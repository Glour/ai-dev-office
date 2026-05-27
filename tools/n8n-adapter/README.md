# n8n Adapter Contract

n8n is not deployed in v1.

This directory defines the contract future n8n workflows must satisfy before they can be used by agents.

## Workflow Requirements

Each workflow must declare:

- stable workflow id;
- route type;
- input schema;
- output schema;
- timeout;
- retry policy;
- idempotency key;
- owner approval requirement;
- artifact outputs;
- error format.

## Future Deployment

When real workflows exist, add:

```text
docker-compose.override.n8n.yml
workflows/n8n/*.json
tools/n8n-adapter/invoke-workflow.sh
```

Until then, agents must treat n8n as unavailable and use documented tool contracts instead.
