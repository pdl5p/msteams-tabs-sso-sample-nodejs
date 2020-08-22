'use strict';

var express = require('express');
var app = express();

// Add the route for handling tabs
// var tabs = require('./tabs');
// tabs.setup(app);

app.get('/', function(req, res) {
    res.send('hello');
});

// Decide which port to use
var port = process.env.PORT || 3333;

// Listen for incoming requests
app.listen(port, function() {
    console.log(`App started listening on port ${port}`);
});
