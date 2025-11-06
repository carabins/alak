module.exports = function myPrettifier(options) {
  return function prettifier(inputData) {
    // let logObject
    // if (typeof inputData === 'string') {
    //     logObject = JSON.parse(inputData)
    // } else if (isObject(inputData)) {
    //     logObject = inputData
    // }
    // if (!logObject) return inputData
    return JSON.stringify(inputData)
  }

  function isObject(input) {
    return Object.prototype.toString.apply(input) === '[object Object]'
  }
}
