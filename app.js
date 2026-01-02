// ===== UI refs =====
const ticketEl = document.getElementById("ticket");
const resultEl = document.getElementById("result");

const sizeSel = document.getElementById("size");
const shotsSel = document.getElementById("shots");
const caffeineSel = document.getElementById("caffeine");
const milkSel = document.getElementById("milk");
// ===== Syrup/Sauce dropdown refs =====
const SAUCE_KEYS  = ["M","WM","CAR","PUMPKIN","BS"];
const SYRUP_KEYS  = ["V","LAV","ROSE","HONEY","FLAVOR"];
const SIMPLE_KEYS = ["SIMPLE"];

const sauceEls = Object.fromEntries(SAUCE_KEYS.map(k => [k, document.getElementById(`sauce_${k}`)]));
const syrupEls = Object.fromEntries(SYRUP_KEYS.map(k => [k, document.getElementById(`syrup_${k}`)]));
const simpleEls = Object.fromEntries(SIMPLE_KEYS.map(k => [k, document.getElementById(`simple_${k}`)]));

function populateSelect(sel){
  if (!sel) return;
  let html = "";
  for (let v = 0; v <= 6.001; v += 0.5){
    const n = Number(v.toFixed(1));
    html += `<option value="${n}">${n}</option>`;
  }
  sel.innerHTML = html;
  sel.value = "0";
}

function populateAllPumps(){
  Object.values(sauceEls).forEach(populateSelect);
  Object.values(syrupEls).forEach(populateSelect);
  Object.values(simpleEls).forEach(populateSelect);
}
populateAllPumps();

function resetAllPumps(){
  for (const el of [...Object.values(sauceEls), ...Object.values(syrupEls), ...Object.values(simpleEls)]){
    if (el) el.value = "0";
  }
}

function readAllPumps(){
  const out = {};
  for (const k of SAUCE_KEYS) out[k] = Number(sauceEls[k]?.value || 0);
  for (const k of SYRUP_KEYS) out[k] = Number(syrupEls[k]?.value || 0);
  for (const k of SIMPLE_KEYS) out[k] = Number(simpleEls[k]?.value || 0);
  return out;
}

let currentOrder = null;

// ===== Helpers =====
function pickRandom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

const CAFFEINE_WEIGHTED = ["Regular","Regular","Regular","Half Caf","Decaf"];

// Parse "2 SHOTS", "1 SHOT", "SOLO" out of a recipe string
function parseShots(recipeText){
  if (!recipeText) return null;
  const t = String(recipeText).toUpperCase();

  let best = null;

  // 2 SHOTS / 3 SHOTS
  const m1 = [...t.matchAll(/(\d+(\.\d+)?)\s*SHOTS?/g)];
  for (const m of m1){
    const v = Number(m[1]);
    if (!Number.isNaN(v)) best = Math.max(best ?? 0, v);
  }

  // 1 SHOT
  const m2 = [...t.matchAll(/(\d+)\s*SHOT\b/g)];
  for (const m of m2){
    const v = Number(m[1]);
    if (!Number.isNaN(v)) best = Math.max(best ?? 0, v);
  }

  // SOLO = single shot
  if (t.includes("SOLO")) best = Math.max(best ?? 0, 1);

  return best == null ? null : Math.round(best);
}

