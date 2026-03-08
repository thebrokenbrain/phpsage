# Qué es PHPStan

## Análisis estático en PHP

El análisis estático es una técnica que examina el código fuente **sin ejecutarlo**. En lugar de correr el programa y esperar a que fallen las cosas en tiempo de ejecución, una herramienta de análisis estático lee el código y detecta errores potenciales basándose en las reglas del lenguaje, los tipos declarados y la estructura del programa.

En PHP, esto es especialmente relevante porque:

- PHP es un lenguaje de tipado dinámico que, históricamente, no obliga a declarar tipos en todas partes.
- Muchos errores (pasar un argumento del tipo incorrecto, llamar a un método que no existe, devolver un valor que no coincide con el tipo de retorno) solo se descubren cuando el código se ejecuta.
- En proyectos grandes o heredados, estos errores pueden quedarse ocultos durante mucho tiempo.

## Qué es PHPStan

[PHPStan](https://phpstan.org/) es la herramienta de análisis estático más extendida en el ecosistema PHP. Se ejecuta desde la línea de comandos sobre un directorio de código y produce una lista de errores organizados por archivo y línea.

PHPStan trabaja por **niveles de severidad** (del 0 al 9). Cada nivel añade reglas más estrictas. En el nivel más bajo, PHPStan detecta errores básicos como clases o funciones que no existen. En los niveles más altos, verifica compatibilidad de tipos, valores de retorno, tipos genéricos y más.

## Qué tipo de errores detecta

Algunos ejemplos de lo que PHPStan puede encontrar:

- **Tipos de argumento incorrectos**: pasar un `string` donde se espera un `int`.
- **Métodos o propiedades inexistentes**: llamar a `$user->getFullName()` cuando el método no existe en la clase `User`.
- **Tipos de retorno inconsistentes**: una función que declara devolver `string` pero en algún path devuelve `null`.
- **Acceso a propiedades no definidas**: usar `$this->address` en una clase que no tiene esa propiedad.
- **Errores en código condicional**: comparaciones que siempre son verdaderas o ramas que nunca se ejecutan.
- **Problemas con Doctrine, Symfony u otros frameworks**: reglas específicas para detectar errores en el uso de ORMs, inyección de dependencias, etc.

## Cómo se ve la salida de PHPStan

Cuando PHPStan encuentra errores, produce una salida como esta:

```
 ------ --------------------------------------------------------
  Line   src/Http/UserController.php
 ------ --------------------------------------------------------
  12     Parameter #1 $id of method App\Http\UserController::show()
         expects int, string given.
  25     Call to an undefined method App\Domain\Entity\User::getFullName().
 ------ --------------------------------------------------------
```

En formato JSON (el que PHPSage consume internamente), cada error es un objeto con `file`, `line`, `message` y opcionalmente un `identifier` que clasifica el tipo de error.

## Limitaciones prácticas de la salida de PHPStan

PHPStan es una herramienta excelente, pero su salida tiene limitaciones cuando se usa directamente:

- **Es una lista plana**: no hay agrupación por tipo de error, ni estadísticas, ni forma de priorizar.
- **Los mensajes son técnicos**: están pensados para desarrolladores que ya conocen el sistema de tipos de PHP. Un desarrollador con menos experiencia puede necesitar consultar documentación externa.
- **No explica el porqué**: PHPStan dice qué está mal, pero no por qué ese error importa ni cuál es la forma recomendada de resolverlo.
- **No sugiere correcciones**: el desarrollador debe interpretar el error y decidir cómo corregirlo por su cuenta.
- **En proyectos grandes, la cantidad de errores puede ser abrumadora**: cientos o miles de errores sin ninguna ayuda para filtrar, navegar o priorizar.

## Por qué tiene sentido construir algo encima de PHPStan

PHPStan es muy bueno en lo que hace: detectar errores de forma precisa y exhaustiva. Pero entre la detección del error y su corrección hay un espacio de trabajo que PHPStan no cubre.

PHPSage ocupa ese espacio: toma la salida de PHPStan y le añade navegación, contexto y asistencia para que el desarrollador pueda pasar de "sé que tengo un error" a "entiendo qué pasa y sé cómo arreglarlo" con menos fricción.
