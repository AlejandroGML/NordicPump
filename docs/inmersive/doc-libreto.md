✓ Libreto generado: 9 capítulos, 2331 palabras, 16355 chars
# NordicPump — Architecture — Libreto

Documentación de arquitectura de NordicPump — comparador de precios de combustibles nórdicos

NordicPump es una PWA mobile-first que compara precios de combustibles (Euro noventa y cinco y Diésel) entre los cinco países nórdicos: Suecia, Dinamarca, Finlandia, Noruega e Islandia. El frontend es Angular veintidos y el backend es un proxy/caché en Litestar (Python 3.14). No hay base de datos: el caché es file-based con escrituras atómicas. La app soporta siete idiomas y muestra precios en la moneda nativa de cada país.

## Capítulo 1: Contexto

El problema: los precios de combustibles en los países nórdicos se publican en fuentes oficiales distintas (fuel-prices.eu para SE/DK/FI, SSB Statbank para NO, gasvaktin.is para IS), con cadencias distintas (semanal, mensual, quincenal) y en monedas distintas (SEK, DKK, NOK, EUR, ISK). Un conductor que cruza la frontera Suecia→Noruega no tiene forma fácil de comparar precios entre ambos países sin abrir tres apps distintas y hacer conversiones mentales.

NordicPump resuelve eso: unifica las fuentes, normaliza a EUR internamente, y deja al usuario elegir en qué moneda ver los precios. Sin esta app, el usuario tendría que visitar de tres a cuatro sitios oficiales, anotar precios, convertir monedas manualmente, y perder diez minutos por consulta.

¿Por qué? Elegimos construir NordicPump porque resuelve una necesidad real del día a día nórdico (comparar precios cruzando fronteras), nos obliga a integrar APIs públicas reales con sus particularidades (cadencias, formatos, monedas), y produce un proyecto de portafolio que le habla directamente al mercado técnico sueco: datos nórdicos, idiomas nórdicos, monedas nórdicas.

---

## Capítulo 2: Arquitectura

El diagrama de arquitectura muestra los siguientes componentes: Frontend. Backend. Cache (JSON). Ingestion → APIs externas. Se muestran cuatro conexiones entre estos componentes, representando el flujo de datos de la arquitectura.

Pasemos a frontend.

La interfaz que ve el usuario. Construida con Angular veintidos (standalone components, signals, change detection OnPush). Es una PWA con service worker para offline.

- PWA (Progressive Web App): una web que se instala como app nativa en el celular, con icono en la pantalla de inicio y funcionamiento offline. - Standalone component: componente Angular que no necesita un NgModule — se importa solo. Es el patrón moderno desde Angular catorce+. - Signal: una caja reactiva que avisa a la UI cuando cambia. Reemplaza al Observable de RxJS para estado local.

Responsabilidades del frontend:

 Renderizar el dashboard: KPI cards con precios actuales, calculadora de tanque, gráficos (historial, comparativa, desglose de impuestos), Manejar siete idiomas (sv, da, nb, fi, en, es, is) con ngx-translate, Convertir monedas en vivo (currency switcher: SEK/EUR/DKK/NOK/ISK) y Funcionar offline con service worker + fallback page.

Estructura de carpetas (frontend/src/app/):

 core/ — servicios (CurrencyService, PriceApiService, ThemeService, CountryStateService, LanguageService) + guards, features/ — dashboard y about, shared/ — componentes reutilizables (charts, widgets, models, currency-switcher), layout/ — header y footer y pwa/ — service worker bits (install prompt, freshness banner, offline fallback).

Ahora, http contract.

El puente entre frontend y backend. Está documentado explícitamente en api-contract.yaml porque el análisis estático no infiere llamadas HTTP — solo se ven los imports.

GET la ruta prices{country}: frontend caller: PriceApiService.fetch(country); backend handler: prices.py:prices_endpoint; service que resuelve: PriceQueryService.resolve(country). GET la ruta rates: frontend caller: CurrencyService.loadRates(); backend handler: rates.py:rates_endpoint; service que resuelve: IngestionPipeline.get_rates(). GET /health: frontend caller: (monitoring); backend handler: health.py:health_check; service que resuelve: (pure function).

- Contract test: un test que verifica que dos lados (frontend y backend) hablan el mismo idioma. En NordicPump, price.contract.spec.ts lee el código Python y el TypeScript y compara que los campos y los enums coincidan — si alguien cambia un lado, el test revienta.

