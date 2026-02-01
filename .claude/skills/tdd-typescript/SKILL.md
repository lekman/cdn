---
name: tdd-typescript
description: Test-driven development with Bun test framework. Use when writing new tests, creating test files, setting up mocks, writing assertions, configuring test coverage, or following the RED-GREEN-REFACTOR cycle in TypeScript.
user-invocable: false
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Test-Driven Development in TypeScript

When writing tests or following TDD workflow, read and follow the policy guide:

**Policy**: `docs/policies/tdd-typescript.md`

## When This Applies

- Writing new test files for `src/` modules
- Following the RED -> GREEN -> REFACTOR cycle
- Creating mock implementations in `tests/mocks/`
- Writing assertions with `bun:test` (`expect`, `describe`, `test`)
- Setting up test factories or shared test utilities
- Configuring coverage thresholds in `bunfig.toml`
- Testing async functions, file system operations, or platform-specific code
- Debugging flaky or failing tests

## Project-Specific Rules (from CLAUDE.md)

- Test files mirror source path: `src/functions/delete/handler.ts` -> `tests/unit/functions/delete/handler.test.ts`
- Use `test()` (not `it()`) for individual test cases
- Import from `bun:test`: `describe`, `expect`, `test`, `beforeEach`, `mock`
- Tests MUST NOT make network calls
- Coverage thresholds: 80% line, 80% statement, 60% function

## Key Patterns

- Arrange / Act / Assert structure
- `realpathSync` for macOS temp directory symlink resolution
- `.skipIf()` for platform-specific tests
- `describe.serial` for tests using `process.chdir()`
- Mock restore in `afterEach` to prevent leaks

Read the full guide for assertion reference, mocking patterns, and examples.
