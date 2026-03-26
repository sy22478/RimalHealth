# Claude Code Dev Setup Framework

> **Derived from:** SEPA Babies landing page project (9 agents, ~545K tokens, 208 tool calls, complete site built in one session)
> **Purpose:** Replicable multi-document planning system for orchestrating Claude Code on any project

---

## 1. Framework Overview

### The Problem This Solves

Claude Code operates one conversation at a time. Complex projects require multiple agents working in parallel, shared state across sessions, and coordination without a real-time message bus. This framework solves that with **10 purpose-specific documents** organized into 4 tiers.

### The 4-Tier Document Ecosystem

```
TIER 1: HUB (1 file)
  CLAUDE.md                         → Entry point, router, quick reference
                                      Target: 5-10 KB

TIER 2: CORE PLANNING (3 files)
  build_instructions.md             → HOW to build (specs + phased steps)
  tasks.md                          → WHAT to do next (atomic checklist)
  sprint_plan.md                    → WHEN to do it (sequencing + blockers)

TIER 3: REFERENCE MATERIAL (3 files)
  copy_deck.md / content.md         → WHAT to say/render (paste-ready content)
  asset_manifest.md                 → WHAT resources exist (inventory)
  context_brief.md                  → WHY (business context, domain knowledge)

TIER 4: COORDINATION (3 files)
  skills_matrix.md                  → WHO does what (agent team mapping)
  trace.md                          → WHAT HAPPENED (execution audit trail)
  .claude/settings.local.json       → PERMISSIONS (tool access whitelist)
```

### Why Each Document Exists

| Document | Cognitive Function | Without It... |
|----------|-------------------|---------------|
| CLAUDE.md | Orient & route | Agents waste tokens exploring the project blind |
| build_instructions.md | Specify & constrain | Agents make inconsistent design/architecture decisions |
| tasks.md | Track & coordinate | No shared state; agents duplicate or skip work |
| sprint_plan.md | Sequence & unblock | Builds stall on blockers with no workarounds |
| copy_deck.md | Supply content | Agents invent text or inconsistently copy from sources |
| asset_manifest.md | Inventory & plan | Missing asset discovered mid-build, breaking flow |
| context_brief.md | Explain & resolve | Source conflicts propagate as bugs |
| skills_matrix.md | Assign & activate | Wrong tools used at wrong times |
| trace.md | Record & coordinate | Cross-team notes lost between sessions |
| settings.local.json | Permit & protect | Agents blocked by permission prompts, breaking flow |

### How They Interconnect

```
CLAUDE.md (hub — every agent reads first)
├── build_instructions.md (HOW — specs + phased build steps)
│   └── tasks.md (WHAT — atomic actions derived from build instructions)
│       └── sprint_plan.md (WHEN — sequences tasks, maps blockers)
│           ├── asset_manifest.md (feeds blocker analysis)
│           └── skills_matrix.md (feeds team assignments)
├── copy_deck.md (WHAT to say — paste-ready with formatting specs)
├── context_brief.md (WHY — unified from all source documents)
├── trace.md (audit trail — updated by all agents during execution)
└── .claude/settings.local.json (gates what agents can do)
```

---

## 2. Document Generation Order

Documents have dependencies — some must exist before others can be created. Follow this DAG:

```
PHASE A: Foundation (human + 1 agent, serial)
  A1: Gather raw source materials into a directory
  A2: Write CLAUDE.md v1 (project identity, tech stack, conventions)
  A3: Generate context_brief.md (synthesize all sources into one reference)

PHASE B: Specification (2-3 agents, parallel)
  B1: build_instructions.md (from context_brief + tech stack)
  B2: copy_deck.md (from context_brief + build instructions outline)
  B3: asset_manifest.md (from source directory inventory)

PHASE C: Execution Planning (2-3 agents, parallel after B)
  C1: tasks.md (derived from build_instructions.md)
  C2: sprint_plan.md (derived from tasks.md + asset_manifest.md)
  C3: skills_matrix.md (derived from tasks.md + available tools)

PHASE D: Finalization (1 agent, serial)
  D1: Update CLAUDE.md v2 (add cross-references to all docs)
  D2: Write .claude/settings.local.json
  D3: Initialize trace.md (empty template)

PHASE E: Execution
  Agents read CLAUDE.md → follow sprint_plan → update tasks.md → log trace.md
```

### Why This Order

