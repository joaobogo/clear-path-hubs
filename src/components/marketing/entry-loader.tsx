/**
 * TaaSFlow Entry Loader
 *
 * Rendered directly into the SSR HTML shell (see src/routes/__root.tsx) so it
 * paints on the first byte, before React hydration. All dismissal logic runs
 * in an inline script — the loader does not depend on hydration completing.
 *
 * Behavior:
 *  - session-gated via sessionStorage["taasflow.entryLoader.seen.v1"]
 *  - waits for document `load` + `fonts.ready` + 550ms min brand moment
 *  - 2.5s safety timeout
 *  - fast-path: if <180ms since paint, removes instantly (no flash)
 *  - prefers-reduced-motion: static logo, no line-draw / sweep / scale
 *  - fully accessible (role=status, aria-live=polite, aria-label)
 *  - never traps focus; pointer-events released on exit
 *  - does not replay on internal navigation (no React state, DOM node is removed)
 */

const SESSION_KEY = "taasflow.entryLoader.seen.v2";

const CSS = `
#tf-entry-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(1200px 800px at 50% 30%,#12244a 0%,#0a1533 45%,#050c22 100%);opacity:1;transition:opacity 380ms ease-out;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#fff;height:100dvh;width:100vw;pointer-events:auto}
#tf-entry-loader.tf-exit{opacity:0;pointer-events:none}
#tf-entry-loader.tf-exit .tf-inner{transform:scale(.96)}
#tf-entry-loader .tf-sweep{position:absolute;inset:0;opacity:.4;background:conic-gradient(from 220deg at 50% 50%,transparent 0deg,rgba(96,165,250,.18) 60deg,transparent 140deg);animation:tf-sweep 6s linear infinite;pointer-events:none}
#tf-entry-loader .tf-inner{position:relative;display:flex;flex-direction:column;align-items:center;gap:32px;padding:0 24px;text-align:center;transition:transform 380ms ease-out;max-width:100%}
#tf-entry-loader .tf-brand{display:flex;align-items:center;gap:12px}
#tf-entry-loader .tf-mark{filter:drop-shadow(0 0 24px rgba(96,165,250,.35))}
#tf-entry-loader .tf-mark .tf-stroke{stroke-dasharray:80;stroke-dashoffset:80;animation:tf-draw 1.1s cubic-bezier(.6,.2,.2,1) .05s forwards}
#tf-entry-loader .tf-word{font-family:Fraunces,ui-serif,Georgia,serif;font-size:30px;font-weight:600;letter-spacing:-.01em;opacity:0;animation:tf-fadeup .7s ease-out .45s forwards}
#tf-entry-loader .tf-stages{display:flex;align-items:flex-start;gap:8px;opacity:0;animation:tf-fadeup .7s ease-out .75s forwards;max-width:100%;flex-wrap:nowrap}
@media(min-width:480px){#tf-entry-loader .tf-stages{gap:12px}}
#tf-entry-loader .tf-stage{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
#tf-entry-loader .tf-dot{width:8px;height:8px;border-radius:9999px;background:rgba(148,163,184,.35);transition:background 300ms,box-shadow 300ms}
#tf-entry-loader .tf-stage.on .tf-dot{background:#60a5fa;box-shadow:0 0 12px rgba(96,165,250,.7)}
#tf-entry-loader .tf-label{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:rgba(148,163,184,.7);white-space:nowrap}
@media(min-width:480px){#tf-entry-loader .tf-label{font-size:11px}}
#tf-entry-loader .tf-stage.on .tf-label{color:#dbeafe}
#tf-entry-loader .tf-link{width:24px;height:1px;background:rgba(148,163,184,.2);margin-top:4px;flex:0 0 auto}
@media(min-width:480px){#tf-entry-loader .tf-link{width:40px}}
#tf-entry-loader .tf-link.on{background:linear-gradient(90deg,#60a5fa,rgba(96,165,250,.2))}
#tf-entry-loader .tf-msg{font-size:14px;color:#cbd5e1;opacity:0;animation:tf-fadeup .7s ease-out 1s forwards;min-height:20px;max-width:min(90vw,420px)}
@media(min-width:480px){#tf-entry-loader .tf-msg{font-size:16px}}
#tf-entry-loader .tf-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@keyframes tf-sweep{to{transform:rotate(360deg)}}
@keyframes tf-draw{to{stroke-dashoffset:0}}
@keyframes tf-fadeup{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){
  #tf-entry-loader .tf-sweep,#tf-entry-loader .tf-mark .tf-stroke{animation:none}
  #tf-entry-loader .tf-mark .tf-stroke{stroke-dashoffset:0}
  #tf-entry-loader .tf-word,#tf-entry-loader .tf-stages,#tf-entry-loader .tf-msg{animation:none;opacity:1}
  #tf-entry-loader.tf-exit .tf-inner{transform:none}
}
`;

