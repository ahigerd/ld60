import Sprite from './Sprite.js';
import EventTargetClass from './EventTarget.js';
import AudioClip from './AudioClip.js';

// eslint refuses to accept import() syntax even though everybody supports it.
// In order to avoid dragging in all of Babel just to deal with that problem,
// wrap the special syntactic form. This WOULD normally make Webpack's code
// splitting not work, but this file in particular is only doing fully-dynamic
// imports so it's not a problem here.
//
// If a developer ever wants to use import() in their own code, they'll have
// to configure eslint themselves, unfortunately. However, an html52d-based
// project will probably never contain enough code to need more code splitting
// than what is offered by default, unless it's pulling in large dependencies.
// And if it's pulling in large dependencies, it's already committed to using
// a bigger ecosystem, so such a project will probably already have the tools
// it needs.
const _import = new Function('path', 'return import(path)');

function urlToModule(url) {
  if (url.startsWith('.')) {
    return url;
  } else {
    return "../" + url;
  }
}

function objectIsEmpty(obj) {
  if (!obj) {
    return true;
  }
  for (const key in obj) {
    return false;
  }
  return true;
}

function makePrefabClass(config) {
  if (typeof config === 'function') {
    // If the config is a callable, assume it's a constructor.
    return config;
  }
  const prefab = Sprite.prepareConfig(config, false);
  return class extends Sprite {
    constructor(origin) {
      super(prefab, origin);
    }
  };
}

export class AssetStore extends EventTargetClass {
  constructor(assetlist) {
    super();
    this.images = {};
    this.prefabs = {};
    this.data = {};
    this.modules = {};
    this.sounds = {};
    this.pendingKeys = new Set();
    this.loadComplete = 0;
    if (
      !assetlist || (
        objectIsEmpty(assetlist.require) &&
        objectIsEmpty(assetlist.images) &&
        objectIsEmpty(assetlist.sounds) &&
        objectIsEmpty(assetlist.data) &&
        objectIsEmpty(assetlist.prefabs)
      )
    ) {
      setTimeout(() => this.dispatchEvent(new UIEvent('loadcomplete')), 0);
    } else {
      this.load(assetlist);
    }
  }

  get loadProgress() {
    return this.loadComplete / (this.loadComplete + this.pendingKeys.size);
  }

  _startLoading(key, collection) {
    const combined_key = collection ? collection + '_' + key : key;
    this.pendingKeys.add(combined_key);
    this.dispatchEvent('loadprogress', this.loadProgress);
  }

  _bindDoneLoading(key, collection) {
    return (value) => {
      this.pendingKeys.delete(collection ? collection + '_' + key : key);
      this.loadComplete++;
      this.dispatchEvent('loadprogress', this.loadProgress);
      if (collection) {
        this[collection][key] = value;
      }
      if (this.pendingKeys.size === 0) {
        // If nothing remains to be loaded, wait for the event loop and then fire the load event.
        setTimeout(() => this.dispatchEvent(new UIEvent('loadcomplete')), 0);
      }
      return value;
    };
  }

  loadSoundAssets(assets) {
    return Promise.all(Object.keys(assets || {}).map(key => this.loadSoundAsset(key, assets[key]))).then(() => this);
  }

  loadSoundAsset(key, options) {
    if (this.sounds[key]) {
      return Promise.resolve(this.sounds[key]);
    }
    this._startLoading(key, 'sounds');
    return new Promise(resolve => {
      const clip = new AudioClip(options);
      clip.ready.then(() => resolve(clip));
    }).then(this._bindDoneLoading(key, 'sounds'));
  }

  loadImageAssets(assets) {
    return Promise.all(Object.keys(assets || {}).map(key => this.loadImageAsset(key, assets[key]))).then(() => this);
  }

  loadImageAsset(key, url) {
    if (this.images[key]) {
      return Promise.resolve(this.images[key]);
    }
    this._startLoading(key, 'images');
    const element = document.createElement('IMG');
    element.assetKey = key;
    element.style.display = 'none';
    return this.images[key] = new Promise((resolve, reject) => {
      element.addEventListener('load', () => resolve(this.images[key] = element));
      element.addEventListener('error', e => reject(e));
      element.src = url;
    }).then(this._bindDoneLoading(key, 'images'));
  }

  loadPrefabAssets(assets) {
    return Promise.all(Object.keys(assets || {}).map(key => this.loadPrefabAsset(key, assets[key]))).then(() => this);
  }

  loadPrefabAsset(key, obj) {
    if (this.prefabs[key]) {
      return Promise.resolve(this.prefabs[key]);
    }
    this._startLoading(key, 'prefabs');
    let importPromise = obj;
    if (obj && obj.defer) {
      importPromise = obj.defer();
    } else if (typeof obj === 'string') {
      importPromise = _import(urlToModule(obj));
    }
    return this.prefabs[key] = Promise.resolve(importPromise)
      .then(module => module.default || module)
      .then(prefab => this._resolveDependencies(prefab))
      .then(makePrefabClass)
      .then(this._bindDoneLoading(key, 'prefabs'));
  }

  loadDataAssets(assets) {
    return Promise.all(Object.keys(assets || {}).map(key => this.loadDataAsset(key, assets[key]))).then(() => this);
  }

  loadDataAsset(key, url) {
    if (this.data[key]) {
      return Promise.resolve(this.data[key]);
    }
    this._startLoading(key, 'data');
    return this.data[key] = fetch(url)
      .then(response => response.text())
      .then(this._bindDoneLoading(key, 'data'));
  }

  load(assets) {
    let modules;
    for (const key of Object.keys(assets.prefabs || {})) {
      if (!this.prefabs[key]) {
        this._startLoading(key, 'prefabs');
      }
    }
    return Promise.all([
      this._require(assets.require || []),
      this.loadImageAssets(assets.images),
      this.loadDataAssets(assets.data),
      this.loadSoundAssets(assets.sounds),
    ]).then(([loadedModules]) => {
      modules = loadedModules;
      return this.loadPrefabAssets(assets.prefabs);
    }).then(() => {
      return modules;
    });
  }

  require(...urls) {
    return this._require(urls);
  }

  _require(mods) {
    let isArray = Array.isArray(mods);
    if (isArray) {
      const oMods = {};
      for (const url of mods) {
        oMods[url] = url;
      }
      mods = oMods;
    }
    const keys = Object.keys(mods);
    const promise = Promise.all(keys.map(key => {
      const module = mods[key];
      this._startLoading(module, 'modules');
      return Promise.resolve(_import(urlToModule(module))).then(this._bindDoneLoading(module, 'modules'));
    }));
    if (isArray) {
      return promise;
    }
    return promise.then(modules => {
      const result = {};
      for (let i = 0; i < modules.length; i++) {
        result[keys[i]] = modules[i];
      }
      return result;
    });
  }

  _resolveDependencies(prefab) {
    return this.load(prefab).then(() => prefab);
  }
}

export default AssetStore;
