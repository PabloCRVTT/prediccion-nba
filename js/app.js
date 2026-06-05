// ============================================================
// Predicción Basket Trewhela's — Login solo con nombre
// ============================================================

let userName = null;       // nombre del usuario (ID)
let currentView = "predecir";
let myPred = {};
let realRes = {};
let allScores = {};

const QUARTERS = ["q1", "q2", "q3", "q4"];
const GID = NBA_GAME.id;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});
let appInitialized = false;

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("nba_user");
  setTimeout(() => {
    hideSplash();
    if (saved) {
      userName = saved;
      showApp();
      initApp();
    } else {
      showLogin();
    }
  }, 800);
});

function hideSplash() { document.getElementById("splash").classList.add("hidden"); }
function showLogin() { document.getElementById("login-page").style.display = "flex"; }
function showApp() {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("app").classList.add("active");
  document.getElementById("header-user-name").textContent = userName;
}

// ---------- Login (solo nombre) ----------
document.getElementById("btn-login").addEventListener("click", doLogin);
document.getElementById("login-name").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});

function doLogin() {
  const name = document.getElementById("login-name").value.trim();
  if (!name) {
    const err = document.getElementById("login-error");
    err.textContent = "Ingresa tu nombre"; err.classList.add("visible");
    return;
  }
  userName = name;
  localStorage.setItem("nba_user", name);
  sb.from("nba_usuarios").upsert({ nombre: name }, { onConflict: "nombre" }).then(() => {});
  showApp();
  initApp();
}

document.getElementById("btn-logout").addEventListener("click", () => {
  localStorage.removeItem("nba_user");
  userName = null;
  location.reload();
});

// ---------- Navegación ----------
document.querySelectorAll(".tab-btn").forEach(b =>
  b.addEventListener("click", () => navigateTo(b.dataset.view)));

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(v =>
    v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "predecir") renderPredecir();
  if (view === "ranking") renderRanking();
  if (view === "admin" && isAdmin()) renderAdmin();
}

function isAdmin() { return NBA_CONFIG.admins.includes(userName.toLowerCase()); }

// ---------- Init app ----------
async function initApp() {
  if (appInitialized) return;
  appInitialized = true;
  if (isAdmin()) document.getElementById("tab-admin").classList.remove("hidden");
  await loadMyPred();
  await loadResults();

  sb.channel("nba-res-" + Date.now()).on("postgres_changes",
    { event: "*", schema: "public", table: "nba_resultados" },
    async () => {
      await loadResults(); await recalcAll();
      if (currentView === "predecir") renderPredecir();
      if (currentView === "ranking") renderRanking();
    }
  ).subscribe();

  await recalcAll();
  navigateTo("predecir");
}

// ---------- Datos ----------
async function loadMyPred() {
  const { data } = await sb.from("nba_predicciones")
    .select("key, value").eq("user_id", userName).eq("game_id", GID);
  myPred = {};
  (data || []).forEach(r => { myPred[r.key] = r.value; });
}

async function loadResults() {
  const { data } = await sb.from("nba_resultados")
    .select("key, value, status").eq("game_id", GID);
  realRes = {};
  (data || []).forEach(r => {
    realRes[r.key] = r.value;
    if (r.status) realRes._status = r.status;
  });
}

async function savePred(key, value) {
  myPred[key] = String(value);
  await sb.from("nba_predicciones").upsert(
    { user_id: userName, game_id: GID, key, value: String(value),
      updated_at: new Date().toISOString() },
    { onConflict: "user_id,game_id,key" }
  );
}

