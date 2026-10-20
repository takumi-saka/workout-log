// 設定の画面。書き出し（CSV・LLM 用のまとめ）、バックアップ、保存の状態、全部消す。

import { ctx, setRenderer, commit } from "../app-state.js";
import { register, $, ICON, openSheet, closeSheet, toast, confirmSheet, downloadFile, copyText, bridge } from "../ui.js";
import { ensureActive } from "./record.js";
import { filterSessions, toCSV, toLLMText } from "../export.js";
import { backupText, dataFromBackup, defaultData } from "../store.js";
import { sortedSessions } from "../model.js";
import { esc, todayISO, dateJP, addDays } from "../util.js";
import { VERSION } from "../version.js";
import { pageHeader } from "./common.js";

function renderSettings() {
  const s = ctx.data.settings;
  const n = ctx.data.sessions.length;
  const last = s.lastBackupAt ? `${dateJP(todayISO(new Date(s.lastBackupAt)))}` : "まだありません";
  $("#screen-settings .scroller").innerHTML = `${pageHeader("設定", { back: true, settings: false })}
  <div class="page">
    <p class="sec-title">書き出し</p>
    <div class="card list-card">
      <button class="act" data-action="set:export" data-kind="csv">${ICON.download}<span><b>CSV を書き出す</b><em>Excel やスプレッドシートで開けます</em></span></button>
      <button class="act" data-action="set:export" data-kind="llm">${ICON.copy}<span><b>LLM 用のまとめをコピー</b><em>ChatGPT や Claude に貼って相談できます</em></span></button>
    </div>
    <p class="sec-title">バックアップ</p>
    <div class="card list-card">
      <p class="card-note">記録はこのスマホの中にだけあります。スマホを替えるときのためにも、ときどき書き出してください。<br>最後のバックアップ：<b>${last}</b></p>
      <button class="act" data-action="set:share">${ICON.share}<span><b>共有して保存する</b><em>Google ドライブなどに送れます</em></span></button>
      <button class="act" data-action="set:download">${ICON.download}<span><b>ファイルに書き出す</b><em>スマホの「ダウンロード」に保存します</em></span></button>
      <label class="act file-act">${ICON.upload}<span><b>バックアップから戻す</b><em>今の記録とメニューは、戻したファイルの中身に置き換わります</em></span><input type="file" accept="application/json,.json" data-change="set:restore"></label>
    </div>
    <p class="sec-title">このアプリについて</p>
    <div class="card list-card">
      <p class="card-note">保存している記録：<b>${n}回分</b>${s.migratedCount ? `（うち前のアプリから引き継いだもの ${s.migratedCount}回分）` : ""}<br>
      ブラウザに消されないための保護：<b id="persistState">確かめています</b><br>
      版：${VERSION}</p>
    </div>
    <p class="sec-title">危ない操作</p>
    <div class="card list-card">
      <button class="act danger" data-action="set:reset">${ICON.trash}<span><b>すべての記録とメニューを消す</b><em>消したものは戻せません</em></span></button>
    </div>
  </div>`;
  const el = $("#persistState");
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then((v) => { el.textContent = v ? "保護されています" : "まだです（記録を保存すると頼みます）"; }).catch(() => { el.textContent = "分かりませんでした"; });
  } else el.textContent = "このブラウザでは使えません";
}

/* ---------- 書き出しの条件 ---------- */

let filter = null;

