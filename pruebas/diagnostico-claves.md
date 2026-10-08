# Diagnóstico de claves ausentes

Criterio: fila marcada ausente en `discrepancias.md` en al menos 5 de 30 ejecuciones; candidato es una tarea sobrante con coincidencia literal normalizada en más de la mitad de las claves. Las frecuencias indican cuántas veces apareció ese texto candidato entre esas ejecuciones. Las tildes se eliminan antes de comparar; no hay fallos atribuibles solo a acentos.

### Fila 1 — ausente 9/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `clientes`; `tarjeta caducada`; `iban` | Llamar a clientes con tarjeta caducada para solicitar método de pago alternativo (1×)<br>Llamar a dos clientes con tarjeta caducada para obtener método de pago alternativo (1×)<br>Llamar a dos clientes para pedirles otro método de pago o IBAN para transferencia (dos cobros duplicados sin poder devolver) (1×)<br>Llamar a dos clientes para pedirles otro método de pago o el IBAN para la transferencia de reembolsos (1×)<br>Llamar a dos clientes para pedirles otro método de pago o IBAN para devolución de cargo duplicado (1×)<br>Llamar a dos clientes para devolver dinero por cargo duplicado (tarjeta caducada) (1×)<br>Llamar a dos clientes para pedirles otro método de pago o IBAN para la transferencia de devoluciones (1×) | Se alternan dos grupos: unos textos omiten `iban`; los otros hablan del IBAN/devolución, pero omiten `tarjeta caducada`. Ninguno contiene las tres claves en `tarea`. |

### Fila 2 — ausente 13/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `idempotencia`; `backoff`; `jitter` | Implementar política de reintentos con backoff exponencial, jitter y dead letter queue (1×)<br>Implementar política de reintentos con backoff exponencial, jitter, máximo 5 intentos y dead letter queue (2×)<br>Implementar backoff exponencial con jitter, máximo 5 intentos y dead letter queue (1×)<br>Implementar backoff exponencial con jitter y dead-letter queue para reintentos de pagos (1×)<br>Implementar política de reintentos con backoff exponencial, jitter y dead-letter queue (1×)<br>Implementar política de reintentos con backoff exponencial, jitter, máximo cinco intentos y dead-letter queue (2×)<br>Implementar política de reintentos con backoff exponencial, jitter y máximo de cinco intentos para el servicio de pagos (1×)<br>Configurar política de reintentos con backoff exponencial, jitter y dead-letter queue (1×)<br>Implementar política de reintentos con backoff exponencial, jitter y dead-letter queue para pagos (1×)<br>Implementar política de reintentos con backoff exponencial, jitter y máximo de cinco intentos para pagos (1×) | Todos los candidatos listados contienen `backoff` y `jitter`, pero omiten `idempotencia`. La extracción suele separar idempotencia y política de reintentos en tareas distintas; la otra tarea por sí sola no aporta las tres claves en una misma descripción. `dead letter` no sustituye ninguna clave exigida. |

### Fila 6 — ausente 14/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `purgar`; `logs`; `texto plano` | Purgar logs de Datadog que contienen la clave de API del proveedor (1×)<br>Purgar logs con la clave de API del proveedor de pagos en Datadog (2×)<br>Purgar logs con clave de API del proveedor de pagos (1×)<br>Purgar logs que contienen la clave de API del proveedor de pagos en Datadog (1×)<br>Purgar logs de Datadog que contienen la clave de API del proveedor de pagos (2×)<br>Purgar logs de Datadog que contienen la clave API del proveedor de pagos (1×)<br>Purgar los logs con la clave de API del proveedor de pagos subidos a Datadog (1×)<br>Purgar los logs de Datadog que contienen la clave de API del proveedor de pagos (3×)<br>Purgar los logs de Datadog donde aparece la clave de API del proveedor de pagos (2×) | Falta `texto plano` en la descripción de tarea. Algunas citas o el contexto indican que la clave está en texto plano, pero el comparador solo mira el campo `tarea`. No es una diferencia de acento ni de forma. |

### Fila 7 — ausente 28/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `rotar`; `clave api`; `pagos` | Rotar la clave de API del proveedor de pagos después de que se purguen los logs (2×)<br>Rotar la clave de API del proveedor de pagos (20×)<br>Rotar clave de API del proveedor de pagos (2×)<br>Rotar la clave de API del proveedor de pagos (después de la purga de logs) (3×)<br>Rotar la clave de API del proveedor de pagos (después de que se purguen los logs) (1×) | La clave compuesta `clave api` exige esas dos palabras contiguas. Las salidas escriben `clave de API`, con `de` intercalado. La idea está presente, pero falla la coincidencia literal de la frase. |

