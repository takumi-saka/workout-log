// アプリ全体で持つ状態と、保存・画面の切り替え。

import { saveData } from "./store.js";
import { toast, $$ } from "./ui.js";
import { KITS } from "./menu-default.js";

export const ctx = {
  data: null,
  screen: "record",
  backTo: "record",
  migrated: null,
  renderers: {},
  /** 画面ごとの一時的な状態（選んでいる月や Day など） */
  view: {},
  hooks: { afterGo: [] },
};

export function setRenderer(screen, fn) {
  ctx.renderers[screen] = fn;
}

export function save() {
  try {
    saveData(ctx.data);
    return true;
  } catch {
    toast("保存できませんでした。スマホの空き容量を確かめてください");
    return false;
  }
}

/** 保存して、今の画面を描き直す */
export function commit({ render = true } = {}) {
  save();
  if (render) renderCurrent();
}

export function renderCurrent() {
  const r = ctx.renderers[ctx.screen];
  if (r) r();
}

export function go(screen) {
  if (screen === "settings" && ctx.screen !== "settings") ctx.backTo = ctx.screen;
  ctx.screen = screen;
  $$(".screen").forEach((el) => el.classList.toggle("active", el.dataset.screen === screen));
  $$(".tabs [data-tab]").forEach((el) => el.classList.toggle("is-active", el.dataset.tab === screen));
  renderCurrent();
  setThemeColor();
  ctx.hooks.afterGo.forEach((fn) => fn(screen));
}

/** スマホの上の帯の色を、記録の画面では Day の色、ほかの画面では明るい色にする */
export function setThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  let color = "#f2f4f9";
  if (ctx.screen === "record" && ctx.data && ctx.data.active) {
    const day = ctx.data.menu.days.find((d) => d.id === ctx.data.active.dayId);
    color = (KITS[day ? day.kit : "a"] || KITS.a).color;
  }
  meta.setAttribute("content", color);
  if (globalThis.AndroidBridge) {
    try { globalThis.AndroidBridge.setStatusBarColor(color === "#f2f4f9" ? "#101734" : color); } catch { /* 何もしない */ }
  }
}

export function dayOf(dayId) {
  return ctx.data.menu.days.find((d) => d.id === dayId) || null;
}

export function kitOf(kitKey) {
  return KITS[kitKey] || KITS.old;
}
