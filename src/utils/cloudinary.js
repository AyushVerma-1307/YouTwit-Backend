import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    //file has been uploaded successfully
    // console.log("file uploaded successfully on cloudinary: ", response.url);
    // console.log("cloudinary response :",response);
    fs.unlinkSync(localFilePath); //delete the file from local storage
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); //delete the file from local storage
    console.log("Error uploading file to cloudinary: ", error);

    return null;
  }
};
const deleteFileFromCloudinary = async (Url, isVideo) => {
  try {
    if (!Url) {
      return; // Exit the function if URL is not provided
    }
    const publicId = Url.split("/").pop().split(".")[0]; // Extract the public ID

    // Set the resource type based on the asset type
    const resourceType = isVideo ? 'video' : 'image';

    // Use Cloudinary's destroy method to delete the asset
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

    console.log(`File ${Url} deleted from Cloudinary`);
  } catch (error) {
    console.error(`Error deleting file from Cloudinary: ${error.message}`);
    throw error;
  }
};


export { uploadOnCloudinary, deleteFileFromCloudinary};

