const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const css=`
.home-widget{border-radius:calc(var(--spring-cell,78px)*.36)!important}
.calendar-widget{background:linear-gradient(155deg,rgba(27,27,30,.94),rgba(11,12,15,.96))!important}
.calendar-head{align-items:start!important}.calendar-head strong{color:#ff453a!important;font-weight:760!important;letter-spacing:-.02em}.calendar-head span{color:rgba(255,255,255,.72)!important}
.mini-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));margin:8px 0 5px;color:rgba(255,255,255,.72);font-size:9px;font-weight:650;text-align:center}
.mini-month{display:grid!important;grid-template-columns:repeat(7,minmax(0,1fr))!important;align-items:center;text-align:center}.mini-month span{font-variant-numeric:tabular-nums}.mini-month .today{background:#ff453a!important;color:#fff!important;box-shadow:none!important}
.home-dock{left:max(20px,env(safe-area-inset-left))!important;right:max(20px,env(safe-area-inset-right))!important;bottom:max(18px,calc(env(safe-area-inset-bottom)-11px))!important;height:106px!important;border-radius:42px!important}
.page-dots{bottom:calc(max(18px,calc(env(safe-area-inset-bottom)-11px))+125px)!important}
@keyframes jiggle-icon-141{0%{transform:translate3d(calc(-1*var(--jiggle-shift)),0,0) rotate(calc(-1*var(--jiggle-angle)))}50%{transform:translate3d(0,calc(.28*var(--jiggle-shift)),0) rotate(.12deg)}100%{transform:translate3d(var(--jiggle-shift),0,0) rotate(var(--jiggle-angle))}}
@keyframes jiggle-widget-141{0%{rotate:calc(-1*var(--jiggle-angle));translate:calc(-1*var(--jiggle-shift)) 0}100%{rotate:var(--jiggle-angle);translate:var(--jiggle-shift) 0}}
.springboard-editing .home-app:not(.spring-dragging) .home-app-icon,.springboard-editing .home-app.wiggle:not(.spring-dragging) .home-app-icon,.home-app.wiggle:not(.spring-dragging) .home-app-icon{animation-name:jiggle-icon-141!important}
.springboard-editing .home-widget:not(.spring-dragging){animation-name:jiggle-widget-141!important}
`;
const style=document.createElement('style');style.textContent=css;document.head.append(style);
function hash01(v,s=0){let h=2166136261^s;for(const c of String(v)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967295}
function key(el){if(el.dataset.springKey)return el.dataset.springKey;if(el.classList.contains('clock-widget'))return'widget:clock';if(el.classList.contains('calendar-widget'))return'widget:calendar';if(el.dataset.id)return`project:${el.dataset.id}`;return $('.home-app-label',el)?.textContent?.trim()||'item'}
function tune(){for(const el of $$('#homeScreen .home-app,#homeScreen .home-widget')){const k=key(el),w=el.classList.contains('home-widget');el.style.setProperty('--jiggle-delay',`${(-.30*hash01(k,11)).toFixed(3)}s`);el.style.setProperty('--jiggle-duration',`${(w?.235:.195)+(w?.060:.070)*hash01(k,29)}s`);el.style.setProperty('--jiggle-angle',`${((w?.72:1.90)+(w?.38:.85)*hash01(k,47)).toFixed(2)}deg`);el.style.setProperty('--jiggle-shift',`${((w?.10:.48)+(w?.20:.72)*hash01(k,71)).toFixed(2)}px`)}}
function weekdays(){const d=new Date(2024,0,1),f=new Intl.DateTimeFormat(navigator.language||'en',{weekday:'narrow'});return Array.from({length:7},(_,i)=>f.format(new Date(2024,0,1+i)))}
function calendar(){for(const w of $$('.calendar-widget'))if(!$('.mini-weekdays',w)){const row=document.createElement('div');row.className='mini-weekdays';row.setAttribute('aria-hidden','true');for(const t of weekdays()){const s=document.createElement('span');s.textContent=t;row.append(s)}$('.mini-month',w)?.before(row)}}
function apply(){tune();calendar();const c=$('#defaultCompatToggle');if(c?.checked){c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}))}}
let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})};
const obs=new MutationObserver(queue);obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});apply();
