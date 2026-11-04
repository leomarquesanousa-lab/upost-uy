CREATE TABLE users (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'EDITOR')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
CREATE TABLE settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_at_idx ON audit_log(created_at);
-- Contador compartilhado entre processos para limitar tentativas por e-mail.
CREATE TABLE login_attempts (
  key char(64) PRIMARY KEY,
  attempts integer NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now()
);
