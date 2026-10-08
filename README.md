# Extractor de tareas

Pegas la transcripción de una reunión y te devuelve quién tiene que hacer qué, para cuándo y con cuánta seguridad, más una lista aparte con lo que se dijo que había que hacer pero nadie asumió. Y, si quieres, esas tareas llegan solas a Jira.

**Pruébalo:** https://extractor-de-tareas.vercel.app/ (el botón "Ver ejemplo" funciona sin código y sin gastar nada).

## Por qué lo hice

Después de una reunión, alguien tiene que releer la grabación o los apuntes para sacar las tareas, y casi siempre se pierde algo: el plazo que se corrigió a mitad de conversación, o la cosa que "alguien debería hacer" y se quedó sin dueño. Quería ver hasta dónde llega una IA en ese trabajo concreto y, sobre todo, dónde falla. Y que el resultado no se quedara en una tabla, sino que llegara al tablero donde el equipo trabaja.

## Qué hace

Cada tarea sale con su responsable, su fecha límite, un nivel de certeza (alta, media o baja) y la frase literal de la transcripción de la que sale, para poder comprobarla en segundos. Las fechas relativas ("el viernes", "la semana que viene") se convierten en fechas reales a partir del día de la reunión. Si nadie dijo quién se encarga, pone "sin asignar" en vez de inventarse un nombre. Lo que ya estaba hecho o se canceló en la reunión no cuenta como tarea.

Los **pendientes** van en otra tabla: cosas que se mencionaron ("habría que...", "alguien debería...") sin responsable o aplazadas sin fecha.

Se puede copiar el resultado, descargarlo en CSV, copiarlo para pegarlo en Google Sheets o exportarlo a PowerPoint. Hay un campo opcional para escribir los nombres de los participantes que sirve para que, si el transcriptor ha escrito mal un nombre ("Marino" por Marina, por ejemplo), la herramienta use el correcto. Y, como muestran las pruebas, mejora mucho el resultado cuando la transcripción no dice quién habla.

## El flujo completo: de la reunión a Jira

La web sirve para usarla a mano, pero para que no haga falta, monté una automatización con Make para poder conectarla con Jira:

1. **Google Drive:** Meet (en las cuentas de pago) guarda la transcripción automáticamente tras terminar la reunión como documento en Drive. Make vigila esa carpeta. En mis pruebas lo simulé creando yo el Google Doc., al no tener cuenta de pago.
2. **Filtro:** solo continúa si el archivo es un Google Doc. (para evitar que se cuele la grabación MP4 de la reunión).
3. **Extractor:** Make envía el texto a la misma función que usa la web.
4. **Jira:** crea una incidencia por tarea, con su fecha de vencimiento, y una por pendiente, con la etiqueta "sin-asignar". Todas llevan además la etiqueta "ia-revisar", para saber diferenciar las creadas manualmente de las creadas con la automatización, para que las segundas puedan revisarse y ser validadas por una persona. 

## Cómo lo probé

### Método

Pruebas hechas el 7 de octubre de 2026 sobre la versión `v1.0-pruebas` (commit 9b3998d). Los criterios de acierto los escribí **antes** de lanzar ninguna prueba y están en [`pruebas/esperado-reunion-larga.md`](pruebas/esperado-reunion-larga.md) (commit 20e111b).

- **La reunión de prueba** es inventada, para conocer de antemano la solución. Tiene ocho personas, explicaciones técnicas, correcciones de fecha, gente que se va a mitad, tareas ya hechas o canceladas y nombres mal transcritos. Conté a mano **28 tareas y 6 pendientes** que deberían salir, y anoté lo que **no** debería salir.
- **Cinco configuraciones:** formato Meet, Teams y Otter (hablantes numerados, sin nombres), y texto corrido sin puntuación ni hablantes, sin y con lista de participantes. Los formatos imitan a los reales, pero son aproximados.
- **Dos modelos:** Claude Opus 5.5 (el que usa la web) y Claude Haiku 4.5 (unas 7 veces más barato).
- **Tres pasadas** de cada combinación, porque la IA no responde siempre igual: 30 ejecuciones en total, lanzadas con un script ([`pruebas/ejecutar.js`](pruebas/ejecutar.js)) para que todas fueran idénticas.
- **Mismas condiciones para los dos modelos:** no fijé la temperatura ni el parámetro "effort". En Opus 5.5, no enviar "effort" equivale al valor que usa la web ("medium"), y Haiku 4.5 no lo admite.
- **Puntuación** con un segundo script ([`pruebas/puntuar.js`](pruebas/puntuar.js)), que compara cada resultado con lo esperado, y **revisión manual** de las discrepancias.

### Resultados

Un **acierto** es una tarea con el responsable, la fecha y la certeza dentro de lo aceptado. Si aparece pero falla en alguno de esos campos, cuenta como parcial.

| Configuración | Opus: aciertos de 28 (mín.–máx.) | Haiku: aciertos de 28 (mín.–máx.) | Pendientes de 6 (Opus / Haiku) | Errores graves (Opus / Haiku) |
| --- | --- | --- | --- | --- |
| Meet | 27,7 (27–28) | 19,7 (17–23) | 6 / 4,3 | 0 / 0 |
| Teams | 27,7 (27–28) | 24,0 (23–25) | 6 / 4,0 | 0 / 0 |
| Otter | 27,0 (26–28) | 21,3 (20–23) | 6 / 3,7 | 0 / 0,7 |
| Texto corrido, sin participantes | 15,3 (15–16) | 5,7 (4–7) | 6 / 4,3 | 0 / 0 |
| Texto corrido, con participantes | 23,0 (22–25) | 10,7 (9–12) | 6 / 4,0 | 0 / 0 |

