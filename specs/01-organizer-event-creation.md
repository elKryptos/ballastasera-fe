# SPEC 01 — Creación de eventos por organizadores verificados

> **Estado:** Aprobado
> **Depende de:** Ninguna spec de este repo. Depende de APIs ya existentes en el backend (`ballastasera-be`, branch `main`, commit `078be43`).
> **Fecha:** 2026-09-14
> **Objetivo:** Permitir que un organizador verificado cree un evento, añada opcionalmente un flyer y lo publique desde el frontend, consumiendo únicamente las APIs que el backend expone hoy.

---

## Por qué existe esta spec

El frontend no tiene ninguna pantalla de creación de eventos: `features/events/create-event/` es un scaffold vacío sin ruta. El backend ya soporta el ciclo completo crear → flyer → publicar para un organizador verificado. Esta spec cubre exactamente ese flujo y nada más: el trabajo de administración de organizadores que está en `main` pertenece a otro compañero y no se toca.

El backend impone dos límites que moldean el diseño: `POST /rest/events` fuerza el estado `PENDING` y no existe ningún endpoint que liste los eventos propios no publicados. Por eso el flujo navega a una ruta con el ID del evento creado: si el usuario recarga, no pierde el acceso; y "Annulla" elimina el evento para no dejar PENDING huérfanos.

---

## Scope

**In:**

- Ruta `/organizer/events/new` (etapa 1: datos del evento) protegida por `featureFlagGuard('createEventPage')` + `roleGuard('ORGANIZER')`.
- Ruta `/organizer/events/:id/publish` (etapa 2: flyer opcional + publicación) con los mismos guards.
- Feature flag nuevo `createEventPage` en `feature-flags.ts` y los tres environment files.
- Enlace `Crea evento` en el navbar, visible solo con `*appRole="'ORGANIZER'"`.
- Selector de organizadores propios verificados (`GET /rest/organizers/me`, filtra `verified === true`). Bloquea el formulario con mensaje si no hay ninguno; preselecciona si hay uno solo.
- Formulario por etapas en una sola página (etapa 1): organizer, título, tipo (`EVENT | SCHOOL | CLUB | BAR`), descripción, ciudad (select), venue existente opcional filtrado por ciudad, dirección libre si no hay venue, estilos de baile (chips checkbox), fecha/hora inicio y fin, toggle gratuito + precio (moneda fija `EUR`), Instagram y WhatsApp opcionales.
- Creación con `POST /rest/events` y navegación a la etapa 2 con el ID devuelto.
- Flyer opcional: validación client-side (JPEG/PNG/WebP, máx. 10 MB), upload multipart, polling de `flyerStatus` hasta `READY` o `FAILED` (timeout 60 s, luego botón de refresco manual), reintento sin repetir el POST.
- Publicación explícita con `PATCH /rest/events/{id}/status` y body `{ "status": "PUBLISHED" }`.
- Cancelación posterior a la creación: `HlmAlertDialog` de confirmación + `DELETE /rest/events/{id}`.
- Pantalla final de confirmación con botones `Crea un altro` y `Vai alla mappa`.
- Test unitario del componente/servicio en `create-event.spec.ts`.

**Out of scope (para futuras specs):**

- Onboarding, edición o borrado del perfil de organizador (lo está haciendo el compañero).
- Cualquier página bajo `/admin/**`, sus flags y sus servicios.
- Correcciones al trabajo admin ya en `main` (flags faltantes en development, paginación, admin-home).
- Creación/edición de venues (solo consumo del listado existente).
- Edición completa de eventos (el backend no devuelve `status`, `cityId`, `venueId` ni `danceStyleIds` en el detalle).
- Listado de eventos PENDING/DRAFT propios (no existe endpoint).
- Event series (`seriesId` nunca se envía).
- Favoritos, asistencia y detalle público de evento.
- Cambios en el backend de ningún tipo.

---

## APIs del backend utilizadas

Todas las rutas ya están declaradas en `src/app/core/api/endpoints.ts`; esta spec **no** modifica ese archivo. Estas APIs son dependencias/ supuestos, no funcionalidad del frontend.

