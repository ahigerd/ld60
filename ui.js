import ThinUI from './thinui.js';
import Gauge from './assets/gauge.js';
import assets from './assets.js';

class SvgAsset extends ThinUI.ThinUIComponent {
  constructor(props, root = null) {
    super(props, root);
    assets.data[props.asset].then(this._setSvg.bind(this));
    const host = document.createElement('DIV');
    this.root.appendChild(host);
    this.shadow = host.attachShadow({ mode: 'open' });
    this.shadow.appendChild(document.querySelector('link').cloneNode());
  }

  _setSvg(svg) {
    const parser = new DOMParser();
    const el = parser.parseFromString(svg, "image/svg+xml").documentElement;
    this.shadow.appendChild(el);
  }
}
ThinUI.register(SvgAsset);

const ui = ThinUI.init(document.body);
window.ui = ui;

export default ui;
