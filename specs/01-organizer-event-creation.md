# SPEC 01 — Creación de eventos por organizadores verificados

> **Estado:** Approvato
> **Depende de:** Ninguna spec de este repo. Depende de `ballastasera-be/specs/06-organizer-event-management.md`.
> **Fecha:** 2026-09-14
> **Objetivo:** Permitir que un organizador verificado cree un evento, añada opcionalmente un flyer y lo publique desde el frontend, consumiendo únicamente las APIs que el backend expone hoy.

---

## Por qué existe esta spec

El frontend implementa el ciclo crear → flyer → publicar para un organizador verificado. Esta spec cubre exactamente ese flujo y nada más: el trabajo de administración de organizadores que está en `main` pertenece a otro compañero y no se toca.

El backend impone dos límites que moldean el diseño: `POST /rest/events` fuerza el estado `PENDING` y el detalle público solo expone eventos `PUBLISHED`. Por eso el flujo navega a una ruta con el ID del evento creado y recupera el estado privado con `GET /rest/events/{id}/manage`; "Annulla" elimina el evento para no dejar PENDING huérfanos.

---

## Scope

**In:**

- Ruta `/organizer/events/new` (etapa 1: datos del evento) protegida por `featureFlagGuard('createEventPage')` + `roleGuard('ORGANIZER')`.
- Ruta `/organizer/events/:id/publish` (etapa 2: flyer opcional + publicación) con los mismos guards.
- Feature flag nuevo `createEventPage` en `feature-flags.ts` y los tres environment files.
- Enlace `Crea evento` en el navbar, visible solo con `*appRole="'ORGANIZER'"`.
- Selector de organizadores propios verificados (`GET /rest/organizers/me`, filtra `verified === true`). Bloquea el formulario con mensaje si no hay ninguno; preselecciona si hay uno solo.
- Formulario por etapas en una sola página (etapa 1): organizer, título, tipo (`EVENT | SCHOOL | CLUB | BAR`), descripción, ciudad (select), venue existente opcional filtrado por ciudad, dirección libre y CAP si no hay venue, estilos de baile (chips checkbox), fecha/hora inicio y fin, toggle gratuito + precio (moneda fija `EUR`), Instagram y WhatsApp opcionales.
- Suggerimenti CAP recuperati da ComuniITA tramite ricerca esatta del comune; un errore del servizio esterno non blocca l'inserimento manuale.
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
- Edición completa de eventos (el backend ya ofrece el DTO privado necesario, pero el formulario de edición pertenece a otra spec).
- Listado de eventos PENDING/DRAFT propios (el backend lo soporta, pero la pantalla de gestión pertenece a otra spec).
- Event series (`seriesId` nunca se envía).
- Favoritos, asistencia y detalle público de evento.
- Cambios en el backend de ningún tipo.

---

## APIs del backend utilizadas

Las rutas se centralizan en `src/app/core/api/endpoints.ts`; esta spec añade el endpoint privado `/manage` requerido por el contrato del backend.

| Operación             | Endpoint                                                              | Cuándo se usa                                                                     |
| --------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Organizadores propios | `GET /rest/organizers/me` (JWT)                                       | Cargar selector; se muestran solo `verified === true`                             |
| Ciudades              | `GET /rest/cities` (público)                                          | Select de ciudad                                                                  |
| Estilos de baile      | `GET /rest/dance-styles` (público)                                    | Chips multiselección                                                              |
| Venues por ciudad     | `GET /rest/venues?cityId={id}` (público)                              | Venue opcional tras elegir ciudad                                                 |
| CAP del comune        | `GET https://comuni-ita.nicolorebaioli.dev/v5/comuni?q={nome}`        | Suggerisce i CAP validi quando si usa un indirizzo libero                         |
| Crear evento          | `POST /rest/events` (JWT + organizer propio + verificado)             | Etapa 1; devuelve `201 OrganizerEventDetailDto` con `status=PENDING`              |
| Detalle privado       | `GET /rest/events/{id}/manage` (JWT + dueño)                          | Recuperar la etapa 2 y consultar `flyerStatus` aunque el evento no esté publicado |
| Subir flyer           | `PATCH /rest/events/{id}/flyer` (JWT + dueño, multipart campo `file`) | Etapa 2, opcional; devuelve `OrganizerEventDetailDto`                             |
| Publicar              | `PATCH /rest/events/{id}/status` (JWT + dueño)                        | Body `{ "status": "PUBLISHED" }`; devuelve `OrganizerEventDetailDto`              |
| Eliminar evento       | `DELETE /rest/events/{id}` (JWT + dueño)                              | Solo desde `Annulla` en etapa 2                                                   |

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
  startAt: string; // ISO OffsetDateTime
  endAt: string;
  liveNow: boolean;
  free: boolean; // el backend serializa "free", no "isFree"
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
  danceStyles: string[]; // nombres, no IDs
  goingCount: number;
  interestedCount: number;
}

