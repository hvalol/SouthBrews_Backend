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

const router = express.Router();

// Public routes
router.get("/categories", getCategories);
router.get("/featured", getFeaturedImages);
router.get("/popular", getPopularImages);
router.get("/:id", getImageById);
router.get("/", getAllImages);

// Protected routes - User
router.use(protect);
router.post("/:id/like", toggleLike);

// Staff/Admin routes
router.use(isStaff);
router.post("/", upload.single("image"), uploadNewImage);
router.put("/:id", updateImage);

// Admin only routes
router.delete("/:id", isAdmin, deleteImage);
router.get("/admin/stats", isAdmin, getGalleryStats);

module.exports = router;
