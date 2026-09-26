// assistant.js — "Ask the kitchen": deterministic search over the recipe data.
// No LLM, no API, no network. It matches your question against recipe titles,
// ingredients, and meal type, and answers with links that open the recipe.

const STOP = new Set([
  "the", "and", "or", "of", "to", "in", "on", "a", "an", "for", "with", "without",
  "what", "whats", "which", "can", "i", "you", "we", "make", "cook", "have", "has",
  "some", "something", "any", "anything", "idea", "ideas", "recipe", "recipes", "dish",
  "dishes", "me", "my", "is", "are", "do", "does", "use", "using", "uses", "that", "this",
  "how", "many", "much", "get", "give", "show", "find", "want", "need", "about", "there",
  // units / prep / measures — not useful search terms
  "cup", "cups", "tbsp", "tsp", "oz", "lb", "lbs", "can", "cans", "jar", "clove", "cloves",
  "large", "medium", "small", "fresh", "dried", "chopped", "diced", "minced", "ground",
  "grated", "sliced", "cut", "into", "pinch", "package", "packages", "optional", "serving",
]);

const MEAL_WORDS = {
  dessert: ["dessert", "desserts", "sweet", "sweets", "treat", "treats", "baking"],
  dinner: ["dinner", "dinners", "supper", "main", "mains", "savory", "savoury", "entree"],
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const singular = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

export function initAssistant(recipes) {
  const active = recipes.filter((r) => r.status !== "archived");

  // Build a searchable index + a vocabulary of "food words" that appear in the data.
  const vocab = new Set();
  const index = active.map((r) => {
    const titleLower = (r.title || "").toLowerCase();
    const ingredientText = (r.ingredients || []).join(" | ").toLowerCase();
    for (const w of `${titleLower} ${ingredientText}`.split(/[^a-z]+/)) {
      if (w.length >= 3 && !STOP.has(w)) { vocab.add(w); vocab.add(singular(w)); }
    }
    return { r, titleLower, ingredientText, meal: r.meal || "dinner" };
  });

  const els = {
    toggle: document.getElementById("assistant-toggle"),
    panel: document.getElementById("assistant"),
    close: document.getElementById("assistant-close"),
    log: document.getElementById("assistant-log"),
    chips: document.getElementById("assistant-chips"),
    form: document.getElementById("assistant-form"),
    input: document.getElementById("assistant-input"),
  };
  if (!els.toggle || !els.panel) return;

  // ---- open / close ----
  let greeted = false;
  function open() {
    els.panel.hidden = false;
    els.toggle.hidden = true;
    els.toggle.setAttribute("aria-expanded", "true");
    if (!greeted) { greet(); greeted = true; }
    setTimeout(() => els.input.focus(), 50);
  }
  function close() {
    els.panel.hidden = true;
    els.toggle.hidden = false;
    els.toggle.setAttribute("aria-expanded", "false");
  }
  els.toggle.addEventListener("click", open);
  els.close.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !els.panel.hidden) close(); });

  // ---- messages ----
  function addMsg(who, html) {
    const div = document.createElement("div");
    div.className = `assist-msg ${who}`;
    div.innerHTML = html;
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
    return div;
  }
  function resultsHtml(list) {
    return `<div class="assist-results">` + list.map((x) =>
      `<button class="assist-result" data-open="${esc(x.r.id)}">
        <span class="ar-title">${esc(x.r.title)}</span>
        <span class="ar-meta">${x.meal === "dessert" ? "Dessert" : "Dinner"} · ${(x.r.ingredients || []).length} ingredients</span>
      </button>`).join("") + `</div>`;
  }
  function greet() {
    addMsg("bot", `Hi! I search your recipes by ingredient, meal, or name — no AI, just matching. Ask me one:`);
    renderChips(["What's for dessert?", "Recipes with chicken", "What uses chickpeas?", "Dinner ideas"]);
  }
  function renderChips(labels) {
    els.chips.innerHTML = labels.map((l) => `<button class="assist-chip" type="button">${esc(l)}</button>`).join("");
  }

  // ---- the search ----
  function detectMeal(tokens) {
    for (const meal in MEAL_WORDS) if (tokens.some((t) => MEAL_WORDS[meal].includes(t))) return meal;
    return null;
  }
  function contentTokens(tokens) {
    const out = [];
    for (const t of tokens) {
      if (STOP.has(t) || t.length < 3) continue;
      if (MEAL_WORDS.dessert.includes(t) || MEAL_WORDS.dinner.includes(t)) continue;
      if (vocab.has(t) || vocab.has(singular(t))) out.push(singular(t));
    }
    return [...new Set(out)];
  }
  function matches(entry, token) {
    return entry.titleLower.includes(token) || entry.ingredientText.includes(token);
  }
  function sample(list, n) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  }

  function respond(qRaw) {
    const q = qRaw.toLowerCase();
    const tokens = q.split(/[^a-z]+/).filter(Boolean);
    const meal = detectMeal(tokens);
    const content = contentTokens(tokens);

    if (/how many/.test(q) && !content.length) {
      const d = index.filter((e) => e.meal === "dinner").length;
      const s = index.filter((e) => e.meal === "dessert").length;
      return `You've got ${index.length} recipes — ${d} dinners and ${s} dessert${s === 1 ? "" : "s"}.`;
    }

    let pool = meal ? index.filter((e) => e.meal === meal) : index;

    if (content.length) {
      const scored = pool.map((e) => ({ e, hits: content.filter((t) => matches(e, t)).length }))
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits);
      if (!scored.length) {
        return `I couldn't find a recipe with ${listWords(content)}${meal ? ` on the ${meal} list` : ""}. I match by ingredient, meal, or recipe name — try one ingredient at a time.`;
      }
      const all = scored.filter((x) => x.hits === content.length).map((x) => x.e);
      const chosen = (all.length ? all : scored.map((x) => x.e)).slice(0, 8);
      const lead = all.length
        ? `${chosen.length} recipe${chosen.length === 1 ? "" : "s"} with ${listWords(content)}:`
        : `Nothing with all of that, but these have some of it:`;
      return lead + resultsHtml(chosen);
    }

    if (meal) {
      const list = pool;
      if (!list.length) return `No ${meal} recipes yet.`;
      if (meal === "dessert" || list.length <= 6) return `Here's the ${meal} lineup:` + resultsHtml(list);
      return `You've got ${list.length} dinners — here are a few:` + resultsHtml(sample(list, 6));
    }

    // Nothing recognized — offer honest guidance.
    return `I can search by ingredient ("recipes with salmon"), by meal ("what's for dessert"), or by name ("pasta bolognese"). What are you after?`;
  }
  function listWords(arr) {
    if (arr.length === 1) return `<strong>${esc(arr[0])}</strong>`;
    return arr.slice(0, -1).map((w) => `<strong>${esc(w)}</strong>`).join(", ") + ` and <strong>${esc(arr[arr.length - 1])}</strong>`;
  }

  function ask(text) {
    const q = text.trim();
    if (!q) return;
    addMsg("user", esc(q));
    els.chips.innerHTML = "";
    const answer = respond(q);
    addMsg("bot", answer);
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = els.input.value;
    els.input.value = "";
    ask(v);
  });
  els.chips.addEventListener("click", (e) => {
    const chip = e.target.closest(".assist-chip");
    if (chip) ask(chip.textContent);
  });
  els.log.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open]");
    if (btn) window.dispatchEvent(new CustomEvent("open-recipe", { detail: { id: btn.dataset.open } }));
  });

  // Shareable question link: index.html?ask=chicken opens the assistant and asks it.
  const preset = new URLSearchParams(location.search).get("ask");
  if (preset) { open(); ask(preset); }
}
