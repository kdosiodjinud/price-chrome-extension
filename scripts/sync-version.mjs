/**
 * Keeps manifest.json's version in step with package.json, so `npm version`
 * is the single place a release number is bumped.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgPath = resolve(root, 'package.json');
const manifestPath = resolve(root, 'public/manifest.json');

const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));

// The Chrome Web Store accepts one to four dot-separated integers.
if (!/^\d+(\.\d+){0,3}$/.test(version)) {
  throw new Error(`package.json version "${version}" is not a valid extension version`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== version) {
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest.json version -> ${version}`);
}
