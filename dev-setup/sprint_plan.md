# SEPA Babies Landing Page — Sprint Plan

> **Created:** 2026-03-24
> **Author:** Planning Team Orchestrator (T1)
> **Total Scope:** 14 task groups, 81 subtasks, 240 sub-subtasks
> **Current State:** Build NOT started. Product images collected. Logo, headshots, favicon MISSING.
> **Method:** Squarespace + Claude Chrome Extension browser automation

---

## PROJECT STATUS SNAPSHOT

### Assets Audit

| Asset | Status | Location | Blocker? |
|-------|--------|----------|----------|
| Kitarama (Tier 1) | HAVE | `Images/Kitarama.png` (780 KB) | No |
| Dragophant (Tier 1) | HAVE | `Images/Dragophant.png` (780 KB) | No |
| Kit (Tier 2) | HAVE | `Images/IMG_8802.jpg` (220 KB) | No |
| Drago (Tier 2) | HAVE | `Images/IMG_8804.jpg` (207 KB) | No |
| Jett (Tier 3) | HAVE | `Images/IMG_8828.JPG` (362 KB) | No |
| Lilly (Tier 3) | HAVE | `Images/IMG_8882.jpg` (248 KB) | No |
| Hero: Baby+Kitarama | HAVE | `Images/File_000(1).jpeg` (173 KB) | No |
| Hero: Child+Dragophant | HAVE | `Images/File_000.jpeg` (183 KB) | No |
| Hero: Girl+Kitarama | HAVE | `IMG_8877.jpg` (322 KB) | No |
| SEPA Babies Logo (color) | **MISSING** | Needed from Taffy | **YES — blocks Nav, Footer** |
| SEPA Babies Logo (white) | **MISSING** | Needed from Taffy | **YES — blocks Footer** |
| Favicon | **MISSING** | Derived from logo | **YES — blocks SEO polish** |
| Taffy Watts headshot | **MISSING** | Needed from Taffy | **YES — blocks Team section** |
| Sonu Yadav headshot | **MISSING** | Needed from Sonu | **YES — blocks Team section** |
| Ozzie Cortez headshot | **MISSING** | Needed from Ozzie | **YES — blocks Team section** |
| Lakeshia Bell headshot | **MISSING** | Needed from Lakeshia | **YES — blocks Team section** |
| Kristen Peters headshot | **MISSING** | Needed from Kristen | **YES — blocks Team section** |
| Open Graph image (1200x630) | **MISSING** | Can generate from hero images | Soft block — SEO polish |

### Task Completion Summary

| Task Group | Subtasks | Sub-subtasks | Done | Remaining |
|-----------|----------|--------------|------|-----------|
| 0: Pre-Requisites | 4 | 19 | 7 (images) | 12 |
| 1: Site Setup | 5 | 13 | 0 | 13 |
| 2: Navigation | 5 | 17 | 0 | 17 |
| 3: Hero | 7 | 18 | 0 | 18 |
| 4: Problem | 5 | 15 | 0 | 15 |
| 5: Solution | 6 | 16 | 0 | 16 |
| 6: Product Line | 6 | 18 | 0 | 18 |
| 7: How It Works | 7 | 16 | 0 | 16 |
| 8: Market | 5 | 14 | 0 | 14 |
| 9: Team | 5 | 15 | 0 | 15 |
| 10: Waitlist/CTA | 6 | 21 | 0 | 21 |
| 11: Footer | 3 | 11 | 0 | 11 |
| 12: Global Styling | 6 | 25 | 0 | 25 |
| 13: QA & Publish | 6 | 22 | 0 | 22 |
| **TOTAL** | **81** | **240** | **7** | **233** |

---

## SPRINT 0: PRE-BUILD PREPARATION (No Squarespace Access Needed)

**Goal:** Do everything possible offline so that once Squarespace is open, we can build without stopping.
**Duration estimate:** 2-3 hours
**Parallel teams:** T4 (Design/CSS), T5 (Content/Copy), T6 (Assets)

### 0A. Asset Collection & Generation (T6)
**Tasks:** 0.3.1, 0.3.2, 0.3.10-0.3.16

