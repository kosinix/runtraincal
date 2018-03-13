const util = require('util');


class Validator {
    constructor(value, name, stopChain){
        this.value = value;
        this.name = name;
        this.stopChain = stopChain;
        
        this.result = [];
        this.stopped = false;
    }
    
    ifUndefined(message=''){
        if(this.stopped && this.stopChain) return this;
        
        if(message===''){
            message = util.format('%s is not defined.', this.name);
        }
        if(this.value === undefined){
            this.result.push(message);
            this.stopped = true && this.stopChain;
        }
        return this;
    }
    ifBlank(message=''){
        if(this.stopped && this.stopChain) return this;
        
        if(message===''){
            message = util.format('%s is blank.', this.name);
        }
        if(this.value === ''){
            this.result.push(message);
            this.stopped = true && this.stopChain;
        }
        return this;
    }
    ifNotEmail(message=''){
        if(this.stopped && this.stopChain) return this;
        
        if(message===''){
            message = util.format('%s is not a valid email.', this.name);
        }
        // From https://github.com/regexhq/regex-email
        var regex =  /^([\w_\.\-\+])+\@([\w\-]+\.)+([\w]{2,10})+$/;
        if(!regex.test(this.value)){
            this.result.push(message);
            this.stopped = true && this.stopChain;
        }
        return this;
    }
    ifFalse(condition, message){
        if(this.stopped && this.stopChain) return this;
        
        if(message===''){
            message = util.format('%s fails the custom validation.', this.name);
        }
        if(this.value===false){
            this.result.push(message);
            this.stopped = true && this.stopChain;
        }
        return this;
    }
    ifFalsy(condition, message){
        if(this.stopped && this.stopChain) return this;
        
        if(message===''){
            message = util.format('%s fails the custom validation.', this.name);
        }
        if(this.value==false){
            this.result.push(message);
            this.stopped = true && this.stopChain;
        }
        return this;
    }
    // TODO: confusing return value
    ifCustom(fnCallBack, message=''){
        if(this.stopped && this.stopChain) return this;
        
        if(message===''){
            message = util.format('%s fails the custom validation.', this.name);
        }
        if(fnCallBack(this.value)){
            this.result.push(message);
            this.stopped = true && this.stopChain;
        }
        return this;
    }
    async ifCustomAsync(fnCallBack, message=''){
        if(this.stopped && this.stopChain) return this;
        
        if(message===''){
            message = util.format('%s fails the custom validation.', this.name);
        }
        if(await fnCallBack(this.value)){
            this.result.push(message);
            this.stopped = true && this.stopChain;
        }
        return this;
    }
    isOk(){
        return (this.result.length<=0);
    }
    isFail(){
        return (this.result.length>0);
    }
}
// class Asserter {
//     constructor(value, name, stopChain){
//         this.value = value;
//         this.name = name;
//         this.stopChain = stopChain;
        
//         this.result = [];
//         this.stopped = false;
//     }
//     isBlank(actual, message) {
//         if(actual === '') {
//             return true;
//         }
//         this.result.push(message);
//         return false;
//     }
    
//     isTrue(condition, message){
//         if(condition){
//             return true;
//         }
//         this.result.push(message);
//         return false;
//     }
//     getResult(){
//         return this.result;
//     }
// }
module.exports = {
    validate: (value, name='Field', stopChain=false) => {
        return new Validator(value, name, stopChain);
        
    },
    isPassed: (validationResults) => {
        var ok = true;
        validationResults.forEach((o, index)=>{
            ok = o.isOk() && ok;
        });
        return ok;
    },
    getErrors: (validationResults) => {
        var errors = [];
        validationResults.forEach((v)=>{
            v.result.forEach((r)=>{
                errors.push(r);
            })
        });
        return errors;
    },
    getErrorsIndexed: (validationResults) => {
        var o = {}
        validationResults.forEach((v)=>{
            
            o[v.name] = v.result;
            
        });
        return o;
    },
    // Asserter: Asserter
};