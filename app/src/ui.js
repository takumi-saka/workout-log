// 画面の共通部品: 押したときの振り分け、下から出る画面、お知らせの帯、数字キー、確認。

import { esc, num } from "./util.js";

/* ---------- 押したときの振り分け ---------- */

const ACTIONS = {};

/** data-action / data-input / data-change に書いた名前と、動かす関数を結びつける */
export function register(map) {
  Object.assign(ACTIONS, map);
}

export function initEvents() {
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    ev.preventDefault();
    fn(el, ev);
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-input]");
    if (el && ACTIONS[el.dataset.input]) ACTIONS[el.dataset.input](el, ev);
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-change]");
    if (el && ACTIONS[el.dataset.change]) ACTIONS[el.dataset.change](el, ev);
  });
}

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export const ICON = {
  check: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  chevD: '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  chevR: '<svg class="i" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  chevL: '<svg class="i" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  up: '<svg class="i" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  close: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  more: '<svg class="i" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  clock: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  play: '<svg class="i" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></svg>',
  calendar: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  settings: '<svg class="i" viewBox="0 0 24 24"><path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.4"/><circle cx="10" cy="12" r="2.4"/><circle cx="18" cy="18" r="2.4"/></svg>',
  flag: '<svg class="i" viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  memo: '<svg class="i" viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/></svg>',
  plus: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  swap: '<svg class="i" viewBox="0 0 24 24"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg>',
  skip: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l6 6-6 6M13 6l6 6-6 6"/></svg>',
  back: '<svg class="i" viewBox="0 0 24 24"><path d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-2"/></svg>',
  trash: '<svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  cable: '<svg class="i" viewBox="0 0 24 24"><path d="M6 3v18M18 3v18M6 6h12M12 6v8"/><circle cx="12" cy="16" r="2"/></svg>',
  search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  download: '<svg class="i" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  share: '<svg class="i" viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>',
  copy: '<svg class="i" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  upload: '<svg class="i" viewBox="0 0 24 24"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>',
  shield: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z"/></svg>',
  tabRecord: '<svg class="i" viewBox="0 0 24 24"><path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/></svg>',
  tabHistory: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/></svg>',
  tabProgress: '<svg class="i" viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/></svg>',
  tabMenu: '<svg class="i" viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
};

/* ---------- 下から出る画面（重ねて開ける） ---------- */

const stack = [];

export function openSheet(html, { onClose, className = "" } = {}) {
  const layer = $("#layer");
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `<div class="sheet ${className}" role="dialog" aria-modal="true"><div class="handle"></div><div class="sheet-body">${html}</div></div>`;
  wrap.addEventListener("click", (ev) => { if (ev.target === wrap) closeSheet(); });
  layer.append(wrap);
  stack.push({ wrap, onClose });
  requestAnimationFrame(() => wrap.classList.add("open"));
  return wrap.querySelector(".sheet-body");
}

export function updateSheet(html) {
  const top = stack[stack.length - 1];
  if (!top) return null;
  const body = top.wrap.querySelector(".sheet-body");
  body.innerHTML = html;
  return body;
}

export function topSheet() {
  const top = stack[stack.length - 1];
  return top ? top.wrap.querySelector(".sheet-body") : null;
}

export function closeSheet() {
  const top = stack.pop();
  if (!top) return;
  top.wrap.classList.remove("open");
  setTimeout(() => top.wrap.remove(), 250);
  if (top.onClose) top.onClose();
}

export function closeAllSheets() {
  while (stack.length) closeSheet();
}

export function sheetCount() {
  return stack.length;
}

/* ---------- お知らせの帯 ---------- */

let toastTimer = null;
let toastAction = null;

export function toast(text, { actionLabel = "", onAction = null, duration = 4000 } = {}) {
  const el = $("#toast");
  el.querySelector(".toast-text").textContent = text;
  const btn = el.querySelector(".toast-btn");
  btn.hidden = !actionLabel;
  btn.textContent = actionLabel;
  toastAction = onAction;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, duration);
}

export function hideToast() {
  $("#toast").classList.remove("show");
  toastAction = null;
}

register({
  "toast:action": () => { const fn = toastAction; hideToast(); if (fn) fn(); },
  "sheet:close": () => closeSheet(),
});

/* ---------- 確認 ---------- */

