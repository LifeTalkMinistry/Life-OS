import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/activityCommitments.js', import.meta.url), 'utf8');
const directorySource = readFileSync(new URL('../src/activityDirectory.js', import.meta.url), 'utf8');

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
  remove() { this.isConnected = false; }

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

function createRuntime({ activityState = null } = {}) {
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

  const storage = new Map();
  if (activityState) {
    storage.set('pause-activity-commitments-v1:account:guest', JSON.stringify(activityState));
  }
  const localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
  };

  const window = { addEventListener() {}, dispatchEvent() {} };
  const context = {
    document,
    MutationObserver,
    localStorage,
    window,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    console
  };

  vm.runInNewContext(source, context, { filename: 'activityCommitments.js' });
  return { document, window, localStorage, getObserverCallback: () => observerCallback };
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

test('Activities panel no longer owns START controls and activity timing is exposed to the ORB', () => {
  assert.equal(source.includes('data-start'), false);
  assert.equal(source.includes('activity-start'), false);

  const { window } = createRuntime({
    activityState: {
      version: 1,
      activities: [
        {
          id: 'spanish',
          name: 'Spanish Language Practice',
          targetMode: 'track',
          targetMinutes: null,
          spanMode: 'ongoing',
          endDate: null,
          createdAt: Date.now()
        }
      ],
      sessions: [],
      active: null
    }
  });

  const api = window.__PAUSE_ACTIVITIES__;
  assert.equal(typeof api?.getActivities, 'function');
  assert.equal(api.getActivities().length, 1);
  assert.equal(api.getActivities()[0].name, 'Spanish Language Practice');

  assert.equal(api.start('spanish'), true);
  assert.equal(api.getActive().activityId, 'spanish');
  assert.equal(api.getActive().name, 'Spanish Language Practice');

  assert.equal(api.stop(), true);
  assert.equal(api.getActive(), null);
});

test('Activity management is a clean clickable directory with per-activity reporting', () => {
  assert.match(directorySource, /<h2>Activities<\/h2>/);
  assert.match(directorySource, /data-activity-directory-add/);
  assert.match(directorySource, /data-activity-report=/);
  assert.match(directorySource, /window\.__PAUSE_ACTIVITIES__\?\.open\?\.\('add'\)/);

  assert.equal(directorySource.includes('>HISTORY<'), false);
  assert.equal(directorySource.includes('>INSIGHTS<'), false);
  assert.equal(directorySource.includes('Track only ·'), false);

  assert.match(directorySource, /TOTAL TRACKED/);
  assert.match(directorySource, /LAST 7 DAYS/);
  assert.match(directorySource, /RECENT SESSIONS/);
  assert.match(directorySource, /timeZone: 'Asia\/Manila'/);
});
