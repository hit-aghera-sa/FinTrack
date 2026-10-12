-- Adds the "TaskActivity" table, its (taskId, createdAt) index and the
-- cascading foreign key to "Task".
--
-- Written idempotently on purpose: part of this may already exist in a
-- deployed database, and no delivered row may be lost. Nothing here drops or
-- rewrites an existing column.

CREATE TABLE IF NOT EXISTS "TaskActivity" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "field" TEXT,
  "fromValue" TEXT,
  "toValue" TEXT,
  "actor" TEXT,
  "message" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- The feed query reads one task's entries newest first.
CREATE INDEX IF NOT EXISTS "TaskActivity_taskId_createdAt_idx"
  ON "TaskActivity" ("taskId", "createdAt");

-- Removing a task removes its activity rows.
DO $$
BEGIN
  ALTER TABLE "TaskActivity"
    ADD CONSTRAINT "TaskActivity_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
