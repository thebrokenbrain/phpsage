# PHPSage

**Análisis estático de PHP enriquecido con contexto, navegación e IA.**

---

## Qué es PHPSage

PHPSage es una herramienta web para desarrolladores PHP que toma la salida de [PHPStan](https://phpstan.org/) y la transforma en una experiencia de análisis más útil, navegable y accionable.

En lugar de trabajar directamente con la salida en texto plano de PHPStan, PHPSage ofrece:

- una **interfaz web** para navegar por los resultados del análisis, los archivos afectados y el código fuente.
- una **capa de IA opcional** que explica cada issue detectada y propone correcciones concretas.
- un **sistema RAG** (Retrieval-Augmented Generation) que enriquece las respuestas del modelo con documentación específica de errores PHPStan.
- una **CLI** para lanzar análisis y gestionar la ingesta de documentación.
- una **API HTTP** que gestiona el ciclo de vida de los análisis y expone las funcionalidades de IA.

## Para quién está hecho

PHPSage está orientado a:

- **desarrolladores PHP** que usan PHPStan y quieren entender mejor sus resultados sin depender solo de la lectura directa del output del comando.
- **equipos de desarrollo** que quieren una vista centralizada y navegable de los problemas detectados en su código.
- **revisores técnicos y profesores** que necesitan evaluar la calidad de un proyecto PHP de forma rápida.
- **cualquier persona** que quiera explorar cómo combinar análisis estático con asistencia de IA en un proyecto real.

## Cómo empezar

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **Primeros pasos**

    ---

    Levanta PHPSage en local con Docker y lanza tu primer análisis.

    [:octicons-arrow-right-24: Inicio rápido](getting-started/index.md)

-   :material-open-in-new:{ .lg .middle } **Demo**

    ---

    Accede a la instancia desplegada en `https://phpsage.nopingnogain.com`. El acceso está protegido con Cloudflare Zero Trust por OTP y debes indicar el correo `mouredev@gmail.com`, que es donde llegará el código de acceso.

    [:octicons-arrow-right-24: Ver demo](getting-started/demo.md)

-   :material-magnify:{ .lg .middle } **Qué es PHPSage**

    ---

    Entiende qué problema resuelve y qué aporta sobre PHPStan.

    [:octicons-arrow-right-24: Visión general](project-overview/index.md)

-   :material-layers-outline:{ .lg .middle } **Arquitectura**

    ---

    Conoce cómo está organizado el monorepo y sus piezas principales.

    [:octicons-arrow-right-24: Arquitectura](architecture/index.md)

-   :material-api:{ .lg .middle } **API**

    ---

    Consulta el contrato funcional de la API HTTP.

    [:octicons-arrow-right-24: Contrato API](api/index.md)

</div>
