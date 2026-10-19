import Sprite from '../html52d/Sprite.js';
import Point from '../html52d/Point.js';
import Rect from '../html52d/Rect.js';
import ui from '../ui.js';
import CONFIG from '../config.js';
import assets from '../assets.js';

let brain = null;
assets.require('assets/brain.js').then(([m]) => brain = m);

const SCALE = 80;
const WIDTH = CONFIG.width * 6 / SCALE;

export const State = {
  Standing: 0,
  Walking: 1,
  Running: 2,
};

const Speeds = {
  [State.Standing]: 0,
  [State.Walking]: 0.001,
  [State.Running]: 0.005,
}

class Cloud
{
  constructor(origin)
  {
    this.origin = origin;
    const c = 260 - Math.sqrt(Math.random()) * 20;
    this.circles = [{ x: 0, y: 0, rx: Math.random() + 1, ry: Math.random() * 0.5 + 0.5, c }];
    this.minX = -this.circles[0].rx;
    this.maxX = this.circles[0].rx;
    const numCircles = 12;
    for (let i = 0; i < 12; i++) {
      let ok = false;
      let retry = 0;
      const theta = Math.random() * Math.PI / numCircles * (i + 1);
      let x = Math.cos(theta) * this.circles[0].rx;
      let y = Math.sin(theta) * this.circles[0].ry;
      const ry = Math.max(0.25, this.circles[0].ry * .5 * (Math.random() + 0.5));
      const rx = ry + this.circles[0].rx * .5 * (Math.random() + 0.5);
      this.circles.push({x, y, rx, ry, c});
      this.minX = Math.min(this.minX, x - rx);
      this.maxX = Math.max(this.maxX, x + rx);
    }
    this.circles.sort((l, r) => r.y - l.y);
  }

  render(layer)
  {
    layer.strokeStyle = '#606060';
    layer.lineWidth = 6;
    layer.beginPath();
    for (const circle of this.circles) {
      layer.ellipse(SCALE * (circle.x + this.origin.x), SCALE * (circle.y + this.origin.y), SCALE * circle.rx, SCALE * circle.ry, 0, 0, Math.PI * 2);
      layer.moveTo(SCALE * this.origin.x, SCALE * this.origin.y);
    }
    layer.stroke();
    for (const circle of this.circles) {
      const c = circle.c - (circle.y) * 48;
      layer.fillStyle = 'rgb(' + (c * 0.92) + ',' + (c * 0.94) + ',' + c + ')';
      layer.beginPath();
      layer.ellipse(SCALE * (circle.x + this.origin.x), SCALE * (circle.y + this.origin.y), SCALE * circle.rx, SCALE * circle.ry, 0, 0, Math.PI * 2);
      layer.fill();
    }
  }
}

class Building
{
  constructor(origin, bg)
  {
    this.origin = origin;
    this.width = Math.floor((Math.random() * 2 + 2) * (bg ? 1 : 1.5));
    this.height = Math.floor(Math.random() * 3) + (bg ? 3 : 0.5);
    let r = Math.random() * 64;
    let g = Math.random() * r;
    let b = Math.random() * r;
    if (!bg) {
      r += 64;
      g += 64;
      b += 64;
    }
    this.color = `rgb(${r},${g},${b})`;
  }

  render(layer)
  {
    layer.strokeStyle = 'black';
    layer.fillStyle = this.color;
    layer.lineWidth = 6;
    layer.fillRect((SCALE * this.origin.x) | 0, (SCALE * (this.origin.y - this.height)) | 0, (SCALE * this.width)|0, (SCALE * this.height)|0);
    layer.strokeRect((SCALE * this.origin.x) | 0, (SCALE * (this.origin.y - this.height)) | 0, (SCALE * this.width)|0, (SCALE * this.height)|0);
  }
}

class MechaComponent
{
  constructor(parent, origin, bounds, rotation = 0)
  {
    this.parent = parent;
    this.origin = origin,
    this._realOrigin = new Point(0, 0);
    this.bounds = bounds;
    this.rotation = rotation / 180 * Math.PI;
  }

  calcOrigin()
  {
    this._realOrigin.set(this.origin);
    let child = this;
    let parent = this.parent;
    this._totalRotation = this.rotation;
    while (parent) {
      this._totalRotation += parent.rotation;
      const x = this._realOrigin.x * Math.cos(parent.rotation) - this._realOrigin.y * Math.sin(parent.rotation);
      const y = this._realOrigin.x * Math.sin(parent.rotation) + this._realOrigin.y * Math.cos(parent.rotation);
      this._realOrigin.setXY(x, y);
      this._realOrigin.add(parent.origin);
      child = parent;
      parent = parent.parent;
    }
    return this._realOrigin;
  }

