const User = require("../models/User");
const Receipt = require("../models/Receipt");
const MenuItem = require("../models/MenuItem");
const Gallery = require("../models/Gallery");
const Reservation = require("../models/Reservation");
const { deleteImage } = require("../config/cloudinary");

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("favoriteMenuItems")
      .populate("favoriteGalleryImages");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    console.error("❌ Get profile error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch profile",
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, dateOfBirth, address, preferences } =
      req.body;

    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (phone !== undefined) updateFields.phone = phone;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
    if (address !== undefined) updateFields.address = address;
    if (preferences !== undefined) updateFields.preferences = preferences;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .select("-password")
      .populate("favoriteMenuItems")
      .populate("favoriteGalleryImages");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: user,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to update profile",
    });
  }
};

// @desc    Update profile image
// @route   PUT /api/users/profile/image
// @access  Private
exports.updateProfileImage = async (req, res) => {
  try {
    console.log("📤 Profile image upload request received");
    console.log("Cloudinary Result:", req.cloudinaryResult);

    // Check if Cloudinary upload was successful
    if (!req.cloudinaryResult) {
      return res.status(400).json({
        status: "error",
        message: "Image upload failed. Please try again.",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Delete old image from Cloudinary if exists
    if (user.profileImage && user.profileImage.public_id) {
      try {
        console.log("🗑️ Deleting old image:", user.profileImage.public_id);
        await deleteImage(user.profileImage.public_id);
        console.log("✅ Old image deleted");
      } catch (deleteError) {
        console.error("⚠️ Failed to delete old image:", deleteError);
        // Continue anyway - we'll save the new one
      }
    }

    // Update user profile image with Cloudinary result
    user.profileImage = {
      public_id: req.cloudinaryResult.public_id,
      url: req.cloudinaryResult.url,
    };

    await user.save();
    console.log("✅ Profile image updated in database");

    // Return updated user data with all fields needed for frontend
    const updatedUser = await User.findById(req.user.id)
      .select("-password")
      .populate("favoriteMenuItems")
      .populate("favoriteGalleryImages");

    res.status(200).json({
      status: "success",
      data: updatedUser,
      message: "Profile image updated successfully",
    });
  } catch (error) {
    console.error("❌ Update profile image error:", error);

    res.status(500).json({
      status: "error",
      message: error.message || "Failed to update profile image",
    });
  }
};

// @desc    Toggle favorite menu item
// @route   POST /api/users/favorites/menu/:id
// @access  Private
exports.toggleFavoriteMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if menu item exists
    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return res.status(404).json({
        status: "error",
        message: "Menu item not found",
      });
    }

    const user = await User.findById(req.user.id);
    await user.toggleFavoriteMenuItem(id);

    const isFavorite = user.favoriteMenuItems.some(
      (item) => item.toString() === id
    );

    res.status(200).json({
      status: "success",
      data: { isFavorite },
      message: isFavorite ? "Added to favorites" : "Removed from favorites",
    });
  } catch (error) {
    console.error("❌ Toggle favorite menu item error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update favorites",
    });
  }
};

// @desc    Toggle favorite gallery image
// @route   POST /api/users/favorites/gallery/:id
// @access  Private
exports.toggleFavoriteGalleryImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if gallery image exists
    const image = await Gallery.findById(id);
    if (!image) {
      return res.status(404).json({
        status: "error",
        message: "Gallery image not found",
      });
    }

    const user = await User.findById(req.user.id);

    // Check if currently favorited BEFORE toggling
    const wasFavorited = user.favoriteGalleryImages.some(
      (item) => item.toString() === id
    );

    // Toggle favorite in user's profile
    await user.toggleFavoriteGalleryImage(id);

    const isFavorite = user.favoriteGalleryImages.some(
      (item) => item.toString() === id
    );

    // Sync gallery likes based on the actual action taken
    if (isFavorite && !image.likes.includes(req.user.id)) {
      // User favorited and not in likes array - add them
      image.likes.push(req.user.id);
      await image.save();
    } else if (!isFavorite && image.likes.includes(req.user.id)) {
      // User unfavorited and still in likes array - remove them
      const likeIndex = image.likes.indexOf(req.user.id);
      if (likeIndex > -1) {
        image.likes.splice(likeIndex, 1);
        await image.save();
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        isFavorite,
        likeCount: image.likeCount,
      },
      message: isFavorite ? "Added to favorites" : "Removed from favorites",
    });
  } catch (error) {
    console.error("❌ Toggle favorite gallery image error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update favorites",
    });
  }
};

// @desc    Get user favorites
// @route   GET /api/users/favorites
// @access  Private
exports.getFavorites = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("favoriteMenuItems")
      .populate("favoriteGalleryImages");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        menuItems: user.favoriteMenuItems || [],
        galleryImages: user.favoriteGalleryImages || [],
      },
    });
  } catch (error) {
    console.error("❌ Get favorites error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch favorites",
    });
  }
};

// @desc    Get user stats
// @route   GET /api/users/stats
// @access  Private
exports.getUserStats = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Get reservation count
    const reservationCount = await Reservation.countDocuments({
      user: req.user.id,
    });

    // Get receipt count
    const receiptCount = await Receipt.countDocuments({
      user: req.user.id,
      status: "approved",
    });

    // Get total points earned
    const totalPointsEarned = user.pointsHistory
      .filter((p) => p.type === "earned")
      .reduce((sum, p) => sum + p.amount, 0);

    // Get total points redeemed
    const totalPointsRedeemed = user.pointsHistory
      .filter((p) => p.type === "redeemed")
      .reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      status: "success",
      data: {
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier,
        totalReservations: reservationCount,
        totalReceipts: receiptCount,
        totalPointsEarned,
        totalPointsRedeemed,
        memberSince: user.createdAt,
        favoriteMenuItems: user.favoriteMenuItems?.length || 0,
        favoriteGalleryImages: user.favoriteGalleryImages?.length || 0,
      },
    });
  } catch (error) {
    console.error("❌ Get user stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user stats",
    });
  }
};

