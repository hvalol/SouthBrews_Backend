const ContactMessage = require("../models/ContactMessage");
const emailService = require("../utils/emailService");

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        status: "error",
        message: "Please provide a valid email address",
      });
    }

    if (!subject) {
      return res.status(400).json({
        status: "error",
        message: "Subject is required",
      });
    }

    const validSubjects = [
      "general",
      "reservation",
      "catering",
      "feedback",
      "partnership",
      "other",
    ];
    if (!validSubjects.includes(subject)) {
      return res.status(400).json({
        status: "error",
        message: `Subject must be one of: ${validSubjects.join(", ")}`,
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Message is required",
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        status: "error",
        message: "Message must not exceed 1000 characters",
      });
    }

    // Create contact message
    const contactMessage = await ContactMessage.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim(),
      subject,
      message: message.trim(),
    });

    console.log(`✅ Contact message received from: ${email}`);

    // Send confirmation email to customer
    try {
      await emailService.sendEmail({
        to: email,
        subject: "We received your message - South Side Brews",
        html: `
          <h2>Thank you for contacting us!</h2>
          <p>Dear ${name},</p>
          <p>We have received your message and will get back to you within 24 hours.</p>
          <p><strong>Your message:</strong></p>
          <p>${message}</p>
          <br>
          <p>Best regards,<br>South Side Brews Team</p>
        `,
      });
    } catch (emailError) {
      console.error("❌ Failed to send confirmation email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      status: "success",
      message:
        "Your message has been sent successfully. We'll respond within 24 hours.",
      data: {
        id: contactMessage._id,
        name: contactMessage.name,
        email: contactMessage.email,
        subject: contactMessage.subject,
      },
    });
  } catch (error) {
    console.error("❌ Submit contact form error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: "error",
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to submit contact form. Please try again later.",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get all contact messages
// @route   GET /api/contact
// @access  Private/Admin/Staff
exports.getAllMessages = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, sort = "-createdAt" } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const messages = await ContactMessage.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate("repliedBy", "firstName lastName email");

    const total = await ContactMessage.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("❌ Get messages error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch messages",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get single contact message
// @route   GET /api/contact/:id
// @access  Private/Admin/Staff
exports.getMessage = async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id).populate(
      "repliedBy",
      "firstName lastName email"
    );

    if (!message) {
      return res.status(404).json({
        status: "error",
        message: "Message not found",
      });
    }

    // Mark as read if unread
    if (message.status === "unread") {
      message.status = "read";
      await message.save();
    }

    res.status(200).json({
      status: "success",
      data: message,
    });
  } catch (error) {
    console.error("❌ Get message error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid message ID format",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to fetch message",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Reply to contact message
// @route   POST /api/contact/:id/reply
// @access  Private/Admin/Staff
exports.replyToMessage = async (req, res) => {
  try {
    const { reply } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Reply message is required",
      });
    }

    if (reply.length > 2000) {
      return res.status(400).json({
        status: "error",
        message: "Reply must not exceed 2000 characters",
      });
    }

    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        status: "error",
        message: "Message not found",
      });
    }

    message.reply = reply.trim();
    message.status = "replied";
    message.repliedAt = new Date();
    message.repliedBy = req.user.id;

    await message.save();

    // Send reply email to customer
    try {
      await emailService.sendEmail({
        to: message.email,
        subject: `Re: ${message.subject} - South Side Brews`,
        html: `
          <h2>Response to Your Message</h2>
          <p>Dear ${message.name},</p>
          <p>${reply}</p>
          <br>
          <p><strong>Your original message:</strong></p>
          <p>${message.message}</p>
          <br>
          <p>Best regards,<br>South Side Brews Team</p>
        `,
      });
      console.log(`✅ Reply sent to: ${message.email}`);
    } catch (emailError) {
      console.error("❌ Failed to send reply email:", emailError);
    }

    res.status(200).json({
      status: "success",
      message: "Reply sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("❌ Reply to message error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid message ID format",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to send reply",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Update message status
// @route   PATCH /api/contact/:id/status
// @access  Private/Admin/Staff
exports.updateMessageStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const validStatuses = ["unread", "read", "replied", "archived"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        status: "error",
        message: "Message not found",
      });
    }

    if (status) message.status = status;
    if (notes !== undefined) message.notes = notes.trim();

    await message.save();

    res.status(200).json({
      status: "success",
      message: "Message updated successfully",
      data: message,
    });
  } catch (error) {
    console.error("❌ Update message status error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid message ID format",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to update message",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Delete contact message
// @route   DELETE /api/contact/:id
// @access  Private/Admin
exports.deleteMessage = async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        status: "error",
        message: "Message not found",
      });
    }

    await ContactMessage.findByIdAndDelete(req.params.id);

    console.log(`✅ Contact message deleted: ${req.params.id}`);

    res.status(200).json({
      status: "success",
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete message error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid message ID format",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to delete message",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};
