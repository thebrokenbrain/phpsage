# Inicio rápido

Esta guía explica cómo levantar PHPSage en local y lanzar tu primer análisis.

## Requisitos

- Docker Desktop
- Docker Compose v2
- Make

No necesitas instalar Node.js ni ninguna dependencia del proyecto en tu máquina. Todo se ejecuta dentro de contenedores Docker.

## Levantar PHPSage

Desde la raíz del repositorio:

```bash
make local/up
```

Este comando:

1. Crea un archivo `.env` a partir de `.env.example` si todavía no existe.
2. Construye las imágenes Docker necesarias.
3. Arranca el stack local en segundo plano.

Una vez levantado, los servicios están disponibles en:

| Servicio | URL |
|---|---|
| Interfaz web | `http://localhost:5173` |
| API HTTP | `http://localhost:8080` |
| Swagger UI | `http://localhost:8081` |
| Qdrant (vectorial) | `http://localhost:6333` |
| Ollama (IA local) | `http://localhost:11434` |

## Ejecutar PHPSage desde Docker

La CLI de PHPSage se ejecuta a través del contenedor `phpsage-cli`. El patrón general es:

```bash
docker compose run --rm --build phpsage-cli phpsage <comando>
```

Por ejemplo, para lanzar un análisis sobre el proyecto de ejemplo:

```bash
docker compose run --rm --build phpsage-cli phpsage phpstan analyse /workspace/examples/php-sample --docker --no-open
```

## Verificar que funciona

Puedes comprobar que el servidor está levantado con:

```bash
curl http://localhost:8080/healthz
```

Y verificar el estado de la integración con IA:

```bash
curl http://localhost:8080/api/ai/health
```

## Siguiente paso

Una vez que el stack está levantado, puedes [ejecutar tu primer análisis](run-analysis.md).