  render(layer)
  {
    const origin = this.calcOrigin();
    let r = this.bounds.width * 0.5;
    const b = this.bounds;
    const x = [b.x1,     b.x1, b.x2, b.x2,     b.x2,     b.x2, b.x1, b.x1];
    const y = [b.y1 + r, b.y1, b.y1, b.y1 + r, b.y2 - r, b.y2, b.y2, b.y2 - r];
    for (let i = 0; i < x.length; i++) {
      const rx = x[i] * Math.cos(this._totalRotation) - y[i] * Math.sin(this._totalRotation);
      const ry = x[i] * Math.sin(this._totalRotation) + y[i] * Math.cos(this._totalRotation);
      x[i] = (rx + origin.x) * SCALE;
      y[i] = (ry + origin.y) * SCALE;
    }
    r *= SCALE;
    layer.strokeStyle = 'black';
    layer.lineWidth = 6;
    layer.fillStyle = '#c0c0c0';
    layer.beginPath();
    layer.moveTo(x[0], y[0]);
    layer.arcTo(x[1], y[1], x[2], y[2], r);
    layer.arcTo(x[2], y[2], x[3], y[3], r);
    layer.lineTo(x[4], y[4]);
    layer.arcTo(x[5], y[5], x[6], y[6], r);
    layer.arcTo(x[6], y[6], x[7], y[7], r);
    layer.closePath();
    layer.fill();
    layer.stroke();
  }
}

const prefab = {
  layer: 1,
  noTransform: true,
};

export default class Progress extends Sprite
{
  constructor()
  {
    super(prefab, new Point(0, 0));
    window.Progress = this;
    this.body = new MechaComponent(null, new Point(1, 2), new Rect(-.75, -.75, .75, 2));
    this.head = new MechaComponent(this.body, new Point(0, -1), new Rect(-.6, -.6, .6, .6));
    this.rightArm1 = new MechaComponent(this.body, new Point(0, 0), new Rect(-.25, -.25, .25, 1.25));
    this.rightArm2 = new MechaComponent(this.rightArm1, new Point(0, 1), new Rect(-.25, -.25, .25, 1.25));
    this.leftArm1 = new MechaComponent(this.body, new Point(0, 0), new Rect(-.25, -.25, .25, 1.25));
    this.leftArm2 = new MechaComponent(this.leftArm1, new Point(0, 1), new Rect(-.25, -.25, .25, 1.25));
    this.rightLeg1 = new MechaComponent(this.body, new Point(0, 1.5), new Rect(-.5, -.5, .5, 1));
    this.rightLeg2 = new MechaComponent(this.rightLeg1, new Point(0, 0.55), new Rect(-.4, -.5, .4, 1.75));
    this.rightFoot = new MechaComponent(this.rightLeg2, new Point(-.25, 1.75), new Rect(-.25, -.25, .25, 1.5), -90);
    this.leftLeg1 = new MechaComponent(this.body, new Point(0, 1.5), new Rect(-.5, -.5, .5, 1));
    this.leftLeg2 = new MechaComponent(this.leftLeg1, new Point(0, 0.55), new Rect(-.4, -.5, .4, 1.75));
    this.leftFoot = new MechaComponent(this.leftLeg2, new Point(-.25, 1.75), new Rect(-.25, -.25, .25, 1.5), -90);

    this.clouds = [];
    let x = 0;
    while (x < WIDTH + SCALE * 4) {
      const cloud = new Cloud(new Point(x, Math.sqrt(Math.random() * 6) + 0.25));
      this.clouds.push(cloud);
      x += cloud.maxX + Math.random() * (cloud.maxX + 1);
    }

    this.bgBuildings = [];
    x = 0;
    while (x < WIDTH + SCALE * 4) {
      const building = new Building(new Point(x, 6), true);
      this.bgBuildings.push(building);
      x += building.width + 0.25 + Math.floor(Math.random() * 2);
    }

    this.fgBuildings = [];
    x = -SCALE * 4;
    while (x < WIDTH) {
      const building = new Building(new Point(x, 6), false);
      this.fgBuildings.push(building);
      x += building.width + 0.25 + Math.floor(Math.random() * 2);
    }

    this.parts = [this.leftLeg2, this.leftLeg1, this.leftFoot, this.leftArm2, this.leftArm1, this.body, this.head, this.rightLeg2, this.rightLeg1, this.rightFoot, this.rightArm2, this.rightArm1];
    const timeGroup = [{ render: this.renderTime.bind(this) }];
    this.renderGroups = [this.clouds, timeGroup, this.bgBuildings, this.parts, this.fgBuildings, timeGroup];

    this.updateAnims = {};
    for (const key in State) {
      this.updateAnims[State[key]] = this["update" + key].bind(this);
    };
    this._storedRotation = {};
    this.speed = 0;
    this.timeOfDay = 0;
    this.lengthOfDay = 120000;
    this.reversing = false;
    this.reverseTick = 0;
    this.walkAccel = 0;
    this.setAnimState(State.Walking);
  }

