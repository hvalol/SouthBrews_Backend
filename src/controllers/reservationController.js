const Reservation = require("../models/Reservation");
const User = require("../models/User");
const emailService = require("../utils/emailService");

// @desc    Create new reservation
// @route   POST /api/reservations
// @access  Private
const createReservation = async (req, res, next) => {
  try {
    const {
      date,
      time,
      partySize,
      specialRequests,
      occasion,
      preferences,
      contactInfo,
    } = req.body;

    // Combine date and time for validation
    const [hours, minutes] = time.split(":").map(Number);
    const reservationDateTime = new Date(date);
    reservationDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();

    // Check if reservation datetime is in the future
    if (reservationDateTime <= now) {
      return res.status(400).json({
        status: "error",
        message: "Reservation date and time must be in the future",
        errors: [
          {
            field: "dateTime",
            message: `Please select a future date and time. Current time: ${now.toLocaleString()}`,
          },
        ],
      });
    }

    // Check if reservation is at least 1 hour from now
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    if (reservationDateTime < oneHourFromNow) {
      return res.status(400).json({
        status: "error",
        message: "Reservations must be made at least 1 hour in advance",
        errors: [
          {
            field: "dateTime",
            message: `Please select a time at least 1 hour from now. Current time: ${now.toLocaleString()}`,
          },
        ],
      });
    }

    // Check availability for the requested time slot
    const availabilityResult = await Reservation.checkAvailability(
      new Date(date),
      time,
      partySize
    );

    if (!availabilityResult.available) {
      return res.status(400).json({
        status: "error",
        message: "The requested time slot is not available",
        data: {
          availabilityResult,
          suggestion: "Please choose a different time or party size",
        },
      });
    }

    // Create reservation
    const reservation = await Reservation.create({
      user: req.user?.id, // Optional for guest reservations
      date: new Date(date),
      time,
      partySize,
      specialRequests,
      occasion,
      preferences,
      contactInfo: {
        name:
          contactInfo.name ||
          (req.user ? `${req.user.firstName} ${req.user.lastName}` : ""),
        phone: contactInfo.phone || req.user?.phone,
        email: contactInfo.email || req.user?.email,
      },
    });

    // Populate user info if available
    if (req.user) {
      await reservation.populate("user", "firstName lastName email phone");

      // Add loyalty points for making reservation
      const user = await User.findById(req.user.id);
      if (user) {
        await user.addLoyaltyPoints(10);
      }
    }

    // Send confirmation email
    try {
      await emailService.sendReservationConfirmation(reservation);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the reservation if email fails
    }

    res.status(201).json({
      status: "success",
      message: req.user
        ? "Reservation created successfully! You earned 10 loyalty points."
        : "Reservation created successfully!",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Create reservation error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: error.message || "Validation failed",
        errors: Object.values(error.errors || {}).map((err) => ({
          field: err.path,
          message: err.message,
        })),
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to create reservation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get user's reservations
// @route   GET /api/reservations/my-reservations
// @access  Private
const getMyReservations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10, upcoming = false } = req.query;

    let query = { user: req.user.id };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter for upcoming reservations only
    if (upcoming === "true") {
      const now = new Date();
      query.date = { $gte: now };
      query.status = { $in: ["pending", "confirmed"] };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Reservation.countDocuments(query);
    const reservations = await Reservation.find(query)
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      status: "success",
      data: {
        reservations,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get my reservations error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch reservations",
    });
  }
};

// @desc    Get single reservation
// @route   GET /api/reservations/:id
// @access  Private
const getReservation = async (req, res, next) => {
  try {
    let query = { _id: req.params.id };

    // Non-admin users can only see their own reservations
    if (req.user.role === "customer") {
      query.user = req.user.id;
    }

    const reservation = await Reservation.findOne(query)
      .populate("user", "firstName lastName email phone")
      .populate("cancelledBy", "firstName lastName")
      .populate("notes.addedBy", "firstName lastName");

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Get reservation error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch reservation",
    });
  }
};

