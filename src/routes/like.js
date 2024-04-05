import { Router } from 'express';
import {
    getUserLikedVideos,
    toggleCommentLike,
    toggleVideoLike,
    toggleTweetLike,
    getUserLikedTweets,
    getUserLikedComments,
} from "../controllers/like.js"
import {verifyJWT} from "../middlewares/auth.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/toggle/v/:videoId").post(toggleVideoLike);
router.route("/toggle/c/:commentId").post(toggleCommentLike);
router.route("/toggle/t/:tweetId").post(toggleTweetLike);
router.route("/likedVideos").get(getUserLikedVideos);
router.route("/likedTweets").get(getUserLikedTweets);
router.route("/likedComments").get(getUserLikedComments);

export default router