# Scripts auxiliares

El directorio `scripts/` contiene scripts de automatización y validación.

## Referencia

| Script | Descripción |
|---|---|
| `phpsage.sh` | Script principal de PHPSage. Wrapper para la CLI. |
| `phpstan.sh` | Ejecutor de PHPStan dentro del entorno Docker. |
| `deploy-server.sh` | Despliegue de la aplicación en el servidor remoto por SSH. Usado internamente por `make deploy/app`. |
| `reindex-rag.sh` | Reindexado del corpus RAG. Invoca el endpoint de ingesta contra la API local. |
| `smoke-no-ai.sh` | Smoke test del sistema sin proveedores de IA. Valida que la navegación y la API funcionan sin IA. |
| `smoke-ollama.sh` | Smoke test con Ollama como proveedor de IA. |
| `smoke-openai.sh` | Smoke test con OpenAI como proveedor de IA. |

## Uso de scripts npm

El `package.json` raíz también define scripts útiles:

| Script | Comando | Descripción |
|---|---|---|
| `build` | `npm run build` | Compila todos los workspaces con TypeScript. |
| `test` | `npm test` | Compila y ejecuta todos los tests. |
| `clean` | `npm run clean` | Elimina los directorios `dist/` de todos los workspaces. |
| `rag:reindex` | `npm run rag:reindex` | Ejecuta la ingesta del corpus RAG. |
| `rag:reindex:wait` | `npm run rag:reindex:wait` | Ejecuta la ingesta del corpus RAG y espera a que termine. |
