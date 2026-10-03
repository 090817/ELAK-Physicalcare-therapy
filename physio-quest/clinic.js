const clinic = { code: null, patient: "", note: "", rows: [], visitIndex: null, writingVisit: false, switchingLogin: false, creating: false, filmsOpen: false, listMode: "current", page: "home", savingVisit: false };
const $c = (id) => document.getElementById(id);

function blankRow() {
  const days = $c("clinic-days") ? clamp(Number($c("clinic-days").value) || 7, 1, 7) : 7;
  return { pattern: "", reps: 6, cue: "", note: "", cueTouched: false, essential: true, minBout: 1, daysPerWeek: days };
}
function defaultUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return dayKey(d);
}
function injuryValue() {
  return ($c("clinic-injury") && $c("clinic-injury").value || "").trim();
}
function syncInjuryLine(plan) {
  const injury = (plan && plan.injury) || "";
  const wrap = $c("account-injury-wrap");
  const line = $c("account-injury-line");
  if (wrap) wrap.hidden = !injury;
  if (line) line.textContent = injury;
}
function fillMin(value) {
  const n = clamp(Number(value) || 1, 1, 5);
  if ($c("clinic-min-choice")) $c("clinic-min-choice").value = String(n);
}
function doseMin() {
  return clamp(Number($c("clinic-min-choice") && $c("clinic-min-choice").value) || 1, 1, 5);
}
function leadDays() {
  return clamp(Number($c("clinic-lead-days") && $c("clinic-lead-days").value) || 14, 1, 90);
}
function untilFromLead(days) {
  const d = new Date();
  d.setDate(d.getDate() + (days || leadDays()));
  return dayKey(d);
}
function fillDose(cycle) {
  const days = cycle && cycle.periodStart && cycle.periodEnd
    ? clamp(Math.round((new Date(cycle.periodEnd) - new Date(cycle.periodStart)) / 86400000) || 14, 1, 90)
    : 14;
  if ($c("clinic-lead-days")) $c("clinic-lead-days").value = String((cycle && cycle.daysUntilNext) || days);
  if ($c("clinic-until")) $c("clinic-until").value = untilFromLead(leadDays());
  if ($c("clinic-part")) $c("clinic-part").value = clockFromPart(cycle && cycle.timeOfDay);
  if ($c("clinic-days")) $c("clinic-days").value = String((cycle && cycle.daysPerWeek) || 7);
  fillMin(cycle && cycle.minBout);
}
function listedPlans() {
  const data = loadPlans();
  const mine = AUTH_OFF ? "" : (authRecord() ? authRecord().id : "");
  const archived = clinic.listMode === "archive";
  return Object.values(data.plans)
    .filter((plan) => !mine || plan.clinicianId === mine)
    .filter((plan) => archived ? !!plan.archived : !plan.archived)
    .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
}
function setPatientArchived(code, archived) {
  if (!code) return null;
  const data = loadPlans();
  const plan = data.plans[code];
  if (!plan) return null;
  plan.archived = !!archived;
  plan.updated = new Date().toISOString();
  savePlans(data);
  return plan;
}
function syncTabs() {
  if ($c("tab-current")) $c("tab-current").classList.toggle("sel", clinic.page === "list" && clinic.listMode === "current");
  if ($c("tab-archive")) $c("tab-archive").classList.toggle("sel", clinic.page === "list" && clinic.listMode === "archive");
  if ($c("tab-notes")) $c("tab-notes").classList.toggle("sel", clinic.page === "notes");
}
function syncWho() {
  const who = $c("who");
  if (!who) return;
  if (AUTH_OFF || !authRecord()) {
    who.hidden = true;
    who.textContent = "";
    return;
  }
  who.hidden = false;
  who.textContent = authRecord().name;
}
function syncClinicPanels() {
  const plan = clinic.code ? loadPlans().plans[clinic.code] : null;
  const creating = !plan && clinic.creating;
  const archived = !!(plan && plan.archived);
  if (archived) clinic.writingVisit = false;
  const hasLogin = !!(plan && plan.username && plan.hash);
  const writing = clinic.listMode !== "archive" && !archived && !!plan && clinic.writingVisit;
  if ($c("account-summary")) $c("account-summary").hidden = !hasLogin;
  if ($c("clinic-switch-login")) $c("clinic-switch-login").hidden = archived;
  if ($c("account-summary-line")) {
    $c("account-summary-line").textContent = hasLogin
      ? plan.username + " · password saved"
      : "";
  }
  if ($c("account-box")) {
    $c("account-box").hidden = !creating && (archived || !plan || (hasLogin && !clinic.switchingLogin));
  }
  if ($c("account-box-title")) {
    $c("account-box-title").textContent = creating
      ? "New patient"
      : hasLogin ? "Switch sign-in" : "Username and password";
  }
  if ($c("account-box-foot")) {
    $c("account-box-foot").hidden = true;
    $c("account-box-foot").textContent = "";
  }
  if ($c("clinic-pass-note")) {
    $c("clinic-pass-note").hidden = true;
    $c("clinic-pass-note").textContent = "";
  }
  if ($c("clinic-save-login")) {
    $c("clinic-save-login").textContent = creating ? "Create patient" : "Save sign-in";
  }
  if ($c("visit-draft")) $c("visit-draft").hidden = !writing;
  if ($c("visit-toolbar")) $c("visit-toolbar").hidden = !plan || writing;
  if ($c("clinic-calendar")) $c("clinic-calendar").hidden = true;
  if ($c("clinic-new-visit")) $c("clinic-new-visit").hidden = !plan || archived || writing;
  if ($c("clinic-archive-patient")) $c("clinic-archive-patient").hidden = !plan || archived || writing;
  if ($c("clinic-reopen-patient")) $c("clinic-reopen-patient").hidden = !plan || !archived;
  if ($c("clinic-cancel-visit")) $c("clinic-cancel-visit").hidden = !plan || archived;
  if ($c("clinic-new")) $c("clinic-new").hidden = clinic.listMode === "archive";
  if ($c("editor-lede")) {
    $c("editor-lede").hidden = true;
    $c("editor-lede").textContent = "";
  }
  syncInjuryLine(plan);
  const head = document.querySelector("#editor h2");
  if (head) {
    head.textContent = creating
      ? "New patient"
      : archived
        ? (plan.patient + " · archive")
        : writing
          ? "New visit"
          : plan
            ? plan.patient
            : (clinic.listMode === "archive" ? "Patient archive" : "Current patients");
  }
  syncTabs();
}
function newClinicDraft() {
  clinic.code = null;
  clinic.patient = "";
  clinic.note = "";
  clinic.rows = [blankRow()];
  clinic.writingVisit = false;
  clinic.switchingLogin = false;
  clinic.creating = true;
  $c("clinic-error").textContent = "";
  $c("clinic-patient").value = "";
  if ($c("clinic-injury")) $c("clinic-injury").value = "";
  if ($c("clinic-username")) $c("clinic-username").value = "";
  if ($c("clinic-pass")) $c("clinic-pass").value = "";
  if ($c("clinic-pass-confirm")) $c("clinic-pass-confirm").value = "";
  if ($c("clinic-copy")) $c("clinic-copy").textContent = "Copy username";
  $c("clinic-note").value = "";
  if ($c("clinic-purpose")) $c("clinic-purpose").value = "";
  clinic.visitIndex = null;
  fillDose(null);
  renderRows();
  renderHistory(null);
  renderReport(null);
  renderVisitView(null);
  renderClinicCalendar(null);
  syncClinicPanels();
}
function loadClinicDraft(plan) {
  const visit = latestVisit(plan);
  clinic.code = plan.code;
  clinic.patient = plan.patient;
  clinic.note = "";
  clinic.rows = ankleExercises(visit ? visit.exercises : []).map((item) => ({
    pattern: item.pattern,
    reps: item.reps,
    cue: item.cue || "",
    note: item.note || "",
    cueTouched: true,
    essential: item.essential !== false,
    minBout: item.minBout || 1,
    daysPerWeek: clamp(Number(item.daysPerWeek) || (cycleOf(plan) && cycleOf(plan).daysPerWeek) || 7, 1, 7)
  }));
  if (!clinic.rows.length) clinic.rows.push(blankRow());
  if ($c("clinic-copy")) $c("clinic-copy").textContent = "Copy username";
  if ($c("clinic-pass-note")) {
    $c("clinic-pass-note").textContent = plan.hash
      ? "Leave both password fields blank to keep the password this patient already uses."
      : "Set a username and password so this patient can sign in.";
  }
  $c("clinic-error").textContent = "";
  $c("clinic-patient").value = plan.patient;
  if ($c("clinic-injury")) $c("clinic-injury").value = plan.injury || "";
  if ($c("clinic-username")) $c("clinic-username").value = plan.username || "";
  if ($c("clinic-pass")) $c("clinic-pass").value = "";
  if ($c("clinic-pass-confirm")) $c("clinic-pass-confirm").value = "";
  $c("clinic-note").value = "";
  if ($c("clinic-purpose")) $c("clinic-purpose").value = "";
  clinic.visitIndex = null;
  clinic.writingVisit = false;
  clinic.switchingLogin = false;
  clinic.creating = false;
  clinic.filmsOpen = false;
  clinic.listMode = plan.archived ? "archive" : "current";
  fillDose(cycleOf(plan));
  renderRows();
  renderHistory(plan);
  renderReport(plan);
  renderVisitView(null);
  renderClinicCalendar(plan);
  syncClinicPanels();
  loadClinicCalendar(plan);
}
let ankleOptionSource = null;
function ankleOptions() {
  if (!ankleOptionSource) {
    ankleOptionSource = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Choose an ankle movement";
    ankleOptionSource.appendChild(empty);
    for (const base of Object.values(EX)) {
      if (!isAnkleEx(base.id)) continue;
      const opt = document.createElement("option");
      opt.value = base.id;
      opt.textContent = base.name + " · " + base.focus;
      ankleOptionSource.appendChild(opt);
    }
  }
  const select = document.createElement("select");
  select.append(...Array.from(ankleOptionSource.options).map((opt) => opt.cloneNode(true)));
  return select;
}
function makeRowCard(row) {
  const card = document.createElement("div");
  card.className = "ex-row";
  card.tabIndex = 0;
  const grid = document.createElement("div");
  grid.className = "ex-grid";
  const moveField = document.createElement("div");
  moveField.className = "field";
  const moveLabel = document.createElement("label");
  moveLabel.textContent = "Ankle movement";
  const select = ankleOptions();
  select.value = row.pattern;
  select.addEventListener("change", () => {
    row.pattern = select.value;
    const base = EX[row.pattern];
    if (!base) return;
    row.reps = base.reps;
    if (!row.cueTouched) row.cue = base.cue;
    const reps = card.querySelector("[data-reps]");
    const repLabel = card.querySelector("[data-replabel]");
    if (reps) {
      reps.value = String(row.reps);
      reps.max = base.type === "sustain" ? "8" : "20";
    }
    if (repLabel) repLabel.textContent = base.type === "sustain" ? "Breaths" : "Reps";
  });
  moveField.append(moveLabel, select);
  const repField = document.createElement("div");
  repField.className = "field";
  const repLabel = document.createElement("label");
  const base = EX[row.pattern];
  repLabel.dataset.replabel = "1";
  repLabel.textContent = base && base.type === "sustain" ? "Breaths" : "Reps";
  const reps = document.createElement("input");
  reps.type = "number";
  reps.min = "1";
  reps.max = base && base.type === "sustain" ? "8" : "20";
  reps.value = String(row.reps);
  reps.dataset.reps = "1";
  reps.addEventListener("input", () => { row.reps = Number(reps.value) || 1; });
  repField.append(repLabel, reps);
  grid.append(moveField, repField);
  const actions = document.createElement("div");
  actions.className = "icon-row";
  const up = document.createElement("button");
  up.type = "button";
  up.className = "ghost";
  up.dataset.up = "1";
  up.textContent = "Up";
  up.addEventListener("click", () => {
    const index = clinic.rows.indexOf(row);
    if (index < 1) return;
    const swap = clinic.rows[index - 1];
    clinic.rows[index - 1] = clinic.rows[index];
    clinic.rows[index] = swap;
    renderRows();
  });
  const down = document.createElement("button");
  down.type = "button";
  down.className = "ghost";
  down.dataset.down = "1";
  down.textContent = "Down";
  down.addEventListener("click", () => {
    const index = clinic.rows.indexOf(row);
    if (index < 0 || index >= clinic.rows.length - 1) return;
    const swap = clinic.rows[index + 1];
    clinic.rows[index + 1] = clinic.rows[index];
    clinic.rows[index] = swap;
    renderRows();
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "texty";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    const index = clinic.rows.indexOf(row);
    if (index < 0) return;
    clinic.rows.splice(index, 1);
    if (!clinic.rows.length) clinic.rows.push(blankRow());
    renderRows();
  });
  actions.append(up, down, remove);
  card.append(grid, actions);
  return card;
}
function refreshRowActions() {
  const cards = $c("clinic-rows").children;
  for (let i = 0; i < cards.length; i++) {
    const up = cards[i].querySelector("[data-up]");
    const down = cards[i].querySelector("[data-down]");
    if (up) up.disabled = i === 0;
    if (down) down.disabled = i === cards.length - 1;
  }
}
function renderRows() {
  const root = $c("clinic-rows");
  const frag = document.createDocumentFragment();
  clinic.rows.forEach((row) => frag.appendChild(makeRowCard(row)));
  root.replaceChildren(frag);
  refreshRowActions();
}
function addExerciseRow() {
  const row = blankRow();
  clinic.rows.push(row);
  $c("clinic-rows").appendChild(makeRowCard(row));
  refreshRowActions();
}
function visitDay(visit) {
  return visit && visit.date ? String(visit.date).slice(0, 10) : "";
}
function visitFingerprint(visit) {
  if (!visit) return "";
  const exercises = ankleExercises(visit.exercises).map((item) => [
    item.pattern,
    item.reps || "",
    item.essential === false ? 0 : 1,
    item.daysPerWeek || "",
    (item.cue || "").trim(),
    (item.note || "").trim()
  ].join(":")).join("|");
  const dose = visit.dose || {};
  return [
    visitDay(visit),
    (visit.purpose || "").trim(),
    (visit.note || "").trim(),
    exercises,
    dose.periodEnd || "",
    dose.timeOfDay || "",
    dose.daysPerWeek || "",
    dose.minBout || "",
    (dose.painRule || "").trim(),
    (dose.sentence || "").trim()
  ].join("||");
}
function dedupeVisits(plan) {
  if (!plan || !Array.isArray(plan.visits) || plan.visits.length < 2) return false;
  const kept = [];
  const seen = new Set();
  for (let i = plan.visits.length - 1; i >= 0; i--) {
    const key = visitFingerprint(plan.visits[i]);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(plan.visits[i]);
  }
  kept.reverse();
  if (kept.length === plan.visits.length) return false;
  plan.visits = kept;
  return true;
}
function compactPlanVisits(plan) {
  if (!plan || !plan.code) return plan;
  const selected = clinic.visitIndex != null ? plan.visits[clinic.visitIndex] : null;
  const selectedKey = selected ? visitFingerprint(selected) : "";
  if (!dedupeVisits(plan)) return plan;
  const data = loadPlans();
  if (data.plans[plan.code]) {
    data.plans[plan.code].visits = plan.visits;
    savePlans(data);
  }
  if (selectedKey) {
    const idx = plan.visits.findIndex((visit) => visitFingerprint(visit) === selectedKey);
    clinic.visitIndex = idx >= 0 ? idx : null;
  }
  return plan;
}
function renderHistory(plan) {
  const root = $c("clinic-history");
  root.replaceChildren();
  const leftover = $c("clinic-visit-view");
  if (leftover) {
    leftover.hidden = true;
    leftover.replaceChildren();
  }
  if (!plan || !plan.visits || !plan.visits.length) return;
  plan = compactPlanVisits(plan);
  const title = document.createElement("p");
  title.className = "kicker";
  title.textContent = "Visits";
  const list = document.createElement("div");
  list.className = "visit-list";
  plan.visits.slice().reverse().forEach((visit, rev) => {
    const index = plan.visits.length - 1 - rev;
    const item = document.createElement("div");
    item.className = "visit-item";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "visit-btn" + (clinic.visitIndex === index ? " sel" : "");
    const when = document.createElement("strong");
    when.textContent = formatWhen(visit.date) + (index === plan.visits.length - 1 ? " · latest" : "");
    const names = document.createElement("small");
    names.textContent = ankleExercises(visit.exercises).map((row) => (EX[row.pattern] && EX[row.pattern].name) || row.pattern).join(", ") || "No ankle set";
    btn.append(when, names);
    btn.addEventListener("click", () => {
      if (clinic.visitIndex === index) {
        closeVisitView();
        return;
      }
      clinic.visitIndex = index;
      clinic.filmsOpen = false;
      renderHistory(plan);
    });
    item.appendChild(btn);
    if (clinic.visitIndex === index) {
      const detail = document.createElement("div");
      detail.className = "saved-box visit-detail";
      detail.tabIndex = 0;
      fillVisitView(detail, plan, visit);
      item.appendChild(detail);
    }
    list.appendChild(item);
  });
  root.append(title, list);
}
function renderVisitView(plan, visit) {
  const leftover = $c("clinic-visit-view");
  if (leftover) {
    leftover.hidden = true;
    leftover.replaceChildren();
  }
  if (plan && visit) {
    if (clinic.visitIndex == null) {
      const idx = plan.visits.indexOf(visit);
      clinic.visitIndex = idx >= 0 ? idx : plan.visits.length - 1;
    }
    renderHistory(plan);
  }
}
function fillVisitView(root, plan, visit) {
  if (!root) return;
  root.replaceChildren();
  if (!plan || !visit) return;
  const head = document.createElement("div");
  head.className = "spread";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "texty";
  close.textContent = "Close visit";
  close.addEventListener("click", closeVisitView);
  head.append(close);
  const title = document.createElement("h3");
  title.style.cssText = "font-size:1.5rem;margin:4px 0 8px";
  title.textContent = plan.patient + " · " + formatWhen(visit.date);
  root.append(head, title);
  if (visit.note) {
    const note = document.createElement("p");
    note.textContent = visit.note;
    root.appendChild(note);
  }
  if (visit.dose) {
    const dose = document.createElement("p");
    dose.className = "note";
    dose.textContent = (visit.dose.daysPerWeek || "") + " practice days a week, minimum " +
      (visit.dose.minBout || 1) + " exercises per day";
    root.appendChild(dose);
  }
  const table = document.createElement("table");
  table.className = "cal-table";
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Movement", "Reps", "Days per week", "Essential"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  const body = document.createElement("tbody");
  ankleExercises(visit.exercises).forEach((item) => {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = (EX[item.pattern] && EX[item.pattern].name) || item.pattern;
    const reps = document.createElement("td");
    reps.textContent = String(item.reps || "");
    const days = document.createElement("td");
    days.textContent = String(item.daysPerWeek || (visit.dose && visit.dose.daysPerWeek) || 7);
    const ess = document.createElement("td");
    ess.textContent = item.essential === false ? "Optional" : "Yes";
    tr.append(name, reps, days, ess);
    body.appendChild(tr);
  });
  table.append(thead, body);
  root.appendChild(table);
  appendVisitFilms(root, plan, visit);
}
function filmsForVisit(plan, visit) {
  const all = planFilms(plan);
  if (!plan || !visit || !all.length) return [];
  const index = clinic.visitIndex != null ? clinic.visitIndex : plan.visits.indexOf(visit);
  const start = visit.date || "";
  const next = index >= 0 ? plan.visits[index + 1] : null;
  const end = (next && next.date) || (visit.dose && visit.dose.periodEnd) || "9999";
  return all.filter((item) => {
    const when = item.at || (item.date ? String(item.date) + "T12:00:00" : "");
    if (!when) return index === plan.visits.length - 1;
    return when >= start && when < end;
  });
}
function appendVisitFilms(root, plan, visit) {
  const films = filmsForVisit(plan, visit);
  const box = document.createElement("div");
  box.style.marginTop = "14px";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "visit-btn" + (clinic.filmsOpen ? " sel" : "");
  toggle.style.width = "100%";
  const label = document.createElement("strong");
  label.textContent = "Submitted videos" + (films.length ? " · " + films.length : "");
  const hint = document.createElement("small");
  hint.textContent = films.length ? String(films.length) : "";
  toggle.append(label, hint);
  toggle.addEventListener("click", () => {
    clinic.filmsOpen = !clinic.filmsOpen;
    renderHistory(plan);
  });
  box.appendChild(toggle);
  if (!clinic.filmsOpen) {
    root.appendChild(box);
    return;
  }
  if (!films.length) {
    const empty = document.createElement("p");
    empty.className = "note";
    empty.textContent = "No films.";
    box.append(empty);
    root.appendChild(box);
    return;
  }
  films.forEach((item) => box.appendChild(makeFilmCard(plan, visit, item)));
  root.appendChild(box);
}
function makeFilmCard(plan, visit, item) {
  const card = document.createElement("div");
  card.className = "ex-row";
  const line = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = (item.name ? item.name + " · " : "") + (item.date || formatWhen(item.at));
  const status = item.review === "refilm"
    ? " · ask to refilm"
    : (item.review === "keep" ? " · kept" : " · submitted");
  line.append(strong, document.createTextNode(status + (item.seconds ? " · " + Math.round(item.seconds) + "s" : "")));
  const player = document.createElement("video");
  player.controls = true;
  player.playsInline = true;
  player.style.cssText = "width:100%;border-radius:16px;background:#111;max-height:240px;margin-top:8px";
  getFilm(plan.code, item.slotId).then((row) => {
    if (row && row.blob) player.src = URL.createObjectURL(row.blob);
    else player.replaceWith(Object.assign(document.createElement("p"), { className: "note", textContent: "The film file is not on this browser." }));
  }).catch(() => {});
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  label.textContent = "Revision note";
  const input = document.createElement("textarea");
  input.rows = 2;
  input.maxLength = 180;
  input.value = item.reviewNote || "";
  input.placeholder = "What to keep, or what to change on the next film.";
  field.append(label, input);
  const row = document.createElement("div");
  row.className = "row";
  const keep = document.createElement("button");
  keep.type = "button";
  keep.className = item.review === "keep" ? "primary" : "secondary";
  keep.textContent = "Keep this film";
  keep.addEventListener("click", () => {
    reviewFilm(plan.code, item.slotId, "keep", input.value);
    const fresh = loadPlans().plans[plan.code];
    clinic.filmsOpen = true;
    renderHistory(fresh);
  });
  const redo = document.createElement("button");
  redo.type = "button";
  redo.className = item.review === "refilm" ? "primary" : "secondary";
  redo.textContent = "Ask to refilm";
  redo.addEventListener("click", () => {
    reviewFilm(plan.code, item.slotId, "refilm", input.value);
    const fresh = loadPlans().plans[plan.code];
    clinic.filmsOpen = true;
    renderHistory(fresh);
  });
  row.append(keep, redo);
  card.append(line, player, field, row);
  return card;
}
function closeVisitView() {
  clinic.visitIndex = null;
  clinic.filmsOpen = false;
  renderVisitView(null);
  if (clinic.code) {
    const plan = loadPlans().plans[clinic.code];
    if (plan) renderHistory(plan);
  }
}
function itemCueList(visit) {
  return ankleExercises(visit.exercises).filter((item) => item.cue || item.note).map((item) => {
    const name = (EX[item.pattern] && EX[item.pattern].name) || item.pattern;
    return name + ": " + (item.cue || item.note);
  });
}
function clearDoseAndExercises() {
  clinic.note = "";
  clinic.visitIndex = null;
  clinic.filmsOpen = false;
  $c("clinic-note").value = "";
  if ($c("clinic-purpose")) $c("clinic-purpose").value = "";
  $c("clinic-error").textContent = "";
  fillDose(null);
  clinic.rows = [blankRow()];
  renderRows();
  renderVisitView(null);
}
function renderPatients() {
  const root = $c("clinic-patients");
  root.replaceChildren();
  const plans = listedPlans();
  if (!plans.length) {
    const empty = document.createElement("p");
    empty.className = "note";
    empty.textContent = clinic.listMode === "archive" ? "No archived patients." : "No patients yet.";
    root.appendChild(empty);
    return;
  }
  for (const plan of plans) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "patient" + (plan.code === clinic.code ? " sel" : "");
    const name = document.createElement("strong");
    name.textContent = plan.patient;
    const meta = document.createElement("small");
    const visit = latestVisit(plan);
    meta.textContent = (plan.username || "No username") + (visit ? " · " + formatWhen(visit.date) : " · No visit yet");
    btn.append(name);
    if (plan.injury) {
      const injury = document.createElement("small");
      injury.className = "injury";
      injury.textContent = plan.injury;
      btn.appendChild(injury);
    }
    btn.appendChild(meta);
    btn.addEventListener("click", () => {
      loadClinicDraft(plan);
      renderPatients();
    });
    root.appendChild(btn);
  }
}
function makeCode(plans) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (plans[code]);
  return code;
}
function doseTime() {
  return normalizeClock($c("clinic-part").value) || "09:00";
}
function setVisitSaving(on) {
  clinic.savingVisit = !!on;
  const submit = $c("clinic-form") && $c("clinic-form").querySelector('button[type="submit"]');
  if (submit) submit.disabled = !!on;
}
async function saveVisit(event) {
  event.preventDefault();
  if (clinic.savingVisit) return;
  if (!AUTH_OFF && !sessionOn()) {
    showGate();
    return;
  }
  $c("clinic-error").textContent = "";
  const planNow = clinic.code ? loadPlans().plans[clinic.code] : null;
  const patient = $c("clinic-patient").value.trim() || clinic.patient || (planNow && planNow.patient) || "";
  if (!patient) {
    $c("clinic-error").textContent = "Add the patient's name.";
    return;
  }
  const exercises = [];
  for (const row of clinic.rows) {
    if (!isAnkleEx(row.pattern)) continue;
    const base = EX[row.pattern];
    const cap = base.type === "sustain" ? 8 : 20;
    exercises.push({
      pattern: row.pattern,
      reps: clamp(Number(row.reps) || base.reps, 1, cap),
      cue: (row.cue || "").trim() || base.cue,
      note: (row.note || "").trim(),
      essential: row.essential !== false,
      minBout: row.minBout ? 1 : 0,
      daysPerWeek: clamp(Number($c("clinic-days") && $c("clinic-days").value) || row.daysPerWeek || 7, 1, 7)
    });
  }
  if (!exercises.length) {
    $c("clinic-error").textContent = "Add at least one ankle movement.";
    return;
  }
  const data = loadPlans();
  if (!clinic.code || !data.plans[clinic.code]) {
    $c("clinic-error").textContent = "Create the patient first with a username and password.";
    return;
  }
  const code = clinic.code;
  const existing = data.plans[code];
  if (!existing.hash) {
    $c("clinic-error").textContent = "Create the patient first with a username and password.";
    return;
  }
  const days = leadDays();
  const until = untilFromLead(days);
  if ($c("clinic-until")) $c("clinic-until").value = until;
  existing.patient = patient || existing.patient;
  const clinician = authRecord();
  if (clinician) existing.clinicianId = clinician.id;
  existing.updated = new Date().toISOString();
  try {
    await syncDeviceCalendarToPlan(existing, false, "clinician");
  } catch (err) { /* use the last clinician calendar from this device */ }
  const live = loadPlans().plans[code] || existing;
  existing.clinicianCalendar = live.clinicianCalendar;
  existing.patientCalendar = live.patientCalendar || live.deviceCalendar;
  existing.deviceCalendar = live.deviceCalendar;
  applyRoleCalendarsToPlan(existing, existing.updated, until + "T23:59:00");
  const appt = bookJointAppointment(existing, days, 30);
  const visitTime = appt ? clockOf(appt.start) : doseTime();
  const nextVisit = {
    date: existing.updated,
    note: $c("clinic-note").value.trim(),
    exercises,
    dose: {
      periodEnd: until + "T23:59:00",
      timeOfDay: visitTime,
      daysUntilNext: days,
      daysPerWeek: Number($c("clinic-days").value) || 7,
      minBout: doseMin(),
      painRule: "Stop if the ankle sharp-pains, swells, or goes numb.",
      sentence: "Time for your ankle practice."
    }
  };
  compactPlanVisits(existing);
  const last = existing.visits[existing.visits.length - 1];
  if (last && visitFingerprint(last) === visitFingerprint(nextVisit)) {
    clinic.writingVisit = false;
    clinic.switchingLogin = false;
    clearDoseAndExercises();
    renderPatients();
    renderHistory(existing);
    renderReport(existing);
    syncClinicPanels();
    return;
  }
  setVisitSaving(true);
  try {
    existing.visits.push(nextVisit);
    existing.calendar = existing.calendar || [];
    existing.phoneDays = existing.phoneDays || {};
    applyRoleCalendarsToPlan(existing, existing.updated, until + "T23:59:00");
    keepVisitOnCalendar(existing);
    existing.cycle = buildCycle(existing, existing.visits[existing.visits.length - 1], {
      periodStart: existing.updated,
      periodEnd: until + "T23:59:00",
      timeOfDay: visitTime,
      daysUntilNext: days,
      daysPerWeek: Number($c("clinic-days").value) || 7,
      minBout: doseMin(),
      painRule: "Stop if the ankle sharp-pains, swells, or goes numb.",
      sentence: "Time for your ankle practice."
    });
    existing.rewards = existing.rewards || [];
    data.plans[code] = existing;
    savePlans(data);
    autoBookCycle(existing);
    const saved = loadPlans().plans[code] || existing;
    clinic.code = code;
    clinic.patient = patient;
    clinic.writingVisit = false;
    clinic.switchingLogin = false;
    clearDoseAndExercises();
    renderPatients();
    renderHistory(saved);
    renderReport(saved);
    syncClinicPanels();
    renderClinicOwnCalendar();
    if (saved.appointment) notifyAppointment(saved, saved.appointment);
    else $c("clinic-error").textContent = "Visit saved. No shared free time in those days.";
    notifyPracticePlan(saved);
    notifyPatientReport(saved);
    paintNotesDot();
  } finally {
    setVisitSaving(false);
  }
}
function noteSavedLogin(username, passwordChanged) {
  if ($c("clinic-copy")) $c("clinic-copy").textContent = "Copy username";
  if ($c("clinic-pass-note")) {
    $c("clinic-pass-note").textContent = passwordChanged
      ? "Password saved. Give " + username + " and that password to the patient."
      : "This patient signs in as " + username + ".";
  }
  if ($c("clinic-pass")) $c("clinic-pass").value = "";
  if ($c("clinic-pass-confirm")) $c("clinic-pass-confirm").value = "";
}
function loginError(message) {
  if ($c("clinic-login-error")) $c("clinic-login-error").textContent = message;
  $c("clinic-error").textContent = message;
}
async function savePatientLogin() {
  loginError("");
  const patient = $c("clinic-patient").value.trim();
  const username = normalizeUsername($c("clinic-username").value);
  if (!validUsername(username)) {
    loginError("Set a username of 3–24 letters or numbers. Spaces are fine.");
    return;
  }
  const password = $c("clinic-pass").value;
  const confirm = $c("clinic-pass-confirm").value;
  if (password !== confirm) {
    loginError("Those passwords don't match.");
    return;
  }
  const data = loadPlans();
  let code = clinic.code && data.plans[clinic.code] ? clinic.code : "";
  if (!code) {
    if (!patient) {
      loginError("Add the patient's name, then press Create patient.");
      return;
    }
    if (password.length < 8) {
      loginError("Set a password of at least 8 characters.");
      return;
    }
    code = makeCode(data.plans);
    data.plans[code] = {
      code,
      patient,
      injury: injuryValue(),
      visits: [],
      rewards: [],
      calendar: [],
      phoneDays: {},
      clinicianId: authRecord() ? authRecord().id : ""
    };
    clinic.code = code;
    clinic.patient = patient;
  }
  const taken = planByUsername(username);
  if (taken && taken.code !== code) {
    loginError("That username is already in use.");
    return;
  }
  const existing = data.plans[code];
  if (patient) existing.patient = patient;
  existing.injury = injuryValue();
  if (!existing.hash && password.length < 8) {
    loginError("Set a password of at least 8 characters for this patient.");
    return;
  }
  if (password && password.length < 8) {
    loginError("Use at least 8 characters, or leave the password blank to keep the current one.");
    return;
  }
  existing.username = username;
  existing.calendar = existing.calendar || [];
  if (password) {
    existing.salt = randomSalt();
    existing.hash = await hashPassword(password, existing.salt);
  }
  existing.updated = new Date().toISOString();
  data.plans[code] = existing;
  savePlans(data);
  noteSavedLogin(username, !!password);
  loginError("");
  clinic.switchingLogin = false;
  clinic.writingVisit = false;
  loadClinicDraft(existing);
  renderPatients();
}
function renderClinicCalendar() {
  if ($c("clinic-calendar")) $c("clinic-calendar").hidden = true;
}
function renderClinicOwnCalendar() {
  paintRoleCalendar($c("clinic-home-cal-table"), $c("clinic-home-cal-status"), "clinician");
}
async function loadClinicCalendar() {
  startCalendarWatch();
}
function renderReport(plan) {
  const root = $c("clinic-report");
  if (root) {
    root.hidden = true;
    root.replaceChildren();
  }
}
function hideClinicNotes() {
  if ($c("clinic-notes")) $c("clinic-notes").hidden = true;
}
function renderClinicInbox() {
  const items = inboxFor("clinic").slice().sort((a, b) => {
    const ap = a.type === "kale-request" && (a.status || "pending") === "pending" ? 0 : 1;
    const bp = b.type === "kale-request" && (b.status || "pending") === "pending" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return String(b.at || "").localeCompare(String(a.at || ""));
  });
  renderInboxList($c("clinic-inbox"), items, (item) => {
    markInboxRead("clinic", item.username, item.id);
    fillMailView(item);
    renderClinicInbox();
    paintNotesDot();
    if (item.type === "appointment" && item.username) {
      const plan = planByUsername(item.username);
      if (plan) markAppointmentSeen(plan, "clinician");
    }
  }, true);
}
function seedClinicInbox() {
  Object.values(loadPlans().plans || {}).forEach((plan) => {
    if (plan.appointment && plan.appointment.start) notifyAppointment(plan, plan.appointment);
    if (cycleOf(plan) && !inboxFor("clinic").some((item) => item.type === "report" && item.username === plan.username)) {
      notifyPatientReport(plan);
    }
  });
  if (typeof syncPendingKaleInbox === "function") syncPendingKaleInbox();
}
function showClinicNotes() {
  if (!clinicUiOn()) {
    showGate();
    return;
  }
  clinic.page = "notes";
  showClinicChrome();
  seedClinicInbox();
  if ($c("clinic-home")) {
    $c("clinic-home").hidden = true;
    $c("clinic-home").classList.remove("on");
  }
  $c("editor").hidden = true;
  if ($c("clinic-notes")) $c("clinic-notes").hidden = false;
  renderClinicInbox();
  paintNotesDot();
}

