'use strict';

const appRoot = process.env.PWD;
const path = require('path');
const glob = require('glob');
const methods = require('methods');
const LambdaWrapper = require('./lib/LambdaWrapper');
const _ = require('lodash');
const reload = require('require-reload')(require);
const fs = require('fs');

/**
 * AutoPilotr
 * 
 * @param  {Express} app  Express app instance
 * @param  {Object}  opts (optional) For additional options
 *                        apiDir            - (default: /api) define different base path
 *                        apiPath           - (default: /) example api path prefix: /api/v1/
 *                        disableAutoReload - (default: false) disable auto reload of route
 *                        logger            - (default: console)
 */
class LambdaXRouter {

  constructor(app, opts) {
  	opts = opts || {};
	opts.apiDir = (opts.apiDir || 'api');
	opts.apiPath = (opts.apiPath || '/');
	opts.logger = (opts.logger || console);
	opts.apiDirFull = path.join(appRoot, opts.apiDir);
	// opts.apiDirFull = 'E:\\1work\\niiknow\\lambdaxrouter\\tests\\api';

    this.app = app;
    this.opts = opts || {};
	this.loadRoutesNow();
	let $that = this;
    if (opts.disableAutoReload) {
    	return;
    }

	// bulk file changes trigger too many reloads. Just wait a
	// little bit AND on windows, fs.watch seems to trigger 2 times
	// for the same file -> so we use debounce
    let reload = _.debounce(() => {
		opts.logger.info('[lambdaxrouter]', 'routing', 'reload');
    	$that.loadRoutesNow() 
    }, 1000);
	fs.watch(opts.apiDirFull, { persistent: true, recursive: true }, (eventType, filename) => {
		// only reload for index file
		if (/[\\\/]+index\.+/gi.test(filename)) {
			reload();
		}
	});
  }

  loadRoutesNow() {
  	let router = this.app.Router();
  	let opts = this.opts;
  	let $that = this;

	function route (url, method, instance) {
		let handler = instance[method.toUpperCase()];

		if (handler) {
			let wrapper = new LambdaWrapper(url, handler, opts.logger);
			// call: app.get, app.post, etc...
			router[method.toLowerCase()].apply(
				router, 
				[url].concat([(req, res) => { wrapper.httpHandler(req, res); }])
			);
		}
	}

	opts.logger.info('[lambdaxrouter]', 'routing', 'start...');
	glob.sync("**/*(index)\.*(coffee|js)", {cwd: opts.apiDirFull }).forEach(function (file) {
		file = path.join(opts.apiDirFull, file);
		file = file.replace(/\.[^.]*$/, '');
		let instance = reload(file);
		let single = typeof instance === 'function';
		let url = file.replace(opts.apiDirFull, '').replace(/\\+/gi, '/').replace(/\@+/, ':').replace(/\/index$/, opts.apiPath);
		
		opts.logger.info('[lambdaxrouter]', 'routing', url);
		single ? route(url, 'ALL', {ALL: instance}) :
			methods.forEach(function (method) {
				if (instance[method.toLowerCase()]) {
					// ignore lower case method
					return;
				}
				route(url, method, instance);
			});
	});

	this.router = router;
  }

  handler() {
    return (req, res, next) => {
        this.router(req, res, next);
    };
  }
}

module.exports = LambdaXRouter;
