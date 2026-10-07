-- Access codes: only a keyed hash of each code is stored, never the code itself.
CREATE TABLE codes (
  id               TEXT PRIMARY KEY,
  code_hash        TEXT NOT NULL UNIQUE,
  label            TEXT NOT NULL,            -- who the code is for (e.g. a company name)
  slugs            TEXT NOT NULL,            -- JSON array of case-study slugs this code unlocks
  created_at       INTEGER NOT NULL,         -- unix seconds
  expires_at       INTEGER NOT NULL,         -- the code must be redeemed before this
  session_hours    INTEGER NOT NULL DEFAULT 48,
  redeemed_at      INTEGER,                  -- set once, atomically; a code can never be redeemed twice
  redeemed_session TEXT,
  revoked_at       INTEGER
);

-- Sessions: only a hash of the cookie token is stored.
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  code_id     TEXT NOT NULL REFERENCES codes(id),
  slugs       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);
CREATE INDEX sessions_code ON sessions(code_id);

-- Failed redemption attempts, keyed by a keyed hash of the visitor's IP (the raw IP is not stored).
CREATE TABLE attempts (
  ip_hash TEXT NOT NULL,
  ts      INTEGER NOT NULL
);
CREATE INDEX attempts_ip_ts ON attempts(ip_hash, ts);
