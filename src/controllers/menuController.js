const MenuItem = require("../models/MenuItem");
const Review = require("../models/Review");
const { deleteImage } = require("../config/cloudinary");

// @desc    Get all menu items with filtering, sorting, and pagination
// @route   GET /api/menu
// @access  Public
const getMenuItems = async (req, res, next) => {
  try {
    let query = {};
    let sortOptions = {};

    // Filtering
    const {
      category,
      dietary,
      available,
      featured,
      search,
      minPrice,
      maxPrice,
      tags,
    } = req.query;

    // Category filter
    if (category) {
      query.category = category;
    }

    // Dietary restrictions filter
    if (dietary) {
      const dietaryArray = dietary.split(",");
      query.dietaryInfo = { $in: dietaryArray };
    }

    // Availability filter
    if (available !== undefined) {
      query.available = available === "true";
    }

    // Featured filter
    if (featured !== undefined) {
      query.featured = featured === "true";
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Tags filter
    if (tags) {
      const tagsArray = tags.split(",");
      query.tags = { $in: tagsArray };
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Sorting
    const { sortBy, order } = req.query;
    if (sortBy) {
      const sortOrder = order === "desc" ? -1 : 1;
      sortOptions[sortBy] = sortOrder;
    } else {
      // Default sort: featured first, then by popularity
      sortOptions = { featured: -1, popularity: -1, createdAt: -1 };
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const startIndex = (page - 1) * limit;

    // Execute query
    const total = await MenuItem.countDocuments(query);
    const menuItems = await MenuItem.find(query)
      .sort(sortOptions)
      .skip(startIndex)
      .limit(limit)
      .populate({
        path: "averageRating reviewCount",
        select: "rating",
      });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      status: "success",
      data: {
        menuItems,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? page + 1 : null,
          prevPage: hasPrevPage ? page - 1 : null,
        },
      },
    });
  } catch (error) {
    console.error("Get menu items error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch menu items",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get single menu item by ID
// @route   GET /api/menu/:id
// @access  Public
const getMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        status: "error",
        message: "Menu item not found",
      });
    }

    // Get reviews for this menu item
    const reviews = await Review.find({
      menuItem: req.params.id,
      status: "approved",
    })
      .populate("user", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get review statistics
    const reviewStats = await Review.getMenuItemStats(req.params.id);

    res.status(200).json({
      status: "success",
      data: {
        menuItem,
        reviews,
        reviewStats,
      },
    });
  } catch (error) {
    console.error("Get menu item error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch menu item",
    });
  }
};

// @desc    Create new menu item
// @route   POST /api/menu
// @access  Private (Admin/Staff only)
const createMenuItem = async (req, res, next) => {
  try {
    console.log("📤 Create menu item request received");
    console.log("Body:", req.body);
    console.log("Cloudinary Result:", req.cloudinaryResult);
    console.log("========== CREATE MENU ITEM BACKEND ==========");
    console.log("📥 Request Body:", req.body);
    console.log("📥 Request File:", req.file);

    // Convert FormData string booleans to actual booleans
    if (typeof req.body.available === "string") {
      req.body.available = req.body.available === "true";
    }
    if (typeof req.body.featured === "string") {
      req.body.featured = req.body.featured === "true";
    }

    // Handle image upload if provided
    if (req.cloudinaryResult) {
      req.body.image = {
        public_id: req.cloudinaryResult.public_id,
        url: req.cloudinaryResult.secure_url || req.cloudinaryResult.url,
      };
    }

    console.log("📊 Data being saved:", req.body);

    const menuItem = await MenuItem.create(req.body);

    console.log("✅ Menu Item Created:", menuItem);

    res.status(201).json({
      status: "success",
      message: "Menu item created successfully",
      data: {
        menuItem,
      },
    });
  } catch (error) {
    console.error("========== CREATE ERROR BACKEND ==========");
    console.error("❌ Error Name:", error.name);
    console.error("❌ Error Message:", error.message);
    console.error("❌ Error Stack:", error.stack);

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
        kind: err.kind,
      }));

      console.error("❌ Validation Errors:", errors);

      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        status: "error",
        message: `${field} already exists`,
        error: error.message,
      });
    }

    // Handle cast errors
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: `Invalid ${error.path}: ${error.value}`,
        error: error.message,
      });
    }

    // Generic error
    res.status(500).json({
      status: "error",
      message: "Failed to create menu item",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private (Admin/Staff only)
const updateMenuItem = async (req, res, next) => {
  try {
    console.log("📝 Update menu item request received");
    console.log("Item ID:", req.params.id);
    console.log("Body:", req.body);
    console.log("Cloudinary Result:", req.cloudinaryResult);
    let menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        status: "error",
        message: "Menu item not found",
      });
    }

    // Convert FormData string booleans to actual booleans
    if (typeof req.body.available === "string") {
      req.body.available = req.body.available === "true";
    }
    if (typeof req.body.featured === "string") {
      req.body.featured = req.body.featured === "true";
    }

    // Handle image upload if provided
    if (req.cloudinaryResult) {
      // Delete old image if exists
      if (menuItem.image && menuItem.image.public_id) {
        await deleteImage(menuItem.image.public_id);
      }

      req.body.image = {
        public_id: req.cloudinaryResult.public_id,
        url: req.cloudinaryResult.secure_url || req.cloudinaryResult.url,
      };
    }

    menuItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: "success",
      message: "Menu item updated successfully",
      data: {
        menuItem,
      },
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update menu item",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private (Admin only)
const deleteMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        status: "error",
        message: "Menu item not found",
      });
    }

    // Delete image from cloudinary if exists
    if (menuItem.image && menuItem.image.public_id) {
      await deleteImage(menuItem.image.public_id);
    }

    // Delete additional images if they exist
    if (menuItem.images && menuItem.images.length > 0) {
      for (const image of menuItem.images) {
        if (image.public_id) {
          await deleteImage(image.public_id);
        }
      }
    }

    await MenuItem.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: "success",
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Delete menu item error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete menu item",
    });
  }
};

