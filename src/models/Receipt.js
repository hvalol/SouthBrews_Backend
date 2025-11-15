const mongoose = require("mongoose");

const receiptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    receiptNumber: {
      type: String,
      required: [true, "Receipt number is required"],
      trim: true,
    },
    orderDate: {
      type: Date,
      required: [true, "Order date is required"],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    items: [
      {
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    image: {
      url: {
        type: String,
        required: [true, "Receipt image is required"],
      },
      cloudinaryId: {
        type: String,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    pointsAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,
    rejectionReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for formatted order date
receiptSchema.virtual("formattedOrderDate").get(function () {
  return this.orderDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Virtual for formatted total amount
receiptSchema.virtual("formattedAmount").get(function () {
  return `$${this.totalAmount.toFixed(2)}`;
});

// Indexes
receiptSchema.index({ user: 1, createdAt: -1 });
receiptSchema.index({ status: 1 });
receiptSchema.index({ receiptNumber: 1 });

// Static method to calculate points from amount
receiptSchema.statics.calculatePoints = function (amount) {
  // 1 point per dollar spent
  return Math.floor(amount);
};

// Instance method to approve receipt
receiptSchema.methods.approve = async function (reviewerId) {
  this.status = "approved";
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();

  // Calculate points
  const points = this.constructor.calculatePoints(this.totalAmount);
  this.pointsAwarded = points;

  // Update user points
  const User = mongoose.model("User");
  const user = await User.findById(this.user);
  if (user) {
    await user.addLoyaltyPoints(
      points,
      "receipt",
      `Receipt #${this.receiptNumber}`,
      this._id
    );
    user.totalReceipts = (user.totalReceipts || 0) + 1;
    await user.save();
  }

  await this.save();
  return this;
};

// Instance method to reject receipt
receiptSchema.methods.reject = async function (reviewerId, reason) {
  this.status = "rejected";
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  await this.save();
  return this;
};

// Pre-save validation
receiptSchema.pre("save", function (next) {
  // Ensure order date is not in the future
  if (this.orderDate > new Date()) {
    return next(new Error("Order date cannot be in the future"));
  }

  // Ensure order date is not too old (90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  if (this.orderDate < ninetyDaysAgo) {
    return next(
      new Error(
        "Receipt is too old. Only receipts from the last 90 days are accepted"
      )
    );
  }

  next();
});

module.exports = mongoose.model("Receipt", receiptSchema);
