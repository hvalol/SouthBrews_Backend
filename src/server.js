const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const errorHandler = require("./middleware/errorHandler");

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development only)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Import routes
const authRoutes = require("./routes/auth");
const menuRoutes = require("./routes/menu");
const reservationRoutes = require("./routes/reservations");
const employeeRoutes = require("./routes/employeeRoutes");
const shiftRoutes = require("./routes/shifts");
const galleryRoutes = require("./routes/gallery");
const userRoutes = require("./routes/users");
const settingsRoutes = require("./routes/settings");
const contactRoutes = require("./routes/contact");

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/contact", contactRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "SouthBrews API",
    version: "1.0.0",
    status: "active",
    endpoints: {
      auth: "/api/auth",
      menu: "/api/menu",
      reservations: "/api/reservations",
      employees: "/api/employees",
      shifts: "/api/shifts",
      gallery: "/api/gallery",
      health: "/api/health",
    },
    documentation: {
      employees: {
        getAll: "GET /api/employees",
        getById: "GET /api/employees/:id",
        getWithShifts: "GET /api/employees/:id/with-shifts",
        getStats: "GET /api/employees/stats",
        create: "POST /api/employees",
        update: "PUT /api/employees/:id",
        delete: "DELETE /api/employees/:id",
      },
      shifts: {
        getAll: "GET /api/shifts",
        getById: "GET /api/shifts/:id",
        getEmployeeSchedule: "GET /api/shifts/employee/:employeeId",
        getSummary: "GET /api/shifts/summary",
        create: "POST /api/shifts",
        update: "PUT /api/shifts/:id",
        delete: "DELETE /api/shifts/:id",
        checkConflicts: "POST /api/shifts/check-conflicts",
        clockIn: "POST /api/shifts/:id/clock-in",
        clockOut: "POST /api/shifts/:id/clock-out",
      },
    },
  });
});

// 404 handler (must be before error handler)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log(`║  🚀 SouthBrews API Server                        ║`);
  console.log("║══════════════════════════════════════════════════║");
  console.log(`║  📍 Port: ${PORT.toString().padEnd(40)} ║`);
  console.log(
    `║  🌍 Environment: ${(process.env.NODE_ENV || "development").padEnd(31)} ║`
  );
  console.log(`║  📊 Status: Running${" ".repeat(32)} ║`);
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");
  console.log("📋 Available endpoints:");
  console.log("   • http://localhost:" + PORT + "/");
  console.log("   • http://localhost:" + PORT + "/api/health");
  console.log("   • http://localhost:" + PORT + "/api/employees");
  console.log("   • http://localhost:" + PORT + "/api/shifts");
  console.log("");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ UNHANDLED REJECTION! Shutting down...");
  console.error("Error:", err.name, "-", err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("✅ Process terminated");
  });
});

module.exports = app;
