
import { readdir, stat, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const targetDir = 'packages/nucl/src';

async function getFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const items = await readdir(dir);
  for (const item of items) {
    const path = join(dir, item);
    const s = await stat(path);
    if (s.isDirectory()) {
      files.push(...(await getFiles(path)));
    } else if (path.endsWith('.ts') || path.endsWith('.d.ts')) {
      files.push(path);
    }
  }
  return files;
}

async function processFile(path: string) {
  let content = await readFile(path, 'utf8');
  
  // Replace block comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    if (match.includes('TODO')) return match;
    return '';
  });

  // Replace line comments
  content = content.replace(/\/\/.*$/gm, (match) => {
    if (match.includes('TODO')) return match;
    return '';
  });
  
  // Remove lines that became empty (whitespace only) due to comment removal
  // This helps clean up the file but keeps intentional blank lines (mostly).
  // Doing this naively might remove indentation for subsequent lines if not careful,
  // but regex `^\s*$` matches empty lines.
  // Actually, better to leave blank lines than risk collapsing code too much.
  // But purely empty lines from comments are annoying.
  // I'll stick to just removing the comment text.

  await writeFile(path, content, 'utf8');
  console.log(`Processed ${path}`);
}

console.log('Starting comment removal...');
const files = await getFiles(targetDir);
for (const file of files) {
  await processFile(file);
}
console.log('Done.');
