# Rimal Health E2E Tests

End-to-end tests for the Rimal Health telehealth platform using Playwright.

## Test Coverage

### 1. Sign Up Flow (`signup.spec.ts`)
- Registration page display
- Form validation (email, password, terms)
- Password strength indicator
- Successful account creation
- Error handling for existing email
- Accessibility checks

### 2. Checkout Flow (`checkout.spec.ts`)
- Multi-step checkout process
  - Step 1: Personal Information
  - Step 2: Address (California-only validation)
  - Step 3: Treatment Screening
  - Step 4: Review and Consent
- Field validation at each step
- Navigation between steps
- Redirect to payment

### 3. Intake Submission (`intake.spec.ts`)
- Medical history section
- Medications section
- Condition-specific assessments:
  - AUDIT-C for alcohol
- Previous treatment history
- Consent and signature

### 4. MD Review Flow (`review.spec.ts`)
- Physician login
- Patient queue view
- Queue filtering and sorting
- Intake review page
- Clinical decision making:
  - Approve with medication
  - Request more information
  - Decline with reason
- Patient details view

### 5. Messaging Flow (`messaging.spec.ts`)
- Patient messaging interface
- Compose and send messages
- Message threading
- Physician inbox
- Reply to messages
- HIPAA compliance indicators

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run with UI mode (for debugging)
```bash
npm run test:e2e:ui
```

### Run specific test file
```bash
npx playwright test signup.spec.ts
```

### Run tests in specific browser
```bash
npx playwright test --project=chromium
```

### Debug mode
```bash
npm run test:e2e:debug
```

### View HTML report
```bash
npm run test:e2e:report
```

## Test Configuration

Configuration is in `playwright.config.ts`:
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: Pixel 5, iPhone 12
- **Base URL**: `http://localhost:3000`
- **Retries**: 2 on CI, 0 locally
- **Workers**: 1 on CI, auto locally

## Test Data

Test fixtures are in `fixtures/test-users.ts`:
- `testPatient` - Standard patient user
- `testPhysician` - Physician user
- `testAdmin` - Admin user
- `generateTestPatient()` - Creates unique patient data
- `testIntakeData` - Sample intake form responses

## Utilities

### Authentication (`utils/auth.ts`)
- `loginAsPatient(page, patient)`
- `loginAsPhysician(page, physician)`
- `loginAsAdmin(page, admin)`
- `logout(page)`

### Helpers (`utils/helpers.ts`)
- `waitForPageLoad(page)`
- `fillField(page, selector, value)`
- `waitForToast(page, message)`
- `fillDateInput(page, selector, date)`
- `fillPhoneInput(page, selector, phone)`

## Environment Variables

Create `.env.test` for test-specific configuration:

```bash
# Test environment
NODE_ENV=test
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Test credentials (for pre-seeded test users)
TEST_PATIENT_EMAIL=test-patient@example.com
TEST_PATIENT_PASSWORD=testpass123
TEST_PHYSICIAN_EMAIL=test-physician@example.com
TEST_PHYSICIAN_PASSWORD=testpass123
```

## CI/CD Integration

Tests run automatically in CI with:
- HTML report generation
- Screenshots on failure
- Video recording on retry
- Trace collection for debugging

## Best Practices

1. **Use data-testid attributes** for element selection when possible
2. **Generate unique data** for signup tests to avoid conflicts
3. **Wait for API responses** after form submissions
4. **Check both success and error paths**
5. **Use helper functions** for common operations
6. **Add accessibility checks** where relevant

## Troubleshooting

### Tests fail locally but pass in CI
- Check if dev server is running on port 3000
- Clear browser cache: `npx playwright clear-cache`
- Update browsers: `npx playwright install`

### Element not found errors
- Add `await page.waitForLoadState('networkidle')`
- Use `data-testid` attributes instead of text selectors
- Check for animation delays

### Flaky tests
- Increase timeout: `{ timeout: 15000 }`
- Add explicit waits for dynamic content
- Use retry configuration for known flaky areas

## Adding New Tests

1. Create new `.spec.ts` file in `tests/e2e/`
2. Import utilities from `utils/` and `fixtures/`
3. Use `test.describe()` for grouping
4. Add `test.beforeEach()` for common setup
5. Run with `--ui` flag to debug

## Maintenance

- Update selectors when UI changes
- Review and update test data periodically
- Keep tests independent (don't rely on state from other tests)
- Document any test-specific requirements
