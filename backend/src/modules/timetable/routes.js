import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import gateway from "../../providers/gateway.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateQuery } from "../../lib/validate.js";
import { ISO_DAY, today, startOfWeek, endOfWeek, addDays } from "../../lib/dates.js";

const router = Router();

const plage = z.object({
  from: z.string().regex(ISO_DAY).optional(),
  to: z.string().regex(ISO_DAY).optional(),
});

/** Par defaut : la semaine en cours. */
const bornes = (q) => ({
  from: q.from ?? startOfWeek(today()),
  to: q.to ?? endOfWeek(today()),
});

router.get(
  "/",
  validateQuery(plage),
  asyncHandler(async (req, res) => {
    res.json(await service.semaine(req.user, bornes(req.validatedQuery)));
  }),
);

router.get(
  "/prochain",
  asyncHandler(async (req, res) => {
    res.json({ cours: await service.prochainCours(req.user) });
  }),
);

router.get(
  "/creneaux-libres",
  validateQuery(
    plage.extend({
      debut: z.string().optional(),
      fin: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const creneaux = await service.creneauxLibres(req.user, {
      from: q.from ?? today(),
      to: q.to ?? addDays(today(), 7),
      debutJournee: q.debut ?? "17:00",
      finJournee: q.fin ?? "21:00",
    });
    res.json({ creneaux });
  }),
);

router.get(
  "/export.ics",
  validateQuery(plage),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const ics = await service.versICS(req.user, {
      from: q.from ?? startOfWeek(today()),
      to: q.to ?? addDays(today(), 60),
    });
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="eduflow-emploi-du-temps.ics"');
    res.send(ics);
  }),
);

router.get(
  "/vacances",
  asyncHandler(async (req, res) => {
    res.json({ vacances: await gateway.vacances(req.user) });
  }),
);

export default router;
