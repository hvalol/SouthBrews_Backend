const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Menu item name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: false, // ✅ Make it optional
      trim: true,
      default: "", // ✅ Add default empty string
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: [
          "coffee",
          "tea",
          "frappe",
          "pastries",
          "sandwiches",
          "salads",
          "desserts",
          "other",
        ],
        message: "Please select a valid category",
      },
    },
    subcategory: {
      type: String,
      trim: true,
    },
    image: {
      public_id: String,
      url: String,
    },
    images: [
      {
        public_id: String,
        url: String,
      },
    ],
    ingredients: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        allergen: {
          type: Boolean,
          default: false,
        },
      },
    ],
    nutritionalInfo: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      sugar: Number,
      sodium: Number,
      fiber: Number,
    },
    dietaryInfo: [
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
          "organic",
        ],
      },
    ],
    sizes: [
      {
        name: {
          type: String,
          required: true,
          enum: ["small", "medium", "large", "extra-large"],
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        calories: Number,
      },
    ],
    customizations: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        options: [
          {
            name: {
              type: String,
              required: true,
              trim: true,
            },
            priceModifier: {
              type: Number,
              default: 0,
            },
          },
        ],
        required: {
          type: Boolean,
          default: false,
        },
        multiSelect: {
          type: Boolean,
          default: false,
        },
      },
    ],
    available: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    popularity: {
      type: Number,
      default: 0,
      min: 0,
    },
    preparationTime: {
      type: Number, // in minutes
      default: 5,
      min: 1,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    seasonalAvailability: {
      available: {
        type: Boolean,
        default: false,
      },
      startDate: Date,
      endDate: Date,
    },
    loyaltyPoints: {
      earned: {
        type: Number,
        default: 1,
        min: 0,
      },
      redeemable: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for average rating
menuItemSchema.virtual("averageRating", {
  ref: "Review",
  localField: "_id",
  foreignField: "menuItem",
  justOne: false,
  options: { match: { menuItem: { $exists: true } } },
});

// Virtual for review count
menuItemSchema.virtual("reviewCount", {
  ref: "Review",
  localField: "_id",
  foreignField: "menuItem",
  count: true,
});

// Indexes for better performance
menuItemSchema.index({ category: 1, available: 1 });
menuItemSchema.index({ featured: 1, available: 1 });
menuItemSchema.index({ popularity: -1 });
menuItemSchema.index({ name: "text", description: "text", tags: "text" });

// Middleware to update popularity when ordered
menuItemSchema.methods.incrementPopularity = function () {
  this.popularity += 1;
  return this.save();
};

// Method to check if item is currently available (considering seasonal availability)
menuItemSchema.methods.isCurrentlyAvailable = function () {
  if (!this.available) return false;

  if (this.seasonalAvailability.available) {
    const now = new Date();
    const start = new Date(this.seasonalAvailability.startDate);
    const end = new Date(this.seasonalAvailability.endDate);

    return now >= start && now <= end;
  }

  return true;
};

// Method to get price for specific size
menuItemSchema.methods.getPriceForSize = function (sizeName) {
  if (!this.sizes || this.sizes.length === 0) {
    return this.price;
  }

  const size = this.sizes.find((s) => s.name === sizeName);
  return size ? size.price : this.price;
};

// Static method to get menu statistics
menuItemSchema.statics.getStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        availableItems: {
          $sum: {
            $cond: [{ $eq: ["$available", true] }, 1, 0],
          },
        },
        featuredItems: {
          $sum: {
            $cond: [{ $eq: ["$featured", true] }, 1, 0],
          },
        },
        averagePrice: { $avg: "$price" },
        categoryBreakdown: {
          $push: "$category",
        },
      },
    },
  ]);

  // Get category breakdown
  const categoryStats = await this.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return {
    ...stats[0],
    categoryBreakdown: categoryStats,
  };
};

// Static method to search menu items
menuItemSchema.statics.search = function (query, filters = {}) {
  const searchQuery = {
    available: true,
    ...filters,
  };

  if (query) {
    searchQuery.$text = { $search: query };
  }

  return this.find(searchQuery)
    .populate("averageRating reviewCount")
    .sort({ popularity: -1, createdAt: -1 });
};

// Pre-save middleware to generate tags from name and description
menuItemSchema.pre("save", function (next) {
  if (this.isModified("name") || this.isModified("description")) {
    const words = `${this.name} ${this.description}`
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 10); // Limit to 10 tags

    this.tags = [...new Set([...this.tags, ...words])];
  }
  next();
});

module.exports = mongoose.model("MenuItem", menuItemSchema);
