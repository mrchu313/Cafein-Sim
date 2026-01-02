import {
  SYRUP_KEYS,
  BASE_SHOTS,
  FLAVORS,
  BASE_RULES,
  prettySize,
  orderName,
  abbrevFor,
  targetsFor
} from "./data.js";

// --- UI refs ---
const ticketEl = document.getElementById("ticket");
const resultEl = document.getElementById("result");
const recipeBoxEl = document.getElementById("recipeBox");

const sizeSel = document.getElementById("size");
const shotsSel = document.getElementById("shots");
const flavorSel = document.getElementById("flavor");
const caffeineSel = document.getElementById("caffeine");
const extraShotSel = document.getElementById("extraShot");
const milkSel = document.getElementById("milk");
const flavorSectionEl = document.getElementById("flavorSection");

// Syrup/sauce dropdowns
const syrupEls = Object.fromEntries(SYRUP_KEYS.map(k => [k, document.getElementById(`syrup_${k}`)]));

function populateSyrupSelect(sel) {
  const vals = [];
  for (let v = 0; v <= 6.0001; v += 0.5) vals.push(Number(v.toFixed(1)));
  sel.innerHTML = vals.map(v => `<option value="${v}">${v}</option>`).join("");
  sel.value = "0";
}
Object.values(syrupEls).forEach(populateSyrupSelect);

// --- Customer name generator ---
const FIRST = ["Ava","Mia","Noah","Liam","Emma","Olivia","Ethan","Lucas","Sofia","Zoe","Daniel","Chris","Sam","Jordan","Alex","Riley","Mason","Leo","Nora","Isla"];
const LAST  = ["Kim","Lee","Park","Johnson","Smith","Garcia","Martinez","Brown","Davis","Miller","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","White","Harris","Clark","Lewis"];
function randomName() {
  return `${FIRST[Math.floor(Math.random()*FIRST.length)]} ${LAST[Math.floor(Math.random()*LAST.length)]}`;
}
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const milkOptions = ["Whole","2%","Oat","Almond","Skim"];
let currentOrder = null;
let showRecipe = false;

function randomOrder() {
  const base = pickRandom(["Latte","Latte","Latte","Americano","Espresso","Expressoda"]);
  const size = pickRandom(Object.keys(BASE_SHOTS[base] || BASE_SHOTS["Latte"]));

  const milkRule = BASE_RULES[base] || { milkRequired: false, defaultMilk: "None" };
  let milk = milkRule.defaultMilk;

  if (milkRule.milkRequired) {
    milk = (Math.random() < 0.35) ? pickRandom(milkOptions) : milkRule.defaultMilk;
  } else {
    milk = "None";
  }

  const caffeine = pickRandom(["Regular","Regular","Regular","Half Caf","Decaf"]);
  const extraShot = Math.random() < 0.25;

  let flavor = "None";
  if (base === "Latte") flavor = pickRandom(["None", ...FLAVORS.filter(f => f !== "None")]);

  return { customer: randomName(), base, flavor, size, milk, caffeine, extraShot };
}

function applyUiForOrder(order) {
  const milkRule = BASE_RULES[order.base] || { milkRequired: false, defaultMilk: "None" };

  // Milk
  if (!milkRule.milkRequired) {
    milkSel.value = "None";
    milkSel.disabled = true;
  } else {
    milkSel.disabled = false;
    if (milkSel.value === "None") milkSel.value = "Whole";
  }

  // Flavor + syrups only for Latte
  const isLatte = order.base === "Latte";
  if (flavorSectionEl) flavorSectionEl.classList.toggle("hidden", !isLatte);

  flavorSel.disabled = !isLatte;
  for (const k of SYRUP_KEYS) syrupEls[k].disabled = !isLatte;

  if (!isLatte) {
    flavorSel.value = "None";
    for (const k of SYRUP_KEYS) syrupEls[k].value = "0";
  }
}

function renderTicket() {
  if (!currentOrder) {
    ticketEl.textContent = "(Press “New Order”)";
    recipeBoxEl.textContent = "";
    return;
  }

  const milkRule = BASE_RULES[currentOrder.base] || { milkRequired: false };

  const lines = [];
  lines.push(`NAME: ${currentOrder.customer}`);
  lines.push("");
  lines.push("ORDER:");
  lines.push(`- ${prettySize(currentOrder.size)}`);
  lines.push(`- ${orderName(currentOrder.base, currentOrder.flavor)}`);

  // Only show milk when it belongs
  if (milkRule.milkRequired) lines.push(`- Milk: ${currentOrder.milk}`);

  lines.push(`- Caffeine: ${currentOrder.caffeine}`);
  lines.push(`- Extra shot: ${currentOrder.extraShot ? "Yes" : "No"}`);

  // IMPORTANT: no abbreviation on ticket
  ticketEl.textContent = lines.join("\n");

  if (!showRecipe) {
    recipeBoxEl.textContent = "";
    return;
  }

  const t = targetsFor(currentOrder.base, currentOrder.flavor, currentOrder.size, currentOrder.extraShot);
  const syrupText = Object.entries(t.syrups)
    .filter(([,v]) => v > 0)
    .map(([k,v]) => `- ${k}: ${v}`)
    .join("\n") || "(none)";

  recipeBoxEl.textContent =
`RECIPE (training hint):
Shots: ${t.shots ?? "(n/a)"}

Syrups/Sauces:
${syrupText}`;
}