export function confirmSheet({ title, body = "", confirmLabel = "OK", danger = false, cancelLabel = "やめる", onConfirm }) {
  const id = `c${Date.now()}`;
  register({ [`confirm:${id}`]: () => { closeSheet(); onConfirm(); } });
  openSheet(`<h2>${esc(title)}</h2>${body ? `<p class="sheet-text">${body}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn ghost" data-action="sheet:close">${esc(cancelLabel)}</button>
      <button class="btn ${danger ? "danger" : "primary"}" data-action="confirm:${id}">${esc(confirmLabel)}</button>
    </div>`);
}

/* ---------- 数字キー ---------- */

let pad = null;

function padDisplay() {
  const { buf, mode, bodyweight, unit } = pad;
  if (bodyweight && (buf === "" || Number(buf) === 0)) return '<span class="pad-jp">自重</span>';
  const shown = buf === "" ? "0" : buf;
  const prefix = bodyweight ? `<small>${mode === "assist" ? "補助" : "加重"}</small>` : "";
  return `${prefix}<span class="pad-num">${esc(shown)}</span><small>${esc(unit)}</small>`;
}

function padHTML() {
  const { title, integer, step, bodyweight, mode, hint } = pad;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", integer ? "" : ".", "0", "del"];
  return `<h2>${esc(title)}</h2>
    ${bodyweight ? `<div class="seg pad-seg"><button class="${mode === "add" ? "on" : ""}" data-action="pad:mode" data-mode="add">加重</button><button class="${mode === "assist" ? "on" : ""}" data-action="pad:mode" data-mode="assist">補助</button></div>` : ""}
    <div class="pad-value" id="padValue">${padDisplay()}</div>
    ${hint ? `<p class="pad-hint">${esc(hint)}</p>` : ""}
    <div class="pad-steps"><button data-action="pad:step" data-d="-1">−${num(step)}</button><button data-action="pad:step" data-d="1">+${num(step)}</button></div>
    <div class="pad-keys">${keys.map((k) => k === "" ? "<span></span>" : `<button data-action="pad:key" data-k="${k}" aria-label="${k === "del" ? "1文字消す" : k}">${k === "del" ? '<svg class="i" viewBox="0 0 24 24"><path d="M9 6h11v12H9l-6-6z"/><path d="M12 10l4 4M16 10l-4 4"/></svg>' : k}</button>`).join("")}</div>
    <button class="btn primary wide" data-action="pad:done">決定</button>`;
}

function refreshPad() {
  const el = $("#padValue");
  if (el) el.innerHTML = padDisplay();
}

/**
 * 数字キーを開く。
 * @param {{ title: string, value: number|null, unit?: string, step?: number, integer?: boolean, bodyweight?: boolean, hint?: string, onDone: (v:number)=>void }} opt
 */
export function openKeypad(opt) {
  const v = opt.value;
  pad = {
    title: opt.title,
    unit: opt.unit || "",
    step: opt.step || 1,
    integer: !!opt.integer,
    bodyweight: !!opt.bodyweight,
    hint: opt.hint || "",
    mode: v !== null && v < 0 ? "assist" : "add",
    buf: v === null || v === undefined ? "" : num(Math.abs(v)),
    fresh: true,
    onDone: opt.onDone,
  };
  openSheet(padHTML(), { className: "pad-sheet", onClose: () => { pad = null; } });
}

register({
  "pad:key": (el) => {
    if (!pad) return;
    const k = el.dataset.k;
    if (k === "del") { pad.buf = pad.fresh ? "" : pad.buf.slice(0, -1); pad.fresh = false; return refreshPad(); }
    if (pad.fresh) { pad.buf = ""; pad.fresh = false; }
    if (k === ".") {
      if (pad.integer || pad.buf.includes(".")) return;
      pad.buf = (pad.buf || "0") + ".";
    } else {
      const [, dec] = pad.buf.split(".");
      if (dec !== undefined && dec.length >= 2) return;
      if (pad.buf.replace(".", "").length >= 5) return;
      pad.buf = pad.buf === "0" ? k : pad.buf + k;
    }
    refreshPad();
  },
  "pad:step": (el) => {
    if (!pad) return;
    const d = Number(el.dataset.d);
    let signed = Number(pad.buf || 0) * (pad.mode === "assist" ? -1 : 1);
    signed = Math.round((signed + d * pad.step) * 100) / 100;
    if (!pad.bodyweight) signed = Math.max(pad.integer ? 1 : 0, signed);
    pad.mode = signed < 0 ? "assist" : "add";
    pad.buf = num(Math.abs(signed));
    pad.fresh = false;
    if (pad.bodyweight) updateSheet(padHTML()); else refreshPad();
  },
  "pad:mode": (el) => {
    if (!pad) return;
    pad.mode = el.dataset.mode;
    pad.fresh = false;
    updateSheet(padHTML());
  },
  "pad:done": () => {
    if (!pad) return;
    let v = Number(pad.buf || 0);
    if (!Number.isFinite(v)) return;
    if (pad.integer) v = Math.round(v);
    if (pad.integer && v < 1) return toast("1以上の数を入れてください");
    if (pad.bodyweight && pad.mode === "assist") v = -v;
    const done = pad.onDone;
    closeSheet();
    done(Math.round(v * 100) / 100);
  },
});

/* ---------- 端末の機能 ---------- */

/** スマホのアプリ（APK）の中で開いているときだけある窓口 */
export const bridge = globalThis.AndroidBridge || null;

export function vibrate(pattern) {
  try {
    if (bridge) {
      const list = Array.isArray(pattern) ? pattern : [pattern];
      bridge.vibrate(list.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0));
      return;
    }
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* 振動できない端末は何もしない */ }
}

/** ファイルに書き出す。アプリの中では保存先を選ぶ画面を出す（Google ドライブも選べる）。 */
export function downloadFile(name, text, type) {
  if (bridge) {
    bridge.saveFile(name, type.split(";")[0], text);
    return "app";
  }
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "web";
}

globalThis.__onAndroidSaved = (ok) => toast(ok ? "保存しました" : "保存しませんでした");

export async function copyText(text) {
  if (bridge) {
    try { bridge.copyText(text); return true; } catch { return false; }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