// @desc    Update reservation
// @route   PUT /api/reservations/:id
// @access  Private
const updateReservation = async (req, res, next) => {
  try {
    let query = { _id: req.params.id };

    // Non-admin users can only update their own reservations
    if (req.user.role === "customer") {
      query.user = req.user.id;
    }

    let reservation = await Reservation.findOne(query);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    // Check if reservation can be modified
    if (["completed", "cancelled", "no-show"].includes(reservation.status)) {
      return res.status(400).json({
        status: "error",
        message: "Cannot modify a completed, cancelled, or no-show reservation",
      });
    }

    // If date/time is being changed, check availability
    if (req.body.date || req.body.time) {
      const newDate = req.body.date
        ? new Date(req.body.date)
        : reservation.date;
      const newTime = req.body.time || reservation.time;
      const newPartySize = req.body.partySize || reservation.partySize;

      // Skip availability check for the current reservation
      const isAvailable = await Reservation.checkAvailability(
        newDate,
        newTime,
        newPartySize
      );

      if (!isAvailable) {
        return res.status(400).json({
          status: "error",
          message: "The requested time slot is not available",
        });
      }
    }

    // Update reservation
    const allowedUpdates = [
      "date",
      "time",
      "partySize",
      "specialRequests",
      "occasion",
      "preferences",
      "contactInfo",
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    reservation = await Reservation.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("user", "firstName lastName email phone");

    res.status(200).json({
      status: "success",
      message: "Reservation updated successfully",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Update reservation error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update reservation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Cancel reservation
// @route   PATCH /api/reservations/:id/cancel
// @access  Private
const cancelReservation = async (req, res, next) => {
  try {
    const { reason } = req.body;

    let query = { _id: req.params.id };

    // Non-admin users can only cancel their own reservations
    if (req.user.role === "customer") {
      query.user = req.user.id;
    }

    const reservation = await Reservation.findOne(query);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    // Populate user for email
    await reservation.populate("user", "firstName lastName email phone");

    // Ensure contactInfo.name exists for backwards compatibility
    if (!reservation.contactInfo.name) {
      reservation.contactInfo.name =
        reservation.user?.firstName && reservation.user?.lastName
          ? `${reservation.user.firstName} ${reservation.user.lastName}`
          : "Guest";
    }

    // Use the model method to cancel
    await reservation.cancel(reason, req.user.id);

    // Send cancellation email
    try {
      await emailService.sendReservationCancellation(reservation);
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError);
      // Don't fail the cancellation if email fails
    }

    res.status(200).json({
      status: "success",
      message: "Reservation cancelled successfully",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Cancel reservation error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: "error",
        message: messages.join(", "),
      });
    }

    // Return specific error messages
    if (error.message) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to cancel reservation",
    });
  }
};

// @desc    Confirm reservation (Staff/Admin only)
// @route   PATCH /api/reservations/:id/confirm
// @access  Private (Staff/Admin)
const confirmReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    await reservation.confirm();

    res.status(200).json({
      status: "success",
      message: "Reservation confirmed successfully",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Confirm reservation error:", error);

    if (error.message.includes("Only pending reservations")) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to confirm reservation",
    });
  }
};

// @desc    Check in customer (Staff/Admin only)
// @route   PATCH /api/reservations/:id/checkin
// @access  Private (Staff/Admin)
const checkInReservation = async (req, res, next) => {
  try {
    const { tableNumber } = req.body;

    if (!tableNumber) {
      return res.status(400).json({
        status: "error",
        message: "Table number is required for check-in",
      });
    }

    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    await reservation.checkIn(tableNumber);

    res.status(200).json({
      status: "success",
      message: "Customer checked in successfully",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Check in reservation error:", error);

    if (error.message.includes("Only confirmed reservations")) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to check in reservation",
    });
  }
};

// @desc    Complete reservation (Staff/Admin only)
// @route   PATCH /api/reservations/:id/complete
// @access  Private (Staff/Admin)
const completeReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    await reservation.complete();

    // Award loyalty points for completing reservation (20 points per reservation)
    const user = await User.findById(reservation.user);
    if (user) {
      await user.addLoyaltyPoints(
        20,
        "reservation",
        `Reservation completed on ${reservation.formattedDate}`,
        reservation._id
      );

      // Update total reservations count
      user.totalReservations = (user.totalReservations || 0) + 1;
      await user.save();
    }

    res.status(200).json({
      status: "success",
      message: "Reservation completed successfully. 20 loyalty points awarded!",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Complete reservation error:", error);

    if (error.message.includes("Only seated reservations")) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to complete reservation",
    });
  }
};

// @desc    Add note to reservation (Staff/Admin only)
// @route   POST /api/reservations/:id/notes
// @access  Private (Staff/Admin)
const addReservationNote = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Note content is required",
      });
    }

    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    await reservation.addNote(content, req.user.id);

    res.status(200).json({
      status: "success",
      message: "Note added successfully",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Add reservation note error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to add note",
    });
  }
};