  setAnimState(state, preserveTimer = false)
  {
    this.state = state;
    this.targetSpeed = Speeds[state];
    if (!preserveTimer)
      this._timer = 0;
    this.strides = 0;
    for (const partKey in this.parts)
      this._storedRotation[partKey] = this.parts[partKey].rotation;
  }

  updateStanding(ms)
  {
    this._timer += ms;
    let step = 0;
    if (this._timer < 300) {
      step = Math.pow(0.995, ms);
    } else if (this._timer < 700) {
      step = Math.pow(0.99, ms);
    }
    this.body.origin.y = 2;
    for (const part of this.parts) {
      if (part == this.leftFoot || part == this.rightFoot) {
        part.rotation = (part.rotation - Math.PI * -0.5) * step + Math.PI * -0.5;
      } else {
        part.rotation *= step;
      }
    }
  }

  updateRunning(ms)
  {
    this._timer += ms * 0.01;
    if (this._timer > Math.PI * 2) {
      this._timer -= Math.PI * 2;
      this.strides++;
    }
    this.body.origin.y = Math.cos(this._timer * 2) * 0.1 + 2;
    this.rightArm1.rotation = Math.sin(this._timer) * Math.PI * 0.25 + Math.PI * 0.15;
    this.rightArm2.rotation = Math.sin(this._timer) * Math.PI * 0.25 + Math.PI * -0.5;
    this.leftArm1.rotation = Math.sin(this._timer + Math.PI) * Math.PI * 0.25 + Math.PI * 0.15;
    this.leftArm2.rotation = Math.sin(this._timer + Math.PI) * Math.PI * 0.25 + Math.PI * -0.5;
    this.rightLeg1.rotation = Math.sin(this._timer) * Math.PI * -0.25 + Math.PI * -0.25;
    this.rightLeg2.rotation = Math.cos(this._timer) * Math.PI * 0.25 + Math.PI * 0.5;
    this.rightFoot.rotation = this.rightLeg1.rotation * 0.5 + Math.PI * -0.5;
    this.leftLeg1.rotation = Math.sin(this._timer + Math.PI) * Math.PI * -0.25 + Math.PI * -0.25;
    this.leftLeg2.rotation = Math.cos(this._timer + Math.PI) * Math.PI * 0.25 + Math.PI * 0.5;
    this.leftFoot.rotation = this.leftLeg1.rotation * 0.5 + Math.PI * -0.5;
    if (this.strides < 1) {
      let t = this._timer / (Math.PI * 2);
      for (const partKey in this.parts) {
        this.parts[partKey].rotation = (this.parts[partKey].rotation * t) + (this._storedRotation[partKey] * (1.0 - t));
      }
    }
  }

  updateWalking(ms)
  {
    if (this.reversing) {
      this.reversing -= ms;
      if (this.reversing < 0) {
        this.reversing = false;
      }
      this._timer -= ms * 0.01;
    } else {
      this._timer += ms * 0.005;
    }

    if (brain && brain.brainDamage()) {
      if (this.reverseTick <= 0) {
        // TODO: sfx
        this.reversing = 125;
        this.reverseTick = 250 + Math.random() * 250;
      } else {
        this.reverseTick -= ms;
      }
    }

    if (this._timer > Math.PI * 2) {
      this._timer -= Math.PI * 2;
      this.strides++;
    }
    this.body.origin.y = Math.cos(this._timer * 2) * 0.1 + 2;
    this.rightArm1.rotation = Math.sin(this._timer) * Math.PI * 0.25 + Math.PI * 0.15;
    this.rightArm2.rotation = Math.sin(this._timer) * Math.PI * 0.25 + Math.PI * -0.5;
    this.leftArm1.rotation = Math.sin(this._timer + Math.PI) * Math.PI * 0.25 + Math.PI * 0.15;
    this.leftArm2.rotation = Math.sin(this._timer + Math.PI) * Math.PI * 0.25 + Math.PI * -0.5;
    this.rightLeg1.rotation = Math.sin(this._timer) * Math.PI * -0.25 + Math.PI * -0.15;
    this.rightLeg2.rotation = Math.cos(this._timer) * Math.PI * 0.25 + Math.PI * 0.5;
    this.rightFoot.rotation = this.rightLeg1.rotation * 0.5 + Math.PI * -0.75;
    this.leftLeg1.rotation = Math.sin(this._timer + Math.PI) * Math.PI * -0.25 + Math.PI * -0.15;
    this.leftLeg2.rotation = Math.cos(this._timer + Math.PI) * Math.PI * 0.25 + Math.PI * 0.5;
    this.leftFoot.rotation = this.leftLeg1.rotation * 0.5 + Math.PI * -0.75;
    for (const part of this.parts) {
      if (part == this.leftFoot || part == this.rightFoot) {
        part.rotation = (part.rotation - Math.PI * -0.5) * 0.25 + Math.PI * -0.5;
      } else {
        part.rotation *= 0.25;
      }
    }
  }

