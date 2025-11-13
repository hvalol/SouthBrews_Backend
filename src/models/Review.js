const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required for review"],
    },
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: false, // Can be null for general cafe reviews
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: false, // Link to specific order if applicable
    },
    type: {
      type: String,
      enum: ["general", "menu-item", "service", "atmosphere"],
      default: "general",
    },
    rating: {
      overall: {
        type: Number,
        required: [true, "Overall rating is required"],
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating cannot exceed 5"],
      },
      food: {
        type: Number,
        min: [1, "Food rating must be at least 1"],
        max: [5, "Food rating cannot exceed 5"],
      },
      service: {
        type: Number,
        min: [1, "Service rating must be at least 1"],
        max: [5, "Service rating cannot exceed 5"],
      },
      atmosphere: {
        type: Number,
        min: [1, "Atmosphere rating must be at least 1"],
        max: [5, "Atmosphere rating cannot exceed 5"],
      },
      value: {
        type: Number,
        min: [1, "Value rating must be at least 1"],
        max: [5, "Value rating cannot exceed 5"],
      },
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Review title cannot exceed 100 characters"],
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true,
      minlength: [10, "Review comment must be at least 10 characters"],
      maxlength: [1000, "Review comment cannot exceed 1000 characters"],
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        caption: {
          type: String,
          maxlength: 200,
        },
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 50,
      },
    ],
    visitDate: {
      type: Date,
      required: [true, "Visit date is required"],
      validate: {
        validator: function (value) {
          return value <= new Date();
        },
        message: "Visit date cannot be in the future",
      },
    },
    visitType: {
      type: String,
      enum: ["dine-in", "takeout", "delivery", "event"],
      required: [true, "Visit type is required"],
    },
    partySize: {
      type: Number,
      min: [1, "Party size must be at least 1"],
      max: [20, "Party size cannot exceed 20"],
      default: 1,
    },
    occasion: {
      type: String,
      enum: [
        "casual",
        "business",
        "date",
        "celebration",
        "family",
        "solo",
        "other",
      ],
      default: "casual",
    },
    wouldRecommend: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false, // Verified if linked to actual order
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "flagged"],
      default: "pending",
    },
    moderationNotes: {
      type: String,
      maxlength: 500,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    moderatedAt: Date,
    helpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    unhelpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    votedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        vote: {
          type: String,
          enum: ["helpful", "unhelpful"],
          required: true,
        },
        votedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    response: {
      content: {
        type: String,
        maxlength: 500,
        trim: true,
      },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      respondedAt: Date,
    },
    flagged: {
      isflagged: {
        type: Boolean,
        default: false,
      },
      reasons: [
        {
          type: String,
          enum: ["inappropriate", "spam", "fake", "offensive", "other"],
        },
      ],
      flaggedBy: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          reason: String,
          flaggedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for helpfulness ratio
reviewSchema.virtual("helpfulnessRatio").get(function () {
  const totalVotes = this.helpfulVotes + this.unhelpfulVotes;
  if (totalVotes === 0) return 0;
  return (this.helpfulVotes / totalVotes) * 100;
});

// Virtual for reviewer name (respecting anonymity)
reviewSchema.virtual("reviewerName").get(function () {
  if (this.isAnonymous || !this.populated("user")) {
    return "Anonymous";
  }
  return this.user ? this.user.firstName : "Anonymous";
});

// Virtual for time since review
reviewSchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const diff = now - this.createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
});

// Indexes for performance
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ menuItem: 1, status: 1, createdAt: -1 });
reviewSchema.index({ "rating.overall": -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ helpfulVotes: -1 });

// Compound index for menu item reviews
reviewSchema.index({ menuItem: 1, status: 1, "rating.overall": -1 });

// Ensure user can only review the same menu item once
reviewSchema.index(
  { user: 1, menuItem: 1 },
  {
    unique: true,
    partialFilterExpression: { menuItem: { $exists: true } },
  }
);

// Pre-save middleware to verify order if provided
reviewSchema.pre("save", async function (next) {
  if (this.isNew && this.order) {
    const Order = mongoose.model("Order");
    const order = await Order.findOne({
      _id: this.order,
      user: this.user,
      status: "completed",
    });

    if (order) {
      this.isVerified = true;
      // If reviewing a specific menu item, check if it was in the order
      if (this.menuItem) {
        const itemInOrder = order.items.some(
          (item) => item.menuItem.toString() === this.menuItem.toString()
        );
        if (!itemInOrder) {
          const error = new Error(
            "Menu item was not part of the specified order"
          );
          return next(error);
        }
      }
    }
  }
  next();
});

