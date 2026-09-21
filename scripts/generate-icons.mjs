/**
 * Renders the extension icons from one SVG source.
 *
 * Run with `npm run icons` after changing the artwork. The PNGs are committed,
 * so a normal build does not need rsvg-convert installed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');
// The SVG source lives outside public/ so it is not shipped in the package.
const sourceDir = resolve(root, 'design');
const sizes = [16, 32, 48, 128];

// The mark: a metal gradient behind "≈", for a price restated as a weight.
const artwork = `  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d9b23c"/>
      <stop offset="0.55" stop-color="#c8a133"/>
      <stop offset="1" stop-color="#9aa3ad"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#metal)"/>
  <path d="M28 50c12-15 24-15 36 0s24 15 36 0" stroke="#ffffff" stroke-width="12"
        stroke-linecap="round" fill="none"/>
  <path d="M28 86c12-15 24-15 36 0s24 15 36 0" stroke="#ffffff" stroke-width="12"
        stroke-linecap="round" fill="none"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
${artwork}
</svg>
`;

/**
 * The store listing icon is not the toolbar icon.
 *
 * The Web Store asks for a 128x128 PNG whose artwork is only 96x96, centred,
 * with 16 px of transparent padding on every side — the surrounding UI needs
 * that room. Keeping the alpha channel also stops the Store from dropping the
 * mark into its own rounded frame, so the corners stay the ones drawn here.
 */
const storeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <g transform="translate(16 16) scale(0.75)">
${artwork}
  </g>
</svg>
`;

mkdirSync(outDir, { recursive: true });
mkdirSync(sourceDir, { recursive: true });
const svgPath = resolve(sourceDir, 'icon.svg');
writeFileSync(svgPath, svg);

for (const size of sizes) {
  execFileSync('rsvg-convert', [
    '-w', String(size),
    '-h', String(size),
    svgPath,
    '-o', resolve(outDir, `icon${size}.png`),
  ]);
  console.log(`public/icons/icon${size}.png`);
}

// Listing asset, uploaded in the dashboard rather than shipped in the package.
const storeSvgPath = resolve(sourceDir, 'store-icon.svg');
writeFileSync(storeSvgPath, storeSvg);
execFileSync('rsvg-convert', [
  '-w', '128',
  '-h', '128',
  storeSvgPath,
  '-o', resolve(sourceDir, 'store-icon-128.png'),
]);
console.log('design/store-icon-128.png');
