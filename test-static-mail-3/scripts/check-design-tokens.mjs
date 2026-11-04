#!/usr/bin/env node
/**
 * Offline, deterministic token-compliance check.
 *
 * Fails when any file under src/ hardcodes a hex colour literal that the pinned
 * palette in design/tokens.css does not declare. Neutral rgba(0,0,0,a) /
 * rgba(255,255,255,a) shadow and overlay alphas are untouched: only genuine hex
 * literals are scanned.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TOKENS = path.join(ROOT, 'design', 'tokens.css');
const SRC = path.join(ROOT, 'src');
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const SCANNED = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);

/** Expand #abc to #aabbcc and lowercase, so equivalent literals compare equal. */
function normalize(hex) {
  const body = hex.slice(1).toLowerCase();
  if (body.length === 3 || body.length === 4) {
    return `#${body.split('').map((c) => c + c).join('')}`;
  }
  return `#${body}`;
}

function collect(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (SCANNED.has(path.extname(entry))) out.push(full);
  }
  return out;
}

if (!existsSync(TOKENS)) {
  console.log('visual-diff: no design/tokens.css — nothing to verify.');
  process.exit(0);
}

const allowed = new Set((readFileSync(TOKENS, 'utf8').match(HEX) ?? []).map(normalize));
const files = existsSync(SRC) ? collect(SRC, []) : [];
const violations = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const literal of line.match(HEX) ?? []) {
      const value = normalize(literal);
      const len = literal.length - 1;
      if (len !== 3 && len !== 4 && len !== 6 && len !== 8) continue;
      if (!allowed.has(value)) {
        violations.push(`${path.relative(ROOT, file)}:${index + 1} ${literal}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error('visual-diff FAILED — hex colours outside the pinned palette:');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(`visual-diff OK — ${files.length} file(s) scanned, ${allowed.size} palette colour(s).`);
