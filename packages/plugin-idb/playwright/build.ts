/**
 * Build harness.ts into a single browser bundle.
 *
 * Relies on Bun's built-in bundler. Bun resolves @alaq/* path aliases from
 * the root tsconfig.json automatically (via bunfig.toml + workspace layout),
 * so no explicit plugin config is needed.
 *
 * Usage:
 *   bun packages/plugin-idb/playwright/build.ts
 *   (or from repo root: bun packages/plugin-idb/playwright/build.ts)
 */

const here = new URL('.', import.meta.url).pathname.replace(/^\/([a-zA-Z]):/, '$1:')

const result = await Bun.build({
  entrypoints: [`${here}harness.ts`],
  outdir: here,
  naming: 'bundle.js',
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'inline',
})

if (!result.success) {
  console.error('Build failed:')
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

for (const out of result.outputs) {
  console.log(`built ${out.path} (${out.size} bytes)`)
}
