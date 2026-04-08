# SafeRidePro - Stack tecnologico

> Documento de referencia con las herramientas y tecnologias propuestas para el proyecto.
> Ultima revision: 2026-03-26

---

## 1. Base del proyecto

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Runtime | Node.js | 20.19+ | Actual |
| Lenguaje | TypeScript | 5.x | Actual |
| Gestor de paquetes | pnpm | 10.x | Actual |
| Monorepo | Turborepo | 2.x | Actual |

---

## 2. Frontend web

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Framework web | Next.js | 16.x | Actual |
| UI web | Tailwind CSS | 4.x | Actual |
| Componentes UI | shadcn/ui | latest | Actual |
| Formularios | React Hook Form | 7.x | Actual |
| Validacion | Zod | 4.x | Actual |
| Testing de componentes | React Testing Library | latest | Actual |
| E2E web | Playwright | 1.x | Actual |

---

## 3. Aplicacion movil

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Framework movil | React Native | 0.83+ | Futuro cercano |
| Tooling movil | Expo | SDK 55+ | Futuro cercano |
| UI movil | NativeWind | 4.x | Futuro cercano |
| Build Android | EAS Build | latest | Futuro cercano |
| Notificaciones movil | Expo Notifications | latest | Futuro cercano |
| E2E movil | Maestro | latest | Futuro cercano |

---

## 4. Backend

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Framework backend | NestJS | 11.x | Actual |
| API | REST | - | Actual |
| Tiempo real | SSE autenticado sobre fetch streaming | - | Actual |
| Documentacion API | Swagger / OpenAPI | latest | Actual |
| Testing API | Jest | 30.x | Actual |
| Integracion API | Supertest | 7.x | Actual |

---

## 5. Base de datos y persistencia

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Base de datos principal | PostgreSQL | 16.x | Actual |
| ORM | Prisma ORM | 6.x | Actual |
| Cache / colas | Redis | 7.x | Futuro cercano |
| Jobs / colas | BullMQ | 5.x | Futuro cercano |
| Archivos y evidencias | S3 compatible storage | latest | Actual si hay uploads |

---

## 6. Mapas, ubicacion y rutas

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Plataforma geografica | Geoapify | latest | Actual |
| Mapa web | Leaflet | 1.9.x | Actual |
| Busqueda de lugares | Geoapify Geocoding Autocomplete | latest | Actual |
| Geocodificacion | Geoapify Geocoding API | latest | Actual |
| Calculo visual de trayecto | Polyline en mapa web | - | Actual |
| Tracking en vivo | GPS + WebSockets | - | Futuro cercano |

---

## 7. Autenticacion y seguridad

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Autenticacion | JWT | latest | Actual |
| Sesion extendida | Refresh Tokens | latest | Actual |
| Hash de contrasenas | bcrypt | latest | Actual |
| Autorizacion | RBAC | - | Actual |
| Validacion de entrada | class-validator / class-transformer | latest | Actual |
| Rate limiting | @nestjs/throttler | latest | Actual |

---

## 8. Comunicacion y notificaciones

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Correo transaccional | Resend | latest | Actual |
| Push notifications | Firebase Cloud Messaging | v1 | Futuro cercano |

---

## 9. Calidad y analisis estatico

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Linting | ESLint | 9.x | Actual |
| Formato | Prettier | 3.x | Actual |
| Git hooks | Husky | 9.x | Actual |
| Pre-commit | lint-staged | 16.x | Actual |

---

## 10. Infraestructura y despliegue

| Area | Herramienta | Version aprox. | Estado |
|---|---|---|---|
| Contenedores | Docker | 28.x | Actual |
| Orquestacion local | Docker Compose | 2.x | Actual |
| CI/CD | GitHub Actions | latest | Actual |
| Deploy web | Vercel | latest | Actual |
| Deploy backend | Railway o Render | latest | Actual |
| Deploy movil | EAS Build | latest | Futuro cercano |

---

## 11. Herramientas descartadas por ahora

| Herramienta | Motivo |
|---|---|
| DeUna / PayPal | El alcance actual no incluye pagos dentro de la app. |
| k6 | Se puede incorporar cuando existan flujos productivos estables y endpoints listos para pruebas de carga. |
| OWASP ZAP | Conveniente mas adelante en una etapa previa a despliegue real o beta cerrada. |
| SonarQube | Opcional; no es obligatorio en la primera etapa. |

---

## 12. Notas de alcance

- El codigo fuente debe estar en ingles.
- El contenido visible para el usuario debe estar en espanol.
- La base de datos debe mantenerse normalizada al menos hasta 3NF.
- El stack contempla web como base actual y mobile como siguiente etapa.
- El uso de coordenadas exactas queda considerado dentro del stack.
- El calculo de precio por desvio se resuelve en logica de negocio; no requiere pasarela de pagos por ahora.
