// 前のアプリ（保存キー workout-log-v1）の記録を、新しい形に引き継ぐ。
// 前のアプリのデータには手を付けない（読むだけ）。万一のときに前のアプリへ戻せるようにするため。
//
// 前のアプリの記録の形
//   { menu: [{ id, label, name, exercises: [...] }],
//     sessions: [{ id, date, dayId, dayLabel, dayName, ratings: { pump, effort, fatigue }, memo, savedAt,
//                  exercises: [{ exerciseId, name, category, bodyweight, skipped, memo, isSubstitute, originalExerciseId,
//                                sets: [{ setNumber, weight, reps }] }] }] }

import { normalizeName } from "./model.js";

const CATEGORY_MAP = { 胸: "胸", 背中: "背中", 脚: "脚", 肩: "肩", 二頭: "二頭", 三頭: "三頭", 前腕: "前腕", 体幹: "体幹", その他: "その他" };

function toNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function slug(name, taken) {
  let h = 5381;
  for (const c of normalizeName(name)) h = ((h << 5) + h + c.codePointAt(0)) >>> 0;
  let id = `old-${h.toString(36)}`;
  while (taken[id]) id += "x";
  return id;
}

/**
 * @param {object} v1 前のアプリの保存データ
 * @param {object} menu 新しいメニュー（menu.exercises を名前で突き合わせる。見つからない種目は名簿に足す）
 * @returns {{ sessions: object[], addedExercises: object[], linkedNames: string[] }}
 */
export function migrateV1(v1, menu) {
  const byName = new Map(Object.values(menu.exercises).map((e) => [normalizeName(e.name), e.id]));
  const oldIdToName = new Map();
  (v1.menu || []).forEach((day) => (day.exercises || []).forEach((e) => oldIdToName.set(e.id, e.name)));
  const added = [];
  const linked = new Set();

  function resolve(name, category, bodyweight) {
    const key = normalizeName(name);
    if (byName.has(key)) {
      const id = byName.get(key);
      if (!added.some((a) => a.id === id)) linked.add(name);
      return id;
    }
    const id = slug(name, menu.exercises);
    const ex = { id, name, category: CATEGORY_MAP[category] || "その他", step: 2.5, bodyweight: !!bodyweight, perSide: false };
    menu.exercises[id] = ex;
    byName.set(key, id);
    added.push(ex);
    return id;
  }

  const sessions = (v1.sessions || []).map((s) => ({
    id: `v1-${s.id}`,
    date: s.date,
    dayId: `v1-${s.dayId}`,
    dayLabel: s.dayLabel || "",
    dayName: s.dayName || "",
    kit: "old",
    startedAt: null,
    endedAt: null,
    savedAt: s.savedAt || `${s.date}T12:00:00.000Z`,
    ratings: {
      pump: toNumber(s.ratings && s.ratings.pump),
      effort: toNumber(s.ratings && s.ratings.effort),
      fatigue: toNumber(s.ratings && s.ratings.fatigue),
    },
    memo: s.memo || "",
    source: "v1",
    entries: (s.exercises || []).map((e) => {
      const exerciseId = resolve(e.name, e.category, e.bodyweight);
      let substituteFor = null;
      if (e.isSubstitute && e.originalExerciseId && oldIdToName.has(e.originalExerciseId)) {
        substituteFor = resolve(oldIdToName.get(e.originalExerciseId), e.category, false);
      }
      const sets = e.skipped ? [] : (e.sets || [])
        .map((x) => ({ weight: toNumber(x.weight), reps: toNumber(x.reps), doneAt: null }))
        .map((x) => (x.weight === null && e.bodyweight ? { ...x, weight: 0 } : x))
        .filter((x) => x.reps !== null && x.reps > 0);
      return {
        exerciseId,
        name: e.name,
        category: CATEGORY_MAP[e.category] || "その他",
        bodyweight: !!e.bodyweight,
        perSide: false,
        targetSets: e.targetSets || sets.length,
        targetReps: e.targetReps || null,
        substituteFor,
        added: false,
        skipped: !!e.skipped || sets.length === 0,
        memo: e.memo || "",
        sets,
      };
    }),
  }));

  return { sessions, addedExercises: added, linkedNames: [...linked] };
}
