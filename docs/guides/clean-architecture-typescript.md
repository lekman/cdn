# Clean Architecture in TypeScript

This guide shows how to implement clean architecture principles in TypeScript, focusing on interface-based dependency injection, the `*.system.ts` naming convention, and constructor-based DI patterns.

**See also**: [Clean Architecture for AI Agents](./agents.clean.arch.md) - Language-agnostic principles

## Target Audience

AI agents refactoring TypeScript/Node.js/Bun projects to improve testability, test coverage, and separation of concerns using clean architecture patterns.

## Problem Statement

TypeScript codebases often mix business logic with system interactions (file I/O, shell execution, network calls, database queries). This creates several issues:

**Testing challenges:**

- Cannot unit test without triggering real system operations
- Tests become slow, flaky, and environment-dependent
- Complex mocking required for every test

**Coverage challenges:**

- Business logic coverage diluted by untestable system calls
- Coverage metrics don't reflect actual code complexity
- Must exclude entire files from coverage, losing visibility into business logic

**Maintenance challenges:**

- System interaction code scattered across many files
- Hard to change system interaction strategy (e.g., switch from child_process to worker_threads)
- Difficult to mock system behavior for testing edge cases

## Solution Pattern

Use **interface-based dependency injection** with a **naming convention** to separate concerns:

1. **Interface** - Define contracts for system operations
2. **System implementation** - Thin wrapper around actual system calls (excluded from coverage)
3. **Mock implementation** - In-memory test doubles
4. **Business logic** - Uses interface, fully testable

### File Naming Convention

**Standard naming pattern:**

- **Interface**: `{domain}-interface.ts` (pure TypeScript types, no .system suffix)
- **System wrapper**: `{domain}.system.ts` (actual system calls, excluded from coverage)
- **Mock**: `tests/mocks/{domain}-mock.ts` (test doubles)
- **Business logic**: Original filename or separate module

**Benefits of `*.system.ts` convention:**

- **Self-documenting** - File name clearly indicates system interaction
- **Simple exclusion** - Single glob pattern (`**/*.system.ts`) in coverage config
- **Scalable** - Works for all future refactorings without config changes
- **Discoverable** - Easy to find all system boundary files

### Folder Organization

**Module-based structure (Recommended):**

Organize related files into feature/module folders:

```typescript
// ✅ GOOD - Module folder with clear separation
src/utils/onepassword/
├── index.ts                    // Public API: re-export public functions
├── cli-interface.ts            // IOnePasswordCLI interface definition
├── cli.system.ts              // System implementation (excluded from coverage)
├── session.ts                  // Business logic: session management
├── resolver.ts                 // Business logic: secret resolution
└── secrets.ts                  // Business logic: secret parsing

tests/mocks/onepassword/
└── cli-mock.ts                // Mock implementation for testing

// Import from module
import { authenticate, readSecret } from '@/utils/onepassword';
```

**Flat structure (Current, but less scalable):**

```typescript
// ⚠️ ACCEPTABLE - Flat structure with prefixes
src/utils/
├── onepassword-cli-interface.ts
├── onepassword-cli.system.ts
├── onepassword-session.ts
├── onepassword-resolver.ts
├── onepassword-secrets.ts
└── onepassword.ts              // Re-exports

tests/mocks/
└── onepassword-cli-mock.ts

// Import with full names
import { authenticate } from '@/utils/onepassword-session';
import { readSecret } from '@/utils/onepassword-resolver';
```

**Benefits of module folders:**

1. **Co-location** - All related code in one directory
2. **Clear boundaries** - Module folder defines public API via `index.ts`
3. **Easier to find** - All onepassword code in `onepassword/` folder
4. **Scales better** - Add new modules without cluttering parent directory
5. **Testability** - Module-level mocks in `tests/mocks/{module}/`
6. **Refactoring** - Move entire module without updating many imports

**When to use each:**

- **Module folders**: 5+ related files, clear domain boundary
- **Flat structure**: 2-3 related files, simple utility functions

**Real-world example transformation:**

