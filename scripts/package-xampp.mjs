import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const xamppSrcDir = path.join(rootDir, 'xampp');
const outDir = path.join(rootDir, 'xampp-dist');

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.cpSync(distDir, outDir, { recursive: true });
fs.cpSync(path.join(xamppSrcDir, 'api'), path.join(outDir, 'api'), { recursive: true });
fs.copyFileSync(path.join(xamppSrcDir, '.htaccess'), path.join(outDir, '.htaccess'));
fs.copyFileSync(path.join(xamppSrcDir, 'database.sql'), path.join(outDir, 'database.sql'));
fs.copyFileSync(path.join(xamppSrcDir, 'README.md'), path.join(outDir, 'README.md'));

console.log(`XAMPP bundle ready at: ${outDir}`);
