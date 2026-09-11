const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DB_NAME = 'pro-runner-v1';
const ASSET_STORE = 'assets';
const PROJECT_STORE = 'projects';
const SOURCE = 'icon-designer-v142';

const BACKGROUNDS = [
  { id:'jet', name:'Jet Black', kind:'solid', a:'#050506', b:'#050506', edge:'#26272b' },
  { id:'obsidian', name:'Obsidian', kind:'glass', a:'#27292e', b:'#070809', edge:'#3a3d43' },
  { id:'graphite', name:'Graphite', kind:'glass', a:'#555b65', b:'#17191d', edge:'#666c75' },
  { id:'black-glass', name:'Black Glass', kind:'glass', a:'#34363c', b:'#08090b', edge:'#4c4f56' },
  { id:'carbon', name:'Carbon Fiber', kind:'carbon', a:'#22252a', b:'#090a0c', edge:'#3b3e44' },
  { id:'forged', name:'Forged Carbon', kind:'forged', a:'#282b30', b:'#090a0c', edge:'#44484f' },
  { id:'brushed', name:'Brushed Metal', kind:'brushed', a:'#3c4148', b:'#15171a', edge:'#5b6068' },
  { id:'slate', name:'Slate', kind:'glass', a:'#46515d', b:'#151a20', edge:'#61707e' },
  { id:'midnight', name:'Midnight', kind:'glass', a:'#263654', b:'#090d17', edge:'#40547b' },
  { id:'cobalt', name:'Cobalt', kind:'glass', a:'#3275e8', b:'#10234f', edge:'#5c91ee' },
  { id:'forest', name:'Forest', kind:'glass', a:'#397253', b:'#10251b', edge:'#56906d' },
  { id:'burgundy', name:'Burgundy', kind:'glass', a:'#713449', b:'#260d17', edge:'#98536c' },
  { id:'ember', name:'Ember', kind:'glass', a:'#9a5136', b:'#35160d', edge:'#c17457' },
  { id:'violet', name:'Violet', kind:'glass', a:'#69509a', b:'#211430', edge:'#8b73ba' },
  { id:'cream', name:'Warm Light', kind:'glass', a:'#f0ede6', b:'#a9a59f', edge:'#ffffff', light:true },
  { id:'ice', name:'Ice', kind:'glass', a:'#dfe9f1', b:'#91a6b5', edge:'#ffffff', light:true },
];

const EMOJI_GROUPS = [
  ['Faces','😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😎 🤓 🧐 🤩 😍 🥰 😇 🤖 👻 💀 ☠️ 👽 👾 🥳 😈 👿 🤠 🤯 🫠 🫡 🤔 🤫 🤐 😴'],
  ['Hands','👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👋 ✋ 🖐️ 🫶 🙌 👏 🤝 💪 🫵 👉 👈 ☝️ 👇 ✍️ 🙏'],
  ['Nature','🌱 🌿 ☘️ 🍀 🌵 🌴 🌲 🌳 🍁 🍂 🌸 🌺 🌻 🌹 🪷 🌊 🔥 💧 ❄️ ☀️ 🌙 ⭐ 🌟 ✨ ⚡ ☁️ 🌈'],
  ['Animals','🐈 🐕 🐺 🦊 🐻 🐼 🐨 🦁 🐯 🐸 🐵 🦄 🐝 🦋 🐞 🦅 🦉 🐍 🦎 🐢 🐙 🦑 🐬 🐋 🦈'],
  ['Food','🍎 🍊 🍋 🍉 🍇 🍓 🫐 🍒 🥝 🥑 🌶️ 🍕 🍔 🌮 🍣 🍜 🍩 🍪 🍫 ☕ 🍵 🥤 🧊'],
  ['Travel','🚗 🏎️ 🚕 🚌 🚎 🏍️ 🚲 ✈️ 🚀 🛸 🚁 🚂 🚆 🚇 🚢 ⛵ 🗺️ 🧭 🏠 🏢 🌆 🌃'],
  ['Media','🎧 🎵 🎶 🎤 🎸 🎹 🥁 🎷 🎺 📻 🎛️ 🎚️ 🔊 🔉 🔈 🎬 🎥 📷 📸 📺 ▶️ ⏯️ ⏭️ ⏮️'],
  ['Tech','💻 🖥️ ⌨️ 🖱️ 📱 ⌚ 🕹️ 🎮 💾 💿 📀 🔌 🔋 🪫 📡 🛰️ 🤖 ⚙️ 🛠️ 🔧 🔩 🧰 🧲 💡'],
  ['Work','📁 📂 🗂️ 📄 📑 📝 ✏️ 📌 📍 📎 🔗 📊 📈 📉 🗓️ 📅 ⏱️ ⏰ 🔍 🔎 🧮 💼 🗃️'],
  ['Objects','🔒 🔓 🔐 🔑 🗝️ 🛡️ ⚔️ 🧪 🧬 🔬 🔭 💊 🩹 🧯 🧹 🪄 🎁 💎 🪙 💰 🧱 🪩 🔔'],
  ['Symbols','❤️ 🖤 🤍 💙 💚 💛 🧡 💜 💗 💯 ✅ ❌ ⭕ ❗ ❓ ➕ ➖ ✖️ ➗ ♾️ ☯️ ☮️ ⚛️ 🔄 🔁 🔀'],
  ['Shapes','⬛ ⬜ 🟥 🟧 🟨 🟩 🟦 🟪 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🔺 🔻 🔶 🔷 🔸 🔹 ◼️ ◻️'],
];
const QUICK_EMOJIS = EMOJI_GROUPS.flatMap(([group, value]) => value.split(/\s+/).filter(Boolean).map((emoji) => ({ group, emoji })));

