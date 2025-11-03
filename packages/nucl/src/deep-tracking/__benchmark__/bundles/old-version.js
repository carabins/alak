import { TrackOpTypes, TriggerOpTypes, track, trigger } from "@vue/reactivity";

//#region packages/nucl/src/deep-tracking/oldversion.ts
const reactiveMap = /* @__PURE__ */ new WeakMap();
const rawMap = /* @__PURE__ */ new WeakMap();
function getPath(parent, currentKey) {
	const path = [currentKey];
	let current = parent;
	while (current.parent) {
		path.unshift(current.key);
		current = current.parent;
	}
	return path;
}
function findRoot(parent) {
	let current = parent;
	while (current.parent) current = current.parent;
	return current;
}
function createArrayInstrumentations(options) {
	const instrumentations = {};
	[
		"push",
		"pop",
		"shift",
		"unshift",
		"splice",
		"sort",
		"reverse"
	].forEach((method) => {
		const original = Array.prototype[method];
		instrumentations[method] = function(...args) {
			const parent = this.__parent__;
			const target = parent.value;
			const oldLength = target.length;
			const result = original.apply(target, args);
			const newLength = target.length;
			if (parent.parent || parent.isRoot) {
				const root = findRoot(parent);
				if (method === "push" || method === "unshift" || method === "splice") {
					const path = parent.parent ? getPath(parent, method) : [method];
					if (root.notify) root.notify(path, root.value, args);
				}
				if (oldLength !== newLength) {
					const lengthPath = parent.parent ? getPath(parent, "length") : ["length"];
					if (root.notify) root.notify(lengthPath, root.value, newLength);
				}
			}
			if (method === "push" || method === "unshift") trigger(target, TriggerOpTypes.ADD, newLength - 1, args[0]);
			else if (method === "pop" || method === "shift") trigger(target, TriggerOpTypes.DELETE, method === "pop" ? oldLength - 1 : 0);
			else trigger(target, TriggerOpTypes.SET, "length", newLength, oldLength);
			return result;
		};
	});
	[
		"includes",
		"indexOf",
		"lastIndexOf",
		"join",
		"concat",
		"slice"
	].forEach((method) => {
		const original = Array.prototype[method];
		instrumentations[method] = function(...args) {
			const target = this.__parent__.value;
			track(target, TrackOpTypes.ITERATE, Symbol.iterator);
			return original.apply(target, args);
		};
	});
	return instrumentations;
}
function createReactiveHandler(options) {
	const arrayInstrumentations = createArrayInstrumentations(options);
	return {
		get(parent, key, receiver) {
			if (key === "__parent__") return parent;
			if (key === "__isProxy__") return true;
			if (key === "__raw__") return parent.value;
			const target = parent.value;
			if (typeof key === "symbol") {
				track(target, TrackOpTypes.GET, key);
				return Reflect.get(target, key, receiver);
			}
			if (Array.isArray(target)) {
				if (key in arrayInstrumentations) return arrayInstrumentations[key];
				if (key === "length") {
					track(target, TrackOpTypes.GET, key);
					return target.length;
				}
			}
			const value = target[key];
			track(target, TrackOpTypes.GET, key);
			if (value == null || typeof value !== "object") return value;
			if (Array.isArray(target) && !isNaN(Number(key)) && !options.deepArrays) return value;
			if (!options.deepObjects && !Array.isArray(value)) return value;
			let proxy = reactiveMap.get(value);
			if (proxy) return proxy;
			if (!parent.subProxies) parent.subProxies = /* @__PURE__ */ new WeakMap();
			proxy = parent.subProxies.get(value);
			if (!proxy) {
				const childParent = {
					parent,
					key: String(key),
					value,
					notify: parent.notify || parent.parent?.notify,
					options: parent.options
				};
				proxy = new Proxy(childParent, this);
				parent.subProxies.set(value, proxy);
				reactiveMap.set(value, proxy);
				rawMap.set(proxy, value);
			}
			return proxy;
		},
		set(parent, key, newValue, receiver) {
			const target = parent.value;
			if (typeof key === "symbol") return Reflect.set(target, key, newValue, receiver);
			const oldValue = target[key];
			const hadKey = Object.prototype.hasOwnProperty.call(target, key);
			const result = Reflect.set(target, key, newValue, receiver);
			if (oldValue === newValue && hadKey) return true;
			if (parent.subProxies && oldValue != null && typeof oldValue === "object") {
				parent.subProxies.delete(oldValue);
				reactiveMap.delete(oldValue);
			}
			if (parent.isRoot && parent.notify) parent.notify([String(key)], target, newValue);
			else if (parent.parent) {
				const path = getPath(parent, String(key));
				const root = findRoot(parent);
				if (root.notify) root.notify(path, root.value, newValue);
			}
			trigger(target, hadKey ? TriggerOpTypes.SET : TriggerOpTypes.ADD, key, newValue, oldValue);
			return result;
		},
		deleteProperty(parent, key) {
			const target = parent.value;
			if (typeof key === "symbol") return Reflect.deleteProperty(target, key);
			const hadKey = Object.prototype.hasOwnProperty.call(target, key);
			const oldValue = target[key];
			const result = Reflect.deleteProperty(target, key);
			if (parent.subProxies && oldValue != null && typeof oldValue === "object") {
				parent.subProxies.delete(oldValue);
				reactiveMap.delete(oldValue);
			}
			if (hadKey && result) {
				if (parent.isRoot && parent.notify) parent.notify([String(key)], target, void 0);
				else if (parent.parent) {
					const path = getPath(parent, String(key));
					const root = findRoot(parent);
					if (root.notify) root.notify(path, root.value, void 0);
				}
				trigger(target, TriggerOpTypes.DELETE, key, void 0, oldValue);
			}
			return result;
		},
		has(parent, key) {
			const target = parent.value;
			const result = Reflect.has(target, key);
			if (typeof key !== "symbol") track(target, TrackOpTypes.HAS, key);
			return result;
		},
		ownKeys(parent) {
			const target = parent.value;
			track(target, TrackOpTypes.ITERATE, Array.isArray(target) ? "length" : Symbol.iterator);
			return Reflect.ownKeys(target);
		}
	};
}
function createTracker(notify, options = {}) {
	const finalOptions = {
		deepArrays: options.deepArrays ?? false,
		deepObjects: options.deepObjects ?? true
	};
	const handler = createReactiveHandler(finalOptions);
	return {
		get options() {
			return finalOptions;
		},
		wrap(value) {
			const existing = reactiveMap.get(value);
			if (existing) return existing;
			const root = {
				isRoot: true,
				notify,
				value,
				options: finalOptions
			};
			const proxy = new Proxy(root, handler);
			reactiveMap.set(value, proxy);
			rawMap.set(proxy, value);
			return proxy;
		},
		toRaw(proxy) {
			const raw = rawMap.get(proxy);
			return raw ? raw : proxy;
		},
		isProxy(value) {
			return !!(value && value.__isProxy__);
		}
	};
}
var oldversion_default = createTracker;

//#endregion
export { oldversion_default as default };