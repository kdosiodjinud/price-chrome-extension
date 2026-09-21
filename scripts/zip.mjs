/**
 * Packs dist/ into the upload archive for the Chrome Web Store.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const releaseDir = resolve(root, 'release');

if (!existsSync(dist)) throw new Error('dist/ not found — run `npm run build` first');

const { name, version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const target = resolve(releaseDir, `${name}-${version}.zip`);

mkdirSync(releaseDir, { recursive: true });
rmSync(target, { force: true });

// Zip the directory contents, not the directory itself: the store expects
// manifest.json at the archive root.
execFileSync('zip', ['-r', '-q', '-X', target, '.'], { cwd: dist });
console.log(target);
