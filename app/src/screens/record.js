// 記録の画面。上の面（Day の色）に今やる1セットを大きく出し、下に今の種目のセットとほかの種目を並べる。

import { ctx, commit, save, dayOf, kitOf, setThemeColor, setRenderer } from "../app-state.js";
import { register, $, ICON, openSheet, closeSheet, closeAllSheets, toast, confirmSheet, openKeypad, vibrate } from "../ui.js";
import { openPicker } from "../picker.js";
import {
  newActive, currentEntry, activeSetIndex, entryStatus, nextUnfinishedKey, activeTotals, hasProgress, allFinished,
  prFlagsForActive, completeCurrentSet, setWeight, finishActive, activeSummary, nextDayId, lastRecord, lastDateOfDay,
  validSet, entryFromItem, topSet, activeSide,
} from "../model.js";
import { esc, num, clock, todayISO, dateJP, dateShort, hhmm, joinDateTime, minutesBetween, clone } from "../util.js";
import { weightLabel, setText } from "../export.js";

const A = () => ctx.data.active;
let undoSnapshot = null;

/* ---------- 記録中のワークアウトを用意する ---------- */

/** 記録中のワークアウトがなければ作る。日をまたいで何も記録していなければ、今日の分に作り直す。 */
export function ensureActive({ promptStale = false } = {}) {
  const d = ctx.data;
  const today = todayISO();
  if (!d.menu.days.length) { d.active = null; return; }
  const a = d.active;
  if (!a || !d.menu.days.some((x) => x.id === a.dayId)) {
    d.active = { ...newActive(d, nextDayId(d), today), createdOn: today };
    save();
    return;
  }
  if (!hasProgress(a) && (a.createdOn || a.date) !== today) {
    d.active = { ...newActive(d, nextDayId(d), today), createdOn: today };
    save();
    return;
  }
  if (promptStale && hasProgress(a) && lastActivityDate(a) !== today && !a.manualDate) staleSheet();
}

function lastActivityDate(a) {
  const times = a.entries.flatMap((e) => e.sets.flatMap((s) => [s.done && s.doneAt, s.doneR && s.doneAtR].filter(Boolean))).sort();
  return times.length ? todayISO(new Date(times[times.length - 1])) : a.date;
}

/** メニューを直したとき、まだ何も記録していなければ、直したメニューで作り直す */
export function refreshActiveIfUntouched() {
  const a = A();
  if (a && !hasProgress(a)) {
    ctx.data.active = { ...newActive(ctx.data, ctx.data.menu.days.some((d) => d.id === a.dayId) ? a.dayId : nextDayId(ctx.data), a.date), createdOn: a.createdOn || todayISO(), manualDate: a.manualDate };
  }
}

function staleSheet() {
  const a = A();
  const t = activeTotals(a);
  openSheet(`<h2>${dateJP(a.date)}の記録が途中です</h2>
    <p class="sheet-text">${t.done}セットまで記録してあります。</p>
    <div class="sheet-stack">
      <button class="btn primary wide" data-action="rec:stale-save">${dateShort(a.date)}の記録として保存する</button>
      <button class="btn ghost wide" data-action="rec:stale-discard">捨てて、今日の記録を始める</button>
      <button class="btn text wide" data-action="sheet:close">あとで決める</button>
    </div>`);
}

/* ---------- 表示 ---------- */

function applyKit() {
  const day = dayOf(A().dayId);
  const k = kitOf(day ? day.kit : "a");
  const s = document.body.style;
  s.setProperty("--kit", k.color);
  s.setProperty("--kit-deep", k.deep);
  s.setProperty("--kit-soft", k.soft);
  document.body.dataset.kitDark = day && day.kit === "c" ? "1" : "";
}

const repText = (e, r) => `${e.perSide ? "各側" : ""}${r}回`;
const SIDE_JP = { R: "右", L: "左" };
/** 今やる側の重さと回数（片手ずつの種目の左は weightL・repsL。まだなければ右と同じ） */
const sideVals = (s, side) => (side === "L" ? { w: s.weightL ?? s.weight, r: s.repsL ?? s.reps } : { w: s.weight, r: s.reps });
const restLeft = (a) => (a.rest ? Math.ceil((a.rest.endsAt - Date.now()) / 1000) : 0);
const shortName = (n) => (n.length > 11 ? `${n.slice(0, 10)}…` : n);

function weightBig(e, w) {
  if (w === null || w === undefined) return '<span class="n dim">—</span><small>kg<em>押して入力</em></small>';
  if (e.bodyweight && w === 0) return '<span class="jp-big">自重</span><small class="bw-hint">＋で加重<br>−で補助</small>';
  const text = e.bodyweight && w > 0 ? `+${num(w)}` : num(Math.abs(w));
  const size = text.length >= 6 ? " s6" : text.length >= 5 ? " s5" : "";
  if (e.bodyweight && w > 0) return `<span class="n${size}">${text}</span><small>kg<em>加重</em></small>`;
  if (e.bodyweight && w < 0) return `<span class="n${size}">${text}</span><small>kg<em>補助</em></small>`;
  return `<span class="n${size}">${text}</span><small>kg</small>`;
}

function weightShort(e, w) {
  if (w === null || w === undefined) return "—";
  if (!e.bodyweight) return num(w);
  if (w === 0) return "自重";
  return w > 0 ? `+${num(w)}` : `補${num(-w)}`;
}

