import { buildPlanningBrief, buildScenarioRecord, forecastDemand, linearTrend, scenarioScore, simulateCapacity } from "./forecast.mjs";

const workspace = document.querySelector("#workspace");
const state = { queues: [], queue: null, forecast: null, simulation: null, brief: null, decision: null, events: [] };
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function shell() {
  workspace.innerHTML = `<div class="planner-shell">
    <aside class="queue-rail"><div class="rail-heading"><p class="eyebrow">Synthetic operations</p><h1>Service queues</h1><p>Choose a fictional workload and test an eight-week capacity plan.</p></div><div id="queue-list" class="queue-list"></div><p class="privacy-note">Planning estimates only. No employee names, shifts, schedules, messages, or external actions are included.</p></aside>
    <section class="planner" aria-labelledby="planner-title">
      <div class="planner-heading"><div><p class="eyebrow" id="queue-industry">Queue</p><h2 id="planner-title">Select a queue</h2><p id="forecast-method">Least-squares trend with residual uncertainty.</p></div><button id="export-scenario" class="secondary" type="button" disabled>Download scenario</button></div>
      <div class="kpi-strip" id="kpi-strip"><div><span>Plan score</span><strong>--</strong></div><div><span>Risk weeks</span><strong>--</strong></div><div><span>Effective capacity</span><strong>--</strong></div><div><span>Required agents</span><strong>--</strong></div></div>
      <div class="planning-grid">
        <section class="chart-section" aria-labelledby="chart-heading"><div class="panel-heading"><div><p class="eyebrow">Demand and capacity</p><h3 id="chart-heading">Twenty-week planning view</h3></div><span id="chart-summary">12 actual + 8 forecast</span></div><div class="chart-wrap"><canvas id="forecast-chart" width="1000" height="470" aria-label="Demand forecast, uncertainty band, and capacity line"></canvas></div><div class="chart-legend"><span><i class="actual"></i> Actual</span><span><i class="forecast"></i> Forecast</span><span><i class="band"></i> Uncertainty</span><span><i class="capacity"></i> Capacity</span></div></section>
        <aside class="assumption-panel" aria-labelledby="assumption-heading"><div class="panel-heading"><div><p class="eyebrow">Scenario controls</p><h3 id="assumption-heading">Planner assumptions</h3></div><button id="reset-assumptions" class="icon-button" type="button" title="Reset assumptions" aria-label="Reset assumptions">Reset</button></div><div id="assumption-controls"></div><button id="run-scenario" type="button">Run scenario</button></aside>
      </div>
      <section class="brief-section" aria-labelledby="brief-heading"><div class="panel-heading"><div><p class="eyebrow">Decision support</p><h3 id="brief-heading">Staffing brief</h3></div><span id="brief-status" class="status idle">Draft</span></div><div id="brief-output" class="brief-output"><p>Run a scenario to produce a quantified planning brief.</p></div></section>
      <section class="table-section" aria-labelledby="table-heading"><div class="panel-heading"><div><p class="eyebrow">Forecast detail</p><h3 id="table-heading">Weekly coverage</h3></div><span>Upper band includes selected service buffer</span></div><div class="table-wrap"><table><thead><tr><th>Week</th><th>Forecast</th><th>Range</th><th>Capacity</th><th>Buffered need</th><th>Gap</th><th>Status</th></tr></thead><tbody id="week-rows"></tbody></table></div></section>
      <section class="decision-section" aria-labelledby="decision-heading"><div><p class="eyebrow">Human planning gate</p><h3 id="decision-heading">Scenario decision</h3><p>Forecasts inform planning; a workforce lead owns assumptions, labor decisions, and adoption.</p><p id="decision-summary" class="decision-summary">No decision recorded.</p></div><div class="decision-actions"><button id="adopt-scenario" type="button" disabled>Adopt scenario</button><button id="reject-scenario" class="return" type="button" disabled>Reject scenario</button></div></section>
      <section class="event-section" aria-labelledby="event-heading"><div class="panel-heading"><div><p class="eyebrow">Local evidence</p><h3 id="event-heading">Planning log</h3></div></div><ol id="event-list"></ol></section>
    </section></div>`;
}

const controls = [
  { key: "demandChangePct", label: "Demand change", min: -20, max: 40, step: 1, suffix: "%" },
  { key: "agents", label: "Scheduled agents", min: 5, max: 40, step: 1, suffix: "" },
  { key: "productivity", label: "Cases per agent", min: 20, max: 65, step: 1, suffix: "" },
  { key: "absencePct", label: "Absence assumption", min: 0, max: 25, step: 1, suffix: "%" },
  { key: "bufferPct", label: "Service buffer", min: 0, max: 30, step: 1, suffix: "%" },
];

