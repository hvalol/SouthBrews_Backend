const nodemailer = require("nodemailer");
const { createTransporter, getFromAddress } = require("../config/email");
const Settings = require("../models/Settings");

/**
 * Email Service
 * Handles sending emails with proper templates
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.transporterPromise = null;
    this.settings = null;
    this.settingsLastFetched = null;
  }

  /**
   * Get settings with caching (refresh every 5 minutes)
   */
  async getSettings() {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (
      !this.settings ||
      !this.settingsLastFetched ||
      now - this.settingsLastFetched > fiveMinutes
    ) {
      this.settings = await Settings.getSingleton();
      this.settingsLastFetched = now;
    }

    return this.settings;
  }

  /**
   * Initialize transporter (lazy loading)
   */
  async getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    if (!this.transporterPromise) {
      this.transporterPromise = createTransporter();
    }

    this.transporter = await this.transporterPromise;
    return this.transporter;
  }

  /**
   * Send email with retry logic
   */
  async sendEmail(options) {
    try {
      const transporter = await this.getTransporter();

      const mailOptions = {
        from: getFromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await transporter.sendMail(mailOptions);

      console.log("✅ Email sent successfully:", info.messageId);

      // For Ethereal Email, log preview URL
      if (process.env.NODE_ENV !== "production") {
        const previewURL = nodemailer.getTestMessageUrl(info);
        if (previewURL) {
          console.log("📧 Preview URL:", previewURL);
        }
      }

      return {
        success: true,
        messageId: info.messageId,
        previewURL: nodemailer.getTestMessageUrl(info),
      };
    } catch (error) {
      console.error("❌ Email sending failed:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send reservation confirmation email
   */
  async sendReservationConfirmation(reservation) {
    const {
      contactInfo,
      date,
      time,
      partySize,
      occasion,
      specialRequests,
      user,
    } = reservation;

    // Get settings for business info
    const settings = await this.getSettings();
    const businessName = settings?.general?.businessName || "South Side Brews";
    const businessPhone = settings?.general?.phone || "+1 (555) 123-4567";
    const businessEmail = settings?.general?.email || "info@southsidebrews.com";
    const businessAddress =
      settings?.general?.address ||
      "123 Mountain View Road, Forest Hills, CA 90210";

    // Get customer name from contactInfo
    const customerName = contactInfo.name || "Valued Customer";

    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Format time to 12-hour format
    const formatTime = (time24) => {
      const [hours, minutes] = time24.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    const formattedTime = formatTime(time);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #2D5016 0%, #3a6b1e 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .header h1 { margin: 0 0 10px 0; font-size: 32px; }
          .header p { margin: 0; font-size: 16px; opacity: 0.95; }
          .content { padding: 40px 30px; background: #ffffff; }
          .greeting { font-size: 18px; color: #2D5016; margin-bottom: 20px; }
          .reservation-details { background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #2D5016; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e0e0e0; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: 600; color: #2D5016; }
          .detail-value { color: #333; font-weight: 500; }
          .alert-box { background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #D4A574; margin: 25px 0; }
          .alert-box strong { color: #8B4513; display: block; margin-bottom: 8px; font-size: 16px; }
          .button { display: inline-block; background: #2D5016; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; transition: background 0.3s; }
          .button:hover { background: #3a6b1e; }
          .contact-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; }
          .contact-info p { margin: 8px 0; }
          .footer { background: #2D5016; color: white; text-align: center; padding: 30px; }
          .footer p { margin: 8px 0; opacity: 0.9; }
          .footer a { color: #D4A574; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">☕ ${businessName}</div>
            <h1>Reservation Confirmed!</h1>
            <p>We're excited to welcome you</p>
          </div>
          <div class="content">
            <p class="greeting">Hello ${customerName},</p>
            <p>Thank you for choosing ${businessName}! Your reservation has been confirmed and we can't wait to serve you.</p>
            
            <div class="reservation-details">
              <h3 style="margin-top: 0; color: #2D5016; font-size: 20px;">📅 Reservation Details</h3>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${formattedTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Party Size:</span>
                <span class="detail-value">${partySize} ${
      partySize === 1 ? "guest" : "guests"
    }</span>
              </div>
              ${
                occasion && occasion !== "other"
                  ? `
              <div class="detail-row">
                <span class="detail-label">Occasion:</span>
                <span class="detail-value">${
                  occasion.charAt(0).toUpperCase() + occasion.slice(1)
                }</span>
              </div>
              `
                  : ""
              }
              ${
                specialRequests
                  ? `
              <div class="detail-row">
                <span class="detail-label">Special Requests:</span>
                <span class="detail-value">${specialRequests}</span>
              </div>
              `
                  : ""
              }
              <div class="detail-row">
                <span class="detail-label">Reservation ID:</span>
                <span class="detail-value">#${reservation._id
                  .toString()
                  .slice(-8)
                  .toUpperCase()}</span>
              </div>
            </div>

            <div class="alert-box">
              <strong>⏰ Important Reminders</strong>
              <p style="margin: 5px 0; font-size: 14px; color: #666;">• Please arrive 10-15 minutes before your reservation time</p>
              <p style="margin: 5px 0; font-size: 14px; color: #666;">• Your table will be held for 15 minutes past your reservation time</p>
              <p style="margin: 5px 0; font-size: 14px; color: #666;">• Please bring your reservation ID for faster check-in</p>
            </div>

            <div class="contact-info">
              <h3 style="color: #2D5016; margin-top: 0;">Need to Make Changes?</h3>
              <p><strong>📞 Phone:</strong> <a href="tel:${businessPhone.replace(
                /\D/g,
                ""
              )}" style="color: #2D5016; text-decoration: none;">${businessPhone}</a></p>
              <p><strong>📧 Email:</strong> <a href="mailto:${businessEmail}" style="color: #2D5016; text-decoration: none;">${businessEmail}</a></p>
              <p style="font-size: 14px; color: #666; margin-top: 12px;">Or simply reply to this email and we'll assist you.</p>
            </div>

            <div style="text-align: center;">
              <a href="${
                process.env.FRONTEND_URL || "http://localhost:5173"
              }/profile?tab=reservations" class="button">View My Reservations</a>
            </div>

            <p style="margin-top: 30px; color: #666;">We look forward to providing you with an exceptional dining experience!</p>
            <p style="color: #2D5016; font-weight: 600; font-size: 16px;">The ${businessName} Team</p>
          </div>
          <div class="footer">
            <p style="font-size: 16px; font-weight: 600; margin-bottom: 15px;">${businessName}</p>
            <p>📍 ${businessAddress}</p>
            <p>📞 ${businessPhone} | 📧 ${businessEmail}</p>
            <p style="margin-top: 15px; font-size: 11px; opacity: 0.8;">This is an automated confirmation email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Reservation Confirmed!

Hello ${customerName},

Thank you for choosing ${businessName}! Your reservation has been confirmed.

RESERVATION DETAILS:
Date: ${formattedDate}
Time: ${formattedTime}
Party Size: ${partySize} ${partySize === 1 ? "guest" : "guests"}
${
  occasion && occasion !== "other"
    ? `Occasion: ${occasion.charAt(0).toUpperCase() + occasion.slice(1)}`
    : ""
}
${specialRequests ? `Special Requests: ${specialRequests}` : ""}
Reservation ID: #${reservation._id.toString().slice(-8).toUpperCase()}

IMPORTANT REMINDERS:
• Please arrive 10-15 minutes before your reservation time
• Your table will be held for 15 minutes past your reservation time
• Bring your reservation ID for faster check-in

NEED TO MAKE CHANGES?
Phone: ${businessPhone}
Email: ${businessEmail}

Or simply reply to this email and we'll assist you.

We look forward to providing you with an exceptional dining experience!
The ${businessName} Team

${businessName}
${businessAddress}
${businessPhone} | ${businessEmail}
    `;

    return this.sendEmail({
      to: contactInfo.email,
      subject: `Reservation Confirmed - ${businessName}`,
      html,
      text,
    });
  }

  /**
   * Send reservation reminder email
   */
  async sendReservationReminder(reservation) {
    const { contactInfo, date, time, partySize } = reservation;

    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .reminder-box { background: #fff; padding: 25px; border-radius: 8px; text-align: center; border: 3px solid #667eea; margin: 20px 0; }
          .big-time { font-size: 36px; color: #667eea; font-weight: bold; margin: 10px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .button-cancel { background: #dc3545; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Reservation Reminder</h1>
            <p>We're looking forward to seeing you soon!</p>
          </div>
          <div class="content">
            <p>Hello ${contactInfo.name},</p>
            <p>This is a friendly reminder about your upcoming reservation at South Side Brews.</p>
            
            <div class="reminder-box">
              <h2 style="margin-top: 0; color: #667eea;">Your Reservation</h2>
              <div class="big-time">${time}</div>
              <p style="font-size: 18px; margin: 10px 0;">${formattedDate}</p>
              <p style="font-size: 16px; color: #666;">Party of ${partySize}</p>
              <p style="margin-top: 20px; font-size: 14px;">Reservation ID: #${reservation._id
                .toString()
                .slice(-8)
                .toUpperCase()}</p>
            </div>

            <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
              <strong>✅ What to know:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Please arrive 10 minutes early</li>
                <li>Your table will be held for 15 minutes</li>
                <li>Bring your reservation confirmation</li>
              </ul>
            </div>

            <p style="text-align: center; margin: 30px 0;">
              <a href="${
                process.env.FRONTEND_URL || "http://localhost:5173"
              }/reservation" class="button">View Details</a>
              <a href="${
                process.env.FRONTEND_URL || "http://localhost:5173"
              }/contact" class="button button-cancel">Cancel Reservation</a>
            </p>

            <p>If you need to modify your reservation, please contact us at <a href="tel:+1234567890">(123) 456-7890</a>.</p>

            <p style="margin-top: 30px;">See you soon!</p>
            <p><strong>The South Side Brews Team</strong></p>
          </div>
          <div class="footer">
            <p>South Side Brews | 123 Coffee Street, Brew City, BC 12345</p>
            <p>Questions? Email us at support@southsidebrews.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Reservation Reminder

Hello ${contactInfo.name},

This is a friendly reminder about your upcoming reservation at South Side Brews.

YOUR RESERVATION:
Time: ${time}
Date: ${formattedDate}
Party Size: ${partySize} ${partySize === 1 ? "guest" : "guests"}
Reservation ID: #${reservation._id.toString().slice(-8).toUpperCase()}

WHAT TO KNOW:
- Please arrive 10 minutes early
- Your table will be held for 15 minutes
- Bring your reservation confirmation

If you need to modify your reservation, please contact us at (123) 456-7890.

See you soon!
The South Side Brews Team

South Side Brews | 123 Coffee Street, Brew City, BC 12345
Questions? Email us at support@southsidebrews.com
    `;

    return this.sendEmail({
      to: contactInfo.email,
      subject: "⏰ Reminder: Your Reservation at South Side Brews",
      html,
      text,
    });
  }

  /**
   * Send reservation cancellation email
   */
  async sendReservationCancellation(reservation) {
    const { contactInfo, date, time, partySize } = reservation;

    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6c757d; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reservation Cancelled</h1>
          </div>
          <div class="content">
            <p>Hello ${contactInfo.name},</p>
            <p>Your reservation at South Side Brews has been cancelled as requested.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Cancelled Reservation:</h3>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${time}</p>
              <p><strong>Party Size:</strong> ${partySize} ${
      partySize === 1 ? "guest" : "guests"
    }</p>
              <p><strong>Reservation ID:</strong> #${reservation._id
                .toString()
                .slice(-8)
                .toUpperCase()}</p>
            </div>

            <p>We're sorry we won't be seeing you this time. We hope to serve you in the future!</p>

            <div style="text-align: center;">
              <a href="${
                process.env.FRONTEND_URL || "http://localhost:5173"
              }/reservation" class="button">Make New Reservation</a>
            </div>

            <p style="margin-top: 30px;">If you have any questions, please contact us at <a href="tel:+1234567890">(123) 456-7890</a>.</p>

            <p><strong>The South Side Brews Team</strong></p>
          </div>
          <div class="footer">
            <p>South Side Brews | 123 Coffee Street, Brew City, BC 12345</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Reservation Cancelled

Hello ${contactInfo.name},

Your reservation at South Side Brews has been cancelled as requested.

CANCELLED RESERVATION:
Date: ${formattedDate}
Time: ${time}
Party Size: ${partySize} ${partySize === 1 ? "guest" : "guests"}
Reservation ID: #${reservation._id.toString().slice(-8).toUpperCase()}

We're sorry we won't be seeing you this time. We hope to serve you in the future!

If you have any questions, please contact us at (123) 456-7890.

The South Side Brews Team
South Side Brews | 123 Coffee Street, Brew City, BC 12345
    `;

    return this.sendEmail({
      to: contactInfo.email,
      subject: "Reservation Cancelled - South Side Brews",
      html,
      text,
    });
  }
}

// Export singleton instance
module.exports = new EmailService();
