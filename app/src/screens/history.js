// 履歴の画面。上にやった日が分かるカレンダー、下に記録の一覧。押すと中身を見て直せる。

import { ctx, setRenderer, commit, renderCurrent, kitOf } from "../app-state.js";
import { register, $, ICON, openSheet, closeSheet, closeAllSheets, updateSheet, toast, confirmSheet, openKeypad } from "../ui.js";
import { sortedSessions, prFlagsForSession, topSet } from "../model.js";
import { esc, todayISO, dateJP, dateShort, weekdayOf, hhmm, minutesBetween, clone } from "../util.js";
import { weightLabel } from "../export.js";
import { pageHeader, dayBadge } from "./common.js";

function monthKey(iso) { return iso.slice(0, 7); }

function view() {
  if (!ctx.view.history) ctx.view.history = { month: monthKey(todayISO()) };
  return ctx.view.history;
}

function calendarHTML(month) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysIn = new Date(y, m, 0).getDate();
  const byDate = new Map();
  ctx.data.sessions.forEach((s) => { if (s.date.startsWith(month)) byDate.set(s.date, [...(byDate.get(s.date) || []), s]); });
  const today = todayISO();
  let cells = "";
  for (let i = 0; i < first.getDay(); i++) cells += "<span></span>";
  for (let d = 1; d <= daysIn; d++) {
    const iso = `${month}-${String(d).padStart(2, "0")}`;
    const list = byDate.get(iso) || [];
    const dots = list.map((s) => `<i style="background:${kitOf(s.kit || "old").color}"></i>`).join("");
    const cls = [list.length ? "has" : "", iso === today ? "today" : ""].join(" ");
    cells += list.length
      ? `<button class="cal-day ${cls}" data-action="hist:date" data-date="${iso}"><span>${d}</span><span class="dots">${dots}</span></button>`
      : `<span class="cal-day ${cls}"><span>${d}</span></span>`;
  }
  const count = [...byDate.values()].reduce((n, l) => n + l.length, 0);
  return `<div class="card calendar">
    <div class="cal-head"><button class="icon-btn" data-action="hist:month" data-d="-1" aria-label="前の月">${ICON.chevL}</button><b>${y}年${m}月</b><span class="cal-count">${count}回</span><button class="icon-btn" data-action="hist:month" data-d="1" aria-label="次の月">${ICON.chevR}</button></div>
    <div class="cal-grid"><span class="wd">日</span><span class="wd">月</span><span class="wd">火</span><span class="wd">水</span><span class="wd">木</span><span class="wd">金</span><span class="wd">土</span>${cells}</div>
  </div>`;
}

function cardHTML(s) {
  const flags = prFlagsForSession(ctx.data, s);
  const prCount = flags.flat().filter(Boolean).length;
  const done = s.entries.filter((e) => !e.skipped && e.sets.length);
  const lines = done.slice(0, 2).map((e) => { const t = topSet(e.sets); return t ? `${e.name} ${weightLabel(e, t.weight)}×${t.reps}` : e.name; });
  const minutes = s.startedAt && s.endedAt ? minutesBetween(s.startedAt, s.endedAt) : null;
  return `<button class="card hist-card" data-action="hist:open" data-id="${esc(s.id)}">
    <div class="hist-date"><b class="n">${dateShort(s.date)}</b><span>${weekdayOf(s.date)}</span></div>
    <div class="hist-main">
      <p class="hist-title">${dayBadge(s)}<b>${esc(s.dayName || "記録")}</b></p>
      <p class="hist-lines">${lines.map(esc).join("<br>") || "全部スキップ"}${done.length > 2 ? `<br>ほか${done.length - 2}種目` : ""}</p>
      <p class="hist-tags">${prCount ? `<i class="chip part">自己ベスト ${prCount}</i>` : ""}${minutes !== null ? `<span>${minutes}分</span>` : ""}<span>${done.reduce((n, e) => n + e.sets.length, 0)}セット</span></p>
    </div>
  </button>`;
}

