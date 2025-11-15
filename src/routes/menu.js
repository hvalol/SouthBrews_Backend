const express = require("express");
const {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuCategories,
  getFeaturedItems,
  getPopularItems,
  searchMenuItems,
  getMenuStats,
  toggleAvailability,
} = require("../controllers/menuController");

const {
  protect,
  isAdmin,
  isStaff,
  optionalAuth,
} = require("../middleware/auth");
const { validateMenuItem } = require("../middleware/validation");
const upload = require("../middleware/upload");
const { uploadToCloudinary } = require("../middleware/upload");

const router = express.Router();

// Public routes
router.get("/categories", getMenuCategories);
router.get("/featured", getFeaturedItems);
router.get("/popular", getPopularItems);
router.get("/search", searchMenuItems);
router.get("/:id", optionalAuth, getMenuItem);
router.get("/", optionalAuth, getMenuItems);

// Protected routes - Staff/Admin only
router.use(protect);
router.use(isStaff);

router.get("/admin/stats", isAdmin, getMenuStats);
router.post(
  "/",
  upload.single("image"),
  uploadToCloudinary("menu-items"),
  validateMenuItem,
  createMenuItem
);
router.put(
  "/:id",
  upload.single("image"),
  uploadToCloudinary("menu-items"),
  validateMenuItem,
  updateMenuItem
);
router.patch("/:id/availability", toggleAvailability);

// Admin only routes
router.delete("/:id", isAdmin, deleteMenuItem);

module.exports = router;
