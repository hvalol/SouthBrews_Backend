const Settings = require("../models/Settings");
const { uploadImage, deleteImage } = require("../config/cloudinary");

// @desc    Get settings
// @route   GET /api/settings
// @access  Public (general info) / Private (sensitive info)
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSingleton();

    // Public users get limited info
    if (!req.user) {
      return res.status(200).json({
        status: "success",
        data: {
          general: settings.general,
          businessHours: settings.businessHours,
          socialMedia: settings.socialMedia,
          appearance: settings.appearance, // Include appearance for branding
        },
      });
    }

    // Authenticated users get all settings
    res.status(200).json({
      status: "success",
      data: settings,
    });
  } catch (error) {
    console.error("❌ Get settings error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch settings",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
  try {
    const {
      general,
      businessHours,
      payment,
      notifications,
      delivery,
      appearance,
      socialMedia,
    } = req.body;

    const settings = await Settings.getSingleton();

    // Validate general settings
    if (general) {
      if (general.email && !/^\S+@\S+\.\S+$/.test(general.email)) {
        return res.status(400).json({
          status: "error",
          message: "Please provide a valid email address",
        });
      }

      if (general.businessName && general.businessName.trim().length < 2) {
        return res.status(400).json({
          status: "error",
          message: "Business name must be at least 2 characters long",
        });
      }

      if (general.description && general.description.length > 500) {
        return res.status(400).json({
          status: "error",
          message: "Description must not exceed 500 characters",
        });
      }

      settings.general = { ...settings.general, ...general };
    }

    // Validate and update business hours
    if (businessHours) {
      const days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];

      for (const day of days) {
        if (businessHours[day]) {
          const dayData = businessHours[day];

          // Validate time format (HH:MM)
          const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (dayData.open && !timeRegex.test(dayData.open)) {
            return res.status(400).json({
              status: "error",
              message: `Invalid opening time format for ${day}. Use HH:MM format.`,
            });
          }

          if (dayData.close && !timeRegex.test(dayData.close)) {
            return res.status(400).json({
              status: "error",
              message: `Invalid closing time format for ${day}. Use HH:MM format.`,
            });
          }

          settings.businessHours[day] = {
            ...settings.businessHours[day],
            ...dayData,
          };
        }
      }
    }

    // Validate and update payment settings
    if (payment) {
      if (payment.taxRate !== undefined) {
        if (payment.taxRate < 0 || payment.taxRate > 100) {
          return res.status(400).json({
            status: "error",
            message: "Tax rate must be between 0 and 100",
          });
        }
      }

      if (payment.tipOptions && !Array.isArray(payment.tipOptions)) {
        return res.status(400).json({
          status: "error",
          message: "Tip options must be an array of numbers",
        });
      }

      settings.payment = { ...settings.payment, ...payment };
    }

    // Update notifications
    if (notifications) {
      settings.notifications = { ...settings.notifications, ...notifications };
    }

    // Validate and update delivery settings
    if (delivery) {
      if (
        delivery.deliveryRadius !== undefined &&
        delivery.deliveryRadius < 0
      ) {
        return res.status(400).json({
          status: "error",
          message: "Delivery radius cannot be negative",
        });
      }

      if (delivery.minimumOrder !== undefined && delivery.minimumOrder < 0) {
        return res.status(400).json({
          status: "error",
          message: "Minimum order cannot be negative",
        });
      }

      if (delivery.deliveryFee !== undefined && delivery.deliveryFee < 0) {
        return res.status(400).json({
          status: "error",
          message: "Delivery fee cannot be negative",
        });
      }

      settings.delivery = { ...settings.delivery, ...delivery };
    }

    // Update appearance
    if (appearance) {
      if (appearance.theme && !["light", "dark"].includes(appearance.theme)) {
        return res.status(400).json({
          status: "error",
          message: "Theme must be either 'light' or 'dark'",
        });
      }

      settings.appearance = { ...settings.appearance, ...appearance };
    }

    // Update social media
    if (socialMedia) {
      settings.socialMedia = { ...settings.socialMedia, ...socialMedia };
    }

    // Track who updated
    settings.lastUpdatedBy = req.user.id;

    await settings.save();

    console.log(`✅ Settings updated by user: ${req.user.id}`);

    res.status(200).json({
      status: "success",
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("❌ Update settings error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: "error",
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to update settings",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Reset settings to default
// @route   POST /api/settings/reset
// @access  Private/Admin
exports.resetSettings = async (req, res) => {
  try {
    const settings = await Settings.getSingleton();

    // Reset to defaults
    settings.general = {
      businessName: "South Side Brews",
      tagline: "Brewing Perfection Since 2020",
      email: "info@southsidebrews.com",
      phone: "+1 (555) 123-4567",
      address: "123 Mountain View Road, Forest Hills, CA 90210",
      website: "www.southsidebrews.com",
      description:
        "A cozy mountain cafe serving artisanal coffee and fresh pastries.",
    };

    settings.lastUpdatedBy = req.user.id;
    await settings.save();

    console.log(`✅ Settings reset by user: ${req.user.id}`);

    res.status(200).json({
      status: "success",
      message: "Settings reset to defaults",
      data: settings,
    });
  } catch (error) {
    console.error("❌ Reset settings error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to reset settings",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Upload logo
// @route   POST /api/settings/upload-logo
// @access  Private/Admin
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Please upload an image file",
      });
    }

    const settings = await Settings.getSingleton();

    // Delete old logo if exists
    if (settings.appearance?.logoUrl) {
      try {
        const publicId = settings.appearance.logoUrl
          .split("/")
          .pop()
          .split(".")[0];
        await deleteImage(`southside-brews/${publicId}`);
      } catch (error) {
        console.log("⚠️ Could not delete old logo:", error.message);
      }
    }

    // Upload new logo to Cloudinary
    const result = await uploadImage(req.file.path, "southside-brews/logos");

    // Update settings with new logo URL
    if (!settings.appearance) {
      settings.appearance = {};
    }
    settings.appearance.logoUrl = result.url;
    settings.lastUpdatedBy = req.user.id;
    await settings.save();

    console.log(`✅ Logo uploaded by user: ${req.user.id}`);

    res.status(200).json({
      status: "success",
      message: "Logo uploaded successfully",
      logoUrl: result.url,
    });
  } catch (error) {
    console.error("❌ Upload logo error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to upload logo",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Upload favicon
// @route   POST /api/settings/upload-favicon
// @access  Private/Admin
exports.uploadFavicon = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Please upload an image file",
      });
    }

    const settings = await Settings.getSingleton();

    // Delete old favicon if exists
    if (settings.appearance?.faviconUrl) {
      try {
        const publicId = settings.appearance.faviconUrl
          .split("/")
          .pop()
          .split(".")[0];
        await deleteImage(`southside-brews/${publicId}`);
      } catch (error) {
        console.log("⚠️ Could not delete old favicon:", error.message);
      }
    }

    // Upload new favicon to Cloudinary
    const result = await uploadImage(req.file.path, "southside-brews/favicons");

    // Update settings with new favicon URL
    if (!settings.appearance) {
      settings.appearance = {};
    }
    settings.appearance.faviconUrl = result.url;
    settings.lastUpdatedBy = req.user.id;
    await settings.save();

    console.log(`✅ Favicon uploaded by user: ${req.user.id}`);

    res.status(200).json({
      status: "success",
      message: "Favicon uploaded successfully",
      faviconUrl: result.url,
    });
  } catch (error) {
    console.error("❌ Upload favicon error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to upload favicon",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};
