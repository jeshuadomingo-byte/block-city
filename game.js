"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const titleScreen = document.getElementById("title-screen");
const startButton = document.getElementById("start-button");
const cashLabel = document.getElementById("cash");
const missionLabel = document.getElementById("mission-count");
const heatLabel = document.getElementById("heat");
const messageLabel = document.getElementById("message");
const actionButton = document.getElementById("action-button");

const world = { width: 2200, height: 1400 };
const keys = Object.create(null);
const vehicles = [
  { x: 470, y: 790, angle: 0, color: "#f66b4d", occupied: false },
  { x: 1450, y: 420, angle: Math.PI, color: "#66e0db", occupied: false },
  { x: 1780, y: 1020, angle: Math.PI / 2, color: "#f8df63", occupied: false }
];

const player = {
  x: 980,
  y: 700,
  angle: 0,
  speed: 0,
  inVehicle: false,
  radius: 14
};

const state = {
  running: false,
  cash: Number(localStorage.getItem("blockCityCash")) || 0,
  missions: Number(localStorage.getItem("blockCityMissions")) || 0,
  heat: 0,
  heatTime: 0,
  mission: { x: 1650, y: 720, active: true },
  pickup: { x: 1280, y: 390, active: true },
  messageTime: 0
};

const police = [
  { x: 190, y: 190, angle: 0, speed: 2.2 },
  { x: 2050, y: 1250, angle: Math.PI, speed: 2.1 }
];

function showMessage(text, seconds = 2.2) {
  messageLabel.textContent = text;
  messageLabel.classList.add("visible");
  state.messageTime = seconds;
}

function updateHud() {
  cashLabel.textContent = "$" + String(state.cash).padStart(3, "0");
  missionLabel.textContent = state.missions + (state.missions === 1 ? " job" : " jobs");
  heatLabel.textContent = [0, 1, 2].map(index => index < state.heat ? "●" : "○").join(" ");
  heatLabel.setAttribute("aria-label", "Heat level " + state.heat + " out of 3");
}

function saveProgress() {
  localStorage.setItem("blockCityCash", String(state.cash));
  localStorage.setItem("blockCityMissions", String(state.missions));
}

function closestVehicle(distanceLimit = 72) {
  let result = null;
  let closest = distanceLimit;
  vehicles.forEach(vehicle => {
    const distance = Math.hypot(player.x - vehicle.x, player.y - vehicle.y);
    if (distance < closest) {
      closest = distance;
      result = vehicle;
    }
  });
  return result;
}

function performAction() {
  if (!state.running) return;

  if (player.inVehicle) {
    const vehicle = vehicles.find(item => item.occupied);
    if (vehicle) {
      vehicle.occupied = false;
      player.inVehicle = false;
      player.speed = 0;
      player.x = vehicle.x + Math.cos(vehicle.angle + Math.PI / 2) * 38;
      player.y = vehicle.y + Math.sin(vehicle.angle + Math.PI / 2) * 38;
      showMessage("You left the car.");
    }
    return;
  }

  const vehicle = closestVehicle();
  if (vehicle) {
    vehicle.occupied = true;
    player.inVehicle = true;
    showMessage("Vehicle ready.");
  }
}

