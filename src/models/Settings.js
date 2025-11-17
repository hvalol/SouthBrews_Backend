const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    // General Settings
    general: {
      businessName: {
        type: String,
        required: true,
        default: "South Side Brews",
      },
      tagline: {
        type: String,
        default: "Brewing Perfection Since 2020",
      },
      email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
      },
      phone: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      website: {
        type: String,
      },
      onlineStoreUrl: {
        type: String,
        default: "http://utak.io/store/southsidebrews",
      },
      description: {
        type: String,
        maxlength: 500,
      },
    },

    // Business Hours
    businessHours: {
      monday: {
        open: { type: String, default: "07:00" },
        close: { type: String, default: "20:00" },
        closed: { type: Boolean, default: false },
      },
      tuesday: {
        open: { type: String, default: "07:00" },
        close: { type: String, default: "20:00" },
        closed: { type: Boolean, default: false },
      },
      wednesday: {
        open: { type: String, default: "07:00" },
        close: { type: String, default: "20:00" },
        closed: { type: Boolean, default: false },
      },
      thursday: {
        open: { type: String, default: "07:00" },
        close: { type: String, default: "20:00" },
        closed: { type: Boolean, default: false },
      },
      friday: {
        open: { type: String, default: "07:00" },
        close: { type: String, default: "22:00" },
        closed: { type: Boolean, default: false },
      },
      saturday: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "22:00" },
        closed: { type: Boolean, default: false },
      },
      sunday: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "20:00" },
        closed: { type: Boolean, default: false },
      },
    },

    // Payment Settings
    payment: {
      enableCreditCard: { type: Boolean, default: true },
      enableDebitCard: { type: Boolean, default: true },
      enableCash: { type: Boolean, default: true },
      enableDigitalWallet: { type: Boolean, default: true },
      taxRate: { type: Number, default: 8.5, min: 0, max: 100 },
      currency: { type: String, default: "USD" },
      tipOptions: {
        type: [Number],
        default: [10, 15, 20, 25],
      },
    },

    // Notification Settings
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      orderNotifications: { type: Boolean, default: true },
      reservationNotifications: { type: Boolean, default: true },
      lowInventoryAlerts: { type: Boolean, default: true },
      customerMessages: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false },
      dailyReports: { type: Boolean, default: true },
      weeklyReports: { type: Boolean, default: true },
    },

    // Delivery Settings
    delivery: {
      enableDelivery: { type: Boolean, default: true },
      deliveryRadius: { type: Number, default: 5, min: 0 },
      minimumOrder: { type: Number, default: 15.0, min: 0 },
      deliveryFee: { type: Number, default: 3.99, min: 0 },
      freeDeliveryThreshold: { type: Number, default: 50.0, min: 0 },
      estimatedDeliveryTime: { type: String, default: "30-45 minutes" },
    },

    // Appearance Settings
    appearance: {
      primaryColor: { type: String, default: "#2D5016" },
      secondaryColor: { type: String, default: "#8B4513" },
      accentColor: { type: String, default: "#D4A574" },
      logoUrl: { type: String },
      faviconUrl: { type: String },
      theme: {
        type: String,
        enum: ["light", "dark"],
        default: "light",
      },
    },

    // Social Media
    socialMedia: {
      instagram: { type: String },
      facebook: { type: String },
      twitter: { type: String },
      linkedin: { type: String },
    },

    // Reservation Settings
    reservations: {
      maxCapacity: {
        type: Number,
        default: 50,
        min: 1,
        max: 500,
      },
      diningDuration: {
        type: Number,
        default: 90,
        min: 30,
        max: 180,
      },
      enableReservations: {
        type: Boolean,
        default: true,
      },
      minPartySize: {
        type: Number,
        default: 1,
        min: 1,
      },
      maxPartySize: {
        type: Number,
        default: 20,
        min: 1,
        max: 50,
      },
      minAdvanceBooking: {
        type: Number,
        default: 1,
        min: 0,
      },
      maxAdvanceBooking: {
        type: Number,
        default: 60,
        min: 1,
      },
      timeSlots: {
        type: [String],
        default: [
          "11:00",
          "11:30",
          "12:00",
          "12:30",
          "13:00",
          "13:30",
          "14:00",
          "14:30",
          "17:00",
          "17:30",
          "18:00",
          "18:30",
          "19:00",
          "19:30",
          "20:00",
          "20:30",
          "21:00",
        ],
      },
      slotCapacityOverrides: {
        type: Map,
        of: Number,
        default: new Map(),
      },
      blockedDates: {
        type: [Date],
        default: [],
      },
      blockedSlots: {
        type: Map,
        of: [String],
        default: new Map(),
      },
    },

    // Metadata
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      general: {
        businessName: "South Side Brews",
        tagline: "Brewing Perfection Since 2020",
        email: "info@southsidebrews.com",
        phone: "+1 (555) 123-4567",
        address: "123 Mountain View Road, Forest Hills, CA 90210",
        website: "www.southsidebrews.com",
        onlineStoreUrl: "https://utak.ph/store/southsidebrews",
        description:
          "A cozy mountain cafe serving artisanal coffee and fresh pastries.",
      },
    });
  }
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);
