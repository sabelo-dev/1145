-- Minimal Supabase platform stubs so the project's migrations can be replayed
-- on a plain PostgreSQL 18 (local, throwaway). Impersonate a user with:
--   SET request.jwt.claim.sub = '<uuid>'; SET request.jwt.claims = '{"aal":"aal1"}'; SET ROLE authenticated;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_admin NOLOGIN;
CREATE ROLE supabase_auth_admin NOLOGIN;
CREATE ROLE supabase_storage_admin NOLOGIN;
CREATE ROLE dashboard_user NOLOGIN;
CREATE ROLE authenticator NOLOGIN NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
GRANT anon, authenticated, service_role TO postgres;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS net;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
ALTER DATABASE postgres SET search_path = public, extensions;
SET search_path = public, extensions;

CREATE TABLE auth.users (
  instance_id uuid, id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, invited_at timestamptz, confirmation_token text, confirmation_sent_at timestamptz,
  recovery_token text, recovery_sent_at timestamptz, email_change text, last_sign_in_at timestamptz,
  raw_app_meta_data jsonb DEFAULT '{}', raw_user_meta_data jsonb DEFAULT '{}', is_super_admin boolean,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), phone text, phone_confirmed_at timestamptz,
  confirmed_at timestamptz, banned_until timestamptz, deleted_at timestamptz, is_anonymous boolean DEFAULT false, is_sso_user boolean DEFAULT false
);
CREATE TABLE auth.identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, provider text, identity_data jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now(), aal text);
CREATE TABLE auth.mfa_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, status text, factor_type text);

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT email FROM auth.users WHERE id = auth.uid() $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
         || jsonb_build_object('sub', auth.uid()) $$;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, owner uuid, public boolean DEFAULT false, avif_autodetection boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid, owner_id text,
  metadata jsonb, user_metadata jsonb, version text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), last_accessed_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
CREATE FUNCTION storage.filename(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
CREATE FUNCTION storage.extension(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT split_part(storage.filename(name), '.', -1) $$;

-- pg_net stub: records calls instead of sending them.
CREATE TABLE net.calls (id bigserial PRIMARY KEY, url text, headers jsonb, body jsonb, at timestamptz DEFAULT now());
CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}', params jsonb DEFAULT '{}', headers jsonb DEFAULT '{}', timeout_milliseconds int DEFAULT 5000)
RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.calls (url, headers, body) VALUES (url, headers, body) RETURNING id $$;
CREATE FUNCTION net.http_get(url text, params jsonb DEFAULT '{}', headers jsonb DEFAULT '{}', timeout_milliseconds int DEFAULT 5000)
RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.calls (url, headers) VALUES (url, headers) RETURNING id $$;
GRANT USAGE ON SCHEMA net TO postgres, service_role;

CREATE PUBLICATION supabase_realtime;

GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
