# Personal Tracker / LifeTracker

Personal OS de Brandon para metas, misiones, agenda, hoja de ruta, revisiones,
analítica y finanzas. Esta carpeta es la copia de trabajo dentro del Second Brain.

## Requisitos

- Node.js 22.13+ o 24+
- npm 10.9+
- `.env.local` con la configuración Firebase y los secretos server-side
  indicados en `.env.example`

## Ejecución local

```bash
npm ci
npm run api:token
npm run dev
```

Abrir `http://127.0.0.1:3000`. Tanto desarrollo como producción se enlazan por
defecto a loopback. El token de API se genera dentro de `.env.local`, no se
imprime y no se versiona.

El acceso web usa una cookie `HttpOnly` firmada. `TRACKER_ACCESS_CODE` y
`TRACKER_SESSION_SECRET` permanecen en el servidor; el código ya no se compara
ni persiste en el navegador.

## Validaciones

```bash
npm run test
npm run typecheck
npm run lint
npm run build
npm run check
```

Estado al 2026-08-31:

- Instalación reproducible: correcta.
- TypeScript: correcto.
- Build de producción: correcto.
- ESLint: deuda heredada de 36 errores y 56 advertencias en la UI existente.
- Tests automatizados: 14 casos para contrato Vibe, mes/fecha CDMX, salud del
  negocio, límite de intentos y sesión firmada.

## Vibe Marketing en Finanzas → Negocio

El corte mensual de pauta y ventas se absorbe automáticamente desde el export
agregado `vibe-business-summary/v1`. La interfaz conserva el diseño del Health
Check y muestra gasto neto, IVA, gasto con IVA, conversaciones, ventas,
ingreso conciliado, CPA, ROAS, calidad de fuentes y detalle por track.

Vibe es la fuente canónica de pauta/ventas cuando el corte está disponible; los
registros manuales del mismo mes quedan como fallback y **no se suman**, para
evitar doble conteo. Capital, costo por prueba y gastos fijos continúan siendo
propiedad de Personal Tracker. La conexión es de solo lectura y sus tokens nunca
llegan al navegador.

La UI consulta `GET /api/integrations/vibe/summary?month=YYYY-MM`, una ruta
interna protegida por la sesión web. El servidor valida host, HTTPS, ruta,
tamaño, timeout y contrato; las respuestas usan `Cache-Control: no-store`. Si la
fuente no está disponible, el Health Check mantiene el registro manual como
fallback y muestra el estado de la conexión.

## API local v1

La API usa `Authorization: Bearer <TRACKER_LOCAL_API_TOKEN>`. El token local solo
se habilita cuando `TRACKER_API_ALLOW_LOCAL_TOKEN=true`.

Endpoints iniciales:

- `GET /api/v1/health` (liveness; no prueba acceso a Firestore)
- `GET /api/v1/me`
- `GET /api/v1/dashboard/summary?month=YYYY-MM`
- `GET /api/v1/finance/expenses`
- `POST /api/v1/finance/expenses/preview`
- `POST /api/v1/finance/expenses` con `Idempotency-Key`
- `GET /api/v1/agenda/template`
- `PUT /api/v1/agenda/template` con revisión optimista e `Idempotency-Key`
- `POST /api/v1/agenda/template/preview` (siempre sin escrituras)
- `POST /api/v1/agenda/weeks/apply` en modo `dryRun` o reemplazo atómico

Con el servidor activo, `npm run api:smoke` valida liveness, autenticación,
meses, precisión monetaria y previsualización sin escribir en Firestore. Por seguridad,
el script no envía el token fuera de loopback salvo opt-in explícito y HTTPS.

La API está pensada para uso local mientras se sustituye la autenticación actual
por Firebase Auth y credenciales de servidor. En esta transición, las rutas
reutilizan el SDK web anónimo: el bearer protege el proceso HTTP local, pero no
constituye una barrera de seguridad para Firestore. No expongas el puerto ni la
API públicamente.

`POST /api/v1/finance/expenses` persiste en el Firebase real. Usa primero
`/preview`; el smoke test omite deliberadamente una escritura exitosa.

Esta restricción aplica a `/api/v1`. No describe el proxy agregado de Vibe, que
solo puede leer el upstream configurado y exige una sesión web válida.

## Rutina de agenda Madriz v2

La definición versionada está en `src/data/routines/madriz-v2.json`. La semana
`2026-W36` contiene tres revisiones puntuales del lanzamiento WA; la plantilla
recurrente no las incluye. Antes de cualquier sustitución, genera un respaldo:

```bash
npm run agenda:backup
npm run agenda:preview:madriz
TRACKER_AGENDA_APPLY_CONFIRM=APPLY_MADRIZ_ROUTINE_V2 npm run agenda:apply:madriz
npm run agenda:verify:madriz
```

El respaldo y el estado de aplicación se guardan con permisos locales en
`.local-backups/agenda/`, carpeta excluida de Git. La aplicación está limitada a
loopback, valida primero 168 horas sin traslapes y sustituye cada semana de forma
atómica con IDs deterministas.

## Documentación

- `📊 Personal Tracker — Índice.md`
- `📡 Inventario API y Arquitectura.md`
- `🔗 Plan de integración — Dashboard de Negocio + Vibe Marketing.md`
- `.env.example`

## Despliegue

- Repositorio: `https://github.com/MarioB19/personal_tracker`
- Plataforma única: Vercel; el flujo durable es `main` → integración GitHub →
  deployment de producción.
- Proyecto histórico: `mario-muros-projects/personal-tracker`.
- No se usa ChatGPT Sites y el proyecto no debe conservar
  `.openai/hosting.json`.

Variables de producción requeridas —solo nombres, nunca valores—:

- `TRACKER_ACCESS_CODE`
- `TRACKER_SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `VIBE_EXPORT_URL`
- `VIBE_EXPORT_ALLOWED_HOST`
- `VIBE_EXPORT_TOKEN`
- `VIBE_SITE_BYPASS_TOKEN` únicamente si el upstream privado heredado lo exige

`.vercel/` permanece local e ignorado. Antes de subir `main`, vincula el scope
correcto, configura las variables y ejecuta tests, TypeScript, lint focalizado,
build y audit de dependencias.

## Precaución

`scratch/cleanup_duplicates.js` elimina documentos reales de Firestore. No lo
ejecutes sin revisar el proyecto, el usuario y los documentos objetivo.
