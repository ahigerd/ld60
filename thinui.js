import EventTarget from './html52d/EventTarget.js';

let uniqId = 1;

class BareThinUIComponent extends EventTarget.Wrap {
  constructor(root) {
    super(root);
    if (root) {
      this.root = root;
    } else {
      this.root = this._template.cloneNode(true);
    }
    this.root.tui = this;
  }

  appendTo(parent) {
    if (parent.root) {
      parent.root.appendChild(this.root);
    } else {
      parent.appendChild(this.root);
    }
  }

  replaceElement(elem) {
    elem.parentNode.insertBefore(this.root, elem);
    elem.parentNode.removeChild(elem);
  }

  get className() {
    return this.root.className;
  }

  set className(v) {
    this.root.className = v;
  }

  get classList() {
    return this.root.classList;
  }

  get style() {
    return this.root.style;
  }

  get isVisible() {
    return this.root.style.display !== 'none';
  }

  set isVisible(show) {
    this.root.style.display = show ? '' : 'none';
  }

  hide() {
    this.isVisible = false;
  }

  show() {
    this.isVisible = true;
  }

  focus() {
    this.root.focus();
  }

  blur() {
    this.root.blur();
  }
}

export class ThinUIComponent extends BareThinUIComponent {
  constructor(props, root = null) {
    super(root);
    if (this.constructor.name !== 'ThinUIComponent') {
      this.root.classList.add(`tui-${this.constructor.name}`);
    }
    this._initChildren();

    for (const key in props) {
      if (this._tuiProperties.has(key)) {
        this[key] = props[key];
      }
    }
  }

  _initChildren() {
    const tui = [...this.root.querySelectorAll('[data-tui-index],[id],[data-tui-properties],[data-tui-events],[data-tui-id]')];
    this._tui = {};
    for (const child of tui) {
      if (child.dataset.tuiIndex) {
        this._tui[child.dataset.tuiIndex] = child;
      }
      if (child.dataset.tuiClass) {
        const tuiClass = ThinUI[child.dataset.tuiClass];
        const widget = new tuiClass(child.dataset, child);
        widget._initChildren();
        widget.root.tui = widget;
        if (child.dataset.tuiId) {
          this[child.dataset.tuiId] = widget;
        }
      } else if (child.dataset.tuiId || child.id) {
        this[child.dataset.tuiId || child.id] = new BareThinUIComponent(child);
      }
    }
    if ('tuiIndex' in this.root.dataset) {
      this._tui[this.root.dataset.tuiIndex] = this.root;
    }
    for (const childID in this._events) {
      const child = this._tui[childID];
      const childEvents = this._events[childID];
      for (const method in childEvents) {
        child.addEventListener(childEvents[method], (event) => { this[method] && this[method](event); });
      }
    }
  }
}
ThinUIComponent.prototype._tuiProperties = new Set(['isVisible']);

const implClasses = {};

