var orElse = function(value, alternative){
  if(!value){
    return alternative;
  }
  return value;
};

module.exports = orElse;

