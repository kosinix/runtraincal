const path = require('path');
const util = require('util');
const express = require('express');
const bcrypt = require('bcrypt');
const moment = require('moment');
const lodash = require('lodash');
const querystring = require('querystring');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const sanitizer = require('sanitizer');

const db = require(path.join(appDir, 'src/db'));
const rdb = require(path.join(appDir, 'src/rdb'));
const orElse = require(path.join(appDir, 'src/orElse'));
const helper = require(path.join(appDir, 'src/helper'));
const kalendaryo = require(path.join(appDir, 'src/kalendaryo'));
const balido = require(path.join(appDir, 'src/balido'));
const inputGuard = require(path.join(appDir, 'src/inputGuard'));


function routerAdmin(app){
    
    var router = express.Router();

    // Auth access middleware
    router.use( (req, res, next) => {
        var exclude = [
            'GET/account/register.html',
            'GET/account/activation-sent.html',
            'GET/account/activate.html',
            'GET/account/login.html',
            'GET/account/logout.html',
            'POST/account/register.json',
            'POST/account/login.json',
        ];
        var requestInfo = req.method + req.baseUrl + req.path;
        
        if( 
            (req.session.isAuth === undefined || req.session.isAuth === false)
            && lodash.findIndex(exclude, (o)=>{ return o === requestInfo; }) === -1
        ){
            var qs = querystring.stringify({
                'redirect_to': appUrl+req.originalUrl
            });
            
            return res.redirect('/account/login.html?'+qs);
        } else {
            
            next();
        }
    });

    router.get('/calendars.html', async (req, res, next)=> {
        try {
            let user = req.session.authUser;
            let calendars = await rdb.Calendar.findAll({
                raw: true,
                include: [{
                    model: rdb.CalendarUser,
                    where: {
                        userId: user.id
                    }
                }]
            })
            res.render('account/calendars.html', {calendars:calendars});
        
        } catch(err){
            next(err);
        }
    });

    router.get('/calendar/create.html', async (req, res, next) => {
        try {
            
            let now = getDateTimeNow();
            let rows = await rdb.Plan.findAll({
                raw: true,
                order:[
                    ['length', 'ASC']
                ]
            });
            let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            res.render('account/calendar/create.html', {now:now, plans: JSON.stringify(rows), months: JSON.stringify(months)});
        } catch(err){
            next(err);
        }
    });

    router.post('/calendar/create.json', async (req, res, next) => {
        try {
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
                planId: {
                    default: 0
                },
            });
            
            let result = await rdb.sequelize.transaction( async (t)=> {
            
                let isoDateString = kalendaryo.helper.isoDate(post.year, post.month, post.day);
                let momentDateAnchor = moment.utc(isoDateString);
                let uid = crypto.randomBytes(8).toString('hex');

                let calendar = await rdb.Calendar.create({
                    uid: uid,
                    title: post.title,
                    date: momentDateAnchor.format('YYYY-MM-DD'), 
                    dateAnchorPoint: post.dateAnchorPoint, 
                    planId: post.planId
                }, {transaction: t});

                let calendarUser = await rdb.CalendarUser.create({
                    calendarId: calendar.id,
                    userId: req.session.authUser.id
                }, {transaction: t});

                 let planData = await rdb.PlanData.findAll({
                    raw: true,
                    where: {
                        planId: post.planId
                    },
                    order: [
                        ['trainingDay', 'ASC'],
                        ['id', 'ASC'],
                    ],
                    transaction: t
                });

                if(planData.length > 0) { // Add data
                
                    if(post.dateAnchorPoint==='end'){
                        let trainingDays = planData[planData.length-1].trainingDay;
                        momentDateAnchor.subtract(trainingDays-1, 'days');
                    }

                    let timeIsGoldMine = planData.map((element)=>{
                        let date = momentDateAnchor.clone().add(element.trainingDay-1, 'days').format('YYYY-MM-DD');
                        
                        return {
                            date: date,
                            workoutType: element.workoutType,
                            title: element.title,
                            description: element.description,
                        }
                    });

                    
                    for(let index=0; index < timeIsGoldMine.length; index++){
                        var element = timeIsGoldMine[index];
                        await rdb.CalendarData.create({
                            calendarId: calendar.id, 
                            date: element.date, 
                            workoutType: element.workoutType, 
                            title: element.title, 
                            description: element.description
                        }, {transaction: t});
                    }
                    
                }
                let url = util.format('/account/calendar/read.html?uid=%s&year=%s&day=%s', uid, momentDateAnchor.format('YYYY'), momentDateAnchor.format('MM'))
                res.json({redirectTo:url});
            }); // end transaction

            
        } catch (err){
            console.log(err);
            err = app.get('fromErrToArray')(err);
            res.status(400).json(err);
        }
    
    });

    router.get('/calendar/read.html', async (req, res, next) => {
        try{
            let query = inputGuard.allowedFields(req.query, {
                uid: {
                    default: ''
                },
                year: {
                    default: moment.utc().format('YYYY')
                },
                month: {
                    default: moment.utc().format('MM')
                },
            });

            var calendar = await rdb.Calendar.findOne({
                where: {
                    uid: query.uid
                }, 
                raw:true
            });
            if(!calendar){
                throw new Error('Calendar not found.');
            }

            var calendarData = await rdb.CalendarData.findAll({
                where: {
                    calendarId: calendar.id
                }, 
                raw:true
            });

            var plans = await rdb.Plan.findAll();
            var trainingPlan = await rdb.Plan.findOne({
                where: {
                    id: calendar.planId
                }
            });

            var monthView = new kalendaryo.MonthView(query.year, query.month, {
                padMode: 1,
                timeZone: timeZone
            });

            var attachCalendarData = (monthView, calendarData)=> {
                var fnMapMonth = (row)=>{
                    row = row.map((dayObject)=>{
                        var items = lodash.filter(calendarData, (el)=>{
                            return el.date === dayObject.iso.split('T')[0];
                        });

                        dayObject.cssClass = dayObject.type;

                        if(monthView.nowDate === dayObject.iso.split('T')[0]){
                            dayObject.cssClass += ' now';
                        }
                        dayObject.info = [];

                        lodash.forEach(items, (gold, key)=>{
                            dayObject.info.push({
                                title: gold.title,
                                description: gold.description,
                            });
                        });
                        return dayObject;
                    });
                    return row;
                };

                monthView.matrix = monthView.matrix.map(fnMapMonth);

                return monthView;
            };

            calendar.date = moment.utc(calendar.date+'T00:00:00.000Z');
            res.render('account/calendar/read.html', {
                calendar: calendar,
                plans: plans,
                monthView: attachCalendarData(monthView, calendarData),
                uid: query.uid,
                months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                now: getDateTimeNow(),
                trainingPlan: trainingPlan
            });

        } catch (err) {
            next(err);
        };
        
    });

    router.post('/calendar/update', async (req, res, next) => {
        try {
            let result = await rdb.sequelize.transaction( async (t)=>{
                let post = inputGuard.allowedFields(req.body, {
                    title: {
                        default: ''
                    },
                    id: {
                        default: 0
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
                    planId: {
                        default: 0
                    },
                });

                // TODO: validations
                if(post.name === '') throw new Error('Please provide a Title');
            
                let isoDateString = kalendaryo.helper.isoDate(post.year, post.month, post.day);
                let momentDateAnchor = moment.utc(isoDateString);

                let calendar = await rdb.Calendar.findOne({where: {id: post.id}});
                if(!calendar){
                    throw new Error('Calendar not found');
                }

                // ORDER BY is important to get the correct first and last date
                let calendarDataCollection = await rdb.CalendarData.findAll({
                    where: {
                        calendarId: post.id
                    },
                    order: [
                        ['date', 'ASC']
                    ]
                });

                let result = await calendar.update({
                    title: post.title, 
                    date: momentDateAnchor.format('YYYY-MM-DD'), 
                    dateAnchorPoint: post.dateAnchorPoint,
                }, {transaction: t});


                if(calendarDataCollection.length > 0) { // No data
                    
                    var momentFirstDate = moment.utc(calendarDataCollection[0].date+'T00:00:00.000Z');
                    var momentLastDate = moment.utc(calendarDataCollection[calendarDataCollection.length-1].date+'T00:00:00.000Z');

                    var trainingDays = momentLastDate.diff(momentFirstDate, 'days');
                    var daysDiff = momentDateAnchor.diff(momentFirstDate, 'days');

                    if(post.dateAnchorPoint==='end'){
                        daysDiff = daysDiff - trainingDays;
                    }
                    if(daysDiff!==0) {
                        for (var i = 0; i < calendarDataCollection.length; i++){
                            var calendarData = calendarDataCollection[i];
                            var momentDate = moment.utc(calendarData.date+'T00:00:00.000Z');
                            momentDate.add(daysDiff, 'days');
                            await calendarData.update({
                                date: momentDate.format('YYYY-MM-DD')
                            }, {transaction: t});
                        };
                    } else {
                        console.log('Mass update skipped')
                    }
                
                }
            
                var url = util.format('/account/calendar/read.html?uid=%s&year=%s&month=%s', calendar.uid, momentDateAnchor.format('YYYY'), momentDateAnchor.format('MM'))
                res.redirect(url);
            });
        } catch (err){
            next(err);
        };
    
    });

    router.post('/calendar/delete', async (req, res, next) => {
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
                res.redirect('/account/calendars.html');
            });
        } catch (err){
            next(err);
        }
    });

    router.get('/day/read.html', async(req, res, next) => {
        try{
            let query = inputGuard.allowedFields(req.query, {
                uid: {
                    default: ''
                },
                year: {
                    default: 0
                },
                month: {
                    default: 0
                },
                day: {
                    default: 0
                },
            });

            let momentNow = getDateTimeNow();
            let currentDate = util.format('%s-%s-%s', lodash.padStart(query.year, 4, '0'), lodash.padStart(query.month, 2, '0'), lodash.padStart(query.day, 2, '0'));

            // TODO: user check
            let calendar = await rdb.Calendar.findOne({where: {uid: query.uid}});
            if(!calendar){
                throw new Error('Calendar not found');
            }

            // TODO: user check
            let timeIsGoldMine = await rdb.CalendarData.findAll({where: { calendarId: calendar.id}});

            timeIsGoldMine = timeIsGoldMine.map((element)=>{
                return {
                    id: element.id,
                    date: element.date,
                    type: element.workoutType,
                    title: element.title,
                    description: orElse(element.description, ''),
                }
            });

            let gold = lodash.filter(timeIsGoldMine, (el)=>{
                return el.date === currentDate;
            });
            
            let dayView = new kalendaryo.DayView(query.year, query.month, query.day, {
                timeZone: timeZone
            });
            
            let vars = {
                dayView: dayView,
                now: momentNow,
                uid: query.uid,
                gold: gold
            };
            res.render('account/day/read.html', vars );
            
        } catch(err){
            next(err);
        }
    });

    router.get('/event/create.html', async (req, res, next) => {
        try{
            // TODO: sanity checks
            var uid = req.query.uid;
            var year = parseInt(req.query.year);
            var month = parseInt(req.query.month);
            var day = parseInt(req.query.day);

            var momentNow = getDateTimeNow();
            var currentDate = util.format('%s-%s-%s', lodash.padStart(year, 4, '0'), lodash.padStart(month, 2, '0'), lodash.padStart(day, 2, '0'));

            var dayView = new kalendaryo.DayView(year, month, day, {
                timeZone: timeZone
            });
            
            var vars = {
                dayView: dayView,
                now: momentNow,
                uid: uid
            };
            res.render('account/event/create.html', vars );
        } catch (err) {
            next(err);
        }
    });
    router.post('/event/create', async (req, res, next) => {
        try {
            // TODO: sanity checks
            var uid = req.query.uid;
            var year = parseInt(req.query.year);
            var month = parseInt(req.query.month);
            var day = parseInt(req.query.day);

        
            var defaults = {
                title:'',
                description: '',
                workoutType: ''
            };

            var post = Object.assign(defaults, req.body);
            await db.run('BEGIN');

            if(post.title === '') throw new Error('Please provide a Title');
            if(post.workoutType === '') throw new Error('Please provide a Type');
            
            var isoDateString = kalendaryo.helper.isoDate(year, month, day);
            var momentDate = moment.utc(isoDateString);

            var calendar = await db.get("SELECT * FROM calendar AS c LEFT JOIN calendar_user AS cu ON c.id = cu.calendar_id WHERE c.uid = ? AND cu.user_id = ?", [uid, req.session.authUser['id']]);
            if(!calendar){
                throw new Error('Calendar not found');
            }

            var result = await db.run("INSERT INTO calendar_data (calendarId, date, workoutType, title, description) VALUES (?, ?, ?, ?, ?)", [calendar.id, momentDate.format('YYYY-MM-DD'), post.workoutType, post.title, post.description]);

            if(!result){
                throw new Error('Error creating calendar data');
            }

            var calendarDataId = result.lastID;

            await db.run('COMMIT');
            var url = util.format('/account/day/read.html?uid=%s&year=%s&month=%s&day=%s', uid, momentDate.format('YYYY'), momentDate.format('MM'), momentDate.format('DD'))
            res.redirect(url);
        } catch (err){
            await db.run('ROLLBACK');
            
            next(err);
        }
        
    });

    router.get('/event/update.html', async (req, res, next) => {
        try{
            let query = inputGuard.allowedFields(req.query, {
                uid: {
                    default: ''
                },
                eventId: {
                    default: 0
                },
            });

            var momentNow = getDateTimeNow();
            
            var event = await rdb.CalendarData.findOne({
                where:{
                    id: query.eventId
                },
                include: [
                    {
                        model: rdb.Calendar,
                        
                    }
                ]
            });
            console.log(query, event)
            if(!event){
                throw new Error('Calendar event not found.');
            }

            var vars = {
                now: momentNow,
                uid: query.uid,
                event: event
            };
            res.render('account/event/update.html', vars );
        } catch(err){
            next(err);
        }
    });

    router.post('/event/update', async (req, res, next) => {
        try {
            // TODO: sanity checks
            var uid = req.query.uid;
        
            var defaults = {
                id:'',
                title:'',
                description: '',
                workoutType: ''
            };

            var post = Object.assign(defaults, req.body);

            await db.run('BEGIN');

            if(post.title === '') throw new Error('Please provide a Title');
            if(post.workoutType === '') throw new Error('Please provide a Type');
            
            

            var calendar = await db.get("SELECT * FROM calendar AS c LEFT JOIN calendar_user AS cu ON c.id = cu.calendar_id WHERE c.uid = ? AND cu.user_id = ?", [uid, req.session.authUser['id']]);
            if(!calendar){
                throw new Error('Calendar not found');
            }

            var event = await db.get("SELECT * FROM calendar_data AS c LEFT JOIN calendar_user AS cu ON c.calendarId = cu.calendar_id WHERE c.id = ? AND cu.user_id = ?", [post.id, req.session.authUser['id']]);
            if(!event){
                throw new Error('Calendar event not found');
            }

            var result = await db.run("UPDATE calendar_data SET workoutType = ?, title = ?, description = ? WHERE id = ?", [post.workoutType, post.title, post.description, post.id]);

            if(!result){
                throw new Error('Error updating calendar data');
            }

            await db.run('COMMIT');

            var isoDateString = event.date+'T00:00:00.000Z';
            var momentDate = moment.utc(isoDateString);

            var url = util.format('/account/day/read.html?uid=%s&year=%s&month=%s&day=%s', uid, momentDate.format('YYYY'), momentDate.format('MM'), momentDate.format('DD'))
            res.redirect(url);
        } catch (err){
            await db.run('ROLLBACK');
            
            next(err);
        }
        
    });

    router.get('/event/delete', async (req, res, next) => {
        try {
        
            var defaults = {
                uid:'',
                event:0
            };
            var query = Object.assign(defaults, req.query);

            var event = await db.get('SELECT * FROM calendar_data AS cd LEFT JOIN calendar_user AS cu ON cd.calendarId = cu.calendar_id WHERE cd.id = ? AND cu.user_id = ?', [query.event, req.session.authUser.id]);

            if(!event) {
                throw new Error('Calendar event not found');
            }

            await db.run('BEGIN');
            await db.run('DELETE FROM calendar_data WHERE id = ?', [query.event]);
            
            
            var isoDateString = event.date+'T00:00:00.000Z';
            var momentDate = moment.utc(isoDateString);

            var url = util.format('/account/day/read.html?uid=%s&year=%s&month=%s&day=%s', query.uid, momentDate.format('YYYY'), momentDate.format('MM'), momentDate.format('DD'));
            res.redirect(url);
            await db.run('COMMIT');
        } catch (err){
            await db.run('ROLLBACK');
            next(err);
        }
    });

    router.get('/register.html', async (req, res, next) => {
        try{
            res.render('register.html');
        } catch (err){
            next(err);
        }
    });

    router.post('/register.json', async (req, res, next) => {
        try{
            let result = await rdb.sequelize.transaction( async (t)=>{
                let config = app.get('config');
                
                let post = inputGuard.allowedFields(req.body, {
                    email: {
                        default: ''
                    },
                    password: {
                        default: ''
                    },
                    terms: {
                        default: ''
                    }
                });
                if(post.email === '') {
                    throw new Error('Please provide an Email.');
                }
                if(post.password === '') {
                    throw new Error('Please provide a Password.');
                }
                if(post.terms !== 'true') {
                    throw new Error('Please agree to the terms.');
                }
                let user = await rdb.User.findOne({where: { email: post.email }});
                console.log('user', user);
                
                if(user){
                    throw new Error('Email already taken.');
                }
                 

                let email = post.email;
                let uid = crypto.randomBytes(16).toString('hex');
                let activation_link = global.appUrl+'/verify-email.html?uid='+uid;
                let help_link = global.appUrl+'/support.html';
                let nunjucksEnv = app.get('nunjucksEnv');
                let messageText = nunjucksEnv.render('email/activate.txt', {activation_link: activation_link, help_link: help_link});
                let messageHtml = nunjucksEnv.render('email/activate.html', {activation_link: activation_link, help_link: help_link});

                if(config.mail.enable){
                    let transporter = app.get('smtpTransporter');
                    let info = await transporter.sendMail({
                        from: 'Run Training Calendar <mailer@runtrainingcalendar.com>',
                        to: email,
                        bcc: 'amarillanico@gmail.com',
                        subject: 'Verify Account',
                        text: messageText,
                        html: messageHtml
                    });
                    console.log('envelope', info.envelope);
                    console.log('id', info.messageId);
                } else {
                    console.log(messageText);
                }

                let passwordHash = await bcrypt.hash(post.password, config.bcrypt.saltRounds);

                user = await rdb.User.create({
                    email: email,
                    passwordHash: passwordHash,
                    active: 0
                }, {transaction: t});
                console.log('user', user)
                await rdb.VerifyEmailToken.create({
                    userId: user.id,
                    uid: uid
                }, {transaction: t});

                res.json({redirectTo: appUrl+'/account/activation-sent.html'});
            });
        } catch (err){
            console.log(err);
            err = app.get('fromErrToArray')(err);
            res.status(400).json(err)
        }
    });

    router.get('/activation-sent.html', async (req, res, next) => {
        try{
            res.render('activation-sent.html');
        } catch (err){
            next(err);
        }
    });

    router.get('/activate.html', async (req, res, next) => {
        try{
            res.render('activate.html');
        } catch (err){
            next(err);
        }
    });
    router.get('/login.html', (req, res, next) => {
        var redirectTo = req.query.redirect_to || '';
        
        res.render('login.html', {redirectTo:redirectTo});
    });

    router.post('/login.json', async (req, res, next) => {
        try {
            let post = inputGuard.allowedFields(req.body, {
                redirectTo: {
                    default: ''
                },
                email: {
                    default: ''
                },
                password: {
                    default: ''
                },
            });
            
            if(!post.email){
                throw new Error('Please provide an Email.');
            }
            if(!post.password){
                throw new Error('Please provide a Password.');
            }
            console.log(post);
            let user = await rdb.User.findOne({
                raw: true,
                where: {
                    email: post.email
                }
            });
            
            if(!user){
                throw new Error ('User not found.');
            }
            
            if(!user.active){
                throw new Error('Account must be activated.');
            }

            let isCorrect = await bcrypt.compare(post.password, user.passwordHash);
            if(!isCorrect){
                throw new Error('Password is incorrect.');
            }

            // Security: we only redirect on our own pages
            let whiteList = [
                appUrl+'/account/calendar/create',
                appUrl+'/account/calendar/read',
                appUrl+'/account/calendar/update',
                appUrl+'/account/calendar/delete',
            ];
            let redirectTo = appUrl+'/account/calendars.html';
            let index = lodash.findIndex(whiteList, (o)=>{ 
                return o === post.redirectTo; 
            })
            if( index !== -1){
                redirectTo = whiteList[index];
            }

            req.session.isAuth = true;
            req.session.authUser = user;

            res.json({
                redirectTo: redirectTo
            });
            
        } catch (err) {
            console.log(err);
            err = app.get('fromErrToArray')(err);
            res.status(400).json(err);
        }
    });

    router.get('/logout.html', (req, res, next) => {
        req.session.isAuth = false;
        req.session.authUser = null;
        
        res.app.locals.isAuth = req.session.isAuth;
        res.app.locals.authUser = req.session.authUser;
  
        res.render('logout.html');
    });

    return router;
}


module.exports = routerAdmin;