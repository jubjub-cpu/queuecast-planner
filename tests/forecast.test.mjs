import assert from "node:assert/strict";
import { buildPlanningBrief, buildScenarioRecord, forecastDemand, linearTrend, scenarioScore, simulateCapacity } from "../assets/forecast.mjs";

const history = [100, 105, 111, 114, 120, 125, 129, 136, 140, 145, 151, 156];
const trend = linearTrend(history);
assert.ok(trend.slope > 4.5 && trend.slope < 5.5);
assert.ok(trend.residualDeviation < 2);
assert.throws(() => linearTrend([1, 2]), /three finite/);

const forecast = forecastDemand(history, 8);
assert.equal(forecast.length, 8);
assert.ok(forecast[7].point > forecast[0].point);
assert.ok(forecast.every((week) => week.low < week.point && week.point < week.high));
assert.throws(() => forecastDemand(history, 0), /Horizon/);

const covered = simulateCapacity(forecast, { demandChangePct: 0, agents: 12, productivity: 30, absencePct: 5, bufferPct: 8 });
assert.equal(covered.weeks.length, 8);
assert.ok(covered.summary.capacity > 300);
assert.equal(covered.summary.highRiskWeeks, 0);

const surge = simulateCapacity(forecast, { demandChangePct: 40, agents: 6, productivity: 25, absencePct: 18, bufferPct: 20 });
assert.ok(surge.summary.highRiskWeeks > 0);
assert.ok(surge.summary.requiredAgents > 6);
assert.ok(surge.summary.worstGap < 0);
assert.ok(scenarioScore(surge) < scenarioScore(covered));
assert.throws(() => simulateCapacity(forecast, { demandChangePct: 0, agents: 0, productivity: 20, absencePct: 0, bufferPct: 0 }), /positive capacity/);

const queue = { id: "test", name: "Test queue", unit: "cases", history };
const brief = buildPlanningBrief(queue, forecast, surge);
assert.match(brief.headline, /high-risk week/);
assert.match(brief.action, /Add/);
const record = buildScenarioRecord({ queue, forecast, simulation: surge, brief, decision: "adopted", events: ["calculated", "adopted"] });
assert.equal(record.schema, "queuecast-scenario/v1");
assert.equal(record.humanDecision, "adopted");
assert.match(record.disclaimer, /no worker schedule/i);

console.log("QUEUECAST LOGIC TESTS PASSED");
console.log("Checked trend, uncertainty, scenario capacity, risk, staffing brief, scoring, errors, and export boundaries.");
