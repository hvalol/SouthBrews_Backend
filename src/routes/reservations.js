const express = require("express");
const {
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
  getCapacitySettings,
  updateCapacitySettings,
  setSlotCapacityOverride,
  blockSlot,
} = require("../controllers/reservationController");

const {
  protect,
  isAdmin,
  isStaff,
  optionalAuth,
} = require("../middleware/auth");
const { validateReservation } = require("../middleware/validation");

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================
router.get("/available-slots", getAvailableSlots);
router.post("/check-availability", checkAvailability);
// Allow both authenticated and guest reservations
router.post("/", optionalAuth, validateReservation, createReservation);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================
router.use(protect);

// ============================================
// CUSTOMER ROUTES
// ============================================
router.get("/my-reservations", getMyReservations);

// ============================================
// STAFF/ADMIN ROUTES
// ============================================
router.use(isStaff);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes (:id)
// Admin only routes
router.get("/export/csv", isAdmin, exportReservationsCSV);
router.get("/admin/stats", isAdmin, getReservationStats);

// Capacity management routes (Admin only)
router.get("/capacity/settings", getCapacitySettings);
router.put("/capacity/settings", isAdmin, updateCapacitySettings);
router.put("/capacity/slot-override", isAdmin, setSlotCapacityOverride);
router.put("/capacity/block-slot", isAdmin, blockSlot);

// Staff/Admin specific routes
router.get("/today", getTodayReservations);
router.get("/stats", getReservationStats); // This was being matched as /:id

// General staff/admin routes - keep these before /:id
router.get("/", getAllReservations);

// ============================================
// PARAMETERIZED ROUTES (MUST BE LAST)
// ============================================
// These routes use :id parameter, so they MUST come after specific routes
router.get("/:id", getReservation);
router.put("/:id", validateReservation, updateReservation);
router.delete("/:id", isAdmin, deleteReservation);
router.patch("/:id/cancel", cancelReservation);
router.patch("/:id/confirm", confirmReservation);
router.patch("/:id/checkin", checkInReservation);
router.patch("/:id/complete", completeReservation);
router.patch("/:id/no-show", markNoShow);
router.post("/:id/notes", addReservationNote);
router.post("/:id/send-reminder", sendReminderEmail);

module.exports = router;
