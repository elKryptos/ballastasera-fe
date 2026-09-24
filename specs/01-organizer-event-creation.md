# SPEC 01 — Creación de eventos por organizadores verificados

> **Estado:** Approvato
> **Depende de:** Ninguna spec de este repo. Depende de `ballastasera-be/specs/06-organizer-event-management.md` (contrato privado de eventos, `/manage` y estados).
> **Fecha:** 2026-09-20 (original: 2026-09-14)
> **Objetivo:** Permitir que un organizador verificado cree un evento eligiendo la dirección con autocompletado de Photon, añada opcionalmente un flyer y lo publique desde el frontend, consumiendo únicamente las APIs que el backend expone hoy.

---

## Por qué existe esta spec

El frontend implementa el ciclo crear → flyer → publicar para un organizador verificado. El backend impone dos límites que moldean el diseño: `POST /rest/events` fuerza el estado `PENDING` y el detalle público solo expone eventos `PUBLISHED`. Por eso el flujo navega a una ruta con el ID del evento creado y recupera el estado privado con `GET /rest/events/{id}/manage`; "Annulla" elimina el evento para no dejar PENDING huérfanos.

Esta revisión actualiza la spec tras el merge con el trabajo del compañero (el panel admin **no** se toca) y cambia la captura de la dirección: el autocompletado usa **Photon** (`https://photon.komoot.io/`) directamente desde el frontend y envía `latitude`/`longitude` en el payload. El backend mantiene Photon como geocoder con fallback a Nominatim cuando las coordenadas no llegan.

---

## Scope

**In:**

- Rutas `/organizer/events/new` (etapa 1: datos del evento) y `/organizer/events/:id/publish` (etapa 2: flyer opcional + publicación), protegidas por `featureFlagGuard('createEventPage')` + `roleGuard('ORGANIZER')`.
- Feature flag `createEventPage` en `src/app/core/config/feature-flags.ts` y en los tres environment files (`true` en development y staging, `false` en producción).
- Enlace `Crea evento` en el navbar, visible solo con `*appRole="'ORGANIZER'"`.
- Selector de organizadores propios verificados (`GET /rest/organizers/me`, filtra `verified === true`). Bloquea el formulario con mensaje si no hay ninguno; preselecciona si hay uno solo.
- Formulario por etapas en una sola página (etapa 1): organizer, título, tipo (`EVENT | SCHOOL | CLUB | BAR`), descripción, ciudad (select), venue existente opcional filtrado por ciudad, dirección, estilos de baile (chips checkbox), fecha/hora inicio y fin, toggle gratuito + precio (moneda fija `EUR`), Instagram y WhatsApp opcionales.
- **Autocompletado de dirección con Photon**: `GET https://photon.komoot.io/api/` con `q` y `limit=30`. Se consulta a partir de 3 caracteres, con debounce de 300 ms. El dropdown muestra **todas** las sugerencias recibidas (hasta 30), deduplicadas por `label`, porque Photon devuelve filas idénticas que no se pueden distinguir. Al seleccionar una sugerencia se guardan `latitude`/`longitude`; si se escribe sin seleccionar, no se envían coordenadas y el backend geocodifica. Un error de Photon muestra lista vacía y deja el campo editable a mano.
- Restaurar desde el branch `spec-01-organizer-event-creation` el flujo organizer eliminado en `main`: `src/app/features/events/create-event/**`, `src/app/features/events/publish-event/**`, `src/app/core/models/venue.model.ts`, `src/app/core/services/organizers.service.ts` y `src/app/core/services/venues.service.ts`, integrando Photon y descartando el servicio de CAP de ComuniITA.
- Creación con `POST /rest/events` y navegación a la etapa 2 con el ID devuelto.
- Flyer opcional: validación client-side (JPEG/PNG/WebP, máx. 10 MB), upload multipart, polling de `flyerStatus` hasta `READY` o `FAILED` (timeout 60 s, luego botón de refresco manual), reintento sin repetir el POST.
- Publicación explícita con `PATCH /rest/events/{id}/status` y body `{ "status": "PUBLISHED" }`.
- Cancelación posterior a la creación: `HlmAlertDialog` de confirmación + `DELETE /rest/events/{id}`.
- Pantalla final de confirmación con botones `Crea un altro` y `Vai alla mappa`.
- Test unitario del componente/servicio en `create-event.spec.ts`.

**Out of scope (para futuras specs):**

