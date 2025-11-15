const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Image title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: [
          "interior",
          "coffee",
          "food",
          "events",
          "nature",
          "people",
          "other",
        ],
        message: "Please select a valid category",
      },
      default: "other",
    },
    url: {
      type: String,
      required: [true, "Image URL is required"],
    },
    cloudinaryId: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
    metadata: {
      width: Number,
      height: Number,
      format: String,
      size: Number, // in bytes
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for like count
gallerySchema.virtual("likeCount").get(function () {
  return this.likes ? this.likes.length : 0;
});

// Virtual for formatted upload date
gallerySchema.virtual("uploadedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Indexes for efficient querying
gallerySchema.index({ category: 1 });
gallerySchema.index({ isActive: 1, isFeatured: -1 });
gallerySchema.index({ createdAt: -1 });
gallerySchema.index({ tags: 1 });
gallerySchema.index({ title: "text", description: "text", tags: "text" });

// Instance method to increment views
gallerySchema.methods.incrementViews = async function () {
  this.views += 1;
  return this.save();
};

// Instance method to toggle like
gallerySchema.methods.toggleLike = async function (userId) {
  const likeIndex = this.likes.indexOf(userId);

  if (likeIndex > -1) {
    // Unlike
    this.likes.splice(likeIndex, 1);
  } else {
    // Like
    this.likes.push(userId);
  }

  return this.save();
};

// Static method to get gallery statistics
gallerySchema.statics.getStats = async function () {
  const stats = await this.aggregate([
    {
      $facet: {
        totalImages: [{ $count: "count" }],
        byCategory: [
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
            },
          },
        ],
        totalViews: [
          {
            $group: {
              _id: null,
              total: { $sum: "$views" },
            },
          },
        ],
        totalLikes: [
          {
            $project: {
              likeCount: { $size: "$likes" },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$likeCount" },
            },
          },
        ],
        featuredImages: [
          {
            $match: { isFeatured: true },
          },
          { $count: "count" },
        ],
      },
    },
  ]);

  return {
    totalImages: stats[0].totalImages[0]?.count || 0,
    byCategory: stats[0].byCategory,
    totalViews: stats[0].totalViews[0]?.total || 0,
    totalLikes: stats[0].totalLikes[0]?.total || 0,
    featuredImages: stats[0].featuredImages[0]?.count || 0,
  };
};

// Static method to get popular images
gallerySchema.statics.getPopular = async function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ views: -1, likes: -1 })
    .limit(limit)
    .populate("uploadedBy", "firstName lastName");
};

// Static method to search images
gallerySchema.statics.searchImages = async function (query) {
  return this.find(
    {
      $text: { $search: query },
      isActive: true,
    },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .populate("uploadedBy", "firstName lastName");
};

module.exports = mongoose.model("Gallery", gallerySchema);
