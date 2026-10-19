import GameManager from '../GameManager.js';
import ui from '../ui.js';

let timerId = null;
let lights = [];
let nextBlow = null;
let blown = 0;
let blinkTimer = 0;

export function brainDamage()
{
  return blown;
}

function update()
{
  if (!GameManager.isPlaying || !GameManager.engine.running) {
    return;
  }
  for (const light of lights) {
    if (light.classList.contains('dead')) {
      continue;
    }
    if (Math.random() < 0.75)
      continue;
    light.classList.toggle('lit');
    light.classList.toggle('unlit');
  }
}

function tick(ts)
{
  if (blown && blinkTimer < ts) {
    blinkTimer = ts + 500;
    ui.toBrain.classList.toggle('lit');
  }
  if (!nextBlow) {
    nextBlow = ts + Math.random() * 10000 + 5000;
    return;
  }
  if (ts < nextBlow) {
    return;
  }
  let light = null;
  while (!light || light.classList.contains('dead')) {
    light = lights[(Math.random() * lights.length)|0];
  }
  ++blown;
  console.log("boom");
  light.classList.remove('lit');
  light.classList.remove('unlit');
  light.classList.add('dead');
  // TODO: sfx
  nextBlow = null;
}

function onClick(light)
{
  if (!light.classList.contains('dead')) {
    return;
  }
  light.classList.add('changing');
  window.setTimeout(() => {
    light.classList.remove('changing');
    light.classList.remove('dead');
    light.classList.add('unlit');
    // TODO: sfx
    --blown;
    if (blown <= 0) {
      blown = 0;
      ui.toBrain.classList.remove('lit');
    }
  }, 500);
}

GameManager.engine.addEventListener('panelChanged', ({ detail: id }) => {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
  if (id == 'brain') {
    timerId = window.setInterval(update, 100);
  }
});

GameManager.engine.addEventListener('newGame', () => {
  if (!lights.length) {
    lights = [...ui.panelBrain.root.querySelectorAll('SvgAsset[data-asset=tube]')].map(el => el.tui);
    for (const light of lights) {
      const ref = light;
      light.addEventListener('click', onClick.bind(null, ref));
    }
  }
  for (const light of lights) {
    light.classList.add('unlit');
    light.classList.remove('lit');
    light.classList.remove('dead');
  }
  blown = 0;
  nextBlow = null;
});

GameManager.engine.onTick(tick);
