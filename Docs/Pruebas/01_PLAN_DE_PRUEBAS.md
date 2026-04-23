# 01_PLAN_DE_PRUEBAS

## 1. Introduccion

Este documento define el plan de pruebas para `SafeRidePro`, una plataforma web de transporte seguro compartido para estudiantes con verificacion institucional, operacion de viajes, confianza comunitaria y auditoria administrativa.

El plan toma como referencia buenas practicas de `IEEE 829` e `ISO/IEC/IEEE 29119`, adaptadas al contexto real del proyecto y a su fase actual de consolidacion web.

La intencion no es producir documentacion rigida o burocratica, sino establecer un marco profesional, mantenible y ejecutable que permita:

- planificar la estrategia de pruebas
- justificar cobertura y prioridades
- ordenar niveles y tipos de testing
- reducir riesgo de regresiones
- dejar evidencia clara de calidad del producto

---

## 2. Objetivos del plan de pruebas

- verificar que los flujos principales del sistema funcionen de punta a punta
- detectar defectos funcionales, inconsistencias de estado y regresiones entre modulos
- validar que el entorno de QA sea reproducible y apto para pruebas de sistema
- dejar trazabilidad entre requerimientos, riesgos y actividades de prueba
- proporcionar base documental para demostracion, evaluacion academica y evolucion futura

---

## 3. Alcance de las pruebas

### 3.1 En alcance

Se incluyen pruebas sobre:

- acceso e identidad institucional
- perfil e incorporacion institucional
- onboarding de conductor
- gestion de vehiculos
- viajes, exploracion y solicitudes
- tracking v1
- ejecucion operativa del viaje
- confianza, reportes, sanciones y apelaciones
- auditoria administrativa
- entorno QA con Docker
- integracion entre web, API, Prisma y PostgreSQL

### 3.2 Fuera de alcance en esta etapa

No forman parte prioritaria del presente plan:

- tracking GPS fino tipo ridesharing v2
- mobile
- push notifications productivas
- pagos
- pruebas de carga formales a gran escala
- pentesting profundo o auditoria de seguridad especializada

---

## 4. Items bajo prueba

Los principales artefactos y componentes bajo prueba son:

- `apps/web`
- `apps/api`
- `apps/api/prisma`
- `packages/shared-types`
- scripts QA del monorepo
- entorno `docker-compose.qa.yml`

Tambien se consideran como fuente de validacion:

- reglas funcionales y operativas descritas en `Docs/02_PROTOCOLO_FUNCIONAL_V2.md`
- politicas descritas en `Docs/04_POLITICAS_Y_REGLAS_OPERATIVAS.md`
- estado actual consolidado en `Docs/10_HANDOFF_ESTADO_ACTUAL_Y_PENDIENTES.md`

---

## 5. Enfoque de las pruebas

El enfoque general sera incremental y basado en riesgo.

Se priorizara:

- funcionalidad critica para la operacion del viaje
- coherencia entre estados del dominio
- integracion entre capas
- cobertura de flujos reales de usuario
- validacion de regresiones en modulos ya implementados

La estrategia combina:

- pruebas automatizadas existentes
- pruebas de integracion backend
- pruebas E2E y smoke web
- pruebas de sistema manuales
- revision de criterios de salida para release readiness web

---

## 6. Niveles de prueba

### 6.1 Pruebas unitarias

Validan componentes aislados de logica de negocio, especialmente:

- use cases
- reglas de transicion de estado
- restricciones operativas
- logica de sanciones o cierres

### 6.2 Pruebas de integracion

Validan la colaboracion entre componentes y capas, por ejemplo:

- controller + use case + repository
- API + Prisma + PostgreSQL
- auditoria generada por acciones operativas
- integracion de migraciones y modelos persistentes

### 6.3 Pruebas de sistema

Validan el comportamiento del producto completo en entorno QA o equivalente, incluyendo:

- web + API + base de datos
- roles distintos
- flujos end-to-end
- consistencia funcional y visual

### 6.4 Pruebas de aceptacion interna

Se consideran como la validacion final del bloque web antes de abrir otra feature grande.

Su objetivo es responder si el producto esta suficientemente estable para:

- demo
- evaluacion academica
- cierre del bloque `Release Readiness Web`

