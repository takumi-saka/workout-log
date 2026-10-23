// 記録の計算まわり。DOM には触らない（Node のテストでも読み込めるようにする）。
//
// data の形
//   menu.exercises  : { [id]: { id, name, category, step, bodyweight, perSide } }   … 種目の名簿（Day をまたいで共通）
//   menu.days       : [{ id, label, name, kit, items: [{ exerciseId, sets, reps, restSec, note, group }] }]
//   sessions        : 保存した記録。完了したセットだけを持つ
//   active          : いま記録中のワークアウト（閉じても残る）
//   settings        : バックアップの日時など

import { uid, todayISO, sum } from "./util.js";

/* ---------- セットの比べ方 ---------- */

/**
 * 片手ずつの種目のセットは、右（weight・reps）と左（weightL・repsL）を持つ。
 * 比べるときは弱い方の側（重さ・回数の小さい方）を使う。左を持たない記録（前の版など）は両側同じとみなす。
 */
export function effSet(s) {
  if (!s) return s;
  const hasL = (s.weightL !== undefined && s.weightL !== null) || (s.repsL !== undefined && s.repsL !== null);
  if (!hasL) return s;
  const wL = s.weightL ?? s.weight;
  const rL = s.repsL ?? s.reps;
  return { ...s, weight: s.weight === null || s.weight === undefined ? s.weight : Math.min(s.weight, wL), reps: s.reps === null || s.reps === undefined ? s.reps : Math.min(s.reps, rL) };
}

export function validSet(s) {
  const e = effSet(s);
  return !!e && e.reps !== null && e.reps !== undefined && e.reps > 0 && e.weight !== null && e.weight !== undefined;
}

/** a が b より上か（重い方が上。同じ重さなら回数が多い方が上）。自重の補助はマイナスで持つので、補助が少ないほど上になる。 */
export function beats(a, b) {
  if (!validSet(a)) return false;
  if (!b) return true;
  const x = effSet(a), y = effSet(b);
  return x.weight > y.weight || (x.weight === y.weight && x.reps > y.reps);
}

export function topSet(sets) {
  return sets.filter(validSet).reduce((best, s) => (beats(s, best) ? s : best), null);
}

/* ---------- 保存した記録を読む ---------- */

export function sortedSessions(data) {
  return [...data.sessions].sort((a, b) => a.date.localeCompare(b.date) || String(a.savedAt || "").localeCompare(String(b.savedAt || "")));
}

/** その種目をやった記録（古い順）。スキップした回は入れない。 */
export function exerciseHistory(data, exerciseId, { excludeSessionId } = {}) {
  const out = [];
  for (const session of sortedSessions(data)) {
    if (session.id === excludeSessionId) continue;
    for (const entry of session.entries) {
      if (entry.exerciseId !== exerciseId || entry.skipped) continue;
      if (!entry.sets.some(validSet)) continue;
      out.push({ session, entry });
    }
  }
  return out;
}

export function lastRecord(data, exerciseId) {
  const h = exerciseHistory(data, exerciseId);
  return h.length ? h[h.length - 1] : null;
}

export function bestEver(data, exerciseId, opts) {
  let best = null;
  for (const { entry } of exerciseHistory(data, exerciseId, opts)) {
    for (const s of entry.sets) if (beats(s, best)) best = s;
  }
  return best;
}

/** 保存した記録の中の自己ベストの印（セッションの中のセットごと） */
export function prFlagsForSession(data, session) {
  const best = new Map();
  for (const s of sortedSessions(data)) {
    if (s.id === session.id) break;
    for (const e of s.entries) {
      if (e.skipped) continue;
      for (const set of e.sets) if (beats(set, best.get(e.exerciseId) || null)) best.set(e.exerciseId, set);
    }
  }
  return session.entries.map((e) => {
    if (e.skipped) return [];
    let b = best.get(e.exerciseId) || null;
    const hadHistory = !!b;
    return e.sets.map((set) => {
      const isPr = hadHistory && beats(set, b);
      if (beats(set, b)) b = set;
      best.set(e.exerciseId, b);
      return isPr;
    });
  });
}

/* ---------- 記録中のワークアウト ---------- */

function pickWeight(exercise, lastSets, i) {
  const s = lastSets[i] || lastSets[lastSets.length - 1];
  if (s && s.weight !== null && s.weight !== undefined) return s.weight;
  return exercise.bodyweight ? 0 : null;
}

