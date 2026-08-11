# NordicPump — Project Plan & AI Context

> **Para:** cualquier sesión de IA futura con Xoko
> **Creado:** 2026-06-26 — sesión con análisis completo de configuración Natu, transición Dev, y diseño de este proyecto
> **Buscar en Engram:** `project/nordicpump` — todas las decisiones están guardadas con ese topic_key

---

## Startup Instructions (MANDATORY — ejecutar al cargar este proyecto)

1. Si hay Engram disponible, ejecutar `mem_search` con query `"NordicPump"` o `"project/nordicpump"` para recuperar contexto completo.
2. Leer este archivo (PLAN.md) — contiene el quick reference de todas las decisiones.
3. Si hay conflicto entre PLAN.md y memoria Engram, **Engram manda** (es la fuente de verdad más reciente).
4. Antes de proponer cambios, verificar contra el plan actual.

---

## Quick Reference — Decisiones Clave

### Identidad
- **Nombre:** NordicPump
- **Scope:** 🇸🇪 Suecia · 🇩🇰 Dinamarca · 🇫🇮 Finlandia · 🇳🇴 Noruega
- **Combustibles:** Euro 95 (Bensin 95) + Diesel
- **Plataforma:** PWA (Android + iOS + Web), mobile-first
- **Idiomas:** sv (default) · da · nb · fi · en · es — extensible (árabe futuro con RTL preparado)
- **Detección:** `navigator.language` → `localStorage` override

### Stack Técnico
```
Frontend: Angular 22 + Chart.js + Tailwind + ngx-translate + @angular/pwa + @angular/animations
Backend:  Python 3.14 + Litestar (proxy/cache — mismo stack que Tiendita)
Deploy:   Docker Compose → Fly.io (nginx + backend + opcional Redis cache)
```

### Data Sources
| País | Fuente | Frecuencia | Gratis | Formato |
|------|--------|------------|--------|---------|
| 🇸🇪🇩🇰🇫🇮 | `fuel-prices.eu/llms.txt` (EU Oil Bulletin, CC BY 4.0) | Semanal | ✅ | Texto plano |
| 🇳🇴 | SSB Statbank API (tabla 09654, JSON-stat) | Mensual | ✅ | JSON |

Backend normaliza ambas fuentes a JSON unificado. Cache semanal.

### Diseño Visual (design-system generado con ui-ux-search)
```
Primary:   #1E40AF  (deep Nordic blue)
Secondary: #3B82F6  (medium blue)
Accent:    #F59E0B  (amber — highlights)
Background:#F8FAFC  (near white)
Text:      #1E3A8A  (dark blue)
Font:      Fira Sans (body) + Fira Code (prices/data)
Chart:     Verde <1€ → Amber 1-3€ → Rojo >3€
```
Estilo: minimalista nórdico, mucha whitespace, data-dense dashboard.

### Animaciones
Chart draw-in (600ms ease-out) · Price counter (400ms) · Country selector fade+slide (200ms) · Tax bars stagger (500ms) · Loading: skeleton pulse · `prefers-reduced-motion: reduce` respetado.

### A11y
WCAG AA mínimo · Touch targets 44×44px · Pattern overlay en chart para colorblind · Tabla de datos accesible debajo de cada chart · `aria-live` en precios · Focus order documentado.

### Componentes MVP
```
country-selector · price-chart · price-current · neighbor-compare
tax-breakdown · tank-calculator · seasonality-chart · language-switcher
kpi-card · skeleton-loader
```

---

## Estado Actual (2026-06-26)

- [x] Diseño completo (PLAN.md + investigación de data sources)
- [x] DESIGN.md tokens definidos
- [ ] Backend proxy (`app.py` — Litestar, fetch llms.txt + SSB, cache)
- [ ] Frontend Angular (`ng new`, PWA setup, i18n)
- [ ] Componentes core
- [ ] Animaciones + responsive testing
- [ ] Deploy en Fly.io

**PRÓXIMO PASO CONCRETO:** Crear `backend/app.py` — el proxy Litestar que:
1. Hace fetch de `https://www.fuel-prices.eu/llms.txt` (todos países EU)
2. Hace fetch de `https://data.ssb.no/api/v0/en/table/09654` (Noruega, JSON-stat)
3. Normaliza a JSON unificado: `{ country, fuel, price_eur, price_sek, date, frequency }`
4. Expone en `/api/v1/prices/{country}`
5. Cache en archivo (renovar cada lunes)

---

## Relación con el portfolio completo de Xoko

```
Portfolio Site (Astro — futuro)
├── 🛒 Tiendita       (e-commerce Angular + Python/Litestar)
├── ⚙️ Admin Dashboard (PrimeNG + Redis + audit trail — mismo repo Tiendita)
└── ⛽ NordicPump      (PWA Angular + 4 países + 6 idiomas + multi-source datos oficiales)
```

---

## Reglas para la IA

- Nunca construir sin aprobación de Xoko.
- Preguntar MÁXIMO una cosa a la vez.
- Si algo del plan no cierra, verificarlo con Xoko antes de cambiar.
- Xoko programa antes de dormir (trabaja full-time en Freska).
- Xoko está en transición a Dev (TypeScript/Angular primario, C++ paralelo, Rust postergado 24-36 meses).
- Xoko habla chileno (seseo, sin voseo rioplatense).
