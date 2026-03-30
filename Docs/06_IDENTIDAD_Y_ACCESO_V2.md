# 06. Identidad y Acceso V2

Esta fase abre la etapa post-MVP del producto web completo y deja listo el bloque base de acceso para usuarios reales nuevos.

## Alcance

- registro con correo institucional desde web
- verificacion por codigo enviado al correo
- reenvio de codigo de verificacion
- inicio de sesion con renovacion controlada de sesion
- cierre de sesion
- recuperacion y restablecimiento de contrasena
- auditoria de eventos de acceso
- proteccion basica frente a abuso de autenticacion

## Endpoints principales

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification-code`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

## Variables de entorno

### API

- `JWT_SECRET`
- `ACCESS_TOKEN_TTL_MINUTES`
- `REFRESH_TOKEN_TTL_DAYS`
- `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES`
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `AUTH_RESEND_COOLDOWN_SECONDS`
- `AUTH_FAILED_ATTEMPT_LIMIT`
- `AUTH_FAILED_ATTEMPT_WINDOW_MINUTES`
- `AUTH_ALLOW_DEBUG_CODES`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`

### Web

- `NEXT_PUBLIC_API_BASE_URL`

## Modos de entrega de codigo

### Desarrollo

Si `AUTH_ALLOW_DEBUG_CODES=true`, el backend puede devolver el codigo de verificacion o de recuperacion para facilitar pruebas locales, QA y E2E.

### Correo real

Si `RESEND_API_KEY` y los datos de remitente estan configurados, el sistema envia los codigos por correo mediante Resend.

## Decisiones vigentes

- el acceso sigue restringido por dominios institucionales permitidos
- `studentCode` se genera internamente y no se solicita al usuario
- la verificacion de correo es obligatoria antes de operar
- el codigo fuente se mantiene en ingles
- el contenido visible al usuario se mantiene en espanol

## Siguiente fase

Una vez estabilizada esta capa, la siguiente fase funcional es `Profile & Institutional Onboarding`.