// ---------- Puntuación ----------
function calcScore(pred) {
  let pts = 0, detalle = { ganador: 0, cuartos: 0, final: 0 };
  const finished = realRes._status === "FINISHED";

  if (pred.winner && realRes.winner && pred.winner === realRes.winner) {
    detalle.ganador = NBA_PUNTOS.ganador; pts += NBA_PUNTOS.ganador;
  }

  for (const q of QUARTERS) {
    for (const lado of ["local", "visit"]) {
      const pk = `${q}_${lado}`;
      if (pred[pk] != null && realRes[pk] != null) {
        const diff = Math.abs(Number(pred[pk]) - Number(realRes[pk]));
        const p = Math.max(0, NBA_PUNTOS.cercaniaMax - diff);
        detalle.cuartos += p; pts += p;
      }
    }
  }

  if (finished) {
    const pf = totalFromPred(pred), rf = totalFromReal();
    if (pf && rf) {
      if (pf.local === rf.local && pf.visit === rf.visit) {
        detalle.final += NBA_PUNTOS.finalExacto; pts += NBA_PUNTOS.finalExacto;
      }
      const pg = pf.local > pf.visit ? "local" : pf.visit > pf.local ? "visit" : "tie";
      const rg = rf.local > rf.visit ? "local" : rf.visit > rf.local ? "visit" : "tie";
      if (pg === rg && pg !== "tie") {
        detalle.final += NBA_PUNTOS.ganadorFinal; pts += NBA_PUNTOS.ganadorFinal;
      }
    }
  }
  return { total: pts, ...detalle };
}

function totalFromPred(pred) {
  let l = 0, v = 0, any = false;
  for (const q of QUARTERS) {
    if (pred[`${q}_local`] != null) { l += Number(pred[`${q}_local`]); any = true; }
    if (pred[`${q}_visit`] != null) { v += Number(pred[`${q}_visit`]); }
  }
  return any ? { local: l, visit: v } : null;
}

function totalFromReal() {
  let l = 0, v = 0, any = false;
  for (const q of QUARTERS) {
    if (realRes[`${q}_local`] != null) { l += Number(realRes[`${q}_local`]); any = true; }
    if (realRes[`${q}_visit`] != null) { v += Number(realRes[`${q}_visit`]); }
  }
  return any ? { local: l, visit: v } : null;
}

async function recalcAll() {
  const [{ data: preds }, { data: users }] = await Promise.all([
    sb.from("nba_predicciones").select("user_id, key, value").eq("game_id", GID),
    sb.from("nba_usuarios").select("nombre"),
  ]);
  const byUser = {};
  (preds || []).forEach(r => {
    (byUser[r.user_id] ??= {})[r.key] = r.value;
  });
  allScores = {};
  // Incluir TODOS los usuarios registrados (incluso sin predicciones)
  (users || []).forEach(u => {
    const p = byUser[u.nombre] || {};
    allScores[u.nombre] = { ...calcScore(p), nombre: u.nombre, uid: u.nombre };
  });
  // Usuarios con predicciones que no están en la tabla
  for (const [uid, p] of Object.entries(byUser)) {
    if (!allScores[uid]) allScores[uid] = { ...calcScore(p), nombre: uid, uid };
  }
  if (userName && !allScores[userName]) {
    allScores[userName] = { ...calcScore(myPred), nombre: userName, uid: userName };
  }
}

// ---------- Render: Predecir ----------
function renderPredecir() {
  const L = NBA_GAME.local, V = NBA_GAME.visitante;
  const cerrado = new Date() > new Date(NBA_GAME.cierre) || realRes._status === "FINISHED";

  document.getElementById("view-predecir").innerHTML = `
  <div class="game-head">
    <div class="text-muted">${NBA_GAME.fecha} · ${NBA_GAME.hora}</div>
    <div class="game-teams">
      <div class="game-team"><div class="em">${L.emoji}</div><div class="nm">${L.nombre}</div></div>
      <div class="game-vs">VS</div>
      <div class="game-team"><div class="em">${V.emoji}</div><div class="nm">${V.nombre}</div></div>
    </div>
    ${realRes._status === "FINISHED" ? '<div class="badge badge-orange">Partido finalizado</div>' :
      cerrado ? '<div class="badge badge-orange">Predicciones cerradas</div>' :
      '<div class="text-muted">Predicciones abiertas hasta el salto inicial</div>'}
  </div>

  <div id="winner-banner-cont"></div>

  <div class="card">
    <div class="card-title">📊 Marcador por cuarto</div>
    ${cerrado && !myPred.q1_local
      ? '<p class="text-muted mb-14">Las predicciones están cerradas.</p>'
      : `<p class="text-muted mb-14">Predice puntos de cada equipo en cada cuarto. Exacto = ${NBA_PUNTOS.cercaniaMax} pts por equipo/cuarto.</p>`}
    ${renderQuarterTable(cerrado)}
    ${!cerrado ? '<button class="btn-primary" style="margin-top:14px" onclick="guardarCuartos()">Guardar marcadores</button>' : ""}
  </div>`;

  renderWinnerBanner();
}

