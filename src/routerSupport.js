const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const moment = require('moment');
const lodash = require('lodash');
const querystring = require('querystring');

const db = require(path.join(appDir, 'src/db'));
const kalendaryo = require(path.join(appDir, 'src/kalendaryo'));
const helper = require(path.join(appDir, 'src/helper'));


module.exports = function (app){
    
    var router = express.Router();

    router.get('/index.html', function(req, res, next){
        res.render('support/index.html');
    });
    

    return router;
}
