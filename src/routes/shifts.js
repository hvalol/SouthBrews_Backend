const express = require("express");
const router = express.Router();
const {
  createShift,
  getShifts,
  getShiftById,
  getEmployeeSchedule,
  updateShift,
  deleteShift,
  checkConflicts,
  clockIn,
  clockOut,
  getShiftsSummary,
} = require("../controllers/shiftController");
const { protect, authorize } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(protect);
router.use(authorize("admin", "manager"));

/**
 * @route   GET /api/shifts/summary
 * @desc    Get shifts summary/statistics
 * @access  Private/Admin
 * @note    Must come before /:id route to avoid treating 'summary' as an ID
 */
router.get("/summary", getShiftsSummary);

/**
 * @route   GET /api/shifts/employee/:employeeId
 * @desc    Get employee schedule
 * @access  Private/Admin
 * @note    Must come before /:id route
 */
router.get("/employee/:employeeId", getEmployeeSchedule);

/**
 * @route   POST /api/shifts/check-conflicts
 * @desc    Check for scheduling conflicts
 * @access  Private/Admin
 * @note    Must come before /:id route
 */
router.post("/check-conflicts", checkConflicts);

/**
 * @route   GET /api/shifts
 * @desc    Get all shifts with filters
 * @access  Private/Admin
 */
router.get("/", getShifts);

/**
 * @route   POST /api/shifts
 * @desc    Create a new shift
 * @access  Private/Admin
 */
router.post("/", createShift);

/**
 * @route   GET /api/shifts/:id
 * @desc    Get single shift by ID
 * @access  Private/Admin
 */
router.get("/:id", getShiftById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    Update shift
 * @access  Private/Admin
 */
router.put("/:id", updateShift);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    Delete shift
 * @access  Private/Admin
 */
router.delete("/:id", deleteShift);

/**
 * @route   POST /api/shifts/:id/clock-in
 * @desc    Clock in to shift
 * @access  Private/Admin
 */
router.post("/:id/clock-in", clockIn);

/**
 * @route   POST /api/shifts/:id/clock-out
 * @desc    Clock out from shift
 * @access  Private/Admin
 */
router.post("/:id/clock-out", clockOut);

module.exports = router;