function setHeat(level) {
  state.heat = Math.max(0, Math.min(3, level));
  state.heatTime = 7;
  updateHud();
  if (state.heat > 0) showMessage("Police on your trail.");
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function update(dt) {
  if (!state.running) return;

  const direction = keys.ArrowUp || keys.w ? 1 : keys.ArrowDown || keys.s ? -1 : 0;
  const turning = keys.ArrowLeft || keys.a ? -1 : keys.ArrowRight || keys.d ? 1 : 0;
  const pace = player.inVehicle ? 260 : 155;

  if (direction) {
    player.speed += direction * (player.inVehicle ? 520 : 900) * dt;
  } else {
    player.speed *= player.inVehicle ? Math.pow(0.3, dt) : Math.pow(0.04, dt);
  }

  const maxSpeed = player.inVehicle ? 250 : 155;
  player.speed = Math.max(-maxSpeed * 0.45, Math.min(maxSpeed, player.speed));

  if (Math.abs(player.speed) > 4 && turning) {
    player.angle += turning * (player.inVehicle ? 2.2 : 3.4) * dt *
      (player.speed >= 0 ? 1 : -1);
  }

  player.x += Math.cos(player.angle) * player.speed * dt;
  player.y += Math.sin(player.angle) * player.speed * dt;
  player.x = Math.max(24, Math.min(world.width - 24, player.x));
  player.y = Math.max(24, Math.min(world.height - 24, player.y));

  if (player.inVehicle) {
    const vehicle = vehicles.find(item => item.occupied);
    if (vehicle) {
      vehicle.x = player.x;
      vehicle.y = player.y;
      vehicle.angle = player.angle;
    }
  }

  if (player.inVehicle) {
    state.heatTime -= dt;
  } else if (state.heatTime > 0) {
    state.heatTime -= dt;
  }

  if (state.heatTime <= 0 && state.heat > 0) {
    state.heat -= 1;
    state.heatTime = 5;
    updateHud();
  }

  if (state.pickup.active && distance(player, state.pickup) < 42) {
    state.pickup.active = false;
    state.cash += 150;
    setHeat(state.heat + 1);
    saveProgress();
    updateHud();
    showMessage("Cash secured: $150");
  }

  if (state.mission.active && distance(player, state.mission) < 48) {
    state.mission.active = false;
    state.cash += 500;
    state.missions += 1;
    setHeat(state.heat + 1);
    saveProgress();
    updateHud();
    showMessage("Courier complete: $500");
  }

  if (state.heat > 0) {
    police.forEach(officer => {
      const targetAngle = Math.atan2(player.y - officer.y, player.x - officer.x);
      let delta = targetAngle - officer.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      officer.angle += delta * Math.min(1, dt * 2);
      officer.speed = 2.2 + state.heat * 0.5;
      officer.x += Math.cos(officer.angle) * officer.speed * 60 * dt;
      officer.y += Math.sin(officer.angle) * officer.speed * 60 * dt;
    });
  }

  if (state.messageTime > 0) {
    state.messageTime -= dt;
    if (state.messageTime <= 0) messageLabel.classList.remove("visible");
  }
}

function roadRect(x, y, width, height) {
  ctx.fillStyle = "#596168";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#9ba0a3";
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 18]);
  ctx.beginPath();
  ctx.moveTo(x, y + height / 2);
  ctx.lineTo(x + width, y + height / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width / 2, y + height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawWorld(cameraX, cameraY) {
  ctx.save();
  ctx.translate(-cameraX, -cameraY);
  ctx.fillStyle = "#31443b";
  ctx.fillRect(0, 0, world.width, world.height);

  roadRect(0, 520, world.width, 220);
  roadRect(0, 1060, world.width, 180);
  roadRect(520, 0, 220, world.height);
  roadRect(1360, 0, 220, world.height);
  roadRect(1880, 0, 160, world.height);

  ctx.fillStyle = "#1d2c38";
  [
    [80, 80, 360, 360], [810, 80, 420, 360],
    [1620, 80, 200, 360], [830, 820, 410, 180],
    [40, 820, 360, 180], [1620, 820, 220, 180],
    [80, 1160, 360, 160], [830, 1180, 410, 140],
    [1620, 1160, 220, 140]
  ].forEach(([x, y, width, height]) => {
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#405266";
    ctx.fillRect(x + 12, y + 12, width - 24, 12);
    ctx.fillStyle = "#1d2c38";
  });

  if (state.mission.active) drawMarker(state.mission.x, state.mission.y, "#66e0db", "JOB");
  if (state.pickup.active) drawMarker(state.pickup.x, state.pickup.y, "#f8df63", "$");

  vehicles.forEach(vehicle => drawVehicle(vehicle.x, vehicle.y, vehicle.angle, vehicle.color));
  police.forEach(officer => {
    if (state.heat > 0) drawPolice(officer.x, officer.y, officer.angle);
  });
  drawPlayer();

  ctx.restore();
}

function drawMarker(x, y, color, label) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 38);
  ctx.lineTo(x + 22, y - 70);
  ctx.lineTo(x - 22, y - 70);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#101827";
  ctx.font = "900 16px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - 78);
}

function drawVehicle(x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#101827";
  ctx.fillRect(-30, -17, 60, 34);
  ctx.fillStyle = color;
  ctx.fillRect(-26, -20, 52, 40);
  ctx.fillStyle = "#b9d5dd";
  ctx.fillRect(-5, -16, 24, 32);
  ctx.fillStyle = "#090d16";
  ctx.fillRect(-24, -24, 10, 5);
  ctx.fillRect(14, -24, 10, 5);
  ctx.fillRect(-24, 19, 10, 5);
  ctx.fillRect(14, 19, 10, 5);
  ctx.restore();
}

function drawPolice(x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#1a252f";
  ctx.fillRect(-28, -19, 56, 38);
  ctx.fillStyle = "#e8edf2";
  ctx.fillRect(-28, -19, 20, 38);
  ctx.fillStyle = "#4f77dc";
  ctx.fillRect(-4, -19, 8, 38);
  ctx.fillStyle = "#f66b4d";
  ctx.fillRect(4, -19, 8, 38);
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.inVehicle ? "#66e0db" : "#f8df63";
  ctx.beginPath();
  ctx.arc(0, 0, player.inVehicle ? 6 : 12, 0, Math.PI * 2);
  ctx.fill();
  if (!player.inVehicle) {
    ctx.fillStyle = "#101827";
    ctx.fillRect(-4, -18, 8, 8);
  }
  ctx.restore();
}

function render() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const cameraX = Math.max(0, Math.min(world.width - width, player.x - width / 2));
  const cameraY = Math.max(0, Math.min(world.height - height, player.y - height / 2));
  ctx.clearRect(0, 0, width, height);
  drawWorld(cameraX, cameraY);
}

let previousTime = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - previousTime) / 1000);
  previousTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function setKey(key, pressed) {
  keys[key] = pressed;
  const control = document.querySelector(`[data-key="${key}"]`);
  if (control) control.classList.toggle("pressed", pressed);
}

window.addEventListener("keydown", event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }
  if (key === " ") performAction();
  setKey(key, true);
});

window.addEventListener("keyup", event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  setKey(key, false);
});

document.querySelectorAll("[data-key]").forEach(control => {
  const key = control.dataset.key;
  control.addEventListener("pointerdown", event => {
    event.preventDefault();
    control.setPointerCapture(event.pointerId);
    setKey(key, true);
  });
  control.addEventListener("pointerup", () => setKey(key, false));
  control.addEventListener("pointercancel", () => setKey(key, false));
});

actionButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  performAction();
});

startButton.addEventListener("click", () => {
  state.running = true;
  titleScreen.classList.add("hidden");
  showMessage("Find the cyan JOB marker.");
});

updateHud();
requestAnimationFrame(frame);
