// categorize.js — classify an ingredient item into a grocery category.
// Categories: "Produce" | "Meat & Seafood" | "Dairy & Eggs" | "Pantry" | "Other".
// Produce / Meat & Seafood / Dairy & Eggs are "Fresh" (included by default);
// Pantry is flagged (needs confirmation); Other is included but low-confidence.
import { normalizeName, HERBS } from "./parse.js";

export const CATEGORIES = ["Produce", "Meat & Seafood", "Dairy & Eggs", "Pantry", "Other"];
export const FRESH_CATEGORIES = new Set(["Produce", "Meat & Seafood", "Dairy & Eggs"]);

// When an herb is written bare (no "fresh"/"dried"), which aisle does it default to?
// Soft herbs are usually bought fresh; woody/seed herbs usually live on the spice rack.
const DRIED_DEFAULT_HERBS = new Set(["oregano", "thyme", "rosemary", "sage", "bay leaf", "marjoram", "tarragon"]);

// Herb aisle rule: "dried X" -> Pantry, "fresh X" -> Produce, bare herb -> its default.
// Returns a category string, or null if the name isn't an herb.
function herbCategory(name) {
  const m = name.match(/^(fresh|dried)\s+(.+)$/);
  if (m) {
    if (!HERBS.has(normalizeName(m[2]))) return null;
    return m[1] === "dried" ? "Pantry" : "Produce";
  }
  const bare = normalizeName(name);
  if (!HERBS.has(bare)) return null;
  return DRIED_DEFAULT_HERBS.has(bare) ? "Pantry" : "Produce";
}

// Seed keyword lists (starting point; expand freely). Order of checks matters — see classify().
const MEAT = ["chicken", "beef", "pork", "turkey", "lamb", "veal", "sausage", "bacon", "ham", "steak", "shrimp", "prawn", "salmon", "cod", "tilapia", "halibut", "trout", "fish", "crab", "scallop", "mussel", "clam", "lobster", "chorizo", "prosciutto", "pancetta", "brisket", "rib", "drumstick", "thigh", "tenderloin", "meatball", "mince", "hot dog", "salami", "pepperoni"];
const DAIRY = ["milk", "cheese", "butter", "cream", "yogurt", "egg", "parmesan", "mozzarella", "cheddar", "feta", "ricotta", "gruyere", "gouda", "halloumi", "mascarpone", "ghee", "kefir", "half-and-half", "cottage cheese"];
const PRODUCE = ["onion", "garlic", "ginger", "tomato", "potato", "carrot", "celery", "lettuce", "spinach", "kale", "cabbage", "broccoli", "cauliflower", "zucchini", "squash", "cucumber", "mushroom", "avocado", "lemon", "lime", "orange", "apple", "banana", "berry", "blueberry", "grape", "mango", "pineapple", "peach", "pear", "corn", "pea", "asparagus", "eggplant", "leek", "shallot", "radish", "beet", "arugula", "parsley", "cilantro", "basil", "mint", "dill", "chive", "rosemary", "thyme", "sage", "scallion", "green onion", "jalapeño", "jalapeno", "bell pepper", "poblano", "green bean", "fennel", "bok choy", "zest", "kiwi", "melon", "cherry", "plum", "fig", "pumpkin", "yam", "turnip", "parsnip", "okra", "artichoke", "sweet potato"];
const PANTRY = ["salt", "pepper", "peppercorn", "pepper flake", "cayenne", "cumin", "paprika", "oregano", "cinnamon", "nutmeg", "turmeric", "coriander", "curry", "garam masala", "allspice", "vanilla", "baking soda", "baking powder", "cornstarch", "cornmeal", "flour", "sugar", "honey", "maple syrup", "molasses", "oil", "vinegar", "sauce", "ketchup", "mustard", "mayo", "salsa", "paste", "wine", "sriracha", "tamari", "miso", "tahini", "jam", "oat", "breadcrumb", "panko", "lentil", "chickpea", "cracker", "cocoa", "raisin", "stock", "broth", "bouillon", "marinade", "dressing", "pasta", "noodle", "rice", "couscous", "quinoa", "orzo", "tortellini", "bean", "coconut milk", "coconut cream", "almond milk", "sesame seed", "curry paste", "fish sauce", "soy", "bamboo shoot", "chili sauce", "chili garlic", "tapioca", "almond flour", "tomato sauce", "marinara", "enchilada sauce", "olive"];
const OTHER = ["tortilla", "bread", "bun", "tofu", "tempeh", "pie crust", "chip", "pickle"];

function anyMatch(name, list) {
  return list.some((kw) => name.includes(kw));
}

// classify(itemName, overrides?) -> category string.
// `overrides` is an optional { normalizedName: category } lookup that wins over keywords.
export function classify(itemName, overrides = {}) {
  const name = (itemName || "").toLowerCase().trim();
  if (!name) return "Other";

  const key = normalizeName(itemName);
  if (overrides && overrides[key]) return overrides[key];

  // Herb fresh/dried rule wins over the keyword scan (dried thyme is a spice, not produce).
  const herbCat = herbCategory(name);
  if (herbCat) return herbCat;

  // Special rules first (they beat the generic keyword scan).
  // Ground/any meat -> Meat, even though "ground" reads like a dry good.
  if (anyMatch(name, MEAT)) {
    // ...unless it's clearly a sauce/broth/stock form of the protein.
    if (/\b(broth|stock|sauce|bouillon)\b/.test(name)) return "Pantry";
    return "Meat & Seafood";
  }
  // Canned/jarred broth & stock, and anything sauce/paste/oil-like -> Pantry.
  if (anyMatch(name, OTHER)) return "Other";
  if (anyMatch(name, DAIRY)) return "Dairy & Eggs";
  if (anyMatch(name, PRODUCE)) return "Produce";
  if (anyMatch(name, PANTRY)) return "Pantry";

  return "Other";
}

// Is this category included-by-default on the review screen?
export function isFresh(category) {
  return FRESH_CATEGORIES.has(category);
}