// @desc    Get all reservations (Staff/Admin only)
// @route   GET /api/reservations
// @access  Private (Staff/Admin)
const getAllReservations = async (req, res, next) => {
  try {
    const {
      status,
      date,
      tableNumber,
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate,
    } = req.query;

    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by specific date (improved)
    if (date) {
      const searchDate = new Date(date);
      // Create start and end of day in UTC to avoid timezone issues
      const startOfDay = new Date(
        Date.UTC(
          searchDate.getFullYear(),
          searchDate.getMonth(),
          searchDate.getDate(),
          0,
          0,
          0,
          0
        )
      );
      const endOfDay = new Date(
        Date.UTC(
          searchDate.getFullYear(),
          searchDate.getMonth(),
          searchDate.getDate(),
          23,
          59,
          59,
          999
        )
      );

      query.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // Filter by date range (for calendar view)
    if (startDate && endDate && !date) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      query.date = {
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

    // Filter by table number
    if (tableNumber) {
      query.tableNumber = parseInt(tableNumber, 10);
    }

    // Search by customer info
    if (search) {
      query.$or = [
        { "contactInfo.phone": { $regex: search, $options: "i" } },
        { "contactInfo.email": { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Reservation.countDocuments(query);
    const reservations = await Reservation.find(query)
      .populate("user", "firstName lastName email phone")
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(); // Use lean for better performance

    // Add dateString to each reservation for frontend consistency
    const reservationsWithDateString = reservations.map((res) => {
      const d = new Date(res.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      return {
        ...res,
        dateString: `${year}-${month}-${day}`,
      };
    });

    res.status(200).json({
      status: "success",
      data: {
        reservations: reservationsWithDateString,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get all reservations error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch reservations",
    });
  }
};

// @desc    Check availability for time slot
// @route   POST /api/reservations/check-availability
// @access  Public
const checkAvailability = async (req, res, next) => {
  try {
    const { date, time, partySize } = req.body;

    if (!date || !time || !partySize) {
      return res.status(400).json({
        status: "error",
        message: "Date, time, and party size are required",
      });
    }

    const isAvailable = await Reservation.checkAvailability(
      new Date(date),
      time,
      parseInt(partySize, 10)
    );

    res.status(200).json({
      status: "success",
      data: {
        available: isAvailable,
        date,
        time,
        partySize,
      },
    });
  } catch (error) {
    console.error("Check availability error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to check availability",
    });
  }
};

// @desc    Get reservation statistics (Admin only)
// @route   GET /api/reservations/stats
// @access  Private (Admin)
const getReservationStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await Reservation.getStats(startDate, endDate);

    res.status(200).json({
      status: "success",
      data: {
        stats,
      },
    });
  } catch (error) {
    console.error("Get reservation stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch reservation statistics",
    });
  }
};

// @desc    Send reminder email for reservation
// @route   POST /api/reservations/:id/send-reminder
// @access  Private/Admin/Staff
const sendReminderEmail = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    // Check if reservation is in valid status
    if (!["pending", "confirmed"].includes(reservation.status)) {
      return res.status(400).json({
        status: "error",
        message: `Cannot send reminder for ${reservation.status} reservation`,
      });
    }

    // Check if reservation is in the future
    const reservationDateTime = new Date(
      `${reservation.date.toISOString().split("T")[0]}T${reservation.time}`
    );
    if (reservationDateTime < new Date()) {
      return res.status(400).json({
        status: "error",
        message: "Cannot send reminder for past reservation",
      });
    }

    // Send reminder email
    await emailService.sendReservationReminder(reservation);

    res.status(200).json({
      status: "success",
      message: "Reminder email sent successfully",
    });
  } catch (error) {
    console.error("Send reminder email error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send reminder email",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Mark reservation as no-show
// @route   PATCH /api/reservations/:id/no-show
// @access  Private/Admin/Staff
const markNoShow = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    // Can only mark confirmed or seated reservations as no-show
    if (!["confirmed", "seated"].includes(reservation.status)) {
      return res.status(400).json({
        status: "error",
        message: `Cannot mark ${reservation.status} reservation as no-show`,
      });
    }

    reservation.status = "no-show";
    reservation.notes.push({
      content: `Marked as no-show by ${req.user.role}`,
      addedBy: req.user.id,
    });

    await reservation.save();
    await reservation.populate("user", "firstName lastName email phone");

    res.status(200).json({
      status: "success",
      message: "Reservation marked as no-show",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Mark no-show error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to mark reservation as no-show",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get today's reservations
// @route   GET /api/reservations/today
// @access  Private/Admin/Staff
const getTodayReservations = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const reservations = await Reservation.find({
      date: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .populate("user", "firstName lastName email phone")
      .sort({ time: 1 });

    const stats = {
      total: reservations.length,
      pending: reservations.filter((r) => r.status === "pending").length,
      confirmed: reservations.filter((r) => r.status === "confirmed").length,
      seated: reservations.filter((r) => r.status === "seated").length,
      completed: reservations.filter((r) => r.status === "completed").length,
      cancelled: reservations.filter((r) => r.status === "cancelled").length,
      noShow: reservations.filter((r) => r.status === "no-show").length,
    };

    res.status(200).json({
      status: "success",
      data: {
        reservations,
        stats,
        date: today.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Get today's reservations error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch today's reservations",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get available time slots for a date
// @route   GET /api/reservations/available-slots
// @access  Public
const getAvailableSlots = async (req, res, next) => {
  try {
    const { date, partySize } = req.query;

    if (!date || !partySize) {
      return res.status(400).json({
        status: "error",
        message: "Date and party size are required",
      });
    }

    const requestedDate = new Date(date);
    const size = parseInt(partySize);

    // Define available time slots (customize as needed)
    const allSlots = [
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
    ];

    // Check availability for each slot
    const availableSlots = [];
    for (const slot of allSlots) {
      const isAvailable = await Reservation.checkAvailability(
        requestedDate,
        slot,
        size
      );
      if (isAvailable) {
        availableSlots.push(slot);
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        date: date,
        partySize: size,
        availableSlots,
        totalSlots: allSlots.length,
        availableCount: availableSlots.length,
      },
    });
  } catch (error) {
    console.error("Get available slots error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch available slots",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Export reservations to CSV (Admin only)
// @route   GET /api/reservations/export/csv
// @access  Private (Admin)
const exportReservationsCSV = async (req, res, next) => {
  try {
    const { status, date, startDate, endDate } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (date) {
      const searchDate = new Date(date);
      const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
      query.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const reservations = await Reservation.find(query)
      .populate("user", "firstName lastName email phone")
      .sort({ date: 1, time: 1 });

    // Create CSV headers
    const headers = [
      "Reservation ID",
      "Customer Name",
      "Email",
      "Phone",
      "Date",
      "Time",
      "Party Size",
      "Status",
      "Occasion",
      "Table Number",
      "Special Requests",
      "Created At",
    ];

    // Helper function to format date for CSV (short format)
    const formatDateForCSV = (date) => {
      const d = new Date(date);
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const year = d.getFullYear();
      return `${month}/${day}/${year}`; // MM/DD/YYYY format
    };

    // Helper function to format datetime for CSV
    const formatDateTimeForCSV = (date) => {
      const d = new Date(date);
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${month}/${day}/${year} ${hours}:${minutes}`; // MM/DD/YYYY HH:MM
    };

    // Helper function to escape CSV fields
    const escapeCSVField = (field) => {
      if (field === null || field === undefined) return "";
      const str = String(field);
      // If field contains comma, newline, or quotes, wrap in quotes and escape existing quotes
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Create CSV rows
    const rows = reservations.map((res) => {
      const customerName = res.user
        ? `${res.user.firstName} ${res.user.lastName}`
        : res.contactInfo.email;

      return [
        res._id.toString().substring(0, 8).toUpperCase(), // Short ID
        escapeCSVField(customerName),
        escapeCSVField(res.contactInfo.email),
        escapeCSVField(res.contactInfo.phone),
        formatDateForCSV(res.date), // Fixed date format
        escapeCSVField(res.time),
        res.partySize,
        escapeCSVField(res.status),
        escapeCSVField(res.occasion || "N/A"),
        res.tableNumber || "N/A",
        escapeCSVField(res.specialRequests || "N/A"),
        formatDateTimeForCSV(res.createdAt), // Fixed datetime format
      ].join(",");
    });

    // Convert to CSV string
    const csvContent = [headers.join(","), ...rows].join("\n");

    // Set headers for file download
    const filename = `reservations-${
      new Date().toISOString().split("T")[0]
    }.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Add UTF-8 BOM for Excel compatibility
    const BOM = "\uFEFF";
    res.status(200).send(BOM + csvContent);
  } catch (error) {
    console.error("Export CSV error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to export reservations",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Delete reservation (Admin only - for completed/cancelled reservations)
// @route   DELETE /api/reservations/:id
// @access  Private (Admin only)
const deleteReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: "error",
        message: "Reservation not found",
      });
    }

    // Only allow deletion of completed, cancelled, or no-show reservations
    if (!["completed", "cancelled", "no-show"].includes(reservation.status)) {
      return res.status(400).json({
        status: "error",
        message: `Cannot delete ${reservation.status} reservations. Only completed, cancelled, or no-show reservations can be deleted.`,
      });
    }

    await Reservation.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: "success",
      message: "Reservation deleted successfully",
    });
  } catch (error) {
    console.error("Delete reservation error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: "error",
        message: messages.join(", "),
      });
    }

    // Handle CastError (invalid ID format)
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid reservation ID format",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to delete reservation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = {
  createReservation,
  getMyReservations,
  getReservation,
  updateReservation,
  cancelReservation,
  confirmReservation,
  checkInReservation,
  completeReservation,
  addReservationNote,
  getAllReservations,
  checkAvailability,
  getReservationStats,
  sendReminderEmail,
  markNoShow,
  getTodayReservations,
  getAvailableSlots,
  exportReservationsCSV,
  deleteReservation,
};
