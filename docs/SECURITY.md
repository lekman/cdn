# Security

Security policy for @lekman/cdn. This API handles image uploads, serves content via CDN, and stores metadata. It processes authentication credentials (mTLS + subscription keys) and connects to external services (Azure, Cloudflare).

## Reporting a Vulnerability

### Do Not Create a Public Issue

Security vulnerabilities should never be reported through public GitHub issues.

### Report Privately

Use [GitHub Security Advisories](https://github.com/lekman/cdn/security/advisories) to create a private advisory.

Include:

- Type of vulnerability
- Affected component (APIM policy, Function, infrastructure)
- Steps to reproduce
- Impact assessment

### Response Timeline

| Severity | Response | Resolution Target |
| -------- | -------- | ----------------- |
| Critical | 24 hours | 7 days |
| High | 48 hours | 14 days |
| Medium | 5 business days | 30 days |
| Low | 10 business days | 60 days |

## Security Design Practices

1. **Content-addressed storage** — images keyed by SHA-256 hash; no user-controlled paths or filenames
2. **mTLS + subscription key** — dual-layer authentication at the APIM gateway
3. **Managed identity** — Azure Functions use managed identity for storage/Cosmos/Service Bus access
4. **Key Vault for secrets** — Cloudflare API token stored in Azure Key Vault, never in code
5. **Immutable content** — no update operations; content at a hash never changes
6. **7-day TTL** — automatic data expiry via Blob lifecycle policy and Cosmos document TTL
7. **Shift-left scanning** — Semgrep runs in CI on every PR (`p/security-audit`, `p/secrets`, `p/typescript`)
8. **No `console.log` in production** — enforced by Semgrep custom rule to prevent accidental data leaks

## CIA Triad

### Confidentiality

**Goal:** Image content is publicly accessible via CDN by design. API access is restricted to authenticated clients.

| Control | Implementation |
| ------- | -------------- |
| mTLS authentication | Client certificate validation at APIM gateway |
| Subscription key | `Ocp-Apim-Subscription-Key` header required |
| No credential exposure | Managed identity for Azure services; Key Vault for Cloudflare token |
| No secrets in code | Enforced by Semgrep (`no-secrets-in-code`, `no-hardcoded-credentials`) |

### Integrity

**Goal:** Uploaded images are stored unmodified. Content-addressing guarantees hash-content binding.

| Control | Implementation |
| ------- | -------------- |
| SHA-256 hash verification | Content hash computed at upload; blob stored at `/{hash}` |
| Immutable content | No update operations; re-upload returns existing document |
| Cache-Control immutable | Cloudflare serves `Cache-Control: public, max-age=604800, immutable` |
| Pre-commit hooks | Lint and typecheck run before every commit |
| CI quality gate | All checks must pass before merge to `main` |

### Availability

**Goal:** CDN serves cached images at the edge with 99.9% availability. API availability follows Azure SLA.

| Control | Implementation |
| ------- | -------------- |
| Cloudflare edge caching | Cache hit serves content without origin pull |
| Azure managed services | Blob, Cosmos, Service Bus, Functions — all PaaS with SLAs |
| Consumption plan | Functions scale to zero and auto-scale on demand |
| 7-day TTL | Automatic cleanup prevents unbounded storage growth |

## STRIDE Threat Model

| Threat | Applies? | Mitigation |
| ------ | -------- | ---------- |
| **Spoofing** | Medium | mTLS + subscription key dual authentication. Certificate validation at APIM. |
| **Tampering** | Low | Content-addressed storage — modifying blob content would change the hash. Immutable cache headers. |
| **Repudiation** | Low | APIM access logs and Azure Monitor for audit trail. |
| **Information Disclosure** | Low | Images are public by design (CDN). Metadata access requires authentication. No PII in metadata beyond optional EXIF GPS. |
| **Denial of Service** | Medium | APIM rate limiting. 25MB request size limit. Consumption plan auto-scaling. |
| **Elevation of Privilege** | Low | No user roles or permissions beyond authenticated/unauthenticated. Functions use least-privilege managed identity. |

## Dependency Security

| Tool | Purpose | Configuration |
| ---- | ------- | ------------- |
| Semgrep | Static analysis in CI | `p/security-audit`, `p/secrets`, `p/typescript` rulesets |
| Dependabot | Automated dependency updates | Weekly npm and GitHub Actions updates |
| CodeRabbit | Automated PR review | Biome, Semgrep, Gitleaks, Markdownlint checks |

Custom Semgrep rules (`.semgrep.yml`):

- `no-secrets-in-code` — detect passwords and API keys
- `no-hardcoded-credentials` — detect hardcoded credentials
- `no-console-log-in-production` — warn on `console.log`

## Network Boundaries

| Boundary | Source | Destination | Protocol | Auth |
| -------- | ------ | ----------- | -------- | ---- |
| Client → APIM | External | api.lekman.com | HTTPS + mTLS | Client cert + subscription key |
| Browser → CDN | External | img.lekman.com | HTTPS | None (public) |
| APIM → Blob | Internal | Storage account | HTTPS | Managed identity / SAS |
| APIM → Cosmos | Internal | Cosmos account | HTTPS | Managed identity |
| APIM → Service Bus | Internal | Service Bus namespace | HTTPS | Managed identity |
| APIM → Function | Internal | Function App | HTTPS | Function key |
| Function → Blob | Internal | Storage account | HTTPS | Managed identity |
| Function → Cosmos | Internal | Cosmos account | HTTPS | Managed identity |
| Function → Cloudflare | External | api.cloudflare.com | HTTPS | Bearer token (Key Vault) |
| Function → Key Vault | Internal | Key Vault | HTTPS | Managed identity |
| CDN → Blob | External | Storage account | HTTPS | Public blob access |

## Secrets Management

CI/CD secrets managed through GitHub repository secrets:

| Secret | Purpose |
| ------ | ------- |
| `CODECOV_TOKEN` | Coverage upload to Codecov |
| `RELEASE_BOT_APP_ID` | GitHub App for release automation |
| `RELEASE_BOT_PRIVATE_KEY` | GitHub App private key (PEM) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code agent authentication |

Runtime secrets managed through Azure Key Vault:

| Secret | Purpose |
| ------ | ------- |
| Cloudflare API token | Cache purge operations in Delete Function |

No secrets appear in code. Semgrep enforces this in CI.
