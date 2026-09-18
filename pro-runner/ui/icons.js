import { read, STORES } from '../core/storage.js';
import { projectURL } from '../core/projects.js';

const urls = new Map();

export function initials(name) { return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '↗'; }
export function gradient(name) { let value = 0; for (const char of String(name || '')) value = ((value << 5) - value + char.charCodeAt(0)) | 0; const hue = Math.abs(value) % 360; return `linear-gradient(145deg,hsl(${hue} 28% 42%),hsl(${(hue + 28) % 360} 28% 18%))`; }

function objectURL(key, bytes, type) {
  if (urls.has(key)) return urls.get(key);
  const value = URL.createObjectURL(new Blob([bytes], { type: type || 'image/png' })); urls.set(key, value); return value;
}

export async function renderIcon(node, project) {
  node.replaceChildren(); node.style.background = gradient(project.name);
  const custom = await read(STORES.assets, `icon:${project.id}`).catch(() => null);
  const src = custom?.bytes ? objectURL(`icon:${project.id}:${custom.updatedAt || custom.bytes.byteLength}`, custom.bytes, custom.type) : project.type === 'local' && project.iconPath ? projectURL(project.id, project.iconPath) : project.remoteIconUrl;
  if (src) {
    const image = document.createElement('img'); image.alt = ''; image.draggable = false; image.referrerPolicy = 'no-referrer'; image.src = src;
    image.addEventListener('error', () => fallback(node, project), { once: true }); node.append(image); return;
  }
  fallback(node, project);
}

export function fallback(node, project) { node.replaceChildren(); const label = document.createElement('span'); label.className = 'icon-fallback'; label.textContent = initials(project.name); node.append(label); }
export function releaseIcons() { for (const value of urls.values()) URL.revokeObjectURL(value); urls.clear(); }
