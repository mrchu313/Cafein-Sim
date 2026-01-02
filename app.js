const ticketEl = document.getElementById("ticket");
const resultEl = document.getElementById("result");

const sizeSel = document.getElementById("size");
const shotsSel = document.getElementById("shots");
const milkSel = document.getElementById("milk");

let currentOrder = null;

// --- Orders ---
function randomOrder() {
  const sizes = ["Hot 12","Hot 16","Iced 16","Iced 20"];
  const milks = ["Whole","2%","Oat","Almond","Skim"];
  const shotsBySize = { "Hot 12":2,"Hot 16":2,"Iced 16":2,"Iced 20":3 };

  const size = sizes[Math.floor(Math.random()*sizes.length)];
  return {
    size,
    milk: milks[Math.floor(Math.random()*milks.length)],
    shots: shotsBySize[size]
  };
}

function renderTicket() {
  if (!currentOrder) return;
  ticketEl.textContent =
`ORDER:
${currentOrder.size}
Milk: ${currentOrder.milk}
Shots: ${currentOrder.shots}`;
}

// --- Buttons ---
document.getElementById("newOrder").onclick = () => {
  currentOrder = randomOrder();
  renderTicket();
  resultEl.textContent = "";
};

document.getElementById("check").onclick = () => {
  if (!currentOrder) return;

  const errors = [];
  if (sizeSel.value !== currentOrder.size) errors.push("Wrong size");
  if (milkSel.value !== currentOrder.milk) errors.push("Wrong milk");
  if (+shotsSel.value !== currentOrder.shots) errors.push("Wrong shots");

  resultEl.textContent = errors.length
    ? "Errors:\n- " + errors.join("\n- ")
    : "Perfect!";
};

// --- Canvas drawing (smooth + iPad-friendly scaling) ---
const canvas = document.getElementById("labelCanvas");
const ctx = canvas.getContext("2d");

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);

  // drawing style defaults
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

  // Pencil pressure support (works on iPad)
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
