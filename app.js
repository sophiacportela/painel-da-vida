// ===== Painel da Vida — lógica do app =====

const PILARES = [
  { id: "saude", nome: "Saúde & corpo", cor: "#14b8a6" },
  { id: "sono", nome: "Sono & descanso", cor: "#f97316" },
  { id: "espiritualidade", nome: "Espiritualidade", cor: "#7c3aed" },
  { id: "mente", nome: "Mente", cor: "#06b6d4" },
  { id: "estudos", nome: "Estudos", cor: "#ca8a04" },
  { id: "carreira", nome: "Carreira", cor: "#4f46e5" },
  { id: "financas", nome: "Finanças", cor: "#db2777" },
];

const STORAGE_KEY = "painelDaVidaState_v1";

let state = null;
let sb = null;
let saveTimer = null;
let activeTab = "visao";
let currentUser = null; // { id, email } — vem do login

// ---------- utilidades de data ----------
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // segunda = 0
  return addDays(dateStr, -day);
}
function weekKey(dateStr) {
  return startOfWeek(dateStr);
}
function fmtDia(dateStr) {
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const d = new Date(dateStr + "T00:00:00");
  return dias[d.getDay()];
}
function last7Days() {
  const out = [];
  for (let i = 6; i >= 0; i--) out.push(addDays(todayISO(), -i));
  return out;
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- estado padrão ----------
function defaultState() {
  return {
    saude: { treinos: {}, metaSemanal: 5, recordes: [] },
    sono: { horas: {}, metaHoras: 8, rituais: {} },
    espiritualidade: { checklist: {}, reflexaoSemanal: {} },
    mente: { checkinsSemana: {}, insights: [] },
    estudos: {
      faculdade: { materiaAtual: "", proximaEntrega: "", progresso: 0 },
      cursos: [],
      metaPaginasDia: 15,
      leituraDiaria: {},
      livros: [],
    },
    carreira: { frentes: [] },
    financas: { meses: {}, metas: [] },
  };
}

function mergeDefaults(base, extra) {
  const out = { ...base };
  for (const k in extra) {
    if (
      extra[k] &&
      typeof extra[k] === "object" &&
      !Array.isArray(extra[k]) &&
      base[k] &&
      typeof base[k] === "object" &&
      !Array.isArray(base[k])
    ) {
      out[k] = mergeDefaults(base[k], extra[k]);
    } else if (extra[k] !== undefined) {
      out[k] = extra[k];
    }
  }
  return out;
}

// ---------- persistência ----------
function supabaseReady() {
  return !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
}

async function initSupabase() {
  if (!supabaseReady()) return null;
  try {
    const { createClient } = window.supabase;
    sb = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    return sb;
  } catch (e) {
    console.error("Falha ao iniciar Supabase", e);
    return null;
  }
}

function safeLocalGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("localStorage indisponível (normal em file://):", e);
    return null;
  }
}
function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("localStorage indisponível (normal em file://):", e);
  }
}

function localKey() {
  return currentUser ? `${STORAGE_KEY}:${currentUser.id}` : STORAGE_KEY;
}

async function loadState() {
  const local = safeLocalGet(localKey());
  let localState = local ? JSON.parse(local) : null;

  if (sb && currentUser) {
    try {
      const { data, error } = await sb
        .from("painel_estado")
        .select("data")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (!error && data && data.data) {
        localState = data.data;
      }
    } catch (e) {
      console.warn("Sem conexão com Supabase agora, usando dado local.", e);
    }
  }

  state = mergeDefaults(defaultState(), localState || {});
}

function saveState() {
  safeLocalSet(localKey(), JSON.stringify(state));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!sb || !currentUser) return;
    try {
      await sb.from("painel_estado").upsert({
        user_id: currentUser.id,
        data: state,
        updated_at: new Date().toISOString(),
      });
      setSyncStatus(`sincronizado — ${currentUser.email}`);
    } catch (e) {
      console.warn("Falha ao sincronizar", e);
      setSyncStatus("offline");
    }
  }, 600);
}

function setSyncStatus(txt) {
  const el = document.getElementById("sync-status");
  if (el) el.textContent = txt;
}

// ---------- render raiz ----------
function renderNav() {
  const nav = document.getElementById("nav");
  const items = [{ id: "visao", nome: "Visão geral", cor: "#334155" }, ...PILARES];
  nav.innerHTML = items
    .map(
      (p) => `
      <button class="nav-item ${activeTab === p.id ? "active" : ""}" data-tab="${p.id}">
        <span class="dot" style="background:${p.cor}"></span>${p.nome}
      </button>`
    )
    .join("");
  nav.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });
}

