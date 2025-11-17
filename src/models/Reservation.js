const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allow guest reservations
    },
    date: {
      type: Date,
      required: [true, "Reservation date is required"],
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
      max: [20, "Party size cannot exceed 20 people"],
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
      name: {
        type: String,
        required: [true, "Contact name is required"],
        trim: true,
      },
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
      sparse: true, // Allow null values
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
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // Add dateString for easier frontend filtering
        if (ret.date) {
          const d = new Date(ret.date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          ret.dateString = `${year}-${month}-${day}`;
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ============================================
// VIRTUALS
// ============================================

// Virtual for normalized date string (YYYY-MM-DD)
reservationSchema.virtual("dateString").get(function () {
  if (!this.date) return null;
  const d = new Date(this.date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
});

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

// Virtual for customer name (from contactInfo or user)
reservationSchema.virtual("customerName").get(function () {
  if (this.user && this.user.firstName && this.user.lastName) {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
  return "Guest";
});

// Virtual to check if reservation is today
reservationSchema.virtual("isToday").get(function () {
  if (!this.date) return false;
  const today = new Date();
  const resDate = new Date(this.date);
  return (
    resDate.getDate() === today.getDate() &&
    resDate.getMonth() === today.getMonth() &&
    resDate.getFullYear() === today.getFullYear()
  );
});

// Virtual to check if reservation is upcoming
reservationSchema.virtual("isUpcoming").get(function () {
  if (!this.dateTime) return false;
  return (
    this.dateTime > new Date() &&
    !["cancelled", "no-show"].includes(this.status)
  );
});

// Virtual to check if reservation is past
reservationSchema.virtual("isPast").get(function () {
  if (!this.dateTime) return false;
  return this.dateTime < new Date();
});

// ============================================
// INDEXES
// ============================================

reservationSchema.index({ user: 1, date: 1 });
reservationSchema.index({ date: 1, time: 1 });
reservationSchema.index({ status: 1, date: 1 });
reservationSchema.index(
  { confirmationCode: 1 },
  { unique: true, sparse: true }
);
reservationSchema.index({ "contactInfo.email": 1 });
reservationSchema.index({ "contactInfo.phone": 1 });

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save middleware to validate and generate confirmation code
reservationSchema.pre("save", function (next) {
  // Only validate on new reservations or when date/time is modified
  if (this.isNew || this.isModified("date") || this.isModified("time")) {
    try {
      // Combine date and time to create full datetime
      const [hours, minutes] = this.time.split(":").map(Number);
      const reservationDateTime = new Date(this.date);
      reservationDateTime.setHours(hours, minutes, 0, 0);

      const now = new Date();

      // Check if reservation datetime is in the past
      if (reservationDateTime <= now) {
        const error = new Error(
          "Reservation date and time must be in the future"
        );
        error.name = "ValidationError";
        return next(error);
      }

      // Check if reservation is at least 1 hour from now
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      if (reservationDateTime < oneHourFromNow) {
        const error = new Error(
          "Reservations must be made at least 1 hour in advance"
        );
        error.name = "ValidationError";
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  }

  // Generate confirmation code if new reservation
  if (this.isNew && !this.confirmationCode) {
    this.confirmationCode = this.generateConfirmationCode();
  }

  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

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
  // Cannot cancel if already completed, cancelled, or no-show
  if (["completed", "cancelled", "no-show"].includes(this.status)) {
    return false;
  }

  // Allow cancellation up to 2 hours before reservation time
  const reservationDateTime = this.dateTime;
  if (!reservationDateTime) return false;

  const now = new Date();
  const timeDiff = reservationDateTime - now;

  return timeDiff > 2 * 60 * 60 * 1000; // 2 hours in milliseconds
};

// Method to cancel reservation
reservationSchema.methods.cancel = function (reason, cancelledBy) {
  // Check if can be cancelled
  if (!this.canBeCancelled()) {
    const reservationDateTime = this.dateTime;
    const now = new Date();
    const timeDiff = reservationDateTime - now;
    const hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));

    if (["completed", "cancelled", "no-show"].includes(this.status)) {
      throw new Error(`Cannot cancel a ${this.status} reservation`);
    }

    if (timeDiff <= 2 * 60 * 60 * 1000) {
      throw new Error(
        `Cancellation must be made at least 2 hours in advance. Your reservation is in ${hoursUntil} hours.`
      );
    }

    throw new Error("Reservation cannot be cancelled at this time");
  }

  // Ensure contactInfo.name exists for backwards compatibility
  if (!this.contactInfo.name) {
    this.contactInfo.name =
      this.user?.firstName && this.user?.lastName
        ? `${this.user.firstName} ${this.user.lastName}`
        : "Guest";
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

// Method to mark as no-show
reservationSchema.methods.markNoShow = function () {
  if (!["pending", "confirmed"].includes(this.status)) {
    throw new Error(
      "Only pending or confirmed reservations can be marked as no-show"
    );
  }

  this.status = "no-show";
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

// Method to check if reservation can be modified
reservationSchema.methods.canBeModified = function () {
  // Cannot modify if completed, cancelled, or no-show
  if (["completed", "cancelled", "no-show"].includes(this.status)) {
    return false;
  }

  // Allow modification up to 2 hours before reservation time
  const reservationDateTime = this.dateTime;
  if (!reservationDateTime) return false;

  const now = new Date();
  const timeDiff = reservationDateTime - now;

  return timeDiff > 2 * 60 * 60 * 1000; // 2 hours in milliseconds
};

// ============================================
// STATIC METHODS
// ============================================

// Static method to check availability for a specific time slot
reservationSchema.statics.checkAvailability = async function (
  date,
  time,
  partySize
) {
  try {
    // Normalize the date to start of day in UTC
    const reservationDate = new Date(date);
    const startOfDay = new Date(
      Date.UTC(
        reservationDate.getFullYear(),
        reservationDate.getMonth(),
        reservationDate.getDate(),
        0,
        0,
        0,
        0
      )
    );

    const endOfDay = new Date(
      Date.UTC(
        reservationDate.getFullYear(),
        reservationDate.getMonth(),
        reservationDate.getDate(),
        23,
        59,
        59,
        999
      )
    );

    // Get all reservations for that day with active status
    const existingReservations = await this.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $in: ["pending", "confirmed", "seated"] },
    });

    // Get capacity settings
    const Settings = require("./Settings");
    let settings = await Settings.findOne();
    let maxCapacity = 50;
    let diningDuration = 90;
    let blockedDates = [];
    let blockedSlots = new Map();
    let slotCapacityOverrides = new Map();

    if (settings && settings.reservations) {
      maxCapacity = settings.reservations.maxCapacity || 50;
      diningDuration = settings.reservations.diningDuration || 90;
      blockedDates = settings.reservations.blockedDates || [];
      blockedSlots = settings.reservations.blockedSlots || new Map();
      slotCapacityOverrides =
        settings.reservations.slotCapacityOverrides || new Map();
    }

    // Check if date is blocked
    const dateString = new Date(date).toISOString().split("T")[0];
    const isDateBlocked = blockedDates.some(
      (d) => new Date(d).toISOString().split("T")[0] === dateString
    );

    if (isDateBlocked) {
      return {
        available: false,
        remainingCapacity: 0,
        reservedCapacity: 0,
        maxCapacity: 0,
        conflictingReservations: 0,
        message: "This date is blocked for reservations",
        blocked: true,
      };
    }

    // Check if specific slot is blocked
    const blockedTimesForDate = blockedSlots.get(dateString) || [];
    if (blockedTimesForDate.includes(time)) {
      return {
        available: false,
        remainingCapacity: 0,
        reservedCapacity: 0,
        maxCapacity: 0,
        conflictingReservations: 0,
        message: "This time slot is blocked for reservations",
        blocked: true,
      };
    }

    // Check for capacity override for this specific slot
    const slotKey = `${dateString}_${time}`;
    const slotMaxCapacity =
      slotCapacityOverrides.get(slotKey) !== undefined
        ? slotCapacityOverrides.get(slotKey)
        : maxCapacity;

    // Parse the requested time
    const [requestedHours, requestedMinutes] = time.split(":").map(Number);
    const requestedTimeInMinutes = requestedHours * 60 + requestedMinutes;

    // Calculate capacity during the requested time slot
    const reservedCapacity = existingReservations
      .filter((res) => {
        const [resHours, resMinutes] = res.time.split(":").map(Number);
        const resTimeInMinutes = resHours * 60 + resMinutes;
        const timeDiff = Math.abs(resTimeInMinutes - requestedTimeInMinutes);
        return timeDiff < diningDuration; // Within dining window
      })
      .reduce((total, res) => total + res.partySize, 0);

    const isAvailable = reservedCapacity + partySize <= slotMaxCapacity;

    return {
      available: isAvailable,
      remainingCapacity: Math.max(0, slotMaxCapacity - reservedCapacity),
      reservedCapacity,
      maxCapacity: slotMaxCapacity,
      conflictingReservations: existingReservations.filter((res) => {
        const [resHours, resMinutes] = res.time.split(":").map(Number);
        const resTimeInMinutes = resHours * 60 + resMinutes;
        const timeDiff = Math.abs(resTimeInMinutes - requestedTimeInMinutes);
        return timeDiff < diningDuration;
      }).length,
      blocked: false,
    };
  } catch (error) {
    console.error("Error checking availability:", error);
    throw error;
  }
};

// Static method to get reservation statistics
reservationSchema.statics.getStats = async function (startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    matchStage.date = {
      $gte: new Date(
        Date.UTC(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
          0,
          0,
          0,
          0
        )
      ),
      $lte: new Date(
        Date.UTC(
          end.getFullYear(),
          end.getMonth(),
          end.getDate(),
          23,
          59,
          59,
          999
        )
      ),
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalReservations: { $sum: 1 },
        pendingReservations: {
          $sum: {
            $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
          },
        },
        confirmedReservations: {
          $sum: {
            $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0],
          },
        },
        seatedReservations: {
          $sum: {
            $cond: [{ $eq: ["$status", "seated"] }, 1, 0],
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
      pendingReservations: 0,
      confirmedReservations: 0,
      seatedReservations: 0,
      completedReservations: 0,
      cancelledReservations: 0,
      noShowReservations: 0,
      totalGuests: 0,
      averagePartySize: 0,
    }
  );
};

// Static method to get today's reservations
reservationSchema.statics.getTodayReservations = async function () {
  const today = new Date();
  const startOfDay = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
  );

  const endOfDay = new Date(
    Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999
    )
  );

  return this.find({
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  })
    .populate("user", "firstName lastName email phone")
    .sort({ time: 1 });
};

// Static method to get upcoming reservations for a user
reservationSchema.statics.getUserUpcomingReservations = async function (
  userId
) {
  const now = new Date();

  return this.find({
    user: userId,
    date: { $gte: now },
    status: { $in: ["pending", "confirmed"] },
  })
    .sort({ date: 1, time: 1 })
    .limit(10);
};

// Static method to get reservations by date range
reservationSchema.statics.getByDateRange = async function (startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return this.find({
    date: {
      $gte: new Date(
        Date.UTC(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
          0,
          0,
          0,
          0
        )
      ),
      $lte: new Date(
        Date.UTC(
          end.getFullYear(),
          end.getMonth(),
          end.getDate(),
          23,
          59,
          59,
          999
        )
      ),
    },
  })
    .populate("user", "firstName lastName email phone")
    .sort({ date: 1, time: 1 });
};

// Static method to get available time slots for a date
reservationSchema.statics.getAvailableSlots = async function (date, partySize) {
  const operatingHours = {
    start: "11:00", // 11 AM
    end: "21:00", // 9 PM
  };

  const slotInterval = 30; // minutes
  const slots = [];

  // Generate all possible time slots
  let [currentHour, currentMinute] = operatingHours.start
    .split(":")
    .map(Number);
  const [endHour, endMinute] = operatingHours.end.split(":").map(Number);

  while (
    currentHour < endHour ||
    (currentHour === endHour && currentMinute <= endMinute)
  ) {
    const timeSlot = `${String(currentHour).padStart(2, "0")}:${String(
      currentMinute
    ).padStart(2, "0")}`;

    // Check availability for this slot
    const availability = await this.checkAvailability(
      date,
      timeSlot,
      partySize
    );

    slots.push({
      time: timeSlot,
      available: availability.available,
      remainingCapacity: availability.remainingCapacity,
      formattedTime: new Date(
        2000,
        0,
        1,
        currentHour,
        currentMinute
      ).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    });

    // Increment time
    currentMinute += slotInterval;
    if (currentMinute >= 60) {
      currentHour++;
      currentMinute = 0;
    }
  }

  return slots;
};

module.exports = mongoose.model("Reservation", reservationSchema);
