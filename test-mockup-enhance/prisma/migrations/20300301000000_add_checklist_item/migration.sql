-- Adds the "ChecklistItem" table, its (taskId, position) index and the
-- cascading foreign key to "Task", so removing a task removes its checklist.
--
-- Written idempotently on purpose: part of this may already exist in a
-- deployed database, and no delivered row may be lost. Nothing here drops or
-- rewrites an existing column.

CREATE TABLE IF NOT EXISTS "ChecklistItem" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- One task's items are always read in display order.
CREATE INDEX IF NOT EXISTS "ChecklistItem_taskId_position_idx"
  ON "ChecklistItem" ("taskId", "position");

-- Removing a task removes its checklist rows.
DO $$
BEGIN
  ALTER TABLE "ChecklistItem"
    ADD CONSTRAINT "ChecklistItem_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
