const express = require("express");
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User");

const router = express.Router();

// Placeholder controllers - simplified for now
const createOrder = async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      user: req.user.id,
      orderNumber: await Order.generateOrderNumber(),
    };

    const order = await Order.create(orderData);
    order.calculateTotal();
    await order.save();

    res.status(201).json({
      status: "success",
      data: { order },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to create order",
    });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate("items.menuItem")
      .sort({ createdAt: -1 });

    res.json({
      status: "success",
      data: { orders },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch orders",
    });
  }
};

const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.menuItem user"
    );

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    res.json({
      status: "success",
      data: { order },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch order",
    });
  }
};

// Routes
const { protect, isStaff } = require("../middleware/auth");
const { validateOrder } = require("../middleware/validation");

router.use(protect);
router.post("/", validateOrder, createOrder);
router.get("/my-orders", getMyOrders);
router.get("/:id", getOrder);

module.exports = router;
