// 電波がないときに使うファイルの一覧（sw.js）が、app/ の中身と合っているか。版の番号がそろっているか。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("../app/", import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("sw.js の一覧に、app/ のファイルが全部入っている", () => {
  const sw = readFileSync(join(appDir, "sw.js"), "utf8");
  const listed = new Set([...sw.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter(Boolean));
  const files = walk(appDir).map((p) => relative(appDir, p).split("\\").join("/")).filter((f) => f !== "sw.js" && !f.startsWith("."));
  const missing = files.filter((f) => !listed.has(f));
  const extra = [...listed].filter((f) => f !== "" && !files.includes(f));
  assert.deepEqual(missing, [], `一覧にないファイル: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `一覧にあるのに存在しないファイル: ${extra.join(", ")}`);
});

test("sw.js と src/version.js の版がそろっている", () => {
  const sw = readFileSync(join(appDir, "sw.js"), "utf8");
  const v = readFileSync(join(appDir, "src/version.js"), "utf8");
  const a = sw.match(/const VERSION = "([^"]+)"/)[1];
  const b = v.match(/VERSION = "([^"]+)"/)[1];
  assert.equal(a, b);
});
