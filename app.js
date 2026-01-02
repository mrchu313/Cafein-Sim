import {
  SYRUP_KEYS,
  BASE_SHOTS,
  FLAVORS,
  FLAVOR_RULES,
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

// Populate syrup dropdown options (0 to 6 by 0.5)
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

const milkOptions = ["2%","Whole","Oat","Almond","Skim"];
let currentOrder = null;
let showRecipe = false;



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

renderTicket();
// ---- Cup Canvas (Apple Pencil-ready, clipped to label region) ----
const canvas = document.getElementById("labelCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

// Offscreen ink layer (stores handwriting only)
const inkCanvas = document.createElement("canvas");
const inkCtx = inkCanvas.getContext("2d");

let currentCupLayout = null; // { writeRect, isIced, ... }

function sizeKeyToCupLayout(sizeKey) {
  // writeRectRel = relative position inside the cup body bounding box
  const layouts = {
    "Hot 12":   { isIced: false, cupScale: 0.88, writeRectRel: { x: 0.25, y: 0.44, w: 0.50, h: 0.32 } },
    "Hot 16":   { isIced: false, cupScale: 0.98, writeRectRel: { x: 0.24, y: 0.42, w: 0.52, h: 0.36 } },
    "Iced 16":  { isIced: true,  cupScale: 0.94, writeRectRel: { x: 0.22, y: 0.40, w: 0.56, h: 0.38 } },
    "Iced 20":  { isIced: true,  cupScale: 1.02, writeRectRel: { x: 0.20, y: 0.38, w: 0.60, h: 0.42 } },
  };
  return layouts[sizeKey] || layouts["Hot 16"];
}

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  inkCanvas.width = canvas.width;
  inkCanvas.height = canvas.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  inkCtx.setTransform(1, 0, 0, 1, 0, 0);

  renderCup();
}

window.addEventListener("resize", fitCanvas);

function drawRoundedRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function computeLayout(sizeKey) {
  const layout = sizeKeyToCupLayout(sizeKey);
  const w = canvas.width;
  const h = canvas.height;

  const cupH = h * 0.90 * layout.cupScale;
  const cupW = w * 0.62 * layout.cupScale;
  const cupX = (w - cupW) / 2;
  const cupY = h * 0.06;

  const wr = layout.writeRectRel;
  const writeRect = {
    x: cupX + cupW * wr.x,
    y: cupY + cupH * wr.y,
    w: cupW * wr.w,
    h: cupH * wr.h
  };

  return { ...layout, cupX, cupY, cupW, cupH, writeRect };
}

function drawIceCubes(c, x, y, w, h) {
  const count = 4;
  for (let i = 0; i < count; i++) {
    const cx = x + (w * (0.16 + i * 0.20)) + (Math.random() * w * 0.02);
    const cy = y + (Math.random() * h * 0.18);
    const s = Math.min(w, h) * (0.26 + Math.random() * 0.07);

    c.save();
    c.globalAlpha = 0.92;
    c.fillStyle = "#ffffff";
    c.strokeStyle = "#111";
    c.lineWidth = Math.max(2, canvas.width * 0.002);
    c.translate(cx, cy);
    c.rotate((Math.random() - 0.5) * 0.35);
    drawRoundedRect(c, 0, 0, s, s, 10);
    c.fill();

    c.globalAlpha = 0.14;
    c.fillStyle = "#000";
    drawRoundedRect(c, s * 0.12, s * 0.12, s * 0.76, s * 0.20, 8);
    c.fill();

    c.globalAlpha = 1;
    c.stroke();
    c.restore();
  }
}

function drawSteam(c, x, y, w, h) {
  c.save();
  c.strokeStyle = "#111";
  c.globalAlpha = 0.35;
  c.lineWidth = Math.max(2, canvas.width * 0.002);
  c.lineCap = "round";

  const cols = 4;
  for (let i = 0; i < cols; i++) {
    const sx = x + (w * (0.15 + i * 0.22));
    const sy = y + h;
    c.beginPath();
    c.moveTo(sx, sy);
    c.bezierCurveTo(sx - w * 0.05, sy - h * 0.35, sx + w * 0.05, sy - h * 0.65, sx, sy - h);
    c.stroke();
  }
  c.restore();
}

function renderCup() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sizeKey = currentOrder?.size || "Hot 16";
  currentCupLayout = computeLayout(sizeKey);

  const { isIced, cupX, cupY, cupW, cupH, writeRect } = currentCupLayout;

  const topW = cupW * 0.92;
  const botW = cupW * 0.70;
  const topX = cupX + (cupW - topW) / 2;
  const botX = cupX + (cupW - botW) / 2;

  const bodyTopY = cupY + cupH * (isIced ? 0.10 : 0.16);
  const bodyBotY = cupY + cupH * 0.93;

  // shadow
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  drawRoundedRect(ctx, cupX + cupW * 0.15, bodyBotY + cupH * 0.02, cupW * 0.70, cupH * 0.05, 18);
  ctx.fill();
  ctx.globalAlpha = 1;

  // body
  ctx.fillStyle = isIced ? "#f2f2f2" : "#f7f7f7";
  ctx.beginPath();
  ctx.moveTo(topX, bodyTopY);
  ctx.lineTo(topX + topW, bodyTopY);
  ctx.lineTo(botX + botW, bodyBotY);
  ctx.lineTo(botX, bodyBotY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#111";
  ctx.lineWidth = Math.max(2, canvas.width * 0.003);
  ctx.stroke();

  // rim/lid + ice/steam
  if (isIced) {
    const rimH = cupH * 0.06;
    ctx.fillStyle = "#ffffff";
    drawRoundedRect(ctx, topX, bodyTopY - rimH * 0.65, topW, rimH, 18);
    ctx.fill();
    ctx.stroke();

    drawIceCubes(ctx, topX, bodyTopY - rimH * 0.55, topW, rimH * 1.35);
  } else {
    const lidH = cupH * 0.10;
    const lidY = bodyTopY - lidH * 0.82;

    ctx.fillStyle = "#111";
    drawRoundedRect(ctx, topX, lidY, topW, lidH, 18);
    ctx.fill();

    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#fff";
    drawRoundedRect(ctx, topX + topW * 0.08, lidY + lidH * 0.20, topW * 0.84, lidH * 0.30, 14);
    ctx.fill();
    ctx.globalAlpha = 1;

    drawSteam(ctx, topX + topW * 0.15, lidY - lidH * 0.80, topW * 0.70, lidH * 0.8);
  }

  // label area
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, writeRect.x, writeRect.y, writeRect.w, writeRect.h, 18);
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#111";
  ctx.lineWidth = Math.max(2, canvas.width * 0.0025);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // clip and draw ink inside label
  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, writeRect.x, writeRect.y, writeRect.w, writeRect.h, 18);
  ctx.clip();
  ctx.drawImage(inkCanvas, 0, 0);
  ctx.restore();

  // subtle cup shading
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(topX + topW * 0.04, bodyTopY);
  ctx.lineTo(topX + topW * 0.16, bodyTopY);
  ctx.lineTo(botX + botW * 0.18, bodyBotY);
  ctx.lineTo(botX + botW * 0.06, bodyBotY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function clearInk() {
  inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
  renderCup();
}

function refreshCupView() {
  renderCup();
}

// ---- Drawing only inside writeRect ----
let drawing = false;
let last = null;

function pos(e) {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    x: (e.clientX - r.left) * dpr,
    y: (e.clientY - r.top) * dpr,
    pressure: e.pressure ?? 0.5
  };
}