let gateMode = "login";
function showGate(mode) {
  if (mode) gateMode = mode;
  else if (!loadClinicians().accounts.length) gateMode = "signup";
  const creating = gateMode === "signup";
  clinic.page = "gate";
  $c("editor").hidden = true;
  hideClinicNotes();
  if ($c("clinic-home")) {
    $c("clinic-home").hidden = true;
    $c("clinic-home").classList.remove("on");
  }
  $c("gate").hidden = false;
  $c("sign-out").hidden = true;
  $c("who").hidden = true;
  if ($c("clinic-new")) $c("clinic-new").hidden = true;
  if ($c("clinic-tabs")) $c("clinic-tabs").hidden = true;
  if ($c("clinic-home-open")) $c("clinic-home-open").hidden = true;
  if (AUTH_OFF) {
    $c("clinician-pass").required = false;
    $c("clinician-pass").minLength = 0;
    $c("clinician-confirm").required = false;
    $c("clinician-name").required = false;
  }
  $c("gate-login").classList.toggle("sel", !creating);
  $c("gate-signup").classList.toggle("sel", creating);
  $c("gate-kicker").textContent = "Clinician";
  $c("gate-title").textContent = creating ? "Sign up" : "Log in";
  if ($c("gate-lede")) {
    $c("gate-lede").hidden = true;
    $c("gate-lede").textContent = "";
  }
  $c("confirm-field").hidden = !creating;
  $c("clinician-confirm").required = creating;
  $c("clinician-pass").autocomplete = creating ? "new-password" : "current-password";
  $c("gate-submit").textContent = creating ? "Sign up" : "Log in";
  $c("gate-error").textContent = "";
  $c("clinician-pass").value = "";
  $c("clinician-confirm").value = "";
}
function showClinicChrome() {
  $c("gate").hidden = true;
  $c("sign-out").hidden = false;
  if ($c("clinic-tabs")) $c("clinic-tabs").hidden = false;
  if ($c("clinic-home-open")) $c("clinic-home-open").hidden = false;
  for (const id of ["clinic-username", "clinic-pass", "clinic-pass-confirm"]) {
    const field = $c(id);
    if (field) {
      field.disabled = false;
      field.required = false;
    }
  }
  syncWho();
  syncTabs();
  paintNotesDot();
}
function showClinicHome() {
  if (window.ELAKBuddy) window.ELAKBuddy.refresh();
  if (!clinicUiOn()) {
    showGate();
    return;
  }
  clinic.page = "home";
  showClinicChrome();
  if ($c("clinic-home")) {
    $c("clinic-home").hidden = false;
    $c("clinic-home").classList.add("on");
  }
  $c("editor").hidden = true;
  hideClinicNotes();
  backfillOpenVisits();
  startCalendarWatch();
  renderClinicOwnCalendar();
  paintNotesDot();
  if (window.ELAKBuddy) window.ELAKBuddy.refresh();
}
function openClinicList(mode) {
  if (!clinicUiOn()) {
    showGate();
    return;
  }
  clinic.page = "list";
  clinic.listMode = mode === "archive" ? "archive" : "current";
  clinic.writingVisit = false;
  clinic.switchingLogin = false;
  clinic.creating = false;
  showClinicChrome();
  if ($c("clinic-home")) {
    $c("clinic-home").hidden = true;
    $c("clinic-home").classList.remove("on");
  }
  $c("editor").hidden = false;
  hideClinicNotes();
  const open = clinic.code ? loadPlans().plans[clinic.code] : null;
  const belongs = open && !!open.archived === (clinic.listMode === "archive");
  if (!belongs) {
    clinic.code = null;
    renderHistory(null);
    renderReport(null);
    renderVisitView(null);
  }
  renderPatients();
  syncClinicPanels();
}

