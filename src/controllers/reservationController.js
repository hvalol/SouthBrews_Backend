const Reservation = require("../models/Reservation");
const User = require("../models/User");

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

    // Check availability for the requested time slot
    const isAvailable = await Reservation.checkAvailability(
      new Date(date),
      time,
      partySize
    );

    if (!isAvailable) {
      return res.status(400).json({
        status: "error",
        message:
          "The requested time slot is not available. Please choose a different time.",
      });
    }

    // Create reservation
    const reservation = await Reservation.create({
      user: req.user.id,
      date: new Date(date),
      time,
      partySize,
      specialRequests,
      occasion,
      preferences,
      contactInfo: {
        phone: contactInfo.phone || req.user.phone,
        email: contactInfo.email || req.user.email,
      },
    });

    // Populate user info
    await reservation.populate("user", "firstName lastName email phone");

    // Add loyalty points for making reservation
    const user = await User.findById(req.user.id);
    await user.addLoyaltyPoints(10);

    res.status(201).json({
      status: "success",
      message:
        "Reservation created successfully! You earned 10 loyalty points.",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Create reservation error:", error);
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

    // Use the model method to cancel
    await reservation.cancel(reason, req.user.id);

    res.status(200).json({
      status: "success",
      message: "Reservation cancelled successfully",
      data: {
        reservation,
      },
    });
  } catch (error) {
    console.error("Cancel reservation error:", error);

    if (error.message.includes("cannot be cancelled")) {
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

    // Award loyalty points for completing reservation
    const user = await User.findById(reservation.user);
    await user.addLoyaltyPoints(20);

    res.status(200).json({
      status: "success",
      message: "Reservation completed successfully",
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
    } = req.query;

    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date
    if (date) {
      const searchDate = new Date(date);
      const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
      query.date = {
        $gte: startOfDay,
        $lte: endOfDay,
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
};