function pickWeightL(exercise, lastSets, i) {
  const s = lastSets[i] || lastSets[lastSets.length - 1];
  if (s && s.weightL !== null && s.weightL !== undefined) return s.weightL;
  return pickWeight(exercise, lastSets, i);
}

function newSet(ex, lastSets, i, reps) {
  const s = { weight: pickWeight(ex, lastSets, i), reps, done: false, doneAt: null };
  if (ex.perSide) Object.assign(s, { weightL: pickWeightL(ex, lastSets, i), repsL: reps, doneR: false, doneAtR: null, touchedL: false });
  return s;
}

/** Day の1種目から、記録中の1種目を作る。重量の初期値はセットごとに前回の値、回数は目標の回数。 */
export function entryFromItem(data, item, extra = {}) {
  const ex = data.menu.exercises[item.exerciseId];
  const last = lastRecord(data, ex.id);
  const lastSets = last ? last.entry.sets.filter(validSet) : [];
  return {
    key: uid(),
    exerciseId: ex.id,
    name: ex.name,
    category: ex.category,
    bodyweight: !!ex.bodyweight,
    perSide: !!ex.perSide,
    step: ex.step || 2.5,
    restSec: item.restSec || 120,
    note: item.note || "",
    group: item.group || "",
    targetSets: item.sets,
    targetReps: item.reps,
    substituteFor: null,
    added: false,
    skipped: false,
    memo: "",
    sets: Array.from({ length: item.sets }, (_, i) => newSet(ex, lastSets, i, item.reps)),
    ...extra,
  };
}

export function newActive(data, dayId, date = todayISO()) {
  const day = data.menu.days.find((d) => d.id === dayId) || data.menu.days[0];
  const entries = day.items.filter((it) => data.menu.exercises[it.exerciseId]).map((it) => entryFromItem(data, it));
  return { id: uid(), date, dayId: day.id, startedAt: null, currentKey: entries[0] ? entries[0].key : null, rest: null, entries };
}

export function entryStatus(e) {
  if (e.skipped) return "skip";
  const done = e.sets.filter((s) => s.done).length;
  if (e.sets.length && done === e.sets.length) return "done";
  return done || e.sets.some((s) => s.doneR) ? "part" : "todo";
}

/** 片手ずつの種目で、今やるのが右か左か（それ以外の種目は null） */
export function activeSide(e) {
  const i = activeSetIndex(e);
  if (!e || !e.perSide || i < 0) return null;
  return e.sets[i].doneR ? "L" : "R";
}

export function activeSetIndex(e) {
  if (!e || e.skipped) return -1;
  return e.sets.findIndex((s) => !s.done);
}

export function currentEntry(active) {
  return active.entries.find((e) => e.key === active.currentKey) || active.entries[0] || null;
}

export function nextUnfinishedKey(active, exceptKey) {
  const e = active.entries.find((x) => x.key !== exceptKey && (entryStatus(x) === "todo" || entryStatus(x) === "part"));
  return e ? e.key : null;
}

export function activeTotals(active) {
  const live = active.entries.filter((e) => !e.skipped);
  return {
    done: sum(live.map((e) => e.sets.filter((s) => s.done).length)),
    all: sum(live.map((e) => e.sets.length)),
  };
}

export function hasProgress(active) {
  return !!active && active.entries.some((e) => e.sets.some((s) => s.done || s.doneR));
}

export function allFinished(active) {
  return active.entries.length > 0 && active.entries.every((e) => entryStatus(e) === "done" || entryStatus(e) === "skip") && hasProgress(active);
}

/** 記録中のセットの自己ベストの印。key → [セットごとの true/false]。前に記録がない種目には付けない。 */
export function prFlagsForActive(data, active) {
  const best = new Map();
  const done = [];
  active.entries.forEach((e) => e.sets.forEach((s, i) => { if (s.done) done.push({ e, s, i }); }));
  done.sort((a, b) => String(a.s.doneAt || "").localeCompare(String(b.s.doneAt || "")));
  const flags = new Map(active.entries.map((e) => [e.key, e.sets.map(() => false)]));
  for (const { e, s, i } of done) {
    if (!best.has(e.exerciseId)) { const b0 = bestEver(data, e.exerciseId); best.set(e.exerciseId, { value: b0, had: !!b0 }); }
    const b = best.get(e.exerciseId);
    if (b.had && beats(s, b.value)) flags.get(e.key)[i] = true;
    if (beats(s, b.value)) b.value = s;
  }
  return flags;
}