---

## 7. Tipos de testing

## 7.1 Pruebas funcionales

Verifican que el sistema haga lo que debe hacer segun requerimientos, reglas operativas y flujos de negocio.

En `SafeRidePro` incluyen:

- registro, login, verificacion y recuperacion de cuenta
- edicion de perfil y contexto institucional
- onboarding de conductor y revision administrativa
- registro y gestion de vehiculos
- publicacion, busqueda y solicitud de viajes
- inicio, operacion y cierre del viaje
- abordaje, finalizacion por pasajero y no-show
- cierre excepcional con nota
- calificaciones, reportes, sanciones y apelaciones
- auditoria administrativa y navegacion cruzada

## 7.2 Pruebas no funcionales

Verifican atributos de calidad distintos a la funcionalidad base.

En esta etapa incluyen principalmente:

- usabilidad basica
- claridad visual
- consistencia de estados y mensajes
- reproducibilidad del entorno QA
- mantenibilidad del flujo de pruebas
- confiabilidad operativa de sesiones, uploads y refresh

No se cubren aun de forma profunda:

- pruebas formales de performance bajo alta carga
- seguridad ofensiva avanzada
- accesibilidad avanzada certificable

## 7.3 Pruebas de caja negra

Se disenan desde entradas, acciones y resultados esperados, sin depender de la implementacion interna.

Se aplican sobre todo a:

- QA manual
- smoke tests
- pruebas E2E
- pruebas de sistema por modulo

## 7.4 Pruebas de caja blanca

Se disenan con conocimiento de la estructura interna del sistema.

Se aplican sobre todo a:

- pruebas unitarias
- pruebas de integracion tecnica
- validacion de ramas criticas y transiciones de estado

## 7.5 Nota de clasificacion

Las categorias `funcional / no funcional` y `caja negra / caja blanca` no son excluyentes entre si.

Son dimensiones distintas del diseno de pruebas y deben convivir en la estrategia.

---

## 8. Tecnicas de diseno de pruebas

Segun el escenario, se podran usar:

- particion de equivalencia
- analisis de valores limite
- tablas de decision
- transicion de estados
- pruebas basadas en escenarios
- pruebas basadas en riesgo

En este proyecto, la tecnica mas critica es `transicion de estados`, por la coexistencia de:

- `Trip.status`
- `TripRequest.status`
- `TripRequest.executionStatus`

---

## 9. Herramientas

### 9.1 Herramientas del proyecto

- `Node.js`
- `TypeScript`
- `pnpm`
- `Turborepo`
- `Next.js`
- `NestJS`
- `Prisma ORM`
- `PostgreSQL`
- `Docker Compose`

### 9.2 Herramientas de prueba

- `Jest` para pruebas unitarias y de integracion backend
- `Supertest` para pruebas HTTP de API
- `Playwright` para smoke y E2E web
- scripts `pnpm` para verificaciones reproducibles
- entorno QA con `docker-compose.qa.yml`

### 9.3 Comandos de referencia

Los comandos tecnicos base del cierre web incluyen:

```powershell
corepack pnpm qa:verify:web
corepack pnpm qa:release:web
corepack pnpm --filter web test:e2e:smoke
```

---

## 10. Entorno de pruebas

### 10.1 Entorno principal

El entorno de pruebas principal de esta fase es el entorno QA definido en:

- `Docs/07_ENTORNO_QA_DEPLOY.md`

Este entorno usa:

- `PostgreSQL` en contenedor
- `API` NestJS en contenedor
- `Web` Next.js en contenedor

### 10.2 Base de datos

La base de datos de pruebas debe:

- ejecutarse en PostgreSQL
- recibir migraciones via Prisma
- contar con seed inicial reproducible
- estar aislada del entorno local de desarrollo habitual cuando se ejecute QA formal

### 10.3 Consideraciones de entorno

El entorno debe garantizar:

- variables `.env.qa` consistentes
- healthchecks funcionales
- build reproducible
- servicios disponibles en los puertos esperados

---

## 11. Datos de prueba

Se requiere contar al menos con:

