const STORAGE_KEY = "workout-log-v1";
const DRAFT_KEY = "workout-log-draft-v1";
const LAST_BACKUP_KEY = "workout-log-last-backup-v1";
const categories = ["胸", "背中", "脚", "肩", "二頭", "三頭", "前腕", "体幹", "その他"];

window.addEventListener("error", (event) => {
  const target = document.querySelector("#appError");
  if (!target) return;
  target.hidden = false;
  target.textContent = `読み込みエラー: ${event.message}`;
});

const initialDays = [
  {
    id: "day1",
    label: "Day1",
    name: "胸＋三頭",
    time: "65〜75分",
    exercises: [
      exercise("bench-press", "ベンチプレス", "胸", 4, 6, "出力維持枠。あと1〜2回残す。"),
      exercise("dips", "ディップス", "胸", 3, 10, "10回できない場合は自重。余裕があれば加重。"),
      exercise("incline-db-press", "インクラインダンベルプレス", "胸", 3, 10, "胸上部狙い。"),
      exercise("lying-triceps-extension", "ライイングトライセプスエクステンション", "三頭", 3, 10, "三頭を重めに使う。"),
      exercise("pec-fly", "ペックフライ", "胸", 2, 15, "胸の仕上げ。"),
      exercise("rope-pressdown", "ローププレスダウン", "三頭", 2, 15, "三頭の仕上げ。"),
    ],
  },
  {
    id: "day2",
    label: "Day2",
    name: "背中＋二頭",
    time: "65〜75分",
    exercises: [
      exercise("deadlift", "デッドリフト", "背中", 3, 5, "出力維持枠。限界までは行かない。"),
      exercise("chin-up", "チンニング", "背中", 4, 8, "8回できない場合は補助あり。", { bodyweight: true }),
      exercise("seated-row", "シーテッドロー", "背中", 3, 10, ""),
      exercise("straight-arm-pulldown", "ストレートアームプルダウン", "背中", 2, 15, ""),
      exercise("incline-db-curl", "インクラインダンベルカール", "二頭", 2, 12, ""),
      exercise("machine-curl", "マシンカール", "二頭", 2, 15, ""),
    ],
  },
  {
    id: "day3",
    label: "Day3",
    name: "脚＋肩",
    time: "60〜75分",
    exercises: [
      exercise("v-squat", "Vスクワット", "脚", 4, 5, "脚のメイン。重めで、あと1〜2回残す。"),
      exercise("leg-press", "レッグプレス", "脚", 3, 8, "重め。パンプより出力補助を重視する。"),
      exercise("bulgarian-squat", "ブルガリアンスクワット", "脚", 2, 8, "追い込みすぎない。"),
      exercise("side-raise", "サイドレイズ", "肩", 3, 20, "肩の横幅狙い。"),
      exercise("machine-shoulder-press", "マシンショルダープレス", "肩", 3, 10, "肩の押す力とボリューム補助。"),
      exercise("face-pull", "フェイスプル", "肩", 2, 15, "肩後部狙い。重くしすぎない。"),
    ],
  },
  {
    id: "day4",
    label: "Day4",
    name: "腕",
    time: "50〜65分",
    exercises: [
      exercise("ez-bar-curl", "EZバーカール", "二頭", 3, 10, "二頭の重め枠。反動を使いすぎない。"),
      exercise("incline-db-curl-day4", "インクラインダンベルカール", "二頭", 2, 12, "二頭のストレッチ狙い。"),
      exercise("hammer-curl", "ハンマーカール", "二頭", 3, 12, "腕の厚みと腕橈骨筋狙い。"),
      exercise("wrist-curl", "リストカール", "前腕", 2, 15, "余裕がある日のみ。前腕内側狙い。"),
      exercise("neutral-db-bench", "ニュートラルグリップ・ダンベルベンチ", "三頭", 3, 10, "三頭の重め枠。"),
      exercise("overhead-cable-extension", "オーバーヘッドケーブルエクステンション", "三頭", 2, 12, "三頭長頭狙い。"),
      exercise("rope-pressdown-day4", "ローププレスダウン", "三頭", 2, 15, "三頭の仕上げ。"),
    ],
  },
];

function exercise(id, name, category, targetSets, targetReps, note, options = {}) {
  return { id, name, category, targetSets, targetReps, note, enabled: true, bodyweight: Boolean(options.bodyweight) };
}

let state = loadState();
let selectedDayId = state.menu[0].id;
let selectedProgressDayId = state.menu[0].id;
let draft = null;
let editingSessionId = null;

