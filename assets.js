import assetlist from './assetlist.js';
import AssetStore from './html52d/AssetStore.js';

const assets = window.assets = new AssetStore(assetlist);
export default assets;