/* internal */
function makeUIClass(root, id, impl = null) {
  init(root);
  const events = {};
  if (!impl) {
    impl = ThinUIComponent;
  }
  const cls = (new Function(
    'impl',
    `return class ${id || ''} extends impl.${impl.name} {}`,
  ))({ [impl.name]: impl });
  if (root.childElementCount == 1) {
    cls.prototype._template = root.firstElementChild;
  } else {
    const div = document.createElement('DIV');
    for (const child of root.children) {
      div.appendChild(child.cloneNode(true));
    }
    cls.prototype._template = div;
  }
  const template = cls.prototype._template;
  cls.prototype._events = events;
  cls.prototype._tuiProperties = new Set(impl.prototype._tuiProperties || []);
  if (impl !== ThinUIComponent) {
    for (const attr of impl.props || []) {
      cls.prototype._tuiProperties.add(attr);
    }
    for (const attr of Reflect.ownKeys(impl.prototype)) {
      if (attr === 'constructor') {
        continue;
      }
      cls.prototype._tuiProperties.add(attr);
    }
  }
  for (const child of [template, ...template.querySelectorAll('[data-tui-properties],[data-tui-events],[data-tui-id],[id]')]) {
    if (child.parentElement && child.parentElement.closest('[data-tui-class]')) {
      // This is controlled by a higher-level ThinUI object. Don't double-process it.
      continue;
    }
    if (child.id && !child.dataset.tuiId) {
      child.dataset.tuiId = child.id;
      child.removeAttribute('id');
    }
    const childID = uniqId++;
    child.dataset.tuiIndex = childID;
    const bindEvents = events[childID] = {};
    if (child.dataset.tuiProperties) {
      for (const prop of child.dataset.tuiProperties.split(',')) {
        let [exposeName, innerName] = prop.split('=');
        innerName = innerName || exposeName;
        if (child.dataset.tuiClass) {
          Object.defineProperty(cls.prototype, exposeName, {
            get: function() { return this._tui[childID].tui[innerName]; },
            set: function(v) { this._tui[childID].tui[innerName] = v; },
          });
        } else {
          Object.defineProperty(cls.prototype, exposeName, {
            get: function() { return this._tui[childID][innerName]; },
            set: function(v) { this._tui[childID][innerName] = v; },
          });
        }
        cls.prototype._tuiProperties.add(exposeName);
      }
      delete child.dataset.tuiProperties;
    }
    if (child.dataset.tuiEvents) {
      for (const prop of child.dataset.tuiEvents.split(',')) {
        let [exposeName, eventName] = prop.split('=');
        eventName = (eventName || exposeName).toLowerCase();
        exposeName = 'on' + exposeName[0].toUpperCase() + exposeName.substr(1);
        bindEvents[exposeName] = eventName;
      }
      delete child.dataset.tuiEvents;
    }
  }
  return cls;
}

export function register(cls) {
  implClasses[cls.name] = cls;
  implClasses[cls.name.toUpperCase()] = cls;
  if (!ThinUI[cls.name]) {
    ThinUI[cls.name] = cls;
  }
}

export function scan(root) {
  if (!root.getElementsByTagName) {
    return;
  }
  for (const tpl of [...root.getElementsByTagName('template')]) {
    if (tpl.id && !ThinUI[tpl.id]) {
      ThinUI[tpl.id] = makeUIClass(tpl.content, tpl.id, implClasses[tpl.id]);
    }
  }
}

export function init(root, id) {
  scan(root);

  const children = {};
  if (!id && root.tagName == 'BODY') {
    id = 'document.body';
  }

  const selectors = ['ThinUI', '[data-tui-class]', ...Object.keys(implClasses)];
  for (const child of root.querySelectorAll(selectors.join(','))) {
    let tuiClass = child.dataset.tuiClass && (ThinUI[child.dataset.tuiClass] || implClasses[child.dataset.tuiClass]);
    if (!tuiClass) {
      tuiClass = implClasses[child.tagName];
    }
    if (!tuiClass) {
      console.error(`Unknown ThinUI element ${child.dataset.tuiClass || '(missing)'} in ${id || 'fromHtml'}`);
      continue;
    }
    let widget;
    const props = {
      ...child.dataset,
    };
    if (child.tagName == 'THINUI') {
      if (child.childNodes.length) {
        props.domContent = child.childNodes;
      }
      widget = new tuiClass(props);
      widget.replaceElement(child);
      if (child.dataset.tuiProperties) {
        widget.root.dataset.tuiProperties = child.dataset.tuiProperties;
      }
      if (child.dataset.tuiEvents) {
        widget.root.dataset.tuiEvents = child.dataset.tuiEvents;
      }
    } else {
      widget = new tuiClass(props, child);
    }
    if (child.id) {
      widget.root.setAttribute('id', child.id);
    } else {
      widget.root.removeAttribute('id');
    }
    widget.root.dataset.tuiClass = tuiClass.name;
    if (widget && widget.root && widget.root.getAttribute('id')) {
      children[widget.root.getAttribute('id')] = widget;
    }
  }

  for (const child of root.querySelectorAll('[id]')) {
    if (child.id && !(child.id in children)) {
      children[child.id] = new BareThinUIComponent(child);
    }
  }

  return children;
}

export function fromHtml(html, className = null) {
  const tpl = document.createElement('TEMPLATE');
  tpl.innerHTML = html;
  return makeUIClass(tpl.content.cloneNode(true), className);
}

const ThinUI = {
  ThinUIComponent,
  register,
  scan,
  init,
  fromHtml,
};
export default ThinUI;