$c("gate-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $c("gate-error").textContent = "";
  const name = $c("clinician-name").value.trim();
  const password = $c("clinician-pass").value;
  const persist = $c("clinic-remember") && $c("clinic-remember").checked;
  if (AUTH_OFF) {
    markClinicIn(persist);
    showClinicHome();
    return;
  }
  if (!name) {
    $c("gate-error").textContent = "Add your name.";
    return;
  }
  if (password.length < 8) {
    $c("gate-error").textContent = "Use at least 8 characters.";
    return;
  }
  try {
    if (gateMode === "signup") {
      if (password !== $c("clinician-confirm").value) {
        $c("gate-error").textContent = "Those passwords don't match.";
        return;
      }
      const result = await createClinician(name, password);
      if (!result.ok) {
        $c("gate-error").textContent = result.error;
        return;
      }
    } else {
      const ok = await signInClinician(name, password);
      if (!ok) {
        $c("gate-error").textContent = "That name and password don't match a clinician account on this browser.";
        return;
      }
    }
    markClinicIn(persist);
    showClinicHome();
  } catch (err) {
    $c("gate-error").textContent = "Sign-in needs a secure page, opened through localhost.";
  }
});
$c("gate-login").addEventListener("click", () => showGate("login"));
$c("gate-signup").addEventListener("click", () => showGate("signup"));
$c("sign-out").addEventListener("click", () => {
  signOutClinician();
  clinic.rows = [];
  showGate();
});
$c("clinic-new").addEventListener("click", () => {
  clinic.listMode = "current";
  newClinicDraft();
  renderPatients();
});
function goClinicHome() {
  if (clinicUiOn()) showClinicHome();
  else showGate();
}
if ($c("clinic-home-btn")) $c("clinic-home-btn").addEventListener("click", goClinicHome);
if ($c("clinic-home-open")) $c("clinic-home-open").addEventListener("click", goClinicHome);
if ($c("tab-current")) $c("tab-current").addEventListener("click", () => openClinicList("current"));
if ($c("tab-archive")) $c("tab-archive").addEventListener("click", () => openClinicList("archive"));
if ($c("tab-notes")) $c("tab-notes").addEventListener("click", showClinicNotes);
if ($c("mail-negotiate-btn")) $c("mail-negotiate-btn").addEventListener("click", submitVisitNegotiate);
if ($c("mail-close")) $c("mail-close").addEventListener("click", () => {
  if ($c("overlay-mail")) $c("overlay-mail").hidden = true;
});
if ($c("home-current")) $c("home-current").addEventListener("click", () => openClinicList("current"));
if ($c("home-archive")) $c("home-archive").addEventListener("click", () => openClinicList("archive"));
if ($c("clinic-archive-patient")) {
  $c("clinic-archive-patient").addEventListener("click", () => {
    const plan = setPatientArchived(clinic.code, true);
    if (!plan) return;
    clinic.listMode = "archive";
    loadClinicDraft(plan);
    renderPatients();
  });
}
if ($c("clinic-reopen-patient")) {
  $c("clinic-reopen-patient").addEventListener("click", () => {
    const plan = setPatientArchived(clinic.code, false);
    if (!plan) return;
    clinic.listMode = "current";
    loadClinicDraft(plan);
    renderPatients();
  });
}
if ($c("appoint-close")) {
  $c("appoint-close").addEventListener("click", () => {
    if ($c("overlay-appoint")) $c("overlay-appoint").hidden = true;
    if (clinic.code) markAppointmentSeen(loadPlans().plans[clinic.code], "clinician");
  });
}
if ($c("clinic-new-visit")) {
  $c("clinic-new-visit").addEventListener("click", () => {
    clinic.writingVisit = true;
    clinic.switchingLogin = false;
    clearDoseAndExercises();
    syncClinicPanels();
  });
}
if ($c("clinic-cancel-visit")) {
  $c("clinic-cancel-visit").addEventListener("click", () => {
    clinic.writingVisit = false;
    $c("clinic-error").textContent = "";
    syncClinicPanels();
  });
}
if ($c("clinic-switch-login")) {
  $c("clinic-switch-login").addEventListener("click", () => {
    clinic.switchingLogin = !clinic.switchingLogin;
    if ($c("clinic-pass")) $c("clinic-pass").value = "";
    if ($c("clinic-pass-confirm")) $c("clinic-pass-confirm").value = "";
    syncClinicPanels();
  });
}
$c("clinic-add").addEventListener("click", addExerciseRow);
function markClinicBox(box) {
  document.querySelectorAll("#clinic-form .saved-box.on, #clinic-form .ex-row.on").forEach((el) => el.classList.remove("on"));
  if (box) box.classList.add("on");
}
$c("clinic-form").addEventListener("click", (event) => {
  const box = event.target.closest(".saved-box, .ex-row");
  if (box) markClinicBox(box);
});
$c("clinic-form").addEventListener("focusin", (event) => {
  const box = event.target.closest(".saved-box, .ex-row");
  if (box) markClinicBox(box);
});
$c("clinic-form").addEventListener("submit", (event) => {
  saveVisit(event).catch((err) => {
    setVisitSaving(false);
    $c("clinic-error").textContent = (err && err.message) || "The visit could not be saved. Try again.";
  });
});
$c("clinic-copy").addEventListener("click", async () => {
  const username = $c("clinic-username").value.trim();
  if (!username) return;
  try { await navigator.clipboard.writeText(username); $c("clinic-copy").textContent = "Copied"; }
  catch { $c("clinic-copy").textContent = username; }
});
if ($c("clinic-save-login")) $c("clinic-save-login").addEventListener("click", savePatientLogin);

if (clinicUiOn()) showClinicHome();
else showGate();
