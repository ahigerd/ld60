import { Point, IntPoint, UNITS_PER_PIXEL, PIXELS_PER_UNIT } from './Point.js';
import { Rect, IntRect } from './Rect.js';
import CONFIG from '../config.js';

// eslint-disable-next-line no-unused-vars
const degenerateFrame = {
  _originPixels: new IntPoint(0, 0),
  _sizePixels: new IntPoint(0, 0),
};

export function cropImage(imageData, sx, sy, sw, sh) {
  const canvas = document.createElement('CANVAS');
  canvas.setAttribute('width', sw);
  canvas.setAttribute('height', sh);
  canvas.width = sw;
  canvas.height = sh;
  canvas.imageSmoothingEnabled = false;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageData, sx, sy, sw, sh, 0, 0, sw, sh);
  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

export function flipImage(image, flipX, flipY) {
  if (!flipX && !flipY) return image;
  const flipKey = 'flipped' + (flipX ? 'X' : '') + (flipY ? 'Y' : '');
  if (image[flipKey]) return image[flipKey];
  const canvas = document.createElement('CANVAS');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.style.display = 'none';
  const ctx = canvas.getContext('2d');
  ctx.translate(flipX ? image.width : 0, flipY ? image.height : 0);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(image, 0, 0);
  const img = new Image();
  img.src = canvas.toDataURL();
  image[flipKey] = img;
  return img;
}

export function drawDebugHitbox(camera, fill = false) {
  if (!this.hitbox) {
    return;
  }
  const layer = camera.layers[this.layer];
  const pixelRect = this.hitbox.translated(this._origin);

  layer.strokeStyle = 'red';
  layer.beginPath();
  layer.rect(
    pixelRect[0] * PIXELS_PER_UNIT,
    pixelRect[1] * PIXELS_PER_UNIT,
    (pixelRect[2] - pixelRect[0]) * PIXELS_PER_UNIT,
    (pixelRect[3] - pixelRect[1]) * PIXELS_PER_UNIT,
  );
  layer.rect(
    this._origin[0] * PIXELS_PER_UNIT - 1,
    this._origin[1] * PIXELS_PER_UNIT - 1,
    2,
    2,
  );
  layer.stroke();
  if (fill) {
    layer.beginPath();
    layer.fillStyle = 'red';
    layer.rect(
      this._origin[0] * PIXELS_PER_UNIT - 1,
      this._origin[1] * PIXELS_PER_UNIT - 1,
      2,
      2,
    );
    layer.fill();
  }
}

export class Hitbox extends Rect {
  constructor(p1, p2, p3, p4, p5) {
    if (p4 !== undefined) {
      super(p1, p2, p3, p4);
      this.bits = p5 === undefined ? 0xFFFFFFFF : p5;
    } else if (p2 && p2.length) {
      super(p1, p2);
      this.bits = p3 === undefined ? 0xFFFFFFFF : p3;
    } else {
      super(p1);
      this.bits = p2 === undefined ? 0xFFFFFFFF : p2;
    }
  }

  intersects(other) {
    if (this.bits !== undefined && other.bits !== undefined && !(this.bits & other.bits)) {
      return false;
    }
    return super.intersects(other);
  }
}

/**
 * A representation of a single frame of an animation.
 */
