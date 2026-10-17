let styleTag = null;

function ensureStyleTag() {
  styleTag = styleTag || document.querySelector('link[href*="style_UITools"]');
  if (styleTag) {
    return;
  }

  styleTag = document.createElement('LINK');
  styleTag.setAttribute('rel', 'stylesheet');
  styleTag.setAttribute('href', 'style_UITools.css');
  document.head.appendChild(styleTag);
}

export class UIElement {
  constructor(element, tagName = 'INPUT') {
    this._element = element || document.createElement(tagName);
    this.addEventListener = this._element.addEventListener.bind(this._element);
    this.removeEventListener = this._element.removeEventListener.bind(this._element);
    ensureStyleTag();
  }

  focus() {
    setTimeout(() => this._element.focus(), 0);
  }

  appendTo(parent) {
    parent.appendChild(this._element);
  }

  dispatchEvent(eventType, detail = undefined) {
    if (typeof eventType === 'string') {
      this._element.dispatchEvent(new CustomEvent(eventType, { detail }));
    } else {
      this._element.dispatchEvent(eventType);
    }
  }
};

export class UIField extends UIElement {
  get value() {
    return this._element.value;
  }

  set value(v) {
    this._element.value = v;
  }
};

export class UIDropdown extends UIField {
  constructor(optionsOrElement, element) {
    if (optionsOrElement instanceof HTMLElement) {
      super(optionsOrElement);
    } else {
      super(element, 'SELECT');
    }
    this._groups = {};
    if (optionsOrElement && !(optionsOrElement instanceof HTMLElement)) {
      this.setOptions(optionsOrElement);
    }
  }

  get options() {
    return this._element.options;
  }

  clear() {
    this._element.innerHTML = '';
  }

  addOption(label, value = undefined, group = null) {
    const groupElement = group === null ?  this._element :
      typeof group === 'object' ? group :
      this._groups[group];
    const option = document.createElement('OPTION');
    option.innerHTML = label;
    option.value = value === undefined ? label : value;
    groupElement.appendChild(option);
  }

  addOptionGroup(label, values, group = null) {
    let groupElement;
    if (label === null) {
      groupElement = this._element;
    } else {
      const parentElement = group ? this._groups[group] : this._element;
      groupElement = document.createElement('OPTGROUP');
      groupElement.label = label;
      parentElement.appendChild(groupElement);
      this._groups[label] = groupElement;
    }

    const isArray = Array.isArray(values);
    const iterable = isArray ? values : Object.keys(values);
    for (let i = 0; i < iterable.length; i++) {
      const obj = isArray ? iterable[i] : values[iterable[i]];
      const label = typeof iterable[i] !== 'object' ? iterable[i] :
        typeof obj === 'object' ? obj.label :
        obj;
      const value = Array.isArray(obj) ? obj :
        typeof obj === 'object' ? obj.value :
        obj;
      if (Array.isArray(value)) {
        this.addOptionGroup(label, value, group);
      } else {
        this.addOption(label, value, groupElement);
      }
    }
  }

  setOptions(options) {
    this.clear();
    this.addOptionGroup(null, options);
  }
};

export class UIListBox extends UIField {
  constructor(optionsOrElement, element) {
    element = optionsOrElement instanceof HTMLElement ? optionsOrElement : element;
    const options = Array.isArray(optionsOrElement) ? optionsOrElement : [];
    if (!element || element.tagName.toUpperCase() === 'FORM') {
      super(element, 'FORM');
    } else {
      super(null, 'FORM');
      element.appendChild(this._element);
    }
    this._element.classList.add('ui-list-box');
    this._formName = 'list_' + `${Math.random()}`.substr(2);

    this._onRadioChange = this._onRadioChange.bind(this);
    this.setOptions(options);

    this._value = undefined;
  }

  get value() {
    return this._value;
  }

  set value(val) {
    const option = this._options.find(o => o.value == val);
    let value = undefined;
    if (option) {
      option.input.checked = true;
      value = this._element.value = option.value;
    } else {
      for (const opt of this._options) {
        opt.input.checked = false;
      }
      this._element.value = undefined;
    }
    if (this._value !== value) {
      this._value = value;
      this.dispatchEvent('change');
    }
  }

  get options() {
    return this._options;
  }

  clear() {
    this._value = null;
    this._options = [];
    this._element.innerHTML = '';
  }

  addOption(label, value) {
    if (value === undefined) {
      value = label;
    }
    const id = 'input_' + `${Math.random()}`.substr(2);
    const input = document.createElement('INPUT');
    input.name = this._formName;
    input.id = id;
    input.value = value;
    input.type = 'radio';
    const element = document.createElement('LABEL');
    element.htmlFor = id;
    if (label instanceof HTMLElement) {
      element.appendChild(label);
    } else {
      element.innerHTML = label;
    }
    input.addEventListener('change', this._onRadioChange);
    this._element.appendChild(input);
    this._element.appendChild(element);
    this._options.push({ label, value, input, element });
  }