function topHTML(a) {
  return `<header class="top">
      <button class="date" data-action="rec:date" aria-label="記録する日を変える">${ICON.calendar}<span>${dateJP(a.date)}</span>${ICON.chevD}</button>
      <input type="date" class="sr" id="recDateInput" value="${a.date}" max="${todayISO()}" data-change="rec:date-change" tabindex="-1" aria-hidden="true">
      <button class="icon-btn" data-action="go:settings" aria-label="設定">${ICON.settings}</button>
    </header>`;
}

function statusHTML(a) {
  const day = dayOf(a.dayId);
  const t = activeTotals(a);
  const timer = a.startedAt
    ? `<button class="clock" data-action="rec:clock" aria-label="時間を直す">${ICON.clock}<span id="recElapsed">${clock((Date.now() - new Date(a.startedAt)) / 1000)}</span></button>`
    : `<button class="start-btn" data-action="rec:start">${ICON.play}スタート</button>`;
  return `<button class="day-chip" data-action="rec:day-sheet" aria-label="Day を変える"><span class="n">${esc(day.label)}</span>${esc(day.name)}${ICON.chevD}</button>
    <span class="count"><span class="n">${t.done}</span>/${t.all}セット</span>${timer}`;
}

function nameHTML(e) {
  const tag = e.substituteFor ? '<span class="sub-tag">入れ替え</span>' : e.added ? '<span class="sub-tag">今日だけ</span>' : "";
  return `<div class="ex-head"><h1 class="ex-name${e.name.length > 13 ? " long" : ""}">${esc(e.name)}${tag}</h1><button class="more" data-action="rec:menu" aria-label="この種目の操作">${ICON.more}</button></div>`;
}

function prevSetOf(e, i) {
  const last = lastRecord(ctx.data, e.exerciseId);
  if (!last) return { last: null, p: null };
  return { last, p: last.entry.sets.filter(validSet)[i] || null };
}

function stripesHTML(e, i, side) {
  if (!e.perSide) return `<span class="stripes">${e.sets.map((t, k) => `<i class="${t.done ? "done" : k === i ? "now" : ""}"></i>`).join("")}</span>`;
  return `<span class="stripes pairs">${e.sets.map((t, k) => {
    const r = t.done || t.doneR ? "done" : k === i && side === "R" ? "now" : "";
    const l = t.done ? "done" : k === i && side === "L" ? "now" : "";
    return `<span class="pair"><i class="${r}"></i><i class="${l}"></i></span>`;
  }).join("")}</span>`;
}

function setView(e, i) {
  const s = e.sets[i];
  const side = activeSide(e);
  const v = sideVals(s, side);
  const { last, p } = prevSetOf(e, i);
  const pv = p ? sideVals(p, side) : null;
  const sideWord = side ? `の${SIDE_JP[side]}` : "";
  const prev = p
    ? `前回のこのセット${sideWord}　${weightLabel(e, pv.w)} × ${side ? `${pv.r}回` : repText(e, pv.r)}（${dateShort(last.session.date)}）`
    : last ? `前回（${dateShort(last.session.date)}）はこのセットなし` : "この種目は初めての記録です";
  return `${nameHTML(e)}
    <div class="ex-meta">${stripesHTML(e, i, side)}<span>${i + 1}セット目</span>${side ? `<span class="side-badge">${SIDE_JP[side]}</span>` : ""}<span class="dim">目標 ${repText(e, e.targetReps)} × ${e.targetSets}</span></div>
    <div class="big">
      <div class="cell">
        <button class="val" id="wVal" data-action="rec:key-w" aria-label="重さを入力する">${weightBig(e, v.w)}</button>
        <div class="pm"><button data-action="rec:adj" data-f="w" data-d="-1" aria-label="重さを${num(e.step)}kg減らす">−${num(e.step)}</button><button data-action="rec:adj" data-f="w" data-d="1" aria-label="重さを${num(e.step)}kg増やす">+${num(e.step)}</button></div>
      </div>
      <div class="cell">
        <button class="val" id="rVal" data-action="rec:key-r" aria-label="回数を入力する"><span class="x">×</span><span class="n">${v.r}</span><small>回${side ? `<em>${SIDE_JP[side]}</em>` : ""}</small></button>
        <div class="pm"><button data-action="rec:adj" data-f="r" data-d="-1" aria-label="回数を1回減らす">−1</button><button data-action="rec:adj" data-f="r" data-d="1" aria-label="回数を1回増やす">+1</button></div>
      </div>
    </div>
    <div class="prev-row"><p class="prev-line">${esc(prev)}</p><button class="rest-btn" data-action="rec:rest-start" aria-label="休憩のタイマーを始める">${ICON.clock}休憩</button></div>
    <button class="complete" data-action="rec:complete">${ICON.check}${i + 1}セット目${sideWord}を完了</button>`;
}

