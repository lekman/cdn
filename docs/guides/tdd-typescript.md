# Test-Driven Development in TypeScript

This guide provides TypeScript-specific TDD implementation details for AI agents. It covers Bun test framework, mocking patterns, and TypeScript best practices.

## Target Audience

AI agents writing TypeScript code with Bun test framework (similar to Jest). Applicable to Node.js, Bun, and Deno runtimes.

## Prerequisites

**Required knowledge:**

- Basic TDD principles (see [agents.tdd.md](./agents.tdd.md))
- TypeScript syntax and type system
- Async/await patterns
- Node.js/Bun APIs

**Setup:**

```bash
# Install bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version

# Install project dependencies
bun install
```

## Test Framework: Bun Test

### Basic Structure

```typescript
/**
 * Copyright (c) 2024-2025 Your Organization
 * All rights reserved.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { functionToTest } from "@src/module";

describe("Module Name", () => {
  // Setup runs before each test
  beforeEach(() => {
    // Initialize test state
  });

  // Cleanup runs after each test
  afterEach(() => {
    // Clean up resources
  });

  it("should perform expected behavior", () => {
    // Arrange
    const input = "test";

    // Act
    const result = functionToTest(input);

    // Assert
    expect(result).toBe("expected");
  });
});
```

### Import Paths

**Use TypeScript path aliases:**

```typescript
//  GOOD - Path alias (configured in tsconfig.json)
import { utility } from "@src/utils/utility";
import { Config } from "@src/types";

//  BAD - Relative paths
import { utility } from "../../../src/utils/utility";
import { Config } from "../../../src/types";
```

**Path mapping in `tsconfig.json`:**

```json
{
  "compilerOptions": {
    "paths": {
      "@src/*": ["./src/*"],
      "@tests/*": ["./tests/*"]
    }
  }
}
```

### Test Discovery

**Bun automatically finds tests:**

- Files matching `*.test.ts` or `*.test.tsx`
- Files in `tests/` directory
- `__tests__/` directories

**Run tests:**

```bash
# Run all tests
bun test

# Run specific file
bun test tests/unit/module.test.ts

# Run tests matching pattern
bun test --filter="email validation"

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch
```

## Assertions

### Basic Assertions

```typescript
import { expect } from "bun:test";

// Equality
expect(actual).toBe(expected); // Strict equality (===)
expect(actual).toEqual(expected); // Deep equality
expect(actual).not.toBe(unexpected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeUndefined();
expect(value).toBeNull();

// Numbers
expect(num).toBeGreaterThan(5);
expect(num).toBeGreaterThanOrEqual(5);
expect(num).toBeLessThan(10);
expect(num).toBeLessThanOrEqual(10);
expect(float).toBeCloseTo(0.3, 5); // 5 decimal places

// Strings
expect(str).toMatch(/pattern/);
expect(str).toContain("substring");
expect(str).toHaveLength(10);

// Arrays
expect(arr).toContain("item");
expect(arr).toHaveLength(5);
expect(arr).toEqual(expect.arrayContaining(["a", "b"]));

// Objects
expect(obj).toHaveProperty("key");
expect(obj).toHaveProperty("key", "value");
expect(obj).toMatchObject({ key: "value" });
expect(obj).toEqual(expect.objectContaining({ key: "value" }));

// Instances
expect(obj).toBeInstanceOf(Date);
expect(obj).toBeInstanceOf(Error);

// Exceptions
expect(() => throwError()).toThrow();
expect(() => throwError()).toThrow("error message");
expect(() => throwError()).toThrow(TypeError);

// Promises
await expect(promise).resolves.toBe("value");
await expect(promise).rejects.toThrow("error");
```

### Custom Matchers

```typescript
// Extend expect with custom matchers
expect.extend({
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid email`
          : `Expected ${received} to be a valid email`,
    };
  },
});

// Usage
expect("test@example.com").toBeValidEmail();
```

## Async Testing

### Testing Async Functions

```typescript
import { describe, it, expect } from "bun:test";

