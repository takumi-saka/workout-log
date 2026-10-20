// 最初に入っているメニュー（2026-10-20 に本人からもらった最新版）と、Day の色の候補。

/** Day ごとの色。完了ボタンのオレンジがどれの上でも読めるものだけにしている。 */
export const KITS = {
  a: { name: "青", color: "#1d40e0", deep: "#132c9e", soft: "#e7ecfd" },
  b: { name: "緑", color: "#0a8a5f", deep: "#066446", soft: "#e1f3ec" },
  c: { name: "紺", color: "#1a2140", deep: "#0b1026", soft: "#e6e8f0" },
  d: { name: "紫", color: "#5b2bd6", deep: "#3f1a9e", soft: "#ece6fb" },
  e: { name: "青緑", color: "#00798c", deep: "#005564", soft: "#dff1f3" },
  old: { name: "灰", color: "#5f6782", deep: "#454c63", soft: "#eceef3" },
};

export const CATEGORIES = ["胸", "肩", "三頭", "背中", "二頭", "前腕", "脚", "体幹", "その他"];

/** −/+ で増える量の候補 */
export const STEP_CHOICES = [1, 1.25, 2, 2.5, 5];
/** 休憩の長さの候補（秒） */
export const REST_CHOICES = [60, 90, 120, 150, 180, 240];

function ex(id, name, category, step, o = {}) {
  return { id, name, category, step, bodyweight: !!o.bodyweight, perSide: !!o.perSide };
}

function item(exerciseId, sets, reps, o = {}) {
  return { exerciseId, sets, reps, restSec: o.restSec ?? 120, note: o.note ?? "", group: o.group ?? "" };
}

export function defaultMenu() {
  const exercises = [
    ex("bench-press", "ベンチプレス", "胸", 2.5),
    ex("chin-up", "チンニング", "背中", 2.5, { bodyweight: true }),
    ex("leg-press", "レッグプレス", "脚", 5),
    ex("lying-triceps-extension", "ライイングトライセプスエクステンション", "三頭", 2.5),
    ex("dumbbell-curl", "ダンベルカール", "二頭", 2),
    ex("v-squat", "Vスクワット", "脚", 5),
    ex("one-hand-cable-row", "ワンハンド・シーテッドケーブルロー", "背中", 2.5, { perSide: true }),
    ex("bulgarian-squat", "ブルガリアンスクワット", "脚", 2, { perSide: true }),
    ex("machine-shoulder-press", "マシンショルダープレス", "肩", 5),
    ex("hammer-curl", "ハンマーカール", "二頭", 2),
    ex("deadlift", "デッドリフト", "脚", 2.5),
    ex("incline-db-press", "インクラインダンベルプレス", "胸", 2),
    ex("pec-fly", "ペックフライ", "胸", 5),
    ex("straight-arm-pulldown", "ストレートアームプルダウン", "背中", 2.5),
    ex("straight-bar-pressdown", "ストレートバー・プレスダウン", "三頭", 2.5),
    ex("face-pull", "フェイスプル", "肩", 2.5),
  ];
  const days = [
    {
      id: "day-a", label: "A", name: "ベンチ中心", kit: "a",
      items: [
        item("bench-press", 3, 5, { restSec: 180 }),
        item("chin-up", 3, 6),
        item("leg-press", 2, 8),
        item("lying-triceps-extension", 2, 10),
        item("dumbbell-curl", 2, 10),
      ],
    },
    {
      id: "day-b", label: "B", name: "Vスクワット中心", kit: "b",
      items: [
        item("v-squat", 3, 5, { restSec: 180 }),
        item("one-hand-cable-row", 2, 10),
        item("bulgarian-squat", 2, 8),
        item("machine-shoulder-press", 2, 8),
        item("hammer-curl", 2, 10),
      ],
    },
    {
      id: "day-c", label: "C", name: "デッドリフト中心", kit: "c",
      items: [
        item("deadlift", 2, 5, { restSec: 180 }),
        item("incline-db-press", 3, 8),
        item("pec-fly", 2, 15),
        item("straight-arm-pulldown", 2, 15, { group: "同じケーブル台" }),
        item("straight-bar-pressdown", 2, 12, { group: "同じケーブル台" }),
        item("face-pull", 2, 15, { group: "同じケーブル台", note: "軽い仕上げ。" }),
      ],
    },
  ];
  return { exercises: Object.fromEntries(exercises.map((e) => [e.id, e])), days };
}
