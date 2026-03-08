/**
 * GET /api/auth/me
 * Returns the current authenticated user from the accessToken httpOnly cookie.
 *
 * HIPAA Compliance:
 * - No PHI is returned (only id, email, role)
 * - Token is read from httpOnly cookie (not localStorage)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = request.cookies.get('accessToken')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const payload = await verifyAccessToken(token);

    return NextResponse.json({
      user: {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid or expired token', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
}
