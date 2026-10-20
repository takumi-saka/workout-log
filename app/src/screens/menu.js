// メニューの画面。Day の追加・削除・並び替えと、Day ごとの種目の追加・削除・並び替え・目標の変更。

import { ctx, setRenderer, commit, kitOf } from "../app-state.js";
import { register, $, ICON, openSheet, closeSheet, updateSheet, toast, confirmSheet, sheetCount } from "../ui.js";
import { openPicker } from "../picker.js";
import { refreshActiveIfUntouched, ensureActive } from "./record.js";
import { normalizeName } from "../model.js";
import { KITS, CATEGORIES, STEP_CHOICES, REST_CHOICES } from "../menu-default.js";
import { esc, num, clock, clone, uid } from "../util.js";
import { pageHeader } from "./common.js";

const restText = (sec) => (sec % 60 ? clock(sec) : `${sec / 60}分`);

function renderMenu() {
  const days = ctx.data.menu.days;
  const lib = ctx.data.menu.exercises;
  let html = pageHeader("メニュー");
  html += `<div class="page">
    <p class="cycle">${days.length ? `${days.map((d) => esc(d.label)).join(" → 休み → ")} → 休み の順に回します。` : "Day がありません。"}</p>`;
  days.forEach((d, i) => {
    const k = kitOf(d.kit);
    const sets = d.items.reduce((n, it) => n + it.sets, 0);
    html += `<article class="card day-card">
      <button class="day-card-main" data-action="menu:day" data-id="${d.id}">
        <span class="badge n" style="background:${k.color}">${esc(d.label)}</span>
        <span class="day-card-text"><b>${esc(d.name)}</b><em>${d.items.length}種目　${sets}セット</em>
          <small>${d.items.map((it) => esc(lib[it.exerciseId] ? lib[it.exerciseId].name : "")).join("、")}</small></span>
      </button>
      <div class="reorder">
        <button class="icon-btn" data-action="menu:day-move" data-i="${i}" data-d="-1" aria-label="上へ" ${i === 0 ? "disabled" : ""}>${ICON.up}</button>
        <button class="icon-btn" data-action="menu:day-move" data-i="${i}" data-d="1" aria-label="下へ" ${i === days.length - 1 ? "disabled" : ""}>${ICON.down}</button>
      </div>
    </article>`;
  });
  html += `<button class="btn ghost wide" data-action="menu:day-add">${ICON.plus}Day を足す</button>
    <p class="hint">Day を押すと、種目・セット数・回数・休憩の長さなどを直せます。順番は右の矢印で入れ替えられます。</p>
  </div>`;
  $("#screen-menu .scroller").innerHTML = html;
}

/* ---------- Day を直す ---------- */

let draft = null; // { isNew, day, lib }

function syncDayFields() {
  const l = $("#dLabel"), n = $("#dName");
  if (l) draft.day.label = l.value.trim();
  if (n) draft.day.name = n.value.trim();
}

function dayHTML() {
  const d = draft.day;
  return `<h2>${draft.isNew ? "Day を足す" : `${esc(d.label)} ${esc(d.name)}を直す`}</h2>
    <div class="field-row">
      <label class="field narrow"><span>記号</span><input id="dLabel" value="${esc(d.label)}" maxlength="3" autocomplete="off"></label>
      <label class="field"><span>名前</span><input id="dName" value="${esc(d.name)}" autocomplete="off"></label>
    </div>
    <div class="field"><span>色</span><div class="kit-row">${Object.entries(KITS).filter(([key]) => key !== "old").map(([key, v]) => `<button class="kit-swatch${key === d.kit ? " on" : ""}" style="background:${v.color}" data-action="menu:kit" data-kit="${key}" aria-label="${v.name}"></button>`).join("")}</div></div>
    <p class="field-label">種目（上から順にやります）</p>
    <div class="day-items">${d.items.length ? d.items.map((it, i) => {
      const ex = draft.lib[it.exerciseId];
      return `<div class="day-item">
        <button class="day-item-main" data-action="menu:item" data-i="${i}"><b>${esc(ex ? ex.name : "（不明な種目）")}</b>
          <em>${ex && ex.perSide ? "各側" : ""}${it.reps}回 × ${it.sets}セット　休憩 ${restText(it.restSec)}${it.group ? `　${esc(it.group)}` : ""}</em></button>
        <div class="reorder">
          <button class="icon-btn" data-action="menu:item-move" data-i="${i}" data-d="-1" aria-label="上へ" ${i === 0 ? "disabled" : ""}>${ICON.up}</button>
          <button class="icon-btn" data-action="menu:item-move" data-i="${i}" data-d="1" aria-label="下へ" ${i === d.items.length - 1 ? "disabled" : ""}>${ICON.down}</button>
        </div>
        <button class="icon-btn" data-action="menu:item-del" data-i="${i}" aria-label="この種目を外す">${ICON.close}</button>
      </div>`;
    }).join("") : '<p class="empty">まだ種目がありません。</p>'}</div>
    <button class="btn ghost wide" data-action="menu:item-add">${ICON.plus}種目を足す</button>
    <div class="sheet-actions">
      ${draft.isNew ? '<button class="btn ghost" data-action="sheet:close">やめる</button>' : '<button class="btn danger-ghost" data-action="menu:day-del">この Day を消す</button>'}
      <button class="btn primary" data-action="menu:day-save">保存</button>
    </div>`;
}