function renderQueues() {
  document.querySelector("#queue-list").innerHTML = state.queues.map((queue) => `<button type="button" class="queue-button" data-queue="${queue.id}" aria-pressed="${queue.id === state.queue?.id}"><span>${escapeHtml(queue.industry)}</span><strong>${escapeHtml(queue.name)}</strong><small>${queue.history.length} historical weeks</small></button>`).join("");
}

function renderControls(values) {
  document.querySelector("#assumption-controls").innerHTML = controls.map((control) => `<label class="assumption" for="${control.key}"><span>${control.label}<output id="${control.key}-output">${values[control.key]}${control.suffix}</output></span><input id="${control.key}" data-assumption="${control.key}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${values[control.key]}"></label>`).join("");
}

function readAssumptions() {
  return Object.fromEntries(controls.map(({ key }) => [key, Number(document.querySelector(`#${key}`).value)]));
}

function addEvent(message) {
  state.events.push(message);
  document.querySelector("#event-list").innerHTML = state.events.map((event) => `<li>${escapeHtml(event)}</li>`).join("");
}

function chooseQueue(queue) {
  state.queue = queue;
  state.forecast = forecastDemand(queue.history, 8);
  state.decision = null;
  renderQueues();
  renderControls(queue.defaults);
  document.querySelector("#queue-industry").textContent = queue.industry;
  document.querySelector("#planner-title").textContent = queue.name;
  const trend = linearTrend(queue.history);
  document.querySelector("#forecast-method").textContent = `Trend ${trend.slope >= 0 ? "+" : ""}${trend.slope.toFixed(1)} ${queue.unit}/week; residual deviation ${trend.residualDeviation.toFixed(1)}.`;
  addEvent(`${queue.name} selected from synthetic planning data.`);
  runScenario();
}

function runScenario() {
  const assumptions = readAssumptions();
  state.simulation = simulateCapacity(state.forecast, assumptions);
  state.brief = buildPlanningBrief(state.queue, state.forecast, state.simulation);
  state.decision = null;
  renderScenario();
  addEvent(`Scenario calculated: ${state.simulation.summary.highRiskWeeks} high-risk week(s), ${Math.round(state.simulation.summary.capacity)} ${state.queue.unit} effective capacity.`);
}

function renderScenario() {
  const { summary } = state.simulation;
  document.querySelector("#kpi-strip").innerHTML = `<div><span>Plan score</span><strong>${scenarioScore(state.simulation)}</strong></div><div><span>Risk weeks</span><strong>${summary.atRiskWeeks}/8</strong></div><div><span>Effective capacity</span><strong>${Math.round(summary.capacity)}</strong></div><div><span>Required agents</span><strong>${summary.requiredAgents}</strong></div>`;
  const status = document.querySelector("#brief-status");
  status.className = `status ${summary.status}`;
  status.textContent = summary.status === "action" ? "Action needed" : summary.status === "watch" ? "Watch" : "Covered";
  document.querySelector("#brief-output").innerHTML = `<h4>${escapeHtml(state.brief.headline)}</h4><p>${escapeHtml(state.brief.trend)}</p><p>${escapeHtml(state.brief.capacity)}</p><p><strong>Planner action:</strong> ${escapeHtml(state.brief.action)}</p>`;
  document.querySelector("#week-rows").innerHTML = state.simulation.weeks.map((week) => `<tr><td>W${week.week}</td><td>${Math.round(week.demand)}</td><td>${Math.round(week.low)}-${Math.round(week.high)}</td><td>${Math.round(week.capacity)}</td><td>${Math.round(week.required)}</td><td class="${week.gap < 0 ? "negative" : "positive"}">${week.gap >= 0 ? "+" : ""}${Math.round(week.gap)}</td><td><span class="week-status ${week.status}">${week.status}</span></td></tr>`).join("");
  document.querySelector("#adopt-scenario").disabled = false;
  document.querySelector("#reject-scenario").disabled = false;
  document.querySelector("#export-scenario").disabled = false;
  document.querySelector("#decision-summary").className = "decision-summary";
  document.querySelector("#decision-summary").textContent = "No decision recorded.";
  drawChart();
}

