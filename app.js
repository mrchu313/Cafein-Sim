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

function uiSizeToMenuSize(uiVal){
  // "12oz Hot" -> "Hot 12"
  // "16oz Iced" -> "Iced 16"
  const m = String(uiVal).match(/^(\d+)\s*oz\s*(Hot|Iced)$/i);
  if (!m) return null;
  const oz = m[1];
  const temp = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase(); // Hot/Iced
  return `${temp} ${oz}`;
}

function menuSizeToUiSize(menuKey){
  // "Hot 12" -> "12oz Hot"
  // "Iced 20" -> "20oz Iced"
  const m = String(menuKey).match(/^(Hot|Iced)\s*(\d+)$/i);
  if (!m) return null;
  const temp = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const oz = m[2];
  return `${oz}oz ${temp}`;
}

function uiSizeLabel(uiVal){
  // For ticket display: Size (Small/Large), Temp (Hot/Iced)
  const m = String(uiVal).match(/^(\d+)\s*oz\s*(Hot|Iced)$/i);
  if (!m) return { size:null, temp:null };
  const oz = Number(m[1]);
  const temp = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
  const size = (oz === 12 || oz === 16) ? "Small" : "Large";
  return { size, temp };
}

// ===== Helpers =====
function randomOrder(){
  const item = pickRandom(MENU_ITEMS);

  // menu size keys like "Hot 12", "Iced 16"
  const menuSizeKeys = Object.keys(item.sizes);

  // convert to UI keys like "12oz Hot", "16oz Iced"
  const uiSizeKeys = menuSizeKeys
    .map(menuSizeToUiSize)
    .filter(Boolean);

  const uiSize = pickRandom(uiSizeKeys);

  // convert back to menu key so we can pull correct recipe
  const menuSize = uiSizeToMenuSize(uiSize);

  const recipeText = item.sizes[menuSize];   // correct recipe from sheet

  const caffeine = pickRandom(CAFFEINE_WEIGHTED);

  const needsMilk = recipeNeedsMilk(recipeText);
  const milk = needsMilk ? "Whole" : "None";

  const extraShot = Math.random() < 0.25;

  const baseShots = parseShots(recipeText);
  const shots = baseShots == null ? null : baseShots + (extraShot ? 1 : 0);

  const ingredients = parseIngredients(recipeText);

  return {
    itemName: item.name,
    abbrev: item.abbrev || "",
    // store UI size for ticket + user matching
    size: uiSize,
    // store menu size for recipe lookups (optional but useful)
    menuSize,
    recipeText,
    caffeine,
    milk,
    extraShot,
    shots,
    ingredients
  };
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
  {
    
  },
  {
    "name": "COLD BREW",
    "abbrev": "CB",
    "sizes": {
      "Iced 16": "8OZ COLD BREW + ICE",
      "Iced 20": "10OZ COLD BREW + ICE"
    }
  },
  {
    "name": "AMERICANO",
    "abbrev": "A",
    "sizes": {
      "Hot 12": "9OZ HOT WATER + 2 SHOTS",
      "Hot 16": "13OZ HOT WATER + 2 SHOTS",
      "Iced 16": "8OZ WATER + 2 SHOTS + ICE",
      "Iced 20": "10OZ WATER + 3 SHOTS + ICE"
    }
  },
  {
    "name": "CAPPUCCINO**",
    "abbrev": "CAP",
    "sizes": {
      "Hot 12": "2 SHOTS + STEAMED FOAM MILK",
      "Hot 16": "2 SHOTS + STEAMED FOAM MILK"
    }
  },
  {
    "name": "LATTE (FLAT WHITE)",
    "abbrev": "L (FW)",
    "sizes": {
      "Hot 12": "2 SHOTS + STEAMED MILK",
      "Hot 16": "2 SHOTS + STEAMED MILK",
      "Iced 16": "8OZ MILK + 2 SHOTS + ICE",
      "Iced 20": "10OZ MILK + 3 SHOTS + ICE"
    }
  },
  
  {
    "name": "MOCHA",
    "abbrev": "M",
    "sizes": {
      "Hot 12": "2 M SAUCE + 2 SHOTS + STEAMED MILK + WC?",
      "Hot 16": "2.5 M SAUCE + 2 SHOTS + STEAMED MILK + WC?",
      "Iced 16": "2 M SAUCE + 2 SHOTS + 8OZ MILK + ICE",
      "Iced 20": "2.5 M SAUCE + 3 SHOTS + 10OZ MILK + ICE"
    }
  },
  {
    "name": "WHITE MOCHA",
    "abbrev": "WM",
    "sizes": {
      "Hot 12": "2 WM SAUCE + 2 SHOTS + STEAMED MILK + WC?",
      "Hot 16": "2.5 WM SAUCE + 2 SHOTS + STEAMED MILK + WC?",
      "Iced 16": "2 WM SAUCE + 2 SHOTS + 8OZ MILK + ICE",
      "Iced 20": "2.5 WM SAUCE + 3 SHOTS + 10OZ MILK + ICE"
    }
  },
  {
    "name": "CARAMEL LATTE",
    "abbrev": "CAR L",
    "sizes": {
      "Hot 12": "1.5 CAR SAUCE + 2 SHOTS + STEAMED MILK",
      "Hot 16": "2 CAR SAUCE + 2 SHOTS + STEAMED MILK",
      "Iced 16": "2 CAR SAUCE + 2 SHOTS + 8OZ MILK + ICE",
      "Iced 20": "2.5 CAR SAUCE  + 3 SHOTS + 10OZ MILK + ICE"
    }
  },
  {
    "name": "CARAMEL MACCHIATO",
    "abbrev": "CM",
    "sizes": {
      "Hot 12": "1.5 CAR SAUCE + 0.5 V SYRUP + 2 SHOTS + STEAMED MILK",
      "Hot 16": "2 CAR SAUCE + 0.5 V + 2 SHOTS + STEAMED MILK",
      "Iced 16": "2 CAR SAUCE + 0.5 V SYRUP + 2 SHOTS + 8OZ MILK + ICE",
      "Iced 20": "2.5 CAR SAUCE + 0.5 V SYRUP + 3 SHOTS + 10OZ MILK + ICE"
    }
  },
  {
    "name": "DAVANT COFFEE",
    "abbrev": "DV",
    "sizes": {
      "Hot 12": "4 SIMPLE + 2 SHOTS + STEAMED BREVE ( half and half)",
      "Hot 16": "5 SIMPLE + 2 SHOTS + STEAMED BREVE",
      "Iced 16": "4 SIMPLE + 2 SHOTS + 8OZ BREVE + ICE",
      "Iced 20": "5 SIMPLE + 3 SHOTS + 10OZ BREVE + ICE"
    }
  },
  {
    "name": "HONEY CINNAMON LATTE",
    "abbrev": "HCL",
    "sizes": {
      "Hot 12": "2.5 HONEY + CINN + 2 SHOTS + STEAMED MILK",
      "Hot 16": "3.5 HONEY + CINN + 2 SHOTS + STEAMED MILK",
      "Iced 16": "2.5 HONEY + CINN + 2 SHOTS + 8OZ MILK + ICE",
      "Iced 20": "3.5 HONEY + CINN + 3 SHOTS + 10OZ MILK + ICE"
    }
  },
  {
    "name": "ROSE LATTE",
    "abbrev": "RL",
    "sizes": {
      "Hot 12": "3 ROSE + 1.5 SIMPLE + 2 SHOTS + STEAMED MILK",
      "Hot 16": "4 ROSE + 2 SIMPLE + 2 SHOTS + STEAMED MILK",
      "Iced 16": "3 ROSE + 1.5 SIMPLE + 2 SHOTS + 8OZ MILK + ICE",
      "Iced 20": "3 ROSE + 1.5 SIMPLE + 3 SHOTS + 10OZ MILK + ICE"
    }
  },
  {
    "name": "LAVENDER LATTE",
    "abbrev": "LL",
    "sizes": {
      "Hot 12": "3 LAV + 1.5 SIMPLE + 2 SHOTS + STEAMED MILK",
      "Hot 16": "4 LAV + 2 SIMPLE + 2 SHOTS + STEAMED MILK",
      "Iced 16": "3 LAV + 1.5 SIMPLE + 2 SHOTS + 8OZ MILK + ICE",
      "Iced 20": "3 LAV + 1.5 SIMPLE + 3 SHOTS + 10OZ MILK + ICE"
    }
  },
  {
    "name": "CHAI LATTE",
    "abbrev": "CHAI",
    "sizes": {
      "Hot 12": "90ml CHAI + 180ml MILK",
      "Hot 16": "120ml CHAI + 230ml MILK",
      "Iced 16": "90ml CHAI + 180ml MILK + ICE + CINN",
      "Iced 20": "120ml CHAI + 230ml MILK  MILK + ICE + CINN"
    }
  },
  {
    "name": "MATCHA LATTE",
    "abbrev": "MT",
    "sizes": {
      "Hot 12": "2 SIMPLE + 30g MATCHA MIX + 9OZ MILK",
      "Hot 16": "2.5 SIMPLE + 30g MATCHA MIX + 13OZ MILK",
      "Iced 16": "2 SIMPLE + 30g MATCHA MIX + 9OZ MILK + ICE",
      "Iced 20": "2.5 SIMPLE + 30g MATCHA MIX + 10OZ MILK + ICE"
    }
  },
  {
    "name": "LAVENDER MATCHA LATTE",
    "abbrev": "LMT",
    "sizes": {
      "Hot 12": "2 SIMPLE + 2 LAV + 30g MATCHA MIX + 9OZ MILK",
      "Hot 16": "2.5 SIMPLE + 2.5 LAV + 30g MATCHA MIX + 13OZ MILK",
      "Iced 16": "2 SIMPLE + 2 LAV + 30g MATCHA MIX + 9OZ MILK + ICE",
      "Iced 20": "2.5 LAV + 30g MATCHA MIX + 10OZ MILK + ICE"
    }
  },
  {
    "name": "WHITE MATCHA LATTE",
    "abbrev": "WMT",
    "sizes": {
      "Hot 12": "2 SIMPLE + 1 WM + 30g MATCHA MIX + 9OZ MILK",
      "Hot 16": "2.5 SIMPLE + 1.5 WM + 30g MATCHA MIX + 13OZ MILK",
      "Iced 16": "2 SIMPLE + 1 WM + 30g MATCHA MIX + 9OZ MILK + ICE",
      "Iced 20": "1.5 WM + 30g MATCHA MIX + 10OZ MILK + ICE"
    }
  },
  {
    "name": "HOJICHA / EARLGREY LATTE",
    "abbrev": "HJ / EG",
    "sizes": {
      "Hot 12": "2 SIMPLE + 60g POWDER MIX + 9OZ MILK",
      "Hot 16": "2.5 SIMPLE + 65g POWDER MIX + 13OZ MILK",
      "Iced 16": "2 SIMPLE + 60g POWDER MIX + 9OZ MILK + ICE",
      "Iced 20": "10OZ MILK + 65g POWDER MIX + ICE"
    }
  },
  {
    "name": "HOT/ICED CHOCOLATE",
    "abbrev": "HC / CHOCO",
    "sizes": {
      "Hot 12": "9OZ MILK + 2.5 M SAUCE + STIR + (WC) + COCOA",
      "Hot 16": "13OZ MILK + 3.5 M SAUCE + STIR + (WC) + COCOA",
      "Iced 16": "9OZ MILK + 2.5 M SAUCE + STIR + ICE + (WC) + COCOA",
      "Iced 20": "13OZ MILK + 3.5 M SAUCE + STIR + ICE + (WC) + COCOA"
    }
  },
  {
    "name": "PUMPKIN CINNAMON LATTE",
    "abbrev": "PCL",
    "sizes": {
      "Hot 12": "2 PUMPKIN SAUCE + CINNAMON(P) + 2 SHOTS + STEAMED MILK + WC",
      "Hot 16": "2.5 PUMPKIN SAUCE + CINNAMON(P) + 2 SHOTS + STEAMED MILK + WC",
      "Iced 16": "2.5 PUMPKIN SAUCE + CINNAMON(P) + 2 SHOTS + 8OZ MILK + ICE + WC",
      "Iced 20": "3 PUMPKIN SAUCE + CINNAMON(P) + 3 SHOTS + 10OZ MILK + ICE + WC"
    }
  },
  {
    "name": "WHITE LAVENDER LATTE",
    "abbrev": "WL",
    "sizes": {
      "Hot 12": "1 WM + 1.5 LAV + 2 SHOTS +STEAMED MILK",
      "Hot 16": "1.5 WM + 2 LAV + 2 SHOTS +STEAMED MILK",
      "Iced 16": "1 WM + 1.5 LAV + 2 SHOTS + 8OZ MILK + ICE",
      "Iced 20": "1.5 WM + 2 LAV + 3 SHOTS + 10 OZ MILK + ICE"
    }
  },

  // Cold/iced section (sheet columns represent Iced 16 / Iced 20)
  {
    "name": "CREAM COFFEE",
    "abbrev": "CC",
    "sizes": {
      "Iced 16": "2.5 SIMPLE + 6OZ COLDBREW +ICE + CREAM ON TOP\nCREAM(1.5 ALM SYRUP +1.5 SIMPLE 1.5 OZ + HEAVY CREAM) *2 PORTIONS USE 1/2",
      "Iced 20": "3 SIMPLE + 8OZ COLDBREW +ICE + CREAM ON TOP\nCREAM(1.5 ALM SYRUP +1.5 SIMPLE 1.5 OZ + HEAVY CREAM) *2 PORTIONS USE 1/2"
    }
  },
  {
    "name": "PUMPKIN FLOAT",
    "abbrev": "PF",
    "sizes": {
      "Iced 16": "1.5 SIMPLE + 6OZ COLDBREW +ICE + CREAM ON TOP w/CINN POWDER\nPUMPKIN CREAM ( 50ml HEAVY CREAM + 1.5 PUMPKIN)",
      "Iced 20": "3 SIMPLE + 8OZ COLDBREW +ICE + CREAM ON TOP w/CINN POWDER\nPUMPKIN CREAM ( 50ml HEAVY CREAM + 1.5 PUMPKIN)"
    }
  },
  {
    "name": "BUTTERSCOTCH LATTE",
    "abbrev": "BSL",
    "sizes": {
      "Iced 16": "1.5 SIMPLE + 2 SHOTS + 5OZ MILK + ICE\nCREAM(25ML HEAVY CREAM + 50ML BS CREAM)TOTAL 75ML"
    }
  },
  {
    "name": "ESPRESSODA",
    "abbrev": "ESP",
    "sizes": {
      "Iced 20": "4 VANILLA SYRUP + 2 SIMPLE + 10OZ CLUB SODA + ICE + SOLO ESP"
    }
  },
  {
    "name": "GRAPEFRUIT ADE",
    "abbrev": "GF ADE",
    "sizes": {
      "Iced 20": "2 PUMPS SIMPLE + 3OZ GF JUICE + 1 SCOOP GRAPEFRUIT + ICE + CLUBSODA"
    }
  },
  {
    "name": "COFFEE FRAP",
    "abbrev": "COFFEE FRAP",
    "sizes": {
      "Iced 16": "1.8 CUP ICE + 1 SCOOP FRAP POWDER + 4 SIMPLE\n1 SHOT + 3OZ COFFEE + BLEND + WC?",
      "Iced 20": "1.8 CUP ICE + 1.2 SCOOP FRAP POWDER + 5 SIMPLE\n1 SHOT + 4OZ COFFEE + BLEND+ WC?"
    }
  },
  {
    "name": "SAUCE FRAP",
    "abbrev": "M/WM/CAR FRAP",
    "sizes": {
      "Iced 16": "1.8 CUP ICE + 1  SCOOP FRAP POWDER + 3 PUMPS SAUCE\n1 SHOT + 3OZ COFFEE + BLEND + WC?",
      "Iced 20": "1.8 CUP ICE + 1.2 SCOOP FRAP POWDER + 3.5 PUMPS SAUCE\n1 SHOT + 4OZ COFFEE + BLEND + WC?"
    }
  },
  {
    "name": "GREEN TEA FRAP",
    "abbrev": "GT FRAP",
    "sizes": {
      "Iced 16": "1.5 CUP ICE + 2 SS + 2 SCOOPS GT  POWDER + 7OZ MILK + BLEND + (WC)",
      "Iced 20": "1.5 CUP ICE + 2.5 SS + 2.5 SCOOPS GT POWDER + 9OZ MILK + BLEND + (WC)"
    }
  },
  {
    "name": "(STRAW/BLUE) BERRY SMOOTHIE",
    "abbrev": "SYS / BYS",
    "sizes": {
      "Iced 16": "50% CUP OF FRUIT, 50% CUP OF ICE + 3 SIMPLE ( SYS) / 4 SIMPLE ( BYS)\n0.9 SCOOP(38-40g) YOGURT POWDER + 6OZ MILK + BLEND + (WC)"
    }
  },
  {
    "name": "STRAWBERRY BANANA OAT MILK",
    "abbrev": "SBO",
    "sizes": {
      "Iced 16": "50% CUP OF STRAWBERRY 50% CUP OF ICE + 4 HONEY\n8OZ OAT MILK + BLEND + (WC)"
    }
  }
];

  // Items listed higher on the sheet (espresso/macchiato/cortado/etc.) exist but were presented as service notes.
  // We can add them as orderable items cleanly in the next step if you want them randomized too.
;

// ===== Order generation from full menu =====
function randomOrder(){
  const item = pickRandom(MENU_ITEMS);
  console.log("Picked:", item.name, Object.keys(item.sizes));


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

  const { size, temp } = uiSizeLabel(currentOrder.size);

  const lines = [];
  lines.push(`Size: ${size}`);             // Small / Large
  lines.push(`Temp: ${temp}`);             // Hot / Iced

  // caffeine (if applicable) — you currently apply it to all, so show it
  lines.push(`Caffeine: ${currentOrder.caffeine}`);

  lines.push(`Drink: ${currentOrder.itemName}`);

  // milk (if applicable)
  if (currentOrder.milk !== "None") {
    lines.push(`Milk: ${currentOrder.milk}`);
  }

  // extra shot(s) (if applicable)
  if (currentOrder.extraShot) {
    lines.push(`Extra Shot: Yes`);
  }

  ticketEl.textContent = lines.join("\n");
}

`ORDER:
Drink: ${currentOrder.itemName}
Size: ${currentOrder.size}
Milk: ${currentOrder.milk}
Caffeine: ${currentOrder.caffeine}` +
`\nShots: ${currentOrder.shots ?? "(n/a)"}`;


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
