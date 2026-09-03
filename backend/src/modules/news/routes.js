import { Router } from "express";
import gateway from "../../providers/gateway.js";
import { asyncHandler } from "../../lib/errors.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const actualites = await gateway.actualites(req.user);
    res.json({
      actualites,
      categories: [...new Set(actualites.map((a) => a.categorie))].sort(),
    });
  }),
);

export default router;
