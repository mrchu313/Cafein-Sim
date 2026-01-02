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

// Syrup/sauce dropdowns
const SYRUP_KEYS = ["M","WM","CAR","V","SIMPLE","HONEY","ROSE","LAV","FLAVOR"];
const syrupEls = Object.fromEntries(SYRUP_KEYS.map(k => [k, document.getElementById(`syrup_${k}`)]));

// Populate syrup dropdown options (0 to 6 by 0.5)
function populateSyrupSelect(sel) {
  const vals = [];
  for (let v = 0; v <= 6.0001; v += 0.5) vals.push(Number(v.toFixed(1)));
  sel.innerHTML = vals.map(v => `<option value="${v}">${v}</option>`).join("");
  sel.value = "0";
}
Object.values(syrupEls).forEach(populateSyrupSelect);

function prettySize(size) {
  const map = {
    "Hot 12": "Hot – Small",
    "Hot 16": "Hot – Large",
    "Iced 16": "Iced – Small",
    "Iced 20": "Iced – Large"
  };
  return map[size] || size;
}

// --- Customer name generator ---
const FIRST = ["Ava","Mia","Noah","Liam","Emma","Olivia","Ethan","Lucas","Sofia","Zoe","Daniel","Chris","Sam","Jordan","Alex","Riley","Mason","Leo","Nora","Isla"];
const LAST  = ["Kim","Lee","Park","Johnson","Smith","Garcia","Martinez","Brown","Davis","Miller","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","White","Harris","Clark","Lewis"];
function randomName() {
  return `${FIRST[Math.floor(Math.random()*FIRST.length)]} ${LAST[Math.floor(Math.random()*LAST.length)]}`;
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- Base drink shot rules (from your sheet patterns) ---
const BASE_SHOTS = {
  "Latte": {
    "Hot 12": 2,
    "Hot 16": 2,
    "Iced 16": 2,
    "Iced 20": 3
  },
  "Americano": {
    "Hot 12": 2,
    "Hot 16": 2,
    "Iced 16": 2,
    "Iced 20": 3
  }
};

// --- Flavor rules (syrup/sauce amounts per size) ---
// These are derived from the same recipes you showed previously.
// If your Excel differs, tell me and I’ll adjust to match exactly.
const FLAVOR_RULES = {
  "Mocha": {
    abbrev: "ML",
    syrups: {
      "Hot 12": { M: 2 },
      "Hot 16": { M: 2.5 },
      "Iced 16": { M: 2 },
      "Iced 20": { M: 2.5 }
    }
  },
  "White Mocha": {
    abbrev: "WML",
    syrups: {
      "Hot 12": { WM: 2 },
      "Hot 16": { WM: 2.5 },
      "Iced 16": { WM: 2 },
      "Iced 20": { WM: 2.5 }
    }
  },
  "Caramel": {
    abbrev: "CL",
    syrups: {
      "Hot 12": { CAR: 2 },
      "Hot 16": { CAR: 2.5 },
      "Iced 16": { CAR: 2 },
      "Iced 20": { CAR: 2.5 }
    }
  },
  "Vanilla": {
    abbrev: "VL",
    syrups: {
      // Your flavored latte line: 2.5 / 3 / 2.5 / 3.5 syrup
      "Hot 12": { FLAVOR: 2.5 },
      "Hot 16": { FLAVOR: 3 },
      "Iced 16": { FLAVOR: 2.5 },
      "Iced 20": { FLAVOR: 3.5 }
    }
  },
  "Lavender": {
    abbrev: "LL",
    syrups: {
      "Hot 12": { LAV: 3, SIMPLE: 1.5 },
      "Hot 16": { LAV: 4, SIMPLE: 2 },
      "Iced 16": { LAV: 3, SIMPLE: 1.5 },
      "Iced 20": { LAV: 3, SIMPLE: 1.5 }
    }
  },
  "Rose": {
    abbrev: "RL",
    syrups: {
      "Hot 12": { ROSE: 3, SIMPLE: 1.5 },
      "Hot 16": { ROSE: 4, SIMPLE: 2 },
      "Iced 16": { ROSE: 3, SIMPLE: 1.5 },
      "Iced 20": { ROSE: 3, SIMPLE: 1.5 }
    }
  },
  "Honey Cinnamon": {
    abbrev: "HCL",
    syrups: {
      // Honey cinnamon: 2.5 / 3 / 2.5 / 3.5 honey
      "Hot 12": { HONEY: 2.5 },
      "Hot 16": { HONEY: 3 },
      "Iced 16": { HONEY: 2.5 },
      "Iced 20": { HONEY: 3.5 }
    }
  },
  "Other Flavor": {
    abbrev: "FL",
    syrups: {
      // Generic flavored latte rule
      "Hot 12": { FLAVOR: 2.5 },
      "Hot 16": { FLAVOR: 3 },
      "Iced 16": { FLAVOR: 2.5 },
      "Iced 20": { FLAVOR: 3.5 }
    }
  }
};

const milkOptions = ["2%","Whole","Oat","Almond","Skim"];
let currentOrder = null;
let showRecipe = false;

function makeEmptySyrups() {
  return Object.fromEntries(SYRUP_KEYS.map(k => [k, 0]));
}

function mergeSyrups(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b || {})) out[k] = Number(((out[k] || 0) + (b[k] || 0)).toFixed(1));
  return out;
}

