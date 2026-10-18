import { Input } from '../html52d/Engine.js';
import Point, { PIXELS_PER_UNIT, UNITS_PER_PIXEL } from '../html52d/Point.js';
import Sprite, { AnimationSequence, AnimationFrame } from '../html52d/Sprite.js';
import CharacterCore, { Layers } from '../CharacterCore.js';
import assets from '../assets.js';
import GameManager from '../GameManager.js';
import CONFIG from '../config.js';
import { weaponProps } from './bullet.js';

const PI_2 = Math.PI * 0.5;
const PI_4 = Math.PI * 0.25;
const PI_8 = Math.PI * 0.125;
const TAU = Math.PI * 2;

export function sortObjectsByDepth(lhs, rhs) {
  if (lhs.label == 'bullet' && rhs.label != 'bullet') return 1;
  if (lhs.label != 'bullet' && rhs.label == 'bullet') return -1;
  return (rhs.plane - lhs.plane) || (lhs._origin[1] - rhs._origin[1]);
}

const originOffset = [20 * UNITS_PER_PIXEL, 20 * UNITS_PER_PIXEL];

const deathLineOrder = [];
for (let i = 0; i < 500; i++) {
  deathLineOrder.push(i);
}
for (let i = 0; i < 500; i++) {
  const p = (Math.random() * 500)|0;
  const t = deathLineOrder[i];
  deathLineOrder[i] = deathLineOrder[p];
  deathLineOrder[p] = t;
}

const prefab = {
  label: 'player',
  animateHitboxes: false,
  defaultIsAnimating: true,
  defaultAnimationName: 'n',
  hitbox: [-.15, -.15, .15, .15, Layers.Terrain | Layers.Character | Layers.EnemyBullet | Layers.Powerup],
  layer: 2,
  animations: {
    n: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 0, 0, 40, 40, originOffset),
    ], 50.0),
    nw: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 40, 0, 40, 40, originOffset),
    ], 50.0),
    w: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 80, 0, 40, 40, originOffset),
    ], 50.0),
    sw: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 40, 0, 40, -40, originOffset),
    ], 50.0),
    s: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 0, 0, 40, -40, originOffset),
    ], 50.0),
    se: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 40, 0, -40, -40, originOffset),
    ], 50.0),
    e: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 80, 0, -40, 40, originOffset),
    ], 50.0),
    ne: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 40, 0, -40, 40, originOffset),
    ], 50.0),
    tn: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 0, 40, 40, 40, originOffset),
    ], 50.0),
    tnw: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 40, 40, 40, 40, originOffset),
    ], 50.0),
    tw: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 80, 40, 40, 40, originOffset),
    ], 50.0),
    tsw: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 40, 40, 40, -40, originOffset),
    ], 50.0),
    ts: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 0, 40, 40, -40, originOffset),
    ], 50.0),
    tse: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 40, 40, -40, -40, originOffset),
    ], 50.0),
    te: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 80, 40, -40, 40, originOffset),
    ], 50.0),
    tne: new AnimationSequence([
      new AnimationFrame(assets.images.ship, 40, 40, -40, 40, originOffset),
    ], 50.0),
  },
};

const rotations = ["w", "nw", "n", "ne", "e", "se", "s", "sw", "w"];

export default class Player extends CharacterCore {
  constructor(origin) {
    super(prefab, origin);
  }

  start(scene) {
    super.start(scene);
    this.hitSound = assets.sounds.damage;
    this.lives = 3;
    this.health = 4;
    this.maxHealth = 4;
    this.speed = 0;
    this.maxSpeed = 5;
    this.deathAnim = 0;
    this.noiseTimer = 0;
    this.noiseChannel = 0;
    this.plane = 2;
    this.isPlayer = true;
    this.inputVelocity = new Point(0, 0);
    this.targetAngle = -PI_2;
    this.angle = -PI_2;
    this.braking = true;
    this.shotCooldown = 0;
    this.weapon = "v1";
    this.comms = new Set();
    this.commsSeen = new Set();
    this.commsAnswered = new Set();

    this.recallPos = new Point(this.origin);

    const cam = GameManager.engine.cameras[0];
    this.healthMeter = new assets.prefabs.health([cam.width - 0.3, 3.85]);
    scene.add(this.healthMeter);

    this.commIcon = new assets.prefabs.comms([cam.width - 0.75, 3.85]);
    scene.add(this.commIcon);

    this.sounds = {};
    for (let snd of ['v1', 'v2', 'l1', 'l1a', 'l2']) {
      this.sounds[snd] = assets.sounds[snd];
      if (this.sounds[snd]) {
        this.sounds[snd].preservesPitch = false;
      }
    }
  }