// Extract syrup/sauce pumps when explicitly specified (not perfect, but matches your sheet for the drinks that list pumps)
// Codes are internal; we’ll show nicer names later in UI.
function parseIngredients(recipeText){
  if (!recipeText) return [];

  const t = String(recipeText).toUpperCase();
  const out = new Map();

  const MAP = [
    { key: "WM", name: "White Mocha", code: "WM" },
    { key: "WHITE MOCHA", name: "White Mocha", code: "WM" },
    { key: "M SAUCE", name: "Mocha Sauce", code: "M" },
    { key: "MOCHA", name: "Mocha Sauce", code: "M" },
    { key: "CARAMEL", name: "Caramel", code: "CAR" },
    { key: "VANILLA", name: "Vanilla", code: "V" },
    { key: "SIMPLE", name: "Simple Syrup", code: "SIMPLE" },
    { key: "HONEY", name: "Honey", code: "HONEY" },
    { key: "LAV", name: "Lavender", code: "LAV" },
    { key: "LAVENDER", name: "Lavender", code: "LAV" },
    { key: "ROSE", name: "Rose", code: "ROSE" },
    { key: "PUMPKIN", name: "Pumpkin Sauce", code: "PUMPKIN" },
    { key: "BUTTERSCOTCH", name: "Butterscotch", code: "BS" },
  ];

  // Patterns like "1.5 WM", "2 PUMPKIN SAUCE", "4 VANILLA SYRUP", "2 SYRUPS"
  const matches = [...t.matchAll(/(\d+(\.\d+)?)\s*([A-Z/ ]{1,24})/g)];
  for (const m of matches){
    const amt = Number(m[1]);
    const word = (m[3] || "").trim();

    // ignore obvious non-ingredient tokens
    if (
      word.startsWith("OZ") || word.startsWith("CUP") || word.startsWith("SCOOP") ||
      word.startsWith("SHOT") || word.startsWith("SHOTS") || word.startsWith("WATER") ||
      word.startsWith("MILK") || word.startsWith("ICE") || word.startsWith("CLUB") ||
      word.startsWith("STEAMED") || word.startsWith("FOAM") || word.startsWith("POWDER") ||
      word.startsWith("JUICE") || word.startsWith("BLEND") || word.startsWith("STIR")
    ) continue;

    let matched = false;
    for (const it of MAP){
      if (word.includes(it.key)){
        const cur = out.get(it.code) || { code: it.code, name: it.name, amount: 0 };
        cur.amount = Math.round((cur.amount + amt) * 100) / 100;
        out.set(it.code, cur);
        matched = true;
        break;
      }
    }

    // Generic "SYRUP(S)" on your flavored-latte line
    if (!matched && (word.includes("SYRUP") || word.includes("SYRUPS"))){
      const cur = out.get("FLAVOR") || { code: "FLAVOR", name: "Flavor Syrup", amount: 0 };
      cur.amount = Math.round((cur.amount + amt) * 100) / 100;
      out.set("FLAVOR", cur);
    }
  }

  return [...out.values()];
}

