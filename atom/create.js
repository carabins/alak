"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("./core");
const handlers_1 = require("./handlers");
const utils_1 = require("./utils");
let protoHandlers;
function makeProtoHandlers() {
    protoHandlers = Object.defineProperties(Object.assign({}, handlers_1.handlers), handlers_1.coreProps);
}
makeProtoHandlers();
/**
 * Установить расширения атома
 * @param options - {@link ExtensionOptions}
 */
function installAtomExtension(options) {
    options.handlers && Object.assign(handlers_1.handlers, options.handlers);
    makeProtoHandlers();
}
exports.installAtomExtension = installAtomExtension;
function get(atom, prop, receiver) {
    if (!atom.children) {
        throw utils_1.DECAY_ATOM_ERROR;
    }
    let keyFn = handlers_1.handlers[prop];
    if (keyFn)
        return keyFn.bind(atom);
    keyFn = handlers_1.proxyProps[prop];
    if (keyFn)
        return keyFn.call(atom);
    throw utils_1.PROPERTY_ATOM_ERROR;
}
function createProtoAtom(value) {
    const atom = core_1.createCore(...arguments);
    // const atom = {
    //   core
    // } as any
    atom.__proto__ = protoHandlers;
    atom._ = atom;
    return atom;
}
exports.createProtoAtom = createProtoAtom;
const proxyHandler = { get };
function createAtom(value) {
    const atom = core_1.createCore(...arguments);
    const proxy = new Proxy(atom, proxyHandler);
    atom._ = proxy;
    atom.uid = Math.random();
    return proxy;
}
exports.createAtom = createAtom;