const DEFAULT_CONFIG = {
  background:'obsidian', mode:'emoji', content:'✨', scale:60, x:0, y:0,
  color:'#ffffff', weight:750, effect:'shadow', gloss:true,
};

const style = document.createElement('style');
style.textContent = `
.icon-designer-card{width:min(760px,calc(100vw - 20px));height:min(86dvh,820px);overflow:hidden;display:flex;flex-direction:column;padding:0!important}
.icon-designer-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:18px 19px 14px;border-bottom:1px solid var(--line)}
.icon-designer-head h2{margin:4px 0 0;font-size:22px}.icon-designer-body{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:0;flex:1}
.icon-designer-preview-pane{padding:18px;border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;gap:14px;align-items:center;background:rgba(0,0,0,.12)}
.icon-designer-preview{width:164px;max-width:100%;aspect-ratio:1;border-radius:26%;overflow:hidden;box-shadow:0 18px 42px rgba(0,0,0,.35)}.icon-designer-preview img{width:100%;height:100%;display:block}
.icon-designer-controls{min-width:0;overflow:auto;padding:16px 17px 20px;-webkit-overflow-scrolling:touch}.designer-section{border-top:1px solid rgba(255,255,255,.07);padding-top:14px;margin-top:14px}.designer-section:first-child{border-top:0;padding-top:0;margin-top:0}.designer-section h3{margin:0 0 9px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.designer-backgrounds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.designer-bg{border:2px solid transparent;border-radius:13px;padding:0;background:transparent;cursor:pointer}.designer-bg.active{border-color:#fff}.designer-bg img{display:block;width:100%;aspect-ratio:1;border-radius:10px}.designer-bg small{display:block;margin-top:4px;color:var(--muted);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.designer-segment{display:grid;grid-template-columns:repeat(3,1fr);padding:3px;background:rgba(255,255,255,.055);border-radius:11px}.designer-segment button{border:0;background:transparent;color:var(--muted);border-radius:8px;padding:7px;font-size:10px}.designer-segment button.active{background:rgba(255,255,255,.13);color:var(--text)}
.designer-field{display:grid;gap:6px;margin-top:10px;color:var(--muted);font-size:10px}.designer-field input[type="text"],.designer-field select{width:100%;border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--text);border-radius:11px;padding:9px 10px;outline:none}.designer-field input[type="range"]{width:100%}.designer-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.designer-check{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:10px;margin-top:10px}.designer-check input{width:16px;height:16px}
.emoji-hint{margin:8px 0;color:var(--faint);font-size:9px;line-height:1.4}.emoji-filter{width:100%;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);border-radius:10px;padding:8px 9px;margin-bottom:8px}.emoji-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;max-height:180px;overflow:auto;padding-right:2px}.emoji-option{border:0;background:rgba(255,255,255,.035);border-radius:8px;aspect-ratio:1;font-size:20px;display:grid;place-items:center;padding:0}.emoji-option:active{background:rgba(255,255,255,.12)}
.designer-color-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.designer-color{width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.15);padding:0}.designer-color.active{border-color:white;box-shadow:0 0 0 2px rgba(255,255,255,.18)}
.icon-designer-foot{display:flex;align-items:center;gap:8px;padding:12px 14px max(12px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.07);background:rgba(15,16,19,.95)}.icon-designer-foot .primary-button{margin-left:auto}
@media(max-width:620px){.icon-designer-card{height:min(90dvh,840px)}.icon-designer-body{grid-template-columns:1fr}.icon-designer-preview-pane{border-right:0;border-bottom:1px solid rgba(255,255,255,.07);padding:12px;flex-direction:row;justify-content:center}.icon-designer-preview{width:112px}.icon-designer-controls{padding:14px}.designer-backgrounds{grid-template-columns:repeat(4,1fr)}.emoji-grid{grid-template-columns:repeat(7,1fr);max-height:150px}}
`;
document.head.append(style);

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open local storage.'));
  });
}
async function dbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
async function dbPut(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[char]));
}
function backgroundById(id) { return BACKGROUNDS.find((item) => item.id === id) || BACKGROUNDS[0]; }
function backgroundMarkup(background) {
  const edge = background.edge || '#444';
  if (background.kind === 'solid') {
    return `<rect width="128" height="128" rx="30" fill="${background.a}"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".65"/>`;
  }
  if (background.kind === 'carbon') {
    return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background.a}"/><stop offset="1" stop-color="${background.b}"/></linearGradient><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="transparent"/><path d="M0 0h4v4H0zM4 4h4v4H4z" fill="#fff" opacity=".045"/><path d="M4 0h4v4H4zM0 4h4v4H0z" fill="#000" opacity=".17"/></pattern><radialGradient id="shine" cx=".18" cy=".08" r=".95"><stop stop-color="#fff" stop-opacity=".18"/><stop offset=".72" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="128" rx="30" fill="url(#p)"/><rect width="128" height="128" rx="30" fill="url(#shine)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".5"/>`;
  }
  if (background.kind === 'forged') {
    return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background.a}"/><stop offset="1" stop-color="${background.b}"/></linearGradient><pattern id="p" width="28" height="24" patternUnits="userSpaceOnUse"><path d="M1 2l10-2 6 7-8 5zM17 10l10-3-2 10-9 3zM0 16l8-3 8 7-13 4z" fill="#fff" opacity=".035"/><path d="M12 1l8 3-3 5-8-4zM6 11l9 1-3 7-9-2z" fill="#000" opacity=".20"/></pattern><radialGradient id="shine" cx=".18" cy=".08" r=".95"><stop stop-color="#fff" stop-opacity=".16"/><stop offset=".72" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="128" rx="30" fill="url(#p)"/><rect width="128" height="128" rx="30" fill="url(#shine)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".55"/>`;
  }
  if (background.kind === 'brushed') {
    return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background.a}"/><stop offset="1" stop-color="${background.b}"/></linearGradient><pattern id="p" width="1" height="4" patternUnits="userSpaceOnUse"><path d="M0 .5h1M0 2.5h1" stroke="#fff" stroke-opacity=".035" stroke-width=".45"/><path d="M0 1.5h1M0 3.5h1" stroke="#000" stroke-opacity=".10" stroke-width=".45"/></pattern></defs><rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="128" rx="30" fill="url(#p)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".55"/>`;
  }
  return `<defs><linearGradient id="bg" x1=".08" y1="0" x2=".9" y2="1"><stop stop-color="${background.a}"/><stop offset="1" stop-color="${background.b}"/></linearGradient><radialGradient id="shine" cx=".17" cy=".04" r=".92"><stop stop-color="#fff" stop-opacity=".24"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".28"/><stop offset=".42" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs><rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="128" rx="30" fill="url(#shine)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="url(#edge)" stroke-width="1.4"/>`;
}

