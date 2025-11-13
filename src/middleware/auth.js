const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token (excluding password)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "User not found",
        });
      }

      next();
    } catch (error) {
      console.error("Token verification error:", error);
      return res.status(401).json({
        status: "error",
        message: "Not authorized, invalid token",
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Not authorized, no token provided",
    });
  }
};

// Middleware to authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: `User role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    next();
  };
};

// Middleware to check if user is admin
const isAdmin = authorize("admin");

// Middleware to check if user is staff or admin
const isStaff = authorize("admin", "staff");

// Optional authentication (doesn't require login but adds user if available)
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch (error) {
      // Token is invalid, but we continue without user
      req.user = null;
    }
  }

  next();
};

module.exports = {
  protect,
  authorize,
  isAdmin,
  isStaff,
  optionalAuth,
};
