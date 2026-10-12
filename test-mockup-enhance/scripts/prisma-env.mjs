// Ensures the Prisma CLI can resolve env("DATABASE_URL") during code generation.
// Runs as `postinstall`. A real DATABASE_URL in the environment always wins:
// the Prisma CLI loads .env with dotenv semantics, which never overrides
// variables that are already set. This file must never fail an install.
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PLACEHOLDER_URL = "postgresql://localhost:5432/app?schema=public";

function ensurePlaceholderDatabaseUrl() {
  const root = process.cwd();
  const schema = path.join(root, "prisma", "schema.prisma");
  if (!existsSync(schema)) {
    return;
  }

  const envFile = path.join(root, ".env");
  const current = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  if (/^\s*DATABASE_URL\s*=/m.test(current)) {
    return;
  }

  const line = `DATABASE_URL="${PLACEHOLDER_URL}"\n`;
  if (current.length === 0) {
    writeFileSync(envFile, line, "utf8");
  } else {
    appendFileSync(envFile, current.endsWith("\n") ? line : `\n${line}`, "utf8");
  }
  process.stdout.write(
    "[postinstall] added a placeholder DATABASE_URL to .env so `prisma generate` can run; real environment variables still take precedence.\n",
  );
}

try {
  ensurePlaceholderDatabaseUrl();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(`[postinstall] skipped .env preparation: ${message}\n`);
}

process.exit(0);
