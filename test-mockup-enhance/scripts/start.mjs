// Starts the compiled server entry produced by `npm run build`.
// The emit location is read from tsconfig.node.json so this launcher stays
// correct whatever outDir the server compilation uses.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

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

const config = readJsonWithComments(path.join(root, "tsconfig.node.json"));
const options = config && typeof config === "object" ? config.compilerOptions : null;
const outDir = options && typeof options.outDir === "string" ? options.outDir : "dist-server";

const candidates = [
  path.join(outDir, "server", "index.js"),
  path.join(outDir, "index.js"),
  path.join(outDir, "src", "server", "index.js"),
  path.join("dist-server", "server", "index.js"),
  path.join("dist-server", "index.js"),
  path.join("dist", "server", "index.js"),
  path.join("build", "server", "index.js"),
];

const entry = candidates
  .map((candidate) => path.resolve(root, candidate))
  .find((candidate) => existsSync(candidate));

if (!entry) {
  process.stderr.write(
    "[start] no compiled server entry found. Run `npm run build` first (it emits the server from src/server/index.ts).\n",
  );
  process.exit(1);
}

process.stdout.write(`[start] ${path.relative(root, entry)}\n`);

const child = spawn(process.execPath, [entry], { stdio: "inherit", env: process.env });
child.on("exit", (code) => {
  process.exit(typeof code === "number" ? code : 0);
});
