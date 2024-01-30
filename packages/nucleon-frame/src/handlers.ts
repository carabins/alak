// import {setNucleonValue} from "@alaq/nucleus/core";
// import {createNucleon} from "@alaq/nucleus/create";
//
// boxMerge(array, key = 'id', context = 'boxJoin') {
//   const v = this.value || {}
//   array.forEach((i) => (v[i[key]] = i))
//   setNucleonValue(this, v, context)
//   return this._
// },
// boxAssign(object, context = 'boxAssign') {
//   const v = this.value || {}
//   setNucleonValue(this, Object.assign(v, object), context)
//   return this._
// },
// boxGet(key) {
//   if (this.value) {
//     return this.value[key]
//   } else {
//     return undefined
//   }
// },
// boxDelete(key) {
//   const v = this.value || {}
//   delete v[key]
//   return this._
// },
// boxUpdate(key, value, context = 'boxAdd') {
//   const v = this.value || {}
//   v[key] = value
//   setNucleonValue(this, v, context)
//   return this._
// },
//
// boxSet(key, value, context = 'boxAdd') {
//   const v = this.value || {}
//   v[key] = value
//   setNucleonValue(this, v, context)
//   return this._
// },
// boxEach(fun) {
//   this.value && Object.values(this.value).forEach(fun)
//   return this._
// },
// unboxToMap(fun) {
//   return this.value ? Object.keys(this.value).map(fun) : {}
// },
// unboxToList() {
//   return this.value ? Object.values(this.value) : []
// },
// boxMap(fun) {
//   const a = createNucleon()
//   this.up((v) => a(this.unboxToMap(fun), this._))
//   return a
// },
// boxToList() {
//   const a = createNucleon()
//   this.up((v) => a(this.unboxToList(), this._))
//   return a
// },

// tuneOff() {
//   this.tunedTarget && this.tunedTarget.down(this.tunedTarget)
// },
//
// listSize() {
//   return this.value?.length
// },
// listAdd(value, context = 'listAdd') {
//   this.value.push(value)
//   setNucleonValue(this, this.value, context)
//   return this._
// },
// listMerge(list, context = 'listMerge') {
//   this.value.push(...list)
//   setNucleonValue(this, this.value, context)
// },
// listMap(fun) {
//   const a = createNucleon()
//   this.up((v) => a(v.map(fun), this._))
//   return a
// },
// listToBox(key) {
//   const a = createNucleon()
//   this.up((v) => a.boxMerge(v, key, this._))
//   return a
// },

// import {setNucleonValue} from "@alaq/nucleus/core";

// applyBefore(...a) {
//   const v = fun(this.value)
//   setNucleonValue(this, v, context)
//   return this._
// },

// link(link, f) {
//   this._.up(f)
//   if (!this.links) this.links = new Map<any, any>()
//   this.links.set(link, f)
//   return this._
// },
//
// downLink(linkObject: any) {
//   const links: Map<any, any> = this.links as Map<any, any>
//   if (links && links.has(linkObject)) {
//     this._.down(links.get(linkObject))
//     links.delete(linkObject)
//   }
// },
