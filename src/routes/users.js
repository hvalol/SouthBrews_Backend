const express = require("express");
const {
  getProfile,
  updateProfile,
  updateProfileImage,
  toggleFavoriteMenuItem,
  toggleFavoriteGalleryImage,
  getFavorites,
  getUserStats,
  getPointsHistory,
  submitReceipt,
  getUserReceipts,
  getAllReceipts,
  approveReceipt,
  rejectReceipt,
} = require("../controllers/userController");

const { protect, isAdmin, isStaff } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadToCloudinary } = require("../middleware/upload");

const router = express.Router();

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================
router.use(protect);

// Profile routes
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put(
  "/profile/image",
  upload.single("image"),
  uploadToCloudinary("profile-images"),
  updateProfileImage
);

// Favorites routes
router.get("/favorites", getFavorites);
router.post("/favorites/menu/:id", toggleFavoriteMenuItem);
router.post("/favorites/gallery/:id", toggleFavoriteGalleryImage);

// Stats and points routes
router.get("/stats", getUserStats);
router.get("/points/history", getPointsHistory);

// Receipt routes (user)
router.post(
  "/receipts",
  upload.single("image"),
  uploadToCloudinary("receipts"),
  submitReceipt
);
router.get("/receipts", getUserReceipts);

// ============================================
// STAFF/ADMIN ROUTES
// ============================================
router.get("/receipts/all", isStaff, getAllReceipts);
router.patch("/receipts/:id/approve", isStaff, approveReceipt);
router.patch("/receipts/:id/reject", isStaff, rejectReceipt);

module.exports = router;
