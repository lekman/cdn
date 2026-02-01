---
name: clean-architecture-typescript
description: TypeScript clean architecture implementation with *.system.ts convention, interface-based DI, namespace API pattern, and coverage configuration. Use when creating or refactoring TypeScript modules with external dependencies, writing system wrappers, defining interfaces for Azure SDK or Cloudflare API, or configuring coverage exclusions.
user-invocable: false
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Clean Architecture in TypeScript

When implementing clean architecture patterns in TypeScript, read and follow the policy guide:

**Policy**: `docs/policies/clean-architecture-typescript.md`

## When This Applies

- Creating `*.system.ts` files wrapping Azure SDK, Cloudflare API, or other external calls
- Defining `{name}-interface.ts` contracts with `I{Name}` interfaces
- Refactoring mixed business logic and system interaction code
- Setting up dependency injection via function/constructor parameters
- Using the namespace API pattern (classes with static methods)
- Configuring `bunfig.toml` coverage exclusions for `**/*.system.ts`
- Creating module folder structures with `index.ts` barrel exports

## File Naming Convention

| File Type | Pattern | Example |
|-----------|---------|---------|
| Interface | `{domain}-interface.ts` | `blob-interface.ts` |
| System wrapper | `{domain}.system.ts` | `blob.system.ts` |
| Mock | `tests/mocks/{domain}-mock.ts` | `blob-mock.ts` |
| Business logic | `{domain}.ts` or descriptive name | `handler.ts` |

## Key Patterns

- System files: thin wrappers, no business logic, excluded from coverage
- Interfaces: `I` prefix, minimal surface area, platform-agnostic
- DI: accept deps object with interface types, provide defaults via `?.?? ??`
- Namespace API: `Secrets.parse()` instead of `parseSecretReference()`

Read the full guide for step-by-step refactoring process and examples.
