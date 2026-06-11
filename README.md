# ⚽ Polla Amigos — Mundial 2026

Sitio web responsive para jugar la polla del Mundial 2026 con tus amigos:
pronósticos de partidos, premios del torneo, tablas de posiciones y **resultados
en tiempo real** desde un proveedor gratuito. Soporta **varias pollas
independientes** en la misma instancia, cada una con su propio administrador.

## Reglas de puntuación

| Acierto                                    | Grupos | Eliminatorias |
| ------------------------------------------ | :----: | :-----------: |
| Resultado (local / empate / visitante)     |   1    |       2       |
| Marcador exacto                            |   2    |       3       |
| Goles exactos de un equipo (por cada uno)  |   2    |       2       |

| Premio             | Puntos | Premio              | Puntos |
| ------------------ | :----: | ------------------- | :----: |
| Campeón            |   10   | Goleador            |   7    |
| Subcampeón         |   7    | Mejor jugador       |   7    |
| Tercer puesto      |   4    | Mejor arquero       |   5    |
| Cuarto puesto      |   4    | Mejor jugador joven |   5    |

- **Los aciertos se acumulan**: un pleno en grupos paga 1 + 2 + 2 + 2 = **7 puntos**
  (resultado + marcador + goles de ambos equipos). En eliminatorias: 2 + 3 + 4 = **9**.
- Todo se puntúa sobre el marcador de los **90 minutos** (en eliminatorias el
  empate cuenta como resultado).
- ¿Prefieres que no se acumulen? Cambia los dos booleanos en
  [src/features/scoring/rules.ts](src/features/scoring/rules.ts)
  (`exactScoreIncludesOutcome` y `teamGoalsStackWithExactScore`) — la página de
  reglas y los ejemplos se actualizan solos.

## Cómo funciona

- **Roles**: la primera cuenta del sistema (hazlo tú) queda como
  **superadmin** — ve todas las pollas, crea pollas nuevas y administra los
  datos del torneo (sync, corrección de resultados, premios oficiales). Cada
  polla tiene además su **admin**, que invita a su gente y valida sus premios.
- **Varias pollas**: en *Admin → Pollas* el superadmin crea una polla nueva
  («Polla de la oficina») y comparte su **link de admin**: quien lo use queda
  al mando de esa polla. Cada polla tiene participantes, invitaciones y tabla
  de posiciones completamente separados; el fixture y los resultados en vivo
  se comparten. El superadmin puede ver cualquier tabla con el selector en
  *Posiciones*.
- **Jugar en varias pollas**: una misma cuenta puede participar en más de una
  polla (con pronósticos independientes en cada una). El superadmin se une a
  cualquiera con el botón «Unirme» de *Admin → Pollas*; cualquier otro usuario
  puede aceptar el link de invitación de otra polla con su cuenta existente.
  Con 2+ pollas aparece un selector en la barra superior para alternar.
- **Solo se entra por invitación.** Todo el mundo necesita una invitación que
  el admin de cada polla crea en *Admin → Invitaciones* y comparte como link
  (`/invitacion/CÓDIGO`) por WhatsApp.
- Las invitaciones son **individuales o de pareja**:
  - *Individual*: una persona, una cuenta.
  - *Pareja*: el mismo código sirve para **dos cuentas** (cada uno con su
    usuario y PIN). Comparten pronósticos y puntaje, y compiten como un solo
    participante 👥 en la tabla. El primero define el nombre del equipo (si no,
    se arma «Ana & Beto»). También puedes crear un código «Sumar a MI pareja»
    para convertir tu propia entrada en pareja.
  - Puedes mezclar: una polla con individuales y parejas a la vez.
- Cada quien se registra con **usuario + PIN** (4-6 dígitos).
- Los pronósticos de cada partido se pueden editar **hasta 10 minutos antes
  del kickoff**; los de los demás se revelan cuando el partido arranca
  (anti-copia).
- Los premios del torneo (campeón, subcampeón, 3.º, 4.º, goleador, mejor
  jugador, arquero y joven) se eligen en la página *Premios* y cierran **10
  minutos antes del primer partido** del Mundial. Los equipos salen de un
  select y los jugadores de un **buscador con la plantilla real de las 48
  selecciones** (catálogo descargado de ESPN — nada de texto libre ni typos).
  Se sincroniza solo con el primer sync; el superadmin puede refrescarlo con
  «Sincronizar plantillas» cuando la FIFA publique las listas definitivas. La
  página *Partidos* muestra un recordatorio mientras te falten premios.
- **Idiomas**: toggle **ES/EN** arriba a la derecha (preferencia por cookie,
  toda la interfaz traducida).
- Los resultados llegan solos del proveedor mientras hay partidos en juego
  (sync automático cada 60 s, respetando los límites del plan gratuito). El
  admin puede corregir cualquier marcador a mano (queda con candado).
- Tabla de posiciones con puntos firmes + provisionales de partidos en vivo.
  Desempate: más marcadores exactos.

## Base de datos: Neon (Postgres)