| Operación | Endpoint | Cuándo se usa |
|---|---|---|
| Organizadores propios | `GET /rest/organizers/me` (JWT) | Cargar selector; se muestran solo `verified === true` |
| Ciudades | `GET /rest/cities` (público) | Select de ciudad |
| Estilos de baile | `GET /rest/dance-styles` (público) | Chips multiselección |
| Venues por ciudad | `GET /rest/venues?cityId={id}` (público) | Venue opcional tras elegir ciudad |
| Crear evento | `POST /rest/events` (JWT + organizer propio + verificado) | Etapa 1; devuelve `201 EventDetailDto` con el evento en `PENDING` |
| Detalle de evento | `GET /rest/events/{id}` (público) | Recuperar la etapa 2 al recargar |
| Subir flyer | `PATCH /rest/events/{id}/flyer` (JWT + dueño, multipart campo `file`) | Etapa 2, opcional |
| Publicar | `PATCH /rest/events/{id}/status` (JWT + dueño) | Body `{ "status": "PUBLISHED" }` |
| Eliminar evento | `DELETE /rest/events/{id}` (JWT + dueño) | Solo desde `Annulla` en etapa 2 |

Errores de backend que la UI debe manejar: `400` (validación, `endAt <= startAt`, dirección no geocodificable), `403` (organizer no verificado o no propio), `415` (flyer de tipo no válido), `413` implícito por límite de 10 MB.

---

## Data model

```ts
// src/app/core/models/event.model.ts (añadidos)
export type EventStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CANCELLED';
export type FlyerStatus = 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';

export interface EventDetailDto {
  id: string;
  slug: string;
  title: string;
  eventType: EventType;
  description: string | null;
  flyerUrl: string | null;
  flyerStatus: FlyerStatus;
  startAt: string;          // ISO OffsetDateTime
  endAt: string;
  liveNow: boolean;
  free: boolean;            // el backend serializa "free", no "isFree"
  price: number | null;
  currency: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cityName: string;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  organizer: OrganizerDetailDto;
  venueName: string | null;
  danceStyles: string[];    // nombres, no IDs
  goingCount: number;
  interestedCount: number;
}

export interface EventCreateDto {
  organizerId: string;
  venueId: string | null;   // null si el usuario no eligió venue
  cityId: number;
  title: string;
  eventType: EventType;
  description: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  startAt: string;          // OffsetDateTime con offset local del navegador
  endAt: string;
  free: boolean;
  price: number | null;     // null cuando free === true
  currency: string;         // siempre 'EUR'
  address: string;
  danceStyleIds: number[];
  // flyerUrl, seriesId, latitude y longitude NUNCA se envían:
  // el flyer se sube en la etapa 2, no hay series, y la dirección
  // se geocodifica en el backend.
}

export interface EventStatusUpdateDto {
  status: EventStatus;
}
```

```ts
// src/app/core/models/venue.model.ts (nuevo)
export interface VenuesSummaryDto {
  id: string;
  name: string;
  address: string;
  cityName: string;
  latitude: number;
  longitude: number;
}
```

Convenciones: el formulario trabaja con `datetime-local` y convierte a `OffsetDateTime` ISO con el offset del navegador en el momento del submit. Las señales de estado de plantilla son `protected` y con `signal()`, según la convención del repo.

---

## Plan de implementación

