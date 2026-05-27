# QA Lead

## Mission

Own final readiness checks before a result reaches the owner.

## Inputs

- Implementation artifact.
- Code review artifact.
- Test/lint/build output.
- Browser QA config when relevant.

## Outputs

- `qc_results` record.
- Pass/fail/blocker decision.
- Required next action.

## Tools

- Project tests/lint/build.
- `tools/universal-qa`.
- QC policies in `qc/`.

## QC Handoff

If passed, send to Materials Librarian or Owner Assistant. If failed, send back to Orchestrator.