const SCRIPT = `
(function(){
  var KEY=${JSON.stringify(SESSION_KEY)};
  var el=document.getElementById('tf-entry-loader');
  if(!el) return;
  function kill(){ try{ localStorage.setItem(KEY,'1'); sessionStorage.setItem(KEY,'1'); }catch(e){} if(el&&el.parentNode) el.parentNode.removeChild(el); }
  // Only show on the home route, and only once per browser (first access).
  if(location.pathname!=='/'){ kill(); return; }
  try{ if(localStorage.getItem(KEY)||sessionStorage.getItem(KEY)){ kill(); return; } }catch(e){}
  var started=performance.now();
  var MAX=2500, MIN=550, FAST=180, EXIT=380;

  var reduced=(matchMedia('(prefers-reduced-motion: reduce)').matches);
  var stages=el.querySelectorAll('.tf-stage');
  var links=el.querySelectorAll('.tf-link');
  var msgEl=el.querySelector('.tf-msg-text');
  var MSGS=['Mapping the role','Activating sourcing channels','Preparing ranked candidates','Opening your hiring workspace'];
  var stage=0, msg=0;
  function light(i){ for(var k=0;k<stages.length;k++){ stages[k].classList.toggle('on', k<=i); } for(var j=0;j<links.length;j++){ links[j].classList.toggle('on', j<i); } }
  light(0);
  var iv1=reduced?0:setInterval(function(){ stage=Math.min(stage+1, stages.length-2); light(stage); },320);
  var iv2=reduced?0:setInterval(function(){ msg=(msg+1)%MSGS.length; if(msgEl) msgEl.textContent=MSGS[msg]+'\u2026'; },900);
  var done=false;
  function remove(){
    try{ localStorage.setItem(KEY,'1'); sessionStorage.setItem(KEY,'1'); }catch(e){}
    if(iv1) clearInterval(iv1); if(iv2) clearInterval(iv2);
    if(el&&el.parentNode) el.parentNode.removeChild(el);
  }
  function finish(){
    if(done) return; done=true;
    if(iv1) clearInterval(iv1); if(iv2) clearInterval(iv2);
    if(performance.now()-started < FAST){ remove(); return; }
    light(stages.length-1);
    el.classList.add('tf-exit');
    setTimeout(remove, EXIT);
  }
  var domReady=new Promise(function(r){ if(document.readyState==='complete') return r(); addEventListener('load',r,{once:true}); });
  var fonts=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve();
  var raf=new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); });
  var to=setTimeout(finish, MAX);
  Promise.all([domReady,fonts,raf]).then(function(){
    var elapsed=performance.now()-started;
    var wait=reduced?0:Math.max(0, MIN-elapsed);
    setTimeout(function(){ clearTimeout(to); finish(); }, wait);
  });
})();
`;

const HTML = `
<div id="tf-entry-loader" role="status" aria-live="polite" aria-label="TaaSFlow is starting">
  <div class="tf-sweep" aria-hidden="true"></div>
  <div class="tf-inner">
    <div class="tf-brand">
      <svg class="tf-mark" width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <defs><linearGradient id="tf-g" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#3b82f6"/>
        </linearGradient></defs>
        <rect x="1" y="1" width="50" height="50" rx="12" stroke="url(#tf-g)" stroke-width="1.5"/>
        <path class="tf-stroke" d="M12 18 H40 M26 18 V38" stroke="url(#tf-g)" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <span class="tf-word">TaaSFlow</span>
    </div>
    <div class="tf-stages" aria-hidden="true">
      <div class="tf-stage on"><span class="tf-dot"></span><span class="tf-label">Role</span></div>
      <div class="tf-link"></div>
      <div class="tf-stage"><span class="tf-dot"></span><span class="tf-label">Source</span></div>
      <div class="tf-link"></div>
      <div class="tf-stage"><span class="tf-dot"></span><span class="tf-label">Evaluate</span></div>
      <div class="tf-link"></div>
      <div class="tf-stage"><span class="tf-dot"></span><span class="tf-label">Rank</span></div>
      <div class="tf-link"></div>
      <div class="tf-stage"><span class="tf-dot"></span><span class="tf-label">Deliver</span></div>
    </div>
    <p class="tf-msg"><span class="tf-sr">Loading TaaSFlow. </span><span class="tf-msg-text">Your hiring engine is starting\u2026</span></p>
  </div>
</div>
`;

/**
 * Renders the loader into the SSR HTML directly. React does not manage its
 * lifecycle after paint — an inline script handles dismissal and DOM removal.
 * Placed inside <body> in the root shell.
 */
export function TaaSFlowEntryLoader() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: HTML }} suppressHydrationWarning />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