  update(scene, ms) {
    if (CONFIG.debug && Input.keys['q']) GameManager.nextLevel();
    if (GameManager.getState() == 'warp') {
      this.setAnimation("n");
      this.braking = true;
      this.targetAngle = this.angle = -PI_2;
      return;
    }
    if (this.dead) {
      const camera = GameManager.engine.cameras[0];
      const ctx = camera.layers[3];
      let opacity = 1.0 - ((this.deathTimer / 500)|0) / 15;

      for (let i = ms; i > 0; --i) {
        for (let y = deathLineOrder[this.deathTimer % 500]; y < camera.heightPixels; y += 500) {
          let x = 0;
          while (x < camera.widthPixels) {
            let w = (Math.random() * 40 + 10)|0;
            let c = ((Math.random() * 256) / (1 + this.respawnTimer / 20))|0;
            ctx.fillStyle = `rgba(${c},${c},${c},${opacity})`;
            ctx.fillRect(x, y|0, w, 1);
            x += w;
          }
        }
        this.deathTimer--;
        if (this.deathTimer < 0) {
          this.deathTimer += 500;
        }
      }
      if (this.deathTimer < 2000) {
        let c = 255 - (this.respawnTimer / 10);
        if (this.deathTimer < 500) {
          ctx.fillStyle = `rgba(0, ${c}, 0, 0.15)`;
        } else if (this.deathTimer < 1000) {
          ctx.fillStyle = `rgba(0, ${c}, 0, 0.1)`;
        } else {
          ctx.fillStyle = `rgba(0, ${c}, 0, 0.05)`;
        }
        ctx.font = 'bold 200px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("SIGNAL LOST", camera.widthPixels * 0.5, camera.heightPixels * 0.5);
        if (this.lives > 0 && this.deathTimer < 500) {
          ctx.font = 'bold 120px sans-serif';
          ctx.fillText("AUTO-RECALL IN PROGRESS", camera.widthPixels * 0.5, camera.heightPixels * 0.6);
          this.respawnTimer += ms;
          if (this.respawnTimer > 3000) {
            this.deathTimer = 0;
            this.dead = false;
            this.health = this.maxHealth;
            this.origin.set(this.recallPos);
            ctx.clearRect(0, 0, camera.widthPixels, camera.heightPixels);
            GameManager.radar.bgDrawn = false;
            this.hidden = false;
            this.explosion = [];
            this.hasCollision = true;
            GameManager.setState('playing');
          }
        } else if (this.deathTimer < 500) {
          this.dead = false;
          GameManager.engine.pause(false);
          GameManager.gameOver();
          return;
        }
      }
      super.update(scene, ms);
      return;
    }
    if (this.stunTimer <= 0) {
      let dx = Input.keys['ArrowLeft'] ? -1 : 0;
      dx += Input.keys['ArrowRight'] ? 1 : 0;
      let dy = Input.keys['ArrowUp'] ? -1 : 0;
      dy += Input.keys['ArrowDown'] ? 1 : 0;
      this.braking = !(dx || dy);
      let ds = ms * 0.03;
      if (this.braking) {
        ds *= 3;
        this.speed = this.speed > ds ? this.speed - ds : 0;
      } else {
        this.speed = this.speed < this.maxSpeed - ds ? this.speed + ds : this.maxSpeed;
        this.targetAngle = Math.atan2(dy, dx);
      }
      let a2 = this.targetAngle;
      let da = Math.abs(this.angle - a2);
      if (da > Math.PI) {
        if (this.angle < a2) {
          a2 -= TAU;
        } else {
          a2 += TAU;
        }
        da = Math.abs(this.angle - a2);
      }
      if (da > Math.PI - 0.01) {
        this.angle = this.targetAngle;
        da = 0;
      }
      if (da > 0) {
        if (da > 0.1) {
          this.angle = (3 * this.angle + a2) * 0.25;
          if (this.angle > Math.PI) {
            this.angle -= TAU;
          } else if (this.angle < -Math.PI) {
            this.angle += TAU;
          }
        } else {
          this.angle = this.targetAngle;
        }
      }
      this.moveColliding(ms, Math.cos(this.angle) * this.speed, Math.sin(this.angle) * this.speed);
      let anim = rotations[((this.angle + Math.PI) / PI_4 + PI_8)|0];

      if (this.shotCooldown > 0) {
        this.shotCooldown -= ms;
      } else if (Input.keys["z"]) {
        if (CONFIG.debug) {
          if (Input.keys["c"]) {
            if (!this.weaponLock) {
              this.upgradeWeapon();
              this.weaponLock = true;
            }
          } else {
            this.weaponLock = false;
          }
        }
        const bullet = new assets.prefabs.bullet(this.origin);
        bullet.dx = Math.cos(this.targetAngle) + this.velocity[0] / 16;
        bullet.dy = Math.sin(this.targetAngle) + this.velocity[1] / 16;
        bullet.dir = anim;
        bullet.weapon = this.weapon;
        scene.add(bullet);
        const sound = this.sounds[this.weapon];
        if (this.weapon[0] == "v") {
          sound.currentTime = 0;
          if (this.altBullet) {
            sound.playbackRate = 0.8;
          } else {
            sound.playbackRate = 1.0;
          }
          this.altBullet = !this.altBullet;
        } else if (this.weapon == "l1") {
          if (sound.ended || sound.currentTime == 0) {
            sound.currentTime = 0;
          } else if (sound.currentTime > 0.05) {
            sound.currentTime = 0.07;
          }
        } else {
          if (sound.ended || sound.currentTime == 0) {
            sound.currentTime = 0;
          } else if (sound.currentTime > 0.03) {
            sound.currentTime = 0.1;
          }
        }
        sound.play();
        this.shotCooldown = weaponProps[bullet.weapon].cooldown;
      }

      if (!this.braking) {
        anim = "t" + anim;
      }
      this.setAnimation(anim);
    }

    super.update(scene, ms);
    this.noiseTimer -= ms;

    if (Input.keys["x"]) {
      this.commIcon.currentComm = this.getNextComm();
      GameManager.setState("comms");
    }
  }

