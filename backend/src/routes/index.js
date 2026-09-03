import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import env from "../config/env.js";
import { aiDisponible } from "../modules/ai/client.js";

import authRoutes from "../modules/auth/routes.js";
import usersRoutes from "../modules/users/routes.js";
import dashboardRoutes from "../modules/dashboard/routes.js";
import timetableRoutes from "../modules/timetable/routes.js";
import gradesRoutes from "../modules/grades/routes.js";
import homeworkRoutes from "../modules/homework/routes.js";
import attendanceRoutes from "../modules/attendance/routes.js";
import messagesRoutes from "../modules/messages/routes.js";
import documentsRoutes from "../modules/documents/routes.js";
import newsRoutes from "../modules/news/routes.js";
import notificationsRoutes from "../modules/notifications/routes.js";
import plannerRoutes from "../modules/planner/routes.js";
import flashcardsRoutes from "../modules/flashcards/routes.js";
import focusRoutes from "../modules/focus/routes.js";
import insightsRoutes from "../modules/insights/routes.js";
import aiRoutes from "../modules/ai/routes.js";
import objectifsRoutes from "../modules/objectifs/routes.js";
import rechercheRoutes from "../modules/recherche/routes.js";

const router = Router();

router.get("/", (_req, res) =>
  res.json({
    nom: "EduFlow API",
    version: "2.0.0",
    documentation: "/api/v1/capacites",
  }),
);

/** Ce que sait faire cette instance : le front s'y adapte au demarrage. */
router.get("/capacites", (_req, res) =>
  res.json({
    version: "2.0.0",
    ia: aiDisponible(),
    demo: env.ALLOW_DEMO_ACCOUNTS,
    modules: [
      "emploi-du-temps", "notes", "devoirs", "vie-scolaire", "messagerie",
      "documents", "actualites", "notifications", "planificateur",
      "revisions", "concentration", "analyses", "assistant", "objectifs", "recherche",
    ],
  }),
);

router.use("/auth", authRoutes);

// Tout ce qui suit exige une session valide.
router.use(requireAuth);

router.use("/moi", usersRoutes);
router.use("/accueil", dashboardRoutes);
router.use("/emploi-du-temps", timetableRoutes);
router.use("/notes", gradesRoutes);
router.use("/devoirs", homeworkRoutes);
router.use("/vie-scolaire", attendanceRoutes);
router.use("/messagerie", messagesRoutes);
router.use("/documents", documentsRoutes);
router.use("/actualites", newsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/planificateur", plannerRoutes);
router.use("/revisions", flashcardsRoutes);
router.use("/concentration", focusRoutes);
router.use("/objectifs", objectifsRoutes);
router.use("/recherche", rechercheRoutes);
router.use("/analyses", insightsRoutes);
router.use("/assistant", aiRoutes);

export default router;
