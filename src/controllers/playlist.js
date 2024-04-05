import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  //TODO: create playlist
  const { name, description } = req.body;
  const userId = req.user?._id;

  if (!name || !description) {
    console.log("all fields are required");
  }

  try {
    const playlist = await Playlist.create({
      name,
      description,
      owner: userId,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, playlist, "playlist created successfully"));
  } catch (error) {
    console.log("error while creating playlist");
    throw new ApiError(500, "error while creating playlist");
  }
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //TODO: get user playlists
  if (!isValidObjectId(userId)) {
    console.log("invalid user id");
  }
  try {
    const playlists = await Playlist.find({ owner: userId }).populate({
      path: "videos",
      select: "-owner -__v -createdAt -updatedAt",
    });

    if (!playlists) {
      console.log("user playlists not found");
      throw new ApiError(404, "user playlists not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, playlists, "user playlists fetched successfully")
      );
  } catch (error) {
    console.log("error while fetching user playlists");
    throw new ApiError(500, "error while fetching user playlists");
  }
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  //TODO: get playlist by id
  if (!isValidObjectId(playlistId)) {
    console.log("invalid playlist id");
  }
  try {
    const playlist = await Playlist.findById(playlistId).populate({
      path: "videos",
      select: "-__v -createdAt -updatedAt",
    });

    if (!playlist) {
      console.log("playlist not found");
      throw new ApiError(404, "playlist not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "playlist fetched successfully"));
  } catch (error) {
    console.log("error while fetching playlist");
    throw new ApiError(500, "error while fetching playlist");
  }
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const userId = req.user?._id;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    console.log("invalid playlist id or video id");
  }

  const playlist = await Playlist.findById(playlistId).select("owner");
  if (!playlist) {
    console.log("Playlist not found");
    throw new ApiError(404, "Playlist not found");
  }
  //   console.log("playlist object: ", playlist);
  //   console.log("userId: ", userId);

  if (playlist.owner.toString() !== userId.toString()) {
    console.log("You are not authorized to add video to this playlist");
    throw new ApiError(
      403,
      "You are not authorized to add video to this playlist"
    );
  }

  try {
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $addToSet: { videos: videoId },
      },
      { new: true }
    );

    if (!updatedPlaylist) {
      console.log("Playlist not found");
      throw new ApiError(404, "Playlist not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedPlaylist,
          "video added to playlist successfully"
        )
      );
  } catch (error) {
    console.log("error while adding video to playlist");
    throw new ApiError(500, "error while adding video to playlist");
  }
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const userId = req.user?._id;

  // TODO: remove video from playlist
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    console.log("invalid playlist id or video id");
  }
  const playlist = await Playlist.findById(playlistId).select("owner");
  if (!playlist) {
    console.log("Playlist not found");
    throw new ApiError(404, "Playlist not found");
  }
  //   console.log("playlist object: ", playlist);
  //   console.log("userId: ", userId);

  if (playlist.owner.toString() !== userId.toString()) {
    console.log("You are not authorized to remove video from this playlist");
    throw new ApiError(
      403,
      "You are not authorized to remove video from this playlist"
    );
  }
  try {
    const removedVideo = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $pull: { videos: videoId },
      },
      { new: true }
    );
    if (!removedVideo) {
      console.log("Playlist not found or video not in playlist");
      throw new ApiError(404, "Playlist not found or video not in playlist");
    }
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          removedVideo,
          "video removed from playlist successfully"
        )
      );
  } catch (error) {
    console.log("error while removing video from playlist");
    throw new ApiError(500, "error while removing video from playlist");
  }
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const userId = req.user?._id;

  // TODO: delete playlist
  if (!isValidObjectId(playlistId)) {
    console.log("invalid playlist id");
  }
  const playlist = await Playlist.findById(playlistId).select("owner");
  if (!playlist) {
    console.log("Playlist not found");
    throw new ApiError(404, "Playlist not found");
  }
  //   console.log("playlist object: ", playlist);
  //   console.log("userId: ", userId);

  if (playlist.owner.toString() !== userId.toString()) {
    console.log("You are not authorized to delete this playlist");
    throw new ApiError(
      403,
      "You are not authorized to delete this playlist"
    );
  }
  try {
    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
    if (!deletedPlaylist) {
      console.log("Playlist not found");
      throw new ApiError(404, "Playlist not found");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "playlist deleted successfully"));
  } catch (error) {
    console.log("error while deleting playlist");
    throw new ApiError(500, "error while deleting playlist");
  }
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  const userId = req.user?._id;
  
  //TODO: update playlist
  if (!isValidObjectId(playlistId)) {
    console.log("invalid playlist id");
  }
  const playlist = await Playlist.findById(playlistId).select("owner");
  if (!playlist) {
    console.log("Playlist not found");
    throw new ApiError(404, "Playlist not found");
  }
  //   console.log("playlist object: ", playlist);
  //   console.log("userId: ", userId);

  if (playlist.owner.toString() !== userId.toString()) {
    console.log("You are not authorized to update this playlist");
    throw new ApiError(
      403,
      "You are not authorized to update this playlist"
    );
  }
  try {
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $set: { name, description },
      },
      { new: true }
    );
    if (!updatedPlaylist) {
      console.log("Playlist not found");
      throw new ApiError(404, "Playlist not found");
    }
    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedPlaylist, "playlist updated successfully")
      );
  } catch (error) {
    console.log("error while updating playlist");
    throw new ApiError(500, "error while updating playlist");
  }
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
