// Shared data for both simulator, menu, and recipe book

export const SIZE_LABELS = {
  "Hot 12": "Hot – Small",
  "Hot 16": "Hot – Large",
  "Iced 16": "Iced – Small",
  "Iced 20": "Iced – Large"
};

export const SIZE_KEYS = ["Hot 12","Hot 16","Iced 16","Iced 20"];

export const SYRUP_KEYS = ["M","WM","CAR","V","SIMPLE","HONEY","ROSE","LAV","FLAVOR"];

export const BASE_SHOTS = {
  "Latte": { "Hot 12": 2, "Hot 16": 2, "Iced 16": 2, "Iced 20": 3 },
  "Americano": { "Hot 12": 2, "Hot 16": 2, "Iced 16": 2, "Iced 20": 3 },
  "Espresso": { "Hot 12": 2, "Hot 16": 2 },
  "Expressoda": { "Iced 16": 2, "Iced 20": 3 }
};

export const FLAVOR_RULES = {
  "Mocha": {
    abbrev: "ML",
    syrups: {
      "Hot 12": { M: 2 }, "Hot 16": { M: 2.5 }, "Iced 16": { M: 2 }, "Iced 20": { M: 2.5 }
    }
  },
  "White Mocha": {
    abbrev: "WML",
    syrups: {
      "Hot 12": { WM: 2 }, "Hot 16": { WM: 2.5 }, "Iced 16": { WM: 2 }, "Iced 20": { WM: 2.5 }
    }
  },
  "Caramel": {
    abbrev: "CL",
    syrups: {
      "Hot 12": { CAR: 2 }, "Hot 16": { CAR: 2.5 }, "Iced 16": { CAR: 2 }, "Iced 20": { CAR: 2.5 }
    }
  },
  "Vanilla": {
    abbrev: "VL",
    syrups: {
      "Hot 12": { FLAVOR: 2.5 }, "Hot 16": { FLAVOR: 3 }, "Iced 16": { FLAVOR: 2.5 }, "Iced 20": { FLAVOR: 3.5 }
    }
  },
  "Lavender": {
    abbrev: "LL",
    syrups: {
      "Hot 12": { LAV: 3, SIMPLE: 1.5 }, "Hot 16": { LAV: 4, SIMPLE: 2 },
      "Iced 16": { LAV: 3, SIMPLE: 1.5 }, "Iced 20": { LAV: 3, SIMPLE: 1.5 }
    }
  },
  "Rose": {
    abbrev: "RL",
    syrups: {
      "Hot 12": { ROSE: 3, SIMPLE: 1.5 }, "Hot 16": { ROSE: 4, SIMPLE: 2 },
      "Iced 16": { ROSE: 3, SIMPLE: 1.5 }, "Iced 20": { ROSE: 3, SIMPLE: 1.5 }
    }
  },
  "Honey Cinnamon": {
    abbrev: "HCL",
    syrups: {
      "Hot 12": { HONEY: 2.5 }, "Hot 16": { HONEY: 3 }, "Iced 16": { HONEY: 2.5 }, "Iced 20": { HONEY: 3.5 }
    }
  },
  "Other Flavor": {
    abbrev: "FL",
    syrups: {
      "Hot 12": { FLAVOR: 2.5 }, "Hot 16": { FLAVOR: 3 }, "Iced 16": { FLAVOR: 2.5 }, "Iced 20": { FLAVOR: 3.5 }
    }
  }
};

export const FLAVORS = ["None", ...Object.keys(FLAVOR_RULES)];

export const BASE_RULES = {
  "Latte": { milkRequired: true, defaultMilk: "Whole" },
  "Americano": { milkRequired: false, defaultMilk: "None" },
  "Espresso": { milkRequired: false, defaultMilk: "None" },
  "Expressoda": { milkRequired: false, defaultMilk: "None" }
};

export function emptySyrups() {
  return Object.fromEntries(SYRUP_KEYS.map(k => [k, 0]));
}

export function prettySize(sizeKey) {
  return SIZE_LABELS[sizeKey] || sizeKey;
}

export function orderName(base, flavor) {
  if (base === "Latte" && flavor && flavor !== "None") return `${flavor} Latte`;
  return base;
}

export function abbrevFor(base, flavor) {
  if (base === "Latte" && flavor && flavor !== "None") return FLAVOR_RULES[flavor]?.abbrev || "L";
  if (base === "Latte") return "L";
  if (base === "Americano") return "A";
  if (base === "Espresso") return "E";
  if (base === "Expressoda") return "ES";
  return "";
}

export function targetsFor(base, flavor, sizeKey, extraShot) {
  const baseShots = BASE_SHOTS[base]?.[sizeKey] ?? null;
  const shots = baseShots == null ? null : baseShots + (extraShot ? 1 : 0);

  const syrups = emptySyrups();
  if (base === "Latte" && flavor && flavor !== "None") {
    const m = FLAVOR_RULES[flavor]?.syrups?.[sizeKey] || {};
    for (const [k,v] of Object.entries(m)) syrups[k] = Number(v.toFixed(1));
  }
  return { shots, syrups };
}
