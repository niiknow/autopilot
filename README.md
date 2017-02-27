lambdaxrouter
=============

A lambda express router.  Useful for proxying and testing lambda methods.  The router basically simulate APIGateway calls.

-[x] auto map local index.js and folder as API path.
-[x] auto route reload on file changes.


## Installation ##

```bash
$ npm install lambdaxrouter
```

## Usage ##

In your express application main file `server.js`:

```javascript
var express = require('express');
var LambdaXRouter = require('lambdaxrouter');

var app = express();
var router = new LambdaXRouter(app, {... opts ...});

app.use(router.handler());

app.listen(1234);
```

### folder path ###

/user/@user/index.js
- use at(@) symbol in place of colon(:) for path parameter routing

/path/to/index.js

Define a function for each HTTP REST method.  Must be uppercase.
```
exports.GET = (event, context, cb) => {
	context.done('ok get');
};

exports.POST = (event, context, cb) => {
	context.done('ok post');
};
```

If you want all methods to be process in only one function(something not RESTful), just make exports to be the handle function:
```
module.exports = (event, context, cb) => {
	context.done('ok all');
};
```
