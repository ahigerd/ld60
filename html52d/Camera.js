import { Point, IntPoint, PIXELS_PER_UNIT, UNITS_PER_PIXEL } from './Point.js';
import EventTargetClass from './EventTarget.js';
import Rect from './Rect.js';
import CONFIG from '../config.js';

export const DEG_PER_RAD = 180 / Math.PI;
export const RAD_PER_DEG = Math.PI / 180;

const mouseEvents = {
  mousedown: 'cameramousedown',
  mousemove: 'cameramousemove',
  mouseup: 'cameramouseup',
  wheel: 'camerawheel',
  touchstart: 'cameramousedown',
  touchmove: 'cameramousemove',
  touchend: 'cameramouseup',
};

export class Camera extends EventTargetClass {
  constructor(container, width = null, height = null, layers = 1) {
    super();
    this.container = container;
    this.container.setAttribute('tabindex', '0');
    if (!width) {
      width = container.clientWidth;
    }
    if (!height) {
      height = container.clientHeight;
    }
    this.layers = [];
    this.canvases = [];
    while (layers > 0) {
      const canvas = document.createElement('CANVAS');
      canvas.setAttribute('width', width);
      canvas.setAttribute('height', height);
      canvas.style.zIndex = this.layers.length + 1;
      container.appendChild(canvas);
      const layer = canvas.getContext('2d');
      layer.imageSmoothingEnabled = CONFIG.smoothing || false;
      layer.lineWidth = 1;
      layer.autoClear = true;
      this.canvases.push(canvas);
      this.layers.push(layer);
      --layers;
    }

    this.widthPixels = width;
    this.heightPixels = height;
    this.width = width * UNITS_PER_PIXEL;
    this.height = height * UNITS_PER_PIXEL;
    // The offset factor necessary to put the origin of the coordinate space in the center of the screen.
    this._translate = new Point(this.widthPixels * -0.5, this.heightPixels * -0.5);

    /**
     * @property {Rect} aabb
     * The smallest axis-aligned rectangle (in world units) that encompasses the entire visible camera area after transformation.
     */
    this.aabb = new Rect(0, 0, this.width, this.height);

    // Rotations are computationally expensive and fairly uncommon to use.
    this._rotation = 0;
    // The transformations to be applied to the camera. This is not a true transformation matrix.
    // The elements are in the order: scaleX, skewY, x, skewX, scaleY, y
    this._transform = Float32Array.from([1, 0, 0, 0, 1, 0]);
    // The transformation matrix in screen space with rotations applied. The third row is [0, 0, 1].
    this._transformProcessed = Float32Array.from([1, 0, 0, 0, 1, 0]);
    // Set to true when the camera transformation has been modified.
    this._transformDirty = true;

    // Inverse transformation matrix coefficient cache (see render() for full documentation)
    this._ae_bd = 0;
    this._bf_ce = 0;
    this._cd_af = 0;

    // The smallest axis-aligned rectangle (in screen units) that encompasses the entire visible camera area after transformation.
    // Not using rect because this is better expressed with width and height
    this._aabbPixels = Float32Array.from([0, 0, 0, 0]);
  }

  get scaleX() {
    return this._transform[0];
  }

  get scaleY() {
    return this._transform[4];
  }

  set scaleX(val) {
    this._transform[0] = val;
    this._transformDirty = true;
    this.width = this.widthPixels / val * UNITS_PER_PIXEL;
  }

  set scaleY(val) {
    this._transform[4] = val;
    this._transformDirty = true;
    this.height = this.heightPixels / val * UNITS_PER_PIXEL;
  }

  setScale(val) {
    this._transform[0] = val;
    this._transform[4] = val;
    this.width = this.widthPixels / val * UNITS_PER_PIXEL;
    this.height = this.heightPixels / val * UNITS_PER_PIXEL;
    this._transformDirty = true;
  }

  get rotation() {
    return this._rotation;
  }

  set rotation(val) {
    this._rotation = val;
    this._transformDirty = true;
  }

  get rotationDegrees() {
    return this._rotation * DEG_PER_RAD;
  }

  set rotationDegrees(val) {
    this.rotation = val * RAD_PER_DEG;
    this._transformDirty = true;
  }

  get x() {
    return -this._transform[2];
  }

  set x(val) {
    this._transform[2] = -val;
    this._transformDirty = true;
  }

  get y() {
    return -this._transform[5];
  }

  set y(val) {
    this._transform[5] = -val;
    this._transformDirty = true;
  }

  setXY(x, y) {
    this._transform[2] = -x;
    this._transform[5] = -y;
    this._transformDirty = true;
  }

  get skewX() {
    return this._transform[1];
  }

  set skewX(val) {
    this._transform[1] = val;
    this._transformDirty = true;
  }

  get skewY() {
    return this._transform[3];
  }

  set skewY(val) {
    this._transform[3] = val;
    this._transformDirty = true;
  }