- Todo `/admin/**` y el trabajo del compañero: panel admin de creación de eventos, servicios admin y el uso de Photon dentro del componente admin. No se toca.
- Sistema i18n/Transloco y componentes UI llegados en el merge (`public/i18n/**`, `transloco-loader.ts`, sidebar, sheet, etc.).
- Onboarding, edición o borrado del perfil de organizador.
- Correcciones al trabajo admin ya en `main` (flags, paginación, admin-home).
- Creación/edición de venues (solo consumo del listado existente).
- Edición completa de eventos (el backend ya ofrece el DTO privado necesario, pero el formulario de edición pertenece a otra spec).
- Listado de eventos PENDING/DRAFT propios (el backend lo soporta, pero la pantalla de gestión pertenece a otra spec).
- Event series (`seriesId` nunca se envía).
- Favoritos, asistencia y detalle público de evento.
- Cambios en el backend de ningún tipo.

---

## APIs del backend utilizadas

Las rutas se centralizan en `src/app/core/api/endpoints.ts`. Photon no pasa por el backend: es una llamada directa del frontend, documentada aquí como servicio externo.

| Operación              | Endpoint                                                              | Cuándo se usa                                                                     |
| ---------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Organizadores propios  | `GET /rest/organizers/me` (JWT)                                       | Cargar selector; se muestran solo `verified === true`                             |
| Ciudades               | `GET /rest/cities` (público)                                          | Select de ciudad                                                                  |
| Estilos de baile       | `GET /rest/dance-styles` (público)                                    | Chips multiselección                                                              |
| Venues por ciudad      | `GET /rest/venues?cityId={id}` (público)                              | Venue opcional tras elegir ciudad                                                 |
| Autocompletado         | `GET https://photon.komoot.io/api/?q={texto}&limit=30` (externo, sin JWT) | Suggestions de dirección con coordenadas                                      |
| Crear evento           | `POST /rest/events` (JWT + organizer propio + verificado)             | Etapa 1; devuelve `201 OrganizerEventDetailDto` con `status=PENDING`              |
| Detalle privado        | `GET /rest/events/{id}/manage` (JWT + dueño)                          | Recuperar la etapa 2 y consultar `flyerStatus` aunque el evento no esté publicado |
| Subir flyer            | `PATCH /rest/events/{id}/flyer` (JWT + dueño, multipart campo `file`) | Etapa 2, opcional; devuelve `OrganizerEventDetailDto`                             |
| Publicar               | `PATCH /rest/events/{id}/status` (JWT + dueño)                        | Body `{ "status": "PUBLISHED" }`; devuelve `OrganizerEventDetailDto`              |
| Eliminar evento        | `DELETE /rest/events/{id}` (JWT + dueño)                              | Solo desde `Annulla` en etapa 2                                                   |

Si el payload no incluye `latitude`/`longitude`, el backend geocodifica `address` con Photon y cae a Nominatim si Photon falla o no encuentra resultados (`GeocodingServiceImpl`, commit BE `a67e345`). Ese fallback es comportamiento del backend, no de esta spec.

Errores de backend que la UI debe manejar: `400` (validación, `endAt <= startAt`, dirección no geocodificable), `403` (organizer no verificado o no propio), `415` (flyer de tipo no válido), `413` implícito por límite de 10 MB.

---

## Data model

```ts
// src/app/core/models/geocoding.model.ts (ya existe en main, commit FE 46ddfc0)
export interface AddressSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}
```

```ts
// src/app/core/models/event.model.ts (añadidos del flujo privado)
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
  free: boolean; // el backend solo deserializa "free"; "isFree" se ignora
  price: number | null; // null cuando free === true
  currency: string; // siempre 'EUR'
  address: string;
  latitude?: number; // coordenadas de la suggestion Photon seleccionada
  longitude?: number;
  danceStyleIds: number[];
  // flyerUrl e seriesId nunca se envían.
}

export interface EventStatusUpdateDto {
  status: EventStatus;
}
```

```ts
// src/app/core/models/venue.model.ts (a restaurar desde el branch spec-01)
export interface VenuesSummaryDto {
  id: string;
  name: string;
  address: string;
  cityName: string;
  latitude: number;
  longitude: number;
}
```

Convenciones: el formulario trabaja con `datetime-local` y convierte a `OffsetDateTime` ISO con el offset del navegador en el momento del submit. Las señales de estado de plantilla son `protected` y con `signal()`, según la convención del repo. Los servicios usan `@Service()` y `inject()`.

---

## Implementation plan

