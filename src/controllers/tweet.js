import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.js";
import { User } from "../models/user.js";
import { Like } from "../models/like.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user._id; // Assuming req.user is set by verifyJWT middleware
    if (!content) {
      console.log("Content is required");
      throw new ApiError(400, "Content is required");
    }

    const tweet = await Tweet.create({
      content,
      owner: userId,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, tweet, "tweet created successfully"));
  } catch (error) {
    console.error("Error creating tweet:", error);
    throw new ApiError(500, "Error creating tweet");
  }
};

const getUserTweets = asyncHandler(async (req, res) => {
  // Get the user ID from the request
  const userId = req.user?._id;

  try {
    // Query the database to find tweets by the user ID
    const tweets = await Tweet.find({ owner: userId });

    // Initialize objects to store number of likes and liked by users for each tweet
    const numberOfLikesOnTweet = {};
    const likedBy = {};

    // Iterate over each tweet to populate additional details
    for (const tweet of tweets) {
      // Populate the owner details for each tweet
      await tweet.populate("owner", "fullName");

      // Find likes for the current tweet
      const likes = await Like.find({ tweet: tweet._id }).populate(
        "likedBy",
        "fullName"
      );

      // Store the number of likes and likedBy users for the current tweet
      numberOfLikesOnTweet[tweet._id] = likes.length;
      likedBy[tweet._id] = likes.map((like) => like.likedBy.fullName);
    }

    // Create an array to hold tweets with additional information
    const tweetsWithLikes = tweets.map((tweet) => ({
      ...tweet.toObject(),
      numberOfLikes: numberOfLikesOnTweet[tweet._id],
      likedBy: likedBy[tweet._id],
    }));

    // Return the tweets with additional information in the response
    return res
      .status(200)
      .json(new ApiResponse(200, tweetsWithLikes, "User tweets fetched Successfully"));
  } catch (error) {
    // Handle any errors that occur during the database query
    console.error("Error fetching user tweets:", error);
    throw new ApiError(500, "Error fetching user tweets");
  }
});


const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet
  const { updatedContent } = req.body;
  //   console.log("updated content: ", updatedContent);

  const userId = req.user._id;
  const tweetId = req.params.tweetId;
  //   console.log("tweetId: ", tweetId);

  if (!updatedContent) {
    console.log("Content is required");
    throw new ApiError(400, "Content is required");
  }
  if (!isValidObjectId(tweetId)) {
    console.log("Invalid tweet ID");
    throw new ApiError(400, "Invalid tweet ID");
  }

  const tweetOwner = await Tweet.findById(tweetId).select("owner");
  if (!tweetOwner) {
    console.log("Tweet not found");
    throw new ApiError(404, "Tweet not found");
  }

  if (tweetOwner.owner.toString() !== userId.toString()) {
    console.log("Unauthorized to update tweet");
    throw new ApiError(403, "Unauthorized to update tweet");
  }
  try {
    const updatedTweet = await Tweet.findByIdAndUpdate(
      tweetId,
      {
        $set: {
          content: updatedContent,
        },
      },
      { new: true }
    );
    // console.log("updated Tweet: ", updatedTweet);

    if (!updatedTweet) {
      console.log("error: tweet not updated");
      throw new ApiError(404, "Error while updating tweet");
    }

    return res
      .status(200)
      .json(new ApiResponse(201, updatedTweet, "Tweet updated Successfully"));
  } catch (error) {
    console.log("Error while updating tweet:", error);
    throw new ApiError(500, "Error while updating tweet");
  }
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const tweetId = req.params.tweetId;
  const userId = req.user._id;
  try {
    const tweetOwner = await Tweet.findById(tweetId).select("owner");
    if (!tweetOwner) {
      console.log("Tweet not found");
      throw new ApiError(404, "Tweet not found");
    }

    if (tweetOwner.owner.toString() !== userId.toString()) {
      console.log("Unauthorized to delete tweet");
      throw new ApiError(403, "Unauthorized to delete tweet");
    }

    await Like.deleteMany({ tweet: tweetId });
    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

    if (!deletedTweet) {
      console.log("Tweet not found or deleted");
      throw new ApiError(500, "Tweet not found or deleted");
    }

    return res
      .status(200)
      .json(new ApiResponse(201, null, "Tweet deleted successfully"));
  } catch (error) {
    console.log("Error while deleting tweet:", error);
    throw new ApiError(500, "Error while deleting tweet");
  }
});

const getAllTweets = asyncHandler(async (req, res) => {
  try {
    // Aggregate query to join tweets with likes and fetch owner's fullName
    const tweetsWithLikes = await Tweet.aggregate([
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "tweet",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails",
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          owner: {
            _id: "$owner", // Rename _id to match with the owner's _id in users collection
            fullName: { $arrayElemAt: ["$ownerDetails.fullName", 0] }, // Extract fullName from ownerDetails array
          },
          createdAt: 1,
          likes: {
            $map: {
              input: "$likes",
              as: "like",
              in: "$$like.likedBy",
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "likes",
          foreignField: "_id",
          as: "likedBy",
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          owner: 1,
          createdAt: 1,
          numberOfLikes: { $size: "$likes" },
          likedBy: {
            _id: 1,
            fullName: 1,
          },
        },
      },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(200, tweetsWithLikes, "All tweets fetched successfully")
      );
  } catch (error) {
    console.error("Error fetching all tweets:", error);
    throw new ApiError(500, "Error fetching all tweets");
  }
});

export { createTweet, getUserTweets, updateTweet, deleteTweet, getAllTweets };