export class AnimationFrame extends Rect {
  /**
   * Creates a new animation frame by cropping an image.
   * @param {???} The sprite sheet.
   * @param {Number=} Left side of sprite, in pixels. (Default 0)
   * @param {Number=} Top side of sprite, in pixels. (Default 0)
   * @param {Number=} Width of sprite, in pixels. (Default to whole image)
   * @param {Number=} Height of sprite, in pixels. (Default to whole image)
   * @param {Point=} Position of the origin inside the sprite, in world units.
   *                 (Default to bottom center)
   * @param {Hitbox[]=} The hitboxes for this frame relative to the origin.
   *                 (Default to one hitbox covering the whole image)
   */
  constructor(image, x = 0, y = 0, w = null, h = null, origin = null, hitboxes = null) {
    w = w || image.width;
    h = h || image.height;
    const flipX = w < 0;
    const flipY = h < 0;
    if (w < 0) w = -w;
    if (h < 0) h = -h;
    const widthUnits = w * UNITS_PER_PIXEL;
    const heightUnits = h * UNITS_PER_PIXEL;
    if (!origin) {
      // If the origin isn't specified, default it to bottom center
      origin = [widthUnits * 0.5, heightUnits];
    }
    super(-origin[0], -origin[1], widthUnits - origin[0], heightUnits - origin[1]);
    this._sizePixels = new IntPoint(w, h);
    this._origin = new Point(origin);
    this._originPixels = new IntPoint((origin[0] * PIXELS_PER_UNIT)|0, (origin[1] * PIXELS_PER_UNIT)|0);
    if (hitboxes) {
      if (Array.isArray(hitboxes[0])) {
        this.hitboxes = hitboxes.map(normalizeHitboxClass);
      } else {
        this.hitboxes = [normalizeHitboxClass(hitboxes)];
      }
    } else {
      this.hitboxes = [new Hitbox(-origin[0], -origin[1], widthUnits - origin[0], heightUnits - origin[1])];
    }
    this.imageData = flipImage(image, flipX, flipY);
    this.imageBounds = new Int32Array(4);
    this.imageBounds[0] = (flipX ? image.width - x - w : x);
    this.imageBounds[1] = (flipY ? image.height - y - h : y);
    this.imageBounds[2] = w;
    this.imageBounds[3] = h;
  }

  get origin() {
    return this._origin;
  }

  set origin(other) {
    this._origin.set(other);
  }
}

/**
 * A representation of a series of frames forming an animation.
 */
export class AnimationSequence {
  /**
   * Creates a new animation sequence from a set of frames.
   * @param {AnimationFrame[]} The set of frames to be rendered.
   * @param {Number=} The duration of each frame. (Default 60fps)
   */
  constructor(frames, frameMS = 1000.0 / 60.0) {
    this.frames = frames;
    this.frameMS = frameMS;
    this.framesPerMs = 1 / frameMS;
  }

  /**
   * Returns the total duration of the animation, in milliseconds.
   */
  get duration() {
    return this.frames.length * this.frameMS;
  }

  /**
   * Returns the number of frames in the animation.
   */
  get length() {
    return this.frames.length;
  }

  /**
   * Returns the frame to be rendered at the specified number of milliseconds
   * into the animation.
   * @param {Number} The elapsed time.
   * @returns {AnimationFrame} The frame to render.
   */
  frameAt(ms) {
    return this.frames[(ms * this.framesPerMs) | 0];
  }
}

const normalizeHitboxClass = hitbox => hitbox instanceof Hitbox ? hitbox : new Hitbox(...hitbox);
const normalizeFrameClass = frame => frame instanceof AnimationFrame ? frame : new AnimationFrame(...frame);

export function normalizeSequenceClass(seq) {
  if (!seq) {
    return null;
  }
  if (seq instanceof AnimationSequence) {
    return seq;
  }
  let fps = 1000.0 / 60.0;
  let frames = seq;
  if (!Array.isArray(seq[seq.length - 1])) {
    frames = seq.slice(0, seq.length - 1);
    const config = seq[seq.length - 1];
    if (config && typeof config === 'object') {
      fps = config.fps;
    } else {
      fps = config;
    }
  }
  return new AnimationSequence(frames.map(normalizeFrameClass), fps);
}

const configCache = new Map();

// Note: only use primitive-typed properties here
const defaultProps = {
  isAsleep: true,
  hasCollision: true,
  lastAabb: null,
  animationTime: 0,
  oneShotName: null,
  scene: null,
  _sweepCollisions: false,
};

/**
 * A renderable object that can be added to a scene.
 */
export class Sprite {
  static prepareConfig(config, memoize = true) {
    // Use a couple of shortcuts to improve performance
    if (config._baked) {
      return config;
    }
    const existing = configCache.get(config);
    if (existing) {
      return existing;
    }

    const prepared = {
      _baked: true,
      label: config.label || null,
      animateHitboxes: config.animateHitboxes || false,
      currentAnimationName: config.defaultAnimationName || 'default',
      layer: config.layer || 0,
      isTrigger: config.isTrigger || false,
      isPassive: config.isPassive || false,
      hasCollision: 'hasCollision' in config ? config.hasCollision : true,
      animations: {},
      isAnimating: config.defaultIsAnimating || false,
    };

    // Use this form in order to keep hasOwnProperty behaving as expected
    for (const method of ['update', 'start', 'lateUpdate', 'onCollisionEnter', 'onCollisionStay', 'onCollisionExit', 'render']) {
      if (config[method]) {
        prepared[method] = config[method];
      }
    }

    if (config.hitbox) {
      prepared._hitboxes = [normalizeHitboxClass(config.hitbox)];
    } else if (config.hitboxes) {
      prepared._hitboxes = config.hitboxes.map(normalizeHitboxClass);
    } else {
      prepared._hitboxes = [new Hitbox(-.5, -.5, .5, .5)];
    }

    for (const key of Object.keys(config.animations || {})) {
      prepared.animations[key] = normalizeSequenceClass(config.animations[key]);
    }

    if (memoize) {
      configCache.set(prepared);
    }
    return prepared;
  }

