const mongoose = require("mongoose");

const shiftSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee is required"],
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true,
    },
    startTime: {
      type: String, // Format: "HH:MM" (e.g., "09:00")
      required: [true, "Start time is required"],
      validate: {
        validator: function (v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Start time must be in HH:MM format",
      },
    },
    endTime: {
      type: String, // Format: "HH:MM" (e.g., "17:00")
      required: [true, "End time is required"],
      validate: {
        validator: function (v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "End time must be in HH:MM format",
      },
    },
    shiftType: {
      type: String,
      enum: {
        values: ["morning", "afternoon", "evening", "full-day", "split"],
        message: "{VALUE} is not a valid shift type",
      },
      required: [true, "Shift type is required"],
    },
    position: {
      type: String,
      required: [true, "Position is required"],
      enum: [
        "Manager",
        "Assistant Manager",
        "Head Barista",
        "Barista",
        "Kitchen Staff",
        "Social Media Manager",
        "Blog Content Creator",
        "Event Coordinator",
        "Customer Relations Manager",
        "Front of House Staff",
      ],
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: {
        values: [
          "scheduled",
          "in-progress",
          "completed",
          "cancelled",
          "no-show",
        ],
        message: "{VALUE} is not a valid status",
      },
      default: "scheduled",
    },
    actualStartTime: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Actual start time must be in HH:MM format",
      },
    },
    actualEndTime: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Actual end time must be in HH:MM format",
      },
    },
    breakDuration: {
      type: Number, // in minutes
      default: 30,
      min: [0, "Break duration cannot be negative"],
      max: [120, "Break duration cannot exceed 120 minutes"],
    },
    isOvertime: {
      type: Boolean,
      default: false,
    },
    overtimeHours: {
      type: Number,
      default: 0,
      min: [0, "Overtime hours cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
shiftSchema.index({ employee: 1, date: 1 });
shiftSchema.index({ date: 1, status: 1 });

// Virtual for calculating scheduled shift duration (in minutes)
shiftSchema.virtual("scheduledDuration").get(function () {
  if (!this.startTime || !this.endTime) return 0;

  const start = new Date(`2000-01-01 ${this.startTime}`);
  const end = new Date(`2000-01-01 ${this.endTime}`);

  let duration = (end - start) / (1000 * 60); // Convert to minutes

  // Handle overnight shifts
  if (duration < 0) {
    duration += 24 * 60; // Add 24 hours
  }

  return duration - (this.breakDuration || 0);
});

// Virtual for calculating actual shift duration (in minutes)
shiftSchema.virtual("actualDuration").get(function () {
  if (!this.actualStartTime || !this.actualEndTime) return null;

  const start = new Date(`2000-01-01 ${this.actualStartTime}`);
  const end = new Date(`2000-01-01 ${this.actualEndTime}`);

  let duration = (end - start) / (1000 * 60);

  // Handle overnight shifts
  if (duration < 0) {
    duration += 24 * 60;
  }

  return duration - (this.breakDuration || 0);
});

// Virtual for formatted date
shiftSchema.virtual("formattedDate").get(function () {
  return this.date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Pre-save middleware to determine shift type automatically
shiftSchema.pre("save", function (next) {
  if (!this.shiftType) {
    const startHour = parseInt(this.startTime.split(":")[0]);
    const endHour = parseInt(this.endTime.split(":")[0]);
    const duration = this.scheduledDuration / 60; // in hours

    if (duration >= 8) {
      this.shiftType = "full-day";
    } else if (startHour < 12) {
      this.shiftType = "morning";
    } else if (startHour < 17) {
      this.shiftType = "afternoon";
    } else {
      this.shiftType = "evening";
    }
  }

  next();
});

// Pre-save middleware to calculate overtime
shiftSchema.pre("save", function (next) {
  if (this.actualDuration) {
    const regularHours = 8 * 60; // 8 hours in minutes
    if (this.actualDuration > regularHours) {
      this.isOvertime = true;
      this.overtimeHours = (this.actualDuration - regularHours) / 60;
    }
  }

  next();
});

// Instance method to check if shift conflicts with another shift
shiftSchema.methods.conflictsWith = function (otherShift) {
  // Same date check
  if (this.date.toDateString() !== otherShift.date.toDateString()) {
    return false;
  }

  // Same employee check
  if (this.employee.toString() !== otherShift.employee.toString()) {
    return false;
  }

  // Time overlap check
  const thisStart = this.startTime;
  const thisEnd = this.endTime;
  const otherStart = otherShift.startTime;
  const otherEnd = otherShift.endTime;

  return (
    (thisStart >= otherStart && thisStart < otherEnd) ||
    (thisEnd > otherStart && thisEnd <= otherEnd) ||
    (thisStart <= otherStart && thisEnd >= otherEnd)
  );
};

// Static method to get shifts for a date range
shiftSchema.statics.getShiftsByDateRange = function (
  startDate,
  endDate,
  options = {}
) {
  const query = {
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (options.employeeId) {
    query.employee = options.employeeId;
  }

  if (options.status) {
    query.status = options.status;
  }

  if (options.shiftType) {
    query.shiftType = options.shiftType;
  }

  return this.find(query)
    .populate("employee", "name email phone position department profileImage")
    .sort({ date: 1, startTime: 1 });
};

// Static method to check for conflicts
shiftSchema.statics.checkConflicts = async function (
  employeeId,
  date,
  startTime,
  endTime,
  excludeShiftId = null
) {
  const query = {
    employee: employeeId,
    date: new Date(date),
    status: { $in: ["scheduled", "in-progress"] },
  };

  if (excludeShiftId) {
    query._id = { $ne: excludeShiftId };
  }

  const existingShifts = await this.find(query);

  const conflicts = existingShifts.filter((shift) => {
    return (
      (startTime >= shift.startTime && startTime < shift.endTime) ||
      (endTime > shift.startTime && endTime <= shift.endTime) ||
      (startTime <= shift.startTime && endTime >= shift.endTime)
    );
  });

  return conflicts;
};

// Enable virtuals in JSON
shiftSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  },
});

shiftSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Shift", shiftSchema);
