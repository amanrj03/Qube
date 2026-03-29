import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, otp: string, orgName: string) {
  await transporter.sendMail({
    from: `"Examiz" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your Examiz Password Reset OTP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <h2 style="color:#1e40af;margin-bottom:8px;">Password Reset</h2>
        <p style="color:#374151;">Hi <strong>${orgName}</strong>,</p>
        <p style="color:#374151;">Use the OTP below to reset your Examiz password. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#fff;border:2px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#1e40af;">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
