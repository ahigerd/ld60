import { Input } from './Engine.js';
import EventTargetClass from './EventTarget.js';

const dpadKeys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];

export class TouchControls extends EventTargetClass {
  constructor(dpadContainer, buttonContainer, pauseContainer, buttons = []) {
    super();
    this.buttons = {};

    if (dpadContainer) {
      this.dpadContainer = dpadContainer;
      dpadContainer.classList.add('dpad');
      this._up = this.addButton(dpadContainer, 'up', '&uarr;', 'ArrowUp', 'up');
      this._left = this.addButton(dpadContainer, 'left', '&larr;', 'ArrowLeft', 'left');
      this._right = this.addButton(dpadContainer, 'right', '&rarr;', 'ArrowRight', 'right');
      this._down = this.addButton(dpadContainer, 'down', '&darr;', 'ArrowDown', 'down');
      dpadContainer.addEventListener('mousedown', (event) => this._touchDpad(event, true));
      dpadContainer.addEventListener('mousemove', (event) => this._touchDpad(event, event.buttons));
      dpadContainer.addEventListener('mouseout', (event) => this._touchDpad(event, false));
      dpadContainer.addEventListener('mouseup', (event) => this._touchDpad(event, false));
      dpadContainer.addEventListener('touchstart', (event) => this._touchDpad(event, true));
      dpadContainer.addEventListener('touchmove', (event) => this._touchDpad(event, true));
      dpadContainer.addEventListener('touchend', (event) => this._touchDpad(event, false));
    }

    if (buttonContainer) {
      this.buttonContainer = buttonContainer;
      buttonContainer.classList.add('buttons');
      for (const button of buttons) {
        let buttonElement;
        if (typeof button === 'string') {
          buttonElement = this.addButton(buttonContainer, 'button', button, button, button);
        } else {
          buttonElement = this.addButton(buttonContainer, 'button', button.label, button.key, button.id ?? button.key);
        }
        buttonElement.addEventListener('mousedown', (event) => this._touchButton(event, buttonElement, true));
        buttonElement.addEventListener('mouseout', (event) => this._touchButton(event, buttonElement, false));
        buttonElement.addEventListener('mouseup', (event) => this._touchButton(event, buttonElement, false));
        buttonElement.addEventListener('touchstart', (event) => this._touchButton(event, buttonElement, true));
        buttonElement.addEventListener('touchend', (event) => this._touchButton(event, buttonElement, false));
      }
    }

    if (pauseContainer) {
      this.pauseContainer = pauseContainer;
      pauseContainer.classList.add('pause');
      this._pauseButton = this.addButton(pauseContainer, 'button', 'Pause', 'Escape', 'pause');
      this._pauseButton.addEventListener('touchstart', event => this._pause(event, true));
      this._pauseButton.addEventListener('touchend', event => this._pause(event, false));
      this._pauseButton.addEventListener('mousedown', event => this._pause(event, true));
      this._pauseButton.addEventListener('mouseout', event => this._pause(event, false));
      this._pauseButton.addEventListener('mouseup', event => this._pause(event, false));
    }

    // By default, hide the touchscreen controls for devices without a touchscreen.
    // ontouchstart defaults to null for devices with one and undefined for devices without one.
    this.hidden = window.ontouchstart === undefined;
    this.touchEnabled = !this.hidden;

    // More modern browsers don't have the ontouchstart property but still report touch events
    // Enable touch events if we receive one
    //document.body.addEventListener('touchstart', () => this.touchEnabled = true, { once: true });
  }

  addButton(container, className, label, key, id) {
    const button = document.createElement('DIV');
    button.className = className;
    button.innerHTML = '<span>' + label + '</span>';
    button.key = key;
    container.appendChild(button);
    this.buttons[id] = button;
    return button;
  }

  _touchDpad(event, active) {
    event.preventDefault();
    const touches = event.touches || (active ? [{ clientX: event.pageX - window.scrollX, clientY: event.pageY - window.scrollY, identifier: 'mouse' }] : []);
    const rect = this.dpadContainer.getBoundingClientRect();
    const buttonWidth = rect.width / 3;
    const buttonHeight = rect.height / 3;
    const leftX = rect.left + buttonWidth;
    const rightX = rect.right - buttonWidth;
    const upY = rect.top + buttonHeight;
    const downY = rect.bottom - buttonHeight;
    const oldKeys = {};
    for (const key of dpadKeys) {
      oldKeys[key] = Input.keys[key];
      Input.keys[key] = false;
    }
    for (const touch of touches) {
      if (touch.clientX < rect.left) continue;
      if (touch.clientX > rect.right) continue;
      if (touch.clientY < rect.top) continue;
      if (touch.clientY > rect.bottom) continue;
      if (touch.clientX < leftX) Input.keys.ArrowLeft = true;
      if (touch.clientX > rightX) Input.keys.ArrowRight = true;
      if (touch.clientY < upY) Input.keys.ArrowUp = true;
      if (touch.clientY > downY) Input.keys.ArrowDown = true;
    }
    this._up.classList.toggle('active', Input.keys.ArrowUp);
    this._left.classList.toggle('active', Input.keys.ArrowLeft);
    this._right.classList.toggle('active', Input.keys.ArrowRight);
    this._down.classList.toggle('active', Input.keys.ArrowDown);
    for (const key of dpadKeys) {
      if (Input.keys[key] != oldKeys[key]) {
        this.dispatchEvent(oldKeys[key] ? 'enginekeyup' : 'enginekeydown', { key });
      }
    }
  }

  _touchButton(event, element, active) {
    event.preventDefault();
    element.classList.toggle('active', active);
    const trigger = Input.keys[element.key] != active;
    Input.keys[element.key] = active;
    if (trigger) {
      this.dispatchEvent(active ? 'enginekeydown' : 'enginekeyup', { key: element.key });
    }
  }

  _pause(event, active) {
    event.preventDefault();
    if (this._pauseDebounce) return;
    this._pauseDebounce = true;
    Input.keys.Escape = active;
    // Pause needs a special event handler because it is the one action that can
    // fire while the engine is paused. Games will probably want to also bind
    // the actual Escape key for the same reason.
    if (active) {
      if (this.onPauseClicked) this.onPauseClicked();
    }
    window.setTimeout(() => {
      this._pauseButton.classList.toggle('active', false);
      this._pauseDebounce = false;
    }, 100);
    this._pauseButton.classList.toggle('active', active);
  }

  get hidden() {
    return this._hidden;
  }

  set hidden(active) {
    this._hidden = active;
    if (this.dpadContainer) this.dpadContainer.style.display = active ? 'none' : '';
    if (this.pauseContainer) this.pauseContainer.style.display = active ? 'none' : '';
    if (this.buttonContainer) this.buttonContainer.style.display = active ? 'none' : '';
  }
}

export default TouchControls;
