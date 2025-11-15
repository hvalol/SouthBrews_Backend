const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't include password in queries by default
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-\(\)]+$/, "Please provide a valid phone number"],
    },
    dateOfBirth: {
      type: Date,
    },
    profileImage: {
      public_id: String,
      url: String,
    },
    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    loyaltyTier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },
    preferences: {
      dietary: [
        {
          type: String,
          enum: [
            "vegetarian",
            "vegan",
            "gluten-free",
            "dairy-free",
            "nut-free",
            "keto",
            "low-sugar",
          ],
        },
      ],
      favoriteCategories: [
        {
          type: String,
          enum: [
            "coffee",
            "tea",
            "pastries",
            "sandwiches",
            "salads",
            "desserts",
          ],
        },
      ],
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        sms: {
          type: Boolean,
          default: false,
        },
        promotions: {
          type: Boolean,
          default: true,
        },
      },
    },
    favoriteMenuItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
      },
    ],
    favoriteGalleryImages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Gallery",
      },
    ],
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: "USA",
      },
    },
    pointsHistory: [
      {
        amount: {
          type: Number,
          required: true,
        },
        type: {
          type: String,
          enum: ["earned", "redeemed"],
          required: true,
        },
        source: {
          type: String,
          enum: ["receipt", "reservation", "reward", "bonus"],
          required: true,
        },
        description: String,
        relatedId: mongoose.Schema.Types.ObjectId,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    totalReservations: {
      type: Number,
      default: 0,
    },
    totalReceipts: {
      type: Number,
      default: 0,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
userSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
});

// Index for email lookup
userSchema.index({ email: 1 });
userSchema.index({ loyaltyPoints: -1 });

// Middleware to hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash password if it's been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Hash password with cost of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware to update loyalty tier based on points
userSchema.pre("save", function (next) {
  if (this.isModified("loyaltyPoints")) {
    const points = this.loyaltyPoints;
    if (points >= 1000) {
      this.loyaltyTier = "platinum";
    } else if (points >= 500) {
      this.loyaltyTier = "gold";
    } else if (points >= 200) {
      this.loyaltyTier = "silver";
    } else {
      this.loyaltyTier = "bronze";
    }
  }
  next();
});

// Method to check if password matches
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate and return JWT token
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

// Method to generate email verification token
userSchema.methods.getEmailVerificationToken = function () {
  const verificationToken = jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  this.emailVerificationToken = verificationToken;
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Method to generate password reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  this.resetPasswordToken = resetToken;
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour

  return resetToken;
};

// Method to add loyalty points
userSchema.methods.addLoyaltyPoints = async function (
  points,
  source,
  description,
  relatedId
) {
  this.loyaltyPoints += points;

  // Add to points history
  this.pointsHistory.push({
    amount: points,
    type: "earned",
    source: source || "bonus",
    description: description || "Points earned",
    relatedId: relatedId,
    createdAt: new Date(),
  });

  return this.save();
};

// Method to redeem loyalty points
userSchema.methods.redeemLoyaltyPoints = async function (
  points,
  description,
  relatedId
) {
  if (this.loyaltyPoints < points) {
    throw new Error("Insufficient loyalty points");
  }

  this.loyaltyPoints -= points;

  // Add to points history
  this.pointsHistory.push({
    amount: points,
    type: "redeemed",
    source: "reward",
    description: description || "Points redeemed",
    relatedId: relatedId,
    createdAt: new Date(),
  });

  return this.save();
};

// Method to toggle favorite menu item
userSchema.methods.toggleFavoriteMenuItem = async function (menuItemId) {
  const index = this.favoriteMenuItems.indexOf(menuItemId);

  if (index === -1) {
    // Add to favorites
    this.favoriteMenuItems.push(menuItemId);
  } else {
    // Remove from favorites
    this.favoriteMenuItems.splice(index, 1);
  }

  return this.save();
};

// Method to toggle favorite gallery image
userSchema.methods.toggleFavoriteGalleryImage = async function (imageId) {
  const index = this.favoriteGalleryImages.indexOf(imageId);

  if (index === -1) {
    // Add to favorites
    this.favoriteGalleryImages.push(imageId);
  } else {
    // Remove from favorites
    this.favoriteGalleryImages.splice(index, 1);
  }

  return this.save();
};

// Static method to get user statistics
userSchema.statics.getStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: {
            $cond: [{ $eq: ["$isActive", true] }, 1, 0],
          },
        },
        verifiedUsers: {
          $sum: {
            $cond: [{ $eq: ["$isEmailVerified", true] }, 1, 0],
          },
        },
        averagePoints: { $avg: "$loyaltyPoints" },
      },
    },
  ]);

  return (
    stats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      verifiedUsers: 0,
      averagePoints: 0,
    }
  );
};

module.exports = mongoose.model("User", userSchema);
