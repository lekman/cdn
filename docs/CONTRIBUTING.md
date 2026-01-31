# Contributing to @lekman/cdn

## Getting Started

1. Fork and clone the repository:

    ```bash
    git clone https://github.com/<your-username>/cdn.git
    cd cdn
    ```

2. Install dependencies:

    ```bash
    brew install oven-sh/bun/bun go-task semgrep
    task install
    ```

3. Verify setup:

    ```bash
    task quality
    ```

## Repository Structure

```
.
├── src/
│   ├── functions/            # Azure Functions (TypeScript)
│   │   ├── metadata-extraction/  # Service Bus trigger: extract image metadata
│   │   └── delete/               # HTTP trigger: delete blob + Cosmos + purge
│   └── shared/               # Shared utilities and types
│       ├── types.ts          # Domain types
│       ├── cosmos.ts         # Cosmos DB client helpers
│       ├── blob.ts           # Blob Storage client helpers
│       └── cloudflare.ts     # Cloudflare purge API client
├── infra/                    # Infrastructure as Code (Bicep)
│   ├── main.bicep            # Main deployment template
│   └── modules/              # Per-resource Bicep modules
├── policies/                 # APIM policy XML files
│   ├── post-images.xml       # Upload policy
│   ├── get-image.xml         # Metadata retrieval policy
│   └── delete-image.xml      # Delete routing policy
├── tests/
│   ├── unit/                 # Unit tests (mock external dependencies)
│   └── mocks/                # Shared mock implementations
├── docs/
│   ├── requirements/         # PRD and epic documents
│   ├── ARCHITECTURE.md       # System design and diagrams
│   ├── QA.md                 # Test strategy and coverage
│   ├── SECURITY.md           # Security policy and threat model
│   └── CHANGELOG.md          # Auto-generated release history
├── .github/
│   ├── workflows/            # CI/CD pipeline definitions
│   └── dependabot.yml        # Automated dependency updates
├── biome.json                # Linting and formatting config
├── tsconfig.json             # TypeScript config
├── bunfig.toml               # Bun runtime and test config
├── Taskfile.yml              # Task runner definitions
└── package.json              # Package metadata and scripts
```

## Task Runner

