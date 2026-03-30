# SafeRidePro - Propuesta V1 de reputacion fina y reincidencia

## 1. Objetivo

Definir una politica mas fina para interpretar el comportamiento historico de los usuarios sin volver opaco el sistema.

Esta propuesta busca:

- separar reputacion visible de sancion operativa
- evitar castigos automaticos por eventos ambiguos
- endurecer reincidencia reciente con reglas explicables
- permitir escalamiento progresivo antes de llegar a una suspension fuerte

---

## 2. Principios de diseno

- la reputacion no debe depender de una sola calificacion aislada
- las sanciones automaticas deben activarse principalmente por eventos objetivos
- los eventos subjetivos, como calificaciones o reportes, deben influir primero en revision y seguimiento
- la reincidencia reciente pesa mas que el historial antiguo
- un usuario debe poder recuperarse con buen comportamiento sostenido
- el sistema debe explicar con claridad por que una cuenta fue observada, advertida o restringida

---

## 3. Separacion de conceptos

### 3.1 Reputacion visible

Es informativa. Sirve para:

- mostrar confianza general
- dar contexto a otros usuarios
- ayudar a priorizar revisiones administrativas

No debe bloquear por si sola al usuario.

### 3.2 Riesgo operativo

Es evaluativo. Sirve para:

- detectar reincidencia
- activar advertencias
- decidir restricciones automaticas
- derivar casos a revision administrativa

### 3.3 Sancion operativa

Es la consecuencia. Sirve para:

- bloquear acciones concretas
- limitar temporalmente la operacion
- proteger a otros usuarios y a la institucion

---

## 4. Variables que componen la reputacion fina

### 4.1 Indicadores positivos

- viajes completados
- solicitudes completadas sin incidentes
- calificaciones altas consistentes
- periodos recientes sin no-show ni cancelaciones tardias

### 4.2 Indicadores de riesgo objetivo

- `passenger_no_show`
- `late_passenger_request_cancellation`
- `late_driver_trip_cancellation`
- viajes cancelados despues de aceptar pasajeros
- sanciones operativas previas dentro de una ventana reciente

### 4.3 Indicadores de riesgo semisubjetivo

- reportes resueltos
- calificacion promedio baja sostenida
- patron repetido de comentarios negativos coherentes

### 4.4 Indicadores que no deben castigar solos

- una sola estrella baja
- un solo reporte resuelto
- un usuario nuevo con pocas calificaciones

---

## 5. Ventanas temporales propuestas

- comportamiento operativo reciente: ultimos `30` dias
- reincidencia de sanciones previas: ultimos `90` dias
- reportes resueltos: ultimos `60` dias
- reputacion visible por ratings: ultimos `90` dias, o historial disponible si hay pocas muestras

Estas ventanas permiten detectar patrones reales sin congelar para siempre errores muy viejos.

---

## 6. Reglas de reputacion visible

### 6.1 Promedio visible

Mostrar:

- promedio de calificaciones
- numero de calificaciones
- viajes completados
- cancelaciones tardias recientes
- no-show recientes

### 6.2 Umbral minimo para interpretar ratings

No usar el promedio de estrellas como señal fuerte hasta que exista al menos:

- `3` calificaciones recibidas
- y `5` interacciones completadas relacionadas

Antes de eso, el sistema debe mostrar reputacion inicial o en construccion.

### 6.3 Estados visibles sugeridos

- `En construccion`
- `Confiable`
- `Con observaciones`
- `En revision`
- `Restringido`

Estos estados no reemplazan la sancion formal, pero ayudan a comunicar el contexto.

---

## 7. Reglas de reincidencia

### 7.1 Reincidencia simple

Existe cuando el mismo tipo de evento ocurre varias veces en la ventana definida.

Ejemplos:

- varios `no-show` en 30 dias
- varias cancelaciones tardias en 30 dias
- varias sanciones del mismo tipo en 90 dias

### 7.2 Reincidencia agravada

Existe cuando:

- un usuario ya tuvo una sancion activa o recien expirada
- y vuelve a cometer el mismo patron en la siguiente ventana

Propuesta:

- si un usuario reincide dentro de `90` dias desde una sancion previa del mismo alcance, la siguiente duracion se duplica una sola vez

Ejemplo:

- primer `LIMITED_PASSENGER`: `7` dias
- reincidencia cercana del mismo patron: `14` dias

### 7.3 Reincidencia combinada

Existe cuando se mezclan varias señales de riesgo aunque no sean identicas.

