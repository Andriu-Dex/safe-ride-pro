# 00_INDICE_PRUEBAS

## Objetivo

Centralizar la documentacion viva de pruebas de `SafeRidePro` en una carpeta separada dentro de `Docs`, con una estructura compatible con buenas practicas inspiradas en `IEEE 829` e `ISO/IEC/IEEE 29119`, pero adaptada al estado real del proyecto.

---

## Documentos de esta carpeta

- `01_PLAN_DE_PRUEBAS.md`
  - documento marco del proceso de pruebas
  - define alcance, enfoque, tipos de testing, roles, riesgos y criterios de entrada/salida

- `02_DISENO_PRUEBAS_INTEGRACION_Y_SISTEMA.md`
  - aterriza el plan en suites concretas
  - organiza escenarios de integracion, sistema y QA manual transversal

- `03_REPORTE_EJECUCION_QA.md`
  - plantilla viva para registrar ejecucion, hallazgos, evidencia y conclusion de una pasada de QA

---

## Relacion con otros documentos del proyecto

Esta carpeta no reemplaza la documentacion funcional u operativa principal.

Debe leerse junto con:

- `Docs/00_REQUERIMIENTOS_BASE.md`
- `Docs/02_PROTOCOLO_FUNCIONAL_V2.md`
- `Docs/04_POLITICAS_Y_REGLAS_OPERATIVAS.md`
- `Docs/07_ENTORNO_QA_DEPLOY.md`
- `Docs/08_RELEASE_READINESS_WEB.md`
- `Docs/09_CHECKLIST_QA_WEB_RELEASE.md`
- `Docs/10_HANDOFF_ESTADO_ACTUAL_Y_PENDIENTES.md`

---

## Uso recomendado

1. usar `01_PLAN_DE_PRUEBAS.md` como documento rector
2. usar `02_DISENO_PRUEBAS_INTEGRACION_Y_SISTEMA.md` para planificar y ejecutar suites
3. usar `03_REPORTE_EJECUCION_QA.md` para registrar cada corrida importante
4. mantener `Docs/09_CHECKLIST_QA_WEB_RELEASE.md` como checklist rapido de smoke y cierre transversal

---

## Nota de criterio

La estructura de pruebas de `SafeRidePro` debe priorizar:

- trazabilidad entre requerimientos, riesgos y pruebas
- consistencia entre estados del dominio
- validacion real de integraciones web, API y base de datos
- evidencia reproducible para demo, evaluacion academica y cierre de release
