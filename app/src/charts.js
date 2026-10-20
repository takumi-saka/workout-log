// 折れ線グラフ（SVG）。点を押すと日付と数字が出る。

import { esc } from "./util.js";

/**
 * @param {{ points: { label: string, value: number, text: string, tip: string, mark?: "pr"|"missing"|"" }[], height?: number }} opt
 */
export function lineChart({ points, height = 150 }) {
  if (!points.length) return '<p class="chart-empty">まだ記録がありません。</p>';
  const W = 340, H = height, padL = 14, padR = 14, padT = 26, padB = 24;
  const values = points.map((p) => p.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.12;
  max += span * 0.12;
  const n = points.length;
  const x = (i) => (n === 1 ? W / 2 : padL + ((W - padL - padR) * i) / (n - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const maxIdx = values.indexOf(Math.max(...values));
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const dateEvery = Math.max(1, Math.ceil(n / 5));
  const showValue = (i) => i === n - 1 || i === maxIdx || (n <= 8) || i % labelEvery === 0;
  const showDate = (i) => i === n - 1 || i === 0 || (n <= 6) || (i % dateEvery === 0 && n - 1 - i >= dateEvery / 2);
  const grid = [0.25, 0.5, 0.75].map((r) => `<line x1="${padL}" x2="${W - padR}" y1="${(padT + (H - padT - padB) * r).toFixed(1)}" y2="${(padT + (H - padT - padB) * r).toFixed(1)}" class="grid"/>`).join("");
  const dots = points.map((p, i) => {
    const cx = x(i).toFixed(1), cy = y(p.value).toFixed(1);
    const cls = p.mark === "pr" ? "dot pr" : p.mark === "missing" ? "dot missing" : "dot";
    return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="4.5"/>
      ${showValue(i) ? `<text class="val" x="${cx}" y="${(y(p.value) - 10).toFixed(1)}">${esc(p.text)}</text>` : ""}
      ${showDate(i) ? `<text class="date" x="${cx}" y="${H - 6}">${esc(p.label)}</text>` : ""}
      <circle class="hit" cx="${cx}" cy="${cy}" r="16" data-action="chart:tip" data-tip="${esc(p.tip)}"/>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="推移のグラフ">${grid}<path class="line" d="${path}"/>${dots}</svg>`;
}
