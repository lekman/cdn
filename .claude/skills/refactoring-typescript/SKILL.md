---
name: refactoring-typescript
description: Step-by-step refactoring from mixed concerns to clean boundaries in TypeScript. Use when separating business logic from system calls, extracting interfaces from existing code, creating system wrappers, migrating to dependency injection, or following the refactoring migration checklist.
user-invocable: false
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Refactoring TypeScript: Separating Business Logic from System Interactions

When refactoring code to separate concerns, read and follow the policy guide:

**Policy**: `docs/policies/refactoring-typescript.md`

## When This Applies

- Refactoring files that mix business logic with system calls (file I/O, HTTP, shell, DB)
- Extracting interfaces from tightly coupled code
- Creating `*.system.ts` wrappers for existing external dependencies
- Adding dependency injection to functions or classes that instantiate SDK clients
- Writing mock implementations for newly extracted interfaces
- Migrating from `mock.module()` to interface-based DI
- Improving test coverage by making business logic testable

## Refactoring Steps (Summary)

1. **Identify system boundaries** -- find mixed business logic + system calls
2. **Define interface** -- `{domain}-interface.ts` with `I{Name}` contract
3. **Create system implementation** -- `{domain}.system.ts`, thin wrapper only
4. **Create mock implementation** -- `tests/mocks/{domain}-mock.ts`
5. **Refactor business logic** -- accept interface param with default value
6. **Write tests** -- use mock for fast, deterministic tests
7. **Configure coverage** -- add `**/*.system.ts` to exclusion

## Anti-Patterns to Flag

- Business logic inside `*.system.ts` files
- Overly broad interfaces combining multiple responsibilities
- Direct dependency on concrete class instead of interface
- Missing interface for external dependency

Read the full guide for code examples, common patterns (file system, shell, HTTP), and migration checklist.
