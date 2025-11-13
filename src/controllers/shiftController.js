const Shift = require("../models/Shift");
const Employee = require("../models/Employee");

/**
 * @desc    Create a new shift
 * @route   POST /api/shifts
 * @access  Private/Admin
 */
exports.createShift = async (req, res) => {
  try {
    const {
      employee,
      date,
      startTime,
      endTime,
      shiftType,
      position,
      notes,
      breakDuration,
    } = req.body;

    // Validate employee exists
    const employeeExists = await Employee.findById(employee);
    if (!employeeExists) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check for scheduling conflicts
    const conflicts = await Shift.checkConflicts(
      employee,
      date,
      startTime,
      endTime
    );

    if (conflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Shift conflicts with existing schedule",
        conflicts: conflicts.map((shift) => ({
          id: shift._id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
        })),
      });
    }

    // Create shift
    const shift = await Shift.create({
      employee,
      date,
      startTime,
      endTime,
      shiftType,
      position,
      notes,
      breakDuration,
    });

    // Populate employee data
    await shift.populate(
      "employee",
      "name email phone position department profileImage"
    );

    res.status(201).json({
      success: true,
      message: "Shift created successfully",
      data: shift,
    });
  } catch (error) {
    console.error("Create shift error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create shift",
    });
  }
};

/**
 * @desc    Get all shifts with filters
 * @route   GET /api/shifts
 * @access  Private/Admin
 */
exports.getShifts = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      employeeId,
      status,
      shiftType,
      position,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    // Date range filter
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }

    // Other filters
    if (employeeId) query.employee = employeeId;
    if (status) query.status = status;
    if (shiftType) query.shiftType = shiftType;
    if (position) query.position = position;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const shifts = await Shift.find(query)
      .populate("employee", "name email phone position department profileImage")
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Shift.countDocuments(query);

    res.json({
      success: true,
      data: shifts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get shifts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shifts",
    });
  }
};

/**
 * @desc    Get single shift by ID
 * @route   GET /api/shifts/:id
 * @access  Private/Admin
 */
exports.getShiftById = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate(
      "employee",
      "name email phone position department profileImage"
    );

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    res.json({
      success: true,
      data: shift,
    });
  } catch (error) {
    console.error("Get shift by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shift",
    });
  }
};

/**
 * @desc    Get employee schedule
 * @route   GET /api/shifts/employee/:employeeId
 * @access  Private/Admin
 */
exports.getEmployeeSchedule = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, status } = req.query;

    // Validate employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const query = { employee: employeeId };

    // Date range
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const shifts = await Shift.find(query).sort({ date: 1, startTime: 1 });

    // Calculate statistics
    const totalShifts = shifts.length;
    const totalScheduledHours = shifts.reduce((sum, shift) => {
      return sum + shift.scheduledDuration / 60;
    }, 0);

    const completedShifts = shifts.filter((s) => s.status === "completed");
    const totalActualHours = completedShifts.reduce((sum, shift) => {
      return sum + (shift.actualDuration || 0) / 60;
    }, 0);

    const totalOvertimeHours = shifts.reduce((sum, shift) => {
      return sum + (shift.overtimeHours || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          name: employee.name,
          position: employee.position,
          department: employee.department,
        },
        shifts,
        statistics: {
          totalShifts,
          totalScheduledHours: totalScheduledHours.toFixed(2),
          totalActualHours: totalActualHours.toFixed(2),
          totalOvertimeHours: totalOvertimeHours.toFixed(2),
          averageHoursPerShift:
            totalShifts > 0
              ? (totalScheduledHours / totalShifts).toFixed(2)
              : "0.00",
          completionRate:
            totalShifts > 0
              ? ((completedShifts.length / totalShifts) * 100).toFixed(1)
              : "0.0",
        },
      },
    });
  } catch (error) {
    console.error("Get employee schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee schedule",
    });
  }
};

/**
 * @desc    Update shift
 * @route   PUT /api/shifts/:id
 * @access  Private/Admin
 */