- administrador institucional activo
- conductor aprobable o ya aprobado
- pasajero operativo
- institucion activa
- casos con licencia vigente y vencida
- viajes con distintos estados
- solicitudes `PENDING`, `ACCEPTED`, `REJECTED` y `CANCELLED`
- escenarios de cierre excepcional y no-show
- reportes con y sin evidencia

Cuando sea posible, los datos deben ser reproducibles via seed o pasos claramente documentados.

---

## 12. Roles y responsabilidades

### 12.1 Responsable de calidad / QA

- planificar la ejecucion de pruebas
- validar cobertura del checklist y del plan
- registrar hallazgos
- priorizar defectos por severidad e impacto

### 12.2 Desarrollador

- implementar y mantener pruebas automatizadas
- corregir defectos encontrados
- validar que los cambios no rompan regresiones conocidas

### 12.3 Revisor funcional / academico

- verificar que el sistema responda al objetivo del proyecto
- confirmar que los flujos sean coherentes para demo o evaluacion

### 12.4 Responsable del entorno

- asegurar disponibilidad del entorno QA
- validar configuracion, migraciones, seed y salud de servicios

En un equipo pequeno, una misma persona puede asumir varios de estos roles, pero las responsabilidades deben distinguirse igual en el documento.

---

## 13. Cronograma de alto nivel

### Fase 1. Preparacion

- revisar documentacion base
- preparar entorno QA
- validar comandos tecnicos de soporte

### Fase 2. Integracion tecnica

- ejecutar pruebas backend y web automatizadas
- validar migraciones y compatibilidad de modelos

### Fase 3. Sistema y QA manual transversal

- recorrer modulos principales
- ejecutar smoke demo
- registrar hallazgos

### Fase 4. Correcciones y regresion

- corregir defectos de mayor impacto
- repetir pruebas afectadas

### Fase 5. Cierre

- validar criterios de salida
- consolidar reporte de ejecucion

El detalle operativo puede ajustarse segun disponibilidad, pero el orden recomendado debe mantenerse.

---

## 14. Gestion de riesgos

Riesgos principales de esta etapa:

- regresiones por cruces entre modulos ya integrados
- inconsistencia entre estados del viaje, solicitud y ejecucion
- defectos en permisos por rol o institucion
- problemas de sesion en interacciones con uploads o cambios de foco
- datos semilla insuficientes para ciertos escenarios
- hallazgos tardios en confianza, sanciones o auditoria

Medidas de mitigacion:

- priorizar flujos criticos y casos borde
- ejecutar smoke transversal antes de abrir nuevas features
- registrar hallazgos con evidencia y reproducibilidad
- validar entorno QA antes de la pasada manual extensa

---

## 15. Criterios de entrada

Las pruebas de sistema y QA transversal pueden iniciar cuando:

- el build de API y Web compila
- el typecheck relevante pasa
- las migraciones necesarias existen y se aplican
- el entorno QA puede levantarse de forma reproducible
- existe documentacion funcional suficiente para definir comportamiento esperado
- el bloque a evaluar esta tecnicamente estabilizado

---

## 16. Criterios de salida

El bloque de pruebas puede considerarse satisfactorio cuando:

- `qa:verify:web` pasa completo
- `qa:release:web` pasa completo
- no hay defectos bloqueantes en flujos principales
- los casos borde criticos fueron revisados
- el smoke demo transversal es ejecutable sin pasos ocultos
- existe reporte de ejecucion con hallazgos y conclusion

---

## 17. Entregables de las pruebas

Los entregables principales de esta fase son:

- plan de pruebas
- diseno de pruebas de integracion y sistema
- checklist transversal web
- reporte de ejecucion QA
- registro de defectos o hallazgos
- evidencia de ejecucion cuando aplique

---

## 18. Metricas sugeridas

Se recomienda registrar al menos:

- casos planificados
- casos ejecutados
- casos aprobados
- casos fallidos
- casos bloqueados
- defectos por severidad
- modulos con mayor concentracion de hallazgos

---

## 19. Cierre y aprobacion

El cierre de la fase de pruebas debe concluir con una valoracion clara:

- apto para continuar con siguiente bloque
- apto con observaciones menores
- no apto hasta corregir hallazgos criticos

La conclusion debe quedar registrada en el reporte de ejecucion correspondiente.