describe("Async operations", () => {
  it("should handle promises", async () => {
    // Using await
    const result = await fetchData();
    expect(result).toBe("data");
  });

  it("should handle promise resolution", async () => {
    // Using resolves
    await expect(fetchData()).resolves.toBe("data");
  });

  it("should handle promise rejection", async () => {
    // Using rejects
    await expect(failingOperation()).rejects.toThrow("Error message");
  });

  it("should handle multiple promises", async () => {
    // Using Promise.all
    const [result1, result2] = await Promise.all([fetchData(), fetchMoreData()]);

    expect(result1).toBe("data1");
    expect(result2).toBe("data2");
  });
});
```

### Timeouts

```typescript
import { describe, it, expect } from "bun:test";

describe("Slow operations", () => {
  it(
    "should handle slow operation",
    async () => {
      const result = await slowOperation();
      expect(result).toBeDefined();
    },
    { timeout: 10000 } // 10 seconds
  );
});
```

## Mocking

### Mock Functions

```typescript
import { describe, it, expect, mock } from "bun:test";

describe("Mock functions", () => {
  it("should track function calls", () => {
    // Create mock function
    const mockFn = mock(() => "return value");

    // Call mock
    const result = mockFn("arg1", "arg2");

    // Assert return value
    expect(result).toBe("return value");

    // Assert call count
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Assert arguments
    expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("should implement custom behavior", () => {
    const mockFn = mock((x: number) => x * 2);

    expect(mockFn(5)).toBe(10);
    expect(mockFn(10)).toBe(20);
  });

  it("should return different values on successive calls", () => {
    const mockFn = mock();

    mockFn.mockReturnValueOnce("first");
    mockFn.mockReturnValueOnce("second");
    mockFn.mockReturnValue("default");

    expect(mockFn()).toBe("first");
    expect(mockFn()).toBe("second");
    expect(mockFn()).toBe("default");
    expect(mockFn()).toBe("default");
  });
});
```

### Spying on Functions

```typescript
import { describe, it, expect, spyOn } from "bun:test";

describe("Function spies", () => {
  it("should spy on object method", () => {
    const obj = {
      method: (x: number) => x * 2,
    };

    // Create spy
    const spy = spyOn(obj, "method");

    // Call original method
    const result = obj.method(5);

    // Assert behavior
    expect(result).toBe(10); // Original implementation
    expect(spy).toHaveBeenCalledWith(5);
  });

  it("should override implementation", () => {
    const obj = {
      method: (x: number) => x * 2,
    };

    // Spy with custom implementation
    const spy = spyOn(obj, "method").mockImplementation((x: number) => x * 3);

    expect(obj.method(5)).toBe(15); // Mock implementation
    expect(spy).toHaveBeenCalled();
  });
});
```

### Module Mocking

```typescript
import { describe, it, expect, mock } from "bun:test";

// Mock module at top level
mock.module("@src/database", () => ({
  connect: mock(() => Promise.resolve()),
  query: mock(() => Promise.resolve([])),
  disconnect: mock(() => Promise.resolve()),
}));

describe("Database operations", () => {
  it("should use mocked database", async () => {
    const { connect, query } = await import("@src/database");

    await connect();
    const result = await query("SELECT * FROM users");

    expect(connect).toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("SELECT * FROM users");
    expect(result).toEqual([]);
  });
});
```

### Restoring Mocks

```typescript
import { describe, it, afterEach, mock } from "bun:test";

describe("Mock cleanup", () => {
  afterEach(() => {
    // Restore all mocks after each test
    mock.restore();
  });

  it("should use mock", () => {
    const fn = mock(() => "mocked");
    expect(fn()).toBe("mocked");
  });

  it("should have fresh mock", () => {
    // Previous mock is restored
    const fn = mock(() => "fresh");
    expect(fn()).toBe("fresh");
  });
});
```

## File System Testing

### Temporary Directories

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("File operations", () => {
  let testDir: string;

  beforeEach(() => {
    // Create temporary directory
    // Use realpathSync to resolve symlinks on macOS (/var -> /private/var)
    testDir = realpathSync(mkdtempSync(join(tmpdir(), "test-")));
  });

  afterEach(() => {
    // Clean up temporary directory
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should read file", () => {
    // Arrange: Create test file
    const testFile = join(testDir, "test.txt");
    writeFileSync(testFile, "test content", "utf-8");

    // Act: Read file
    const content = readFile(testFile);

    // Assert: Verify content
    expect(content).toBe("test content");
  });
});
```

### Working Directory Isolation

```typescript
import { describe, it, beforeEach, afterEach } from "bun:test";

// Use serial execution to avoid race conditions
describe.serial("Directory operations", () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd);
  });

  it("should change directory", () => {
    const newDir = "/tmp";
    process.chdir(newDir);

    expect(process.cwd()).toBe(newDir);
  });
});
```

## Platform-Specific Testing

### Conditional Test Execution

```typescript
import { describe, it, expect } from "bun:test";
import { platform } from "node:os";

const isMacOS = platform() === "darwin";
const isLinux = platform() === "linux";
const isWindows = platform() === "win32";

describe("Platform-specific features", () => {
  it.skipIf(!isMacOS)("should run on macOS only", () => {
    // Test macOS-specific behavior
  });

  it.skipIf(!isLinux)("should run on Linux only", () => {
    // Test Linux-specific behavior
  });

  it.skipIf(!isWindows)("should run on Windows only", () => {
    // Test Windows-specific behavior
  });

  it.skipIf(isMacOS)("should skip on macOS", () => {
    // Test runs on Linux and Windows
  });
});
```

### Environment Variables

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("Environment configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it("should use environment variable", () => {
    // Set test environment variable
    process.env.API_KEY = "test-key";

    // Test code that uses process.env.API_KEY
    expect(getApiKey()).toBe("test-key");
  });
});
```

## Test Organization Patterns

### Test Factories

**Create reusable test data:**

```typescript
// tests/factories/user.ts
export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: "123",
    name: "Test User",
    email: "test@example.com",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// Usage in tests
