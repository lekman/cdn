---
name: typescript-patterns
description: TypeScript design patterns including bounded contexts, class-based exports, barrel exports, atomic tests, and business capability naming. Use when organizing code into domains, designing public APIs, creating barrel exports, structuring test files, or choosing between function and class-based exports.
user-invocable: false
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# TypeScript Design Patterns

When applying TypeScript design patterns, read and follow the policy guide:

**Policy**: `docs/policies/typescript-patterns.md`

## When This Applies

- Organizing source code into bounded contexts or domain folders
- Designing public API surfaces with barrel exports (`index.ts`)
- Choosing between function exports and class-based namespace exports
- Naming APIs by business capability (not vendor/tool names)
- Implementing the Adapter Pattern for swappable providers
- Separating system interactions into `*.system.ts` files
- Writing atomic tests that work in parallel execution
- Structuring test folders to mirror source folders

## Principles Checklist

1. **Bounded context folders**: `src/domains/` by business domain, not technical layer
2. **Business capability naming**: `ISecretStore` not `IOnePasswordClient`
3. **Class-based exports**: group related operations under namespace classes
4. **Barrel exports**: `index.ts` defines public API, hides internals
5. **System separation**: `*.system.ts` for external I/O, excluded from coverage
6. **TDD**: RED -> GREEN -> REFACTOR with architecture-first skeleton
7. **Unit tests without mocks**: real in-memory implementations, mocks only for integration
8. **Atomic tests**: new mock instance per `test()` block, no shared state

Read the full guide for patterns, examples, and anti-patterns.
