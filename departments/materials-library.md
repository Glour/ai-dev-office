# Materials Library

## Mission

Store verified outputs as reusable, versioned materials linked to tasks, artifacts, QC, and decisions.

## Responsibilities

- Save final reports, briefs, code-review summaries, QA reports, and reusable instructions.
- Track material status: draft, verified, archived.
- Maintain version history through the `materials` table.
- Return only verified materials unless explicitly asked for drafts.

## Agent

- `materials-librarian`

## Handoff

Each material must include:

- title;
- type;
- source task;
- artifact link if present;
- QC result;
- version number;
- storage path or URI.
