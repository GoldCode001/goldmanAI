/**
 * Build Script
 * Copies web assets to www folder for Capacitor
 */

import { cpSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const wwwDir = join(rootDir, 'www');

console.log('Building web assets for Capacitor...');

// Clean www folder
if (existsSync(wwwDir)) {
  console.log('Cleaning www folder...');
  rmSync(wwwDir, { recursive: true });
}

// Create www folder
mkdirSync(wwwDir, { recursive: true });

// Files and folders to copy
const toCopy = [
  'index.html',
  'src',
];

// Copy files
for (const item of toCopy) {
  const srcPath = join(rootDir, item);
  const destPath = join(wwwDir, item);

  if (existsSync(srcPath)) {
    console.log(`Copying ${item}...`);
    cpSync(srcPath, destPath, { recursive: true });
  } else {
    console.warn(`Warning: ${item} not found`);
  }
}

console.log('Build complete!');
console.log('www folder contents:');

// List contents
import { readdirSync } from 'fs';
const contents = readdirSync(wwwDir);
contents.forEach(f => console.log(`  - ${f}`));
