// Core modules
const crypto = require('crypto');
const path = require('path');
const util = require('util');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json'));

global.appDir = path.resolve(__dirname);
global.scheme = config.scheme || 'http';
global.host = config.host || 'localhost';
global.port = config.port || '80';
global.appUrl = config.appUrl || global.scheme+'://'+global.host;

const express = require('express');
const bcrypt = require('bcrypt');
const nunjucks = require('nunjucks');
const session = require('express-session'); // Session engine
const SQLiteStore = require('connect-sqlite3')(session); // Save session to sqlite db
const compression = require('compression'); // Gzip response

const moment = require('moment');
const bodyParser = require('body-parser');
const sanitizer = require('sanitizer');
const nodemailer = require('nodemailer');

const lodash = require('lodash');
const kalendaryo = require('./src/kalendaryo');
const trainingData = require('./src/training');
const orElse = require('./src/orElse');
const db = require('./src/db');
const rdb = require('./src/rdb');
const balido = require(path.join(appDir, 'src/balido'));

const routerAdmin = require('./src/routerAdmin');
const routerApi = require('./src/routerApi');
const routerDemo = require('./src/routerDemo');
const routerSupport = require('./src/routerSupport');
const helper = require('./src/helper');
const inputGuard = require('./src/inputGuard');

global.timeZone = kalendaryo.helper.getMyTimeZone();
global.getDateTimeNow = function(){
    return moment.utc().add(timeZone, 'hours');
}


// App
const app = express();
const isDev = app.get('env') === 'development';

const credentials = JSON.parse(fs.readFileSync('credentials'));



// App directories
const dirView = path.join(__dirname, 'views');
const dirPublic = path.join(__dirname, 'public');

//// Setup view
// Setup nunjucks loader. See https://mozilla.github.io/nunjucks/api.html#loader
const loaderFsNunjucks = new nunjucks.FileSystemLoader( [dirView], {
    watch: isDev,
    noCache: isDev
});

// Setup nunjucks environment. See https://mozilla.github.io/nunjucks/api.html#environment
var envNunjucks = new nunjucks.Environment(loaderFsNunjucks, {
    autoescape: true,
    throwOnUndefined: false,
    trimBlocks: false,
    lstripBlocks: false
});

// Add global vars available to all templates
envNunjucks.addGlobal('baseUrl', global.appUrl);
envNunjucks.addGlobal('title', 'Run Training Calendar - Web App');

// Add to express
envNunjucks.express(app);
// With envNunjucks.express, view and env are auto set. Access them via:
// app.get('view');
// app.get('nunjucksEnv');

// Use compression
app.use(compression());

// Static dir 
app.use(express.static(dirPublic));

// Parse http body
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

// Cookie settings
var cookieSettings = {
    httpOnly: false,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
}
if (app.get('env') === 'production') {
    app.set('trust proxy', 1); // trust first proxy
    cookieSettings.httpOnly = true;
    cookieSettings.secure = true; // serve secure cookies
}

// Use the session middleware 
app.use(session({
    store: new SQLiteStore({db: 'sessions.db', dir:'./data'}),
    secret: credentials.session.secret,
    cookie: cookieSettings, // 1 week
    resave: false,
    saveUninitialized: false
}));

// Validator middleware
// Note: this line must be immediately after any of the bodyParser middlewares!
// app.use(expressValidator({
//     customValidators: {}
// }));

// Setup mailer 
var sendmailTransporter = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail'
});
app.set('sendmailTransporter', sendmailTransporter);


var smtpTransporter = nodemailer.createTransport({
    host: credentials.SMTP.host,
    port: 465, // NOTE: Port 465 for secure connections
    secure: true,
    auth: {
        user: credentials.SMTP.user,
        pass: credentials.SMTP.pass
    }
});
app.set('smtpTransporter', smtpTransporter);

app.set('config', config);

app.set('fromErrToArray', (err) => {
    let arr = [];
    if(err instanceof Error){
        arr.push(err.message);
    } else if (err instanceof Array){
        arr = err;
    } else if (err instanceof Object){
        arr = JSON.stringify(err);
    } else {
        arr.push('Cannot convert error.');
    }
    return arr;
});

app.use(function(req,res,next){
    // console.log('isAuth', req.session.isAuth);
    res.app.locals.isAuth = req.session.isAuth;
    res.app.locals.authUser = req.session.authUser;
    next();
});