  constructor(config = {}, origin = null) {
    Object.assign(this, defaultProps);
    Object.assign(this, Sprite.prepareConfig(config));
    console.log(Sprite.prepareConfig(config), this.layer)
    this._origin = new Point(origin || config.origin || [0, 0]);

    const currentAnimation = this.currentAnimation;
    this.currentFrame = currentAnimation ? currentAnimation.frameAt(0) : null;
    this.lastHitboxes = [];

    // An array is 25% faster than a Set here.
    // this._coarseCollisions = [];
    // But in Chrome 67, [].includes doesn't consistently work with reference identity
    this._coarseCollisions = new Set();
    // A Map with object-valued keys is 4% faster than maintaining numeric IDs and using a plain object.
    this._collisions = new Map();

    this._pixelRect = new IntRect(0, 0, 0, 0);
    this._lastOrigin = new Point(0, 0);
    this._velocity = new Point(0, 0);
  }

  computeBoxes() {
    const hitboxes = this.hitboxes;
    const len = hitboxes.length;
    if (this.lastAabb) {
      this.lastAabb.set(this.currentFrame || this.hitbox);
    } else {
      this.lastAabb = new Rect(this.currentFrame || this.hitbox);
    }
    this.lastAabb.translate(this._origin);
    if (this.lastHitboxes.length > len) {
      this.lastHitboxes.length = len;
    } else {
      while (this.lastHitboxes.length < len) {
        this.lastHitboxes.push(new Hitbox(0, 0, 0, 0));
      }
    }
    for (let i = 0; i < len; i++) {
      hitboxes[i].translateInto(this.lastHitboxes[i], this._origin);
      this.lastHitboxes[i].bits = hitboxes[i].bits;
      this.lastAabb.union(this.lastHitboxes[i]);
    }
  }

  get hitboxes() {
    if (this.animateHitboxes) {
      return this.currentFrame.hitboxes;
    }
    return this._hitboxes;
  }

  get hitbox() {
    return this.hitboxes[0];
  }

  set hitbox(other) {
    this.hitboxes[0].set(other);
  }

  get origin() {
    return this._origin;
  }

  set origin(other) {
    this._origin.set(other);
  }

  get pixelRect() {
    if (CONFIG.smoothing) {
      if (this.currentFrame) {
        this._pixelRect[0] = (this._origin[0] * PIXELS_PER_UNIT - this.currentFrame._originPixels[0]);
        this._pixelRect[1] = (this._origin[1] * PIXELS_PER_UNIT - this.currentFrame._originPixels[1]);
        this._pixelRect[2] = this._pixelRect[0] + this.currentFrame._sizePixels[0];
        this._pixelRect[3] = this._pixelRect[1] + this.currentFrame._sizePixels[1];
      } else {
        const hitbox = this.hitbox;
        this._pixelRect[0] = (this._origin[0] * PIXELS_PER_UNIT);
        this._pixelRect[1] = (this._origin[1] * PIXELS_PER_UNIT);
        this._pixelRect[2] = ((this._origin[0] + hitbox[2]) * PIXELS_PER_UNIT);
        this._pixelRect[3] = ((this._origin[1] + hitbox[3]) * PIXELS_PER_UNIT);
      }
    } else {
      if (this.currentFrame) {
        this._pixelRect[0] = (this._origin[0] * PIXELS_PER_UNIT - this.currentFrame._originPixels[0])|0;
        this._pixelRect[1] = (this._origin[1] * PIXELS_PER_UNIT - this.currentFrame._originPixels[1])|0;
        this._pixelRect[2] = this._pixelRect[0] + this.currentFrame._sizePixels[0];
        this._pixelRect[3] = this._pixelRect[1] + this.currentFrame._sizePixels[1];
      } else {
        const hitbox = this.hitbox;
        this._pixelRect[0] = (this._origin[0] * PIXELS_PER_UNIT)|0;
        this._pixelRect[1] = (this._origin[1] * PIXELS_PER_UNIT)|0;
        this._pixelRect[2] = ((this._origin[0] + hitbox[2]) * PIXELS_PER_UNIT)|0;
        this._pixelRect[3] = ((this._origin[1] + hitbox[3]) * PIXELS_PER_UNIT)|0;
      }
    }
    return this._pixelRect;
  }