- **context_brief.md first** — it resolves inconsistencies across source materials that would otherwise propagate into every downstream document. In SEPA, this caught 6 conflicts (e.g., "1 in 36" vs "1 in 20" statistics used interchangeably).
- **build_instructions before tasks.md** — you can't create an atomic checklist until you know the full scope.
- **sprint_plan after tasks + assets** — sequencing requires knowing both what needs doing AND what resources exist/are blocked.
- **CLAUDE.md written twice** — skeleton in Phase A (enough to start), complete version in Phase D (cross-linked to everything).

---

## 3. Document Templates

### 3.1 CLAUDE.md — The Hub

See `templates/CLAUDE_md_template.md` for a fill-in-the-blanks version.

**Required sections:**

| Section | Purpose | Size Target |
|---------|---------|-------------|
| Project Overview | What it is, who it's for, what problem it solves | 2-3 sentences |
| Tech Stack & Architecture | Runtime, framework, database, deployment | Bullet list |
| Project Structure | ASCII tree with annotations | 10-20 lines |
| Commands | Dev, test, deploy — exact commands | 5-15 lines |
| Key Reference Files | Table linking to all planning docs | 1 row per doc |
| Domain Knowledge | Essential facts every agent needs | 3-10 items |
| Design System (if frontend) | Color tokens, typography, spacing, components | Summary table |
| Conventions | Rules that every agent must follow | 5-10 bullets |

**Critical conventions to always include:**
```
- Always read tasks.md to check current progress before starting work
- Update task statuses in tasks.md as work is completed
- Follow build order from [build_instructions file]
```

**Size target:** 5-10 KB. Larger = agents waste context reading the hub instead of working.

### 3.2 build_instructions.md — The HOW

Adapt the name to your project type: `build_instructions.md`, `architecture.md`, `pipeline_architecture.md`, etc.

**Required sections:**

```markdown
# [Project Name] — Build Instructions

> **Purpose:** [what this document provides]

## DESIGN SYSTEM / ARCHITECTURE
### [Subsection per major concern]
| Token/Pattern | Value | Usage |
[tables for design tokens, API contracts, data models, etc.]

## PREREQUISITES
[numbered checklist of what must exist before building]

## PHASE 1: [Foundation]
### Step 1 — [Name]
[exact instructions with specs, measurements, references]

## PHASE 2: [Core Build]
### [Component/Module 1] — [Name]
**Goal:** [what this achieves]
**Spec:** [structural description]
[numbered steps with exact content/code]

## PHASE N: [Polish/QA]
[global concerns, testing, deployment]
```

**Key pattern:** Each component follows the same sub-structure (Goal → Spec → Steps → Styling/Config). Consistency lets build agents parse every section identically.

**Size target:** 15-40 KB depending on project complexity.

### 3.3 tasks.md — The WHAT (Shared Mutable State)

**This is the most critical coordination document.** It's the ONLY file that multiple agents update.

**Required format:**

```markdown
# [Project Name] — Task Tracker

> **Status Legend:** `[ ]` To Do | `[~]` In Progress | `[x]` Done | `[!]` Blocked

## TASK 0: Prerequisites
- [ ] **0.1 [Category]**
  - [ ] 0.1.1 [Atomic action — single verb, single outcome]
  - [ ] 0.1.2 [Atomic action]

## TASK 1: [First Build Phase]
- [ ] **1.1 [Subtask Group]**
  - [ ] 1.1.1 [Atomic action]
  - [ ] 1.1.2 [Verification: "Run tests" or "Check output"]

## TASK N: QA & Deploy
- [ ] **N.1 [QA Category]**
  - [ ] N.1.1 [Verification action]
```

**Rules:**
- **Numbering:** `TASK N.A.B` — globally unique IDs that other docs reference
- **Atomic:** Every sub-subtask = one action, one verb, verifiable completion
- **Inline verification:** Test/check steps live next to what they verify, not in a separate QA section
- **Blocked items:** Must identify what blocks them: `[!] 2.1.3 Upload logo (**BLOCKED:** waiting for logo from designer)`

**Size target:** 10-30 KB (SEPA had 240 sub-subtasks in 25 KB).

### 3.4 sprint_plan.md — The WHEN

**Required sections:**

