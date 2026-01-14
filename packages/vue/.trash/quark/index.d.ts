/**
 * VueQuarkRefPlugin - Makes Quark behave like native Vue Ref
 *
 * Integrate Vue's reactivity system with quark by using Vue's customRef
 * This allows quark to function as a native Vue Ref while maintaining its own API
 *
 * @packageDocumentation
 */
import type { AtomPlugin } from '@alaq/atom';
/**
 * Transform Quark into native Vue Ref by integrating with customRef
 *
 * This plugin makes each Quark property directly usable in Vue templates:
 * - quark.value tracks in Vue components
 * - watch() and watchEffect() work automatically
 */
export declare const VueQuarkRefPlugin: AtomPlugin;