All development commands use [Task](https://taskfile.dev/) with Bun as the runtime.

| Command | Alias | Description |
| ------- | ----- | ----------- |
| `task install` | `i` | Install all tools and dependencies |
| `task lint` | `l` | Run Biome linting |
| `task format` | `fmt` | Format code with Biome |
| `task typecheck` | `tc` | TypeScript type checking |
| `task test` | `t` | Run unit tests with Bun |
| `task test:coverage` | `cov` | Tests with coverage report |
| `task quality` | `q` | Run lint + typecheck + security + test |

Additional commands are available via `@northbridge-security/ai-toolkit`:

| Namespace | Description |
| --------- | ----------- |
| `task git:<command>` | Git operations |
| `task json:<command>` | JSON validation |
| `task yaml:<command>` | YAML validation |
| `task markdown:<command>` | Markdown validation |
| `task security:<command>` | Security tools (Semgrep) |

## Development Workflow

This project uses Test-Driven Development (TDD). Follow the Red-Green-Refactor cycle:

1. **Red** — Write a failing test that describes the expected behaviour
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Improve the code while keeping tests green

Run the quality gate before committing:

```bash
task quality    # Runs lint + typecheck + security + test
```

Pre-commit hooks run `lint` and `typecheck` automatically via Husky. If either check fails, the commit is rejected.

## Pull Request Process

1. Create a feature branch from `main`:

    ```bash
    git checkout -b feat/your-feature
    ```

2. Make your changes following the [code style](#code-style) and [testing requirements](#testing-requirements).

3. Run the quality gate:

    ```bash
    task quality
    ```

4. Push and open a PR against `main`.

5. Fill in the PR template: summary, changes, test plan, related issues.

6. All CI checks must pass before merge:

    | Check | Purpose |
    | ----- | ------- |
    | lint | Biome linting |
    | typecheck | TypeScript type checking |
    | test | Unit tests with coverage |
    | security | Semgrep scan |

7. PRs are reviewed by CodeRabbit (automated) and a maintainer.

## Code Style

[Biome](https://biomejs.dev/) handles formatting and linting. Configuration is in `biome.json`.

- Double quotes, semicolons, ES5 trailing commas
- 100 character line width, 2-space indentation
- Imports organized automatically
- No `console.log` in production code (enforced by Semgrep)

Format and lint:

```bash
task format     # Auto-format
task lint       # Check linting
```

## Testing Requirements

- Business logic requires 80%+ line coverage
- System files (`*.system.ts`) are excluded from coverage
- All tests use mocks for Azure SDK clients and Cloudflare API
- No network calls in unit tests

Run tests:

```bash
task test              # Run unit tests
task test:coverage     # Tests with coverage report
bun test tests/unit/functions/delete/handler.test.ts   # Single file
```

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning via release-please.

Format: `<type>(<scope>): <description>`

| Type | Purpose | Changelog |
| ---- | ------- | --------- |
| `feat` | New feature | Visible |
| `fix` | Bug fix | Visible |
| `perf` | Performance improvement | Visible |
| `docs` | Documentation change | Visible |
| `refactor` | Code change that neither fixes a bug nor adds a feature | Hidden |
| `test` | Adding or updating tests | Hidden |
| `chore` | Maintenance (dependencies, CI config) | Hidden |
| `ci` | CI/CD pipeline changes | Hidden |

Examples:

```
feat(delete): add Cloudflare cache purge on image deletion
fix(metadata): handle EXIF extraction failure for PNG files
docs: add architecture diagrams to ARCHITECTURE.md
```

## CI Pipeline

GitHub Actions workflows run on PRs to `main`:

| Workflow | File | Trigger | Purpose |
| -------- | ---- | ------- | ------- |
| CI | `ci.yml` | PR to `main`, push to `main` | Lint, typecheck, test, security scan |
| Release | `release.yml` | Push to `main` | Create release PR via release-please |
| Auto-release | `auto-release.yml` | Release workflow completes | Auto-merge release PRs |
| Claude | `claude.yml` | `@claude` mention | Interactive Claude Code agent |
| Code Review | `claude-code-review.yml` | PR open/sync | Automated code review |

The CI workflow runs these jobs in parallel:

| Job | Command | Purpose |
| --- | ------- | ------- |
| lint | `biome check src/ tests/` | Code style and lint rules |
| typecheck | `tsc --noEmit` | TypeScript type checking |
| test | `bun test tests/unit/ --coverage` | Unit tests with coverage |
| security | Semgrep scan | `p/security-audit`, `p/secrets`, `p/typescript` |
| quality-gate | (depends on all above) | All checks must pass for merge |

Every PR must pass all CI jobs before merging. Locally, run `task quality` to check all gates before pushing.

## Release Process

Releases are automated using [release-please](https://github.com/googleapis/release-please):

1. Merge PRs with conventional commit messages to `main`.
2. Release-please creates a release PR that bumps the version and updates `docs/CHANGELOG.md`.
3. The auto-release workflow merges the release PR after CI passes.
4. A GitHub Release is created.

## Code Review Tools

| Tool | Trigger | Configuration |
| ---- | ------- | ------------- |
| CodeRabbit | Automatic on PR | `.coderabbit.yml` — Biome, Semgrep, Gitleaks, Markdownlint |
| Claude Code Review | Automatic on PR | `claude-code-review.yml` — skips `release-please--*` branches |
| Claude Code Agent | `@claude` mention | `claude.yml` — interactive issue/PR agent |
| Semgrep | CI pipeline | `.semgrep.yml` — custom rules + cloud rulesets |

## Dependency Updates

[Dependabot](https://docs.github.com/en/code-security/dependabot) is configured in `.github/dependabot.yml`:

| Ecosystem | Schedule | Max PRs | Grouping |
| --------- | -------- | ------- | -------- |
| npm | Weekly | 10 | Dev dependencies grouped by minor/patch |
| GitHub Actions | Weekly | 5 | None |

## Issue Reporting

### Bug Reports

Open a [GitHub issue](https://github.com/lekman/cdn/issues) with:

- Steps to reproduce
- Expected behaviour
- Actual behaviour
- Request/response details (if relevant)

### Feature Requests

Open a [GitHub issue](https://github.com/lekman/cdn/issues) describing the use case and proposed solution.

## Security Issues

Do not report security vulnerabilities through public GitHub issues. See [SECURITY.md](SECURITY.md) for the reporting process.
