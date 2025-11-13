const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: [true, "Menu item is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      max: [99, "Quantity cannot exceed 99"],
    },
    size: {
      type: String,
      enum: ["small", "medium", "large", "extra-large"],
      default: "medium",
    },
    customizations: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        selections: [
          {
            type: String,
            required: true,
            trim: true,
          },
        ],
        priceModifier: {
          type: Number,
          default: 0,
        },
      },
    ],
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: [true, "Total price is required"],
      min: 0,
    },
    specialInstructions: {
      type: String,
      maxlength: [200, "Special instructions cannot exceed 200 characters"],
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required for order"],
    },
    items: [orderItemSchema],
    orderType: {
      type: String,
      enum: ["pickup", "delivery", "dine-in"],
      required: [true, "Order type is required"],
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "processing", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "mobile", "loyalty-points"],
      required: [true, "Payment method is required"],
    },
    paymentDetails: {
      transactionId: String,
      paymentProcessor: String, // stripe, paypal, etc.
      cardLast4: String,
      cardType: String,
    },
    pricing: {
      subtotal: {
        type: Number,
        required: [true, "Subtotal is required"],
        min: 0,
      },
      tax: {
        type: Number,
        required: [true, "Tax amount is required"],
        min: 0,
      },
      tip: {
        type: Number,
        default: 0,
        min: 0,
      },
      discount: {
        amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        code: String,
        description: String,
      },
      deliveryFee: {
        type: Number,
        default: 0,
        min: 0,
      },
      total: {
        type: Number,
        required: [true, "Total is required"],
        min: 0,
      },
    },
    customerInfo: {
      name: {
        type: String,
        required: [true, "Customer name is required"],
        trim: true,
      },
      phone: {
        type: String,
        required: [true, "Customer phone is required"],
        match: [/^\+?[\d\s\-\(\)]+$/, "Please provide a valid phone number"],
      },
      email: {
        type: String,
        required: [true, "Customer email is required"],
        match: [
          /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
          "Please provide a valid email",
        ],
      },
    },
    deliveryInfo: {
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: {
          type: String,
          default: "US",
        },
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
      deliveryInstructions: {
        type: String,
        maxlength: [300, "Delivery instructions cannot exceed 300 characters"],
        trim: true,
      },
      estimatedDeliveryTime: Date,
      actualDeliveryTime: Date,
    },
    pickupInfo: {
      estimatedReadyTime: Date,
      actualReadyTime: Date,
      pickupTime: Date,
      pickupInstructions: {
        type: String,
        maxlength: [200, "Pickup instructions cannot exceed 200 characters"],
        trim: true,
      },
    },
    specialInstructions: {
      type: String,
      maxlength: [500, "Special instructions cannot exceed 500 characters"],
      trim: true,
    },
    loyaltyPoints: {
      earned: {
        type: Number,
        default: 0,
        min: 0,
      },
      redeemed: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    estimatedPreparationTime: {
      type: Number, // in minutes
      default: 15,
      min: 1,
    },
    actualPreparationTime: Number, // in minutes
    rating: {
      overall: {
        type: Number,
        min: 1,
        max: 5,
      },
      food: {
        type: Number,
        min: 1,
        max: 5,
      },
      service: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: {
        type: String,
        maxlength: 500,
        trim: true,
      },
      ratedAt: Date,
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        note: String,
      },
    ],
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tableNumber: Number, // for dine-in orders
    refund: {
      amount: Number,
      reason: String,
      processedAt: Date,
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for formatted order number
orderSchema.virtual("formattedOrderNumber").get(function () {
  return `#${this.orderNumber}`;
});

// Virtual for estimated completion time
orderSchema.virtual("estimatedCompletionTime").get(function () {
  if (!this.createdAt || !this.estimatedPreparationTime) return null;

  const completion = new Date(this.createdAt);
  completion.setMinutes(
    completion.getMinutes() + this.estimatedPreparationTime
  );

  return completion;
});

// Virtual for order duration
orderSchema.virtual("orderDuration").get(function () {
  if (!this.createdAt || this.status !== "completed") return null;

  const completedStatus = this.statusHistory.find(
    (s) => s.status === "completed"
  );
  if (!completedStatus) return null;

  return Math.round((completedStatus.timestamp - this.createdAt) / (1000 * 60)); // in minutes
});

// Indexes for performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderType: 1, status: 1 });
orderSchema.index({ "customerInfo.phone": 1 });
orderSchema.index({ "customerInfo.email": 1 });

// Pre-save middleware to generate order number
orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderNumber) {
    this.orderNumber = await this.constructor.generateOrderNumber();
  }
  next();
});

// Pre-save middleware to update status history
orderSchema.pre("save", function (next) {
  if (this.isModified("status") && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
    });
  } else if (this.isNew) {
    this.statusHistory = [
      {
        status: this.status,
        timestamp: new Date(),
      },
    ];
  }
  next();
});