// ===== Menu imported from your Excel (RECIPE sheet) =====
// Each item has sizes (some missing), and we use the recipe text for shots/milk/ingredients.
const MENU_ITEMS = [
  {"name":"COLD BREW","abbrev":"CB","sizes":{"Iced 16":"8OZ COLD BREW + ICE","Iced 20":"10OZ COLD BREW + ICE"}},
  {"name":"AMERICANO","abbrev":"A","sizes":{"Hot 12":"9OZ HOT WATER + 2 SHOTS","Hot 16":"13OZ HOT WATER + 2 SHOTS","Iced 16":"8OZ WATER + 2 SHOTS + ICE","Iced 20":"10OZ WATER + 3 SHOTS + ICE"}},
  {"name":"CAPPUCCINO**","abbrev":"CAP","sizes":{"Hot 12":"2 SHOTS + STEAMED FOAM MILK","Hot 16":"2 SHOTS + STEAMED FOAM MILK"}},
  {"name":"LATTE (FLAT WHITE)","abbrev":"L (FW)","sizes":{"Hot 12":"2 SHOTS + STEAMED MILK","Hot 16":"2 SHOTS + STEAMED MILK","Iced 16":"8OZ MILK + 2 SHOTS + ICE","Iced 20":"10OZ MILK + 3 SHOTS + ICE"}},
  {"name":"FLAVORED LATTE","abbrev":"(FLAVOR) L","sizes":{"Hot 12":"2 SYRUPS + 2 SHOTS + STEAMED MILK","Hot 16":"2.5 SYRUP + 2 SHOTS + STEAMED MILK","Iced 16":"2.5 SYRUP + 8OZ MILK + 2 SHOTS + ICE","Iced 20":"3 SYRUP + 10OZ MILK + 3 SHOTS + ICE"}},
  {"name":"MOCHA LATTE","abbrev":"ML","sizes":{"Hot 12":"2 M SAUCE + 2 SHOTS + STEAMED MILK + WC?","Hot 16":"2.5 M SAUCE + 2 SHOTS + STEAMED MILK + WC?","Iced 16":"2 M SAUCE + 8OZ MILK + 2 SHOTS + ICE + WC?","Iced 20":"2.5 M SAUCE + 10OZ MILK + 3 SHOTS + ICE + WC?"}},
  {"name":"WHITE MOCHA LATTE","abbrev":"WML","sizes":{"Hot 12":"2 WM + 2 SHOTS + STEAMED MILK + WC?","Hot 16":"2.5 WM + 2 SHOTS + STEAMED MILK + WC?","Iced 16":"2 WM + 8OZ MILK + 2 SHOTS + ICE + WC?","Iced 20":"2.5 WM + 10OZ MILK + 3 SHOTS + ICE + WC?"}},
  {"name":"CARAMEL LATTE","abbrev":"CL","sizes":{"Hot 12":"2 CARAMEL SAUCE + 2 SHOTS + STEAMED MILK + WC?","Hot 16":"2.5 CARAMEL SAUCE + 2 SHOTS + STEAMED MILK + WC?","Iced 16":"2 CARAMEL SAUCE + 8OZ MILK + 2 SHOTS + ICE + WC?","Iced 20":"2.5 CARAMEL SAUCE + 10OZ MILK + 3 SHOTS + ICE + WC?"}},
  {"name":"VANILLA LATTE","abbrev":"VL","sizes":{"Hot 12":"2.5 VANILLA SYRUP + 2 SHOTS + STEAMED MILK","Hot 16":"3 VANILLA SYRUP + 2 SHOTS + STEAMED MILK","Iced 16":"2.5 VANILLA SYRUP + 8OZ MILK + 2 SHOTS + ICE","Iced 20":"3.5 VANILLA SYRUP + 10OZ MILK + 3 SHOTS + ICE"}},
  {"name":"LAVENDER LATTE","abbrev":"LL","sizes":{"Hot 12":"3 LAV + 1.5 SIMPLE + 2 SHOTS + STEAMED MILK","Hot 16":"4 LAV + 2 SIMPLE + 2 SHOTS + STEAMED MILK","Iced 16":"3 LAV + 1.5 SIMPLE + 8OZ MILK + 2 SHOTS + ICE","Iced 20":"3 LAV + 1.5 SIMPLE + 10OZ MILK + 3 SHOTS + ICE"}},
  {"name":"ROSE LATTE","abbrev":"RL","sizes":{"Hot 12":"3 ROSE + 1.5 SIMPLE + 2 SHOTS + STEAMED MILK","Hot 16":"4 ROSE + 2 SIMPLE + 2 SHOTS + STEAMED MILK","Iced 16":"3 ROSE + 1.5 SIMPLE + 8OZ MILK + 2 SHOTS + ICE","Iced 20":"3 ROSE + 1.5 SIMPLE + 10OZ MILK + 3 SHOTS + ICE"}},
  {"name":"HONEY CINNAMON LATTE","abbrev":"HCL","sizes":{"Hot 12":"2.5 HONEY + 2 SHOTS + STEAMED MILK + CINN","Hot 16":"3 HONEY + 2 SHOTS + STEAMED MILK + CINN","Iced 16":"2.5 HONEY + 8OZ MILK + 2 SHOTS + ICE + CINN","Iced 20":"3.5 HONEY + 10OZ MILK + 3 SHOTS + ICE + CINN"}},

  {"name":"MATCHA LATTE","abbrev":"MT","sizes":{"Hot 12":"9OZ MILK + 60g POWDER MIX + 2 SHOTS? (IF REQUESTED)","Hot 16":"13OZ MILK + 65g POWDER MIX","Iced 16":"9OZ MILK + 60g POWDER MIX + ICE","Iced 20":"10OZ MILK + 65g POWDER MIX + ICE"}},
  {"name":"HOJICHA / EARLGREY LATTE","abbrev":"HJ / EG","sizes":{"Hot 12":"9OZ MILK + 60g POWDER MIX","Hot 16":"13OZ MILK + 65g POWDER MIX","Iced 16":"9OZ MILK + 60g POWDER MIX + ICE","Iced 20":"10OZ MILK + 65g POWDER MIX + ICE"}},
  {"name":"HOT/ICED CHOCOLATE","abbrev":"HC / CHOCO","sizes":{"Hot 12":"9OZ MILK + 2.5 M SAUCE + STIR + (WC) + COCOA","Hot 16":"13OZ MILK + 3.5 M SAUCE + STIR + (WC) + COCOA","Iced 16":"9OZ MILK + 2.5 M SAUCE + STIR + ICE + (WC) + COCOA","Iced 20":"13OZ MILK + 3.5 M SAUCE + STIR + ICE + (WC) + COCOA"}},
  {"name":"PUMPKIN CINNAMON LATTE","abbrev":"PCL","sizes":{"Hot 12":"2 PUMPKIN SAUCE + CINNAMON(P) + 2 SHOTS + STEAMED MILK + WC","Hot 16":"2.5 PUMPKIN SAUCE + CINNAMON(P) + 2 SHOTS + STEAMED MILK + WC","Iced 16":"2.5 PUMPKIN SAUCE + CINNAMON(P) + 2 SHOTS + 8OZ MILK + ICE + WC","Iced 20":"3 PUMPKIN SAUCE + CINNAMON(P) + 3 SHOTS + 10OZ MILK + ICE + WC"}},
  {"name":"WHITE LAVENDER LATTE","abbrev":"WL","sizes":{"Hot 12":"1 WM + 1.5 LAV + 2 SHOTS +STEAMED MILK","Hot 16":"1.5 WM + 2 LAV + 2 SHOTS +STEAMED MILK","Iced 16":"1 WM + 1.5 LAV + 2 SHOTS + 8OZ MILK + ICE","Iced 20":"1.5 WM + 2 LAV + 3 SHOTS + 10 OZ MILK + ICE"}},

  {"name":"CREAM COFFEE","abbrev":"CC","sizes":{"Iced 16":"2.5 SIMPLE + 6OZ COLDBREW +ICE + CREAM ON TOP \n(CREAM 1.5 SIMPLE 1.5 OZ + HEAVY CREAM) *2 PORTIONS USE 1/2","Iced 20":"3 SIMPLE + 8OZ COLDBREW +ICE + CREAM ON TOP \n(CREAM 1.5 SIMPLE 1.5 OZ + HEAVY CREAM) *2 PORTIONS USE 1/2"}},
  {"name":"PUMPKIN FLOAT","abbrev":"PF","sizes":{"Iced 16":"1.5 SIMPLE + 6OZ COLDBREW +ICE + CREAM ON TOP w/CINN POWDER\nPUMPKIN CREAM ( 50ml HEAVY CREAM + 1.5 PUMPKIN)","Iced 20":"2 SIMPLE + 8OZ COLDBREW +ICE + CREAM ON TOP w/CINN POWDER\nPUMPKIN CREAM ( 50ml HEAVY CREAM + 1.5 PUMPKIN)"}},
  {"name":"BUTTERSCOTCH LATTE","abbrev":"BSL","sizes":{"Iced 16":"1.5 SIMPLE + 2 SHOTS + 5OZ MILK + ICE + BS CREAM(25ML HEAVY CREAM + 50ML BS CREAM)TOTAL 75ML"}},
  {"name":"ESPRESSODA","abbrev":"ESP","sizes":{"Iced 16":"4 VANILLA SYRUP + 2 SIMPLE + 10OZ CLUB SODA + ICE + SOLO ESP"}},

  {"name":"GRAPEFRUIT ADE","abbrev":"GF ADE","sizes":{"Iced 16":"2 PUMPS SIMPLE + 3OZ GF JUICE + 1 SCOOP GRAPEFRUIT + ICE + CLUBSODA"}},
  {"name":"COFFEE FRAP","abbrev":"COFFEE FRAP","sizes":{"Hot 12":"1.8 CUP ICE + 1 SCOOP FRAP POWDER + 5 SIMPLE\n1 SHOT + 4OZ COFFEE + BLEND+ WC?"}},
  {"name":"SAUCE FRAP","abbrev":"M/WM/CAR FRAP","sizes":{"Hot 12":"1.8 CUP ICE + 1  SCOOP FRAP POWDER + 3 PUMPS SAUCE\n1 SHOT + 3OZ COFFEE + BLEND + WC?"}},
  {"name":"GREEN TEA FRAP","abbrev":"GT FRAP","sizes":{"Hot 12":"1.5 CUP ICE + 2 SS + 2 SCOOPS GT POWDER + 9OZ MILK + BLEND + (WC)"}},

  {"name":"(STRAW/BLUE) BERRY SMOOTHIE","abbrev":"SYS / BYS","sizes":{"Hot 12":"50% CUP OF FRUIT + 1.5 CUP OF ICE + 2 SIMPLE + (1 SCOOP BERRY POWDER 35-40g) YOGURT POWDER + 6OZ MILK + BLEND + (WC)"}},
  {"name":"STRAWBERRY BANANA OAT MILK","abbrev":"SBO","sizes":{"Hot 12":"50% CUP OF STRAWBERRY + 1/2 BANANA + 1.5 CUP OF ICE + 4 HONEY \n8OZ OAT MILK + BLEND + (WC)"}},

  // Items listed higher on the sheet (espresso/macchiato/cortado/etc.) exist but were presented as service notes.
  // We can add them as orderable items cleanly in the next step if you want them randomized too.
];

