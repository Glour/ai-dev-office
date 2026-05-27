# n8n Adapter Contract

В v1 n8n не разворачивается.

Эта директория описывает контракт будущих n8n workflows, которые смогут использовать агенты.

## Требования к workflow

Каждый workflow должен объявлять:

- стабильный workflow id;
- route type;
- input schema;
- output schema;
- timeout;
- retry policy;
- idempotency key;
- необходимость owner approval;
- artifact outputs;
- формат ошибки.

## Будущее развертывание

Когда появятся реальные утвержденные workflows, нужно добавить:

```text
docker-compose.override.n8n.yml
workflows/n8n/*.json
tools/n8n-adapter/invoke-workflow.sh
```

До этого агенты считают n8n недоступным и используют описанные tool contracts.
