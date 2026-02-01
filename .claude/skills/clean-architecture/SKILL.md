---
name: clean-architecture
description: Clean architecture principles for separating concerns. Use when designing new modules, creating interfaces, defining system boundaries, refactoring mixed concerns, or reviewing code for architecture violations. Applies to all languages.
user-invocable: false
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Clean Architecture

When working on architecture decisions, module design, or separation of concerns, read and follow the policy guide:

**Policy**: `docs/policies/clean-architecture.md`

## When This Applies

- Designing new modules, services, or bounded contexts
- Creating interface contracts between layers
- Choosing between repository, service, gateway, or strategy patterns
- Organizing code into module-based folder structures
- Reviewing code for architecture layer violations
- Deciding where to place new functionality

## Key Rules (from CLAUDE.md)

Dependencies point inward. Inner layers MUST NOT depend on outer layers:

```
Business Logic (inner)  -- Pure functions, domain logic, validation
  depends on
Interface (boundary)    -- Contracts between layers (I{Name} interfaces)
  implemented by
System Implementation (outer) -- External I/O (*.system.ts files)
```

## Quick Reference

- **One interface per system boundary** (HTTP client, database, file system)
- **Module folders** when 5+ related files share a prefix
- **Barrel exports** via `index.ts` for public API
- **Name by business capability**, not implementation tool (e.g., `ISecretStore` not `IOnePasswordClient`)

Read the full guide for patterns, examples, and folder organization.
