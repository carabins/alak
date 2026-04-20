/**
 * Release identity: `${version}+${build}.r${reload}`.
 *
 * - `version`: semver from package.json (or config override).
 * - `build`:   short build id — git sha, CI build number, or timestamp.
 *              Injected as globalThis.__ALAQ_BUILD__ at bundle time; falls back to 'dev'.
 * - `reload`:  per-browser-session counter. Incremented once per page load
 *              (or once per Node process start). Persisted in localStorage
 *              under `__alaq_reload__` so HMR reloads increment too.
 *
 * This string goes into every LogiFrame.release and ends up in Logi's `release`
 * column, letting the AI slice events by run via `logi_list_runs`.
 */

const RELOAD_KEY = '__alaq_reload__'

function readReload(): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(RELOAD_KEY)
      const n = raw ? parseInt(raw, 10) : 0
      const next = Number.isFinite(n) ? n + 1 : 1
      localStorage.setItem(RELOAD_KEY, String(next))
      return next
    }
  } catch {
    // localStorage can throw in private mode / cross-origin frames.
  }
  // Node / sandboxed: use a module-level counter per process.
  return ++processReload
}

let processReload = 0
let cachedReload: number | null = null

export function getReload(): number {
  if (cachedReload === null) cachedReload = readReload()
  return cachedReload
}

export function getBuild(configured?: string): string {
  if (configured) return configured
  const g = globalThis as unknown as { __ALAQ_BUILD__?: string }
  return g.__ALAQ_BUILD__ ?? 'dev'
}

export function formatRelease(version: string, build: string, reload: number): string {
  return `${version}+${build}.r${reload}`
}

/** For tests only. */
export function __resetReload(): void {
  cachedReload = null
  processReload = 0
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(RELOAD_KEY)
  } catch { /* ignore */ }
}