```diff
# Before (flat structure)
src/utils/
+ onepassword-cli-interface.ts        (42 lines)
+ onepassword-cli.system.ts          (179 lines)
+ onepassword-session.ts             (254 lines)
+ onepassword-resolver.ts            (331 lines)
+ onepassword-secrets.ts             (187 lines)
+ onepassword.ts                      (15 lines)
  = 1,008 lines across 6 files with "onepassword-" prefix

# After (module structure)
src/utils/op/
+ index.ts                            (275 lines - namespaced public API)
+ cli-interface.ts                    (42 lines)
+ cli.system.ts                      (179 lines)
+ session.ts                         (254 lines)
+ resolver.ts                        (331 lines)
+ secrets.ts                         (187 lines)
  = Same 1,008 lines, better organized

# Import comparison
- import { parseSecretReference, buildSecretReference } from '@/utils/onepassword-secrets';
+ import { Secrets } from '@/utils/op';
+ Secrets.parse('op://...');
+ Secrets.build({ vault: 'Private', item: 'API', field: 'token' });
```

### Clean Namespace API Pattern

**Problem**: Exporting many individual functions creates messy imports and unclear API boundaries.

```typescript
// ❌ BAD - Function-based exports are verbose and unclear
import {
  parseSecretReference,
  buildSecretReference,
  validateSecretReference,
  findSecretReferences,
  extractSecretReferences,
  hasSecretReferences,
  redactSecretReferences,
  isSecretReference,
  getOnePasswordStatus,
  getOnePasswordCLIPath,
  getOnePasswordCLIVersion,
  isOnePasswordCLIAvailable,
  authenticateWithSession,
  readSecretWithSession,
  signOut,
} from "@/utils/op";

// Use functions
const result = parseSecretReference("op://Private/API/token");
const status = await getOnePasswordStatus();
```

**Solution**: Use namespaced classes with static methods for cleaner API.

```typescript
// ✅ GOOD - Namespaced classes provide clear boundaries
import { Secrets, Status, Session } from "@/utils/op";

// Use namespaced methods
const result = Secrets.parse("op://Private/API/token");
const status = await Status.get();
await Session.authenticate();
```

**Implementation pattern:**

<details>
<summary><strong>Step 1: Module files export functions AND classes</strong></summary>

Each module file exports both functions and a namespaced class:

```typescript
// src/utils/op/secrets.ts

// Individual functions (implementation)
export function parseSecretReference(uri: string): ParseResult {
  // Implementation
}

export function buildSecretReference(ref: SecretReference): string {
  // Implementation
}

export function validateSecretReference(ref: SecretReference): ParseResult {
  // Implementation
}

// Namespaced class (public API)
export class Secrets {
  static build = buildSecretReference;
  static extract = extractSecretReferences;
  static find = findSecretReferences;
  static has = hasSecretReferences;
  static is = isSecretReference;
  static parse = parseSecretReference;
  static redact = redactSecretReferences;
  static validate = validateSecretReference;
}
```

**Why both exports?**

- **Functions**: Backward compatibility, tree-shaking optimization
- **Class**: Clean namespace API, better discoverability

</details>

<details>
<summary><strong>Step 2: Index.ts re-exports classes</strong></summary>

The `index.ts` file simply re-exports classes from modules:

```typescript
// src/utils/op/index.ts

// ============================================================================
// Namespaced Class Exports
// ============================================================================

export { Errors } from "./errors.js";
export { Resolver } from "./resolver.js";
export { Secrets } from "./secrets.js";
export { Session } from "./session.js";
export { Setup } from "./setup.js";
export { Status } from "./status.js";

// ============================================================================
// Individual Function Exports (for backward compatibility)
// NOTE: Only applicable if the library is used externally in production, or we are not
// moving to a new major version.
// Always ASK THE USER if they need this unless this is only used inside the
// project itself.
// ============================================================================

export {
  parseSecretReference,
  buildSecretReference,
  validateSecretReference,
  // ... other functions
} from "./secrets.js";

// Export types directly
export type { ParseResult, SecretReference } from "./secrets.js";
export type { OnePasswordStatus } from "./status.js";
export type { AuthResult } from "./session.js";
```

**Benefits of this approach:**

