// Build script to prepare www/ folder for Tauri bundling
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const srcDir = path.join(__dirname, 'src');
const rootFiles = ['index.html', 'bubble.html'];
const destDir = path.join(__dirname, 'www');

// Clean www/ directory (except loader files for backwards compat)
if (fs.existsSync(destDir)) {
  const files = fs.readdirSync(destDir);
  files.forEach(file => {
    if (!file.startsWith('loader')) {
      const filePath = path.join(destDir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  });
} else {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy root HTML files
console.log('Copying root HTML files...');
rootFiles.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(destDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ ${file}`);
  }
});

// Copy src/ directory recursively
console.log('Copying src/ directory...');
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(srcDir, path.join(destDir, 'src'));
console.log('  ✓ src/ directory copied');

console.log('\n✅ Build complete! www/ is ready for Tauri bundling.');