### Fila 9 — ausente 16/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `informe`; `soc 2`; `nda` | Ninguna. | En estas ejecuciones no hay tarea sobrante que comparta al menos 2 de las 3 claves. Con ese umbral no hay una candidata que permita atribuir el fallo a una clave concreta. |

### Fila 12 — ausente 8/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `audit_tmp`; `replica identity full`; `events_raw` | Borrar tabla audit_tmp y configurar replica identity en events_raw y legacy_imports (1×)<br>Configurar replica identity full en tabla events_raw (1×)<br>Configurar REPLICA IDENTITY FULL en tablas events_raw y legacy_imports (1×) | En el primer texto falta `full` en la frase `replica identity full`. En los otros dos falta `audit_tmp`: describen configurar la identidad de réplica, pero no borrar la tabla temporal. |

### Fila 13 — ausente 13/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `debezium`; `postgres 16`; `staging` | Probar compatibilidad de Debezium con PostgreSQL 16 en staging (4×)<br>Probar compatibilidad de Debezium versión 2.2 con PostgreSQL 16 en staging (2×)<br>Probar compatibilidad de Debezium versión 2.2 con PostgreSQL 16 en staging y confirmar resultado (1×)<br>Probar compatibilidad de Debezium 2.2 con PostgreSQL 16 en staging (2×)<br>Probar compatibilidad de Debezium con PostgreSQL 16 en staging y confirmar resultados (1×) | `postgres 16` no aparece literalmente: la salida usa `PostgreSQL 16`. Es una variante de nombre del producto (`PostgreSQL` frente a `Postgres`), no un acento ni una fecha. |

### Fila 15 — ausente 20/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `borrador`; `aviso`; `correo` | Enviar aviso de mantenimiento a Julián por correo para revisión (2×)<br>Enviar aviso de ventana de mantenimiento a Julián por correo para revisión (1×)<br>Enviar aviso de mantenimiento de Postgres a Julián por correo para revisión (1×)<br>Enviar aviso de mantenimiento a Julián para su revisión por correo (1×)<br>Enviar a Julián por correo el aviso de mantenimiento para que lo revise (1×)<br>Enviar por correo a Julián el aviso de mantenimiento para que lo revise antes de enviarlo (3×)<br>Enviar a Julián por correo el aviso de mantenimiento para que lo revise antes del envío (1×) | Todos omiten `borrador`. Se describe enviar el aviso para revisión, pero no se nombra el borrador en el campo `tarea`; `revisión` no es la clave literal `borrador`. |

### Fila 20 — ausente 18/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `apoyo`; `guardia`; `corte` | Proporcionar apoyo si hay incidencias con la aplicación durante el corte de migración de PostgreSQL (1×)<br>Proporcionar apoyo técnico la noche de corte de migración de PostgreSQL (1×)<br>Proporcionar apoyo como guardia de emergencia durante la migración de Postgres el sábado 14 de noviembre (1×)<br>Estar como apoyo durante la guardia de migración de PostgreSQL si pasa algo con la aplicación (1×)<br>Estar de apoyo la noche del corte de la migración por si hay problemas con la aplicación (2×)<br>Estar de apoyo la noche del corte de la migración por si hay problemas con la aplicación (se pasaría al 21 si Debezium no es compatible) (1×)<br>Estar de apoyo la noche del corte de la migración por si hay problemas con la aplicación (sábado 14, o 21 si se aplaza) (1×) | Los candidatos contienen solo dos claves por descripción: unos omiten `guardia` al hablar del corte; otros omiten `corte` al hablar de guardia. No es una variante ortográfica; la tercera palabra no está en la tarea. |

### Fila 21 — ausente 20/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `fct_subscriptions`; `join`; `historico` | Arreglar modelo fct_subscriptions y recalcular histórico de métricas (1×)<br>Arreglar modelo fct_subscriptions y recalcular histórico de MRR y churn (3×)<br>Arreglar modelo fct_subscriptions en dbt y recalcular histórico de MRR y churn (2×)<br>Arreglar el modelo fct_subscriptions en dbt y recalcular histórico (1×)<br>Arreglar modelo fct_subscriptions y recalcular histórico del MRR (1×)<br>Arreglar modelo fct_subscriptions en DBT corrigiendo join de subscription_id (1×)<br>Arreglar modelo fct_subscriptions en dbt y recalcular histórico (1×)<br>Corregir el join del modelo fct subscriptions, recalcular el histórico y validarlo con Paloma de finanzas (1×)<br>Arreglar el join del modelo fct subscriptions y recalcular el histórico (2×)<br>Arreglar el modelo fct subscriptions (join por subscription id) y recalcular el histórico (1×)<br>Arreglar el modelo fct_subscriptions, recalcular el histórico y validarlo con Paloma de finanzas (1×) | En la mayoría falta `join`, aunque la cita o palabras como `arreglar` describan la corrección. En las variantes que sí dicen `join`, `fct subscriptions` lleva un espacio en vez del guion bajo literal de `fct_subscriptions`; en otros textos falta `historico`. |

