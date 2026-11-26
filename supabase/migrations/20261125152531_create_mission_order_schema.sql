/*
# Create Mission Order Management Schema

1. New Tables
- `employees`: Stores company employee records (first name, last name, job position).
  Each employee is entered once and then selected when creating mission orders.
- `vehicles`: Stores company vehicle records (model/type, registration plate).
  Each vehicle is entered once and then selected when creating mission orders.
- `mission_orders`: The core table — each row is a mission order (travel authorization)
  linking an employee and a vehicle with mission destination and date range.
  - `order_number`: human-readable sequential identifier (e.g. MO-2026-001).
  - `employee_id`: FK to employees.
  - `vehicle_id`: FK to vehicles.
  - `destination`: mission location.
  - `start_date`, `end_date`: mission duration.
  - `status`: draft / issued / archived.
  - `notes`: optional additional info.

2. Security
- This is a single-tenant app with no sign-in screen.
- RLS enabled on all three tables.
- CRUD granted to `anon, authenticated` on all tables.
- Policies allow all operations for `anon, authenticated` (intentionally shared data).

3. Indexes
- `mission_orders.employee_id` and `mission_orders.vehicle_id` for join performance.
- `mission_orders.order_number` unique index.
*/

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  position text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_employees" ON employees;
CREATE POLICY "anon_select_employees" ON employees FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_employees" ON employees;
CREATE POLICY "anon_insert_employees" ON employees FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_employees" ON employees;
CREATE POLICY "anon_update_employees" ON employees FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_employees" ON employees;
CREATE POLICY "anon_delete_employees" ON employees FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  registration_plate text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON vehicles TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_vehicles" ON vehicles;
CREATE POLICY "anon_select_vehicles" ON vehicles FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_vehicles" ON vehicles;
CREATE POLICY "anon_insert_vehicles" ON vehicles FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_vehicles" ON vehicles;
CREATE POLICY "anon_update_vehicles" ON vehicles FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_vehicles" ON vehicles;
CREATE POLICY "anon_delete_vehicles" ON vehicles FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS mission_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  destination text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mission_orders ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON mission_orders TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_mission_orders" ON mission_orders;
CREATE POLICY "anon_select_mission_orders" ON mission_orders FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mission_orders" ON mission_orders;
CREATE POLICY "anon_insert_mission_orders" ON mission_orders FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mission_orders" ON mission_orders;
CREATE POLICY "anon_update_mission_orders" ON mission_orders FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mission_orders" ON mission_orders;
CREATE POLICY "anon_delete_mission_orders" ON mission_orders FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_mission_orders_employee_id ON mission_orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_mission_orders_vehicle_id ON mission_orders(vehicle_id);

/*
# Add auto-incrementing order number sequence

Creates a sequence to generate human-readable order numbers (MO-YYYY-NNN).
A trigger function sets the order_number on insert if not provided.
*/

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val bigint;
  year_str text;
BEGIN
  year_str := EXTRACT(YEAR FROM now())::text;
  SELECT nextval('mission_order_seq') INTO seq_val;
  RETURN 'MO-' || year_str || '-' || lpad(seq_val::text, 3, '0');
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'mission_order_seq') THEN
    CREATE SEQUENCE mission_order_seq START 1;
  END IF;
END $$;

GRANT USAGE ON SEQUENCE mission_order_seq TO anon, authenticated;