export const frameDefaults = Object.freeze({ style: 'standard' });

export const frameStyles = Object.freeze({
  standard: Object.freeze({ icon: 'inset 0 0 0 1px rgba(255,255,255,.16)', widget: 'inset 0 0 0 1px rgba(255,255,255,.12)', dock: 'inset 0 0 0 1px rgba(255,255,255,.16)' }),
  none: Object.freeze({ icon: 'inset 0 0 0 0 transparent', widget: 'inset 0 0 0 0 transparent', dock: 'inset 0 0 0 0 transparent' }),
  top: Object.freeze({ icon: 'inset 0 1px 0 rgba(255,255,255,.42)', widget: 'inset 0 1px 0 rgba(255,255,255,.36)', dock: 'inset 0 1px 0 rgba(255,255,255,.38)' }),
  sculpted: Object.freeze({ icon: 'inset 0 1px 0 rgba(255,255,255,.38), inset 0 -1px 0 rgba(0,0,0,.28)', widget: 'inset 0 1px 0 rgba(255,255,255,.32), inset 0 -1px 0 rgba(0,0,0,.3)', dock: 'inset 0 1px 0 rgba(255,255,255,.34), inset 0 -1px 0 rgba(0,0,0,.25)' }),
});

export function resolveFrameMaterial(value = {}) {
  const style = Object.hasOwn(frameStyles, value.style) ? value.style : frameDefaults.style;
  return { style, ...frameStyles[style] };
}

export function applyFrameMaterial(target, value) {
  const material = resolveFrameMaterial(value);
  target.style.setProperty('--frame-icon', material.icon);
  target.style.setProperty('--frame-widget', material.widget);
  target.style.setProperty('--frame-dock', material.dock);
  target.dataset.frameStyle = material.style;
  return material;
}
