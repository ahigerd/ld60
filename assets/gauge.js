import ThinUI from '../thinui.js';

export default class Gauge extends ThinUI.ThinUIComponent {
  constructor(props, root = null) {
    super(props, root);
    root.setAttribute('width', 200);
    root.setAttribute('height', 200);
    this.ctx = root.getContext('2d');
    this.min = 0;
    this.max = 100;
    this.value = 0;

    this.ctx.font = 'bold 20px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.label = props.label;
  }

  render() {
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 4.0;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.ellipse(100, 100, 85, 85, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    const t0 = Math.PI / 28;
    const t1 = 30 * Math.PI / -28 + Math.PI / 28;
    this.ctx.lineWidth = 7;
    this.ctx.strokeStyle = '#ff8080';
    this.ctx.beginPath();
    this.ctx.ellipse(100, 100, 64, 64, 0, (t1 + t0) * 0.3125, t0);
    this.ctx.stroke();

    this.ctx.fillStyle = '#404040';
    this.ctx.fillText(this.label, 100, 125, 125);

    this.ctx.lineWidth = 2.0;
    this.ctx.strokeStyle = '#000000';
    this.ctx.beginPath();
    for (let i = 0; i < 31; i++) {
      const theta = i * Math.PI / -28 + Math.PI / 28;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      this.ctx.moveTo(100 + dx * 60, 100 + dy * 60);
      if (i % 5 == 0)
        this.ctx.lineTo(100 + dx * 76, 100 + dy * 76);
      else
        this.ctx.lineTo(100 + dx * 68, 100 + dy * 68);
    }
    this.ctx.stroke();

    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    this.ctx.ellipse(100, 100, 68, 68, 0, t1, t0);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.ellipse(100, 100, 60, 60, 0, t1, t0);
    this.ctx.stroke();

    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.ellipse(100, 100, 8, 8, 0, 0, Math.PI * 2);
    this.ctx.fill();

    const t = (t0 - t1) * (this.value - this.min) / (this.max - this.min) + t1;
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    const dx2 = Math.cos(t + Math.PI * 135 / 180);
    const dy2 = Math.sin(t + Math.PI * 135 / 180);
    const dx3 = Math.cos(t - Math.PI * 135 / 180);
    const dy3 = Math.sin(t - Math.PI * 135 / 180);
    const tailx = 100 - dx * 45;
    const taily = 100 - dy * 45;
    const tipx = 100 + dx * 50;
    const tipy = 100 + dy * 50;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(tailx, taily);
    this.ctx.lineTo(tailx + dx2 * 8, taily + dy2 * 8);
    this.ctx.moveTo(tailx, taily);
    this.ctx.lineTo(tailx + dx3 * 8, taily + dy3 * 8);
    this.ctx.lineTo(tailx, taily);
    this.ctx.lineTo(tipx, tipy);
    this.ctx.lineTo(tipx + dx2 * 8, tipy + dy2 * 8);
    this.ctx.moveTo(tipx, tipy);
    this.ctx.lineTo(tipx + dx3 * 8, tipy + dy3 * 8);
    this.ctx.lineTo(tipx, tipy);
    this.ctx.stroke();
  }
}

ThinUI.register(Gauge);
