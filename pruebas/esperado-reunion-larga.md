# Esperado: reunión larga (Producto, Ingeniería y Negocio)

Borrador para revisar contra `demo/transcripcion.txt`.

Fecha de la reunión: **martes 27/10/2026**. Participantes: Raquel, Andrés, Marina, Tomás, Clara, Julián, Nerea, Álvaro.

Fechas de referencia: "mañana" = 28/10, "este viernes" = 30/10, "esta semana" = 30/10, "dentro de dos semanas" = 10/11, "antes del 4" = 04/11 (se admite la fecha límite tal cual).

## Cómo se puntúa cada fila

- **Acierto:** aparece en `tareas`, con el responsable correcto y la fecha correcta (o la aceptada).
- **Parcial:** aparece, pero con fecha o responsable equivocados, o con una certeza fuera del rango aceptado.
- **Mal clasificada:** aparece en `pendientes` cuando debía ser tarea, o al revés.
- **Ausente:** no aparece en ninguna lista.
- **Fusión:** dos tareas esperadas en una sola fila. Cuenta como acierto solo en las filas marcadas "fusión admitida".
- **Sobrante:** aparece algo que no estaba en esta lista.
- **Error grave:** un responsable inventado o atribuido a otra persona, o algo de la lista "No debe salir".

En los formatos sin nombre de hablante (Otter y texto corrido), en las filas marcadas con ◆ vale "sin asignar" además del responsable correcto. Un nombre equivocado sigue siendo error grave.

## Tareas esperadas (28)

| # | Tarea (idea) | Responsable | Fecha | Certeza aceptada | Notas | Rev. |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Llamar a los dos clientes con tarjeta caducada (otro método de pago o IBAN) | Nerea | 2026-10-27 | alta | | Rev. |
| 2 | Idempotencia (Idempotency-Key) y backoff con jitter en el worker de cobros | Andrés | 2026-11-06 | alta | | Rev. |
| 3 | Alertas de cola (más de 5000) y de lag (más de un minuto) | Marina | 2026-10-30 | alta | |  Rev. |
| 4 | Limitar la concurrencia de los consumidores a un tercio del pool | Marina | sin fecha | media o alta | ◆ | Rev. |
| 5 | Publicar el documento del postmortem | Marina | 2026-10-29 | alta | Corrige "mañana" a jueves 29 | Rev. |
| 6 | Purgar los logs con la clave de API en texto plano | Marina | 2026-10-27 | alta | | Rev. |
| 7 | Rotar la clave de API del proveedor de pagos | Álvaro | 2026-10-30 | alta | "Como tarde" el 30 | Rev. |
| 8 | Reenviar a Álvaro el NDA y el contacto de seguridad de Atlas | Julián | 2026-10-27 | alta | | Rev. |
| 9 | Entregar a Atlas el informe SOC 2 Tipo II bajo NDA | Álvaro | sin fecha | baja o media | Compromiso flojo ("se lo puedo dar") | Rev. |
| 10 | Estimación escrita con hitos (SAML, logs de auditoría, frontend) | Andrés | 2026-10-30 | alta | | Rev. |
| 11 | Llamar a Atlas: matizar lo del cuarto trimestre, fecha la semana que viene | Julián | 2026-10-28 | alta | | Rev. |
| 12 | Borrar `audit_tmp` y configurar REPLICA IDENTITY FULL en `events_raw` y `legacy_imports` | Clara | 2026-11-04 | alta | ◆ | Rev. |
| 13 | Probar Debezium con Postgres 16 en staging y confirmar | Clara | 2026-11-06 | alta | | Rev. |
| 14 | Redactar y enviar el aviso de mantenimiento a clientes enterprise | Nerea | 2026-11-04 | alta | Plazo contractual: 10 días naturales | Rev. |
| 15 | Enviar a Julián el borrador del aviso por correo | Nerea | 2026-10-28 | alta | | Rev. |
| 16 | Banner de mantenimiento programado con feature flag | Tomás | 2026-11-12 | alta | | Rev. |
| 17 | Escribir el plan de rollback | Marina | 2026-11-06 | alta | | Rev. |
| 18 | Ensayo completo de la migración en staging | Marina | 2026-11-07 | alta | | Rev. |
| 19 | Hacer el corte de la migración y estar de guardia esa noche | Marina | 2026-11-14 | media o alta | ◆ Se admite "estar de guardia", "hacer el corte" o las dos juntas. Si salen como dos filas, cuenta como un acierto y un duplicado admitido, no como sobrante. El corte pasa al 21 si Debezium no es compatible | Rev. |
| 20 | Apoyo en la guardia de la noche del corte | Andrés | 2026-11-14 | media o alta | Igual que la 19 | Rev. |
| 21 | Corregir el join de `fct_subscriptions` y recalcular el histórico | Clara | 2026-11-03 | alta | | Rev. |
| 22 | Enseñar los números corregidos a Paloma (finanzas) para validarlos | Clara | 2026-11-03 | alta o media | Fusión admitida con la 21 | Rev. |
| 23 | Límite de intentos en el API gateway (10 por minuto por IP) | Marina | 2026-11-04 | alta | | Rev. |
| 24 | Límite de intentos por cuenta con contadores en Redis | Andrés | 2026-11-20 o sin fecha | media | ◆ "En el siguiente sprint" | Rev. |
| 25 | Quitar el stack trace de los errores 500 | Andrés | 2026-10-28 | alta | | Rev. |
| 26 | Informe de seguimiento del pentest | Álvaro | 2026-11-10 | alta o media | ◆ "Dentro de dos semanas" | Rev. |
| 27 | Carga diferida de la librería de gráficos | Tomás | 2026-10-30 | media o alta | "Esta semana" | Rev. |
| 28 | Comentar el documento de arquitectura de la migración | todos | 2026-11-02 | alta | "Antes del lunes 2"; el responsable es "todos", no una sola persona | Rev. |

