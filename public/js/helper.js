var lodash = _;
var helper = {
    isoDate: function (year, month, day, hour, min, s, ms){
        hour = hour || 0;
        min = min || 0;
        s = s || 0;
        ms = ms || 0;

        year = lodash.padStart(year, 4, '0');
        month = lodash.padStart(month, 2, '0');
        day = lodash.padStart(day, 2, '0');

        hour = lodash.padStart(hour, 2, '0');
        min = lodash.padStart(min, 2, '0');
        s = lodash.padStart(s, 2, '0');
        ms = lodash.padStart(ms, 3, '0');

        return year+'-'+month+'-'+day+'T'+hour+':'+min+':'+s+'.'+ms+'Z';
    },
    getMyTimeZone: function (){
        // Returns timezone in minutes relative to local time. Which means UTC+8:00 is -480. Yup.
        var offset = new Date().getTimezoneOffset(); 
        // Note: The 0 is to negate the offset because JS returns a negative number instead of a sane positive one.
        return 0 - (offset/60); 
    },
    /**
     * Generate an array containing numbers 1 to count
     * 
     * @param {number} count
     * @return {Array} 
     */
    generateDays: function(count){
        return lodash.times(count, function(i){ return i+1 });
    },
    computeStartDateFromEndDate: function(momentEndDate, trainingDays){
        // var trainingDays = trainingData[trainingData.length-1].trainingDay;
        return momentEndDate.clone().subtract(trainingDays-1, 'days');
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
            row = lodash.map(row, function(dayObject){
                var items = lodash.filter(trainingData, function(el){
                    return el.date === dayObject.iso.split('T')[0];
                });

                dayObject.cssClass = dayObject.type;

                if(moment.utc().add(helper.getMyTimeZone(), 'hours').format('YYYY-MM-DD') === dayObject.iso.split('T')[0]){
                    dayObject.cssClass += ' now';
                }
                dayObject.info = [];

                lodash.each(items, function(gold, key){
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
    attachCalendarData: function(momentNow, momentCurrent, matrix, calendarData){

        return lodash.map(matrix, function(row) {
            return lodash.map(row, function(day) {
                var items = lodash.filter(calendarData, function(el){
                    return el.date === dayObject.iso.split('T')[0];
                });

                var dayObject = {};

                dayObject.cssClass = '';//dayObject.type;

                if(momentNow.format('YYYY-MM-DD') === moment){
                    dayObject.cssClass += ' now';
                }
                dayObject.info = [];

                lodash.each(items, function(gold){
                    dayObject.info.push({
                        title: gold.title,
                        description: gold.description,
                        workoutType: gold.workoutType,
                    });
                });
                return dayObject;
            });
        });

    }
}