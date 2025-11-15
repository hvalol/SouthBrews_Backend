const express = require("express");
const {
  getAllImages,
  getImageById,
  uploadNewImage,
  updateImage,
  deleteImage,
  toggleLike,
  getFeaturedImages,
  getPopularImages,
  getGalleryStats,
  getCategories,
} = require("../controllers/galleryController");

const { protect, isAdmin, isStaff } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadToCloudinary } = require("../middleware/upload");

const router = express.Router();

// Public routes - IMPORTANT: Specific routes must come before /:id
router.get("/categories", getCategories);
router.get("/featured", getFeaturedImages);
router.get("/popular", getPopularImages);
router.get("/", getAllImages);
router.get("/:id", getImageById);

// Protected routes - User
router.use(protect);
router.post("/:id/like", toggleLike);

// Admin routes - Must come before isStaff middleware
router.get("/admin/stats", isAdmin, getGalleryStats);

// Staff/Admin routes
router.use(isStaff);
router.post(
  "/",
  upload.single("image"),
  uploadToCloudinary("gallery"),
  uploadNewImage
);
router.put("/:id", updateImage);

// Admin only routes
router.delete("/:id", isAdmin, deleteImage);

module.exports = router;
