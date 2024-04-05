import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.js";
import { User } from "../models/user.js";
import { Like } from "../models/like.js";
import { Comment } from "../models/comment.js";
import { Playlist } from "../models/playlist.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary,deleteFileFromCloudinary } from "../utils/cloudinary.js";


const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType } = req.query;
  const userId = req.user?._id;
  // Prepare the options for pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: sortBy
      ? { [sortBy]: sortType === "desc" ? -1 : 1 }
      : { createdAt: -1 },
  };

  // Prepare the conditions for filtering
  const conditions = {};
  if (query) {
    // Add conditions for searching by title, description, etc.
    conditions.title = { $regex: query, $options: "i" }; // Case-insensitive search for title
    // You can add conditions for other fields similarly
    // For example:
    conditions.description = { $regex: query, $options: "i" }; // Case-insensitive search for description
  }
  if (userId) {
    conditions.owner = userId; // Filter videos by user ID
  }

  // Perform the database query
  const videos = await Video.aggregatePaginate(conditions, options);

  for (let video of videos.docs) {
    const likes = await Like.find({ video: video._id }).populate(
      "likedBy",
      "fullName username"
    );
    video.likes = likes.map((like) => like.likedBy);

    // Populate 'owner' field
    const owner = await User.findById(video.owner).select("fullName username");
    video.owner = owner;
  }

  // Return the paginated list of videos
  if (!videos) {
    console.log("error in fetching videos");
    throw new ApiError(500, "error in fetching video");
  }

  return res
    .status(200)
    .json(new ApiResponse(201, videos, "videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  // TODO: get video, upload to cloudinary, create

  if (!title || !description) {
    console.error("Error: Title or description is missing");
    throw new ApiError(400, "Title and description are required");
  }

  const userId = req.user?._id;

  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;
  // console.log("Debug: Video file path:", videoFileLocalPath);
  // console.log("Debug: Thumbnail file path:", thumbnailLocalPath);

  // Upload video and thumbnail to Cloudinary
  const videoFile = await uploadOnCloudinary(videoFileLocalPath);

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  const videoDuration = videoFile?.duration;
  // console.log("video duration", videoDuration);

  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload thumbnail");
  }
  if (!videoFile) {
    throw new ApiError(500, "Failed to upload video");
  }

  // Create the video document in the database
  const video = await Video.create({
    title,
    description,
    videoFile: videoFile.secure_url,
    thumbnail: thumbnail.secure_url,
    duration: videoDuration,
    owner: userId,
  });

  //api response
  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId.trim()) {
    throw new ApiError(400, "Invalid video id");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const numberOfLikes = await Like.countDocuments({ video: videoId });
  const numberOfComments = await Comment.countDocuments({ video: videoId });
  const video = await Video.findById(videoId)
    .populate({
      path: "owner",
      select: "fullName username",
    })
    .exec();

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Dynamically add numberOfLikes to the video object
  const videoWithNumberOfLikesAndComments = {
    ...video.toObject(),
    numberOfLikes: numberOfLikes,
    numberOfComments: numberOfComments,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, videoWithNumberOfLikesAndComments, "Video found")
    );
});

const updateVideoThumbnail = asyncHandler(async (req, res) => {
  //TODO: update video details like title, description, thumbnail
  const { videoId } = req.params;
  const userId = req.user?._id;

  if (!videoId.trim()) {
    throw new ApiError(400, "Invalid video id");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const videoOwner = await Video.findById(videoId).select("owner thumbnail").exec();
  console.log("video owner: ", videoOwner);
  if (!videoOwner || videoOwner.owner.toString() !== userId.toString()) {
    throw new ApiError(
      403,
      "Video Not found || You are not owner of this video"
    );
  }

  await deleteFileFromCloudinary(videoOwner.thumbnail,false);

  const thumbnailLocalPath = req.file?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail.secure_url) {
    throw new ApiError(400, "error while uploading avatar");
  }

  const video = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        thumbnail: thumbnail.secure_url,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Avatar updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;

  if (!videoId.trim() || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Check if the authenticated user is the owner of the video
  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not the owner of this video");
  }

  try {
    // Check if the video is in any playlist
    const playlistsWithVideo = await Playlist.find({ videos: videoId });

    if (playlistsWithVideo.length > 0) {
      const playlistNames = playlistsWithVideo.map((playlist) => playlist.name);
      const message = `The video is in the following playlists: ${playlistNames.join(", ")}. Please remove it from these playlists before deleting.`;
      return res.status(400).json(new ApiResponse(400, null, message));
    }

    // Delete all likes associated with the video
    await Like.deleteMany({ video: videoId });

    // Find all comments associated with the video
    const comments = await Comment.find({ video: videoId });

    // Loop through each comment
    for (const comment of comments) {
      // Delete all likes associated with the comment
      await Like.deleteMany({ comment: comment._id });

      // Delete the comment itself
      await findByIdAndDelete(comment._id);
    }
    // Remove the video from all users' watch history
    await User.updateMany(
      { watchHistory: videoId },
      { $pull: { watchHistory: videoId } }
    );

    // Delete the video from Cloudinary
    await deleteFileFromCloudinary(video.videoFile,true);
    await deleteFileFromCloudinary(video.thumbnail,false);
    // Finally, delete the video itself
    await Video.findByIdAndDelete(videoId);

    return res.status(200).json(new ApiResponse(200, null, "Video deleted"));
  } catch (error) {
    console.error("Error while deleting video:", error);
    throw new ApiError(500, "Error while deleting video");
  }
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;
  if (!videoId.trim()) {
    throw new ApiError(400, "Invalid video id");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const videoOwner = await Video.findById(videoId).select("owner").exec();
  if (!videoOwner || videoOwner.owner.toString() !== userId.toString()) {
    throw new ApiError(
      403,
      "Video Not found || You are not owner of this video"
    );
  }

  // Find the video by its ID
  const video = await Video.findById(videoId).select("-owner").exec();

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Toggle the isPublished status
  video.isPublished = !video.isPublished;

  // Save the updated video document
  const updatedVideo = await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video publish status updated"));
});

const updateVideoViews = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;
  if (!videoId.trim()) {
    throw new ApiError(400, "Invalid video id");
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  // Find the video by its ID
  const video = await Video.findById(videoId);

  if (!video) {
    // Handle the case where the video is not found
    console.log("Video not found");
    throw new ApiError(404, "Video not found");
  }

  // Increment the views count
  video.views += 1;

  // Save the updated video
  await video.save();

  // Return a success response
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Video views updated successfully"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideoThumbnail,
  deleteVideo,
  togglePublishStatus,
  updateVideoViews,
};