```markdown
# [Project Name] — Sprint Plan

> **Total Scope:** [N task groups, M subtasks]
> **Current State:** [brief status]

## PROJECT STATUS SNAPSHOT

### Resource Audit
| Resource | Status | Location | Blocker? |
[every dependency: APIs, assets, credentials, libraries]

### Task Completion Summary
| Task Group | Done | Remaining |
[summary per task group]

## SPRINT 0: [PRE-BUILD PREPARATION]
**Goal:** [what this sprint achieves]
**Duration:** [hours/days]
**Parallel teams:** [which agents work simultaneously]

### 0A. [Workstream] ([Team])
**Tasks:** [task IDs from tasks.md]
| # | Action | Task ID | Priority |
[action table with P0/P1/P2]

**Workarounds if blocked:**
- [Blocker]: [Solution 1 (FASTEST)] / [Solution 2] / [Solution 3]

## SPRINT N: [Name]
**Goal:** [deliverable]
**Prerequisites:** [what must be done first]
**Duration:** [estimate]
[same structure]
```

**Critical pattern — the Workaround Matrix:** Every identified blocker gets ranked solutions with "FASTEST" explicitly marked. This is what prevents builds from stalling. Example from SEPA:
```
- Logo MISSING: (1) Text-only "SEPA Babies" in Poppins Bold [FASTEST]
                (2) Extract from existing illustrations
                (3) AI-generated logo
                (4) Professional design [BEST but slow]
```

**Size target:** 15-30 KB.

### 3.5 copy_deck.md / content.md — The Content

**Required sections:**

```markdown
# [Project Name] — Content Deck

> **Sources cross-referenced:** [list of source documents]

## [Component 1] — [Name]

### [Element Name]
```text
[Exact text to use]
```
- **Style:** [typography/formatting spec]
- **Character count:** [N]
- **Variants:** [alternative copy if applicable]

## SEO / Metadata
| Element | Text |
[title, description, OG tags]

## Inconsistencies Found
| Source A says | Source B says | Resolution |
[conflict resolution log]
```

**Why character counts matter:** They catch truncation bugs in constrained UI elements and help estimate layout space.

**Size target:** 10-30 KB.

### 3.6 asset_manifest.md — The Inventory

**Required sections:**

```markdown
# [Project Name] — Asset Manifest

> **Assets directory:** [path]

## 1. Complete Inventory
| # | File | Location | Size | Format | Status | Notes |
[measured metadata — not estimated]

## 2. Usage Order by Task ID
| Order | Task ID | Component | Asset | Purpose |
[when each asset is needed during the build]

## 3. Missing Asset Solutions
### [Asset Name] — [CRITICAL/BLOCKING/NICE-TO-HAVE]
**Status:** [what's missing]
**Solutions (ranked by speed):**
1. [FASTEST] ...
2. [NEXT] ...
**Recommendation:** [which to use]

## 4. Pre-Build Checklist
- [ ] [item]
```

**Key pattern:** Measure metadata with actual tools (e.g., `python3` for image dimensions), don't estimate. SEPA's asset team used `python3` to measure all 9 images, discovering that Tier 1 images were smaller (676px vs 1179px) — a finding that drove a CSS `object-fit` fix.

**Size target:** 5-20 KB.

### 3.7 context_brief.md — The WHY

The largest document. Synthesizes ALL source materials into one reference.

**Required sections:**

```markdown
# [Project Name] — Context Brief

> **Source Documents:** [list every source with brief description]

## 1. Project Summary
[1 paragraph: what, who, why, when]

## 2. Brand Voice & Tone (user-facing projects)
### Voice Characteristics
### Messaging Pillars
### Key Taglines

## 3. Content Library (by Component)
| Element | Text | Source |
[every piece of content with source attribution]

## 4. Key Statistics & Claims
| Stat | Value | Source | Notes |
[every number, with source for traceability]

## 5. People / Team (if applicable)
### [Name] — [Role]
**Short bio:** [for UI]
**Full bio:** [for reference]

## 6. Domain Knowledge
[organized by topic]

## 7. Inconsistencies Found
### [CRITICAL/MINOR]: [Description]
| Document | Value |
**Resolution:** [which value to use and why]
```

**This document's superpower:** The inconsistency log. SEPA found 6 conflicts across 9 source documents. Without this upfront resolution, every downstream document would have had a coin flip for which value to use.

**Size target:** 20-50 KB.

### 3.8 skills_matrix.md — The WHO

**Required sections:**

