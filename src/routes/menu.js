const express = require("express");
const multer = require("multer");
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

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Please upload an image file"), false);
    }
  },
});

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
router.post("/", upload.single("image"), validateMenuItem, createMenuItem);
router.put("/:id", upload.single("image"), validateMenuItem, updateMenuItem);
router.patch("/:id/availability", toggleAvailability);

// Admin only routes
router.delete("/:id", isAdmin, deleteMenuItem);

module.exports = router;
