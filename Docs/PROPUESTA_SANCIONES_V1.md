# SafeRidePro - Propuesta de politica V1 para sanciones automaticas

## 1. Objetivo

Definir una politica inicial, simple y explicable, para aplicar restricciones automaticas por comportamiento operativo riesgoso dentro del MVP extendido.

Esta version:

- prioriza reglas claras sobre formulas complejas
- evita suspensiones permanentes automaticas
- separa reputacion informativa de sancion operativa
- deja espacio para endurecer reglas en versiones futuras

---

## 2. Principios de diseno

- una calificacion baja aislada no debe suspender automaticamente a un usuario
- `no-show` y cancelaciones tardias pesan mas que una mala estrella individual
- los reportes resueltos deben activar revision y pueden escalar a sancion temporal
- la reincidencia importa mas que un evento aislado
- toda sancion debe ser temporal, auditable y entendible por el usuario

---

## 3. Eventos que afectan confianza y sancion

### 3.1 Eventos con impacto automatico directo

- `late_driver_trip_cancellation`
- `late_passenger_request_cancellation`
- `passenger_no_show`

### 3.2 Eventos con impacto de revision o escalamiento

- `resolved_report_received`

### 3.3 Eventos informativos, no sancionatorios por si solos

- `average_rating_received`
- `total_ratings_received`
- `completed_trips`

Las calificaciones y viajes completados ayudan a contextualizar el historial, pero no activan por si solos una sancion fuerte en esta version.

---

## 4. Tipos de sancion operativa

- `NONE`
- `WARNING`
- `LIMITED_PASSENGER`
- `LIMITED_DRIVER`
- `SUSPENDED`

### 4.1 Significado

- `WARNING`: advertencia visible, sin bloqueo operativo
- `LIMITED_PASSENGER`: no puede solicitar nuevos viajes por un tiempo
- `LIMITED_DRIVER`: no puede crear, publicar ni reiniciar viajes por un tiempo
- `SUSPENDED`: no puede operar como pasajero ni conductor en modulos de movilidad

---

## 5. Ventanas de evaluacion

- comportamiento operativo de cancelaciones y `no-show`: ultimos `30` dias
- reportes resueltos: ultimos `60` dias
- reputacion promedio: referencia informativa de hasta `90` dias o historial disponible

Estas ventanas permiten sancionar reincidencia reciente sin castigar indefinidamente por eventos muy antiguos.

---

## 6. Reglas automaticas propuestas para V1

### 6.1 No-show de pasajero

- `2` `NO_SHOW` en 30 dias: `WARNING`
- `3` `NO_SHOW` en 30 dias: `LIMITED_PASSENGER` por `7` dias
- `4` o mas `NO_SHOW` en 30 dias: `LIMITED_PASSENGER` por `14` dias

### 6.2 Cancelaciones tardias de conductor

- `2` cancelaciones tardias en 30 dias: `WARNING`
- `3` cancelaciones tardias en 30 dias: `LIMITED_DRIVER` por `7` dias
- `4` o mas cancelaciones tardias en 30 dias: `LIMITED_DRIVER` por `14` dias

### 6.3 Cancelaciones tardias de pasajero

- `2` cancelaciones tardias en 30 dias: `WARNING`
- `3` cancelaciones tardias en 30 dias: `LIMITED_PASSENGER` por `3` dias
- `4` o mas cancelaciones tardias en 30 dias: `LIMITED_PASSENGER` por `7` dias

### 6.4 Reportes resueltos recibidos

- `1` reporte resuelto: alerta administrativa y seguimiento
- `2` reportes resueltos en 60 dias: `SUSPENDED` temporal por `7` dias y revision administrativa obligatoria
- `3` o mas reportes resueltos en 60 dias: `SUSPENDED` por `15` dias y revision obligatoria

Nota:

En esta version, los reportes resueltos se tratan como severos porque ya pasaron por revision administrativa.

---

## 7. Que no activa sancion automatica en V1

- una calificacion baja aislada
- una sola cancelacion tardia
- un solo reporte resuelto
- pocos viajes completados

Estos factores pueden mostrarse en el resumen de confianza, pero no deben bloquear automaticamente al usuario en esta fase.

---

## 8. Efectos tecnicos de cada sancion

### 8.1 `WARNING`

- mostrar alerta visible en web
- registrar auditoria
- no bloquear endpoints

### 8.2 `LIMITED_PASSENGER`

Bloquear:

- `createTripRequest`

Permitir:

- ver viajes
- gestionar historial
- consultar confianza

### 8.3 `LIMITED_DRIVER`

Bloquear:

- `createTrip`
- `publishTrip`
- `startTrip`

Permitir:

- ver viajes ya existentes
- completar gestion administrativa no bloqueada
- consultar historial y confianza

### 8.4 `SUSPENDED`

Bloquear:

- `createTrip`
- `publishTrip`
- `startTrip`
- `createTripRequest`

Permitir:

- login
- consulta de perfil
- consulta de confianza e historial
- lectura de estado de sancion

---

## 9. Requisitos de auditoria

Toda sancion debe registrar al menos:

- tipo de sancion
- motivo
- fecha de inicio
- fecha de fin, si aplica
- ventana de evaluacion usada
- evento disparador
- si fue automatica o administrativa

---

## 10. Reglas de experiencia de usuario

- el usuario debe ver un mensaje claro explicando por que fue restringido
- el mensaje debe indicar si la sancion afecta el rol de pasajero, conductor o ambos
- debe mostrarse fecha estimada de finalizacion cuando exista
- la web no debe ofrecer acciones que el backend ya no permitira

---

## 11. Alcance de implementacion recomendado

### 11.1 Entra en la primera implementacion

- calculo de reincidencia por ventanas de tiempo
- creacion de sancion activa
- bloqueos en endpoints segun tipo
- visualizacion de estado en web
- auditoria

### 11.2 Se aplaza para una version posterior

- score numerico de reputacion
- severidad diferenciada por tipo de reporte
- apelaciones o levantamiento manual avanzado
- sanciones permanentes
- ponderaciones complejas por historial largo

---

## 12. Recomendacion final

La politica V1 debe implementarse como:

- reputacion informativa por un lado
- sancion operativa por otro lado

Esto permite mantener el sistema explicable, testeable y facil de endurecer despues sin rehacer toda la base de reglas.