function render() {
  renderNav();
  const content = document.getElementById("content");
  if (activeTab === "visao") content.innerHTML = renderVisaoGeral();
  else if (activeTab === "saude") content.innerHTML = renderSaude();
  else if (activeTab === "sono") content.innerHTML = renderSono();
  else if (activeTab === "espiritualidade") content.innerHTML = renderEspiritualidade();
  else if (activeTab === "mente") content.innerHTML = renderMente();
  else if (activeTab === "estudos") content.innerHTML = renderEstudos();
  else if (activeTab === "carreira") content.innerHTML = renderCarreira();
  else if (activeTab === "financas") content.innerHTML = renderFinancas();
  attachHandlers();
}

// ---------- Visão geral ----------
function renderVisaoGeral() {
  const t = todayISO();
  const treinouHoje = !!state.saude.treinos[t];
  const dormiuHoje = state.sono.horas[t] !== undefined;
  const espHoje = state.espiritualidade.checklist[t] || {};
  const espCompleta = espHoje.terco && espHoje.evangelho && espHoje.liturgia;
  const wk = weekKey(t);
  const mentefeita = !!state.mente.checkinsSemana[wk];
  const leuHoje = (state.estudos.leituraDiaria[t] || 0) >= state.estudos.metaPaginasDia;

  const habitosHoje = [treinouHoje, dormiuHoje, espCompleta, leuHoje];
  const feitos = habitosHoje.filter(Boolean).length;

  const semanaTreinos = last7Days().filter((d) => state.saude.treinos[d]).length;
  const mediaSono = mediaSemana(state.sono.horas);
  const streakEsp = streakEspiritualidade();
  const cursosMedia = mediaArray(state.estudos.cursos.map((c) => c.progresso));
  const carreiraMedia = mediaArray(
    state.carreira.frentes.flatMap((f) => f.projetos.map((p) => p.progresso))
  );
  const mesAtual = t.slice(0, 7);
  const fin = state.financas.meses[mesAtual];

  return `
    <h1>Visão geral</h1>
    <p class="sub">Hoje, ${feitos}/4 hábitos diários feitos (treino, sono, espiritualidade, leitura).</p>

    <div class="card">
      <div class="big-number">${feitos} <span class="of">/ 4</span></div>
      <div class="muted">hábitos diários de hoje</div>
    </div>

    <div class="grid">
      <div class="card mini" style="border-left-color:${cor('saude')}">
        <div class="mini-label">Saúde</div>
        <div class="mini-value">${semanaTreinos}/7 treinos essa semana</div>
      </div>
      <div class="card mini" style="border-left-color:${cor('sono')}">
        <div class="mini-label">Sono</div>
        <div class="mini-value">${mediaSono ? mediaSono.toFixed(1) + "h média (7d)" : "sem registros"}</div>
      </div>
      <div class="card mini" style="border-left-color:${cor('espiritualidade')}">
        <div class="mini-label">Espiritualidade</div>
        <div class="mini-value">${streakEsp} dia(s) seguidos completos</div>
      </div>
      <div class="card mini" style="border-left-color:${cor('mente')}">
        <div class="mini-label">Mente</div>
        <div class="mini-value">${mentefeita ? "check-in da semana feito" : "check-in da semana pendente"}</div>
      </div>
      <div class="card mini" style="border-left-color:${cor('estudos')}">
        <div class="mini-label">Estudos</div>
        <div class="mini-value">${cursosMedia !== null ? Math.round(cursosMedia) + "% médio nos cursos" : "sem cursos cadastrados"}</div>
      </div>
      <div class="card mini" style="border-left-color:${cor('carreira')}">
        <div class="mini-label">Carreira</div>
        <div class="mini-value">${carreiraMedia !== null ? Math.round(carreiraMedia) + "% médio nos projetos" : "sem projetos cadastrados"}</div>
      </div>
      <div class="card mini" style="border-left-color:${cor('financas')}">
        <div class="mini-label">Finanças</div>
        <div class="mini-value">${fin ? "mês de " + mesAtual + " registrado" : "mês atual sem registro"}</div>
      </div>
    </div>
  `;
}

function cor(id) {
  return PILARES.find((p) => p.id === id).cor;
}
function mediaSemana(mapa) {
  const dias = last7Days().map((d) => mapa[d]).filter((v) => v !== undefined);
  if (!dias.length) return null;
  return dias.reduce((a, b) => a + b, 0) / dias.length;
}
function mediaArray(arr) {
  const v = arr.filter((x) => typeof x === "number");
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}
function streakEspiritualidade() {
  let n = 0;
  let d = todayISO();
  while (true) {
    const c = state.espiritualidade.checklist[d];
    if (c && c.terco && c.evangelho && c.liturgia) {
      n++;
      d = addDays(d, -1);
    } else break;
  }
  return n;
}

