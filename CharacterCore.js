import Sprite, { drawDebugHitbox } from './html52d/Sprite.js';
import Point, { PIXELS_PER_UNIT } from './html52d/Point.js';
import GameManager from './GameManager.js';
import CONFIG from './config.js';

const ACCEL = 0.01;
const DECEL = 0.02;

function accel(d, c, ms) {
  if (Math.abs(c - d) < .01) {
    return c;
  } else if (c == 0) {
    return d - d * ms * DECEL;
  } else {
    return d + (c - d) * ms * ACCEL;
  }
}

export const Layers = {
  Terrain: 0x1,
  Character: 0x2,
  PlayerBullet: 0x4,
  EnemyBullet: 0x8,
  Powerup: 0x10,
};

export default class CharacterCore extends Sprite {
  constructor(config, origin) {
    super(config, origin);
    this.GameManager = GameManager;
    this.velocity = new Point(0, 0);
    this.explosion = [];
  }

  shouldCollide(other) {
    // TODO: profile `return other instanceof CharacterCore;`
    return false;
  }

  selfDestruct() {
    this.selfDestructed = true;
    this.blinkTimer = 0;
    this.stunTimer = 0;
    this.inflict(this.health);
  }

  inflict(damage) {
    if (this.immune || this.blinkTimer > 0) return;
    this.health -= damage;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.hasCollision = false;
      if (this.animations.dead)
        this.setAnimation('dead');
      this.blinkTimer = this.maxHealth > 10 || this.label != 'enemy' ? 2500 : 500;
      this.onDeath();
    } else {
      this.hidden = true;
      if (this.isPlayer) {
        this.blinkTimer = 500;
        this.stunTimer = 250;
      } else {
        this.blinkTimer = 16; // this.maxHealth > 10 ? 500 : (this.label == 'enemy' ? 0 : 1000);
        this.stunTimer = 16; // this.blinkTimer * 0.5;
      }
      this.hitSound.play();
      this.onDamage();
    }
  }

  render(camera) {
    const frame = this.currentFrame;
    const x = (this._origin[0] * PIXELS_PER_UNIT - frame._originPixels[0]);
    const y = (this._origin[1] * PIXELS_PER_UNIT - frame._originPixels[1]);
    camera.layers[this.layer].imageSmoothingEnabled = false;
    if (!this.hidden) {
      camera.layers[this.layer].drawImage(
        frame.imageData,
        frame.imageBounds[0],
        frame.imageBounds[1],
        frame.imageBounds[2],
        frame.imageBounds[3],
        x|0,
        y|0,
        frame.imageBounds[2],
        frame.imageBounds[3],
      );
    }
    if (this.explosion.length) {
      for (const explosion of this.explosion) {
        if (explosion.t < 0 && explosion.t > -100) {
          camera.layers[this.layer].drawImage(
            assets.images.burst,
            0,
            0,
            14,
            14,
            (x + explosion.x)|0,
            (y + explosion.y)|0,
            14,
            14
          );
        }
      }
      /*
      if (this.value > 0) {
        const c = 255 + Math.ceil(this.scoreTimer / 2.5);
        camera.layers[2].textAlign = 'center';
        camera.layers[2].fillStyle = `rgb(${c},${c},${c})`;
        camera.layers[2].fillText(this.value, x + this.lastAabb.width * 16, y + this.scoreTimer * .03);
      }
      */
    }
    camera.layers[this.layer].imageSmoothingEnabled = CONFIG.smoothing;
    if (CONFIG.debug) drawDebugHitbox.call(this, camera);
  }

  renderHealth(camera) {
    const layer = camera.layers[this.layer];
    const fraction = this.health < 0 ? 0 : this.health / this.maxHealth;
    const pixelRect = this.pixelRect;
    layer.fillStyle = `hsl(${fraction * 120},100%,50%)`;
    layer.fillRect(pixelRect[0], pixelRect[1] - 5, (pixelRect[2] - pixelRect[0] - .5) * fraction, 3);
  }

  start() {
    this.faceLeft = true;
    this.health = 100;
    this.maxHealth = 100;
    this.hidden = false;
    this.dead = false;
    this.blinkTimer = 0;
    this.stunTimer = 0;
    this.hitSound = assets.sounds.hit;
    this.deathSound = assets.sounds.destroy;
  }

  moveColliding(ms, dx, dy) {
    this.velocity.setXY(dx, dy);
    this.move(this.velocity[0] * ms / 500, this.velocity[1] * ms / 500);
  }

  centerCameraOn(sprite) {
    const camera = this.GameManager.camera;
    if (!sprite || !camera) {
      return;
    }
    const halfWidth = camera.width * .5;
    const halfHeight = camera.height * .5;
    let x = ((sprite._origin[0] * PIXELS_PER_UNIT) | 0) / PIXELS_PER_UNIT;
    let y = ((sprite._origin[1] * PIXELS_PER_UNIT) | 0) / PIXELS_PER_UNIT;
    camera.setXY(x, y);
  }

  update(scene, ms) {
    if (this.explosion.length) {
      this.scoreTimer -= ms;
      for (const ex of this.explosion) {
        ex.t -= ms;
      }
      if (this.explosion[this.explosion.length - 1].t < -500) {
        if (this.isPlayer) {
          this.hidden = true;
        } else {
          scene.remove(this);
        }
      } else if (this.explosion[0].t < -50) {
        this.hidden = true;
      }
      return;
    }
    if (this.stunTimer > 0) {
      this.stunTimer -= ms;
    }
    if (this.blinkTimer > 0) {
      this.blinkTimer -= ms;
      this.hidden = this.blinkTimer <= 0 ? false : (this.blinkTimer % 100 < 35);
      if (this.dead && this.blinkTimer <= 0) {
        if (this.label !== 'player') {
          scene.remove(this);
        }
      }
    }
  }

  onDamage() {}
  onDeath() {
    this.deathSound.play();
    for (let i = 0; i < 8; i++) {
      //assets.sounds.hit.currentTime = 0;
      //assets.sounds.hit.play();
      this.explosion.push({ x: Math.random() * 0.5 * PIXELS_PER_UNIT * this.lastAabb.width, y: Math.random() * 0.5 * PIXELS_PER_UNIT * this.lastAabb.height, t: i * 17 });
    }
  }

  onCollisionEnter(other, coll) {
    this.onCollisionStay(other, coll);
  }

  onCollisionStay(other, coll) {
  }
}
