// 進捗の画面。Day ごとに「各種目の最大重量の合計」と、種目ごとの推移を縦に並べる。

import { ctx, setRenderer, kitOf, renderCurrent } from "../app-state.js";
import { register, $, ICON } from "../ui.js";
import { exerciseSeries, dayTotalSeries, bestEver, nextDayId } from "../model.js";
import { lineChart } from "../charts.js";
import { esc, num, dateShort, todayISO, addDays } from "../util.js";
import { weightLabel } from "../export.js";
import { pageHeader } from "./common.js";

const PERIODS = [
  { key: "3m", label: "3か月", days: 92 },
  { key: "6m", label: "半年", days: 183 },
  { key: "1y", label: "1年", days: 366 },
  { key: "all", label: "全部", days: null },
];

function view() {
  const days = ctx.data.menu.days;
  if (!ctx.view.progress) ctx.view.progress = { dayId: null, period: "3m" };
  const v = ctx.view.progress;
  if (!days.some((d) => d.id === v.dayId)) v.dayId = ctx.data.active ? ctx.data.active.dayId : nextDayId(ctx.data);
  return v;
}

function exerciseCard(ex, since) {
  const series = exerciseSeries(ctx.data, ex.id, since);
  const best = bestEver(ctx.data, ex.id);
  const repsMode = ex.bodyweight && series.length > 0 && series.every((p) => p.weight === 0);
  let bestSoFar = null;
  const points = series.map((p) => {
    const isPr = bestSoFar !== null && (p.weight > bestSoFar.weight || (p.weight === bestSoFar.weight && p.reps > bestSoFar.reps));
    if (!bestSoFar || isPr) bestSoFar = p;
    const value = repsMode ? p.reps : p.weight;
    const text = repsMode ? `${p.reps}回` : ex.bodyweight ? weightLabel(ex, p.weight).replace("自重＋", "+").replace("補助", "補") : `${num(p.weight)}`;
    return { label: dateShort(p.date), value, text, tip: `${dateShort(p.date)}　${weightLabel(ex, p.weight)} × ${p.reps}回`, mark: isPr ? "pr" : "" };
  });
  return `<article class="card chart-card">
    <button class="chart-title" data-action="ex:history" data-id="${esc(ex.id)}"><b>${esc(ex.name)}</b>${ICON.chevR}</button>
    <p class="chart-sub">${repsMode ? "自重の回数（その日いちばん多い回数）" : "その日のいちばん重いセット（kg）"}${best ? `　自己ベスト ${esc(weightLabel(ex, best.weight))} × ${best.reps}` : ""}</p>
    ${lineChart({ points })}
  </article>`;
}

function renderProgress() {
  const v = view();
  const days = ctx.data.menu.days;
  const day = days.find((d) => d.id === v.dayId);
  const p = PERIODS.find((x) => x.key === v.period);
  const since = p.days ? addDays(todayISO(), -p.days) : null;
  let html = pageHeader("進捗");
  html += `<div class="page">
    <div class="chips-row">${days.map((d) => `<button class="day-pill${d.id === v.dayId ? " on" : ""}" data-action="prog:day" data-id="${d.id}" style="--c:${kitOf(d.kit).color}"><span class="n">${esc(d.label)}</span>${esc(d.name)}</button>`).join("")}</div>
    <div class="seg">${PERIODS.map((x) => `<button class="${x.key === v.period ? "on" : ""}" data-action="prog:period" data-key="${x.key}">${x.label}</button>`).join("")}</div>`;
  if (!day) {
    html += '<p class="empty">メニューがありません。</p></div>';
    $("#screen-progress .scroller").innerHTML = html;
    return;
  }
  const totals = dayTotalSeries(ctx.data, day.id, since);
  html += `<article class="card chart-card total">
    <p class="chart-title static"><b>${esc(day.label)} ${esc(day.name)}　最大重量の合計</b></p>
    <p class="chart-sub">その日にやった種目の、いちばん重いセットの重さを足した値（kg）。入れ替えた種目・足した種目は入れません。白抜きの点はスキップか入れ替えがあった日です。</p>
    ${lineChart({ points: totals.map((t) => ({ label: dateShort(t.date), value: t.total, text: num(t.total), tip: `${dateShort(t.date)}　合計 ${num(t.total)}kg${t.missing ? "（スキップ・入れ替えあり）" : ""}`, mark: t.missing ? "missing" : "" })), height: 170 })}
  </article>`;
  html += day.items.map((it) => ctx.data.menu.exercises[it.exerciseId]).filter(Boolean).map((ex) => exerciseCard(ex, since)).join("");
  html += "</div>";
  $("#screen-progress .scroller").innerHTML = html;
}

register({
  "prog:day": (el) => { view().dayId = el.dataset.id; renderCurrent(); },
  "prog:period": (el) => { view().period = el.dataset.key; renderCurrent(); },
});

setRenderer("progress", renderProgress);
