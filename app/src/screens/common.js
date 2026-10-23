// 明るい画面（履歴・進捗・メニュー・設定）で共通の部品。

import { ctx, kitOf } from "../app-state.js";
import { ICON, openSheet, register, toast } from "../ui.js";
import { exerciseHistory, bestEver, prFlagsForSession, validSet } from "../model.js";
import { esc, dateShort, weekdayOf } from "../util.js";
import { setText } from "../export.js";

export function pageHeader(title, { back = false, settings = true } = {}) {
  return `<header class="page-head">
    ${back ? `<button class="icon-btn" data-action="go:back" aria-label="戻る">${ICON.chevL}</button>` : ""}
    <h1>${esc(title)}</h1>
    ${settings ? `<button class="icon-btn" data-action="go:settings" aria-label="設定">${ICON.settings}</button>` : ""}
  </header>`;
}

export function dayBadge(session) {
  const k = kitOf(session.kit || "old");
  const label = session.dayLabel || "—";
  return `<span class="badge n${label.length > 2 ? " small" : ""}" style="background:${k.color}">${esc(label.length > 4 ? label.slice(0, 4) : label)}</span>`;
}

export function setsText(entry, flags = []) {
  return entry.sets.filter(validSet).map((s, i) => `<span class="set-chip${flags[i] ? " pr" : ""}">${esc(setText(entry, s))}</span>`).join("");
}

/** 種目ごとの過去の記録（新しい順） */
export function openExerciseSheet(exerciseId) {
  const ex = ctx.data.menu.exercises[exerciseId];
  if (!ex) return;
  const hist = exerciseHistory(ctx.data, exerciseId).reverse();
  const best = bestEver(ctx.data, exerciseId);
  const bestWhen = best ? hist.find(({ entry }) => entry.sets.includes(best)) : null;
  const rows = hist.map(({ session, entry }) => {
    const flags = prFlagsForSession(ctx.data, session)[session.entries.indexOf(entry)] || [];
    return `<div class="hist-row"><div class="hist-date"><b class="n">${dateShort(session.date)}</b><span>${weekdayOf(session.date)}</span></div>
      <div class="hist-main">${dayBadge(session)}<div class="chips">${setsText(entry, flags)}</div>${entry.memo ? `<p class="hist-memo">${esc(entry.memo)}</p>` : ""}</div></div>`;
  }).join("");
  openSheet(`<h2>${esc(ex.name)}</h2>
    <p class="sub">${hist.length}回の記録${best && bestWhen ? `　自己ベスト ${esc(setText(ex, best))}（${dateShort(bestWhen.session.date)}）` : ""}</p>
    ${rows || '<p class="empty">まだ記録がありません。</p>'}`, { className: "tall" });
}

register({
  "chart:tip": (el) => toast(el.dataset.tip, { duration: 2500 }),
  "ex:history": (el) => openExerciseSheet(el.dataset.id),
});