function effectFilter(config) {
  if (config.effect === 'glow') return 'filter="url(#fgGlow)"';
  if (config.effect === 'shadow') return 'filter="url(#fgShadow)"';
  return '';
}
function renderSvg(config, previewOnlyBackground = false) {
  const bg = backgroundById(config.background);
  const gloss = config.gloss ? `<path d="M10 8h108v44c-24 8-82 10-108 2z" fill="#fff" opacity=".035"/>` : '';
  let foreground = '';
  if (!previewOnlyBackground && config.mode !== 'none' && config.content) {
    const size = Math.max(20, Math.min(110, Number(config.scale) || 60));
    const x = 64 + Math.max(-30, Math.min(30, Number(config.x) || 0));
    const y = 66 + Math.max(-30, Math.min(30, Number(config.y) || 0));
    const content = escapeXml(config.content);
    const filter = effectFilter(config);
    if (config.mode === 'emoji') {
      foreground = `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif" font-size="${size}" ${filter}>${content}</text>`;
    } else {
      foreground = `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,Arial,sans-serif" font-size="${size}" font-weight="${Number(config.weight)||750}" letter-spacing="-1.8" fill="${escapeXml(config.color || '#fff')}" ${filter}>${content}</text>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><filter id="fgShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".46"/></filter><filter id="fgGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${backgroundMarkup(bg)}${gloss}${foreground}</svg>`;
}
function svgDataUrl(svg) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }

let activeProjectId = null;
let config = { ...DEFAULT_CONFIG };
let dialog = null;

function rememberProject(event) {
  const node = event.target.closest?.('.home-app[data-id],.project-card[data-id]');
  if (node?.dataset.id) activeProjectId = node.dataset.id;
}
async function resolveActiveProjectId() {
  if (activeProjectId) return activeProjectId;
  const name = $('#projectNameInput')?.value?.trim();
  if (!name) return null;
  const projects = await dbGetAll(PROJECT_STORE).catch(() => []);
  activeProjectId = projects.find((project) => project.name === name)?.id || null;
  return activeProjectId;
}

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'iconDesignerDialog';
  dialog.className = 'modal';
  dialog.innerHTML = `<div class="modal-card icon-designer-card">
    <div class="icon-designer-head"><div><span class="eyebrow">ICON DESIGNER</span><h2>Design app icon</h2></div><button id="designerClose" class="close-button" type="button" aria-label="Close">×</button></div>
    <div class="icon-designer-body">
      <aside class="icon-designer-preview-pane"><div class="icon-designer-preview"><img id="designerPreview" alt="Icon preview"></div><small style="color:var(--faint);text-align:center;line-height:1.4">Generated locally. No icon assets are downloaded.</small></aside>
      <div class="icon-designer-controls">
        <section class="designer-section"><h3>Background</h3><div id="designerBackgrounds" class="designer-backgrounds"></div><label class="designer-check"><input id="designerGloss" type="checkbox"> Subtle top gloss</label></section>
        <section class="designer-section"><h3>Foreground</h3><div id="designerMode" class="designer-segment"><button data-mode="emoji" type="button">Emoji</button><button data-mode="text" type="button">Text</button><button data-mode="none" type="button">None</button></div>
          <div id="designerEmojiPanel"><label class="designer-field"><span>Emoji or emoji sequence</span><input id="designerContentEmoji" type="text" inputmode="text" autocomplete="off" placeholder="✨"></label><p class="emoji-hint">Tap the field and use the system emoji keyboard for the complete emoji catalog. The browser renders the emoji with the device's native emoji font.</p><input id="designerEmojiFilter" class="emoji-filter" type="search" placeholder="Filter quick emoji by category"><div id="designerEmojiGrid" class="emoji-grid"></div></div>
          <div id="designerTextPanel" class="hidden"><label class="designer-field"><span>Letters / text</span><input id="designerContentText" type="text" maxlength="5" autocomplete="off" placeholder="LL"></label><div class="designer-color-row" id="designerColors"></div><label class="designer-field"><span>Weight</span><select id="designerWeight"><option value="500">Medium</option><option value="650">Semibold</option><option value="750">Bold</option><option value="850">Heavy</option></select></label></div>
        </section>
        <section class="designer-section"><h3>Placement</h3><label class="designer-field"><span>Scale <output id="designerScaleValue">60%</output></span><input id="designerScale" type="range" min="24" max="104" step="1"></label><div class="designer-row"><label class="designer-field"><span>Horizontal</span><input id="designerX" type="range" min="-22" max="22" step="1"></label><label class="designer-field"><span>Vertical</span><input id="designerY" type="range" min="-22" max="22" step="1"></label></div><label class="designer-field"><span>Foreground effect</span><select id="designerEffect"><option value="none">Clean</option><option value="shadow">Soft shadow</option><option value="glow">Soft glow</option></select></label></section>
      </div>
    </div>
    <div class="icon-designer-foot"><button id="designerImage" class="subtle-button" type="button">Choose image…</button><button id="designerCancel" class="text-button" type="button">Cancel</button><button id="designerSave" class="primary-button" type="button">Save icon</button></div>
  </div>`;
  document.body.append(dialog);
  $('#designerClose', dialog).addEventListener('click', () => dialog.close());
  $('#designerCancel', dialog).addEventListener('click', () => dialog.close());
  $('#designerImage', dialog).addEventListener('click', () => { dialog.close(); $('#iconPicker')?.click(); });
  $('#designerSave', dialog).addEventListener('click', saveDesignerIcon);
  $('#designerGloss', dialog).addEventListener('change', (event) => { config.gloss = event.target.checked; updatePreview(); });
  $('#designerScale', dialog).addEventListener('input', (event) => { config.scale = Number(event.target.value); updatePreview(); });
  $('#designerX', dialog).addEventListener('input', (event) => { config.x = Number(event.target.value); updatePreview(); });
  $('#designerY', dialog).addEventListener('input', (event) => { config.y = Number(event.target.value); updatePreview(); });
  $('#designerEffect', dialog).addEventListener('change', (event) => { config.effect = event.target.value; updatePreview(); });
  $('#designerWeight', dialog).addEventListener('change', (event) => { config.weight = Number(event.target.value); updatePreview(); });
  $('#designerContentEmoji', dialog).addEventListener('input', (event) => { if (config.mode === 'emoji') { config.content = event.target.value; updatePreview(); } });
  $('#designerContentText', dialog).addEventListener('input', (event) => { if (config.mode === 'text') { config.content = event.target.value; updatePreview(); } });
  $('#designerEmojiFilter', dialog).addEventListener('input', renderEmojiGrid);
  for (const button of $$('#designerMode button', dialog)) button.addEventListener('click', () => setMode(button.dataset.mode));
  renderBackgrounds();
  renderColors();
  renderEmojiGrid();
  return dialog;
}

