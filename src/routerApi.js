const path = require('path');
const util = require('util');
const unirest = require('unirest');
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const moment = require('moment');
const lodash = require('lodash');
const querystring = require('querystring');

const db = require(path.join(appDir, 'src/db'));
const rdb = require(path.join(appDir, 'src/rdb'));
const kalendaryo = require(path.join(appDir, 'src/kalendaryo'));
const helper = require(path.join(appDir, 'src/helper'));
const inputGuard = require(path.join(appDir, 'src/inputGuard'));


function routerApi(app){
    
    var router = express.Router();

    router.get('/', function(req, res, next){
        res.send('API running...');
    });
    router.get('/plan-to-calendar-data.json', async (req, res, next)=>{
        try {
            let query = inputGuard.allowedFields(req.query, {
                planUid: {
                    default: 0
                },
                date: {
                    default: null
                },
                anchor: {
                    default: 'start'
                },
            });
            
            
            let plan = await rdb.Plan.findOne({
                where: {
                    uid: query.planUid
                },
                include: [{
                    model: rdb.PlanData
                }],
                order: [
                    [rdb.PlanData, 'trainingDay', 'ASC']
                ]
            });
            let calendarData = {};
            if(plan){
                planData = plan.plan_data;
                let momentStartDate = moment.utc(query.date+'T00:00:00.000Z');
                if(query.anchor=== 'end'){
                    let trainingDays = planData[planData.length-1].trainingDay-1;
                    let momentEndDate = moment.utc(query.date+'T00:00:00.000Z');
                    momentStartDate = momentEndDate.subtract(trainingDays, "days");
                }
                
                calendarData = helper.planToCalendarData(planData, momentStartDate);
            }
            
            res.json(calendarData);
        } catch(err){
            console.log(err);
            res.status(400).send('Something broke');
        }
    });
    router.get('/matrix/:year/:month/:planUid/:startDate', async (req, res, next) => {
        try {
            // TODO: number checks
            var year = req.params.year;
            var month = req.params.month;
            var planUid = req.params.planUid;
            var startDate = req.params.startDate;
            var hourDiff = kalendaryo.helper.getMyTimeZone();

            var monthView = new kalendaryo.MonthView(year, month, {
                padMode: 1,
                timeZone: hourDiff
            });
            let plan = await rdb.Plan.findOne({
                where: {
                    uid: planUid
                },
                include: [{
                    model: rdb.PlanData
                }]
            });
            let planData = {};
            if(plan){
                planData = plan.plan_data.map(function(element){
                    return {
                        date: null,
                        workoutType: element.workoutType,
                        title: element.title,
                        description: element.description,
                        trainingDay: element.trainingDay,
                    }
                });
                planData = helper.adjustTrainingData(planData, moment(startDate));
            }
            
            monthView = helper.attachTrainingDataTo(monthView, planData);
            res.send(monthView);
        } catch(err){
            console.log(err);
            res.status(400).send('Something broke');
        }
    });

    router.get('/month-view.json', async (req, res, next) => {
        try {
            let query = inputGuard.allowedFields(req.query, {
                year: {
                    default: 2018
                },
                month: {
                    default: 1
                },
                timeZone: {
                    default: 0
                },
            });
            
            var monthView = new kalendaryo.MonthView(query.year, query.month, {
                padMode: 1,
                timeZone: query.timeZone // In hours. Eg. GMT+8 = 8
            });
            // let plan = await rdb.Plan.findOne({
            //     where: {
            //         uid: planUid
            //     },
            //     include: [{
            //         model: rdb.PlanData
            //     }]
            // });
            
            res.json(monthView);
        } catch(err){
            console.log(err);
            res.status(400).send('Something broke');
        }
    });

    router.get('/plan/:uid', async (req, res, next)=>{

        try{
            let uid = req.params.uid;
            let plan = await rdb.Plan.findOne({
                where: {
                    uid: uid
                },
                include: [{
                    model: rdb.PlanData
                }]
            });
            
            res.json(plan);
        } catch(err){
            console.log(err)
            res.status(400).send('Something broke');
        }
    });

    router.post('/calendar/update.json', async(req, res, next)=>{
        try {
            let authUser = lodash.get(req, 'session.authUser', null);
            if(authUser===null){
                throw new Error('Unauthenticated');
            }
            let post = inputGuard.allowedFields(req.body, {
                calendarId:{
                    default: null
                },
                title: {
                    default: ''
                },
                dateAnchorPoint: {
                    default: 'end'
                },
                month: {
                    default: 1
                },
                day: {
                    default: 1
                },
                year: {
                    default: 0
                },
                calendarDataCollection: {
                    default: []
                }
            }); 
            post.calendarDataCollection = JSON.parse(post.calendarDataCollection);
            let result = await rdb.sequelize.transaction( async (t)=> {
            
                let isoDateString = kalendaryo.helper.isoDate(post.year, post.month, post.day);
                let momentDateAnchor = moment.utc(isoDateString);

                let calendar = await rdb.Calendar.update({
                    title: post.title,
                    date: momentDateAnchor.format('YYYY-MM-DD'), 
                    dateAnchorPoint: post.dateAnchorPoint, 
                }, {
                    where: {
                        id: post.calendarId
                    },
                    transaction: t
                });
                
                await rdb.CalendarData.destroy({transaction: t, force: true, where: { calendarId: post.calendarId}});

                for(let key in post.calendarDataCollection){
                    let calendarDataList = post.calendarDataCollection[key];
                    for(var x = 0; x < calendarDataList.length; x++){
                        var calendarData = calendarDataList[x];
                        await rdb.CalendarData.create({
                            calendarId: post.calendarId,
                            date: calendarData.date, 
                            workoutType: calendarData.workoutType, 
                            title: calendarData.title, 
                            description: calendarData.description
                        }, {transaction: t});
                    }
                }
                
                res.json({updated: true, calendarId: post.calendarId});
            }); // end transaction

            
        } catch (err){
            console.log(err);
            err = app.get('fromErrToArray')(err);
            res.status(400).json(err);
        }
    });

    router.post('/calendar/create.json', async (req, res, next) => {
        try {
            let authUser = lodash.get(req, 'session.authUser', null);
            if(authUser===null){
                throw new Error('Unauthenticated');
            }
            let post = inputGuard.allowedFields(req.body, {
                
                title: {
                    default: ''
                },
                dateAnchorPoint: {
                    default: 'end'
                },
                month: {
                    default: 1
                },
                day: {
                    default: 1
                },
                year: {
                    default: 0
                },
                calendarDataCollection: {
                    default: []
                }
            }); 
            post.calendarDataCollection = JSON.parse(post.calendarDataCollection);
            let result = await rdb.sequelize.transaction( async (t)=> {
            
                let isoDateString = kalendaryo.helper.isoDate(post.year, post.month, post.day);
                let momentDateAnchor = moment.utc(isoDateString);
                let uid = crypto.randomBytes(8).toString('hex');

                let calendar = await rdb.Calendar.create({
                    uid: uid,
                    title: post.title,
                    date: momentDateAnchor.format('YYYY-MM-DD'), 
                    dateAnchorPoint: post.dateAnchorPoint, 
                    planId: 0
                }, {transaction: t});

                let calendarUser = await rdb.CalendarUser.create({
                    calendarId: calendar.id,
                    userId: authUser.id
                }, {transaction: t});

                for(let key in post.calendarDataCollection){
                    let calendarDataList = post.calendarDataCollection[key];
                    for(var x = 0; x < calendarDataList.length; x++){
                        var calendarData = calendarDataList[x];
                        await rdb.CalendarData.create({
                            calendarId: calendar.id,
                            date: calendarData.date, 
                            workoutType: calendarData.workoutType, 
                            title: calendarData.title, 
                            description: calendarData.description
                        }, {transaction: t});
                    }
                }
                
                res.json({calendarId:calendar.id});
            }); // end transaction

            
        } catch (err){
            console.log(err);
            err = app.get('fromErrToArray')(err);
            res.status(400).json(err);
        }
    
    });

    router.post('/calendar/delete.json', async (req, res, next) => {
        try {
        
            let post = inputGuard.allowedFields(req.body, {
                uid: {
                    default: ''
                },
            });

            let calendar = await rdb.Calendar.findOne({
                where: {
                    uid: post.uid
                }
            });

            if(!calendar) {
                throw new Error('Calendar not found');
            }

            let result = await rdb.sequelize.transaction( async (t)=> {
                await rdb.CalendarData.destroy({transaction: t, where: { calendarId: calendar.id}});
                await rdb.Calendar.destroy({transaction: t, where: { id: calendar.id}});
                await rdb.CalendarUser.destroy({transaction: t, where: { calendarId: calendar.id}});
                res.json({redirect:'/account/calendars.html'});
            });
        } catch (err){
            next(err);
        }
    });

    router.post('/fb-login.json', async (req, res, next) => {
        try {
            let post = inputGuard.allowedFields(req.body, {
                accessToken: {
                    default: ''
                },
                userId: {
                    default: ''
                }
            });

            let fbAppId = '982218988600046';
            let fbAppSecret = '83451ca71869f3e3c33b3dcfb8f13e75';
            let url = 'https://graph.facebook.com/debug_token?input_token=%s&access_token=%s|%s'

            let endPoint = util.format(url, 
                post.accessToken, 
                fbAppId,
                fbAppSecret
            );
            unirest.get(endPoint)
                .end(async (response) => {
                    let package = JSON.parse(response.body);
                    let appId = lodash.get(package, 'data.app_id');
                    let userId = lodash.get(package, 'data.user_id');
                    let error = lodash.get(package, 'data.error', null);
                    if(error!==null){
                        console.log(error);
                        return res.status(400).json(app.get('fromErrToArray')(new Error(error.message)));
                    }
                    if(appId !== fbAppId) {
                        console.log(error);
                        return res.status(400).json(app.get('fromErrToArray')(new Error('App ID dont match.')));
                    }
                    console.log(package);
                    let user = await rdb.User.findOne({
                        where: {
                            fbUserId: userId
                        }
                    });
                    if(user){
                        await user.update({
                            fbAccessToken: post.accessToken
                        });
                    } else {
                        let endPoint = util.format('https://graph.facebook.com/me?fields=id,name,email&access_token=%s', 
                            post.accessToken, 
                        );
                        // unirest.get(endPoint)
                        //     .end(async (response) => {
                                
                        //     });

                        user = await rdb.User.create({
                            fbUserId: userId,
                            fbAccessToken: post.accessToken
                        })
                    }

                    req.session.isAuth = true;
                    req.session.authUser = user.get({ plain: true });
                    res.json(req.session.authUser);
                });
            
        } catch (err){
            console.log(err);
            err = app.get('fromErrToArray')(err);
            res.status(400).json(err);
        }
    });
    return router;
}

module.exports = routerApi;