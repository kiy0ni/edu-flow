import { Router } from "express";
import { z } from "zod";
import { queryAll, queryOne } from "../../lib/db.js";
import { asyncHandler, notFound } from "../../lib/errors.js";
import { validateBody, validateParams } from "../../lib/validate.js";
import * as activite from "../activite/service.js";

const router = Router();

/**
 * Sessions de travail concentre (type Pomodoro).
 * Le temps reellement travaille alimente les statistiques et les insights.
 */

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sessions = await queryAll(
      `SELECT id, subject AS matiere, homework_id AS "homeworkId", planned_minutes AS "dureePrevue",
              actual_minutes AS "dureeReelle", interruptions, rating AS ressenti, note,
              started_at AS "debutLe", ended_at AS "finLe"
       FROM focus_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50`,
      [req.user.id],
    );

    const [stats] = await queryAll(
      `SELECT coalesce(sum(actual_minutes),0)::int AS "minutes7j",
              count(*)::int AS "sessions7j",
              coalesce(round(avg(rating)::numeric,1),0) AS "ressentiMoyen"
       FROM focus_sessions
       WHERE user_id = $1 AND started_at > now() - interval '7 days' AND ended_at IS NOT NULL`,
      [req.user.id],
    );

    const parMatiere = await queryAll(
      `SELECT subject AS matiere, coalesce(sum(actual_minutes),0)::int AS minutes
       FROM focus_sessions
       WHERE user_id = $1 AND started_at > now() - interval '30 days' AND subject IS NOT NULL
       GROUP BY subject ORDER BY minutes DESC`,
      [req.user.id],
    );

    res.json({ sessions, statistiques: { ...stats, parMatiere } });
  }),
);

router.post(
  "/",
  validateBody(
    z.object({
      matiere: z.string().max(80).optional(),
      homeworkId: z.string().max(160).optional(),
      dureePrevue: z.number().int().min(5).max(180).default(25),
    }),
  ),
  asyncHandler(async (req, res) => {
    const session = await queryOne(
      `INSERT INTO focus_sessions (user_id, subject, homework_id, planned_minutes)
       VALUES ($1,$2,$3,$4)
       RETURNING id, subject AS matiere, planned_minutes AS "dureePrevue", started_at AS "debutLe"`,
      [req.user.id, req.body.matiere ?? null, req.body.homeworkId ?? null, req.body.dureePrevue],
    );
    res.status(201).json({ session });
  }),
);

router.patch(
  "/:id",
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(
    z.object({
      dureeReelle: z.number().int().min(0).max(600).optional(),
      interruptions: z.number().int().min(0).max(100).optional(),
      ressenti: z.number().int().min(1).max(5).optional(),
      note: z.string().max(500).optional(),
      terminer: z.boolean().default(false),
    }),
  ),
  asyncHandler(async (req, res) => {
    const session = await queryOne(
      `UPDATE focus_sessions SET
         actual_minutes = COALESCE($3, actual_minutes),
         interruptions  = COALESCE($4, interruptions),
         rating         = COALESCE($5, rating),
         note           = COALESCE($6, note),
         ended_at       = CASE WHEN $7 THEN now() ELSE ended_at END
       WHERE id = $1 AND user_id = $2
       RETURNING id, actual_minutes AS "dureeReelle", interruptions, rating AS ressenti, ended_at AS "finLe"`,
      [
        req.params.id,
        req.user.id,
        req.body.dureeReelle ?? null,
        req.body.interruptions ?? null,
        req.body.ressenti ?? null,
        req.body.note ?? null,
        req.body.terminer,
      ],
    );
    if (!session) throw notFound("Session introuvable.");

    // Une session close alimente le journal d'activité, en minutes réellement travaillées.
    if (req.body.terminer && session.dureeReelle > 0) {
      activite.enregistrer(req.user.id, "focus", session.dureeReelle).catch(() => {});
    }

    res.json({ session });
  }),
);

export default router;
