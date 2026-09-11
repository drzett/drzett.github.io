(() => {
  'use strict';

  const script = document.currentScript;
  const projectId = script?.dataset?.project || '';
  const basePath = script?.dataset?.base || '';
  const debugEnabled = script?.dataset?.debug === '1';
  const compatibilityEnabled = script?.dataset?.compat === '1';
  const channel = 'PRO_RUNNER_BRIDGE';

  const send = (type, payload = {}) => {
    try {
      window.parent?.postMessage({ channel, type, projectId, payload, time: Date.now() }, '*');
    } catch {
      // Diagnostics must never break the hosted project.
    }
  };

  const serialize = (value, depth = 0) => {
    if (depth > 3) return '[…]';
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'string') return value;
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
    if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
    if (value instanceof Element) return `<${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ''}>`;
    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (key, item) => {
        if (typeof item === 'object' && item !== null) {
          if (seen.has(item)) return '[Circular]';
          seen.add(item);
        }
        if (typeof item === 'function') return `[Function ${item.name || 'anonymous'}]`;
        return item;
      }, 2);
    } catch {
      try { return String(value); } catch { return '[Unserializable]'; }
    }
  };

  if (debugEnabled) {
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
      const original = console[level]?.bind(console);
      if (!original) continue;
      console[level] = (...args) => {
        original(...args);
        send('console', { level, message: args.map((item) => serialize(item)).join(' ') });
      };
    }

    addEventListener('error', (event) => {
      send('console', {
        level: 'error',
        message: `${event.message || 'Script error'}${event.filename ? `\n${event.filename}:${event.lineno || 0}:${event.colno || 0}` : ''}`,
      });
    });

    addEventListener('unhandledrejection', (event) => {
      send('console', { level: 'error', message: `Unhandled rejection: ${serialize(event.reason)}` });
    });

    let last = performance.now();
    let samples = [];
    let lastReport = last;
    const frame = (now) => {
      const delta = now - last;
      last = now;
      if (delta > 0 && delta < 2000) samples.push(delta);
      if (now - lastReport >= 1000) {
        const sorted = samples.slice().sort((a, b) => a - b);
        const median = sorted.length ? sorted[Math.floor(sorted.length * .5)] : 0;
        const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : 0;
        const fps = samples.length ? 1000 / (samples.reduce((sum, n) => sum + n, 0) / samples.length) : 0;
        const longFrames = samples.filter((n) => n > 34).length;
        send('performance', { fps, median, p95, longFrames, sampleCount: samples.length });
        samples = [];
        lastReport = now;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  if (!compatibilityEnabled || !basePath) {
    send('ready', { compatibility: false, debug: debugEnabled });
    return;
  }

  const shouldRewrite = (value) => {
    if (typeof value !== 'string') return false;
    return value.startsWith('/') && !value.startsWith('//') && !value.startsWith(basePath);
  };

  const rewrite = (value) => {
    if (!shouldRewrite(value)) return value;
    return `${basePath}${value.replace(/^\/+/, '')}`;
  };

  const rewriteURLLike = (input) => {
    if (typeof input === 'string') return rewrite(input);
    if (input instanceof URL && input.origin === location.origin && input.pathname.startsWith('/') && !input.pathname.startsWith(basePath)) {
      return new URL(`${basePath}${input.pathname.slice(1)}${input.search}${input.hash}`, location.origin);
    }
    if (input instanceof Request) {
      try {
        const url = new URL(input.url);
        if (url.origin === location.origin && url.pathname.startsWith('/') && !url.pathname.startsWith(basePath)) {
          return new Request(new URL(`${basePath}${url.pathname.slice(1)}${url.search}${url.hash}`, location.origin), input);
        }
      } catch {}
    }
    return input;
  };

  const nativeFetch = window.fetch?.bind(window);
  if (nativeFetch) {
    window.fetch = (input, init) => nativeFetch(rewriteURLLike(input), init);
  }

  const xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return xhrOpen.call(this, method, rewriteURLLike(url), ...rest);
  };

  const historyPush = history.pushState.bind(history);
  const historyReplace = history.replaceState.bind(history);
  history.pushState = (state, unused, url) => historyPush(state, unused, url == null ? url : rewriteURLLike(url));
  history.replaceState = (state, unused, url) => historyReplace(state, unused, url == null ? url : rewriteURLLike(url));

  const nativeOpen = window.open?.bind(window);
  if (nativeOpen) window.open = (url, ...rest) => nativeOpen(rewriteURLLike(url), ...rest);

  if (window.Worker) {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) { super(rewriteURLLike(url), options); }
    };
  }

  if (window.SharedWorker) {
    const NativeSharedWorker = window.SharedWorker;
    window.SharedWorker = class extends NativeSharedWorker {
      constructor(url, options) { super(rewriteURLLike(url), options); }
    };
  }

  if (window.EventSource) {
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(url, options) { super(rewriteURLLike(url), options); }
    };
  }

  const attrs = ['src', 'href', 'action', 'poster', 'data'];
  const rewriteElement = (element) => {
    if (!(element instanceof Element)) return;
    for (const attr of attrs) {
      const value = element.getAttribute(attr);
      if (shouldRewrite(value)) element.setAttribute(attr, rewrite(value));
    }
    const srcset = element.getAttribute('srcset');
    if (srcset) {
      const rewritten = srcset.split(',').map((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        if (shouldRewrite(parts[0])) parts[0] = rewrite(parts[0]);
        return parts.join(' ');
      }).join(', ');
      if (rewritten !== srcset) element.setAttribute('srcset', rewritten);
    }
  };

  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    const lower = String(name).toLowerCase();
    if (attrs.includes(lower) && shouldRewrite(value)) value = rewrite(value);
    if (lower === 'srcset' && typeof value === 'string') {
      value = value.split(',').map((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        if (shouldRewrite(parts[0])) parts[0] = rewrite(parts[0]);
        return parts.join(' ');
      }).join(', ');
    }
    return originalSetAttribute.call(this, name, value);
  };

  document.querySelectorAll('[src],[href],[action],[poster],[data],[srcset]').forEach(rewriteElement);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') rewriteElement(mutation.target);
      for (const node of mutation.addedNodes || []) {
        if (node instanceof Element) {
          rewriteElement(node);
          node.querySelectorAll?.('[src],[href],[action],[poster],[data],[srcset]').forEach(rewriteElement);
        }
      }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: [...attrs, 'srcset'] });

  document.addEventListener('click', (event) => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    const raw = anchor.getAttribute('href');
    if (shouldRewrite(raw)) anchor.setAttribute('href', rewrite(raw));
  }, true);

  send('ready', { compatibility: true, debug: debugEnabled });
})();