```markdown
# [Project Name] — Skills & Agent Matrix

## 1. Agent Team Roster
| Team | Role | Primary Skills | Status |

## 2. Skill-to-Task Mapping
### [Skill Name]
- **Team:** [ID]
- **When:** [phase]
- **Tasks:** [IDs]

## 3. Activation Order
### Tier 1 — Immediate
### Tier 2 — During Prep
### Tier 3 — At Build Start

## 4. Capability Gaps
### [Gap]: Need / Current State / Recommendation / Priority

## 5. Available Tools Audit
| Tool/MCP Server | Capabilities | Project Use |

## 6. Risk Register
| Risk | Impact | Mitigation |
```

**Size target:** 10-30 KB.

### 3.9 trace.md — The Audit Trail

**Required format:**

```markdown
# [Project Name] — Agent Trace Log

> **Created:** [date]
> **Project Manager:** [orchestrating agent]
> **Status:** Active

## Team Structure
| Team | Focus | Status |

## Trace Entries

### Phase 0 — Initialization
- **[PM-001]** [date] — [action]

### Phase 1 — [Name]
#### [Team Name]
- **[T1-001]** [STATUS] — [deliverable] ([tokens], [tool calls])
- **Analysis:** [what was produced, key findings]
- **Deliverable:** [file path]
- **Quality:** [High/Excellent + notes]
- **Cross-team note:** [anything other teams need to know]

### [PIVOT/CHANGE]
- **[PM-NNN]** [date] — [change description]
- **Impact:** [POSITIVE/NEGATIVE/NEUTRAL]
- **Actions:** [what was done]
```

**The cross-team note pattern** is what makes multi-agent coordination work without a message bus. Example from SEPA: *"CSS classes use `sepa-` prefix. Build team must add these classes to HTML elements."*

**Size target:** Grows during execution. Starts at <1 KB.

### 3.10 .claude/settings.local.json — Permissions

See `templates/settings_local_json_templates.md` for project-type-specific patterns.

**Structure:**
```json
{
  "permissions": {
    "allow": [
      "Bash(category_command:*)"
    ]
  }
}
```

**Categories to pre-configure:**
1. Package management (npm, pip, cargo, etc.)
2. Build & dev tools (run scripts, compilers)
3. Deployment (netlify, vercel, docker, aws)
4. Version control (git, gh)
5. File operations (cp, mkdir, open)
6. External access (WebFetch for docs, WebSearch)
7. Testing (test runners, curl for smoke tests)
8. Language runtimes (python3 for reading binary docs)

---

## 4. Agent Orchestration Pattern

### The Two-Phase Parallel Dispatch Model

```
PHASE 1: PARALLEL PREPARATION (all independent)
  Agent-A: Planning         → sprint_plan.md
  Agent-B: Skills Audit     → skills_matrix.md
  Agent-C: Context Compile  → context_brief.md
  Agent-D: Design/Arch      → build_instructions.md (or code scaffold)
  Agent-E: Content          → copy_deck.md
  Agent-F: Asset Audit      → asset_manifest.md

  [SYNC: PM reads all 6, resolves conflicts, makes go/no-go decision]

PHASE 2: PARALLEL BUILD (depends on Phase 1)
  Agent-G: Build Part 1     → code/components (top half / frontend)
  Agent-H: Build Part 2     → code/components (bottom half / backend)
  Agent-I: Infrastructure   → config, deploy setup (if needed)

  [SYNC: PM merges, runs integration checks]

PHASE 3: QA (serial, depends on merged build)
  Agent-J: QA & Polish      → verified, deployed artifact
```

### Team Sizing Guide

| Project Complexity | Phase 1 Agents | Phase 2 Agents | Total | Est. Tokens |
|-------------------|----------------|----------------|-------|-------------|
| **Small** (CLI tool, script) | 2-3 | 1-2 | 3-5 | ~150-250K |
| **Medium** (landing page, API) | 4-6 | 2-3 | 6-9 | ~400-600K |
| **Large** (full-stack app) | 6-8 | 4-6 | 10-14 | ~800K-1.2M |

### The 6 Critical Coordination Rules

These were proven by SEPA's successful 9-agent execution:

1. **tasks.md is the ONLY mutable shared state.** All other docs are write-once-read-many. This prevents coordination conflicts.

2. **Every agent reads CLAUDE.md first.** It's the project's "system prompt" — routes agents to the right specialized document.

3. **Cross-team notes go in trace.md.** Not in chat, not in comments. trace.md survives across sessions and agents.

4. **The PM agent merges and resolves conflicts.** After Phase 1, PM reads all deliverables and resolves inconsistencies before Phase 2 begins.

5. **Build agents work on non-overlapping file sets.** SEPA split HTML into top (sections 1-5) and bottom (sections 6-10). Zero merge conflicts possible.

