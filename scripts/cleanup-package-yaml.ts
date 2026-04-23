import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';

const packagesDir = 'packages';
const packages = readdirSync(packagesDir);

for (const pkgName of packages) {
  const yamlPath = join(packagesDir, pkgName, 'package.yaml');
  if (!existsSync(yamlPath)) continue;

  console.log(`Processing ${yamlPath}...`);
  const content = readFileSync(yamlPath, 'utf8');
  const pkg = parse(content);
  
  const newPkg: any = {};
  
  // Standard fields to keep/ensure in order
  const order = [
    'name',
    'version',
    'description',
    'type',
    'main',
    'types',
    'bin',
    'scripts',
    'keywords',
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'publishConfig'
  ];

  for (const key of order) {
    if (key === 'type') {
      newPkg.type = 'module';
    } else if (key === 'publishConfig') {
      newPkg.publishConfig = { access: 'public' };
    } else if (key === 'main') {
      newPkg.main = pkg.main || './src/index.ts';
    } else if (key === 'types') {
      newPkg.types = pkg.types || './dist/index.d.ts';
    } else if (pkg[key] !== undefined) {
      newPkg[key] = pkg[key];
    }
  }

  // Double check required fields
  if (!newPkg.name && pkg.name) newPkg.name = pkg.name;
  if (!newPkg.version && pkg.version) newPkg.version = pkg.version;
  if (!newPkg.description && pkg.description) newPkg.description = pkg.description;

  writeFileSync(yamlPath, stringify(newPkg, { indent: 2 }));
}
console.log('Done!');
