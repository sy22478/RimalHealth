# SEPA Babies — Skills & Plugins Matrix

> **Prepared by:** T2 Skills & Plugins Orchestrator
> **Date:** 2026-03-24
> **Project:** SEPA Babies Landing Page (Squarespace + Chrome Extension)
> **Status:** Phase 1 — Research & Preparation

---

## 1. claude-mem Analysis

### What It Is

[claude-mem](https://github.com/thedotmack/claude-mem) is a Claude Code plugin by Alex Newman (@thedotmack) that provides **persistent memory across sessions**. It automatically captures everything Claude does during coding sessions, compresses observations using Claude's agent-sdk, and injects relevant context into future sessions. Licensed under AGPL-3.0.

### Architecture

| Component | Technology | Location |
|-----------|-----------|----------|
| Structured storage | SQLite | `~/.claude-mem/claude-mem.db` |
| Vector embeddings | ChromaDB | `~/.claude-mem/vector-db` |
| Search strategy | Hybrid (keyword + semantic) | Combined SQLite + ChromaDB |
| Compression | Claude agent-sdk (async) | Background worker service |
| Integration | MCP tools + lifecycle hooks | Plugin hooks system |

### Lifecycle Hooks (4 total)

| Hook | Trigger | What It Captures |
|------|---------|------------------|
| `SessionStart` | New session begins | Searches past context, auto-injects relevant MEMORY.md |
| `UserPromptSubmit` | User sends a prompt | Records user intent behind actions |
| `PostToolUse` | After any tool call | Records results of file edits, commands, browser actions |
| `Stop` | Session ends | Executes 2-stage compression and storage |

### MCP Tools (3-step token-efficient workflow)

1. **`/mem search`** — Full-text + semantic search across memory index (~50-100 tokens/entry)
2. **`/mem timeline`** — Chronological context around an observation (~500-1,000 tokens/entry)
3. **`/mem get_observations`** — Fetch full observation details by IDs (~500-1,000 tokens/entry)
4. **`/mem save_memory`** — Explicitly save a memory entry

This progressive retrieval achieves approximately **10x token savings** versus loading full session histories.

### Installation

```
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
# Restart Claude Code after installation
```

> **Note:** npm install installs the SDK/library only — it does NOT register plugin hooks. Always install via `/plugin` commands.

### Value for SEPA Babies Project

| Benefit | Why It Matters |
|---------|---------------|
| **Cross-session continuity** | This is a multi-session build across 13 task groups with 213+ sub-tasks. claude-mem prevents "amnesia" between sessions. |
| **Multi-agent memory sharing** | With 8 agent teams (T1-T8), claude-mem lets each agent retrieve what other teams discovered — e.g., T7 (Build) can recall T4's (Design) CSS decisions. |
| **Decision archaeology** | When QA finds issues in Phase 5, claude-mem can surface why a design choice was made in Phase 3. |
| **Squarespace-specific learning** | Browser automation against Squarespace involves trial-and-error. claude-mem captures what worked (and what didn't) with specific Squarespace UI patterns. |
| **Asset tracking** | Remembers which images were uploaded where, which headshots are still missing, and what the user confirmed. |

### Integration Recommendation

**Priority: HIGH — Install before Phase 2 (Build) begins.**

claude-mem should be the first plugin installed because every subsequent session benefits from accumulated memory. The `PostToolUse` hook is especially valuable for this project since Chrome Extension tool calls (upload_image, form_input, computer clicks) are the primary work method and need to be remembered.

---

## 2. Skill-to-Team Mapping

### Team Roster (from trace.md)

| Team | Orchestrator Role | Primary Skills | Secondary Skills |
|------|------------------|----------------|------------------|
| **T1: Planning** | Sprint planning, dependency mapping | `superpowers:writing-plans`, `superpowers:brainstorming` | `schedule`, `superpowers:dispatching-parallel-agents` |
| **T2: Skills & Plugins** | Plugin research, skill management | `update-config`, `claude-md-management:revise-claude-md` | `claude-api`, `superpowers:brainstorming` |
| **T3: Context Management** | Context compilation, cross-team flow | `claude-md-management:claude-md-improver`, `claude-md-management:revise-claude-md` | `superpowers:writing-plans` |
| **T4: Design System & CSS** | Custom CSS, animations, component prep | `frontend-design:frontend-design`, `figma:create-design-system-rules` | `superpowers:brainstorming`, `superpowers:requesting-code-review` |
| **T5: Content & Copy** | Page copy, SEO metadata, text verification | `superpowers:brainstorming`, `superpowers:verification-before-completion` | `superpowers:requesting-code-review` |
| **T6: Asset Management** | Image audit, missing assets, optimization | `superpowers:verification-before-completion` | `superpowers:systematic-debugging` |
| **T7: Squarespace Build** | Browser-based construction | `ralph-loop:ralph-loop`, `superpowers:executing-plans`, `superpowers:dispatching-parallel-agents` | `superpowers:systematic-debugging`, `superpowers:verification-before-completion` |
| **T8: QA & Verification** | Screenshots, responsive testing | `superpowers:verification-before-completion`, `superpowers:systematic-debugging` | `superpowers:requesting-code-review` |

### Detailed Skill-to-Task Mapping

#### `frontend-design:frontend-design`

- **Primary team:** T4 (Design System & CSS)
- **When:** Phase 1 prep (CSS authoring), Phase 4 (Global Styling)
- **Tasks:** TASK 12 — Custom CSS injection (12.3.1-12.3.7), component pattern CSS for stat cards, feature cards, team cards, button variants, animation keyframes
- **Why:** Produces production-grade CSS with distinctive aesthetic choices rather than generic defaults. Critical for achieving the "godly.website-quality" design target stated in the build instructions.

#### `superpowers:brainstorming`

- **Primary teams:** T1 (Planning), T4 (Design), T5 (Content)
- **When:** Phase 1 prep, whenever creative decisions are needed
- **Tasks:** Logo design direction (TASK 0.3.1-0.3.2), Open Graph image creation (TASK 0.3.15), animation pattern decisions, alternative copy options, solving missing-headshot problem creatively
- **Why:** Several assets are marked "NEEDED" — brainstorming can generate creative solutions (AI-generated placeholders, illustrated avatars, etc.)

#### `superpowers:writing-plans`

- **Primary team:** T1 (Planning)
- **When:** Phase 0 initialization, sprint planning
- **Tasks:** Break down the 5-phase build into executable sprints, dependency mapping between tasks, identifying critical path
- **Why:** 213 sub-tasks need sequencing. T7 is blocked until T1-T6 complete prep. Plans need to account for user-dependent steps (password entry, asset collection).

#### `superpowers:executing-plans`

- **Primary team:** T7 (Squarespace Build)
- **When:** Phase 2-3 (building each of the 10 sections)
- **Tasks:** TASKS 1-11 — systematic execution of each section build with review checkpoints between sections
- **Why:** Each section build has 11-25 sub-steps that must execute in order. Review checkpoints catch issues before moving to the next section.

#### `superpowers:dispatching-parallel-agents`

- **Primary teams:** T1 (Planning), T7 (Build)
- **When:** Phase 1 prep (T1-T6 parallel), Phase 3 (independent section prep)
- **Tasks:** Dispatch T1-T6 simultaneously (already happening per trace.md PM-002). During build, dispatch parallel agents for independent prep work (e.g., CSS for section 4 while section 3 is being reviewed).
- **Constraints:** Browser automation is inherently serial (one cursor). Parallel agents can prepare copy/CSS/assets, but actual Squarespace construction must be sequential.

#### `superpowers:verification-before-completion`

- **Primary teams:** T5 (Content), T6 (Assets), T7 (Build), T8 (QA)
- **When:** After every section build, after CSS injection, after form setup, before publish
- **Tasks:** Every "Screenshot and verify" sub-task (3.7.5, 4.5.3, 5.6.2, 6.6.5, 7.7.4, 8.5.2, 9.5.2, 10.6.1, 11.3.6). TASK 13 (Final Review & QA) in its entirety.
- **Why:** This is a visual product. Every section must be screenshot-verified against the design system before moving on. The skill enforces this discipline.

#### `superpowers:systematic-debugging`

- **Primary teams:** T7 (Build), T8 (QA)
- **When:** Phase 3-5, whenever something doesn't look right or work correctly
- **Tasks:** CSS not applying (12.3.7), mobile layout issues (12.4.9, 12.4.11), form submission failures (13.3), animation jank (13.4.3), Squarespace editor unexpected behavior
- **Why:** Browser automation against a WYSIWYG editor is inherently unpredictable. Systematic debugging prevents wasted time on trial-and-error.

#### `superpowers:test-driven-development`

- **Primary team:** T8 (QA)
- **When:** Phase 4-5 (CSS and QA)
- **Tasks:** TASK 13.2 (Test Interactions), TASK 13.3 (Test Form Submission), TASK 13.4 (Performance Check)
- **Adapted approach:** Not traditional TDD, but "write the expected behavior checklist first, then verify." The checklist already exists in TASK 13.1 (13 verification items).

#### `superpowers:requesting-code-review`

- **Primary teams:** T4 (Design), T5 (Content), T8 (QA)
- **When:** After CSS injection (Phase 4), after all copy is finalized, before publish
- **Tasks:** Review CSS code injection (TASK 12.3), review SEO metadata (TASK 12.5), final full-page review (TASK 13.1)
- **Why:** Custom CSS injected via Code Injection affects the entire site. A review catch bugs before they propagate.

#### `ralph-loop:ralph-loop`

- **Primary team:** T7 (Squarespace Build)
- **When:** Phase 3 — during section-by-section builds
- **Tasks:** TASKS 2-11 (building 10 sections sequentially)
- **Why:** Each section requires 10-25 sequential browser automation steps. Ralph Loop keeps Claude working autonomously through the full sequence without losing momentum or stopping prematurely. The `<promise>` tag pattern aligns with "Screenshot and verify" checkpoints.

#### `ralph-loop:help`

- **Primary team:** Any team unfamiliar with Ralph Loop
- **When:** Phase 0 (training/onboarding)
- **Tasks:** N/A — informational only

#### `claude-md-management:revise-claude-md`

- **Primary teams:** T2 (Skills), T3 (Context)
- **When:** After Phase 1 prep, after each major discovery
- **Tasks:** Update CLAUDE.md with Squarespace-specific learnings, tool interaction patterns, and skill activation notes
- **Why:** CLAUDE.md is the project's persistent context. As teams discover what works in Squarespace, those learnings should be captured.

#### `claude-md-management:claude-md-improver`

- **Primary team:** T3 (Context Management)
- **When:** Phase 0 (audit existing CLAUDE.md), between build phases
- **Tasks:** Audit CLAUDE.md for completeness, add missing sections (e.g., known Squarespace gotchas, MCP tool best practices)
- **Why:** The current CLAUDE.md is solid but could be enhanced with tool-specific tips discovered during the build.

#### `figma:implement-design`

- **Primary team:** T4 (Design System & CSS)
- **When:** Phase 1 prep (if Figma mockups exist)
- **Tasks:** Translate any existing Figma designs to CSS/HTML
- **Applicability:** LOW for this project — the build instructions serve as the "design spec" and the target is Squarespace (not custom code). Only relevant if the team creates Figma mockups first.

#### `figma:create-design-system-rules`

- **Primary team:** T4 (Design System & CSS)
- **When:** Phase 1 prep
- **Tasks:** Generate formal design system rules from the Design System section of the build instructions
- **Why:** The build instructions contain a comprehensive design system (colors, typography, spacing, components). This skill can formalize it into reusable rules that all agents reference consistently.

#### `schedule`

- **Primary team:** T1 (Planning)
- **When:** Phase 0 — for scheduling follow-up agents
- **Tasks:** Schedule agents for: morning asset check (are headshots uploaded?), post-build QA sweeps, reminder to user about manual steps
- **Why:** Some tasks depend on user action (headshot collection, password entry). Scheduled agents can check back.

#### `update-config`

- **Primary team:** T2 (Skills & Plugins)
- **When:** Phase 0 — initial configuration
- **Tasks:** Configure settings, hooks, permissions for optimal build workflow. Set up any needed MCP tool permissions.

#### `claude-api`

- **Primary team:** T4 (Design), T6 (Assets)
- **When:** Phase 1 prep (if generating assets)
- **Tasks:** Potentially use Claude API for generating placeholder images, Open Graph image, or favicon from existing product photos
- **Applicability:** MEDIUM — useful if missing assets cannot be collected from the team.

---

## 3. Recommended Skill Activations (Priority-Ordered)

### Tier 1 — Activate Immediately (Phase 0)

| Priority | Skill | Reason |
|----------|-------|--------|
| **P0** | `claude-mem` (plugin) | Install first. Every session henceforth benefits from persistent memory. Critical for 8-team coordination. |
| **P1** | `superpowers:writing-plans` | T1 needs to produce the sprint plan that unblocks all other teams. |
| **P2** | `superpowers:dispatching-parallel-agents` | Enable T1-T6 parallel deployment (already in progress per trace.md). |
| **P3** | `claude-md-management:claude-md-improver` | Audit and enhance CLAUDE.md before the build starts — establishes shared context baseline. |
| **P4** | `update-config` | Configure tool permissions, hooks, and settings for the build environment. |

### Tier 2 — Activate During Prep (Phase 1)

| Priority | Skill | Reason |
|----------|-------|--------|
| **P5** | `frontend-design:frontend-design` | T4 needs this to produce premium CSS. Activate before any CSS authoring begins. |
| **P6** | `figma:create-design-system-rules` | Formalize the design system from build instructions into machine-readable rules. |
| **P7** | `superpowers:brainstorming` | Solve creative problems: missing assets, logo design direction, copy alternatives. |
| **P8** | `superpowers:verification-before-completion` | Activate before any output is declared "done" — enforces screenshot verification discipline. |

### Tier 3 — Activate at Build Start (Phase 2-3)

| Priority | Skill | Reason |
|----------|-------|--------|
| **P9** | `ralph-loop:ralph-loop` | Activate when T7 starts section builds. Keeps autonomous execution going through 10-25 step sequences. |
| **P10** | `superpowers:executing-plans` | T7 executes the plans T1 wrote. Review checkpoints between sections. |
| **P11** | `superpowers:systematic-debugging` | Have ready for when Squarespace editor behaves unexpectedly. |

### Tier 4 — Activate for Polish & QA (Phase 4-5)

| Priority | Skill | Reason |
|----------|-------|--------|
| **P12** | `superpowers:requesting-code-review` | Review CSS injection code before it goes live site-wide. |
| **P13** | `superpowers:test-driven-development` | Adapted for QA checklist verification (TASK 13). |
| **P14** | `claude-md-management:revise-claude-md` | Capture all learnings from the build into CLAUDE.md for future reference. |

---

## 4. Plugin Gaps — What's Missing

### Gap 1: Squarespace-Specific Automation Skill

**Need:** A skill that encodes Squarespace editor patterns — where to click to add sections, how to access Code Injection, how to upload images in the editor, how to configure form blocks.

**Current state:** No Squarespace-specific skill exists in the ecosystem. The team is relying on generic Chrome Extension tools (find, computer, form_input) and trial-and-error.

**Recommendation:** Create a custom `SKILL.md` file (e.g., `squarespace-builder`) that documents:
- Common Squarespace editor UI patterns and click targets
- Section type selection shortcuts
- CSS Code Injection access path
- Form block configuration steps
- Image upload best practices within the editor
- Known Squarespace editor quirks and workarounds

**Priority:** HIGH — would dramatically accelerate T7's work.

### Gap 2: Visual Regression / Screenshot Diff Skill

**Need:** A skill that compares screenshots against design system expectations — catching color drift, spacing violations, font mismatches automatically rather than relying on human eye review.

**Current state:** QA is done via manual screenshot review (gif_creator + read_page). No automated comparison exists.

**Recommendation:** Create or install a skill that:
- Takes a screenshot and extracts dominant colors, checking against the palette
- Measures element spacing against the 8px grid
- Verifies font rendering matches the typography scale
- Flags visual regressions between builds

**Priority:** MEDIUM — valuable for TASK 13 (Final QA) but manual review is feasible.

### Gap 3: Asset Generation / Placeholder Skill

**Need:** Several critical assets are missing (logo, headshots, favicon, OG image). A skill that generates professional placeholders or creates assets from existing materials would unblock T6.

**Current state:** 7 assets marked "NEEDED" in tasks.md (TASK 0.3). The build cannot fully complete without them.

**Recommendation:** A skill combining:
- AI image generation for logo concepts
- Circular avatar generation from name/initials (for missing headshots)
- Favicon extraction from logo
- OG image composition from existing hero illustrations

**Priority:** HIGH — directly unblocks TASK 0.3 which blocks TASKS 2, 9, and 12.6.

### Gap 4: Copy Verification Skill (Brand Voice Consistency)

**Need:** The build instructions contain exact copy for every section. A skill that verifies what's actually on the live page matches the specified copy (no typos, no truncation, correct formatting).

**Current state:** Copy verification is manual — read_page or get_page_text then compare by eye.

**Recommendation:** A skill that:
- Extracts text from each section via `get_page_text`
- Diffs against the canonical copy in `SEPA_Landing_Page_Build_Instructions.md`
- Reports mismatches, missing text, or formatting differences

**Priority:** MEDIUM — reduces risk of copy errors across 10 sections with 50+ text elements.

### Gap 5: Session Orchestration / Multi-Agent Coordination Plugin

**Need:** A plugin that manages handoffs between the 8 agent teams — tracking who finished what, what's unblocked, and who goes next.

**Current state:** `trace.md` is being used as a manual coordination log. Team status is tracked as text.

**Recommendation:** The combination of `claude-mem` + `schedule` + `superpowers:dispatching-parallel-agents` partially covers this, but a dedicated orchestration plugin would provide:
- Formal task status tracking (beyond text in tasks.md)
- Dependency resolution (auto-detect when a task's blockers are cleared)
- Agent dispatch queue management

**Priority:** LOW — the current manual approach works for a team of 8. Would matter more at 20+ agents.

### Gap 6: Squarespace Preview / Live URL Validator

**Need:** After publishing, validate the live site works correctly (links resolve, images load, form submits, mobile renders properly).

**Current state:** TASK 13.6.4 says "Test live site on a separate device/browser" but no automated tool exists.

**Recommendation:** Leverage the Playwright MCP tools already available (`mcp__plugin_playwright_playwright__*`) to:
- Navigate to the live URL
- Take screenshots at multiple viewports (mobile, tablet, desktop)
- Click all anchor links and verify scroll
- Submit a test form entry
- Check for console errors

**Priority:** MEDIUM — Playwright tools are already in the environment; a skill wrapping them for Squarespace validation would save time.

---

## 5. Skill Activation Timeline

### Phase 0: Initialization (Current — Day 1)

```
ACTIVATE NOW
├── claude-mem (plugin)                          ← Install first, benefits all future sessions
├── superpowers:writing-plans                    ← T1 produces sprint plan
├── superpowers:dispatching-parallel-agents      ← T1 dispatches T1-T6 in parallel
├── claude-md-management:claude-md-improver      ← T3 audits/improves CLAUDE.md
├── update-config                                ← T2 configures environment
└── superpowers:brainstorming                    ← T4/T5/T6 creative problem-solving
```

**Milestone:** Sprint plan produced, CLAUDE.md enhanced, teams dispatched.

### Phase 1: Research & Preparation (Day 1-2)

```
ACTIVATE FOR PREP
├── frontend-design:frontend-design              ← T4 begins CSS authoring
├── figma:create-design-system-rules             ← T4 formalizes design system
├── superpowers:verification-before-completion   ← All teams verify their outputs
├── claude-md-management:revise-claude-md        ← T2/T3 capture prep learnings
└── [NEW] squarespace-builder skill              ← Create custom SKILL.md for Squarespace patterns
```

**Team outputs due:**
- T1: Sprint plan with dependency graph
- T2: This skills matrix (complete)
- T3: Enhanced CLAUDE.md + context packages for each team
- T4: Complete CSS stylesheet ready for Code Injection
- T5: All copy verified and formatted for paste-ready use
- T6: Asset audit with solutions for all "NEEDED" items

**Milestone:** All prep complete, T7 unblocked (pending user Squarespace auth).

### Phase 2: Site Setup (Day 2)

```
ACTIVATE FOR BUILD
├── ralph-loop:ralph-loop                        ← T7 begins autonomous section builds
├── superpowers:executing-plans                  ← T7 follows T1's sprint plan
└── superpowers:systematic-debugging             ← Ready for Squarespace editor issues
```

**User action required:** Log into Squarespace (type password manually).

**Milestone:** Squarespace site created, blank template selected, site title set.

### Phase 3: Section-by-Section Build (Day 2-4)

```
ACTIVE DURING BUILD
├── ralph-loop:ralph-loop                        ← Continuous autonomous execution
├── superpowers:executing-plans                  ← Checkpoint after each section
├── superpowers:verification-before-completion   ← Screenshot verify after each section
├── superpowers:systematic-debugging             ← Debug layout/styling issues
└── superpowers:dispatching-parallel-agents      ← Prep next section's assets while current builds
```

**Build order (sequential, per build instructions):**
1. Navigation Bar (TASK 2)
2. Hero Section (TASK 3)
3. Problem Section (TASK 4)
4. Solution Section (TASK 5)
5. Product Line (TASK 6)
6. How It Works (TASK 7)
7. Market & Traction (TASK 8)
8. Team Section (TASK 9)
9. Waitlist/CTA (TASK 10)
10. Footer (TASK 11)

**Milestone:** All 10 sections built and individually screenshot-verified.

### Phase 4: Global Styling & Polish (Day 4-5)

```
ACTIVATE FOR POLISH
├── frontend-design:frontend-design              ← Final CSS refinement
├── superpowers:requesting-code-review           ← Review CSS before injection
├── superpowers:verification-before-completion   ← Verify each responsive breakpoint
└── superpowers:systematic-debugging             ← Fix mobile/tablet issues
```

**Tasks:** TASK 12 — Fonts, colors, CSS injection, mobile responsive checks, SEO, favicon/OG.

**Milestone:** Site fully styled, responsive, SEO-configured.

### Phase 5: QA & Launch (Day 5)

```
ACTIVATE FOR QA
├── superpowers:verification-before-completion   ← Full QA checklist (13.1)
├── superpowers:test-driven-development          ← Interaction testing (13.2-13.4)
├── superpowers:systematic-debugging             ← Fix any issues found
├── claude-md-management:revise-claude-md        ← Capture all learnings for future
└── [NEW] playwright-based live-site validator   ← Post-publish validation
```

**Tasks:** TASK 13 — Full visual QA, interaction testing, form testing, performance, GIF walkthrough, publish.

**Milestone:** Site live and verified.

---

## 6. MCP Tools Already Available (Ecosystem Audit)

The current environment includes several MCP tool sets that map directly to project needs:

| MCP Server | Tools Available | Project Use |
|------------|----------------|-------------|
| **claude-in-chrome** | navigate, find, computer, form_input, upload_image, read_page, get_page_text, javascript_tool, gif_creator, resize_window, tabs_* | **PRIMARY BUILD TOOLS** — all Squarespace construction |
| **Playwright** | browser_navigate, browser_click, browser_fill_form, browser_take_screenshot, browser_evaluate, browser_resize | **QA & VALIDATION** — automated testing of live site |
| **GitHub** | get_file_contents, create_issue, search_* | **PROJECT MANAGEMENT** — track issues, reference repos |
| **Perplexity** | search, reason, deep_research | **RESEARCH** — Squarespace docs, CSS patterns, accessibility standards |
| **Serena** | read_file, edit_memory, write_memory, list_memories | **CONTEXT MANAGEMENT** — alternative memory system to claude-mem |
| **Context7** | resolve-library-id, query-docs | **DOCUMENTATION** — look up library docs (CSS, accessibility) |
| **Neon** | run_sql, create_project, * | **NOT NEEDED** — no database in this project |

### Key Insight: Playwright as QA Automation

The Playwright MCP tools (`mcp__plugin_playwright_playwright__*`) are already installed and can fill Gap 6 (live site validation) without any new plugins. T8 should use Playwright for automated QA alongside the Chrome Extension's gif_creator for visual documentation.

---

## 7. Summary & Next Steps

### Immediate Actions (T2 Responsibility)

1. **Install claude-mem** — `/plugin marketplace add thedotmack/claude-mem` then `/plugin install claude-mem`
2. **Create squarespace-builder SKILL.md** — Document Squarespace editor patterns from initial exploration sessions
3. **Activate Tier 1 skills** — Ensure T1, T3, T4, T5, T6 have access to their primary skills
4. **Update CLAUDE.md** — Add skill activation notes and MCP tool usage tips using `claude-md-management:revise-claude-md`
5. **Brief T7 on Ralph Loop** — Run `ralph-loop:help` so the Build team understands autonomous execution patterns

### Dependencies on Other Teams

| Dependency | From Team | Needed By |
|------------|-----------|-----------|
| Sprint plan with skill annotations | T1 (Planning) | All teams |
| Enhanced CLAUDE.md | T3 (Context) | All teams |
| CSS stylesheet ready for injection | T4 (Design) | T7 (Build) |
| Verified copy document | T5 (Content) | T7 (Build) |
| Asset availability report | T6 (Assets) | T7 (Build) |
| User Squarespace authentication | User (manual) | T7 (Build) |

### Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing assets (logo, headshots) block build | HIGH | T6 + brainstorming skill generate placeholders; schedule reminder agents for user |
| Squarespace editor changes break automation | MEDIUM | claude-mem captures working patterns; systematic-debugging skill for recovery |
| CSS injection conflicts with Squarespace defaults | MEDIUM | frontend-design + code-review skills catch issues early; test on preview before publish |
| Session context loss across 8 teams | HIGH | claude-mem primary mitigation; CLAUDE.md as fallback; trace.md for coordination |
| Ralph Loop enters infinite loop on stuck step | LOW | verification-before-completion enforces checkpoint; user can interrupt |

---

*This document should be updated as skills are activated and gaps are filled during the build.*
