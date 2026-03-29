import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/mailer';

// POST /api/auth/org/send-otp — send OTP to org email
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { email } });
  if (!org) return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.organization.update({
    where: { email },
    data: { otpCode: otp, otpExpiresAt: expiresAt },
  });

  try {
    await sendOtpEmail(email, otp, org.name);
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    return NextResponse.json({ error: 'Failed to send OTP email. Check SMTP config.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'OTP sent to your email' });
}
