import { NextRequest, NextResponse } from 'next/server';

// Lightweight JWT decode for Edge runtime (no Node.js crypto needed).
// Full signature verification still happens in every API route via lib/auth.ts.
function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isOrgRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/preview');
  const isStudentRoute =
    pathname === '/student' ||
    pathname.startsWith('/student/') ||
    pathname.startsWith('/instructions/') ||
    pathname.startsWith('/test/') ||
    pathname.startsWith('/analyse/');

  if (!isOrgRoute && !isStudentRoute) return NextResponse.next();

  const token = req.cookies.get('auth_token')?.value;
  const payload = token ? decodeJwtPayload(token) : null;

  if (isOrgRoute && (!payload || payload.role !== 'org')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isStudentRoute && (!payload || payload.role !== 'student')) {
    const url = new URL('/login/student', req.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/preview/:path*',
    '/student',
    '/student/:path*',
    '/instructions/:path*',
    '/test/:path*',
    '/analyse/:path*',
  ],
};