// ---------- Saúde ----------
function renderSaude() {
  const s = state.saude;
  const semana = last7Days();
  const feitos = semana.filter((d) => s.treinos[d]).length;
  return `
    <h1>Saúde & corpo</h1>
    <p class="sub">Marca os dias em que treinou. A meta e a sequência se atualizam sozinhas.</p>

    <div class="card">
      <div class="card-title">Treinos — últimos 7 dias</div>
      <div class="checkrow">
        ${semana
          .map(
            (d) => `
          <button class="daybtn ${s.treinos[d] ? "on" : ""}" data-action="toggleTreino" data-date="${d}" style="--c:${cor('saude')}">
            <span>${fmtDia(d)}</span><span class="daynum">${d.slice(8, 10)}</span>
          </button>`
          )
          .join("")}
      </div>
      <div class="progress-row">
        <div class="bar"><div class="fill" style="width:${Math.min(100, (feitos / s.metaSemanal) * 100)}%;background:${cor('saude')}"></div></div>
        <span>${feitos} / ${s.metaSemanal} treinos essa semana</span>
      </div>
      <label class="inline-label">Meta semanal
        <input type="number" min="1" max="7" value="${s.metaSemanal}" data-action="metaTreino" style="width:60px">
      </label>
    </div>

    <div class="card">
      <div class="card-title">Recordes pessoais</div>
      <div class="add-row">
        <input id="novoRecorde" placeholder="ex: agachamento 60kg, 5km em 28min...">
        <button data-action="addRecorde">Adicionar</button>
      </div>
      <ul class="list">
        ${s.recordes
          .map(
            (r, i) => `<li>${r}<button class="x" data-action="delRecorde" data-i="${i}">×</button></li>`
          )
          .join("") || '<li class="muted">nenhum recorde ainda</li>'}
      </ul>
    </div>
  `;
}

// ---------- Sono ----------
function renderSono() {
  const s = state.sono;
  const semana = last7Days();
  const media = mediaSemana(s.horas);
  const rituaisDef = [
    ["semTela", "Sem tela 30min antes de dormir"],
    ["diario", "Diário antes de dormir"],
    ["semCafeina", "Sem cafeína depois das 17h"],
  ];
  const t = todayISO();
  const hoje = s.rituais[t] || {};

  return `
    <h1>Sono & descanso</h1>
    <p class="sub">Horas de sono por noite e os rituais que ajudam a dormir melhor.</p>

    <div class="card">
      <div class="card-title">Horas de sono — últimos 7 dias</div>
      <div class="barchart">
        ${semana
          .map((d) => {
            const h = s.horas[d] || 0;
            const pct = Math.min(100, (h / (s.metaHoras || 8)) * 100);
            return `<div class="bar-col">
              <div class="bar-track"><div class="bar-fill" style="height:${pct}%;background:${cor('sono')}"></div></div>
              <div class="bar-label">${fmtDia(d)}</div>
            </div>`;
          })
          .join("")}
      </div>
      <div class="add-row">
        <label>Horas dormidas hoje
          <input type="number" step="0.5" min="0" max="14" value="${s.horas[t] || ""}" data-action="setHoras">
        </label>
      </div>
      <p class="muted">Média 7 dias: ${media ? media.toFixed(1) + "h" : "sem registros ainda"}</p>
    </div>

    <div class="card">
      <div class="card-title">Rituais de hoje</div>
      ${rituaisDef
        .map(
          ([k, label]) => `
        <label class="check-line">
          <input type="checkbox" data-action="toggleRitual" data-key="${k}" ${hoje[k] ? "checked" : ""}>
          ${label}
        </label>`
        )
        .join("")}
    </div>
  `;
}