## Pendientes esperados (6)

| # | Pendiente | Por qué es pendiente | Rev. |
| --- | --- | --- | --- |
| P1 | Circuit breaker para las llamadas al proveedor de pagos | Andrés lo propone para el siguiente sprint, pero nadie lo asume ni se lo asignan |  Rev. |
| P2 | Quién hace el diseño de la pantalla de configuración de SSO | "Habría que ver quién lo hace" | Rev. |
| P3 | Análisis con finanzas del nuevo plan de precios | "No tengo claro quién lo haría" | Rev. |
| P4 | Runbook de rotación de claves | "Alguien debería escribirlo" | Rev. |
| P5 | Experimento A/B para medir si mejorar el LCP mueve la conversión | "A ver quién lo monta" | Rev. |
| P6 | Migración de Webpack a Vite | Aplazada al primer trimestre, sin responsable | Rev. |

## No debe salir (error grave si sale)

- Dar un crédito o descuento a los clientes afectados (se descartó en la reunión del viernes).
- Pasar a Postgres 17 (descartado: "la 16 y punto").
- Actualizar la dependencia vulnerable del front y activar Dependabot (ya lo hizo Tomás).
- Devolver los 29 cobros duplicados (finanzas ya los devolvió).
- Una tarea para el responsable de "no usar el MRR del dashboard fuera de la empresa" (es una instrucción, no un compromiso).
- Tareas condicionales que no se han activado (que Nerea presente con números viejos si el 3 no hay datos; que Tomás monte la pantalla de SSO con componentes existentes).

## Casos dudosos

| Caso | Qué hace falta decidir | Decisión |
| --- | --- | --- |
| Ejecutar el corte de la migración (14/11, Marina) | Marina propone la fecha, pero nadie dice "yo hago el corte". ¿Tarea esperada o sobrante? | Se absorbe en la fila 19: Marina es quien hace el corte y está de guardia. No hay fila nueva y el total sigue en 28. |
| QBR de Nerea el jueves 5 | Es un evento que ya tiene, no un compromiso nuevo | No esperada. Si aparece, sobrante discutible |
| Una fecha de compromiso para el SSO de Atlas ("no me voy a comprometer a una fecha hoy") | Es la decisión de no comprometerse, no un pendiente | No esperada. Si aparece, sobrante |
| Informe SOC 2 (fila 9) | ¿Debe salir como tarea de certeza baja, o vale que no aparezca? | Debe salir como tarea, con certeza baja o media. Si falta, cuenta como ausente |
| Paloma (fila 22) | ¿Fusión con la 21 o fila propia? | Se admiten las dos |
| Fecha de la fila 24 (Redis) | "Siguiente sprint" no da un día exacto | Se admite el 20/11 o "sin fecha" |

## Resumen

- 28 tareas esperadas: 22 firmes, 6 flojas o dudosas (filas 4, 9, 19, 20, 24 y 27).
- 6 pendientes esperados.
- 6 tipos de error grave definidos arriba.
- 5 filas con responsable difícil de saber sin etiquetas de hablante (marcadas con ◆: 4, 12, 19, 24 y 26).