// Admin routes - Must come first
app.use('/account', routerAdmin(app));

app.use('/api', routerApi(app));

app.use('/demo', routerDemo(app));

app.use('/support', routerSupport(app));


// Routes
app.get('/', async (req, res, next) => {
    try{
        // TODO: number checks
        var year = 2018;
        var month = 2;
        var hourDiff = kalendaryo.helper.getMyTimeZone();

        var monthView = new kalendaryo.MonthView(year, month, {
            padMode: 1,
            timeZone: hourDiff
        });
            
        let plan = await rdb.Plan.findOne({
            where: {
                uid: 'beginner-5k'
            },
            include: [{
                model: rdb.PlanData
            }]
        });

        let planData = plan.plan_data.map(function(element){
        return {
            date: null,
            workoutType: element.workoutType,
            title: element.title,
            description: element.description,
            trainingDay: element.trainingDay,
        }
        });
        console.log(planData)
        let sql = 'SELECT * FROM plan ORDER BY plan.length';
        let rows = await db.all(sql);
        res.render('index.html', {
            bodyClass:'home', 
            plans: rows,
            monthView: JSON.stringify(monthView),
            plan: JSON.stringify(plan),
            planData: JSON.stringify(planData),
        });
    } catch(err){
        console.log(err);
        res.status(400).send('Error')
    }
});

// app.get('/import', async (req, res, next) => {
//     try{
//         let planId = 9;
//         let weeks = [
//   ["Off","3M","Fartlek 5M","3M","6M","3M","6M"  ],
//   ["Off","4M","Fartlek 5M","4M","5M","4M","7M"  ],
//   ["Off","4M","5-6 Hills 5K-10K pace","4M","6M","3M","8M"  ],
//   ["Off","5M","6 x 440s 5K pace","4M","6M","3M","9M"  ],
//   ["Off","5M","4-5 long hills 5K-10K pace","4M","6M","3M","5K race"  ],
//   ["Off","5M","5 x 880s 5K-10K pace","5M","7M","3M","8M"  ],
//   ["Off","5M","5-6 long hills 5K-10K pace","4M","7M","4M","10M"  ],
//   ["Off","5M","8 x 440s 5k pace","4M","7M","4M","10K Race"  ],
//   ["Off","5M","7 x 880s 5K-10K pace","4M","7M","4M","8M"  ],
//   ["Off","4 x Mile 5K-10K pace","5M","5M","5 x Fast 440s 5K pace","4M","8M"  ],
//   ["Off","8 x 440s 5K pace","5M","5M","4 x Fast 880s 5k pace","3M","5M"  ],
//   ["Off","6 x 440s 5K pace","5M","3M","Off","4M","Race Day"  ]
// ];
//         let days = lodash.flatten(weeks);

//         for(let trainingDay = 0; trainingDay < days.length; trainingDay++){
//             let workoutType = "run";
//             let day = lodash.trim(days[trainingDay]);
//             let searchee = lodash.trim(lodash.toLower(day));
//             if(searchee==="off"){
//                 workoutType = "rest";
//             } else if(searchee.indexOf("race")!==-1){
//                 workoutType = "race";
//             } else {
//                 day = lodash.replace(day, "2M", "3 km");
//                 day = lodash.replace(day, "3M", "5 km");
//                 day = lodash.replace(day, "5M", "8 km");
//                 day = lodash.replace(day, "4M", "6 km");
//                 day = lodash.replace(day, "6M", "10 km");
//                 day = lodash.replace(day, "7M", "11 km");
//                 day = lodash.replace(day, "8M", "12 km");
//                 day = lodash.replace(day, "9M", "14 km");
//                 day = lodash.replace(day, "10M", "16 km");
//                 day = lodash.replace(day, "12M", "19 km");
//                 day = lodash.replace(day, "15M", "24 km");
//                 day = lodash.replace(day, "20M", "32 km");
//                 day = lodash.replace(day, "22M", "35 km");
//                 day = lodash.replace(day, "24M", "39 km");
//                 day = lodash.replace(day, "26M", "42 km");
//                 day = lodash.replace(day, "880s", "800 meters");
//                 day = lodash.replace(day, "440s", "400 meters");
//             }
//             let result = await db.run("INSERT INTO plan_data (plan_id, workoutType, title, description, trainingDay) VALUES (?, ?, ?, ?, ?)",[planId,workoutType,day,"",trainingDay+1]);
//         }
        
