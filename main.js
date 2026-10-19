import assets from './assets.js';
import { Input } from './html52d/Engine.js';
import GameManager from './GameManager.js';
import config from './config.js';
/* eslint-disable no-console */

const style = document.createElement('STYLE');
const stylesheets = [];
for (let factor = 1; factor <= 6; factor++) {
  let minWidth = config.width * factor;
  let maxWidth = config.width * (factor + 1);
  let minHeight = config.height * factor;
  let maxHeight = config.height * (factor + 1);
  let query = ['@media screen'];
  if (factor > 1) {
    query.push(`(width >= ${minWidth}px)`);
    query.push(`(height >= ${minHeight}px)`);
  }
  if (factor < 6) {
    query.push(`((width < ${maxWidth}px) or (height < ${maxHeight}px))`);
  }
  stylesheets.push(`${query.join(' and ')} {
    .warning {
      zoom: ${factor};
    }
    SvgAsset {
      zoom: ${factor / 2};
    }
    #container {
      left: calc(50% - ${minWidth / 2}px);
      top: calc(50% - ${minHeight / 2}px);
      width: ${minWidth} px;
      height: ${minHeight} px;
    }
    .touch.full > #container {
      top: 0;
    }
    .splashText { font-size: ${minHeight / 25}px }
    .popover { line-height: 50vh } /*${minHeight / 2}px }*/
    #hud td {
      font-size: ${10 * factor}px;
    }
    #hud img {
      height: ${21 * factor}px;
      margin-top: ${2 * factor}px;
      margin-bottom: ${2 * factor}px;
    }
    h1 {
      font-size: ${minHeight / 10}px;
    }
    .bigbutton {
      font-size: ${minHeight / 15}px;
    }
    .meter {
      margin-left: ${7 * factor}px;
      height: ${16 * factor}px;
      width: ${minHeight / 2}px;
    }
  }`.replaceAll(' px', 'px'));
}
style.innerHTML = stylesheets.join('\n');
document.head.appendChild(style);

Input.normalize['w'] = 'ArrowUp';
Input.normalize['W'] = 'ArrowUp';
Input.normalize['s'] = 'ArrowDown';
Input.normalize['S'] = 'ArrowDown';
Input.normalize['a'] = 'ArrowLeft';
Input.normalize['A'] = 'ArrowLeft';
Input.normalize['d'] = 'ArrowRight';
Input.normalize['D'] = 'ArrowRight';
Input.normalize['Z'] = 'z';
Input.normalize['M'] = 'x';
Input.normalize['m'] = 'x';
Input.normalize['X'] = 'x';
Input.normalize[' '] = 'z';

const progress = document.getElementById('progress');
assets.addEventListener('loadprogress', ({ detail: percent }) => progress.innerText = (percent * 100).toFixed(0) + '%');
assets.addEventListener('loadcomplete', () => GameManager.init(assets), { once: true });

document.body.addEventListener('contextmenu', (event) => event.preventDefault());
