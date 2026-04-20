/**
 * Tauri runtime detection.
 *
 * Tauri v2 injects `window.__TAURI_INTERNALS__` on app startup (before the
 * webview script runs). That marker is the canonical probe; dynamic-importing
 * `@tauri-apps/api` is NOT a reliable test — the module resolves fine in a
 * plain browser but its calls fail at runtime.
 */

export function hasTauri(): boolean {
  if (typeof globalThis === 'undefined') return false
  const w: any = (globalThis as any).window ?? globalThis
  return !!(w && '__TAURI_INTERNALS__' in w)
}
