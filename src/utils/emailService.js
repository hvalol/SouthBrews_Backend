const nodemailer = require("nodemailer");
const { createTransporter, getFromAddress } = require("../config/email");

/**
 * Email Service
 * Handles sending emails with proper templates
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.transporterPromise = null;
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
    const { contactInfo, date, time, partySize, occasion, specialRequests } =
      reservation;

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
          .reservation-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #667eea; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Reservation Confirmed!</h1>
            <p>We're excited to see you at South Side Brews</p>
          </div>
          <div class="content">
            <p>Hello ${contactInfo.name},</p>
            <p>Thank you for choosing South Side Brews! Your reservation has been confirmed.</p>
            
            <div class="reservation-details">
              <h3 style="margin-top: 0; color: #667eea;">Reservation Details</h3>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span>${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span>${time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Party Size:</span>
                <span>${partySize} ${
      partySize === 1 ? "guest" : "guests"
    }</span>
              </div>
              ${
                occasion
                  ? `
              <div class="detail-row">
                <span class="detail-label">Occasion:</span>
                <span>${occasion}</span>
              </div>
              `
                  : ""
              }
              ${
                specialRequests
                  ? `
              <div class="detail-row">
                <span class="detail-label">Special Requests:</span>
                <span>${specialRequests}</span>
              </div>
              `
                  : ""
              }
              <div class="detail-row" style="border-bottom: none;">
                <span class="detail-label">Reservation ID:</span>
                <span>#${reservation._id
                  .toString()
                  .slice(-8)
                  .toUpperCase()}</span>
              </div>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <strong>⏰ Please arrive 10 minutes early</strong>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Your table will be held for 15 minutes past your reservation time.</p>
            </div>

            <p><strong>Need to make changes?</strong><br>
            Contact us at <a href="tel:+1234567890">(123) 456-7890</a> or reply to this email.</p>

            <div style="text-align: center;">
              <a href="${
                process.env.FRONTEND_URL || "http://localhost:5173"
              }/reservation" class="button">Manage Reservation</a>
            </div>

            <p style="margin-top: 30px;">We look forward to serving you!</p>
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
Reservation Confirmed!

Hello ${contactInfo.name},

Thank you for choosing South Side Brews! Your reservation has been confirmed.

RESERVATION DETAILS:
Date: ${formattedDate}
Time: ${time}
Party Size: ${partySize} ${partySize === 1 ? "guest" : "guests"}
${occasion ? `Occasion: ${occasion}` : ""}
${specialRequests ? `Special Requests: ${specialRequests}` : ""}
Reservation ID: #${reservation._id.toString().slice(-8).toUpperCase()}

Please arrive 10 minutes early. Your table will be held for 15 minutes past your reservation time.

Need to make changes? Contact us at (123) 456-7890 or reply to this email.

We look forward to serving you!
The South Side Brews Team

South Side Brews | 123 Coffee Street, Brew City, BC 12345
Questions? Email us at support@southsidebrews.com
    `;

    return this.sendEmail({
      to: contactInfo.email,
      subject: "Reservation Confirmed - South Side Brews",
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
