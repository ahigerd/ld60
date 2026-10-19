import GameManager from '../GameManager.js';
import ui from '../ui.js';

let blinkTimer = 0;

const pipes = [
  { display: ui.pipe1status, repair: ui.pipe1repair, status: () => GameManager.player.leaking[0] },
  { display: ui.pipe2status, repair: ui.pipe2repair, status: () => GameManager.player.leaking[1] },
  { display: ui.pipe3status, repair: ui.pipe3repair, status: () => GameManager.player.leaking[2] },
];

function refuel() {
  GameManager.player.refueling = true;
}

function fix(index) {
  if (GameManager.player.leaking[index]) {
    GameManager.player.leaking[index] = false;
    GameManager.player.leaks--;
  }
}

function tick(ts)
{
  if (!GameManager.player) {
    return;
  }

  if ((GameManager.player.fuel <= 0 || GameManager.player.leaks) && blinkTimer < ts) {
    blinkTimer = ts + 500;
    ui.toBoiler.classList.toggle('lit');
  } else if (!GameManager.player.leaks && GameManager.player.fuel > 0) {
    ui.toBoiler.classList.remove('lit');
  }

  if (!ui.panelBoiler.isVisible)
    return;
  ui.boilerPressure.value = GameManager.player.pressure;
  ui.boilerPressure.render();

  ui.boilerTemp.value = GameManager.player.temperature + Math.sqrt(Math.random()) * 3;
  ui.boilerTemp.render();

  ui.fuel.root.innerText = Math.ceil(GameManager.player.fuel) + '%';

  for (const pipe of pipes) {
    if (pipe.status()) {
      pipe.display.root.innerText = "Broken";
      pipe.display.classList.add('leak');
    } else {
      pipe.display.root.innerText = "OK";
      pipe.display.classList.remove('leak');
    }
  }
}

let initialized = false;
GameManager.engine.addEventListener('newGame', () => {
  if (!initialized) {
    initialized = true;
    let index = 0;
    ui.fuelRefill.addEventListener('click', refuel);
    for (const pipe of pipes) {
      let i = index;
      pipe.repair.addEventListener('click', () => fix(i));
      ++index;
    }
  }
});

GameManager.engine.onTick(tick);