function renderQuarterTable(cerrado) {
  const L = NBA_GAME.local, V = NBA_GAME.visitante;
  const tp = totalFromPred(myPred), tr = totalFromReal();
  const dis = cerrado ? "disabled" : "";

  const row = (lado, team) => `<tr>
    <td class="team-cell">${team.emoji} ${team.nombre}</td>
    ${QUARTERS.map(q => `<td><input type="number" min="0" max="99" class="q-input"
      id="in-${q}_${lado}" value="${myPred[`${q}_${lado}`] ?? ""}" ${dis}></td>`).join("")}
    <td class="q-total">${tp ? (lado === "local" ? tp.local : tp.visit) : "–"}</td>
  </tr>`;

  const realRows = tr ? `
  <tr><td class="team-cell q-real">Real ${L.emoji}</td>
    ${QUARTERS.map(q => `<td class="q-real">${realRes[`${q}_local`] ?? "–"}</td>`).join("")}
    <td class="q-real">${tr.local}</td></tr>
  <tr><td class="team-cell q-real">Real ${V.emoji}</td>
    ${QUARTERS.map(q => `<td class="q-real">${realRes[`${q}_visit`] ?? "–"}</td>`).join("")}
    <td class="q-real">${tr.visit}</td></tr>` : "";

  return `<table class="q-table">
    <thead><tr><th></th>${QUARTERS.map(q => `<th>${q.toUpperCase()}</th>`).join("")}<th>Total</th></tr></thead>
    <tbody>${row("local", L)}${row("visit", V)}${realRows}</tbody>
  </table>`;
}

async function guardarCuartos() {
  let any = false;
  for (const q of QUARTERS) for (const lado of ["local", "visit"]) {
    const el = document.getElementById(`in-${q}_${lado}`);
    if (el && el.value !== "") { await savePred(`${q}_${lado}`, el.value); any = true; }
  }
  if (!any) return showToast("Ingresa al menos un marcador", "error");
  await recalcAll();
  showToast("✅ Marcadores guardados", "success");
  renderPredecir();
}

// ---------- Winner banner ----------
function renderWinnerBanner() {
  const cont = document.getElementById("winner-banner-cont");
  if (!cont) return;
  const L = NBA_GAME.local, V = NBA_GAME.visitante;
  const cerrado = new Date() > new Date(NBA_GAME.cierre) || realRes._status === "FINISHED";

  if (myPred.winner) {
    const t = myPred.winner === "local" ? L : V;
    cont.innerHTML = `
    <div class="winner-banner elegido">
      <span class="wb-tag">🏆 Tu ganador · ${NBA_PUNTOS.ganador} pts</span>
      <h3>Tu predicción del ganador está confirmada</h3>
      <div class="wb-pick"><span class="em">${t.emoji}</span> ${t.nombre}</div>
      <p style="margin-top:10px">🔒 Es definitiva y no se puede cambiar.</p>
    </div>`;
  } else if (cerrado) {
    cont.innerHTML = `<div class="winner-banner"><span class="wb-tag">Cerrado</span><h3>No predijiste el ganador a tiempo</h3></div>`;
  } else {
    cont.innerHTML = `
    <div class="winner-banner">
      <span class="wb-tag">⚡ Antes del salto inicial</span>
      <h3>¿Quién gana el partido?</h3>
      <p>Es tu apuesta principal: vale <span class="pts">${NBA_PUNTOS.ganador} puntos</span> si aciertas.
         <strong>Una vez elegido no se puede cambiar.</strong></p>
      <div class="wb-choices">
        <div class="wb-choice" onclick="elegirGanador('local')"><span class="em">${L.emoji}</span>${L.nombre}</div>
        <div class="wb-choice" onclick="elegirGanador('visit')"><span class="em">${V.emoji}</span>${V.nombre}</div>
      </div>
    </div>`;
  }
}

