-- =====================================================================
-- EduFlow - schema initial
-- =====================================================================

-- gen_random_uuid() est fourni par le coeur de PostgreSQL depuis la version 13 :
-- aucune extension n'est requise.

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT NOT NULL CHECK (provider IN ('ecoledirecte', 'demo', 'local')),
  provider_account_id TEXT NOT NULL,
  username            TEXT,
  first_name          TEXT NOT NULL DEFAULT '',
  last_name           TEXT NOT NULL DEFAULT '',
  email               TEXT,
  phone               TEXT,
  avatar_url          TEXT,
  role                TEXT NOT NULL DEFAULT 'eleve'
                        CHECK (role IN ('eleve', 'parent', 'professeur', 'admin')),
  class_label         TEXT,
  school_name         TEXT,
  password_hash       TEXT,
  provider_token_enc  TEXT,
  provider_meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_synced_at  TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email)) WHERE email IS NOT NULL;

-- --------------------------------------------------------- preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme          TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  accent         TEXT NOT NULL DEFAULT 'indigo',
  locale         TEXT NOT NULL DEFAULT 'fr-FR',
  ai_opt_in      BOOLEAN NOT NULL DEFAULT true,
  notifications  JSONB NOT NULL DEFAULT
                   '{"nouvelleNote":true,"devoirProche":true,"absence":true,"message":true,"briefQuotidien":true}'::jsonb,
  study          JSONB NOT NULL DEFAULT
                   '{"debut":"17:00","fin":"20:30","dureeBloc":45,"pause":10,"joursOff":["dimanche"]}'::jsonb,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------ sessions
CREATE TABLE IF NOT EXISTS sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent         TEXT,
  ip                 TEXT,
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;

-- ------------------------------------------------- etat des devoirs
-- Le contenu des devoirs vient du provider ; ici on ne stocke que
-- l'etat local (fait / estimation / notes perso).
CREATE TABLE IF NOT EXISTS homework_state (
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  homework_id       TEXT NOT NULL,
  done              BOOLEAN NOT NULL DEFAULT false,
  done_at           TIMESTAMPTZ,
  estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 5 AND 480),
  difficulty        SMALLINT CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 5),
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, homework_id)
);

-- ------------------------------------------------ planificateur revisions
CREATE TABLE IF NOT EXISTS planner_blocks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day            DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'revision'
                   CHECK (kind IN ('revision', 'devoir', 'controle', 'pause', 'autre')),
  subject        TEXT,
  title          TEXT NOT NULL,
  detail         TEXT,
  homework_id    TEXT,
  priority       SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status         TEXT NOT NULL DEFAULT 'planifie'
                   CHECK (status IN ('planifie', 'fait', 'reporte', 'annule')),
  auto_generated BOOLEAN NOT NULL DEFAULT true,
  generation_id  UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_planner_user_day ON planner_blocks (user_id, day);

-- ------------------------------------------------------ revisions (SRS)
CREATE TABLE IF NOT EXISTS decks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  subject     TEXT,
  description TEXT,
  source      TEXT NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel', 'ia', 'import')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decks_user ON decks (user_id);

CREATE TABLE IF NOT EXISTS cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id       UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front         TEXT NOT NULL,
  back          TEXT NOT NULL,
  hint          TEXT,
  -- Parametres SM-2
  ease          NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions   INTEGER NOT NULL DEFAULT 0,
  lapses        INTEGER NOT NULL DEFAULT 0,
  due_on        DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_due ON cards (deck_id, due_on);

CREATE TABLE IF NOT EXISTS card_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quality     SMALLINT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  interval_before INTEGER NOT NULL DEFAULT 0,
  interval_after  INTEGER NOT NULL DEFAULT 0,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_reviews_user_date ON card_reviews (user_id, reviewed_at);

-- ------------------------------------------------------- sessions focus
CREATE TABLE IF NOT EXISTS focus_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject         TEXT,
  homework_id     TEXT,
  planned_minutes INTEGER NOT NULL DEFAULT 25,
  actual_minutes  INTEGER,
  interruptions   INTEGER NOT NULL DEFAULT 0,
  rating          SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  note            TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_focus_user_started ON focus_sessions (user_id, started_at DESC);

-- -------------------------------------------------------- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'succes', 'attention', 'urgent')),
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  dedupe_key  TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- ------------------------------------------------------------------ IA
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Nouvelle conversation',
  scope      TEXT NOT NULL DEFAULT 'general',
  archived   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  model           TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           DATE NOT NULL DEFAULT CURRENT_DATE,
  messages      INTEGER NOT NULL DEFAULT 0,
  input_tokens  BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- ------------------------------------------------- cache donnees provider
CREATE TABLE IF NOT EXISTS provider_cache (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key  TEXT NOT NULL,
  payload    JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_provider_cache_expiry ON provider_cache (expires_at);
