// 計算まわりのテスト。実行: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultData, loadData, saveData, KEY, V1_KEY, dataFromBackup } from "../app/src/store.js";
import {
  newActive, completeCurrentSet, currentEntry, activeSetIndex, finishActive, nextDayId, prFlagsForActive,
  activeSummary, exerciseSeries, dayTotalSeries, setWeight, prFlagsForSession, entryStatus, allFinished, activeTotals,
} from "../app/src/model.js";
import { migrateV1 } from "../app/src/migrate.js";
import { toCSV, toLLMText, filterSessions } from "../app/src/export.js";

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

/** 記録中のワークアウトを、指定した重さ・回数で全部やって保存する */
function doWorkout(data, dayId, date, plan, startHour = 18) {
  const a = newActive(data, dayId, date);
  let t = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00`);
  for (const e of a.entries) {
    const p = plan[e.exerciseId];
    if (p === "skip") { e.skipped = true; continue; }
    a.currentKey = e.key;
    e.sets.forEach((s, i) => {
      if (p && p[i]) { s.weight = p[i][0]; s.reps = p[i][1]; }
    });
    while (activeSetIndex(currentEntry(a)) >= 0 && currentEntry(a).key === e.key) {
      t = new Date(t.getTime() + 60000);
      const r = completeCurrentSet(data, a, t);
      if (r && r.needsWeight) currentEntry(a).sets[activeSetIndex(currentEntry(a))].weight = 20;
    }
  }
  const s = finishActive(data, a, { startedAt: a.startedAt, endedAt: t.toISOString(), ratings: { pump: 7, effort: null, fatigue: 4 }, memo: "テスト" });
  data.sessions.push(s);
  return s;
}

test("最初のメニューは A・B・C で、種目数とセット数が渡されたメニューどおり", () => {
  const d = defaultData();
  assert.deepEqual(d.menu.days.map((x) => x.label), ["A", "B", "C"]);
  assert.deepEqual(d.menu.days.map((x) => x.items.length), [5, 5, 6]);
  const sets = d.menu.days.map((x) => x.items.reduce((n, it) => n + it.sets, 0));
  assert.deepEqual(sets, [12, 11, 13]);
  const c = d.menu.days[2];
  assert.equal(c.items.filter((it) => it.group === "同じケーブル台").length, 3);
  assert.equal(c.items[5].note, "軽い仕上げ。");
  assert.equal(d.menu.exercises["chin-up"].bodyweight, true);
  assert.equal(d.menu.exercises["one-hand-cable-row"].perSide, true);
  assert.equal(d.menu.exercises["bulgarian-squat"].perSide, true);
});

test("記録がないとき: 重さは空（自重の種目は 0）、回数は目標", () => {
  const d = defaultData();
  const a = newActive(d, "day-a", "2026-10-20");
  const bench = a.entries[0], chin = a.entries[1];
  assert.deepEqual(bench.sets.map((s) => s.weight), [null, null, null]);
  assert.deepEqual(bench.sets.map((s) => s.reps), [5, 5, 5]);
  assert.deepEqual(chin.sets.map((s) => s.weight), [0, 0, 0]);
  assert.equal(a.startedAt, null);
});

test("重さが空のままでは完了にできない（入力を求める）", () => {
  const d = defaultData();
  const a = newActive(d, "day-a", "2026-10-20");
  const r = completeCurrentSet(d, a, new Date());
  assert.equal(r.needsWeight, true);
  assert.equal(a.entries[0].sets[0].done, false);
});

test("前回の記録から、重さの初期値をセットごとに入れる", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", { "bench-press": [[80, 5], [80, 5], [77.5, 4]] });
  const a = newActive(d, "day-a", "2026-10-20");
  assert.deepEqual(a.entries[0].sets.map((s) => s.weight), [80, 80, 77.5]);
  assert.deepEqual(a.entries[0].sets.map((s) => s.reps), [5, 5, 5]);
});

test("完了: 押し忘れていたら時間を自動で始め、種目の休憩の長さで休憩を始める", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", { "bench-press": [[80, 5], [80, 5], [80, 4]] });
  const a = newActive(d, "day-a", "2026-10-20");
  const now = new Date("2026-10-20T18:10:00");
  const r = completeCurrentSet(d, a, now);
  assert.equal(r.autoStarted, true);
  assert.equal(a.startedAt, now.toISOString());
  assert.equal(a.rest.totalSec, 180);
  assert.equal(a.rest.endsAt, now.getTime() + 180000);
});

test("自己ベスト: 前の最高（80kg×5）を超えたセットだけに付く", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", { "bench-press": [[80, 5], [80, 5], [80, 4]] });
  const a = newActive(d, "day-a", "2026-10-20");
  const b = a.entries[0];
  b.sets[0].weight = 80; b.sets[1].weight = 82.5; b.sets[2].weight = 82.5;
  const t = (m) => new Date(`2026-10-20T18:${String(m).padStart(2, "0")}:00`);
  assert.equal(completeCurrentSet(d, a, t(1)).pr, false);
  assert.equal(completeCurrentSet(d, a, t(5)).pr, true);
  assert.equal(completeCurrentSet(d, a, t(9)).pr, false);
  assert.deepEqual(prFlagsForActive(d, a).get(b.key), [false, true, false]);
});

test("前に記録がない種目には、自己ベストの印を付けない", () => {
  const d = defaultData();
  const a = newActive(d, "day-a", "2026-10-20");
  a.entries[0].sets.forEach((s) => (s.weight = 60));
  a.entries[0].sets[2].weight = 70;
  completeCurrentSet(d, a, new Date("2026-10-20T18:01:00"));
  completeCurrentSet(d, a, new Date("2026-10-20T18:02:00"));
  const r = completeCurrentSet(d, a, new Date("2026-10-20T18:03:00"));
  assert.equal(r.pr, false);
});

test("種目の最後のセットを終えると、まだ終わっていない種目のうちメニュー順で最初のものに移る", () => {
  const d = defaultData();
  const a = newActive(d, "day-a", "2026-10-20");
  a.entries[0].sets.forEach((s) => (s.weight = 60));
  // 先にダンベルカール（5番）を途中までやってから、ベンチに戻る
  a.currentKey = a.entries[4].key;
  a.entries[4].sets.forEach((s) => (s.weight = 12));
  completeCurrentSet(d, a, new Date("2026-10-20T18:01:00"));
  assert.equal(entryStatus(a.entries[4]), "part");
  a.currentKey = a.entries[0].key;
  completeCurrentSet(d, a, new Date("2026-10-20T18:02:00"));
  completeCurrentSet(d, a, new Date("2026-10-20T18:03:00"));
  const r = completeCurrentSet(d, a, new Date("2026-10-20T18:04:00"));
  assert.equal(r.moved, true);
  assert.equal(currentEntry(a).exerciseId, "chin-up");
});

test("重さを変えると、同じ種目のまだのセットのうち同じ重さだったものが合わせて変わる", () => {
  const d = defaultData();
  const a = newActive(d, "day-a", "2026-10-20");
  const b = a.entries[0];
  b.sets.forEach((s) => (s.weight = 80));
  b.sets[2].weight = 75;
  setWeight(b, 0, 82.5);
  assert.deepEqual(b.sets.map((s) => s.weight), [82.5, 82.5, 75]);
});

test("保存: 完了したセットだけ残し、1セットもやっていない種目はスキップ扱い", () => {
  const d = defaultData();
  const a = newActive(d, "day-a", "2026-10-20");
  a.entries[0].sets.forEach((s) => (s.weight = 60));
  completeCurrentSet(d, a, new Date("2026-10-20T18:01:00"));
  const s = finishActive(d, a, { startedAt: a.startedAt, endedAt: "2026-10-20T19:00:00.000Z", ratings: { pump: 8 } });
  assert.equal(s.entries[0].sets.length, 1);
  assert.equal(s.entries[0].skipped, false);
  assert.equal(s.entries[1].skipped, true);
  assert.equal(s.ratings.effort, null);
  assert.equal(s.dayLabel, "A");
});

test("全部終わったかどうか・合計セット数", () => {
  const d = defaultData();
  const a = newActive(d, "day-c", "2026-10-20");
  assert.equal(activeTotals(a).all, 13);
  a.entries.forEach((e) => e.sets.forEach((s) => { s.weight = 10; s.done = true; s.doneAt = "2026-10-20T10:00:00.000Z"; }));
  assert.equal(allFinished(a), true);
});

test("次の Day: A のあとは B、C のあとは A", () => {
  const d = defaultData();
  assert.equal(nextDayId(d), "day-a");
  doWorkout(d, "day-a", "2026-10-14", {});
  assert.equal(nextDayId(d), "day-b");
  doWorkout(d, "day-b", "2026-10-16", {});
  doWorkout(d, "day-c", "2026-10-18", {});
  assert.equal(nextDayId(d), "day-a");
});

const V1_SAMPLE = {
  menu: [
    { id: "day1", label: "Day1", name: "胸＋三頭", exercises: [
      { id: "bench-press", name: "ベンチプレス" }, { id: "dips", name: "ディップス" }, { id: "rope-pressdown", name: "ローププレスダウン" },
    ] },
    { id: "day4", label: "Day4", name: "腕", exercises: [
      { id: "incline-db-curl-day4", name: "インクラインダンベルカール" }, { id: "rope-pressdown-day4", name: "ローププレスダウン" },
    ] },
  ],
  sessions: [
    { id: "s1", date: "2026-06-20", dayId: "day1", dayLabel: "Day1", dayName: "胸＋三頭", ratings: { pump: 5, effort: 7, fatigue: 4 }, memo: "初回", savedAt: "2026-06-20T10:00:00.000Z",
      exercises: [
        { exerciseId: "bench-press", name: "ベンチプレス", category: "胸", skipped: false, memo: "", sets: [{ setNumber: 1, weight: 70, reps: 6 }, { setNumber: 2, weight: 70, reps: 6 }] },
        { exerciseId: "dips", name: "ディップス", category: "胸", skipped: true, memo: "", sets: [] },
        { exerciseId: "sub-x", name: "スミスマシンベンチ", category: "胸", isSubstitute: true, originalExerciseId: "rope-pressdown", skipped: false, sets: [{ setNumber: 1, weight: "", reps: 10 }] },
      ] },
    { id: "s2", date: "2026-06-23", dayId: "day4", dayLabel: "Day4", dayName: "腕", ratings: { pump: 6, effort: 6, fatigue: 5 }, memo: "", savedAt: "2026-06-23T10:00:00.000Z",
      exercises: [
        { exerciseId: "chin-up", name: "チンニング", category: "背中", bodyweight: true, skipped: false, sets: [{ setNumber: 1, weight: "", reps: 8 }, { setNumber: 2, weight: -10, reps: 8 }] },
        { exerciseId: "incline-db-curl-day4", name: "インクラインダンベルカール", category: "二頭", skipped: false, sets: [{ setNumber: 1, weight: 10, reps: 12 }] },
      ] },
  ],
};

test("前のアプリの記録の引き継ぎ: 同じ名前の種目はつなげ、ない種目は名簿に足す", () => {
  const d = defaultData();
  const r = migrateV1(JSON.parse(JSON.stringify(V1_SAMPLE)), d.menu);
  assert.equal(r.sessions.length, 2);
  assert.ok(r.linkedNames.includes("ベンチプレス"));
  assert.ok(r.linkedNames.includes("チンニング"));
  const addedNames = r.addedExercises.map((e) => e.name).sort();
  assert.deepEqual(addedNames, ["インクラインダンベルカール", "ディップス", "スミスマシンベンチ", "ローププレスダウン"].sort());
  const s1 = r.sessions[0];
  assert.equal(s1.entries[0].exerciseId, "bench-press");
  assert.equal(s1.entries[1].skipped, true);
  assert.equal(s1.entries[2].substituteFor, d.menu.exercises[s1.entries[2].substituteFor].id);
  assert.equal(d.menu.exercises[s1.entries[2].substituteFor].name, "ローププレスダウン");
  // 重さが空のセットは、自重の種目なら 0（自重）、それ以外は空のまま
  assert.deepEqual(r.sessions[1].entries[0].sets.map((x) => x.weight), [0, -10]);
  assert.equal(s1.entries[2].sets[0].weight, null);
  assert.equal(s1.ratings.pump, 5);
  assert.equal(s1.kit, "old");
});

test("引き継いだベンチの記録が、新しいメニューの前回の値になる", () => {
  const d = defaultData();
  d.sessions = migrateV1(JSON.parse(JSON.stringify(V1_SAMPLE)), d.menu).sessions;
  const a = newActive(d, "day-a", "2026-10-20");
  assert.deepEqual(a.entries[0].sets.map((s) => s.weight), [70, 70, 70]);
  assert.deepEqual(a.entries[1].sets.map((s) => s.weight), [0, -10, -10]);
});

test("読み込み: 前のアプリのデータを1回だけ引き継ぎ、前のアプリのデータには手を付けない", () => {
  const raw = JSON.stringify(V1_SAMPLE);
  const st = memoryStorage({ [V1_KEY]: raw, "workout-log-last-backup-v1": "2026-06-30T00:00:00.000Z" });
  const first = loadData(st);
  assert.equal(first.migrated.count, 2);
  assert.equal(first.data.settings.lastBackupAt, "2026-06-30T00:00:00.000Z");
  assert.equal(st.getItem(V1_KEY), raw);
  first.data.sessions.pop();
  saveData(first.data, st);
  const second = loadData(st);
  assert.equal(second.migrated, null);
  assert.equal(second.data.sessions.length, 1);
});

test("読み込み: 何もなければ最初のメニューで始める", () => {
  const st = memoryStorage();
  const { data, migrated } = loadData(st);
  assert.equal(migrated, null);
  assert.equal(data.sessions.length, 0);
  assert.ok(st.getItem(KEY));
});

test("バックアップから戻す: 新しい形も前のアプリの形も読める", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", {});
  assert.equal(dataFromBackup(JSON.parse(JSON.stringify(d)), d).kind, "v2");
  const fromV1 = dataFromBackup(JSON.parse(JSON.stringify(V1_SAMPLE)), d);
  assert.equal(fromV1.kind, "v1");
  assert.equal(fromV1.data.sessions.length, 2);
  assert.equal(dataFromBackup({ foo: 1 }, d), null);
});

test("CSV: 先頭に BOM、評価と時間の列、スキップの行", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", { "dumbbell-curl": "skip" });
  const csv = toCSV(d, filterSessions(d));
  assert.ok(csv.startsWith("﻿date,day,exercise"));
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.length, 1 + 3 + 3 + 2 + 2 + 1);
  assert.ok(lines.some((l) => l.includes("ダンベルカール") && l.includes(",true,")));
  assert.ok(lines[1].includes(",7,,4,"));
});

test("LLM 用のまとめ: 自己ベストと未入力の評価が書かれる。種目で絞るとその種目だけ", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", { "bench-press": [[80, 5], [80, 5], [80, 4]] });
  doWorkout(d, "day-a", "2026-10-20", { "bench-press": [[82.5, 5], [80, 5], [80, 5]] });
  const text = toLLMText(d, filterSessions(d));
  assert.ok(text.includes("82.5kg×5（自己ベスト）"));
  assert.ok(text.includes("出し切り感 未入力"));
  const only = toLLMText(d, filterSessions(d, { exerciseId: "bench-press" }));
  assert.ok(!only.includes("チンニング"));
  assert.ok(only.includes("ベンチプレス"));
});

test("グラフ: やっていない日は点を打たない。合計には入れ替えた種目を入れない", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", { "bench-press": [[80, 5], [80, 5], [80, 4]] });
  doWorkout(d, "day-a", "2026-10-20", { "bench-press": "skip" });
  assert.equal(exerciseSeries(d, "bench-press").length, 1);
  const tot = dayTotalSeries(d, "day-a");
  assert.equal(tot.length, 2);
  assert.equal(tot[1].missing, true);
  assert.ok(tot[0].total > tot[1].total);
});

test("保存した記録の自己ベストの印", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", { "bench-press": [[80, 5], [80, 5], [80, 4]] });
  const s2 = doWorkout(d, "day-a", "2026-10-20", { "bench-press": [[80, 6], [82.5, 5], [82.5, 5]] });
  assert.deepEqual(prFlagsForSession(d, s2)[0], [true, true, false]);
});

test("今日のまとめ: 前回より伸びた種目とやらなかった種目", () => {
  const d = defaultData();
  doWorkout(d, "day-a", "2026-10-14", { "bench-press": [[80, 5], [80, 5], [80, 4]] });
  const a = newActive(d, "day-a", "2026-10-20");
  a.entries[0].sets[0].weight = 85;
  completeCurrentSet(d, a, new Date("2026-10-20T18:01:00"));
  const m = activeSummary(d, a);
  assert.equal(m.prs.length, 1);
  assert.equal(m.ups.length, 1);
  assert.equal(m.ups[0].to.weight, 85);
  assert.equal(m.skipped.length, 4);
});