const dayGrid = document.querySelector("#dayGrid");
const progressDayGrid = document.querySelector("#progressDayGrid");
const workoutArea = document.querySelector("#workoutArea");
const progressArea = document.querySelector("#progressArea");
const menuEditor = document.querySelector("#menuEditor");
const historyList = document.querySelector("#historyList");
const screenTitle = document.querySelector("#screenTitle");
const exerciseTemplate = document.querySelector("#exerciseTemplate");
const toast = document.querySelector("#toast");
const backupStatus = document.querySelector("#backupStatus");
const sheetRoot = document.querySelector("#sheet");
const sheetTitle = document.querySelector("#sheetTitle");
const sheetForm = document.querySelector("#sheetForm");
const sheetClose = document.querySelector("#sheetClose");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.menu) && Array.isArray(parsed.sessions)) return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return { menu: clone(initialDays), sessions: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadDraft() {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function saveDraft() {
  if (!draft || editingSessionId) return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function selectedDay() {
  return state.menu.find((day) => day.id === selectedDayId) || state.menu[0];
}

function selectedProgressDay() {
  return state.menu.find((day) => day.id === selectedProgressDayId) || state.menu[0];
}

function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function shortDate(date) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function renderDaySwitcher(container, selectedId, onSelect) {
  container.innerHTML = "";
  state.menu.forEach((day) => {
    const button = document.createElement("button");
    button.className = `day-chip ${day.id === selectedId ? "active" : ""}`;
    button.innerHTML = `<strong>${day.label}</strong><span>${day.name}</span>`;
    button.addEventListener("click", () => onSelect(day.id));
    container.append(button);
  });
}

function ensureDraft() {
  const savedDraft = loadDraft();
  if (!editingSessionId && savedDraft && savedDraft.dayId === selectedDayId) {
    draft = savedDraft;
    return;
  }
  const day = selectedDay();
  draft = {
    id: uniqueId(),
    date: todayIso(),
    dayId: day.id,
    dayLabel: day.label,
    dayName: day.name,
    ratings: { pump: 5, effort: 7, fatigue: 4 },
    memo: "",
    exercises: day.exercises
      .filter((item) => item.enabled)
      .map((item) => {
        const last = lastExerciseRecord(item.id);
        const previousWeight = last && last.maxWeight ? String(last.maxWeight) : "";
        return {
          exerciseId: item.id,
          name: item.name,
          category: item.category,
          targetSets: item.targetSets,
          targetReps: item.targetReps,
          bodyweight: Boolean(item.bodyweight),
          skipped: false,
          memo: "",
          sets: Array.from({ length: item.targetSets }, (_, index) => ({
            setNumber: index + 1,
            weight: previousWeight,
            reps: String(item.targetReps),
          })),
        };
      }),
  };
  saveDraft();
}

function lastExerciseRecord(exerciseId) {
  for (const session of [...state.sessions].reverse()) {
    const item = session.exercises.find((entry) => entry.exerciseId === exerciseId && !entry.skipped);
    if (item) return { ...item, sessionDate: session.date };
  }
  return null;
}

function previousText(exerciseId) {
  const last = lastExerciseRecord(exerciseId);
  if (!last) return "前回: なし";
  const reps = last.sets.map((set) => cleanNumber(set.reps)).filter(Boolean).join(", ");
  return `前回: ${last.maxWeight || "-"}kg x ${reps || "-"}`;
}

function renderRecord() {
  renderDaySwitcher(dayGrid, selectedDayId, (id) => {
    selectedDayId = id;
    ensureDraft();
    renderRecord();
  });

  if (!draft || draft.dayId !== selectedDayId) ensureDraft();
  workoutArea.innerHTML = "";

  const day = selectedDay();
  const sessionPanel = document.createElement("div");
  sessionPanel.className = "session-panel";
  sessionPanel.innerHTML = `
    <div class="session-title">
      <span>
        <strong>${day.label} ${day.name}${editingSessionId ? "（編集中）" : ""}</strong>
        <input class="date-input" type="date" value="${draft.date}" aria-label="記録日" />
      </span>
      <span class="pill">${day.time}</span>
    </div>
  `;
  sessionPanel.querySelector(".date-input").addEventListener("input", (event) => {
    draft.date = event.target.value || todayIso();
    saveDraft();
  });
  workoutArea.append(sessionPanel);

  draft.exercises.forEach((entry, exerciseIndex) => {
    const node = exerciseTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.exerciseId = entry.exerciseId;
    node.classList.toggle("excluded", entry.skipped);
    node.querySelector(".exercise-name").textContent = entry.name;
    node.querySelector(".exercise-sub").textContent = `${entry.category}${entry.bodyweight ? " / 自重" : ""} / 目標 ${entry.targetReps}回 x ${entry.targetSets}セット`;
    node.querySelector(".previous").textContent = previousText(entry.exerciseId);
    node.querySelector(".exclude-toggle").textContent = entry.skipped ? "スキップ中" : "スキップ";

    const list = node.querySelector(".set-list");
    entry.sets.forEach((set, setIndex) => {
      list.append(makeSetRow(exerciseIndex, setIndex, set));
    });

    node.querySelector(".add-set").addEventListener("click", () => {
      entry.sets.push({ setNumber: entry.sets.length + 1, weight: (lastItem(entry.sets) && lastItem(entry.sets).weight) || "", reps: String(entry.targetReps) });
      renumberSets(entry);
      saveDraft();
      renderRecord();
    });
    node.querySelector(".exercise-main").addEventListener("click", () => node.classList.toggle("collapsed"));
    node.querySelector(".chevron").addEventListener("click", () => node.classList.toggle("collapsed"));
    node.querySelector(".exclude-toggle").addEventListener("click", () => {
      entry.skipped = !entry.skipped;
      saveDraft();
      renderRecord();
    });
    node.querySelector(".swap-action").addEventListener("click", () => {
      openSubstituteSheet(entry);
    });
    node.querySelector(".memo").value = entry.memo;
    node.querySelector(".memo").addEventListener("input", (event) => {
      entry.memo = event.target.value;
      saveDraft();
    });
    workoutArea.append(node);
  });

  const finishPanel = document.createElement("div");
  finishPanel.className = "finish-panel";
  finishPanel.innerHTML = `
    <h3>セッション評価</h3>
    ${slider("pump", "パンプ", draft.ratings.pump)}
    ${slider("effort", "出し切り感", draft.ratings.effort)}
    ${slider("fatigue", "疲労感", draft.ratings.fatigue)}
    <textarea class="session-memo" rows="3" placeholder="全体メモ">${draft.memo}</textarea>
    <button class="save-button">保存する</button>
  `;
  finishPanel.querySelectorAll('input[type="range"]').forEach((input) => {
    input.addEventListener("input", (event) => {
      draft.ratings[input.dataset.key] = Number(event.target.value);
      input.closest(".slider-row").querySelector("strong").textContent = event.target.value;
      saveDraft();
    });
  });
  finishPanel.querySelector(".session-memo").addEventListener("input", (event) => {
    draft.memo = event.target.value;
    saveDraft();
  });
  finishPanel.querySelector(".save-button").addEventListener("click", saveDraftSession);
  workoutArea.append(finishPanel);
}

function makeSetRow(exerciseIndex, setIndex, set) {
  const row = document.createElement("div");
  row.className = "set-row";
  const number = document.createElement("div");
  number.className = "set-number";
  number.textContent = setIndex + 1;
  const entry = draft.exercises[exerciseIndex];
  const deleteButton = document.createElement("button");
  deleteButton.className = "set-delete";
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", "セットを削除");
  deleteButton.disabled = setIndex < entry.targetSets;
  if (deleteButton.disabled) deleteButton.title = "目標セットは削除できません";
  deleteButton.addEventListener("click", () => {
    if (deleteButton.disabled) return;
    if (entry.sets.length <= 1) return showToast("最低1セットは必要です");
    entry.sets.splice(setIndex, 1);
    renumberSets(entry);
    saveDraft();
    renderRecord();
  });
  row.append(
    number,
    makeStepper("kg", 2.5, set.weight, (value) => {
      set.weight = value;
      saveDraft();
    }),
    makeStepper("rep", 1, set.reps, (value) => {
      set.reps = value;
      saveDraft();
    }),
    deleteButton
  );
  return row;
}

function renumberSets(entry) {
  entry.sets.forEach((set, index) => {
    set.setNumber = index + 1;
  });
}

function makeStepper(kind, step, initialValue, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "stepper";
  const minus = document.createElement("button");
  minus.textContent = "−";
  const input = document.createElement("input");
  input.inputMode = "decimal";
  input.placeholder = kind;
  input.value = initialValue || "";
  const plus = document.createElement("button");
  plus.textContent = "+";
  const setValue = (value) => {
    input.value = value;
    onChange(value);
  };
  const update = (direction) => {
    if (!input.value && direction < 0) return;
    const current = Number(input.value || 0);
    const next = Math.max(0, current + direction * step);
    if (next === 0 && direction < 0) return setValue("");
    setValue(Number.isInteger(next) ? String(next) : next.toFixed(1));
  };
  minus.addEventListener("click", () => update(-1));
  plus.addEventListener("click", () => update(1));
  input.addEventListener("input", () => onChange(input.value));
  wrapper.append(minus, input, plus);
  return wrapper;
}

function slider(key, label, value) {
  return `
    <label class="slider-row">
      <span class="slider-top"><span>${label}</span><strong>${value}</strong></span>
      <input type="range" min="1" max="10" value="${value}" data-key="${key}" />
    </label>
  `;
}

function saveDraftSession() {
  const warnings = validateDraft(draft);
  if (warnings.length && !window.confirm(`${warnings.join("\n")}\n\nこのまま保存しますか？`)) return;
  const duplicate = state.sessions.find((session) => session.id !== editingSessionId && session.date === draft.date && session.dayId === draft.dayId);
  if (duplicate && !window.confirm(`${draft.date} の ${draft.dayLabel} は既に保存済みです。\n別記録として保存しますか？`)) return;
  const session = normalizeSession(draft);
  if (editingSessionId) {
    state.sessions = state.sessions.map((item) => (item.id === editingSessionId ? { ...session, id: editingSessionId } : item));
    editingSessionId = null;
  } else {
    state.sessions.push(session);
  }
  saveState();
  clearDraft();
  ensureDraft();
  renderAll();
  showToast("保存しました");
}

function validateDraft(source) {
  const warnings = [];
  const activeExercises = source.exercises.filter((entry) => !entry.skipped);
  if (activeExercises.length === 0) warnings.push("全種目がスキップされています。");
  activeExercises.forEach((entry) => {
    const emptyReps = entry.sets.some((set) => cleanNumber(set.reps) === "");
    const emptyWeight = !entry.bodyweight && entry.sets.some((set) => cleanNumber(set.weight) === "");
    if (emptyWeight || emptyReps) {
      warnings.push(`${entry.name}: 未入力の${emptyWeight && emptyReps ? "重量/レップ" : emptyWeight ? "重量" : "レップ"}があります。`);
    }
  });
  return warnings;
}

function normalizeSession(source) {
  return {
    ...source,
    savedAt: new Date().toISOString(),
    exercises: source.exercises.map((entry) => {
      const sets = entry.sets.map((set, index) => ({
        setNumber: index + 1,
        weight: cleanNumber(set.weight),
        reps: cleanNumber(set.reps),
      }));
      return {
        ...entry,
        sets,
        maxWeight: entry.skipped ? 0 : Math.max(0, ...sets.map((set) => set.weight || 0)),
      };
    }),
  };
}

function cleanNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function renderHistory() {
  historyList.innerHTML = "";
  if (state.sessions.length === 0) {
    historyList.innerHTML = `<div class="empty-state">まだ記録がありません。</div>`;
    return;
  }
  [...state.sessions].reverse().forEach((session) => {
    const button = document.createElement("button");
    button.className = "history-item";
    const summary = session.exercises
      .filter((item) => !item.skipped)
      .slice(0, 2)
      .map((item) => `${item.name} ${item.maxWeight || "-"}kg`)
      .join(" / ");
    button.innerHTML = `
      <span class="date">${shortDate(session.date)}</span>
      <span>
        <strong>${session.dayLabel} ${session.dayName}</strong>
        <small>${summary || "全種目スキップ"}</small>
      </span>
    `;
    button.addEventListener("click", () => showHistoryDetail(session));
    historyList.append(button);
  });
}

function showHistoryDetail(session) {
  const details = session.exercises
    .map((item) => {
      const sets = item.skipped
        ? "スキップ"
        : item.sets.map((set) => `${set.weight || "-"}kg x ${set.reps || "-"}`).join(", ");
      return `
        <div class="detail-item">
          <strong>${escapeHtml(item.name)}${item.isSubstitute ? "（代替）" : ""}</strong>
          <small>${escapeHtml(sets)}</small>
          ${item.memo ? `<small>メモ: ${escapeHtml(item.memo)}</small>` : ""}
        </div>
      `;
    })
    .join("");
  openSheet({
    title: `${session.date} ${session.dayLabel} ${session.dayName}`,
    body: `
      <div class="detail-list">${details}</div>
      ${session.memo ? `<div class="detail-item"><strong>全体メモ</strong><small>${escapeHtml(session.memo)}</small></div>` : ""}
    `,
    submitLabel: "閉じる",
    cancelLabel: "",
    extraActions: `
      <button type="button" data-action="edit">編集</button>
      <button type="button" class="danger" data-action="delete">この記録を削除</button>
    `,
    onAction: (action) => {
      if (action === "edit") {
        editingSessionId = session.id;
        selectedDayId = session.dayId;
        draft = clone(session);
        closeSheet();
        activateTab("record");
        renderRecord();
        showToast("記録を編集できます");
        return;
      }
      if (action !== "delete") return;
      if (!window.confirm("この記録を削除しますか？")) return;
      state.sessions = state.sessions.filter((item) => item.id !== session.id);
      saveState();
      closeSheet();
      renderAll();
      showToast("記録を削除しました");
    },
    onSubmit: () => {},
  });
}

function renderProgressDaySwitcher() {
  renderDaySwitcher(progressDayGrid, selectedProgressDayId, (id) => {
    selectedProgressDayId = id;
    renderProgressDaySwitcher();
    renderProgress();
  });
}

function renderProgress() {
  const day = selectedProgressDay();
  const sessions = state.sessions.filter((session) => session.dayId === day.id).slice(-8);
  progressArea.innerHTML = "";
  if (sessions.length === 0) {
    progressArea.innerHTML = `<div class="empty-state">まだ${day.label}の記録がありません。</div>`;
    return;
  }

  const totals = sessions.map((session) => session.exercises.filter((item) => !item.skipped && !item.isSubstitute).reduce((sum, item) => sum + (item.maxWeight || 0), 0));
  progressArea.append(chartCard(`${day.label} ${day.name} 総重量`, "各種目の最大重量合計", sessions, totals, "kg", "chart-card"));

  const latest = lastItem(totals) || 0;
  const previous = totals.length > 1 ? totals[totals.length - 2] : latest;
  const diff = previous ? (((latest - previous) / previous) * 100).toFixed(1) : "0.0";
  const metrics = document.createElement("div");
  metrics.className = "metric-row";
  metrics.innerHTML = `
    <div><span>最新 最大重量合計</span><strong>${latest}kg</strong></div>
    <div><span>前回比</span><strong>${Number(diff) >= 0 ? "+" : ""}${diff}%</strong></div>
  `;
  progressArea.append(metrics);

  const list = document.createElement("div");
  list.className = "exercise-chart-list";
  day.exercises.filter((item) => item.enabled).forEach((exerciseItem) => {
    const values = sessions.map((session) => {
      const entry = session.exercises.find((item) => item.exerciseId === exerciseItem.id && !item.skipped);
      return entry ? entry.maxWeight || 0 : 0;
    });
    const card = document.createElement("article");
    card.className = "exercise-chart";
    card.innerHTML = `<div class="chart-title"><strong>${exerciseItem.name}</strong><span>${exerciseItem.category} / 最大重量</span></div>`;
    card.append(chartCardBody(sessions, values, "kg", "mini-chart-card"));
    list.append(card);
  });
  progressArea.append(list);
}

function chartCard(title, subtitle, sessions, values, unit, className) {
  const card = document.createElement("div");
  card.className = className;
  card.innerHTML = `<div class="chart-title"><strong>${title}</strong><span>${subtitle}</span></div>`;
  card.append(chartCardBody(sessions, values, unit, ""));
  return card;
}

function chartCardBody(sessions, values, unit, className) {
  const wrapper = document.createElement("div");
  if (className) wrapper.className = className;
  const max = Math.max(1, ...values);
  const min = Math.min(...values, max);
  const span = Math.max(1, max - min);
  const step = values.length > 1 ? 280 / (values.length - 1) : 0;
  const points = values.map((value, index) => `${20 + step * index},${148 - ((value - min) / span) * 86}`).join(" ");
  const labels = values.map((value) => (value ? `${value}${unit}` : "-"));
  wrapper.innerHTML = `
    <div class="chart-grid"></div>
    <svg viewBox="0 0 320 180" role="img" aria-label="推移グラフ">
      <polyline points="${points}" />
      ${points.split(" ").map((point) => {
        const [x, y] = point.split(",");
        return `<circle cx="${x}" cy="${y}" r="4" />`;
      }).join("")}
      ${points.split(" ").map((point, index) => {
        const [x, y] = point.split(",").map(Number);
        return `<text x="${x}" y="${Math.max(14, y - 10)}">${labels[index]}</text>`;
      }).join("")}
    </svg>
    <div class="date-axis">${sessions.map((session) => `<span>${shortDate(session.date)}</span>`).join("")}</div>
  `;
  return wrapper;
}

function renderMenuEditor() {
  menuEditor.innerHTML = "";
  state.menu.forEach((day) => {
    const row = document.createElement("div");
    row.className = "menu-row";
    row.innerHTML = `
      <span>
        <strong>${day.label} ${day.name}</strong>
        <small>${day.exercises.filter((item) => item.enabled).map((item) => item.name).join(" / ")}</small>
      </span>
      <span class="handle">編集</span>
    `;
    row.addEventListener("click", () => editDay(day));
    menuEditor.append(row);
    day.exercises.forEach((item) => {
      const exerciseRow = document.createElement("button");
      exerciseRow.className = `menu-exercise-row ${item.enabled ? "" : "disabled"}`;
      exerciseRow.innerHTML = `
        <span>
          <strong>${item.name}</strong>
          <small>${item.category} / ${item.targetReps}回 x ${item.targetSets}セット</small>
        </span>
        <span class="handle">${item.enabled ? "編集" : "無効"}</span>
      `;
      exerciseRow.addEventListener("click", () => editExercise(day, item));
      menuEditor.append(exerciseRow);
    });
  });
}

function editDay(day) {
  openSheet({
    title: `${day.label}を編集`,
    body: `
      <label class="form-field"><span>表示名</span><input name="name" value="${escapeHtml(day.name)}" required /></label>
      <label class="form-field"><span>想定時間</span><input name="time" value="${escapeHtml(day.time)}" /></label>
    `,
    onSubmit: (form) => {
      day.name = form.name.value.trim();
      day.time = form.time.value.trim() || day.time;
      saveState();
      ensureDraft();
      renderAll();
      showToast("Dayを更新しました");
    },
  });
}

function editExercise(day, item) {
  openSheet({
    title: "種目を編集",
    body: exerciseFormFields(item),
    extraActions: `<button type="button" class="danger" data-action="delete">削除</button>`,
    onSubmit: (form) => {
      applyExerciseForm(item, form);
      saveState();
      ensureDraft();
      renderAll();
      showToast("種目を更新しました");
    },
    onAction: (action) => {
      if (action !== "delete") return;
      day.exercises = day.exercises.filter((exerciseItem) => exerciseItem.id !== item.id);
      saveState();
      ensureDraft();
      closeSheet();
      renderAll();
      showToast("種目を削除しました");
    },
  });
}

function addExercise() {
  const blank = exercise("", "", "その他", 3, 10, "");
  openSheet({
    title: "種目を追加",
    body: `
      <label class="form-field">
        <span>追加するDay</span>
        <select name="dayId">${state.menu.map((day) => `<option value="${day.id}">${day.label} ${escapeHtml(day.name)}</option>`).join("")}</select>
      </label>
      ${exerciseFormFields(blank)}
    `,
    onSubmit: (form) => {
      const day = state.menu.find((item) => item.id === form.dayId.value);
      if (!day) return;
      const item = exercise(uniqueId(), "", "その他", 3, 10, "");
      applyExerciseForm(item, form);
      day.exercises.push(item);
      saveState();
      ensureDraft();
      renderAll();
      showToast("種目を追加しました");
    },
  });
}

function filteredSessions(form) {
  const from = form && form.from ? form.from.value : "";
  const to = form && form.to ? form.to.value : "";
  const dayId = form && form.dayId ? form.dayId.value : "";
  const exerciseName = form && form.exerciseName ? form.exerciseName.value.trim() : "";
  return state.sessions.filter((session) => {
    if (from && session.date < from) return false;
    if (to && session.date > to) return false;
    if (dayId && session.dayId !== dayId) return false;
    if (exerciseName && !session.exercises.some((item) => item.name.includes(exerciseName))) return false;
    return true;
  });
}

function exportFilterFields() {
  return `
    <div class="form-grid">
      <label class="form-field"><span>開始日</span><input name="from" type="date" /></label>
      <label class="form-field"><span>終了日</span><input name="to" type="date" /></label>
    </div>
    <label class="form-field">
      <span>Day</span>
      <select name="dayId">
        <option value="">すべて</option>
        ${state.menu.map((day) => `<option value="${day.id}">${day.label} ${escapeHtml(day.name)}</option>`).join("")}
      </select>
    </label>
    <label class="form-field"><span>種目名を含む</span><input name="exerciseName" placeholder="例: ベンチ" /></label>
  `;
}

function openCsvExportSheet() {
  openSheet({
    title: "CSV出力",
    body: exportFilterFields(),
    submitLabel: "出力",
    onSubmit: (form) => downloadCsv(filteredSessions(form)),
  });
}

function openSummaryExportSheet() {
  openSheet({
    title: "LLM用サマリー",
    body: exportFilterFields(),
    submitLabel: "コピー",
    onSubmit: (form) => copySummary(filteredSessions(form)),
  });
}

function downloadCsv(sessions = state.sessions) {
  const rows = [["date", "day", "exercise", "category", "set", "weight", "reps", "skipped", "exercise_memo", "session_memo"]];
  sessions.forEach((session) => {
    session.exercises.forEach((exerciseItem) => {
      if (exerciseItem.skipped) {
        rows.push([session.date, session.dayName, exerciseItem.name, exerciseItem.category, "", "", "", "true", exerciseItem.memo || "", session.memo || ""]);
      } else {
        exerciseItem.sets.forEach((set) => {
          rows.push([session.date, session.dayName, exerciseItem.name, exerciseItem.category, set.setNumber, set.weight, set.reps, "false", exerciseItem.memo || "", session.memo || ""]);
        });
      }
    });
  });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `workout-log-${todayIso()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value == null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function copySummary(sessions = state.sessions.slice(-8)) {
  const lines = sessions.map((session) => {
    const exercises = session.exercises
      .filter((item) => !item.skipped)
      .map((item) => `- ${item.name}: ${item.sets.map((set) => `${set.weight || "-"}kg x ${set.reps || "-"}`).join(", ")}`)
      .join("\n");
    return `${session.date} ${session.dayLabel} ${session.dayName}\n${exercises}\nメモ: ${session.memo || "-"}`;
  });
  await navigator.clipboard.writeText(lines.join("\n\n"));
  showToast("コピーしました");
}

function backupFileName() {
  return `workout-backup-${todayIso()}.json`;
}

function backupBlob() {
  return new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
}

function markBackedUp() {
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  renderBackupStatus();
}

function exportJson() {
  const blob = backupBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName();
  link.click();
  URL.revokeObjectURL(url);
  markBackedUp();
  showToast("バックアップを書き出しました");
}

async function shareJson() {
  const file = new File([backupBlob()], backupFileName(), { type: "application/json" });
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "筋トレログ バックアップ",
        text: "筋トレログのJSONバックアップです。",
      });
      markBackedUp();
      showToast("共有しました");
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  exportJson();
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const nextState = JSON.parse(reader.result);
      if (!Array.isArray(nextState.menu) || !Array.isArray(nextState.sessions)) throw new Error("invalid");
      if (!window.confirm("現在の保存データをバックアップ内容で置き換えますか？")) return;
      state = nextState;
      selectedDayId = state.menu[0].id;
      selectedProgressDayId = state.menu[0].id;
      editingSessionId = null;
      clearDraft();
      saveState();
      ensureDraft();
      renderAll();
      showToast("復元しました");
    } catch {
      showToast("読み込みに失敗しました");
    }
  };
  reader.readAsText(file);
}

async function persistStorage() {
  if (!navigator.storage || typeof navigator.storage.persist !== "function") {
    showToast("このブラウザでは未対応です");
    renderBackupStatus();
    return;
  }
  const persisted = await navigator.storage.persist();
  renderBackupStatus();
  showToast(persisted ? "保存データを保護しました" : "ブラウザ側で許可されませんでした");
}

async function renderBackupStatus() {
  if (!backupStatus) return;
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  let storageText = "端末保存: 未確認";
  if (navigator.storage && typeof navigator.storage.persisted === "function") {
    try {
      storageText = (await navigator.storage.persisted()) ? "端末保存: 保護済み" : "端末保存: 通常";
    } catch {
      storageText = "端末保存: 未確認";
    }
  }
  const backupText = lastBackup ? `最終バックアップ: ${shortDate(lastBackup.slice(0, 10))}` : "最終バックアップ: なし";
  backupStatus.textContent = `${backupText} / ${storageText}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function openSubstituteSheet(entry) {
  const options = state.menu
    .flatMap((day) => day.exercises.filter((item) => item.enabled))
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)} / ${item.category}</option>`)
    .join("");
  openSheet({
    title: "今回だけ代替",
    body: `
      <label class="form-field">
        <span>登録済み種目から選ぶ</span>
        <select name="exerciseId">
          <option value="">自由入力する</option>
          ${options}
        </select>
      </label>
      <label class="form-field"><span>代替種目名</span><input name="name" value="${escapeHtml(entry.name)}" required /></label>
      <label class="form-field">
        <span>カテゴリ</span>
        <select name="category">${categoryOptions(entry.category)}</select>
      </label>
      <div class="form-grid">
        <label class="form-field"><span>目標セット</span><input name="targetSets" type="number" min="1" value="${entry.targetSets}" /></label>
        <label class="form-field"><span>目標レップ</span><input name="targetReps" type="number" min="1" value="${entry.targetReps}" /></label>
      </div>
      <label class="checkbox-field"><input name="bodyweight" type="checkbox" ${entry.bodyweight ? "checked" : ""} /><span>自重種目</span></label>
    `,
    onMount: (form) => {
      form.exerciseId.addEventListener("change", () => {
        const selected = findExercise(form.exerciseId.value);
        if (!selected) return;
        form.name.value = selected.name;
        form.category.value = selected.category;
        form.targetSets.value = selected.targetSets;
        form.targetReps.value = selected.targetReps;
        form.bodyweight.checked = Boolean(selected.bodyweight);
      });
    },
    onSubmit: (form) => {
      const selected = findExercise(form.exerciseId.value);
      entry.originalExerciseId ||= entry.exerciseId;
      entry.exerciseId = `sub-${uniqueId()}`;
      entry.name = form.name.value.trim();
      entry.category = form.category.value;
      entry.targetSets = numberOr(form.targetSets.value, entry.targetSets);
      entry.targetReps = numberOr(form.targetReps.value, entry.targetReps);
      entry.bodyweight = Boolean(form.bodyweight.checked);
      entry.isSubstitute = true;
      entry.skipped = false;
      entry.sets = Array.from({ length: entry.targetSets }, (_, index) => ({
        setNumber: index + 1,
        weight: selected ? String((lastExerciseRecord(selected.id) || {}).maxWeight || "") : "",
        reps: String(entry.targetReps),
      }));
      renderRecord();
      showToast("代替しました");
    },
  });
}

function findExercise(id) {
  if (!id) return null;
  return state.menu.flatMap((day) => day.exercises).find((item) => item.id === id) || null;
}

function exerciseFormFields(item) {
  return `
    <label class="form-field"><span>種目名</span><input name="name" value="${escapeHtml(item.name)}" required /></label>
    <label class="form-field">
      <span>カテゴリ</span>
      <select name="category">${categoryOptions(item.category)}</select>
    </label>
    <div class="form-grid">
      <label class="form-field"><span>目標セット</span><input name="targetSets" type="number" min="1" value="${item.targetSets}" /></label>
      <label class="form-field"><span>目標レップ</span><input name="targetReps" type="number" min="1" value="${item.targetReps}" /></label>
    </div>
    <label class="form-field"><span>メモ/方針</span><textarea name="note" rows="3">${escapeHtml(item.note || "")}</textarea></label>
    <label class="checkbox-field"><input name="bodyweight" type="checkbox" ${item.bodyweight ? "checked" : ""} /><span>自重種目</span></label>
    <label class="checkbox-field"><input name="enabled" type="checkbox" ${item.enabled ? "checked" : ""} /><span>有効</span></label>
  `;
}

function categoryOptions(selected) {
  return categories.map((category) => `<option value="${category}" ${category === selected ? "selected" : ""}>${category}</option>`).join("");
}

function applyExerciseForm(item, form) {
  item.name = form.name.value.trim();
  item.category = categories.includes(form.category.value) ? form.category.value : "その他";
  item.targetSets = numberOr(form.targetSets.value, item.targetSets);
  item.targetReps = numberOr(form.targetReps.value, item.targetReps);
  item.note = form.note ? form.note.value.trim() : "";
  item.bodyweight = Boolean(form.bodyweight && form.bodyweight.checked);
  item.enabled = Boolean(form.enabled && form.enabled.checked);
}

function openSheet({ title, body, onSubmit, onAction, onMount, submitLabel = "保存", cancelLabel = "キャンセル", extraActions = "" }) {
  sheetTitle.textContent = title;
  sheetForm.innerHTML = `
    ${body}
    <div class="sheet-actions">
      ${cancelLabel ? `<button type="button" data-action="cancel">${cancelLabel}</button>` : ""}
      ${extraActions}
      <button type="submit" class="primary">${submitLabel}</button>
    </div>
  `;
  sheetRoot.hidden = false;
  sheetForm.onsubmit = (event) => {
    event.preventDefault();
    if (onSubmit) onSubmit(sheetForm);
    closeSheet();
  };
  sheetForm.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "cancel") return closeSheet();
      if (onAction) onAction(action, sheetForm);
    });
  });
  if (onMount) onMount(sheetForm);
}

function closeSheet() {
  sheetRoot.hidden = true;
  sheetForm.innerHTML = "";
  sheetForm.onsubmit = null;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function lastItem(items) {
  return items.length ? items[items.length - 1] : undefined;
}

function resetData() {
  if (!window.confirm("保存済みの記録とメニュー編集をすべて初期化しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  selectedDayId = state.menu[0].id;
  selectedProgressDayId = state.menu[0].id;
  ensureDraft();
  renderAll();
  showToast("初期化しました");
}

function renderAll() {
  renderDaySwitcher(dayGrid, selectedDayId, (id) => {
    selectedDayId = id;
    ensureDraft();
    renderRecord();
  });
  renderRecord();
  renderHistory();
  renderProgressDaySwitcher();
  renderProgress();
  renderMenuEditor();
  renderBackupStatus();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.target));
});

document.querySelector("#resetButton").addEventListener("click", () => {
  if (!window.confirm("入力中の内容を破棄しますか？")) return;
  editingSessionId = null;
  clearDraft();
  ensureDraft();
  renderRecord();
});
document.querySelector("#downloadCsv").addEventListener("click", openCsvExportSheet);
document.querySelector("#copySummary").addEventListener("click", openSummaryExportSheet);
document.querySelector("#addExercise").addEventListener("click", addExercise);
document.querySelector("#resetData").addEventListener("click", resetData);
document.querySelector("#shareJson").addEventListener("click", shareJson);
document.querySelector("#exportJson").addEventListener("click", exportJson);
document.querySelector("#persistStorage").addEventListener("click", persistStorage);
document.querySelector("#importJson").addEventListener("click", () => document.querySelector("#importJsonFile").click());
document.querySelector("#importJsonFile").addEventListener("change", (event) => importJson(event.target.files[0]));
sheetClose.addEventListener("click", closeSheet);
sheetRoot.addEventListener("click", (event) => {
  if (event.target === sheetRoot) closeSheet();
});

ensureDraft();
renderAll();

function activateTab(target) {
  document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item.dataset.target === target));
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === target));
  const tab = document.querySelector(`.tab[data-target="${target}"]`);
  screenTitle.textContent = tab ? tab.textContent.trim() : "";
}
