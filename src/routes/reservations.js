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
} = require("../controllers/reservationController");

const { protect, isAdmin, isStaff } = require("../middleware/auth");
const { validateReservation } = require("../middleware/validation");

const router = express.Router();

// Public routes
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
router.patch("/:id/confirm", confirmReservation);
router.patch("/:id/checkin", checkInReservation);
router.patch("/:id/complete", completeReservation);
router.post("/:id/notes", addReservationNote);

// Admin only routes
router.get("/admin/stats", isAdmin, getReservationStats);

module.exports = router;
