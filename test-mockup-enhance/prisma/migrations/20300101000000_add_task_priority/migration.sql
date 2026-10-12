-- Adds the task priority enum and the non-null "Task"."priority" column.
--
-- Written idempotently on purpose: the column may already have been introduced
-- by an earlier migration in a deployed database, and no delivered row may be
-- lost or invalidated. Existing rows are backfilled with 'Medium'.

DO $$
BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('Low', 'Medium', 'High');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "priority" "TaskPriority" NOT NULL DEFAULT 'Medium';

-- Every pre-existing task becomes a Medium-priority task.
UPDATE "Task" SET "priority" = 'Medium' WHERE "priority" IS NULL;
