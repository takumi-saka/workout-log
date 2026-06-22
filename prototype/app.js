const days = [
  {
    id: "day1",
    label: "Day1",
    name: "胸＋三頭",
    time: "65〜75分",
    exercises: [
      ["ベンチプレス", "胸", 4, 6, "前回: 80kg x 6, 6, 5, 4"],
      ["ディップス", "胸", 3, 10, "前回: 15kg x 10, 9, 8"],
      ["インクラインダンベルプレス", "胸", 3, 10, "前回: 30kg x 10, 10, 9"],
      ["ライイングトライセプスエクステンション", "三頭", 3, 10, "前回: 32kg x 10, 9, 8"],
      ["ペックフライ", "胸", 2, 15, "前回: 54kg x 15, 14"],
      ["ローププレスダウン", "三頭", 2, 15, "前回: 42kg x 15, 13"],
    ],
  },
  {
    id: "day2",
    label: "Day2",
    name: "背中＋二頭",
    time: "65〜75分",
    exercises: [
      ["デッドリフト", "背中", 3, 5, "前回: 130kg x 5, 5, 4"],
      ["チンニング", "背中", 4, 8, "前回: 自重 x 8, 7, 6, 6"],
      ["シーテッドロー", "背中", 3, 10, "前回: 70kg x 10, 10, 9"],
      ["ストレートアームプルダウン", "背中", 2, 15, "前回: 32kg x 15, 14"],
      ["インクラインダンベルカール", "二頭", 2, 12, "前回: 12kg x 12, 10"],
      ["マシンカール", "二頭", 2, 15, "前回: 28kg x 15, 13"],
    ],
  },
  {
    id: "day3",
    label: "Day3",
    name: "脚＋肩",
    time: "60〜75分",
    exercises: [
      ["Vスクワット", "脚", 4, 5, "前回: 160kg x 5, 5, 5, 4"],
      ["レッグプレス", "脚", 3, 8, "前回: 220kg x 8, 8, 7"],
      ["ブルガリアンスクワット", "脚", 2, 8, "前回: 24kg x 8, 8"],
      ["サイドレイズ", "肩", 3, 20, "前回: 10kg x 20, 18, 16"],
      ["マシンショルダープレス", "肩", 3, 10, "前回: 48kg x 10, 9, 8"],
      ["フェイスプル", "肩", 2, 15, "前回: 28kg x 15, 15"],
    ],
  },
  {
    id: "day4",
    label: "Day4",
    name: "腕",
    time: "50〜65分",
    exercises: [
      ["EZバーカール", "二頭", 3, 10, "前回: 32kg x 10, 9, 8"],
      ["インクラインダンベルカール", "二頭", 2, 12, "前回: 12kg x 12, 10"],
      ["ハンマーカール", "二頭", 3, 12, "前回: 16kg x 12, 12, 10"],
      ["リストカール", "前腕", 2, 15, "前回: 18kg x 15, 13"],
      ["ニュートラルグリップ・ダンベルベンチ", "三頭", 3, 10, "前回: 28kg x 10, 10, 8"],
      ["オーバーヘッドケーブルエクステンション", "三頭", 2, 12, "前回: 36kg x 12, 11"],
      ["ローププレスダウン", "三頭", 2, 15, "前回: 42kg x 15, 13"],
    ],
  },
];

let selectedDay = days[0];
let selectedProgressDay = days[0];

const dayGrid = document.querySelector("#dayGrid");
const progressDayGrid = document.querySelector("#progressDayGrid");
const workoutArea = document.querySelector("#workoutArea");
const progressArea = document.querySelector("#progressArea");
const menuEditor = document.querySelector("#menuEditor");
const exerciseTemplate = document.querySelector("#exerciseTemplate");
const screenTitle = document.querySelector("#screenTitle");

function renderDaySwitcher(container, selected, onSelect) {
  container.innerHTML = "";
  days.forEach((day) => {
    const button = document.createElement("button");
    button.className = `day-chip ${day.id === selected.id ? "active" : ""}`;
    button.innerHTML = `
      <strong>${day.label}</strong>
      <span>${day.name}</span>
    `;
    button.addEventListener("click", () => {
      onSelect(day);
    });
    container.append(button);
  });
}