function renderHistory() {
  const v = view();
  const sessions = sortedSessions(ctx.data).reverse();
  let html = pageHeader("履歴");
  html += `<div class="page">${calendarHTML(v.month)}`;
  if (!sessions.length) {
    html += '<p class="empty big">まだ記録がありません。<br>記録の画面で「記録を終える」を押すと、ここに並びます。</p>';
  } else {
    let cur = "";
    for (const s of sessions) {
      const mk = monthKey(s.date);
      if (mk !== cur) { cur = mk; const [y, m] = mk.split("-"); html += `<p class="month-head">${y}年${Number(m)}月</p>`; }
      html += cardHTML(s);
    }
  }
  html += "</div>";
  $("#screen-history .scroller").innerHTML = html;
}

/* ---------- 記録の中身 ---------- */

let openId = null;

function sessionHTML(s) {
  const flags = prFlagsForSession(ctx.data, s);
  const minutes = s.startedAt && s.endedAt ? `${hhmm(s.startedAt)}〜${hhmm(s.endedAt)}（${minutesBetween(s.startedAt, s.endedAt)}分）` : "時間の記録なし";
  const r = s.ratings || {};
  const rate = (v) => (v === null || v === undefined ? "未入力" : v);
  const entries = s.entries.map((e, ei) => {
    const tag = e.substituteFor ? `<span class="sub-tag light">${esc(ctx.data.menu.exercises[e.substituteFor]?.name || "")}の代わり</span>` : e.added ? '<span class="sub-tag light">この日だけ</span>' : "";
    if (e.skipped || !e.sets.length) return `<div class="detail-entry skipped"><p class="detail-name">${esc(e.name)}${tag}</p><p class="detail-skip">スキップ</p></div>`;
    const chips = e.sets.map((x, si) => `<button class="set-chip${flags[ei] && flags[ei][si] ? " pr" : ""}" data-action="hist:set" data-e="${ei}" data-s="${si}">${esc(weightLabel(e, x.weight))}×${e.perSide ? "各側" : ""}${x.reps}</button>`).join("");
    return `<div class="detail-entry"><p class="detail-name">${esc(e.name)}${tag}</p><div class="chips">${chips}</div>${e.memo ? `<p class="hist-memo">${esc(e.memo)}</p>` : ""}</div>`;
  }).join("");
  return `<div class="detail-head">${dayBadge(s)}<div><h2>${dateJP(s.date)}</h2><p class="sub">${esc(`${s.dayLabel} ${s.dayName}`.trim())}　${minutes}</p></div></div>
    <p class="detail-rates">パンプ <b>${rate(r.pump)}</b>　出し切り感 <b>${rate(r.effort)}</b>　疲労感 <b>${rate(r.fatigue)}</b></p>
    ${entries}
    ${s.memo ? `<p class="detail-memo"><small>全体のメモ</small>${esc(s.memo)}</p>` : ""}
    <p class="detail-hint">セットを押すと、重さと回数を直せます。</p>
    <div class="sheet-stack">
      <label class="btn ghost wide file-btn">${ICON.calendar}日付を変える<input type="date" value="${s.date}" max="${todayISO()}" data-change="hist:date-change"></label>
      <button class="btn ghost wide" data-action="hist:memo">${ICON.memo}全体のメモを直す</button>
      <button class="btn danger-ghost wide" data-action="hist:delete">${ICON.trash}この記録を消す</button>
    </div>`;
}

const current = () => ctx.data.sessions.find((s) => s.id === openId);

function refreshSheet() {
  const s = current();
  if (s) updateSheet(sessionHTML(s));
}

export function openSession(id) {
  openId = id;
  const s = current();
  if (s) openSheet(sessionHTML(s), { className: "tall", onClose: () => { openId = null; } });
}

