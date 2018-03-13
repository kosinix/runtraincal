const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const moment = require('moment');
const lodash = require('lodash');
const querystring = require('querystring');

const db = require(path.join(appDir, 'src/db'));
const kalendaryo = require(path.join(appDir, 'src/kalendaryo'));
const helper = require(path.join(appDir, 'src/helper'));


function routerDemo(app){
    
    var router = express.Router();

    router.get('/', function(req, res, next){
        res.send('Demo routes running...');
    });
    router.get('/plan/:uid', function(req, res, next){
        // TODO: sanity checks
        var planUid = req.params.uid;
        var trainingPlan = null;
        helper.getTrainingPlanByUid(planUid).then(function(plan){
            trainingPlan = plan;
            return helper.getTrainingData(plan.id);
            
        }).then(function(trainingData){
            var year = moment.utc().format('YYYY');
            var month = moment.utc().format('MM');
            var now = moment.utc().add(timeZone, 'hours');
            
            var monthView = new kalendaryo.MonthView(year, month, {
                padMode: 1,
                timeZone: timeZone
            });

            var vars = {
                month: monthView,
                monthJson: JSON.stringify(monthView),
                trainingPlanJson: JSON.stringify(trainingPlan),
                trainingDataJson: JSON.stringify(trainingData),
                now:now
            };

            res.render('vue.html', vars );
        }).catch(function(error){
            next(error);
        });
    });

    return router;
}

module.exports = routerDemo;