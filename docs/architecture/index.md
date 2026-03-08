# Arquitectura

## Visión general

PHPSage está organizado como un **monorepo TypeScript** gestionado con npm workspaces. Los componentes del producto (CLI, servidor, web y paquetes compartidos) conviven en el mismo repositorio. Además, el repositorio incluye automatización de despliegue y documentación para la demo pública.

```mermaid
flowchart TB
    subgraph Monorepo
        CLI["CLI<br/>apps/cli/"]
        Server["Server API<br/>apps/server/"]
        Web["Web UI<br/>apps/web/"]
        Shared["Shared<br/>packages/shared/"]
    end

    subgraph Externos
        PHPStan["PHPStan"]
        Ollama["Ollama"]
        OpenAI["OpenAI"]
        Qdrant["Qdrant"]
    end

    CLI --> Server
    Web --> Server
    CLI --> Shared
    Server --> Shared
    Web --> Shared
    CLI --> PHPStan
    Server --> Ollama
    Server --> OpenAI
    Server --> Qdrant
```

## Arquitectura interna del servidor

El servidor sigue una arquitectura limpia (Clean Architecture) con separación estricta de capas:

| Capa | Directorio | Responsabilidad |
|---|---|---|
| **Domain** | `src/domain/` | Reglas de negocio puras. Modelo `Run`. |
| **Application** | `src/application/` | Casos de uso y definición de puertos. Servicios de IA (explain, suggest-fix, ingest, RAG context). |
| **Infrastructure** | `src/infrastructure/` | Adaptadores concretos: repositorios en filesystem, clientes LLM (Ollama, OpenAI), almacén vectorial (Qdrant), patch guard. |
| **Interfaces** | `src/interfaces/` | Servidor HTTP. Orquesta los casos de uso sin contener lógica de dominio. |

La **regla de dependencia** apunta siempre hacia dentro: las capas externas dependen de las internas, pero nunca al revés. Las capas internas definen puertos (interfaces) que las capas externas implementan.

```mermaid
flowchart LR
    Interfaces --> Application
    Infrastructure --> Application
    Application --> Domain
```

## Flujo de un análisis completo

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant PHPStan
    participant Server
    participant LLM
    participant RAG

    User->>CLI: phpsage phpstan analyse <path>
    CLI->>Server: POST /api/runs/start
    Server-->>CLI: runId
    CLI->>PHPStan: Ejecutar análisis
    PHPStan-->>CLI: Resultados JSON
    CLI->>Server: POST /api/runs/:runId/log (streaming)
    CLI->>Server: POST /api/runs/:runId/finish (issues)
    User->>Server: GET /api/ai/explain (issue)
    Server->>RAG: Recuperar contexto
    RAG-->>Server: Fragmentos relevantes
    Server->>LLM: Prompt + contexto
    LLM-->>Server: Explicación
    Server-->>User: Respuesta enriquecida
```

## Principios de diseño

Los principios operativos del proyecto están documentados en `AGENTS.md`:

- **Iteraciones cortas** con resultados verificables.
- **WIP máximo**: una iteración activa a la vez.
- **Corrección observable primero**, refinamientos después.
- **Simplicidad**: evitar complejidad accidental.
- **Documentación sincronizada**: cada cambio funcional, de API o de UX se documenta en la misma iteración.
