# RimalHealth -- Design Inspiration Brief

> Produced by the Design Research Team | March 2026
> Based on analysis of healthcare design trends, telehealth competitor sites, godly.website patterns, and UX research.

---

## Design Philosophy

RimalHealth serves patients dealing with alcohol use disorder -- a deeply personal, often stigmatized condition. The design must communicate **safety, competence, and warmth** without feeling clinical, cold, or judgmental. Patients arriving at this site are often anxious, possibly ashamed, and looking for a solution that feels discreet and dignified.

**Core Emotional Targets:**
- **Safe** -- "My information is protected, and I am not being judged."
- **Capable** -- "These are real doctors who know what they are doing."
- **Simple** -- "I can actually do this. It is not complicated."
- **Premium** -- "This feels like a high-quality, modern service -- not a discount clinic."

The design should land in the space between a premium wellness brand (think Parsley Health, Hims/Hers) and a trusted medical institution -- never veering into either "lifestyle brand that trivializes medicine" or "sterile hospital portal."

---

## Landing Page Inspiration

### Hero Section

**Recommended Pattern: Gradient Background with Centered Content**

Based on 2026 design trends, the most effective hero sections for healthcare combine:

1. **Soft gradient backgrounds** -- A smooth transition from deep navy (#0A2540) at the top to a lighter ocean-tinted white toward the bottom. Gradients are making a strong comeback in 2026, with multi-tone effects creating emotional resonance. For RimalHealth, this creates a feeling of depth and calm without the coldness of a flat white background.

2. **Centered headline with generous whitespace** -- Large, confident typography (48-64px on desktop) with a clear value proposition. The 2026 trend toward oversized, intentional type pairs well with healthcare's need for clarity. Example headline structure:
   - Primary: "Take Control of Your Relationship with Alcohol"
   - Secondary: "FDA-approved medication, licensed physicians, and ongoing support -- all from home. Starting at $25/month."

3. **Single prominent CTA** -- One clear action button, not competing elements. Research shows healthcare sites convert best with a single, prominent path forward.

4. **Subtle background motion** -- A very slow gradient shift or soft particle animation that adds life without distraction. Must honor `prefers-reduced-motion` by defaulting to a static gradient.

**What to avoid:** Stock photos of smiling people in lab coats (feels generic), split-layout hero sections (too complex for the emotional simplicity needed here), autoplay video (adds anxiety for privacy-conscious patients).

**Competitor Reference Points:**
- **Oar Health** (oarhealth.com) -- Clean, direct approach to naltrexone treatment. Simple hero, clear pricing, medical credibility.
- **Monument** (joinmonument.com) -- Warm, supportive tone. Good use of patient stories and community emphasis.
- **Ria Health** (riahealth.com) -- More clinical/comprehensive feel. Good credibility indicators.
- **Parsley Health** -- Premium wellness aesthetic with calming greens. Good model for the "premium but approachable" feel.

### Trust Indicators

Trust indicators are critical for a telehealth platform handling sensitive health data. Research shows they should be placed near CTAs, in the footer, and on dedicated security pages.

**Recommended Trust Badge Strategy:**

1. **Below-the-hero trust bar** -- A horizontal strip with 4-5 trust signals:
   - HIPAA Compliant (shield icon + text)
   - Licensed California Physicians (stethoscope icon)
   - AES-256 Encrypted (lock icon)
   - FDA-Approved Medication (checkmark icon)
   - Flat-fee pricing / No hidden costs (dollar icon)

2. **Important legal note:** There is no official HIPAA certification logo from HHS/OCR. Use a custom-designed shield icon with "HIPAA Compliant" text rather than any third-party "seal." This is more legally accurate and can be designed to match the brand.

3. **Design treatment:** Muted gray or navy icons on a light background bar. Not overly colorful -- trust badges should feel institutional and serious, not promotional. Use a subtle border-top and border-bottom to separate from content sections.

4. **Contextual placement:** Repeat key trust indicators near:
   - The payment/checkout form ("Your payment is secured with AES-256 encryption")
   - The intake form header ("All responses are HIPAA-protected and encrypted")
   - The login page ("End-to-end encrypted connection")

### CTA Patterns

**Primary CTA: "Get Started" / "Start Treatment"**

Research indicates the most effective healthcare CTAs are:

1. **Pill-shaped (fully rounded corners)** -- Rounded buttons draw the eye inward toward the label text. The pill shape feels modern and approachable, less aggressive than sharp rectangles.

2. **Solid fill with the ocean accent color (#0284C7)** -- Blue CTAs perform well in healthcare contexts. The ocean blue is action-oriented without feeling urgent or alarming.

3. **Subtle hover animation** -- On hover: slight scale-up (1.02-1.05x), a soft box-shadow glow in a lighter blue, and a 200ms ease transition. The "floating island" pattern -- where the button appears to lift slightly on hover via shadow depth change -- is a current 2026 trend that adds premium feel.

4. **CTA copy that reduces anxiety:**
   - Primary: "Get Started -- $50/month" (transparent pricing reduces friction)
   - Secondary/ghost: "See How It Works" (low-commitment alternative)
   - Avoid: "Sign Up Now," "Buy Now," "Subscribe" (too transactional for healthcare)

5. **Supporting micro-copy beneath the CTA:** "No insurance needed. Cancel anytime." -- Small, muted text that preemptively answers objections.

**Secondary CTA Pattern:**
- Ghost button (outlined, not filled) in navy or ocean blue
- Same pill shape as primary
- Used for "Learn More," "See How It Works," or "Talk to a Doctor"

---

## Consent Page Design

Patients must agree to telehealth consent and HIPAA privacy notices before proceeding. This is a legally required step that, if poorly designed, creates drop-off.

**Design Principles for Approachable Consent:**

1. **Layered disclosure** -- Start with a brief, plain-language summary (3-4 bullet points) of what the patient is agreeing to, followed by expandable sections for full legal text. Research shows this layered approach significantly reduces abandonment.

2. **Visual structure:**
   - Clean card-based layout with clear section headers
   - Each consent topic in its own expandable accordion section
   - Icons next to each section header (shield for privacy, video for telehealth, pill for medication)
   - Progress indicator showing "Step X of Y" if consent is part of the onboarding flow

3. **Language approach:**
   - Lead each section with a plain-language summary in normal-weight text
   - Full legal text in a scrollable container with slightly smaller, muted text
   - Key terms highlighted or bolded (but sparingly)

4. **Interaction design:**
   - Individual checkboxes for each consent area (not one "agree to all" checkbox -- this feels more transparent)
   - The "Continue" button remains disabled until all required consents are checked
   - A "Download PDF" link for patients who want to review offline

5. **Tone:** Frame consent positively -- "Here is how we protect you" rather than "You must agree to the following terms." The heading could be "Your Privacy & Rights" rather than "Legal Agreements."

---

## Intake Form Wizard Design

The RimalHealth intake form is approximately 34 questions covering medical history, alcohol use (AUDIT-C scoring), medications, and personal information. This is the most UX-critical flow in the application.

### Multi-Step Wizard Patterns

**Recommended Architecture: Segmented Wizard with Progress Bar**

1. **Step segmentation** -- Break 34 questions into 5-7 logical sections:
   - Personal Information (name, DOB, address)
   - Medical History (conditions, medications, allergies)
   - Alcohol Use Assessment (AUDIT-C questions)
   - Treatment Goals (what they hope to achieve)
   - Pharmacy & Preferences
   - Review & Submit

2. **Progress indicator** -- A horizontal segmented progress bar at the top of the form:
   - Show section names (not just numbers) on desktop
   - Collapse to step numbers on mobile
   - Completed sections get a checkmark icon
   - Current section is highlighted in ocean blue
   - Future sections are muted gray
   - The bar should be sticky/fixed to the top of the form viewport

3. **One question group per screen** -- Research shows that showing 3-5 related fields per step is optimal. Never show all 34 questions on one page. Each step should feel like a brief, manageable conversation.

4. **Smooth transitions** -- Slide-left animation when advancing, slide-right when going back. Duration: 250-300ms with ease-out timing. Must respect `prefers-reduced-motion` (fall back to instant swap).

5. **Auto-save indicator** -- A subtle "Saved" indicator (small checkmark + text) that appears briefly after each field change. Use a fade-in/fade-out animation. This is critical for a long form -- patients need confidence that progress is not lost.

6. **Save and resume** -- For healthcare intake specifically, save-and-resume functionality is essential. Display a "Your progress is saved. You can return anytime." message if the patient navigates away.

### Making 34 Questions Feel Manageable

- **Section introductions** -- A brief, friendly sentence at the top of each section explaining why these questions matter: "This helps your doctor understand your overall health" (not "Required medical history").
- **Conditional logic** -- Hide irrelevant follow-up questions. If "No current medications," skip the medication details step.
- **Visual variety** -- Mix input types: radio buttons for yes/no, dropdown for state selection, slider or visual scale for frequency questions, text areas for open-ended responses. Monotony makes forms feel longer.
- **Completion encouragement** -- "Almost there -- 2 sections remaining" messaging near the end.

### Sensitive Question Design (Alcohol Use)

The AUDIT-C questions are the emotional core of the intake. Design considerations:

- **Neutral, non-judgmental framing** -- Use clinical but warm language
- **No red warning colors** -- Scoring feedback (if shown) should use the same neutral palette
- **Generous spacing** -- Give these questions more vertical breathing room
- **Optional "Why we ask" tooltips** -- Small info icons that explain the clinical purpose

---

## Patient Portal Design

### Dashboard Layout

**Recommended Pattern: Left Sidebar Navigation + Card-Based Content Area**

1. **Sidebar navigation (desktop):**
   - Fixed left sidebar (240-280px width)
   - Navy background (#0A2540) with white/light text
   - Active item highlighted with ocean blue (#0284C7) left border or background tint
   - Navigation items: Dashboard, Messages, Prescriptions, Billing, Documents, Profile
   - Patient name and avatar/initials at the top
   - Collapse to icon-only on smaller screens (below 1024px)
   - On mobile: bottom tab navigation (5 primary items) or hamburger slide-out

2. **Dashboard content area:**
   - Light gray or off-white background (#F8FAFC or similar)
   - Card-based layout with white cards, subtle shadows (soft colored shadows per 2026 trends, not harsh black)
   - Rounded corners on cards (12-16px radius, matching the 2026 bento grid trend with exaggerated rounding)

3. **Dashboard cards:**
   - **Treatment Status Card** (prominent, top) -- Current subscription status, next steps, physician review status. Use a status badge (green = active, amber = pending, etc.)
   - **Messages Card** -- Unread message count badge, preview of latest message, "View All" link
   - **Prescription Card** -- Current medication, refill date, pharmacy info
   - **Upcoming Actions Card** -- Any items needing patient attention (complete intake, respond to doctor, etc.)
   - **Billing Card** -- Current plan, next payment date, "Manage Subscription" link

4. **Notification patterns:**
   - Subtle dot badge (red) on sidebar navigation items with pending actions
   - Toast notifications for real-time updates (slide in from top-right, auto-dismiss after 5s)
   - In-card notification banners for important updates (e.g., "Your physician has reviewed your intake")

5. **Message thread design:**
   - Chat-bubble style for message threads (patient messages right-aligned in ocean blue, physician messages left-aligned in light gray)
   - Timestamp grouping (today, yesterday, date)
   - "Physician typically responds within 24 hours" notice
   - Secure attachment support with file type icons

6. **Prescription status cards:**
   - Visual timeline showing prescription lifecycle: Prescribed > Sent to Pharmacy > Ready for Pickup / Delivered
   - Green checkmarks for completed stages, pulsing dot for current stage
   - Pharmacy name and contact info prominently displayed
   - Refill request button (enabled when within 7-day refill window)

---

## Physician Portal Design

### Queue Management

1. **Patient review queue:**
   - Table/list view as primary layout (physicians process patients sequentially)
   - Sortable columns: Patient name (encrypted display), submission date, priority, status
   - Status badges: New (blue), In Review (amber), Completed (green), Needs Follow-up (orange)
   - Click-to-expand or click-to-navigate for patient detail view
   - Batch action capabilities (mark reviewed, assign priority)

2. **Patient detail view:**
   - Full-width layout with tabbed sections: Intake Summary, Medical History, Messages, Prescriptions, Notes
   - Intake responses displayed in a clean, scannable format (label-value pairs with clear hierarchy)
   - AUDIT-C score prominently displayed with clinical interpretation
   - Action panel (sticky sidebar or bottom bar): Approve Treatment, Request More Info, Refer Out, Add Note

3. **Review form design:**
   - Structured form with pre-defined fields (diagnosis, treatment plan, medication, dosage)
   - Quick-select options for common decisions (reduces physician typing)
   - Free-text area for clinical notes
   - Digital signature / confirmation step before submission

### Physician Dashboard

- **Summary statistics** at top: Pending reviews count, patients seen today/this week, average response time
- **Quick-access queue** below stats
- **Recent activity feed** in a sidebar or secondary panel
- **Calendar/schedule view** if applicable

---

## Color Palette Recommendations

### Analysis of Current Brand Colors

The current brand palette -- navy (#0A2540) and ocean (#0284C7) -- is strong and well-chosen for healthcare:

- **Navy (#0A2540)** conveys authority, professionalism, and trust. It is a deep, grounding color that works well as a primary dark color for backgrounds, headers, and sidebar navigation.
- **Ocean (#0284C7)** is an energetic, trustworthy blue that works as an action/accent color for CTAs, links, and interactive elements. It has enough saturation to be noticeable without being aggressive.

**Recommendation: Keep the core palette but extend it with supporting colors.**

### Extended Color Palette

```
PRIMARY
  Navy:        #0A2540  -- Primary dark (headers, sidebar, footer, body text)
  Navy Light:  #0F3A5C  -- Hover states on navy backgrounds, secondary dark
  Ocean:       #0284C7  -- Primary action color (CTAs, links, active states)
  Ocean Light: #38BDF8  -- Hover state for ocean, secondary accent
  Ocean Pale:  #E0F2FE  -- Light tint for backgrounds, selected states, badges

NEUTRALS
  White:       #FFFFFF  -- Card backgrounds, primary content areas
  Off-White:   #F8FAFC  -- Page backgrounds, subtle separation
  Gray 100:    #F1F5F9  -- Secondary backgrounds, disabled states
  Gray 200:    #E2E8F0  -- Borders, dividers
  Gray 400:    #94A3B8  -- Placeholder text, muted icons
  Gray 600:    #475569  -- Secondary text, labels
  Gray 900:    #0F172A  -- Near-black for maximum contrast text (alternative to navy for body)

SEMANTIC
  Success:     #059669  -- Treatment active, prescription filled, form saved
  Success Bg:  #ECFDF5  -- Success message backgrounds
  Warning:     #D97706  -- Pending review, approaching refill date
  Warning Bg:  #FFFBEB  -- Warning message backgrounds
  Error:       #DC2626  -- Form validation errors, system errors
  Error Bg:    #FEF2F2  -- Error message backgrounds
  Info:        #0284C7  -- Reuse ocean for informational messages
  Info Bg:     #E0F2FE  -- Reuse ocean pale for info backgrounds

ACCENT (OPTIONAL)
  Teal:        #0D9488  -- Secondary accent for variety (wellness/recovery themed sections)
  Teal Pale:   #CCFBF1  -- Teal background tint
```

### Color Usage Guidelines

- **Avoid red as a dominant color anywhere in the patient-facing UI** -- Red triggers urgency and danger, which is inappropriate for addiction treatment contexts. Reserve red strictly for form validation errors and critical system alerts.
- **Use green sparingly and only for positive states** -- "Active treatment," "Prescription ready," "Saved successfully." Never for monetary amounts or promotional elements.
- **The navy-to-white gradient** in the hero section and key pages creates a calming depth effect that is both premium and healthcare-appropriate.
- **85% of healthcare companies use blue** -- This is a strength, not a weakness. Blue is the universal trust color in healthcare. Differentiate through typography, layout, and the specific shade (the deep navy is more distinctive than a generic medium blue).

---

## Typography Recommendations

### Primary Recommendation: Inter + Serif Accent

**Option A (Recommended): Inter Family**
```
Headings:   Inter (SemiBold 600 / Bold 700)
Body:       Inter (Regular 400 / Medium 500)
Monospace:  JetBrains Mono (for any code/technical display)
```

Inter is purpose-built for screens and UI. It offers exceptional legibility at all sizes, has a professional but warm character, and includes tabular numbers (important for dashboards and billing displays). It is variable-weight, enabling fine control over typographic hierarchy.

**Option B: Plus Jakarta Sans + Inter**
```
Headings:   Plus Jakarta Sans (SemiBold 600 / Bold 700)
Body:       Inter (Regular 400 / Medium 500)
```

Plus Jakarta Sans has slightly more geometric character and warmth than Inter, which can help the headings feel more approachable. The taller x-height preserves legibility. This pairing gives the headings a softer, more human feel while keeping body text maximally readable.

**Option C: DM Sans + Lora**
```
Headings:   DM Sans (Medium 500 / Bold 700)
Body:       DM Sans (Regular 400)
Accents:    Lora (Italic, for pull-quotes or patient testimonials)
```

DM Sans has a friendly geometric quality with clean lines. Adding Lora italic for testimonials or emotional content creates a warm, human contrast -- useful for a brand that needs to balance medical authority with empathetic care.

### Type Scale

```
Display (hero):     48px / 56px line-height (desktop) | 32px / 40px (mobile)
H1:                 36px / 44px (desktop) | 28px / 36px (mobile)
H2:                 28px / 36px (desktop) | 24px / 32px (mobile)
H3:                 22px / 30px (desktop) | 20px / 28px (mobile)
H4:                 18px / 26px
Body Large:         18px / 28px (landing page body)
Body:               16px / 24px (standard body, dashboard content)
Body Small:         14px / 20px (captions, labels, metadata)
Micro:              12px / 16px (badges, timestamps, fine print)
```

### Typography Principles

- **Minimum 16px for body text** -- Patients may be older adults or reading on mobile. Never go below 14px for any readable content.
- **Generous line-height (1.5-1.6x)** -- Healthcare content must be scannable and not feel dense.
- **Sufficient color contrast** -- All text must meet WCAG AA (4.5:1 for normal text, 3:1 for large text). Navy (#0A2540) on white provides a 16.75:1 ratio -- excellent.
- **Use font weight, not color alone, for emphasis** -- Accessible and works in all contexts.

---

## Animation & Interaction Patterns

### Guiding Principle

Animations in a healthcare context must be **functional, not decorative**. Every animation should serve a purpose: guide attention, provide feedback, smooth transitions, or indicate loading state. Patients dealing with addiction may have heightened anxiety -- motion should calm, not agitate.

### Recommended Animation Patterns

1. **Page transitions (form wizard steps):**
   - Slide-left/right with a subtle fade (250-300ms, ease-out)
   - Reduced motion: instant swap with no animation

2. **Button hover effects:**
   - Scale to 1.02x with a soft shadow expansion (200ms ease)
   - Background color shift (ocean to ocean-dark)
   - Reduced motion: color change only, no scale

3. **Card hover effects:**
   - Subtle shadow depth increase (shadow-sm to shadow-md) -- 200ms ease
   - No position change (translateY effects can feel unsettling)
   - Reduced motion: border color change only

4. **Loading states:**
   - Skeleton screens (pulsing gray blocks matching content layout) rather than spinners
   - Skeleton pulse animation: 1.5s ease-in-out infinite
   - Reduced motion: static gray blocks without pulse

5. **Form feedback:**
   - Validation errors: red border + shake animation (2 cycles, 300ms) -- use sparingly
   - Success: green checkmark fade-in (200ms)
   - Auto-save indicator: "Saved" text fade-in, hold 2s, fade-out (total ~3.5s)
   - Reduced motion: all feedback shown instantly without transition

6. **Toast notifications:**
   - Slide in from top-right (300ms ease-out)
   - Auto-dismiss with a shrinking progress bar after 5s
   - Reduced motion: appear instantly, disappear instantly

7. **Sidebar/navigation:**
   - Active state transitions: 150ms ease for color/border changes
   - Mobile drawer: slide from left with overlay backdrop (300ms)
   - Reduced motion: instant state changes

### Accessibility Requirements (Non-Negotiable)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- All animations must respect the `prefers-reduced-motion` media query
- No animation should last longer than 3 seconds (per WCAG 2.2.2)
- No flashing or strobing effects (per WCAG 2.3.1 -- three flashes threshold)
- Parallax scrolling is explicitly avoided (causes vestibular discomfort)
- Auto-playing video or motion is never used

---

## Key Design Principles

Derived from the full body of research, these seven principles should guide every design decision:

### 1. Calm Over Clever

Every design choice should reduce anxiety, not showcase creativity. Patients are dealing with a serious health condition. The interface should feel like a calm, competent doctor's office -- not a startup pitch deck. Prefer whitespace over density, muted over vibrant, steady over flashy.

### 2. Trust Through Transparency

Pricing is visible upfront ($50/month active, $25/month maintenance). Security badges are present but honest (no fake certifications). Consent language is plain and layered. The patient should never wonder "what's the catch?" or "who can see my data?"

### 3. Progressive Disclosure

Never overwhelm. Break complex flows (intake, consent, onboarding) into digestible steps. Show information in layers -- summary first, detail on demand. This applies to everything from the intake form wizard to prescription information to legal agreements.

### 4. Mobile-First, Always

The majority of telehealth users access services via mobile. Every component -- from the hero CTA to the intake form to the patient dashboard -- must be designed mobile-first and then enhanced for desktop. Large tap targets (minimum 44x44px), simplified navigation, and fast loading are non-negotiable.

### 5. Accessibility as Foundation

WCAG 2.1 AA compliance is the floor, not the ceiling. Color contrast ratios must exceed minimums. Focus states must be visible. Screen reader compatibility must be tested. Reduced motion preferences must be honored. This is both an ethical imperative and a legal requirement for healthcare.

### 6. Warm Professionalism

The tone sits between "empathetic therapist" and "competent physician." Use rounded shapes (pill buttons, rounded cards) for approachability. Use the navy/ocean palette for authority. Use generous spacing and clean typography for professionalism. The result should feel like a modern, private practice -- not a hospital, not a wellness influencer.

### 7. Speed as a Feature

Performance is a design decision. Skeleton loading states, optimistic UI updates, and minimal JavaScript all contribute to the perception of a fast, reliable service. For patients who may be making a courageous first step toward treatment, a slow or broken page is a lost patient. Target: First Contentful Paint under 1.5s, Largest Contentful Paint under 2.5s.

---

## Design References and Competitor Landscape

### Direct Competitors (Alcohol/Addiction Telehealth)

| Service | Key Design Takeaway |
|---------|-------------------|
| **Oar Health** (oarhealth.com) | Clean, direct, no-nonsense. Good at reducing friction. Simple checkout. |
| **Monument** (joinmonument.com) | Warm, community-oriented. Emphasizes support and belonging. |
| **Ria Health** (riahealth.com) | More clinical, comprehensive. Strong credibility indicators. |
| **Thrive Alcohol Recovery** | Focused messaging, clear value proposition. |

### Aspirational Design References (Premium Healthcare)

| Brand | What to Learn |
|-------|--------------|
| **Parsley Health** | Premium wellness aesthetic, calming greens, clean layouts |
| **Talkiatry** | Modern psychiatry brand, warm but professional |
| **Hims / Hers** | Premium DTC healthcare, excellent mobile experience, bold branding |
| **One Medical** | Clean patient portal, excellent dashboard UX |
| **Zocdoc** | Differentiated with yellow, but the booking flow UX is best-in-class |

### Design Inspiration Platforms

| Platform | What to Find |
|----------|-------------|
| **Godly.website** | Premium web design curation -- search "health," "medical," "SaaS" |
| **Landingfolio** | Health landing page collection with real examples |
| **Saaspo** | 28+ healthcare SaaS landing pages curated for inspiration |
| **Dribbble** | Search "medical SaaS" for UI concept work |
| **Behance** | Search "healthcare SaaS landing page" for full case studies |

---

## Summary of Recommendations

| Area | Recommendation |
|------|---------------|
| **Hero** | Gradient navy-to-white background, centered content, single CTA, no stock photos |
| **Trust** | Custom HIPAA shield icon, trust bar below hero, contextual repetition near forms |
| **CTAs** | Pill-shaped, ocean blue fill, subtle hover scale+shadow, anxiety-reducing copy |
| **Consent** | Layered disclosure, plain language summaries, individual checkboxes, positive framing |
| **Intake Form** | 5-7 step wizard, segmented progress bar, auto-save, conditional logic, 3-5 fields per step |
| **Patient Portal** | Left sidebar (navy), card-based dashboard, status badges, chat-style messaging |
| **Physician Portal** | Queue table view, status badges, tabbed patient detail, structured review forms |
| **Colors** | Keep navy + ocean core; extend with neutrals, semantic colors, optional teal accent |
| **Typography** | Inter (primary recommendation) or Plus Jakarta Sans for headings; 16px minimum body |
| **Animation** | Functional only; 200-300ms transitions; skeleton loaders; mandatory reduced-motion support |

---

*This brief is a research deliverable. No code has been modified. The UI/UX implementation team should use this as a reference guide when building components and pages.*

**Sources:**
- [Framerbite: 15+ Best Healthcare Website Design Inspiration for 2026](https://framerbite.com/blog/20-best-healthcare-website-design-inspiration)
- [Webstacks: 18 Best Healthcare Website Design Examples](https://www.webstacks.com/blog/healthcare-website-design)
- [DesignRush: 10 Best Medical Website Designs 2026](https://www.designrush.com/best-designs/websites/trends/best-medical-website-designs)
- [Purrweb: Telehealth Website Design Key Principles](https://www.purrweb.com/blog/telehealth-website-design/)
- [Webugol: Telehealth Website Design Key Features 2026](https://webugol.com/blog/telehealth-website-design-key-features-to-include-in-2026/)
- [Eleken: Healthcare UI Design 2026 Best Practices](https://www.eleken.co/blog-posts/user-interface-design-for-healthcare-applications)
- [Fuselab: Healthcare UX Design Guide 2026](https://fuselabcreative.com/healthcare-ux-design-best-practices-guide/)
- [Smashing Magazine: Creating Effective Multistep Forms](https://www.smashingmagazine.com/2024/12/creating-effective-multistep-form-better-user-experience/)
- [Designlab: How to Design Multi-Step Forms](https://designlab.com/blog/design-multi-step-forms-enhance-user-experience)
- [Erik Fiala: Psychology of Trust Seals and Badges in UI Design](https://erikfiala.com/blog/psychology-trust-seals-badges-ui-design/)
- [Etactics: Examples of HIPAA Compliance Badges](https://etactics.com/blog/hipaa-compliance-badges)
- [Spot On Agency: Top 7 Trust Signals for SaaS Websites](https://www.thespotonagency.com/blog/top-7-trust-signals-for-your-saas-website-to-boost-credibility-conversions)
- [Formsort: Best Practices for User Consent in Healthcare](https://formsort.com/article/user-consent-in-saas-healthcare-and-fintech/)
- [Fuzzy Math: Color Palettes of Mental Healthcare UI](https://fuzzymath.com/blog/the-color-palettes-of-mental-healthcare-ui/)
- [Digital Dot: Color Psychology and Mental Health Website Design](https://digitaldot.com/how-color-psychology-impacts-mental-health-website-design/)
- [Progress: Healthcare Color Palette Using Color Psychology](https://www.progress.com/blogs/using-color-psychology-healthcare-web-design)
- [Progress: Choosing Fonts for Healthcare Marketing](https://www.progress.com/blogs/choosing-fonts-healthcare-marketing-branding)
- [Digital Arcane: Top 10 Font Pairings For Medical Websites](https://digitalarcane.com/font-pairings-for-medical-websites/)
- [Figma: 24 Best Fonts for Websites in 2026](https://www.figma.com/resource-library/best-fonts-for-websites/)
- [Pope Tech: Designing Accessible Animation](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)
- [Web.dev: Animation and Motion Accessibility](https://web.dev/learn/accessibility/motion)
- [WriterDock: Bento Grids and UI Trends 2026](https://writerdock.in/blog/bento-grids-and-beyond-7-ui-trends-dominating-web-design-2026)
- [TheeDigital: 20 Top Web Design Trends 2026](https://www.theedigital.com/blog/web-design-trends)
- [Perfect Afternoon: Hero Section Design Best Practices 2026](https://www.perfectafternoon.com/2025/hero-section-design/)
- [Saaspo: Healthcare SaaS Landing Pages](https://saaspo.com/industry/healthcare-saas-websites-inspiration)
- [SaaS Landing Page: Healthcare Examples](https://saaslandingpage.com/tag/healthcare/)
- [Godly.website](https://godly.website/)
- [Landingfolio: Health Landing Page Inspiration](https://www.landingfolio.com/inspiration/landing-page/health)
- [Grey Matter Marketing: Standing Out From the Sea of Blue](https://www.greymattermarketing.com/blog/standing-out-from-the-sea-of-blue)
- [Piktochart: Best 15 Medical Color Palette Combinations](https://piktochart.com/tips/medical-color-palette/)
