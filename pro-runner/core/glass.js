export const glassDefaults = Object.freeze({ style: 'standard', intensity: 50 });

export const glassStyles = Object.freeze({
  standard: Object.freeze({
    panel: Object.freeze({ lowAlpha: .06, defaultAlpha: .54, blur: 28, saturation: 165 }),
    dock: Object.freeze({ lowAlpha: .035, defaultAlpha: .16, blur: 34, saturation: 180 }),
    brightness: 1,
    highlight: 0,
  }),
  clear: Object.freeze({
    panel: Object.freeze({ lowAlpha: .025, defaultAlpha: .34, blur: 16, saturation: 195 }),
    dock: Object.freeze({ lowAlpha: .02, defaultAlpha: .10, blur: 20, saturation: 210 }),
    brightness: 1.06,
    highlight: .09,
  }),
  frosted: Object.freeze({
    panel: Object.freeze({ lowAlpha: .08, defaultAlpha: .68, blur: 42, saturation: 135 }),
    dock: Object.freeze({ lowAlpha: .05, defaultAlpha: .28, blur: 48, saturation: 145 }),
    brightness: 1.08,
    highlight: .18,
  }),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (from, to, amount) => from + ((to - from) * amount);

function opacityAt(surface, intensity) {
  if (intensity <= 50) return mix(surface.lowAlpha, surface.defaultAlpha, intensity / 50);
  return mix(surface.defaultAlpha, 1, (intensity - 50) / 50);
}

export function resolveGlassMaterial(value = {}) {
  const style = Object.hasOwn(glassStyles, value.style) ? value.style : glassDefaults.style;
  const intensity = clamp(Number.isFinite(Number(value.intensity)) ? Number(value.intensity) : glassDefaults.intensity, 0, 100);
  const preset = glassStyles[style];
  return {
    style,
    intensity,
    panelAlpha: opacityAt(preset.panel, intensity),
    dockAlpha: opacityAt(preset.dock, intensity),
    panelBlur: preset.panel.blur,
    dockBlur: preset.dock.blur,
    panelSaturation: preset.panel.saturation,
    dockSaturation: preset.dock.saturation,
    brightness: preset.brightness,
    highlight: intensity === 100 ? 0 : preset.highlight,
  };
}

export function applyGlassMaterial(target, value) {
  const material = resolveGlassMaterial(value);
  const tokens = {
    '--glass-panel-alpha': material.panelAlpha,
    '--glass-dock-alpha': material.dockAlpha,
    '--glass-panel-blur': `${material.panelBlur}px`,
    '--glass-dock-blur': `${material.dockBlur}px`,
    '--glass-panel-saturation': `${material.panelSaturation}%`,
    '--glass-dock-saturation': `${material.dockSaturation}%`,
    '--glass-brightness': material.brightness,
    '--glass-highlight-alpha': material.highlight,
  };
  for (const [name, token] of Object.entries(tokens)) target.style.setProperty(name, String(token));
  target.dataset.glassStyle = material.style;
  return material;
}
