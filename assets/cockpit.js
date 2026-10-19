import GameManager from '../GameManager.js';
import ui from '../ui.js';

const ctx = ui.clock.root.getContext('2d');
let throttleButton = null;
let throttleRod = null;
let buttonDown = false;

function tick(timestamp)
{
  if (!ui.panelCockpit.isVisible)
    return;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(100, 100, 80, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const theta = Math.PI * 0.5 + i * Math.PI / 30;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    if (i % 5 == 0)
      ctx.moveTo(100 + dx * 64, 100 + dy * 64);
    else
      ctx.moveTo(100 + dx * 70, 100 + dy * 70);
    ctx.lineTo(100 + dx * 76, 100 + dy * 76);
  }
  ctx.stroke();

  if (!GameManager.player) {
    return;
  }
  const time = GameManager.player.timeOfDay / GameManager.player.lengthOfDay;
  const hour = Math.PI + Math.PI * 2 * time;
  const minute = Math.PI * (Math.floor(time * 24 * 30) / 30 - 0.5);
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = '#c00000';
  ctx.beginPath();
  ctx.moveTo(100, 100);
  ctx.lineTo(50, 100);
  ctx.stroke();
  ctx.strokeStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(100, 100);
  ctx.lineTo(100 + Math.cos(minute) * 72, 100 + Math.sin(minute) * 72);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, 100);
  ctx.moveTo(100, 100);
  ctx.lineTo(100 + Math.cos(hour) * 40, 100 + Math.sin(hour) * 40);
  ctx.stroke();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(100, 100, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ui.cockpitPressure.value = GameManager.player.pressure;
  ui.cockpitPressure.render();

  ui.cockpitTemp.value = GameManager.player.temperature + Math.sqrt(Math.random()) * 3;
  ui.cockpitTemp.render();

  ui.cockpitSpeed.value = GameManager.player.renderSpeed;
  ui.cockpitSpeed.render();
}

function setThrottle(value)
{
  GameManager.player.throttle = value;
  const bounds = ui.cockpitThrottle.root.getBoundingClientRect();
  let minX = bounds.left;
  let maxX = bounds.right;
  const w = maxX - minX;
  minX += w * (15.5 / 220.0);
  maxX -= w * (15.5 / 220.0);
  const scale = (maxX - minX) / w;
  const pos = value * scale + (minX - bounds.left) / w;
  ui.throttleHandle.root.style.left = `${pos * 100}%`;
  ui.throttleHandle.root.style.top = `${17 - 10 * Math.sin(value * Math.PI)}px`;
  ui.throttleHandle.root.style.zoom = 1.0 + Math.sin(value * Math.PI) * .1;
  if (value > 0.5) {
    const rodScale = 2 * (value - 0.5);
    const rodPos = -225 + 112.5 * (1 - rodScale); //  - ((1 - rodScale) * 183.6);
    throttleRod.setAttribute('transform', `scale(${-rodScale} 1) translate(${rodPos / rodScale} 0)`);
  } else {
    const rodScale = 2 * (0.5 - value);
    const rodPos = 112.5 / rodScale - 112.5;
    throttleRod.setAttribute('transform', `scale(${rodScale},1) translate(${rodPos} 0)`);
  }
}

function setThrottleButton(event)
{
  if (!throttleButton) return;
  if (!GameManager.isPlaying || !GameManager.engine.running) {
    return;
  }
  buttonDown = (event.type == 'touchstart' || event.type == 'mousedown');
  throttleButton.setAttribute('y', buttonDown ? 44.859 : 47.768475);
}

function moveThrottle(event)
{
  if (!buttonDown) return;
  if (!GameManager.isPlaying || !GameManager.engine.running || !event.buttons) {
    buttonDown = false;
    throttleButton.setAttribute('y', 47.768475);
    return;
  }
  let x = event.clientX;
  if (event.changedTouches) {
    const touch = event.changedTouches[0];
    x = touch.clientX;
  }

  const bounds = ui.cockpitThrottle.root.getBoundingClientRect();
  let minX = bounds.left;
  let maxX = bounds.right;
  const w = maxX - minX;
  minX += w * (15.5 / 220.0);
  maxX -= w * (15.5 / 220.0);
  let value = (x - minX) / (maxX - minX);
  if (value < 0) value = 0;
  if (value > 1) value = 1;
  const scale = (maxX - minX) / w;
  setThrottle(value);
  const oldValue = value;
  value = value * scale + (minX - bounds.left) / w;
  ui.throttleHandle.root.style.left = `${value * 100}%`;
}

ui.throttleHandle.addEventListener('mousedown', setThrottleButton);
ui.throttleHandle.addEventListener('touchstart', setThrottleButton);

document.body.addEventListener('mousemove', moveThrottle);
ui.throttleHandle.addEventListener('touchmove', moveThrottle);

document.body.addEventListener('mouseup', setThrottleButton);
ui.throttleHandle.addEventListener('touchend', setThrottleButton);

GameManager.engine.addEventListener('newGame', () => {
  throttleButton = ui.throttleHandle.shadow.querySelector('#throttleButton');
  throttleRod = ui.cockpitThrottle.shadow.querySelector('#rod');
  throttleRod.setAttribute('width', 0);
  setThrottle(0);
});

GameManager.engine.onTick(tick);