function restView(e, i) {
  const a = A();
  const left = restLeft(a);
  const segs = 24;
  const on = Math.ceil((left / a.rest.totalSec) * segs);
  const s = e.sets[i];
  const side = activeSide(e);
  const v = sideVals(s, side);
  const { p: p0 } = prevSetOf(e, i);
  const p = p0 ? sideVals(p0, side) : null;
  const long = e.name.length > 12;
  return `<div class="rest-head"><span class="rest-pill"><span>休憩</span></span>次は${long ? "" : `${esc(e.name)}の`}${i + 1}セット目${side ? `の<b class="side-inline">${SIDE_JP[side]}</b>` : ""}</div>
    <div class="countdown n${left <= 10 ? " soon" : ""}" id="recCountdown">${clock(left)}</div>
    <div class="segbar${left <= 10 ? " soon" : ""}" id="recSegbar">${Array.from({ length: segs }, (_, k) => `<i class="${k < on ? "on" : ""}"></i>`).join("")}</div>
    <div class="rest-actions"><button data-action="rec:rest-adj" data-v="-15">−15秒</button><button data-action="rec:rest-adj" data-v="15">+15秒</button><button class="go" data-action="rec:rest-skip">次のセットへ</button></div>
    <p class="next-preview">次　${long ? `${esc(e.name)}　` : ""}<b>${weightShort(e, v.w)}${e.bodyweight && v.w === 0 ? "" : "kg"} × ${side ? `${v.r}回` : repText(e, v.r)}</b>${p ? `前回 ${weightShort(e, p.w)} × ${p.r}` : ""}</p>`;
}

function doneView(e) {
  const nk = nextUnfinishedKey(A(), e.key);
  return `${nameHTML(e)}
    <p class="state-big"><span class="n">${e.sets.length}</span>セット完了</p>
    <p class="state-sub">${e.sets.map((s) => `${weightShort(e, s.weight)}×${s.reps}${e.perSide ? `/${s.repsL ?? s.reps}` : ""}`).join("　")}</p>
    <div class="state-actions"><button data-action="rec:add-set">セットを1つ足す</button>${nk ? `<button class="go" data-action="rec:switch" data-key="${nk}">次の種目へ</button>` : ""}</div>`;
}

function skippedView(e) {
  const nk = nextUnfinishedKey(A(), e.key);
  return `${nameHTML(e)}
    <p class="state-big">今日はスキップ</p>
    <p class="state-sub">記録にも進み具合にも入りません。</p>
    <div class="state-actions"><button data-action="rec:unskip">やっぱりやる</button>${nk ? `<button class="go" data-action="rec:switch" data-key="${nk}">次の種目へ</button>` : ""}</div>`;
}

function finishedView() {
  const a = A();
  const t = activeTotals(a);
  const min = a.startedAt ? `　${minutesBetween(a.startedAt, new Date().toISOString())}分` : "";
  return `<p class="state-big wide">今日のメニューが<br>全部終わりました</p>
    <p class="state-sub">${t.done}セット${min}</p>
    <button class="finish-big" data-action="rec:finish">記録を終える</button>`;
}

function mainHTML(a) {
  const e = currentEntry(a);
  if (!e) return '<p class="state-big wide">この Day には種目がありません</p><p class="state-sub">メニューの画面で種目を足せます。</p>';
  const i = activeSetIndex(e);
  if (a.rest && restLeft(a) > 0 && i >= 0) return restView(e, i);
  if (i < 0 && allFinished(a)) return finishedView();
  if (e.skipped) return skippedView(e);
  if (i < 0) return doneView(e);
  return setView(e, i);
}

function tilesHTML(a, e) {
  const i = activeSetIndex(e);
  const flags = prFlagsForActive(ctx.data, a).get(e.key) || [];
  const last = lastRecord(ctx.data, e.exerciseId);
  const lastSets = last ? last.entry.sets.filter(validSet) : [];
  return `<div class="tiles" style="grid-template-columns: repeat(${Math.min(4, Math.max(3, e.sets.length))}, 1fr)">${e.sets.map((s, k) => {
    const cls = s.done ? "done" : k === i && !e.skipped ? "now" : "todo";
    const p = lastSets[k];
    const lr = (x) => (e.perSide ? `<small>/</small>${x.repsL ?? x.reps}` : "");
    const pv = s.doneR && !s.done ? "右は済み、左がまだ" : `前回 ${p ? `${weightShort(e, p.weight)}×${p.reps}${e.perSide ? `/${p.repsL ?? p.reps}` : ""}` : "なし"}`;
    return `<button class="tile ${cls}" data-action="rec:tile" data-k="${k}"><span class="n no">${k + 1}</span>${s.done ? `<span class="ok">${ICON.check}</span>` : ""}
      <span class="v">${weightShort(e, s.weight)}<small>×</small>${s.reps}${lr(s)}</span><span class="pv">${pv}</span>${flags[k] ? '<span class="tag">自己ベスト</span>' : ""}</button>`;
  }).join("")}</div>`;
}

function itemHTML(a, e) {
  const sts = entryStatus(e);
  const idx = a.entries.indexOf(e) + 1;
  const done = e.sets.filter((s) => s.done).length;
  let meta, right;
  if (sts === "part") { meta = `${e.sets.length}セット中 ${done}セット済み`; right = '<i class="chip part">途中</i>'; }
  else if (sts === "done") { meta = `${e.sets.length}セット完了`; right = `<span class="okc">${ICON.check}</span>`; }
  else if (sts === "skip") { meta = "今日はスキップ"; right = '<i class="chip skip">スキップ</i>'; }
  else { meta = `${weightLabel(e, e.sets[0] ? e.sets[0].weight : null)} × ${repText(e, e.targetReps)}　${e.sets.length}セット`; right = ICON.chevR; }
  return `<button class="item ${sts}" data-action="rec:switch" data-key="${e.key}"><span class="n no">${idx}</span><span class="txt"><b>${esc(e.name)}</b><em>${esc(meta)}</em></span><span class="state">${right}</span></button>`;
}

