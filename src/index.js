import connectDb from "./db/index.js";
import dotenv from "dotenv";
import { app } from "./app.js";
dotenv.config({
  path: "./env",
});

const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("server is up and running");
});

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`server is running on port http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.log("MongoDb connection falied !!!", error);
  });