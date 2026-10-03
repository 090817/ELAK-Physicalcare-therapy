import { listPatients } from "./data.js?v=20";

const rowsEl = document.getElementById("rows");
const searchEl = document.getElementById("search");

let patients = [];
const genderZh = (g) => ({ Male: "男", Female: "女", Other: "其他" }[g] || g || "—");

function render(query = "") {
  const s = query.trim().toLowerCase();
  const list = patients.filter(
    (p) =>
      !s ||
      [p.name, p.patient_id, p.medical_record_number, p.condition].some((v) =>
        String(v).toLowerCase().includes(s)
      )
  );

  rowsEl.innerHTML = list.length
    ? list
        .map(
          (p, i) => `<tr data-id="${p.patient_id}">
        <td class="c-num">${i + 1}</td>
        <td class="c-name">${p.name}</td>
        <td class="c-id">${p.patient_id} · ${p.medical_record_number}</td>
        <td>${p.condition}</td>
        <td>${p.age}</td>
        <td>${genderZh(p.gender)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td class="empty" colspan="6">无匹配患者</td></tr>`;

  rowsEl.querySelectorAll("tr[data-id]").forEach((tr) =>
    tr.addEventListener("click", () => {
      location.href = `dashboard.html?id=${encodeURIComponent(tr.dataset.id)}`;
    })
  );
}

async function load() {
  patients = await listPatients();
  render(searchEl.value);
}

load().catch((err) => {
  rowsEl.innerHTML = `<tr><td class="empty" colspan="6">加载失败：${err.message}</td></tr>`;
});

searchEl.addEventListener("input", () => render(searchEl.value));

// 联动：PhysioQuest 在其它标签页注册/修改患者时，自动刷新列表
window.addEventListener("storage", (e) => {
  if (e.key === "full-range-plans-v1") load();
});