function presetRange(k) {
  const t = todayISO();
  if (k === "this") return [`${t.slice(0, 7)}-01`, t];
  if (k === "prev") {
    const d = new Date(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 2, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return [todayISO(d), todayISO(end)];
  }
  if (k === "3m") return [addDays(t, -91), t];
  return ["", ""];
}

function readFilter() {
  return { from: $("#fFrom").value, to: $("#fTo").value, dayId: $("#fDay").value, exerciseId: $("#fEx").value };
}

function countText() {
  const n = filterSessions(ctx.data, readFilter()).length;
  return n ? `${n}回分が対象です。` : "この条件に合う記録はありません。";
}

function filterHTML(kind) {
  const sessions = sortedSessions(ctx.data);
  const dayOpts = new Map();
  sessions.forEach((s) => dayOpts.set(s.dayId, `${s.dayLabel} ${s.dayName}`.trim()));
  ctx.data.menu.days.forEach((d) => { if (!dayOpts.has(d.id)) dayOpts.set(d.id, `${d.label} ${d.name}`); });
  const exIds = new Set(sessions.flatMap((s) => s.entries.filter((e) => !e.skipped).map((e) => e.exerciseId)));
  const exOpts = [...exIds].map((id) => ctx.data.menu.exercises[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return `<h2>${kind === "csv" ? "CSV を書き出す" : "LLM 用のまとめをコピー"}</h2>
    <div class="field"><span>期間</span><div class="choice-row">
      <button data-action="set:preset" data-k="this">今月</button><button data-action="set:preset" data-k="prev">先月</button>
      <button data-action="set:preset" data-k="3m">直近3か月</button><button class="on" data-action="set:preset" data-k="all">全部</button></div></div>
    <div class="field-row">
      <label class="field"><span>開始日</span><input type="date" id="fFrom" data-change="set:fchange"></label>
      <label class="field"><span>終了日</span><input type="date" id="fTo" data-change="set:fchange"></label>
    </div>
    <label class="field"><span>Day</span><select id="fDay" data-change="set:fchange"><option value="">すべて</option>${[...dayOpts].map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join("")}</select></label>
    <label class="field"><span>種目</span><select id="fEx" data-change="set:fchange"><option value="">すべて</option>${exOpts.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label>
    <p class="sheet-text" id="fCount"></p>
    <button class="btn primary wide" data-action="set:run" data-kind="${kind}">${kind === "csv" ? "書き出す" : "コピーする"}</button>`;
}

/* ---------- バックアップ ---------- */

function backupName() {
  return `workout-log-backup-${todayISO()}.json`;
}

function markBackup() {
  ctx.data.settings.lastBackupAt = new Date().toISOString();
  commit();
}

register({
  "set:export": (el) => {
    filter = el.dataset.kind;
    openSheet(filterHTML(filter), { className: "tall", onClose: () => { filter = null; } });
    $("#fCount").textContent = countText();
  },
  "set:preset": (el) => {
    const [from, to] = presetRange(el.dataset.k);
    $("#fFrom").value = from;
    $("#fTo").value = to;
    el.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el));
    $("#fCount").textContent = countText();
  },
  "set:fchange": () => { $("#fCount").textContent = countText(); },
  "set:run": async (el) => {
    const f = readFilter();
    const sessions = filterSessions(ctx.data, f);
    if (!sessions.length) return toast("この条件に合う記録はありません");
    if (el.dataset.kind === "csv") {
      const where = downloadFile(`workout-log-${todayISO()}.csv`, toCSV(ctx.data, sessions), "text/csv;charset=utf-8");
      closeSheet();
      return toast(where === "app" ? "保存先を選んでください" : `CSV を書き出しました（${sessions.length}回分）`);
    }
    const text = toLLMText(ctx.data, sessions);
    if (await copyText(text)) {
      closeSheet();
      return toast(`コピーしました（${sessions.length}回分）。LLM に貼り付けてください`);
    }
    openSheet(`<h2>コピーできませんでした</h2><p class="sheet-text">下の文字を長押しして、全部選んでコピーしてください。</p><textarea class="copy-box" readonly>${esc(text)}</textarea>`);
  },
  "set:share": async () => {
    const text = backupText(ctx.data);
    if (bridge) {
      downloadFile(backupName(), text, "application/json");
      markBackup();
      return toast("保存先を選んでください（Google ドライブも選べます）");
    }
    const file = new File([text], backupName(), { type: "application/json" });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "筋トレログのバックアップ" });
        markBackup();
        return toast("バックアップを送りました");
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    downloadFile(backupName(), text, "application/json");
    markBackup();
    toast("共有できなかったので、ファイルに書き出しました");
  },
  "set:download": () => {
    const where = downloadFile(backupName(), backupText(ctx.data), "application/json");
    markBackup();
    toast(where === "app" ? "保存先を選んでください" : "バックアップを書き出しました");
  },
  "set:restore": (el) => {
    const file = el.files && el.files[0];
    el.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let obj;
      try { obj = JSON.parse(reader.result); } catch { return toast("このファイルは読めませんでした"); }
      const r = dataFromBackup(obj, ctx.data);
      if (!r) return toast("筋トレログのバックアップではないようです");
      confirmSheet({
        title: "このバックアップで置き換えますか？",
        body: `バックアップの記録：${r.data.sessions.length}回分${r.kind === "v1" ? "（前のアプリのバックアップなので、メニューは今のままにします）" : ""}<br>今の記録：${ctx.data.sessions.length}回分（消えます）`,
        confirmLabel: "置き換える", danger: true,
        onConfirm: () => {
          ctx.data = r.data;
          ensureActive();
          commit();
          toast("バックアップから戻しました");
        },
      });
    };
    reader.readAsText(file);
  },
  "set:reset": () => {
    confirmSheet({
      title: "すべての記録とメニューを消しますか？", body: `記録 ${ctx.data.sessions.length}回分と、直したメニューが消えます。先にバックアップを書き出しておくと安心です。`,
      confirmLabel: "消す", danger: true,
      onConfirm: () => confirmSheet({
        title: "本当に消しますか？", body: "消したものは戻せません。", confirmLabel: "すべて消す", danger: true,
        onConfirm: () => {
          ctx.data = defaultData();
          ensureActive();
          commit();
          toast("すべて消しました");
        },
      }),
    });
  },
});

setRenderer("settings", renderSettings);
