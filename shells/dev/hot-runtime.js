/* eslint-disable */

let contextCache = new Map();
let currentContextIndex = 0;

const createContext = require('react').createContext;
require('react').createContext = function(defaultValue) {
  if (currentModuleID !== null) {
    let id = `${currentModuleID}:${currentContextIndex}`;
    let ctx;
    if (contextCache.has(id)) {
      ctx = contextCache.get(id);
    } else {
      ctx = createContext(defaultValue);
      contextCache.set(id, ctx);
    }
    currentContextIndex++;
    return ctx;
  }
  return createContext(defaultValue);
};

let currentModuleID = null;
window.__setCurrentModule__ = function(m) {
  currentModuleID = m.id;
  currentContextIndex = 0;
};

let identities = new Map();
let signatures = new WeakMap();
let pendingRegistrations = new Map();

let scheduleUpdateForHotReload;
let lastCommittedRoot;
if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject() {},
    onCommitFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
  };
}
function patchHook(method, intercept) {
  let oldFn = window.__REACT_DEVTOOLS_GLOBAL_HOOK__[method];
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__[method] = (...args) => {
    intercept(...args);
    return oldFn(...args);
  };
}
patchHook('inject', injected => {
  scheduleUpdateForHotReload = injected.scheduleUpdateForHotReload;
});
patchHook('onCommitFiberRoot', (id, root) => {
  // TODO: properly track roots
  lastCommittedRoot = root;
});

const REACT_PROVIDER_TYPE = Symbol.for('react.provider');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_MEMO_TYPE = Symbol.for('react.memo');

function unwrapHotReloadableType(type) {
  switch (typeof type) {
    case 'string':
      return null;
    case 'function':
      if (type.prototype && type.prototype.isReactComponent) {
        return null;
      }
      return type;
    case 'object':
      switch (type.$$typeof) {
        case REACT_MEMO_TYPE:
          return unwrapHotReloadableType(type.type);
        case REACT_FORWARD_REF_TYPE:
          // TODO: this doesn't really work if it doesn't get identity
          return type.render;
        default:
          return null;
      }
    default:
      return null;
  }
}

window.__shouldAccept__ = function(exports) {
  for (let key in exports) {
    const val = exports[key];
    if (
      val &&
      (val.$$typeof === REACT_PROVIDER_TYPE ||
        val.$$typeof === REACT_CONTEXT_TYPE)
    ) {
      // Context is fine too
      continue;
    }
    const type = val && unwrapHotReloadableType(val);
    if (type && type.name && /^use[A-Z]+/.test(type.name)) {
      // Propagate Hooks
      return false;
    }
    if (type) {
      if (pendingRegistrations.has(type)) {
        // This one is definitely ok
        continue;
      }
    }
    return false;
  }
  // All exports are component-ish.
  return true;
};

window.__signature__ = function(fn, sig, deps) {
  signatures.set(fn, [sig, deps]);
};

window.__register__ = function(fn, id) {
  if (pendingRegistrations.has(fn)) {
    throw new Error('Something is wrong');
  }
  pendingRegistrations.set(fn, id);
  scheduleHotReload();
  return fn;
};

function flushRegistrations() {
  currentModuleID = null;
  let pendingNewIDs = [];
  let deadIDs = [];

  for (let [fn, id] of pendingRegistrations.entries()) {
    let isNew = false;

    let sig = '';
    if (signatures.has(fn)) {
      let deps;
      [sig, deps] = signatures.get(fn);
      let allDeps = deps();
      for (let i = 0; i < allDeps.length; i++) {
        // TODO: this doesn't work for late arrows
        const id = allDeps[i].__debugIdentity;
        sig += ':::' + (id ? id.signature : '<none>');
      }
    }

    if (!identities.has(id)) {
      isNew = true;
      identities.set(id, {
        current: fn,
        signature: sig,
      });
    }
    const identity = identities.get(id);
    if (identity.signature !== sig) {
      identity.signature = sig;
      deadIDs.push(identity);
    }
    fn.__debugIdentity = identity;
    identity.current = fn;

    if (!isNew) {
      pendingNewIDs.push(identity);
    }
  }

  pendingRegistrations.clear();
  return [pendingNewIDs, deadIDs];
}

let waitHandle = null;
function scheduleHotReload() {
  if (!waitHandle) {
    waitHandle = setTimeout(() => {
      waitHandle = null;

      let [pendingNewIDs, deadIDs] = flushRegistrations();

      // Do it.
      if (!lastCommittedRoot) {
        return;
      }
      const result = scheduleUpdateForHotReload(
        lastCommittedRoot,
        pendingNewIDs,
        deadIDs
      );
      highlightNodes(result.hostNodes);
      console.clear();
      // TODO: this is weird because we want to ignore spurious multiple updates
      // like when you save with typo in render, fix typo, and then get two versions.
    }, 30);
  }
}

function highlightNodes(nodes) {
  let rects = nodes.map(node => node.getBoundingClientRect());
  let layer = ensureLayer();

  layer.innerHTML = '';
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const div = document.createElement('div');
    Object.assign(div.style, rectStyles, {
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    });
    layer.appendChild(div);
  }
  layer.style.transition = 'none';
  layer.style.opacity = 1;
  setTimeout(() => {
    layer.style.transition = 'opacity 2s ease-in';
    layer.style.opacity = 0;
  }, 100);
}

const layerStyles = {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  border: 'none',
  pointerEvents: 'none',
  zIndex: 2147483647,
};

const rectStyles = {
  position: 'absolute',
  border: '1px rgb(97, 218, 251) solid',
  backgroundColor: 'rgba(97, 218, 251, 0.1)',
};

let l;
function ensureLayer() {
  if (l) {
    return l;
  }
  // TODO: iframe
  l = document.createElement('div');
  Object.assign(l.style, layerStyles);
  document.body.appendChild(l);
  return l;
}
