import Scene from './Scene.js';
import EventTargetClass from './EventTarget.js';

export const Input = {
  keys: {},

  // These are mappings from various nonstandard key names that some browsers produce
  // to the standardized names in the HTML5 specification.
  normalize: {
    'Spacebar': ' ',
    'Left': 'ArrowLeft',
    'Right': 'ArrowRight',
    'Down': 'ArrowDown',
    'Up': 'ArrowUp',
    'OS': 'Meta',
    'Scroll': 'ScrollLock',
    'Del': 'Delete',
    'Crsel': 'CrSel',
    'Exsel': 'ExSel',
    'Esc': 'Escape',
    'Apps': 'ContextMenu',
    'Nonconvert': 'NonConvert',
    'MediaNextTrack': 'MediaTrackNext',
    'MediaPreviousTrack': 'MediaTrackPrevious',
    'FastFwd': 'MediaFastForward',
    'VolumeUp': 'AudioVolumeUp',
    'VolumeDown': 'AudioVolumeDown',
    'VolumeMute': 'AudioVolumeMute',
    'SelectMedia': 'LaunchMediaPlayer',
    'MediaSelect': 'LaunchMediaPlayer',
    'LaunchCalculator': 'LaunchApplication1',
    'LaunchMyComputer': 'LaunchApplication2',
    'Add': '+',
    'Decimal': '.',
    'Multiply': '*',
    'Divide': '/',
  },
};

const fullscreenMethods = ['requestFullscreen', 'webkitRequestFullscreen', 'msRequestFullscreen', 'mozRequestFullScreen'];
const fullscreenEvents = ['fullscreenchange', 'fullscreenerror', 'msfullscreenchange', 'msfullscreenerror', 'webkitfullscreenchange', 'webkitfullscreenerror'];

export class Engine extends EventTargetClass {
  constructor(options = {}) {
    super();

    this.pauseOnBlur = true;

    this._fullscreenPromises = [];
    this._requestFullscreenMethod = null;
    for (const method of fullscreenMethods) {
      if (document.body[method]) {
        this._requestFullscreenMethod = method;
        break;
      }
    }

    this._fpsFrames = 0;
    this._fpsSum = 0;
    this.fpsMeter = document.createElement('DIV');
    this.fpsMeter.style.position = 'absolute';
    this.fpsMeter.style.top = '0px';
    this.fpsMeter.style.right = '0px';
    this.fpsMeter.style.fontFamily = 'monospace';
    this.fpsMeter.style.textAlign = 'right';
    this.fpsMeter.width = '5em';
    this.showFps = options.showFps;

    this.activeScene = options.scene || new Scene();
    this.cameras = [];

    this.timer = null;

    this.tick = this.tick.bind(this);
    this._enqueuedEvents = [];

    this.eventSource = options.eventSource || window;
    this.eventSource.addEventListener('keydown', event => {
      if (!event.altKey && !event.ctrlKey && !event.metaKey) event.preventDefault();
      const key = Input.normalize[event.key] || event.key;
      Input.keys[key] = true;
      this.dispatchEvent('enginekeydown', { key, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
    });
    this.eventSource.addEventListener('keyup', event => {
      if (!event.altKey && !event.ctrlKey && !event.metaKey) event.preventDefault();
      const key = Input.normalize[event.key] || event.key;
      Input.keys[key] = false;
      this.dispatchEvent('enginekeyup', { key, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
    });

    this.onFullscreenChange = this.onFullscreenChange.bind(this);
    for (const eventName of fullscreenEvents) {
      document.addEventListener(eventName, this.onFullscreenChange);
    }
  }

  get showFps() {
    return this._showFps;
  }

  set showFps(on) {
    this._showFps = !!on;
    if (on) {
      document.body.appendChild(this.fpsMeter);
    } else if (this.fpsMeter.parentElement) {
      document.body.removeChild(this.fpsMeter);
    }
  }

  get running() {
    return !!this.timer;
  }

  start() {
    if (this.timer) {
      return;
    }
    this.timer = window.requestAnimationFrame(this.tick);
    this.dispatchEvent('enginestart');
  }

  pause(on = null) {
    this._lastTS = null;
    if (on === null) {
      on = !this.timer;
    }
    if (on) {
      this.start();
    } else {
      const wasRunning = this.running;
      window.cancelAnimationFrame(this.timer);
      this.timer = null;
      if (wasRunning) this.dispatchEvent('enginepause');
    }
  }

  step(ms = 16) {
    this.pause(false);
    this.tick(ms, true);
  }

  tick(timestamp, stepping) {
    if (this.running && !this._lastTS) {
      this._lastTS = timestamp;
      this.timer = window.requestAnimationFrame(this.tick);
      return;
    }
    if (document.hidden || !document.hasFocus() || document.visibilityState === 'hidden') {
      // Automatically pause the game if the browser loses focus
      if (this.pauseOnBlur) {
        this.pause(false);
      }
    }
    let ms;
    if (stepping) {
      ms = timestamp;
      this._lastTS = null;
    } else {
      ms = timestamp - this._lastTS;
      this._lastTS = timestamp;
    }
    const before = performance.now();
    for (let i = this._enqueuedEvents.length - 1; i >= 0; --i) {
      const queued = this._enqueuedEvents[i];
      queued.ms -= ms;
      if (queued.ms < 0) {
        queued.callback();
        this._enqueuedEvents.splice(i, 1);
      }
    }
    this.activeScene.tick(ms);
    for (let i = 0; i < this.cameras.length; i++) {
      this.cameras[i].render(this.activeScene);
    }
    const after = performance.now();
    if (this.showFps) {
      this._fpsSum += (after - before);
      this._fpsFrames++;
      if (this._fpsFrames > 15 || stepping) {
        const msPerFrame = this._fpsSum / this._fpsFrames;
        this.fpsMeter.innerHTML = (1000.0 / msPerFrame).toFixed(0) + ' fps<br/>' + msPerFrame.toFixed(2) + ' ms';
        this._fpsFrames = 0;
        this._fpsSum = 0;
      }
    }
    if (this.running) {
      this.timer = window.requestAnimationFrame(this.tick);
    } else {
      this.timer = null;
    }
  }

  get isFullscreen() {
    return !!document.fullscreenElement || document.fullscreen || document.webkitIsFullScreen;
  }

  get canFullscreen() {
    return !!this._requestFullscreenMethod;
  }

  requestFullscreen(element) {
    if (!this.canFullscreen || !element || !element[this._requestFullscreenMethod]) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      this._fullscreenPromises.push(resolve);
      try {
        element[this._requestFullscreenMethod]({ navigationUI: 'hide' });
      } catch (err) {
        this._requestFullscreenMethod = null;
        const idx = this._fullscreenPromises.indexOf(resolve);
        if (idx >= 0) {
          this._fullscreenPromises.splice(idx, 1);
        }
        resolve(false);
      }
    });
  }

  exitFullscreen() {
    if (!this.isFullscreen) {
      return;
    }
    const exitFullscreen = document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen ||
      document.mozExitFullScreen;
    exitFullscreen.call(document);
  }

  onFullscreenChange(event) {
    if (this.running && !this.isFullscreen) {
      this.pause(false);
    }
    while (this._fullscreenPromises.length) {
      try {
        this._fullscreenPromises.pop()(true);
      } catch (err) {
        // consume silently
      }
    }
  }

  enqueue(ms, callback) {
    this._enqueuedEvents.push({ ms, callback });
  }
}

export default Engine;