function orderDisplayName(order) {
  // Core requirement: show “Mocha Latte” etc.
  if (order.base === "Latte" && order.flavor && order.flavor !== "None") {
    return `${order.flavor} Latte`;
  }
  return order.base; // Americano, Latte (plain)
}

function abbrevForOrder(order) {
  // Hidden until after submit
  if (order.base === "Latte" && order.flavor && order.flavor !== "None") {
    return (FLAVOR_RULES[order.flavor]?.abbrev) || "L";
  }
  if (order.base === "Latte") return "L";
  if (order.base === "Americano") return "A";
  return "";
}

function getTargets(order) {
  const baseShots = BASE_SHOTS[order.base]?.[order.size] ?? null;
  const targetShots = (baseShots == null) ? null : baseShots + (order.extraShot ? 1 : 0);

  // Syrups: only if flavored latte
  let targetSyrups = makeEmptySyrups();
  let recipeText = "";

  if (order.base === "Latte" && order.flavor && order.flavor !== "None") {
    const flavorRule = FLAVOR_RULES[order.flavor];
    const flavorSyrups = flavorRule?.syrups?.[order.size] || {};
    targetSyrups = mergeSyrups(targetSyrups, flavorSyrups);

    recipeText = `Latte base + flavor\nFlavor: ${order.flavor}\nSyrups/Sauces required for ${prettySize(order.size)}:\n` +
      Object.entries(flavorSyrups).map(([k,v]) => `- ${k}: ${v}`).join("\n");
  } else if (order.base === "Latte") {
    recipeText = "Latte base (no flavor).";
  } else if (order.base === "Americano") {
    recipeText = "Americano (water + shots).";
  }

  return { shots: targetShots, syrups: targetSyrups, recipeText };
}

function randomOrder() {
  const base = pickRandom(["Latte","Latte","Latte","Americano"]); // weighted toward lattes
  const size = pickRandom(Object.keys(BASE_SHOTS[base] || BASE_SHOTS["Latte"]));
  const milk = (Math.random() < 0.35) ? pickRandom(milkOptions) : "2%";
  const caffeine = pickRandom(["Regular","Regular","Regular","Half Caf","Decaf"]);
  const extraShot = Math.random() < 0.25;

  // If it's a latte, often flavored
  let flavor = "None";
  if (base === "Latte") {
    flavor = pickRandom(["None","Mocha","White Mocha","Caramel","Vanilla","Lavender","Rose","Honey Cinnamon","Other Flavor"]);
  }

  // Rule: “Flavored latte must have specified syrup” is enforced in grading.
  return {
    customer: randomName(),
    base,
    flavor,
    size,
    milk,
    caffeine,
    extraShot
  };
}

