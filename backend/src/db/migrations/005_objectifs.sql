-- =====================================================================
-- Objectifs de note et suivi de l'activité de travail
-- =====================================================================

-- Objectif de moyenne, par matière ou pour l'ensemble (matiere_code = '_GENERAL').
CREATE TABLE IF NOT EXISTS objectifs (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matiere_code TEXT NOT NULL,
  periode_code TEXT NOT NULL,
  cible        NUMERIC(4,2) NOT NULL CHECK (cible > 0 AND cible <= 20),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, matiere_code, periode_code)
);

-- Journal d'activité : une ligne par jour où l'élève a réellement travaillé.
-- Alimente la série de jours actifs et le bilan hebdomadaire.
CREATE TABLE IF NOT EXISTS journal_activite (
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jour              DATE NOT NULL,
  devoirs_faits     INTEGER NOT NULL DEFAULT 0,
  cartes_revisees   INTEGER NOT NULL DEFAULT 0,
  minutes_focus     INTEGER NOT NULL DEFAULT 0,
  blocs_termines    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, jour)
);

CREATE INDEX IF NOT EXISTS idx_journal_user_jour ON journal_activite (user_id, jour DESC);