| # | Action | Task ID | Owner | Priority |
|---|--------|---------|-------|----------|
| 1 | Request SEPA Babies logo (color PNG, transparent bg) from Taffy | 0.3.1 | User/Taffy | **P0 CRITICAL** |
| 2 | Request SEPA Babies logo (white version for dark bgs) from Taffy | 0.3.2 | User/Taffy | **P0 CRITICAL** |
| 3 | Request headshot from Taffy Watts | 0.3.10 | User/Taffy | **P1 HIGH** |
| 4 | Request headshot from Sonu Yadav | 0.3.11 | User/Sonu | **P1 HIGH** |
| 5 | Request headshot from Ozzie Cortez | 0.3.12 | User/Ozzie | **P1 HIGH** |
| 6 | Request headshot from Lakeshia Bell | 0.3.13 | User/Lakeshia | **P1 HIGH** |
| 7 | Request headshot from Kristen Peters | 0.3.14 | User/Kristen | **P1 HIGH** |
| 8 | Generate Open Graph image (1200x630) from hero illustrations | 0.3.15 | T6 (automated) | P2 |
| 9 | Generate favicon from logo once received | 0.3.16 | T6 (automated) | P2 (blocked by 0.3.1) |

**Workarounds if assets are delayed:**
- Logo: Use text-only "SEPA Babies" in Poppins Bold as placeholder in Nav. Can swap in logo image later.
- Headshots: Use colored initial circles (e.g., "TW" on `#E8E4FF`) as placeholders. Team section can be built structurally and photos swapped in later.
- Favicon: Can be set after logo arrives. Not a launch blocker.

### 0B. Custom CSS Pre-Authoring (T4)
**Tasks:** 12.3.1-12.3.7 (preparation only — injection happens in Sprint 4)

Write the complete custom CSS stylesheet offline so it can be pasted into Squarespace Code Injection in a single step. The CSS must cover:

| Component | CSS Rules |
|-----------|-----------|
| Smooth scroll | `html { scroll-behavior: smooth; }` |
| Pill buttons | `.sqs-button-element--primary { border-radius: 60px; }` + hover scale(1.03) |
| Card hover effects | `translateY(-4px)` / `translateY(-8px)` with shadow transitions |
| Stat counter JS | Intersection Observer script for counting up stat numbers |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` safety net |
| Nav sticky styling | z-index, bottom border, backdrop |
| Dark section overrides | White text on `#1A1A2E` backgrounds |
| Form input focus states | Border `#7B68EE`, bg `#FAFAFF` |
| Gradient backgrounds | Hero and CTA lavender-to-white gradients |
| Timeline connector | Horizontal line between step circles (responsive to vertical on mobile) |
| Product card hover | `translateY(-8px)`, intensified shadow, 400ms ease |
| Responsive breakpoints | Mobile (375px), Tablet (768px), Desktop (1440px) overrides |

**Deliverable:** A single `<style>` block ready to paste into Code Injection > Header.

### 0C. Copy Verification & Finalization (T5)
**Tasks:** All copy from SEPA_Landing_Page_Build_Instructions.md Copy Reference section

| Section | Copy Elements to Verify |
|---------|------------------------|
| Hero | Eyebrow, headline, subheadline, social proof line |
| Problem | Title, subtitle, 4 stat labels, closing statement |
| Solution | Eyebrow, headline, body, 4 SEPA feature titles+descriptions, closing line |
| Products | Section title, 3 tier badge labels, 3 subtitles, 3 descriptions |
| How It Works | Title, subtitle, 4 step titles, 4 step descriptions |
| Market | Title, 4 stat labels, "Why Now" paragraph |
| Team | Section title, founder bio, 4 advisor titles+bios |
| CTA/Waitlist | Headline, subheadline, 3 path card titles+descriptions, 5 comparison rows |
| Footer | Company info, nav links, legal text |
| SEO | Title tag, meta description |

**Deliverable:** A verified copy document with all text finalized and approved, organized by section in build order. Any copy changes from Taffy should be captured now, not during the build.

### 0D. Brand Identity Finalization (T4/T5)
**Tasks:** 0.4.1, 0.4.2, 0.4.3

| # | Action | Task ID |
|---|--------|---------|
| 1 | Confirm full color palette (13 tokens from Design System) | 0.4.1 |
| 2 | Confirm typography scale (Poppins headings, Open Sans body, all sizes) | 0.4.2 |
| 3 | Confirm spacing system (8px base grid) | 0.4.3 |