function refreshDay() {
  syncDayFields();
  updateSheet(dayHTML());
}

function openDay(day, isNew) {
  draft = { isNew, day: clone(day), lib: clone(ctx.data.menu.exercises) };
  openSheet(dayHTML(), { className: "tall", onClose: () => { draft = null; } });
}

/* ---------- 種目を直す ---------- */

let item = null; // { index, it, ex }

function syncItemFields() {
  const g = (id) => $(id);
  if (g("#itNote")) item.it.note = g("#itNote").value.trim();
  if (g("#itGroup")) item.it.group = g("#itGroup").value.trim();
  if (g("#exName")) item.ex.name = g("#exName").value.trim();
  if (g("#exCat")) item.ex.category = g("#exCat").value;
  if (g("#exBw")) item.ex.bodyweight = g("#exBw").checked;
  if (g("#exSide")) item.ex.perSide = g("#exSide").checked;
  const custom = g("#exStepCustom");
  if (custom && custom.value) { const v = Number(custom.value); if (v > 0) item.ex.step = Math.round(v * 100) / 100; }
}

function itemHTML() {
  const { it, ex } = item;
  const stepper = (f, v) => `<div class="stepper"><button data-action="menu:it-adj" data-f="${f}" data-d="-1" aria-label="減らす">−</button><b class="n">${v}</b><button data-action="menu:it-adj" data-f="${f}" data-d="1" aria-label="増やす">+</button></div>`;
  const customStep = !STEP_CHOICES.includes(ex.step);
  return `<h2>${esc(ex.name || "種目")}</h2>
    <p class="field-label">この Day での目標</p>
    <div class="num-row">
      <div class="num-field"><span>セット数</span>${stepper("sets", it.sets)}</div>
      <div class="num-field"><span>回数${ex.perSide ? "（各側）" : ""}</span>${stepper("reps", it.reps)}</div>
    </div>
    <div class="field"><span>休憩の長さ</span><div class="choice-row">${REST_CHOICES.map((s) => `<button class="${s === it.restSec ? "on" : ""}" data-action="menu:it-rest" data-v="${s}">${restText(s)}</button>`).join("")}</div></div>
    <label class="field"><span>方針メモ（記録の画面に出ます）</span><textarea id="itNote" placeholder="例：あと1〜2回残す">${esc(it.note)}</textarea></label>
    <label class="field"><span>まとめて続けてやる種目の名前</span><input id="itGroup" value="${esc(it.group)}" placeholder="例：同じケーブル台" autocomplete="off"><small>同じ名前を入れた種目どうしは、記録の画面でひとまとめに出ます。</small></label>
    <p class="field-label">種目そのものの設定（この種目を使う、すべての Day で同じです）</p>
    <label class="field"><span>種目名</span><input id="exName" value="${esc(ex.name)}" autocomplete="off"></label>
    <label class="field"><span>部位</span><select id="exCat">${CATEGORIES.map((c) => `<option ${c === ex.category ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    <div class="field"><span>−/+ で増える量</span><div class="choice-row">${STEP_CHOICES.map((s) => `<button class="${s === ex.step ? "on" : ""}" data-action="menu:ex-step" data-v="${s}">${num(s)}kg</button>`).join("")}</div>
      <label class="inline-input"><span>ほかの量</span><input id="exStepCustom" type="number" inputmode="decimal" step="0.25" min="0.25" value="${customStep ? num(ex.step) : ""}" placeholder="例：0.5"><span>kg</span></label></div>
    <label class="check"><input type="checkbox" id="exBw" ${ex.bodyweight ? "checked" : ""}><span>自重の種目（＋で加重、−で補助）</span></label>
    <label class="check"><input type="checkbox" id="exSide" ${ex.perSide ? "checked" : ""}><span>左右を片側ずつやる種目（回数は各側）</span></label>
    <div class="sheet-actions"><button class="btn ghost" data-action="sheet:close">やめる</button><button class="btn primary" data-action="menu:it-save">決定</button></div>`;
}

function refreshItem() {
  syncItemFields();
  updateSheet(itemHTML());
}

function nextLabel(days) {
  const used = new Set(days.map((d) => d.label));
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!used.has(c)) return c;
  return String(days.length + 1);
}

function nextKit(days) {
  const used = new Set(days.map((d) => d.kit));
  return Object.keys(KITS).find((k) => k !== "old" && !used.has(k)) || "a";
}

register({
  "menu:day": (el) => {
    const d = ctx.data.menu.days.find((x) => x.id === el.dataset.id);
    if (d) openDay(d, false);
  },
  "menu:day-add": () => {
    const days = ctx.data.menu.days;
    openDay({ id: `day-${uid().slice(0, 8)}`, label: nextLabel(days), name: "新しいメニュー", kit: nextKit(days), items: [] }, true);
  },
  "menu:day-move": (el) => {
    const days = ctx.data.menu.days;
    const i = Number(el.dataset.i), j = i + Number(el.dataset.d);
    if (j < 0 || j >= days.length) return;
    [days[i], days[j]] = [days[j], days[i]];
    commit();
  },
  "menu:kit": (el) => {
    draft.day.kit = el.dataset.kit;
    refreshDay();
  },
  "menu:item-move": (el) => {
    const items = draft.day.items;
    const i = Number(el.dataset.i), j = i + Number(el.dataset.d);
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    refreshDay();
  },
  "menu:item-del": (el) => {
    draft.day.items.splice(Number(el.dataset.i), 1);
    refreshDay();
  },
  "menu:item-add": () => {
    syncDayFields();
    openPicker({
      title: `${draft.day.label} に種目を足す`,
      exclude: draft.day.items.map((it) => it.exerciseId),
      onChoose: (id) => {
        if (!draft.lib[id]) draft.lib[id] = clone(ctx.data.menu.exercises[id]);
        draft.day.items.push({ exerciseId: id, sets: 3, reps: 10, restSec: 120, note: "", group: "" });
        refreshDay();
      },
    });
  },
  "menu:item": (el) => {
    syncDayFields();
    const index = Number(el.dataset.i);
    const it = draft.day.items[index];
    item = { index, it: clone(it), ex: clone(draft.lib[it.exerciseId]) };
    openSheet(itemHTML(), { className: "tall", onClose: () => { item = null; } });
  },
  "menu:it-adj": (el) => {
    const f = el.dataset.f;
    item.it[f] = Math.max(1, Math.min(f === "sets" ? 10 : 100, item.it[f] + Number(el.dataset.d)));
    refreshItem();
  },
  "menu:it-rest": (el) => { item.it.restSec = Number(el.dataset.v); refreshItem(); },
  "menu:ex-step": (el) => {
    syncItemFields();
    item.ex.step = Number(el.dataset.v);
    const c = $("#exStepCustom");
    if (c) c.value = "";
    updateSheet(itemHTML());
  },
  "menu:it-save": () => {
    syncItemFields();
    if (!item.ex.name) return toast("種目名を入れてください");
    const clash = Object.values(draft.lib).find((e) => e.id !== item.ex.id && normalizeName(e.name) === normalizeName(item.ex.name));
    if (clash) return toast(`「${clash.name}」はもうあります。別の名前にしてください`);
    draft.lib[item.ex.id] = item.ex;
    draft.day.items[item.index] = item.it;
    closeSheet();
    updateSheet(dayHTML());
  },
  "menu:day-save": () => {
    syncDayFields();
    const d = draft.day;
    if (!d.label) return toast("記号を入れてください（例：A）");
    if (!d.name) return toast("名前を入れてください");
    const days = ctx.data.menu.days;
    if (days.some((x) => x.id !== d.id && x.label === d.label)) return toast(`「${d.label}」はもう使っています`);
    Object.entries(draft.lib).forEach(([id, ex]) => { ctx.data.menu.exercises[id] = ex; });
    if (draft.isNew) days.push(d);
    else days[days.findIndex((x) => x.id === d.id)] = d;
    refreshActiveIfUntouched();
    closeSheet();
    commit();
    toast(`${d.label} ${d.name}を保存しました`);
  },
  "menu:day-del": () => {
    const d = draft.day;
    confirmSheet({
      title: `${d.label} ${d.name}を消しますか？`, body: "これまでの記録は消えません。", confirmLabel: "消す", danger: true,
      onConfirm: () => {
        ctx.data.menu.days = ctx.data.menu.days.filter((x) => x.id !== d.id);
        while (sheetCount()) closeSheet();
        ensureActive();
        commit();
        toast("Day を消しました");
      },
    });
  },
});

setRenderer("menu", renderMenu);

