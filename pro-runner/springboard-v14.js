const SETTINGS_KEY = 'pro-runner-settings';
const DEFAULT_COMPAT_MIGRATION_KEY = 'pro-runner-v14-raw-default';
const LAYOUT_KEY = 'pro-runner-home-layout-v2';
const GRID_COLUMNS = 4;

function migrateCompatibilityDefault() {
  if (localStorage.getItem(DEFAULT_COMPAT_MIGRATION_KEY) === '1') return;
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    settings.defaultCompat = false;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(DEFAULT_COMPAT_MIGRATION_KEY, '1');
  } catch {}
}

migrateCompatibilityDefault();

function readLayout() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
    if (parsed?.version === 2 && parsed.positions && typeof parsed.positions === 'object') return parsed;
  } catch {}
  return { version: 2, positions: {} };
}

function saveLayout(layout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {}
}

function itemKey(item) {
  if (item.classList.contains('clock-widget')) return 'widget:clock';
  if (item.classList.contains('calendar-widget')) return 'widget:calendar';
  if (item.classList.contains('home-app')) {
    if (item.dataset.id) return `project:${item.dataset.id}`;
    const label = item.querySelector('.home-app-label')?.textContent?.trim();
    if (label === 'Pro Runner') return 'runner';
  }
  return null;
}

function itemSize(item) {
  return item.classList.contains('home-widget') ? { w: 2, h: 2 } : { w: 1, h: 1 };
}

function cellsFor(pos, size) {
  const cells = [];
  for (let row = pos.row; row < pos.row + size.h; row += 1) {
    for (let col = pos.col; col < pos.col + size.w; col += 1) cells.push(`${col}:${row}`);
  }
  return cells;
}

function occupy(occupied, key, pos, size) {
  for (const cell of cellsFor(pos, size)) occupied.set(cell, key);
}

function isFree(occupied, pos, size) {
  return cellsFor(pos, size).every((cell) => !occupied.has(cell));
}

