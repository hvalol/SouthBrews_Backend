const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");

// All routes require authentication and admin/manager role
router.use(protect);
router.use(authorize("admin", "manager"));

/**
 * @route   GET /api/employees/stats
 * @desc    Get employee statistics
 * @access  Private/Admin
 */
router.get("/stats", employeeController.getEmployeeStats);

/**
 * @route   GET /api/employees/:id/with-shifts
 * @desc    Get employee with their shifts
 * @access  Private/Admin
 * @note    Must come before /:id route
 */
router.get("/:id/with-shifts", employeeController.getEmployeeWithShifts);

/**
 * @route   GET /api/employees
 * @desc    Get all employees
 * @access  Private/Admin
 */
router.get("/", employeeController.getAllEmployees);

/**
 * @route   GET /api/employees/:id
 * @desc    Get single employee
 * @access  Private/Admin
 */
router.get("/:id", employeeController.getEmployee);

/**
 * @route   POST /api/employees
 * @desc    Create new employee
 * @access  Private/Admin
 */
router.post(
  "/",
  upload.single("profileImage"),
  employeeController.createEmployee
);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update employee
 * @access  Private/Admin
 */
router.put(
  "/:id",
  upload.single("profileImage"),
  employeeController.updateEmployee
);

/**
 * @route   DELETE /api/employees/:id
 * @desc    Delete employee
 * @access  Private/Admin
 */
router.delete("/:id", employeeController.deleteEmployee);

module.exports = router;
