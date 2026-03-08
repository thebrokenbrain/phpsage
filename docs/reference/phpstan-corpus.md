# Corpus PHPStan para RAG

## Qué es

El directorio `docs/phpstan/` contiene un corpus de más de **1.000 documentos en Markdown** que describen los errores que PHPStan puede reportar. Cada documento corresponde a un tipo de error identificado por su código (por ejemplo, `argument.type`, `class.notFound`, `return.type`).

Este corpus es la base del sistema RAG (Retrieval-Augmented Generation) de PHPSage. Cuando un usuario pide una explicación o una sugerencia de fix para un issue, el sistema busca en este corpus los fragmentos más relevantes y los incluye como contexto en la consulta al modelo de IA.

La fuente principal de estos documentos es la documentación oficial de errores de PHPStan, publicada en GitHub: [phpstan/phpstan/tree/2.2.x/website/errors](https://github.com/phpstan/phpstan/tree/2.2.x/website/errors).

## Estructura de cada documento

Todos los documentos siguen un formato consistente:

### Front matter

```yaml
---
title: "nombre-del-error"
ignorable: true
---
```

### Secciones

1. **Ejemplo de código**: un snippet PHP que reproduce el error.
2. **Por qué se reporta**: explicación de por qué PHPStan marca este código como problemático.
3. **Cómo corregirlo**: una o varias soluciones con diffs de ejemplo.

## Ejemplo: `argument.type`

Un archivo como `docs/phpstan/argument.type.md` documenta el error que ocurre cuando se pasa un argumento de un tipo incorrecto a una función o método. Incluye:

- Un ejemplo PHP con un argumento `string` donde se espera `int`.
- Explicación de por qué PHPStan lo detecta.
- Correcciones sugeridas: cambiar el tipo del argumento, hacer casting, o modificar la declaración de la función.

## Categorías principales

Los documentos cubren una amplia variedad de errores, organizados por prefijo:

| Prefijo | Área |
|---|---|
| `argument.*` | Validación de argumentos |
| `class.*`, `interface.*`, `trait.*` | Clases, interfaces, traits |
| `method.*`, `staticMethod.*` | Métodos de instancia y estáticos |
| `property.*`, `staticProperty.*` | Propiedades de instancia y estáticas |
| `return.*` | Tipos de retorno |
| `function.*` | Funciones |
| `cast.*` | Conversiones de tipo |
| `array.*`, `offsetAccess.*` | Arrays y acceso por índice |
| `closure.*`, `callable.*` | Closures y callables |
| `enum.*` | Enumeraciones PHP 8.1+ |
| `generics.*` | Tipos genéricos |
| `doctrine.*` | Errores específicos de Doctrine ORM |
| `symfony.*` | Errores específicos de Symfony |

## Cómo se usa en PHPSage

### Ingesta

Antes de que el RAG funcione, el corpus debe ser ingestado. Esto se puede hacer:

- **Automáticamente** al arrancar el servidor (si `AI_RAG_AUTO_INGEST_ON_BOOT=true`).
- **Desde la CLI**: `phpsage rag ingest`.
- **Desde la API**: `POST /api/ai/ingest`.

### Recuperación

Cuando se consulta explain o suggest-fix:

1. El sistema identifica el tipo de error del issue.
2. Busca en el corpus los fragmentos más relevantes.
3. Los incluye como contexto adicional en el prompt al LLM.

El número de fragmentos recuperados se configura con `AI_RAG_TOP_K` (por defecto 3).

### Backends

| Backend | Cómo busca | Configuración |
|---|---|---|
| Filesystem | Coincidencia de identificadores | `AI_RAG_BACKEND=filesystem` |
| Qdrant | Búsqueda semántica vectorial | `AI_RAG_BACKEND=qdrant` |
