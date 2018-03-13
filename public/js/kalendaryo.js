/**
 * Module for displaying a Gregorian calendar
 */
if (typeof window === 'undefined') {
  const lodash = require('lodash');
  const moment = require('moment');
} else {
  const _ = lodash;
}

var helper = {
  /**
   * Generate an array containing numbers 1 to count
   * 
   * @param {number} count
   * @return {Array} 
   */
  generateDays: function(count){
    return Array.from(Array(count).keys()).map((e,i)=>i+1); // 1-count
  },

  /**
   * Returns date in ISO 8601 format in timezone 0: YYYY-MM-DDTHH:mm:ss.sssZ
   * 
   */
  isoDate: function(year, month, day, hour=0, min=0, s=0, ms=0){
    
    var year = lodash.padStart(year, 4, '0');
    var month = lodash.padStart(month, 2, '0');
    var day = lodash.padStart(day, 2, '0');

    var hour = lodash.padStart(hour, 2, '0');
    var min = lodash.padStart(min, 2, '0');
    var s = lodash.padStart(s, 2, '0');
    var ms = lodash.padStart(ms, 3, '0');
    
    
    return year+"-"+month+"-"+day+"T"+hour+":"+min+":"+s+"."+ms+"Z";
  },
  /**
   * Returns the timezone of the server.
   * 
   * @return {number}  Eg. for UTC+8:00, returns 8. for UTC-3:00 returns -3.
   */
  getMyTimeZone: function(){
    // Returns timezone in minutes relative to local time. Which means UTC+8:00 is -480. Yup.
    var offset = new Date().getTimezoneOffset(); 
    // Note: The 0 is to negate the offset because JS returns a negative number instead of a sane positive one.
    return 0 - (offset/60); 
  },

  /**
   * Get weekdays in an array
   * 
   * @param {number} weekStart The start of the week. Range from 0 to 6. Eg. 0-Sun, 1-Mon, ... 6-Sat
   * @return {Array} Array containing string names
   */
  getWeekDays: function(weekStart=0){
    var weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return lodash.concat(lodash.slice(weekDays, weekStart), lodash.slice(weekDays, 0, weekStart));
  }
}

var DayType = {
  prefix: 'prefix',
  day: 'day',
  suffix: 'suffix',
}

/**
 * Represent a calendar day
 * 
 * @param {boolean} isToday - True if day is today.
 * @param {DayType} type - See DayType.
 * @param {number} year - Year in YYYY format.
 * @param {number} month - Month in M format.
 * @param {number} day - day in D format.
 * @param {String} iso - ISO date time.
 */
class DayObject {
  constructor(isToday, type, year, month, day, iso){
    this.isToday = isToday;
    this.type = type;
    this.year = year;
    this.month = month;
    this.day = day;
    this.iso = iso;
  }
}

/**
 * A calendar's month view
 */
class MonthView {
  /**
   * Create a month calendar
   * 
   * @param {number} month - Eg. 1-12
   * @param {number} year - Eg. 1979- 2100
   * @param {Object} [config] - The extra configuration options. All optional.
   */
  constructor(year, month, config){
    /**
     * @namespace
     * @property {number} weekStart - Values: 0 to 6. Where 0 is Sunday and 6 is Saturday.
     * @property {number} padMode - Values: 0 to 1
     * @property {number} timeZone - Values: -12 to 14
     * @property {Function} dayCallBack - Map values to something else for date.
     * @property {Function} prefixCallBack - Map values to something else for date prefix.
     * @property {Function} suffixCallBack - Map values to something else for date suffix.
    */
    var defaults = {
      weekStart: 0,
      padMode: 1,
      timeZone: 0,
      dayCallBack: function(day){
        return day;
      },
      prefixCallBack: function(day){
        return day;
      },
      suffixCallBack: function(day){
        return day;
      }
    };
    
    config = Object.assign(defaults, config);
    this.weekStart = config.weekStart;
    this.padMode = config.padMode;
    this.timeZone = config.timeZone;

    var isoDateString = helper.isoDate(year, month, 1); // First day of specific month
    var momentCurrentMonth = moment.utc(isoDateString); 
    if(!momentCurrentMonth.isValid()){
      // Handle error
    }
    var momentPrevMonth = moment.utc(isoDateString).subtract(1, 'months'); // Since we are already at first day of month, subtract 1 day
    var momentNextMonth = moment.utc(isoDateString).add(1, 'months'); // Move to last day of month, then add 1 day
    var momentNow = moment.utc().add(this.timeZone, 'hours');
    this.year = parseInt(year); // Year
    this.month = parseInt(month); // Month 1-12
    
    this.name = momentCurrentMonth.format('MMMM'); // String month name
    this.days = momentCurrentMonth.daysInMonth(); // Total month days. 1-n
    this.weekDays = helper.getWeekDays(this.weekStart); // Array containing names of the days of the week (Sun, Mon, etc).
    this.weekDayFirst = parseInt(momentCurrentMonth.format('d')); // First day of week. Zero-based. 0-6
    this.weekDayLast = parseInt(moment.utc(isoDateString).endOf('month').format('d')); // This months last day of week. Zero-based. 0-6
    
    // Now info
    this.nowYear = parseInt(momentNow.format('YYYY'));
    this.nowMonth = parseInt(momentNow.format('M'));
    this.nowDay = parseInt(momentNow.format('D'));
    this.nowDate = momentNow.format('YYYY-MM-DD');

    // Previous month info
    this.prevMonthYear = parseInt(momentPrevMonth.format('YYYY'));
    this.prevMonthNumber = parseInt(momentPrevMonth.format('M'));
    this.prevMonthDays = parseInt(momentPrevMonth.daysInMonth());
    // Next month info
    this.nextMonthYear = parseInt(momentNextMonth.format('YYYY'));
    this.nextMonthNumber = parseInt(momentNextMonth.format('M'));
    this.nextMonthDays = parseInt(momentNextMonth.daysInMonth());
    this.matrix = [];
    
    this.dayCallBack = config.dayCallBack;
    this.prefixCallBack = config.prefixCallBack;
    this.suffixCallBack = config.suffixCallBack;
    
    this.matrixes();

  }

