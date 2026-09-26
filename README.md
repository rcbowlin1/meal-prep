# Grocery Run

A small, static meal-planning web app. Browse recipes, pick a few for the week, and get an
auto-categorized shopping list (fresh items included, pantry items flagged for confirmation).

**Model B (v1):** pure static — no backend, no accounts, no build step. Recipes live in
`data/recipes.json` (the source of truth, updated by commit). Weekly picks and the running
list live in the browser (localStorage), per device. Deploys as-is to GitHub Pages.

## Structure
- `index.html` — the app shell (3 tabs: Recipes / This Week / Grocery).
- `css/app.css` — cream + carrot design system.
- `js/app.js` — UI controller: loads recipes, manages state, renders the three views.
- `data/recipes.json` — the recipe list (source of truth; add recipes by committing here).
- `js/parse.js` — parses an ingredient line into quantity / unit / item (keeps fresh vs. dried on herbs).
- `js/categorize.js` — classifies an item as Produce / Meat & Seafood / Dairy & Eggs / Pantry / Other.
- `js/list.js` — merges duplicate ingredients across recipes and builds the categorized list.
- `test/engine.test.mjs` — node checks for the engine against the seed recipes.

## Run locally
It's fully static, but the app fetches `data/recipes.json`, so serve it over HTTP (not `file://`):
```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Test the engine
```bash
npm test
```

## Deploy
Push to GitHub and enable Pages (Settings → Pages → deploy from branch, root). No build step.

## How it works
- **Recipes** — browse all recipes, tap a card for ingredients + a link out to the full recipe, or "Add to week."
- **This Week** — your picks; "Generate grocery list" merges their ingredients.
- **Grocery** — categorized list with color-coded aisles, checkboxes, add-your-own-item, and Copy to clipboard.
- Picks and the running list persist per device (localStorage). Recipes are shared via the committed file.

## Roadmap
- Stored step-by-step instructions per recipe (today the detail links out to the source).
- Add-a-recipe form (today recipes are added by committing to `data/recipes.json`).
- PWA install polish (raster icons for iOS home screen).
- Later (Model C, optional): a shared store so both phones can add recipes live.
