let BaseEventTarget = EventTarget;
try {
  new EventTarget();
} catch (e) {
  // MS Edge doesn't support the EventTarget constructor: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/18274176/
  class EdgeEventTarget {
    constructor() {
      this._eventTarget = document.createElement('DIV');
    }

    addEventListener(type, listener, options) {
      return this._eventTarget.addEventListener(type, listener, options);
    }

    removeEventListener(type, listener, options) {
      return this._eventTarget.removeEventListener(type, listener, options);
    }

    dispatchEvent(event) {
      return this._eventTarget.dispatchEvent(event);
    }
  }
  BaseEventTarget = EdgeEventTarget;
}

export default class EventTargetClass extends BaseEventTarget {
  constructor() {
    super();
    this._eventTypes = new Set();
  }

  hasEventListener(type) {
    return this._eventTypes.has(type);
  }

  addEventListener(type, listener, options) {
    this._eventTypes.add(type);
    return super.addEventListener(type, listener, options);
  }

  dispatchEvent(eventType, detail = undefined) {
    if (typeof eventType === 'string') {
      super.dispatchEvent(new CustomEvent(eventType, { detail }));
    } else {
      super.dispatchEvent(eventType);
    }
  }
}

EventTargetClass.Wrap = class EventTargetWrapper {
  constructor(target) {
    this._eventTarget = target;
    this._eventTypes = new Set();
  }

  hasEventListener(type) {
    return this._eventTypes.has(type);
  }

  addEventListener(type, listener, options) {
    this._eventTypes.add(type);
    return this._eventTarget.addEventListener(type, listener, options);
  }

  removeEventListener(type, listener) {
    this._eventTarget.removeEventListener(type, listener);
  }

  dispatchEvent(eventType, detail = undefined) {
    if (typeof eventType === 'string') {
      this._eventTarget.dispatchEvent(new CustomEvent(eventType, { detail }));
    } else {
      this._eventTarget.dispatchEvent(eventType);
    }
  }
}
