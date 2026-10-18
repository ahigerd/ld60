/*
import Inventory, { InventoryUI } from './Inventory.js';
import Station from './Station.js';
import Computer from './Computer.js';
*/
import ThinUI from './thinui.js';

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

/*
window.setTimeout(() => {
  ui.computer.show();
  ui.stationBox.show();
}, 1000);
*/

/*
const inventoryUI = new InventoryUI();
ui.inventoryUI = inventoryUI;
inventoryUI.inventory = inventory;
inventoryUI.appendTo(ui.inventoryBox);

inventory.addEventListener('updated', event => {
  ui.chemStation.onInventoryUpdate(event.detail)
  ui.workStation.onInventoryUpdate(event.detail)
  ui.refineStation.onInventoryUpdate(event.detail)
  ui.oxygen.root.innerText = inventory.contents['O2'] || 0;
  inventoryUI.update();
});
*/

export default ui;