// Pre-save middleware to calculate loyalty points
orderSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("pricing.total")) {
    // Earn 1 point per dollar spent (rounded down)
    this.loyaltyPoints.earned = Math.floor(this.pricing.total);
  }
  next();
});

// Static method to generate unique order number
orderSchema.statics.generateOrderNumber = async function () {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  // Find the highest order number for today
  const lastOrder = await this.findOne({
    orderNumber: new RegExp(`^${dateStr}`),
  }).sort({ orderNumber: -1 });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.slice(-3));
    sequence = lastSequence + 1;
  }

  return `${dateStr}${sequence.toString().padStart(3, "0")}`;
};

// Method to update status
orderSchema.methods.updateStatus = function (newStatus, updatedBy, note) {
  const validTransitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }

  this.status = newStatus;

  if (updatedBy || note) {
    const statusUpdate = {
      status: newStatus,
      timestamp: new Date(),
    };

    if (updatedBy) statusUpdate.updatedBy = updatedBy;
    if (note) statusUpdate.note = note;

    this.statusHistory.push(statusUpdate);
  }

  // Set estimated times based on status
  if (newStatus === "preparing") {
    const now = new Date();

    if (this.orderType === "pickup") {
      this.pickupInfo.estimatedReadyTime = new Date(
        now.getTime() + this.estimatedPreparationTime * 60000
      );
    } else if (this.orderType === "delivery") {
      const prepTime = this.estimatedPreparationTime * 60000;
      const deliveryTime = 20 * 60000; // 20 minutes delivery time
      this.deliveryInfo.estimatedDeliveryTime = new Date(
        now.getTime() + prepTime + deliveryTime
      );
    }
  }

  if (newStatus === "ready" && this.orderType === "pickup") {
    this.pickupInfo.actualReadyTime = new Date();
  }

  if (newStatus === "completed") {
    if (this.orderType === "pickup") {
      this.pickupInfo.pickupTime = new Date();
    } else if (this.orderType === "delivery") {
      this.deliveryInfo.actualDeliveryTime = new Date();
    }
  }

  return this.save();
};

// Method to calculate total price
orderSchema.methods.calculateTotal = function () {
  // Calculate subtotal from items
  this.pricing.subtotal = this.items.reduce(
    (total, item) => total + item.totalPrice,
    0
  );

  // Calculate tax (assuming 8.5% tax rate)
  const taxRate = 0.085;
  this.pricing.tax = Math.round(this.pricing.subtotal * taxRate * 100) / 100;

  // Add delivery fee if applicable
  if (this.orderType === "delivery" && this.pricing.deliveryFee === 0) {
    this.pricing.deliveryFee = 3.99; // Default delivery fee
  }

  // Calculate total
  this.pricing.total =
    this.pricing.subtotal +
    this.pricing.tax +
    this.pricing.tip +
    this.pricing.deliveryFee -
    this.pricing.discount.amount;

  // Round to 2 decimal places
  this.pricing.total = Math.round(this.pricing.total * 100) / 100;

  return this.pricing.total;
};

// Method to add rating
orderSchema.methods.addRating = function (rating) {
  if (this.status !== "completed") {
    throw new Error("Can only rate completed orders");
  }

  this.rating = {
    ...rating,
    ratedAt: new Date(),
  };

  return this.save();
};

// Method to process refund
orderSchema.methods.processRefund = function (amount, reason, processedBy) {
  if (this.paymentStatus !== "paid") {
    throw new Error("Can only refund paid orders");
  }

  if (amount > this.pricing.total) {
    throw new Error("Refund amount cannot exceed order total");
  }

  this.refund = {
    amount,
    reason,
    processedAt: new Date(),
    processedBy,
  };

  this.paymentStatus = "refunded";
  this.status = "cancelled";

  return this.save();
};

// Static method to get order statistics
orderSchema.statics.getStats = async function (startDate, endDate) {
  const matchStage = {
    status: { $ne: "cancelled" },
  };

  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.total" },
        averageOrderValue: { $avg: "$pricing.total" },
        orderTypes: {
          $push: "$orderType",
        },
        paymentMethods: {
          $push: "$paymentMethod",
        },
      },
    },
  ]);

  // Get order type breakdown
  const orderTypeStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$orderType",
        count: { $sum: 1 },
        revenue: { $sum: "$pricing.total" },
      },
    },
  ]);

  // Get popular items
  const popularItems = await this.aggregate([
    { $match: matchStage },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.menuItem",
        totalQuantity: { $sum: "$items.quantity" },
        totalRevenue: { $sum: "$items.totalPrice" },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "menuitems",
        localField: "_id",
        foreignField: "_id",
        as: "menuItem",
      },
    },
  ]);

  return {
    ...stats[0],
    orderTypeBreakdown: orderTypeStats,
    popularItems,
  };
};

module.exports = mongoose.model("Order", orderSchema);
