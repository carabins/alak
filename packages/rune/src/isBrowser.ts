export const isBrowser = new Function('try {return this===window;}catch(e){ return false;}')()
export default isBrowser
