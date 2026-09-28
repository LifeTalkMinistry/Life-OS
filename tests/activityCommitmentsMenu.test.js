import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/activityCommitments.js', import.meta.url), 'utf8');

function dataAttributeFor(property) {
  return `data-${String(property).replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
}

function matches(node, selector) {
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return String(node.className || '').split(/\s+/).includes(selector.slice(1));
  const attribute = selector.match(/^\[([^\]]+)\]$/)?.[1];
  return attribute ? node.attributes.has(attribute) : false;
}

class FakeNode {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this.isConnected = true;
    this.dataset = new Proxy({}, {
      set: (_target, property, value) => {
        this.attributes.set(dataAttributeFor(property), String(value));
        return true;
      }
    });
    this.classList = {
      toggle: (name, on) => {
        const classes = new Set(String(this.className || '').split(/\s+/).filter(Boolean));
        if (on) classes.add(name); else classes.delete(name);
        this.className = [...classes].join(' ');
      }
    };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
}

function createRuntime() {
  const documentElement = new FakeNode('html');
  const head = new FakeNode('head');
  const body = new FakeNode('body');
  const nav = new FakeNode('nav');
  nav.className = 'pause-orb-menu';
  documentElement.appendChild(head);
  documentElement.appendChild(body);
  body.appendChild(nav);

  let observerCallback = null;
  class MutationObserver {
    constructor(callback) { observerCallback = callback; }
    observe() {}
  }

  const document = {
    readyState: 'complete',
    documentElement,
    head,
    body,
    createElement: (tagName) => new FakeNode(tagName),
    querySelector: (selector) => documentElement.querySelector(selector),
    querySelectorAll: (selector) => documentElement.querySelectorAll(selector),
    addEventListener() {}
  };

  const context = {
    document,
    MutationObserver,
    localStorage: { getItem: () => null, setItem() {} },
    window: { addEventListener() {}, dispatchEvent() {} },
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    console
  };

  vm.runInNewContext(source, context, { filename: 'activityCommitments.js' });
  return { document, getObserverCallback: () => observerCallback };
}

test('Activity menu injection is idempotent and uses only the canonical data attribute', () => {
  const { document, getObserverCallback } = createRuntime();

  assert.equal(document.querySelectorAll('[data-pause-activity-menu]').length, 1);
  assert.equal(document.querySelector('[data-pause-activities-menu]'), null);

  const reconcile = getObserverCallback();
  assert.equal(typeof reconcile, 'function');
  for (let index = 0; index < 100; index += 1) reconcile();

  assert.equal(document.querySelectorAll('[data-pause-activity-menu]').length, 1);
  assert.equal(document.querySelector('[data-pause-activities-menu]'), null);
});
