-- Fiches de revision, quiz et resumes produits par l'assistant.
CREATE TABLE IF NOT EXISTS study_artifacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('fiche', 'quiz', 'brief', 'plan', 'resume')),
  subject      TEXT,
  title        TEXT NOT NULL,
  content      JSONB NOT NULL,
  source_ref   TEXT,
  pinned       BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_user_kind ON study_artifacts (user_id, kind, created_at DESC);
