# Fase 5d — Gestión de serate (FE)

Estado al 09/11/2026. Rama `feature/organizer-requests`. Backend de la fase ya en remoto
(`068b9f2`, `f4b1b0c`). Todo lo nuevo está detrás del flag `eventManagementPage`
(prod `false`, staging `true`): para verlo en local, `ng serve --configuration staging`.

## Qué se hizo

### Rutas y estructura

- `/admin/serate` (solo ADMIN) y `/serate-pubblicate` (ORGANIZER o ADMIN con página propia).
- Las dos usan las **mismas cuatro páginas** (`event-management.routes.ts`): lista, `nuova`,
  `:id` y `:id/modifica`. Lo único que cambia es el contexto `EVENT_MANAGEMENT_CONTEXT`
  (`scope`, `basePath`, títulos, enlace de vuelta).
- `EventManagementService` elige el endpoint según el `scope` (admin u organizador).
- Menú: «Pubblica una serata» y «Serate pubblicate» pasan a ser enlaces con el flag activo.
  Admin home: tarjeta «Serate».
- Las tres páginas nuevas están en las dos listas de la paleta `--ev-*` de `styles.css`
  (sin eso no tienen colores ni modo día/noche).

### Lista (`managed-events`)

- Tres pestañas: Prossime / Annullate / Passate (admin, en píldoras) y In programma / Passate /
  Annullate (organizador, en barra segmentada), con contadores.
- «Carica altre» para paginar. Al cambiar de pestaña o filtro solo se muestra la última respuesta.
- Admin: búsqueda por título, filtro por organizador, «Nuova serata» fijo abajo.
- Organizador: nombre de su página arriba y «Pubblica una serata».

### Página de la serata (`managed-event`)

- Flyer con cambio inmediato (cámara), estado, «ci vado», like, enlace a la página pública.
- Resumen de los datos con «Modifica» en cada fila.
- «Se qualcosa cambia»: **Annulla** (solo PUBLISHED y no terminada) y **Elimina**, cada una con
  confirmación que dice cuánta gente ha dicho «ci vado».
- Mientras el flyer está en `PROCESSING`, la página vuelve a preguntar cada 3 s (máx. 1 minuto)
  hasta que esté listo; si el BE devuelve `FAILED`, lo dice.
- Si el formulario guardó la serata pero el flyer no subió, la página lo avisa (`flyerFailed`).
- **Un organizador no puede abrir la serata de otra página**: se muestra «Questa serata non esiste
  più», sin cifras ni botones (`EventManagementService.getManaged`). El admin abre cualquiera.

### Formulario (`event-editor` + `EventEditorFormStore`)

- Un solo formulario para crear y editar: organizador (solo admin), flyer, «La serata»,
  «Quando», «Dove», «Ingresso», «Contatti».
- **Quando**: calendario de Spartan (italiano, semana desde el lunes, sin días pasados) y select
  de Spartan con las horas cada 15 minutos desde las 18:00. Una hora guardada fuera de los cuartos
  (21:10) se conserva. Si la hora de fin es igual o anterior a la de inicio, la serata termina al
  día siguiente («Finisce sabato 15 alle 02:00»).
- **Dove**: un local (buscador por ciudad, y los locales propios del organizador primero) u otra
  dirección (Photon, mapa pequeño, coordenadas a mano con «Il punto non è giusto?»).
  Elegir un local rellena dirección, ciudad y contactos, y pone «Dove» en «In un locale».
- **Tipo de serata** (`9faf27c`): en un local, el tipo es el del local (`EVENT_TYPE_OF_VENUE`) y
  queda bloqueado, con el texto «Il tipo lo prende dal locale». En una escuela solo se puede elegir
  «Serata / social» o «Lezione o stage» (`SCHOOL_VENUE_EVENT_TYPES`); por defecto, «Lezione».
  Con «Altro indirizzo» o tras «Cambia», las 5 opciones vuelven a estar libres. Al editar, si el tipo
  guardado no coincide con el del local, se corrige y se envía al guardar. Solo en el FE: el BE no
  lo comprueba.
- **D12**: un CLUB o VENUE solo elige entre sus locales; si tiene uno solo, se elige solo y no
  aparece «Cambia» (con varios, sí). Los locales propios se cargan en `PlaceSection`.
- Al editar se envía **solo lo que cambió**; un campo vaciado va como `""`. `startAt` solo se
  envía si se tocó el día o la hora de inicio (así se puede alargar una serata ya empezada).
- Pasar de un local a otra dirección (organizador): primero el PATCH, después `removeVenue`, para
  que un PATCH rechazado no deje la serata a medias.
- Errores 400 con mensaje propio: dirección no encontrada, local de otra ciudad, fin antes del
  inicio, inicio ya pasado, precio negativo (`event-management-errors.ts`).

### Spartan

- Generados con el CLI: `shared/ui/calendar` y `shared/ui/date-picker` (+ rutas en `tsconfig.json`).
  El CLI genera también variantes que no usamos (rango, múltiple, mes/año).
- Las clases de los triggers de Spartan van con `[class]="…"`, nunca como atributo `class`:
  como esos componentes tienen un input `class`, el atributo también se aplica al elemento inline
  y pinta manchas redondas alrededor del botón.
- Celdas del calendario a 2,5 rem (`styles.css`) para tocarlas en el móvil.

### Tests

- 195 tests en verde. Solo falla `app.spec.ts` (transloco), que ya fallaba antes.
- Specs solo de lógica, junto a cada archivo: servicio, store del formulario, `event-schedule`,
  `file-preview`, `geo`, errores.

## Qué falta probar (contra el BE real)