import { createTestUser } from "@tests/factories/user";

it("should update user email", () => {
  const user = createTestUser({ email: "old@example.com" });

  updateEmail(user, "new@example.com");

  expect(user.email).toBe("new@example.com");
});
```

### Shared Test Utilities

```typescript
// tests/utils/assertions.ts
export function expectValidEmail(email: string) {
  expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
}

export function expectDateInRange(date: Date, start: Date, end: Date) {
  expect(date.getTime()).toBeGreaterThanOrEqual(start.getTime());
  expect(date.getTime()).toBeLessThanOrEqual(end.getTime());
}

// Usage
import { expectValidEmail, expectDateInRange } from "@tests/utils/assertions";

it("should create user with valid email", () => {
  const user = createUser("test@example.com");

  expectValidEmail(user.email);
  expectDateInRange(user.createdAt, new Date(), new Date());
});
```

### Mock Implementations

```typescript
// tests/mocks/database.ts
import { mock } from "bun:test";

export class MockDatabase {
  private data: Map<string, any> = new Map();

  insert = mock((key: string, value: any) => {
    this.data.set(key, value);
    return Promise.resolve({ id: key });
  });

  get = mock((key: string) => {
    return Promise.resolve(this.data.get(key));
  });

  delete = mock((key: string) => {
    this.data.delete(key);
    return Promise.resolve();
  });

  clear() {
    this.data.clear();
  }
}

// Usage
import { MockDatabase } from "@tests/mocks/database";

it("should save user to database", async () => {
  const db = new MockDatabase();
  const service = new UserService(db);

  await service.saveUser({ id: "1", name: "Alice" });

  expect(db.insert).toHaveBeenCalledWith("1", { id: "1", name: "Alice" });
});
```

## Coverage Configuration

### Package.json Scripts

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "test:unit": "bun test tests/unit",
    "test:integration": "bun test tests/integration"
  }
}
```

### Coverage Thresholds

```typescript
// bun.test.ts or bunfig.toml
export default {
  coverage: {
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    exclude: ["tests/**", "**/*.test.ts", "**/*.spec.ts", "**/node_modules/**", "**/dist/**"],
  },
};
```

