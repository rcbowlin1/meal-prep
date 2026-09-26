// app.js — UI controller for Bowlin's Shopping List (static, no backend).
// State lives in localStorage; recipes come from data/recipes.json.
import { parseIngredient, normalizeName } from "./parse.js";
import { classify } from "./categorize.js";
import { buildShoppingList } from "./list.js";

const KEYS = { week: "mp.week", list: "mp.list", overrides: "mp.overrides" };

const CAT_ORDER = ["Produce", "Meat & Seafood", "Dairy & Eggs", "Pantry", "Other"];
const CAT_DOT = {
  "Produce": "dot-produce",
  "Meat & Seafood": "dot-meat",
  "Dairy & Eggs": "dot-dairy",
  "Pantry": "dot-pantry",
  "Other": "dot-other",
};
const CAT_NOTE = { "Pantry": "check your shelf first", "Other": "double-check these" };

let recipes = [];
const state = {
  week: load(KEYS.week, []),
  list: load(KEYS.list, []),
  overrides: load(KEYS.overrides, {}),
};

// ---- storage helpers ----
function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ---- small utils ----
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = (id) => document.getElementById(id);
function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function itemKey(nameKey, unit) { return `${nameKey}|${unit || ""}`; }

let toastTimer;
function toast(msg) {
  const t = byId("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
}

// ---- routing ----
const VIEWS = ["recipes", "week", "grocery"];
function currentView() {
  const v = location.hash.replace("#", "");
  return VIEWS.includes(v) ? v : "recipes";
}
function render() {
  const view = currentView();
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  const badge = byId("week-badge");
  badge.textContent = state.week.length;
  badge.hidden = state.week.length === 0;

  const main = byId("view");
  if (view === "recipes") main.innerHTML = renderRecipes();
  else if (view === "week") main.innerHTML = renderWeek();
  else main.innerHTML = renderGrocery();
  window.scrollTo(0, 0);
}

// ---- Recipes view ----
function renderRecipes() {
  const cards = recipes
    .filter((r) => r.status !== "archived")
    .map((r) => {
      const inWeek = state.week.includes(r.id);
      const d = domain(r.url);
      const n = (r.ingredients || []).length;
      return `<article class="recipe-card" data-recipe="${esc(r.id)}">
        <h3>${esc(r.title)}</h3>
        <div class="recipe-meta">
          ${d ? `<span>${esc(d)}</span><span class="dot"></span>` : ""}
          <span>${n} ingredient${n === 1 ? "" : "s"}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-ghost toggle-week ${inWeek ? "in-week" : ""}" data-toggle="${esc(r.id)}">
            ${inWeek ? "✓ In this week" : "+ Add to week"}
          </button>
        </div>
      </article>`;
    })
    .join("");
  return `<div class="view-head"><h2>Recipes</h2><span class="count">${recipes.length} recipes</span></div>
    <div class="recipe-grid">${cards}</div>`;
}

// ---- This Week view ----
function renderWeek() {
  const picked = state.week.map((id) => recipes.find((r) => r.id === id)).filter(Boolean);
  if (!picked.length) {
    return `<div class="view-head"><h2>This Week</h2></div>
      <div class="empty"><div class="big">No dinners picked yet.</div>
      Head to <a href="#recipes">Recipes</a> and tap “Add to week.”</div>`;
  }
  const rows = picked.map((r) => `<div class="week-row" data-recipe="${esc(r.id)}">
      <span class="title">${esc(r.title)}</span>
      <button class="btn btn-sm btn-danger rm" data-remove="${esc(r.id)}">Remove</button>
    </div>`).join("");
  return `<div class="view-head"><h2>This Week</h2><span class="count">${picked.length} picked</span></div>
    <div class="week-list">${rows}</div>
    <div class="week-actions">
      <button class="btn btn-primary" id="generate">Generate grocery list</button>
      <button class="btn btn-ghost" id="clear-week">Clear week</button>
    </div>`;
}

// ---- Grocery view ----
function groupList() {
  const groups = {};
  for (const cat of CAT_ORDER) groups[cat] = [];
  for (const it of state.list) (groups[it.category] || groups.Other).push(it);
  for (const cat of CAT_ORDER) groups[cat].sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}
function renderGrocery() {
  if (!state.list.length) {
    return `<div class="view-head"><h2>Grocery</h2></div>
      <div class="empty"><div class="big">Your list is empty.</div>
      Pick recipes in <a href="#week">This Week</a>, then Generate — or add items below.</div>
      ${addItemRow()}`;
  }
  const groups = groupList();
  const total = state.list.length;
  const done = state.list.filter((i) => i.checked).length;
  let body = "";
  for (const cat of CAT_ORDER) {
    const items = groups[cat];
    if (!items.length) continue;
    const note = CAT_NOTE[cat] ? ` <span class="cat-note">· ${CAT_NOTE[cat]}</span>` : "";
    const rows = items.map((it) => {
      const srcs = it.custom ? "added by you" : (it.sources || []).join(", ");
      return `<label class="grocery-item ${it.checked ? "checked" : ""}" data-key="${esc(it.key)}">
        <input type="checkbox" ${it.checked ? "checked" : ""} data-check="${esc(it.key)}" />
        <span class="label">${esc(it.display)}${srcs ? ` <span class="src">${esc(srcs)}</span>` : ""}</span>
        <button class="del" data-del="${esc(it.key)}" aria-label="Remove">×</button>
      </label>`;
    }).join("");
    body += `<section class="cat-group">
      <h3 class="cat-head"><span class="cat-dot ${CAT_DOT[cat]}"></span>${esc(cat)}${note}</h3>
      ${rows}
    </section>`;
  }
  return `<div class="view-head"><h2>Grocery</h2><span class="count">${done}/${total} checked</span></div>
    ${body}
    ${addItemRow()}
    <div class="grocery-actions">
      <button class="btn btn-primary" id="copy">Copy list</button>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" id="clear-checked">Clear checked</button>
      <button class="btn btn-danger btn-sm" id="clear-all">Clear all</button>
    </div>`;
}
function addItemRow() {
  return `<form class="add-item-row" id="add-item">
    <input type="text" id="add-item-input" placeholder="Add your own item…" autocomplete="off" />
    <button class="btn btn-primary" type="submit">Add</button>
  </form>`;
}

// ---- actions ----
function toggleWeek(id) {
  const i = state.week.indexOf(id);
  if (i === -1) { state.week.push(id); toast("Added to this week"); }
  else { state.week.splice(i, 1); }
  save(KEYS.week, state.week);
  render();
}
function removeFromWeek(id) {
  state.week = state.week.filter((x) => x !== id);
  save(KEYS.week, state.week);
  render();
}
function generateList() {
  const picked = state.week.map((id) => recipes.find((r) => r.id === id)).filter(Boolean);
  const { items } = buildShoppingList(picked, state.overrides);
  const prevChecked = new Set(state.list.filter((i) => i.checked).map((i) => i.key));
  const customs = state.list.filter((i) => i.custom);
  const fromRecipes = items.map((it) => {
    const key = itemKey(it.nameKey, it.unit);
    return {
      key, name: it.name, display: it.display, unit: it.unit,
      category: it.category, sources: it.sources, custom: false,
      checked: prevChecked.has(key),
    };
  });
  // Keep hand-added items that aren't duplicated by a generated item.
  const genKeys = new Set(fromRecipes.map((i) => i.key));
  const keptCustoms = customs.filter((c) => !genKeys.has(c.key));
  state.list = [...fromRecipes, ...keptCustoms];
  save(KEYS.list, state.list);
  location.hash = "#grocery";
  toast(`Built list from ${picked.length} recipe${picked.length === 1 ? "" : "s"}`);
  render();
}
function addCustomItem(text) {
  const raw = text.trim();
  if (!raw) return;
  const parsed = parseIngredient(raw);
  const name = parsed.item || raw;
  const nameKey = normalizeName(name);
  const key = itemKey(nameKey, parsed.unit);
  if (state.list.some((i) => i.key === key)) { toast("Already on the list"); return; }
  const display = [parsed.quantity != null ? trimQty(parsed.quantity) : "", parsed.unit, name].filter(Boolean).join(" ");
  state.list.push({
    key, name, display: display || raw, unit: parsed.unit,
    category: classify(name, state.overrides), sources: [], custom: true, checked: false,
  });
  save(KEYS.list, state.list);
  render();
}
function trimQty(q) { return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100); }

