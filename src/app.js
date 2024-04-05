import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
); // Cross-Origin Resource Sharing

app.use(express.json({ limit: "16kb" })); // parse json data
app.use(express.urlencoded({ extended: true, limit: "16kb" })); // parse urlencoded data
app.use(express.static("public")); // serve static files
app.use(cookieParser()); // parse cookies

//routes import
import userRouter from './routes/user.js'
import healthcheckRouter from "./routes/healthcheck.js"
import tweetRouter from "./routes/tweet.js"
import subscriptionRouter from "./routes/subscription.js"
import videoRouter from "./routes/video.js"
import commentRouter from "./routes/comment.js"
import likeRouter from "./routes/like.js"
import playlistRouter from "./routes/playlist.js"
import dashboardRouter from "./routes/dashboard.js"

//routes declaration
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)

export { app };