Hablemos de backend.

El proxy/caché. Construido con Litestar (framework ASGI de Python, alternativa moderna a FastAPI). Sin base de datos: el caché vive en archivos JSON en disco.

- ASGI: Asynchronous Server Gateway Interface — el estándar de Python para servidores web async. Litestar, FastAPI y Starlette lo usan. - Litestar: framework web Python con tipado estricto, validación Pydantic, y OpenAPI automático. Más opinionated que FastAPI.

Capas del backend (de afuera hacia adentro):

 primero, Routes (routes/) — reciben HTTP, validan el país, delegan al service. No tienen lógica de negocio.. segundo, Services (services/) — PriceQueryService (lee caché, cache-first), IngestionPipeline (escribe caché, orquesta ingestión).. tercero, Cache (cache/) — CacheStore (I/O atómica), CacheFreshness (lógica de tiempo).. cuarto, Ingestion (ingestion/) — parsers de cada fuente externa (fuel_prices_eu, ssb, iceland, ecb_rates).. quinto, Scheduler (scheduler.py + cadence/) — scheduler in-process async que dispara ingestión según cadencias.. sexto, Models (models/) — PriceRecord, Country (StrEnum), FuelType, CountryMeta..

Veamos ahora cache (file-based).

El corazón del backend. No usa SQLite ni Redis: usa archivos JSON en disco, con dos trucos clave:

Escrituras atómicas con tempfile + os.replace (POSIX rename). El archivo nunca queda corrupto a medias: se escribe en un archivo temporal y se renombra atómicamente. Si el proceso muere a la mitad, el archivo original sigue intacto.

Índices por país para O(uno) lookup. Además del archivo principal (fuel-prices-eu.json con todos los países), se escribe un índice por país (fuel-prices-eu_idx_SE.json, _idx_DK.json, etc.). Así PriceQueryService lee directamente el archivo del país sin escanear toda la lista.

- Escritura atómica: garantía de que un archivo o se escribe completo o no se escribe nada. Nunca queda a medias. En POSIX, os.replace() es atómico: el rename ocurre en una sola operación del sistema de archivos. - O(uno) lookup: tiempo constante — tarda lo mismo sin importar cuántos datos haya. Es lo opuesto a O(n) donde hay que escanear todo. - POSIX: estándar de sistemas operativos tipo UNIX (Linux, macOS). os.replace es la función Python que invoca la syscall atómica de rename.

En cuanto a ingestion → apis externas.

Cada fuente externa tiene su propio parser y su propia cadencia:

fuel-prices.eu: parser: fuel_prices_eu.py; países: SE, DK, FI; cadencia: Domingos; por qué esa cadencia: Publican snapshot semanal los domingos. SSB Statbank: parser: ssb.py; países: NO; cadencia: primero del mes + día quince; por qué esa cadencia: Tabla mensual se publica a mediados de mes. gasvaktin.is: parser: iceland.py; países: IS; cadencia: Ventana dos días; por qué esa cadencia: Estaciones actualizan cada quince min, pero cachedeamos dos días. ECB: parser: ecb_rates.py; países: (rates); cadencia: Diario; por qué esa cadencia: Reference rates diarios del BCE.

Advertencia: Islandia no es UE, así que el BCE (ECB) no publica EUR→ISK. NordicPump usa open.er-api.com como fuente para ISK, con fallback hardcodeado (eur_isk_fallback: 140.00) si esa API también cae.

---

## Capítulo 3: Flujo de datos

¿Qué pasa cuando un usuario abre NordicPump y selecciona Noruega?