//         res.send("Import done");
//     } catch(err){
//         console.log(err);
//         res.send("error");
//     }
// });

// app.get('/mail', async (req, res, next) => {
//   try{

//     let nunjucksEnv = app.get('nunjucksEnv');
//     let messageText = nunjucksEnv.render('email/activate.txt', {activation_link: '#', help_link: '#'});
//     let messageHtml = nunjucksEnv.render('email/activate.html', {activation_link: '#', help_link: '#'});

//     let transporter = app.get('smtpTransporter');
//     let info = await transporter.sendMail({
//         from: 'Run Training Calendar <mailer@runtrainingcalendar.com>',
//         to: 'amarillanico@gmail.com',
//         subject: 'Verify Email Address',
//         text: messageText,
//         html: messageHtml
//     });
//     console.log(info.envelope);
//     console.log(info.messageId);

//     res.send(messageHtml+messageText);

//   } catch (err){
//     next(err);
//   }
// });

// TODO: support.html


app.get('/verify-email.html', async (req, res, next) => {

    try{
        await rdb.sequelize.transaction(async(t)=>{
            let query = inputGuard.allowedFields(req.query, {
                uid: {
                    default: ''
                }
            })

            let verify = await rdb.VerifyEmailToken.findOne({
                where:{ uid: query.uid },
                include: [{
                    model: rdb.User
                }],
            });

            if(!verify){
                throw new Error('User or token not found.');
            }

            var momentCreated = moment.utc(verify.createdAt);
            var momentNow = moment.utc();
            var diff = momentNow.diff(momentCreated, 'hours');
            if(diff>24){ // expired after 24 hours
                throw new Error('Token has expired.');
            }

            await rdb.User.update({
                active: 1
            }, {
                transaction:t, 
                where:{ email: verify.user.email}
            });

            await rdb.VerifyEmailToken.destroy({
                transaction:t, 
                force: true,
                where:{ userId: verify.userId}
            });

            res.render('account-verified.html');
        });
    } catch (err){
        next(err);
    }
});
app.get('/calendars.html', async (req, res, next) => {
    try {
        let rows = await db.all('SELECT * FROM plan ORDER BY plan.length');
        res.render('calendars.html', {calendars:rows});
    } catch (err) {
        next(err);
    }
});

app.get('/about-us.html', async (req, res, next) => {
    try {
        res.render('about-us.html');
    } catch (err) {
        next(err);
    }
});

app.get('/privacy-policy.html', async (req, res, next) => {
    try {
        res.render('privacy-policy.html');
    } catch (err) {
        next(err);
    }
});


app.get('/contact-us.html', async (req, res, next) => {
    try {
        res.render('contact-us.html');
    } catch (err) {
        next(err);
    }
});

app.get('/forgot-password.html', async (req, res, next) => {
    try {
        res.render('forgot-password.html');
    } catch (err) {
        next(err);
    }
});

app.post('/forgot-password.json', async (req, res, next) => {
    try {
        await rdb.sequelize.transaction( async(t)=>{
            let post = inputGuard.allowedFields(req.body, {
                email: {
                    default: ''
                }
            });

            if(post.email === '') {
                throw new Error("Please type your Email.");
            }

            post.email = sanitizer.sanitize(post.email);

            let user = await rdb.User.findOne({
                where: {
                    email: post.email,
                    active: 1
                }
            });
            if(!user){
                throw new Error('User not found.');
            }

            let uid = crypto.randomBytes(16).toString('hex');

            await rdb.PasswordResetToken.create({
                userId: user.id,
                uid: uid
            }, {transaction: t});
            

            let change_password_link = global.appUrl+'/password-reset.html?uid='+uid;
            let nunjucksEnv = app.get('nunjucksEnv');
            let messageText = nunjucksEnv.render('email/forgot-password.txt', {change_password_link: change_password_link});
            let messageHtml = nunjucksEnv.render('email/forgot-password.html', {change_password_link: change_password_link});

            let transporter = app.get('smtpTransporter');
            let info = await transporter.sendMail({
                from: 'Run Training Calendar <mailer@runtrainingcalendar.com>',
                to: user.email,
                subject: 'Forgot Password',
                text: messageText,
                html: messageHtml
            });

            res.json({
                email: user.email
            });
        });
    } catch (err) {
        console.log(err);
        err = app.get('fromErrToArray')(err);
        res.status(400).json(err)
    }
});

