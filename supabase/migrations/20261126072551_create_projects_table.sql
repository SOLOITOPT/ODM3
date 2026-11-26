/*
# Create projects table and link mission orders to projects

1. New Tables
- `projects`: Stores company project records (name, description).
  Each project is entered once and then selected when creating mission orders.
  - `name` (text, not null): project name
  - `description` (text, nullable): optional project description
  - `created_at` (timestamptz): creation timestamp

2. Modified Tables
- `mission_orders`: Added `project_id` (uuid, nullable) — FK to projects.
  Nullable so existing mission orders are not broken. New orders can optionally
  link to a project.

3. Security
- RLS enabled on `projects` with full CRUD for `anon, authenticated` (single-tenant app, no sign-in screen).
- Grant SELECT, INSERT, UPDATE, DELETE on `projects` to `anon, authenticated`.
- Policies allow all operations for `anon, authenticated` (intentionally shared data).
- Existing mission_orders policies already use USING(true)/WITH CHECK(true), so the new `project_id` column is covered.

4. Indexes
- `mission_orders.project_id` for join performance.
*/

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE
TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mission_orders' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE mission_orders ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mission_orders_project_id ON mission_orders(project_id);