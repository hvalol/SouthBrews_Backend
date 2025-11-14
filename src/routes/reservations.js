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
} = require("../controllers/reservationController");

const { protect, isAdmin, isStaff } = require("../middleware/auth");
const { validateReservation } = require("../middleware/validation");

const router = express.Router();

// Public routes
router.get("/available-slots", getAvailableSlots);
router.post("/check-availability", checkAvailability);

// Protected routes
router.use(protect);

// Customer routes
router.post("/", validateReservation, createReservation);
router.get("/my-reservations", getMyReservations);
router.get("/:id", getReservation);
router.put("/:id", validateReservation, updateReservation);
router.patch("/:id/cancel", cancelReservation);

// Staff/Admin routes
router.use(isStaff);

router.get("/", getAllReservations);
router.get("/today", getTodayReservations);
router.patch("/:id/confirm", confirmReservation);
router.patch("/:id/checkin", checkInReservation);
router.patch("/:id/complete", completeReservation);
router.patch("/:id/no-show", markNoShow);
router.post("/:id/notes", addReservationNote);
router.post("/:id/send-reminder", sendReminderEmail);

// Admin only routes
router.get("/admin/stats", isAdmin, getReservationStats);

module.exports = router;