These are already well-defined in the build instructions. Mark as done if no changes from stakeholders.

### 0E. Environment Verification
**Tasks:** 0.1.1, 0.1.2, 0.2.1, 0.2.2

| # | Action | Task ID |
|---|--------|---------|
| 1 | Verify Squarespace account exists (free trial or paid) | 0.1.1 |
| 2 | Confirm login credentials available | 0.1.2 |
| 3 | Verify Claude Chrome Extension installed | 0.2.1 |
| 4 | Test extension responsiveness | 0.2.2 |

---

## SPRINT 1: FOUNDATION — Site Setup & Global Styling (Requires Squarespace Login)

**Goal:** Create the Squarespace site, set global fonts/colors, so every section built after this inherits correct styling.
**Duration estimate:** 30-45 minutes
**Prerequisites:** Sprint 0E complete (Squarespace account + Chrome Extension working)
**Dependency:** User must manually type password (Task 1.3.4)

### 1A. Browser Session & Authentication
**Tasks:** 1.1.1, 1.1.2, 1.2.1, 1.3.1-1.3.5

| Step | Action | Tool | Task ID |
|------|--------|------|---------|
| 1 | Get browser tab context | `tabs_context_mcp` | 1.1.1 |
| 2 | Open new tab | `tabs_create_mcp` | 1.1.2 |
| 3 | Navigate to squarespace.com | `navigate` | 1.2.1 |
| 4 | Find and click "Log In" | `find` + `computer` | 1.3.1, 1.3.2 |
| 5 | Enter email | `form_input` | 1.3.3 |
| 6 | **USER TYPES PASSWORD MANUALLY** | — | 1.3.4 |
| 7 | Confirm login success | `computer` (screenshot) | 1.3.5 |

### 1B. Create Site & Set Title
**Tasks:** 1.4.1-1.4.4, 1.5.1-1.5.3

| Step | Action | Task ID |
|------|--------|---------|
| 1 | Find "Create a new site" | 1.4.1 |
| 2 | Click to start new site | 1.4.2 |
| 3 | Select **Blank** template | 1.4.3 |
| 4 | Click "Start Editing" | 1.4.4 |
| 5 | Navigate to Settings > General > Site Title | 1.5.1 |
| 6 | Set title: "SEPA Babies — Innovative Medical Monitoring Companions" | 1.5.2 |
| 7 | Save settings | 1.5.3 |

### 1C. Set Global Fonts & Colors
**Tasks:** 12.1.1-12.1.4, 12.2.1-12.2.3

| Step | Action | Task ID |
|------|--------|---------|
| 1 | Navigate to Design > Fonts | 12.1.1 |
| 2 | Set heading font: Poppins (Bold/SemiBold) | 12.1.2 |
| 3 | Set body font: Open Sans (Regular) | 12.1.3 |
| 4 | Save font settings | 12.1.4 |
| 5 | Navigate to Design > Colors | 12.2.1 |
| 6 | Apply full color palette from Design System | 12.2.2 |
| 7 | Save color settings | 12.2.3 |

**Rationale for doing this in Sprint 1:** Setting fonts and colors globally FIRST means every section built in Sprints 2-3 automatically inherits the correct typography and color scheme, reducing per-section styling work.

---

## SPRINT 2: CORE SECTIONS — Nav, Hero, Problem, Solution, Products

**Goal:** Build the top 5 sections of the page — everything above the fold and the core narrative arc.
**Duration estimate:** 3-5 hours
**Prerequisites:** Sprint 1 complete. Logo available for Nav (or use text placeholder).
**Sections:** 1 (Nav), 2 (Hero), 3 (Problem), 4 (Solution), 5 (Products)

### 2A. Navigation Bar (Section 1)
**Tasks:** 2.1-2.5 (17 sub-subtasks)
**Blocker:** Logo (Task 0.3.1). **Workaround:** Use text "SEPA Babies" in Poppins Bold if logo not yet received.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Edit header, enter edit mode | 2.1.1, 2.1.2 |
| Logo | Upload logo OR set text placeholder | 2.2.1-2.2.3 |
| Links | Add 5 anchor links (Problem, Solution, Products, How It Works, Team) | 2.3.1-2.3.5 |
| CTA | Add "Join the Waitlist" button → `#waitlist` | 2.4.1, 2.4.2 |
| Style | White bg, bottom border, link font, hover color, sticky, mobile hamburger | 2.5.1-2.5.6 |

