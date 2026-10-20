// 種目を選ぶ画面（今日だけ入れ替える・今日だけ足す・メニューに足す）と、新しい種目を作る画面。

import { ctx, save } from "./app-state.js";
import { register, openSheet, closeSheet, ICON, $, toast } from "./ui.js";
import { recentExerciseIds, normalizeName, findExerciseByName, exerciseInUse } from "./model.js";
import { CATEGORIES, STEP_CHOICES } from "./menu-default.js";
import { esc, num, uid } from "./util.js";

let picker = null;

/** @param {{ title: string, onChoose: (exerciseId: string) => void, exclude?: string[] }} opt */
export function openPicker(opt) {
  picker = { ...opt, query: "" };
  openSheet(pickerHTML(), { className: "tall", onClose: () => { picker = null; } });
}

function row(e) {
  const tags = [e.category, e.bodyweight ? "自重" : "", e.perSide ? "各側" : "", exerciseInUse(ctx.data, e.id) ? "" : "メニュー外"].filter(Boolean);
  return `<button class="pick-row" data-action="pick:choose" data-id="${esc(e.id)}"><b>${esc(e.name)}</b><em>${tags.map(esc).join("　")}</em>${ICON.chevR}</button>`;
}

function listHTML() {
  const all = Object.values(ctx.data.menu.exercises).filter((e) => !(picker.exclude || []).includes(e.id));
  const q = normalizeName(picker.query);
  if (q) {
    const hits = all.filter((e) => normalizeName(e.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name, "ja"));
    return hits.length ? hits.map(row).join("") : `<p class="empty">「${esc(picker.query)}」に合う種目はありません。下のボタンから作れます。</p>`;
  }
  const recent = recentExerciseIds(ctx.data).map((id) => ctx.data.menu.exercises[id]).filter((e) => e && all.includes(e));
  const rest = all.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return `${recent.length ? `<p class="pick-head">最近やった種目</p>${recent.map(row).join("")}` : ""}<p class="pick-head">すべての種目</p>${rest.map(row).join("")}`;
}

function pickerHTML() {
  return `<h2>${esc(picker.title)}</h2>
    <label class="search">${ICON.search}<input type="search" placeholder="種目名で探す" value="${esc(picker.query)}" data-input="pick:search" autocomplete="off"></label>
    <div class="pick-list" id="pickList">${listHTML()}</div>
    <button class="btn ghost wide" data-action="pick:new">${ICON.plus}新しい種目を作る</button>`;
}

function newExerciseHTML(name = "") {
  return `<h2>新しい種目を作る</h2>
    <label class="field"><span>種目名</span><input id="neName" value="${esc(name)}" placeholder="例：ケーブルクロスオーバー" autocomplete="off"></label>
    <label class="field"><span>部位</span><select id="neCat">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select></label>
    <label class="field"><span>−/+ で増える量</span><select id="neStep">${STEP_CHOICES.map((s) => `<option value="${s}" ${s === 2.5 ? "selected" : ""}>${num(s)}kg</option>`).join("")}</select></label>
    <label class="check"><input type="checkbox" id="neBw"><span>自重の種目（チンニングなど）</span></label>
    <label class="check"><input type="checkbox" id="neSide"><span>左右を片側ずつやる種目（回数は各側）</span></label>
    <div class="sheet-actions"><button class="btn ghost" data-action="sheet:close">やめる</button><button class="btn primary" data-action="pick:create">作る</button></div>`;
}

register({
  "pick:search": (el) => {
    if (!picker) return;
    picker.query = el.value;
    const list = $("#pickList");
    if (list) list.innerHTML = listHTML();
  },
  "pick:choose": (el) => {
    if (!picker) return;
    const fn = picker.onChoose;
    closeSheet();
    fn(el.dataset.id);
  },
  "pick:new": () => {
    openSheet(newExerciseHTML(picker ? picker.query : ""));
  },
  "pick:create": () => {
    const name = $("#neName").value.trim();
    if (!name) return toast("種目名を入れてください");
    const existing = findExerciseByName(ctx.data, name);
    let id;
    if (existing) {
      id = existing.id;
      toast(`「${existing.name}」はもうあるので、それを使います`);
    } else {
      id = `ex-${uid().slice(0, 8)}`;
      ctx.data.menu.exercises[id] = {
        id, name, category: $("#neCat").value, step: Number($("#neStep").value),
        bodyweight: $("#neBw").checked, perSide: $("#neSide").checked,
      };
      save();
    }
    closeSheet();
    if (picker) {
      const fn = picker.onChoose;
      closeSheet();
      fn(id);
    }
  },
});
