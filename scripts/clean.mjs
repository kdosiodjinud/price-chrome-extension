import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const dir of ['dist', 'release']) {
  rmSync(resolve(root, dir), { recursive: true, force: true });
}
