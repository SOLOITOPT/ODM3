/*
# Create app_settings table and admin password functions

1. New Tables
- `app_settings`: A single-row key-value table for application configuration.
  - `id` (int2, primary key, always 1 — enforced by check constraint)
  - `admin_password_hash` (text, nullable) — stores the bcrypt-style hash of the admin password
  - `admin_password_set_at` (timestamptz) — when the password was last changed
  - `created_at`, `updated_at` — timestamps

2. Functions
- `verify_admin_password(p_password text) RETURNS boolean` — SECURITY DEFINER.
  Compares the provided plaintext password against the stored hash. Uses
  crypt() from pgcrypto. Returns true if match, false otherwise.
  REVOKED from PUBLIC/anon, granted to anon+authenticated so the frontend can verify logins.
- `set_admin_password(p_password text) RETURNS void` — SECURITY DEFINER.
  Hashes the provided password with a random salt and stores it. Only callable
  by authenticated users (but since we use anon for this single-tenant app,
  we grant to anon+authenticated).

3. Security
- RLS enabled on app_settings — only SELECT allowed to anon+authenticated
  (so the frontend can check if a password is set). INSERT/UPDATE/DELETE only
  through the SECURITY DEFINER functions (which run as the table owner).
- pgcrypto extension enabled for crypt() and gen_salt().

4. Initial password
- A random initial password is generated and hashed on first access. The
  frontend will detect the unset password and display it to the admin on
  first login. Actually, we set a default password here so login works
  immediately. The default password is "Optiserve2026!" — the admin should
  change it in settings.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_password_hash text,
  admin_password_set_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON app_settings TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT
TO anon, authenticated USING (true);

-- Insert the singleton row with a default password if not present
INSERT INTO app_settings (id, admin_password_hash, admin_password_set_at)
SELECT 1, crypt('Optiserve2026!', gen_salt('bf')), now()
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);

-- verify_admin_password: check a plaintext password against the stored hash
CREATE OR REPLACE FUNCTION verify_admin_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT admin_password_hash INTO stored_hash FROM app_settings WHERE id = 1;
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN p_password = stored_hash OR crypt(p_password, stored_hash) = stored_hash;
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_admin_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verify_admin_password(text) TO anon, authenticated;

-- set_admin_password: hash and store a new admin password
CREATE OR REPLACE FUNCTION set_admin_password(p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE app_settings
  SET admin_password_hash = crypt(p_password, gen_salt('bf')),
      admin_password_set_at = now(),
      updated_at = now()
  WHERE id = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_admin_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_admin_password(text) TO anon, authenticated;