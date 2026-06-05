# 🏀 Predicción NBA

App web para predecir un partido de la NBA en familia: marcador por cuarto de cada equipo,
predicción inicial (bloqueada) de quién gana, ranking en tiempo real y resultados reales desde ESPN.

**Independiente de la polla de fútbol** — usa el mismo Supabase pero tablas `nba_*` aparte.
Stack: HTML/CSS/JS + Supabase + GitHub Pages.

---

## 🎯 Cómo funciona

- **Predicción de ganador** (antes del salto inicial): vale **30 pts**. Se elige una vez y queda **bloqueada**.
- **Marcador por cuarto**: predices los puntos de cada equipo en Q1–Q4. Cuanto más cerca, más puntos
  (acierto exacto de un equipo en un cuarto = **5 pts**).
- **Marcador final exacto**: +25 pts. Acertar quién gana por el marcador final: +10 pts.
- **Ranking** automático y en tiempo real.
- **Resultados reales** desde la API pública de ESPN (o carga manual del admin).

---

## 🚀 Setup

### 1. Tablas en Supabase
En **SQL Editor** ejecuta el archivo [`SCHEMA.sql`](./SCHEMA.sql).

### 2. Configurar el partido
Edita `js/config.js`:

```js
const NBA_GAME = {
  id: "2026-06-06",
  fecha: "Sábado 6 de junio, 2026",
  hora: "21:00",
  espnDate: "20260606",            // fecha YYYYMMDD para ESPN
  local:     { nombre: "Boston Celtics",   abbr: "BOS", emoji: "🟢", color: "#007a33" },
  visitante: { nombre: "LA Lakers",        abbr: "LAL", emoji: "🟣", color: "#552583" },
  cierre: "2026-06-06T21:00:00",
};
```

> Las **abreviaturas** (`abbr`) deben coincidir con las de ESPN (BOS, LAL, GSW, DEN, etc.)
> para que los resultados automáticos funcionen.

### 3. Credenciales
Ya usa el mismo proyecto Supabase que la polla. Si quieres uno aparte, cambia
`SUPABASE_URL` y `SUPABASE_ANON_KEY` en `config.js`.

### 4. Desplegar (GitHub Pages)
```bash
git push
# Settings → Pages → Source: main branch
```

---

## ⚙️ Admin

El email en `NBA_CONFIG.admins` ve la pestaña **⚙️ Admin**:
- **🔄 Obtener resultados reales** — trae el marcador por cuarto desde ESPN
- **Resultados manuales** — ingresa los cuartos a mano y marca "Finalizar partido"

---

## 📊 Puntuación (editable en `config.js` → `NBA_PUNTOS`)

| Concepto | Puntos |
|---|---|
| 🏆 Ganador (predicción inicial, bloqueada) | +30 |
| Cercanía por equipo/cuarto (exacto) | hasta +5 c/u |
| Marcador final exacto | +25 |
| Acertar ganador por marcador final | +10 |