export interface OrganizerEventDetailDto extends Omit<EventDetailDto, 'danceStyles'> {
  status: EventStatus;
  cityId: number;
  venueId: string | null;
  seriesId: string | null;
  danceStyles: DanceStyleDto[];
}

export interface EventCreateDto {
  organizerId: string;
  venueId: string | null; // null si el usuario no eligió venue
  cityId: number;
  title: string;
  eventType: EventType;
  description: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  startAt: string; // OffsetDateTime con offset local del navegador
  endAt: string;
  free: boolean;
  price: number | null; // null cuando free === true
  currency: string; // siempre 'EUR'
  address: string;
  latitude?: number; // solo con venue esistente
  longitude?: number; // solo con venue esistente
  danceStyleIds: number[];
  // flyerUrl e seriesId non vengono mai inviati. Le coordinate arrivano
  // dal venue; l'indirizzo libero viene invece geocodificato dal backend.
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
3. Crear `src/app/core/services/organizers.service.ts` (`getMyOrganizers()` → `OrganizerDetailDto[]`), `src/app/core/services/venues.service.ts` (`listByCity(cityId)` → `VenuesSummaryDto[]`) y ampliar `src/app/core/services/events.service.ts` con `getManageableEventDetail(id)`, `createEvent(dto)`, `updateEventStatus(id, status)`, `updateFlyer(id, file)` (FormData, sin `Content-Type` manual) y `deleteEvent(id)`.
4. Registrar en `src/app/app.routes.ts` las rutas `organizer/events/new` y `organizer/events/:id/publish` con `featureFlagGuard(FEATURE_FLAGS.createEventPage)` + `roleGuard('ORGANIZER')`, y añadir `{ path: 'organizer/**', renderMode: RenderMode.Client }` en `src/app/app.routes.server.ts`.
5. Implementar la etapa 1 en `features/events/create-event/` (reemplaza el scaffold): carga paralela de organizadores/ciudades/estilos, selector de verificados, formulario reactivo con validaciones (título requerido, `endAt > startAt`, precio ≥ 0 si no es gratuito, dirección y CAP requeridos sin venue), sugerencias CAP de ComuniITA y `POST` + navegación a la etapa 2. Reutilizar `HlmButton`, `HlmSelectImports`, `hlmInput`, `hlmLabel`.
6. Implementar la etapa 2 (`pubblica`): recuperación por `GET /rest/events/{id}/manage`, upload de flyer con validación y polling de `flyerStatus`, botón `Pubblica`, `Annulla` con `HlmAlertDialog` + `DELETE`, y pantalla final de confirmación con `Crea un altro` y `Vai alla mappa`.
7. Añadir el enlace `Crea evento` en `shared/navbar/navbar.html` + `navbar.ts`, envuelto en el directive `*appRole` existente.
8. Añadir `features/events/create-event/create-event.spec.ts` con tests de: mapeo del formulario a `EventCreateDto` (`free`, no `isFree`; conversión de fechas), exclusión de organizers no verificados y validación `endAt > startAt`.

---

## Criterios de aceptación

- [ ] `/organizer/events/new` y `/organizer/events/:id/publish` solo cargan para rol `ORGANIZER`; un `USER` o anónimo cae al redirect `**`.
- [ ] Con `createEventPage` en `false` en un environment, ninguna de las dos rutas matchea.
- [ ] El selector muestra únicamente organizers con `verified === true`; si no hay ninguno, se muestra un mensaje y no hay formulario.
- [ ] Con un solo organizer verificado, este queda preseleccionado sin interacción.
- [ ] Al elegir ciudad se cargan sus venues (`GET /rest/venues?cityId=...`); al elegir venue se usa su `id`; al deseleccionarlo se envía `venueId: null`.
- [ ] Se viene scelto un venue, il payload usa il suo indirizzo e le sue coordinate già censite, evitando una nuova geocodifica testuale.
- [ ] Se non viene scelto un venue, il CAP è obbligatorio e composto da cinque cifre; `address` viene inviato come `indirizzo, CAP` senza `latitude`/`longitude`.
- [ ] Dopo la scelta della città, ComuniITA suggerisce i CAP del comune; con un solo CAP lo preseleziona, mentre un errore esterno lascia disponibile l'inserimento manuale.
- [ ] `startAt` y `endAt` se envían como ISO OffsetDateTime y `endAt > startAt`; el formulario bloquea el envío en caso contrario.
- [ ] Un evento de pago envía `price >= 0` y `currency: 'EUR'`; uno gratuito envía `free: true` y `price: null`.
- [ ] El JSON enviado usa la clave `free` (nunca `isFree`) y no incluye `flyerUrl`, `seriesId`.
- [ ] Tras un `POST` exitoso la URL cambia a `/organizer/events/{id}/publish`; recargar esa URL recupera el evento con `GET /rest/events/{id}/manage` y JWT.
- [ ] El flyer es opcional: se puede publicar sin subirlo; acepta JPEG/PNG/WebP y rechaza otros tipos o > 10 MB con mensaje en italiano.
- [ ] Si el upload falla, se puede reintentar sin que se ejecute un segundo `POST /rest/events`.
- [ ] `Pubblica` envía exactamente `PATCH /rest/events/{id}/status` con body `{ "status": "PUBLISHED" }`; tras el 200 se muestra la confirmación.
- [ ] `Annulla` tras crear pregunta con un alert dialog y, al confirmar, ejecuta `DELETE /rest/events/{id}` y vuelve a la etapa 1.
- [ ] La pantalla final ofrece `Crea un altro` (vuelve a etapa 1 vacía) y `Vai alla mappa` (navega a `/mappa`).
- [ ] `organizer/**` está en `RenderMode.Client` en `app.routes.server.ts` (no hay ruta `organizer` suelta).
- [ ] `pnpm build` (production) compila y el test `pnpm test --watch=false --filter "CreateEvent"` pasa.

---

## Verifica HTTP

### Health Check

- Metodo: GET
- Endpoint: http://<<BASE_URL>>/rest/health
- Ambiente Hoppscotch: Ballastasera Local
- Headers:
  - Accept: application/json
- Body: nessuno
- Stato atteso: 200
- JSON atteso: body JSON con `status` e `UP`
- Tempo massimo di risposta: 5000

### Dettaglio privato dell'evento PENDING

- Metodo: GET
- Endpoint: http://<<BASE_URL>>/rest/events/<<PENDING_EVENT_ID>>/manage
- Ambiente Hoppscotch: Ballastasera Local
- Headers:
  - Accept: application/json
  - Authorization: Bearer <<ORGANIZER_TOKEN>>
- Body: nessuno
- Stato atteso: 200
- JSON atteso: body JSON con `status`, `PENDING`, `flyerStatus` e `cityId`
- Tempo massimo di risposta: 5000

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
- **Sí:** indirizzo libero con CAP quando non c'è un venue. Il frontend unisce `indirizzo, CAP` e il backend continua a geocodificare senza modifiche di contratto.
- **No:** creación/edición de venues. Falta `GET /rest/venues/{id}` para hidratar una edición; va en otra spec cuando el BE lo soporte.
- **No:** edición de eventos ni listado de PENDING/DRAFT. El backend ya expone los contratos privados, pero ambas pantallas requieren una spec frontend propia.
- **No:** mini-mapa para coordenadas del evento. El geocoding del backend cubre el caso; el mapa solo tiene sentido para venues.
- **No:** tocar `/admin/**` ni flags admin. `endpoints.ts` cambia únicamente para declarar `/rest/events/{id}/manage`.
- **No:** event series, favoritos, asistencia, detalle público. Cada uno merece spec propia.
- **Sí:** reparar `environment.development.ts` durante la implementación (2 flags admin que faltaban). Las decisiones del plan decían dejarlo fuera, pero `pnpm test` compila ese archivo y sin reparación ningún test pasa. Notado para coordinar con el compañero.
- **Sí:** `--filter` de Vitest matchea el título del suite (componente), no el nombre del archivo: el criterio usa `--filter "CreateEvent"`.

---

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El detalle público devuelve `404` para eventos PENDING                                      | La etapa 2 usa exclusivamente el detalle privado autenticado `/manage` y las mutaciones devuelven `OrganizerEventDetailDto`                                                                                |
| Un PENDING puede quedar huérfano si el usuario abandona sin publicar ni cancelar            | Ruta con ID recuperable + `Annulla` con borrado; el riesgo residual se documenta, no se resuelve en FE                                                                                                     |
| El polling del flyer puede no terminar (procesamiento lento)                                | Timeout de 60 s y botón manual de refresco; `FAILED` permite reintentar                                                                                                                                    |
| `environment.development.ts` no compilaba por flags admin faltantes (trabajo del compañero) | Se añadieron `verifiedOrganizersPage`/`updateOrganizerPage` en `true` durante la implementación: `pnpm test` compila ese archivo y el criterio de tests lo exigía. Cambio mecánico de 2 líneas, sin lógica |
| `roleGuard` lee el JWT de localStorage, invisible en SSR                                    | Las rutas nuevas van en `RenderMode.Client`, como ya hace `admin/**`                                                                                                                                       |
| CORS del backend solo permite `PATCH` con `Authorization`/`Content-Type`                    | El multipart se envía como `FormData` sin fijar `Content-Type` manual                                                                                                                                      |
| ComuniITA non è disponibile o non trova il comune                                           | Il campo CAP resta editabile manualmente; il servizio esterno fornisce suggerimenti ma non è necessario per inviare il form                                                                                |

---

## What is **not** in this spec

- Onboarding y perfil de organizador (spec del compañero).
- Administración de organizadores y sus correcciones.
- CRUD de venues y mini-mapa de venues.
- Edición de eventos, listado de borradores, moderación.
- Event series, favoritos, asistencia, detalle público de evento.
- Cualquier cambio en `ballastasera-be`.

Cada uno de esos, si aterriza, va en su propia spec.
