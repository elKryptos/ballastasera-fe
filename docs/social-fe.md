# Social (FE): seguirse, amigos, bloquear, avisos

Fecha: 24/11/2026 · Rama `feature/social` (desde `main`). Backend: rama `feature/social` de
`ballastasera-be`, fases 0–7 hechas y con tests; plan en `ballastasera-be/docs/social-plan.md` (decisiones
en su §3) y contrato en `ballastasera-be/docs/API.md` (§1 Rate limit y §4 desde «Quién ve tus serate»).

Todo lo visible va detrás del flag **`social`**: `true` en staging, `false` en prod hasta el deploy. Lo
único que cambia sin flag es el body de `PATCH /auth/me`, que lleva siempre los campos nuevos (S4).

Canvas: «ballastasera – Mappa e scheda evento» (https://claude.ai/artifact/JqQ8CdmVDhnZENtcaNfWfK),
artboards **4** (tu perfil), **4b** (modifica perfil), **4c** (perfil de otra persona) y **4d** (Amici).
Donde el canvas y el plan del BE no coinciden, gana el plan (es posterior): ver S2.

Convención de estado: `[ ]` no empezado · `[~]` escrito, compila y con tests unitarios donde aplica ·
`[x]` probado contra el BE local.

## ▶ Estado (24/11/2026, sesión cortada por el límite de uso)

Todo escrito, compila (`ng build --configuration development`) y los tests unitarios pasan (falla solo
`app.spec.ts`, lo de Transloco de siempre). **Nada probado todavía contra el BE local ni en el navegador.**

| Fase | Qué | FE |
|---|---|---|
| 0 | Aviso «Troppe richieste» en el 429 | [~] |
| 1 | `/persona/{id}`, seguir, listas de amigos, bloquear | [~] |
| 2 | «Modifica profilo»: foto propia, bio, ciudad, país, escuela, quién ve tus serate | [~] |
| 3 | «Avete in comune», sus serate, «Sara e Luca ci vanno», «Cerco qualcuno» | [~] |
| 4 | Menú ⋯ (Silenzia, Segnala, Blocca) y moderación en el admin | [~] |
| 5 | Pestaña Amici: Attività, Amici, Scopri | [~] |
| 6 | Campanita, «Invita a ballare», «Ricevi email» | [~] |
| 7 | Traguardi, «Nome utente», `/@username`, «Condividi» | [~] |

**Siguiente paso (al retomar):**
1. ~~Enlaces a `/il-tuo-account`~~ (25/11): todos bien ahí. `organizer-profile` vuelve a `/il-tuo-account` (de ahí
   se abre), con la etiqueta «Modifica profilo» cuando el flag está encendido.
2. ~~Build optimizado~~ (25/11): los `@container` de los componentes y el `@starting-style`/`transition` del toast
   llegan al bundle; ninguna animación nueva dentro de `@media`. Home prerenderizada contra `main` (los dos con
   `build:staging`): title, meta, link y JSON-LD idénticos, y el texto del `<body>` también. Solo se añade
   `<app-toast>` vacío (se quitó la etiqueta oculta «Annunci» de su live region para no meter texto en la home).
3. Probar contra el BE local (checklist de abajo), con el SQL de `social-prod-db.md` en dev. **← aquí**
4. Pendiente de diseño: la chip «N escono stasera» de «Amici» en el menú (no se hizo: pediría el feed en cada carga).
5. Revisión con el usuario y commit/merge.

---

## 1. Decisiones

| # | Tema | Decisión |
|---|---|---|
| S1 | Flag | `social`. Apagado, todo se ve como hoy. Encendido: rutas nuevas, la tarjeta del menú abre «Il tuo profilo», la campanita, «Amici» en el menú, botones en la serata |
| S2 | Canvas vs plan | Gana el plan: «Zona» de texto libre → ciudad con Photon + «Mostra la città nel profilo» + paese d'origine; «Cerco qualcuno» va por serata al decir «Ci vado», no en el perfil; las frases de invitación son las 4 del BE; en «Novità» no hay cambios de nivel (no hay historial); «Balli con qualcuno che non è qui?» con follow automático queda fuera (§5 del plan) |
| S3 | Páginas | `/il-tuo-profilo` = canvas 4 (el tuyo, con «Come ti vedono»). `/il-tuo-account` = canvas 4b «Modifica profilo» (el formulario, la foto, «Ricevi email», persone bloccate, la página de organizador): conserva la URL porque el email de avisos lleva ahí. `/persona/:id` y `/@:username` = canvas 4c. `/amici` = canvas 4d (`?tab=attivita\|amici\|scopri`). `/avvisi` = la campanita. Admin: `/admin/segnalazioni` y `/admin/utenti-bannati` |
| S4 | `PATCH /auth/me` | Reemplaza el perfil entero (§6.4 del plan). El formulario lleva siempre `bio`, `attendanceVisibility`, escuela, `originCountry`, `homeCity`, `showHomeCity` con los valores del usuario, también con el flag apagado. `whatsappVisibility` pasa de switch a tres valores: con el flag apagado el switch no convierte un `MUTUALS` guardado en `EVERYONE` salvo que se toque |
| S5 | Sin sesión | `/persona/:id` y `/@:username` no tienen guard: sin sesión muestran «Accedi per vedere il profilo» y vuelven ahí después del login (`loginWithGoogle(returnUrl)`), para quien llega desde una story. Las demás páginas nuevas, `roleGuard` como «Il tuo account» |
| S6 | Foto propia | Se guarda al momento (F10 de `perfil-usuario-fe.md`), no con «Salva». El cliente valida tipo y 5 MB antes de subir |
| S7 | «Nome utente» | En el mismo «Salva» que el formulario, pero con su endpoint (`PATCH /users/me/username`): si cambió, va después del `PATCH /auth/me`. Se comprueba mientras se escribe (`username-available`, con debounce) |
| S8 | «Ricevi email» | Toggle que se guarda al tocarlo (endpoint propio), con «Salvato» al lado |
| S9 | Campanita | Página `/avvisi` (cargada solo al abrirla), no un popover: en el móvil, botón en la barra de arriba; en el desktop, fila «Avvisi» en el menú lateral. El número sin leer se pide al iniciar sesión, al volver a la pestaña y al navegar (como mucho una vez por minuto). Abrir la página marca todo como leído |
| S10 | Invitar | Desde la serata (plan, fase 6): botón «Invita a ballare» si dijiste «Ci vado» y no terminó. El diálogo: frase arriba, amigos con su estado e «Invita» en cada uno, «Ti restano N inviti oggi». Desde el perfil de un amigo (canvas 4c): eliges una de tus próximas serate y la frase |
| S11 | Avisos efímeros | Un `ToastService` global (un aviso a la vez, `role="status"`): el 429, «Ora siete amici», «Link copiato», etc. |
| S12 | Reutilizar | Piezas en `shared/`: `person-avatar` (foto o inicial en su color), `person-row` (fila de lista), `follow-button` (los 4 estados + «Profilo privato»). Las secciones del perfil (cabecera, estilos, contactos) las comparten `/persona`, «Il tuo profilo» y la hoja de «Chi ci va» |
| S13 | Desktop | Como el resto (memoria del proyecto): formularios como `account`, listas como las serate del admin; `@container` en el `<main appSidebarPush>` |

## 2. Contrato (resumen para el FE)

Todo con login salvo lo marcado. Rutas bajo `/rest`.

- **Perfil propio** `GET/PATCH /auth/me` (`UserDto`): suma `bio`, `attendanceVisibility`, `schoolOrganizerId`/`schoolName`/`schoolSlug`,
  `originCountry`, `homeCity` (`{ name, region, country, latitude, longitude }`), `showHomeCity`, `avatarSource`,
  `googleAvatarUrl`, `emailNotifications`, `username`, `memberSince`, `followersCount`, `followingCount`, `eventsCount`,
  `venuesCount`, `firstEventAt`. `whatsappVisibility` admite `MUTUALS`.
- **Perfil de otro** `GET /users/{id}` y `GET /users/by-username/{u}` (`UserProfileDto`): `relation`, `muted`, contadores,
  `bio`, escuela, `originCountry`, `homeCityName`, `username`, `memberSince`, `venuesCount`, `mutualFriends` (≤3) +
  `mutualFriendsCount`, `eventsTogetherCount` + `lastEventTogether*`, `lookingForPartnerToday`. 404 = privado, bloqueo,
  baneado o borrado (no se distingue).
- **Sus serate** `GET /users/{id}/attendance?past=&cursorStartAt=&cursorId=&limit=` → `CursorPage<EventCardDto>`.
- **Seguir** `POST/DELETE /users/{id}/follow` (204), `PATCH /users/{id}/follow { muted }`. **Bloquear** `POST/DELETE
  /users/{id}/block`. **Denunciar** `POST /users/{id}/report { reason, note }`.
- **Listas** `GET /users/me/followers|following|friends?q=` → `CursorPage<UserSummaryDto>`; `GET /users/me/blocks` →
  `UserSummaryDto[]`. `UserSummaryDto = { userId, displayName, avatarUrl, relation, profilePublic }`.
- **Foto** `PATCH /users/me/avatar` (multipart `avatar`), `PATCH /users/me/avatar/source { source: GOOGLE|NONE }` → `UserDto`.
- **Escuelas** `GET /organizers/schools?name=&limit=` (público).
- **Serata** `POST /events/{id}/attendance { lookingForPartner? }`, `GET /events/{id}/attendance/me` → `{ going,
  lookingForPartner }`, `GET /events/{id}/friends-going` → `UserSummaryDto[]`. `AttendeeDto` suma `relation` y
  `lookingForPartner`.
- **Amici** `GET /users/me/feed` → `{ tonight[], news[] }`, `GET /users/me/suggestions?limit=` → `SuggestionDto[]`.
- **Avisos** `GET /users/me/notifications` (cursor), `GET .../unread-count` → `{ unread }`, `PATCH .../read`,
  `PATCH /users/me/email-notifications { enabled }`.
- **Invitar** `POST /users/{id}/invites { eventId, phrase }`, `GET /events/{id}/invites/friends?q=` → `{ invitesLeft,
  friends: CursorPage<{ user, status }> }`.
- **@username** `GET /users/username-available?u=` → `{ available, reason }`, `PATCH /users/me/username { username }`.
- **Admin** `GET /admin/reports?status=`, `PATCH /admin/reports/{id} { status }`, `PATCH /admin/users/{id}/ban|unban`,
  `GET /admin/users/banned`.
- **Errores con `code`**: 429 `RATE_LIMITED` / `INVITE_LIMIT`; 400 `SELF_ACTION`, `NOT_FRIENDS`, `PROFILE_PRIVATE`,
  `FRIEND_PRIVATE`, `NOT_GOING`, `EVENT_NOT_INVITABLE`, `ALREADY_GOING`; 409 `USERNAME_TAKEN`, `USERNAME_RESERVED`,
  `REPORT_NOT_OPEN`, `CANNOT_BAN_ADMIN`, `CONCURRENT_UPDATE`. El código llega en `error.errors.code`.

## 3. Archivos

Cada componente con su `.ts`, su `.html` y, si hace falta, su `.css`, en su carpeta. Colores de los tokens
`--ev-*` de `styles.css` (tema claro y oscuro).

### Nuevos
- **core**: `api/cursor-params.ts`; `config/social.ts` (textos y límites), `config/countries.ts`; `models/social.model.ts`,
  `moderation.model.ts`; servicios `toast`, `follows`, `feed`, `notifications` (+ `notifications-watcher`), `invites`,
  `moderation`; `interceptors/rate-limit.interceptor`; `routing/username-matcher`; utils `api-errors`, `relation`,
  `person-links`, `profile-view`, `time-ago`, `username`, `invite-errors`, `remote-search`, `spring-page-list`,
  `brand-canvas` (sacado de `social-posts/cards.ts`). Specs de casi todos.
- **shared**: `toast`, `sheet`, `person-avatar`, `person-row`, `follow-button`, `email-notifications-toggle`, `page-nav`,
  `confirm-sheet` (movido desde event-management), `profile/` (`profile-hero`, `-chips`, `-styles`, `-contacts`,
  `-milestones`, `-school`, `-section`, `-layout`, `night-row`).
- **features**: `person/` (página + `in-common`, `person-nights`, `person-menu`, `report-sheet`, `invite-to-night-sheet`),
  `my-profile/` (+ `my-upcoming-nights`, `share-sheet` con `profile-card.ts`), `friends/` (+ `friends-activity`,
  `friends-lists`, `friends-discover`, `tonight-card`), `notifications/`, `account/` (`about-fields`, `username-field`,
  `home-city-field`, `origin-country-field`, `school-field`, `privacy-fields`, `avatar-editor`, `blocked-people`),
  `event-details/` (`night-social`, `invite-sheet`), `admin/reports` (+ `report-card`), `admin/banned-users`.

### Modificados
`app.routes.ts` (rutas nuevas), `app.config.ts` (interceptor), `app.ts/html` (toast), `feature-flags` + environments (flag
`social`), `endpoints.ts`, `user.model.ts`, `event.model.ts`, `auth.service` (`setUser`, `patchUser`), `users.service`,
`events.service`, `organizers.service` (`searchSchools`), `geocoding.service` (`searchCities`), `user-activity.service`,
`cursor-list.ts` (clave por función, `updateLocal`), `page-share.ts` (`copy` devuelve si copió, `share` con URL),
`user-update.ts` + `profile-form.ts` (campos nuevos, S4/S7), `whatsapp-field` (3 valores), `account`, `attendee-profile`,
`attendees-sheet`, `event-details`, `navbar`, `admin-home`, `admin-pickers`, `organizer-requests`, `styles.css`
(`.person-list`, `.section-label`, `.drawer-chip-count`, `.bell-dot`).

## 4. Checklist

### Prueba contra el BE local (`ng serve --configuration staging`, con el SQL de `social-prod-db.md` en dev)
- [ ] 429: pasar el límite de lectura y ver el aviso
- [ ] Seguir, dejar de seguir, «Ricambia» → «Amici»; seguir a un privado da 404
- [ ] Bloquear y desbloquear; el bloqueado no aparece en «Chi ci va» ni en las listas
- [ ] Guardar el perfil completo con el flag apagado: no se pierde nada de lo nuevo
- [ ] Foto: subir, volver a la de Google, quitarla
- [ ] Invitar: límite de 10, «Ci va già», «Già invitato», perfil privado
- [ ] Campanita: número, lista, marcar leídos
- [ ] `/@username` sin sesión → login → vuelve al perfil
