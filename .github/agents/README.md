# `.github/agents/` (fleet-mode sub-agent definitions)

This folder defines the GitHub Copilot CLI fleet-mode sub-agents. The orchestrator (`scripts/iterate.ts`) reads from here, then spawns sub-agents with the listed model, scope, context allow-list, and tool allow-list.

The real definitions land in `p3-subagents`. This README sketches the shape.

Each agent gets one Markdown file. The frontmatter pins the model, the scope, the context allow-list, and the tools. The body is the system prompt.

```
---
name: redline-generator-iterator
model: gpt-5-mini
scope: agents/redline-generator
context_allowlist:
  - agents/redline-generator/**
  - specs/001-eval-protocol/SPEC.md
  - eval-reports/round-NNN/per-agent/redline-generator/**
tool_allowlist:
  - read_file
  - edit_file
  - pnpm gen:few-shot
out_of_scope:
  - datasets/cases/**
  - "*.age"
  - datasets/policy-corpus/oracle/**
---
```

The orchestrator refuses to spawn an agent whose `scope` overlaps with another agent's scope or whose `context_allowlist` includes any prohibited path.