  get isOneShotPlaying() {
    return !!this.oneShotName;
  }

  get currentAnimation() {
    if (this.oneShotName) {
      return this.animations[this.oneShotName];
    }
    return this.animations[this.currentAnimationName];
  }

  setAnimation(name, play = true) {
    if (this.currentAnimationName !== name) {
      this.currentAnimationName = name;
      if (!this.oneShotName) {
        this.animationTime = 0;
        this.currentFrame = this.currentAnimation.frameAt(0);
      }
    }
    this.isAnimating = play;
  }

  playOneShot(name) {
    this.oneShotName = name;
    this.animationTime = 0;
  }

  internalUpdate(scene, ms) {
    if (this.isAnimating || this.oneShotName) {
      let animation = this.currentAnimation;
      this.animationTime += ms;
      while (this.animationTime >= animation.duration) {
        if (this.oneShotName) {
          this.oneShotName = null;
          this.animationTime = 0;
          animation = this.currentAnimation;
        } else {
          this.animationTime -= animation.duration;
        }
      }
      this.currentFrame = animation.frameAt(this.animationTime);
    }
    this._lastOrigin.set(this._origin);
    this._moved = false;
    this._sweepCollisions = false;
    this.update(scene, ms);
  }

  // eslint-disable-next-line no-unused-vars
  update(scene, ms) {
    // By default, sprites have no update behavior.
    // Subclasses should override this.
  }

  // eslint-disable-next-line no-unused-vars
  start(scene) {
    // By default, sprites have no start behavior.
    // Subclasses may override this.
  }

  /*
  lateUpdate(scene) {
    // By default, sprites have no late update behavior.
    // Subclasses may override this.
    // Note that moving colliders during lateUpdate may cause unpredictable behavior.
  }

  onCollisionEnter(other) {
    // By default, sprites have no collision behavior.
    // Subclasses may override this.
  }

  onCollisionStay(other) {
    // By default, sprites have no collision behavior.
    // Subclasses may override this.
  }

  onCollisionExit(other) {
    // By default, sprites have no collision behavior.
    // Subclasses may override this.
  }
  */

  render(camera) {
    if (this.hidden) return;
    const frame = this.currentFrame;
    if (frame && frame.imageData) {
      const x = (this._origin[0] * PIXELS_PER_UNIT - frame._originPixels[0]);
      const y = (this._origin[1] * PIXELS_PER_UNIT - frame._originPixels[1]);
      camera.layers[this.layer].drawImage(
        frame.imageData,
        frame.imageBounds[0],
        frame.imageBounds[1],
        frame.imageBounds[2],
        frame.imageBounds[3],
        CONFIG.smoothing ? x : x|0,
        CONFIG.smoothing ? y : y|0,
        frame.imageBounds[2],
        frame.imageBounds[3],
      );
      if (CONFIG.debug) drawDebugHitbox.call(this, camera);
    }
  }

