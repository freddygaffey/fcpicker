// fcPicker labeler — vanilla JS, no build step.

const state = {
  categories: [],
  activeCategory: null,
  items: [],
  filter: "",
  activeSlug: null,
  detail: null, // { data, sources }
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "onclick") node.onclick = v;
    else if (k === "oninput") node.oninput = v;
    else if (k === "onchange") node.onchange = v;
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
};

function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = el("div", { class: "toast" }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1500);
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

async function loadCategories() {
  state.categories = await api("/api/categories");
  const nav = $("#categories");
  nav.innerHTML = "";
  for (const c of state.categories) {
    nav.append(el("button", {
      class: state.activeCategory === c.key ? "active" : "",
      onclick: () => selectCategory(c.key),
    }, c.display));
  }
  if (!state.activeCategory && state.categories.length) {
    selectCategory(state.categories[0].key);
  }
}

async function selectCategory(key) {
  state.activeCategory = key;
  state.activeSlug = null;
  state.detail = null;
  await loadCategories();
  state.items = await api(`/api/category/${key}`);
  renderSlugList();
  renderDetail();
}

function renderSlugList() {
  const ul = $("#slug-list");
  ul.innerHTML = "";
  const filtered = state.items.filter((it) =>
    !state.filter ||
    it.slug.toLowerCase().includes(state.filter.toLowerCase()) ||
    it.name.toLowerCase().includes(state.filter.toLowerCase())
  );
  for (const it of filtered) {
    ul.append(el("li", {
      class: state.activeSlug === it.slug ? "active" : "",
      onclick: () => selectSlug(it.slug),
    }, it.name, el("span", { class: `badge ${it.status}` }, it.status)));
  }
}

async function selectSlug(slug) {
  state.activeSlug = slug;
  state.detail = await api(`/api/item/${state.activeCategory}/${slug}`);
  renderSlugList();
  renderDetail();
}

function renderDetail() {
  const root = $("#detail");
  root.innerHTML = "";
  if (!state.detail) {
    root.append(el("p", { class: "empty" }, "Pick a slug."));
    return;
  }
  const { data, sources } = state.detail;
  const cfg = state.categories.find((c) => c.key === state.activeCategory);
  const nameKey = state.activeCategory === "boards" ? "name" : "display_name";
  const name = data[nameKey] || data.slug;
  const cat = state.activeCategory;
  const slug = data.slug || state.activeSlug;

  root.append(el("h2", {}, name));
  root.append(el("div", { class: "slug" }, `${cat} / ${slug}`));

  // Sources
  const sourcesTa = el("textarea", { placeholder: "https://...\nhttps://..." }, sources || "");
  const sourcesSec = el("section", {},
    el("h3", {},
      "Sources",
      el("button", {
        onclick: async () => {
          await api(`/api/sources/${cat}/${slug}`, { method: "PUT", body: { text: sourcesTa.value } });
          toast("sources saved");
          refreshList();
        },
      }, "save"),
    ),
    sourcesTa,
    el("div", { class: "actions" },
      el("button", {
        class: "secondary",
        onclick: () => queue("find_sources"),
      }, "Queue source discovery"),
      el("button", {
        class: "secondary",
        onclick: () => queue("extract"),
      }, "Queue extraction"),
    ),
  );
  root.append(sourcesSec);

  // AI block
  if (data.ai && Object.keys(data.ai).length) {
    const aiSec = el("section", {}, el("h3", {}, "AI-extracted (review & promote)"));
    for (const [k, v] of Object.entries(data.ai)) {
      aiSec.append(el("div", { class: "field-row" },
        el("label", {}, k),
        el("div", { class: "ai-val" }, JSON.stringify(v, null, 2)),
        el("button", {
          class: "promote",
          onclick: () => promoteField(k, v),
        }, "→ manual"),
      ));
    }
    root.append(aiSec);
  }

  // Manual block
  if (data.manual) {
    const manualSec = el("section", {}, el("h3", {}, "Manual (edit & save)"));
    const inputs = {};
    for (const [k, v] of Object.entries(data.manual)) {
      const isComplex = Array.isArray(v) || (v && typeof v === "object");
      const input = isComplex
        ? el("textarea", {}, JSON.stringify(v, null, 2))
        : el("input", { type: typeof v === "number" ? "number" : "text", value: v ?? "" });
      inputs[k] = { input, isComplex };
      manualSec.append(el("div", { class: "field-row" },
        el("label", {}, k),
        input,
        el("span", {}),
      ));
    }
    manualSec.append(el("div", { class: "actions" },
      el("button", {
        class: "primary",
        onclick: async () => {
          const manual = {};
          for (const [k, { input, isComplex }] of Object.entries(inputs)) {
            if (isComplex) {
              try { manual[k] = JSON.parse(input.value || "null"); }
              catch { toast(`bad JSON for ${k}`); return; }
            } else {
              const raw = input.value;
              if (input.type === "number") {
                manual[k] = raw === "" ? null : Number(raw);
              } else {
                manual[k] = raw === "" ? null : raw;
              }
            }
          }
          await api(`/api/manual/${cat}/${slug}`, { method: "PUT", body: { manual } });
          toast("manual saved");
          await selectSlug(slug);
          refreshList();
        },
      }, "Save manual"),
    ));
    root.append(manualSec);
  }

  // Raw JSON (collapsed at bottom for reference)
  const raw = el("section", {},
    el("h3", {}, "Raw JSON"),
    el("pre", {}, JSON.stringify(data, null, 2)),
  );
  root.append(raw);
}

async function promoteField(key, value) {
  const cat = state.activeCategory;
  const slug = state.activeSlug;
  const current = state.detail.data.manual || {};
  const updated = { ...current, [key]: value };
  await api(`/api/manual/${cat}/${slug}`, { method: "PUT", body: { manual: updated } });
  toast(`promoted ${key}`);
  await selectSlug(slug);
  refreshList();
}

async function queue(action) {
  await api("/api/queue", {
    method: "POST",
    body: { action, category: state.activeCategory, slug: state.activeSlug },
  });
  toast(`queued: ${action}`);
  refreshQueueCount();
}

async function refreshList() {
  state.items = await api(`/api/category/${state.activeCategory}`);
  renderSlugList();
}

async function refreshQueueCount() {
  const q = await api("/api/queue");
  $("#queue-btn").textContent = `Queue (${q.length})`;
}

async function showQueue() {
  const q = await api("/api/queue");
  $("#queue-list").textContent = q.length
    ? q.map((e) => `${e.action}  ${e.category}/${e.slug}`).join("\n")
    : "(empty)";
  $("#queue-dialog").showModal();
}

$("#filter").oninput = (e) => { state.filter = e.target.value; renderSlugList(); };
$("#queue-btn").onclick = showQueue;

loadCategories().then(refreshQueueCount);
setInterval(refreshQueueCount, 5000);