Ejemplos:

- `2` no-show y `1` reporte resuelto en una ventana corta
- `2` cancelaciones tardias como conductor y rating consistentemente bajo

En esta version, la reincidencia combinada no debe suspender automaticamente, pero si:

- activar `UNDER_REVIEW`
- generar auditoria
- priorizar revision administrativa

---

## 8. Politica de ratings bajos

### 8.1 Que no se debe hacer

No suspender automaticamente a un usuario solo porque:

- tenga una mala calificacion aislada
- tenga un promedio bajo con muy pocas muestras

### 8.2 Cuando si debe preocupar

El rating debe activar observacion cuando:

- el promedio sea menor a `3.5`
- existan al menos `3` calificaciones
- y ademas exista otra senal de riesgo reciente

### 8.3 Que accion tomar

En esta version:

- ratings bajos sostenidos generan `Con observaciones`
- ratings bajos mas otro riesgo reciente generan `En revision`
- solo si eso se combina con eventos objetivos o reportes resueltos debe escalar a sancion o revision formal

---

## 9. Politica de reportes resueltos

### 9.1 Naturaleza del reporte resuelto

Un reporte resuelto indica que un admin ya valido un incidente.

Por eso:

- pesa mas que una estrella baja
- pero no todos los reportes resueltos deben equivaler automaticamente a una suspension permanente

### 9.2 Regla propuesta

- `1` reporte resuelto en 60 dias: `En revision`
- `2` reportes resueltos en 60 dias: suspension temporal automatica segun politica V1 ya aprobada
- `3` o mas: suspension mas larga y revision obligatoria

### 9.3 Evolucion futura

Mas adelante convendra diferenciar gravedad:

- conducta insegura
- fraude
- acoso
- impuntualidad
- conflicto menor

Pero no es obligatorio para esta version.

---

## 10. Politica de recuperacion de confianza

La reputacion debe poder mejorar.

Propuesta:

- si el usuario completa `5` interacciones limpias seguidas sin incidentes recientes, su estado visible puede mejorar
- los eventos viejos salen naturalmente de la ventana y dejan de afectar reincidencia
- una sancion expirada no debe bloquear por si sola, pero si contar como antecedente cercano en la ventana de `90` dias

---

## 11. Estados administrativos sugeridos

- `NORMAL`
- `OBSERVED`
- `UNDER_REVIEW`
- `RESTRICTED`

### 11.1 Significado

- `NORMAL`: sin señales graves recientes
- `OBSERVED`: hay senales leves o tempranas
- `UNDER_REVIEW`: hay mezcla de riesgo o reincidencia que requiere mirada admin
- `RESTRICTED`: existe sancion operativa activa

Estos estados ayudan a priorizar paneles administrativos y auditoria.

---

## 12. Reglas recomendadas para V1.1

### 12.1 Automatico

Mantener automatico solo para:

- `no-show`
- cancelaciones tardias
- reincidencia directa de esos eventos
- multiples reportes resueltos ya aprobados

### 12.2 Semiautomatico

Activar revision, no bloqueo directo, cuando exista:

- rating menor a `3.5` con muestra suficiente
- rating bajo sostenido mas otro riesgo reciente
- mezcla de eventos diferentes en ventanas cortas

### 12.3 Manual

Requerir intervencion administrativa para:

- extension extraordinaria de suspension
- apelaciones
- clasificacion de gravedad alta
- bloqueo excepcional por patron peligroso no cubierto por reglas basicas

---

## 13. Recomendacion de implementacion

### 13.1 Primera bajada tecnica

Agregar, sin sobreingenieria:

- resumen visible de reputacion
- estado administrativo de riesgo
- conteo de sanciones previas recientes
- regla de reincidencia agravada por ventana de `90` dias
- disparador `UNDER_REVIEW` para mezcla de riesgos

### 13.2 No implementar todavia

- score numerico unico tipo `72/100`
- formulas opacas con pesos decimales
- sanciones permanentes automaticas
- dependencia excesiva de ratings como fuente principal de castigo

---

## 14. Recomendacion final

Para SafeRidePro, la siguiente etapa deberia quedar asi:

- `reputacion visible`: informativa y comprensible
- `riesgo operativo`: evaluacion interna por ventanas
- `sancion operativa`: restriccion concreta y temporal
- `revision administrativa`: capa intermedia para casos combinados o ambiguos

Este enfoque mantiene el sistema explicable, academico, defendible ante revisores y facil de evolucionar despues.
