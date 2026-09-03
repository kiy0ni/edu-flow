-- Suivi local des documents : dernier accès, mise en favori.
CREATE TABLE IF NOT EXISTS document_state (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  TEXT NOT NULL,
  opened_at    TIMESTAMPTZ,
  starred      BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, document_id)
);
