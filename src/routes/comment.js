import { Router } from 'express';
import {
    addComment,
    deleteComment,
    getAllComments,
    getVideoComments,
    updateComment,
} from "../controllers/comment.js"
import {verifyJWT} from "../middlewares/auth.js"

const router = Router();

// router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/:videoId").get(verifyJWT,getVideoComments).post(verifyJWT,addComment);
router.route("/c/:commentId").delete(verifyJWT,deleteComment).patch(verifyJWT,updateComment);
router.get("/", getAllComments);

export default router