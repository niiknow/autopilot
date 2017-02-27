'use strict';

class LambdaWrapper {

  constructor(path, handler, logger) {
    this.path = path;
    this.handler = handler;
    this.logger = logger;
  }

  buildEventFromRequest(request) {
    const result = {
      resource: request.path,
      path: request.path,
      httpMethod: request.method.toUpperCase(),
      headers: {},
      queryStringParameters: Object.keys(request.query).length ? request.query : null,
      pathParameters: Object.keys(request.params).length ? request.params : null,
      requestContext: {
        resourcePath: request.path,
        httpMethod: request.method.toUpperCase()
      },
      body: request.body
    };

    // Camel-Case header names, as this is what APIGateway does
    Object.keys(request.headers).forEach((header) => {
      result.headers[this.camelizeHeader(header)] = request.headers[header];
    });

    return result;
  }

  buildContext() {
    // TODO: add additional methods like millis left
    return {};
  }

  camelizeHeader(str) {
    const arr = str.split('-');
    for (let i = 0; i < arr.length; i++) {
      arr[i] = arr[i][0].toUpperCase() + arr[i].slice(1);
    }
    return arr.join('-');
  }

  parseRequestBody(request, cb) {
    request.body = null;
    request.setEncoding('utf8');

    request.on('data', (chunk) => {
      if (request.body === null) {
        request.body = '';
      }
      request.body += chunk;
    });

    request.on('end', cb);
  }

  httpHandler(request, response) {
    var $that = this;

    // parse request body before handling lambda
    $that.parseRequestBody(request, () => {
      const event = $that.buildEventFromRequest(request);
      const context = $that.buildContext();
      const callback = (failure, result) => {
        if (failure) {
          const errorMessage = JSON.stringify(failure);
          $that.logger.log(`λ returned error: ${errorMessage}`);
        }

        // something went wrong
        if (!result || typeof result !== 'object') {
          response
            .status(500)
            .send('Internal server error');
          return;
        }

        const headers = result.headers || {};

        // APIGateway defaults 'Content-Type' if not provided
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }

        response.status(result.statusCode || 200);
        response.set(headers);

        if (result.body) {
          response.send(result.body);
        } else {
          response.end();
        }
      };

      try {
        $that.handler(event, context, callback);
      } catch (e) {
        response
          .status(500)
          .send(`λ Caught ERROR: ${e.message}`);
      }
    });
  }
}

module.exports = LambdaWrapper;