function makeStepper(kind, step, initialValue = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "stepper";

  const minus = document.createElement("button");
  minus.textContent = "−";
  minus.setAttribute("aria-label", `${kind}を減らす`);

  const input = document.createElement("input");
  input.inputMode = "decimal";
  input.placeholder = kind;
  input.setAttribute("aria-label", kind);
  input.value = initialValue;

  const plus = document.createElement("button");
  plus.textContent = "+";
  plus.setAttribute("aria-label", `${kind}を増やす`);

  const update = (direction) => {
    if (!input.value && direction < 0) return;
    const current = Number(input.value || 0);
    const next = Math.max(0, current + direction * step);
    if (next === 0 && direction < 0) {
      input.value = "";
      return;
    }
    input.value = Number.isInteger(next) ? String(next) : next.toFixed(1);
  };

  minus.addEventListener("click", () => update(-1));
  plus.addEventListener("click", () => update(1));

  wrapper.append(minus, input, plus);
  return wrapper;
}

function makeSetRow(index, targetReps = "", previousWeight = "") {
  const row = document.createElement("div");
  row.className = "set-row";

  const number = document.createElement("div");
  number.className = "set-number";
  number.textContent = index;

  row.append(number, makeStepper("kg", 2.5, previousWeight), makeStepper("rep", 1, String(targetReps)));
  return row;
}

function previousWeightFrom(text) {
  const match = text.match(/(\d+(?:\.\d+)?)kg/);
  return match ? match[1] : "";
}

function renderWorkout() {
  workoutArea.innerHTML = "";

  const sessionPanel = document.createElement("div");
  sessionPanel.className = "session-panel";
  sessionPanel.innerHTML = `
    <div class="session-title">
      <span>
        <strong>${selectedDay.label} ${selectedDay.name}</strong>
      </span>
      <span class="pill">${selectedDay.time}</span>
    </div>
  `;
  workoutArea.append(sessionPanel);

  selectedDay.exercises.forEach(([name, category, sets, reps, previous]) => {
    const node = exerciseTemplate.content.firstElementChild.cloneNode(true);
    const previousWeight = previousWeightFrom(previous);
    node.querySelector(".exercise-name").textContent = name;
    node.querySelector(".exercise-sub").textContent = `${category} / 目標 ${reps}回 x ${sets}セット`;
    node.querySelector(".previous").textContent = previous;

    const list = node.querySelector(".set-list");
    for (let i = 1; i <= sets; i += 1) {
      list.append(makeSetRow(i, reps, previousWeight));
    }

    node.querySelector(".add-set").addEventListener("click", () => {
      list.append(makeSetRow(list.children.length + 1, reps, previousWeight));
    });

    node.querySelector(".exercise-main").addEventListener("click", () => {
      node.classList.toggle("collapsed");
    });

    node.querySelector(".chevron").addEventListener("click", () => {
      node.classList.toggle("collapsed");
    });

    node.querySelector(".exclude-toggle").addEventListener("click", (event) => {
      event.stopPropagation();
      node.classList.toggle("excluded");
      event.currentTarget.textContent = node.classList.contains("excluded")
        ? "スキップ中"
        : "スキップ";
    });

    workoutArea.append(node);
  });

  const finishPanel = document.createElement("div");
  finishPanel.className = "finish-panel";
  finishPanel.innerHTML = `
    <h3>セッション評価</h3>
    ${slider("パンプ", 5)}
    ${slider("出し切り感", 7)}
    ${slider("疲労感", 4)}
    <textarea class="session-memo" rows="3" placeholder="全体メモ"></textarea>
    <button class="save-button">保存する</button>
  `;
  workoutArea.append(finishPanel);
}

function renderRecordDaySwitcher() {
  renderDaySwitcher(dayGrid, selectedDay, (day) => {
    selectedDay = day;
    renderRecordDaySwitcher();
    renderWorkout();
  });
}

function renderProgressDaySwitcher() {
  renderDaySwitcher(progressDayGrid, selectedProgressDay, (day) => {
    selectedProgressDay = day;
    renderProgressDaySwitcher();
    renderProgress();
  });
}

