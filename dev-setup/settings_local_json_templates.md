# .claude/settings.local.json Templates

> Copy the relevant template to `.claude/settings.local.json` in your project root.
> Adjust commands for your specific tools and paths.

---

## Static Site / Landing Page

```json
{
  "permissions": {
    "allow": [
      "Bash(open:*)",
      "Bash(cp:*)",
      "Bash(python3:*)",
      "Bash(netlify:*)",
      "Bash(git init:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git remote:*)",
      "Bash(git branch:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(gh repo:*)",
      "Bash(gh auth:*)",
      "Bash(curl -s:*)",
      "WebSearch",
      "WebFetch(domain:fonts.google.com)",
      "WebFetch(domain:developer.mozilla.org)"
    ]
  }
}
```

## Full-Stack Web App (Node.js / Next.js)

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(next:*)",
      "Bash(prisma:*)",
      "Bash(docker compose:*)",
      "Bash(git init:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git remote:*)",
      "Bash(git branch:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(gh:*)",
      "Bash(vercel:*)",
      "Bash(curl -s:*)",
      "Bash(open:*)",
      "Bash(cp:*)",
      "WebSearch",
      "WebFetch(domain:nextjs.org)",
      "WebFetch(domain:developer.mozilla.org)",
      "WebFetch(domain:react.dev)"
    ]
  }
}
```

## Full-Stack Web App (Python / Django / FastAPI)

```json
{
  "permissions": {
    "allow": [
      "Bash(pip install:*)",
      "Bash(pip3 install:*)",
      "Bash(python3:*)",
      "Bash(python:*)",
      "Bash(pytest:*)",
      "Bash(uvicorn:*)",
      "Bash(alembic:*)",
      "Bash(docker compose:*)",
      "Bash(git init:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git remote:*)",
      "Bash(git branch:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(gh:*)",
      "Bash(curl -s:*)",
      "Bash(open:*)",
      "Bash(cp:*)",
      "WebSearch",
      "WebFetch(domain:docs.python.org)",
      "WebFetch(domain:fastapi.tiangolo.com)",
      "WebFetch(domain:docs.djangoproject.com)"
    ]
  }
}
```

## Mobile App (React Native / Expo)

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run:*)",
      "Bash(npx:*)",
      "Bash(expo:*)",
      "Bash(eas:*)",
      "Bash(pod install:*)",
      "Bash(xcodebuild:*)",
      "Bash(adb:*)",
      "Bash(git init:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git remote:*)",
      "Bash(git branch:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(gh:*)",
      "Bash(open:*)",
      "Bash(cp:*)",
      "WebSearch",
      "WebFetch(domain:reactnative.dev)",
      "WebFetch(domain:docs.expo.dev)"
    ]
  }
}
```

## CLI Tool / Library (Node.js)

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(npm publish:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(git init:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git remote:*)",
      "Bash(git branch:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git tag:*)",
      "Bash(gh:*)",
      "Bash(cp:*)",
      "WebSearch",
      "WebFetch(domain:nodejs.org)",
      "WebFetch(domain:npmjs.com)"
    ]
  }
}
```

## CLI Tool / Library (Rust)

```json
{
  "permissions": {
    "allow": [
      "Bash(cargo:*)",
      "Bash(rustc:*)",
      "Bash(rustup:*)",
      "Bash(git init:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git remote:*)",
      "Bash(git branch:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git tag:*)",
      "Bash(gh:*)",
      "Bash(cp:*)",
      "WebSearch",
      "WebFetch(domain:doc.rust-lang.org)",
      "WebFetch(domain:docs.rs)"
    ]
  }
}
```

## Data Pipeline (Python / Airflow)

```json
{
  "permissions": {
    "allow": [
      "Bash(pip install:*)",
      "Bash(pip3 install:*)",
      "Bash(python3:*)",
      "Bash(python:*)",
      "Bash(pytest:*)",
      "Bash(airflow:*)",
      "Bash(dbt:*)",
      "Bash(docker compose:*)",
      "Bash(psql:*)",
      "Bash(git init:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git remote:*)",
      "Bash(git branch:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(gh:*)",
      "Bash(aws:*)",
      "Bash(cp:*)",
      "WebSearch",
      "WebFetch(domain:airflow.apache.org)",
      "WebFetch(domain:docs.getdbt.com)"
    ]
  }
}
```

---

## Notes

- **Principle:** Pre-allow everything your agents will need so they don't get blocked by permission prompts mid-execution. Permission interruptions break agent flow and waste tokens.
- **Security:** Only allow what's actually needed. Don't use `Bash(*)` wildcard — be specific about which tools.
- **WebFetch domains:** Add documentation sites relevant to your stack. Agents use these for API reference lookups.
- **Git safety:** The templates above allow common git operations but NOT destructive ones (`git reset --hard`, `git push --force`). Add those only if explicitly needed.