// @desc    Get points history
// @route   GET /api/users/points/history
// @access  Private
exports.getPointsHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Sort points history by date (newest first)
    const sortedHistory = user.pointsHistory.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const paginatedHistory = sortedHistory.slice(skip, skip + limit);
    const totalItems = sortedHistory.length;
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      status: "success",
      data: paginatedHistory,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("❌ Get points history error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch points history",
    });
  }
};

// @desc    Submit receipt for points
// @route   POST /api/users/receipts
// @access  Private
exports.submitReceipt = async (req, res) => {
  try {
    console.log("📤 Receipt submission request received");
    console.log("Cloudinary Result:", req.cloudinaryResult);
    console.log("Body:", req.body);

    const { orderDate, amount, items, storeName } = req.body;

    // Validate required fields
    if (!orderDate || !amount) {
      return res.status(400).json({
        status: "error",
        message: "Order date and amount are required",
      });
    }

    // Check if Cloudinary upload was successful
    if (!req.cloudinaryResult) {
      return res.status(400).json({
        status: "error",
        message: "Receipt image upload failed. Please try again.",
      });
    }

    // Parse items if it's a string
    let parsedItems = [];
    if (items) {
      try {
        parsedItems = typeof items === "string" ? JSON.parse(items) : items;
      } catch (parseError) {
        console.error("❌ Failed to parse items:", parseError);
        parsedItems = [];
      }
    }

    // Create receipt
    const receipt = await Receipt.create({
      user: req.user.id,
      receiptImage: {
        public_id: req.cloudinaryResult.public_id,
        url: req.cloudinaryResult.url,
      },
      orderDate: new Date(orderDate),
      amount: parseFloat(amount),
      items: parsedItems,
      storeName: storeName || "South Side Brews",
      status: "pending",
    });

    console.log("✅ Receipt created:", receipt._id);

    // Populate user data for response
    await receipt.populate("user", "firstName lastName email");

    res.status(201).json({
      status: "success",
      data: { receipt },
      message: "Receipt submitted successfully. Pending approval.",
    });
  } catch (error) {
    console.error("❌ Submit receipt error:", error);

    res.status(500).json({
      status: "error",
      message: error.message || "Failed to submit receipt",
    });
  }
};

// @desc    Get user receipts
// @route   GET /api/users/receipts
// @access  Private
exports.getUserReceipts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    const query = { user: req.user.id };
    if (status) query.status = status;

    const receipts = await Receipt.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const totalItems = await Receipt.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      status: "success",
      data: receipts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("❌ Get user receipts error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch receipts",
    });
  }
};

// @desc    Get all receipts (Admin/Staff)
// @route   GET /api/users/receipts/all
// @access  Private/Admin/Staff
exports.getAllReceipts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const query = {};
    if (status) query.status = status;

    const receipts = await Receipt.find(query)
      .populate("user", "firstName lastName email")
      .populate("reviewedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const totalItems = await Receipt.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    // Get status counts
    const statusCounts = await Receipt.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    statusCounts.forEach((item) => {
      stats[item._id] = item.count;
    });

    res.status(200).json({
      status: "success",
      data: receipts,
      stats,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("❌ Get all receipts error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch receipts",
    });
  }
};

// @desc    Approve receipt (Admin/Staff)
// @route   PATCH /api/users/receipts/:id/approve
// @access  Private/Admin/Staff
exports.approveReceipt = async (req, res, next) => {
  try {
    const receipt = await Receipt.findById(req.params.id).populate(
      "user",
      "firstName lastName email"
    );

    if (!receipt) {
      return res.status(404).json({
        status: "error",
        message: "Receipt not found",
      });
    }

    if (receipt.status !== "pending") {
      return res.status(400).json({
        status: "error",
        message: `Receipt has already been ${receipt.status}`,
      });
    }

    await receipt.approve(req.user.id);

    res.status(200).json({
      status: "success",
      data: receipt,
      message: `Receipt approved. ${receipt.pointsAwarded} points awarded to ${receipt.user.firstName} ${receipt.user.lastName}.`,
    });
  } catch (error) {
    console.error("❌ Approve receipt error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to approve receipt",
    });
  }
};

// @desc    Reject receipt (Admin/Staff)
// @route   PATCH /api/users/receipts/:id/reject
// @access  Private/Admin/Staff
exports.rejectReceipt = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "Please provide a rejection reason",
      });
    }

    const receipt = await Receipt.findById(req.params.id).populate(
      "user",
      "firstName lastName email"
    );

    if (!receipt) {
      return res.status(404).json({
        status: "error",
        message: "Receipt not found",
      });
    }

    if (receipt.status !== "pending") {
      return res.status(400).json({
        status: "error",
        message: `Receipt has already been ${receipt.status}`,
      });
    }

    await receipt.reject(req.user.id, reason);

    res.status(200).json({
      status: "success",
      data: receipt,
      message: `Receipt rejected for ${receipt.user.firstName} ${receipt.user.lastName}.`,
    });
  } catch (error) {
    console.error("❌ Reject receipt error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to reject receipt",
    });
  }
};