**Screenshot checkpoint after completion.**

### 2B. Hero Section (Section 2)
**Tasks:** 3.1-3.7 (18 sub-subtasks)
**No asset blockers.** Hero images are available.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Add section, choose split layout (60/40) | 3.1.1, 3.1.2 |
| Eyebrow | "REMOTE PATIENT MONITORING FOR CHILDREN" — Poppins 600, 14px, `#7B68EE` | 3.2.1, 3.2.2 |
| Copy | Headline + subheadline | 3.3.1-3.3.4 |
| CTAs | Primary (coral pill) + Secondary (outlined pill) | 3.4.1-3.4.3 |
| Social proof | "Backed by clinicians, educators, and families..." | 3.5.1, 3.5.2 |
| Image | Upload `File_000(1).jpeg`, apply border-radius + shadow | 3.6.1, 3.6.2 |
| Background | Lavender→White gradient + fade-up animations | 3.7.1-3.7.5 |

**Screenshot checkpoint after completion.**

### 2C. Problem Section (Section 3)
**Tasks:** 4.1-4.5 (15 sub-subtasks)
**No asset blockers.** Data-driven section with stats only.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Add section, set anchor `problem`, bg `#FAFAFA`, padding 96px | 4.1.1-4.1.4 |
| Header | Title + subtitle (centered) | 4.2.1, 4.2.2 |
| Stat cards | 4 cards: 7.7M, 1 in 36, #2, 167 hrs — with colored numbers | 4.3.1-4.3.7 |
| Closing | Italic closing statement, max-width 700px | 4.4.1, 4.4.2 |
| Animation | Counter animation + stagger fade-in | 4.5.1-4.5.3 |

**Screenshot checkpoint after completion.**

### 2D. Solution Section (Section 4)
**Tasks:** 5.1-5.6 (16 sub-subtasks)
**No asset blockers.** Product images (Kitarama/Dragophant) available.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Add section, split layout (45/55), anchor `solution`, white bg | 5.1.1-5.1.3 |
| Image | Upload Kitarama.png, apply border-radius + shadow | 5.2.1, 5.2.2 |
| Copy | Eyebrow + headline + body | 5.3.1-5.3.3 |
| SEPA Grid | 4 feature cards (Sensory, Education, Productivity, Adaptability) | 5.4.1-5.4.6 |
| Closing | Italic closing line | 5.5.1, 5.5.2 |
| Animation | Stagger fade-up on feature cards | 5.6.1, 5.6.2 |

**Screenshot checkpoint after completion.**

### 2E. Product Line Section (Section 5)
**Tasks:** 6.1-6.6 (18 sub-subtasks)
**No asset blockers.** All 6 product images are available.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Add section, 3-column, anchor `products`, bg `#E8E4FF` | 6.1.1-6.1.3 |
| Header | "One Platform. Three Tiers. Every Child." | 6.2.1 |
| Tier 1 card | Badge "Ages 2-6" (purple), Kitarama+Dragophant images, copy | 6.3.1-6.3.4 |
| Tier 2 card | Badge "Ages 7-11" (coral), Drago+Kit images, copy | 6.4.1-6.4.4 |
| Tier 3 card | Badge "Ages 12+" (teal), Jett+Lilly images, copy | 6.5.1-6.5.4 |
| Style | Card styling, equal heights, hover effects, animations | 6.6.1-6.6.5 |

**Screenshot checkpoint after completion.**

---

## SPRINT 3: REMAINING SECTIONS — How It Works, Market, Team, CTA, Footer

**Goal:** Build the bottom 5 sections to complete the full page.
**Duration estimate:** 3-5 hours
**Prerequisites:** Sprint 2 complete. Headshots needed for Team section (or use placeholders).
**Sections:** 6 (How It Works), 7 (Market), 8 (Team), 9 (CTA/Waitlist), 10 (Footer)