function renderBackgrounds() {
  const host = $('#designerBackgrounds', dialog);
  host.replaceChildren();
  for (const background of BACKGROUNDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `designer-bg${config.background === background.id ? ' active' : ''}`;
    button.title = background.name;
    button.innerHTML = `<img alt="" src="${svgDataUrl(renderSvg({ ...DEFAULT_CONFIG, background:background.id, mode:'none', content:'' }, true))}"><small>${background.name}</small>`;
    button.addEventListener('click', () => { config.background = background.id; renderBackgrounds(); updatePreview(); });
    host.append(button);
  }
}

const TEXT_COLORS = ['#ffffff','#d9dde4','#0b0c0e','#ff453a','#ff9f0a','#ffd60a','#32d74b','#64d2ff','#0a84ff','#bf5af2'];
function renderColors() {
  const host = $('#designerColors', dialog);
  host.replaceChildren();
  for (const color of TEXT_COLORS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `designer-color${config.color === color ? ' active' : ''}`;
    button.style.background = color;
    button.title = color;
    button.addEventListener('click', () => { config.color = color; renderColors(); updatePreview(); });
    host.append(button);
  }
}

function renderEmojiGrid() {
  if (!dialog) return;
  const host = $('#designerEmojiGrid', dialog);
  const query = $('#designerEmojiFilter', dialog)?.value.trim().toLowerCase() || '';
  host.replaceChildren();
  for (const entry of QUICK_EMOJIS) {
    if (query && !entry.group.toLowerCase().includes(query) && !entry.emoji.includes(query)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-option';
    button.textContent = entry.emoji;
    button.title = entry.group;
    button.addEventListener('click', () => {
      config.mode = 'emoji';
      config.content = entry.emoji;
      $('#designerContentEmoji', dialog).value = entry.emoji;
      setMode('emoji', false);
      updatePreview();
    });
    host.append(button);
  }
}

function setMode(mode, resetContent = true) {
  config.mode = mode;
  for (const button of $$('#designerMode button', dialog)) button.classList.toggle('active', button.dataset.mode === mode);
  $('#designerEmojiPanel', dialog).classList.toggle('hidden', mode !== 'emoji');
  $('#designerTextPanel', dialog).classList.toggle('hidden', mode !== 'text');
  if (resetContent) {
    if (mode === 'emoji') config.content = $('#designerContentEmoji', dialog).value || '✨';
    if (mode === 'text') config.content = $('#designerContentText', dialog).value || 'APP';
    if (mode === 'none') config.content = '';
  }
  updatePreview();
}

function syncControls() {
  ensureDialog();
  $('#designerGloss', dialog).checked = Boolean(config.gloss);
  $('#designerScale', dialog).value = String(config.scale);
  $('#designerX', dialog).value = String(config.x);
  $('#designerY', dialog).value = String(config.y);
  $('#designerEffect', dialog).value = config.effect;
  $('#designerWeight', dialog).value = String(config.weight);
  $('#designerContentEmoji', dialog).value = config.mode === 'emoji' ? config.content : '✨';
  $('#designerContentText', dialog).value = config.mode === 'text' ? config.content : 'APP';
  renderBackgrounds();
  renderColors();
  setMode(config.mode, false);
  updatePreview();
}

function updatePreview() {
  if (!dialog) return;
  $('#designerScaleValue', dialog).textContent = `${config.scale}%`;
  $('#designerPreview', dialog).src = svgDataUrl(renderSvg(config));
}

async function openDesigner() {
  const id = await resolveActiveProjectId();
  if (!id) return;
  const stored = await dbGet(ASSET_STORE, `icon:${id}`).catch(() => null);
  config = stored?.source === SOURCE && stored?.designer ? { ...DEFAULT_CONFIG, ...stored.designer } : { ...DEFAULT_CONFIG };
  syncControls();
  dialog.showModal();
}

function setRenderedIcon(element, url, stamp = '') {
  if (!element) return;
  element.replaceChildren();
  const image = document.createElement('img');
  image.alt = '';
  image.src = url;
  image.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
  element.append(image);
  if (stamp) element.dataset.designer142 = stamp;
}

async function saveDesignerIcon() {
  const id = await resolveActiveProjectId();
  if (!id) return;
  const svg = renderSvg(config);
  const updatedAt = Date.now();
  const record = {
    key:`icon:${id}`,
    bytes:new TextEncoder().encode(svg).buffer,
    type:'image/svg+xml',
    source:SOURCE,
    designer:{ ...config },
    updatedAt,
  };
  await dbPut(ASSET_STORE, record);
  const url = svgDataUrl(svg);
  const stamp = `${id}:${updatedAt}`;
  setRenderedIcon($('#projectIconPreview'), url, stamp);
  const escaped = CSS.escape(id);
  for (const element of $$(`.home-app[data-id="${escaped}"] .home-app-icon,.project-card[data-id="${escaped}"] .app-icon`)) setRenderedIcon(element, url, stamp);
  dialog.close();
}

async function refreshDesignerIcons() {
  const ids = new Set([
    ...$$('.home-app[data-id]').map((element) => element.dataset.id),
    ...$$('.project-card[data-id]').map((element) => element.dataset.id),
  ]);
  for (const id of ids) {
    const asset = await dbGet(ASSET_STORE, `icon:${id}`).catch(() => null);
    if (!asset?.bytes || asset.source !== SOURCE) continue;
    const stamp = `${id}:${asset.updatedAt || 0}`;
    const blob = new Blob([asset.bytes], { type:asset.type || 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const escaped = CSS.escape(id);
    for (const element of $$(`.home-app[data-id="${escaped}"] .home-app-icon,.project-card[data-id="${escaped}"] .app-icon`)) {
      if (element.dataset.designer142 !== stamp) setRenderedIcon(element, url, stamp);
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

let wired = false;
function wireDesigner() {
  if (!wired) {
    wired = true;
    document.addEventListener('pointerdown', rememberProject, true);
    document.addEventListener('click', rememberProject, true);
  }
  const choose = $('#chooseIconButton');
  if (choose && choose.dataset.designer142 !== '1') {
    choose.dataset.designer142 = '1';
    choose.textContent = 'Design or choose icon';
    choose.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await openDesigner();
    }, true);
  }
}

let refreshQueued = false;
function decorate() {
  wireDesigner();
  refreshDesignerIcons();
}
function queueDecorate() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    decorate();
  });
}

new MutationObserver(queueDecorate).observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class'] });
decorate();
