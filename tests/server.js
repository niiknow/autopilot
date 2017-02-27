var express = require('express');
var LambdaXRouter = require('../index.js');

var router = new LambdaXRouter(express);

var app = express();
app.use(router.handler());

app.listen(1234);