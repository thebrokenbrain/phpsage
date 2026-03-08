# Ejecutar un análisis

Con el stack local levantado (`make local/up`), puedes lanzar un análisis de PHPStan a través de la CLI de PHPSage.

## Lanzar un análisis sobre el proyecto de ejemplo

El repositorio incluye un proyecto PHP de ejemplo en `examples/php-sample/` con errores intencionales para demostrar el funcionamiento de PHPSage.

```bash
docker compose run --rm --build phpsage-cli phpsage phpstan analyse /workspace/examples/php-sample --docker --no-open
```

Este comando:

1. Construye y ejecuta el contenedor de la CLI de PHPSage.
2. Ejecuta PHPStan sobre el directorio `/workspace/examples/php-sample`.
3. Envía los resultados al servidor, que persiste el run.
4. El flag `--docker` indica que se ejecuta dentro del entorno Docker.
5. El flag `--no-open` evita intentar abrir el navegador automáticamente.

## Ver los resultados

Una vez completado el análisis, abre la interfaz web en `http://localhost:5173`. Verás:

- El run recién creado en la lista de runs del Dashboard.
- Los issues detectados por PHPStan, agrupados por archivo.
- Acceso al código fuente de cada archivo afectado.
- Si la IA está activa, la posibilidad de pedir explicaciones o sugerencias de fix para cada issue.

## Lanzar un análisis desde la UI

También puedes iniciar un análisis directamente desde la interfaz web:

1. En el Dashboard, localiza el campo de target path.
2. Escribe la ruta del directorio a analizar (por ejemplo, `/workspace/examples/php-sample`).
3. Pulsa Enter o el botón de ejecución.

El análisis se ejecuta en el servidor y la UI se actualiza en vivo con los logs y resultados.

## El proyecto de ejemplo

El proyecto en `examples/php-sample/` es una pequeña aplicación PHP con arquitectura hexagonal que incluye errores intencionales. Contiene:

- Entidades de dominio (`User`, `Address`)
- Servicios de aplicación (`RegisterUserService`)
- Un controlador HTTP (`UserController`)
- Interfaces/puertos (`UserRepository`, `Mailer`)
- Implementaciones de infraestructura (`InMemoryUserRepository`, `ArrayMailer`)
- Un archivo con errores deliberados (`Broken.php`)

Esto permite ver cómo PHPSage presenta los errores de PHPStan y cómo funcionan las funcionalidades de navegación e IA.
