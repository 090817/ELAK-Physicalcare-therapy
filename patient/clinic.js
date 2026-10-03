const clinic = { code: null, patient: "", note: "", rows: [] };
const $c = (id) => document.getElementById(id);

function blankRow() {
  return { pattern: "", reps: 6, cue: "", note: "", cueTouched: false };
}
function newClinicDraft() {
  clinic.code = null;
  clinic.patient = "";
  clinic.note = "";
  clinic.rows = [blankRow()];
  $c("clinic-error").textContent = "";
  $c("clinic-patient").value = "";
  if ($c("clinic-username")) $c("clinic-username").value = "";
  if ($c("clinic-pass")) $c("clinic-pass").value = "";
  if ($c("clinic-pass-confirm")) $c("clinic-pass-confirm").value = "";
  if ($c("clinic-pass-note")) $c("clinic-pass-note").textContent = "Choose the username and password this patient will use to sign in.";
  if ($c("clinic-copy")) $c("clinic-copy").textContent = "Copy username";
  $c("clinic-note").value = "";
  renderRows();
  renderHistory(null);
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
    cueTouched: true
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
  if ($c("clinic-username")) $c("clinic-username").value = plan.username || "";
  if ($c("clinic-pass")) $c("clinic-pass").value = "";
  if ($c("clinic-pass-confirm")) $c("clinic-pass-confirm").value = "";
  $c("clinic-note").value = "";
  renderRows();
  renderHistory(plan);
}
function renderRows() {
  const root = $c("clinic-rows");
  root.replaceChildren();
  clinic.rows.forEach((row, index) => {
    const card = document.createElement("div");
    card.className = "ex-row";
    const grid = document.createElement("div");
    grid.className = "ex-grid";
    const moveField = document.createElement("div");
    moveField.className = "field";
    const moveLabel = document.createElement("label");
    moveLabel.textContent = "Ankle movement";
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Choose an ankle movement";
    select.appendChild(empty);
    for (const base of Object.values(EX)) {
      if (!isAnkleEx(base.id)) continue;
      const opt = document.createElement("option");
      opt.value = base.id;
      opt.textContent = base.name + " · " + base.focus;
      select.appendChild(opt);
    }
    select.value = row.pattern;
    select.addEventListener("change", () => {
      row.pattern = select.value;
      const base = EX[row.pattern];
      if (base) {
        row.reps = base.reps;
        if (!row.cueTouched) row.cue = base.cue;
      }
      renderRows();
    });
    moveField.append(moveLabel, select);
    const repField = document.createElement("div");
    repField.className = "field";
    const repLabel = document.createElement("label");
    const base = EX[row.pattern];
    repLabel.textContent = base && base.type === "sustain" ? "Breaths" : "Reps";
    const reps = document.createElement("input");
    reps.type = "number";
    reps.min = "1";
    reps.max = base && base.type === "sustain" ? "8" : "20";
    reps.value = String(row.reps);
    reps.addEventListener("input", () => { row.reps = Number(reps.value) || 1; });
    repField.append(repLabel, reps);
    grid.append(moveField, repField);
    const cueField = document.createElement("div");
    cueField.className = "field";
    const cueLabel = document.createElement("label");
    cueLabel.textContent = "Cue the patient hears";
    const cue = document.createElement("textarea");
    cue.rows = 2;
    cue.maxLength = 180;
    cue.value = row.cue;
    cue.addEventListener("input", () => { row.cue = cue.value; row.cueTouched = true; });
    cueField.append(cueLabel, cue);
    const noteField = document.createElement("div");
    noteField.className = "field";
    const noteLabel = document.createElement("label");
    noteLabel.textContent = "Personal note";
    const note = document.createElement("input");
    note.maxLength = 140;
    note.placeholder = "Optional. Shown with the exercise.";
    note.value = row.note;
    note.addEventListener("input", () => { row.note = note.value; });
    noteField.append(noteLabel, note);
    const actions = document.createElement("div");
    actions.className = "icon-row";
    const up = document.createElement("button");
    up.type = "button";
    up.className = "ghost";
    up.textContent = "Up";
    up.disabled = index === 0;
    up.addEventListener("click", () => {
      const swap = clinic.rows[index - 1];
      clinic.rows[index - 1] = clinic.rows[index];
      clinic.rows[index] = swap;
      renderRows();
    });
    const down = document.createElement("button");
    down.type = "button";
    down.className = "ghost";
    down.textContent = "Down";
    down.disabled = index === clinic.rows.length - 1;
    down.addEventListener("click", () => {
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
      clinic.rows.splice(index, 1);
      if (!clinic.rows.length) clinic.rows.push(blankRow());
      renderRows();
    });
    actions.append(up, down, remove);
    card.append(grid, cueField, noteField, actions);
    root.appendChild(card);
  });
}
function renderHistory(plan) {
  const root = $c("clinic-history");
  root.replaceChildren();
  if (!plan || plan.visits.length < 2) return;
  const title = document.createElement("p");
  title.className = "kicker";
  title.textContent = "Earlier visits";
  const list = document.createElement("ul");
  list.className = "done-list";
  plan.visits.slice(0, -1).slice().reverse().forEach((visit) => {
    const li = document.createElement("li");
    const when = document.createElement("span");
    when.textContent = formatWhen(visit.date);
    const names = document.createElement("strong");
    names.textContent = ankleExercises(visit.exercises).map((item) => EX[item.pattern].name).join(", ");
    li.append(when, names);
    list.appendChild(li);
  });
  root.append(title, list);
}
function renderPatients() {
  const data = loadPlans();
  const root = $c("clinic-patients");
  root.replaceChildren();
  const mine = AUTH_OFF ? "" : (authRecord() ? authRecord().id : "");
  const plans = Object.values(data.plans)
    .filter((plan) => !mine || plan.clinicianId === mine)
    .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  if (!plans.length) {
    const empty = document.createElement("p");
    empty.className = "note";
    empty.textContent = "No patients yet.";
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
    meta.textContent = AUTH_OFF
      ? (visit ? formatWhen(visit.date) : "No visit yet")
      : ((plan.username || "No username") + (visit ? " · " + formatWhen(visit.date) : ""));
    btn.append(name, meta);
    btn.addEventListener("click", () => { loadClinicDraft(plan); renderPatients(); });
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
async function saveVisit(event) {
  event.preventDefault();
  if (!AUTH_OFF && !sessionOn()) {
    showGate();
    return;
  }
  $c("clinic-error").textContent = "";
  const patient = $c("clinic-patient").value.trim();
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
      note: (row.note || "").trim()
    });
  }
  if (!exercises.length) {
    $c("clinic-error").textContent = "Add at least one ankle movement.";
    return;
  }
  const username = AUTH_OFF
    ? ""
    : $c("clinic-username").value.trim().toLowerCase();
  if (!AUTH_OFF && !/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) {
    $c("clinic-error").textContent = "Usernames are 3–24 letters or numbers.";
    return;
  }
  const password = AUTH_OFF ? "" : $c("clinic-pass").value;
  const confirm = AUTH_OFF ? "" : $c("clinic-pass-confirm").value;
  if (!AUTH_OFF && password !== confirm) {
    $c("clinic-error").textContent = "Those passwords don't match.";
    return;
  }
  const data = loadPlans();
  const taken = username ? planByUsername(username) : null;
  const code = clinic.code && data.plans[clinic.code] ? clinic.code : makeCode(data.plans);
  if (taken && taken.code !== code) {
    $c("clinic-error").textContent = "That username is already in use.";
    return;
  }
  const existing = data.plans[code] || { code, patient, visits: [] };
  if (!AUTH_OFF && !existing.hash && password.length < 8) {
    $c("clinic-error").textContent = "Set a password of at least 8 characters for this patient.";
    return;
  }
  if (!AUTH_OFF && password && password.length < 8) {
    $c("clinic-error").textContent = "Use at least 8 characters, or leave the password blank.";
    return;
  }
  existing.patient = patient;
  if (username) existing.username = username;
  const clinician = authRecord();
  if (clinician) existing.clinicianId = clinician.id;
  if (password) {
    existing.salt = randomSalt();
    existing.hash = await hashPassword(password, existing.salt);
  }
  existing.updated = new Date().toISOString();
  existing.visits.push({
    date: existing.updated,
    note: $c("clinic-note").value.trim(),
    exercises
  });
  data.plans[code] = existing;
  savePlans(data);
  clinic.code = code;
  clinic.patient = patient;
  if ($c("clinic-copy")) $c("clinic-copy").textContent = "Copy username";
  if ($c("clinic-pass-note")) {
    $c("clinic-pass-note").textContent = password
      ? "Password saved. Give " + username + " and that password to the patient."
      : "This patient signs in as " + username + ".";
  }
  if ($c("clinic-pass")) $c("clinic-pass").value = "";
  if ($c("clinic-pass-confirm")) $c("clinic-pass-confirm").value = "";
  $c("clinic-note").value = "";
  clinic.note = "";
  renderPatients();
  renderHistory(existing);
}

