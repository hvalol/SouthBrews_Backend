const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = user.getSignedJwtToken();

  const cookieExpire = parseInt(process.env.JWT_COOKIE_EXPIRE) || 7; // Default 7 days

  const options = {
    expires: new Date(Date.now() + cookieExpire * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  // Remove password from output
  user.password = undefined;

  res
    .status(statusCode)
    .cookie("token", token, options)
    .json({
      status: "success",
      message,
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          loyaltyPoints: user.loyaltyPoints,
          loyaltyTier: user.loyaltyTier,
          profileImage: user.profileImage,
          preferences: user.preferences,
        },
      },
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone, dateOfBirth } =
      req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "User with this email already exists",
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phone,
      dateOfBirth,
    });

    // Welcome bonus points
    user.loyaltyPoints = 50;
    await user.save();

    sendTokenResponse(user, 201, res, "User registered successfully");
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      status: "error",
      message: "Registration failed",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Please provide an email and password",
      });
    }

    // Check for user (include password for comparison)
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: "error",
        message: "Account is deactivated. Please contact support.",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    sendTokenResponse(user, 200, res, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      status: "error",
      message: "Login failed",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    res.cookie("token", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      status: "error",
      message: "Logout failed",
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "orders",
      options: { sort: { createdAt: -1 }, limit: 5 },
    });

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          age: user.age,
          role: user.role,
          loyaltyPoints: user.loyaltyPoints,
          loyaltyTier: user.loyaltyTier,
          profileImage: user.profileImage,
          preferences: user.preferences,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user data",
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      preferences: req.body.preferences,
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(
      (key) => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          preferences: user.preferences,
          loyaltyPoints: user.loyaltyPoints,
          loyaltyTier: user.loyaltyTier,
        },
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update profile",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select("+password");

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        status: "error",
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, "Password changed successfully");
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to change password",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "No user found with this email",
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/reset-password/${resetToken}`;

    // TODO: Implement email sending
    // For now, just return success (in production, send email)

    res.status(200).json({
      status: "success",
      message: "Password reset link sent to email",
      ...(process.env.NODE_ENV === "development" && { resetToken, resetUrl }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    // Clear reset token fields
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }

    res.status(500).json({
      status: "error",
      message: "Email could not be sent",
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { resettoken } = req.params;
    const { password } = req.body;

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(resettoken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired reset token",
      });
    }

    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: resettoken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired reset token",
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res, "Password reset successful");
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      status: "error",
      message: "Password reset failed",
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired verification token",
      });
    }

    const user = await User.findOne({
      _id: decoded.id,
      emailVerificationToken: token,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired verification token",
      });
    }

    // Verify email
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;

    // Give bonus points for email verification
    user.loyaltyPoints += 25;

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Email verified successfully! You earned 25 loyalty points.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      status: "error",
      message: "Email verification failed",
    });
  }
};

// @desc    Resend email verification
// @route   POST /api/auth/resend-verification
// @access  Private
const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.isEmailVerified) {
      return res.status(400).json({
        status: "error",
        message: "Email is already verified",
      });
    }

    // Generate new verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // TODO: Implement email sending
    // For now, just return success

    res.status(200).json({
      status: "success",
      message: "Verification email sent",
      ...(process.env.NODE_ENV === "development" && { verificationToken }),
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send verification email",
    });
  }
};

// @desc    Delete account
// @route   DELETE /api/auth/account
// @access  Private
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select("+password");

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({
        status: "error",
        message: "Password is incorrect",
      });
    }

    // Deactivate account instead of deleting (for data integrity)
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete account",
    });
  }
};

module.exports = {
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
};