  lateUpdate(scene) {
    scene.objects.sort(sortObjectsByDepth);
    this.centerCameraOn(this);
  }

  heal(hp) {
    this.health += hp;
    if (this.health > this.maxHealth) {
      this.health = this.maxHealth;
    }
    this.healthMeter.setAnimation(this.health);
  }

  onDamage() {
    this.healthMeter.setAnimation(this.health);
    super.onDamage();
  }

  onDeath() {
    this.healthMeter.setAnimation(0);
    this.deathTimer = 5000;
    this.respawnTimer = 0;
    setTimeout(() => assets.sounds.static.play(), 250);
    GameManager.commButton.classList.toggle("enabled", false);
    GameManager.commButton.classList.toggle("disabled", true);
    GameManager.setState('death');
    this.lives--;
    super.onDeath();
  }

  addComm(comm) {
    if (this.comms.has(comm)) {
      return;
    }
    if (!this.commsSeen.has(comm)) {
      assets.sounds.incoming.play();
      this.commsSeen.add(comm);
    }
    this.comms.add(comm);
    this.updateComms();
  }

  removeComm(comm) {
    if (this.comms.has(comm)) {
      this.comms.delete(comm);
      this.updateComms();
    }
  }

  updateComms() {
    let enabled = false;
    let replay = false;
    for (const c of this.comms) {
      if (!this.commsAnswered.has(c)) {
        enabled = true;
        break;
      } else if (c.replayable) {
        replay = true;
      }
    }
    GameManager.commButton.classList.toggle("enabled", enabled);
    GameManager.commButton.classList.toggle("disabled", !enabled);
    if (replay) {
      this.commIcon.setAnimation("replay");
    } else {
      this.commIcon.setAnimation(enabled ? "on" : "off");
    }
  }

  getNextComm() {
    let replay = null;
    for (const c of this.comms) {
      if (!this.commsAnswered.has(c)) {
        this.commsAnswered.add(c);
        this.updateComms();
        return c;
      } else if (c.replayable) {
        replay = c;
      }
    }
    return replay;
  }

  upgradeWeapon() {
    const weaponCycle = { "v1": "v2", "v2": "l1", "l1": "l2", "l2": "l2" };
    this.weapon = weaponCycle[this.weapon];
  }
}
