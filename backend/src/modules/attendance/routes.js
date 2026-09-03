import { Router } from "express";
import { z } from "zod";
import gateway from "../../providers/gateway.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateQuery } from "../../lib/validate.js";
import { ISO_DAY } from "../../lib/dates.js";

const router = Router();

/** Vie scolaire : absences, retards et sanctions, avec synthese chiffree. */
router.get(
  "/",
  validateQuery(
    z.object({
      from: z.string().regex(ISO_DAY).optional(),
      to: z.string().regex(ISO_DAY).optional(),
      type: z.enum(["absence", "retard", "sanction"]).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { type, ...plage } = req.validatedQuery;
    const tous = await gateway.vieScolaire(req.user, plage);
    const evenements = type ? tous.filter((e) => e.type === type) : tous;

    const parType = (t) => tous.filter((e) => e.type === t);
    const absences = parType("absence");
    const retards = parType("retard");

    res.json({
      evenements,
      synthese: {
        absences: absences.length,
        absencesNonJustifiees: absences.filter((a) => !a.justifie).length,
        heuresManquees: Math.round((absences.reduce((a, e) => a + (e.duree ?? 0), 0) / 60) * 10) / 10,
        retards: retards.length,
        retardsNonJustifies: retards.filter((r) => !r.justifie).length,
        sanctions: parType("sanction").length,
      },
    });
  }),
);

export default router;
