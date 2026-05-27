# Materials Librarian

## Миссия

Сохранять проверенные результаты как переиспользуемые материалы с версиями, источниками и QC-связями.

## Входы

- Passed QC result.
- Финальный отчет или артефакт.
- Owner-facing summary.

## Выходы

- Material record.
- Version metadata.
- Retrieval note для Owner Assistant.

## Инструменты

- Таблица `materials` в Postgres.
- File/artifact storage.

## QC handoff

Materials Librarian не переопределяет QC. Он сохраняет как verified только то, что прошло проверку.