1. Añadir la flag `createEventPage` a `src/app/core/config/feature-flags.ts` y a los tres environment files (`true` en development y staging, `false` en producción). Verificación manual: el typecheck no reporta la flag nueva como faltante.
2. Ampliar `src/app/core/models/event.model.ts` con `EventStatus`, `FlyerStatus`, `EventDetailDto`, `EventCreateDto`, `EventStatusUpdateDto` y crear `src/app/core/models/venue.model.ts` con `VenuesSummaryDto`.
3. Crear `src/app/core/services/organizers.service.ts` (`getMyOrganizers()` → `OrganizerDetailDto[]`), `src/app/core/services/venues.service.ts` (`listByCity(cityId)` → `VenuesSummaryDto[]`) y ampliar `src/app/core/services/events.service.ts` con `getEventDetail(id)`, `createEvent(dto)`, `updateEventStatus(id, status)`, `updateFlyer(id, file)` (FormData, sin `Content-Type` manual) y `deleteEvent(id)`.
4. Registrar en `src/app/app.routes.ts` las rutas `organizer/events/new` y `organizer/events/:id/publish` con `featureFlagGuard(FEATURE_FLAGS.createEventPage)` + `roleGuard('ORGANIZER')`, y añadir `{ path: 'organizer/**', renderMode: RenderMode.Client }` en `src/app/app.routes.server.ts`.
5. Implementar la etapa 1 en `features/events/create-event/` (reemplaza el scaffold): carga paralela de organizadores/ciudades/estilos, selector de verificados, formulario reactivo con validaciones (título requerido, `endAt > startAt`, precio ≥ 0 si no es gratuito, dirección requerida sin venue), y `POST` + navegación a la etapa 2. Reutilizar `HlmButton`, `HlmSelectImports`, `hlmInput`, `hlmLabel`.
6. Implementar la etapa 2 (`pubblica`): recuperación por `GET /rest/events/{id}`, upload de flyer con validación y polling de `flyerStatus`, botón `Pubblica`, `Annulla` con `HlmAlertDialog` + `DELETE`, y pantalla final de confirmación con `Crea un altro` y `Vai alla mappa`.
7. Añadir el enlace `Crea evento` en `shared/navbar/navbar.html` + `navbar.ts`, envuelto en el directive `*appRole` existente.
8. Añadir `features/events/create-event/create-event.spec.ts` con tests de: mapeo del formulario a `EventCreateDto` (`free`, no `isFree`; conversión de fechas), exclusión de organizers no verificados y validación `endAt > startAt`.

---

## Criterios de aceptación

- [ ] `/organizer/events/new` y `/organizer/events/:id/publish` solo cargan para rol `ORGANIZER`; un `USER` o anónimo cae al redirect `**`.
- [ ] Con `createEventPage` en `false` en un environment, ninguna de las dos rutas matchea.
- [ ] El selector muestra únicamente organizers con `verified === true`; si no hay ninguno, se muestra un mensaje y no hay formulario.
- [ ] Con un solo organizer verificado, este queda preseleccionado sin interacción.
- [ ] Al elegir ciudad se cargan sus venues (`GET /rest/venues?cityId=...`); al elegir venue se usa su `id`; al deseleccionarlo se envía `venueId: null`.
- [ ] Si no se elige venue, se envía `address` y no se envían `latitude`/`longitude`.
- [ ] `startAt` y `endAt` se envían como ISO OffsetDateTime y `endAt > startAt`; el formulario bloquea el envío en caso contrario.
- [ ] Un evento de pago envía `price >= 0` y `currency: 'EUR'`; uno gratuito envía `free: true` y `price: null`.
- [ ] El JSON enviado usa la clave `free` (nunca `isFree`) y no incluye `flyerUrl`, `seriesId`.
- [ ] Tras un `POST` exitoso la URL cambia a `/organizer/events/{id}/publish`; recargar esa URL recupera el evento con `GET /rest/events/{id}`.
- [ ] El flyer es opcional: se puede publicar sin subirlo; acepta JPEG/PNG/WebP y rechaza otros tipos o > 10 MB con mensaje en italiano.
- [ ] Si el upload falla, se puede reintentar sin que se ejecute un segundo `POST /rest/events`.
- [ ] `Pubblica` envía exactamente `PATCH /rest/events/{id}/status` con body `{ "status": "PUBLISHED" }`; tras el 200 se muestra la confirmación.
- [ ] `Annulla` tras crear pregunta con un alert dialog y, al confirmar, ejecuta `DELETE /rest/events/{id}` y vuelve a la etapa 1.
- [ ] La pantalla final ofrece `Crea un altro` (vuelve a etapa 1 vacía) y `Vai alla mappa` (navega a `/mappa`).
- [ ] `organizer/**` está en `RenderMode.Client` en `app.routes.server.ts` (no hay ruta `organizer` suelta).
- [ ] `pnpm build` (production) compila y el test `pnpm test --watch=false --filter "CreateEvent"` pasa.

