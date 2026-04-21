# Runtime Testing Gap Analysis

**Date:** 2026-04-21
**Context:** After fixing 16+ issues across 4 commits (14645e4, bafb914, 9ed7236, 2722149), we analyzed why the earlier Playwright MCP runtime testing sessions missed these bugs.

---

## Issues Missed (by failure mode)

### Mode 1: Data-Dependent Bugs Invisible With Test Data
| Bug | Why Missed |
|-----|-----------|
| `[object Object]` in medical chips | Test accounts had empty or string-shaped fields — `Object.values()` on empty data never trips |
| Doctor's note truncated at 120 chars | Test notes were short — truncation invisible below threshold |

**Root cause:** No instruction to test with diverse data shapes (strings, arrays, nested objects) and realistic lengths.

---

### Mode 2: Timezone-Dependent Bugs
| Bug | Why Missed |
|-----|-----------|
| DOB off by one day (April 3 → April 2) | Server parses ISO as UTC midnight → displays as previous day in Pacific. Only visible if tester is in Pacific AND remembers the exact date entered |

**Root cause:** No instruction to verify date round-trips, no timezone-variant testing.

---

### Mode 3: Viewport-Dependent Bugs
| Bug | Why Missed |
|-----|-----------|
| Prescription details overflow | Decision sidebar `lg:col-span-3` (25% width) — bug only at 1024-1280px |
| Blank Quantity/Refills | Inputs too narrow to render recognizably on constrained sidebar |

**Root cause:** Testing at single (default) viewport. No breakpoint sweep.

---

### Mode 4: Cross-Role Data Integrity
| Bug | Why Missed |
|-----|-----------|
| Pharmacy match case-sensitive | Patient enters "cvs pharmacy" → no FK match to "CVS Pharmacy" |
| DOB off by one day | Patient enters → doctor sees different (only visible cross-role) |
| Doctor writes note → doctor can't read back | Write-only testing; never verified read-back in same role |

**Root cause:** Testing validates each role independently. Nobody verifies data flowing between roles is byte-identical.

---

### Mode 5: Business Logic / Copy Contradictions
| Bug | Why Missed |
|-----|-----------|
| Prescription card: "No Active Prescription" vs "will appear once sent" | Elements present, no error. Bug is in meaning, not mechanics |
| MFA banner says "Required" after made optional | Technically renders; contradicts current business rule |
| Redundant dashboard widgets | Functional, just duplicates sidebar tabs |

**Root cause:** No instruction to read all text for coherence. Playwright checks element existence, not semantic correctness.

---

### Mode 6: Input Validation Edge Cases
| Bug | Why Missed |
|-----|-----------|
| ZIP regex rejects 90210-1234 (ZIP+4) | Testers use happy-path "90210" |
| Case-sensitive pharmacy match | Nobody tries "cvs" vs "CVS" |

**Root cause:** No explicit edge-case input matrix per form field.

---

### Mode 7: Silent Backend Bugs (API success, wrong shape)
| Bug | Why Missed |
|-----|-----------|
| Doctor's note truncated server-side before UI sees it | API returns 200, UI renders without error |
| Dead complexity sort option | Works (sorts by something), just meaningless |

**Root cause:** UI-only testing cannot detect API response shape bugs. Requires network inspection.

---

## The Structural Gap

Old prompts treated runtime testing as: **"Click through the UI and see if anything looks broken."**

This catches ~40% of real bugs. The remaining 60% require structured adversarial testing across **five orthogonal axes**:

| Axis | What to vary | What bugs it catches |
|------|--------------|---------------------|
| **Data shape** | Empty / string / array / object / null | Serialization bugs |
| **Data size** | 0 / small / boundary / huge | Truncation bugs |
| **Viewport** | 1024 / 1280 / 1536 / 1920 / mobile | CSS overflow bugs |
| **Timezone** | UTC / Pacific / browser default | Date drift bugs |
| **Role flow** | Single-role / cross-role | Data consistency bugs |

Plus three complementary inspection layers:

| Layer | Method | What it catches |
|-------|--------|-----------------|
| **Network inspection** | Check API response shapes in DevTools | Truncation, missing fields, wrong types |
| **Copy audit** | Read all user-facing text | Contradictions, stale language, misleading states |
| **Negative path** | Try forbidden actions | Gate bypasses, resubmission, unauthorized access |

---

## Improved Prompt Structure (6 sections)

Every runtime testing prompt should include:

1. SETUP — test accounts with DIVERSE data, viewport sizes, browser timezone
2. HAPPY PATH — golden flow with expected outputs per step
3. DATA SHAPE MATRIX — test each field with empty/string/array/object/long/special chars; inspect API response shape
4. CROSS-ROLE VERIFICATION — role A writes "MemorableValue123", role B verifies byte-identical read
5. EDGE CASES & NEGATIVE PATHS — edge inputs per field, bypass attempts per gate, timezone boundaries
6. AUDIT CHECKLIST — copy audit, network inspection, viewport sweep, dead-code check

---

## Key Principle

> **Test what you can't see, not just what you can.**
>
> UI renders are the tip of the iceberg. Most bugs live in: API response shapes, cross-role data consistency, viewport edge cases, timezone interpretations, and semantic coherence of copy. A runtime test that only validates "page loads + elements present" is a false confidence generator.