function renderTicket() {
  if (!currentOrder) {
    ticketEl.textContent = "(Press “New Order”)";
    recipeBoxEl.textContent = "";
    return;
  }

  ticketEl.textContent =
`NAME: ${currentOrder.customer}

ORDER:
- ${prettySize(currentOrder.size)}
- ${orderDisplayName(currentOrder)}
- Milk: ${currentOrder.milk}
- Caffeine: ${currentOrder.caffeine}
- Extra shot: ${currentOrder.extraShot ? "Yes" : "No"}`;

  const targets = getTargets(currentOrder);

  if (showRecipe) {
    recipeBoxEl.textContent =
`RECIPE (training hint):
${targets.recipeText}

TARGETS:
Shots: ${targets.shots ?? "(n/a)"}`;
  } else {
    recipeBoxEl.textContent = "";
  }
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
  renderTicket();
  resultEl.textContent = "";

  // reset syrup inputs to 0 each new order
  for (const k of SYRUP_KEYS) syrupEls[k].value = "0";
  // reset build inputs to reasonable defaults
  flavorSel.value = "None";
  caffeineSel.value = "Regular";
  extraShotSel.value = "No";
  shotsSel.value = "2";
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
  const targets = getTargets(order);
  const errors = [];

  // Core ticket fields
  if (build.size !== order.size) errors.push(`Size expected ${prettySize(order.size)}, got ${prettySize(build.size)}`);
  if (build.milk !== order.milk) errors.push(`Milk expected ${order.milk}, got ${build.milk}`);
  if (build.caffeine !== order.caffeine) errors.push(`Caffeine expected ${order.caffeine}, got ${build.caffeine}`);
  if (build.extraShot !== order.extraShot) errors.push(`Extra shot expected ${order.extraShot ? "Yes" : "No"}, got ${build.extraShot ? "Yes" : "No"}`);

  // Shots check
  if (targets.shots != null) {
    if (build.shots !== targets.shots) {
      errors.push(`Shots expected ${targets.shots}, got ${build.shots}`);
    }
  }

  // Flavor correctness for lattes
  const flavoredLatte = (order.base === "Latte" && order.flavor !== "None");

  if (order.base === "Latte") {
    // Must match the ordered flavor
    if (build.flavor !== order.flavor) {
      errors.push(`Flavor expected "${order.flavor}", got "${build.flavor}"`);
    }

    // “Flavored latte must have specified syrup”
    if (flavoredLatte) {
      const expected = targets.syrups;
      const anyExpected = Object.values(expected).some(v => v > 0);
      const anySelected = Object.values(build.syrups).some(v => v > 0);

      if (anyExpected && !anySelected) {
        errors.push(`No syrup/sauce selected (flavored latte requires flavor pumps).`);
      }
    }
  } else {
    // Non-latte: user should not select a flavor
    if (build.flavor !== "None") {
      errors.push(`Flavor should be "None" for ${order.base}.`);
    }
  }

  // Syrup checks: must match exactly to target profile
  for (const k of SYRUP_KEYS) {
    const expected = targets.syrups[k] ?? 0;
    const got = build.syrups[k] ?? 0;
    if (Math.abs(got - expected) > 0.001) {
      errors.push(`${k} expected ${expected}, got ${got}`);
    }
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
  lines.push(`Correct build (${prettySize(currentOrder.size)} ${orderDisplayName(currentOrder)}):`);
  // Abbreviation revealed ONLY after submit
  lines.push(`Abbreviation: (${abbrevForOrder(currentOrder)})`);
  lines.push(`- Milk: ${currentOrder.milk}`);
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

// ---- Drawing canvas (Apple Pencil-ready) ----
const canvas = document.getElementById("labelCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.scale(dpr, dpr);
  clearCanvas();
}

function clearCanvas() {
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, rect.width, rect.height);
}

window.addEventListener("resize", fitCanvas);
fitCanvas();

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

renderTicket();