function hash01(value, salt = 0) {
  let hash = 2166136261 ^ salt;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function applyJiggleSeed(item, key) {
  const widget = item.classList.contains('home-widget');
  item.style.setProperty('--jiggle-delay', `${(-0.30 * hash01(key, 11)).toFixed(3)}s`);
  item.style.setProperty('--jiggle-duration', `${((widget ? 0.235 : 0.195) + (widget ? 0.060 : 0.070) * hash01(key, 29)).toFixed(3)}s`);
  item.style.setProperty('--jiggle-angle', `${((widget ? 0.72 : 1.90) + (widget ? 0.38 : 0.85) * hash01(key, 47)).toFixed(2)}deg`);
  item.style.setProperty('--jiggle-shift', `${((widget ? 0.10 : 0.48) + (widget ? 0.20 : 0.72) * hash01(key, 71)).toFixed(2)}px`);
}

function applyPosition(item, pos, size) {
  item.style.gridColumn = `${pos.col} / span ${size.w}`;
  item.style.gridRow = `${pos.row} / span ${size.h}`;
  item.dataset.springCol = String(pos.col);
  item.dataset.springRow = String(pos.row);
  item.classList.remove('spring-overflow');
}

function setupSpringBoard() {
  const homeScreen = document.getElementById('homeScreen');
  const homeContent = homeScreen?.querySelector('.home-content');
  const widgetArea = document.getElementById('widgetArea');
  const appGrid = document.getElementById('homeAppGrid');
  const dock = document.getElementById('homeDock');
  const doneButton = document.getElementById('homeEditDone');
  if (!homeScreen || !homeContent || !widgetArea || !appGrid || !dock || !doneButton) return;

  const defaultCompatToggle = document.getElementById('defaultCompatToggle');
  if (defaultCompatToggle?.checked) {
    defaultCompatToggle.checked = false;
    defaultCompatToggle.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const defaultCompatRow = defaultCompatToggle?.closest('.toggle-row');
  const compatHelp = defaultCompatRow?.querySelector('small');
  if (compatHelp) compatHelp.textContent = 'Off by default. Enable only when a project needs root-relative URL repair or other compatibility rewrites.';

  let layout = readLayout();
  let decorating = false;
  let decorateQueued = false;
  let drag = null;
  let dropMarker = null;
  let suppressClickUntil = 0;
  let visibleRows = 4;

  function currentItems() {
    return [...widgetArea.querySelectorAll('.home-widget'), ...appGrid.querySelectorAll('.home-app')];
  }

  function syncEditClass() {
    const editing = !doneButton.classList.contains('hidden');
    homeScreen.classList.toggle('springboard-editing', editing);
    return editing;
  }

  function measureGrid() {
    const rect = homeContent.getBoundingClientRect();
    const style = getComputedStyle(homeContent);
    const columnGap = parseFloat(style.columnGap) || 0;
    const rowGap = parseFloat(style.rowGap) || columnGap;
    const cell = (rect.width - columnGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
    const rows = Math.max(2, Math.floor((rect.height + rowGap) / Math.max(1, cell + rowGap)));
    visibleRows = rows;
    homeContent.style.setProperty('--springboard-visible-rows', String(rows));
    return { rect, columnGap, rowGap, cell, rows };
  }

  function validPosition(pos, size, rows = visibleRows) {
    return Number.isInteger(pos?.col) && Number.isInteger(pos?.row) &&
      pos.col >= 1 && pos.row >= 1 &&
      pos.col + size.w - 1 <= GRID_COLUMNS && pos.row + size.h - 1 <= rows;
  }

  function findFirstFree(occupied, size, rows = visibleRows) {
    for (let row = 1; row <= rows - size.h + 1; row += 1) {
      for (let col = 1; col <= GRID_COLUMNS - size.w + 1; col += 1) {
        const pos = { col, row };
        if (isFree(occupied, pos, size)) return pos;
      }
    }
    return null;
  }

  function normalizeLayout(items) {
    measureGrid();
    const occupied = new Map();
    const accepted = new Set();

    for (const item of items) {
      const key = itemKey(item);
      if (!key) continue;
      const size = itemSize(item);
      const pos = layout.positions[key];
      if (validPosition(pos, size) && isFree(occupied, pos, size)) {
        occupy(occupied, key, pos, size);
        accepted.add(key);
        applyPosition(item, pos, size);
      }
    }

    for (const item of items) {
      const key = itemKey(item);
      if (!key) continue;
      const size = itemSize(item);
      if (!accepted.has(key)) {
        const pos = findFirstFree(occupied, size);
        if (pos) {
          layout.positions[key] = pos;
          occupy(occupied, key, pos, size);
          applyPosition(item, pos, size);
        } else {
          item.classList.add('spring-overflow');
          item.style.removeProperty('grid-column');
          item.style.removeProperty('grid-row');
        }
      }
      applyJiggleSeed(item, key);
      item.dataset.springKey = key;
    }

    saveLayout(layout);
    homeContent.scrollTop = 0;
    homeContent.scrollLeft = 0;
  }

  function decorate() {
    decorateQueued = false;
    if (decorating) return;
    decorating = true;
    try {
      const items = currentItems();
      normalizeLayout(items);
      syncEditClass();
      for (const item of items) wireDrag(item);
      for (const item of dock.querySelectorAll('.home-app')) {
        const key = itemKey(item) || `dock:${item.dataset.id || 'item'}`;
        applyJiggleSeed(item, key);
      }
    } finally {
      decorating = false;
    }
  }

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(decorate);
  }

  function layoutSnapshot(excludeKey = null) {
    const occupied = new Map();
    const entries = new Map();
    for (const item of currentItems()) {
      const key = itemKey(item);
      if (!key || key === excludeKey || item.classList.contains('spring-overflow')) continue;
      const size = itemSize(item);
      const pos = layout.positions[key];
      if (!validPosition(pos, size)) continue;
      entries.set(key, { item, pos: { ...pos }, size });
      occupy(occupied, key, pos, size);
    }
    return { occupied, entries };
  }

  function targetFromPointer(event, item) {
    const { rect, columnGap, rowGap, cell, rows } = measureGrid();
    const size = itemSize(item);
    const pitchX = cell + columnGap;
    const pitchY = cell + rowGap;
    const left = event.clientX - drag.offsetX - rect.left;
    const top = event.clientY - drag.offsetY - rect.top;
    let col = Math.round(left / pitchX) + 1;
    let row = Math.round(top / pitchY) + 1;
    col = Math.max(1, Math.min(GRID_COLUMNS - size.w + 1, col));
    row = Math.max(1, Math.min(rows - size.h + 1, row));
    return { col, row };
  }

  function showDropMarker(pos, size, allowed) {
    if (!dropMarker) {
      dropMarker = document.createElement('div');
      dropMarker.className = 'spring-drop-target';
      homeContent.append(dropMarker);
    }
    dropMarker.classList.toggle('blocked', !allowed);
    dropMarker.style.gridColumn = `${pos.col} / span ${size.w}`;
    dropMarker.style.gridRow = `${pos.row} / span ${size.h}`;
  }

  function hideDropMarker() {
    dropMarker?.remove();
    dropMarker = null;
  }

  function conflictsAt(key, pos, size) {
    const { occupied, entries } = layoutSnapshot(key);
    const conflictKeys = [...new Set(cellsFor(pos, size).map((cell) => occupied.get(cell)).filter(Boolean))];
    return { conflictKeys, entries };
  }

  function canDrop(item, key, pos) {
    const size = itemSize(item);
    if (!validPosition(pos, size)) return false;
    const { conflictKeys, entries } = conflictsAt(key, pos, size);
    if (!conflictKeys.length) return true;
    if (size.w === 1 && size.h === 1 && conflictKeys.length === 1) {
      const other = entries.get(conflictKeys[0]);
      return other?.size.w === 1 && other?.size.h === 1;
    }
    return false;
  }

  function commitDrop(item, key, pos) {
    const size = itemSize(item);
    if (!validPosition(pos, size)) return false;
    const oldPos = { ...(layout.positions[key] || { col: 1, row: 1 }) };
    const { conflictKeys, entries } = conflictsAt(key, pos, size);
    if (!conflictKeys.length) {
      layout.positions[key] = pos;
    } else if (size.w === 1 && size.h === 1 && conflictKeys.length === 1) {
      const otherKey = conflictKeys[0];
      const other = entries.get(otherKey);
      if (!other || other.size.w !== 1 || other.size.h !== 1 || !validPosition(oldPos, other.size)) return false;
      layout.positions[key] = pos;
      layout.positions[otherKey] = oldPos;
      applyPosition(other.item, oldPos, other.size);
    } else {
      return false;
    }
    applyPosition(item, layout.positions[key], size);
    saveLayout(layout);
    return true;
  }

  function clearDragVisual(item) {
    item.classList.remove('spring-dragging');
    item.style.removeProperty('transform');
    item.style.removeProperty('z-index');
    hideDropMarker();
  }

  function wireDrag(item) {
    if (item.dataset.springDragWired === '1') return;
    item.dataset.springDragWired = '1';

    item.addEventListener('pointerdown', (event) => {
      if (!syncEditClass() || event.button > 0) return;
      if (event.target.closest('.app-delete-badge')) return;
      const key = itemKey(item);
      if (!key || item.classList.contains('spring-overflow')) return;
      const rect = item.getBoundingClientRect();
      drag = {
        item, key, pointerId: event.pointerId,
        startX: event.clientX, startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false,
        target: layout.positions[key] ? { ...layout.positions[key] } : { col: 1, row: 1 },
      };
      try { item.setPointerCapture(event.pointerId); } catch {}
    });

    item.addEventListener('pointermove', (event) => {
      if (!drag || drag.item !== item || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      event.preventDefault();
      item.classList.add('spring-dragging');
      item.style.zIndex = '30';
      item.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.045)`;
      const target = targetFromPointer(event, item);
      drag.target = target;
      showDropMarker(target, itemSize(item), canDrop(item, drag.key, target));
    }, { passive: false });

    const finish = (event) => {
      if (!drag || drag.item !== item || drag.pointerId !== event.pointerId) return;
      const active = drag;
      drag = null;
      if (active.moved) {
        const accepted = commitDrop(item, active.key, active.target);
        suppressClickUntil = performance.now() + 450;
        if (!accepted) item.animate(
          [{ transform: item.style.transform }, { transform: 'translate3d(0,0,0) scale(1)' }],
          { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      }
      clearDragVisual(item);
      try { item.releasePointerCapture(event.pointerId); } catch {}
    };
    item.addEventListener('pointerup', finish);
    item.addEventListener('pointercancel', finish);
  }

  homeContent.addEventListener('click', (event) => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  doneButton.addEventListener('click', () => {
    homeScreen.classList.remove('springboard-editing');
    hideDropMarker();
  }, true);

  homeContent.addEventListener('scroll', () => {
    if (homeContent.scrollLeft !== 0) homeContent.scrollLeft = 0;
    if (homeContent.scrollTop !== 0) homeContent.scrollTop = 0;
  }, { passive: true });

  window.addEventListener('resize', queueDecorate, { passive: true });
  window.visualViewport?.addEventListener('resize', queueDecorate, { passive: true });

  const observer = new MutationObserver(queueDecorate);
  observer.observe(homeScreen, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  queueDecorate();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupSpringBoard, { once: true });
else setupSpringBoard();
