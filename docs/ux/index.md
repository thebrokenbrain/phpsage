# Comportamiento UX

Contrato de experiencia de usuario para la implementación actual de la interfaz web de PHPSage.

## Vistas principales

La aplicación web tiene tres vistas principales:

- **Dashboard**: vista de gestión de runs y exploración de resultados
- **Insights**: estadísticas y distribución de errores
- **Issue**: vista detallada de un issue con asistencia IA

La navegación y el estado se sincronizan con la URL donde es relevante.

## Dashboard

El Dashboard es la vista principal y ofrece:

### Lista de runs

- Lista de runs con selección y highlighting del run activo.
- Posibilidad de iniciar un nuevo análisis desde la UI (campo de target path con `POST /api/runs/start` y `execute=true`).
- Helpers de target: presets, enter-to-run, reset, prefill desde el run seleccionado.

### Panel de detalle del run

Cuando se selecciona un run, el panel muestra:

- Estado y timestamps del run.
- **Logs**: salida del análisis de PHPStan con filtros locales.
- **Issues**: lista de issues detectados con filtros.
- **Source preview**: vista previa del código fuente de los archivos afectados.
- **Files navigator**: árbol de archivos del directorio analizado con contadores de issues.

### Funcionalidades adicionales

- **Live polling**: actualización automática mientras el run seleccionado está en estado `running`.
- **Auto-run**: controles para ejecución automática con intervalo configurable.
- **AI status**: indicador del estado de la IA (ON/OFF, proveedor y modelo activo).
- **Ingest jobs**: panel de jobs de ingesta recientes con filtros, estado y detalle expandible.

## Insights

La vista Insights muestra estadísticas del run seleccionado:

### KPIs

- Total de issues
- Identificadores únicos
- Identificador más frecuente
- Cobertura de identificadores conocidos

### Visualizaciones

- Barras horizontales con la distribución por identificador.
- Gráfico donut con el porcentaje de los 5 identificadores más comunes.
- Lista de identificadores con enlaces a la documentación de PHPStan cuando el identificador es conocido.

## Issue

La vista Issue se activa al seleccionar un issue concreto y muestra:

### Contexto del issue

- Archivo y línea afectada.
- Navegación al código fuente con highlighting de la línea del issue.

### Panel de asistencia IA

Vinculado al issue activo, ofrece:

- **Explain**: explicación generada por IA del error.
- **Suggest Fix**: diff propuesto por IA para corregir el error, renderizado de forma legible.
- **Fallback messaging**: cuando no se puede generar un parche seguro, se muestra el motivo del rechazo.

## Panel lateral

El panel lateral de la aplicación incluye:

- **Project Files**: header con chip del nombre del proyecto.
- **Runs**: sección con cards simplificadas de cada run.
- **Files**: árbol de archivos con badges de issues por archivo.

El panel es redimensionable por el usuario.

## Debug de IA

Cuando el backend tiene activado `AI_DEBUG_LLM_IO=true` y hay payload de debug disponible:

- Aparece un toggle **Debug LLM I/O** en el panel de AI Assist.
- El panel de debug muestra: estrategia, endpoint, system prompt, user prompt y request body.
- La respuesta cruda del proveedor no se muestra en la UI por diseño.

## Principios UX

- Feedback operativo rápido para runs activos.
- Visibilidad clara del estado del sistema (running/finished, errores, estado de IA).
- Mínima fricción para relanzar análisis.
- Comportamiento conservador en parches de IA: mejor no mostrar un fix que mostrar uno defectuoso.