  update(scene, ms)
  {
    this.timeOfDay += ms;
    if (this.timeOfDay > this.lengthOfDay) {
      GameManager.gameOver();
      return;
    }

    this.stateTimer = (this.stateTimer || 0) + ms;
    if (this.speed < this.targetSpeed) {
      this.speed = Math.min(this.targetSpeed, this.speed + ms * 0.000005);
    } else if (this.speed > this.targetSpeed) {
      this.speed = Math.max(this.targetSpeed, this.speed - ms * 0.000005);
    }
    if (this.speed == 0)
      return;
    this.body.origin.x += this.speed * ms * (this.reversing > 0 ? -0.1 : 0.5);
    if (this.state == State.Running && brain && brain.brainDamage()) {
      this.setAnimState(State.Walking);
      this.walkAccel = 0;
    } else if (this.state == State.Walking && !(brain && brain.brainDamage())) {
      this.walkAccel += ms;
      if (this.walkAccel >= 5000) {
        this.setAnimState(State.Running);
      }
    }
    this.updateAnims[this.state](ms);
    for (const cloud of this.clouds) {
      cloud.origin.x -= this.speed * ms * 0.25;
    }
    if (this.clouds[0].origin.x + this.clouds[0].maxX < 0) {
      this.clouds.splice(0, 1);
      const last = this.clouds[this.clouds.length - 1];
      let x = last.origin.x + last.maxX + Math.random() * (last.maxX + 1);
      if (x < WIDTH)
        x = WIDTH;
      const cloud = new Cloud(new Point(x, Math.sqrt(Math.random() * 6) + 0.25));
      this.clouds.push(cloud);
    }

    for (const building of this.bgBuildings) {
      building.origin.x -= this.speed * ms * 0.35;
    }

    for (const building of this.fgBuildings) {
      building.origin.x += this.speed * ms * 0.75;
    }
    if (this.fgBuildings[this.fgBuildings.length - 1].origin.x > WIDTH) {
      this.fgBuildings.pop();
      const building = new Building(new Point(this.fgBuildings[0].origin.x, 6), false);
      building.origin.x -= building.width + 0.25 + Math.floor(Math.random() * 2);
      this.fgBuildings.splice(0, 0, building);
    }
  }

  renderTime(layer)
  {
    let time = this.timeOfDay / this.lengthOfDay;
    let r, g, b;
    let a = time * 0.125;
    if (time < 0.5) {
      time *= 2;
      r = 255;
      g = 255;
      b = 128;
    } else if (time < 0.75) {
      time -= 0.5;
      time *= 4;
      r = 255 * (1.0 - time * 0.25);
      g = 255 * (1.0 - time);
      b = 128 * (1.0 - time);
    } else {
      time -= 0.75;
      a += time;
      if (a > 0.75)
        a = 0.75;
      time *= 4;
      if (time > 1) time = 1;
      r = 191 * (1.0 - time);
      g = 0;
      b = 32 * time;
    }
    layer.fillStyle = `rgba(${r|0},${g|0},${b|0},${a})`;
    layer.fillRect(1, 1, CONFIG.widthPx - 2, 6 * SCALE);
  }

  render(camera)
  {
    const layer = camera.layers[this.layer];

    layer.strokeStyle = 'red';
    layer.fillStyle = '#80b0e0';
    layer.beginPath();
    layer.rect(1, 1, CONFIG.widthPx - 2, 6 * SCALE);
    layer.fill();
    layer.clip();

    for (const group of this.renderGroups) {
      for (const part of group) {
        part.render(layer);
      }
    }

    layer.strokeStyle = 'black';
    layer.beginPath();
    layer.rect(1, 1, CONFIG.widthPx - 2, 6 * SCALE);
    layer.stroke();
  }
}