function listHTML(a) {
  const cur = currentEntry(a);
  const rank = { part: 0, todo: 1, done: 2, skip: 2 };
  const items = a.entries.filter((e) => e !== cur).sort((x, y) => rank[entryStatus(x)] - rank[entryStatus(y)] || a.entries.indexOf(x) - a.entries.indexOf(y));
  let html = "";
  for (let k = 0; k < items.length;) {
    const e = items[k];
    if (e.group && rank[entryStatus(e)] < 2) {
      const run = [];
      while (k < items.length && items[k].group === e.group && rank[entryStatus(items[k])] < 2) run.push(items[k++]);
      html += run.length > 1
        ? `<div class="group"><p class="group-label">${ICON.cable}${esc(e.group)}で続けて</p>${run.map((x) => itemHTML(a, x)).join("")}</div>`
        : itemHTML(a, run[0]);
    } else { html += itemHTML(a, e); k++; }
  }
  return html;
}

function backupReminderHTML() {
  const { sessions, settings } = ctx.data;
  if (!sessions.length) return "";
  const days = settings.lastBackupAt ? Math.floor((Date.now() - new Date(settings.lastBackupAt)) / 86400000) : null;
  if (days !== null && days < (settings.backupReminderDays || 14)) return "";
  return `<div class="reminder">${ICON.shield}<p>${days === null ? "まだバックアップがありません。" : `最後のバックアップから${days}日たっています。`}<br>記録はこのスマホの中にしかありません。</p><button class="btn small" data-action="go:settings">バックアップする</button></div>`;
}

function bodyHTML(a) {
  const e = currentEntry(a);
  if (!e) return "";
  const notes = [];
  if (e.note) notes.push(`<p class="note">${ICON.flag}<span><small>方針</small>${esc(e.note)}</span></p>`);
  const last = lastRecord(ctx.data, e.exerciseId);
  if (last && last.entry.memo) notes.push(`<p class="note">${ICON.memo}<span><small>前回のメモ（${dateShort(last.session.date)}）</small>${esc(last.entry.memo)}</span></p>`);
  if (e.memo) notes.push(`<p class="note">${ICON.memo}<span><small>今日のメモ</small>${esc(e.memo)}</span></p>`);
  const others = a.entries.length > 1;
  return `${backupReminderHTML()}
    <div class="sec">${e.name.length > 14 ? "この種目" : esc(e.name)}のセット<span>${last ? `前回 ${dateShort(last.session.date)}` : "前回の記録なし"}</span></div>
    ${tilesHTML(a, e)}
    ${notes.length ? `<div class="notes">${notes.join("")}</div>` : ""}
    ${others ? `<div class="sec">ほかの種目<span>押すと切り替わります</span></div><div class="list">${listHTML(a)}</div>` : ""}
    <button class="add-ex" data-action="rec:add-ex">${ICON.plus}今日だけ種目を足す</button>
    <button class="finish" data-action="rec:finish">記録を終える</button>`;
}

export function renderRecord({ swap = false } = {}) {
  const a = A();
  if (!a) {
    $("#recHero").innerHTML = '<p class="state-big wide" style="padding-top:60px">メニューがありません</p><p class="state-sub">メニューの画面で Day を作ってください。</p>';
    $("#recBody").innerHTML = "";
    return;
  }
  applyKit();
  $("#recHero").innerHTML = `${topHTML(a)}<div class="status">${statusHTML(a)}</div><div class="hero-main${swap ? " enter" : ""}">${mainHTML(a)}</div>`;
  $("#recBody").innerHTML = bodyHTML(a);
  setThemeColor();
}

