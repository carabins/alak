import { build } from 'bun';
import { join } from 'path';

console.log('Building E2E App...');

await build({
  entrypoints: [join(process.cwd(), 'packages/flex/test/e2e/app.ts')],
  outdir: join(process.cwd(), 'packages/flex/test/e2e/dist'),
  target: 'browser',
  format: 'esm',
});

console.log('Done.');