6. **Every deliverable gets a quality assessment in trace.md.** The PM logs quality ratings with specific notes. This enables targeted rework without re-reading entire outputs.

### Agent Prompt Template

When dispatching a preparation agent:

```
You are [Team Name] for the [Project Name] project.

**Your deliverable:** [file name and path]
**Your mission:** [1-2 sentence description]

**Context:**
- Read CLAUDE.md first for project overview
- [Specific source files to read]
- [Specific constraints or format requirements]

**Output format:**
- Follow the template in [section of this guide]
- Include cross-references to task IDs from tasks.md
- Note any inconsistencies or blockers found

**Do NOT:**
- Modify any files except your deliverable
- Make assumptions about other teams' work
- Skip the inconsistency/blocker analysis
```

When dispatching a build agent:

```
You are [Build Team] for the [Project Name] project.

**Your deliverable:** [file(s) to create/modify]
**Your scope:** [exactly which components/sections/modules]

**References (read in this order):**
1. CLAUDE.md — project conventions
2. build_instructions.md — specs for your components
3. copy_deck.md — exact content to use
4. tasks.md — mark completed tasks as [x]

**Critical rules:**
- Use design tokens/constants from [file], never hardcode
- Your files must not overlap with [other build agent's scope]
- Log cross-team notes in trace.md if you discover anything other agents need
```

---

## 5. Project-Type Adaptation

### Universal Documents (required for ALL project types)

| Document | Always Needed | Why |
|----------|---------------|-----|
| CLAUDE.md | Yes | Every project needs an agent entry point |
| tasks.md | Yes | Every project has trackable work |
| sprint_plan.md | Yes | Every project benefits from sequencing + blocker management |
| context_brief.md | Yes | Every project has domain knowledge agents need |
| trace.md | Yes (if multi-agent) | Coordination requires an audit trail |
| settings.local.json | Yes | Permission boundaries prevent interruptions |

### Adaptation Map by Project Type

#### Static Websites / Landing Pages
Use the full 10-document system as-is. This is the SEPA pattern directly.

| Document | Name | Notes |
|----------|------|-------|
| build_instructions | `build_instructions.md` | Design system + section-by-section build |
| content | `copy_deck.md` | All page text with font specs |
| assets | `asset_manifest.md` | Images, icons, illustrations |
| skills | `skills_matrix.md` | Browser automation + design skills |

#### Full-Stack Web Apps (React/Next.js + API)

| Document | Name | Adaptation |
|----------|------|------------|
| build_instructions | Split: `frontend_instructions.md` + `api_instructions.md` | Separate specs for UI and API layers |
| content | `content.md` | UI strings, error messages, email templates |
| assets | `asset_manifest.md` | Add: API integrations, env vars, DB schemas alongside media |
| *additional* | `data_model.md` | Entity relationships, migrations, constraints |
| skills | `skills_matrix.md` | Frontend + backend + database skills |

#### Mobile Apps (iOS/Android)

| Document | Name | Adaptation |
|----------|------|------------|
| build_instructions | `build_instructions.md` (or split per platform) | Include both platform specs |
| content | `content.md` | Add: localization strings, store descriptions |
| assets | `asset_manifest.md` | Add: app icons at all sizes, store screenshots |
| skills | `skills_matrix.md` | Add: Xcode/Gradle, Fastlane, emulator tools |

#### CLI Tools / Libraries

| Document | Name | Adaptation |
|----------|------|------------|
| build_instructions | `architecture.md` | Module structure, public API surface, extension points |
| content | `api_reference.md` | Function signatures, options, examples |
| assets | Usually unnecessary | Replace with `test_fixtures.md` if applicable |
| *additional* | `changelog_convention.md` | Versioning rules, release process |

#### Data Pipelines

| Document | Name | Adaptation |
|----------|------|------------|
| build_instructions | `pipeline_architecture.md` | DAG structure, data flow, transformation logic |
| content | `schema_registry.md` | Input/output schemas, validation rules |
| assets | `data_source_manifest.md` | Connections, credentials locations, SLAs, rate limits |
| context_brief | Emphasize: data dictionary, business rules, compliance |

---

## 6. Quick-Start Checklist

Bootstrap this framework for a new project in ~30 minutes:

### Step 1: Gather Sources (5 min)
```bash
mkdir -p my-project/sources
# Copy all specs, designs, docs, requirements into sources/
```