  matrixes(){
    
    var days = helper.generateDays(this.days); // Generate days for this month
    var momentNow = moment.utc().add(this.timeZone, 'hours');
    days = days.map(function(day){
      var isoDateString = helper.isoDate(this.year, this.month, day);
      var monthDay = moment.utc(isoDateString);
      var isToday = (momentNow.format('YYYY-MM-DD') === monthDay.format("YYYY-MM-DD"));

      return new DayObject(isToday, DayType.day, this.year, this.month, day, isoDateString);
      
      //   date: isoDateString.split('T')[0], // Just the YYYY-MM-DD
    }, this).map(this.dayCallBack, this);

    // Prepend prefix and append suffix to matrix
    this.matrix = lodash.concat(this.prefix(this.padMode), days, this.suffix(this.padMode)); 

    // 1D into 2D array
    this.matrix = lodash.chunk(this.matrix, 7);
  }

  prefix(padMode){
    // Prefix length formula
    var prefixLength = this.weekDayFirst - this.weekStart;
    if(prefixLength < 0){
      prefixLength += 7;
    }

    var prefix = helper.generateDays(this.prevMonthDays); // Get previous month's total number of days and place it in an array
    prefix = lodash.takeRight(prefix, prefixLength); // Cut the parts we need
    var momentNow = moment.utc().add(this.timeZone, 'hours');
    // Create prefix content
    prefix = prefix.map(function(day){
        var year = this.prevMonthYear;
        var month = this.prevMonthNumber;
        var isoDateString = helper.isoDate(year, month, day);
        var monthDay = moment.utc(isoDateString);
        var isToday = (momentNow.format('YYYY-MM-DD') === monthDay.format("YYYY-MM-DD"));

        if(padMode==0){
          day = ''; // Blank it out
        }
        return new DayObject(isToday, DayType.prefix, year, month, day, isoDateString);
      }, this);

    return prefix.map(this.prefixCallBack, this);
  }

  suffix(padMode){

    // Suffix length formula
    const weekDays = 6; // 0-6 (7) days in a week
    var suffixLength = weekDays - (this.weekDayLast - this.weekStart);
    if(suffixLength > 6){
      suffixLength = suffixLength - weekDays - 1;
    }
    
    var suffix = helper.generateDays(suffixLength);
    var momentNow = moment.utc().add(this.timeZone, 'hours');

    // Create suffix content
    suffix = suffix.map(function(day){
        var year = this.nextMonthYear;
        var month = this.nextMonthNumber;
        var isoDateString = helper.isoDate(year, month, day);
        var monthDay = moment.utc(isoDateString);
        var isToday = (momentNow.format('YYYY-MM-DD') === monthDay.format("YYYY-MM-DD"));

        if(padMode==0){
          day = ''; // Blank it out
        }
        return new DayObject(isToday, DayType.suffix, year, month, day, isoDateString);
      }, this);

    return suffix.map(this.suffixCallBack, this);
  }

}

class DayView {
  /**
   * Create a day view for calendar
   * 
   * @param {number} year - Eg. 1979 to 2999
   * @param {number} month - Eg. 1 to 12
   * @param {number} day - Eg. 1 to 31
   * @param {Object} [config] - The extra configuration options. All optional.
   */
  constructor(year, month, day, config){
    /**
     * @namespace
     * @property {number} timeZone - Hour difference from UTC-0. Values: -12 to 14
    */
    var defaults = {
      timeZone: 0,
    };
    
    config = Object.assign(defaults, config);

    /**
     * @property {number} year - Number representing the year.
     * @property {number} month - Number representing the month. Values: 1 to 12
     * @property {number} day - Number representing the day. Values: 1 to 31
     */
    this.year = year;
    this.month = month;
    this.day = day;
    this.timeZone = config.timeZone;

    var isoDateString = helper.isoDate(year, month, day);
    
    /**
     * @property {Moment} moment - Instance of momentjs representing current day.
     * @property {Moment} prevDay - Instance of momentjs representing previous day.
     * @property {Moment} nextDay - Instance of momentjs representing next day.
     */
    this.moment = moment.utc(isoDateString).add(this.timeZone, 'hours');
    this.prevDay = moment.utc(isoDateString).add(this.timeZone, 'hours').subtract(1, 'days');
    this.nextDay = moment.utc(isoDateString).add(this.timeZone, 'hours').add(1, 'days');
  }
}
module.exports = {
  DayView: DayView,
  MonthView: MonthView,
  YearView: {},
  DecadeView: {},
  helper: helper
};