function bump(sel) {
  const el = $(sel);
  if (!el) return;
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function updateRestUI(left) {
  const cd = $("#recCountdown"), bar = $("#recSegbar");
  if (!cd || !bar) return;
  cd.textContent = clock(left);
  cd.classList.toggle("soon", left <= 10);
  bar.classList.toggle("soon", left <= 10);
  const on = Math.ceil((left / A().rest.totalSec) * bar.children.length);
  [...bar.children].forEach((el, k) => el.classList.toggle("on", k < on));
}

/** 1秒ごとに呼ばれる */
export function tickRecord() {
  const a = A();
  if (!a) return;
  if (a.startedAt) {
    const el = $("#recElapsed");
    if (el) el.textContent = clock((Date.now() - new Date(a.startedAt)) / 1000);
  }
  if (a.rest) {
    const left = restLeft(a);
    if (left <= 0) {
      a.rest = null;
      save();
      vibrate([200, 100, 200]);
      if (ctx.screen === "record") renderRecord({ swap: true });
      toast("休憩おわり");
    } else if (ctx.screen === "record") updateRestUI(left);
  }
}

function prBurst(e, set) {
  vibrate([40, 60, 40, 60, 120]);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElement("div");
  el.className = "pr-burst";
  el.innerHTML = `<b>自己ベスト更新</b><span>${esc(e.name)}　${esc(setText(e, set))}</span>`;
  $("#recHero").append(el);
  setTimeout(() => el.remove(), 2000);
}

/* ---------- 操作 ---------- */

function doComplete() {
  const a = A();
  const snap = clone(a);
  const r = completeCurrentSet(ctx.data, a, new Date());
  if (!r) return;
  if (r.needsWeight) {
    const e = currentEntry(a);
    const i = activeSetIndex(e);
    return openKeypad({
      title: `${e.name}　${i + 1}セット目${r.side ? `の${SIDE_JP[r.side]}` : ""}の重さ`, value: null, unit: "kg", step: e.step,
      hint: "この種目は初めてなので、重さを入れてから完了にします",
      onDone: (v) => { setWeight(e, i, v, r.side === "L" ? "L" : null); doComplete(); },
    });
  }
  undoSnapshot = snap;
  commit({ render: false });
  renderRecord({ swap: true });
  const text = `${shortName(r.entry.name)} ${r.index + 1}セット目${r.side ? `の${SIDE_JP[r.side]}` : ""}を記録しました`;
  toast(r.autoStarted ? "記録しました。時間も計り始めました" : text, { actionLabel: "元に戻す", onAction: undo });
  if (r.pr) prBurst(r.entry, r.entry.sets[r.index]); else vibrate(25);
  ctx.hooks.afterGo.forEach((fn) => fn(ctx.screen));
}

function undo() {
  if (!undoSnapshot) return;
  ctx.data.active = undoSnapshot;
  undoSnapshot = null;
  commit({ render: false });
  renderRecord({ swap: true });
}

function curSet() {
  const e = currentEntry(A());
  const i = activeSetIndex(e);
  return { e, i, s: i >= 0 ? e.sets[i] : null, side: activeSide(e) };
}

function switchDay(dayId) {
  const a = A();
  ctx.data.active = { ...newActive(ctx.data, dayId, a.date), createdOn: todayISO(), manualDate: a.manualDate };
  undoSnapshot = null;
  commit({ render: false });
  closeAllSheets();
  renderRecord({ swap: true });
  $("#recScroller").scrollTo({ top: 0 });
}

const ratings = { pump: null, effort: null, fatigue: null };

function rateHTML(key, label) {
  const v = ratings[key];
  return `<div class="rate"><div class="rate-top">${label}<span class="${v ? "set" : ""}">${v ?? "未入力"}</span></div>
    <div class="scale">${Array.from({ length: 10 }, (_, k) => `<button class="${v === k + 1 ? "on" : ""}" data-action="rec:rate" data-key="${key}" data-v="${k + 1}">${k + 1}</button>`).join("")}</div></div>`;
}

function ratesHTML() {
  return rateHTML("pump", "パンプ") + rateHTML("effort", "出し切り感") + rateHTML("fatigue", "疲労感");
}

function summaryHTML() {
  const a = A();
  const day = dayOf(a.dayId);
  const m = activeSummary(ctx.data, a);
  const now = new Date();
  const minutes = a.startedAt ? minutesBetween(a.startedAt, now.toISOString()) : null;
  const row = (left, right) => `<div class="sum-row">${left}<em>${right}</em></div>`;
  return `<h2>今日の記録</h2><p class="sub">${dateJP(a.date)}　${esc(day.label)} ${esc(day.name)}</p>
    <div class="stats">
      <div class="stat"><span class="n">${m.totals.done}</span><span>セット</span></div>
      <div class="stat"><span class="n">${minutes ?? "—"}</span><span>分</span></div>
      <div class="stat hot"><span class="n">${m.prs.length}</span><span>自己ベスト</span></div>
    </div>
    <div class="time-row">
      <label class="field"><span>始めた時刻</span><input type="time" id="sumStart" value="${a.startedAt ? hhmm(a.startedAt) : ""}"></label>
      <label class="field"><span>終えた時刻</span><input type="time" id="sumEnd" value="${hhmm(now.toISOString())}"></label>
    </div>
    <p class="sum-sec">自己ベスト</p>
    ${m.prs.length ? m.prs.map(({ entry, set }) => row(esc(entry.name), `<span class="up">${esc(setText(entry, set))}</span>`)).join("") : '<p class="sum-empty">今日はありません。</p>'}
    <p class="sum-sec">前回より伸びた種目</p>
    ${m.ups.length ? m.ups.map(({ entry, from, to }) => row(esc(entry.name), `${esc(setText(entry, from))}　から　<span class="up">${esc(setText(entry, to))}</span>`)).join("") : '<p class="sum-empty">今日はありません。</p>'}
    ${m.skipped.length ? `<p class="sum-sec">やらなかった種目</p><p class="sum-empty">${m.skipped.map(esc).join("、")}</p>` : ""}
    <p class="sum-sec">今日の評価</p>
    <div id="rates">${ratesHTML()}</div>
    <p class="sum-sec">全体のメモ</p>
    <textarea id="sumMemo" placeholder="例：睡眠不足。ベンチは調子がよかった"></textarea>
    <button class="btn primary wide" data-action="rec:save">保存して終える</button>`;
}

function saveSession({ startedAt, endedAt, memo, rating }) {
  const d = ctx.data;
  const a = A();
  const session = finishActive(d, a, { startedAt, endedAt, ratings: rating, memo });
  d.sessions.push(session);
  d.active = { ...newActive(d, nextDayId(d), todayISO()), createdOn: todayISO() };
  undoSnapshot = null;
  commit({ render: false });
  closeAllSheets();
  renderRecord({ swap: true });
  $("#recScroller").scrollTo({ top: 0 });
  const next = dayOf(d.active.dayId);
  toast(`保存しました。次は ${next.label} ${next.name} です`);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  ctx.hooks.afterGo.forEach((fn) => fn(ctx.screen));
}

register({
  "rec:date": () => {
    const input = $("#recDateInput");
    try { input.showPicker(); } catch { input.focus(); input.click(); }
  },
  "rec:date-change": (el) => {
    const v = el.value;
    if (!v || v > todayISO()) return;
    const a = A();
    a.date = v;
    a.manualDate = v !== todayISO();
    commit();
    if (a.manualDate) toast(`${dateJP(v)}の記録として入れます`);
  },
  "rec:start": () => {
    A().startedAt = new Date().toISOString();
    commit();
    toast("時間を計り始めました");
    ctx.hooks.afterGo.forEach((fn) => fn(ctx.screen));
  },
  "rec:clock": () => {
    const a = A();
    openSheet(`<h2>ワークアウトの時間</h2>
      <p class="sheet-text">${hhmm(a.startedAt)} に始めて、${clock((Date.now() - new Date(a.startedAt)) / 1000)} たっています。始めた時刻はあとから直せます。</p>
      <label class="field"><span>始めた時刻</span><input type="time" id="startTimeInput" value="${hhmm(a.startedAt)}"></label>
      <div class="sheet-actions"><button class="btn ghost" data-action="rec:clock-reset">計り直す</button><button class="btn primary" data-action="rec:clock-save">保存</button></div>`);
  },
  "rec:clock-save": () => {
    const v = $("#startTimeInput").value;
    if (!v) return toast("時刻を入れてください");
    const a = A();
    const iso = joinDateTime(a.date, v);
    if (new Date(iso) > new Date()) return toast("今より後の時刻にはできません");
    a.startedAt = iso;
    closeSheet();
    commit();
  },
  "rec:clock-reset": () => {
    A().startedAt = null;
    closeSheet();
    commit();
    toast("時間をリセットしました。もう一度スタートを押せます");
  },
  "rec:adj": (el) => {
    const { e, i, s, side } = curSet();
    if (!s) return;
    const d = Number(el.dataset.d);
    const v = sideVals(s, side);
    if (el.dataset.f === "w") {
      let w = v.w;
      if (w === null || w === undefined) { if (d < 0) return; w = 0; }
      w = Math.round((w + d * e.step) * 100) / 100;
      if (!e.bodyweight) w = Math.max(0, w);
      setWeight(e, i, w, side === "L" ? "L" : null);
    } else if (side === "L") {
      s.repsL = Math.max(1, v.r + d);
      s.touchedL = true;
    } else {
      s.reps = Math.max(1, s.reps + d);
    }
    commit({ render: false });
    renderRecord();
    bump(el.dataset.f === "w" ? "#wVal" : "#rVal");
  },
  "rec:key-w": () => {
    const { e, i, s, side } = curSet();
    if (!s) return;
    const sw = side ? `の${SIDE_JP[side]}` : "";
    openKeypad({
      title: `${e.name}　${i + 1}セット目${sw}の重さ`, value: sideVals(s, side).w, unit: "kg", step: e.step, bodyweight: e.bodyweight,
      hint: e.bodyweight ? "自重は 0 のまま。補助を使うときは「補助」を選んで入力" : "",
      onDone: (v) => { setWeight(e, i, v, side === "L" ? "L" : null); commit({ render: false }); renderRecord(); bump("#wVal"); },
    });
  },
  "rec:key-r": () => {
    const { e, i, s, side } = curSet();
    if (!s) return;
    const sw = side ? `の${SIDE_JP[side]}` : "";
    openKeypad({
      title: `${e.name}　${i + 1}セット目${sw}の回数`, value: sideVals(s, side).r, unit: "回", step: 1, integer: true,
      onDone: (v) => {
        if (side === "L") { s.repsL = v; s.touchedL = true; } else s.reps = v;
        commit({ render: false }); renderRecord(); bump("#rVal");
      },
    });
  },
  "rec:rest-start": () => {
    const a = A();
    const e = currentEntry(a);
    if (!e) return;
    a.rest = { endsAt: Date.now() + e.restSec * 1000, totalSec: e.restSec };
    commit({ render: false });
    renderRecord({ swap: true });
  },
  "rec:complete": () => doComplete(),
  "rec:rest-adj": (el) => {
    const a = A();
    if (!a.rest) return;
    a.rest.endsAt = Math.max(Date.now() + 1000, a.rest.endsAt + Number(el.dataset.v) * 1000);
    a.rest.totalSec = Math.max(a.rest.totalSec, restLeft(a));
    save();
    updateRestUI(restLeft(a));
  },
  "rec:rest-skip": () => {
    A().rest = null;
    commit({ render: false });
    renderRecord({ swap: true });
  },
  "rec:switch": (el) => {
    const a = A();
    if (a.currentKey === el.dataset.key) return;
    a.currentKey = el.dataset.key;
    commit({ render: false });
    renderRecord({ swap: true });
    $("#recScroller").scrollTo({ top: 0, behavior: "smooth" });
  },
  "rec:day-sheet": () => {
    const a = A();
    const next = nextDayId(ctx.data);
    const days = ctx.data.menu.days;
    openSheet(`<h2>今日のメニュー</h2><p class="sub">${days.map((d) => esc(d.label)).join(" → 休み → ")} → 休み の順です。</p>
      ${days.map((d) => {
        const k = kitOf(d.kit);
        const lastDate = lastDateOfDay(ctx.data, d.id);
        const right = d.id === a.dayId ? `<span class="okc">${ICON.check}</span>` : d.id === next ? '<span class="tagline">次の順番</span>' : "";
        return `<button class="opt" data-action="rec:pick-day" data-id="${d.id}"><span class="badge n" style="background:${k.color}">${esc(d.label)}</span>
          <span><b>${esc(d.name)}</b><em>${d.items.length}種目　${lastDate ? `前回 ${dateShort(lastDate)}` : "まだ記録なし"}${d.id === next && d.id === a.dayId ? "　次の順番" : ""}</em></span>${right}</button>`;
      }).join("")}
      ${hasProgress(a) ? `<button class="act danger" data-action="rec:discard">${ICON.trash}今の記録を捨てて、最初からにする</button>` : ""}`);
  },
  "rec:pick-day": (el) => {
    const a = A();
    const id = el.dataset.id;
    if (id === a.dayId) return closeSheet();
    const d = dayOf(id);
    if (hasProgress(a)) {
      const t = activeTotals(a);
      return confirmSheet({
        title: `${d.label} ${d.name} に切り替えますか？`,
        body: `今の記録（${t.done}セット）は消えます。`,
        confirmLabel: "切り替える", danger: true,
        onConfirm: () => switchDay(id),
      });
    }
    switchDay(id);
  },
  "rec:discard": () => {
    confirmSheet({
      title: "今の記録を捨てますか？", body: "今日ここまでに記録したセットが消えます。", confirmLabel: "捨てる", danger: true,
      onConfirm: () => switchDay(A().dayId),
    });
  },
  "rec:menu": () => {
    const e = currentEntry(A());
    const lastSet = e.sets[e.sets.length - 1];
    const extra = e.sets.length > 1 && !lastSet.done && !lastSet.doneR;
    openSheet(`<h2>${esc(e.name)}</h2><p class="sub">この種目の操作</p>
      <button class="act" data-action="rec:memo">${ICON.memo}メモを書く</button>
      <button class="act" data-action="rec:add-set">${ICON.plus}セットを1つ足す</button>
      ${extra ? `<button class="act" data-action="rec:remove-set">${ICON.close}最後のセットを減らす</button>` : ""}
      <button class="act" data-action="rec:substitute">${ICON.swap}今日だけ別の種目に入れ替える</button>
      ${e.skipped ? `<button class="act" data-action="rec:unskip">${ICON.back}スキップをやめる</button>` : `<button class="act danger" data-action="rec:skip">${ICON.skip}今日はスキップする</button>`}`);
  },
  "rec:memo": () => {
    const e = currentEntry(A());
    openSheet(`<h2>${esc(e.name)}のメモ</h2><p class="sub">次にこの種目をやるときに表示されます。</p>
      <textarea id="memoInput" placeholder="例：右肩に違和感。次は重さを据え置く">${esc(e.memo)}</textarea>
      <button class="btn primary wide" data-action="rec:memo-save">メモを保存</button>`);
  },
  "rec:memo-save": () => {
    currentEntry(A()).memo = $("#memoInput").value.trim();
    closeAllSheets();
    commit();
    toast("メモを保存しました");
  },
  "rec:add-set": () => {
    const e = currentEntry(A());
    const last = e.sets[e.sets.length - 1];
    const ns = { weight: last ? last.weight : e.bodyweight ? 0 : null, reps: e.targetReps, done: false, doneAt: null };
    if (e.perSide) Object.assign(ns, { weightL: last ? last.weightL ?? last.weight : ns.weight, repsL: e.targetReps, doneR: false, doneAtR: null, touchedL: false });
    e.sets.push(ns);
    e.skipped = false;
    closeAllSheets();
    commit({ render: false });
    renderRecord({ swap: true });
  },
  "rec:remove-set": () => {
    const e = currentEntry(A());
    const lastSet = e.sets[e.sets.length - 1];
    if (e.sets.length > 1 && !lastSet.done && !lastSet.doneR) e.sets.pop();
    closeAllSheets();
    commit();
  },
  "rec:skip": () => {
    const a = A();
    const snap = clone(a);
    const e = currentEntry(a);
    e.skipped = true;
    const nk = nextUnfinishedKey(a, e.key);
    if (nk) a.currentKey = nk;
    undoSnapshot = snap;
    closeAllSheets();
    commit({ render: false });
    renderRecord({ swap: true });
    toast(`${shortName(e.name)}をスキップしました`, { actionLabel: "元に戻す", onAction: undo });
  },
  "rec:unskip": () => {
    currentEntry(A()).skipped = false;
    closeAllSheets();
    commit({ render: false });
    renderRecord({ swap: true });
  },
  "rec:substitute": () => {
    const a = A();
    const e = currentEntry(a);
    if (e.sets.some((s) => s.done || s.doneR)) return toast("記録したセットがある種目は入れ替えられません。「今日だけ種目を足す」を使ってください");
    closeAllSheets();
    openPicker({
      title: `${e.name}の代わりにやる種目`,
      exclude: [e.exerciseId],
      onChoose: (id) => {
        const idx = a.entries.indexOf(e);
        const ne = entryFromItem(ctx.data, { exerciseId: id, sets: e.targetSets, reps: e.targetReps, restSec: e.restSec, note: "", group: "" },
          { key: e.key, substituteFor: e.substituteFor || e.exerciseId });
        a.entries[idx] = ne;
        commit({ render: false });
        renderRecord({ swap: true });
        toast(`今日は ${ne.name} に入れ替えました`);
      },
    });
  },
  "rec:add-ex": () => {
    const a = A();
    openPicker({
      title: "今日だけ種目を足す",
      onChoose: (id) => {
        const last = lastRecord(ctx.data, id);
        const top = last ? topSet(last.entry.sets) : null;
        const ne = entryFromItem(ctx.data, { exerciseId: id, sets: last ? Math.max(1, last.entry.sets.length) : 3, reps: top ? top.reps : 10, restSec: 120 }, { added: true });
        a.entries.push(ne);
        a.currentKey = ne.key;
        commit({ render: false });
        renderRecord({ swap: true });
        $("#recScroller").scrollTo({ top: 0, behavior: "smooth" });
      },
    });
  },
  "rec:tile": (el) => {
    const e = currentEntry(A());
    const k = Number(el.dataset.k);
    const s = e.sets[k];
    const vals = e.perSide
      ? `<button data-action="rec:tile-w" data-k="${k}" data-side="R"><span>右の重さ</span><b>${esc(weightLabel(e, s.weight))}</b></button>
        <button data-action="rec:tile-r" data-k="${k}" data-side="R"><span>右の回数</span><b>${s.reps}回</b></button>
        <button data-action="rec:tile-w" data-k="${k}" data-side="L"><span>左の重さ</span><b>${esc(weightLabel(e, s.weightL ?? s.weight))}</b></button>
        <button data-action="rec:tile-r" data-k="${k}" data-side="L"><span>左の回数</span><b>${s.repsL ?? s.reps}回</b></button>`
      : `<button data-action="rec:tile-w" data-k="${k}"><span>重さ</span><b>${esc(weightLabel(e, s.weight))}</b></button>
        <button data-action="rec:tile-r" data-k="${k}"><span>回数</span><b>${repText(e, s.reps)}</b></button>`;
    openSheet(`<h2>${esc(e.name)}　${k + 1}セット目</h2>
      <div class="edit-values">${vals}</div>
      <div class="sheet-stack">
        ${s.done || s.doneR ? `<button class="btn ghost wide" data-action="rec:tile-undone" data-k="${k}">未完了に戻す</button>` : ""}
        ${e.sets.length > 1 ? `<button class="btn danger-ghost wide" data-action="rec:tile-del" data-k="${k}">このセットを消す</button>` : ""}
      </div>`);
  },
  "rec:tile-w": (el) => {
    const e = currentEntry(A());
    const k = Number(el.dataset.k);
    const s = e.sets[k];
    const left = el.dataset.side === "L";
    openKeypad({
      title: `${e.name}　${k + 1}セット目${el.dataset.side ? `の${left ? "左" : "右"}` : ""}の重さ`, value: left ? s.weightL ?? s.weight : s.weight, unit: "kg", step: e.step, bodyweight: e.bodyweight,
      onDone: (v) => {
        if (left) { if (s.done) s.weightL = v; else setWeight(e, k, v, "L"); }
        else if (s.done || s.doneR) s.weight = v;
        else setWeight(e, k, v);
        closeAllSheets(); commit();
      },
    });
  },
  "rec:tile-r": (el) => {
    const e = currentEntry(A());
    const k = Number(el.dataset.k);
    const s = e.sets[k];
    const left = el.dataset.side === "L";
    openKeypad({
      title: `${e.name}　${k + 1}セット目${el.dataset.side ? `の${left ? "左" : "右"}` : ""}の回数`, value: left ? s.repsL ?? s.reps : s.reps, unit: "回", step: 1, integer: true,
      onDone: (v) => {
        if (left) { s.repsL = v; s.touchedL = true; } else s.reps = v;
        closeAllSheets(); commit();
      },
    });
  },
  "rec:tile-undone": (el) => {
    const a = A();
    const e = currentEntry(a);
    const s = e.sets[Number(el.dataset.k)];
    s.done = false;
    s.doneAt = null;
    if (e.perSide) { s.doneR = false; s.doneAtR = null; }
    a.rest = null;
    closeAllSheets();
    commit({ render: false });
    renderRecord({ swap: true });
  },
  "rec:tile-del": (el) => {
    const e = currentEntry(A());
    e.sets.splice(Number(el.dataset.k), 1);
    closeAllSheets();
    commit();
  },
  "rec:finish": () => {
    const a = A();
    if (!hasProgress(a)) return toast("まだ1セットも記録していません");
    ratings.pump = ratings.effort = ratings.fatigue = null;
    openSheet(summaryHTML(), { className: "tall" });
  },
  "rec:rate": (el) => {
    const key = el.dataset.key;
    const v = Number(el.dataset.v);
    ratings[key] = ratings[key] === v ? null : v;
    const box = $("#rates");
    if (box) box.innerHTML = ratesHTML();
  },
  "rec:save": () => {
    const a = A();
    const sv = $("#sumStart").value, ev = $("#sumEnd").value;
    const startedAt = sv ? joinDateTime(a.date, sv) : a.startedAt;
    let endedAt = ev ? joinDateTime(a.date, ev) : new Date().toISOString();
    if (startedAt && new Date(endedAt) < new Date(startedAt)) return toast("終えた時刻が、始めた時刻より前になっています");
    saveSession({ startedAt, endedAt, memo: $("#sumMemo").value.trim(), rating: { ...ratings } });
  },
  "rec:stale-save": () => {
    const a = A();
    const times = a.entries.flatMap((e) => e.sets.filter((s) => s.done && s.doneAt).map((s) => s.doneAt)).sort();
    saveSession({ startedAt: a.startedAt, endedAt: times[times.length - 1] || a.startedAt, memo: "", rating: { pump: null, effort: null, fatigue: null } });
  },
  "rec:stale-discard": () => {
    const d = ctx.data;
    d.active = { ...newActive(d, nextDayId(d), todayISO()), createdOn: todayISO() };
    closeAllSheets();
    commit();
  },
});

setRenderer("record", () => renderRecord());

