//// Core modules
const path = require('path');

//// External modules
const lodash = require('lodash');

//// Modules

module.exports = {
    allowedFields: (req, allowedFields)=>{
        let defaults = {
            sanitize: (value)=>{
                if(typeof value === "string"){
                    return lodash.trim(value);
                } else if(typeof value === "number"){
                    return value;
                }
            }
        };
        return lodash.mapValues(allowedFields, (currentObjValue, key, sourceObj) => {
            // Add default sanitizer. Which is just trim actually.
            currentObjValue = Object.assign(defaults, currentObjValue);
            // Use lodash.get to prevent undefined error and assign default
            let fieldValue = lodash.get(req, key, currentObjValue.default);
            return currentObjValue.sanitize(fieldValue);
        });
    }
};

/*
// Usage:
// Post data
let post = inputGuard.allowedFields(req.body, {
    id: {
        default: 0
    },
    title: {
        default: ''
    },
});
console.log(post.id);

// Get data
let query = inputGuard.allowedFields(req.query, {
    id: {
        default: 0
    },
    title: {
        default: ''
    },
});
console.log(query.id);

 */