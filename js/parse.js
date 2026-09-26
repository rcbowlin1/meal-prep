// parse.js — turn a raw ingredient line into { quantity, unit, item, qualifier, raw }.
// Pure functions, no dependencies. Works in the browser (ES module) and in Node.

const UNICODE_FRACTIONS = {
  "\u00BC": 0.25, "\u00BD": 0.5, "\u00BE": 0.75,
  "\u2153": 1 / 3, "\u2154": 2 / 3,
  "\u215B": 0.125, "\u215C": 0.375, "\u215D": 0.625, "\u215E": 0.875,
};

// Canonical unit -> the variants that map to it.
const UNIT_ALIASES = {
  tsp: ["tsp", "teaspoon", "teaspoons"],
  tbsp: ["tbsp", "tbsp.", "tablespoon", "tablespoons"],
  cup: ["cup", "cups"],
  oz: ["oz", "oz.", "ounce", "ounces"],
  lb: ["lb", "lb.", "lbs", "pound", "pounds"],
  g: ["g", "gram", "grams"],
  kg: ["kg", "kilogram", "kilograms"],
  ml: ["ml", "milliliter", "milliliters"],
  l: ["l", "liter", "liters", "litre", "litres"],
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  jar: ["jar", "jars"],
  bunch: ["bunch", "bunches"],
  pinch: ["pinch", "pinches"],
  slice: ["slice", "slices"],
  stalk: ["stalk", "stalks"],
  head: ["head", "heads"],
  package: ["package", "packages", "pkg"],
  sprig: ["sprig", "sprigs"],
  pint: ["pint", "pints"],
  quart: ["quart", "quarts"],
  fillet: ["fillet", "fillets", "filet", "filets"],
  bag: ["bag", "bags"],
  block: ["block", "blocks"],
  stick: ["stick", "sticks"],
};

const UNIT_LOOKUP = {};
for (const canon in UNIT_ALIASES) {
  for (const v of UNIT_ALIASES[canon]) UNIT_LOOKUP[v] = canon;
}

// Prep/method words removed from the item name (they don't change what to buy).
const PREP_WORDS = new Set([
  "chopped", "diced", "minced", "sliced", "shredded", "grated", "crushed", "peeled",
  "halved", "cubed", "drained", "rinsed", "thawed", "melted", "softened", "trimmed",
  "cooked", "seasoned", "grilled", "roasted", "toasted", "beaten", "julienned",
  "quartered", "smashed", "mashed", "pitted", "seeded", "deveined",
]);

// Descriptive adjectives removed from the front of the item name.
const DESCRIPTORS = new Set([
  "large", "medium", "small", "fresh", "boneless", "skinless", "extra-virgin",
  "extra", "virgin", "lean", "whole", "raw", "ripe", "packed", "organic", "baby",
  "unsweetened", "unsalted", "salted", "dried", "frozen", "low-sodium", "low",
  "sodium", "part-skim", "reduced-fat", "plain", "smoked", "prepared", "kosher",
  "ground",
]);

// Trailing qualifiers that mean "not really a shopping quantity" — stripped from the name.
const QUALIFIER_PATTERNS = [
  /,?\s*(for serving|for garnish|for topping|for simmering|to top|to taste|for dusting|for drizzling|optional|divided|as needed|plus more.*|to serve)\s*$/i,
];

function stripParentheticals(s) {
  return s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

// Parse a quantity token like "1", "1/2", "1 1/2", "1.5", "½", "1½", "2-3", "2 to 3".
// Returns { value, rest } or null if the string doesn't start with a quantity.
function parseQuantity(str) {
  let s = str.trim();

  // Range: "2-3", "2 to 3", "1-2" -> take the first value.
  const range = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\b(.*)$/i);
  if (range) return { value: parseFloat(range[1]), rest: range[3].trim() };

  // Leading unicode fraction possibly glued to a whole number: "1½", "½".
  const uni = s.match(/^(\d+)?\s*([\u00BC-\u00BE\u2153-\u215E])(.*)$/);
  if (uni) {
    const whole = uni[1] ? parseInt(uni[1], 10) : 0;
    return { value: whole + (UNICODE_FRACTIONS[uni[2]] || 0), rest: uni[3].trim() };
  }

  // "1 1/2" (whole + ascii fraction).
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)(.*)$/);
  if (mixed) {
    return { value: parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10), rest: mixed[4].trim() };
  }

  // "1/2".
  const frac = s.match(/^(\d+)\/(\d+)(.*)$/);
  if (frac) return { value: parseInt(frac[1], 10) / parseInt(frac[2], 10), rest: frac[3].trim() };

  // Plain number / decimal.
  const num = s.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (num) return { value: parseFloat(num[1]), rest: num[2].trim() };

  return null;
}

function cleanItemName(name) {
  let s = stripParentheticals(name);
  // Everything after the first comma in an ingredient line is prep/descriptor noise
  // ("garlic, minced" / "salmon, skin removed" / "chickpeas, drained and rinsed").
  if (s.includes(",")) s = s.split(",")[0].trim();
  // Drop trailing serving/qualifier clauses that weren't comma-separated.
  for (const re of QUALIFIER_PATTERNS) s = s.replace(re, "").trim();
  // Strip leading descriptors and stray prep words.
  let words = s.split(/\s+/).filter(Boolean);
  while (words.length > 1 && (DESCRIPTORS.has(words[0].toLowerCase()) || PREP_WORDS.has(words[0].toLowerCase()))) {
    words.shift();
  }
  words = words.filter((w) => !PREP_WORDS.has(w.toLowerCase()));
  return words.join(" ").replace(/\s+/g, " ").trim();
}

// Normalized key for merging/overrides: lowercase, de-pluralized, punctuation-trimmed.
export function normalizeName(name) {
  let s = (name || "").toLowerCase().trim().replace(/[.,]+$/, "");
  // naive singularization
  if (/(ches|shes|ses|xes|zes)$/.test(s)) s = s.replace(/es$/, "");
  else if (/ies$/.test(s)) s = s.replace(/ies$/, "y");
  else if (/oes$/.test(s)) s = s.replace(/oes$/, "o");
  else if (/s$/.test(s) && !/ss$/.test(s)) s = s.replace(/s$/, "");
  return s.trim();
}

export function parseIngredient(raw) {
  const original = (raw || "").trim();
  let working = original.toLowerCase();

  // "salt and pepper[, to taste]" and similar -> a single unquantified pantry line.
  if (/^[\w\s]*salt and (black |white )?pepper/.test(working)) {
    return { quantity: null, unit: null, item: "salt and pepper", qualifier: null, raw: original };
  }

  // "juice of 1 lime" / "zest of 1 lemon" -> quantity + item (you buy the fruit).
  const jz = working.match(/^(?:juice|zest) of\s+(.*)$/);
  if (jz) working = jz[1];

  let quantity = null;
  const q = parseQuantity(working);
  if (q) { quantity = q.value; working = q.rest; }

  // Unit (only if a quantity was found and the next token is a known unit).
  let unit = null;
  if (quantity !== null) {
    const m = working.match(/^([a-z.]+)\b(.*)$/);
    if (m && UNIT_LOOKUP[m[1]]) { unit = UNIT_LOOKUP[m[1]]; working = m[2].trim(); }
  }

  // Drop a leading "of" ("1 can of beans").
  working = working.replace(/^of\s+/, "");

  const item = cleanItemName(working);
  return { quantity, unit, item, qualifier: null, raw: original };
}