### 3A. How It Works Section (Section 6)
**Tasks:** 7.1-7.7 (16 sub-subtasks)
**No asset blockers.** Text and numbered circles only.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Add section, anchor `how-it-works`, white bg, padding 96px | 7.1.1-7.1.3 |
| Header | Title + subtitle (centered) | 7.2.1, 7.2.2 |
| Step 1 | "01" circle (purple) + "Child Bonds" + description | 7.3.1-7.3.3 |
| Step 2 | "02" circle (coral) + "SEPA Monitors" + description | 7.4.1-7.4.3 |
| Step 3 | "03" circle (teal) + "AI Summarizes" + description | 7.5.1-7.5.3 |
| Step 4 | "04" circle (purple) + "All Informed" + description | 7.6.1-7.6.3 |
| Timeline | Connecting line, responsive layout, stagger animation | 7.7.1-7.7.4 |

**Screenshot checkpoint after completion.**

### 3B. Market & Traction Section (Section 7)
**Tasks:** 8.1-8.5 (14 sub-subtasks)
**No asset blockers.** Dark section with stats, no images.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Add section, anchor `market`, bg `#1A1A2E`, padding 96px | 8.1.1-8.1.3 |
| Header | "A $65 Billion Opportunity" (white text) | 8.2.1 |
| Stats | 4 dark cards: $65B, $5.5B, 7.7M, 0 — with accent colors | 8.3.1-8.3.7 |
| Narrative | "Why Now?" paragraph (centered, italic, white text) | 8.4.1, 8.4.2 |
| Animation | Counter animation + screenshot | 8.5.1, 8.5.2 |

**Screenshot checkpoint after completion.**

### 3C. Team Section (Section 8)
**Tasks:** 9.1-9.5 (15 sub-subtasks)
**BLOCKER:** Headshots for Taffy, Sonu, Ozzie, Lakeshia, Kristen (Tasks 0.3.10-0.3.14)

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Add section, anchor `team`, bg `#FAFAFA`, padding 96px | 9.1.1-9.1.3 |
| Header | "Built by People Who Understand..." | 9.2.1 |
| Founder | Taffy spotlight: photo (or placeholder), name, title, bio | 9.3.1-9.3.6 |
| Advisors | 4 cards with pastel bgs: Sonu, Ozzie, Lakeshia, Kristen | 9.4.1-9.4.6 |
| Animation | Founder fade-in, advisor stagger | 9.5.1, 9.5.2 |

**Placeholder strategy:** Build the full section structure with placeholder circles (initials on pastel backgrounds). Photos can be swapped in via `upload_image` once received, without rebuilding the section.

**Screenshot checkpoint after completion.**

### 3D. Waitlist / CTA Section (Section 9)
**Tasks:** 10.1-10.6 (21 sub-subtasks)
**No asset blockers.** Largest single section by sub-task count.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Add section, anchor `waitlist`, gradient bg, padding 96px | 10.1.1-10.1.3 |
| Copy | Headline + subheadline (centered) | 10.2.1, 10.2.2 |
| Comparison | WITHOUT/WITH SEPA 2-column table (optional but valuable) | 10.3.1, 10.3.2 |
| Path cards | 3 audience cards: Investors, Clinical Partners, Families | 10.4.1-10.4.4 |
| Form | Email capture: Name, Email, Role dropdown, "Count Me In" submit | 10.5.1-10.5.7 |
| QA | Screenshot and verify | 10.6.1 |

**Screenshot checkpoint after completion.**

### 3E. Footer (Section 10)
**Tasks:** 11.1-11.3 (11 sub-subtasks)
**Soft blocker:** White logo version (Task 0.3.2). Can proceed without it.

| Phase | Actions | Task IDs |
|-------|---------|----------|
| Structure | Open footer editing | 11.1.1 |
| Content | 3 columns: company info, nav links, legal | 11.2.1-11.2.3 |
| Style | Dark bg `#1A1A2E`, white/gray text, white logo, hover states | 11.3.1-11.3.6 |

**Screenshot checkpoint after completion.**

---

## SPRINT 4: POLISH & LAUNCH

**Goal:** Inject custom CSS, run responsive testing, configure SEO, final QA, publish.
**Duration estimate:** 2-3 hours
**Prerequisites:** All 10 sections built (Sprints 2-3). Custom CSS pre-authored (Sprint 0B).