// ===== Order generation from full menu =====
function randomOrder(){
  const item = pickRandom(MENU_ITEMS);

  const sizeKeys = Object.keys(item.sizes);
  const size = pickRandom(sizeKeys);

  const recipeText = item.sizes[size];
  const caffeine = pickRandom(CAFFEINE_WEIGHTED);


  const shots = parseShots(recipeText);

  const ingredients = parseIngredients(recipeText); // syrup/sauce pumps if explicitly present

  return {
    itemName: item.name,
    abbrev: item.abbrev || "",
    size,
    caffeine,
    milk,
    shots,
    recipeText,
    ingredients
  };
}

function renderTicket(){
  if (!currentOrder){
    ticketEl.textContent = "(Press New Order)";
    return;
  }


  ticketEl.textContent =
`ORDER:
Drink: ${currentOrder.itemName}
Size: ${currentOrder.size}
Caffeine: ${currentOrder.caffeine}` +
`\nShots: ${currentOrder.shots ?? "(n/a)"}`;
}

// ===== Buttons =====
document.getElementById("newOrder").onclick = () => {
  currentOrder = randomOrder();
  renderTicket();
  resultEl.textContent = "";
  resetAllPumps();


  // Default build inputs (stable)
  caffeineSel.value = "Regular";
  
  sizeSel.value = "Select";
  shotsSel.value = "0";

};