document.getElementById("toggleRecipe").addEventListener("click", () => {
  showRecipe = !showRecipe;
  const btn = document.getElementById("toggleRecipe");
  btn.textContent = showRecipe ? "Hide Recipe" : "Show Recipe";
  recipeBoxEl.classList.toggle("hidden", !showRecipe);
  renderTicket();
});

document.getElementById("newOrder").addEventListener("click", () => {
  currentOrder = randomOrder();
  applyUiForOrder(currentOrder);
  renderTicket();
  resultEl.textContent = "";

  // reset syrup inputs to 0 each new order
  for (const k of SYRUP_KEYS) syrupEls[k].value = "0";

  // reset build inputs
  flavorSel.value = "None";
  caffeineSel.value = "Regular";
  extraShotSel.value = "No";
  shotsSel.value = "2";

  // If the drink doesn't require milk, lock it to None
  if (BASE_RULES[currentOrder.base]?.milkRequired) {
    milkSel.value = "Whole";
  } else {
    milkSel.value = "None";
  }
});

function readBuild() {
  const syrups = {};
  for (const k of SYRUP_KEYS) syrups[k] = Number(syrupEls[k].value);

  return {
    size: sizeSel.value,
    shots: Number(shotsSel.value),
    flavor: flavorSel.value,
    milk: milkSel.value,
    caffeine: caffeineSel.value,
    extraShot: extraShotSel.value === "Yes",
    syrups
  };
}

function grade(order, build) {
  const targets = targetsFor(order.base, order.flavor, order.size, order.extraShot);
  const errors = [];

  if (build.size !== order.size) errors.push(`Size expected ${prettySize(order.size)}, got ${prettySize(build.size)}`);
  if (build.caffeine !== order.caffeine) errors.push(`Caffeine expected ${order.caffeine}, got ${build.caffeine}`);
  if (build.extraShot !== order.extraShot) errors.push(`Extra shot expected ${order.extraShot ? "Yes" : "No"}, got ${build.extraShot ? "Yes" : "No"}`);

  const milkRule = BASE_RULES[order.base] || { milkRequired: false };
  if (milkRule.milkRequired) {
    if (build.milk !== order.milk) errors.push(`Milk expected ${order.milk}, got ${build.milk}`);
  } else {
    if (build.milk !== "None") errors.push(`Milk should be "None" for ${order.base}.`);
  }

  if (targets.shots != null && build.shots !== targets.shots) {
    errors.push(`Shots expected ${targets.shots}, got ${build.shots}`);
  }

  const isLatte = order.base === "Latte";
  if (isLatte) {
    if (build.flavor !== order.flavor) errors.push(`Flavor expected "${order.flavor}", got "${build.flavor}"`);
  } else {
    if (build.flavor !== "None") errors.push(`Flavor should be "None" for ${order.base}.`);
  }

  // Syrup exact match (non-latte target is all zeros)
  for (const k of SYRUP_KEYS) {
    const expected = targets.syrups[k] ?? 0;
    const got = build.syrups[k] ?? 0;
    if (Math.abs(got - expected) > 0.001) errors.push(`${k} expected ${expected}, got ${got}`);
  }

  const score = Math.max(0, 100 - errors.length * 10);
  return { score, errors, targets };
}

document.getElementById("check").addEventListener("click", () => {
  if (!currentOrder) return;

  const build = readBuild();
  const out = grade(currentOrder, build);

  const lines = [];
  lines.push(`Score: ${out.score}`);
  if (out.errors.length) {
    lines.push("Errors:");
    out.errors.forEach(e => lines.push(`- ${e}`));
  } else {
    lines.push("Perfect.");
  }

  lines.push("");
  lines.push(`Correct build (${prettySize(currentOrder.size)} ${orderName(currentOrder.base, currentOrder.flavor)}):`);
  lines.push(`Abbreviation: (${abbrevFor(currentOrder.base, currentOrder.flavor)})`);

  const milkRule = BASE_RULES[currentOrder.base] || { milkRequired: false };
  if (milkRule.milkRequired) lines.push(`- Milk: ${currentOrder.milk}`);

  lines.push(`- Caffeine: ${currentOrder.caffeine}`);
  lines.push(`- Extra shot: ${currentOrder.extraShot ? "Yes" : "No"}`);
  lines.push(`- Shots: ${out.targets.shots ?? "(n/a)"}`);

  const syrupLines = Object.entries(out.targets.syrups)
    .filter(([,v]) => v > 0)
    .map(([k,v]) => `  - ${k}: ${v}`)
    .join("\n");

  lines.push(`- Syrups/Sauces:`);
  lines.push(syrupLines || "  (none)");

  resultEl.textContent = lines.join("\n");
});

// ---- Regular Canvas (free draw anywhere) ----
const canvas = document.getElementById("labelCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  clearCanvas();
}

function clearCanvas() {
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, rect.width, rect.height);
}

window.addEventListener("resize", fitCanvas);

let drawing = false;
let last = null;

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, pressure: e.pressure ?? 0.5 };
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  drawing = true;
  last = pos(e);
  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  if (!drawing || !last) return;
  const p = pos(e);

  const pressure = (e.pointerType === "pen") ? Math.max(0.08, p.pressure) : 0.35;

  ctx.strokeStyle = "#111";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.2 + pressure * 6;

  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  last = p;
  e.preventDefault();
});

function end(e) {
  drawing = false;
  last = null;
  e.preventDefault();
}
canvas.addEventListener("pointerup", end);
canvas.addEventListener("pointercancel", end);

document.getElementById("clearLabel").addEventListener("click", clearCanvas);

window.addEventListener("load", () => {
  fitCanvas();
  renderTicket();
});