### 4A. Custom CSS Injection
**Tasks:** 12.3.1-12.3.7

| Step | Action | Task ID |
|------|--------|---------|
| 1 | Navigate to Settings > Advanced > Code Injection > Header | 12.3.1 |
| 2 | Paste pre-authored CSS (smooth scroll, pill buttons, card hovers, reduced-motion, counter JS) | 12.3.2-12.3.6 |
| 3 | Test all custom styles applied correctly | 12.3.7 |

### 4B. Responsive Testing
**Tasks:** 12.4.1-12.4.12

| Breakpoint | Width x Height | Checks | Task IDs |
|------------|---------------|--------|----------|
| Mobile | 375 x 812 | Stack, overflow, tap targets (44px), text min 16px, full-width CTAs | 12.4.1-12.4.9 |
| Tablet | 768 x 1024 | Stat grid 2x2, product cards 2+1, general review | 12.4.10-12.4.11 |
| Desktop | 1440 x 900 | Return to baseline, verify no regressions | 12.4.12 |

**Fix any issues found at each breakpoint before moving to the next.**

### 4C. SEO & Metadata
**Tasks:** 12.5.1-12.5.5, 12.6.1-12.6.3

| Step | Action | Task ID |
|------|--------|---------|
| 1 | Set SEO Title: "SEPA Babies — Remote Patient Monitoring for Neurodiverse Children" | 12.5.2 |
| 2 | Set SEO Description (from build instructions) | 12.5.3 |
| 3 | Set URL slug to "/" | 12.5.4 |
| 4 | Upload favicon (from logo) | 12.6.1 |
| 5 | Upload Open Graph image (1200x630) | 12.6.2 |

### 4D. Full-Page Visual QA
**Tasks:** 13.1.1-13.1.11

Run through every section against the Design System checklist:

| # | Check | Task ID |
|---|-------|---------|
| 1 | Sticky nav with logo, links, coral CTA pill | 13.1.1 |
| 2 | Hero — eyebrow → headline → sub → CTAs → social proof | 13.1.2 |
| 3 | Problem — stat cards, large colored numbers, subtle labels | 13.1.3 |
| 4 | Solution — split layout, SEPA bento grid with icon circles | 13.1.4 |
| 5 | Product cards — equal height, colored badges, hover effects | 13.1.5 |
| 6 | Timeline — circles connected, horizontal/vertical responsive | 13.1.6 |
| 7 | Market — dark section, white text, stat counters | 13.1.7 |
| 8 | Team — founder spotlight large, advisors in pastel cards | 13.1.8 |
| 9 | Waitlist — styled inputs, coral submit, focus states | 13.1.9 |
| 10 | Footer — dark, matching Market, all links present | 13.1.10 |
| 11 | Mobile — clean stacking, no horizontal overflow | 13.1.11 |

### 4E. Interaction Testing
**Tasks:** 13.2.1-13.2.4

| # | Test | Task ID |
|---|------|---------|
| 1 | Click each nav link — smooth scroll to correct anchor | 13.2.1 |
| 2 | All CTA buttons navigate to `#waitlist` | 13.2.2 |
| 3 | Card hover effects (translateY, shadow) | 13.2.3 |
| 4 | Button hover states (scale, color transitions) | 13.2.4 |

### 4F. Form Testing
**Tasks:** 13.3.1-13.3.4

| # | Test | Task ID |
|---|------|---------|
| 1 | Fill test data in waitlist form | 13.3.1 |
| 2 | Click submit | 13.3.2 |
| 3 | Verify confirmation message | 13.3.3 |
| 4 | Check submission in Squarespace form responses | 13.3.4 |

### 4G. Performance Check
**Tasks:** 13.4.1-13.4.3

| # | Check | Task ID |
|---|-------|---------|
| 1 | Run `performance.timing` via `javascript_tool` | 13.4.1 |
| 2 | Verify images are optimized | 13.4.2 |
| 3 | Verify animations don't jank on scroll | 13.4.3 |

### 4H. GIF Walkthrough & Publish
**Tasks:** 13.5.1-13.5.5, 13.6.1-13.6.4

