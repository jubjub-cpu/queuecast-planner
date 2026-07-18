const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function linearTrend(values) {
  if (!Array.isArray(values) || values.length < 3 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("At least three finite history values are required.");
  }
  const count = values.length;
  const meanX = (count - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < count; index += 1) {
    numerator += (index - meanX) * (values[index] - meanY);
    denominator += (index - meanX) ** 2;
  }
  const slope = denominator ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  const residuals = values.map((value, index) => value - (intercept + slope * index));
  const residualDeviation = Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, count - 2));
  return { slope, intercept, residualDeviation, mean: meanY };
}

export function forecastDemand(history, horizon = 8, confidenceMultiplier = 1.28) {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 52) throw new Error("Horizon must be between 1 and 52.");
  const trend = linearTrend(history);
  return Array.from({ length: horizon }, (_, index) => {
    const x = history.length + index;
    const point = Math.max(0, trend.intercept + trend.slope * x);
    const uncertainty = Math.max(4, trend.residualDeviation * confidenceMultiplier * Math.sqrt(1 + (index + 1) / history.length));
    return { week: index + 1, point, low: Math.max(0, point - uncertainty), high: point + uncertainty, uncertainty };
  });
}

export function simulateCapacity(forecast, assumptions) {
  const demandFactor = 1 + Number(assumptions.demandChangePct) / 100;
  const absenceFactor = 1 - Number(assumptions.absencePct) / 100;
  const bufferFactor = 1 + Number(assumptions.bufferPct) / 100;
  const agents = Number(assumptions.agents);
  const productivity = Number(assumptions.productivity);
  if (![demandFactor, absenceFactor, bufferFactor, agents, productivity].every(Number.isFinite) || agents <= 0 || productivity <= 0 || absenceFactor <= 0) {
    throw new Error("Scenario assumptions must produce positive capacity.");
  }
  const capacity = agents * productivity * absenceFactor;
  const weeks = forecast.map((item) => {
    const demand = item.point * demandFactor;
    const low = item.low * demandFactor;
    const high = item.high * demandFactor;
    const required = high * bufferFactor;
    const gap = capacity - required;
    const utilization = demand / capacity;
    const risk = required / capacity;
    return {
      week: item.week,
      demand,
      low,
      high,
      capacity,
      required,
      gap,
      utilization,
      risk,
      status: risk > 1.08 ? "high" : risk > 0.94 ? "watch" : "covered",
    };
  });
  const atRiskWeeks = weeks.filter((week) => week.status !== "covered").length;
  const highRiskWeeks = weeks.filter((week) => week.status === "high").length;
  const worstGap = Math.min(...weeks.map((week) => week.gap));
  const peakRequired = Math.max(...weeks.map((week) => week.required));
  const effectivePerAgent = productivity * absenceFactor;
  return {
    assumptions: { ...assumptions },
    weeks,
    summary: {
      capacity,
      averageDemand: weeks.reduce((sum, week) => sum + week.demand, 0) / weeks.length,
      averageUtilization: weeks.reduce((sum, week) => sum + week.utilization, 0) / weeks.length,
      atRiskWeeks,
      highRiskWeeks,
      worstGap,
      peakRequired,
      requiredAgents: Math.ceil(peakRequired / effectivePerAgent),
      status: highRiskWeeks ? "action" : atRiskWeeks ? "watch" : "covered",
    },
  };
}

export function buildPlanningBrief(queue, forecast, simulation) {
  const { summary } = simulation;
  const trend = linearTrend(queue.history);
  const direction = trend.slope > 1 ? "rising" : trend.slope < -1 ? "falling" : "stable";
  const action = summary.status === "action"
    ? `Add ${Math.max(0, summary.requiredAgents - simulation.assumptions.agents)} effective agent(s), improve productivity, or reduce the service buffer before adoption.`
    : summary.status === "watch"
      ? "Hold contingency coverage for watch weeks and review actual arrivals weekly."
      : "Current effective capacity covers the upper forecast plus the selected buffer.";
  return {
    headline: `${summary.highRiskWeeks} high-risk week${summary.highRiskWeeks === 1 ? "" : "s"} in the eight-week plan`,
    trend: `Historical demand is ${direction} by ${Math.abs(trend.slope).toFixed(1)} cases per week with residual deviation ${trend.residualDeviation.toFixed(1)}.`,
    capacity: `Effective weekly capacity is ${Math.round(summary.capacity)} cases; peak buffered requirement is ${Math.round(summary.peakRequired)}.`,
    action,
  };
}

export function buildScenarioRecord({ queue, forecast, simulation, brief, decision, events }) {
  if (!queue || !forecast || !simulation) throw new Error("A completed scenario is required.");
  return {
    schema: "queuecast-scenario/v1",
    queue: { id: queue.id, name: queue.name, unit: queue.unit },
    method: "least-squares linear trend with residual uncertainty band",
    history: [...queue.history],
    forecast,
    simulation,
    brief,
    humanDecision: decision || "pending",
    events: [...events],
    disclaimer: "Synthetic planning estimate; no worker schedule or employment action is created.",
  };
}

export function scenarioScore(simulation) {
  return clamp(Math.round(100 - simulation.summary.highRiskWeeks * 12 - Math.max(0, -simulation.summary.worstGap) / 10), 0, 100);
}