document.getElementById("check").onclick = () => {
  if (!currentOrder) return;

  const errors = [];

  // Size check
  if (sizeSel.value !== currentOrder.size) errors.push("Wrong size");

  // Caffeine check
  if (caffeineSel.value !== currentOrder.caffeine) errors.push("Wrong caffeine");

  
  // Shots check
  if (currentOrder.shots != null){
    if (Number(shotsSel.value) !== Number(currentOrder.shots)) {
      errors.push("Wrong shots");
    }
  }

  /* ===== ADD SYRUP / SAUCE CHECKS HERE ===== */

  const selected = readAllPumps();   // what YOU selected in dropdowns

  const expected = {};
  for (const ing of (currentOrder.ingredients || [])){
    expected[ing.code] = ing.amount;
  }

  // If recipe has NO syrups/sauces
  if (Object.keys(expected).length === 0){
    for (const [k,v] of Object.entries(selected)){
      if (v !== 0){
        errors.push(`No pumps required, but ${k} = ${v}`);
      }
    }
  } else {
    // Exact pump match required
    const ALL_KEYS = [
      ...SAUCE_KEYS,
      ...SYRUP_KEYS,
      ...SIMPLE_KEYS
    ];

    for (const k of ALL_KEYS){
      const exp = Number(expected[k] || 0);
      const got = Number(selected[k] || 0);

      if (Math.abs(exp - got) > 0.01){
        errors.push(`Pumps ${k}: expected ${exp}, got ${got}`);
      }
    }
  }

  /* ===== END SYRUP CHECKS ===== */

  resultEl.textContent = errors.length
    ? "Errors:\n- " + errors.join("\n- ")
    : "Perfect!";
};


// ===== Canvas drawing (smooth + iPad-friendly scaling) =====
const canvas = document.getElementById("labelCanvas");
const ctx = canvas.getContext("2d");

function resize(){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}
resize();
window.addEventListener("resize", resize);

let drawing = false;

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const pressure = (e.pointerType === "pen") ? Math.max(0.1, e.pressure || 0.5) : 0.6;
  ctx.lineWidth = 2 + pressure * 6;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  e.preventDefault();
});

function end(e){
  drawing = false;
  e.preventDefault();
}
canvas.addEventListener("pointerup", end);
canvas.addEventListener("pointercancel", end);

document.getElementById("clearLabel").addEventListener("click", () => {
  const r = canvas.getBoundingClientRect();
  ctx.clearRect(0,0,r.width,r.height);
});

renderTicket();
