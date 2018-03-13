const path = require('path');


const lodash = require('lodash');
const moment = require('moment');

const db = require(path.join(appDir, 'src/db'));
const orElse = require(path.join(appDir, 'src/orElse'));

function getCalendarByUid(uid){
  return db.get('SELECT * FROM calendar WHERE calendar.uid = ?', [uid]).then(function(row){
    if( typeof row == 'undefined'){
      return Promise.reject(new Error('Calendar not found'));
    } 
    
    return row;

  });
}



function getTrainingPlan(planId){

  return db.get('SELECT * FROM plan WHERE id = ?', [planId]).then(function(trainingPlan){

    if( typeof trainingPlan == 'undefined'){
      return Promise.reject(new Error('Plan not found'));
    } 
    return trainingPlan;

  });
}
function getTrainingPlanByUid(uid){

  return db.get('SELECT * FROM plan WHERE uid = ?', [uid]).then(function(trainingPlan){

    if( typeof trainingPlan == 'undefined'){
      return Promise.reject(new Error('Plan not found'));
    } 
    return trainingPlan;

  });
}

function getTrainingData(planId){

  // ORDER is important as we get the trainingDays from the last trainingDay
  var sql = 'SELECT * FROM plan_data WHERE plan_data.plan_id = ? ORDER BY plan_data.trainingDay, plan_data.id ASC';
  return db.all(sql, [planId]).then(function(trainingData){

    if(trainingData.length <= 0) { // No data, so abort 
      return Promise.reject(new Error('Plan not found'));
    } 
    return trainingData.map(function(element){
      return {
        date: null,
        workoutType: element.workoutType,
        title: element.title,
        description: element.description,
        trainingDay: element.trainingDay,
      }
    });

  });
}

var helper = {
    isoDate: function (year, month, day, hour=0, min=0, s=0, ms=0){
        var year = lodash.padStart(year, 4, '0');
        var month = lodash.padStart(month, 2, '0');
        var day = lodash.padStart(day, 2, '0');

        var hour = lodash.padStart(hour, 2, '0');
        var min = lodash.padStart(min, 2, '0');
        var s = lodash.padStart(s, 2, '0');
        var ms = lodash.padStart(ms, 3, '0');


        return year+'-'+month+'-'+day+'T'+hour+':'+min+':'+s+'.'+ms+'Z';
    },
    getMyTimeZone: function (){
        // Returns timezone in minutes relative to local time. Which means UTC+8:00 is -480. Yup.
        var offset = new Date().getTimezoneOffset(); 
        // Note: The 0 is to negate the offset because JS returns a negative number instead of a sane positive one.
        return 0 - (offset/60); 
    },
    computeStartDateFromEndDate: function(momentEndDate, trainingDays){
        // var trainingDays = trainingData[trainingData.length-1].trainingDay;
        return momentEndDate.clone().subtract(trainingDays-1, 'days');
    },
    planToCalendarData: function(planData, momentTrainStartDate){
        return planData.map(function(planEl){
          return {
            calendarId: null,
            date: momentTrainStartDate.clone().add(planEl.trainingDay-1, 'days').format('YYYY-MM-DD'),
            workoutType: planEl.workoutTypeUid,
            title: planEl.title,
            description: planEl.description
          }
        });
    },
    adjustTrainingData: function(trainingData, momentTrainStartDate){
        return trainingData.map(function(el){
            var date = momentTrainStartDate.clone().add(el.trainingDay-1, 'days').format('YYYY-MM-DD');
            el.date = date;
            return el;
        });
    },
    attachTrainingDataTo: function(monthView, trainingData){
        var fnMapMonth = function(row){
            row = row.map(function(dayObject){
                var items = lodash.filter(trainingData, function(el){
                    return el.date === dayObject.iso.split('T')[0];
                });
                
                dayObject.cssClass = dayObject.type;

                if(moment.utc().add(helper.getMyTimeZone(), 'hours').format('YYYY-MM-DD') === dayObject.iso.split('T')[0]){
                    dayObject.cssClass += ' now';
                }
                dayObject.info = [];

                lodash.forEach(items, function(gold, key){
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
    },
    createCalendarData: function(planData, startDate){
      planData = lodash.each(planData, (data)=>{

      });
    }
}
module.exports = {
    getCalendarByUid: getCalendarByUid,
    getTrainingPlan: getTrainingPlan,
    getTrainingPlanByUid: getTrainingPlanByUid,
    getTrainingData: getTrainingData,
    attachTrainingDataTo: helper.attachTrainingDataTo,
    adjustTrainingData: helper.adjustTrainingData,
    planToCalendarData: helper.planToCalendarData
}