# TypeScript Design Patterns for AI Agents

This guide establishes TypeScript design patterns for AI agents working with codebases. These patterns ensure maintainable, testable, and scalable TypeScript code following clean architecture principles.

## Target Audience

AI agents (Claude Code, Cursor, GitHub Copilot, etc.) writing production TypeScript code that requires clear structure, type safety, and long-term maintainability.

## Principles Checklist

Quick reference of TypeScript design principles covered in this guide:

1. [Bounded Context-Based Folder Structure](#bounded-context-based-folder-structure): Organize src/domains/ by business domain (bounded contexts), not by technical layers
2. [Expose Business Capabilities, Not Dependencies](#expose-business-capabilities-not-dependencies): Name APIs by business capability, not implementation tool; use Adapter Pattern to enable swapping vendors/tools without breaking consumers
3. [Prefer Class-Based Structures](#prefer-class-based-structures): Organize exports by function domain using classes with grouped operations for ease of understanding by consumers
4. [Prefer Barrel Exports](#prefer-barrel-exports): Use index.ts to create consumer-focused public APIs and hide implementation details (including adapters)
5. [Separate System Interactions](#separate-system-interactions): Isolate external system calls in `systems.ts` files excluded from code coverage; adapters use these for vendor-specific operations
6. [Test-Driven Development (TDD)](#test-driven-development-tdd): Write tests first using RED → GREEN → REFACTOR; design skeleton code with architecture-first approach
7. [Unit Tests Without Mocks](#unit-tests-without-mocks): Unit tests use real implementations (no mocks); mocks are for integration tests only; test structure shadows source folders
8. [Atomic Tests](#atomic-tests): Create isolated test instances in each `it()` or `test()` call, avoid module-level mocks and shared state to enable parallel and random-order execution

## Core Principles

### Expose Business Capabilities, Not Dependencies

**Problem**: Naming APIs after implementation tools (dependencies) creates vendor lock-in and requires consumer changes when swapping implementations.

```typescript
// ❌ BAD - API exposes implementation dependency (vendor lock-in)
import { OnePasswordSecretsManager } from "@src/security";

class OnePasswordSecretsManager {
  async resolveFromOnePassword(ref: string): Promise<string>;
  async authenticateToOnePassword(): Promise<void>;
  async queryOnePasswordVault(vault: string): Promise<OnePasswordItem[]>;
}

const secrets = new OnePasswordSecretsManager();
await secrets.resolveFromOnePassword("op://vault/item/field");

// Problem: Consumer code is coupled to 1Password
// Migrating to Bitwarden requires changing ALL consumer code
```

**Solution**: Name classes, methods, and types by business capability, not by implementation tool.

```typescript
// ✓ GOOD - API exposes business capability (vendor-neutral)
import { SecretsManager } from "@src/security";

class SecretsManager {
  async resolve(reference: string): Promise<string>;
  async authenticate(): Promise<void>;
  async list(category?: string): Promise<Secret[]>;
}

const secrets = SecretsManager.create();
await secrets.resolve("secret-reference");

// Consumer doesn't know or care about 1Password
// Bounded context can swap to Bitwarden without breaking consumers
```

**Why this approach is better:**

1. **No vendor lock-in**: Swap tools (1Password → Bitwarden → Vault) without consumer changes
2. **Domain language**: API speaks business terms ("resolve secret") not tool terms ("query 1Password CLI")
3. **Future-proof**: Add new implementations without breaking existing code
4. **Clear intent**: Consumers understand business purpose, not technical details
5. **Implementation hiding**: Bounded context internals can change freely

**Apply to ALL aspects of public API:**

**Class names:**

```typescript
// ❌ BAD - Named after tool
class OnePasswordManager
class BitwardenClient
class AwsSecretsManagerService

// ✓ GOOD - Named after capability
class SecretsManager
class SecretStore
class SecretResolver
```

**Method signatures:**

```typescript
// ❌ BAD - Methods expose tool
async resolveFromOnePassword(reference: string)
async fetchFromBitwarden(itemId: string)
async getFromVault(path: string)

// ✓ GOOD - Methods express capability
async resolve(reference: string)
async fetch(identifier: string)
async get(path: string)
```

**Return types:**

```typescript
// ❌ BAD - Types expose tool
interface OnePasswordItem {
  vault: string;
  item: string;
  field: string;
}

// ✓ GOOD - Types express domain concept
interface Secret {
  category: string;
  name: string;
  value: string;
}
```

**Complete example:**

```typescript
// Public API (src/security/index.ts) - Business capability-focused
export class SecretsManager {
  private constructor(private adapter: ISecretsProvider) {}

  static create(adapter?: ISecretsProvider): SecretsManager {
    // Default adapter can change without breaking consumers
    return new SecretsManager(adapter || new OnePasswordAdapter());
  }

  async resolve(reference: string): Promise<string> {
    return this.adapter.resolve(reference);
  }

  async authenticate(): Promise<void> {
    return this.adapter.authenticate();
  }

  async setup(services: ServiceConfig[]): Promise<void> {
    return this.adapter.setup(services);
  }
}

// Internal implementation (src/security/adapters/onepassword/) - Hidden
class OnePasswordAdapter implements ISecretsProvider {
  // 1Password-specific implementation
  // Consumers never see this class
}

// Future: Add Bitwarden without breaking changes
class BitwardenAdapter implements ISecretsProvider {
  // Bitwarden-specific implementation
}

// Consumer code never changes:
const secrets = SecretsManager.create();
await secrets.resolve("secret-ref");
```

**Design patterns used:**

This principle combines several architectural patterns:

1. **Adapter Pattern**: Wrap vendor-specific tools behind a common interface
   - **Purpose**: Convert vendor-specific API to your business interface
   - **Benefit**: Swap vendors without changing consumer code
   - **Example**: `OnePasswordAdapter`, `BitwardenAdapter`, `VaultAdapter` all implement `ISecretsProvider`

2. **Strategy Pattern**: Swap implementations at runtime via dependency injection
   - **Purpose**: Define a family of interchangeable algorithms/providers
   - **Benefit**: Choose provider at runtime or configuration time
   - **Example**: `SecretsManager.create(new BitwardenAdapter())` vs `SecretsManager.create(new OnePasswordAdapter())`

3. **Hexagonal Architecture (Ports & Adapters)**:
   - **Port**: `ISecretsProvider` interface (business capability - what you need)
   - **Adapters**: `OnePasswordAdapter`, `BitwardenAdapter`, `VaultAdapter` (tool implementations - how it's done)
   - **Benefit**: Domain core depends only on interfaces, not implementations

4. **Anti-Corruption Layer**: Protect domain from external system details
   - **Purpose**: Prevent vendor-specific concepts from leaking into your domain
   - **Example**: Vendor uses "vault/item/field", you expose "category/item/field"

**When to use this pattern:**

- External services (APIs, databases, message queues)
- Third-party libraries (payment processors, email providers)
- Infrastructure tools (secret managers, cloud providers)
- Any dependency that might change or be swapped

**When NOT needed:**

- Core language features (Array, Map, Set)
- Stable, universal standards (HTTP, JSON)
- Internal domain entities (User, Order, Invoice)

**How adapters enable vendor swapping:**

```typescript
// Phase 1: Using 1Password
const secrets = SecretsManager.create(new OnePasswordAdapter());
await secrets.resolve("op://Private/API/token");

// Phase 2: Migrate to Bitwarden (zero consumer code changes)
const secrets = SecretsManager.create(new BitwardenAdapter());
await secrets.resolve("bw://Private/API/token"); // Different reference format

// Phase 3: Hybrid approach (multiple providers)
class MultiProviderAdapter implements ISecretsProvider {
  constructor(
    private primary: ISecretsProvider,
    private fallback: ISecretsProvider
  ) {}

  async resolve(ref: string): Promise<string> {
    try {
      return await this.primary.resolve(ref);
    } catch {
      return await this.fallback.resolve(ref);
    }
  }
}

const secrets = SecretsManager.create(
  new MultiProviderAdapter(new OnePasswordAdapter(), new BitwardenAdapter())
);
```

**Connection to other principles:**

- **Bounded Context-Based Folder Structure** (#1): Organize by business domain in `src/domains/`, not by tools; adapters live in `domains/security/secrets/adapters/`
- **Class-Based Structures** (#3): How to group operations around business capabilities
- **Barrel Exports** (#4): Hide implementation adapters in subdirectories, only export business API from main index.ts
- **Separate System Interactions** (#5): Adapters use `systems.ts` files for vendor-specific CLI calls, keeping business logic clean

This principle is the foundation of a maintainable architecture. By naming APIs after business capabilities and using the Adapter Pattern, your bounded context becomes a stable interface that can evolve its implementation without breaking consumers.

### Prefer Class-Based Structures

**Problem**: Exporting 30-40 functions from a module creates cognitive overhead and unclear boundaries.

```typescript
// ❌ BAD - Function soup
export function validateContract(contract: Contract): ValidationResult {}
export function analyzeContractRisk(contract: Contract): RiskScore {}
export function checkContractCompliance(contract: Contract): boolean {}
export function generateContractSummary(contract: Contract): Summary {}
export function compareContracts(a: Contract, b: Contract): Diff {}
export function archiveContract(contract: Contract): void {}
// ... 30 more functions

// Consumer imports and uses:
import { validateContract, analyzeContractRisk, checkCompliance /* ... */ } from "./utils";
const result = validateContract(contract); // Unclear relationships
```

**Solution**: Organize related functionality into classes with grouped operations.

```typescript
// ✓ GOOD - Class with nested operation groups
export class ContractModeler {
  private constructor(private contract: Contract) {}

  static create(data: ContractData): ContractModeler {
    return new ContractModeler(parseContract(data));
  }

  readonly analysis = {
    risk: () => analyzeRisk(this.contract),
    compliance: () => checkCompliance(this.contract),
    value: () => calculateValue(this.contract),
  };

  readonly review = {
    validate: () => validateContract(this.contract),
    summary: () => generateSummary(this.contract),
  };

  readonly lifecycle = {
    archive: () => archiveContract(this.contract),
  };
}

// Consumer uses grouped operations:
import { ContractModeler } from "./contract-modeler";
const modeler = ContractModeler.create(contractData);
modeler.analysis.risk(); // Clear grouping
modeler.review.validate(); // Self-documenting
modeler.lifecycle.archive(); // Easy to discover
```

**Why this approach is better:**

1. **Clear context**: Consumer immediately understands `analysis`, `review`, and `lifecycle` are distinct areas of concern
2. **Discoverability**: IDE autocomplete shows grouped operations (`.analysis.` reveals all analysis functions)
3. **Single import**: One import statement instead of 40
4. **Encapsulation**: Private methods hidden from consumers, only public API exposed
5. **Testability**: Can mock entire groups (`modeler.analysis`) or individual operations
6. **Maintainability**: Adding new operations is clear (which group does it belong to?)
7. **Type safety**: TypeScript understands class structure better than loose functions
8. **Clean architecture**: Class boundaries align with business domains

**When to use class-based design:**

- Module exports more than 5-10 related functions
- Functions share common state or dependencies
- Clear groupings exist (analysis, validation, transformation, etc.)
- Business logic with multiple steps or workflows
- Code that benefits from dependency injection

**When functions are acceptable:**

- Pure utility functions (string manipulation, math operations)
- Single-purpose helpers with no shared state
- Top-level facade functions that delegate to classes
- Framework integration points (Next.js API routes, React components)

### Bounded Context-Based Folder Structure

**Problem**: Organizing by technical layers (controllers/, services/, models/) obscures business purpose and doesn't scale.

```typescript
// ❌ BAD - Layer-based (screams "I use Express")
src/
├── controllers/
│   ├── UserController.ts
│   └── OrderController.ts
├── services/
└── models/

// Hard to understand business capabilities
```

**Solution**: Organize by bounded contexts (business domains) with clean architecture layers inside.

```typescript
// ✓ GOOD - Bounded context-based (screams "security and git workflow")
src/domains/
├── security/                // Security & Secrets bounded context
│   ├── secrets/             // Secrets management subdomain
│   │   ├── interfaces.ts    // Business capability interfaces
│   │   ├── manager.ts       // SecretsManager (main API)
│   │   ├── resolver.ts      // Secret resolution with caching
│   │   ├── systems.ts       // System interactions (excluded from coverage)
│   │   ├── adapters/        // Vendor-specific implementations
│   │   │   ├── onepassword/ // 1Password adapter
│   │   │   └── bitwarden/   // Bitwarden adapter (future)
│   │   └── index.ts         // Public API
│   ├── scanning/            // Security scanning subdomain
│   └── index.ts             // Security domain API
└── shared/                  // Cross-cutting concerns (shared kernel)
    ├── process/
    └── logging/

// Consumer imports from public API:
import { SecretsManager } from '@domains/security/secrets';  // Public API
```

**Why this approach is better:**

1. **Screaming architecture**: Folder structure reveals business capabilities, not framework
2. **Bounded contexts**: Each domain represents a distinct business domain (DDD)
3. **Easy extraction**: Lift entire domain into separate service/microservice
4. **Parallel development**: Teams work on different domains without conflicts
5. **Dependency control**: Clean architecture enforces testability
6. **Adapter isolation**: Vendor-specific code hidden in `adapters/` subdirectories

**When to use bounded context-based:**

- Projects beyond simple prototypes
- Multiple business domains
- Planning for microservice extraction
- Teams larger than 3 developers

**When layer-based is acceptable:**

- Small projects (<1000 lines)
- Learning projects
- Simple CRUD with no complex business logic

### Prefer Barrel Exports

**Problem**: Exporting everything directly from source files creates tight coupling and no API boundaries.

```typescript
// ❌ BAD - No public API boundary
src/domains/security/secrets/
├── manager.ts              // Consumers import directly
├── resolver.ts             // Internal implementation exposed
└── adapters/
    └── onepassword/
        └── adapter.ts      // Internal implementation exposed

// Consumer sees all internals:
import { SecretsManager } from '@domains/security/secrets/manager';
import { SecretResolver } from '@domains/security/secrets/resolver';
import { OnePasswordAdapter } from '@domains/security/secrets/adapters/onepassword/adapter';  // Should be private
```

**Solution**: Use index.ts barrel files to define consumer-focused public APIs.

```typescript
// ✓ GOOD - Explicit public API via index.ts
src/domains/security/secrets/
├── manager.ts              // Implementation
├── resolver.ts             // Implementation (optional to export)
├── adapters/               // Internal (not exported from main index)
│   └── onepassword/
│       ├── adapter.ts      // Internal implementation
│       └── index.ts        // Adapter barrel (not exported from main)
└── index.ts                // Public API

// index.ts - Explicitly defines what's public:
export { SecretsManager } from './manager.js';
export type { ISecretsProvider } from './interfaces.js';
// Adapters NOT exported - consumers use dependency injection

// Consumer uses clean API:
import { SecretsManager } from '@domains/security/secrets';  // Simple, controlled
const secrets = SecretsManager.create(); // Uses default adapter internally
```

**Why this approach is better:**

1. **Consumer-focused**: API designed for ease of use, not implementation convenience
2. **Encapsulation**: Hide internal classes, only expose what consumers need
3. **Refactoring safety**: Change internals without breaking consumers
4. **Clear boundaries**: index.ts documents what's public vs internal
5. **Code coverage exclusion**: Barrel files excluded from coverage (no logic)

**Barrel file guidelines:**

```typescript
// index.ts patterns:

// ✓ GOOD - Explicit named exports
export { UserService } from "./user-service";
export { CreateUserUseCase } from "./application/create-user.usecase";
export type { User, UserDTO } from "./domain/user.entity";

// ❌ BAD - Wildcard exports (kills tree-shaking)
export * from "./user-service"; // Exports everything, including internals
```

**Code coverage exclusion:**

```javascript
// jest.config.js
collectCoverageFrom: [
  "src/**/*.ts",
  "!src/**/index.ts", // Exclude barrel files (no logic to test)
  "!src/**/*.spec.ts",
];
```

**When to use barrel exports:**

- Module public APIs (always)
- Package entry points (package.json main field)
- Bounded context boundaries

**When NOT to use barrel exports:**

- Internal organization within a module
- Deep folder hierarchies (use direct imports)
- Performance-critical paths (direct imports faster)

### Separate System Interactions

**Problem**: Mixing business logic with system calls (file I/O, HTTP, shell commands) makes code untestable and dilutes coverage metrics.

```typescript
// ❌ BAD - Business logic mixed with system calls
export async function processConfig(path: string): Promise<Config> {
  // System call - hard to test
  const content = await readFile(path, "utf-8");

  // Business logic
  const parsed = JSON.parse(content);
  if (!parsed.version) throw new Error("Missing version");

  return { ...parsed, validated: true };
}

// Cannot test without real files, coverage includes untestable system code
```

**Solution**: Use interface-based dependency injection with `systems.ts` files for system operations.

```typescript
// ✓ GOOD - Clean separation via interface
// interfaces.ts
export interface IFileReader {
  read(path: string): Promise<string>;
}

// systems.ts (excluded from coverage by glob pattern: **/systems.ts)
import { readFile } from "node:fs/promises";
export class FileReaderSystem implements IFileReader {
  async read(path: string): Promise<string> {
    return readFile(path, "utf-8"); // Thin wrapper, no logic
  }
}
export const defaultFileReader = new FileReaderSystem();

// config-loader.ts (testable business logic)
import type { IFileReader } from "./interfaces.js";
import { defaultFileReader } from "./systems.js";

export async function processConfig(
  path: string,
  reader: IFileReader = defaultFileReader
): Promise<Config> {
  const content = await reader.read(path); // Injected dependency
  const parsed = JSON.parse(content); // Business logic
  if (!parsed.version) throw new Error("Missing version");
  return { ...parsed, validated: true };
}

// tests/mocks.ts (or tests/mocks/config.ts)
export class FileReaderMock implements IFileReader {
  private files = new Map<string, string>();
  setFile(path: string, content: string) {
    this.files.set(path, content);
  }
  async read(path: string) {
    return this.files.get(path) || "";
  }
}
```

**Why this approach is better:**

1. **Testable**: Business logic tested with mocks, no real file I/O
2. **Fast tests**: All in-memory, deterministic
3. **Accurate coverage**: Only business logic measured, system wrappers excluded
4. **Clear boundaries**: `systems.ts` file self-documents all system interactions in module
5. **Type-safe**: Interface contract enforced at compile time

**File naming convention:**

```typescript
src/domains/config/
├── interfaces.ts         // All interface definitions for this domain
├── systems.ts           // All system implementations (excluded from coverage)
├── config-loader.ts     // Business logic (testable)
├── adapters/            // Vendor-specific implementations (if any)
│   └── yaml/            // YAML config adapter
│       ├── adapter.ts
│       └── systems.ts   // YAML library system wrapper
└── index.ts             // Public API

tests/mocks/
└── config.ts            // All test doubles for config domain

// Coverage exclusion:
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/systems.ts',    // Exclude all system interaction files
  '!src/**/index.ts',      // Exclude all barrel files
  '!src/**/adapters/**',   // Optionally exclude adapter implementations
]
```

**When to use this pattern:**

- File system operations (read, write, delete)
- Shell command execution
- HTTP/network requests
- Database queries
- External service calls

**When NOT needed:**

- Pure functions with no I/O
- In-memory data transformations
- Business rule calculations

For comprehensive examples and patterns, see [Clean Architecture in TypeScript](./agents.clean.arch.ts.md).

### Test-Driven Development (TDD)

**Problem**: Writing implementation first and tests later leads to untestable code, missed edge cases, and poor API design.

```typescript
// ❌ BAD - Implementation first approach
// Step 1: Write full implementation
export class UserService {
  async createUser(data: UserData): Promise<User> {
    // Complex implementation with no tests guiding design
    const user = await this.db.insert({
      name: data.name,
      email: data.email,
      // Missing validation, error handling
    });
    return user;
  }
}

// Step 2: Try to write tests (discover problems too late)
describe("UserService", () => {
  it("should create user", async () => {
    // Hard to test - tightly coupled to real database
    // Missing validation wasn't caught until now
  });
});
```

**Solution**: Write tests first using RED → GREEN → REFACTOR, designing skeleton code with architecture-first approach.

```typescript
// ✓ GOOD - TDD approach with architecture-first design
// Step 1: Design architecture skeleton (focus on structure)
export interface IUserRepository {
  insert(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
}

export class UserService {
  constructor(private repository: IUserRepository) {}

  async createUser(data: UserData): Promise<User> {
    throw new Error("Not implemented yet"); // Architecture complete, logic pending
  }
}

// Step 2: Write failing test (RED)
import { describe, it, expect } from "bun:test";
import { UserService } from "./user-service";
import { InMemoryUserRepository } from "../../../tests/mocks/user-repository";

describe("UserService.createUser", () => {
  it("should create user with valid data", async () => {
    // Arrange
    const repository = new InMemoryUserRepository();
    const service = new UserService(repository);
    const userData = { name: "Alice", email: "alice@example.com" };

    // Act
    const user = await service.createUser(userData);

    // Assert
    expect(user.name).toBe("Alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.id).toBeDefined();
  });
});
// Test fails: Error: Not implemented yet (RED)

// Step 3: Write minimal implementation (GREEN)
export class UserService {
  constructor(private repository: IUserRepository) {}

  async createUser(data: UserData): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };
    return this.repository.insert(user);
  }
}
// Test passes (GREEN)

// Step 4: Add validation test (RED)
it("should reject invalid email", async () => {
  const repository = new InMemoryUserRepository();
  const service = new UserService(repository);
  const invalidData = { name: "Bob", email: "not-an-email" };

  await expect(service.createUser(invalidData)).rejects.toThrow("Invalid email");
});
// Test fails (RED)

// Step 5: Add validation (GREEN)
export class UserService {
  async createUser(data: UserData): Promise<User> {
    if (!this.isValidEmail(data.email)) {
      throw new Error("Invalid email");
    }
    // ... rest of implementation
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
// Test passes (GREEN)

// Step 6: Refactor (REFACTOR)
// Extract validation to separate validator class
// Improve error messages
// All tests still pass
```

**Why this approach is better:**

1. **Better API design**: Tests force you to think about how consumers will use your code
2. **Complete test coverage**: Every line of code has a corresponding test
3. **Faster feedback**: Catch design problems in minutes, not days
4. **Regression protection**: Tests document expected behavior and catch regressions
5. **Confidence to refactor**: Comprehensive tests enable safe refactoring
6. **No dead code**: Only write code needed to pass tests
7. **Architecture clarity**: Skeleton design separates structure from implementation

**TDD Workflow:**

1. **Design skeleton (architecture first)**:
   - Define interfaces for dependencies (`IUserRepository`)
   - Define public API signatures (`createUser(data: UserData): Promise<User>`)
   - Use `throw new Error('Not implemented yet')` in method bodies
   - Focus on bounded context structure and domain separation

2. **RED - Write failing test**:
   - Write test for single behavior
   - Test should fail (proves test is valid)
   - Use mocks/test doubles for dependencies

3. **GREEN - Write minimal implementation**:
   - Write simplest code to pass the test
   - Don't optimize or add extra features
   - Get to working state quickly

4. **REFACTOR - Improve code quality**:
   - Extract duplicated code
   - Improve naming and structure
   - Optimize algorithms
   - All tests must still pass

5. **Repeat**: Add next test, implement, refactor

**When to use TDD:**

- New features or modules
- Bug fixes (write failing test that reproduces bug first)
- Complex business logic
- Public APIs (test-first ensures good design)
- Code that requires high reliability

**When TDD may be skipped:**

- Prototypes or spikes (exploration phase)
- UI layout (visual testing more appropriate)
- Configuration files
- Simple data transformations with obvious implementation

**Example: TDD for secrets management refactoring**

```typescript
// Step 1: Architecture skeleton
// src/domains/security/secrets/manager.ts
export class SecretsManager {
  private constructor(private provider: ISecretsProvider) {}

  static create(provider?: ISecretsProvider): SecretsManager {
    throw new Error("Not implemented yet");
  }

  async resolve(reference: string): Promise<string> {
    throw new Error("Not implemented yet");
  }
}

// Step 2: Write failing tests (RED)
describe("SecretsManager", () => {
  it("should create instance with default provider", () => {
    const manager = SecretsManager.create();
    expect(manager).toBeInstanceOf(SecretsManager);
  });

  it("should resolve secret reference", async () => {
    const mockProvider = new MockSecretsProvider();
    mockProvider.setSecret("op://vault/item/field", "secret-value");
    const manager = SecretsManager.create(mockProvider);

    const result = await manager.resolve("op://vault/item/field");
    expect(result).toBe("secret-value");
  });
});

// Step 3: Implement (GREEN)
export class SecretsManager {
  private constructor(private provider: ISecretsProvider) {}

  static create(provider?: ISecretsProvider): SecretsManager {
    return new SecretsManager(provider || new OnePasswordAdapter());
  }

  async resolve(reference: string): Promise<string> {
    return this.provider.resolve(reference);
  }
}

// Step 4: Refactor (add error handling, caching, etc.)
// All tests still pass
```

**Connection to other principles:**

- **Bounded Context-Based Folder Structure** (#1): TDD encourages thinking about domain boundaries upfront
- **Expose Business Capabilities** (#2): Tests validate that API expresses business intent
- **Class-Based Structures** (#3): Tests drive towards cohesive class design
- **Barrel Exports** (#4): Tests validate public API is sufficient and well-designed
- **Separate System Interactions** (#5): TDD with mocks naturally separates testable logic from system calls
- **Unit Tests Without Mocks** (#7): TDD skeleton design enables testing real implementations

### Unit Tests Without Mocks

**Problem**: Using mocks in unit tests creates brittle tests that pass even when real implementations are broken.

```typescript
// ❌ BAD - Mocks in unit tests
// tests/unit/user-service.test.ts
import { jest } from "@jest/globals";

describe("UserService", () => {
  it("should create user", async () => {
    // Mocking in unit test
    const mockRepository = {
      insert: jest.fn().mockResolvedValue({ id: "123", name: "Alice" }),
      findByEmail: jest.fn().mockResolvedValue(null),
    };

    const service = new UserService(mockRepository);
    const user = await service.createUser({ name: "Alice", email: "alice@example.com" });

    expect(user.name).toBe("Alice");
    // Test passes, but real PostgresRepository might be broken
  });
});
```

**Solution**: Unit tests use real implementations; mocks only in integration tests to bypass external systems.

```typescript
// ✓ GOOD - Real implementations in unit tests
// tests/unit/domains/security/secrets/manager.test.ts
import { describe, it, expect } from "bun:test";
import { SecretsManager } from "@src/domains/security/secrets/manager";
import { InMemorySecretsProvider } from "../../../../mocks/secrets-provider";

describe("SecretsManager", () => {
  it("should resolve secret from provider", async () => {
    // Real implementation, just in-memory instead of external system
    const provider = new InMemorySecretsProvider();
    provider.addSecret("op://vault/item/field", "secret-value");

    const manager = SecretsManager.create(provider);
    const result = await manager.resolve("op://vault/item/field");

    expect(result).toBe("secret-value");
    // Test verifies real business logic with real data structures
  });

  it("should cache resolved secrets", async () => {
    const provider = new InMemorySecretsProvider();
    provider.addSecret("op://vault/api/token", "abc123");

    const manager = SecretsManager.create(provider);

    // First call - hits provider
    await manager.resolve("op://vault/api/token");

    // Second call - should use cache
    await manager.resolve("op://vault/api/token");

    // Verify caching behavior with real implementation
    expect(provider.getCallCount("op://vault/api/token")).toBe(1);
  });
});

// tests/mocks/secrets-provider.ts - Real implementation for testing
export class InMemorySecretsProvider implements ISecretsProvider {
  private secrets = new Map<string, string>();
  private callCounts = new Map<string, number>();

  addSecret(reference: string, value: string): void {
    this.secrets.set(reference, value);
  }

  async resolve(reference: string): Promise<string> {
    this.callCounts.set(reference, (this.callCounts.get(reference) || 0) + 1);
    const value = this.secrets.get(reference);
    if (!value) throw new Error(`Secret not found: ${reference}`);
    return value;
  }

  getCallCount(reference: string): number {
    return this.callCounts.get(reference) || 0;
  }
}

// ✓ Integration tests use mocks for external systems
// tests/integration/secrets/onepassword-integration.test.ts
describe("OnePasswordAdapter integration", () => {
  it("should authenticate with 1Password CLI", async () => {
    // Mock external system (1Password CLI) in integration test
    const mockCLI = new MockOnePasswordCLI();
    mockCLI.setAuthResponse({ success: true, account: "test-account" });

    const adapter = new OnePasswordAdapter(mockCLI);
    const result = await adapter.authenticate();

    expect(result.success).toBe(true);
    // Integration test verifies adapter interacts correctly with CLI
  });
});
```

**Why this approach is better:**

1. **Catch real bugs**: Tests exercise actual business logic, not mock behavior
2. **Fast execution**: In-memory implementations run at compile speed (< 1ms per test)
3. **Deterministic**: No flakiness from external systems or timing issues
4. **Refactoring confidence**: Tests verify real behavior, not implementation details
5. **Clear test boundaries**: Unit (real implementations) vs Integration (mocked systems) vs UAT (real systems)
6. **Better test coverage**: Exercise actual code paths, not mock return values

**Test structure:**

```typescript
tests/
├── unit/                       // Real implementations, no mocks
│   └── domains/                // Shadows src/domains/
│       ├── security/
│       │   └── secrets/        // Shadows src/domains/security/secrets/
│       │       ├── manager.test.ts
│       │       ├── resolver.test.ts
│       │       └── reference.test.ts
│       └── git/
│           └── pr-template/    // Shadows src/domains/git/pr-template/
│               └── parser.test.ts
├── integration/                // Mocks for external systems
│   ├── secrets/
│   │   └── onepassword-integration.test.ts  // Mocks 1Password CLI
│   └── installers/
│       └── github-mcp.test.ts              // Mocks GitHub API
├── uat/                        // End-to-end, real systems
│   └── deployment-workflow.test.ts
└── mocks/                      // Real implementations for testing
    ├── secrets-provider.ts     // In-memory ISecretsProvider
    ├── user-repository.ts      // In-memory IUserRepository
    └── file-reader.ts          // In-memory IFileReader
```

**Test folder structure shadows source:**

```typescript
// Source structure
src/domains/security/secrets/
├── manager.ts
├── resolver.ts
├── reference.ts
└── adapters/
    └── onepassword/
        └── adapter.ts

// Test structure mirrors domain organization
tests/unit/domains/security/secrets/
├── manager.test.ts          // Tests manager.ts
├── resolver.test.ts         // Tests resolver.ts
├── reference.test.ts        // Tests reference.ts
└── adapters/
    └── onepassword/
        └── adapter.test.ts  // Tests adapter.ts

// Benefits:
// 1. Easy to find tests for any source file
// 2. Clear relationship between source and tests
// 3. Refactoring moves tests with source
// 4. New developers understand test organization instantly
```

**Performance targets:**

| Test Type   | Execution Time | External Dependencies | Mocks Used                      |
| ----------- | -------------- | --------------------- | ------------------------------- |
| Unit        | < 1ms per test | None                  | None (real in-memory impl)      |
| Integration | < 100ms        | Minimal (local only)  | External systems (API, CLI, DB) |
| UAT/E2E     | < 30 seconds   | Real systems          | None (full end-to-end)          |

**Creating test doubles (real implementations):**

```typescript
// ✓ GOOD - Real implementation for testing
// tests/mocks/user-repository.ts
export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>();

  async insert(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find((u) => u.email === email) || null;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  // Test helper methods
  clear(): void {
    this.users.clear();
  }

  count(): number {
    return this.users.size;
  }
}

// Usage in tests
describe("UserService", () => {
  it("should prevent duplicate emails", async () => {
    const repository = new InMemoryUserRepository();
    const service = new UserService(repository);

    await service.createUser({ name: "Alice", email: "alice@example.com" });

    // Test real validation logic
    await expect(service.createUser({ name: "Bob", email: "alice@example.com" })).rejects.toThrow(
      "Email already exists"
    );
  });
});
```

**When to use mocks:**

**Integration tests** - Mock external systems:

- Database connections (use in-memory DB or docker container instead when possible)
- HTTP APIs (mock server responses)
- File system (mock file operations for external files)
- CLI tools (mock command output)
- Cloud services (mock AWS SDK calls)

**Unit tests** - Use real implementations:

- Business logic (always use real code)
- Domain entities (always use real objects)
- Data transformations (always test real functions)
- Validation rules (always test real validators)
- Internal dependencies (use real in-memory implementations)

**Never mock:**

- Language built-ins (Array, Map, Set, String, etc.)
- Your own domain code in unit tests
- Pure functions with no side effects
- Value objects and DTOs

**Example: Unit vs Integration testing**

```typescript
// Unit test - Real implementations
// tests/unit/domains/security/secrets/resolver.test.ts
describe("SecretResolver", () => {
  it("should cache resolved secrets", async () => {
    const provider = new InMemorySecretsProvider(); // Real implementation
    provider.addSecret("op://vault/api/token", "abc123");

    const resolver = new SecretResolver(provider);

    const first = await resolver.resolve("op://vault/api/token");
    const second = await resolver.resolve("op://vault/api/token");

    expect(first).toBe("abc123");
    expect(second).toBe("abc123");
    expect(provider.getCallCount("op://vault/api/token")).toBe(1); // Cached
  });
});

// Integration test - Mocked external system
// tests/integration/secrets/onepassword-integration.test.ts
describe("OnePasswordAdapter", () => {
  it("should resolve secret from 1Password CLI", async () => {
    const mockCLI = new MockOnePasswordCLI(); // Mocks external system
    mockCLI.setSecret("op://vault/api/token", "real-secret-123");

    const adapter = new OnePasswordAdapter(mockCLI);
    const result = await adapter.resolve("op://vault/api/token");

    expect(result).toBe("real-secret-123");
    expect(mockCLI.wasCalledWith("op", "read", "op://vault/api/token")).toBe(true);
  });
});
```

**Connection to other principles:**

- **Test-Driven Development** (#6): TDD skeleton design enables real implementations for unit testing
- **Separate System Interactions** (#5): System wrappers tested in integration, business logic in unit tests
- **Expose Business Capabilities** (#2): Unit tests validate business API works with real domain logic
- **Bounded Context-Based Folder Structure** (#1): Test folders mirror domain organization for clarity

### Atomic Tests

**Problem**: Tests that share state (module-level mocks, describe-scoped instances, or module singletons) fail when Bun runs them in parallel or random order, even though they pass individually.

```typescript
// ❌ BAD - Shared mock instance causes race conditions
describe("git-utils (integration)", () => {
  let mockExecutor: ProcessExecutorMock; // ← SHARED across all tests

  beforeEach(() => {
    mockExecutor = new ProcessExecutorMock();
  });

  it("should get staged files", async () => {
    mockExecutor.setCommand("git diff --cached", { stdout: "file1.ts\n" });
    const result = await getStagedFiles(mockExecutor);
    expect(result).toEqual(["file1.ts"]);
  });

  it("should return empty array when no files", async () => {
    mockExecutor.setCommand("git diff --cached", { stdout: "" });
    const result = await getStagedFiles(mockExecutor);
    expect(result).toEqual([]);
  });

  // When running in parallel:
  // - Test 1 sets stdout to 'file1.ts\n'
  // - Test 2 sets stdout to '' at the same time
  // - Both tests use the SAME mockExecutor instance
  // - Race condition: which value wins?
});

// Symptom: Individual file passes, full suite fails
// $ FILES=tests/unit/utils/git-utils.test.ts bun test  ✓ 13 pass
// $ bun test  ✗ 8 failures in git-utils.test.ts
```

**Even worse - Module-level mocks pollute ALL test files:**

```typescript
// ❌ VERY BAD - Global pollution across entire test process
// tests/unit/security/eslint-linter.test.ts
const mockIsCommandAvailable = mock();

mock.module("../../../src/utils/git-utils.js", () => ({
  isCommandAvailable: mockIsCommandAvailable,
  getStagedFiles: mock(() => []),
}));

describe("eslint-linter", () => {
  it("should check if ESLint is installed", async () => {
    mockIsCommandAvailable.mockReturnValue(true);
    const result = await isESLintInstalled();
    expect(result).toBe(true);
  });
});

// Problem: mock.module() creates GLOBAL mock for ALL test files
// When git-utils.test.ts runs (in parallel or after), it imports git-utils
// But it gets the MOCKED version instead of real implementation
// Result: git-utils.test.ts fails with unexpected mock behavior
```

**Solution**: Create new mock instances in each `it()` block, avoid module-level mocks for internal code, and always pass explicit dependencies.

```typescript
// ✓ GOOD - Test-scoped mocks (isolated per test)
describe("git-utils (integration)", () => {
  it("should get staged files", async () => {
    const mockExecutor = new ProcessExecutorMock(); // ← NEW instance per test
    mockExecutor.setCommand("git diff --cached --name-only --diff-filter=ACM", {
      stdout: "file1.ts\n",
      exitCode: 0,
    });

    const result = await getStagedFiles(mockExecutor);
    expect(result).toEqual(["file1.ts"]);
  });

  it("should return empty array when no files", async () => {
    const mockExecutor = new ProcessExecutorMock(); // ← NEW instance per test
    mockExecutor.setCommand("git diff --cached --name-only --diff-filter=ACM", {
      stdout: "",
      exitCode: 0,
    });

    const result = await getStagedFiles(mockExecutor);
    expect(result).toEqual([]);
  });

  // Each test has its own isolated mock
  // No race conditions in parallel execution
  // Tests can run in any order
});

// ✓ GOOD - Use dependency injection instead of mock.module()
// src/security/eslint-linter.ts
export async function isESLintInstalled(
  commandChecker: (cmd: string) => Promise<boolean> = isCommandAvailable
): Promise<boolean> {
  return commandChecker("eslint");
}

// tests/unit/security/eslint-linter.test.ts
it("should check if ESLint is installed", async () => {
  const mockChecker = mock(() => Promise.resolve(true)); // ← Test-scoped
  const result = await isESLintInstalled(mockChecker);
  expect(result).toBe(true);
});

// No module mocking needed - clean dependency injection
```

**Why this approach is better:**

1. **Parallel execution**: Tests run concurrently without race conditions
2. **Random order**: Tests can run in any order (Bun default behavior)
3. **Fast debugging**: Individual test failures are isolated, not cascade failures
4. **No pollution**: Module-level mocks don't leak between test files
5. **Deterministic**: Same results every run, regardless of execution order
6. **Maintainable**: Tests don't mysteriously fail when unrelated tests are added

**The Four Rules of Atomic Tests:**

**Rule 1: Test-Scoped Mocks Only**

```typescript
// ✗ BAD - Describe-scoped (shared instance)
describe('my tests', () => {
  let mockExecutor: ProcessExecutorMock; // Shared

  beforeEach(() => {
    mockExecutor = new ProcessExecutorMock();
  });

  it('test 1', () => { mockExecutor.setCommand(...); }); // Race
  it('test 2', () => { mockExecutor.setCommand(...); }); // Race
});

// ✓ GOOD - Test-scoped (isolated instances)
describe('my tests', () => {
  it('test 1', () => {
    const mockExecutor = new ProcessExecutorMock(); // Isolated
    mockExecutor.setCommand(...);
  });

  it('test 2', () => {
    const mockExecutor = new ProcessExecutorMock(); // Isolated
    mockExecutor.setCommand(...);
  });
});
```

**Rule 2: Avoid Module-Level Mocks for Internal Code**

```typescript
// ✗ BAD - Module mock for internal code (global pollution)
mock.module("../../../src/utils/git-utils.js", () => ({
  isCommandAvailable: mock(),
}));

// ✓ GOOD - Dependency injection (no module mocking)
export async function isESLintInstalled(commandChecker = isCommandAvailable): Promise<boolean> {
  return commandChecker("eslint");
}

// Test with injected mock (test-scoped)
it("should check if ESLint is installed", async () => {
  const mockChecker = mock(() => Promise.resolve(true));
  const result = await isESLintInstalled(mockChecker);
  expect(result).toBe(true);
});

// ✓ ACCEPTABLE - Module mock for external dependencies only
mock.module("node:child_process", () => ({
  execSync: mock(),
}));
```

**Rule 3: Minimize Module-Level Singletons**

```typescript
// ⚠️ RISKY - Module-level singleton (shared state)
export const defaultProcessExecutor = new ProcessExecutorSystem();

export async function getStagedFiles(
  executor: IProcessExecutor = defaultProcessExecutor // ← Shared singleton
): Promise<string[]> {
  return executor.exec("git diff --cached");
}

// ✓ BETTER - Factory function (new instance per call)
export function createProcessExecutor(): IProcessExecutor {
  return new ProcessExecutorSystem();
}

// ✓ ACCEPTABLE - Immutable singleton (no state)
export const DEFAULT_TIMEOUT = 30000; // Primitive, can't mutate
```

**Rule 4: Always Pass Dependencies in Tests**

```typescript
// ✗ BAD - Relies on default parameter (uses shared singleton)
it('should get staged files', async () => {
  const result = await getStagedFiles(); // No executor passed
  expect(result).toEqual(['file1.ts']);
});

// ✓ GOOD - Explicit mock instance (isolated)
it('should get staged files', async () => {
  const mockExecutor = new ProcessExecutorMock();
  mockExecutor.setCommand(...);

  const result = await getStagedFiles(mockExecutor);
  expect(result).toEqual(['file1.ts']);
});
```

**Detection Methods:**

When tests fail only in full suite but pass individually:

```bash
# Individual file passes
FILES=tests/unit/utils/git-utils.test.ts bun test
# ✓ 13 pass, 0 fail

# Full suite fails
bun test
# ✗ 995 pass, 14 fail (including 8 git-utils failures)

# Conclusion: Global state pollution
```

**Finding antipatterns:**

```bash
# Find describe-scoped mocks (potential shared state)
grep -r "let mock.*:" tests/ | grep -v "const mock"

# Find module-level mocks (global pollution)
grep -r "mock.module" tests/

# Find module-level singletons (shared state)
grep -r "^export const.*=.*new " src/
```

**Quick checklist before committing:**

- [ ] No `let mock*` declarations at describe scope
- [ ] No `mock.module()` calls for internal code (only external deps)
- [ ] All mocks created with `const` inside individual `it()` blocks
- [ ] No reliance on default parameters in tests (always pass explicit mocks)
- [ ] Tests pass individually: `FILES=path/to/test.ts bun test`
- [ ] Tests pass in full suite: `bun test`

**Performance impact:**

| Approach           | Parallel | Random Order | Speed       | Reliability |
| ------------------ | -------- | ------------ | ----------- | ----------- |
| Shared mocks (bad) | ✗ Fails  | ✗ Fails      | Fast        | Unreliable  |
| Test-scoped mocks  | ✓ Works  | ✓ Works      | Fast        | Reliable    |
| Serial execution   | N/A      | ✓ Works      | Slow (10x+) | Reliable    |

**When to use atomic test pattern:**

- Always (all unit and integration tests)
- Especially when using Bun (parallel by default)
- Required for CI/CD reliability
- Critical for test-driven development

**When NOT to worry:**

- End-to-end tests with real systems (serial execution acceptable)
- Prototype/spike code (no tests yet)

**Connection to other principles:**

- **Unit Tests Without Mocks** (#7): Real implementations eliminate need for module mocking
- **Test-Driven Development** (#6): TDD naturally creates test-scoped dependencies
- **Separate System Interactions** (#5): Dependency injection enables atomic tests
- **Expose Business Capabilities** (#2): Business APIs designed for testability support atomic tests

By following these four rules, tests become truly independent units that can execute in any order, at any time, in parallel, without cascading failures or mysterious bugs.

## Related Documentation

For general clean architecture principles, see [Clean Architecture Guide](./agents.clean.arch.md)

For test-driven development patterns, see [TDD Guide](./agents.tdd.md)
