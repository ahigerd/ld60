import GameManager from '../GameManager.js';
import ui from '../ui.js';
import assets from '../assets.js';

let State;
assets.require('assets/progress.js').then(([progress]) => State = progress.State);

let timerId = null;
let lights = [];
let nextBlow = null;
let blown = 0;
let blinkTimer = 0;
let altTick = false;

export function brainDamage()
{
  return blown;
}

function update()
{
  if (!GameManager.isPlaying || !GameManager.engine.running) {
    return;
  }
  altTick = !altTick;
  if (!altTick && GameManager.player.state == State.Walking) {
    return;
  }
  for (const light of lights) {
    if (light.svgClass.contains('dead')) {
      continue;
    }
    if (Math.random() < 0.75)
      continue;
    light.svgClass.toggle('lit');
    light.svgClass.toggle('unlit');
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
  while (!light || light.svgClass.contains('dead')) {
    light = lights[(Math.random() * lights.length)|0];
  }
  ++blown;
  console.log("boom");
  light.svgClass.remove('lit');
  light.svgClass.remove('unlit');
  light.svgClass.add('dead');
  // TODO: sfx
  nextBlow = null;
}

function onClick(light)
{
  if (!light.svgClass.contains('dead')) {
    return;
  }
  light.svgClass.add('changing');
  window.setTimeout(() => {
    light.svgClass.remove('changing');
    light.svgClass.remove('dead');
    light.svgClass.add('unlit');
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
    timerId = window.setInterval(update, 50);
  }
});

GameManager.engine.addEventListener('newGame', () => {
  if (!lights.length) {
    lights = [...ui.panelBrain.root.querySelectorAll('SvgAsset[data-asset=tube]')].map(el => el.tui);
    for (const light of lights) {
      const ref = light;
      light.svgClass = light.shadow.querySelector('svg').classList;
      light.addEventListener('click', onClick.bind(null, ref));
    }
  }
  for (const light of lights) {
    light.svgClass.add('unlit');
    light.svgClass.remove('lit');
    light.svgClass.remove('dead');
  }
  blown = 0;
  nextBlow = null;
});

GameManager.engine.onTick(tick);
