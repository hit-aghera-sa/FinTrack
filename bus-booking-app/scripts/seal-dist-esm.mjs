import { mkdirSync, writeFileSync } from 'node:fs';

// The server bundle is emitted as ESM (root package.json is "type":"module"). Node resolves a module's
// type from the NEAREST package.json, so a dist/package.json saying anything else makes dist unloadable.
mkdirSync('dist', { recursive: true });
writeFileSync('dist/package.json', JSON.stringify({ name: 'app-dist', private: true, type: 'module' }, null, 2) + '\n');
