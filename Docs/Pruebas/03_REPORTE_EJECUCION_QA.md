# 03_REPORTE_EJECUCION_QA

## 1. Objetivo

Registrar la ejecucion de una pasada de QA relevante sobre `SafeRidePro`, incluyendo contexto, alcance, resultados, hallazgos y conclusion.

---

## 2. Datos generales

- fecha: `2026-04-21 11:20:13 -05:00`
- responsable: Codex + usuario
- version o commit evaluado: `83cf63c`
- entorno: `QA local con Docker Compose`
- documentos de referencia:
  - `Docs/Pruebas/01_PLAN_DE_PRUEBAS.md`
  - `Docs/Pruebas/02_DISENO_PRUEBAS_INTEGRACION_Y_SISTEMA.md`
  - `Docs/09_CHECKLIST_QA_WEB_RELEASE.md`
  - `Docs/10_HANDOFF_ESTADO_ACTUAL_Y_PENDIENTES.md`
  - `Docs/07_ENTORNO_QA_DEPLOY.md`

---

## 3. Alcance ejecutado

- modulos cubiertos:
  - preparacion de entorno QA
  - verificacion inicial del bloque web previo a QA manual transversal
  - inicio del registro de ejecucion para acceso, perfil, conductor, vehiculos, viajes, solicitudes, ejecucion operativa, confianza y auditoria
- suites ejecutadas:
  - verificacion inicial de entorno
  - QA manual transversal en progreso
- comandos ejecutados:
  - `git rev-parse --short HEAD`
  - `Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"`
  - `docker --version`
  - `corepack pnpm qa:ps`
- casos omitidos o fuera de alcance:
  - tracking GPS fino v2
  - mobile
  - pagos
  - notificaciones avanzadas

---

## 4. Resultado de validaciones tecnicas

### Build y typecheck

- resultado: aprobado parcialmente
- observaciones:
  - `corepack pnpm qa:verify:web` compilo `API` y `Web` correctamente
  - `typecheck` de `Web` paso
  - el fallo de la corrida se produjo despues, en el smoke E2E

### Automatizadas

- pruebas unitarias: no ejecutadas de forma aislada en esta corrida
- pruebas de integracion: no ejecutadas de forma aislada en esta corrida
- pruebas E2E o smoke: `qa:verify:web` ejecutado con `2` escenarios aprobados y `1` fallido
- observaciones:
  - escenarios aprobados:
    - `auth-admin.spec.ts`
    - `driver-onboarding-trip.spec.ts`
  - escenario fallido:
    - `passenger-trust-audit.spec.ts`
  - el fallo ocurre cuando el test intenta finalizar un viaje inmediatamente despues de iniciarlo y espera el mensaje `Viaje finalizado correctamente.`
  - el comportamiento nuevo del backend exige cerrar a todos los pasajeros o registrar una nota de cierre excepcional si quedan solicitudes aceptadas sin resolver

### Entorno QA

- estado de Docker: disponible, `Docker version 29.2.1`
- estado de API: contenedor `healthy` en puerto `3001`
- estado de Web: contenedor `healthy` en puerto `3000`
- estado de base de datos: contenedor `healthy` en puerto `5432`
- observaciones:
  - el comando `corepack pnpm qa:ps` confirma `postgres`, `api` y `web` levantados y saludables
  - `http://localhost:3000/healthz` responde `200`
  - `http://localhost:3001/api/health` responde `200`
  - la corrida manual puede avanzar sobre este entorno, sujeto a comprobacion funcional por modulo

---

## 5. Resultado de QA manual transversal

### Acceso y sesion

- resultado: pendiente
- observaciones:
  - aun no se inicia la validacion manual guiada de interfaz

### Perfil e incorporacion institucional

- resultado: pendiente
- observaciones:
  - aun no se inicia la validacion manual guiada de interfaz

### Conductor

- resultado: pendiente
- observaciones:
  - aun no se inicia la validacion manual guiada de interfaz

### Vehiculos

- resultado: pendiente
- observaciones:
  - aun no se inicia la validacion manual guiada de interfaz

### Viajes y solicitudes

- resultado: pendiente
- observaciones:
  - aun no se inicia la validacion manual guiada de interfaz

### Ejecucion operativa del viaje

- resultado: pendiente
- observaciones:
  - este es el foco prioritario de la corrida manual actual

### Confianza

- resultado: pendiente
- observaciones:
  - aun no se inicia la validacion manual guiada de interfaz

### Auditoria

- resultado: pendiente
- observaciones:
  - aun no se inicia la validacion manual guiada de interfaz

---

## 6. Hallazgos

Usar una entrada por hallazgo.

### H-001

- titulo: Smoke E2E de confianza y auditoria falla al finalizar viaje sin cierre operativo previo
- severidad: media
- modulo: viajes / ejecucion operativa / smoke E2E
- descripcion:
  - el escenario automatizado `passenger-trust-audit.spec.ts` intenta finalizar un viaje justo despues de iniciarlo y espera el mensaje `Viaje finalizado correctamente.`
  - con el nuevo flujo operativo, si existe un pasajero aceptado sin resolver, el sistema debe exigir cierre operativo o nota excepcional
  - por tanto, el smoke ya no refleja la regla vigente y falla en esta corrida
- pasos para reproducir:
  1. ejecutar `corepack pnpm qa:verify:web`
  2. esperar la ejecucion del smoke `passenger-trust-audit.spec.ts`
  3. observar el paso donde el conductor inicia el viaje y luego intenta finalizarlo de inmediato
- resultado esperado:
  - el smoke debe alinearse con la politica actual y finalizar correctamente solo si el pasajero fue resuelto o si se registra una nota excepcional valida
- resultado obtenido:
  - el test sigue esperando el mensaje `Viaje finalizado correctamente.` sin contemplar el nuevo cierre operativo y falla
- evidencia:
  - salida de `qa:verify:web`
  - capturas generadas por Playwright en `apps/web/test-results/.../test-failed-*.png`
- estado: abierto

### H-002

- titulo:
- severidad:
- modulo:
- descripcion:
- pasos para reproducir:
- resultado esperado:
- resultado obtenido:
- evidencia:
- estado:

---

## 7. Riesgos residuales

- riesgo: aun no se han ejecutado validaciones manuales sobre los cruces de estado del bloque reciente
- impacto: puede existir una falsa sensacion de estabilidad si solo se considera el estado saludable de contenedores
- recomendacion: completar QA manual transversal y luego reejecutar verificacion tecnica de cierre

---

## 8. Conclusion

- estado general: pendiente
- criterio de salida alcanzado: no aun
- recomendacion:
  - continuar con QA manual transversal guiada
  - registrar hallazgos en este mismo documento conforme aparezcan
  - ejecutar validaciones tecnicas de cierre antes de dar por concluido el bloque

Valores sugeridos para `estado general`:

- apto
- apto con observaciones
- no apto

---

## 9. Proximos pasos

1. ejecutar comprobaciones funcionales iniciales de acceso y sesion en la interfaz
2. recorrer viajes, solicitudes y ejecucion operativa con foco en el nuevo flujo
3. consolidar hallazgos y decidir si el bloque puede pasar a cierre o requiere endurecimiento adicional
