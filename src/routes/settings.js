const express = require("express");
const {
  getSettings,
  updateSettings,
  resetSettings,
  uploadLogo,
  uploadFavicon,
} = require("../controllers/settingsController");

const { protect, isAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Public route
router.get("/", getSettings);

// Protected routes (Admin only)
router.use(protect);
router.use(isAdmin);
router.put("/", updateSettings);
router.post("/reset", resetSettings);
router.post("/upload-logo", upload.single("image"), uploadLogo);
router.post("/upload-favicon", upload.single("image"), uploadFavicon);

module.exports = router;