| # | Action | Task ID |
|---|--------|---------|
| 1 | Record GIF walkthrough (scroll + hover + click) | 13.5.1-13.5.5 |
| 2 | **USER CONFIRMS** site is ready to go live | 13.6.1 |
| 3 | Click "Publish" / "Go Live" | 13.6.2 |
| 4 | Verify live URL loads correctly | 13.6.3 |
| 5 | Test on separate device/browser | 13.6.4 |

---

## BLOCKERS & RISKS

### Critical Blockers (P0)

| Blocker | Impact | Mitigation | Resolution Owner |
|---------|--------|------------|-----------------|
| **No SEPA Babies logo** | Nav (Section 1) and Footer (Section 10) incomplete | Use text placeholder "SEPA Babies" in Poppins Bold; swap logo in later | Taffy Watts |
| **No headshots (5 people)** | Team section (Section 8) incomplete | Use initial-circle placeholders on pastel backgrounds; swap photos later | Each team member |
| **No Squarespace account confirmed** | Cannot start Sprint 1 | User must confirm account exists or create one | User |

### High Risks (P1)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Squarespace template limitations** | Medium | Certain layouts (split 60/40, bento grid) may not map cleanly to Squarespace blocks | Use custom CSS overrides; worst case, use Code Block with raw HTML |
| **Browser automation flakiness** | Medium | Chrome Extension tools may fail on complex Squarespace editor interactions | Take screenshots frequently; use `read_page` to verify state; retry failed operations |
| **Squarespace font availability** | Low | Poppins or Open Sans may not be in Squarespace's font library | Both are Google Fonts and typically available; if not, inject via Code Injection `@import` |
| **Stat counter animation** | Medium | Intersection Observer JS may conflict with Squarespace's own JS | Test in isolation; fall back to static numbers if counter causes issues |
| **Form storage configuration** | Low | Squarespace form may need Mailchimp or other integration setup | Default Squarespace form storage works for MVP; Mailchimp can be added post-launch |
| **Image upload size limits** | Low | Kitarama.png and Dragophant.png are ~780KB each | Squarespace auto-optimizes; should not be an issue |

### Medium Risks (P2)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Mobile layout breaks** | Medium | Squarespace responsive behavior may not match design spec | Sprint 4B dedicated to responsive fixes; custom CSS media queries |
| **Dark section text contrast** | Low | White text on `#1A1A2E` may need refinement | Use `rgba(255,255,255,0.7)` for body, pure `#FFFFFF` for headings per spec |
| **Hover animations on mobile** | Low | Touch devices don't have hover states | Animations degrade gracefully; consider `:active` states for mobile |
| **Session timeout** | Medium | Squarespace session may expire during long build sessions | Save frequently; bookmark editor URL for quick re-login |

---

## CRITICAL PATH

The critical path determines the minimum time from start to publish. Tasks on the critical path cannot be delayed without delaying the whole project.

```
CRITICAL PATH (sequential, cannot be parallelized):

Sprint 0E ──→ Sprint 1A ──→ Sprint 1B ──→ Sprint 1C ──→ Sprint 2A ──→ Sprint 2B
(Env check)   (Auth)        (Create site)  (Fonts/Colors) (Nav)         (Hero)
  ~15min       ~10min        ~10min         ~15min         ~30min        ~45min
                  │
                  └──── USER TYPES PASSWORD (blocking interaction)

──→ Sprint 2C ──→ Sprint 2D ──→ Sprint 2E ──→ Sprint 3A ──→ Sprint 3B
    (Problem)     (Solution)     (Products)    (How It Works) (Market)
     ~30min        ~40min         ~45min        ~35min         ~30min

──→ Sprint 3C ──→ Sprint 3D ──→ Sprint 3E ──→ Sprint 4A ──→ Sprint 4B
    (Team)        (CTA/Waitlist)  (Footer)     (CSS inject)   (Responsive)
     ~30min        ~45min          ~20min       ~15min         ~45min

──→ Sprint 4C ──→ Sprint 4D-G ──→ Sprint 4H
    (SEO)         (QA/Testing)     (Publish)
     ~15min        ~45min           ~10min
                       │
                       └──── USER CONFIRMS publish (blocking interaction)
```

**Total critical path time estimate: 8-10 hours of active build time**

### What CAN Be Parallelized (run alongside critical path)