El siguiente diagrama de secuencia describe el flujo entre: Usuario, Frontend (Angular), Backend (Litestar), Cache (JSON), Scheduler, APIs externas. Usuario Selecciona "NO" hacia Frontend (Angular) Frontend (Angular) GET la ruta prices, NO hacia Backend (Litestar) Backend (Litestar) CacheStore.read("ssb-no") hacia Cache (JSON) Si se cumple la condición de que caché fresco (≤treinta días), Cache (JSON) PriceRecord[NO] hacia Backend (Litestar) Backend (Litestar) doscientos + X-Cache: HIT hacia Frontend (Angular) Backend (Litestar) IngestionPipeline.refresh(NO) hacia Scheduler Scheduler fetch SSB Statbank hacia APIs externas APIs externas tabla mensual NO hacia Scheduler Scheduler CacheStore.write("ssb-no", records) hacia Cache (JSON) Cache (JSON) PriceRecord[NO] hacia Backend (Litestar) Backend (Litestar) doscientos + X-Cache: REFRESHED hacia Frontend (Angular) Backend (Litestar) IngestionPipeline.refresh(NO) hacia Scheduler Si se cumple la condición de que ingestión ok, Scheduler write hacia Cache (JSON) Backend (Litestar) doscientos + X-Cache: REFRESHED hacia Frontend (Angular) Backend (Litestar) quinientos tres + Retry-After hacia Frontend (Angular) y aquí termina esta parte del flujo. y aquí termina esta parte del flujo. Frontend (Angular) Renderiza KPI cards + charts hacia Usuario

- Cache-first: patrón de lectura donde siempre se mira el caché primero. Si está fresco, se sirve de ahí. Si está viejo (stale), se intenta refrescar. Si no existe (miss), se intenta ingerir. - X-Cache header: header HTTP que indica de dónde vino la respuesta: HIT (caché fresco), REFRESHED (se actualizó en esta request), STALE (se sirvió viejo porque la actualización falló). - Retry-After: header HTTP que dice "intenta de nuevo en N segundos". Se manda con quinientos tres para que el cliente sepa cuándo reintentar.

---

## Capítulo 4: Tech Stack

Frontend: tecnología: Angular; versión: veintidos; por qué: Standalone components + signals son el presente de Angular. Stack demandado en mercado sueco (fintech, enterprise).. Backend: tecnología: Litestar; versión: latest; por qué: Framework ASGI con tipado estricto + OpenAPI. Más opinionated que FastAPI — te empuja a hacerlo bien.. Runtime backend: tecnología: Python; versión: 3.14; por qué: StrEnum, performance, match statements.. Cache: tecnología: JSON files; versión: —; por qué: Sin DB. Atomic writes + per-country indices. Suficiente para un dataset de aproximadamente cinco países × dos combustibles.. Charts: tecnología: Chart.js; versión: 4.x; por qué: Doughnuts, line charts. Tree-shakeable con registro manual de componentes.. i18n: tecnología: ngx-translate; versión: latest; por qué: Maduro, soporta siete idiomas con interpolación {{param}}.. Tests frontend: tecnología: Vitest; versión: 4.x; por qué: Rápido, jsdom, integration con Angular unit-test builder.. Tests backend: tecnología: pytest; versión: latest; por qué: Markers unit/integration, pytest-asyncio.. Tipado Python: tecnología: mypy strict; versión: —; por qué: noPropertyAccessFromIndexSignature fuerza acceso por ['key'].. Linting Python: tecnología: ruff; versión: latest; por qué: Line-length 120, select E,F,I,N,W,UP..

---

## Capítulo 5: Trade-offs (Decisiones clave)

Cada decisión técnica tuvo alternativas que se descartaron con razón. Estas son las más importantes:

Framework backend: elegido: Litestar; descartado: FastAPI, Django; razón [!decision]: Litestar te empuja a tipado estricto + estructura limpia. FastAPI es muy libre (cada quien lo arma distinto). Django es overkill para un proxy/caché sin DB.. Persistencia: elegido: JSON files; descartado: SQLite, Redis; razón [!decision]: El dataset es chico (aproximadamente diez registros por país, cinco países). SQLite agrega una dependencia y migraciones. Redis es infra externa. JSON + atomic rename es suficiente y portátil.. Scheduler: elegido: In-process async; descartado: cron, Celery; razón [!decision]: Una sola instancia, sin workers distribuidos. Async in-process evita dependencias externas (Redis broker para Celery) y funciona igual en dev y prod.. Enum país: elegido: StrEnum; descartado: Enum clásico; razón [!decision]: StrEnum serializa directamente a "SE" en JSON sin .value. Menos código, menos bugs.. Lazy charts: elegido: @defer (on viewport); descartado: Lazy routes; razón [!decision]: Los charts son caros de renderizar (Chart.js). @defer los carga solo cuando el usuario scrollea a ellos. Gotcha: Playwright fullPage screenshot NO los dispara — hay que scrollear programáticamente en tests.. Source of truth país: elegido: countries.json + codegen; descartado: Types compartidos; razón [!decision]: Backend (Python) y frontend (TS) son runtimes distintos — no pueden compartir código. Un JSON fuente + script que genera enum Python + type TS elimina la deuda de "cinco lugares que tocar por país nuevo".. Atomic write: elegido: POSIX rename; descartado: File lock; razón [!decision]: os.replace es atómico a nivel syscall en POSIX. Un lock (fcntl o file-based) agrega complejidad y edge cases (proceso muere con el lock tomado). Rename es más simple y garantiza consistencia.. Signals vs RxJS: elegido: Signals; descartado: RxJS; razón [!decision]: Signals son el futuro de Angular (reactividad simple). RxJS sigue para eventos complejos (HTTP, debouncing) pero para estado local, signals son más legibles y performantes..

