import { INucleonPlugin } from "@alaq/nucl/INucleonPlugin";
import { track, trigger, TrackOpTypes, TriggerOpTypes } from "@vue/reactivity";

/**
 * Vue Reactivity Integration Plugin for Alaq Nucleons.
 * 
 * This plugin makes Alaq nodes compatible with Vue 3 reactivity by:
 * 1. Marking them as Vue Refs (__v_isRef).
 * 2. Calling track() on value access (dependency collection).
 * 3. Calling trigger() on change (effect notification).
 */
export const VueNuclPlugin: INucleonPlugin = {
  name: 'vue-nucl',
  symbol: Symbol.for('nucl:vue'),
  order: 50,

  onCreate(nucl) {
    // 1. Mark as Vue Ref for template unwrapping and watch() support
    (nucl as any).__v_isRef = true;
    (nucl as any).__v_isShallow = true;

    // 2. Wrap notify to trigger Vue updates
    const originalNotify = nucl.notify;
    nucl.notify = function() {
      // Call original Alaq listeners
      originalNotify.call(this);
      
      // Notify Vue that value has changed
      trigger(this, TriggerOpTypes.SET, 'value');
    };
  },

  properties: {
    // 3. Override 'value' to include Vue dependency tracking
    value: {
      get(this: any) {
        // Track this access in Vue's active effect (if any)
        track(this, TrackOpTypes.GET, 'value');
        
        // Return internal Alaq value
        return this._isDeep ? (this._state !== undefined ? this._state : this._value) : this._value;
      },
      set(this: any, newValue: any) {
        // Track this access in Vue's active effect (if any)
        // Set internal value directly to avoid recursion
        this._value = newValue;
        
        // Notify Alaq listeners
        this.notify();
      },
      enumerable: true,
      configurable: true
    }
  }
};
