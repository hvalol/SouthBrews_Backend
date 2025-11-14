const { body, validationResult } = require("express-validator");

// Helper function to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }
  next();
};

// User registration validation
const validateRegister = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  body("phone")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),

  handleValidationErrors,
];

// User login validation
const validateLogin = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

// Menu item validation
const validateMenuItem = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Menu item name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters"),

  body("price")
    .isFloat({ min: 0.01 })
    .withMessage("Price must be a positive number"),

  body("category")
    .isIn([
      "coffee",
      "tea",
      "pastries",
      "sandwiches",
      "salads",
      "desserts",
      "other",
    ])
    .withMessage("Invalid category"),

  body("available")
    .optional()
    .isBoolean()
    .withMessage("Available must be a boolean value"),

  handleValidationErrors,
];

// Reservation validation
const validateReservation = [
  body("date")
    .isISO8601()
    .withMessage("Please provide a valid date")
    .custom((value) => {
      const reservationDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (reservationDate < today) {
        throw new Error("Reservation date cannot be in the past");
      }

      // Check if date is not more than 30 days in advance
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);

      if (reservationDate > maxDate) {
        throw new Error(
          "Reservations can only be made up to 30 days in advance"
        );
      }

      return true;
    }),

  body("time")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please provide a valid time in HH:MM format"),

  body("partySize")
    .isInt({ min: 1, max: 12 })
    .withMessage("Party size must be between 1 and 12 people"),

  body("contactInfo.phone")
    .notEmpty()
    .withMessage("Contact phone is required")
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage("Please provide a valid phone number"),

  body("contactInfo.email")
    .notEmpty()
    .withMessage("Contact email is required")
    .isEmail()
    .withMessage("Please provide a valid email address"),

  body("occasion")
    .optional()
    .isIn([
      "birthday",
      "anniversary",
      "date",
      "business",
      "celebration",
      "other",
    ])
    .withMessage("Invalid occasion type"),

  body("specialRequests")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Special requests cannot exceed 500 characters"),

  handleValidationErrors,
];

// Order validation
const validateOrder = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("Order must contain at least one item"),

  body("items.*.menuItem").isMongoId().withMessage("Invalid menu item ID"),

  body("items.*.quantity")
    .isInt({ min: 1, max: 99 })
    .withMessage("Quantity must be between 1 and 99"),

  body("orderType")
    .isIn(["pickup", "delivery", "dine-in"])
    .withMessage("Invalid order type"),

  body("specialInstructions")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Special instructions cannot exceed 500 characters"),

  handleValidationErrors,
];

// Review validation
const validateReview = [
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("comment")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Comment must be between 10 and 1000 characters"),

  body("menuItem").optional().isMongoId().withMessage("Invalid menu item ID"),

  handleValidationErrors,
];

// Update profile validation
const validateProfileUpdate = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("phone")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),

  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date of birth"),

  handleValidationErrors,
];

// Password change validation
const validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Password confirmation does not match new password");
    }
    return true;
  }),

  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateMenuItem,
  validateReservation,
  validateOrder,
  validateReview,
  validateProfileUpdate,
  validatePasswordChange,
  handleValidationErrors,
};
