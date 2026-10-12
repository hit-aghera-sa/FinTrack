-- Adds the "Label" table and the TaskLabel many-to-many relation between
-- Task and Label. Existing tasks start with no labels: nothing already stored
-- is changed or invalidated by this migration.
--
-- Written idempotently on purpose, exactly like the priority migration beside
-- it: a deployed database may already carry part of this shape, and no
-- delivered row may be lost.

CREATE TABLE IF NOT EXISTS "Label" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  -- The NAME of a design token (neutral / info / success / warning / danger).
  "color" TEXT NOT NULL DEFAULT 'neutral',
  CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- A label name is unique across the board, so a duplicate can never be stored.
CREATE UNIQUE INDEX IF NOT EXISTS "Label_name_key" ON "Label"("name");

-- The TaskLabel join table (Prisma's implicit many-to-many shape for the
-- relation named "TaskLabel": "A" is Label.id, "B" is Task.id).
CREATE TABLE IF NOT EXISTS "_TaskLabel" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "_TaskLabel_AB_unique" ON "_TaskLabel"("A", "B");
CREATE INDEX IF NOT EXISTS "_TaskLabel_B_index" ON "_TaskLabel"("B");

DO $$
BEGIN
  ALTER TABLE "_TaskLabel"
    ADD CONSTRAINT "_TaskLabel_A_fkey" FOREIGN KEY ("A")
    REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "_TaskLabel"
    ADD CONSTRAINT "_TaskLabel_B_fkey" FOREIGN KEY ("B")
    REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