/**
 * 今のセットを完了にする。休憩の始まりと、次に出す種目もここで決める。
 * - 片手ずつの種目は、右 → 休憩 → 左 → 休憩 の順に1側ずつ完了にする。左には、右でやった重さと回数が入る。
 * - 種目の最後のセットのあとは休憩を入れず、次の種目に移る（片付けて移動するため）。
 */
export function completeCurrentSet(data, active, now = new Date()) {
  const e = currentEntry(active);
  const i = activeSetIndex(e);
  if (i < 0) return null;
  const set = e.sets[i];
  const side = e.perSide ? (set.doneR ? "L" : "R") : null;
  if (side === "L") {
    if (set.weightL === null || set.weightL === undefined) set.weightL = set.weight;
    if (set.repsL === null || set.repsL === undefined) set.repsL = set.reps;
  }
  const wKey = side === "L" ? "weightL" : "weight";
  if (set[wKey] === null || set[wKey] === undefined) {
    if (!e.bodyweight) return { needsWeight: true, side };
    set[wKey] = 0;
  }
  let autoStarted = false;
  if (!active.startedAt) { active.startedAt = now.toISOString(); autoStarted = true; }
  const restAfter = { endsAt: now.getTime() + e.restSec * 1000, totalSec: e.restSec };
  if (side === "R") {
    set.doneR = true;
    set.doneAtR = now.toISOString();
    if (!set.touchedL) { set.weightL = set.weight; set.repsL = set.reps; }
    active.rest = restAfter;
    return { entry: e, index: i, side, pr: false, autoStarted, moved: false, allDone: false };
  }
  set.done = true;
  set.doneAt = now.toISOString();
  const moreHere = activeSetIndex(e) >= 0;
  let moved = false;
  if (!moreHere) {
    const nk = nextUnfinishedKey(active, e.key);
    if (nk) { active.currentKey = nk; moved = true; }
  }
  active.rest = moreHere ? restAfter : null;
  const pr = !!prFlagsForActive(data, active).get(e.key)[i];
  return { entry: e, index: i, side, pr, autoStarted, moved, allDone: !moreHere && !moved };
}

/**
 * 重さを変えたとき、同じ種目のまだのセットのうち、前と同じ重さだったものを合わせる。
 * 片手ずつの種目で右を変えたときは、左も（まだ左だけ変えていなければ）合わせる。side が "L" なら左だけを変える。
 */
export function setWeight(entry, index, weight, side = null) {
  const s = entry.sets[index];
  if (side === "L") {
    const oldL = s.weightL ?? s.weight;
    s.weightL = weight;
    s.touchedL = true;
    entry.sets.forEach((t, j) => { if (j > index && !t.done && !t.doneR && (t.weightL ?? t.weight) === oldL) t.weightL = weight; });
    return;
  }
  const old = s.weight;
  s.weight = weight;
  if (entry.perSide && !s.done && !s.touchedL) s.weightL = weight;
  entry.sets.forEach((t, j) => {
    if (j <= index || t.done) return;
    if (t.weight === old && !t.doneR) t.weight = weight;
    if (entry.perSide && !t.touchedL && (t.weightL ?? old) === old) t.weightL = weight;
  });
}

/** 記録中のワークアウトを保存用の形にする。完了したセットだけを残し、1セットもやっていない種目はスキップ扱いにする。 */
export function finishActive(data, active, { startedAt, endedAt, ratings, memo, now = new Date() }) {
  const day = data.menu.days.find((d) => d.id === active.dayId) || { id: active.dayId, label: "", name: "", kit: "old" };
  return {
    id: active.id,
    date: active.date,
    dayId: day.id,
    dayLabel: day.label,
    dayName: day.name,
    kit: day.kit,
    startedAt: startedAt || null,
    endedAt: endedAt || null,
    savedAt: now.toISOString(),
    ratings: { pump: ratings?.pump ?? null, effort: ratings?.effort ?? null, fatigue: ratings?.fatigue ?? null },
    memo: memo || "",
    entries: active.entries.map((e) => {
      const done = e.sets.filter((s) => s.done);
      return {
        exerciseId: e.exerciseId,
        name: e.name,
        category: e.category,
        bodyweight: e.bodyweight,
        perSide: e.perSide,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        substituteFor: e.substituteFor || null,
        added: !!e.added,
        skipped: e.skipped || done.length === 0,
        memo: e.memo || "",
        sets: done.map((s) => (e.perSide
          ? { weight: s.weight, reps: s.reps, weightL: s.weightL ?? s.weight, repsL: s.repsL ?? s.reps, doneAt: s.doneAt }
          : { weight: s.weight, reps: s.reps, doneAt: s.doneAt })),
      };
    }),
  };
}

