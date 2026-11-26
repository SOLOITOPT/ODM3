/*
# Add authorized_by column to mission_orders

1. Modified Tables
- `mission_orders`: Added `authorized_by` (text, nullable) — stores which direction
  authorized the mission order. Values: "operations" or "administration".
  This lets the printed document show the correct authorization label.

2. Security
- No policy changes. The existing CRUD policies on mission_orders already
  cover the new column since they use `USING (true)` / `WITH CHECK (true)`
  for this single-tenant app.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mission_orders' AND column_name = 'authorized_by'
  ) THEN
    ALTER TABLE mission_orders ADD COLUMN authorized_by text;
  END IF;
END $$;