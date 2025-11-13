const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    position: {
      type: String,
      required: [true, "Position is required"],
      enum: ["Manager", "Barista", "Chef", "Waiter", "Cashier", "Cleaner"],
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      enum: ["Kitchen", "Service", "Management", "Cleaning"],
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    hireDate: {
      type: Date,
      default: Date.now,
    },
    salary: {
      type: Number,
      required: [true, "Salary is required"],
      min: 0,
    },
    status: {
      type: String,
      enum: ["Active", "On Leave", "Terminated"],
      default: "Active",
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    shifts: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },
        startTime: String,
        endTime: String,
      },
    ],
    profileImage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Generate employee ID before saving
employeeSchema.pre("save", async function (next) {
  if (!this.employeeId) {
    const count = await mongoose.model("Employee").countDocuments();
    this.employeeId = `EMP${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Virtual for full name
employeeSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model("Employee", employeeSchema);
