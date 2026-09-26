# Meal Prep — Bowlin's Shopping List

A small, static meal-planning web app. Browse recipes, pick a few for the week, and get an
auto-categorized shopping list (fresh items included, pantry items flagged for confirmation).

**Model B (v1):** pure static — no backend, no accounts, no build step. Recipes live in
`data/recipes.json` (the source of truth, updated by commit). Weekly picks and the running
list live in the browser (localStorage), per device. Deploys as-is to GitHub Pages.

## Structure
- `data/recipes.json` — the recipe list (seed data; add recipes by committing here).
- `js/parse.js` — parses an ingredient line into quantity / unit / item.
- `js/categorize.js` — classifies an item as Produce / Meat & Seafood / Dairy & Eggs / Pantry / Other.
- `js/list.js` — merges duplicate ingredients across recipes and builds the categorized list.
- `test/engine.test.mjs` — node checks for the engine against the seed recipes.

## Test the engine
```bash
npm test
```

## Roadmap
- v1: static UI (deck / this week / shopping list / all recipes / add), PWA install.
- later (Model C, optional): a minimal shared store so both phones can add recipes live.