---

## Capítulo 6: Failure Modes (Modos de fallo)

Cuidado: Crítico: si el caché está vacío (miss) Y la ingestión falla (API externa caída), el backend devuelve quinientos tres con Retry-After. El usuario ve un mensaje de error traducido. No hay degradación elegante más allá de eso — no podemos inventar precios.

Advertencia: ECB caído: si el BCE no responde, los rates EUR→SEK/DKK/NOK usan fallback hardcodeado (11.50, 7.45, 12.00). Los precios convertidos pueden estar ligeramente desactualizados. Para ISK el fallback es 140.00 (vía open.er-api.com con su propio fallback).

Advertencia: Isla desconectada: el grafo de conocimiento del proyecto muestra cero edges entre frontend y backend por defecto (análisis estático no infiere HTTP). Se soluciona con api-contract.yaml + scripts/inject_contract_edges.py que inyecta los edges manualmente.

---

## Capítulo 7: Plan de escalabilidad

El sistema actual funciona para cinco países y un solo usuario concurrente. Si crece:

Más países (ej. Países Bálticos): editar countries.json + correr python scripts/generate_countries.py. Las traducciones i18n y el flag SVG son manuales. El resto se autogenera.

Más concurrencia: el file-based cache funciona mientras un solo proceso escribe. Para multi-proceso, migrar a SQLite (misma atomicidad, mejor concurrencia) o Redis. El refactor es pequeño porque CacheStore tiene solo tres métodos públicos (read, write, exists).

Histórico largo: actualmente el caché guarda solo el snapshot más reciente. Para series temporales largas, agregar append-only al archivo de caché (lista de snapshots) o tablas SQLite por país.

---

## Capítulo 8: Glosario

- ASGI: Asynchronous Server Gateway Interface — estándar de Python para web servers async. - Atomic write: escritura que nunca queda a medias. POSIX rename lo garantiza a nivel syscall. - Cache-first: patrón de leer caché primero, refrescar solo si está viejo o ausente. - Cadence: frecuencia con que una fuente publica datos. EU=semanal, SSB=mensual, ISK=diaria. - Codegen: generación de código desde una fuente única. En NordicPump, countries.json genera el enum Python y el type TS. - Contract test: test que valida que dos lados (frontend/backend) coincidan en campos y tipos. - Ingestion: proceso de traer datos de una fuente externa y normalizarlos al formato interno. - Litestar: framework web Python ASGI con tipado estricto. Alternativa a FastAPI. - O(uno) lookup: acceso en tiempo constante, sin importar el tamaño del dataset. - POSIX: estándar de sistemas UNIX (Linux, macOS). Garantiza atomicidad de rename. - PWA: Progressive Web App — web instalable como app nativa, con offline. - Signal: caja reactiva de Angular que avisa a la UI cuando cambia. - Standalone component: componente Angular sin NgModule, autónomo. - StrEnum: enum de Python donde los miembros son strings. Serializa directo a JSON. - X-Cache header: header HTTP que indica el origen de la respuesta (HIT/REFRESHED/STALE).

---

## Capítulo 9: Próximos pasos

 [ ] Deploy (Netlify frontend + Render/Railway backend), [ ] README profesional con screenshots y URL demo, [ ] GitHub público, [ ] Benchmark: cache hit vs miss (latencia) y [ ] Más países bálticos (Estonia, Latvia, Lithuania) — solo editar countries.json.

---

Información: Cómo se genera esta doc: source.md (este archivo) es la fuente única. Los pipelines build-html.py, build-pdf.js, build-md.py, y build-narration.py producen los formatos finales. Edita source.md y re-build para actualizar.

---

Fin del libreto.
