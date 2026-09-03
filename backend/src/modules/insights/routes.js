import { Router } from "express";
import * as service from "./service.js";
import { asyncHandler } from "../../lib/errors.js";

const router = Router();

router.get("/", asyncHandler(async (req, res) => res.json(await service.analyser(req.user))));

export default router;