// Pre-save middleware to auto-approve verified reviews
reviewSchema.pre("save", function (next) {
  if (this.isNew && this.isVerified) {
    this.status = "approved";
  }
  next();
});

// Method to vote on review helpfulness
reviewSchema.methods.vote = function (userId, voteType) {
  // Remove existing vote from this user
  this.votedBy = this.votedBy.filter(
    (vote) => vote.user.toString() !== userId.toString()
  );

  // Add new vote
  this.votedBy.push({
    user: userId,
    vote: voteType,
    votedAt: new Date(),
  });

  // Recalculate vote counts
  this.helpfulVotes = this.votedBy.filter(
    (vote) => vote.vote === "helpful"
  ).length;
  this.unhelpfulVotes = this.votedBy.filter(
    (vote) => vote.vote === "unhelpful"
  ).length;

  return this.save();
};

// Method to flag review
reviewSchema.methods.flag = function (userId, reason) {
  // Check if user already flagged this review
  const existingFlag = this.flagged.flaggedBy.find(
    (flag) => flag.user.toString() === userId.toString()
  );

  if (existingFlag) {
    throw new Error("You have already flagged this review");
  }

  this.flagged.flaggedBy.push({
    user: userId,
    reason,
    flaggedAt: new Date(),
  });

  // Add reason to reasons array if not already present
  if (!this.flagged.reasons.includes(reason)) {
    this.flagged.reasons.push(reason);
  }

  // Flag review if it receives multiple flags
  if (this.flagged.flaggedBy.length >= 3) {
    this.flagged.isflagged = true;
    this.status = "flagged";
  }

  return this.save();
};

// Method to respond to review (for staff)
reviewSchema.methods.respond = function (content, respondedBy) {
  this.response = {
    content,
    respondedBy,
    respondedAt: new Date(),
  };

  return this.save();
};

// Method to moderate review
reviewSchema.methods.moderate = function (status, notes, moderatedBy) {
  const validStatuses = ["approved", "rejected"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid moderation status");
  }

  this.status = status;
  this.moderationNotes = notes;
  this.moderatedBy = moderatedBy;
  this.moderatedAt = new Date();

  return this.save();
};

// Static method to get review statistics for a menu item
reviewSchema.statics.getMenuItemStats = async function (menuItemId) {
  const stats = await this.aggregate([
    {
      $match: {
        menuItem: new mongoose.Types.ObjectId(menuItemId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: "$rating.overall" },
        averageFoodRating: { $avg: "$rating.food" },
        averageServiceRating: { $avg: "$rating.service" },
        averageAtmosphereRating: { $avg: "$rating.atmosphere" },
        averageValueRating: { $avg: "$rating.value" },
        ratingBreakdown: {
          $push: "$rating.overall",
        },
        recommendationRate: {
          $avg: {
            $cond: [{ $eq: ["$wouldRecommend", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  // Calculate rating distribution
  const ratingDistribution = await this.aggregate([
    {
      $match: {
        menuItem: new mongoose.Types.ObjectId(menuItemId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$rating.overall",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  return {
    ...stats[0],
    ratingDistribution,
  };
};

// Static method to get overall cafe statistics
reviewSchema.statics.getCafeStats = async function () {
  const stats = await this.aggregate([
    {
      $match: {
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: "$rating.overall" },
        averageFoodRating: { $avg: "$rating.food" },
        averageServiceRating: { $avg: "$rating.service" },
        averageAtmosphereRating: { $avg: "$rating.atmosphere" },
        averageValueRating: { $avg: "$rating.value" },
        recommendationRate: {
          $avg: {
            $cond: [{ $eq: ["$wouldRecommend", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  // Get recent reviews
  const recentReviews = await this.find({
    status: "approved",
  })
    .populate("user", "firstName lastName")
    .populate("menuItem", "name")
    .sort({ createdAt: -1 })
    .limit(5);

  return {
    ...stats[0],
    recentReviews,
  };
};

// Static method to get top-rated menu items
reviewSchema.statics.getTopRatedItems = async function (limit = 10) {
  return await this.aggregate([
    {
      $match: {
        menuItem: { $exists: true },
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$menuItem",
        averageRating: { $avg: "$rating.overall" },
        reviewCount: { $sum: 1 },
      },
    },
    {
      $match: {
        reviewCount: { $gte: 3 }, // At least 3 reviews
      },
    },
    { $sort: { averageRating: -1, reviewCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "menuitems",
        localField: "_id",
        foreignField: "_id",
        as: "menuItem",
      },
    },
    { $unwind: "$menuItem" },
  ]);
};

module.exports = mongoose.model("Review", reviewSchema);
