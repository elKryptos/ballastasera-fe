# Perfil de usuario ampliado (FE)

Fecha: 16/11/2026 · Rama `feature/user-profile` (desde `main`). Backend: rama `feature/user-profile` de
`ballastasera-be`, terminado y con tests; plan en `ballastasera-be/docs/user-profile-plan.md` (contrato
API en su sección 5 y en `ballastasera-be/docs/API.md`).

Todo lo nuevo va detrás del flag **`dancerProfile`** (prod `false`, staging `true`): para verlo en local,
`ng serve --configuration staging`.

Convención de estado:
- `[ ]` no empezado
- `[~]` en progreso (dejar nota de qué falta)
- `[x]` hecho y probado

## ▶ Dónde retomar (17/11/2026)

**Paso actual: código escrito, falta probarlo contra el BE local** (sección 5, «Prueba contra el BE
local», con `pnpm start:staging` y el BE de la rama `feature/user-profile` corriendo).

Estado:
- Canvas revisado y aprobado por el usuario el 17/11, con los cambios F9 (colores) y F10 (foto, solo diseño).
- Código del FE commiteado en la rama `feature/user-profile` (17/11), **sin push**: un commit con la paleta (F13) y otro con la feature. El merge a `main` lo hace el usuario, junto con el BE y después del SQL en prod. `ng build` (dev y prod) limpio;
  `ng test`: 26 de 27 archivos en verde. Falla `app.spec.ts` por falta del provider de Transloco
  (`TRANSLOCO_TRANSPILER`), ajeno a esta feature.
- Fuera de esta feature, sin seguimiento: `docs/antes-de-contactar-locales.md` y `public/.well-known/`. No
  commitearlos con esto.
- Backend terminado y commiteado en su rama `feature/user-profile` (343 tests en verde), sin push; pendiente la
  prueba con Postman. Ver `ballastasera-be/docs/user-profile-plan.md`.
