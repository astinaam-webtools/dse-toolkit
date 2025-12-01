import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Files and folders to copy
const assets = [
  'index.html',
  'analyzer.html',
  'guides.html',
  'market.html',
  'stock.html',
  'styles.css',
  'sw.js',
  'manifest.webmanifest',
  'src',
  'data',
  'icons'
];

// Ensure dist exists and is empty
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// Copy function
function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Building for production...');
assets.forEach(asset => {
  const srcPath = path.join(rootDir, asset);
  const destPath = path.join(distDir, asset);
  
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`Copied ${asset}`);
  } else {
    console.warn(`Warning: Asset not found: ${asset}`);
  }
});

console.log('Build complete! Assets are in /dist');