Medias de 3 pasadas. **Tiempo por reunión:** Opus, entre 41 y 54 segundos; Haiku, entre 26 y 34. **Coste por reunión** (tarifa pública de Anthropic a fecha de la prueba): Opus, unos 0,14 $; Haiku, unos 0,02 $. La tabla completa, con parciales, ausentes y sobrantes, está en [`pruebas/tabla-readme.md`](pruebas/tabla-readme.md).

**Lo que dicen los números (en mis pruebas):**

- **Opus saca casi todas las tareas cuando la transcripción indica quién habla:** 27-28 de 28, los 6 pendientes siempre y ningún error grave.
- **El texto corrido es el punto débil de los dos modelos.** En el de Opus, casi todo lo que no es acierto son tareas bien encontradas con el responsable equivocado (12 parciales de media), porque no se sabe quién habla.
- **Dar la lista de participantes ayuda mucho:** Opus pasa de 15 a 23 aciertos.
- **Haiku encuentra menos tareas y se deja pendientes** (unos 4 de 6), y en Otter convirtió en pendiente una cuestión que no debía salir.

**Por eso la web sigue usando Opus.** Cuesta unas 7 veces más, pero son céntimos por reunión, y la diferencia de calidad es clara justo en lo que más importa: no perder pendientes ni inventarse nada.

### Lo que corregí en la medición, y por qué

La primera puntuación salió mucho peor (Opus, 22-25 de 28; Haiku, 12-16). Al revisarla vi que el fallo era del script, no de los modelos: reconocía cada tarea por palabras clave demasiado literales. Por ejemplo, "clave api" no reconocía "clave **de** API", y "carga diferida" no reconocía "cargar de forma diferida".

Corregí la medición **sin cambiar los criterios**: las tareas, los responsables, las fechas y las certezas esperadas son las mismas. Lo que cambié:

- **Claves más flexibles,** después de comprobar que cada una solo reconoce su propia tarea.
- **Aceptar dos tareas compuestas que el modelo divide en dos** (las filas 2 y 12), igual que ya aceptaba la fusión de las filas 21 y 22.
- **Contar como parcial, no como error grave,** un responsable con el nombre mal escrito tal como venía en la transcripción ("Marino", "Clarra") o una persona que se menciona en la reunión pero no es quien hace la tarea.
- **Dos correcciones manuales** documentadas en [`pruebas/correcciones.csv`](pruebas/correcciones.csv).

La tabla original se conserva en [`pruebas/tabla-readme-claves-v1.md`](pruebas/tabla-readme-claves-v1.md), y cada cambio está en su propio commit. La puntuación es conservadora: en algunos casos Haiku escribe "apoyar" o "soporte" donde la clave espera "apoyo", así que sus cifras pueden estar ligeramente por debajo de lo real.

Antes de esta evaluación hice pruebas informales con otras reuniones; en una reunión corta de cuatro personas salieron 6 de 6 tareas y el único pendiente, sin ninguna tarea inventada.

## Qué no hace bien

- **No da siempre lo mismo.** Entre dos pasadas de la misma reunión cambian una o dos filas, sobre todo en los compromisos flojos.
- **A veces se deja una tarea condicionada.** "Atlas va a pedir nuestro informe SOC 2 Tipo II, y se lo puedo dar bajo NDA" faltó en 3 de las 15 pasadas de Opus.
- **La certeza es discutible.** Ante "Mañana miércoles, de acuerdo. Aunque me da corte", Opus no siempre pone la certeza que yo esperaba. Es una cuestión de criterio, no un error claro.
- **Saca alguna instrucción general como tarea,** por ejemplo "no usar el MRR del dashboard fuera de la empresa hasta que se arregle". La he contado como discutible.
- **Los responsables dependen de que la gente se nombre.** Sin hablantes identificados ni lista de participantes, casi la mitad de las tareas salen con el responsable equivocado o sin asignar.
- **Los nombres mal transcritos no se arreglan solos.** Hay que dar la lista de participantes.
- **Las fechas relativas se leen al pie de la letra.** "Pasado mañana" dicho un jueves sale como sábado.

## Cómo está hecho

Una página en HTML y una función en Vercel (`api/extract.js`) que llama a la API de Anthropic con el modelo **Claude Opus 5.5** (`effort: medium`). Las instrucciones para la IA están en `prompt.js`. El PowerPoint se genera en el navegador con PptxGenJS. No hay base de datos ni cuentas de usuario. La automatización usa Make con Google Drive y Jira.

El código lo escribí con un asistente de IA en VS Code. Lo que fue mío: qué problema resolver, qué cuenta como tarea y qué no, cómo tratar lo ambiguo, el diseño del flujo hasta Jira, los criterios de acierto, el diseño de las pruebas y la revisión de cada resultado.

## Privacidad y coste

Al extraer tareas, el texto de la transcripción se envía a la API de Anthropic para analizarlo. No lo uses con reuniones confidenciales. Para que nadie gaste mi saldo, la extracción pide un código de acceso y hay un límite de longitud de la transcripción. Si quieres probarla con tus propias transcripciones, pídeme el código y te lo paso. El botón "Ver ejemplo" carga un resultado guardado y no llama a la IA.

## Qué sigue

- **Probar con transcripciones reales,** que es donde espero que aparezcan los fallos que estas pruebas no han destapado.
- **Conectar la automatización con una cuenta de Meet de pago,** para que el flujo arranque solo al terminar la reunión.
- **Ampliar la evaluación** a más reuniones y a otros tipos (comerciales, seguimiento semanal), para no depender de una sola.
