-- =====================================================================
-- Messagerie : état local des messages reçus et messages envoyés
-- =====================================================================

-- Le contenu des messages reçus vient de l'établissement ; seul l'état de
-- lecture, l'archivage et la suppression sont propres à EduFlow.
CREATE TABLE IF NOT EXISTS message_state (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  read_at    TIMESTAMPTZ,
  starred    BOOLEAN NOT NULL DEFAULT false,
  archived   BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

-- Messages rédigés depuis EduFlow.
CREATE TABLE IF NOT EXISTS outbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destinataires JSONB NOT NULL DEFAULT '[]'::jsonb,
  sujet         TEXT NOT NULL,
  corps         TEXT NOT NULL,
  repond_a      TEXT,
  brouillon     BOOLEAN NOT NULL DEFAULT false,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_user ON outbox (user_id, created_at DESC);
