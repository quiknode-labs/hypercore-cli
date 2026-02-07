import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { access, readFile } from 'node:fs/promises';

test('package entry points and bin target are publishable', async () => {
  const root = process.cwd();
  const packagePath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(packageJson.main, 'dist/src/index.js');
  assert.equal(packageJson.types, 'dist/src/index.d.ts');
  assert.equal(packageJson.bin['hypercore-cli'], './bin/hypercore-cli.js');

  await access(path.join(root, packageJson.main));
  await access(path.join(root, packageJson.types));
  await access(path.join(root, packageJson.bin['hypercore-cli']));

  const binSource = await readFile(path.join(root, packageJson.bin['hypercore-cli']), 'utf8');
  assert.match(binSource, /dist\/src\/index\.js/);
});
