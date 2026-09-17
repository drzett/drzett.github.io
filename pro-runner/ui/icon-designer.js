import { STORES, write } from '../core/storage.js';

const colors = ['#1c1c1e', '#343a40', '#0d3b66', '#24513a', '#6b2737', '#7a3e16', '#5a4788', '#e8e4dc'];
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const render = (config) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${config.color}"/><stop offset="1" stop-color="#050506"/></linearGradient></defs><rect width="128" height="128" rx="30" fill="url(#g)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="#fff" stroke-opacity=".25"/><text x="${64 + config.x}" y="${69 + config.y}" fill="#fff" font-family="-apple-system,Apple Color Emoji,Segoe UI Emoji,sans-serif" font-size="${config.size}" font-weight="700" text-anchor="middle" dominant-baseline="central" transform="rotate(${config.rotate} 64 64)">${escape(config.text)}</text></svg>`;

function dialog() {
  let node = document.getElementById('iconDesignerDialog'); if (node) return node;
  node = document.createElement('dialog'); node.id = 'iconDesignerDialog'; node.className = 'modal';
  node.innerHTML = '<div class="modal-card icon-designer-card"><div class="modal-head"><div><span class="eyebrow">ICON DESIGNER</span><h2>Design app icon</h2></div><button class="close-button" type="button">×</button></div><div class="icon-designer-body"><div class="icon-designer-preview"></div><label class="field"><span>Text or emoji</span><input class="designer-text" maxlength="8"></label><div class="designer-colors"></div><label class="range-row"><span>Size</span><input class="designer-size" type="range" min="24" max="116"></label><label class="range-row"><span>Horizontal position</span><input class="designer-x" type="range" min="-34" max="34"></label><label class="range-row"><span>Vertical position</span><input class="designer-y" type="range" min="-34" max="34"></label><label class="range-row"><span>Rotation</span><input class="designer-rotate" type="range" min="-35" max="35"></label></div><div class="modal-actions"><button class="designer-cancel subtle-button" type="button">Cancel</button><button class="designer-save primary-button" type="button">Use icon</button></div></div>';
  document.body.append(node); node.querySelector('.close-button').onclick = () => node.close(); node.querySelector('.designer-cancel').onclick = () => node.close(); return node;
}

export async function openIconDesigner({ project, onSaved }) {
  const node = dialog(); const record = await new Promise((resolve) => { const request = indexedDB.open('pro-runner-v1'); request.onsuccess = () => { const get = request.result.transaction('assets').objectStore('assets').get(`icon:${project.id}`); get.onsuccess = () => resolve(get.result); }; request.onerror = () => resolve(null); });
  const config = { color: '#343a40', text: '', size: 74, x: 0, y: 0, rotate: 0, ...(record?.config || {}) };
  const preview = node.querySelector('.icon-designer-preview'); const controls = ['text', 'size', 'x', 'y', 'rotate'].map((key) => [key, node.querySelector(`.designer-${key}`)]);
  for (const [key, control] of controls) { control.value = config[key]; control.oninput = () => { config[key] = control.value; draw(); }; }
  const colorsNode = node.querySelector('.designer-colors'); colorsNode.replaceChildren(...colors.map((color) => { const button = document.createElement('button'); button.type = 'button'; button.style.background = color; button.className = 'designer-color'; button.onclick = () => { config.color = color; draw(); }; return button; }));
  const draw = () => { preview.innerHTML = render(config); };
  node.querySelector('.designer-save').onclick = async () => { const svg = render(config); await write(STORES.assets, { key: `icon:${project.id}`, bytes: new TextEncoder().encode(svg).buffer, type: 'image/svg+xml', source: 'icon-designer-v2', config: { ...config }, updatedAt: Date.now() }); node.close(); onSaved?.(); };
  draw(); node.showModal();
}
