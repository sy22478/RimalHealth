# Integration Tests

This directory contains integration tests for the Rimal Health API endpoints.

## Test Structure

```
tests/
├── integration/          # Integration tests
│   ├── setup.ts         # Test environment setup
│   ├── auth.test.ts     # Auth endpoint tests
│   ├── patient.test.ts  # Patient endpoint tests
│   ├── physician.test.ts # Physician endpoint tests
│   └── webhooks.test.ts # Webhook handler tests
├── helpers/             # Test utilities
│   └── auth.ts          # Authentication helpers
└── README.md            # This file
```

## Prerequisites

Before running tests, ensure:

1. **Prisma Client is generated**:
   ```bash
   npm run db:generate
   ```

2. **Test database is configured**:
   ```bash
   cp .env.test.example .env.test
   # Edit .env.test with your test database credentials
   ```

3. **Test database exists**:
   ```bash
   createdb rimalhealth_test
   ```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx vitest run tests/integration/auth.test.ts

# Run tests with debug output
DEBUG_TESTS=true npm test
```

## Environment Variables

Create a `.env.test` file with:

```bash
# Required
DATABASE_URL_TEST="postgresql://user:password@localhost:5432/rimalhealth_test"
JWT_SECRET="test-jwt-secret-minimum-32-characters-long"

# Optional (for specific tests)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_test_..."
```

## Test Database

Tests use a separate PostgreSQL database to ensure isolation:
- Database is cleaned before each test
- All test data is removed after tests complete
- Never run tests against production databases

## Test Categories

### Auth Tests (`auth.test.ts`)

Tests authentication endpoints:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Token refresh

**Coverage:**
- ✅ Success cases (valid registration, login, logout, refresh)
- ✅ Validation errors (invalid email, weak password, missing fields)
- ✅ Duplicate email handling
- ✅ Invalid credentials (preventing user enumeration)
- ✅ Token expiration and invalidation

### Patient Tests (`patient.test.ts`)

Tests patient-facing endpoints:
- `GET /api/patient/messages` - List message threads
- `POST /api/patient/messages` - Send message
- `GET /api/patient/prescriptions` - List prescriptions
- `POST /api/patient/prescriptions/[id]/refill` - Request refill
- `GET /api/patient/documents` - List documents

**Coverage:**
- ✅ Authenticated access to resources
- ✅ Unauthorized access rejection
- ✅ Resource creation and retrieval
- ✅ Validation error handling

### Physician Tests (`physician.test.ts`)

Tests physician-facing endpoints:
- `GET /api/physician/queue` - Patient intake queue
- `GET /api/physician/intake/[id]` - Intake details
- `POST /api/physician/review` - Submit review decision

**Coverage:**
- ✅ Queue data retrieval with filtering
- ✅ Intake detail access
- ✅ Review submission (approve, reject, request info)
- ✅ Role-based access control
- ✅ Validation of review data

### Webhook Tests (`webhooks.test.ts`)

Tests external service webhooks:
- `POST /api/webhooks/stripe` - Stripe webhooks

**Coverage:**
- ✅ Signature verification
- ✅ Event handling (checkout, invoices, subscriptions)
- ✅ Error handling and retries
- ✅ Idempotency handling

## Test Helpers

### `createTestUser(options)`

Creates a test user with tokens:

```typescript
const patient = await createTestUser({ role: 'PATIENT' });
const physician = await createTestUser({ role: 'PHYSICIAN' });

// Returns:
// {
//   id: string;
//   email: string;
//   password: string;
//   role: Role;
//   accessToken: string;
//   refreshToken: string;
// }
```

### `getAuthHeaders(accessToken)`

Returns Authorization headers:

```typescript
const headers = getAuthHeaders(user.accessToken);
// { Authorization: 'Bearer eyJ...', 'Content-Type': 'application/json' }
```

### `generateTestEmail(prefix?)`

Generates unique test email:

```typescript
const email = generateTestEmail('patient');
// patient-1234567890-abc123@example.com
```

## Writing New Tests

### Basic Test Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { POST as handler } from '@/app/api/your-route/route';
import { createTestUser, getAuthHeaders } from '@/tests/helpers/auth';

describe('POST /api/your-route', () => {
  it('should handle the request', async () => {
    // Arrange
    const user = await createTestUser({ role: 'PATIENT' });
    const request = createMockRequest(payload, {
      headers: getAuthHeaders(user.accessToken),
    });
    
    // Act
    const response = await handler(request);
    
    // Assert
    expect(response.status).toBe(200);
  });
});
```

### Request Helper

```typescript
function createMockRequest(
  body: unknown = null,
  options: {
    method?: string;
    headers?: Record<string, string>;
    url?: string;
  } = {}
): NextRequest {
  const url = options.url || 'http://localhost:3000/api/test';
  
  return new Request(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}
```

## Best Practices

1. **Use test database** - Never run tests against production
2. **Clean state** - Tests clean database before each run
3. **Use helpers** - Leverage `createTestUser()` and other utilities
4. **Test both paths** - Include success and error cases
5. **Check auth** - Verify endpoints require proper authentication
6. **Mock externals** - Use mocks for Stripe, SendGrid, etc.

## Troubleshooting

### Prisma Client Errors

If you see engine type errors:
```bash
npm run db:generate
```

### Database Connection

If tests fail to connect:
```bash
# Verify database exists
psql -l | grep rimalhealth_test

# Create if needed
createdb rimalhealth_test
```

### Test Timeouts

Increase timeout in `vitest.config.ts`:
```typescript
testTimeout: 60000,
```

## Coverage Report

After running `npm run test:coverage`, view the report:
```bash
open coverage/index.html
```