1. Verificar la flag `createEventPage` en `feature-flags.ts` y en los tres environment files (ya está en `main`): el typecheck no debe reportar flags faltantes.
2. Restaurar desde `spec-01-organizer-event-creation` los archivos del flujo organizer eliminados en `main` por el commit `10cb39f`: `src/app/features/events/**`, `src/app/core/models/venue.model.ts`, `src/app/core/services/organizers.service.ts` y `src/app/core/services/venues.service.ts`. **No** restaurar `postal-codes.service.ts` ni su test (ComuniITA queda fuera).
3. Reintegrar en `src/app/core/models/event.model.ts` los tipos privados del flujo (`EventStatus`, `FlyerStatus`, `EventDetailDto`, `OrganizerEventDetailDto`, `EventCreateDto`, `EventStatusUpdateDto`), conviviendo con los tipos que ya usa el resto de la app. `EventCreateDto` usa `free`, nunca `isFree`.
4. Ajustar `src/app/core/services/geocoding.service.ts` (ya en `main`): `searchAddress(query)` usa `limit=30` fijo y devuelve `AddressSuggestion[]` deduplicado por `label`. No tocar el componente admin que ya lo consume.
5. Ampliar `src/app/core/services/events.service.ts` con `getManageableEventDetail(id)`, `createEvent(dto)`, `updateEventStatus(id, status)`, `updateFlyer(id, file)` (FormData, sin `Content-Type` manual) y `deleteEvent(id)`.
6. Registrar en `src/app/app.routes.ts` las rutas `organizer/events/new` y `organizer/events/:id/publish` con `featureFlagGuard(FEATURE_FLAGS.createEventPage)` + `roleGuard('ORGANIZER')`, y conservar `{ path: 'organizer/**', renderMode: RenderMode.Client }` en `src/app/app.routes.server.ts`.
7. Implementar la etapa 1 con el autocomplete Photon: `addressSearch`, `addressSearching` y `addressSuggestions` (`toSignal` + `debounceTime(300)` + mínimo 3 caracteres), `addressItemToString` y el effect que copia `latitude`/`longitude` solo cuando la dirección coincide con una suggestion. Reutilizar `HlmButton`, `HlmSelectImports`, `hlmInput`, `hlmLabel`.
8. Implementar la etapa 2 (publicar): recuperación por `/manage`, upload de flyer con validación y polling, `Pubblica`, `Annulla` con `HlmAlertDialog` + `DELETE`, y pantalla final de confirmación.
9. Añadir el enlace `Crea evento` en `shared/navbar/navbar.html` + `navbar.ts`, envuelto en el directive `*appRole` existente.
10. Actualizar `create-event.spec.ts`: mapeo del formulario a `EventCreateDto` (`free`, no `isFree`; conversión de fechas), exclusión de organizers no verificados, validación `endAt > startAt` y que una suggestion de Photon rellena `latitude`/`longitude`.

---

## Criteri di accettazione

