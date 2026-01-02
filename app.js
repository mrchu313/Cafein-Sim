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

// --- Canvas drawing ---
const canvas = document.getElementById("labelCanvas");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
resize();
window.addEventListener("resize", resize);

let drawing = false;
canvas.onpointerdown = e => {
  drawing = true;
  ctx.moveTo(e.offsetX, e.offsetY);
};
canvas.onpointermove = e => {
  if (!drawing) return;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
};
canvas.onpointerup = () => drawing = false;

document.getElementById("clearLabel").onclick = () => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
};
