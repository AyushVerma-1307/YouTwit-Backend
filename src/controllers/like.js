import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  try {
    // Extract videoId from request parameters
    const { videoId } = req.params;

    // Check if videoId is valid
    if (!isValidObjectId(videoId)) {
      throw new ApiError(400, "Invalid video id");
    }

    // Find existing like by the current user on the specified video
    const existingLike = await Like.findOneAndDelete({
      video: videoId,
      likedBy: req.user._id,
    });

    if (existingLike) {
      // If an existing like is found, delete it (unlike)
      return res
        .status(200)
        .json(new ApiResponse(200, null, "Video unliked successfully"));
    } else {
      // If no existing like is found, create a new like
      const newLike = new Like({ video: videoId, likedBy: req.user._id });
      const savedLike = await newLike.save();
      return res
        .status(201)
        .json(new ApiResponse(201, savedLike, "Video liked successfully"));
    }
  } catch (error) {
    console.error("Error while toggling video like:", error);
    throw new ApiError(500, "Error while toggling video like");
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  //TODO: toggle like on comment
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  try {
    const existingLike = await Like.findOneAndDelete({
      comment: commentId,
      likedBy: req.user._id,
    });

    if (existingLike) {
      return res
        .status(200)
        .json(new ApiResponse(200, null, "Comment unliked successfully"));
    } else {
      const newLike = new Like({ comment: commentId, likedBy: req.user._id });
      const savedLike = await newLike.save();

      return res
        .status(201)
        .json(new ApiResponse(201, savedLike, "Comment liked successfully"));
    }
  } catch (error) {
    console.error("Error while toggling comment like:", error);
    throw new ApiError(500, "Error while toggling comment like");
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  //TODO: toggle like on tweet
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }

  try {
    const existingLike = await Like.findOneAndDelete({
      tweet: tweetId,
      likedBy: req.user._id,
    });

    if (existingLike) {
      return res
        .status(200)
        .json(new ApiResponse(200, null, "Tweet unliked successfully"));
    } else {
      const newLike = new Like({ tweet: tweetId, likedBy: req.user._id });
      const savedLike = await newLike.save();

      return res
        .status(201)
        .json(new ApiResponse(201, savedLike, "Tweet liked successfully"));
    }
  } catch (error) {
    console.error("Error while toggling tweet like:", error);
    throw new ApiError(500, "Error while toggling tweet like");
  }
});

const getUserLikedVideos = asyncHandler(async (req, res) => {
  try {
    const likedVideos = await Like.find({ likedBy: req.user._id })
      .populate({
        path: "video",
        populate: {
          path: "owner",
          select: "username fullName", // Specify the fields to retrieve and exclude _id
        },
      })
      .populate({
        path: "likedBy",
        select: "username fullName", // Retrieve only the specified fields for the likedBy user
      });

    // Filter out entries that are not liked videos
    const filteredLikedVideos = likedVideos.filter(
      (entry) => entry.video !== null && entry.video !== undefined
    );

    if (filteredLikedVideos.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "No liked videos found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          filteredLikedVideos,
          "Liked videos retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error while getting liked videos:", error);
    throw new ApiError(500, "Error while getting liked videos");
  }
});

const getUserLikedTweets = asyncHandler(async (req, res) => {
  try {
    const likedTweets = await Like.find({ likedBy: req.user._id }).populate({
      path: "tweet",
      populate: {
        path: "owner",
        select: "username fullName",
      },
    }).populate({
      path: "likedBy",
      select: "username fullName",
    });
  
    const filteredLikedTweets = likedTweets.filter(
      (entry) => entry.tweet !== null && entry.tweet !== undefined
    );
  
    if (filteredLikedTweets.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "No liked tweets found"));
    }
  
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          filteredLikedTweets,
          "Liked tweets retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error while getting liked tweets:", error);
    throw new ApiError(500, "Error while getting liked tweets");
  }
});

const getUserLikedComments = asyncHandler(async (req, res) => {
  try {
    const likedComments = await Like.find({ likedBy: req.user._id }).populate({
      path: "comment",
      populate: {
        path: "owner",
        select: "username fullName",
      },
    }).populate({
      path: "likedBy",
      select: "username fullName",
    });

    const filteredLikedComments = likedComments.filter(
      (entry) => entry.comment !== null && entry.comment !== undefined
    );

    if (filteredLikedComments.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "No liked comments found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          filteredLikedComments,
          "Liked comments retrieved successfully"
        )
      );

  } catch (error) {
    console.error("Error while getting liked comments:", error);
    throw new ApiError(500, "Error while getting liked comments");    
  }
})

export {
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
  getUserLikedVideos,
  getUserLikedTweets,
  getUserLikedComments,
};
