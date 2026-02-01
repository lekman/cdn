# Clean Architecture for AI Agents

This guide establishes clean architecture principles for AI agents refactoring codebases. These patterns apply across all languages and frameworks, ensuring testable, maintainable, and scalable code.

## Target Audience

AI agents (Claude Code, Cursor, GitHub Copilot, etc.) working with any codebase that needs improved testability, separation of concerns, and better test coverage.

## Core Principles

### Separation of Concerns

**The Dependency Rule**: Source code dependencies must point inward toward higher-level policies. Inner layers should not depend on outer layers.

```text
┌─────────────────────────────────────────────┐
│  Frameworks & Drivers (UI, DB, Web, CLI)    │ ← Outer layer
├─────────────────────────────────────────────┤
│  Interface Adapters (Controllers, Gateways) │
├─────────────────────────────────────────────┤
│  Application Business Rules (Use Cases)     │
├─────────────────────────────────────────────┤
│  Enterprise Business Rules (Entities)       │ ← Inner layer
└─────────────────────────────────────────────┘
```

**For system interaction refactoring**, we focus on the boundary between:

- **Business Logic** (inner) - Pure functions, domain logic, validation
- **Infrastructure** (outer) - System calls, I/O, external services

### Interface-Based Boundaries

Use interfaces (or protocols, traits, abstract classes) to define contracts between layers:

**Benefits:**

- Business logic depends on abstractions, not implementations
- Multiple implementations (production, test, mock)
- Easy to swap infrastructure without changing business logic
- Clear contracts documented in code

### Dependency Injection

Pass dependencies through constructors or function parameters, not global singletons or imports:

**Good:**

```typescript
class UserService {
  constructor(private api: IUserAPI) {}
  async getUser(id: string) {
    return this.api.fetch(id);
  }
}
```

**Bad:**

```typescript
import { realAPI } from "./real-api";
class UserService {
  async getUser(id: string) {
    return realAPI.fetch(id);
  } // Hardcoded dependency
}
```

### Testability First

Design for testability from the start:

**Unit Tests** - Test business logic in isolation with mocks

- Fast (< 1ms per test)
- Deterministic (no flakiness)
- No external dependencies

**Integration Tests** - Test real system interactions

- Slower (seconds per test)
- May require setup/teardown
- Test against real systems

## Common Patterns

### Pattern 1: Repository Pattern

Separate data access from business logic:

```text
IRepository (interface)
    ↑
    ├─ DatabaseRepository (production)
    ├─ InMemoryRepository (testing)
    └─ MockRepository (unit tests)
```

**Use when:**

- Accessing databases
- Reading/writing files
- Caching systems

### Pattern 2: Service Pattern

Encapsulate external service calls:

```text
INotificationService (interface)
    ↑
    ├─ EmailService (production)
    ├─ SMSService (production)
    └─ MockNotificationService (testing)
```

**Use when:**

- Calling external APIs
- Sending notifications
- Third-party integrations

### Pattern 3: Gateway Pattern

Abstract system operations:

```text
ISystemGateway (interface)
    ↑
    ├─ ShellGateway (production - executes commands)
    └─ MockGateway (testing - returns canned responses)
```

**Use when:**

- Executing shell commands
- File system operations
- Network calls

### Pattern 4: Strategy Pattern

Interchangeable algorithms or behaviors:

```text
IAuthStrategy (interface)
    ↑
    ├─ OAuth2Strategy
    ├─ JWTStrategy
    └─ MockAuthStrategy
```

**Use when:**

- Multiple implementations of same behavior
- Algorithm selection at runtime
- Platform-specific implementations

## Folder Organization

### Module-Based Structure (Recommended)

Organize by feature/module rather than by architectural layer:

```text
src/
├── auth/
│   ├── index.ts              # Public API exports
│   ├── auth-interface.ts     # IAuthService interface
│   ├── auth.system.ts        # System implementation (LDAP, OAuth)
│   ├── session.ts            # Business logic
│   └── tokens.ts             # Business logic
├── users/
│   ├── index.ts
│   ├── user-repository-interface.ts
│   ├── user-repository.system.ts
│   └── user-service.ts
└── payments/
    ├── index.ts
    ├── payment-gateway-interface.ts
    ├── payment-gateway.system.ts
    └── payment-processor.ts

tests/mocks/
├── auth/
│   └── auth-mock.ts
├── users/
│   └── user-repository-mock.ts
└── payments/
    └── payment-gateway-mock.ts
```

**Benefits:**

- Related code co-located (easy to find)
- Clear module boundaries
- Import from module: `import { authenticate } from '@/auth'`
- Easy to test (all module code in one place)
- Scales well (add modules without restructuring)
- Easier to extract to microservices if needed

### Layer-Based Structure (Academic)

Traditional Clean Architecture organizes by layer:

```text
src/
├── entities/           # Enterprise business rules
├── use-cases/          # Application business rules
├── adapters/           # Interface adapters
└── frameworks/         # External frameworks

# NOT RECOMMENDED for most projects
```

**Problems:**

- Code for one feature scattered across directories
- Hard to find related files
- Doesn't scale (hundreds of files in one directory)
- Violates co-location principle

### Hybrid Approach

For large codebases, combine both:

```text
src/
├── modules/
│   ├── auth/           # Feature module
│   ├── users/          # Feature module
│   └── payments/       # Feature module
└── shared/
    ├── interfaces/     # Shared contracts
    └── utils/          # Shared utilities
```

## Language-Specific Guides

For implementation details in specific languages, see:

- [Clean Architecture in TypeScript](./agents.clean.arch.ts.md)
- Python (Coming soon)
- Ruby (Coming soon)
- Go (Coming soon)