## Real-World Examples

### Example 1: Testing Pure Functions

```typescript
// src/utils/email.ts
export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  if (!email) {
    return { valid: false, reason: "Email is required" };
  }

  if (!email.includes("@")) {
    return { valid: false, reason: "Email must contain @" };
  }

  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return { valid: false, reason: "Invalid email format" };
  }

  if (!domain.includes(".")) {
    return { valid: false, reason: "Domain must contain ." };
  }

  return { valid: true };
}

// tests/unit/utils/email.test.ts
import { describe, it, expect } from "bun:test";
import { validateEmail } from "@src/utils/email";

describe("validateEmail", () => {
  it("should reject empty email", () => {
    const result = validateEmail("");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Email is required");
  });

  it("should reject email without @", () => {
    const result = validateEmail("invalid");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Email must contain @");
  });

  it("should reject email without local part", () => {
    const result = validateEmail("@example.com");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid email format");
  });

  it("should reject email without domain", () => {
    const result = validateEmail("user@");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid email format");
  });

  it("should reject domain without TLD", () => {
    const result = validateEmail("user@example");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Domain must contain .");
  });

  it("should accept valid email", () => {
    const result = validateEmail("user@example.com");

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should accept complex valid email", () => {
    const result = validateEmail("user.name+tag@example.co.uk");

    expect(result.valid).toBe(true);
  });
});
```

### Example 2: Testing with Dependency Injection

```typescript
// src/services/user-service.ts
export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
}

export class UserService {
  constructor(private repository: IUserRepository) {}

  async createUser(name: string, email: string): Promise<User> {
    const user: User = {
      id: generateId(),
      name,
      email,
      createdAt: new Date(),
    };

    await this.repository.save(user);

    return user;
  }

  async getUser(id: string): Promise<User> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    return user;
  }
}

// tests/unit/services/user-service.test.ts
import { describe, it, expect, mock } from "bun:test";
import { UserService, type IUserRepository } from "@src/services/user-service";
import type { User } from "@src/types";

describe("UserService", () => {
  function createMockRepository(): IUserRepository {
    return {
      save: mock(() => Promise.resolve()),
      findById: mock(() => Promise.resolve(null)),
    };
  }

  describe("createUser", () => {
    it("should create and save user", async () => {
      // Arrange
      const mockRepo = createMockRepository();
      const service = new UserService(mockRepo);

      // Act
      const user = await service.createUser("Alice", "alice@example.com");

      // Assert
      expect(user.name).toBe("Alice");
      expect(user.email).toBe("alice@example.com");
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(mockRepo.save).toHaveBeenCalledWith(user);
    });
  });

  describe("getUser", () => {
    it("should return user when found", async () => {
      // Arrange
      const mockUser: User = {
        id: "123",
        name: "Alice",
        email: "alice@example.com",
        createdAt: new Date(),
      };

      const mockRepo = createMockRepository();
      mockRepo.findById.mockResolvedValue(mockUser);

      const service = new UserService(mockRepo);

      // Act
      const user = await service.getUser("123");

      // Assert
      expect(user).toEqual(mockUser);
      expect(mockRepo.findById).toHaveBeenCalledWith("123");
    });

    it("should throw error when user not found", async () => {
      // Arrange
      const mockRepo = createMockRepository();
      mockRepo.findById.mockResolvedValue(null);

      const service = new UserService(mockRepo);

      // Act & Assert
      await expect(service.getUser("999")).rejects.toThrow("User 999 not found");
      expect(mockRepo.findById).toHaveBeenCalledWith("999");
    });
  });
});
```

### Example 3: Testing File System Operations

