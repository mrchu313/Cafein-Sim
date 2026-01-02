import { FLAVORS, SYRUP_KEYS, SIZE_KEYS, prettySize, orderName, targetsFor } from "./data.js";

const qEl = document.getElementById("q");
const baseFilterEl = document.getElementById("baseFilter");
const flavorFilterEl = document.getElementById("flavorFilter");
const listEl = document.getElementById("list");
const detailsEl = document.getElementById("details");

const modeBrowseBtn = document.getElementById("modeBrowse");
const modeFlashBtn = document.getElementById("modeFlash");
const browsePane = document.getElementById("browsePane");
const flashPane = document.getElementById("flashPane");

const newCardBtn = document.getElementById("newCard");
const revealBtn = document.getElementById("reveal");
const flashcardEl = document.getElementById("flashcard");

// Build recipe catalog from base + flavors
function buildCatalog() {
  const items = [];

  // Latte: plain + flavored
  for (const size of SIZE_KEYS) {
    items.push({ base: "Latte", flavor: "None", size });
    for (const flavor of FLAVORS) {
      if (flavor === "None") continue;
      items.push({ base: "Latte", flavor, size });
    }
  }

  // Americano (no flavors)
  for (const size of SIZE_KEYS) items.push({ base: "Americano", flavor: "None", size });

  // Espresso (hot only)
  for (const size of ["Hot 12", "Hot 16"]) items.push({ base: "Espresso", flavor: "None", size });

  // Expressoda (iced only)
  for (const size of ["Iced 16", "Iced 20"]) items.push({ base: "Expressoda", flavor: "None", size });

  return items;
}

const CATALOG = buildCatalog();

function setFlavorFilterOptions() {
  flavorFilterEl.innerHTML =
    [`<option value="All">All</option>`, ...FLAVORS.map(f => `<option value="${f}">${f}</option>`)].join("");
  flavorFilterEl.value = "All";
}
setFlavorFilterOptions();

function matches(item) {
  const q = (qEl.value || "").trim().toLowerCase();
  const baseF = baseFilterEl.value;
  const flavorF = flavorFilterEl.value;

  const name = orderName(item.base, item.flavor).toLowerCase();
  const size = prettySize(item.size).toLowerCase();

  if (baseF !== "All" && item.base !== baseF) return false;
  if (flavorF !== "All" && item.flavor !== flavorF) return false;

  if (q) {
    if (
      !name.includes(q) &&
      !size.includes(q) &&
      !item.base.toLowerCase().includes(q) &&
      !item.flavor.toLowerCase().includes(q)
    ) return false;
  }
  return true;
}

function syrupLines(syrups) {
  const lines = [];
  for (const k of SYRUP_KEYS) {
    const v = syrups[k] ?? 0;
    if (v > 0) lines.push(`- ${k}: ${v}`);
  }
  return lines.length ? lines.join("\n") : "(none)";
}

function renderDetails(item) {
  const t = targetsFor(item.base, item.flavor, item.size, false);
  detailsEl.textContent =
`${orderName(item.base, item.flavor)}
Size: ${prettySize(item.size)}

Shots: ${t.shots ?? "(n/a)"}

Syrups/Sauces:
${syrupLines(t.syrups)}`;
}

let selected = null;

function renderList() {
  const items = CATALOG.filter(matches);

  listEl.innerHTML = "";
  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = `${orderName(item.base, item.flavor)} — ${prettySize(item.size)}`;
    div.addEventListener("click", () => {
      selected = item;
      renderDetails(item);
    });
    listEl.appendChild(div);

    if (idx === 0 && !selected) {
      selected = item;
      renderDetails(item);
    }
  });

  if (!items.length) detailsEl.textContent = "(No matches.)";
}

qEl.addEventListener("input", renderList);
baseFilterEl.addEventListener("change", renderList);
flavorFilterEl.addEventListener("change", renderList);

// Mode toggle
function setMode(mode) {
  if (mode === "browse") {
    modeBrowseBtn.classList.add("primary");
    modeFlashBtn.classList.remove("primary");
    browsePane.classList.remove("hidden");
    flashPane.classList.add("hidden");
  } else {
    modeFlashBtn.classList.add("primary");
    modeBrowseBtn.classList.remove("primary");
    flashPane.classList.remove("hidden");
    browsePane.classList.add("hidden");
  }
}

modeBrowseBtn.addEventListener("click", () => setMode("browse"));
modeFlashBtn.addEventListener("click", () => setMode("flash"));

// Flashcards
let currentCard = null;
let revealed = false;

function randomCard() {
  return CATALOG[Math.floor(Math.random() * CATALOG.length)];
}

function renderCard() {
  if (!currentCard) {
    flashcardEl.textContent = "(Press “New Card”)";
    return;
  }

  if (!revealed) {
    flashcardEl.textContent =
`${orderName(currentCard.base, currentCard.flavor)}
${prettySize(currentCard.size)}

(Front)`;
  } else {
    const t = targetsFor(currentCard.base, currentCard.flavor, currentCard.size, false);
    flashcardEl.textContent =
`${orderName(currentCard.base, currentCard.flavor)}
${prettySize(currentCard.size)}

(Back)
Shots: ${t.shots ?? "(n/a)"}

Syrups/Sauces:
${syrupLines(t.syrups)}`;
  }
}

newCardBtn.addEventListener("click", () => {
  currentCard = randomCard();
  revealed = false;
  revealBtn.textContent = "Reveal";
  renderCard();
});

revealBtn.addEventListener("click", () => {
  if (!currentCard) return;
  revealed = !revealed;
  revealBtn.textContent = revealed ? "Hide" : "Reveal";
  renderCard();
});

// Start
setMode("browse");
renderList();