/** 今日のまとめ（自己ベスト・前回より伸びた種目・やらなかった種目） */
export function activeSummary(data, active) {
  const flags = prFlagsForActive(data, active);
  const prs = [], ups = [], skipped = [];
  for (const e of active.entries) {
    const done = e.sets.filter((s) => s.done);
    if (e.skipped || !done.length) { skipped.push(e.name); continue; }
    e.sets.forEach((s, i) => { if (flags.get(e.key)[i]) prs.push({ entry: e, set: s }); });
    const last = lastRecord(data, e.exerciseId);
    if (!last) continue;
    const today = topSet(done), before = topSet(last.entry.sets);
    if (beats(today, before)) ups.push({ entry: e, from: before, to: today });
  }
  return { prs, ups, skipped, totals: activeTotals(active) };
}

/* ---------- Day の順番 ---------- */

/** 次にやる Day。最後に保存した記録の Day の、メニュー上の次。 */
export function nextDayId(data) {
  const days = data.menu.days;
  if (!days.length) return null;
  const last = sortedSessions(data).reverse().find((s) => days.some((d) => d.id === s.dayId));
  if (!last) return days[0].id;
  const i = days.findIndex((d) => d.id === last.dayId);
  return days[(i + 1) % days.length].id;
}

export function lastDateOfDay(data, dayId) {
  const s = sortedSessions(data).reverse().find((x) => x.dayId === dayId);
  return s ? s.date : null;
}

/* ---------- 進捗のグラフ用 ---------- */

/** 種目ごとの推移（その日のいちばん上のセット）。やっていない日は点を打たない。 */
export function exerciseSeries(data, exerciseId, since) {
  return exerciseHistory(data, exerciseId)
    .filter(({ session }) => !since || session.date >= since)
    .map(({ session, entry }) => {
      const top = effSet(topSet(entry.sets));
      return { date: session.date, sessionId: session.id, weight: top.weight, reps: top.reps, bodyweight: entry.bodyweight };
    });
}

/** Day ごとの「各種目の最大重量の合計」。入れ替えた種目・足した種目・スキップした種目は入れない。 */
export function dayTotalSeries(data, dayId, since) {
  return sortedSessions(data)
    .filter((s) => s.dayId === dayId && (!since || s.date >= since))
    .map((s) => {
      const counted = s.entries.filter((e) => !e.skipped && !e.substituteFor && !e.added && e.sets.some(validSet));
      const total = sum(counted.map((e) => Math.max(...e.sets.filter(validSet).map((x) => effSet(x).weight))));
      return { date: s.date, sessionId: s.id, total: Math.round(total * 100) / 100, missing: s.entries.some((e) => e.skipped || e.substituteFor) };
    });
}

/* ---------- 種目を選ぶ画面用 ---------- */

export function recentExerciseIds(data, limit = 8) {
  const seen = [];
  for (const s of sortedSessions(data).reverse()) {
    for (const e of s.entries) {
      if (!e.skipped && data.menu.exercises[e.exerciseId] && !seen.includes(e.exerciseId)) seen.push(e.exerciseId);
      if (seen.length >= limit) return seen;
    }
  }
  return seen;
}

export function exerciseInUse(data, exerciseId) {
  return data.menu.days.some((d) => d.items.some((it) => it.exerciseId === exerciseId));
}

export function normalizeName(name) {
  return String(name || "").replace(/[\s・･]/g, "").toLowerCase();
}

export function findExerciseByName(data, name) {
  const n = normalizeName(name);
  return Object.values(data.menu.exercises).find((e) => normalizeName(e.name) === n) || null;
}
