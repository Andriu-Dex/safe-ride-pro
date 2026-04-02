# Incidente temporal: carga de documentos en Driver Onboarding

## Resumen

Durante la implementacion de `Driver Onboarding`, la carga de documentos del conductor presento un comportamiento anomalo en el navegador:

- el explorador de archivos se abria correctamente
- el usuario seleccionaba una imagen o PDF
- al confirmar, la pantalla parpadeaba
- el archivo no quedaba seleccionado
- al abrir el inspector del navegador, el problema a veces desaparecia

Esto hacia pensar inicialmente que el problema estaba en el selector de archivos o en el endpoint de subida, pero la causa real estuvo en otra capa.

## Causa raiz

La causa principal fue la resincronizacion automatica de sesion dentro de `AuthProvider`.

El frontend ejecutaba una sincronizacion del usuario autenticado en estos eventos:

- `window.focus`
- `document.visibilitychange`
- intervalo periodico

Cuando el usuario cerraba el explorador de archivos del sistema operativo, la ventana recuperaba el foco. En ese momento, el `AuthProvider` lanzaba una resincronizacion, lo que podia provocar un rerender o una resinicializacion de la vista justo antes de que el `input[type="file"]` terminara de propagar el archivo seleccionado.

Ese comportamiento explicaba:

- el parpadeo visible
- la perdida del archivo seleccionado
- la diferencia de comportamiento al abrir el inspector

## Senales que ayudaron a aislarlo

- el selector de archivos si se abria
- el error ocurria exactamente al volver del dialogo del sistema
- el problema no dependia del endpoint final
- el comportamiento cambiaba al modificar el foco de la ventana

## Solucion aplicada

Se aplicaron estas medidas:

1. Se mantuvo el uso de `input[type="file"]` nativo para la carga de documentos.
2. Se creo una proteccion temporal de resincronizacion en:
   - `apps/web/src/modules/auth/lib/auth-sync-guard.ts`
3. `AuthProvider` ahora omite la resincronizacion automatica si el sistema detecta que acaba de abrirse un selector de archivos.
4. Antes de abrir el selector, los componentes de carga invocan `suppressAuthSessionSync()`.
5. La carga real de documentos del conductor quedo integrada en el flujo principal, ya sin bloques temporales de diagnostico.

## Archivos relacionados con la solucion

- `apps/web/src/modules/auth/components/auth-provider.tsx`
- `apps/web/src/modules/auth/lib/auth-sync-guard.ts`
- `apps/web/src/modules/driver/components/driver-application-form.tsx`
- `apps/web/src/app/(app)/conductor/page.tsx`

## Leccion tecnica

En interfaces con seleccion de archivos, no se debe asumir que los eventos de `focus` y `visibilitychange` son inocuos. Si existe una resincronizacion agresiva de sesion o datos, esa logica puede interferir directamente con la confirmacion del archivo seleccionado.

## Recomendacion para futuras implementaciones

Si una vista incluye:

- uploads de archivos
- dialogos del sistema
- o interacciones que sacan temporalmente el foco del navegador

entonces debe revisarse cualquier logica global que dependa de:

- `focus`
- `visibilitychange`
- refrescos automaticos inmediatos

antes de asumir que el problema pertenece al componente visual.
