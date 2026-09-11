const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const css = `
.home-screen { overflow:hidden!important; overscroll-behavior:none!important; }
.home-content {
  overflow:hidden!important;
  overscroll-behavior:none!important;
  touch-action:none!important;
  padding-bottom:0!important;
}
.spring-overflow { display:none!important; }
.home-widget { border-radius:calc(var(--spring-cell,78px) * .46)!important; }
.calendar-widget { background:linear-gradient(155deg,rgba(27,27,30,.94),rgba(11,12,15,.96))!important; }
.calendar-head { align-items:start!important; }
.calendar-head strong { color:#ff453a!important; font-weight:760!important; letter-spacing:-.02em; }
.calendar-head span { color:rgba(255,255,255,.72)!important; }
.mini-weekdays { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); margin:8px 0 5px; color:rgba(255,255,255,.72); font-size:9px; font-weight:650; text-align:center; }
.mini-month { display:grid!important; grid-template-columns:repeat(7,minmax(0,1fr))!important; align-items:center; text-align:center; }
.mini-month span { font-variant-numeric:tabular-nums; }
.mini-month .today { background:#ff453a!important; color:#fff!important; box-shadow:none!important; }
.home-dock {
  position:absolute!important;
  z-index:4!important;
  left:max(20px, env(safe-area-inset-left))!important;
  right:max(20px, env(safe-area-inset-right))!important;
  top:auto!important;
  bottom:max(18px, calc(env(safe-area-inset-bottom) - 11px))!important;
  height:106px!important;
  border-radius:42px!important;
  overflow:hidden!important;
}
.page-dots { bottom:calc(max(18px, calc(env(safe-area-inset-bottom) - 11px)) + 125px)!important; }
@keyframes jiggle-icon-142 {
  0% { transform:translate3d(calc(-1 * var(--jiggle-shift)),0,0) rotate(calc(-1 * var(--jiggle-angle))); }
  50% { transform:translate3d(0,calc(.28 * var(--jiggle-shift)),0) rotate(.12deg); }
  100% { transform:translate3d(var(--jiggle-shift),0,0) rotate(var(--jiggle-angle)); }
}
@keyframes jiggle-widget-142 {
  0% { rotate:calc(-1 * var(--jiggle-angle)); translate:calc(-1 * var(--jiggle-shift)) 0; }
  100% { rotate:var(--jiggle-angle); translate:var(--jiggle-shift) 0; }
}
.springboard-editing .home-app:not(.spring-dragging) .home-app-icon,
.springboard-editing .home-app.wiggle:not(.spring-dragging) .home-app-icon,
.home-app.wiggle:not(.spring-dragging) .home-app-icon { animation-name:jiggle-icon-142!important; }
.springboard-editing .home-widget:not(.spring-dragging) { animation-name:jiggle-widget-142!important; }
`;
const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

function localizedWeekdays() {
  const formatter = new Intl.DateTimeFormat(navigator.language || 'en', { weekday: 'narrow' });
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 1 + index)));
}

function decorateCalendar() {
  for (const widget of $$('.calendar-widget')) {
    if ($('.mini-weekdays', widget)) continue;
    const row = document.createElement('div');
    row.className = 'mini-weekdays';
    row.setAttribute('aria-hidden', 'true');
    for (const label of localizedWeekdays()) {
      const span = document.createElement('span');
      span.textContent = label;
      row.append(span);
    }
    $('.mini-month', widget)?.before(row);
  }
}

function apply() {
  decorateCalendar();
  const compat = $('#defaultCompatToggle');
  if (compat?.checked) {
    compat.checked = false;
    compat.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const homeContent = $('.home-content');
  if (homeContent) {
    homeContent.scrollTop = 0;
    homeContent.scrollLeft = 0;
  }
}

let queued = false;
function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    apply();
  });
}

new MutationObserver(queueApply).observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['class'],
});

apply();