### Fila 22 — ausente 22/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `numeros corregidos`; `paloma`; `finanzas` | Validar métricas corregidas con Paloma de finanzas (1×)<br>Validar números de MRR y churn con Paloma de finanzas (1×)<br>Validar números corregidos del MRR y churn con finanzas antes de usarlos (1×)<br>Validar modelo corregido de fct_subscriptions con Paloma de finanzas (1×)<br>Validar números de MRR y churn corregidos con Paloma de finanzas (1×)<br>Corregir el join del modelo fct subscriptions, recalcular el histórico y validarlo con Paloma de finanzas (1×)<br>Arreglar el modelo fct subscriptions, recalcular el histórico y enseñárselo a Paloma de finanzas para validarlo (1×)<br>Arreglar el modelo fct_subscriptions, recalcular el histórico y validarlo con Paloma de finanzas (1×) | Unos candidatos mencionan a Paloma y finanzas, pero sustituyen `numeros corregidos` por `métricas corregidas`, `modelo corregido` o dejan palabras intercaladas entre `números` y `corregidos`. Otro contiene `numeros corregidos` y finanzas, pero omite `paloma`. Los acentos de «números» no afectan porque se normalizan. |

### Fila 23 — ausente 10/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `intentos`; `api gateway`; `ip` | Implementar límite de intentos de login y reset de contraseña en API gateway (3×)<br>Implementar límite de intentos de login en API gateway (1×)<br>Implementar límite de intentos en login y reset de contraseña en API gateway (3×)<br>Implementar límite de intentos en login con API gateway (1×)<br>Implementar límite de diez intentos por minuto en el API gateway para login y reset de contraseña (1×)<br>Implementar límite de intentos de login y reset de contraseña en el API gateway (1×) | Falta `ip` en todas las descripciones. En algunas citas sí aparece «por IP», pero las claves se comparan contra el campo `tarea`, no contra la cita. |

### Fila 24 — ausente 6/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `intentos`; `cuenta`; `redis` | Ninguna. | No hay un sobrante que comparta al menos 2 de las 3 claves; por tanto no hay una candidata mayoritaria para aislar una clave fallida. |

### Fila 25 — ausente 5/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `stack trace`; `errores`; `500` | Arreglar manejador de errores para no devolver stack traces en producción (1×)<br>Arreglar respuestas de error 500 que devuelven stack trace completo en producción (1×)<br>Corregir manejador de errores para no devolver stack traces en producción (1×)<br>Arreglar stack traces en respuestas de error 500 en producción (1×)<br>Arreglar manejo de errores para no devolver stack traces en producción (1×) | Unas descripciones omiten `500`. Las que dicen `error` en singular no contienen la clave plural `errores`; aunque es una variación de número evidente, la coincidencia literal no la equipara. |

### Fila 26 — ausente 7/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `seguimiento`; `pentest`; `informe` | Ninguna. | Ningún sobrante de esas ejecuciones comparte al menos 2 de las 3 claves. No se puede señalar una clave concreta sin una candidata que alcance el umbral. |

### Fila 27 — ausente 18/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `carga diferida`; `libreria`; `graficos` | Cargar librería de gráficos de forma diferida (1×)<br>Cargar librería de gráficos de forma diferida solo en dashboard para mejorar LCP en móvil (1×)<br>Cargar de forma diferida la librería de gráficos solo donde hace falta para mejorar LCP en móvil (1×)<br>Cargar de forma diferida la librería de gráficos solo donde hace falta (8×)<br>Cargar de forma diferida la librería de gráficos solo donde se usa (6×)<br>Cargar la librería de gráficos de forma diferida solo donde hace falta (1×) | `libreria` y `graficos` sí coinciden: la normalización elimina los acentos. La frase `carga diferida` falla porque las salidas usan `cargar` y separan/reordenan los términos (`de forma diferida`); es una variación de forma verbal y orden, no de acento. |

### Fila 28 — ausente 6/30

| Claves | Tareas sobrantes con coincidencia mayoritaria | Por qué falla la clave restante |
| --- | --- | --- |
| `comentar`; `arquitectura`; `migracion` | Revisar documento de arquitectura de migración de PostgreSQL (2×)<br>Revisar documento de arquitectura de la migración de PostgreSQL (3×)<br>Revisar documento de arquitectura de la migración de PostgreSQL antes del lunes 2 de noviembre (1×) | Las tareas contienen `arquitectura` y `migracion`, pero dicen `revisar` y no `comentar`. Es una sustitución léxica; los acentos no influyen. |
