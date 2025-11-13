const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload image to Cloudinary
const uploadImage = async (file, folder = "southside-brews") => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: folder,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      transformation: [
        { width: 800, height: 600, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" },
      ],
    });

    return {
      public_id: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

// Delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Image deletion failed: ${error.message}`);
  }
};

// Generate optimized image URL
const getOptimizedImageUrl = (publicId, options = {}) => {
  const defaultOptions = {
    width: 400,
    height: 300,
    crop: "fill",
    quality: "auto",
    fetch_format: "auto",
  };

  const finalOptions = { ...defaultOptions, ...options };

  return cloudinary.url(publicId, finalOptions);
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  getOptimizedImageUrl,
};
