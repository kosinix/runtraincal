//// Core modules

//// External modules
const Sequelize = require('sequelize');

// DB
let config = {
    "host": "localhost",
    "dialect": "sqlite",
    "pool": {
        "max": 5,
        "min": 0,
        "acquire": 30000,
        "idle": 10000
    },
    "operatorsAliases": "false",
    "storage": "app.db",
    "define": {
        "freezeTableName": "true",
        "timestamps": "false",
        "paranoid": true
    },
    "logging": false
};
let sequelize = new Sequelize("database", "", "", config);

// User
const User = sequelize.define('user', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: Sequelize.STRING,
        validate: {
            notEmpty: {
                args: true,
                msg: "Please provide a Email"
            },
            isEmail: {
                args: true,
                msg: "Please provide a valid Email"
            }
        }
    },
    username: {
        type: Sequelize.STRING,
        validate: {
            notEmpty: {
                args: true,
                msg: "Please provide a Username"
            }
        }
    },
    passwordHash: {
        type: Sequelize.STRING
    },
    active: {
        type: Sequelize.INTEGER
    },
});

// Calendar
const Calendar = sequelize.define('calendar', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    uid: {
        type: Sequelize.STRING
    },
    title: {
        type: Sequelize.STRING,
        validate: {
            notEmpty: {
                args: true,
                msg: "Please provide a Title"
            }
        }
    },
    description: {
        type: Sequelize.STRING
    },
    date: {
        type: Sequelize.STRING
    },
    dateAnchorPoint: {
        type: Sequelize.STRING
    },
    planId: {
        type: Sequelize.INTEGER
    }
});

// CalendarUser
const CalendarUser = sequelize.define('calendar_user', {
    calendarId: {
        type: Sequelize.INTEGER,
    },
    userId: {
        type: Sequelize.INTEGER,
    },
});

// CalendarData
const CalendarData = sequelize.define('calendar_data', {
    date: {
        type: Sequelize.STRING
    },
    workoutType: {
        type: Sequelize.STRING
    },
    title: {
        type: Sequelize.STRING
    },
    description: {
        type: Sequelize.STRING
    }
});

// TODO
const Plan = sequelize.define('plan', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    uid: {
        type: Sequelize.STRING
    },
    title: {
        type: Sequelize.STRING,
        validate: {
            notEmpty: {
                args: true,
                msg: "Please provide a Title"
            }
        }
    },
    description: {
        type: Sequelize.STRING
    },
    length: {
        type: Sequelize.INTEGER
    }
}, {timestamps: false});

// PlanData
const PlanData = sequelize.define('plan_data', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    planId: {
        type: Sequelize.INTEGER
    },
    workoutTypeUid: {
        type: Sequelize.STRING
    },
    title: {
        type: Sequelize.STRING
    },
    description: {
        type: Sequelize.STRING
    },
    trainingDay: {
        type: Sequelize.INTEGER
    }
});

// WorkoutType
const WorkoutType = sequelize.define('workout_type', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    uid: {
        type: Sequelize.STRING
    },
    name: {
        type: Sequelize.STRING
    },
    description: {
        type: Sequelize.STRING
    }
});

// PasswordResetToken
const PasswordResetToken = sequelize.define('password_reset_token', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: Sequelize.INTEGER
    },
    uid: {
        type: Sequelize.STRING
    }
});

// VerifyEmailToken
const VerifyEmailToken = sequelize.define('verify_email_token', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: Sequelize.INTEGER
    },
    uid: {
        type: Sequelize.STRING
    }
});

// Assocs 
// User.belongsToMany(Calendar, {through: 'CalendarUser'});
// Calendar.belongsToMany(User, {through: 'CalendarUser'});
User.hasMany(CalendarUser, { foreignKey: 'userId', sourceKey: 'id' });
Calendar.hasMany(CalendarUser, { foreignKey: 'calendarId', sourceKey: 'id' });

Calendar.hasMany(CalendarData, { foreignKey: 'calendarId', sourceKey: 'id' });
CalendarData.belongsTo(Calendar, { foreignKey: 'calendarId', targetKey: 'id' });

Plan.hasMany(PlanData, { foreignKey: 'planId', sourceKey: 'id' });

WorkoutType.hasMany(PlanData, { foreignKey: 'workoutTypeUid', sourceKey: 'uid' });

User.hasMany(PasswordResetToken, { foreignKey: 'userId', sourceKey: 'id' });
PasswordResetToken.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

User.hasMany(VerifyEmailToken, { foreignKey: 'userId', sourceKey: 'id' });
VerifyEmailToken.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

module.exports = {
    Sequelize: Sequelize,
    sequelize: sequelize,
    User: User,
    Calendar: Calendar,
    CalendarUser: CalendarUser,
    CalendarData: CalendarData,
    Plan: Plan,
    PlanData: PlanData,
    WorkoutType: WorkoutType,
    PasswordResetToken: PasswordResetToken,
    VerifyEmailToken: VerifyEmailToken
};

