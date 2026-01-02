import { SIZE_KEYS, prettySize, FLAVORS, orderName } from "./data.js";

const coffeeEl = document.getElementById("menuCoffee");
const lattesEl = document.getElementById("menuLattes");
const notesEl = document.getElementById("menuNotes");

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function menuItem(name, meta) {
  const wrap = el("div", "menuItem");
  wrap.appendChild(el("div", "menuItemName", name));
  wrap.appendChild(el("div", "menuItemMeta", meta));
  return wrap;
}

// Coffee items
const coffeeItems = [
  { name: "Americano", meta: "Espresso + water. Milk not standard (None)." },
  { name: "Espresso", meta: "Straight espresso. Milk not standard (None)." },
  { name: "Expressoda", meta: "Espresso + soda (iced). Milk not standard (None)." }
];

// Latte items
const latteItems = [
  { name: "Latte", meta: "Espresso + milk. Default milk: Whole." },
  ...FLAVORS.filter(f => f !== "None").map(f => ({
    name: orderName("Latte", f),
    meta: "Flavored latte variant."
  }))
];

coffeeItems.forEach(x => coffeeEl.appendChild(menuItem(x.name, x.meta)));
latteItems.forEach(x => lattesEl.appendChild(menuItem(x.name, x.meta)));

notesEl.textContent =
`Sizes:
${SIZE_KEYS.map(k => `- ${prettySize(k)} (${k})`).join("\n")}

Notes:
- Menu page is view-only (no recipes).
- Use Recipe Book for exact shots + syrups.
- Use Simulator to practice under ticket pressure.`;
