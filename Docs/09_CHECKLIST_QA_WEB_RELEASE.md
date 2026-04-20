# 09_CHECKLIST_QA_WEB_RELEASE

## Objetivo

Dejar una guia unica de verificacion transversal para la version web de SafeRidePro antes de abrir el siguiente gran bloque funcional.

Este checklist sirve para:

- QA manual transversal
- smoke tests de demo
- cierre de etapa web
- validacion previa a despliegue QA/release web

---

## 1. Comandos base de validacion

### Prerrequisito

Antes de correr los E2E o la verificacion completa:

- Docker Desktop debe estar encendido
- el motor de Docker debe estar accesible
- `.env.qa` debe existir o poder generarse desde `.env.qa.example`

### Verificacion tecnica web

Desde la raiz del proyecto:

```powershell
corepack pnpm qa:verify:web
```

Este comando ejecuta:

- build de API
- typecheck de Web
- build de Web
- smoke E2E de Web alineado con la UI actual

### Verificacion reforzada de esta etapa

```powershell
corepack pnpm qa:release:web
```

Este comando agrega ademas:

- pruebas API de reportes/evidencia

### Smoke E2E directo

Si solo quieres correr la pasada transversal de interfaz:

```powershell
corepack pnpm --filter web test:e2e:smoke
```

---

## 2. Checklist transversal por modulo

## 2.1 Acceso y sesion

- registro institucional con dominio valido
- bloqueo de dominio no permitido
- verificacion por codigo
- reenvio de codigo
- login correcto
- error claro en login incorrecto
- forgot password
- reset password
- cierre de sesion
- redireccion correcta despues de verificar correo

## 2.2 Perfil e incorporacion institucional

- carga y edicion de perfil
- foto de perfil visible en sidebar y perfil
- validacion de celular
- estado de onboarding coherente
- contexto institucional activo visible

## 2.3 Conductor

- carga de documento de identidad
- carga de licencia
- previsualizacion de documentos
- descarga de documentos
- envio de solicitud
- aprobacion administrativa
- rechazo administrativo con nota
- bloqueo de auto revision por admin

## 2.4 Vehiculos

- registro de vehiculo
- carga de documento de matricula
- previsualizacion del documento
- descarga del documento
- edicion del vehiculo
- cambio de estado activo/inactivo
- catalogo de marca/modelo
- entrada manual cuando aplique

## 2.5 Viajes

- crear viaje nuevo
- reutilizar ultima ruta
- publicar viaje
- explorar viajes
- filtros de busqueda
- detalle de viaje
- mapa y lugares
- estado del viaje consistente

## 2.6 Solicitudes y operacion

- solicitud de cupo
- aceptacion
- rechazo
- cancelacion
- cierre de pendientes al iniciar viaje
- inicio del viaje
- finalizacion del viaje
- tracking v1 visible para participantes correctos

## 2.7 Confianza

- registrar calificacion
- registrar reporte
- carga de evidencia del reporte
- ventana post-viaje respetada
- historial visible
- sanciones visibles al usuario
- apelacion visible y enviable cuando aplique

## 2.8 Auditoria

- revision de conductores
- previsualizacion y descarga de documentos del conductor
- revision de reportes
- previsualizacion y descarga de evidencia del reporte
- transicion a en revision
- resolver
- desestimar
- levantamiento manual de sancion
- revision de apelaciones
- navegacion cruzada entre reportes, sanciones y apelaciones
- resumen de efecto operativo actual por caso

---

## 3. Casos borde obligatorios

- evidencia de reporte ausente
- evidencia de reporte presente
- reporte de alta severidad sin nota suficiente
- reporte de alta severidad sin paso previo por revision
- sancion con apelacion pendiente
- sancion sin apelacion
- apelacion aprobada
- apelacion rechazada
- viaje cancelado tarde por conductor
- viaje con no-show
- licencia vencida
- institucion inactiva

---

## 4. Smoke demo recomendado

Ejecutar en este orden:

1. admin inicia sesion
2. usuario nuevo se registra y verifica
3. usuario solicita habilitacion como conductor
4. admin aprueba conductor
5. conductor registra vehiculo
6. conductor publica viaje
7. pasajero solicita cupo
8. conductor acepta
9. conductor inicia y finaliza viaje
10. pasajero califica y reporta con evidencia
11. admin revisa reporte
12. admin consulta sanciones/apelaciones relacionadas

---

## 5. Criterio de salida del bloque

El bloque `Release Readiness Web + QA transversal` puede darse por cerrado cuando:

- `qa:verify:web` pasa completo
- `qa:release:web` pasa completo
- no hay errores funcionales bloqueantes en el smoke demo
- no hay errores visuales graves en accesos, viajes, confianza o auditoria
- los flujos principales funcionan en entorno QA sin pasos manuales ocultos

---

## 6. Hallazgos

Usar esta seccion para registrar pendientes cortos durante la pasada final:

- pendiente:
- pendiente:
- pendiente:
