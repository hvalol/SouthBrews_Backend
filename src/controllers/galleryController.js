const Gallery = require("../models/Gallery");
const { uploadImage, deleteImage } = require("../config/cloudinary");

// @desc    Get all gallery images
// @route   GET /api/gallery
// @access  Public
exports.getAllImages = async (req, res) => {
  try {
    const {
      category,
      featured,
      search,
      tags,
      page = 1,
      limit = 12,
      sort = "-createdAt",
    } = req.query;

    // Build query
    let query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (featured !== undefined) {
      query.isFeatured = featured === "true";
    }

    if (tags) {
      const tagArray = tags.split(",");
      query.tags = { $in: tagArray };
    }

    // Text search if search query provided
    let images;
    if (search) {
      images = await Gallery.searchImages(search);
    } else {
      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      images = await Gallery.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate("uploadedBy", "firstName lastName");

      const total = await Gallery.countDocuments(query);

      return res.status(200).json({
        status: "success",
        data: {
          images,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        images,
      },
    });
  } catch (error) {
    console.error("Get gallery images error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch gallery images",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get single image by ID
// @route   GET /api/gallery/:id
// @access  Public
exports.getImageById = async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id).populate(
      "uploadedBy",
      "firstName lastName"
    );

    if (!image) {
      return res.status(404).json({
        status: "error",
        message: "Image not found",
      });
    }

    // Increment view count
    const updatedImage = await image.incrementViews();

    res.status(200).json({
      status: "success",
      data: {
        image: updatedImage,
      },
    });
  } catch (error) {
    console.error("Get image error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch image",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Upload new image
// @route   POST /api/gallery
// @access  Private/Admin/Staff
exports.uploadNewImage = async (req, res) => {
  try {
    console.log("📤 Upload gallery image request received");
    console.log("Body:", req.body);
    console.log("Cloudinary Result:", req.cloudinaryResult);

    const { title, description, category, tags, isFeatured } = req.body;

    // Validate required fields
    if (!req.cloudinaryResult) {
      return res.status(400).json({
        status: "error",
        message: "Please upload an image file",
      });
    }

    const trimmedTitle = title?.trim();
    if (!trimmedTitle) {
      return res.status(400).json({
        status: "error",
        message: "Title is required",
      });
    }

    if (trimmedTitle.length < 3) {
      return res.status(400).json({
        status: "error",
        message: "Title must be at least 3 characters long",
      });
    }

    if (trimmedTitle.length > 100) {
      return res.status(400).json({
        status: "error",
        message: "Title must not exceed 100 characters",
      });
    }

    const trimmedDescription = description?.trim();
    if (trimmedDescription && trimmedDescription.length > 500) {
      return res.status(400).json({
        status: "error",
        message: "Description must not exceed 500 characters",
      });
    }

    const validCategories = [
      "interior",
      "coffee",
      "food",
      "events",
      "nature",
      "people",
      "other",
    ];
    const imageCategory = category || "other";
    if (!validCategories.includes(imageCategory)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid category. Must be one of: ${validCategories.join(
          ", "
        )}`,
      });
    }

    // Convert FormData string boolean to actual boolean
    const featured =
      typeof isFeatured === "string"
        ? isFeatured === "true"
        : Boolean(isFeatured);

    // Process tags - handle both string and array formats
    let processedTags = [];
    if (tags) {
      if (typeof tags === "string") {
        processedTags = tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
      } else if (Array.isArray(tags)) {
        processedTags = tags
          .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
          .filter((tag) => tag.length > 0);
      }
    }

    // Create gallery entry using Cloudinary result from middleware
    const image = await Gallery.create({
      title: trimmedTitle,
      description: trimmedDescription || "",
      category: imageCategory,
      tags: processedTags,
      url: req.cloudinaryResult.secure_url || req.cloudinaryResult.url,
      cloudinaryId: req.cloudinaryResult.public_id,
      uploadedBy: req.user.id,
      isFeatured: featured,
      metadata: {
        width: req.cloudinaryResult.width,
        height: req.cloudinaryResult.height,
        format: req.cloudinaryResult.format,
        size: req.cloudinaryResult.bytes || 0,
      },
    });

    await image.populate("uploadedBy", "firstName lastName");

    console.log("✅ Image uploaded successfully:", image._id);

    res.status(201).json({
      status: "success",
      message: "Image uploaded successfully",
      data: {
        image,
      },
    });
  } catch (error) {
    console.error("❌ Upload image error:", error);

    // Handle specific errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: "error",
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to upload image",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Update image details
// @route   PUT /api/gallery/:id
// @access  Private/Admin/Staff
exports.updateImage = async (req, res) => {
  try {
    const { title, description, category, tags, isFeatured, isActive } =
      req.body;

    // Validate request
    if (title !== undefined) {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return res.status(400).json({
          status: "error",
          message: "Title cannot be empty",
        });
      }
      if (trimmedTitle.length < 3) {
        return res.status(400).json({
          status: "error",
          message: "Title must be at least 3 characters long",
        });
      }
      if (trimmedTitle.length > 100) {
        return res.status(400).json({
          status: "error",
          message: "Title must not exceed 100 characters",
        });
      }
    }

    if (description !== undefined && description.length > 500) {
      return res.status(400).json({
        status: "error",
        message: "Description must not exceed 500 characters",
      });
    }

    const validCategories = [
      "interior",
      "coffee",
      "food",
      "events",
      "nature",
      "people",
      "other",
    ];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid category. Must be one of: ${validCategories.join(
          ", "
        )}`,
      });
    }

    let image = await Gallery.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        status: "error",
        message: "Image not found",
      });
    }

    // Update fields with proper validation
    if (title) image.title = title.trim();
    if (description !== undefined) image.description = description.trim();
    if (category) image.category = category;

    // Handle tags - support both string and array formats
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        // Already an array - just filter and trim
        image.tags = tags
          .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
          .filter((tag) => tag.length > 0);
      } else if (typeof tags === "string") {
        // String format - split by comma
        image.tags = tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
      } else {
        return res.status(400).json({
          status: "error",
          message: "Tags must be a string or array",
        });
      }
    }

    if (isFeatured !== undefined)
      image.isFeatured = isFeatured === "true" || isFeatured === true;
    if (isActive !== undefined)
      image.isActive = isActive === "true" || isActive === true;

    await image.save();
    await image.populate("uploadedBy", "firstName lastName");

    res.status(200).json({
      status: "success",
      message: "Image updated successfully",
      data: {
        image,
      },
    });
  } catch (error) {
    console.error("Update image error:", error);

    // Handle specific errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: "error",
        message: messages.join(", "),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid image ID format",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to update image",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Delete image
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
exports.deleteImage = async (req, res) => {
  try {
    // Validate ID format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid image ID format",
      });
    }

    const image = await Gallery.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        status: "error",
        message: "Image not found",
      });
    }

    // Delete from Cloudinary
    try {
      console.log(`🗑️ Deleting image from Cloudinary: ${image.cloudinaryId}`);
      await deleteImage(image.cloudinaryId);
      console.log("✅ Cloudinary deletion successful");
    } catch (cloudinaryError) {
      console.error("❌ Cloudinary deletion error:", cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
    }

    // Delete from database
    await Gallery.findByIdAndDelete(req.params.id);
    console.log(`✅ Image deleted from database: ${req.params.id}`);

    res.status(200).json({
      status: "success",
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete image error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid image ID format",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to delete image",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Toggle like on image
// @route   POST /api/gallery/:id/like
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        status: "error",
        message: "Image not found",
      });
    }

    const updatedImage = await image.toggleLike(req.user.id);

    res.status(200).json({
      status: "success",
      message: updatedImage.likes.includes(req.user.id)
        ? "Image liked"
        : "Image unliked",
      data: {
        likes: updatedImage.likeCount,
        isLiked: updatedImage.likes.includes(req.user.id),
      },
    });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to toggle like",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get featured images
