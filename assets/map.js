import GameManager from '../GameManager.js';
import thinui from '../thinui.js';
import ui from '../ui.js';

const panels = {};
let lastPanel = null;
let transition = false;

function onButtonClicked(id, event)
{
  if (!GameManager.isPlaying)
    return;
  const panel = panels[id];
  if (lastPanel == panel || transition)
    return;
  if (lastPanel) {
    transition = true;
    window.setTimeout(() => {
      lastPanel.hide();
      panel.style.opacity = 1;
      lastPanel = panel;
    }, 750);
    window.setTimeout(() => transition = false, 1500);
    lastPanel.style.opacity = 0;
  } else {
    lastPanel = panel;
    panel.style.opacity = 1;
  }
  panel.show();
  GameManager.engine.dispatchEvent('panelChanged', panel.panelType);
}

GameManager.engine.addEventListener('newGame', () => {
  for (const id in ui) {
    if (!id.startsWith('to'))
      continue;
    ui[id].addEventListener('click', (event) => onButtonClicked(id, event));
    const panelId = 'panel' + id.substring(2);
    panels[id] = ui[panelId];
    panels[id].panelType = id.substring(2, 3).toLowerCase() + id.substring(3);
    panels[id].hide();
  }

  lastPanel = ui.panelCockpit;
  ui.panelCockpit.style.opacity = 1;
  ui.panelCockpit.show();
  GameManager.engine.dispatchEvent('panelChanged', 'cockpit');
});
