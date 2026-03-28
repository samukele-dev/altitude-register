const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  initialize() {
    try {
      // Only initialize if SMTP is configured
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_USER !== 'test@gmail.com') {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        });
        console.log('📧 Email service initialized');
      } else {
        console.log('⚠️ Email service not configured (using mock mode)');
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  async sendDailyReport(recipients, reportData, fileBuffer, fileName) {
    try {
      if (!this.transporter) {
        console.log('📧 Email service not configured - would send email to:', recipients);
        console.log('Report data:', reportData);
        return { success: true, mock: true };
      }

      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: recipients.join(', '),
        subject: `Altitude Register System - Daily Attendance Report ${date}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
              .stats { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📊 Altitude Register System</h1>
                <p>Daily Attendance Report</p>
              </div>
              <div class="content">
                <h2>Report Date: ${date}</h2>
                <div class="stats">
                  <p><strong>Total Clocked In:</strong> ${reportData.totalClockedIn}</p>
                  <p><strong>Total Employees:</strong> ${reportData.totalEmployees}</p>
                  <p><strong>Attendance Rate:</strong> ${(reportData.attendanceRate * 100).toFixed(1)}%</p>
                </div>
                <p>Please find the detailed Excel report attached.</p>
                <p>This is an automated message.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Altitude Call Center</p>
              </div>
            </div>
          </body>
          </html>
        `,
        attachments: [{
          filename: fileName,
          content: fileBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }]
      };

      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, info };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(employee) {
    try {
      if (!this.transporter) {
        console.log('📧 Would send welcome email to:', employee.email);
        return { success: true, mock: true };
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: employee.email,
        subject: 'Welcome to Altitude Call Center!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #2a5298;">Welcome to Altitude, ${employee.firstName}!</h2>
            <p>Your account has been successfully created.</p>
            <p><strong>Employee Details:</strong></p>
            <ul>
              <li>Employee ID: ${employee.employeeId}</li>
              <li>Campaign: ${employee.campaign}</li>
              <li>Team: ${employee.team}</li>
            </ul>
            <p>To clock in/out, place your finger on the fingerprint scanner.</p>
            <p>Welcome aboard!</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();