import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
    updateVideoViews,
} from "../controllers/video.js"
import {verifyJWT} from "../middlewares/auth.js"
import {upload} from "../middlewares/multer.js"

const router = Router();


router
    .route("/")
    .get(getAllVideos) // No verifyJWT middleware applied here
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
            
        ]),
        verifyJWT,
        publishAVideo
    );

router
    .route("/:videoId")
    .get(verifyJWT,getVideoById)
    .delete(verifyJWT,deleteVideo)
    .patch(upload.single("thumbnail"),verifyJWT, updateVideo);
    
router.route("/views/:videoId").patch(verifyJWT,updateVideoViews)

router.route("/toggle/publish/:videoId").patch(verifyJWT,togglePublishStatus);

export default router;