register({
  "hist:month": (el) => {
    const v = view();
    const [y, m] = v.month.split("-").map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.d), 1);
    v.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    renderCurrent();
  },
  "hist:date": (el) => {
    const list = ctx.data.sessions.filter((s) => s.date === el.dataset.date);
    if (list.length === 1) return openSession(list[0].id);
    openSheet(`<h2>${dateJP(el.dataset.date)}</h2>${list.map((s) => `<button class="opt" data-action="hist:open-close" data-id="${esc(s.id)}">${dayBadge(s)}<span><b>${esc(s.dayName)}</b><em>${s.entries.filter((e) => !e.skipped).length}種目</em></span>${ICON.chevR}</button>`).join("")}`);
  },
  "hist:open-close": (el) => { closeSheet(); openSession(el.dataset.id); },
  "hist:open": (el) => openSession(el.dataset.id),
  "hist:set": (el) => {
    const s = current();
    const e = s.entries[Number(el.dataset.e)];
    const si = Number(el.dataset.s);
    const x = e.sets[si];
    openSheet(`<h2>${esc(e.name)}　${si + 1}セット目</h2>
      <div class="edit-values">
        <button data-action="hist:set-w" data-e="${el.dataset.e}" data-s="${si}"><span>重さ</span><b>${esc(weightLabel(e, x.weight))}</b></button>
        <button data-action="hist:set-r" data-e="${el.dataset.e}" data-s="${si}"><span>回数</span><b>${e.perSide ? "各側" : ""}${x.reps}回</b></button>
      </div>
      <div class="sheet-stack"><button class="btn danger-ghost wide" data-action="hist:set-del" data-e="${el.dataset.e}" data-s="${si}">このセットを消す</button></div>`);
  },
  "hist:set-w": (el) => {
    const e = current().entries[Number(el.dataset.e)];
    const x = e.sets[Number(el.dataset.s)];
    openKeypad({ title: `${e.name}の重さ`, value: x.weight, unit: "kg", step: ctx.data.menu.exercises[e.exerciseId]?.step || 2.5, bodyweight: e.bodyweight,
      onDone: (v) => { x.weight = v; closeSheet(); commit(); refreshSheet(); } });
  },
  "hist:set-r": (el) => {
    const e = current().entries[Number(el.dataset.e)];
    const x = e.sets[Number(el.dataset.s)];
    openKeypad({ title: `${e.name}の回数`, value: x.reps, unit: "回", step: 1, integer: true,
      onDone: (v) => { x.reps = v; closeSheet(); commit(); refreshSheet(); } });
  },
  "hist:set-del": (el) => {
    const e = current().entries[Number(el.dataset.e)];
    e.sets.splice(Number(el.dataset.s), 1);
    if (!e.sets.length) e.skipped = true;
    closeSheet();
    commit();
    refreshSheet();
  },
  "hist:date-change": (el) => {
    const s = current();
    if (!el.value || el.value > todayISO()) return;
    s.date = el.value;
    commit();
    refreshSheet();
    toast(`${dateJP(s.date)}に移しました`);
  },
  "hist:memo": () => {
    const s = current();
    openSheet(`<h2>全体のメモ</h2><textarea id="histMemo">${esc(s.memo || "")}</textarea><button class="btn primary wide" data-action="hist:memo-save">保存</button>`);
  },
  "hist:memo-save": () => {
    current().memo = $("#histMemo").value.trim();
    closeSheet();
    commit();
    refreshSheet();
  },
  "hist:delete": () => {
    const s = current();
    confirmSheet({
      title: "この記録を消しますか？", body: `${dateJP(s.date)}　${esc(`${s.dayLabel} ${s.dayName}`.trim())}`, confirmLabel: "消す", danger: true,
      onConfirm: () => {
        const idx = ctx.data.sessions.indexOf(s);
        const removed = clone(s);
        ctx.data.sessions.splice(idx, 1);
        closeAllSheets();
        commit();
        toast("記録を消しました", { actionLabel: "元に戻す", onAction: () => { ctx.data.sessions.splice(idx, 0, removed); commit(); } });
      },
    });
  },
});

setRenderer("history", renderHistory);

