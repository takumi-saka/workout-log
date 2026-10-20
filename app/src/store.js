// 保存と読み込み。記録はこのスマホのブラウザの中（localStorage）にだけ置く。外には送らない。

import { defaultMenu } from "./menu-default.js";
import { migrateV1 } from "./migrate.js";

export const KEY = "workout-log-v2";
export const V1_KEY = "workout-log-v1";
const V1_LAST_BACKUP_KEY = "workout-log-last-backup-v1";

export function defaultData() {
  return {
    version: 2,
    menu: defaultMenu(),
    sessions: [],
    active: null,
    settings: { lastBackupAt: null, migratedAt: null, migratedCount: 0, backupReminderDays: 14 },
  };
}

function isV2(d) {
  return !!d && d.version === 2 && !!d.menu && Array.isArray(d.menu.days) && !!d.menu.exercises && Array.isArray(d.sessions);
}

function isV1(d) {
  return !!d && Array.isArray(d.menu) && Array.isArray(d.sessions);
}

function normalize(d) {
  d.settings = { lastBackupAt: null, migratedAt: null, migratedCount: 0, backupReminderDays: 14, ...(d.settings || {}) };
  if (!("active" in d)) d.active = null;
  return d;
}

/**
 * 読み込む。新しい形のデータがなければ、前のアプリのデータから引き継いで作る。
 * @returns {{ data: object, migrated: null | { count: number, linkedNames: string[], addedNames: string[] } }}
 */
export function loadData(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (isV2(d)) return { data: normalize(d), migrated: null };
    }
  } catch {
    // 壊れていたら作り直す（前のアプリのデータからもう一度引き継ぐ）
  }
  const data = defaultData();
  let migrated = null;
  try {
    const raw1 = storage.getItem(V1_KEY);
    const v1 = raw1 ? JSON.parse(raw1) : null;
    if (isV1(v1) && v1.sessions.length) {
      const r = migrateV1(v1, data.menu);
      data.sessions = r.sessions;
      data.settings.migratedAt = new Date().toISOString();
      data.settings.migratedCount = r.sessions.length;
      migrated = { count: r.sessions.length, linkedNames: r.linkedNames, addedNames: r.addedExercises.map((e) => e.name) };
    }
    const lb = storage.getItem(V1_LAST_BACKUP_KEY);
    if (lb) data.settings.lastBackupAt = lb;
  } catch {
    migrated = null;
  }
  saveData(data, storage);
  return { data, migrated };
}

export function saveData(data, storage = globalThis.localStorage) {
  storage.setItem(KEY, JSON.stringify(data));
}

/**
 * バックアップのファイルを読み、戻すデータを作る。新しい形・前のアプリの形のどちらも受け付ける。
 * 前のアプリのバックアップなら、今のメニューはそのままにして記録だけを戻す。
 */
export function dataFromBackup(obj, currentData) {
  if (isV2(obj)) return { data: normalize(JSON.parse(JSON.stringify(obj))), kind: "v2" };
  if (isV1(obj)) {
    const menu = JSON.parse(JSON.stringify(currentData.menu));
    const r = migrateV1(obj, menu);
    const data = normalize({ ...defaultData(), menu, sessions: r.sessions, settings: { ...currentData.settings } });
    return { data, kind: "v1" };
  }
  return null;
}

export function backupText(data) {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}
