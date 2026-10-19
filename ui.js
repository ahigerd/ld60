import ThinUI from './thinui.js';
import assets from './assets.js';

class SvgAsset extends ThinUI.ThinUIComponent {
  constructor(props, root = null) {
    super(props, root);
    assets.data[props.asset].then(this._setSvg.bind(this));
  }

  _setSvg(svg) {
    const parser = new DOMParser();
    const el = parser.parseFromString(svg, "image/svg+xml").documentElement;
    this.root.appendChild(el);
  }
}
ThinUI.register(SvgAsset);

const ui = ThinUI.init(document.body);
window.ui = ui;

/*
export const inventory = new Inventory();

ui.chemStation = new Station({ name: 'Chemistry' });
ui.chemStation.hide();

ui.workStation = new Station({ name: 'Workbench' });
ui.workStation.hide();

ui.refineStation = new Station({ name: 'Refining' });
ui.refineStation.hide();

ui.computer = new Computer();
//ui.computer.appendTo(ui.stationBox);
ui.computer.hide();
*/

export default ui;
