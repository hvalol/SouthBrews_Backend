const express = require("express");
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  deleteAccount,
} = require("../controllers/authController");

const { protect } = require("../middleware/auth");
const {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
} = require("../middleware/validation");

const router = express.Router();

// Public routes
router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:resettoken", resetPassword);
router.get("/verify-email/:token", verifyEmail);

// Protected routes
router.use(protect); // All routes after this are protected

router.post("/logout", logout);
router.get("/me", getMe);
router.put("/profile", validateProfileUpdate, updateProfile);
router.put("/change-password", validatePasswordChange, changePassword);
router.post("/resend-verification", resendVerification);
router.delete("/account", deleteAccount);

module.exports = router;
