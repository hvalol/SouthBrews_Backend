const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Verify configuration
const verifyConfig = () => {
  const missingVars = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME)
    missingVars.push("CLOUDINARY_CLOUD_NAME");
  if (!process.env.CLOUDINARY_API_KEY) missingVars.push("CLOUDINARY_API_KEY");
  if (!process.env.CLOUDINARY_API_SECRET)
    missingVars.push("CLOUDINARY_API_SECRET");

  if (missingVars.length > 0) {
    console.error("❌ Missing Cloudinary environment variables:", missingVars);
    return false;
  }

  console.log("✅ Cloudinary configured:");
  console.log("   Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
  console.log(
    "   API Key:",
    process.env.CLOUDINARY_API_KEY?.substring(0, 5) + "..."
  );
  return true;
};

// Verify on startup
verifyConfig();

// Upload image to Cloudinary
const uploadImage = async (file, folder = "southside-brews") => {
  try {
    // Verify config before upload
    if (!verifyConfig()) {
      throw new Error("Cloudinary configuration is incomplete");
    }

    console.log("🔄 Uploading to Cloudinary...");
    console.log("   File:", file);
    console.log("   Folder:", folder);

    const result = await cloudinary.uploader.upload(file, {
      folder: folder,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      resource_type: "auto",
    });

    console.log("✅ Upload successful!");
    console.log("   Public ID:", result.public_id);
    console.log("   URL:", result.secure_url);

    return {
      public_id: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error);

    // Check if it's a configuration error
    if (error.message.includes("Invalid Signature")) {
      throw new Error(
        "Cloudinary authentication failed. Please check your API credentials in .env file"
      );
    }

    throw new Error(`Image upload failed: ${error.message}`);
  }
};

// Delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    console.log("🗑️ Deleting from Cloudinary:", publicId);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("✅ Delete result:", result);
    return result;
  } catch (error) {
    console.error("❌ Cloudinary delete error:", error);
    throw new Error(`Image deletion failed: ${error.message}`);
  }
};

module.exports = {
  uploadImage,
  deleteImage,
  cloudinary,
};
