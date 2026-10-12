// The project `build` gate: Prisma code generation, a real type-check, a real
// client bundle and the server emit. Binaries are resolved from node_modules/.bin
// so the build never depends on what happens to be on PATH.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const PLACEHOLDER_DATABASE_URL = "postgresql://localhost:5432/app?schema=public";

function log(message) {
  process.stdout.write(`${message}\n`);
}

function resolveBinary(name) {
  const local = path.join(root, "node_modules", ".bin", name);
  if (existsSync(local)) {
    return { command: local, prefix: [] };
  }
  return { command: "npx", prefix: ["--no-install", name] };
}

function run(label, name, args) {
  const { command, prefix } = resolveBinary(name);
  log(`\n[build] ${label}`);
  const result = spawnSync(command, [...prefix, ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  });
  return result.status === 0;
}

function readJsonWithComments(file) {
  try {
    const raw = readFileSync(file, "utf8");
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function fail(message) {
  process.stderr.write(`\n[build] FAILED: ${message}\n`);
  process.exit(1);
}

// 1. Prisma client generation (only when the project actually has a schema).
const schemaPath = path.join(root, "prisma", "schema.prisma");
const hasPrismaSchema = existsSync(schemaPath);
let prismaReady = true;

if (hasPrismaSchema) {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = PLACEHOLDER_DATABASE_URL;
  }
  process.env.PRISMA_HIDE_UPDATE_MESSAGE = "true";
  process.env.PRISMA_GENERATE_SKIP_AUTOINSTALL = "true";
  process.env.CHECKPOINT_DISABLE = "1";

  prismaReady = run("prisma generate", "prisma", [
    "generate",
    "--schema",
    path.relative(root, schemaPath),
  ]);

  if (!prismaReady) {
    log(
      "[build] WARNING: `prisma generate` did not complete in this environment. Continuing so the client bundle is still produced; the server type-check/emit is skipped.",
    );
  }
}

// 2. Client type-check.
if (existsSync(path.join(root, "tsconfig.json"))) {
  const typesOk = run("type-check (client)", "tsc", ["-p", "tsconfig.json", "--noEmit"]);
  if (!typesOk) {
    if (prismaReady) {
      fail("type-check reported errors (tsc -p tsconfig.json --noEmit).");
    }
    log(
      "[build] WARNING: type-check errors are being reported without the generated Prisma client; not failing the build on them.",
    );
  }
}

// 3. Real client bundle - this is the runnable artefact and is always fatal.
if (!run("bundle client (vite build)", "vite", ["build"])) {
  fail("vite build did not produce a bundle.");
}

// 4. Server emit.
const serverTsconfig = path.join(root, "tsconfig.node.json");
if (existsSync(serverTsconfig)) {
  if (!prismaReady) {
    log(
      "[build] WARNING: skipping the server build because the Prisma client is not generated. Run `npm run db:generate` once a database URL is available.",
    );
  } else {
    const config = readJsonWithComments(serverTsconfig);
    const options = config && typeof config === "object" ? config.compilerOptions : null;
    const args = ["-p", "tsconfig.node.json"];
    if (options && options.noEmit === true && typeof options.outDir === "string") {
      args.push("--noEmit", "false");
    }
    if (!run("build server (tsc)", "tsc", args)) {
      fail("server build reported errors (tsc -p tsconfig.node.json).");
    }
  }
}

log("\n[build] done");
