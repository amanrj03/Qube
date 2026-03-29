import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// POST /api/auth/org/reset-password — verify OTP and set new password
export async function POST(req: NextRequest) {
  const { email, otp, newPassword } = await req.json();
  if (!email || !otp || !newPassword)
    return NextResponse.json({ error: 'email, otp and newPassword required' }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { email } });
  if (!org) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  if (!org.otpCode || org.otpCode !== otp)
    return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });

  if (!org.otpExpiresAt || new Date() > org.otpExpiresAt)
    return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });

  if (newPassword.length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.organization.update({
    where: { email },
    data: { password: hashed, otpCode: null, otpExpiresAt: null },
  });

  return NextResponse.json({ success: true, message: 'Password reset successfully' });
}
