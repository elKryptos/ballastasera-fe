# Antes de contactar a los locales

Creado el 13/11/2026, estado revisado contra el código el 22/11/2026. Qué falta para ofrecer ballastasera gratis a los locales sin que se cansen en
la primera semana, y cómo mostrar la plataforma mientras todavía hay pocos usuarios.

Convención: `[ ]` no empezado · `[~]` en progreso (con nota) · `[x]` hecho y probado.

---

## 1. Bloqueantes (antes del primer contacto)

### 1.0 Reclamar una página sin dueño
- [x] En la ficha de una serata («Chi organizza») y en la del local, si el organizador no tiene dueño,
      aparece el aviso para reclamarla (`app-claim-page-prompt`), que lleva al flujo de «Diventa
      organizzatore» con esa página. Así un local que se encuentra ya publicado no tiene que escribirnos.

### 1.1 Bienvenida del organizador con pasos en «Presto»
- [x] «Pubblica la prima serata» enlaza a `/serate-pubblicate/nuova` (con `eventManagementPage` activo).
- [x] El botón principal de abajo pasa de «Vai al menu» a «Pubblica la prima serata».
- [x] Comentario de `organizer-welcome.html` actualizado.
- «Crea una serata ricorrente» sigue en «Presto» a propósito: ver 1.2.

### 1.2 Serate fijas semanales: por ahora solo el admin
**Decisión (22/11/2026): las series las crea solo el admin.** Si un local tiene un social fijo cada
semana, se lo creamos nosotros desde `/admin/create-event-series`. `offerSeries` en
`schedule-section.ts:25` sigue exigiendo `scope === 'admin'`, y en la bienvenida el paso queda en «Presto».

Para cuando se abra a los organizadores (no antes del primer contacto):
- [ ] Crear series desde `/serate-pubblicate` (organizador): mismo formulario o paso «Ogni settimana».
- [ ] Generar las ocurrencias al crear (endpoint `eventSeries.generateOccurrences` ya existe).
- [ ] Ver y editar la serie desde la lista de serate (no solo cada ocurrencia).
- [ ] BE: validar `startTime < endTime` en `EventSeriesCreateDto`/`UpdateDto` (deuda en `ROADMAP.md`).
- [ ] BE: decidir si las ocurrencias de un organizador verificado nacen ya publicadas (ver `ROADMAP.md`,
      «Notas de decisiones pendientes»).

### 1.3 Página del local con sus próximas serate
- [ ] `/luogo/:id` hoy solo tiene «Chi siamo», «Dove» y contactos: añadir «Prossime serate».
- [ ] BE: endpoint de eventos futuros por venue (o filtro `venueId` en `/rest/events`), si no existe.
- [x] Botón «Condividi» en la página del local.
- [~] SEO de la página: título y descripción hechos (`venueSeo` en `venue-details.ts`); falta la imagen
      OG con el logo del local, para que el enlace se vea bien en Instagram/WhatsApp.

Por qué: es el enlace que el local pondrá en su bio de Instagram. Si lo comparten ellos, traen
usuarios gratis — y eso resuelve en parte el problema de la sección 3.

---

## 2. Importantes (primeras semanas)

### 2.1 Página pública del organizador
- [ ] En `event-details`, «Chi organizza» no lleva a ninguna página. Crear `/organizzatore/:slug`
      (el BE ya tiene `GET /rest/organizers/{slug}`) con logo, descripción y próximas serate.

### 2.2 Vinculación del local sin escribirnos
- [ ] `organizer-profile.html`: «Per collegare o cambiare un locale scrivici: lo gestiamo noi».
      Con pocos locales vale; cuando crezca, que el organizador pueda pedir el cambio desde la app.

### 2.3 Dashboard del organizador con cifras honestas
- [ ] `managed-event.html` (las tarjetas de cifras) muestra «0 ci vado / 0 like» en grande. Con 0, mostrar un estado
      vacío útil en vez del cero: «Condividi il link: i primi ci vado arrivano da lì» + botón copiar.
- [ ] Añadir **visualizaciones** de la página de la serata (contador real en el BE, sin login).
      Es la cifra que sube antes: la gente que llega desde Instagram mira sin registrarse.

---

## 3. Pocos usuarios: qué mostrar sin inventar números

### No generar «ci vado» ni like falsos
- Son endorsements sociales falsos. En la UE están en la lista negra de prácticas comerciales
  desleales (Directiva 2005/29/CE, Anexo I punto 23 quater, añadido por la Directiva Omnibus
  2019/2161; en Italia, Codice del Consumo). Riesgo de multa del AGCM.
- El local ve esas cifras en su dashboard y decide con ellas. Si un día le cobráis, se lo estaréis
  vendiendo con datos inventados — y la gente que «va» no aparece en la puerta.
- Las caras de «Chi ci va» serían personas que no existen.

### Lo que ya está bien
- La parte pública ya esconde los ceros: `event-list.html:220`, `event-map-card.html:73-77`,
  `menu.html:121`, `my-night-card.html:39` y «Chi ci va» solo aparecen con cifras > 0.
  Un visitante no ve «0 persone»: simplemente no ve nada. Solo el dashboard del organizador
  enseña el cero (ver 2.3).

### Señales reales que sí se pueden mostrar
- [ ] Visualizaciones de la serata (2.3) — en el dashboard del organizador.
- [ ] Cuántas serate hay esta semana en Milano / cuántos locales hay en el mapa (dato real, ya
      lo tenéis: el menú ya muestra «N live ora»).
- [ ] Etiquetas de contenido, no de gente: «Nuova», «Ogni giovedì», «Ingresso gratuito».

### Cómo conseguir los primeros «ci vado» reales
- Vosotros y vuestros amigos marcáis «ci vado» cuando de verdad vais: es real y ya da caras.
- Los alumnos de las escuelas que ya están en `/scuole`: la escuela les pasa el enlace de su social.
- Cada flyer que generéis en `/admin/social` lleva el enlace de la serata en ballastasera.
- Al local se le pide una sola cosa: que ponga el enlace de su página (1.3) en la bio y en las stories.

### Cómo presentarlo al local
- Honesto: «Estamos empezando en Milano, es gratis, y los primeros locales salen destacados».
  El argumento no es «tenemos miles de usuarios», sino «publicas en 1 minuto, tu serata semanal se
  repite sola, y tienes una página para tu bio que muestra quién va».

---

## 4. Después del lanzamiento a locales

- [ ] «Segui» local/organizador (Bloque 3 de `ballastasera-be/docs/ROADMAP.md`).
- [ ] Email semanal «Questa settimana a Milano» con las serate de lo que sigues y lo que marcaste.
- [ ] Recordatorio «Stasera vai a…» para los «ci vado» (Bloque 5 del ROADMAP).
- [ ] Web push en la PWA (en iPhone solo con la app instalada en la pantalla de inicio).
- [ ] «Amici» (hoy «Presto» en el menú lateral, `navbar.html`): solo cuando haya volumen de usuarios.
