import { firstFree, GRID_COLUMNS, itemCells, moveDockItem, validPosition } from '../core/home-state.js';

export function createHomeController({ home, content, grid, dock, done, load, save, onOpen, onEdit, onDelete }) {
  let editing = false; let drag = null; let marker = null; let ghost = null; let suppressUntil = 0;
  const itemKey = (node) => node.dataset.runner === 'true' ? 'runner' : node.dataset.id ? `project:${node.dataset.id}` : node.dataset.widget ? `widget:${node.dataset.widget}` : null;
  const itemSize = (node) => node.dataset.widget ? { w: 2, h: 2 } : { w: 1, h: 1 };
  const gridMetrics = () => { const rect = content.getBoundingClientRect(); const style = getComputedStyle(content); const gap = parseFloat(style.columnGap) || 0; const rowGap = parseFloat(style.rowGap) || gap; const cell = (rect.width - gap * 3) / 4; return { rect, gap, rowGap, cell, rows: Math.max(2, Math.floor((rect.height + rowGap) / Math.max(1, cell + rowGap))) }; };
  const items = () => [...content.querySelectorAll('[data-home-item="true"]')];
  const gridItems = () => items().filter((node) => node.parentElement !== dock);
  const isDocked = (node, state) => state.dock.includes(itemKey(node));

  function setEditing(value) { editing = value; home.classList.toggle('springboard-editing', value); done.classList.toggle('hidden', !value); for (const node of items()) node.classList.toggle('wiggle', value); }
  function position(node, value, size) { node.style.gridColumn = `${value.col} / span ${size.w}`; node.style.gridRow = `${value.row} / span ${size.h}`; }
  function clearPosition(node) { node.style.removeProperty('grid-column'); node.style.removeProperty('grid-row'); }
  function normalize(state) {
    const metric = gridMetrics(); const occupied = new Map();
    for (const node of gridItems()) { const key = itemKey(node); const size = itemSize(node); let value = state.positions[key]; if (!validPosition(value, size, metric.rows) || itemCells(value, size).some((cell) => occupied.has(cell))) value = firstFree(occupied, size, metric.rows); if (!value) continue; state.positions[key] = value; itemCells(value, size).forEach((cell) => occupied.set(cell, key)); position(node, value, size); }
    return state;
  }
  async function render() {
    const state = await load();
    for (const node of items()) { const key = itemKey(node); const parent = isDocked(node, state) ? dock : grid; if (node.parentElement !== parent) parent.append(node); clearPosition(node); }
    state.dock.forEach((key) => { const node = items().find((item) => itemKey(item) === key); if (node) dock.append(node); });
    normalize(state); await save(state); setEditing(editing);
  }
  function markerAt(position, size, allowed) { if (!marker) { marker = document.createElement('div'); marker.className = 'pro-portal-grid-marker'; content.append(marker); } marker.classList.toggle('blocked', !allowed); marker.style.gridColumn = `${position.col} / span ${size.w}`; marker.style.gridRow = `${position.row} / span ${size.h}`; }
  function clearVisual() { marker?.remove(); marker = null; ghost?.remove(); ghost = null; home.classList.remove('home-dock-drop'); }
  function target(event, node) { const metric = gridMetrics(); const size = itemSize(node); const dockRect = dock.getBoundingClientRect(); if (!node.dataset.widget && event.clientX >= dockRect.left - 12 && event.clientX <= dockRect.right + 12 && event.clientY >= dockRect.top - 12 && event.clientY <= dockRect.bottom + 12) return { zone: 'dock', index: Math.max(0, Math.min(4, Math.round((event.clientX - dockRect.left) / Math.max(1, dockRect.width) * 4))), size };
    const left = event.clientX - drag.offsetX - metric.rect.left; const top = event.clientY - drag.offsetY - metric.rect.top; const position = { col: Math.max(1, Math.min(GRID_COLUMNS - size.w + 1, Math.round(left / (metric.cell + metric.gap)) + 1)), row: Math.max(1, Math.min(metric.rows - size.h + 1, Math.round(top / (metric.cell + metric.rowGap)) + 1)) }; return { zone: 'grid', position, size, rows: metric.rows };
  }
  function start(event, node) { const rect = (node.querySelector('.home-app-icon') || node).getBoundingClientRect(); drag = { node, key: itemKey(node), pointer: event.pointerId, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, started: false, longFired: false, longTimer: null }; drag.longTimer = setTimeout(() => { if (drag && !drag.started) { drag.longFired = true; setEditing(true); } }, 560); }
  function begin(event) { drag.started = true; clearTimeout(drag.longTimer); ghost = drag.node.cloneNode(true); ghost.className = 'pro-drag-ghost'; ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id')); document.body.append(ghost); drag.node.classList.add('portal-drag-source'); try { home.setPointerCapture(event.pointerId); } catch {} }
  function move(event) { if (!drag || drag.pointer !== event.pointerId) return; const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y); if (!drag.started && !editing) { if (distance > 14) clearTimeout(drag.longTimer); return; } if (!drag.started && distance >= 6) begin(event); if (!drag.started) return; event.preventDefault(); const left = event.clientX - drag.offsetX; const top = event.clientY - drag.offsetY; ghost.style.transform = `translate3d(${left}px,${top}px,0) scale(1.05)`; drag.target = target(event, drag.node); if (drag.target.zone === 'grid') markerAt(drag.target.position, drag.target.size, true); else home.classList.add('home-dock-drop'); }
  async function finish(event) { if (!drag || drag.pointer !== event.pointerId) return; const active = drag; drag = null; clearTimeout(active.longTimer); if (!active.started) { if (active.longFired) suppressUntil = performance.now() + 700; return; } event.preventDefault(); suppressUntil = performance.now() + 700; const state = await load(); if (active.target?.zone === 'dock') state.dock = moveDockItem(state.dock, active.key, active.target.index); else if (active.target?.zone === 'grid') { state.dock = state.dock.filter((key) => key !== active.key); state.positions[active.key] = active.target.position; } await save(state); active.node.classList.remove('portal-drag-source'); clearVisual(); try { home.releasePointerCapture(event.pointerId); } catch {} await render(); }
  home.addEventListener('pointerdown', (event) => { const node = event.target.closest('[data-home-item="true"]'); if (!node || event.button > 0 || event.target.closest('button')) return; start(event, node); }, true);
  home.addEventListener('pointermove', move, { capture: true, passive: false });
  home.addEventListener('pointerup', finish, true); home.addEventListener('pointercancel', finish, true);
  home.addEventListener('click', (event) => { const node = event.target.closest('[data-home-item="true"]'); if (!node) return; if (performance.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; } if (editing) { if (event.target.closest('.app-delete-badge')) onDelete(node.dataset.id); else if (node.dataset.id) onEdit(node.dataset.id); return; } if (node.dataset.id) onOpen(node.dataset.id); }, true);
  done.addEventListener('click', () => setEditing(false)); window.addEventListener('resize', () => render(), { passive: true });
  return { render, enterEdit: () => setEditing(true), exitEdit: () => setEditing(false), isEditing: () => editing };
}
