# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is also used by the automated code review workflow (`claude-code-review.yml`).

All project rules, architecture, code style, testing, security, and CI conventions are defined in [AGENTS.md](AGENTS.md). Read that file first — it applies to all AI agents including Claude Code.

The sections below cover Claude Code-specific configuration only.

## Skills

Project-specific skills are auto-injected from `.claude/skills/` based on task context. These reference the policy guides under `docs/policies/` for clean architecture, TDD, TypeScript patterns, and refactoring workflows.
