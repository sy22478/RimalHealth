# Authentication System Setup Guide

## Overview

This document describes the complete authentication system for the Rimal Health telehealth platform.

## Architecture

The authentication system uses a **custom JWT-based approach** (not NextAuth.js) with the following components:

- **JWT Tokens**: Short-lived access tokens (15 min) + long-lived refresh tokens (7 days)
- **Role-Based Access Control**: PATIENT, PHYSICIAN, ADMIN roles
- **Account Lockout**: 5 failed attempts = 15-minute lockout
- **Redis Storage**: Session state and rate limiting
- **Prisma**: User data and session persistence

## File Structure

```
lib/
├── auth/
│   ├── index.ts              # Central exports
│   ├── jwt.ts                # JWT token generation/verification
│   ├── password.ts           # bcrypt password hashing
│   ├── rbac.ts               # Role-based access control
│   ├── session.ts            # Session management
│   ├── session-helpers.ts    # Server component helpers
│   ├── require-auth.ts       # API route middleware
│   └── account-lockout.ts    # Account lockout system
├── middleware.ts             # Route protection middleware
└── redis/
    └── client.ts             # Redis connection

types/
├── next-auth.d.ts            # TypeScript definitions
└── index.ts                  # Type exports

app/
├── api/auth/
│   ├── login/route.ts        # Login endpoint
│   ├── register/route.ts     # Registration endpoint
│   ├── logout/route.ts       # Logout endpoint
│   └── refresh/route.ts      # Token refresh endpoint
├── (auth)/
│   ├── layout.tsx            # Auth layout
│   ├── login/page.tsx        # Login page
│   └── signup/page.tsx       # Signup page
├── logout/page.tsx           # Logout handler
└── unauthorized/page.tsx     # 403 page

components/forms/
├── LoginForm.tsx             # Login form
└── SignUpForm.tsx            # Registration form
```

## Environment Variables

Add these to `.env.local`:

```bash
# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rimalhealth

# Redis (optional, falls back to localhost)
REDIS_URL=redis://localhost:6379

# Email Verification (optional)
REQUIRE_EMAIL_VERIFICATION=false

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Usage

### 1. Protecting API Routes

```typescript
// app/api/patient/data/route.ts
import { requireAuth, requireRole } from '@/lib/auth';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  // Or require specific role
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;
  
  const { userId, role } = auth.user;
  // ... handle request
}
```

### 2. Protecting Server Components

```typescript
// app/patient/dashboard/page.tsx
import { requireAuth, requireRole } from '@/lib/auth/session-helpers';
import { Role } from '@prisma/client';

export default async function DashboardPage() {
  // Require authentication (redirects to login if not authenticated)
  const user = await requireAuth();
  
  // Or require specific role
  const user = await requireRole([Role.PATIENT]);
  
  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <p>Role: {user.role}</p>
    </div>
  );
}
```

### 3. Checking Authentication in Server Components

```typescript
// app/some-page/page.tsx
import { getCurrentUser, isAuthenticated } from '@/lib/auth/session-helpers';

export default async function SomePage() {
  const user = await getCurrentUser();
  
  if (!user) {
    return <div>Please log in</div>;
  }
  
  return <div>Hello, {user.email}</div>;
}
```

### 4. Server Actions

```typescript
// app/actions.ts
'use server';

import { authenticateAction, authorizeAction } from '@/lib/auth/session-helpers';
import { Role } from '@prisma/client';

export async function updatePatientData(formData: FormData) {
  // Authenticate
  const auth = await authenticateAction();
  if (!auth.success) return auth;
  
  const { user } = auth;
  // ... perform action
}

export async function adminAction() {
  // Authorize (check role)
  const auth = await authorizeAction([Role.ADMIN]);
  if (!auth.success) return auth;
  
  // ... perform admin action
}
```

### 5. Client-Side Usage

```typescript
'use client';

// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const data = await response.json();