```typescript
// src/utils/config-loader.ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface Config {
  apiKey: string;
  environment: "development" | "production";
}

export function loadConfig(configPath: string): Config {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  if (!config.apiKey) {
    throw new Error("Config missing apiKey");
  }

  if (!config.environment) {
    throw new Error("Config missing environment");
  }

  return config;
}

// tests/unit/utils/config-loader.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "@src/utils/config-loader";

describe("loadConfig", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = realpathSync(mkdtempSync(join(tmpdir(), "config-test-")));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should load valid config", () => {
    // Arrange
    const configPath = join(testDir, "config.json");
    const configData = {
      apiKey: "test-key",
      environment: "development",
    };
    writeFileSync(configPath, JSON.stringify(configData), "utf-8");

    // Act
    const config = loadConfig(configPath);

    // Assert
    expect(config.apiKey).toBe("test-key");
    expect(config.environment).toBe("development");
  });

  it("should throw error if file not found", () => {
    // Arrange
    const configPath = join(testDir, "nonexistent.json");

    // Act & Assert
    expect(() => loadConfig(configPath)).toThrow("Config file not found");
  });

  it("should throw error if apiKey missing", () => {
    // Arrange
    const configPath = join(testDir, "config.json");
    writeFileSync(configPath, JSON.stringify({ environment: "development" }), "utf-8");

    // Act & Assert
    expect(() => loadConfig(configPath)).toThrow("Config missing apiKey");
  });

  it("should throw error if environment missing", () => {
    // Arrange
    const configPath = join(testDir, "config.json");
    writeFileSync(configPath, JSON.stringify({ apiKey: "test-key" }), "utf-8");

    // Act & Assert
    expect(() => loadConfig(configPath)).toThrow("Config missing environment");
  });
});
```

## Common Pitfalls

### Pitfall 1: Forgetting to Restore Mocks

```typescript
//  BAD - Mocks leak between tests
describe("Tests with mocks", () => {
  it("test 1", () => {
    const fn = mock(() => "result");
    // Mock not restored
  });

  it("test 2", () => {
    // Previous mock still active!
  });
});

//  GOOD - Restore mocks
describe("Tests with mocks", () => {
  afterEach(() => {
    mock.restore();
  });

  it("test 1", () => {
    const fn = mock(() => "result");
  });

  it("test 2", () => {
    // Fresh state
  });
});
```

### Pitfall 2: Not Cleaning Up File System

```typescript
//  BAD - Temporary files left behind
it("should write file", () => {
  const testFile = "/tmp/test.txt";
  writeFileSync(testFile, "test");
  // File never deleted
});

//  GOOD - Clean up after test
it("should write file", () => {
  const testFile = "/tmp/test.txt";

  try {
    writeFileSync(testFile, "test");
    // Test assertions
  } finally {
    if (existsSync(testFile)) {
      rmSync(testFile);
    }
  }
});
```

### Pitfall 3: Race Conditions with process.chdir()

```typescript
//  BAD - Parallel tests conflict
describe("Directory tests", () => {
  it("test 1", () => {
    process.chdir("/tmp");
    // Affects other parallel tests!
  });

  it("test 2", () => {
    process.chdir("/var");
    // Affects other parallel tests!
  });
});

//  GOOD - Serial execution
describe.serial("Directory tests", () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("test 1", () => {
    process.chdir("/tmp");
  });

  it("test 2", () => {
    process.chdir("/var");
  });
});
```

## Best Practices Summary

**Test structure:**

- Use `describe` to group related tests
- Use `beforeEach`/`afterEach` for setup/cleanup
- Use path aliases (`@src/*`) for imports
- One assertion per test (or related assertions)

**Async testing:**

- Always use `async/await` for promises
- Use `expect().resolves` and `expect().rejects`
- Set appropriate timeouts for slow operations

**Mocking:**

- Mock external dependencies (filesystem, network, database)
- Use dependency injection for testability
- Always restore mocks in `afterEach`
- Create reusable mock factories

**File system:**

- Use temporary directories for file tests
- Clean up temp files/directories in `afterEach`
- Use `realpathSync` to resolve symlinks on macOS
- Use `.serial` for tests using `process.chdir()`

**Platform testing:**

- Use `.skipIf()` for platform-specific tests
- Test on multiple platforms in CI/CD
- Mock platform-specific APIs when needed

**Coverage:**

- Aim for 80%+ on business logic
- Exclude test files from coverage
- Focus on meaningful tests, not coverage numbers

**Result:** Fast, reliable tests that enable confident refactoring and prevent regressions.