async function elegirGanador(lado) {
  if (myPred.winner) return showToast("🔒 Ya está bloqueado", "error");
  const t = lado === "local" ? NBA_GAME.local : NBA_GAME.visitante;
  if (!confirm(`Eliges a ${t.emoji} ${t.nombre} como ganador.\n\n⚠️ Esta predicción es DEFINITIVA.\n\n¿Confirmas?`)) return;
  await savePred("winner", lado);
  await recalcAll();
  showToast("✅ Ganador confirmado", "success");
  renderPredecir();
}

// ---------- Ranking ----------
async function renderRanking() {
  await recalcAll();
  const sorted = Object.values(allScores).sort((a, b) => b.total - a.total);
  document.getElementById("view-ranking").innerHTML = `
  <h2 class="section-title">🏅 Clasificación</h2>
  <div class="card">${!sorted.length
    ? '<div class="empty-state"><div class="icon">🏅</div><p>Aún no hay participantes</p></div>'
    : `<table class="ranking-table">
      <thead><tr><th>#</th><th>Participante</th><th style="text-align:right">Pts</th><th style="text-align:right">Ganador</th><th style="text-align:right">Cuartos</th></tr></thead>
      <tbody>${sorted.map((s, i) => {
        const pos = i + 1, yo = s.uid === userName;
        const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos;
        return `<tr class="${yo ? "yo" : ""}">
          <td><span class="rank-pos">${medal}</span></td>
          <td><strong>${s.nombre}</strong>${yo ? ' <span class="badge badge-orange">Tú</span>' : ""}</td>
          <td style="text-align:right"><span class="pts-badge">${s.total}</span></td>
          <td style="text-align:right;color:var(--texto-suave)">${s.ganador || 0}</td>
          <td style="text-align:right;color:var(--texto-suave)">${s.cuartos || 0}</td>
        </tr>`;
      }).join("")}</tbody></table>`}
  </div>`;
}