- Pendiente de decidir: borrar el canvas vacío «Profilo ballerino»
  (https://claude.ai/artifact/8qmyYeEcdYuP2LJEHMG1mg), creado por error antes de usar el canvas de abajo.

Canvas: «ballastasera – Mappa e scheda evento» (https://claude.ai/artifact/JqQ8CdmVDhnZENtcaNfWfK),
actualizado el 16/11/2026:
- **3 · Scheda evento**: en la hoja «Chi ci va», tocar a una persona abre su perfil (edad, sexo, ruolo,
  estilos con nivel, WhatsApp, Instagram). Tweak «loggedIn» (sección Stato) apagado: tocar a alguien abre
  el login. «Paolo V.» muestra el perfil no disponible (404). La fila «Tu» abre el propio perfil con
  «Modifica il tuo profilo».
- **4 · Il tuo account** (nueva): Instagram, WhatsApp con «Mostra il mio WhatsApp» y la vista previa del
  número normalizado (F3), «Profilo visibile», fecha de nacimiento, sexo, ruolo, estilos con nivel y
  «Salva». Se llega desde la tarjeta del perfil del menú lateral.
- **Fila «Chi ci va → il profilo di chi partecipa»** (debajo): 3b lista abierta, 3c perfil, 3d sin
  sesión (login), 3e perfil no disponible. Son la pantalla 3 abierta en cada paso (tweak `startView` de la
  3: chiuso / lista / profilo / accesso / privato), así que cambiar la 3 las cambia todas.

**Qué del canvas entra en esta fase y qué no:** la hoja de «Chi ci va» del canvas ya tenía pestañas
(Tutti / Amici / Cercano compagnia), búsqueda por nombre, «Segui» y «Amici». **Nada de eso entra
ahora**: depende de los follows (fase 2 del BE) o no tiene backend. En esta fase la lista es solo los
perfiles públicos, paginada, y tocar abre el perfil.

---

## 1. Decisiones cerradas

| # | Tema | Decisión |
|---|---|---|
| F1 | Diseño | Canvas primero, como «Diventa organizzatore»; después se implementa igual |
| F2 | Perfil sin sesión | La lista de asistentes es pública, pero `GET /users/{id}` pide login: sin sesión, tocar a alguien abre el `auth-modal` con «Accedi per vedere il profilo» |
| F3 | WhatsApp | El usuario lo escribe libre (`333 123 4567`, `+39 333…`, `0039…`). El FE quita espacios, guiones, puntos y paréntesis; `00` al principio pasa a `+`; sin `+`, antepone `+39`. Después valida igual que el BE: `^\+[1-9]\d{6,14}$` |
| F4 | Guardado | El BE reemplaza el formulario completo (P5 del BE): lo que no se manda queda `null`. **El FE manda siempre todos los campos**, también con el flag apagado (los ocultos con los valores actuales del usuario), así guardar Instagram no borra el resto |
| F5 | Botón «Salva» | Deshabilitado mientras guarda (P13 del BE). Ya lo hace `FormSave` en `account` |
| F6 | Errores | El BE manda mensajes técnicos en inglés. El FE valida antes en el cliente con textos en italiano y, si llega un 400, traduce las claves de `errors` (`whatsapp`, `birthDateValid`, `danceStyles`, `danceStyles[0].level`, `instagram`) |
| F7 | Flag apagado | `account` se ve como hoy; «Chi ci va» se ve como hoy (sin «Vedi tutti» y sin caras clicables). Lo único que cambia sin flag es el body del PATCH (F4) |
| F8 | Deploy | BE y FE juntos: el FE de hoy, contra el BE nuevo, vaciaría los campos nuevos al guardar |
| F9 | Colores del perfil (17/11) | Más colorido por ser algo personal: la cabecera se tiñe con el color del avatar, las etiquetas (edad, sexo, ruolo) van en azul, rosa y turquesa, y las tarjetas de WhatsApp e Instagram con su color. Nivel: de verde (Principiante `#4ade80`, Intermedio `#9be15d`) a oro (Avanzato `#f5c04a`, Insegnante `#ffa62b`), tokens `--ev-level-N`; los mismos colores en el selector de nivel de «Il tuo account». En uso verde→oro (el tweak `coloreLivello` de la pantalla 3 deja comparar). Las barras de entonces las reemplazó la insignia (F12) |
| F10 | Foto propia (17/11, **solo diseño**) | En «Il tuo account» el avatar tiene un botón de cámara: «Carica una foto» (JPG/PNG/WebP, máx. 5 MB, propuesta), «Usa la foto di Google» y «Togli la foto» (se ve la inicial). La foto se guarda al momento, no con «Salva» (confirmado por el usuario el 17/11). **No entra en esta fase**: falta el backend (upload a S3 como los flyers, endpoint propio). Tweak `fotoProfilo` de la pantalla 4: google / personale / nessuna |
| F11 | «Salva» y «Annulla» (17/11) | «Salva» se activa solo si el formulario guardaría algo distinto de lo último guardado (`sameProfile`, que compara como se mandaría: `333 123 4567` = `+393331234567`, estilos en cualquier orden). Cambiar algo y volver a dejarlo como estaba lo apaga. «Annulla», junto a «Salva» y solo con cambios, vuelve a lo último guardado |
| F12 | Símbolo del nivel (17/11) | Grados como en los juegos en vez de barras (que parecían la señal del teléfono) o estrellas (se leerían como un voto a la persona): Un escudo común con 1–3 chevrons llenos; Insegnante, el escudo lleno con una estrella recortada (el nivel más alto es el mismo escudo «evolucionado», no otro símbolo, como hacen los juegos). Formas llenas, no líneas finas, para que se lean a 20–26px. En el color del nivel. El mismo en «Il tuo account», en el perfil y en el canvas |
| F13 | Paleta del tema oscuro (17/11) | **Fuera del perfil, pero en esta rama:** el viola/prugna se va de toda la app. `--color-ink` `#1b1819`, `--color-ink-2` `#2a2527`, `--color-ground` `#0f0d0e` (carbón cálido) y las superficies `--ev-*` mezcladas con bone, no con violeta; el tema claro con grises cálidos. «Seleccionado» = crema invertido (`--ev-primary` = `--ev-invert-bg`, texto `--ev-on-primary`): Parteciperò, filtros, chips, toggles pulsados; el rosa queda para la acción principal. Toca 10 plantillas de mapa, lista, filtros, locale, scuole y gestión (`text-white` → `text-(--ev-on-primary)`), `theme-color` (`index.html`, `ThemeService`, `site.webmanifest`) y el canvas. El violeta solo queda como color de categoría (scuole, iconos del drawer, landing) |

## 2. Lo que ya existe y se reutiliza

- **`features/account`**: formulario «I tuoi dati» (Instagram + «Profilo visibile») con `FormSave`
  (`core/utils/pending-action.ts`), `RequestField`, `InstagramInput`.
- **`features/event-details`**, sección «Chi ci va» (`crowd()`): caras + «Sara e Luca e altri 10». El
  comentario del template ya prevé el «Vedi tutti» que abre la lista completa.
- **Modales**: `<dialog class="ev-dialog">` con `showModal()` (`confirm-sheet`, `event-filters-dialog`):
  hoja desde abajo en el teléfono, tarjeta desde `md`.
- **`auth-modal`**: el login de Google.
- **Utils**: `waMeUrl` e `instagramUrl` (`core/utils/event-format.ts`), `optionalInstagram`
  (`core/utils/form-validators.ts`), `initialOf`.
- **`DanceStylesService`** y `DanceStyleDto`: la lista de estilos para elegir.
- **`EventsService.getAttendees(eventId, size)`**: ya pagina (`SpringPage<EventAttendeeDto>`).

## 3. Pantallas (canvas)

1. **«Il tuo account» con el perfil de baile**, en el mismo formulario y con un solo «Salva»:
   - data di nascita (solo la ve el usuario; los demás ven la edad);
   - sesso: Uomo / Donna / Altro / Preferisco non dirlo;
   - ruolo: Leader / Follower / Entrambi (a confirmar en el canvas: ¿Cavaliere / Dama?);
   - WhatsApp + switch «Mostra il mio WhatsApp» (default activo) con el texto de quién lo ve;
   - stili e livello: elegir estilos (máx. 10) y para cada uno Principiante / Intermedio / Avanzato /
     Insegnante.
2. **Lista de «Chi ci va»** (hoja): se abre desde las caras o «Vedi tutti». Foto, nombre e Instagram,
   «Carica altri» (20 por página). Solo salen los perfiles públicos: el total de `goingCount` puede ser
   mayor, la hoja lo dice («Gli altri partecipano in incognito»).
3. **Perfil de un usuario** (hoja, se abre desde la lista): foto, nombre, edad, ruolo, estilos con nivel,
   Instagram y WhatsApp como botones (`instagramUrl`, `waMeUrl`). Estados: cargando, perfil no disponible
   (404: se volvió privado), sin sesión → `auth-modal` (F2).

## 4. Archivos

Cada componente nuevo tiene sus tres archivos: `.ts`, `.html` y `.css`. Los colores salen de los tokens
`--ev-*` de `styles.css`, así funcionan en tema claro y oscuro.

### Nuevos

| Archivo | Qué |
|---|---|
| `core/config/dance-profile.ts` | Etiquetas en italiano de `Gender`, `DanceRole`, `DanceLevel`, `levelRank`, límites (10 estilos, 16–100 años) |
| `core/utils/whatsapp.ts` + `.spec.ts` | `normalizeWhatsapp` e `isValidWhatsapp` (F3) |
| `core/utils/profile-errors.ts` + `.spec.ts` | Claves de `errors` del 400 (y el 404 de un estilo) → textos en italiano (F6) |
| `core/utils/user-update.ts` + `.spec.ts` | `profileFormValue(user)` y `toUserUpdate(form)`: el formulario completo ida y vuelta (F4) |
| `core/utils/form-validators.spec.ts` | Tests de `optionalWhatsapp`, `shiftYears` y `birthDateAllowed` |
| `core/utils/form-controls.ts` | `controlValue` (el valor de un control como señal: los componentes son OnPush por defecto en Angular 22) y `toggleControl` (el switch) |
| `core/utils/initials.ts` + `.spec.ts` | `initialOf` (ya existía) y `firstNameOf`, para no repetir el `split` del nombre |
| `core/utils/person-tone.ts` + `.spec.ts` | Color fijo por persona (inicial en la lista y cabecera del perfil) |
| `core/services/users.service.ts` | `getProfile(id)` → `GET /rest/users/{id}` |
| `shared/level-insignia/` | La insignia del nivel, como los grados de un juego: el mismo escudo para todos, con 1–3 chevrons llenos (Principiante, Intermedio, Avanzato); para Insegnante, el escudo lleno con una estrella recortada. En `currentColor` |
| `shared/level-meter/` | Insignia + nombre del nivel, de verde a oro (F9), en el perfil que ven los demás |
| `shared/toggle-switch/` | El switch de «Profilo visibile», reutilizado en «Mostra il mio WhatsApp» |
| `features/account/profile-form.ts` | El formulario y `PROFILE_FORM`: `account` lo provee y sus grupos de campos lo inyectan |
| `features/account/whatsapp-field/` | WhatsApp, vista previa «Lo salviamo come +39…» y switch de visibilidad |
| `features/account/dancer-fields/` | Fecha de nacimiento, sexo y ruolo. Sexo y ruolo son `app-choice-group` (`clearable`, `tone="invert"`) |
| `shared/choice-group/` (movido desde `event-editor/choice-group`) | El mismo componente del formulario de serate, ahora compartido. Nuevo: `tone` (`pick` azul, como en serate; `invert` crema, en la cuenta) y `clearable` (tocar lo elegido lo quita) |
| `features/account/birth-date-picker/` | La fecha de nacimiento con el mismo datepicker de Spartan que «Giorno» de una serata, con desplegables de mes y año (años de hace 100 a hace 16) y botón para quitarla |
| `core/config/calendar-it.ts` | El calendario en italiano (`CALENDAR_IT`, `MONTHS`), compartido por `DayPicker` y `BirthDatePicker` |
| `features/account/dance-styles-field/` | Elegir estilos (máx. 10) y el nivel de cada uno. Se adapta al ancho que tiene (container query): en el teléfono, una fila de 4 botones con la insignia de cada nivel (`level-insignia`) en su color, y el nombre del nivel elegido junto al del estilo; desde 26rem los botones muestran el nombre del nivel; desde 40rem una fila por estilo (nombre · 4 niveles · ✕). En desktop ocupa todo el ancho del formulario, debajo de las dos columnas |
| `features/event-details/attendees-sheet/` | La hoja «Chi ci va»: lista paginada (20) y navegación al perfil. Cabecera con las primeras caras, «N persone · N in incognito»; el usuario primero («Tu»); filas enteras pulsables con el anillo del color de cada persona; esqueletos mientras carga; «Carica altri» con cuántos faltan; misma altura en lista y perfil. Abrirla ya no lleva la página arriba (el bloqueo del scroll pasó de `html` a `body` en `styles.css`) |
| `features/event-details/attendee-profile/` | El perfil de una persona dentro de la hoja: cargando, listo, 404, error |

### Modificados (solo agregando, y lo visible detrás del flag)

| Archivo | Qué |
|---|---|
| `core/models/user.model.ts` | `UserDto` y `UserUpdateDto` ampliados; tipos nuevos y `UserProfileDto` |
| `core/models/event.model.ts` | `EventAttendeeDto` + `instagram` (el BE ya lo manda) |
| `core/api/endpoints.ts` | `users.profile(id)` |
| `core/services/events.service.ts` | `getAttendees(eventId, size, page = 0)` |
| `core/config/feature-flags.ts`, `environments/environment.ts`, `environment.staging.ts` | Flag `dancerProfile` |
| `core/utils/form-validators.ts` | `optionalWhatsapp`, `birthDateInRange` (16–100), `shiftYears`, `birthDateAllowed` |
| `styles.css` | Tokens `--ev-level-1..4` y `--ev-on-level`, en oscuro y en claro |
| `shared/auth-modal/` | Input opcional `text`: «Accedi … per vedere il profilo di chi partecipa» (F2) |
| `features/account/account.ts` / `.html` | Formulario completo siempre (F4), secciones nuevas detrás del flag, `app-toggle-switch`. En desktop (container queries sobre `<main>`): desde `@4xl` dos columnas (quién eres, organizador y «Esci» a la izquierda; «I tuoi dati» a la derecha); desde `@6xl` el formulario también se parte en dos (contactos y visibilidad / perfil de ballo). En el móvil no cambia |
| `features/event-details/event-details.ts` / `.html` | «Vedi tutti» y caras clicables que abren la hoja (flag) |
| `features/event-management/.../day-picker/day-picker.ts` | Importa `CALENDAR_IT` de `core/config/calendar-it.ts` en vez de tenerlo dentro (sin cambios de comportamiento) |

## 5. Checklist

### Diseño
- [x] Canvas: perfil en «Chi ci va» (3, 3b–3e) e «Il tuo account» (4)
- [x] Revisado por el usuario (17/11), con F9 y F10

### Código
`[~]` = escrito, compila y tiene tests unitarios donde aplica; pasa a `[x]` con la prueba contra el BE local.

- [~] Modelos, endpoint, `UsersService`, flag
- [~] `dance-profile.ts`, `whatsapp.ts`, `profile-errors.ts`, `user-update.ts` + specs
- [~] Validadores en `form-validators.ts` + spec
- [~] `account`: body completo en `save()` (F4), **también con el flag apagado**
- [~] `whatsapp-field`, `dancer-fields`, `dance-styles-field`
- [~] `attendees-sheet`, `attendee-profile`, cambios en `event-details`
- [x] `ng build` (dev y prod) limpio; `ng test` en verde salvo `app.spec.ts` (Transloco, ajeno)

### Prueba contra el BE local (`ng serve --configuration staging`)
- [ ] Guardar el perfil completo y recargar: todo se mantiene
- [ ] Cambiar un nivel y quitar un estilo
- [ ] Vaciar WhatsApp y fecha
- [ ] Con el flag apagado: guardar Instagram no borra los demás campos
- [ ] Lista de «Chi ci va» con más de 20 personas («Carica altri»)
- [ ] Perfil de otro con WhatsApp visible y oculto; perfil que se volvió privado (404)
- [ ] Sin sesión: tocar a alguien abre el login
- [ ] Doble click en «Salva»: un solo request
