import assets from './assets.js';
import Engine from './html52d/Engine.js';
import Camera from './html52d/Camera.js';
import Point, { PIXELS_PER_UNIT } from './html52d/Point.js';
//import { sortObjectsByDepth } from '../prefabs/hero.js';
import Scene from './html52d/Scene.js';
import TouchControls from './html52d/TouchControls.js';
import CONFIG from './config.js';
import ui from './ui.js';

let audioLatency = 0, lastAudioTime = 0;
let helpPage = 1;

let state = 'title';

const fullscreenEvents = ['fullscreenchange', 'fullscreenerror', 'msfullscreenchange', 'msfullscreenerror', 'webkitfullscreenchange', 'webkitfullscreenerror'];

const initialState = {
  tacks: 0,
};

class ExtendedEngine extends Engine {
  constructor(config) {
    super(config);
    this._ticks = [];
  }

  onTick(cb) {
    this._ticks.push(cb);
  }

  tick(timestamp, stepping) {
    super.tick(timestamp, stepping);
    const ct = this._ticks.length;
    for (let i = 0; i < ct; i++) {
      this._ticks[i](timestamp);
    }
  }
}

const GameManager = {
  ...initialState,
  difficulty: 0,
  enemiesRemaining: 0,
  engine: new ExtendedEngine({ showFps: false }),
  camera: new Camera(document.getElementById('camera'), CONFIG.widthPx, CONFIG.heightPx, 5),
  disableFullscreen: false,

  init(assets) {
    try {
      this.disableFullscreen = localStorage.enableFullscreen === '0';
    } catch (e) {
      console.error(e);
    }
    ui.enableFullscreen.root.checked = !this.disableFullscreen;

    this.engine.onTick(this.tick.bind(this));

    this.assets = assets;
    this.bgm = assets.sounds.bgm;
    if (this.bgm) this.bgm.gain = 0.5;

    this.bindEvent(ui.startButton, 'click', this.bindFullscreenThen(this.newGameNormal));
    this.bindEvent(ui.easyButton, 'click', this.bindFullscreenThen(this.newGameEasy));
    this.bindEvent(ui.helpButton, 'click', this.showHelp);
    this.bindEvent(ui.helpBackButton, 'click', this.helpBack.bind(this));
    this.bindEvent(ui.gameOverStartButton, 'click', this.showTitle);
    this.bindEvent(ui.exitButton, 'click', this.gameOver);
    this.bindEvent(ui.resumeButton, 'click', this.bindFullscreenThen(() => this.engine.start()));
    this.bindEvent(ui.enableFullscreen.root, 'change', this.enableFullscreen.bind(this));

    this.camera.layers[1].noTransform = true;
    this.engine.cameras.push(this.camera);
    this.camera.setXY(1, 1);
    this.camera.setScale(6, 6);

    this.engine.addEventListener('enginekeydown', e => e.detail.key === 'Escape' && this.onEscapePressed());
    this.engine.addEventListener('enginepause', this.onPause.bind(this));
    this.bindEvent(this.engine, 'enginestart', this.onStart.bind(this));

    this.touchControls = new TouchControls(
      document.getElementById('dpad'),
      document.getElementById('buttons'),
      document.getElementById('pauseContainer'),
      [
        { label: 'Fire', key: 'z' },
      ],
    );
    this.touchControls.onPauseClicked = () => this.isPlaying && this.engine.pause();
    this.touchControls.addEventListener('enginekeydown', event => this.engine.dispatchEvent('enginekeydown', event.detail));
    this.touchControls.addEventListener('enginekeyup', event => this.engine.dispatchEvent('enginekeyup', event.detail));
    this.touchControls.hidden = true;
    this.touchControls.touchEnabled = false;

    GameManager.showTitle();
  },

  bindEvent(target, eventName, callback, options = undefined) {
    target.addEventListener(eventName, (event) => {
      event.preventDefault();
      callback.call(this);
    }, options);
  },

  onEscapePressed() {
    if (state == "playing") {
      this.engine.pause();
    }
  },

  showTitle() {
    this.setState('title');

    this.scene = this.engine.activeScene = new Scene();

    ui.hud.hide();
    ui.container.show();
    ui.loading.hide();
    ui.helppage.hide();
    ui.gameOver.hide();
    ui.easyButton.hide();
    ui.pauseBox.hide();
    ui.splash.show();
    //ui.easyButton.style.display = CONFIG.easyModeUnlocked ? '' : 'none';

    //  TODO: Not sure why the engine has to be ticked twice to make this work
    this.engine.step();
    //this.scene.objects.sort(sortObjectsByDepth);
    this.camera.render(this.scene);
  },

  showHelp() {
    this.setState('help');
    helpPage = 1;
    this.updateHelp();

    ui.splash.hide();
    ui.helppage.show();
  },

  enableFullscreen() {
    this.disableFullscreen = !ui.enableFullscreen.root.checked;
    try {
      localStorage.enableFullscreen = this.disableFullscreen ? '0' : '1';
    } catch (e) {
      console.error(e);
    }
  },

  bindFullscreenThen(callback) {
    return () => {
      if (this.disableFullscreen) {
        callback.call(this);
        return;
      }
      this.fullscreenCallback = (event) => {
        if (event.type.toLowerCase().includes('error')) {
          this.disableFullscreen = true;
        } else {
          ui.fullscreen.classList.add('full');
        }
        for (const eventType of fullscreenEvents) {
          fullscreen.removeEventListener(eventType, this.fullscreenCallback);
        }
        this.fullscreenCallback = null;
        callback.call(this);
      };

      const fullscreen = ui.fullscreen.root;
      for (const eventType of fullscreenEvents) {
        fullscreen.addEventListener(eventType, this.fullscreenCallback);
      }
      const requestFullscreen = fullscreen.requestFullscreen ||
        fullscreen.webkitRequestFullscreen ||
        fullscreen.msRequestFullscreen ||
        fullscreen.mozRequestFullScreen;
      if (!requestFullscreen) {
        this.disableFullscreen = true;
        ui.enableFullscreen.root.checked = false;
        callback.call(this);
        return;
      }
      requestFullscreen.call(fullscreen, { navigationUI: 'hide' });
    };
  },

  exitFullscreen() {
    if (!document.fullscreenElement && !document.fullscreen) {
      return false;
    }
    const exitFullscreen = document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen ||
      document.mozExitFullScreen;
    exitFullscreen.call(document);
    ui.fullscreen.classList.remove('full');
  },

  newGameEasy() {
    CONFIG.easyMode = true;
    this.newGame();
  },

  newGameNormal() {
    CONFIG.easyMode = false;
    this.newGame();
  },

  newGame() {
    this.win = false;
    this.score = 0;
    this.addScore(0);
    ui.hud.show();
    ui.splash.hide();
    ui.gameOver.hide();
    this.scene = new Scene();
    this.engine.activeScene = this.scene;

    this.player = new assets.prefabs.player([0, 0]);
    this.scene.add(this.player);

    this.podsRescued = 0;
    this.level = 0;
    this.startLevel();

    Object.assign(this, initialState);
    this.setState('playing');
    this.engine.start();
    this.engine.dispatchEvent('newGame', null);
  },

  tick() {
  },

  onPause() {
    if (this.bgm) this.bgm.pause();
    document.body.classList.add('paused');
    if (this.isPlaying && state == "playing") {
      this.exitFullscreen();
      ui.pauseBox.show();
      this.touchControls.hidden = true;
      ui.fullscreen.classList.remove('touch');
    }
  },

  onStart() {
    ui.pauseBox.hide();
    document.body.classList.remove('paused');
    if (this.touchControls.touchEnabled) {
      this.touchControls.hidden = false;
      ui.fullscreen.classList.add('touch');
    }
    if (this.bgm) this.bgm.play();
  },

  winGame() {
    this.win = true;
    this.gameOver();
  },

  gameOver() {
    ui.panelBrain.hide();
    ui.panelCockpit.hide();
    ui.panelBoiler.hide();
    ui.panelCargo.hide();
    ui.panelLocomotion.hide();

    this.player.energy = -1;
    this.player.haltTimer = -1;
    if (this.bgm) this.bgm.stop();
    this.exitFullscreen();
    this.setState('gameover');
    for (const layer of this.camera.layers) {
      layer.clearRect(0, 0, this.camera.pixelWidth, this.camera.pixelHeight);
    }
    //ui.gameOverLevel.root.innerText = this.level;
    //ui.gameOverPods.root.innerText = this.podsRescued;
    if (this.win) {
      ui.gameOverWin.show();
      ui.gameOverLose.hide();
    } else {
      ui.gameOverWin.hide();
      ui.gameOverLose.show();
    }
    ui.gameOver.show();
  },

  get isPlaying() {
    return state === 'playing';
  },

  getState() {
    return state;
  },

  setState(t) {
    state = t;
    document.body.className = t;
    if (this.isPlaying) {
      //assets.sounds.bgm.play();
    }
    this.engine.pauseOnBlur = (t != 'death' && t != 'warp');
    this.engine.dispatchEvent('stateChanged', t);
  },

  addScore(n) {
    this.score += n;
    // ui.tackCount.root.innerText = this.score;
  },

  nextLevel() {
    if (!this.isPlaying) {
      return;
    }
    this.level += 1;
    /*
    for (const obj of this.scene.objects.slice()) {
      if (!obj.isPlayer && !obj.isUI) {
        this.scene.remove(obj);
      }
    }
    this.setState('warp');
    this.starfield.warpTime = 200;
    */
  },

  startLevel() {
    this.setState("playing");
    /*
    const level = LevelData[this.level];
    if (!level) {
      this.winGame();
      return;
    }
    this.player.origin.set(this.player.recallPos);
    this.bounds = level.bounds;
    for (const def of level.objects) {
      const obj = new def.prefab(def.origin);
      Object.assign(obj, def.props);
      this.scene.add(obj);
    }
    */
    if (this.bgm) this.bgm.stop();
    if (this.bgm) this.bgm.play();
  },

  helpBack() {
    helpPage--;
    this.updateHelp();
  },

  updateHelp() {
    if (helpPage == 1) {
      ui.help1.show();
    } else {
      this.showTitle();
    }
  },
};

window.GameManager = GameManager;

export default GameManager;