function inWriteRect(p) {
  const wr = currentCupLayout?.writeRect;
  if (!wr) return false;
  return p.x >= wr.x && p.x <= (wr.x + wr.w) && p.y >= wr.y && p.y <= (wr.y + wr.h);
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

  const lastInside = inWriteRect(last);
  const nowInside = inWriteRect(p);
  if (!lastInside && !nowInside) {
    last = p;
    return;
  }

  const pressure = (e.pointerType === "pen") ? Math.max(0.08, p.pressure) : 0.35;

  inkCtx.strokeStyle = "#111";
  inkCtx.lineCap = "round";
  inkCtx.lineJoin = "round";
  inkCtx.lineWidth = (1.2 + pressure * 6) * (window.devicePixelRatio || 1);

  inkCtx.beginPath();
  inkCtx.moveTo(last.x, last.y);
  inkCtx.lineTo(p.x, p.y);
  inkCtx.stroke();

  last = p;
  renderCup();
  e.preventDefault();
});

function end(e) {
  drawing = false;
  last = null;
  e.preventDefault();
}
canvas.addEventListener("pointerup", end);
canvas.addEventListener("pointercancel", end);

document.getElementById("clearLabel").addEventListener("click", clearInk);

// Ensure size changes redraw the cup label region
sizeSel.addEventListener("change", refreshCupView);

// Draw once page is fully laid out
window.addEventListener("load", () => {
  fitCanvas();
  renderCup();
});
