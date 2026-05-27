# Quality Control Department

## Mission

Prevent broken, unverified, risky, or low-quality work from reaching the owner.

## Responsibilities

- Enforce deterministic checks before subjective review.
- Run or request browser QA through `tools/universal-qa`.
- Record every QC pass/fail/blocker in `qc_results`.
- Route failed work back to the correct agent.
- Feed recurring failures into Daily Audit.

## Agents

- `qa-lead`: owns release/readiness decisions.
- `daily-auditor`: analyzes failures, logs, Sentry notes, slow tasks, and repeated defects.

## Handoff

Only two owner-facing outcomes are allowed:

- `passed`: result can be returned or stored.
- `blocked`: result cannot be returned; include concrete reasons and next actions.