function setChecked(key, checked) {
  const it = state.list.find((i) => i.key === key);
  if (it) { it.checked = checked; save(KEYS.list, state.list); }
}
function deleteItem(key) {
  state.list = state.list.filter((i) => i.key !== key);
  save(KEYS.list, state.list);
  render();
}
function clearChecked() {
  state.list = state.list.filter((i) => !i.checked);
  save(KEYS.list, state.list);
  render();
}
function clearAll() {
  if (!confirm("Clear the whole grocery list?")) return;
  state.list = [];
  save(KEYS.list, state.list);
  render();
}
function clearWeek() {
  state.week = [];
  save(KEYS.week, state.week);
  render();
}

// ---- copy to clipboard ----
function listText() {
  const groups = groupList();
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const lines = [`Grocery list — ${date}`, ""];
  for (const cat of CAT_ORDER) {
    const items = groups[cat].filter((i) => !i.checked);
    if (!items.length) continue;
    lines.push(cat);
    for (const it of items) lines.push(`- ${it.display}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
async function copyList() {
  const text = listText();
  if (!text) { toast("Nothing to copy"); return; }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    // Fallback for browsers without async clipboard (older Safari, insecure origin).
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("Copied to clipboard"); }
    catch { toast("Copy failed — select and copy manually"); }
    document.body.removeChild(ta);
  }
}

// ---- recipe detail modal ----
function openRecipe(id) {
  const r = recipes.find((x) => x.id === id);
  if (!r) return;
  const d = domain(r.url);
  const ings = (r.ingredients || []).map((l) => `<li>${esc(l)}</li>`).join("");
  const inWeek = state.week.includes(r.id);
  byId("modal-body").innerHTML = `
    <h2>${esc(r.title)}</h2>
    ${r.url ? `<a class="src-link" href="${esc(r.url)}" target="_blank" rel="noopener">View full recipe on ${esc(d)} ↗</a>` : ""}
    <div class="ing-head">Ingredients</div>
    <ul>${ings}</ul>
    <div class="modal-foot">
      <button class="btn btn-primary toggle-week ${inWeek ? "in-week" : ""}" data-toggle="${esc(r.id)}">
        ${inWeek ? "✓ In this week" : "+ Add to week"}
      </button>
    </div>`;
  byId("recipe-modal").showModal();
}

// ---- event wiring (delegated) ----
function wire() {
  document.addEventListener("click", (e) => {
    const t = e.target;

    const toggle = t.closest("[data-toggle]");
    if (toggle) { e.preventDefault(); e.stopPropagation(); toggleWeek(toggle.dataset.toggle); refreshModalIfOpen(); return; }

    const del = t.closest("[data-del]");
    if (del) { e.preventDefault(); deleteItem(del.dataset.del); return; }

    const remove = t.closest("[data-remove]");
    if (remove) { removeFromWeek(remove.dataset.remove); return; }

    if (t.closest("#generate")) { generateList(); return; }
    if (t.closest("#clear-week")) { clearWeek(); return; }
    if (t.closest("#copy")) { copyList(); return; }
    if (t.closest("#clear-checked")) { clearChecked(); return; }
    if (t.closest("#clear-all")) { clearAll(); return; }
    if (t.closest("#modal-close")) { byId("recipe-modal").close(); return; }

    const card = t.closest(".recipe-card");
    if (card) { openRecipe(card.dataset.recipe); return; }
  });

  document.addEventListener("change", (e) => {
    const chk = e.target.closest("[data-check]");
    if (chk) {
      setChecked(chk.dataset.check, chk.checked);
      chk.closest(".grocery-item").classList.toggle("checked", chk.checked);
      const done = state.list.filter((i) => i.checked).length;
      const c = document.querySelector(".view-head .count");
      if (c) c.textContent = `${done}/${state.list.length} checked`;
    }
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id === "add-item") {
      e.preventDefault();
      const input = byId("add-item-input");
      addCustomItem(input.value);
      // render() rebuilt the DOM; focus the fresh input for fast entry.
      const fresh = byId("add-item-input");
      if (fresh) fresh.focus();
    }
  });

  // Close modal on backdrop click.
  byId("recipe-modal").addEventListener("click", (e) => {
    if (e.target.id === "recipe-modal") e.target.close();
  });

  window.addEventListener("hashchange", render);
}
function refreshModalIfOpen() {
  const modal = byId("recipe-modal");
  if (modal.open) {
    const id = modal.querySelector("[data-toggle]")?.dataset.toggle;
    if (id) openRecipe(id);
  }
}

// ---- boot ----
async function boot() {
  wire();
  try {
    const res = await fetch("./data/recipes.json", { cache: "no-store" });
    recipes = await res.json();
  } catch (err) {
    byId("view").innerHTML = `<div class="empty"><div class="big">Couldn't load recipes.</div>${esc(String(err))}</div>`;
    return;
  }
  // Prune any stale ids from saved week (recipe file may have changed).
  const ids = new Set(recipes.map((r) => r.id));
  state.week = state.week.filter((id) => ids.has(id));
  save(KEYS.week, state.week);
  render();
}
boot();
