# CLAUDE.md Template

> Copy this file to your project root as `CLAUDE.md` and fill in the bracketed sections.

---

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

[PROJECT_NAME] is a [TYPE: static site / web app / mobile app / CLI tool / data pipeline] that [WHAT_IT_DOES — 1 sentence]. [WHO_ITS_FOR — 1 sentence]. [WHY_IT_EXISTS — 1 sentence if not obvious].

## Tech Stack & Architecture

- **[Language/Runtime]** — [purpose]
- **[Framework]** — [purpose]
- **[Database]** — [purpose, if applicable]
- **[Deployment]** — [platform]
- **[Build]** — [build system, or "No build step — static files served directly"]

### Project Structure

```
[PROJECT_ROOT]/
├── [dir/]          ← [annotation]
│   ├── [file]      ← [annotation]
│   └── [file]      ← [annotation]
├── [dir/]          ← [annotation]
└── [config]        ← [annotation]
```

[NOTE: Call out any non-obvious structural decisions, e.g., "Git repo lives in site/, not project root"]

## Commands

### Development
```bash
[exact command to run locally]
```

### Testing
```bash
[exact test command]
[command to run a single test, if applicable]
```

### Deployment
```bash
[exact deploy command]
```

[PLATFORM_DETAILS: repo URL, site ID, dashboard URL, etc.]

### QA Breakpoints (if frontend)
- Mobile: [width]px
- Tablet: [width]px
- Desktop: [width]px

## Key Reference Files

| File | Purpose | How to Read |
|------|---------|-------------|
| `[build_instructions.md]` | [HOW to build — specs + phased steps] | Direct read |
| `[tasks.md]` | [Task tracker — N groups, M subtasks] | Direct read |
| `[sprint_plan.md]` | [Sprint roadmap with blockers/workarounds] | Direct read |
| `[copy_deck.md]` | [All content, paste-ready] | Direct read |
| `[asset_manifest.md]` | [Resource inventory] | Direct read |
| `[context_brief.md]` | [Business context, domain knowledge] | Direct read |

## Domain Knowledge (Quick Reference)

[3-10 essential domain facts that every agent needs to know. These should be
things that are NOT obvious from reading the code — business rules, industry
terminology, key metrics, regulatory requirements, etc.]

| Metric | Value |
|--------|-------|
| [key metric] | [value] |

## Design System (if frontend)

The full design system is defined in `[build_instructions.md]` and implemented as
[CSS custom properties / theme config / design tokens] in `[tokens file path]`.

- **Colors:** [N] tokens — [list primary ones with hex]. Never hardcode; use `[var syntax]`.
- **Typography:** [heading font] for headings, [body font] for body. Never hardcode font families.
- **Spacing:** [base]px grid ([list scales]). Use `[var syntax]` tokens.
- **Animations:** [summary of animation patterns and their constraints].
- **Components:** [summary of key reusable component patterns].

## Conventions

- Always read `tasks.md` to check current progress before starting work
- Update task statuses in `tasks.md` as work is completed
- Follow build order from `[build_instructions.md]`
- [Convention about code style: e.g., "All CSS must use custom properties — never hardcode"]
- [Convention about accessibility: e.g., "All animations must respect prefers-reduced-motion"]
- [Convention about file operations: e.g., "Images served from site/images/"]
- [Convention about git/deploy: e.g., "Git operations happen in site/ directory"]
- **Known blockers:** [list any soft blockers and their workarounds]
```
