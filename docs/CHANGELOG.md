# Changelog

## [1.6.0](https://github.com/lekman/cdn/compare/cdn-v1.5.0...cdn-v1.6.0) (2026-02-02)


### Features

* **api:** add GET /images/{hash} APIM policy for metadata retrieval ([#7](https://github.com/lekman/cdn/issues/7)) ([1860fff](https://github.com/lekman/cdn/commit/1860ffff75f318b90eb4e27fbada5328a7b0de5d))
* **docs:** enhance architecture and README with detailed flow diagrams and updated content ([fc8c917](https://github.com/lekman/cdn/commit/fc8c91738dae326bce5687b5f71bde6761cb296e))
* **docs:** update architecture diagrams and enhance component descriptions in ARCHITECTURE.md ([49c7aec](https://github.com/lekman/cdn/commit/49c7aec3f0a0a0b3c9a5aec95d315731d0a28fb0))
* **docs:** update EPIC and add implementation roadmap for Edge Cache CDN API ([c735f74](https://github.com/lekman/cdn/commit/c735f7448c72fcf1038a8ecd60000b50cc0b48ea))
* **github-mcp:** add configuration script for GitHub MCP server with 1Password integration ([e9c4fea](https://github.com/lekman/cdn/commit/e9c4feacd7c15f86d6fdd97019077ee83bd0b081))
* **planner:** add unified planning workflow skill with context detection and PRD validation ([46308e3](https://github.com/lekman/cdn/commit/46308e3958e809db98dac96b7199ba32cde37c3b))
* **planner:** create PRD template for structured documentation ([46308e3](https://github.com/lekman/cdn/commit/46308e3958e809db98dac96b7199ba32cde37c3b))
* **refine:** implement skill to transform early requirements into validated PRD ([46308e3](https://github.com/lekman/cdn/commit/46308e3958e809db98dac96b7199ba32cde37c3b))
* **shared:** add shared domain layer (types, interfaces, mocks) ([#3](https://github.com/lekman/cdn/issues/3)) ([b31ba71](https://github.com/lekman/cdn/commit/b31ba71ffe92de5bc6035096dbd34e69a90a13f5))
* **skill:** add 2-phase triage and fix workflow to coderabbit skill ([0887c8c](https://github.com/lekman/cdn/commit/0887c8c4e4aa275954152e386aa966a988c1698a))
* **skill:** add Taskfile development guidelines and best practices ([524b589](https://github.com/lekman/cdn/commit/524b589ba762b915a44efeb234e6748a6c7be88e))
* **swagger-ui:** add Swagger UI page and GitHub Pages deployment ([#17](https://github.com/lekman/cdn/issues/17)) ([1e3a067](https://github.com/lekman/cdn/commit/1e3a06713816f26ad804b1606f358de2735bf1bf))


### Bug Fixes

* **api:** update schema for created property and remove clientCertificate security scheme ([02e0a47](https://github.com/lekman/cdn/commit/02e0a47c230b9585fd472cc62d2ee47d99b74756))
* **ci:** add bootstrap step for Azure consumption plan in CI/CD ([25eb717](https://github.com/lekman/cdn/commit/25eb717a68d0635f363b5cbff2e5ff15e3ac2f4d))
* **ci:** resolve Pulumi resource clash and update semgrep action ([f5b4fe8](https://github.com/lekman/cdn/commit/f5b4fe846c7568b577a36c3751e581cd38b4411d))
* **security:** resolve semgrep findings for SRI, shell injection, and scan config ([070c34a](https://github.com/lekman/cdn/commit/070c34a2dee7863e12993d49bd282aa3bf439359))


### Documentation

* add clean architecture rules and reference guides ([cf7659c](https://github.com/lekman/cdn/commit/cf7659c615f4c46c0ab763a04cd990c9af7054b8))
* add PRD documents with WBS for all EPIC work items ([#2](https://github.com/lekman/cdn/issues/2)) ([e42eb86](https://github.com/lekman/cdn/commit/e42eb863505b359cb771509b4f96735f24ef4ba7))
* add project README with API reference and dev setup ([cc9085f](https://github.com/lekman/cdn/commit/cc9085f978ffa4ba193363f86a47c2d5b00b0787))
* **delete:** add implementation plan for delete pipeline feature ([#14](https://github.com/lekman/cdn/issues/14)) ([655d586](https://github.com/lekman/cdn/commit/655d586f48ec87beb637db0714bfee5b1c4f7891))
* **metadata:** add implementation plan for metadata extraction function ([#12](https://github.com/lekman/cdn/issues/12)) ([a82b21f](https://github.com/lekman/cdn/commit/a82b21f16b0197cb7ac206983c9c760dfa9d162e))
* simplify API section in README to point to Swagger UI ([05737f5](https://github.com/lekman/cdn/commit/05737f5679169cbfe7f4b28f7a274f08f66062a2))
* **skill:** provide guidelines for creating and maintaining Claude Code skill files ([46308e3](https://github.com/lekman/cdn/commit/46308e3958e809db98dac96b7199ba32cde37c3b))
* **swagger-ui:** add PRD for Swagger UI on GitHub Pages ([b30796b](https://github.com/lekman/cdn/commit/b30796b2e21a8b78bc84481c83c8f106d47aa767))

## [1.5.0](https://github.com/lekman/cdn/compare/cdn-v1.4.1...cdn-v1.5.0) (2026-02-02)


### Features

* **planner:** add unified planning workflow skill with context detection and PRD validation ([46308e3](https://github.com/lekman/cdn/commit/46308e3958e809db98dac96b7199ba32cde37c3b))
* **planner:** create PRD template for structured documentation ([46308e3](https://github.com/lekman/cdn/commit/46308e3958e809db98dac96b7199ba32cde37c3b))
* **refine:** implement skill to transform early requirements into validated PRD ([46308e3](https://github.com/lekman/cdn/commit/46308e3958e809db98dac96b7199ba32cde37c3b))
* **swagger-ui:** add Swagger UI page and GitHub Pages deployment ([#17](https://github.com/lekman/cdn/issues/17)) ([1e3a067](https://github.com/lekman/cdn/commit/1e3a06713816f26ad804b1606f358de2735bf1bf))


### Bug Fixes

* **security:** resolve semgrep findings for SRI, shell injection, and scan config ([070c34a](https://github.com/lekman/cdn/commit/070c34a2dee7863e12993d49bd282aa3bf439359))


### Documentation

* **skill:** provide guidelines for creating and maintaining Claude Code skill files ([46308e3](https://github.com/lekman/cdn/commit/46308e3958e809db98dac96b7199ba32cde37c3b))
* **swagger-ui:** add PRD for Swagger UI on GitHub Pages ([b30796b](https://github.com/lekman/cdn/commit/b30796b2e21a8b78bc84481c83c8f106d47aa767))

## [1.4.1](https://github.com/lekman/cdn/compare/cdn-v1.4.0...cdn-v1.4.1) (2026-02-01)


### Documentation

* **delete:** add implementation plan for delete pipeline feature ([#14](https://github.com/lekman/cdn/issues/14)) ([655d586](https://github.com/lekman/cdn/commit/655d586f48ec87beb637db0714bfee5b1c4f7891))

## [1.4.0](https://github.com/lekman/cdn/compare/cdn-v1.3.0...cdn-v1.4.0) (2026-02-01)


### Features

* **api:** add GET /images/{hash} APIM policy for metadata retrieval ([#7](https://github.com/lekman/cdn/issues/7)) ([1860fff](https://github.com/lekman/cdn/commit/1860ffff75f318b90eb4e27fbada5328a7b0de5d))
* **docs:** enhance architecture and README with detailed flow diagrams and updated content ([fc8c917](https://github.com/lekman/cdn/commit/fc8c91738dae326bce5687b5f71bde6761cb296e))
* **docs:** update architecture diagrams and enhance component descriptions in ARCHITECTURE.md ([49c7aec](https://github.com/lekman/cdn/commit/49c7aec3f0a0a0b3c9a5aec95d315731d0a28fb0))
* **docs:** update EPIC and add implementation roadmap for Edge Cache CDN API ([c735f74](https://github.com/lekman/cdn/commit/c735f7448c72fcf1038a8ecd60000b50cc0b48ea))
* **github-mcp:** add configuration script for GitHub MCP server with 1Password integration ([e9c4fea](https://github.com/lekman/cdn/commit/e9c4feacd7c15f86d6fdd97019077ee83bd0b081))
* **shared:** add shared domain layer (types, interfaces, mocks) ([#3](https://github.com/lekman/cdn/issues/3)) ([b31ba71](https://github.com/lekman/cdn/commit/b31ba71ffe92de5bc6035096dbd34e69a90a13f5))
* **skill:** add 2-phase triage and fix workflow to coderabbit skill ([0887c8c](https://github.com/lekman/cdn/commit/0887c8c4e4aa275954152e386aa966a988c1698a))
* **skill:** add Taskfile development guidelines and best practices ([524b589](https://github.com/lekman/cdn/commit/524b589ba762b915a44efeb234e6748a6c7be88e))


### Bug Fixes

* **api:** update schema for created property and remove clientCertificate security scheme ([02e0a47](https://github.com/lekman/cdn/commit/02e0a47c230b9585fd472cc62d2ee47d99b74756))
* **ci:** add bootstrap step for Azure consumption plan in CI/CD ([25eb717](https://github.com/lekman/cdn/commit/25eb717a68d0635f363b5cbff2e5ff15e3ac2f4d))


### Documentation

* add clean architecture rules and reference guides ([cf7659c](https://github.com/lekman/cdn/commit/cf7659c615f4c46c0ab763a04cd990c9af7054b8))
* add PRD documents with WBS for all EPIC work items ([#2](https://github.com/lekman/cdn/issues/2)) ([e42eb86](https://github.com/lekman/cdn/commit/e42eb863505b359cb771509b4f96735f24ef4ba7))
* add project README with API reference and dev setup ([cc9085f](https://github.com/lekman/cdn/commit/cc9085f978ffa4ba193363f86a47c2d5b00b0787))
* **metadata:** add implementation plan for metadata extraction function ([#12](https://github.com/lekman/cdn/issues/12)) ([a82b21f](https://github.com/lekman/cdn/commit/a82b21f16b0197cb7ac206983c9c760dfa9d162e))

## [1.3.0](https://github.com/lekman/cdn/compare/cdn-v1.2.0...cdn-v1.3.0) (2026-02-01)


### Features

* **github-mcp:** add configuration script for GitHub MCP server with 1Password integration ([e9c4fea](https://github.com/lekman/cdn/commit/e9c4feacd7c15f86d6fdd97019077ee83bd0b081))
* **skill:** add 2-phase triage and fix workflow to coderabbit skill ([0887c8c](https://github.com/lekman/cdn/commit/0887c8c4e4aa275954152e386aa966a988c1698a))
* **skill:** add Taskfile development guidelines and best practices ([524b589](https://github.com/lekman/cdn/commit/524b589ba762b915a44efeb234e6748a6c7be88e))


### Bug Fixes

* **ci:** add bootstrap step for Azure consumption plan in CI/CD ([25eb717](https://github.com/lekman/cdn/commit/25eb717a68d0635f363b5cbff2e5ff15e3ac2f4d))

## [1.2.0](https://github.com/lekman/cdn/compare/cdn-v1.1.0...cdn-v1.2.0) (2026-02-01)


### Features

* **api:** add GET /images/{hash} APIM policy for metadata retrieval ([#7](https://github.com/lekman/cdn/issues/7)) ([1860fff](https://github.com/lekman/cdn/commit/1860ffff75f318b90eb4e27fbada5328a7b0de5d))

## [1.1.0](https://github.com/lekman/cdn/compare/cdn-v1.0.0...cdn-v1.1.0) (2026-02-01)


### Features

* **docs:** enhance architecture and README with detailed flow diagrams and updated content ([fc8c917](https://github.com/lekman/cdn/commit/fc8c91738dae326bce5687b5f71bde6761cb296e))
* **docs:** update architecture diagrams and enhance component descriptions in ARCHITECTURE.md ([49c7aec](https://github.com/lekman/cdn/commit/49c7aec3f0a0a0b3c9a5aec95d315731d0a28fb0))


### Bug Fixes

* **api:** update schema for created property and remove clientCertificate security scheme ([02e0a47](https://github.com/lekman/cdn/commit/02e0a47c230b9585fd472cc62d2ee47d99b74756))

## 1.0.0 (2026-02-01)


### Features

* **docs:** update EPIC and add implementation roadmap for Edge Cache CDN API ([c735f74](https://github.com/lekman/cdn/commit/c735f7448c72fcf1038a8ecd60000b50cc0b48ea))
* **shared:** add shared domain layer (types, interfaces, mocks) ([#3](https://github.com/lekman/cdn/issues/3)) ([b31ba71](https://github.com/lekman/cdn/commit/b31ba71ffe92de5bc6035096dbd34e69a90a13f5))


### Documentation

* add clean architecture rules and reference guides ([cf7659c](https://github.com/lekman/cdn/commit/cf7659c615f4c46c0ab763a04cd990c9af7054b8))
* add PRD documents with WBS for all EPIC work items ([#2](https://github.com/lekman/cdn/issues/2)) ([e42eb86](https://github.com/lekman/cdn/commit/e42eb863505b359cb771509b4f96735f24ef4ba7))
* add project README with API reference and dev setup ([cc9085f](https://github.com/lekman/cdn/commit/cc9085f978ffa4ba193363f86a47c2d5b00b0787))