---

## Decisiones

- **Sí:** flujo por etapas con ruta con ID (`/{id}/publish`). Es la única forma de sobrevivir a una recarga, dado que no existe listado de eventos propios.
- **Sí:** `Annulla` elimina el evento PENDING. Evita huérfanos inalcanzables; se confirma con alert dialog.
- **Sí:** selector solo con organizers verificados. El backend rechaza con `403` cualquier otra opción; mostrarlos sería un error garantizado.
- **Sí:** rutas en inglés (`/organizer/events/new`, `/organizer/events/:id/publish`), sin italiano ni español. El copy de la UI sigue siendo italiano; las URLs no.
- **Sí:** imports con alias `@/*` (`@/core/...`, `@/shared/...`) en vez de cadenas de `../..`. Mapeado en `tsconfig.json`.
- **Sí:** flyer opcional. El backend permite publicar sin flyer y la conversión WebP es asíncrona.
- **Sí:** reintento de flyer/publicación conservando el ID. Repetir el `POST` crearía duplicados.
- **Sí:** moneda fija `EUR`. El producto está orientado a Italia; un selector añade superficie sin valor.
- **Sí:** dirección libre con geocoding del backend cuando no hay venue. Menos complejidad que un mini-mapa, y el BE ya lo resuelve.
- **No:** creación/edición de venues. Falta `GET /rest/venues/{id}` para hidratar una edición; va en otra spec cuando el BE lo soporte.
- **No:** edición de eventos ni listado de PENDING/DRAFT. `EventDetailDto` no expone `status` ni los IDs necesarios; requiere cambios de backend primero.
- **No:** mini-mapa para coordenadas del evento. El geocoding del backend cubre el caso; el mapa solo tiene sentido para venues.
- **No:** tocar `/admin/**`, flags admin ni `endpoints.ts`. El trabajo admin es del compañero y todas las rutas necesarias ya están declaradas. (Excepción: las 2 flags faltantes de `environment.development.ts`, ver abajo.)
- **No:** event series, favoritos, asistencia, detalle público. Cada uno merece spec propia.
- **Sí:** reparar `environment.development.ts` durante la implementación (2 flags admin que faltaban). Las decisiones del plan decían dejarlo fuera, pero `pnpm test` compila ese archivo y sin reparación ningún test pasa. Notado para coordinar con el compañero.
- **Sí:** `--filter` de Vitest matchea el título del suite (componente), no el nombre del archivo: el criterio usa `--filter "CreateEvent"`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `EventDetailDto` no devuelve `status`; tras publicar no se puede confirmar leyendo el evento | La UI considera publicado cuando `PATCH /status` responde 200; nunca muestra un badge de estado leído del backend |
| Un PENDING puede quedar huérfano si el usuario abandona sin publicar ni cancelar | Ruta con ID recuperable + `Annulla` con borrado; el riesgo residual se documenta, no se resuelve en FE |
| El polling del flyer puede no terminar (procesamiento lento) | Timeout de 60 s y botón manual de refresco; `FAILED` permite reintentar |
| `environment.development.ts` no compilaba por flags admin faltantes (trabajo del compañero) | Se añadieron `verifiedOrganizersPage`/`updateOrganizerPage` en `true` durante la implementación: `pnpm test` compila ese archivo y el criterio de tests lo exigía. Cambio mecánico de 2 líneas, sin lógica |
| `roleGuard` lee el JWT de localStorage, invisible en SSR | Las rutas nuevas van en `RenderMode.Client`, como ya hace `admin/**` |
| CORS del backend solo permite `PATCH` con `Authorization`/`Content-Type` | El multipart se envía como `FormData` sin fijar `Content-Type` manual |

---

## What is **not** in this spec

- Onboarding y perfil de organizador (spec del compañero).
- Administración de organizadores y sus correcciones.
- CRUD de venues y mini-mapa de venues.
- Edición de eventos, listado de borradores, moderación.
- Event series, favoritos, asistencia, detalle público de evento.
- Cualquier cambio en `ballastasera-be`.

Cada uno de esos, si aterriza, va en su propia spec.