### Step 2: Create CLAUDE.md v1 (10 min)
Copy `templates/CLAUDE_md_template.md` to your project root. Fill in:
- [ ] Project overview (2-3 sentences)
- [ ] Tech stack (bullet list)
- [ ] Project structure (ASCII tree)
- [ ] Development commands
- [ ] Basic conventions

### Step 3: Create .claude/settings.local.json (5 min)
```bash
mkdir -p my-project/.claude
```
Copy the relevant template from `templates/settings_local_json_templates.md`. Adjust commands for your stack.

### Step 4: Dispatch Phase A Agent (5 min)
Deploy one agent to generate `context_brief.md` from all source materials:
```
Prompt: "Read all files in sources/. Synthesize into context_brief.md
following the template in [this guide, section 3.7]. Flag all
inconsistencies across documents."
```

### Step 5: Dispatch Phase B Agents in Parallel (5 min)
Deploy 2-3 agents simultaneously:
- Agent 1: `build_instructions.md` from context_brief + tech stack
- Agent 2: `copy_deck.md` from context_brief (if user-facing)
- Agent 3: `asset_manifest.md` from source directory inventory

### Step 6: Dispatch Phase C Agents in Parallel
Deploy 2-3 agents simultaneously:
- Agent 1: `tasks.md` derived from build_instructions
- Agent 2: `sprint_plan.md` from tasks + asset_manifest
- Agent 3: `skills_matrix.md` from tasks + available tools

### Step 7: Finalize
- Update CLAUDE.md v2 with cross-references
- Initialize empty trace.md
- Begin execution following sprint_plan

---

## 7. Real-World Metrics (from SEPA)

### Resource Consumption

| Agent | Deliverable | Tokens | Tool Calls | Quality |
|-------|-------------|--------|------------|---------|
| T1: Planning | sprint_plan.md | 57K | 18 | High |
| T2: Skills | skills_matrix.md | 48K | 25 | High |
| T3: Context | context_brief.md | 89K | 31 | Excellent |
| T4: Design | CSS/JS scaffold | 43K | 14 | Excellent |
| T5: Content | copy_deck.md | 54K | 16 | High |
| T6: Assets | asset_manifest.md | 50K | 31 | High |
| T4b: Extraction | styles.css + main.js | 53K | 16 | High |
| T7: Build Top | HTML sections 1-5 | 81K | 35 | High |
| T7b: Build Bottom | HTML sections 6-10 | 68K | 22 | High |
| **Total** | **9 deliverables** | **~545K** | **208** | — |

### Key Findings

- **Context compilation (T3) was the most expensive** at 89K tokens but also rated "Excellent" — it read 8+ source documents and found 6 inconsistencies
- **Build agents consumed the most tool calls** (35 + 22 = 57 for HTML) because they read multiple reference docs + wrote code
- **The platform pivot** (Squarespace → Netlify) was absorbed without restarting — trace.md documented the change and CSS output was directly reusable
- **Total documentation size:** ~210 KB across 7 planning docs, supporting ~80 KB of production code

### Cost-Benefit

The 7 planning documents (~210 KB) took roughly 340K tokens to generate. The 3 build agents then consumed only 200K tokens to produce the entire site — because they had unambiguous specs, exact content, and pre-resolved conflicts. Without the planning docs, build agents would spend far more tokens exploring, asking questions, and making inconsistent decisions.

---

## 8. Anti-Patterns to Avoid

1. **Monolithic CLAUDE.md** — Don't put everything in one file. A 50 KB CLAUDE.md wastes context window on every agent. Split into specialized documents.

2. **Mutable reference docs** — Only tasks.md should be updated by multiple agents. If build_instructions needs changes, the PM agent should update it at a sync point, not build agents mid-flight.

3. **Missing workaround matrix** — If sprint_plan.md doesn't pre-document workarounds for blockers, builds will stall and agents will improvise inconsistently.

4. **Overlapping file assignments** — Two build agents writing to the same file = merge conflicts. Split by component, layer, or section.

5. **Skipping context_brief.md** — "We'll just read the source docs directly." This fails because agents each resolve inconsistencies differently. One centralized resolution prevents divergence.

6. **No trace.md** — Cross-team notes disappear between sessions. An agent discovers that "images need `object-fit: contain`" but the build agent in the next session doesn't know.

7. **Generating tasks.md before build_instructions.md** — Tasks without specs produce vague items like "Build the frontend" instead of atomic actions like "Add nav section with sticky positioning, logo left, 5 links center, CTA button right."
