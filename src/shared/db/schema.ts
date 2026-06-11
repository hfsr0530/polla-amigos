// Esquema Postgres completo. Idempotente: se ejecuta en cada arranque.
//
// Modelo:
//  - pollas       → cada grupo juega su propia polla con su admin; el fixture
//                   del Mundial (teams/matches) es compartido
//  - entries      → la unidad que compite dentro de una polla (individual o pareja)
//  - users        → cada login; is_superadmin administra el torneo entero
//  - user_entries → membresías: una cuenta puede jugar en varias pollas
//  - invites      → códigos por polla; grants_admin entrega esa polla
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pollas (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  admin_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  polla_id INTEGER NOT NULL REFERENCES pollas(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  name_custom INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_entries_polla ON entries(polla_id);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  polla_id INTEGER NOT NULL REFERENCES pollas(id),
  kind TEXT NOT NULL,
  label TEXT,
  entry_id INTEGER REFERENCES entries(id),
  grants_admin INTEGER NOT NULL DEFAULT 0,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_superadmin INTEGER NOT NULL DEFAULT 0,
  entry_id INTEGER REFERENCES entries(id),
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS user_entries (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_user_entries_entry ON user_entries(entry_id);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id TEXT UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  tla TEXT,
  crest_url TEXT,
  group_name TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id TEXT UNIQUE,
  stage TEXT NOT NULL,
  group_name TEXT,
  matchday INTEGER,
  kickoff_utc TEXT NOT NULL,
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  home_label TEXT,
  away_label TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  home_goals INTEGER,
  away_goals INTEGER,
  minute TEXT,
  result_locked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

CREATE TABLE IF NOT EXISTS predictions (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_goals INTEGER NOT NULL CHECK (home_goals BETWEEN 0 AND 99),
  away_goals INTEGER NOT NULL CHECK (away_goals BETWEEN 0 AND 99),
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (entry_id, match_id)
);

CREATE TABLE IF NOT EXISTS award_picks (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  award TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  player_name TEXT,
  correct_override INTEGER,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (entry_id, award)
);

CREATE TABLE IF NOT EXISTS award_results (
  award TEXT PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  player_name TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  external_id TEXT UNIQUE,
  name TEXT NOT NULL,
  position TEXT,
  jersey TEXT
);

CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);

ALTER TABLE award_picks ADD COLUMN IF NOT EXISTS player_id INTEGER REFERENCES players(id);

ALTER TABLE award_results ADD COLUMN IF NOT EXISTS player_id INTEGER REFERENCES players(id)
`