if (data.accessToken) {
  // Store tokens (consider httpOnly cookies for production)
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  
  // Redirect based on role
  router.push(data.redirectUrl);
}

// Logout
await fetch('/api/auth/logout', { method: 'POST' });
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

## Route Protection

The middleware (`middleware.ts`) automatically protects routes based on these patterns:

| Route Pattern | Required Role |
|--------------|---------------|
| `/patient/*` | PATIENT |
| `/physician/*` | PHYSICIAN |
| `/admin/*` | ADMIN |
| `/checkout/*` | Any authenticated |
| `/intake/*` | PATIENT |

### Public Routes (No authentication required)

- `/`, `/about`, `/pricing`, `/faq`, `/contact`
- `/login`, `/signup`, `/forgot-password`
- `/alcohol-treatment`
- `/privacy`, `/terms`, `/hipaa`

## Role-Based Access Control

### Permissions

```typescript
import { Permission, hasPermission } from '@/lib/auth/rbac';

// Check single permission
if (hasPermission(user.role, Permission.VIEW_PATIENT_DETAILS)) {
  // Allow access
}

// Check multiple permissions
import { hasAllPermissions, hasAnyPermission } from '@/lib/auth/rbac';

// Must have ALL permissions
const canManagePrescriptions = hasAllPermissions(user.role, [
  Permission.CREATE_PRESCRIPTION,
  Permission.SEND_PRESCRIPTION,
]);

// Must have ANY permission
const canViewPatients = hasAnyPermission(user.role, [
  Permission.VIEW_ALL_PATIENTS,
  Permission.VIEW_PATIENT_DETAILS,
]);
```

### Role Hierarchy

- **PATIENT**: Self-service only (own data)
- **PHYSICIAN**: Clinical access (all patients for care delivery)
- **ADMIN**: Full system access

## Account Lockout

Configuration:
- **Max Attempts**: 5
- **Lockout Duration**: 15 minutes
- **Progressive Delays**: 1s, 2s, 4s, 8s, 16s

The lockout system uses Redis for distributed state management.

## Security Features

1. **Password Hashing**: bcrypt with 12 rounds
2. **Token Expiration**: 15 min access, 7 days refresh
3. **Token Versioning**: For "logout all devices"
4. **IP Rate Limiting**: 30 requests/minute per IP
5. **Account Lockout**: After 5 failed attempts
6. **Secure Cookies**: httpOnly, secure in production
7. **CSRF Protection**: SameSite strict cookies

## Token Refresh

Access tokens expire after 15 minutes. To refresh:

```typescript
const response = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken }),
});

const data = await response.json();
// Store new tokens
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Email or password incorrect |
| `ACCOUNT_LOCKED` | Too many failed attempts |
| `EMAIL_NOT_VERIFIED` | Email verification required |
| `TOKEN_EXPIRED` | JWT token expired |
| `INVALID_TOKEN` | JWT token invalid |
| `SESSION_INVALIDATED` | Token version mismatch |
| `UNAUTHORIZED` | No authentication provided |
| `FORBIDDEN` | Insufficient permissions |
| `RATE_LIMITED` | Too many requests |

## Testing

### Creating a Test User

```typescript
// scripts/create-test-user.ts
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';

async function createTestUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash,
      role: Role.PATIENT,
      emailVerified: true,
    },
  });
  
  console.log('Created user:', user.id);
}

createTestUser();
```

## Troubleshooting

### Redis Connection Issues

If Redis is not available, the account lockout system will fail gracefully. For development:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine
```

### JWT Secret Issues

Ensure `JWT_SECRET` is at least 32 characters:

```bash
# Generate a secure secret
openssl rand -base64 32
```

### Token Storage

For production, consider using httpOnly cookies instead of localStorage:

```typescript
// The middleware and session helpers already support cookie-based auth
// Just ensure the login API sets the cookies:

// In /api/auth/login/route.ts
import { setAuthCookies } from '@/lib/auth/session-helpers';

// After successful login
await setAuthCookies(accessToken, refreshToken);
```