// ---------- Admin ----------
function renderAdmin() {
  const L = NBA_GAME.local, V = NBA_GAME.visitante;
  document.getElementById("view-admin").innerHTML = `
  <h2 class="section-title">⚙️ Administración</h2>
  <div class="card mb-14">
    <div class="card-title">📡 Resultados ESPN</div>
    <button class="btn-primary" onclick="fetchNBA()">🔄 Obtener resultados reales</button>
    <p id="api-status" class="text-muted" style="margin-top:10px"></p>
  </div>
  <div class="card">
    <div class="card-title">✏️ Resultados manuales</div>
    <table class="q-table">
      <thead><tr><th></th>${QUARTERS.map(q => `<th>${q.toUpperCase()}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td class="team-cell">${L.emoji} ${L.nombre}</td>
          ${QUARTERS.map(q => `<td><input type="number" min="0" max="99" class="q-input" id="ar-${q}_local" value="${realRes[`${q}_local`] ?? ""}"></td>`).join("")}</tr>
        <tr><td class="team-cell">${V.emoji} ${V.nombre}</td>
          ${QUARTERS.map(q => `<td><input type="number" min="0" max="99" class="q-input" id="ar-${q}_visit" value="${realRes[`${q}_visit`] ?? ""}"></td>`).join("")}</tr>
      </tbody>
    </table>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn-admin" onclick="guardarResReal(false)">Guardar (en curso)</button>
      <button class="btn-primary" style="width:auto;flex:1" onclick="guardarResReal(true)">Finalizar partido</button>
    </div>
  </div>`;
}

async function guardarResReal(finalizar) {
  const rows = [];
  let l = 0, v = 0;
  for (const q of QUARTERS) for (const lado of ["local", "visit"]) {
    const el = document.getElementById(`ar-${q}_${lado}`);
    if (el && el.value !== "") {
      rows.push({ id: `${GID}_${q}_${lado}`, game_id: GID, key: `${q}_${lado}`,
        value: el.value, status: finalizar ? "FINISHED" : "LIVE" });
      if (lado === "local") l += Number(el.value); else v += Number(el.value);
    }
  }
  if (finalizar && l !== v) {
    rows.push({ id: `${GID}_winner`, game_id: GID, key: "winner",
      value: l > v ? "local" : "visit", status: "FINISHED" });
  }
  if (!rows.length) return showToast("Ingresa marcadores", "error");
  await sb.from("nba_resultados").upsert(rows, { onConflict: "id" });
  await loadResults(); await recalcAll();
  showToast(finalizar ? "✅ Partido finalizado" : "✅ Guardado", "success");
  renderAdmin();
}

async function fetchNBA() {
  const st = document.getElementById("api-status");
  st.textContent = "Consultando ESPN...";
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${NBA_GAME.espnDate}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const A = NBA_GAME.local.abbr.toUpperCase(), B = NBA_GAME.visitante.abbr.toUpperCase();
    let comp = null;
    for (const ev of (data.events || [])) {
      const c = ev.competitions?.[0];
      const abbrs = (c?.competitors || []).map(x => x.team?.abbreviation?.toUpperCase());
      if (abbrs.includes(A) && abbrs.includes(B)) { comp = c; break; }
    }
    if (!comp) { st.textContent = `❌ No encontré ${A} vs ${B}`; return; }

    const rows = [];
    for (const c of comp.competitors) {
      const lado = c.team?.abbreviation?.toUpperCase() === A ? "local" : "visit";
      (c.linescores || []).forEach((ls, i) => {
        if (i < 4) rows.push({ id: `${GID}_q${i+1}_${lado}`, game_id: GID,
          key: `q${i+1}_${lado}`, value: String(Math.round(ls.value)),
          status: comp.status?.type?.completed ? "FINISHED" : "LIVE" });
      });
    }
    if (comp.status?.type?.completed) {
      const lc = comp.competitors.find(c => c.team?.abbreviation?.toUpperCase() === A);
      const vc = comp.competitors.find(c => c.team?.abbreviation?.toUpperCase() === B);
      if (Number(lc?.score) !== Number(vc?.score))
        rows.push({ id: `${GID}_winner`, game_id: GID, key: "winner",
          value: Number(lc?.score) > Number(vc?.score) ? "local" : "visit", status: "FINISHED" });
    }
    if (!rows.length) { st.textContent = "⚠️ Sin marcador por cuarto aún"; return; }
    await sb.from("nba_resultados").upsert(rows, { onConflict: "id" });
    await loadResults(); await recalcAll();
    st.textContent = `✅ ${comp.status?.type?.completed ? "Final" : "En vivo"}: ${rows.length} datos`;
    renderAdmin();
  } catch (e) { st.textContent = `❌ ${e.message}`; }
}

// ---------- Utils ----------
function showToast(m, type = "") {
  const t = document.getElementById("toast");
  t.textContent = m; t.className = `toast ${type} show`;
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 3000);
}

window.doLogin = doLogin;
window.navigateTo = navigateTo;
window.guardarCuartos = guardarCuartos;
window.elegirGanador = elegirGanador;
window.guardarResReal = guardarResReal;
window.fetchNBA = fetchNBA;