| Parallel Work | When | Team |
|--------------|------|------|
| Sprint 0A (Asset collection — request photos from team) | NOW, before anything else | User |
| Sprint 0B (CSS pre-authoring) | NOW, before Squarespace access | T4 |
| Sprint 0C (Copy verification) | NOW, before Squarespace access | T5 |
| Sprint 0D (Brand identity confirmation) | NOW | T4/T5 |
| Open Graph image generation | After Sprint 0A yields logo | T6 |
| Favicon generation | After Sprint 0A yields logo | T6 |

### Sections That Are Independent of Each Other

Once global styling is set (Sprint 1C), sections 2-10 are built sequentially in the Squarespace editor because they must be in page order. However, the **content preparation** for all sections is independent and can happen in parallel during Sprint 0.

---

## DECISION POINTS — Where User Input Is Required

| # | Decision | When | Options | Recommendation |
|---|----------|------|---------|----------------|
| **D1** | Squarespace plan tier | Sprint 0E | Free trial vs. Business vs. Commerce | Free trial is fine for building; upgrade to Business ($33/mo) before publish for custom CSS Code Injection |
| **D2** | Logo status | Sprint 0A | Wait for real logo vs. use text placeholder | Use text placeholder to unblock build; swap logo later. Do NOT delay Sprint 2 for logo. |
| **D3** | Hero image choice | Sprint 2B | Option A: `File_000(1).jpeg` (Baby+Kitarama), Option B: `File_000.jpeg` (Child+Dragophant), Option C: `IMG_8877.jpg` (Girl+Kitarama), Option D: `Kitarama.png` (product shot) | Option A recommended — warmest, most emotionally resonant |
| **D4** | Headshot status | Sprint 3C | Wait for real photos vs. build with placeholders | Build with placeholders; photos can be swapped in any time |
| **D5** | WITHOUT/WITH comparison table | Sprint 3D | Include the comparison table above the CTA paths, or skip it | Include it — powerful conversion element, relatively low effort (Task 10.3) |
| **D6** | Form storage | Sprint 3D | Squarespace native form vs. Mailchimp integration | Squarespace native for MVP. Mailchimp can be added post-launch if needed. |
| **D7** | Go live confirmation | Sprint 4H | Publish now vs. wait for missing assets | User's call. Site can launch with text logo placeholder and initial-circle headshots, then update assets live. |
| **D8** | Custom domain | Post-publish | Use Squarespace subdomain vs. connect sepababies.com | Connect custom domain if DNS is controlled. Separate from this build scope. |

---

## EXECUTION SUMMARY

| Sprint | Duration | Sections Built | Key Prerequisite | Tasks Completed |
|--------|----------|---------------|-----------------|-----------------|
| **0** | 2-3 hrs | — (prep only) | None | 0.3.x, 0.4.x, 12.3.x (prep) |
| **1** | 30-45 min | Site created, global styling set | Squarespace login + user password | 1.x, 12.1.x, 12.2.x |
| **2** | 3-5 hrs | Nav, Hero, Problem, Solution, Products | Sprint 1 done | 2.x, 3.x, 4.x, 5.x, 6.x |
| **3** | 3-5 hrs | How It Works, Market, Team, CTA, Footer | Sprint 2 done | 7.x, 8.x, 9.x, 10.x, 11.x |
| **4** | 2-3 hrs | CSS injection, responsive, SEO, QA, publish | Sprint 3 done | 12.3-12.6, 13.x |
| **TOTAL** | **~10-16 hrs** | **10 sections + polish** | | **233 remaining tasks** |

### Immediate Next Actions (Priority Order)

1. **NOW:** Send asset requests to all 5 team members for headshots (Tasks 0.3.10-0.3.14)
2. **NOW:** Request logo files from Taffy (Tasks 0.3.1, 0.3.2) — this is the single most impactful blocker
3. **NOW:** T4 begins pre-authoring custom CSS (Sprint 0B)
4. **NOW:** T5 begins copy verification pass (Sprint 0C)
5. **NOW:** Confirm Squarespace account status (Task 0.1.1)
6. **WHEN READY:** Begin Sprint 1 — requires user at the keyboard for password entry

---

*Sprint plan authored by T1 Planning Orchestrator — 2026-03-24*
*Covers all 240 sub-subtasks across 14 task groups from tasks.md*
