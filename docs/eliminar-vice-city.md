# Eliminar Vice City (GTA VI) después de la temporada

La temporada Vice City se apaga sola después de la noche del **30 de noviembre de 2026** y no vuelve otros años (`year: 2026` en `SEASONS`). A partir de entonces todo su código está muerto: hay que borrarlo.

Lo general se queda: la lista `SEASONS` del servicio, Halloween y el brillo del logo en `navbar.css`, que ahora sale de `--color-rose` y también lo usa Halloween.

## Borrar archivos enteros

- `src/app/shared/season/vice.ts`: `ViceDefs`, `ViceStars` y `ViceHorizon`.
- `src/season-vice.css`.

## `src/styles.css`

Borrar el import y su comentario:

```css
/* Vice City (GTA VI's launch), inert outside <html data-season="vice">. */
@import './season-vice.css';
```

## `src/app/core/services/season.service.ts`

- `type Season = 'halloween' | 'vice';` → `type Season = 'halloween';`
- En `SEASONS`, borrar la línea `{ season: 'vice', start: [10, 19], end: [10, 30], year: 2026 },`.
- Borrar `readonly vice = computed(...)`.
- Comentarios: quitar las menciones a Vice City, `season-vice.css` y `?stagione=vice`, en el comentario de `SEASONS` y en el JSDoc de la clase.
- El campo opcional `year` solo existe por Vice City. Si no hay otra temporada de un solo año prevista, quitarlo del tipo de `SEASONS` y de la condición `(s.year === undefined || s.year === year)` en `seasonOf`.

## `src/app/shared/navbar/navbar.ts`

- Borrar `import { ViceDefs, ViceHorizon, ViceStars } from '../season/vice';`.
- Quitar `ViceDefs`, `ViceHorizon` y `ViceStars` de `imports`.
- Borrar la propiedad `vice` y su comentario.

## `src/app/shared/navbar/navbar.html`

En la plantilla `#brand`:
- Borrar el comentario `<!-- Vice City only (season-vice.css): ... -->` y los dos `<path class="season-vice" ...>` de la palmera.
- En la gota, quitar `class="brand-drop"`: solo la usaba `season-vice.css`.
- En «stasera», quitar `brand-night` de `class="brand-night night text-rose"`, por el mismo motivo.
- Borrar `@if (vice()) { <app-vice-stars /> }`.

Justo después de la plantilla:
- Borrar `@if (vice()) { <app-vice-defs /> }`.

En la barra móvil (`<header class="mobile-bar">`):
- Borrar `@if (vice()) { <app-vice-horizon /> }`.

## `src/app/core/config/feature-flags.ts`

En el comentario de `seasonalThemes`, quitar «Vice City for GTA VI's launch»: queda `/** The seasonal looks (Halloween), dated by SeasonService. */`.

## Comprobar

1. Buscar restos: `vice`, `Vice` y `brand-drop` en `src/` no deberían dar nada. Ojo, `vice` aparece dentro de `service`: hay que buscar la palabra entera.
2. `pnpm build` sin errores.
3. `pnpm test`.
4. En local, con `?stagione=halloween` el logo sigue siendo la calabaza, con su brillo naranja. Con `?stagione=vice` no pasa nada.
5. Borrar también este archivo.
