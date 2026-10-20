// 起動。保存した記録を読み、画面と時計と画面の点灯を動かす。

import { ctx, go } from "./app-state.js";
import { loadData } from "./store.js";
import { initEvents, register, toast, closeAllSheets } from "./ui.js";
import { hasProgress } from "./model.js";
import { ensureActive, tickRecord, renderRecord } from "./screens/record.js";
import "./screens/history.js";
import "./screens/progress.js";
import "./screens/menu.js";
import "./screens/settings.js";
import { VERSION } from "./version.js";

/* ---------- 画面を点けたままにする（記録中だけ） ---------- */

let wakeLock = null;

async function updateWakeLock() {
  const a = ctx.data && ctx.data.active;
  const want = ctx.screen === "record" && document.visibilityState === "visible" && !!a && (!!a.startedAt || hasProgress(a));
  if (want && !wakeLock && "wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch {
      wakeLock = null;
    }
  } else if (!want && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

/* ---------- 起動 ---------- */

let staleAskedFor = null;

function checkActive() {
  const a = ctx.data.active;
  const ask = !!a && staleAskedFor !== a.id;
  if (ask) staleAskedFor = a.id;
  ensureActive({ promptStale: ask });
}

function boot() {
  const { data, migrated } = loadData();
  ctx.data = data;
  ctx.migrated = migrated;
  initEvents();
  register({
    "go:tab": (el) => { closeAllSheets(); go(el.dataset.tab); },
    "go:settings": () => { closeAllSheets(); go("settings"); },
    "go:back": () => { closeAllSheets(); go(ctx.backTo && ctx.backTo !== "settings" ? ctx.backTo : "record"); },
  });
  ctx.hooks.afterGo.push(() => updateWakeLock());
  checkActive();
  go("record");
  setInterval(tickRecord, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkActive();
      if (ctx.screen === "record") renderRecord();
      tickRecord();
    }
    updateWakeLock();
  });
  if (migrated && migrated.count) toast(`前のアプリの記録を${migrated.count}回分引き継ぎました`, { duration: 6000 });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  window.__workoutLog = { ctx, VERSION };
}

boot();
