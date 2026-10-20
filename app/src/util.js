// どこからでも使う小さな道具。DOM には触らない（Node のテストでも読み込めるようにする）。

export const WEEKDAYS = "日月火水木金土";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** 端末の時刻での日付（YYYY-MM-DD） */
export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

/** 10月20日（月） */
export function dateJP(iso) {
  const d = parseISODate(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 10/20 */
export function dateShort(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function weekdayOf(iso) {
  return WEEKDAYS[parseISODate(iso).getDay()];
}

/** 秒 → 1:05 / 1:02:05 */
export function clock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** ISO 日時 → 18:05 */
export function hhmm(isoDateTime) {
  const d = new Date(isoDateTime);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 日付（YYYY-MM-DD）と時刻（HH:MM）から ISO 日時を作る */
export function joinDateTime(isoDate, time) {
  const [h, m] = time.split(":").map(Number);
  const d = parseISODate(isoDate);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function minutesBetween(fromIso, toIso) {
  return Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
}

/** 重さの数字を短く（82.5 / 81.25 / 80） */
export function num(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(+(+value).toFixed(2));
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function sum(list) {
  return list.reduce((a, b) => a + b, 0);
}
