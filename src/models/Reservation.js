const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required for reservation"],
    },
    date: {
      type: Date,
      required: [true, "Reservation date is required"],
      validate: {
        validator: function (value) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return value >= today;
        },
        message: "Reservation date cannot be in the past",
      },
    },
    time: {
      type: String,
      required: [true, "Reservation time is required"],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Please provide time in HH:MM format",
      ],
    },
    partySize: {
      type: Number,
      required: [true, "Party size is required"],
      min: [1, "Party size must be at least 1"],
      max: [12, "Party size cannot exceed 12 people"],
    },
    tableNumber: {
      type: Number,
      min: 1,
    },
    tableType: {
      type: String,
      enum: ["regular", "high-top", "booth", "outdoor", "private"],
      default: "regular",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "seated",
        "completed",
        "cancelled",
        "no-show",
      ],
      default: "pending",
    },
    contactInfo: {
      phone: {
        type: String,
        required: [true, "Contact phone is required"],
        match: [/^\+?[\d\s\-\(\)]+$/, "Please provide a valid phone number"],
      },
      email: {
        type: String,
        required: [true, "Contact email is required"],
        match: [
          /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
          "Please provide a valid email",
        ],
      },
    },
    specialRequests: {
      type: String,
      maxlength: [500, "Special requests cannot exceed 500 characters"],
      trim: true,
    },
    occasion: {
      type: String,
      enum: [
        "birthday",
        "anniversary",
        "date",
        "business",
        "celebration",
        "other",
      ],
      default: "other",
    },
    preferences: {
      seating: {
        type: String,
        enum: ["indoor", "outdoor", "window", "quiet", "no-preference"],
        default: "no-preference",
      },
      accessibility: {
        wheelchairAccessible: {
          type: Boolean,
          default: false,
        },
        highChair: {
          type: Boolean,
          default: false,
        },
      },
    },
    estimatedDuration: {
      type: Number, // in minutes
      default: 90,
      min: 30,
      max: 180,
    },
    confirmationCode: {
      type: String,
      unique: true,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    reminderSentAt: Date,
    checkedInAt: Date,
    completedAt: Date,
    cancellationReason: String,
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: [
      {
        content: {
          type: String,
          required: true,
          maxlength: 500,
        },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full date-time
reservationSchema.virtual("dateTime").get(function () {
  if (!this.date || !this.time) return null;

  const [hours, minutes] = this.time.split(":").map(Number);
  const dateTime = new Date(this.date);
  dateTime.setHours(hours, minutes, 0, 0);

  return dateTime;
});

// Virtual for formatted date
reservationSchema.virtual("formattedDate").get(function () {
  if (!this.date) return null;
  return this.date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Virtual for formatted time
reservationSchema.virtual("formattedTime").get(function () {
  if (!this.time) return null;

  const [hours, minutes] = this.time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
});

// Indexes for performance
reservationSchema.index({ user: 1, date: 1 });
reservationSchema.index({ date: 1, time: 1 });
reservationSchema.index({ status: 1, date: 1 });
reservationSchema.index(
  { confirmationCode: 1 },
  { unique: true, sparse: true }
);

// Pre-save middleware to generate confirmation code
reservationSchema.pre("save", function (next) {
  if (this.isNew && !this.confirmationCode) {
    this.confirmationCode = this.generateConfirmationCode();
  }
  next();
});

// Method to generate confirmation code
reservationSchema.methods.generateConfirmationCode = function () {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Method to check if reservation can be cancelled
reservationSchema.methods.canBeCancelled = function () {
  if (["completed", "cancelled", "no-show"].includes(this.status)) {
    return false;
  }

  // Allow cancellation up to 2 hours before reservation time
  const reservationDateTime = this.dateTime;
  const now = new Date();
  const timeDiff = reservationDateTime - now;

  return timeDiff > 2 * 60 * 60 * 1000; // 2 hours in milliseconds
};

// Method to cancel reservation
reservationSchema.methods.cancel = function (reason, cancelledBy) {
  if (!this.canBeCancelled()) {
    throw new Error("Reservation cannot be cancelled at this time");
  }

  this.status = "cancelled";
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;

  return this.save();
};

// Method to confirm reservation
reservationSchema.methods.confirm = function () {
  if (this.status !== "pending") {
    throw new Error("Only pending reservations can be confirmed");
  }

  this.status = "confirmed";
  return this.save();
};

// Method to check in customer
reservationSchema.methods.checkIn = function (tableNumber) {
  if (this.status !== "confirmed") {
    throw new Error("Only confirmed reservations can be checked in");
  }

  this.status = "seated";
  this.tableNumber = tableNumber;
  this.checkedInAt = new Date();

  return this.save();
};

// Method to complete reservation
reservationSchema.methods.complete = function () {
  if (this.status !== "seated") {
    throw new Error("Only seated reservations can be completed");
  }

  this.status = "completed";
  this.completedAt = new Date();

  return this.save();
};

// Method to add note
reservationSchema.methods.addNote = function (content, addedBy) {
  this.notes.push({
    content,
    addedBy,
    addedAt: new Date(),
  });

  return this.save();
};

// Static method to check availability for a specific time slot
reservationSchema.statics.checkAvailability = async function (
  date,
  time,
  partySize
) {
  // Normalize the date to start of day
  const reservationDate = new Date(date);
  reservationDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(reservationDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Get all reservations for that day with conflicting status
  const existingReservations = await this.find({
    date: {
      $gte: reservationDate,
      $lt: nextDay,
    },
    status: { $in: ["pending", "confirmed", "seated"] },
  });

  // Parse the requested time
  const [requestedHours, requestedMinutes] = time.split(":").map(Number);
  const requestedTimeInMinutes = requestedHours * 60 + requestedMinutes;

  // Check for time slot conflicts (90-minute dining window)
  const DINING_DURATION = 90; // minutes

  for (const reservation of existingReservations) {
    const [existingHours, existingMinutes] = reservation.time
      .split(":")
      .map(Number);
    const existingTimeInMinutes = existingHours * 60 + existingMinutes;

    // Check if times overlap (considering 90-minute duration)
    const requestedStart = requestedTimeInMinutes;
    const requestedEnd = requestedTimeInMinutes + DINING_DURATION;
    const existingStart = existingTimeInMinutes;
    const existingEnd = existingTimeInMinutes + DINING_DURATION;

    // If times overlap, check capacity
    if (
      (requestedStart >= existingStart && requestedStart < existingEnd) ||
      (requestedEnd > existingStart && requestedEnd <= existingEnd) ||
      (requestedStart <= existingStart && requestedEnd >= existingEnd)
    ) {
      // Times overlap - you can add more sophisticated logic here
      // For now, we'll use a simple capacity check
    }
  }

  // Simple availability check based on total capacity
  const maxCapacity = 50; // Total restaurant capacity
  const reservedCapacity = existingReservations
    .filter((res) => {
      const [resHours, resMinutes] = res.time.split(":").map(Number);
      const resTimeInMinutes = resHours * 60 + resMinutes;
      const timeDiff = Math.abs(resTimeInMinutes - requestedTimeInMinutes);
      return timeDiff < DINING_DURATION; // Within dining window
    })
    .reduce((total, res) => total + res.partySize, 0);

  return reservedCapacity + partySize <= maxCapacity;
};

// Static method to get reservation statistics
reservationSchema.statics.getStats = async function (startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalReservations: { $sum: 1 },
        confirmedReservations: {
          $sum: {
            $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0],
          },
        },
        completedReservations: {
          $sum: {
            $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
          },
        },
        cancelledReservations: {
          $sum: {
            $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
          },
        },
        noShowReservations: {
          $sum: {
            $cond: [{ $eq: ["$status", "no-show"] }, 1, 0],
          },
        },
        totalGuests: { $sum: "$partySize" },
        averagePartySize: { $avg: "$partySize" },
      },
    },
  ]);

  return (
    stats[0] || {
      totalReservations: 0,
      confirmedReservations: 0,
      completedReservations: 0,
      cancelledReservations: 0,
      noShowReservations: 0,
      totalGuests: 0,
      averagePartySize: 0,
    }
  );
};

module.exports = mongoose.model("Reservation", reservationSchema);