  setSkew(x, y) {
    this._transform[1] = x;
    this._transform[3] = y;
    this._transformDirty = true;
  }

  prepareLayer(layer) {
    if (layer.noTransform) {
      if (layer.autoClear) {
        layer.clearRect(0, 0, this.widthPixels, this.heightPixels);
      }
    } else {
      if (this._transformDirty) {
        layer.setTransform(
          this._transformProcessed[0], this._transformProcessed[3],
          this._transformProcessed[1], this._transformProcessed[4],
          this._transformProcessed[2] | 0, this._transformProcessed[5] | 0,
        );
      }
      if (layer.autoClear) {
        layer.clearRect(this._aabbPixels[0], this._aabbPixels[1], this._aabbPixels[2], this._aabbPixels[3]);
      }
    }
  }

  screenToWorld(x, y) {
    // This is the inverse transformation matrix (see render() for details) multiplied by the point as a vector.
    Camera._pointCache.setXY(
      ((this._bf_ce + x * this._transformProcessed[4] - y * this._transformProcessed[1]) * this._ae_bd) * UNITS_PER_PIXEL,
      ((this._cd_af - x * this._transformProcessed[3] + y * this._transformProcessed[0]) * this._ae_bd) * UNITS_PER_PIXEL,
    );
    return Camera._pointCache;
  }

  worldToScreen(x, y) {
    x *= PIXELS_PER_UNIT;
    y *= PIXELS_PER_UNIT;
    // This is simply the transformation matrix multiplied by the point as a vector.
    Camera._pixelPointCache.setXY(
      x * this._transformProcessed[0] + y * this._transformProcessed[1] + this._transformProcessed[2],
      x * this._transformProcessed[3] + y * this._transformProcessed[4] + this._transformProcessed[5],
    );
    return Camera._pixelPointCache;
  }

  render(scene) {
    // The transformation matrix isn't recomputed unless it's been changed.
    if (this._transformDirty) {
      // Pull out some constants from the matrix to avoid repeated lookups and make the code more readable
      const a = this._transform[0];
      const b = this._transform[1];
      const c = this._transform[2];
      const d = this._transform[3];
      const e = this._transform[4];
      const f = this._transform[5];

      // To achieve the most intuitive effect of the camera parameters, the following transformations must be applied:
      // 1. Apply the scaling factors.
      // 2. Rotate around the origin.
      // 3. Apply the skew factors.
      // 4. Translate the camera location to the origin.
      // 5. Translate the new origin to the center of the screen.
      // This is achieved through a series of matrix multiplications, but since the multiplications always have the same
      // structure, the simplified form of the result is written into the code here.

      // These are some common factors used multiple times in the calculations.
      const cd_f = c*d + f;
      const c_bf = c + b*f;

      if (this._rotation) {
        const cos = Math.cos(this._rotation);
        const sin = Math.sin(this._rotation);
        this._transformProcessed[0] = a*(cos-d*sin);
        this._transformProcessed[1] = a*(b*cos-sin);
        this._transformProcessed[2] = a*PIXELS_PER_UNIT*(c_bf*cos-cd_f*sin) - this._translate[0];
        this._transformProcessed[3] = e*(d*cos+sin);
        this._transformProcessed[4] = e*(cos+b*sin);
        this._transformProcessed[5] = e*PIXELS_PER_UNIT*(cd_f*cos+c_bf*sin) - this._translate[1];
      } else {
        // When no rotation is applied, the above multiplication is not needed, so only the skew factor needs updated.
        this._transformProcessed[0] = a;
        this._transformProcessed[1] = a*b;
        this._transformProcessed[2] = a*PIXELS_PER_UNIT*c_bf - this._translate[0];
        this._transformProcessed[3] = d*e;
        this._transformProcessed[4] = e;
        this._transformProcessed[5] = e*PIXELS_PER_UNIT*cd_f - this._translate[1];
      }

      // In order to convert screen coordinates back into world coordinates, we need to apply the inverse of the transform matrix;
      //        [ a b c      [  e/(ae-bd) -b/(ae-bd) (bf-ce)/(ae-bd)
      // Invert(  d e f  ) =   -d/(ae-bd)  a/(ae-bd) (cd-af)/(ae-bd)
      //          0 0 1 ]       0          0         1               ]
      // For efficiency's sake, the nontrivial terms are cached.
      this._ae_bd = 1/(this._transformProcessed[0] * this._transformProcessed[4] - this._transformProcessed[1] * this._transformProcessed[3]);
      this._bf_ce = this._transformProcessed[1] * this._transformProcessed[5] - this._transformProcessed[2] * this._transformProcessed[4];
      this._cd_af = this._transformProcessed[2] * this._transformProcessed[3] - this._transformProcessed[0] * this._transformProcessed[5];

      // Find the four corners of the transformed canvas
      // (x0, y0) is always (0, 0)
      const x1 = this.widthPixels * this._transformProcessed[4];
      const y1 = -this.widthPixels * this._transformProcessed[3];
      const x2 = -this.heightPixels * this._transformProcessed[1];
      const y2 = this.heightPixels * this._transformProcessed[0];
      const x3 = x1 + x2;
      const y3 = y2 + y1;

      // Find the smallest axis-aligned rectangle that encompasses this non-axis-aligned one.
      let xMin = 0, xMax = 0, yMin = 0, yMax = 0;
      if (x1 < 0) xMin = x1; else xMax = x1;
      if (x2 < xMin) xMin = x2; else if (x2 > xMax) xMax = x2;
      if (x3 < xMin) xMin = x3; else if (x3 > xMax) xMax = x3;
      if (y1 < 0) yMin = y1; else yMax = y1;
      if (y2 < yMin) yMin = y2; else if (y2 > yMax) yMax = y2;
      if (y3 < yMin) yMin = y3; else if (y3 > yMax) yMax = y3;

      // The pixel bounding boxes get padded by 1px on each side to accommodate antialiasing.
      if (this._ae_bd < 0) {
        // Negative coefficient means max and min are flipped
        this._aabbPixels[0] = ((this._bf_ce + xMax) * this._ae_bd - 1);
        this._aabbPixels[1] = ((this._cd_af + yMax) * this._ae_bd - 1);
        this._aabbPixels[2] = ((this._bf_ce + xMin) * this._ae_bd + 2) - this._aabbPixels[0];
        this._aabbPixels[3] = ((this._cd_af + yMin) * this._ae_bd + 2) - this._aabbPixels[1];
      } else {
        this._aabbPixels[0] = ((this._bf_ce + xMin) * this._ae_bd - 1);
        this._aabbPixels[1] = ((this._cd_af + yMin) * this._ae_bd - 1);
        this._aabbPixels[2] = ((this._bf_ce + xMax) * this._ae_bd + 2) - this._aabbPixels[0];
        this._aabbPixels[3] = ((this._cd_af + yMax) * this._ae_bd + 2) - this._aabbPixels[1];
      }
      this.aabb.setXySize(
        this._aabbPixels[0] * UNITS_PER_PIXEL,
        this._aabbPixels[1] * UNITS_PER_PIXEL,
        this._aabbPixels[2] * UNITS_PER_PIXEL,
        this._aabbPixels[3] * UNITS_PER_PIXEL,
      );
    }
    for(let i = 0; i < this.layers.length; i++) {
      this.prepareLayer(this.layers[i]);
    }
    this._transformDirty = false;
    scene.render(this);
  }

