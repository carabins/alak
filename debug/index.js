"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("../atom/core");
const events_1 = require("./events");
const instance_1 = require("./instance");
const receivers = [];
exports.installAtomDebuggerTool = {
    default(options) {
        pathCore();
    },
    host() { },
    instance() {
        pathCore();
        const inst = instance_1.debugInstance();
        receivers.push(inst.receiver);
        return inst.controller;
    },
};
function pathCore() {
    core_1.debug.enabled = true;
    Object.keys(events_1.DebugEvent).forEach(eventName => (core_1.debug[eventName] = (...a) => routeEvent(eventName, ...a)));
}
//event: string, atom: Atom, context?: string
function routeEvent(...args) {
    receivers.forEach(r => r(...args));
}
