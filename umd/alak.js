"use strict";
// import A from '../facade'
// import { installExtension } from '../core'
//
// // export const id = A.id
// // export const wrap = A.wrap
// // export const from = A.from
// // export const getOnce = A.getOnce
// // export const getter = A.getter
// // export const object = A.object
// // export const call = A.call
// // export const proxy = A.proxy
//
// // export const installAtomExtension = installExtension
//
//
//
// function fx() {
//   return "fun"
// }
//
// fx.ok = "ok"
//
//
// const ff = Object.assign(fx, {
//   mx:"mx"
// })
// export default ff
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const facade_1 = __importDefault(require("../facade"));
exports.default = facade_1.default;