// @route   GET /api/gallery/featured
// @access  Public
exports.getFeaturedImages = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    const images = await Gallery.find({ isActive: true, isFeatured: true })
      .sort("-createdAt")
      .limit(limit)
      .populate("uploadedBy", "firstName lastName");

    res.status(200).json({
      status: "success",
      data: {
        images,
      },
    });
  } catch (error) {
    console.error("Get featured images error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch featured images",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get popular images
// @route   GET /api/gallery/popular
// @access  Public
exports.getPopularImages = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const images = await Gallery.getPopular(limit);

    res.status(200).json({
      status: "success",
      data: {
        images,
      },
    });
  } catch (error) {
    console.error("Get popular images error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch popular images",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get gallery statistics
// @route   GET /api/gallery/stats
// @access  Private/Admin
exports.getGalleryStats = async (req, res) => {
  try {
    const stats = await Gallery.getStats();

    res.status(200).json({
      status: "success",
      data: {
        stats,
      },
    });
  } catch (error) {
    console.error("Get gallery stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch gallery statistics",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get categories
// @route   GET /api/gallery/categories
// @access  Public
exports.getCategories = async (req, res) => {
  try {
    const categories = await Gallery.distinct("category", { isActive: true });

    // Count images per category
    const categoryStats = await Promise.all(
      categories.map(async (category) => {
        const count = await Gallery.countDocuments({
          category,
          isActive: true,
        });
        return {
          _id: category,
          name: category.charAt(0).toUpperCase() + category.slice(1),
          count,
        };
      })
    );

    res.status(200).json({
      status: "success",
      data: {
        categories: categoryStats,
      },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch categories",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};
