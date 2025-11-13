const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const cloudinary = require("../config/cloudinary");

/**
 * @desc    Get all employees with optional filters
 * @route   GET /api/employees
 * @access  Private/Admin
 */
exports.getAllEmployees = async (req, res) => {
  try {
    const {
      department,
      position,
      status,
      search,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Build query
    const query = {};

    if (department) query.department = department;
    if (position) query.position = position;
    if (status) query.status = status;

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const employees = await Employee.find(query)
      .sort({ [sortBy]: order === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-__v");

    // Get total count for pagination
    const total = await Employee.countDocuments(query);

    res.json({
      success: true,
      count: employees.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: employees,
    });
  } catch (error) {
    console.error("Get all employees error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message,
    });
  }
};

/**
 * @desc    Get single employee by ID
 * @route   GET /api/employees/:id
 * @access  Private/Admin
 */
exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select("-__v");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Get employee error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee",
      error: error.message,
    });
  }
};

/**
 * @desc    Get employee with shifts
 * @route   GET /api/employees/:id/with-shifts
 * @access  Private/Admin
 */
exports.getEmployeeWithShifts = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, status } = req.query;

    // Get employee
    const employee = await Employee.findById(id).select("-__v");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Build shift query
    const shiftQuery = { employee: id };

    // Date range filter
    if (startDate && endDate) {
      shiftQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      shiftQuery.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      shiftQuery.date = { $lte: new Date(endDate) };
    }

    // Status filter
    if (status) {
      shiftQuery.status = status;
    }

    // Get shifts
    const shifts = await Shift.find(shiftQuery)
      .sort({ date: 1, startTime: 1 })
      .select("-__v");

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

    const upcomingShifts = shifts.filter(
      (s) => s.status === "scheduled" && new Date(s.date) >= new Date()
    ).length;

    res.json({
      success: true,
      data: {
        employee,
        shifts,
        statistics: {
          totalShifts,
          totalScheduledHours: parseFloat(totalScheduledHours.toFixed(2)),
          totalActualHours: parseFloat(totalActualHours.toFixed(2)),
          totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
          averageHoursPerShift:
            totalShifts > 0
              ? parseFloat((totalScheduledHours / totalShifts).toFixed(2))
              : 0,
          completionRate:
            totalShifts > 0
              ? parseFloat(
                  ((completedShifts.length / totalShifts) * 100).toFixed(1)
                )
              : 0,
          upcomingShifts,
        },
      },
    });
  } catch (error) {
    console.error("Get employee with shifts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee with shifts",
      error: error.message,
    });
  }
};

/**
 * @desc    Create new employee
 * @route   POST /api/employees
 * @access  Private/Admin
 */
exports.createEmployee = async (req, res) => {
  try {
    const employeeData = { ...req.body };

    // Check if email already exists
    const existingEmployee = await Employee.findOne({
      email: employeeData.email,
    });

    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // Handle profile image upload
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "southbrews/employees",
          transformation: [
            { width: 500, height: 500, crop: "fill" },
            { quality: "auto" },
          ],
        });
        employeeData.profileImage = result.secure_url;
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile image",
          error: uploadError.message,
        });
      }
    }

    // Create employee
    const employee = await Employee.create(employeeData);

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: employee,
    });
  } catch (error) {
    console.error("Create employee error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create employee",
      error: error.message,
    });
  }
};

/**
 * @desc    Update employee
 * @route   PUT /api/employees/:id
 * @access  Private/Admin
 */
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if email is being changed and if it already exists
    if (req.body.email && req.body.email !== employee.email) {
      const existingEmployee = await Employee.findOne({
        email: req.body.email,
      });
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    const updateData = { ...req.body };

    // Handle profile image upload
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (employee.profileImage) {
          const publicId = employee.profileImage.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`southbrews/employees/${publicId}`);
        }

        // Upload new image
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "southbrews/employees",
          transformation: [
            { width: 500, height: 500, crop: "fill" },
            { quality: "auto" },
          ],
        });
        updateData.profileImage = result.secure_url;
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile image",
          error: uploadError.message,
        });
      }
    }

    // Update employee
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-__v");

    res.json({
      success: true,
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Update employee error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update employee",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete employee
 * @route   DELETE /api/employees/:id
 * @access  Private/Admin
 */
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if employee has any future shifts
    const futureShifts = await Shift.countDocuments({
      employee: req.params.id,
      date: { $gte: new Date() },
      status: { $in: ["scheduled", "in-progress"] },
    });

    if (futureShifts > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete employee with ${futureShifts} upcoming shift(s). Please cancel or reassign shifts first.`,
      });
    }

    // Delete profile image from Cloudinary if exists
    if (employee.profileImage) {
      try {
        const publicId = employee.profileImage.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`southbrews/employees/${publicId}`);
      } catch (deleteError) {
        console.error("Failed to delete image from Cloudinary:", deleteError);
        // Continue with employee deletion even if image deletion fails
      }
    }

    // Delete employee
    await Employee.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete employee",
      error: error.message,
    });
  }
};

/**
 * @desc    Get employee statistics
 * @route   GET /api/employees/stats
 * @access  Private/Admin
 */
exports.getEmployeeStats = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ status: "active" });
    const onLeaveEmployees = await Employee.countDocuments({
      status: "on-leave",
    });
    const inactiveEmployees = await Employee.countDocuments({
      status: "inactive",
    });

    // Get department breakdown
    const departmentStats = await Employee.aggregate([
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get position breakdown
    const positionStats = await Employee.aggregate([
      {
        $group: {
          _id: "$position",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get today's scheduled shifts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayShifts = await Shift.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: { $in: ["scheduled", "in-progress"] },
    });

    res.json({
      success: true,
      data: {
        overview: {
          total: totalEmployees,
          active: activeEmployees,
          onLeave: onLeaveEmployees,
          inactive: inactiveEmployees,
        },
        departments: departmentStats.reduce((acc, dept) => {
          acc[dept._id] = dept.count;
          return acc;
        }, {}),
        positions: positionStats.reduce((acc, pos) => {
          acc[pos._id] = pos.count;
          return acc;
        }, {}),
        todayShifts,
      },
    });
  } catch (error) {
    console.error("Get employee stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee statistics",
      error: error.message,
    });
  }
};
