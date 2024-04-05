import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.js";
import { Tweet } from "../models/tweet.js";
import { Playlist } from "../models/playlist.js";
import { Like } from "../models/like.js";
import { Comment } from "../models/comment.js";
import { Subscription } from "../models/subscription.js";
import { Video } from "../models/video.js";

import { uploadOnCloudinary,deleteFileFromCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access tokens"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  //validation of user details
  //check if user already exists: username,email
  //check for images, check for avatar
  //upload them to cloudinary, avatar
  //create user object - create entry in db
  //remove password and refresh token from response
  //check for user creation
  //return response

  const { username, fullName, email, password } = req.body;

  if (!username || !fullName || !email || !password) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar && req.files.avatar[0]?.path;

  if (!avatarLocalPath) {
    // Handle the case where avatar file is not uploaded
    console.error("Error: Avatar file is missing in the request");
    // Respond with an appropriate error message or status
    return res
      .status(400)
      .json({ error: "Avatar file is missing in the request" });
  }

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  // console.log("req.body", req.body)

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.secure_url,
    coverImage: coverImage?.secure_url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registering user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  //validation of user details
  //check if user exist or not
  //check if password is correct or not - hash compare
  //generate access and refresh token
  //send cookie response

  const { email, password, username } = req.body;

  if (!email && !username) {
    throw new ApiError(400, "Email or username is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User does not Exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { refreshToken, accessToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const getAllUsers = asyncHandler(async (req, res) => {
  try {
    // Retrieve all users from the database
    const users = await User.find().select("-password -refreshToken");

    return res
      .status(200)
      .json(new ApiResponse(200, users, "Users retrieved successfully"));
  } catch (error) {
    console.error("Error while fetching users:", error.message);
    throw new ApiError(500, "Error while fetching users");
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await User.findByIdAndUpdate(
    userId,
    {
      $unset: { refreshToken: 1 },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    console.log("decoded token: ", decodedToken);

    const user = await User.findById(decodedToken._id);

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token mismatch");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken,
          },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    console.error("Token refresh failed:", error);
    throw new ApiError(401, "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
      throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Password changed successfully"));
  } catch (error) {
    console.log("error while changing password: ", error);
    throw new ApiError(500, "Something went wrong while changing password");
  }
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Current User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(
      500,
      "Something went wrong while updating account details"
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const userExists = await User.findById(userId);

  await deleteFileFromCloudinary(userExists.avatar,false);
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.secure_url,
      },
    },
    { new: true }
  ).select("-password ");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  const userId = req.user?._id;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "cover Image file is required");
  }

  const userExists = await User.findById(userId);

  await deleteFileFromCloudinary(userExists.coverImage,false);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "error while uploading cover Image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.secure_url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!mongoose.isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid Channel ID");
  }

  const channel = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(channelId), // Convert channelId to ObjectId
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  const numberOfVideos = await Video.countDocuments({owner:channelId})

  if (!channel?.length) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Channel not found"));
  }

  const channelWithNumberOfVideos = {
    ...channel[0], // Access the first element of the array
    numberOfVideos:numberOfVideos,
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channelWithNumberOfVideos,
        "User Channel Profile fetched successfully"
      )
    );
});

const addToWatchHistory = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id; // Assuming user ID is available in the request
    const { videoId } = req.params; // Assuming video ID is provided in the request body

    // Retrieve the user from the database
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Add the video ID to the user's watch history
    user.watchHistory.push(videoId);

    // Save the updated user object
    await user.save();

    return res
      .status(200)
      .json(
        new ApiResponse(200, user.watchHistory, "Item added to watch history")
      );
  } catch (error) {
    console.error("Error adding item to watch history:", error.message);
    throw new ApiError(500, "Error adding item to watch history");
  }
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch History fetched successfully"
      )
    );
});