// ---------- Espiritualidade ----------
function renderEspiritualidade() {
  const e = state.espiritualidade;
  const semana = last7Days();
  const streak = streakEspiritualidade();
  const wk = weekKey(todayISO());
  const reflexao = e.reflexaoSemanal[wk] || "";

  return `
    <h1>Espiritualidade</h1>
    <p class="sub">Terço, evangelho e liturgia do dia — sem hora cravada, só constância.</p>

    <div class="card">
      <div class="big-number">${streak}<span class="of"> dia(s)</span></div>
      <div class="muted">seguidos com os 3 completos</div>
    </div>

    <div class="card">
      <div class="card-title">Últimos 7 dias</div>
      <table class="tbl">
        <thead><tr><th></th>${semana.map((d) => `<th>${fmtDia(d)}</th>`).join("")}</tr></thead>
        <tbody>
          ${["terco", "evangelho", "liturgia"]
            .map(
              (k) => `
            <tr>
              <td>${{ terco: "Terço", evangelho: "Evangelho", liturgia: "Liturgia" }[k]}</td>
              ${semana
                .map((d) => {
                  const c = e.checklist[d] || {};
                  return `<td><button class="check-cell ${c[k] ? "on" : ""}" data-action="toggleEsp" data-date="${d}" data-key="${k}" style="--c:${cor('espiritualidade')}">${c[k] ? "✓" : ""}</button></td>`;
                })
                .join("")}
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">Reflexão da semana</div>
      <textarea data-action="setReflexao" placeholder="o que Deus falou com você essa semana?">${reflexao}</textarea>
    </div>
  `;
}

// ---------- Mente ----------
function renderMente() {
  const m = state.mente;
  const wk = weekKey(todayISO());
  const c = m.checkinsSemana[wk] || { texto: "", coisaBoa: "", notas: {}, funcionou: "", mudar: "", vitoria: "" };
  const outrosPilares = ["saude", "sono", "estudos", "financas", "carreira"];

  return `
    <h1>Mente</h1>
    <p class="sub">Check-in e balanço da semana atual (${wk}).</p>

    <div class="card">
      <div class="card-title">Como você tá</div>
      <textarea data-action="mente:texto" placeholder="como foi a semana até agora?">${c.texto}</textarea>
      <label class="inline-label full">Uma coisa boa dessa semana
        <input data-action="mente:coisaBoa" value="${c.coisaBoa}" placeholder="...">
      </label>
      ${outrosPilares
        .map((p) => {
          const v = c.notas[p] || 3;
          return `<div class="slider-row">
            <span>${PILARES.find((x) => x.id === p).nome}</span>
            <input type="range" min="1" max="5" value="${v}" data-action="mente:nota" data-pilar="${p}">
            <span class="slider-val">${v}</span>
          </div>`;
        })
        .join("")}
    </div>

    <div class="card">
      <div class="card-title">Perguntas fixas da semana</div>
      <label class="inline-label full">O que funcionou bem?
        <input data-action="mente:funcionou" value="${c.funcionou}"></label>
      <label class="inline-label full">O que quero fazer diferente?
        <input data-action="mente:mudar" value="${c.mudar}"></label>
      <label class="inline-label full">Qual vitória quero reconhecer?
        <input data-action="mente:vitoria" value="${c.vitoria}"></label>
    </div>

    <div class="card">
      <div class="card-title">Insights & aprendizados</div>
      <div class="add-row">
        <input id="novoInsight" placeholder="um aprendizado, insight da terapia, de leitura...">
        <button data-action="addInsight">Adicionar</button>
      </div>
      <ul class="list">
        ${m.insights
          .slice()
          .reverse()
          .map(
            (ins) =>
              `<li><span class="insight-date">${ins.data}</span> — ${ins.texto}</li>`
          )
          .join("") || '<li class="muted">nenhum insight registrado ainda</li>'}
      </ul>
    </div>
  `;
}

// ---------- Estudos ----------
function renderEstudos() {
  const e = state.estudos;
  const t = todayISO();
  const semana = last7Days();
  const streakLeitura = streakLeituraFn();

  return `
    <h1>Estudos</h1>
    <p class="sub">Faculdade e cursos comprados, juntos num lugar só.</p>

    <div class="card">
      <div class="card-title">Faculdade</div>
      <label class="inline-label full">Matéria/foco atual
        <input data-action="fac:materia" value="${e.faculdade.materiaAtual}"></label>
      <label class="inline-label full">Próxima entrega/prova
        <input data-action="fac:entrega" value="${e.faculdade.proximaEntrega}"></label>
      <div class="progress-row">
        <div class="bar"><div class="fill" style="width:${e.faculdade.progresso}%;background:${cor('estudos')}"></div></div>
        <span>${e.faculdade.progresso}%</span>
      </div>
      <input type="range" min="0" max="100" value="${e.faculdade.progresso}" data-action="fac:progresso">
    </div>

    <div class="card">
      <div class="card-title">Cursos comprados</div>
      <div class="add-row">
        <input id="novoCurso" placeholder="nome do curso">
        <button data-action="addCurso">Adicionar</button>
      </div>
      ${e.cursos
        .map(
          (c, i) => `
        <div class="progress-item">
          <div class="progress-item-head">
            <span>${c.nome}</span>
            <button class="x" data-action="delCurso" data-i="${i}">×</button>
          </div>
          <div class="progress-row">
            <div class="bar"><div class="fill" style="width:${c.progresso}%;background:${cor('estudos')}"></div></div>
            <span>${c.progresso}%</span>
          </div>
          <input type="range" min="0" max="100" value="${c.progresso}" data-action="cursoProgresso" data-i="${i}">
        </div>`
        )
        .join("") || '<p class="muted">nenhum curso cadastrado ainda</p>'}
    </div>

    <div class="card">
      <div class="card-title">Leitura — meta ${e.metaPaginasDia} páginas/dia</div>
      <div class="barchart">
        ${semana
          .map((d) => {
            const p = e.leituraDiaria[d] || 0;
            const pct = Math.min(100, (p / e.metaPaginasDia) * 100);
            return `<div class="bar-col">
              <div class="bar-track"><div class="bar-fill" style="height:${pct}%;background:${cor('estudos')}"></div></div>
              <div class="bar-label">${fmtDia(d)}</div>
            </div>`;
          })
          .join("")}
      </div>
      <div class="add-row">
        <label>Páginas lidas hoje
          <input type="number" min="0" value="${e.leituraDiaria[t] || ""}" data-action="setLeitura">
        </label>
      </div>
      <p class="muted">Sequência atual: ${streakLeitura} dia(s)</p>
    </div>

    <div class="card">
      <div class="card-title">Livros sendo lidos</div>
      <div class="add-row">
        <input id="novoLivroNome" placeholder="nome do livro" style="flex:2">
        <input id="novoLivroTotal" type="number" placeholder="total de páginas" style="flex:1">
        <button data-action="addLivro">Adicionar</button>
      </div>
      ${e.livros
        .map((l, i) => {
          const pct = Math.min(100, Math.round((l.lidas / l.total) * 100));
          return `<div class="progress-item">
            <div class="progress-item-head">
              <span>${l.nome} — faltam ${Math.max(0, l.total - l.lidas)} páginas</span>
              <button class="x" data-action="delLivro" data-i="${i}">×</button>
            </div>
            <div class="progress-row">
              <div class="bar"><div class="fill" style="width:${pct}%;background:${cor('estudos')}"></div></div>
              <span>${pct}%</span>
            </div>
            <button data-action="livroMais10" data-i="${i}">+10 páginas</button>
          </div>`;
        })
        .join("") || '<p class="muted">nenhum livro cadastrado ainda</p>'}
    </div>
  `;
}
function streakLeituraFn() {
  let n = 0;
  let d = todayISO();
  const meta = state.estudos.metaPaginasDia;
  while ((state.estudos.leituraDiaria[d] || 0) >= meta) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ---------- Carreira ----------
function renderCarreira() {
  const c = state.carreira;
  return `
    <h1>Carreira</h1>
    <p class="sub">Frentes do trabalho — clientes e marca própria — com seus projetos e avanço.</p>

    <div class="add-row">
      <input id="novaFrente" placeholder="nome da frente (ex: Clientes, Marca própria)">
      <button data-action="addFrente">Adicionar frente</button>
    </div>

    ${c.frentes
      .map(
        (f, fi) => `
      <div class="card">
        <div class="card-title-row">
          <div class="card-title">${f.nome}</div>
          <button class="x" data-action="delFrente" data-fi="${fi}">× remover frente</button>
        </div>
        <div class="add-row">
          <input id="novoProjeto-${fi}" placeholder="novo projeto/tarefa">
          <button data-action="addProjeto" data-fi="${fi}">Adicionar</button>
        </div>
        ${f.projetos
          .map(
            (p, pi) => `
          <div class="progress-item">
            <div class="progress-item-head">
              <span>${p.nome}</span>
              <button class="x" data-action="delProjeto" data-fi="${fi}" data-pi="${pi}">×</button>
            </div>
            <div class="progress-row">
              <div class="bar"><div class="fill" style="width:${p.progresso}%;background:${cor('carreira')}"></div></div>
              <span>${p.progresso}%</span>
            </div>
            <input type="range" min="0" max="100" value="${p.progresso}" data-action="projetoProgresso" data-fi="${fi}" data-pi="${pi}">
          </div>`
          )
          .join("") || '<p class="muted">nenhum projeto ainda</p>'}
      </div>`
      )
      .join("") || '<p class="muted">nenhuma frente cadastrada — comece adicionando uma acima</p>'}
  `;
}

// ---------- Finanças ----------
function renderFinancas() {
  const f = state.financas;
  const mesAtual = todayISO().slice(0, 7);
  const m = f.meses[mesAtual] || { receita: 0, despesas: 0, categorias: {} };
  const categorias = Object.entries(m.categorias || {}).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...categorias.map(([, v]) => v));

  return `
    <h1>Finanças</h1>
    <p class="sub">Mês atual: ${mesAtual}</p>

    <div class="card">
      <div class="card-title">Receita x despesas</div>
      <div class="add-row">
        <label>Receita <input type="number" value="${m.receita}" data-action="fin:receita"></label>
        <label>Despesas <input type="number" value="${m.despesas}" data-action="fin:despesas"></label>
      </div>
      <p class="muted">Saldo do mês: R$ ${(m.receita - m.despesas).toFixed(2)}</p>
    </div>

    <div class="card">
      <div class="card-title">Gastos por categoria</div>
      <div class="add-row">
        <input id="novaCatNome" placeholder="categoria (ex: alimentação)">
        <input id="novaCatValor" type="number" placeholder="valor">
        <button data-action="addCategoria">Adicionar</button>
      </div>
      ${categorias
        .map(
          ([nome, valor]) => `
        <div class="cat-row">
          <span>${nome}</span>
          <div class="bar"><div class="fill" style="width:${(valor / maxCat) * 100}%;background:${cor('financas')}"></div></div>
          <span>R$ ${valor.toFixed(2)}</span>
          <button class="x" data-action="delCategoria" data-nome="${nome}">×</button>
        </div>`
        )
        .join("") || '<p class="muted">nenhuma categoria registrada esse mês</p>'}
    </div>

    <div class="card">
      <div class="card-title">Metas de longo prazo</div>
      <div class="add-row">
        <input id="novaMeta" placeholder="ex: reserva de emergência, viagem...">
        <button data-action="addMetaFin">Adicionar</button>
      </div>
      ${f.metas
        .map(
          (mt, i) => `
        <div class="progress-item">
          <div class="progress-item-head">
            <span>${mt.nome}</span>
            <button class="x" data-action="delMetaFin" data-i="${i}">×</button>
          </div>
          <div class="progress-row">
            <div class="bar"><div class="fill" style="width:${mt.progresso}%;background:${cor('financas')}"></div></div>
            <span>${mt.progresso}%</span>
          </div>
          <button data-action="metaFinMais10" data-i="${i}">+10%</button>
        </div>`
        )
        .join("") || '<p class="muted">nenhuma meta cadastrada</p>'}
    </div>
  `;
}

// ---------- handlers ----------
function attachHandlers() {
  const root = document.getElementById("content");

  root.querySelectorAll("[data-action]").forEach((el) => {
    const action = el.dataset.action;
    const evt = el.tagName === "BUTTON" ? "click" : el.tagName === "TEXTAREA" || el.type === "text" || el.type === "number" ? "input" : "change";
    el.addEventListener(evt, (ev) => handleAction(action, el, ev));
  });

  root.querySelectorAll("[data-action='addRecorde']").forEach((btn) =>
    btn.addEventListener("click", () => {
      const input = document.getElementById("novoRecorde");
      if (input.value.trim()) {
        state.saude.recordes.push(input.value.trim());
        saveState();
        render();
      }
    })
  );
}

function handleAction(action, el, ev) {
  const t = todayISO();
  switch (action) {
    case "toggleTreino":
      state.saude.treinos[el.dataset.date] = !state.saude.treinos[el.dataset.date];
      saveState();
      render();
      break;
    case "metaTreino":
      state.saude.metaSemanal = Number(el.value) || 1;
      saveState();
      render();
      break;
    case "delRecorde":
      state.saude.recordes.splice(Number(el.dataset.i), 1);
      saveState();
      render();
      break;

    case "setHoras":
      state.sono.horas[t] = Number(el.value) || 0;
      saveState();
      break;
    case "toggleRitual":
      state.sono.rituais[t] = state.sono.rituais[t] || {};
      state.sono.rituais[t][el.dataset.key] = el.checked;
      saveState();
      break;

    case "toggleEsp":
      const d = el.dataset.date;
      state.espiritualidade.checklist[d] = state.espiritualidade.checklist[d] || {};
      state.espiritualidade.checklist[d][el.dataset.key] = !state.espiritualidade.checklist[d][el.dataset.key];
      saveState();
      render();
      break;
    case "setReflexao":
      state.espiritualidade.reflexaoSemanal[weekKey(t)] = el.value;
      saveState();
      break;

    case "mente:texto":
    case "mente:coisaBoa":
    case "mente:funcionou":
    case "mente:mudar":
    case "mente:vitoria": {
      const wk = weekKey(t);
      const c = (state.mente.checkinsSemana[wk] = state.mente.checkinsSemana[wk] || {
        texto: "", coisaBoa: "", notas: {}, funcionou: "", mudar: "", vitoria: "",
      });
      const field = action.split(":")[1];
      c[field] = el.value;
      saveState();
      break;
    }
    case "mente:nota": {
      const wk = weekKey(t);
      const c = (state.mente.checkinsSemana[wk] = state.mente.checkinsSemana[wk] || {
        texto: "", coisaBoa: "", notas: {}, funcionou: "", mudar: "", vitoria: "",
      });
      c.notas[el.dataset.pilar] = Number(el.value);
      saveState();
      render();
      break;
    }

    case "fac:materia":
      state.estudos.faculdade.materiaAtual = el.value;
      saveState();
      break;
    case "fac:entrega":
      state.estudos.faculdade.proximaEntrega = el.value;
      saveState();
      break;
    case "fac:progresso":
      state.estudos.faculdade.progresso = Number(el.value);
      saveState();
      render();
      break;
    case "cursoProgresso":
      state.estudos.cursos[Number(el.dataset.i)].progresso = Number(el.value);
      saveState();
      render();
      break;
    case "delCurso":
      state.estudos.cursos.splice(Number(el.dataset.i), 1);
      saveState();
      render();
      break;
    case "setLeitura":
      state.estudos.leituraDiaria[t] = Number(el.value) || 0;
      saveState();
      render();
      break;
    case "livroMais10": {
      const l = state.estudos.livros[Number(el.dataset.i)];
      l.lidas = Math.min(l.total, l.lidas + 10);
      saveState();
      render();
      break;
    }
    case "delLivro":
      state.estudos.livros.splice(Number(el.dataset.i), 1);
      saveState();
      render();
      break;

    case "addFrente": {
      const input = document.getElementById("novaFrente");
      if (input.value.trim()) {
        state.carreira.frentes.push({ nome: input.value.trim(), projetos: [] });
        saveState();
        render();
      }
      break;
    }
    case "delFrente":
      state.carreira.frentes.splice(Number(el.dataset.fi), 1);
      saveState();
      render();
      break;
    case "addProjeto": {
      const fi = Number(el.dataset.fi);
      const input = document.getElementById(`novoProjeto-${fi}`);
      if (input.value.trim()) {
        state.carreira.frentes[fi].projetos.push({ nome: input.value.trim(), progresso: 0 });
        saveState();
        render();
      }
      break;
    }
    case "delProjeto":
      state.carreira.frentes[Number(el.dataset.fi)].projetos.splice(Number(el.dataset.pi), 1);
      saveState();
      render();
      break;
    case "projetoProgresso":
      state.carreira.frentes[Number(el.dataset.fi)].projetos[Number(el.dataset.pi)].progresso = Number(el.value);
      saveState();
      render();
      break;

    case "fin:receita":
    case "fin:despesas": {
      const mesAtual = t.slice(0, 7);
      const m = (state.financas.meses[mesAtual] = state.financas.meses[mesAtual] || {
        receita: 0, despesas: 0, categorias: {},
      });
      m[action.split(":")[1]] = Number(el.value) || 0;
      saveState();
      break;
    }
    case "addCategoria": {
      const nome = document.getElementById("novaCatNome").value.trim();
      const valor = Number(document.getElementById("novaCatValor").value) || 0;
      if (nome) {
        const mesAtual = t.slice(0, 7);
        const m = (state.financas.meses[mesAtual] = state.financas.meses[mesAtual] || {
          receita: 0, despesas: 0, categorias: {},
        });
        m.categorias[nome] = (m.categorias[nome] || 0) + valor;
        saveState();
        render();
      }
      break;
    }
    case "delCategoria": {
      const mesAtual = t.slice(0, 7);
      delete state.financas.meses[mesAtual].categorias[el.dataset.nome];
      saveState();
      render();
      break;
    }
    case "addMetaFin": {
      const input = document.getElementById("novaMeta");
      if (input.value.trim()) {
        state.financas.metas.push({ nome: input.value.trim(), progresso: 0 });
        saveState();
        render();
      }
      break;
    }
    case "delMetaFin":
      state.financas.metas.splice(Number(el.dataset.i), 1);
      saveState();
      render();
      break;
    case "metaFinMais10":
      const meta = state.financas.metas[Number(el.dataset.i)];
      meta.progresso = Math.min(100, meta.progresso + 10);
      saveState();
      render();
      break;
  }
}

// listeners fora do content (adicionar itens com botão próprio)
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (["addCurso", "addLivro", "addInsight"].includes(action)) {
    if (action === "addCurso") {
      const input = document.getElementById("novoCurso");
      if (input.value.trim()) {
        state.estudos.cursos.push({ nome: input.value.trim(), progresso: 0 });
        saveState();
        render();
      }
    }
    if (action === "addLivro") {
      const nome = document.getElementById("novoLivroNome").value.trim();
      const total = Number(document.getElementById("novoLivroTotal").value) || 100;
      if (nome) {
        state.estudos.livros.push({ nome, total, lidas: 0 });
        saveState();
        render();
      }
    }
    if (action === "addInsight") {
      const input = document.getElementById("novoInsight");
      if (input.value.trim()) {
        state.mente.insights.push({ data: todayISO(), texto: input.value.trim() });
        saveState();
        render();
      }
    }
  }
});

// ---------- login (e-mail + senha) ----------
function renderLogin(msg) {
  document.getElementById("nav").innerHTML = "";
  document.getElementById("content").innerHTML = `
    <div class="login-box">
      <h1>Painel da Vida</h1>
      <p class="sub">Primeira vez: cria sua conta. Depois disso, é só entrar com e-mail e senha.</p>
      <div class="add-row" style="flex-direction:column;align-items:stretch">
        <input id="loginEmail" type="email" placeholder="seu@email.com">
        <input id="loginSenha" type="password" placeholder="senha (mínimo 6 caracteres)">
        <div style="display:flex;gap:8px">
          <button id="btnEntrar" style="flex:1">Entrar</button>
          <button id="btnCriarConta" style="flex:1;background:#334155">Criar conta</button>
        </div>
      </div>
      ${msg ? `<p class="muted">${msg}</p>` : ""}
    </div>
  `;

  const getCreds = () => ({
    email: document.getElementById("loginEmail").value.trim(),
    password: document.getElementById("loginSenha").value,
  });

  document.getElementById("btnEntrar").addEventListener("click", async () => {
    const { email, password } = getCreds();
    if (!email || !password) return renderLogin("Preenche e-mail e senha.");
    setSyncStatus("entrando...");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) renderLogin(`Erro: ${error.message}`);
    // sucesso dispara SIGNED_IN via onAuthStateChange, que já leva pro app
  });

  document.getElementById("btnCriarConta").addEventListener("click", async () => {
    const { email, password } = getCreds();
    if (!email || !password) return renderLogin("Preenche e-mail e senha.");
    if (password.length < 6) return renderLogin("Senha precisa de pelo menos 6 caracteres.");
    setSyncStatus("criando conta...");
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) {
      renderLogin(`Erro: ${error.message}`);
    } else if (data.session) {
      // confirmação de e-mail desligada: já entra direto
    } else {
      renderLogin("Conta criada! Confirma seu e-mail (se a confirmação estiver ligada no Supabase) e depois clica em Entrar.");
    }
  });
}

function renderLogout() {
  const nav = document.getElementById("nav");
  const btn = document.createElement("button");
  btn.className = "nav-item logout";
  btn.textContent = "Sair";
  btn.addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });
  nav.appendChild(btn);
}

async function startApp() {
  await loadState();
  setSyncStatus(sb ? `sincronizado — ${currentUser.email}` : "só local (configure config.js pra sincronizar)");
  render();
  if (sb && currentUser) renderLogout();
}

// ---------- boot ----------
async function boot() {
  try {
    await initSupabase();

    if (!sb) {
      // sem Supabase configurado: modo local, sem exigir login
      await startApp();
    } else {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) {
        currentUser = { id: session.user.id, email: session.user.email };
        await startApp();
      } else {
        setSyncStatus("não logada");
        renderLogin();
      }

      sb.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session && session.user) {
          currentUser = { id: session.user.id, email: session.user.email };
          startApp();
        }
        if (event === "SIGNED_OUT") {
          currentUser = null;
          location.reload();
        }
      });
    }
  } catch (e) {
    console.error(e);
    document.getElementById("content").innerHTML =
      `<h1>Deu erro ao carregar</h1><p class="sub">Abre o Console do navegador (F12) e manda pra Sophia/Claude o texto em vermelho.</p><pre style="white-space:pre-wrap;background:#fee;padding:12px;border-radius:8px">${(e && e.message) || e}</pre>`;
  }

  if (location.protocol !== "file:" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot();