exports.updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find existing shift
    const shift = await Shift.findById(id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    // If updating time or date, check for conflicts
    if (updates.date || updates.startTime || updates.endTime) {
      const checkDate = updates.date || shift.date;
      const checkStart = updates.startTime || shift.startTime;
      const checkEnd = updates.endTime || shift.endTime;
      const checkEmployee = updates.employee || shift.employee;

      const conflicts = await Shift.checkConflicts(
        checkEmployee,
        checkDate,
        checkStart,
        checkEnd,
        id
      );

      if (conflicts.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Updated shift conflicts with existing schedule",
          conflicts: conflicts.map((s) => ({
            id: s._id,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }
    }

    // Update shift
    const updatedShift = await Shift.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate(
      "employee",
      "name email phone position department profileImage"
    );

    res.json({
      success: true,
      message: "Shift updated successfully",
      data: updatedShift,
    });
  } catch (error) {
    console.error("Update shift error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update shift",
    });
  }
};

/**
 * @desc    Delete shift
 * @route   DELETE /api/shifts/:id
 * @access  Private/Admin
 */
exports.deleteShift = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    // Prevent deletion of in-progress or completed shifts
    if (shift.status === "in-progress" || shift.status === "completed") {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${shift.status} shifts. Cancel the shift instead.`,
      });
    }

    await Shift.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Shift deleted successfully",
    });
  } catch (error) {
    console.error("Delete shift error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete shift",
    });
  }
};

/**
 * @desc    Check for scheduling conflicts
 * @route   POST /api/shifts/check-conflicts
 * @access  Private/Admin
 */
exports.checkConflicts = async (req, res) => {
  try {
    const { employeeId, date, startTime, endTime, excludeShiftId } = req.body;

    if (!employeeId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Employee ID, date, start time, and end time are required",
      });
    }

    const conflicts = await Shift.checkConflicts(
      employeeId,
      date,
      startTime,
      endTime,
      excludeShiftId
    );

    res.json({
      success: true,
      hasConflict: conflicts.length > 0,
      conflicts: conflicts.map((shift) => ({
        id: shift._id,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        shiftType: shift.shiftType,
        position: shift.position,
      })),
    });
  } catch (error) {
    console.error("Check conflicts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check conflicts",
    });
  }
};

/**
 * @desc    Clock in to shift
 * @route   POST /api/shifts/:id/clock-in
 * @access  Private/Admin
 */
exports.clockIn = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    if (shift.status !== "scheduled") {
      return res.status(400).json({
        success: false,
        message: `Cannot clock in to ${shift.status} shift`,
      });
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    shift.actualStartTime = currentTime;
    shift.status = "in-progress";
    await shift.save();

    await shift.populate(
      "employee",
      "name email phone position department profileImage"
    );

    res.json({
      success: true,
      message: "Clocked in successfully",
      data: shift,
    });
  } catch (error) {
    console.error("Clock in error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clock in",
    });
  }
};

/**
 * @desc    Clock out from shift
 * @route   POST /api/shifts/:id/clock-out
 * @access  Private/Admin
 */
exports.clockOut = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    if (shift.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: `Cannot clock out from ${shift.status} shift`,
      });
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    shift.actualEndTime = currentTime;
    shift.status = "completed";
    await shift.save();

    await shift.populate(
      "employee",
      "name email phone position department profileImage"
    );

    res.json({
      success: true,
      message: "Clocked out successfully",
      data: shift,
    });
  } catch (error) {
    console.error("Clock out error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clock out",
    });
  }
};

/**
 * @desc    Get shifts summary/statistics
 * @route   GET /api/shifts/summary
 * @access  Private/Admin
 */
exports.getShiftsSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const shifts = await Shift.find(query);

    const summary = {
      totalShifts: shifts.length,
      byStatus: {
        scheduled: shifts.filter((s) => s.status === "scheduled").length,
        inProgress: shifts.filter((s) => s.status === "in-progress").length,
        completed: shifts.filter((s) => s.status === "completed").length,
        cancelled: shifts.filter((s) => s.status === "cancelled").length,
        noShow: shifts.filter((s) => s.status === "no-show").length,
      },
      byShiftType: {
        morning: shifts.filter((s) => s.shiftType === "morning").length,
        afternoon: shifts.filter((s) => s.shiftType === "afternoon").length,
        evening: shifts.filter((s) => s.shiftType === "evening").length,
        fullDay: shifts.filter((s) => s.shiftType === "full-day").length,
      },
      totalScheduledHours: shifts
        .reduce((sum, shift) => {
          return sum + shift.scheduledDuration / 60;
        }, 0)
        .toFixed(2),
      totalOvertimeHours: shifts
        .reduce((sum, shift) => {
          return sum + (shift.overtimeHours || 0);
        }, 0)
        .toFixed(2),
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get shifts summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shifts summary",
    });
  }
};
