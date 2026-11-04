#!/usr/bin/env node
/*
 * Deterministic, offline token-compliance check (the `test:visual-diff` gate).
 *
 * Fails when any file under src/ contains a hex colour literal that is not part
 * of the approved design palette. The palette is read from design/tokens.css
 * when that file exists, otherwise from src/styles/tokens.css.
 *
 * Neutral shadow/overlay alphas - rgba(0,0,0,a) and rgba(255,255,255,a) - are
 * permitted and are not hex literals, so they are never flagged. Only genuine
 * 3/4/6/8-digit hex colour literals are matched; identifiers and fragments such
 * as `#root` or `#/route` contain non-hex characters and are ignored.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';

const ROOT = process.cwd();
const PALETTE_CANDIDATES = ['design/tokens.css', 'src/styles/tokens.css'];
const SCAN_ROOT = join(ROOT, 'src');
const SCAN_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.html',
  '.svg',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.qa']);

/* Matches a hex colour literal only when the `#` is not preceded by a word
 * character and the digits are followed by a non-hex boundary. */
const HEX_PATTERN = /(^|[^\w&])#([0-9a-fA-F]{3,8})(?![0-9a-zA-Z_-])/g;

/** Normalise a hex literal to its lowercase 6-digit RGB form. */
function normalise(digits) {
  const value = digits.toLowerCase();
  if (value.length === 3 || value.length === 4) {
    return value
      .slice(0, 3)
      .split('')
      .map((character) => character + character)
      .join('');
  }
  if (value.length === 6 || value.length === 8) {
    return value.slice(0, 6);
  }
  return null;
}

function collectHexes(text) {
  const found = [];
  for (const match of text.matchAll(HEX_PATTERN)) {
    const normalised = normalise(match[2]);
    if (normalised) {
      found.push({ raw: `#${match[2]}`, normalised });
    }
  }
  return found;
}

function loadPalette() {
  for (const candidate of PALETTE_CANDIDATES) {
    const absolute = join(ROOT, candidate);
    if (!existsSync(absolute)) continue;
    const allowed = new Set();
    for (const hex of collectHexes(readFileSync(absolute, 'utf8'))) {
      allowed.add(hex.normalised);
    }
    return { source: candidate, allowed };
  }
  return { source: null, allowed: new Set() };
}

function walk(directory, files = []) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const absolute = join(directory, entry);
    let stats;
    try {
      stats = statSync(absolute);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      walk(absolute, files);
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      files.push(absolute);
    }
  }
  return files;
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let position = 0; position < index && position < text.length; position += 1) {
    if (text[position] === '\n') line += 1;
  }
  return line;
}

function main() {
  const { source, allowed } = loadPalette();

  if (!source || allowed.size === 0) {
    console.error('visual-diff: no design palette found (design/tokens.css or src/styles/tokens.css).');
    process.exit(1);
  }

  if (!existsSync(SCAN_ROOT)) {
    console.log(`visual-diff: no src/ directory to scan; palette ${source} OK.`);
    return;
  }

  const paletteFileAbsolute = join(ROOT, source);
  const files = walk(SCAN_ROOT).filter((file) => file !== paletteFileAbsolute);
  const violations = [];
  let scannedLiterals = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(HEX_PATTERN)) {
      const normalised = normalise(match[2]);
      if (!normalised) continue;
      scannedLiterals += 1;
      if (!allowed.has(normalised)) {
        violations.push({
          file: relative(ROOT, file).split(sep).join('/'),
          line: lineNumberAt(text, match.index ?? 0),
          literal: `#${match[2]}`,
        });
      }
    }
  }

  const paletteList = [...allowed].sort().map((hex) => `#${hex}`).join(', ');

  if (violations.length > 0) {
    console.error(`visual-diff FAILED - ${violations.length} off-palette colour literal(s) found.`);
    console.error(`Approved palette (${source}): ${paletteList}`);
    for (const violation of violations) {
      console.error(`  ${violation.file}:${violation.line}  ${violation.literal}`);
    }
    console.error('Replace each literal with the matching var(--color-*) token.');
    process.exit(1);
  }

  console.log(
    `visual-diff OK - ${files.length} file(s) scanned, ${scannedLiterals} hex literal(s) all within the ${allowed.size}-colour palette from ${source}.`,
  );
}

main();