- Classes are defined where implementation lives
- `index.ts` is a simple re-export gateway
- Maintainers see class and functions together in same file
- No mental mapping between file structure and API surface

</details>

<details>
<summary><strong>Step 3: Consumers use namespaced API</strong></summary>

Application code imports and uses namespaced classes:

```typescript
// src/services/config-loader.ts
import { Secrets, Session } from "@/utils/op";

export async function loadSecretConfig(configText: string): Promise<Config> {
  // Check if config contains secrets
  if (!Secrets.has(configText)) {
    return parseConfig(configText);
  }

  // Authenticate if needed
  if (!Session.isValid()) {
    await Session.authenticate();
  }

  // Resolve all secrets in config
  const resolved = await Resolver.resolveInText(configText);

  return parseConfig(resolved.text);
}
```

</details>

**Benefits of namespaced classes:**

1. **Clear organization** - Related functions grouped under logical namespaces
2. **Discoverable API** - IDE autocomplete shows `Secrets.` and lists all secret operations
3. **Self-documenting** - Class name indicates domain (`Secrets`, `Session`, `Status`)
4. **Easier imports** - Import 3 classes instead of 20 functions
5. **Better tree-shaking** - Unused namespaces can be eliminated by bundlers
6. **Consistent naming** - `Secrets.parse()` instead of `parseSecretReference()`
7. **Type safety** - Same TypeScript checking as functions
8. **No runtime overhead** - Static methods compile to function calls

**API comparison:**

| Pattern              | Import Statement                     | Usage                              | Clarity    |
| -------------------- | ------------------------------------ | ---------------------------------- | ---------- |
| Individual functions | `import { parseSecret... } from '.'` | `parseSecretReference('op://...')` | ❌ Verbose |
| Namespaced classes   | `import { Secrets } from '.'`        | `Secrets.parse('op://...')`        | ✅ Clear   |
| Default export       | `import secrets from '.'`            | `secrets.parse('op://...')`        | ⚠️ Opaque  |
| Instance methods     | `const s = new Secrets(); s.parse()` | Creates unnecessary instances      | ❌ Wrong   |

**When to use this pattern:**

- **5+ related functions** - Namespace reduces import clutter
- **Clear domain boundaries** - Functions naturally group by purpose
- **Stable API** - Public API unlikely to change frequently
- **Module folders** - Works best with organized folder structure

**When NOT to use:**

- **1-3 utility functions** - Direct exports are simpler
- **Mixed concerns** - Functions don't group naturally
- **Tree-shakeable critical** - Function-level exports optimize better in some bundlers

**Coverage note**: `index.ts` files with only re-exports should be excluded from coverage:

```toml
# bunfig.toml
[test]
coveragePathIgnorePatterns = [
  "**/*.system.ts",
  "**/index.ts",  # Re-export files have no business logic
]
```

## Step-by-Step Refactoring Process

### Step 1: Identify System Boundaries

Find files that mix business logic with system interactions:

```typescript
// ❌ Mixed concerns - hard to test
export async function processUserData(userId: string): Promise<User> {
  // Business logic
  if (!userId || userId.length < 5) {
    throw new Error("Invalid user ID");
  }

  // System interaction (blocks testing)
  const { stdout } = await execAsync(`curl https://api.example.com/users/${userId}`);
  const rawData = JSON.parse(stdout);

  // Business logic
  return {
    id: rawData.id,
    name: rawData.full_name.toUpperCase(),
    email: rawData.email_address,
    verified: rawData.status === "active",
  };
}
```

**Identify the boundary:**

- **Business logic**: Validation, transformation, business rules
- **System interaction**: HTTP calls, file I/O, process execution, database queries

### Step 2: Define Interface

Create an interface that describes all system operations:

```typescript
// src/services/user-api-interface.ts

/**
 * User API system operations interface
 * Abstracts HTTP calls for testability
 */
export interface IUserAPI {
  /**
   * Fetch user data from remote API
   *
   * @param userId - User identifier
   * @returns Raw user data from API
   * @throws {Error} If API call fails or user not found
   */
  fetchUser(userId: string): Promise<RawUserData>;

