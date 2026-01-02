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