  computeCollision(other, fast) {
    if (other.isTileMap) {
      // TileMap-Sprite collisions should be handled by TileMap's code, so delegate the calculation.
      return other.computeCollision(this, fast);
    }

    const cc = Sprite._collisionCache;
    let slope;
    if (!fast) {
      cc.velocities[0].set(this._velocity);
      cc.speeds[0] = this._velocity.magnitude;

      cc.velocities[1].set(other._velocity);
      cc.speeds[1] = other._velocity.magnitude;

      cc.velocity[0] = this._velocity[0] - other._velocity[0];
      cc.velocity[1] = this._velocity[1] - other._velocity[1];
      cc.speed = cc.velocity.magnitude;

      if (cc.speed) {
        slope = cc.velocity[1] / cc.velocity[0];
      } else {
        const dx = this._origin[0] - other._origin[0];
        if (dx) {
          slope = (this._origin[1] - other._origin[1]) / dx;
        } else {
          slope = 0;
        }
      }
    }

    const hitboxes = this.hitboxes;
    const otherHitboxes = other.hitboxes;
    const len = hitboxes.length;
    const otherLen = otherHitboxes.length;
    const hitbox = Sprite._tempRect1;
    const otherHitbox = Sprite._tempRect2;

    let hMag = 0, vMag = 0, penX, penY, penSquared, minPenSquared = Infinity;
    let hMag1, hMag2, vMag1, vMag2, i, j;
    for (i = 0; i < len; ++i) {
      hitboxes[i].translateInto(hitbox, this._origin);
      hitbox.bits = hitboxes[i].bits;
      for (j = 0; j < otherLen; ++j) {
        otherHitboxes[j].translateInto(otherHitbox, other._origin);
        otherHitbox.bits = otherHitboxes[j].bits;
        if (!hitbox.intersects(otherHitbox)) {
          continue;
        }

        if (fast || this.isTrigger || other.isTrigger) return true;

        hMag1 = hitbox[2] - otherHitbox[0];
        hMag2 = otherHitbox[2] - hitbox[0];
        hMag = hMag1*hMag1 < hMag2*hMag2 ? hMag1 : hMag2;
        vMag1 = hitbox[3] - otherHitbox[1];
        vMag2 = otherHitbox[3] - hitbox[1];
        vMag = vMag1*vMag1 < vMag2*vMag2 ? vMag1 : vMag2;

        if (hMag * hMag <= vMag * vMag || !slope) {
          penX = hMag;
          penY = penX * slope;
        } else {
          penY = vMag;
          penX = penY / slope;
        }
        penSquared = (penX * penX) + (penY * penY);

        if (minPenSquared > penSquared) {
          cc.penetration[0] = penX;
          cc.penetration[1] = penY;
          cc.hitboxes[0] = hitboxes[i];
          cc.hitboxes[1] = otherHitboxes[j];
          minPenSquared = penSquared;
          const magCompare = hMag > vMag ? hMag - vMag : vMag - hMag;
          if (magCompare < 0.01) {
            // TODO: Figure out a better way to scale this ambiguous corner calculation
            cc.normal[0] = (hitbox[0] + hitbox[2]) > (otherHitbox[0] + otherHitbox[2]) ? 1 : -1;
            cc.normal[1] = (hitbox[1] + hitbox[3]) > (otherHitbox[1] + otherHitbox[3]) ? 1 : -1;
            cc.normal.normalize();
          } else if (hMag < vMag) {
            cc.normal[0] = cc.velocity[0] > 0 ? -1 : 1;
            cc.normal[1] = 0;
          } else {
            cc.normal[0] = 0;
            cc.normal[1] = cc.velocity[1] > 0 ? -1 : 1;
          }
        }
      }
    }
    return minPenSquared !== Infinity ? cc : false;
  }

  move(dx, dy, sweep = false) {
    // Triggers don't need to mark themselves as moving
    if (!this.isTrigger) {
      this._moved = true;
      this._sweepCollisions = this._sweepCollisions || sweep;
    }
    this._origin[0] += dx;
    this._origin[1] += dy;
  }
}

// Pre-allocated storage for computations to avoid generating garbage
Sprite._tempRect1 = new Hitbox(0, 0, 0, 0);
Sprite._tempRect2 = new Hitbox(0, 0, 0, 0);
Sprite._collisionCache = {
  velocity: new Point(0, 0),
  speed: 0,
  normal: new Point(0, 0),
  penetration: new Point(0, 0),
  contact: [new Point(0, 0), new Point(0, 0)],
  hitboxes: [new Hitbox(0, 0, 0, 0, 0), new Hitbox(0, 0, 0, 0, 0)],
  velocities: [new Point(0, 0), new Point(0, 0)],
  speeds: [0, 0],
  invert: function() {
    this.velocity.invert();
    this.normal.invert();
    this.penetration.invert();

    let t = this.hitboxes[1];
    this.hitboxes[1] = this.hitboxes[0];
    this.hitboxes[0] = t;

    t = this.contact[1];
    this.contact[1] = this.contact[0];
    this.contact[0] = t;

    t = this.speeds[1];
    this.speeds[1] = this.speeds[0];
    this.speeds[0] = t;

    t = this.velocities[1];
    this.velocities[1] = this.velocities[0];
    this.velocities[0] = t;
  },
};

export default Sprite;