  /**
   * Update user data via API
   *
   * @param userId - User identifier
   * @param updates - Fields to update
   * @returns Updated user data
   */
  updateUser(userId: string, updates: Partial<RawUserData>): Promise<RawUserData>;
}

/**
 * Raw API response shape
 */
export interface RawUserData {
  id: string;
  full_name: string;
  email_address: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
}
```

**Interface design guidelines:**

- **One interface per system boundary** (HTTP client, database, file system, etc.)
- **Synchronous when possible** - Use sync methods for file system if business logic needs sync behavior
- **Throw errors** - Don't return error codes; use exceptions for system failures
- **Platform-agnostic** - Abstract away OS-specific details
- **Minimal surface area** - Only expose operations actually needed by business logic

### Step 3: Create System Implementation

Implement the interface with actual system calls in a `*.system.ts` file:

```typescript
// src/services/user-api.system.ts

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { IUserAPI, RawUserData } from "./user-api-interface.js";

const execAsync = promisify(exec);

/**
 * Real User API implementation using curl
 *
 * **Coverage note**: This file uses the .system.ts suffix and is automatically
 * excluded from coverage via glob pattern: **\/*.system.ts
 *
 * This is a thin wrapper with no business logic - all system interaction.
 *
 * @file user-api.system.ts
 */
export class UserAPISystem implements IUserAPI {
  constructor(private baseURL: string = "https://api.example.com") {}