// @desc    Get menu categories
// @route   GET /api/menu/categories
// @access  Public
const getMenuCategories = async (req, res, next) => {
  try {
    const categories = await MenuItem.aggregate([
      {
        $match: { available: true },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          averagePrice: { $avg: "$price" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        categories,
      },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch categories",
    });
  }
};

// @desc    Get featured menu items
// @route   GET /api/menu/featured
// @access  Public
const getFeaturedItems = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 6;

    const featuredItems = await MenuItem.find({
      available: true,
      featured: true,
    })
      .sort({ popularity: -1, createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      status: "success",
      data: {
        featuredItems,
      },
    });
  } catch (error) {
    console.error("Get featured items error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch featured items",
    });
  }
};

// @desc    Get popular menu items
// @route   GET /api/menu/popular
// @access  Public
const getPopularItems = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 8;

    const popularItems = await MenuItem.find({
      available: true,
      popularity: { $gt: 0 },
    })
      .sort({ popularity: -1 })
      .limit(limit);

    res.status(200).json({
      status: "success",
      data: {
        popularItems,
      },
    });
  } catch (error) {
    console.error("Get popular items error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch popular items",
    });
  }
};

// @desc    Search menu items
// @route   GET /api/menu/search
// @access  Public
const searchMenuItems = async (req, res, next) => {
  try {
    const { q, category, dietary, minPrice, maxPrice } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Search query is required",
      });
    }

    let query = {
      available: true,
      $text: { $search: q },
    };

    // Add filters
    if (category) query.category = category;
    if (dietary) query.dietaryInfo = { $in: dietary.split(",") };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const results = await MenuItem.find(query, {
      score: { $meta: "textScore" },
    })
      .sort({ score: { $meta: "textScore" }, popularity: -1 })
      .limit(20);

    res.status(200).json({
      status: "success",
      data: {
        results,
        count: results.length,
        query: q,
      },
    });
  } catch (error) {
    console.error("Search menu items error:", error);
    res.status(500).json({
      status: "error",
      message: "Search failed",
    });
  }
};

// @desc    Get menu statistics (Admin only)
// @route   GET /api/menu/stats
// @access  Private (Admin only)
const getMenuStats = async (req, res, next) => {
  try {
    const stats = await MenuItem.getStats();

    res.status(200).json({
      status: "success",
      data: {
        stats,
      },
    });
  } catch (error) {
    console.error("Get menu stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch menu statistics",
    });
  }
};

// @desc    Toggle menu item availability
// @route   PATCH /api/menu/:id/availability
// @access  Private (Staff/Admin only)
const toggleAvailability = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        status: "error",
        message: "Menu item not found",
      });
    }

    menuItem.available = !menuItem.available;
    await menuItem.save();

    res.status(200).json({
      status: "success",
      message: `Menu item ${
        menuItem.available ? "enabled" : "disabled"
      } successfully`,
      data: {
        menuItem,
      },
    });
  } catch (error) {
    console.error("Toggle availability error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to toggle availability",
    });
  }
};

module.exports = {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuCategories,
  getFeaturedItems,
  getPopularItems,
  searchMenuItems,
  getMenuStats,
  toggleAvailability,
};
