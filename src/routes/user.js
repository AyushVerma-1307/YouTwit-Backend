import { Router } from "express";
import {
  changeCurrentPassword,
  getAllUsers,
  getCurrentUser,
  getUserChannelProfile,
  getUserDetails,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  removeUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.js";

import { upload } from "../middlewares/multer.js";
import { verifyJWT } from "../middlewares/auth.js";
const router = Router();

router.post(
  "/register",
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.post("/login", loginUser);

//secured routes
router.post("/logout", verifyJWT, logoutUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/change-password", verifyJWT, changeCurrentPassword);
router.get("/current-user", verifyJWT, getCurrentUser);
router.patch("/update-account", verifyJWT, updateAccountDetails);
router.get("/allUsers",getAllUsers);

router.patch(
  "/update-avatar",
  verifyJWT,
  upload.single("avatar"),
  updateUserAvatar
);

router.patch(
  "/update-coverImage",
  verifyJWT,
  upload.single("coverImage"),
  updateUserCoverImage
);

router.get("/c/:channelId",verifyJWT,getUserChannelProfile)

router.get("/watchHistory",verifyJWT,getWatchHistory);
router.delete("/removeUser",verifyJWT,removeUser)
router.get("/getUserDetails",verifyJWT,getUserDetails)
export default router;