  setOptions(options) {
    this.clear();
    for (const option of options) {
      if (typeof option === 'object') {
        this.addOption(option.label, option.value);
      } else {
        this.addOption(option);
      }
    }
  }

  _onRadioChange(event) {
    event.stopPropagation();
    if (event.target.checked) {
      const option = this._options.find(o => o.input === event.target);
      if (option) {
        this._value = option.value;
        this._element.value = option.value;
        this.dispatchEvent('change');
      }
    }
  }
};

export class UIDialog extends UIElement {
  constructor(optionsOrElement, element) {
    let options;
    if (optionsOrElement instanceof HTMLElement) {
      super(optionsOrElement);
      options = optionsOrElement.dataset;
    } else {
      super(element, 'DIV');
      options = optionsOrElement;
    }
    this._overlay = document.createElement('DIV');
    this._overlay.className = 'ui-overlay';
    this._overlay.style.display = 'none';
    document.body.appendChild(this._overlay);
    this._element.parentElement.removeChild(this._element);
    this._overlay.appendChild(this._element);
    this._overlay.addEventListener('click', this._hideEvent.bind(this));
    this._modalResolve = null;
    this._result = undefined;
    if (options.cancelable === undefined) {
      this.cancelable = true;
    } else if (typeof options.cancelable === 'string') {
      this.cancelable = options.cancelable.toLowerCase() === 'true';
    } else {
      this.cancelable = !!options.cancelable;
    }
  }

  get isVisible() {
    return this._overlay.style.display !== 'none';
  }

  set isVisible(show) {
    const isOpening = !this.isVisible && show;
    const isClosing = this.isVisible && !show;
    this._overlay.style.display = show ? '' : 'none';
    if (isOpening) {
      this.dispatchEvent('open');
    } else if (isClosing) {
      this.dispatchEvent('close');
      if (this._modalResolve) {
        this._modalResolve(this._result);
      }
    }
  }

  show() {
    this.isVisible = true;
  }

  hide() {
    this.isVisible = false;
  }

  open() {
    this.show();
    return new Promise(resolve => this._modalResolve = resolve);
  }

  resolve(value) {
    this._result = value;
    this.hide();
  }

  _hideEvent(event) {
    if (event.target === this._overlay && this.cancelable) {
      this._result = undefined;
      this.hide();
    }
  }

  _buildUI(context, extraTypes) {
    // Other subclasses might want to expand on the context or do some binding on the subcomponents.
    // UIDialog is a naive container so it just needs to expose its children and pass through the context.
    Object.assign(this, buildUI(context, this._element, null, extraTypes));
  }
};

const uiTypes = {
  UIElement,
  UIField,
  UIDropdown,
  UIListBox,
  UIDialog,
};

export function buildUI(context, container, content, extraTypes = {}) {
  const objects = {};
  if (!container) {
    container = document.createElement('DIV');
    objects.ui = container;
  }
  if (typeof content === 'string') {
    // If you pass in a string, treat it as HTML.
    container.innerHTML = content;
  } else if (content) {
    // If you pass in a DOM tree, clone it into the container. 
    // If the content is a <template> tag, capture its contents instead of the template tag itself.
    container.innerHTML = '';
    container.appendChild(container.ownerDocument.importNode(content.content || content, true));
  } else {
    // If you don't pass in any content at all, then attach to whatever is already in the container.
    // This requires no action here.
  }
  const combinedTypes = { ...uiTypes, ...extraTypes };
  // Find all interactive or programmatically-accessible UI elements
  const elements = [...container.querySelectorAll('input, button, [data-type], [data-id], [id]')];
  // Identify the elements that have constructors
  const components = elements.filter(element => 'type' in element.dataset);
  // Filter out elements contained within other elements that have constructors, since the constructors will handle those
  const filteredElements = elements.filter(element => !components.some(c => c !== element && c.contains(element)));
  for (const element of filteredElements) {
    let object = element.dataset.type ? new combinedTypes[element.dataset.type](element) : element;
    if (element.dataset.id) {
      objects[element.dataset.id] = object;
    } else if (element.id) {
      objects[element.id] = object;
    }
    for (const attr of Object.keys(element.dataset)) {
      if (attr.startsWith('on')) {
        const eventName = attr.replace(/^on/, '').toLowerCase();
        if (context[element.dataset[attr]]) {
          object.addEventListener(eventName, context[element.dataset[attr]].bind(context));
        }
      }
    }
    if (typeof object._buildUI === 'function') {
      // Components can opt into recursively building their children. This is primarily used by containers like UIDialog.
      object._buildUI(context, extraTypes);
    }
  }
  return objects;
}
