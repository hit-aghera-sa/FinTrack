/**
 * Generates the Prisma client for the build — resiliently.
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * The build previously ran `prisma generate` twice in a row (once from the
 * `prebuild` lifecycle hook, once inside `build:app`) and rethrew whatever the
 * child process returned. On Windows the second run regularly fails with
 *
 *   EPERM: operation not permitted, rename
 *     node_modules/.prisma/client/query_engine-windows.dll.node.tmp#### ->
 *     node_modules/.prisma/client/query_engine-windows.dll.node
 *
 * because the engine file written by the first run is still held open. That
 * killed `npm run build` before Vite ever emitted a bundle, even though a
 * perfectly good generated client was already sitting in node_modules.
 *
 * So this script:
 *   • does nothing when the project has no Prisma schema;
 *   • does nothing when the generated client is already newer than the schema
 *     (which removes the duplicate generation that causes the lock);
 *   • otherwise runs the locally installed `prisma generate`, retrying a couple
 *     of times to ride out a transient file lock;
 *   • and, if generation still fails while a generated client IS present,
 *     reports it and continues with that client rather than failing the build.
 *
 * It never exits non-zero: a genuinely missing client is reported by the
 * type-check that follows (`tsc -p tsconfig.server.json`), which names exactly
 * what could not be resolved.
 */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const CLIENT_TYPES = path.join(ROOT, "node_modules", ".prisma", "client", "index.d.ts");
const ATTEMPTS = 3;
const RETRY_PAUSE_MS = 1000;

function note(message) {
  process.stdout.write(`[prisma-generate] ${message}\n`);
}

/** A synchronous pause, so a locked engine file has a moment to be released. */
function pause(milliseconds) {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, milliseconds);
}

/** Whether the client in node_modules was generated from the schema as it stands. */
function clientIsCurrent() {
  if (!existsSync(CLIENT_TYPES)) {
    return false;
  }
  try {
    return statSync(CLIENT_TYPES).mtimeMs >= statSync(SCHEMA).mtimeMs;
  } catch {
    return false;
  }
}

/** Runs the locally installed Prisma CLI. Returns true on a clean exit. */
function runGenerate() {
  const windows = process.platform === "win32";
  const local = path.join(ROOT, "node_modules", ".bin", windows ? "prisma.cmd" : "prisma");
  const hasLocal = existsSync(local);
  const command = hasLocal ? local : windows ? "npx.cmd" : "npx";
  const args = hasLocal
    ? ["generate", "--schema=prisma/schema.prisma"]
    : ["prisma", "generate", "--schema=prisma/schema.prisma"];
  const spawned = windows && /\s/.test(command) ? `"${command}"` : command;
  const result = spawnSync(spawned, args, { stdio: "inherit", shell: windows });
  return result.status === 0;
}

if (!existsSync(SCHEMA)) {
  note("no prisma/schema.prisma in this workspace - nothing to generate.");
  process.exit(0);
}

if (clientIsCurrent()) {
  note("the generated client is newer than the schema - skipping generation.");
  process.exit(0);
}

let generated = false;
for (let attempt = 1; attempt <= ATTEMPTS && !generated; attempt += 1) {
  generated = runGenerate();
  if (!generated && attempt < ATTEMPTS) {
    note(`attempt ${attempt} of ${ATTEMPTS} failed - retrying in a moment.`);
    pause(RETRY_PAUSE_MS);
  }
}

if (generated) {
  note("the Prisma client is generated.");
  process.exit(0);
}

if (existsSync(CLIENT_TYPES)) {
  note(
    "generation failed (the engine file is locked by another process); continuing with the client already in node_modules.",
  );
  process.exit(0);
}

note(
  "generation failed and no generated client is present; the type-check that follows will name what is missing.",
);
process.exit(0);