const getUserDetails = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  // Fetch user details
  const user = await User.findById(userId).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Fetch number of tweets and tweets array
  const tweetsCount = await Tweet.countDocuments({ owner: userId });
  const tweets = await Tweet.find({ owner: userId });

  // Fetch number of comments and comments array
  const commentsCount = await Comment.countDocuments({ owner: userId });
  const comments = await Comment.find({ owner: userId });

  // Fetch number of videos uploaded by the user and videos array
  const videosCount = await Video.countDocuments({ owner: userId });
  const videos = await Video.find({ owner: userId });

  // Fetch playlists created by the user
  const playlistsCount = await Playlist.countDocuments({ owner: userId });
  const playlists = await Playlist.find({ owner: userId });

  // Fetch number of subscribers
  const subscriptions = await Subscription.find({ channel: userId });
  const subscribersCount = subscriptions.length;

  // Fetch channels the user has subscribed to
  const channelsSubscribed = await Subscription.find({ subscriber: userId });

  // Fetch likes on user's comments, tweets, and videos
  const likesOnUserContent = await Like.find({
    $or: [
      { comment: { $in: comments.map((c) => c._id) } },
      { tweet: { $in: tweets.map((t) => t._id) } },
      { video: { $in: videos.map((v) => v._id) } }, // Include liked videos
    ],
  })
    .populate({
      path: "comment",
      select: "content owner",
      populate: {
        path: "owner",
        select: "fullName",
      },
    })
    .populate({
      path: "tweet",
      select: "content owner",
      populate: {
        path: "owner",
        select: "fullName",
      },
    })
    .populate({
      path: "video",
      select: "title owner",
      populate: {
        path: "owner",
        select: "fullName",
      },
    })
    .populate("likedBy", "fullName")
    .select("-_id -__v -createdAt -updatedAt");

  // Group likes based on content (comment, tweet, or video)
  const groupedLikes = {};
  likesOnUserContent.forEach((like) => {
    const contentId = like.comment
      ? like.comment._id
      : like.tweet
        ? like.tweet._id
        : like.video
          ? like.video._id
          : null;
    if (!contentId) return;
    if (!groupedLikes[contentId]) {
      groupedLikes[contentId] = [];
    }
    groupedLikes[contentId].push(like.likedBy);
  });

  // Construct the final response with grouped likes
  const finalFormattedLikesOnUserContent = Object.entries(groupedLikes).map(
    ([contentId, likedByArray]) => {
      const likeObj = likesOnUserContent.find(
        (like) =>
          (like.comment && like.comment._id.toString() === contentId) ||
          (like.tweet && like.tweet._id.toString() === contentId) ||
          (like.video && like.video._id.toString() === contentId)
      );
      return {
        ...likeObj.toObject(), // Convert Mongoose object to plain object
        likedBy: likedByArray,
      };
    }
  );

  // Prepare the response object
  const userDetails = {
    user: user,
    comments: {
      count: commentsCount,
      data: comments,
    },
    tweets: {
      count: tweetsCount,
      data: tweets,
    },
    videos: {
      count: videosCount,
      data: videos,
    },
    playlists: {
      count: playlistsCount,
      data: playlists,
    },
    subscriptions: {
      subscriber: subscribersCount,
      subscribedTo: channelsSubscribed,
    },
    likesOnUserContent: finalFormattedLikesOnUserContent,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, userDetails, "User details fetched successfully")
    );
});

const removeUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;

    // Check if the user exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    //! Delete all likes associated with the user's tweets
    const userTweets = await Tweet.find({ owner: userId }, "_id");
    const tweetIds = userTweets.map((tweet) => tweet._id);
    await Like.deleteMany({ tweet: { $in: tweetIds } });

    // Delete all tweets associated with the user
    await Tweet.deleteMany({ owner: userId });

    //! Delete associated videos and their related data
    const videos = await Video.find({ owner: userId });
    for (const video of videos) {
      await deleteVideoAndRelatedData(video);
    }

    //! Delete associated playlists and their related data
    const playlists = await Playlist.find({ owner: userId });
    for (const playlist of playlists) {
      await deletePlaylistAndRelatedData(playlist);
    }

    //! Delete associated comments and their related data
    const comments = await Comment.find({ owner: userId });
    for (const comment of comments) {
      await deleteCommentAndRelatedData(comment);
    }

    //! Delete all likes associated with the user
    await Like.deleteMany({ likedBy: userId });

    //! Clean up subscriptions
    await cleanupSubscriptions(userId);

    //! Delete user avatar and coverImage from Cloudinary
    console.log("now deleting user avatar and coverImage :");
    console.log("avatarUrl: ", userExists.avatar);
    console.log("coverImageUrl: ", userExists.coverImage);

    await deleteFileFromCloudinary(userExists.avatar,false);
    await deleteFileFromCloudinary(userExists?.coverImage,false);

    // Finally, delete the user
    await User.findByIdAndDelete(userId);

    return res
      .status(200)
      .json(new ApiResponse(200, null, "User removed successfully"));
  } catch (error) {
    console.error("Error while deleting user:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error while deleting user"));
  }
});

// Helper function to delete a video and its related data
async function deleteVideoAndRelatedData(video) {
  // Retrieve comments associated with the video
  await Like.deleteMany({ video: video._id });
  const comments = await Comment.find({ video: video._id });
  for (const comment of comments) {
    console.log("comment: ", comment);
    await deleteCommentAndRelatedData(comment);
  }

  // Delete the video itself
  await deleteFileFromCloudinary(video.videoFile,true);
  await deleteFileFromCloudinary(video.thumbnail,false);
  await Video.findByIdAndDelete(video._id);
}
// Helper function to delete a playlist and its related data
async function deletePlaylistAndRelatedData(playlist) {
  // Retrieve videos associated with the playlist
  const videos = await Video.find({ _id: { $in: playlist.videos } });
  for (const video of videos) {
    await deleteVideoAndRelatedData(video);
  }

  // Delete the playlist itself
  await Playlist.findByIdAndDelete(playlist._id);
}
// Helper function to delete a comment and its related data
async function deleteCommentAndRelatedData(comment) {
  // Delete likes associated with the comment
  await Like.deleteMany({ comment: comment._id });

  // Delete the comment itself
  await Comment.findByIdAndDelete({ _id: comment._id });
}
// Helper function to delete an image from Cloudinary
const cleanupSubscriptions = async (userId) => {
  // Find subscriptions where the user is a subscriber
  const subscriptions = await Subscription.find({ subscriber: userId });

  // Unsubscribe the user from all channels
  for (const subscription of subscriptions) {
    await Subscription.findByIdAndDelete(subscription._id);
  }

  // Find subscriptions where the user is a channel owner
  const ownedSubscriptions = await Subscription.find({ channel: userId });

  // Remove all subscribers of the user's channel
  for (const subscription of ownedSubscriptions) {
    await Subscription.findByIdAndDelete(subscription._id);
  }
};

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
  removeUser,
  getUserDetails,
  getAllUsers,
  addToWatchHistory,
};
