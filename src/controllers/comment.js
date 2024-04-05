import mongoose from "mongoose";
import { Comment } from "../models/comment.js";
import { Video } from "../models/video.js";
import { Like } from "../models/like.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
    };

    if (!mongoose.isValidObjectId(videoId)) {
      throw new ApiError(400, "Invalid video id");
    }

    const videoExists = await Video.exists({ _id: videoId });
    if (!videoExists) {
      throw new ApiError(404, "Video not found");
    }

    // Aggregate query to match comments with the specified video ID
    const aggregateQuery = Comment.aggregate([
      {
        $match: { video: new mongoose.Types.ObjectId(videoId) },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
        },
      },
      { $unwind: "$owner" },
      {
        $project: {
          _id: 1,
          content: 1,
          createdAt: 1,
          owner: { _id: 1, fullName: 1, username: 1 },
        },
      },
      {
        $lookup: {
          from: "likes",
          let: { commentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$comment", "$$commentId"] },
              },
            },
            {
              $project: {
                _id: 1,
                likedBy: 1,
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "likedBy",
                foreignField: "_id",
                as: "likedBy",
              },
            },
            { $unwind: "$likedBy" },
            {
              $project: {
                _id: 0,
                likedBy: { _id: 1, fullName: 1, username: 1 },
              },
            },
          ],
          as: "likes",
        },
      },
      {
        $addFields: {
          numberOfLikes: { $size: "$likes" }, // Calculate the number of likes
        },
      },
    ]);

    // Perform pagination on the aggregated comments
    const comments = await Comment.aggregatePaginate(aggregateQuery, options);
    if (!comments) {
      throw new ApiError(404, "Comments not found");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, comments, "Comments fetched successfully"));
  } catch (error) {
    console.error("Error while fetching video comments:", error);
    throw new ApiError(500, "Error while fetching video comments");
  }
});

const getAllComments = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 }, // Sort by descending createdAt date
    };

    // Find all comments using pagination
    const rawComments = await Comment.aggregatePaginate({}, options);

    // Convert raw MongoDB documents to Mongoose documents
    const comments = rawComments.docs.map(doc => new Comment(doc));

    // Create objects to store numberOfLikes and likedBy for each comment
    const numberOfLikesOnComment = {};
    const likedBy = {};

    // Populate additional information for each comment
    for (const comment of comments) {
      // Populate video title and owner name for each comment
      await comment.populate({
        path: 'video',
        select: 'title owner',
        populate: {
          path: 'owner',
          select: 'fullName',
        },
      });

      await comment.populate('owner', 'fullName');

      // Count the number of likes for each comment
      numberOfLikesOnComment[comment._id] = await Like.countDocuments({ comment: comment._id });

      // Find the users who liked the comment
      likedBy[comment._id] = await Like.find({ comment: comment._id })
                                        .populate('likedBy', 'fullName')
                                        .then(likes => likes.map(like => like.likedBy.fullName));
    }

    // Create an array to hold comments with additional information
    const commentsWithLikes = comments.map(comment => ({
      ...comment.toObject(),
      numberOfLikes: numberOfLikesOnComment[comment._id],
      likedBy: likedBy[comment._id],
    }));

    return res.status(200).json(new ApiResponse(200, commentsWithLikes, "All comments fetched successfully"));
  } catch (error) {
    console.error("Error while fetching all comments:", error);
    throw new ApiError(500, "Error while fetching all comments");
  }
});


const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  try {
    const newComment = await Comment.create({
      content,
      video: videoId,
      owner: req.user._id,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, newComment, "Comment added successfully"));
  } catch (error) {
    console.error("Error while adding comment:", error);
    throw new ApiError(500, "Error while adding comment");
  }
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user?._id;

  if (!mongoose.isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }

  const commentOwner = await Comment.findById(commentId).select("owner");
  if (commentOwner.owner.toString() !== userId.toString()) {
    console.log("You are not authorized to update this comment ");
    throw new ApiError(403, "You are not authorized to update this comment");
  }

  try {
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $set: { content },
      },
      { new: true }
    );
    if (!updatedComment) {
      throw new ApiError(404, "Comment not found");
    }
    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
      );
  } catch (error) {
    console.error("Error while updating comment:", error);
    throw new ApiError(500, "Error while updating comment");
  }
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  const { commentId } = req.params;
  if (!mongoose.isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }

  const commentOwner = await Comment.findById(commentId).select("owner");
  if (commentOwner.owner.toString() !== userId.toString()) {
    console.log("You are not authorized to delete this comment ");
    throw new ApiError(403, "You are not authorized to delete this comment");
  }

  try {
    await Like.deleteMany({ comment: commentId });
    const deletedComment = await Comment.findByIdAndDelete(commentId);
    if (!deletedComment) {
      throw new ApiError(404, "Comment not found");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Comment deleted successfully"));
  } catch (error) {
    console.error("Error while deleting comment:", error);
    throw new ApiError(500, "Error while deleting comment");
  }
});

export {
  getVideoComments,
  addComment,
  updateComment,
  deleteComment,
  getAllComments,
};
