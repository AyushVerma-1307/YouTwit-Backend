import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.js";
import { Subscription } from "../models/subscription.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription
  const userId = req.user?._id;

  if(!isValidObjectId(channelId)){
    throw new ApiError(404,"invalid channel Id" );
  }

  if(channelId === userId.toString()){
    throw new ApiError(403, "user cant subscribe his own channel");
  }

  try {
    const existingSubscription = await Subscription.findOne({
      channel: channelId,
      subscriber: userId,
    });

    if (existingSubscription) {
      // User is already subscribed, so unsubscribe them
      await Subscription.findOneAndDelete({
        channel: channelId,
        subscriber: userId,
      });

      return res
        .status(200)
        .json(
          new ApiResponse(
            201,
            { message: "user unsubscribed" },
            "user unsubscribed the channel successfully"
          )
        );
    } else {
      // User is not subscribed, so subscribe them
      await Subscription.create({
        subscriber: userId,
        channel: channelId,
      });
      return res
        .status(200)
        .json(
          new ApiResponse(
            201,
            { message: "user subscribed" },
            "user subscribed the channel Successfully"
          )
        );
    }
  } catch (error) {
    console.log("error: error while toggling subscription");
    throw new ApiError(500, "error while toggling the subsription");
  }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user?._id;
  // console.log("channelId: ", channelId, "userId: ", userId.toString())
  if(!mongoose.isValidObjectId(channelId)){
    throw new ApiError(400, "Invalid channel id");
  }
  
  if(channelId !== userId.toString()){
    throw new ApiError(403, "You are not authorized to view subscribers of this channel");
  }
  // Find all subscriptions where the channel matches the provided channelId
  try {
    const subscriptions = await Subscription.find({
      channel: channelId,
    }).populate({
      path: "subscriber",
      select: "-refreshToken -password -email -createdAt -updatedAt -__v -watchHistory",
    });

    // Extract subscriber details
    const subscribers = subscriptions.map(
      (subscription) => subscription.subscriber
    );

    // Return the list of subscribers
    return res
      .status(200)
      .json(new ApiResponse(200, subscribers, "list of subscribers who has subscribed to this channel"));
  } catch (error) {
    console.log("error: subscribers not fetched");
    throw new ApiError(404, "error while fetching subscribers details");
  }
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  
  try {
    // Find all subscriptions where the subscriber matches the provided subscriberId
    const subscriptions = await Subscription.find({
      subscriber: subscriberId,
    }).populate({
      path:"channel",
      select:"-refreshToken -password -email -createdAt -updatedAt -__v -watchHistory"
    });

    // Extract channel details
    const channels = subscriptions.map((subscription) => subscription.channel);

    // Return the list of channels
    return res
      .status(200)
      .json(
        new ApiResponse(200, channels, "list of channels user subscribed to")
      );
  } catch (error) {
    console.log("error: channels not fetched");
    throw new ApiError(404, "error while fetching channels details");
  }
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