La app usa **Postgres**. En producción la base vive en
[Neon](https://neon.tech) (serverless, plan gratuito de sobra para una polla):

1. Crea una cuenta y un proyecto en [neon.tech](https://neon.tech) (30 segundos).
2. En el dashboard pulsa **Connect** y copia el *connection string*
   (`postgresql://...@....neon.tech/neondb?sslmode=require`).
3. Pégalo en `.env` como `DATABASE_URL=...`.

Las tablas se crean solas en el primer arranque. **Sin `DATABASE_URL`** la app
usa [PGlite](https://pglite.dev) (Postgres embebido) en `./data/pglite` —
ideal para probar en local sin cuentas, pero no para producción.

## Arranque rápido (WSL)

El proyecto vive en WSL (`Ubuntu-20.04`) y usa Node 22 instalado vía nvm.

```bash
# dentro de WSL
cd ~/git/polla_amigos
cp .env.example .env        # pega tu DATABASE_URL de Neon y un SESSION_SECRET
npm install                 # solo la primera vez
npm run build
npm start                   # http://localhost:3000
```

Desde Windows también puedes usar los wrappers (cargan nvm solos):

```powershell
wsl -d Ubuntu-20.04 -- bash ~/git/polla_amigos/scripts/run.sh dev    # desarrollo
wsl -d Ubuntu-20.04 -- bash ~/git/polla_amigos/scripts/run.sh build  # compilar
wsl -d Ubuntu-20.04 -- bash ~/git/polla_amigos/scripts/run.sh test   # tests del motor de puntos
```

Tras arrancar: **regístrate (serás superadmin) → Admin → «Sincronizar ahora»**
para descargar los 104 partidos. Luego crea las invitaciones en *Admin →
Invitaciones* (y otras pollas en *Admin → Pollas*, si quieres) y comparte los
links.

## Tests

```bash
npm test    # vitest: motor de puntuación + flujo de invitaciones y parejas
```

## Proveedor de resultados en vivo

Tres adapters gratuitos intercambiables (variable `LIVESCORE_PROVIDER` en `.env`):

| Proveedor | Valor | API key | Notas |
| --- | --- | --- | --- |
| ESPN | `espn` | No necesita | **Default**: marcadores en vivo muy rápidos desde la API pública de ESPN (ventana ayer/hoy/mañana); el fixture completo se siembra solo desde worldcup26 la primera vez |
| [football-data.org](https://www.football-data.org) | `football-data` | Gratis ([registro](https://www.football-data.org/client/register)) | Estable y con fixture oficial; marcadores con un pequeño delay en el plan gratis (10 req/min) |
| [worldcup26.ir](https://github.com/rezarahiminia/worldcup2026) | `worldcup26` | No necesita | Proyecto comunitario open source |

Sin configuración usa `espn` (o `football-data` si defines
`FOOTBALL_DATA_API_KEY`). Los partidos se cruzan entre proveedores por nombre
de equipo (con alias para los nombres divergentes tipo «Czechia» vs «Czech
Republic»). Pase lo que pase, el superadmin siempre puede fijar resultados a
mano desde el panel.

### Cómo se mantienen los datos al día

- **Durante los partidos**: cada navegador con la app abierta dispara un tick
  cada 60 s (`/api/live`); el servidor sincroniza como máximo **1 vez por
  minuto** sin importar cuántos usuarios haya, y solo mientras haya partidos
  en su ventana de juego (15 min antes del kickoff hasta 4 h después). Cuando
  el partido termina (`Final`), sale de la ventana y el polling se apaga solo.
- **Garantía sin visitas** (recomendado en producción): crea un monitor
  gratuito en [cron-job.org](https://cron-job.org) que haga `GET` a
  `https://tu-polla.vercel.app/api/live` **cada 1-5 minutos**. Es idempotente
  y barato: si no toca sincronizar, responde al instante. (El `vercel.json`
  incluye además un cron diario de respaldo para refrescar el fixture.)
- **Clasificados de eliminatorias**: cuando hay cruces «por definir» a menos
  de 7 días, cada sync re-consulta el fixture completo y los rellena solo —
  los partidos de dieciseisavos en adelante se completan automáticamente al
  definirse cada llave (verificado con tests de no-duplicación).
- **Banderas y plantillas**: el sync de plantillas (automático la primera vez,
  botón «Sincronizar plantillas» en Admin) trae logo y sigla de las 48
  selecciones + sus jugadores desde ESPN.

## Para que tus amigos entren

Con la base en Neon la app es 100 % serverless-friendly. La vía recomendada:

**Deploy en Vercel (gratis, ~5 minutos)**

1. Sube el repo a GitHub (`git init && git add -A && git commit && git push`).
2. En [vercel.com](https://vercel.com) → *New Project* → importa el repo
   (framework: Next.js, sin configuración extra).
3. En *Environment Variables* agrega: `DATABASE_URL` (tu connection string de
   Neon), `SESSION_SECRET` (algo aleatorio largo) y `COOKIE_SECURE=true`.
4. Deploy → comparte `https://tu-polla.vercel.app`, regístrate primero
   (quedas de superadmin), sincroniza y reparte invitaciones.

Alternativas: correrla en tu PC y exponerla con
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
(`cloudflared tunnel --url http://localhost:3000`), o cualquier host Node
(Railway, Render, Fly.io) con las mismas variables de entorno. Si la sirves
por HTTP plano deja `COOKIE_SECURE=false`.

## Estructura

```
src/
├── app/                  # rutas (App Router) y API
├── features/
│   ├── auth/             # registro/login con PIN + sesión JWT en cookie
│   ├── pollas/           # pollas independientes (multi-grupo) y sus admins
│   ├── entries/          # participantes (individuales y parejas)
│   ├── invites/          # invitaciones por polla (códigos y links)
│   ├── matches/          # partidos y resultados
│   ├── predictions/      # pronósticos de marcadores (por participante)
│   ├── awards/           # premios del torneo
│   ├── scoring/          # motor de puntos (puro, con tests) y reglas
│   ├── leaderboard/      # tabla de posiciones
│   ├── livescore/        # proveedores + sync throttled
│   └── admin/            # paneles del administrador
└── shared/               # db (better-sqlite3), tipos y componentes comunes
```