- [ ] `/organizer/events/new` y `/organizer/events/:id/publish` solo cargan para rol `ORGANIZER`; un `USER` o anónimo cae al redirect `**`.
- [ ] Con `createEventPage` en `false` en un environment, ninguna de las dos rutas matchea.
- [ ] El selector muestra únicamente organizers con `verified === true`; si no hay ninguno, se muestra un mensaje y no hay formulario. (Verifica: Organizzatori dell'utente)
- [ ] Con un solo organizer verificado, este queda preseleccionado sin interacción.
- [ ] Al elegir ciudad se cargan sus venues (`GET /rest/venues?cityId=...`); al elegir venue se usa su `id` y sus coordenadas ya censidas; al deseleccionarlo se envía `venueId: null`.
- [ ] El campo dirección no consulta Photon con menos de 3 caracteres; a partir de 3 consulta tras 300 ms sin tecleo. (Verifica: Ricerca Photon)
- [ ] El dropdown de dirección muestra todas las suggestions recibidas (hasta `limit=30`), deduplicadas por `label`. (Verifica: Ricerca Photon)
- [ ] Al seleccionar una suggestion se envían `latitude`/`longitude` en `EventCreateDto`; al escribir libre sin seleccionar no se envían y el backend geocodifica.
- [ ] Un error de Photon deja el campo editable a mano y no bloquea el envío del formulario.
- [ ] `startAt` y `endAt` se envían como ISO OffsetDateTime y `endAt > startAt`; el formulario bloquea el envío en caso contrario.
- [ ] Un evento de pago envía `price >= 0` y `currency: 'EUR'`; uno gratuito envía `free: true` y `price: null`.
- [ ] El JSON enviado usa la clave `free` (nunca `isFree`) y no incluye `flyerUrl` ni `seriesId`. (Verifica: Creazione evento)
- [ ] `POST /rest/events` responde `201` y el evento nace con `status=PENDING`. (Verifica: Creazione evento)
- [ ] Tras un `POST` exitoso la URL cambia a `/organizer/events/{id}/publish`; recargar esa URL recupera el evento con `GET /rest/events/{id}/manage` y JWT.
- [ ] El flyer es opcional: se puede publicar sin subirlo; acepta JPEG/PNG/WebP y rechaza otros tipos o > 10 MB con mensaje en italiano.
- [ ] Si el upload falla, se puede reintentar sin que se ejecute un segundo `POST /rest/events`.
- [ ] `Pubblica` envía exactamente `PATCH /rest/events/{id}/status` con body `{ "status": "PUBLISHED" }`; tras el 200 se muestra la confirmación.
- [ ] `Annulla` tras crear pregunta con un alert dialog y, al confirmar, ejecuta `DELETE /rest/events/{id}` y vuelve a la etapa 1.
- [ ] La pantalla final ofrece `Crea un altro` (vuelve a etapa 1 vacía) y `Vai alla mappa` (navega a `/mappa`).
- [ ] `organizer/**` está en `RenderMode.Client` en `app.routes.server.ts` (no hay ruta `organizer` suelta).
- [ ] `pnpm build` (production) compila y el test `pnpm test --watch=false --filter "CreateEvent"` pasa.
- [ ] El backend responde en `/rest/health`. (Verifica: Controllo salute)

---

## Verifica HTTP

Nota: el script determinista `verify-spec.ps1` vive en el repo backend (`.agents/skills/spec/scripts/`); para verificar esta spec hay que ejecutarlo con `-SpecRoot` apuntando a `ballastasera-fe/specs`. Las referencias `<<NOMBRE>>` se resuelven con el environment `Ballastasera Local` de Hoppscotch; nunca se escriben valores de credenciales en la spec.

### Controllo salute

- Metodo: GET
- Endpoint: http://<<BASE_URL>>/rest/health
- Ambiente Hoppscotch: Ballastasera Local
- Headers:
  - Accept: application/json
- Body: nessuno
- Stato atteso: 200
- JSON atteso: body JSON con `status` e `UP`
- Tempo massimo di risposta: 5000

### Ricerca Photon

- Metodo: GET
- Endpoint: https://photon.komoot.io/api/?q=Milano&limit=1
- Ambiente Hoppscotch: nessuno
- Headers:
  - Accept: application/json
- Body: nessuno
- Stato atteso: 200
- JSON atteso: body JSON con `features` e `geometry`
- Tempo massimo di risposta: 5000

### Organizzatori dell'utente

- Metodo: GET
- Endpoint: http://<<BASE_URL>>/rest/organizers/me
- Ambiente Hoppscotch: Ballastasera Local
- Headers:
  - Accept: application/json
  - Authorization: Bearer <<ORGANIZER_TOKEN>>
- Body: nessuno
- Stato atteso: 200
- JSON atteso: body JSON (array) con `verified` e `name`
- Tempo massimo di risposta: 5000

### Creazione evento

- Metodo: POST
- Endpoint: http://<<BASE_URL>>/rest/events
- Ambiente Hoppscotch: Ballastasera Local
- Headers:
  - Accept: application/json
  - Content-Type: application/json
  - Authorization: Bearer <<ORGANIZER_TOKEN>>
- Body: {"organizerId":"<<ORGANIZER_ID>>","venueId":null,"seriesId":null,"cityId":1,"title":"Evento spec 01 - verifica","eventType":"EVENT","description":null,"instagramUrl":null,"whatsappUrl":null,"startAt":"2030-01-15T20:00:00+01:00","endAt":"2030-01-15T23:00:00+01:00","free":true,"price":null,"currency":"EUR","address":"Via Roma 1, Milano","latitude":45.4641943,"longitude":9.1896346,"danceStyleIds":[]}
- Stato atteso: 201
- JSON atteso: body JSON con `status`, `PENDING` e `flyerStatus`
- Tempo massimo di risposta: 5000

Nota: `Creazione evento` es una verifica mutating (crea un evento PENDING real). El verificador debe pedir confirmación inmediata antes de ejecutarla.

---

## Decisions

- **Sí:** Photon como proveedor del autocompletado de direcciones, llamado directo desde el FE. Ya está en `main` (servicio `core/services/geocoding.service.ts`, commit FE `46ddfc0`; BE `a67e345`) y reemplaza al servicio de CAP de ComuniITA. Contrapartida: dependencia de un tercero sin SLA.
- **Sí:** `limit=30` fijo en la llamada a Photon. Muestra todas las opciones útiles del dropdown sin truncar a 5 y sin pedir cientos de filas.
- **Sí:** deduplicar por `label` en el cliente. Photon devuelve filas idénticas que rompen la selección en el dropdown.
- **Sí:** enviar `latitude`/`longitude` cuando hay una suggestion seleccionada. Ahorra una geocodificación y fija la posición elegida; el backend geocodifica solo si faltan.
- **Sí:** flujo por etapas con ruta con ID (`/{id}/publish`). Es la única forma de sobrevivir a una recarga, dado que no existe listado de eventos propios.
- **Sí:** `Annulla` elimina el evento PENDING. Evita huérfanos inalcanzables; se confirma con alert dialog.
- **Sí:** selector solo con organizers verificados. El backend rechaza con `403` cualquier otra opción; mostrarlos sería un error garantizado.
- **Sí:** rutas en inglés (`/organizer/events/new`, `/organizer/events/:id/publish`), sin italiano ni español. El copy de la UI sigue siendo italiano; las URLs no.
- **Sí:** flyer opcional. El backend permite publicar sin flyer y la conversión WebP es asíncrona.
- **Sí:** reintento de flyer/publicación conservando el ID. Repetir el `POST` crearía duplicados.
- **Sí:** moneda fija `EUR`. El producto está orientado a Italia; un selector añade superficie sin valor.
- **Sí:** restaurar el flujo organizer desde el branch `spec-01-organizer-event-creation`. En `main` fue eliminado por el commit del compañero `10cb39f` (panel admin); este flujo sigue siendo el objeto de la spec.
- **No:** tocar `/admin/**`, `admin.service.ts`, `AdminController` ni el componente admin de creación de eventos. Es el trabajo del compañero.
- **No:** ComuniITA (`postal-codes.service.ts`). Queda reemplazado por Photon.
- **No:** creación/edición de venues. Falta `GET /rest/venues/{id}` para hidratar una edición; va en otra spec cuando el BE lo soporte.
- **No:** edición de eventos ni listado de PENDING/DRAFT. El backend ya expone los contratos privados, pero ambas pantallas requieren una spec frontend propia.
- **No:** event series, favoritos, asistencia, detalle público. Cada uno merece spec propia.
- **Sí:** `--filter` de Vitest matchea el título del suite (componente), no el nombre del archivo: el criterio usa `--filter "CreateEvent"`.

---

## Risks

| Riesgo                                                                                      | Mitigación                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Photon no disponible, lento o sin resultados                                                | El campo queda editable a mano y el envío no se bloquea; el backend geocodifica con Photon y fallback Nominatim (`a67e345`)                                                                               |
| El FE envía `isFree` en vez de `free`; Jackson lo ignora y el evento nace gratuito           | Criterio de aceptación explícito (`free`, nunca `isFree`) y test unitario del mapeo del formulario                                                                                                         |
| Restaurar el flujo organizer choca con `event.model.ts`/`events.service.ts` actuales         | Resolver conservando ambos contratos (público y privado) y sin tocar `admin/**`; el commit del compañero `10cb39f` eliminó esos archivos en `main`                                                        |
| El detalle público devuelve `404` para eventos PENDING                                       | La etapa 2 usa exclusivamente el detalle privado autenticado `/manage` y las mutaciones devuelven `OrganizerEventDetailDto`                                                                                |
| Un PENDING puede quedar huérfano si el usuario abandona sin publicar ni cancelar             | Ruta con ID recuperable + `Annulla` con borrado; el riesgo residual se documenta, no se resuelve en FE                                                                                                     |
| El polling del flyer puede no terminar (procesamiento lento)                                 | Timeout de 60 s y botón manual de refresco; `FAILED` permite reintentar                                                                                                                                    |
| `roleGuard` lee el JWT de localStorage, invisible en SSR                                     | Las rutas nuevas van en `RenderMode.Client`, como ya hace `admin/**`                                                                                                                                       |
| CORS del backend solo permite `PATCH` con `Authorization`/`Content-Type`                     | El multipart se envía como `FormData` sin fijar `Content-Type` manual                                                                                                                                      |
| Photon es un servicio de terceros sin SLA ni API key                                         | Solo se usa para sugerencias; el BE mantiene fallback Nominatim y el usuario siempre puede escribir la dirección a mano                                                                                    |

---

## What is **not** in this spec

- Panel admin y cualquier página bajo `/admin/**` (trabajo del compañero).
- Sistema i18n/Transloco y UI kit llegados en el merge.
- Onboarding y perfil de organizador.
- CRUD de venues y mini-mapa de venues.
- Edición de eventos, listado de borradores, moderación.
- Event series, favoritos, asistencia, detalle público de evento.
- Cualquier cambio en `ballastasera-be`.

Cada uno de esos, si aterriza, va en su propia spec.
