-- Step 1: Add nullable column
ALTER TABLE project ADD COLUMN description TEXT;
ALTER TABLE doc_training ADD COLUMN description TEXT;

-- Step 2: Populate with default value
UPDATE project SET description = '';
UPDATE doc_training SET description = '';

-- Step 3: Enforce NOT NULL constraint
ALTER TABLE project ALTER COLUMN description SET NOT NULL;
ALTER TABLE doc_training ALTER COLUMN description SET NOT NULL;