- [ ] **Organizador**: crear una serata con y sin flyer; editar título, horas, estilos, contactos.
- [ ] Editar solo la hora de fin de una serata ya empezada.
- [ ] Pasar de un local a «Altro indirizzo» y al revés.
- [ ] Dirección escrita a mano sin elegir sugerencia → el BE geocodifica, o sale el mensaje de
      «Non troviamo questo indirizzo».
- [ ] Coordenadas pegadas a mano.
- [ ] D12: organizador CLUB/VENUE con uno y con varios locales; sin locales. Con uno solo no
      aparece «Cambia»; con varios, sí.
- [ ] CLUB/VENUE que edita una serata que el admin dejó en una dirección: elige su local, guarda y
      la serata queda en el local.
- [ ] Tipo de serata: elegir un tipo y después un local Club → pasa a «Club» y queda bloqueado.
      Local escuela → solo «Serata / social» y «Lezione o stage». «Cambia» o «Altro indirizzo» →
      las 5 opciones libres.
- [ ] Editar una serata cuyo tipo no coincide con el de su local → al guardar se envía el del local.
- [ ] Anular y eliminar; comprobar la página pública después.
- [ ] Flyer: cambio desde la página, «in elaborazione» que se actualiza solo, flyer fallido.
- [ ] Abrir por URL una serata de otro organizador (página y `modifica`) → «non esiste più».
- [ ] **Admin**: lista con búsqueda y filtro por organizador, crear para cualquier organizador,
      editar, anular, eliminar.
- [ ] Contadores de las pestañas después de anular o eliminar.
- [ ] Móvil y escritorio; tema de noche y de día.

## Puntos abiertos

1. **«Ogni venerdì» en las tarjetas**: sale del día de la serata; una serie de varios días no es
   «cada viernes». La tarjeta no trae los días de la serie. Propuesta: «Serata fissa».
2. **Tema de día**: el calendario, la lista de horas y los autocompletados se abren fuera de la
   página y usan los colores oscuros globales. Revisar en el navegador.
3. **Contadores**: cada cambio de filtro o búsqueda lanza 4 peticiones. Si crece el volumen,
   un endpoint de contadores en el BE.
4. **UX**: el editor no avisa si sales con cambios sin guardar; las serate pasadas se pueden
   editar (decisión de diseño).
5. **Errores 400**: el FE distingue los casos por el texto en inglés de `details` del BE. Lo sólido
   sería un `errors.code` en el BE, como en los 409.
6. **Caché del flyer**: ventana mínima en la que Redis puede quedarse con `PROCESSING` si una
   consulta coincide con el fin de la conversión.
7. **Páginas antiguas del admin**: `admin/create-event` y `admin/create-event-series` no aplican
   las reglas del tipo de serata (bloqueo al tipo del local, dos opciones en una escuela).

## Pendiente para después de producción

Decidido el 09/11: no bloquea el paso a producción.

1. **Escuela sin sede propia** (BE + FE). Hoy SCHOOL necesita un local para ser aprobada (D11).
   Si no tiene sede propia, el admin tendría que hacerla dueña de un local ajeno, y el dueño real
   ya no podría reclamarlo (`VENUE_ALREADY_LINKED`). Propuesta:
   - BE: `OrganizerType.requiresVenue()` solo VENUE/CLUB y un nuevo `allowsVenue()` (todos menos
     PERSON). `OrganizerRequestValidator`: dirección obligatoria si `requiresVenue`, prohibida si
     no `allowsVenue`. Ajustar `OrganizerRequestCreateDtoValidationTest` y los tests de approve de
     `OrganizerRequestsServiceImplTest` (pasarlos a CLUB).
   - FE: en el wizard, el paso «Il tuo locale» opcional para SCHOOL («Non ho una sede mia»). En la
     tarjeta de la solicitud del admin, mostrar la dirección propuesta y «Crea il locale» también
     cuando el locale es opcional (hoy solo sale con `missingVenue`).
   - Mientras tanto: una escuela sin sede se registra como «Insegnante, DJ o promoter» (PERSON).
2. **Aviso de serate que se solapan** (BE + FE). `GET /rest/events/overlaps?venueId&startAt&endAt[&excludeId]`:
   serate PUBLISHED en el mismo local cuyo horario se solapa (las antiguas sin `end_at` cuentan
   4 h). El editor avisa sin bloquear: «C'è già una serata in questo locale in quell'orario…».
   Autenticado: añadirlo antes del `permitAll` de `/rest/events/{id}` en `SecurityConfig`.
3. **Email al dueño del locale** (BE). Cuando otro organizador publica en un local que tiene
   dueño: «X ha pubblicato una serata nel tuo locale», con forma de avisar al admin. El dueño del
   local no puede editar serate de otros; el admin resuelve.
4. **Aviso en el editor** (BE + FE, opcional): «Il locale è gestito da Y. La serata sarà pubblicata
   a nome tuo.» Necesita `organizerId`/`organizerName` en `VenuesSummaryDto`.
5. **Tipo de serata en el BE**: hoy las reglas del tipo solo están en el FE. Si se quieren
   garantizar, aplicarlas también al crear y editar en `EventsServiceImpl`.

## Falta en el BE

- El admin no puede quitar el local de una serata (no hay `removeVenue` de admin): el formulario
  solo le deja cambiarla a otro local.

## Antes de staging

- Marcar la parte FE de la fase 5d en `docs/organizer-requests-plan.md` (repo BE).
- `schema.sql` + migración (`organizer_requests`, tipo de organizador sin ASSOCIATION).
- Postman §16 (D12).
- Push de la rama FE (lo hace el usuario).
