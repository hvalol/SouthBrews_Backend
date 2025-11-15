const express = require("express");
const {
  submitContactForm,
  getAllMessages,
  getMessage,
  replyToMessage,
  updateMessageStatus,
  deleteMessage,
} = require("../controllers/contactController");

const { protect, isAdmin, isStaff } = require("../middleware/auth");

const router = express.Router();

// Public route
router.post("/", submitContactForm);

// Protected routes (Staff/Admin)
router.use(protect);
router.use(isStaff);
router.get("/", getAllMessages);
router.get("/:id", getMessage);
router.post("/:id/reply", replyToMessage);
router.patch("/:id/status", updateMessageStatus);

// Admin only
router.delete("/:id", isAdmin, deleteMessage);

module.exports = router;