function drawChart() {
  const canvas = document.querySelector("#forecast-chart");
  const context = canvas.getContext("2d");
  const ratio = devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 1000;
  const cssHeight = Math.max(320, cssWidth * 0.47);
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  context.scale(ratio, ratio);
  const width = cssWidth;
  const height = cssHeight;
  const pad = { left: 55, right: 24, top: 24, bottom: 42 };
  const history = state.queue.history;
  const weeks = state.simulation.weeks;
  const all = [...history, ...weeks.flatMap((week) => [week.high, week.capacity])];
  const min = Math.max(0, Math.min(...all) * 0.88);
  const max = Math.max(...all) * 1.08;
  const x = (index) => pad.left + index * ((width - pad.left - pad.right) / 19);
  const y = (value) => pad.top + (max - value) * ((height - pad.top - pad.bottom) / (max - min || 1));
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.font = "12px Arial";
  context.fillStyle = "#6a6a66";
  context.strokeStyle = "#d7d9d3";
  context.lineWidth = 1;
  for (let line = 0; line <= 4; line += 1) {
    const value = min + (max - min) * (line / 4);
    const py = y(value);
    context.beginPath(); context.moveTo(pad.left, py); context.lineTo(width - pad.right, py); context.stroke();
    context.fillText(String(Math.round(value)), 8, py + 4);
  }
  context.beginPath();
  weeks.forEach((week, index) => { const px = x(12 + index); const py = y(week.high); index ? context.lineTo(px, py) : context.moveTo(px, py); });
  [...weeks].reverse().forEach((week, reverseIndex) => { const index = weeks.length - 1 - reverseIndex; context.lineTo(x(12 + index), y(week.low)); });
  context.closePath(); context.fillStyle = "rgba(54, 95, 194, 0.15)"; context.fill();
  const line = (values, start, color, dash = []) => { context.beginPath(); values.forEach((value, index) => { const px=x(start+index),py=y(value); index?context.lineTo(px,py):context.moveTo(px,py); }); context.strokeStyle=color; context.lineWidth=3; context.setLineDash(dash); context.stroke(); context.setLineDash([]); };
  line(history, 0, "#18181b");
  line(weeks.map((week) => week.demand), 12, "#355fc2");
  line(weeks.map((week) => week.capacity), 12, "#d83a77", [10, 7]);
  context.strokeStyle = "#777"; context.lineWidth = 1; context.beginPath(); context.moveTo(x(11.5), pad.top); context.lineTo(x(11.5), height-pad.bottom); context.stroke();
  context.fillStyle = "#555"; context.fillText("Actual", x(0), height-14); context.fillText("Forecast", x(12), height-14);
}

function decide(decision) {
  state.decision = decision;
  const adopted = decision === "adopted";
  const summary = document.querySelector("#decision-summary");
  summary.className = `decision-summary ${adopted ? "adopted" : "rejected"}`;
  summary.textContent = adopted ? "Scenario adopted by the human workforce planner." : "Scenario rejected by the human workforce planner.";
  addEvent(adopted ? "Human planner adopted the scenario." : "Human planner rejected the scenario.");
}

function exportScenario() {
  const record = buildScenarioRecord({ queue: state.queue, forecast: state.forecast, simulation: state.simulation, brief: state.brief, decision: state.decision, events: state.events });
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "queuecast-scenario.json"; link.click(); URL.revokeObjectURL(link.href);
  addEvent("Local scenario record downloaded; no schedule or worker data was included.");
}

function bind() {
  document.querySelector("#queue-list").addEventListener("click", (event) => { const button=event.target.closest("[data-queue]"); if(button) chooseQueue(state.queues.find((queue)=>queue.id===button.dataset.queue)); });
  document.querySelector("#assumption-controls").addEventListener("input", (event) => { const input=event.target.closest("[data-assumption]"); if(!input)return; const control=controls.find((item)=>item.key===input.dataset.assumption); document.querySelector(`#${control.key}-output`).textContent=`${input.value}${control.suffix}`; });
  document.querySelector("#run-scenario").addEventListener("click", runScenario);
  document.querySelector("#reset-assumptions").addEventListener("click", () => { renderControls(state.queue.defaults); runScenario(); });
  document.querySelector("#adopt-scenario").addEventListener("click", () => decide("adopted"));
  document.querySelector("#reject-scenario").addEventListener("click", () => decide("rejected"));
  document.querySelector("#export-scenario").addEventListener("click", exportScenario);
  addEventListener("resize", () => { if(state.simulation) drawChart(); });
}

async function start() {
  try {
    const response = await fetch("data/queues.json"); if(!response.ok) throw new Error(`Queue request failed with ${response.status}.`);
    const payload = await response.json(); state.queues = payload.queues; state.events = ["QueueCast Planner opened in deterministic local mode."];
    shell(); renderQueues(); bind(); chooseQueue(state.queues[0]);
  } catch (error) {
    workspace.innerHTML = `<section class="startup error"><p class="eyebrow">Planning data unavailable</p><h1>The synthetic service queues could not be loaded.</h1><p>${escapeHtml(error.message)}</p><button type="button" id="retry-start">Retry</button></section>`;
    document.querySelector("#retry-start").addEventListener("click", () => location.reload());
  }
}
start();
