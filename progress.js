import Sprite from './html52d/Sprite.js';
import Point from './html52d/Point.js';
import Rect from './html52d/Rect.js';
import ui from './ui.js';

class MechaComponent
{
  constructor(parent, bounds, rotation = 0)
  {
    this.parent = parent;
    this.bounds = bounds;
    this.rotation = rotation;
  }

  render(layer)
  {
    const
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
   // const body = MechaComponent(null, new Rect(
  }

  render(camera)
  {
    const layer = camera.layers[this.layer];
    layer.strokeStyle = 'black';
    layer.fillStyle = 'white';
    layer.beginPath();
    layer.rect(0, 0, 638, 100);
    layer.fill();
    layer.stroke();
  }
}
