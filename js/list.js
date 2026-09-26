// list.js — build a merged, categorized shopping list from picked recipes.
import { parseIngredient, normalizeName } from "./parse.js";
import { classify, isFresh } from "./categorize.js";

// Pretty-print a quantity (0.5 -> "1/2", 2.5 -> "2 1/2", 3 -> "3").
function formatQty(q) {
  if (q == null) return "";
  const whole = Math.floor(q);
  const frac = q - whole;
  const map = { 0.25: "1/4", 0.5: "1/2", 0.75: "3/4", 0.33: "1/3", 0.67: "2/3", 0.13: "1/8" };
  const key = Object.keys(map).find((k) => Math.abs(frac - parseFloat(k)) < 0.02);
  if (frac < 0.02) return String(whole);
  if (key) return whole > 0 ? `${whole} ${map[key]}` : map[key];
  return String(Math.round(q * 100) / 100);
}

export function formatItem(item) {
  const qty = formatQty(item.quantity);
  const parts = [qty, item.unit, item.name].filter(Boolean);
  return parts.join(" ").trim();
}

// recipes: array of { id, title, ingredients: string[] }
// overrides: { normalizedName: category }
// Returns { items: [...], byCategory: { cat: [items] } }.
export function buildShoppingList(recipes, overrides = {}) {
  const merged = new Map(); // key -> item

  for (const recipe of recipes) {
    for (const line of recipe.ingredients || []) {
      const parsed = parseIngredient(line);
      if (!parsed.item) continue;
      const nameKey = normalizeName(parsed.item);
      // Merge key: same item + same unit (null unit merges with null unit).
      const key = `${nameKey}|${parsed.unit || ""}`;

      if (merged.has(key)) {
        const it = merged.get(key);
        if (it.quantity != null && parsed.quantity != null) it.quantity += parsed.quantity;
        else if (parsed.quantity != null && it.quantity == null) it.quantity = parsed.quantity;
        if (!it.sources.includes(recipe.title)) it.sources.push(recipe.title);
      } else {
        merged.set(key, {
          name: parsed.item,
          nameKey,
          quantity: parsed.quantity,
          unit: parsed.unit,
          category: classify(parsed.item, overrides),
          fresh: false, // set below
          sources: [recipe.title],
          raw: [parsed.raw],
        });
      }
    }
  }

  const items = [...merged.values()];
  for (const it of items) {
    it.category = classify(it.name, overrides);
    it.fresh = isFresh(it.category);
    it.display = formatItem(it);
  }

  // Group by category in canonical order.
  const order = ["Produce", "Meat & Seafood", "Dairy & Eggs", "Pantry", "Other"];
  const byCategory = {};
  for (const cat of order) byCategory[cat] = items.filter((i) => i.category === cat)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { items, byCategory };
}

// Plain-text export for Apple Notes: dated title, category headers, one item per line,
// excluding checked-off items. `checkedKeys` is a Set of nameKey|unit keys to omit.
export function toPlainText(byCategory, { title = "Shopping list", checkedKeys = new Set() } = {}) {
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const lines = [`${title} — ${date}`, ""];
  for (const cat of Object.keys(byCategory)) {
    const items = byCategory[cat].filter((i) => !checkedKeys.has(`${i.nameKey}|${i.unit || ""}`));
    if (!items.length) continue;
    lines.push(cat);
    for (const it of items) lines.push(it.display);
    lines.push("");
  }
  return lines.join("\n").trim();
}
