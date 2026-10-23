// CSV と、LLM に貼るためのまとめ。

import { sortedSessions, prFlagsForSession } from "./model.js";
import { dateJP, hhmm, minutesBetween, num } from "./util.js";

/** 期間・Day・種目で記録を絞る。種目を選んだときは、その種目の行だけを残す。 */
export function filterSessions(data, { from = "", to = "", dayId = "", exerciseId = "" } = {}) {
  return sortedSessions(data)
    .filter((s) => (!from || s.date >= from) && (!to || s.date <= to) && (!dayId || s.dayId === dayId))
    .map((s) => (exerciseId ? { ...s, entries: s.entries.filter((e) => e.exerciseId === exerciseId) } : s))
    .filter((s) => s.entries.length > 0);
}

function loadType(e, w) {
  if (!e.bodyweight) return "";
  if (w === 0) return "自重";
  return w > 0 ? "加重" : "補助";
}

export function weightLabel(e, w) {
  if (w === null || w === undefined) return "-";
  if (!e.bodyweight) return `${num(w)}kg`;
  if (w === 0) return "自重";
  return w > 0 ? `自重＋${num(w)}kg` : `補助${num(-w)}kg`;
}

/** 1セットの書き方。片手ずつの種目は、左右が同じなら「各側10」、違えば「右10・左9」。 */
export function setText(e, s) {
  if (!e.perSide) return `${weightLabel(e, s.weight)}×${s.reps}`;
  const wL = s.weightL ?? s.weight;
  const rL = s.repsL ?? s.reps;
  if (wL === s.weight && rL === s.reps) return `${weightLabel(e, s.weight)}×各側${s.reps}`;
  if (wL === s.weight) return `${weightLabel(e, s.weight)}×右${s.reps}・左${rL}`;
  return `右${weightLabel(e, s.weight)}×${s.reps}・左${weightLabel(e, wL)}×${rL}`;
}

function cell(v) {
  const t = String(v ?? "");
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const CSV_HEAD = ["date", "day", "exercise", "category", "set", "weight_kg", "load_type", "reps", "weight_left_kg", "reps_left", "per_side", "substitute_for", "skipped", "exercise_memo", "pump", "effort", "fatigue", "started_at", "ended_at", "minutes", "session_memo"];

/** Excel で開いても文字化けしないよう、先頭に BOM を付ける */
export function toCSV(data, sessions) {
  const rows = [CSV_HEAD];
  for (const s of sessions) {
    const day = `${s.dayLabel} ${s.dayName}`.trim();
    const minutes = s.startedAt && s.endedAt ? minutesBetween(s.startedAt, s.endedAt) : "";
    const base = (e) => [s.date, day, e.name, e.category];
    const tail = (e) => [e.memo || "", s.ratings?.pump ?? "", s.ratings?.effort ?? "", s.ratings?.fatigue ?? "", s.startedAt || "", s.endedAt || "", minutes, s.memo || ""];
    for (const e of s.entries) {
      const sub = e.substituteFor ? data.menu.exercises[e.substituteFor]?.name || e.substituteFor : "";
      if (e.skipped || !e.sets.length) {
        rows.push([...base(e), "", "", "", "", "", "", e.perSide ? "true" : "false", sub, "true", ...tail(e)]);
        continue;
      }
      e.sets.forEach((x, i) => rows.push([...base(e), i + 1, x.weight ?? "", loadType(e, x.weight), x.reps ?? "",
        e.perSide ? (x.weightL ?? x.weight ?? "") : "", e.perSide ? (x.repsL ?? x.reps ?? "") : "", e.perSide ? "true" : "false", sub, "false", ...tail(e)]));
    }
  }
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

function rating(v) {
  return v === null || v === undefined ? "未入力" : String(v);
}

/** LLM に貼るまとめ（自然な日本語の箇条書き） */
export function toLLMText(data, sessions, { title = "筋トレの記録" } = {}) {
  if (!sessions.length) return `# ${title}\n\n該当する記録はありません。`;
  const first = sessions[0].date, last = sessions[sessions.length - 1].date;
  const lines = [`# ${title}（${first}〜${last}、${sessions.length}回分）`, ""];
  lines.push("重さの「自重＋10kg」は加重、「補助10kg」はアシストを表す。「各側」は片側ずつの回数で、左右で違うときは「右10・左9」のように書く。", "");
  for (const s of sessions) {
    const full = data.sessions.find((x) => x.id === s.id) || s;
    const flags = prFlagsForSession(data, full);
    const time = s.startedAt && s.endedAt ? `　${minutesBetween(s.startedAt, s.endedAt)}分（${hhmm(s.startedAt)}〜${hhmm(s.endedAt)}）` : "";
    lines.push(`## ${dateJP(s.date)} ${`${s.dayLabel} ${s.dayName}`.trim()}${time}`);
    lines.push(`評価：パンプ ${rating(s.ratings?.pump)}／出し切り感 ${rating(s.ratings?.effort)}／疲労感 ${rating(s.ratings?.fatigue)}`);
    for (const e of s.entries) {
      const target = e.targetSets && e.targetReps ? `（目標 ${e.perSide ? "各側" : ""}${e.targetReps}回×${e.targetSets}）` : "";
      const sub = e.substituteFor ? `［${data.menu.exercises[e.substituteFor]?.name || "元の種目"}の代わり］` : e.added ? "［この日だけ追加］" : "";
      if (e.skipped || !e.sets.length) { lines.push(`- ${e.name}${sub}：スキップ`); continue; }
      const fi = full.entries.indexOf(e);
      const sets = e.sets.map((x, i) => `${setText(e, x)}${fi >= 0 && flags[fi] && flags[fi][i] ? "（自己ベスト）" : ""}`).join("、");
      lines.push(`- ${e.name}${target}${sub}：${sets}`);
      if (e.memo) lines.push(`  メモ：${e.memo}`);
    }
    if (s.memo) lines.push(`全体メモ：${s.memo}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}
