import GameManager from '../GameManager.js';
import ui from '../ui.js';

const ctx = ui.clock.root.getContext('2d');

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

  ui.cockpitPressure.render();
  ui.cockpitTemp.render();

  ui.cockpitSpeed.value = GameManager.player.renderSpeed;
  ui.cockpitSpeed.render();
}

/*
GameManager.engine.addEventListener('panelChanged', ({ detail: id }) => {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
  if (id == 'cockpit') {
    timerId = window.setInterval(update, 100);
  }
});
*/

GameManager.engine.addEventListener('newGame', () => {
});

GameManager.engine.onTick(tick);