let gateMode = "login";
function showGate(mode) {
  if (AUTH_OFF) {
    showEditor();
    return;
  }
  if (mode) gateMode = mode;
  else if (!loadClinicians().accounts.length) gateMode = "signup";
  const creating = gateMode === "signup";
  $c("editor").hidden = true;
  $c("gate").hidden = false;
  $c("sign-out").hidden = true;
  $c("who").hidden = true;
  $c("gate-login").classList.toggle("sel", !creating);
  $c("gate-signup").classList.toggle("sel", creating);
  $c("gate-kicker").textContent = "Ankle rehab";
  $c("gate-title").textContent = creating ? "Sign up" : "Log in";
  $c("gate-lede").textContent = creating
    ? "Create a clinician account on this browser. You can add more than one."
    : "Log in to edit the ankle sets for your patients.";
  $c("confirm-field").hidden = !creating;
  $c("clinician-confirm").required = creating;
  $c("clinician-pass").autocomplete = creating ? "new-password" : "current-password";
  $c("gate-submit").textContent = creating ? "Sign up" : "Log in";
  $c("gate-error").textContent = "";
  $c("clinician-pass").value = "";
  $c("clinician-confirm").value = "";
}
function showEditor() {
  if (!AUTH_OFF && (!sessionOn() || !authRecord())) {
    showGate();
    return;
  }
  $c("gate").hidden = true;
  $c("editor").hidden = false;
  $c("sign-out").hidden = AUTH_OFF;
  if (AUTH_OFF) {
    for (const id of ["clinic-username", "clinic-pass", "clinic-pass-confirm"]) {
      const field = $c(id);
      if (field) {
        field.required = false;
        field.disabled = true;
      }
    }
    const accountBox = $c("account-box");
    if (accountBox) accountBox.hidden = true;
  }
  const who = $c("who");
  if (AUTH_OFF || !authRecord()) {
    who.hidden = true;
    who.textContent = "";
  } else {
    who.hidden = false;
    who.textContent = authRecord().name;
  }
  renderPatients();
  if (!clinic.rows.length) newClinicDraft();
}

$c("gate-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $c("gate-error").textContent = "";
  const name = $c("clinician-name").value.trim();
  const password = $c("clinician-pass").value;
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
    showEditor();
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
$c("clinic-new").addEventListener("click", () => { newClinicDraft(); renderPatients(); });
$c("clinic-add").addEventListener("click", () => { clinic.rows.push(blankRow()); renderRows(); });
$c("clinic-form").addEventListener("submit", saveVisit);
$c("clinic-copy").addEventListener("click", async () => {
  const username = $c("clinic-username").value.trim();
  if (!username) return;
  try { await navigator.clipboard.writeText(username); $c("clinic-copy").textContent = "Copied"; }
  catch { $c("clinic-copy").textContent = username; }
});

if (AUTH_OFF || (sessionOn() && authRecord())) showEditor();
else showGate();
