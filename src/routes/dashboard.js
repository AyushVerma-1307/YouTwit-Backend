import { Router } from "express";
import { getChannelStats, getChannelVideos } from "../controllers/dashboard.js";
import { verifyJWT } from "../middlewares/auth.js";

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/stats").get(getChannelStats);
router.route("/videos").get(getChannelVideos);

export default router;
