/*
# Fix admin password functions to use extensions schema for pgcrypto

The pgcrypto extension is installed in the `extensions` schema, not `public`.
The SECURITY DEFINER functions had `SET search_path = public` which hid the
`crypt()` and `gen_salt()` functions, causing a "function does not exist"
error when calling verify_admin_password or set_admin_password.

1. Modified Functions
- `verify_admin_password(text)`: Updated to call `extensions.crypt()` instead
  of bare `crypt()`. Also simplified to only use crypt() (removed the direct
  equality check which was comparing plaintext to hash).
- `set_admin_password(text)`: Updated to call `extensions.crypt()` and
  `extensions.gen_salt()` instead of bare function names.

2. Security
- No table or policy changes. Functions remain SECURITY DEFINER with the same
  execute grants (anon + authenticated).
*/

CREATE OR REPLACE FUNCTION verify_admin_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT admin_password_hash INTO stored_hash FROM app_settings WHERE id = 1;
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN crypt(p_password, stored_hash) = stored_hash;
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_admin_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verify_admin_password(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION set_admin_password(p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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