app.get('/password-reset.html', async (req, res, next) => {

    try{
        let defaults = {
            uid:''
        };
        let query = Object.assign(defaults, req.query);
        res.render('password-reset.html', {uid: query.uid});
    } catch (err){
        next(err);
    }
});

app.post('/password-reset.json', async (req, res, next) => {
    try{
        await rdb.sequelize.transaction( async (t)=>{
            let config = app.get('config');

            let post = inputGuard.allowedFields(req.body, {
                uid: {
                    default: ''
                },
                password: {
                    default: ''
                },
                passwordConfirm: {
                    default: ''
                },
            });

            post.uid = sanitizer.sanitize(post.uid);
            post.password = sanitizer.sanitize(post.password);
            post.passwordConfirm = sanitizer.sanitize(post.passwordConfirm);

            if(post.password===''){
                throw new Error('Please provide a Password.');
            }
            if(post.passwordConfirm===''){
                throw new Error('Confirm Password is blank.');
            }

            let verify = await rdb.PasswordResetToken.findOne({
                where: {
                    uid: post.uid
                },
                include: [{
                    model: rdb.User,
                    where: {
                        active: 1
                    }
                }]
            })
            
            if(!verify){
                throw new Error('User or token not found.');
            }
            let momentCreated = moment.utc(verify.createdAt);
            let momentNow = moment.utc();
            let diff = momentNow.diff(momentCreated, 'hours');
            if(diff>24){ // expired after 24 hours
                throw new Error('Token has expired.')
            }

            
            if(post.password.length < 8){
                throw new Error('Password must be 8 or more characters.');
            }
            
            if(post.passwordConfirm !== post.password){
                throw new Error('Passwords do not match.');
            }
            
            let passwordHash = await bcrypt.hash(post.password, config.bcrypt.saltRounds);

            await rdb.User.update({
                passwordHash: passwordHash
            }, {
                where: {
                    email: verify.user.email
                },
                transaction: t
            });

            await rdb.PasswordResetToken.destroy({
                transaction: t,
                force: true,
                where: {
                    userId: verify.userId
                }
            });

            res.json({
                post: post
            });
        });
    } catch (err){
        console.log(err);
        err = app.get('fromErrToArray')(err);
        res.status(400).json(err)
    }
});



app.post('/contact-us.json', async (req, res, next) => {
    try {
        let defaults = {
            email:'',
            message: ''
        };
        let post = Object.assign(defaults, req.body);

        post.email = sanitizer.sanitize(post.email);
        post.message = sanitizer.sanitize(post.message);


        let validationResult = [];

        validationResult.push(balido.validate(post.email, 'email', true).ifUndefined('Email missing.').ifBlank('Please type your Email.'));
        validationResult.push(balido.validate(post.message, 'message', true).ifUndefined('Message missing.').ifBlank('Please type your Message.'));

        validationErrors = balido.getErrors(validationResult);
        if(!lodash.isEmpty(validationErrors)){
            throw validationErrors;
        }

        let nunjucksEnv = app.get('nunjucksEnv');
        let messageText = post.message;
        let messageHtml = post.message;

        let transporter = app.get('smtpTransporter');
        let info = await transporter.sendMail({
            from: 'Run Training Calendar <mailer@runtrainingcalendar.com>',
            to: post.email,
            subject: 'Contact Us',
            text: messageText
        });
        console.log(info);
        res.json({ok:'ok'});
    } catch (err) {
        console.log(err);
        err = app.get('fromErrToArray')(err);
        res.status(400).json(err)
    }
});

app.use(function(req, res, next) {
    if (!req.route)
        return next (new Error('404'));
    next();
});




// Global error handler
app.use(function (err, req, res, next) {
    let message = err;
    if(err instanceof Error){
        message = err.message;
    } else if (err instanceof Array){
        message = '';
        err.forEach((v)=>{
            message += JSON.stringify(v)+" ";
        });
    } else if (err instanceof Object){
        message = JSON.stringify(err);
    }

    console.log(message);
    res.render('error.html', {message: message});
});

app.listen(global.port, function () {
    console.log(util.format('Example app listening on port %s!',global.port));
});
