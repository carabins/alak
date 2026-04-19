import { defineKind } from '@alaq/nucl';
import { VueNuclPlugin } from './nuclPlugin';

/**
 * Initializes Alaq integration with Vue 3.
 * 
 * After calling this function, Alaq nucleons and atoms will natively 
 * support Vue reactivity (can be used in templates, watch, computed, etc.)
 * 
 * @param options Configuration options
 */
export function setupAlaqVue(options: { 
  /** If true, applies Vue reactivity to the default Alaq kind '+' and 'nucleus' */
  global?: boolean 
} = { global: true }) {

  // Register as a specific kind 'vue'
  defineKind('vue', VueNuclPlugin);

  if (options.global) {
    // Note: defineKind replaces the definition. 
    // In a real app, users might want to combine kinds like 'std vue'
    // But for global magic, we register it for the most common base kinds.
    defineKind('+', VueNuclPlugin);
    defineKind('nucleus', VueNuclPlugin);
  }
}
