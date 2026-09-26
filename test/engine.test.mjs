// Quick engine checks. Run: npm test  (node test/engine.test.mjs)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseIngredient } from "../js/parse.js";
import { classify } from "../js/categorize.js";
import { buildShoppingList, toPlainText } from "../js/list.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const recipes = JSON.parse(readFileSync(join(__dir, "../data/recipes.json"), "utf8"));

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "  ok" : "FAIL"}  ${label}${ok ? "" : `\n        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
}

console.log("\n— PARSE —");
const p = (s) => { const r = parseIngredient(s); return { q: r.quantity, u: r.unit, item: r.item }; };
check('"1 lb salmon, skin removed"', p("1 lb salmon, skin removed"), { q: 1, u: "lb", item: "salmon" });
check('"2 tbsp tapioca flour (optional)"', p("2 tbsp tapioca flour (optional)"), { q: 2, u: "tbsp", item: "tapioca flour" });
check('"1/4 cup honey"', p("1/4 cup honey"), { q: 0.25, u: "cup", item: "honey" });
check('"1 clove garlic, minced"', p("1 clove garlic, minced"), { q: 1, u: "clove", item: "garlic" });
check('"1 can (15 oz) chickpeas, drained and rinsed"', p("1 can (15 oz) chickpeas, drained and rinsed"), { q: 1, u: "can", item: "chickpeas" });
check('"2 1/2 cups vegetable or chicken broth"', p("2 1/2 cups vegetable or chicken broth"), { q: 2.5, u: "cup", item: "vegetable or chicken broth" });
check('"1 to 2 cups cooked chicken or chickpeas"', p("1 to 2 cups cooked chicken or chickpeas"), { q: 1, u: "cup", item: "chicken or chickpeas" });
check('"juice of 1 lemon"', p("juice of 1 lemon"), { q: 1, u: null, item: "lemon" });
check('"kosher salt and black pepper"', p("kosher salt and black pepper"), { q: null, u: null, item: "salt and pepper" });
check('"3 stalks celery, small diced"', p("3 stalks celery, small diced"), { q: 3, u: "stalk", item: "celery" });
check('"green onions, to top"', p("green onions, to top"), { q: null, u: null, item: "green onions" });

console.log("\n— CLASSIFY —");
const c = (s) => classify(parseIngredient(s).item);
check('ground beef -> Meat & Seafood', c("1 lb lean ground beef"), "Meat & Seafood");
check('chicken broth -> Pantry', c("6 cups low sodium chicken broth"), "Pantry");
check('cheddar cheese -> Dairy & Eggs', c("1 cup shredded cheddar cheese"), "Dairy & Eggs");
check('yellow onion -> Produce', c("1 small yellow onion"), "Produce");
check('olive oil -> Pantry', c("2 tbsp olive oil"), "Pantry");
check('tortillas -> Other', c("4 tortillas (6-inch), cut into strips"), "Other");
check('tofu -> Other', c("8 oz firm tofu, cut into 1/2-inch cubes"), "Other");
check('eggs -> Dairy & Eggs', c("2 large eggs"), "Dairy & Eggs");

console.log("\n— SAMPLE SHOPPING LIST (Pasta Bolognese + Zucchini beef meatballs + Salmon bowls) —");
const picked = recipes.filter((r) => ["pasta-bolognese", "zucchini-beef-meatballs", "salmon-bowls"].includes(r.id));
const { byCategory } = buildShoppingList(picked);
for (const cat of Object.keys(byCategory)) {
  if (!byCategory[cat].length) continue;
  const flag = (cat === "Pantry") ? "  (confirm)" : (cat === "Other" ? "  (low-confidence)" : "");
  console.log(`\n${cat}${flag}`);
  for (const it of byCategory[cat]) console.log(`  - ${it.display}   [${it.sources.join(", ")}]`);
}

console.log("\n— PLAIN-TEXT EXPORT PREVIEW —\n");
console.log(toPlainText(byCategory, { title: "Dinner list" }));

console.log(`\n— all 22 recipes parse without crashing —`);
let lines = 0;
for (const r of recipes) for (const l of r.ingredients) { parseIngredient(l); lines++; }
console.log(`  parsed ${lines} ingredient lines across ${recipes.length} recipes`);

console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECK(S) FAILED"} (${pass} passed, ${fail} failed)\n`);
process.exit(fail === 0 ? 0 : 1);
