const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadImage, deleteImage } = require("../config/cloudinary");

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for disk storage (temporary storage before Cloudinary upload)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: fileFilter,
});

// Middleware to handle multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "error",
        message: "File size cannot exceed 5MB",
      });
    }
    return res.status(400).json({
      status: "error",
      message: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      status: "error",
      message: err.message,
    });
  }
  next();
};

// Middleware to upload to Cloudinary after multer processes the file
const uploadToCloudinary = (folder = "uploads") => {
  return async (req, res, next) => {
    try {
      // Check if file exists
      if (!req.file) {
        return next();
      }

      console.log(`☁️ Uploading ${req.file.filename} to Cloudinary...`);

      // Upload to Cloudinary
      const result = await uploadImage(req.file.path, folder);

      console.log("✅ Cloudinary upload successful:", result.public_id);

      // Add Cloudinary data to request
      req.cloudinaryResult = {
        public_id: result.public_id,
        url: result.url,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
      };

      // Clean up local file
      try {
        await fs.promises.unlink(req.file.path);
        console.log("🧹 Cleaned up local file");
      } catch (unlinkError) {
        console.error("Failed to delete local file:", unlinkError);
      }

      next();
    } catch (error) {
      console.error("❌ Cloudinary upload error:", error);

      // Clean up local file on error
      if (req.file && req.file.path) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error("Failed to delete local file:", unlinkError);
        }
      }

      return res.status(500).json({
        status: "error",
        message: "Failed to upload image to cloud storage",
        error: error.message,
      });
    }
  };
};

// Middleware to upload multiple files to Cloudinary
const uploadMultipleToCloudinary = (folder = "uploads") => {
  return async (req, res, next) => {
    try {
      // Check if files exist
      if (!req.files || req.files.length === 0) {
        return next();
      }

      console.log(`☁️ Uploading ${req.files.length} files to Cloudinary...`);

      const uploadPromises = req.files.map((file) =>
        uploadImage(file.path, folder)
      );

      const results = await Promise.all(uploadPromises);

      console.log(`✅ Uploaded ${results.length} files to Cloudinary`);

      // Add Cloudinary data to request
      req.cloudinaryResults = results.map((result) => ({
        public_id: result.public_id,
        url: result.url,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
      }));

      // Clean up local files
      const cleanupPromises = req.files.map((file) =>
        fs.promises.unlink(file.path).catch((err) => {
          console.error(`Failed to delete ${file.filename}:`, err);
        })
      );

      await Promise.all(cleanupPromises);
      console.log("🧹 Cleaned up local files");

      next();
    } catch (error) {
      console.error("❌ Cloudinary upload error:", error);

      // Clean up local files on error
      if (req.files && req.files.length > 0) {
        const cleanupPromises = req.files.map((file) =>
          fs.promises.unlink(file.path).catch((err) => {
            console.error(`Failed to delete ${file.filename}:`, err);
          })
        );
        await Promise.all(cleanupPromises);
      }

      return res.status(500).json({
        status: "error",
        message: "Failed to upload images to cloud storage",
        error: error.message,
      });
    }
  };
};

// Cleanup middleware - use this to clean up files if an error occurs after upload
const cleanupUploadedFile = async (req, res, next) => {
  // Store original json and send methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Override json method
  res.json = function (data) {
    // If error response and file exists, clean it up
    if (
      res.statusCode >= 400 &&
      req.file &&
      req.file.path &&
      fs.existsSync(req.file.path)
    ) {
      fs.promises
        .unlink(req.file.path)
        .catch((err) => console.error("Cleanup error:", err));
    }
    return originalJson(data);
  };

  // Override send method
  res.send = function (data) {
    // If error response and file exists, clean it up
    if (
      res.statusCode >= 400 &&
      req.file &&
      req.file.path &&
      fs.existsSync(req.file.path)
    ) {
      fs.promises
        .unlink(req.file.path)
        .catch((err) => console.error("Cleanup error:", err));
    }
    return originalSend(data);
  };

  next();
};

module.exports = upload;
module.exports.handleUploadError = handleUploadError;
module.exports.uploadToCloudinary = uploadToCloudinary;
module.exports.uploadMultipleToCloudinary = uploadMultipleToCloudinary;
module.exports.cleanupUploadedFile = cleanupUploadedFile;