  addEventListener(type, listener, options) {
    if (!this._useMouse) {
      this._initMouse();
    }
    super.addEventListener(type, listener, options);
  }

  _initMouse() {
    this._useMouse = true;
    this._onMouseEvent = this._onMouseEvent.bind(this);
    this._onTouchEvent = this._onTouchEvent.bind(this);
    this.container.addEventListener('mousedown', this._onMouseEvent);
    this.container.addEventListener('mousemove', this._onMouseEvent);
    this.container.addEventListener('mouseup', this._onMouseEvent);
    this.container.addEventListener('wheel', this._onMouseEvent);
    this.container.addEventListener('touchstart', this._onTouchEvent);
    this.container.addEventListener('touchmove', this._onTouchEvent);
    this.container.addEventListener('touchend', this._onTouchEvent);
    this.container.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onTouchEvent(event) {
    event.preventDefault();
    const rect = this.container.getClientRects()[0];
    const touchCount = event.touches.length;
    for (const touch of event.changedTouches) {
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;
      this._translateMouseEvent(event, offsetX, offsetY, touch.identifier, touchCount);
    }
  }

  _onMouseEvent(event) {
    event.preventDefault();
    this._translateMouseEvent(event, event.offsetX, event.offsetY);
  }

  _translateMouseEvent(event, offsetX, offsetY, touch, touchCount = -1) {
    const x = offsetX / this.container.offsetWidth * this.widthPixels;
    const y = offsetY / this.container.offsetHeight * this.heightPixels;
    const worldX = ((this._bf_ce + x * this._transformProcessed[4] - y * this._transformProcessed[1]) * this._ae_bd) * UNITS_PER_PIXEL;
    const worldY = ((this._cd_af - x * this._transformProcessed[3] + y * this._transformProcessed[0]) * this._ae_bd) * UNITS_PER_PIXEL;
    const detail = {
      type: event.type,
      x,
      y,
      worldX,
      worldY,
      offsetX,
      offsetY,
      touch,
      button: touchCount >= 0 ? touchCount : event.button,
      buttons: touchCount >= 0 ? (1 << touchCount) - 1 : event.buttons,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
    };
    this.dispatchEvent(mouseEvents[event.type], detail);
  }
}

Camera._pointCache = new Point(0,0);
Camera._pixelPointCache = new IntPoint(0,0);

export default Camera;
