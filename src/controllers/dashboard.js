import mongoose from "mongoose";
import { Video } from "../models/video.js";
import { Subscription } from "../models/subscription.js";
import { Like } from "../models/like.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  try {
    // Get the channel ID from the request parameters or from the authenticated user
    const channelId = req.user?._id;

    // Fetch the total video views for the channel
    const totalVideoViews = await Video.aggregate([
      { $match: { owner:new mongoose.Types.ObjectId(channelId) } },
      { $group: { _id: null, totalViews: { $sum: "$views" } } },
    ]);

    // Fetch the total subscribers for the channel
    const totalSubscribers = await Subscription.countDocuments({
      channel: channelId,
    });

    // Fetch the total videos uploaded by the channel
    const totalVideos = await Video.countDocuments({ owner: channelId });

    // Fetch the IDs of videos uploaded by the channel
    const channelVideos = await Video.find({ owner: channelId }, "_id");

    // Extract video IDs from the result
    const channelVideoIds = channelVideos.map(video => video._id);

    // Fetch the total likes received by the channel's videos
    const totalVideoLikes = await Like.countDocuments({ video: { $in: channelVideoIds } });

    // Return the channel stats
    return res.status(200).json({
      totalVideoViews:
        totalVideoViews.length > 0 ? totalVideoViews[0].totalViews : 0,
      totalSubscribers,
      totalVideos,
      totalVideoLikes,
    });
  } catch (error) {
    console.error("Error while fetching channel stats:", error);
    throw new ApiError(500, "Error while fetching channel stats");
  }
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel
  const channelId = req.user._id;

  if (!mongoose.isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  try {
    const videos = await Video.find({ owner: channelId });
    return res
      .status(200)
      .json(
        new ApiResponse(200, videos, "Channel videos fetched successfully")
      );
  } catch (error) {
    console.error("Error while getting channel videos:", error);
    throw new ApiError(500, "Error while getting channel videos");
  }
});

export { getChannelStats, getChannelVideos };
