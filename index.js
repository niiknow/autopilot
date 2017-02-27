'use strict';

const appRoot = process.env.PWD;
const path = require('path');
const glob = require('glob');
const methods = require('methods');
const LambdaWrapper = require('lib/LambdaWrapper');
const _ = require('lodash');
const reload = require('require-reload')(require);

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
	opts.apiDir = (opts.apiDir || 'api');
	opts.apiPath = (opts.apiPath || '/');
	opts.logger = (opts.logger || console);
	opts.apiDirFull = path.join(appRoot, opts.apiDir);

    this.app = app;
    this.opts = opts || {};
	this.loadRoutesNow();
    if (opts.disableAutoReload) {
    	return;
    }

	// bulk file changes trigger too many reloads. Just wait a
	// little bit AND on windows, fs.watch seems to trigger 2 times
	// for the same file -> so we use debounce
    let reload = _.debounce(this.loadRoutesNow, 1000);
	fs.watch(opts.apiDirFull, { persistent: true, recursive: true }, (eventType, filename) => {
		// only reload for index file
		if (filename.indexOf('/index.') >= 0) {
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
		let router = $that.router;

		if (handler) {
			let wrapper = new LambdaWrapper(url, handler, opts.logger);
			// call: app.get, app.post, etc...
			router[method.toLowerCase()].apply(
				router, 
				[url].concat([wrapper])
			);
		}
	}

	glob.sync(opts.apiDirFull + "/**/index\.(coffee|js)").forEach(function (file) {
		file = file.replace(/\.[^.]*$/, '');
		let instance = reload(file);
		let single = typeof instance == 'function';
		let url = file.replace(opts.apiDirFull, '').replace(/\@+/, ':').replace(/\/index$/, opts.apiPath);
		
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