  async fetchUser(userId: string): Promise<RawUserData> {
    try {
      const { stdout } = await execAsync(`curl -s ${this.baseURL}/users/${userId}`);
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(
        `Failed to fetch user ${userId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateUser(userId: string, updates: Partial<RawUserData>): Promise<RawUserData> {
    try {
      const payload = JSON.stringify(updates);
      const { stdout } = await execAsync(
        `curl -s -X PATCH -H "Content-Type: application/json" -d '${payload}' ${this.baseURL}/users/${userId}`
      );
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(
        `Failed to update user ${userId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Singleton instance for convenience
 * Use this in production code
 */
export const defaultUserAPI = new UserAPISystem();
```

**System implementation guidelines:**

- **Keep it thin** - No business logic, only system call wrappers
- **Document exclusion** - Add comment about `*.system.ts` coverage exclusion
- **Provide default instance** - Export singleton for convenience
- **Error translation** - Convert system errors to domain exceptions
- **Configuration via constructor** - Allow dependency injection of config (URLs, paths, etc.)

### Step 4: Create Mock Implementation

Create a test double that implements the interface with in-memory operations:

```typescript
// tests/mocks/user-api-mock.ts

import type { IUserAPI, RawUserData } from "../../src/services/user-api-interface.js";

/**
 * Mock User API for testing
 * No network calls, all operations are in-memory
 */
export class UserAPIMock implements IUserAPI {
  private users = new Map<string, RawUserData>();
  private fetchShouldFail = false;
  private updateShouldFail = false;

  /**
   * Pre-populate mock with user data
   */
  setUser(userId: string, data: RawUserData): void {
    this.users.set(userId, data);
  }

  /**
   * Simulate API failures for error testing
   */
  setFetchShouldFail(fail: boolean): void {
    this.fetchShouldFail = fail;
  }

  setUpdateShouldFail(fail: boolean): void {
    this.updateShouldFail = fail;
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.users.clear();
    this.fetchShouldFail = false;
    this.updateShouldFail = false;
  }

  // IUserAPI implementation

  async fetchUser(userId: string): Promise<RawUserData> {
    if (this.fetchShouldFail) {
      throw new Error("Network error: Connection timeout");
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    return user;
  }

  async updateUser(userId: string, updates: Partial<RawUserData>): Promise<RawUserData> {
    if (this.updateShouldFail) {
      throw new Error("Network error: Server returned 500");
    }

    const existing = this.users.get(userId);
    if (!existing) {
      throw new Error(`User not found: ${userId}`);
    }

    const updated = { ...existing, ...updates };
    this.users.set(userId, updated);
    return updated;
  }
}
```

**Mock implementation guidelines:**

- **Implement full interface** - All methods from system interface
- **In-memory state** - No actual system calls
- **Configuration methods** - Allow tests to control behavior (simulate failures, set data)
- **Realistic behavior** - Throw same errors as real implementation
- **Stateful** - Maintain state across calls within a test

### Step 5: Refactor Business Logic

Update business logic to accept interface parameter with default value:

```typescript
// src/services/user-service.ts

import type { IUserAPI, RawUserData } from "./user-api-interface.js";
import { defaultUserAPI } from "./user-api.system.js";

/**
 * Normalized user model for application use
 */
export interface User {
  id: string;
  name: string;
  email: string;
  verified: boolean;
}

/**
 * Process and normalize user data
 *
 * @param userId - User identifier
 * @param api - User API implementation (defaults to real API)
 * @returns Normalized user object
 * @throws {Error} If user ID invalid or API call fails
 */
export async function processUserData(
  userId: string,
  api: IUserAPI = defaultUserAPI
): Promise<User> {
  // Business logic: Validation
  if (!userId || userId.length < 5) {
    throw new Error("Invalid user ID: must be at least 5 characters");
  }

  // System interaction (delegated to interface)
  const rawData = await api.fetchUser(userId);

  // Business logic: Transformation
  return {
    id: rawData.id,
    name: rawData.full_name.toUpperCase(),
    email: rawData.email_address,
    verified: rawData.status === "active",
  };
}

/**
 * Update user status
 *
 * @param userId - User identifier
 * @param active - Whether user should be active
 * @param api - User API implementation (defaults to real API)
 */
export async function updateUserStatus(
  userId: string,
  active: boolean,
  api: IUserAPI = defaultUserAPI
): Promise<void> {
  // Business logic: Determine status value
  const status: RawUserData["status"] = active ? "active" : "inactive";

  // System interaction (delegated to interface)
  await api.updateUser(userId, { status });
}
```

**Refactoring guidelines:**

- **Add interface parameter last** - With default value for backward compatibility
- **Use interface type** - Not concrete implementation type
- **Keep business logic pure** - All system interaction through interface
- **Maintain public API** - Existing callers work without changes
- **Document parameter** - Explain why interface is injectable

### Step 6: Write Tests

Use mock implementation for fast, deterministic tests:

```typescript
// tests/unit/services/user-service.test.ts

import { describe, expect, it, beforeEach } from "bun:test";
import { UserAPIMock } from "../../mocks/user-api-mock.js";
import { processUserData, updateUserStatus } from "../../../src/services/user-service.js";

describe("User Service", () => {
  let mockAPI: UserAPIMock;

  beforeEach(() => {
    mockAPI = new UserAPIMock();
  });

  describe("processUserData", () => {
    it("should normalize user data from API", async () => {
      // Arrange
      mockAPI.setUser("user-12345", {
        id: "user-12345",
        full_name: "john doe",
        email_address: "john@example.com",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
      });

      // Act
      const user = await processUserData("user-12345", mockAPI);

      // Assert
      expect(user).toEqual({
        id: "user-12345",
        name: "JOHN DOE", // Uppercased
        email: "john@example.com",
        verified: true, // active -> verified
      });
    });

    it("should reject invalid user IDs", async () => {
      // Act & Assert
      await expect(processUserData("123", mockAPI)).rejects.toThrow(
        "Invalid user ID: must be at least 5 characters"
      );
    });

    it("should handle API failures", async () => {
      // Arrange
      mockAPI.setFetchShouldFail(true);

      // Act & Assert
      await expect(processUserData("user-12345", mockAPI)).rejects.toThrow("Network error");
    });

    it("should mark inactive users as unverified", async () => {
      // Arrange
      mockAPI.setUser("user-12345", {
        id: "user-12345",
        full_name: "jane doe",
        email_address: "jane@example.com",
        status: "inactive",
        created_at: "2024-01-01T00:00:00Z",
      });

      // Act
      const user = await processUserData("user-12345", mockAPI);

      // Assert
      expect(user.verified).toBe(false);
    });
  });

  describe("updateUserStatus", () => {
    beforeEach(() => {
      mockAPI.setUser("user-12345", {
        id: "user-12345",
        full_name: "john doe",
        email_address: "john@example.com",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
      });
    });

    it("should activate user", async () => {
      // Act
      await updateUserStatus("user-12345", true, mockAPI);

      // Assert
      const updated = await mockAPI.fetchUser("user-12345");
      expect(updated.status).toBe("active");
    });

    it("should deactivate user", async () => {
      // Act
      await updateUserStatus("user-12345", false, mockAPI);

      // Assert
      const updated = await mockAPI.fetchUser("user-12345");
      expect(updated.status).toBe("inactive");
    });

    it("should handle update failures", async () => {
      // Arrange
      mockAPI.setUpdateShouldFail(true);

      // Act & Assert
      await expect(updateUserStatus("user-12345", true, mockAPI)).rejects.toThrow("Network error");
    });
  });
});
```

**Test guidelines:**

- **No system calls** - Tests run in-memory only
- **Fast execution** - Entire suite should run in seconds
- **Deterministic** - Same inputs always produce same outputs
- **Test business logic** - Focus on validation, transformation, error handling
- **Test error paths** - Use mock configuration to simulate failures

### Step 7: Configure Coverage Exclusion

Add `*.system.ts` pattern to coverage configuration:

<details>
<summary><strong>Bun (bunfig.toml)</strong></summary>

```toml
[test]
coveragePathIgnorePatterns = [
  "**/*.system.ts",      # All system interaction files
  "tests/**",            # Test files
  "**/*.test.ts",        # More test files
  "**/types/**",         # Type definition files
]
```

</details>

<details>
<summary><strong>Jest (jest.config.js)</strong></summary>

```javascript
export default {
  coveragePathIgnorePatterns: [
    ".*\\.system\\.ts$", // All system interaction files
    "/node_modules/",
    "/tests/",
    "\\.test\\.ts$",
  ],
};
```

</details>

<details>
<summary><strong>Vitest (vitest.config.ts)</strong></summary>

```typescript
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/*.system.ts", // All system interaction files
        "tests/**",
        "**/*.test.ts",
        "**/types/**",
      ],
    },
  },
});
```

</details>

<details>
<summary><strong>SonarQube (sonar-project.properties)</strong></summary>

```properties
# Coverage exclusions
sonar.coverage.exclusions=\
  **/*.system.ts,\
  tests/**,\
  **/*.test.ts,\
  **/types/**
```

</details>

## Common Patterns

### Pattern 1: File System Operations

<details>
<summary><strong>File system abstraction example</strong></summary>

**Interface:**

```typescript
// src/utils/filesystem-interface.ts

export interface IFileSystem {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  writeFile(path: string, content: string, encoding: BufferEncoding): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readdir(path: string): Promise<string[]>;
}
```

**System implementation:**

```typescript
// src/utils/filesystem.system.ts

import { readFile, writeFile, access, mkdir, readdir } from "node:fs/promises";
import type { IFileSystem } from "./filesystem-interface.js";

export class FileSystemReal implements IFileSystem {
  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    return readFile(path, encoding);
  }

  async writeFile(path: string, content: string, encoding: BufferEncoding): Promise<void> {
    await writeFile(path, content, encoding);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await mkdir(path, options);
  }

  async readdir(path: string): Promise<string[]> {
    return readdir(path);
  }
}

export const defaultFS = new FileSystemReal();
```

**Mock:**

```typescript
// tests/mocks/filesystem-mock.ts

export class FileSystemMock implements IFileSystem {
  private files = new Map<string, string>();
  private dirs = new Set<string>();

  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  setDir(path: string): void {
    this.dirs.add(path);
  }

  clear(): void {
    this.files.clear();
    this.dirs.clear();
  }

  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    const content = this.files.get(path);
    if (!content) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    return content;
  }

  async writeFile(path: string, content: string, encoding: BufferEncoding): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    this.dirs.add(path);
  }

  async readdir(path: string): Promise<string[]> {
    if (!this.dirs.has(path))
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    return Array.from(this.files.keys()).filter((f) => f.startsWith(path + "/"));
  }
}
```

</details>

### Pattern 2: Shell Command Execution

<details>
<summary><strong>Shell execution abstraction example</strong></summary>

**Interface:**

```typescript
// src/utils/shell-interface.ts

export interface IShellExecutor {
  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  execSync(command: string): { stdout: string; stderr: string; exitCode: number };
  commandExists(command: string): Promise<boolean>;
}
```

**System implementation:**

```typescript
// src/utils/shell.system.ts

import { exec, execSync as nodeExecSync } from "node:child_process";
import { promisify } from "node:util";
import type { IShellExecutor } from "./shell-interface.js";

const execAsync = promisify(exec);

export class ShellExecutorReal implements IShellExecutor {
  async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        exitCode: error.code || 1,
      };
    }
  }

  execSync(command: string): { stdout: string; stderr: string; exitCode: number } {
    try {
      const stdout = nodeExecSync(command, { encoding: "utf-8" });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        exitCode: error.status || 1,
      };
    }
  }

  async commandExists(command: string): Promise<boolean> {
    const result = await this.exec(`command -v ${command}`);
    return result.exitCode === 0;
  }
}

export const defaultShell = new ShellExecutorReal();
```

**Mock:**

```typescript
// tests/mocks/shell-mock.ts

export class ShellExecutorMock implements IShellExecutor {
  private commands = new Map<string, { stdout: string; stderr: string; exitCode: number }>();
  private availableCommands = new Set<string>(["ls", "cat", "grep"]);

  setCommandOutput(command: string, stdout: string, stderr = "", exitCode = 0): void {
    this.commands.set(command, { stdout, stderr, exitCode });
  }

  setCommandExists(command: string, exists: boolean): void {
    if (exists) {
      this.availableCommands.add(command);
    } else {
      this.availableCommands.delete(command);
    }
  }

  clear(): void {
    this.commands.clear();
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const result = this.commands.get(command);
    if (result) return result;

    // Default behavior for unknown commands
    return { stdout: "", stderr: `sh: command not found: ${command}`, exitCode: 127 };
  }

  execSync(command: string): { stdout: string; stderr: string; exitCode: number } {
    return this.exec(command) as any; // Sync version returns same data
  }

  async commandExists(command: string): Promise<boolean> {
    return this.availableCommands.has(command);
  }
}
```

</details>

### Pattern 3: HTTP Client

<details>
<summary><strong>HTTP client abstraction example</strong></summary>

**Interface:**

```typescript
// src/utils/http-interface.ts

export interface IHTTPClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>;
  post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
  put<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
  delete<T>(url: string, headers?: Record<string, string>): Promise<T>;
}
```

**System implementation:**

```typescript
// src/utils/http.system.ts

export class HTTPClientReal implements IHTTPClient {
  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }

  async post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }

  async put<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }

  async delete<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(url, { method: "DELETE", headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }
}

export const defaultHTTP = new HTTPClientReal();
```

**Mock:**

```typescript
// tests/mocks/http-mock.ts

export class HTTPClientMock implements IHTTPClient {
  private routes = new Map<string, any>();
  private shouldFail = false;

  setRoute(method: string, url: string, response: any): void {
    this.routes.set(`${method}:${url}`, response);
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  clear(): void {
    this.routes.clear();
    this.shouldFail = false;
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    if (this.shouldFail) throw new Error("HTTP 500: Internal Server Error");
    const response = this.routes.get(`GET:${url}`);
    if (!response) throw new Error(`HTTP 404: Not Found`);
    return response;
  }

  async post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
    if (this.shouldFail) throw new Error("HTTP 500: Internal Server Error");
    const response = this.routes.get(`POST:${url}`);
    if (!response) throw new Error(`HTTP 404: Not Found`);
    return response;
  }

  async put<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
    if (this.shouldFail) throw new Error("HTTP 500: Internal Server Error");
    const response = this.routes.get(`PUT:${url}`);
    if (!response) throw new Error(`HTTP 404: Not Found`);
    return response;
  }

  async delete<T>(url: string, headers?: Record<string, string>): Promise<T> {
    if (this.shouldFail) throw new Error("HTTP 500: Internal Server Error");
    const response = this.routes.get(`DELETE:${url}`);
    if (!response) throw new Error(`HTTP 404: Not Found`);
    return response;
  }
}
```

</details>

## Benefits Summary

### Testing Benefits

- **Fast tests** - No system calls, all in-memory
- **Deterministic** - Same inputs always produce same outputs
- **Isolated** - No external dependencies
- **Comprehensive** - Easy to test edge cases and error paths
- **No mocking complexity** - Simple mock classes instead of complex spy setups

### Coverage Benefits

- **Accurate metrics** - Coverage reflects business logic complexity
- **Focused exclusions** - Only thin system wrappers excluded
- **Better visibility** - Business logic coverage clearly visible
- **Scalable pattern** - One glob pattern covers all system files

### Maintainability Benefits

- **Clear boundaries** - Business logic vs. system interaction
- **Single responsibility** - System files only do system calls
- **Easy to change** - Swap system implementation without touching business logic
- **Type safety** - Interface contract enforced at compile time
- **Self-documenting** - File naming convention makes architecture clear

## Migration Checklist

When refactoring existing code:

- [ ] Identify file with mixed business logic and system calls
- [ ] Define interface for system operations (`{domain}-interface.ts`)
- [ ] Create system implementation (`{domain}.system.ts`)
- [ ] Create mock implementation (`tests/mocks/{domain}-mock.ts`)
- [ ] Refactor business logic to accept interface parameter
- [ ] Add default parameter for backward compatibility
- [ ] Update tests to use mock implementation
- [ ] Add `**/*.system.ts` to coverage exclusion config
- [ ] Verify all tests pass with mocks
- [ ] Verify production code works with real implementation
- [ ] Remove old file from coverage exclusion list (if it was excluded)
- [ ] Update documentation to explain new architecture

## Anti-Patterns to Avoid

**Don't put business logic in `*.system.ts` files:**

```typescript
// ❌ BAD - Business logic in system file
export class UserAPISystem implements IUserAPI {
  async fetchUser(userId: string): Promise<RawUserData> {
    // Business logic belongs in service layer, not here
    if (!userId || userId.length < 5) {
      throw new Error("Invalid user ID");
    }

    const { stdout } = await execAsync(`curl ${this.baseURL}/users/${userId}`);
    return JSON.parse(stdout);
  }
}
```

```typescript
// ✅ GOOD - Pure system interaction
export class UserAPISystem implements IUserAPI {
  async fetchUser(userId: string): Promise<RawUserData> {
    const { stdout } = await execAsync(`curl ${this.baseURL}/users/${userId}`);
    return JSON.parse(stdout);
  }
}
```

**Don't create overly broad interfaces:**

```typescript
// ❌ BAD - Too many responsibilities
export interface ISystem {
  execCommand(cmd: string): Promise<string>;
  readFile(path: string): Promise<string>;
  httpGet(url: string): Promise<any>;
  queryDatabase(sql: string): Promise<any[]>;
}
```

```typescript
// ✅ GOOD - Focused interfaces
export interface IShellExecutor {
  exec(command: string): Promise<{ stdout: string; stderr: string }>;
}

export interface IFileSystem {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
}

export interface IHTTPClient {
  get<T>(url: string): Promise<T>;
}

export interface IDatabase {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
}
```

**Don't skip the interface:**

```typescript
// ❌ BAD - Direct dependency on concrete class
export async function processUser(userId: string, api: UserAPISystem): Promise<User> {
  // Now can't substitute mock
}
```

```typescript
// ✅ GOOD - Depend on interface
export async function processUser(userId: string, api: IUserAPI): Promise<User> {
  // Can use real or mock implementation
}
```

## Related Documentation

- [Clean Architecture for AI Agents](./agents.clean.arch.md) - Language-agnostic clean architecture principles
- [Task Master AI Integration](./agents.task-master.md) - Project task management
- [GoTask Usage Guide](./agents.gotask.md) - Build automation patterns
- [Markdown Standards](./agents.markdown.md) - Documentation formatting

---

**For AI Agents**: This guide implements clean architecture principles for TypeScript. Use `*.system.ts` naming convention for system interaction files, define interfaces for all external dependencies, and use constructor-based dependency injection for testable code.
