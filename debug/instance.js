"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const receiveTools_1 = require("./receiveTools");
const logsHead = ['time', 'event', 'uid', 'name', 'id', 'meta', 'value', 'children', 'context'];
function debugInstance() {
    let isCollecting = false;
    let collection = [];
    function startCollect() {
        isCollecting = true;
        collection = [];
    }
    function stopCollect() {
        isCollecting = false;
        return collection;
    }
    let recordListener;
    function onRecord(fn) {
        recordListener = fn;
    }
    const records = [];
    const controller = {
        logsHead,
        records,
        startCollect,
        stopCollect,
        onRecord,
    };
    const timeStart = Date.now();
    return {
        controller,
        receiver(event, atom, ...context) {
            const snap = receiveTools_1.atomSnapshot(atom);
            context.length > 0 && snap.push(...context);
            const record = [Date.now() - timeStart, event, ...snap];
            isCollecting && collection.push(record);
            records.push(record);
            recordListener && recordListener(record);
        },
    };
}
exports.debugInstance = debugInstance;
