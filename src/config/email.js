const nodemailer = require("nodemailer");

/**
 * Email Configuration
 * Using Nodemailer to send emails
 */

// Create reusable transporter with auto-generated Ethereal account
const createTransporter = async () => {
  // For development: Use Ethereal (fake SMTP service), Gmail, or SendGrid
  // For production: Use SendGrid, AWS SES, or your email service

  if (
    process.env.NODE_ENV === "production" ||
    process.env.EMAIL_SERVICE === "sendgrid"
  ) {
    // Production email service or SendGrid
    console.log("📧 Configuring SendGrid email service...");
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.sendgrid.net",
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER || "apikey",
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } else {
    // Development: Gmail or Ethereal
    if (process.env.EMAIL_SERVICE === "gmail") {
      console.log("📧 Configuring Gmail email service...");
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    } else {
      // Ethereal Email (Testing) - Auto-generate test account
      try {
        console.log("📧 Creating Ethereal Email test account...");

        // Add timeout for Ethereal account creation
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Ethereal account creation timeout")),
            5000
          );
        });

        const accountPromise = nodemailer.createTestAccount();
        const testAccount = await Promise.race([
          accountPromise,
          timeoutPromise,
        ]);

        console.log("✅ Ethereal Email Test Account Created:");
        console.log("   User:", testAccount.user);
        console.log("   Preview emails at: https://ethereal.email");

        return nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
          connectionTimeout: 5000, // 5 second connection timeout
          greetingTimeout: 5000, // 5 second greeting timeout
        });
      } catch (error) {
        console.error(
          "⚠️ Failed to create Ethereal test account:",
          error.message
        );
        console.log(
          "📧 Using mock email transporter (emails will not be sent)"
        );

        // Return a mock transporter that doesn't actually send emails
        return {
          sendMail: async (mailOptions) => {
            console.log("📧 Mock email would be sent:");
            console.log("   To:", mailOptions.to);
            console.log("   Subject:", mailOptions.subject);
            return {
              messageId: `mock-${Date.now()}@localhost`,
              accepted: [mailOptions.to],
              rejected: [],
            };
          },
        };
      }
    }
  }
};

// Email configuration
const emailConfig = {
  from: {
    name: process.env.EMAIL_FROM_NAME || "South Side Brews",
    email: process.env.EMAIL_FROM || "noreply@southsidebrews.com",
  },
  support: process.env.EMAIL_SUPPORT || "support@southsidebrews.com",
};

// Get formatted sender
const getFromAddress = () => {
  return `"${emailConfig.from.name}" <${emailConfig.from.email}>`;
};

module.exports = {
  createTransporter,
  emailConfig,
  getFromAddress,
};
