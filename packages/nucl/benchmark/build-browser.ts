/**
 * Build browser bundles for Quark and Nucl
 */

import { build } from 'bun'
import { join } from 'path'

console.log('🔨 Building browser bundles...\n')

// Build Quark
console.log('📦 Building Quark...')
await build({
  entrypoints: [join(import.meta.dir, '../../quark/src/index.ts')],
  outdir: join(import.meta.dir, './dist'),
  naming: 'quark.js',
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'none',
})
console.log('✅ Quark built: ./dist/quark.js\n')

// Build Nucl (bare) - inline Quark
console.log('📦 Building Nucl (bare)...')
await build({
  entrypoints: [join(import.meta.dir, '../src/index.ts')],
  outdir: join(import.meta.dir, './dist'),
  naming: 'nucl.js',
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'none',
  // No external - inline everything
})
console.log('✅ Nucl built: ./dist/nucl.js\n')

// Build Nucl with plugins - inline Quark
console.log('📦 Building Nucl+plugins...')
await build({
  entrypoints: [join(import.meta.dir, '../src/nucleus/index.ts')],
  outdir: join(import.meta.dir, './dist'),
  naming: 'nucl-plugins.js',
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'none',
  // No external - inline everything
})
console.log('✅ Nucl+plugins built: ./dist/nucl-plugins.js\n')

// Build HeavyNucl - inline Quark
console.log('📦 Building HeavyNucl...')
await build({
  entrypoints: [join(import.meta.dir, '../src/heavy/index.ts')],
  outdir: join(import.meta.dir, './dist'),
  naming: 'heavy.js',
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'none',
  // No external - inline everything
})
console.log('✅ HeavyNucl built: ./dist/heavy.js\n')

console.log('🎉 All bundles built successfully!')
console.log('\n📝 Open compare.html in your browser to run benchmarks')