function renderProgress() {
  progressArea.innerHTML = "";
  const total = document.createElement("div");
  total.className = "chart-card";
  total.innerHTML = `
    <div class="chart-title">
      <strong>${selectedProgressDay.label} ${selectedProgressDay.name} 総重量</strong>
      <span>各種目の最大重量合計 / 直近6回</span>
    </div>
    ${chartSvg("20,142 76,132 132,118 188,112 244,92 300,76", ["332", "341", "356", "362", "374", "381"])}
    ${dateAxis()}
  `;
  progressArea.append(total);

  const metrics = document.createElement("div");
  metrics.className = "metric-row";
  metrics.innerHTML = `
    <div>
      <span>最新 最大重量合計</span>
      <strong>${selectedProgressDay.id === "day4" ? "222" : "381"}kg</strong>
    </div>
    <div>
      <span>前回比</span>
      <strong>+4.8%</strong>
    </div>
  `;
  progressArea.append(metrics);

  const list = document.createElement("div");
  list.className = "exercise-chart-list";
  selectedProgressDay.exercises.forEach(([name, category], index) => {
    const card = document.createElement("article");
    card.className = "exercise-chart";
    card.innerHTML = `
      <div class="chart-title">
        <strong>${name}</strong>
        <span>${category} / 最大重量</span>
      </div>
      <div class="mini-chart-card">
        ${chartSvg(pointsFor(index), weightsFor(index))}
        ${dateAxis()}
      </div>
    `;
    list.append(card);
  });
  progressArea.append(list);
}

function chartSvg(points, labels = []) {
  const pointList = points.split(" ");
  const circles = pointList
    .map((point) => {
      const [x, y] = point.split(",");
      return `<circle cx="${x}" cy="${y}" r="4" />`;
    })
    .join("");
  const weightLabels = pointList
    .map((point, index) => {
      if (!labels[index]) return "";
      const [x, y] = point.split(",").map(Number);
      return `<text x="${x}" y="${Math.max(14, y - 10)}">${labels[index]}kg</text>`;
    })
    .join("");

  return `
    <div class="chart-grid"></div>
    <svg viewBox="0 0 320 180" role="img" aria-label="推移グラフ">
      <polyline points="${points}" />
      ${circles}
      ${weightLabels}
    </svg>
  `;
}

function pointsFor(index) {
  const patterns = [
    "20,138 76,128 132,126 188,108 244,96 300,82",
    "20,146 76,140 132,122 188,122 244,104 300,98",
    "20,136 76,130 132,116 188,110 244,112 300,92",
    "20,150 76,142 132,134 188,126 244,118 300,112",
    "20,132 76,136 132,120 188,112 244,106 300,88",
    "20,144 76,130 132,132 188,116 244,102 300,94",
    "20,152 76,142 132,124 188,124 244,108 300,100",
  ];
  return patterns[index % patterns.length];
}

function weightsFor(index) {
  const weights = [
    ["75", "77.5", "77.5", "80", "80", "82.5"],
    ["10", "10", "12.5", "12.5", "15", "15"],
    ["28", "28", "30", "30", "32", "32"],
    ["30", "30", "32", "32", "32", "34"],
    ["50", "52", "52", "54", "54", "56"],
    ["38", "40", "40", "42", "42", "44"],
    ["18", "18", "20", "20", "22", "22"],
  ];
  return weights[index % weights.length];
}

function dateAxis() {
  return `
    <div class="date-axis" aria-label="記録日">
      <span>5/12</span>
      <span>5/19</span>
      <span>5/26</span>
      <span>6/2</span>
      <span>6/9</span>
      <span>6/16</span>
    </div>
  `;
}

function slider(label, value) {
  return `
    <label class="slider-row">
      <span class="slider-top"><span>${label}</span><strong>${value}</strong></span>
      <input type="range" min="1" max="10" value="${value}" />
    </label>
  `;
}

function renderMenuEditor() {
  menuEditor.innerHTML = "";
  days.forEach((day) => {
    const header = document.createElement("div");
    header.className = "menu-row";
    header.innerHTML = `
      <span>
        <strong>${day.label} ${day.name}</strong>
        <small>${day.exercises.map((exercise) => exercise[0]).join(" / ")}</small>
      </span>
      <span class="handle">編集</span>
    `;
    menuEditor.append(header);
  });
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`[data-screen="${tab.dataset.target}"]`).classList.add("active");
    screenTitle.textContent = tab.textContent.trim();
  });
});

document.addEventListener("input", (event) => {
  if (event.target.matches('input[type="range"]')) {
    const value = event.target.closest(".slider-row").querySelector("strong");
    value.textContent = event.target.value;
  }
});

document.querySelector("#resetButton").addEventListener("click", renderWorkout);

renderRecordDaySwitcher();
renderWorkout();
renderProgressDaySwitcher();
renderProgress();
renderMenuEditor();
