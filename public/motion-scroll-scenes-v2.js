(() => {
  if (window.__SKYNET_MOTION_SCROLL_SCENES_V2__) return;
  window.__SKYNET_MOTION_SCROLL_SCENES_V2__ = true;

  const style = document.createElement('style');
  style.id = 'motionScrollScenesV2Styles';
  style.textContent = `
    .v17-scroll-scenes{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
    .v17-gate{position:absolute;inset:0;pointer-events:none}
    .v17-cloud-bank{position:absolute;width:72vw;height:34vh;min-width:520px;min-height:220px;top:18%;filter:blur(10px);opacity:.42;will-change:transform,opacity;background:radial-gradient(ellipse at 24% 52%,rgba(238,238,246,.16),transparent 36%),radial-gradient(ellipse at 48% 44%,rgba(199,194,239,.14),transparent 34%),radial-gradient(ellipse at 72% 58%,rgba(238,238,246,.12),transparent 32%)}
    .v17-cloud-left{left:-24vw;transform:translate3d(var(--v17-cloud-left-x,0vw),var(--v17-cloud-left-y,0px),0) scale(var(--v17-cloud-scale,1))}
    .v17-cloud-right{right:-24vw;transform:translate3d(var(--v17-cloud-right-x,0vw),var(--v17-cloud-right-y,0px),0) scale(var(--v17-cloud-scale,1))}
    .v17-cloud-glow{position:absolute;left:50%;top:31%;width:56vw;height:28vh;transform:translate(-50%,-50%) scale(var(--v17-cloud-glow-scale,.82));opacity:var(--v17-cloud-glow-opacity,.06);background:radial-gradient(ellipse,rgba(133,120,225,.22),transparent 67%);filter:blur(26px)}
    .v17-moon-scene{position:absolute;inset:0;opacity:var(--v17-moon-scene-opacity,0);will-change:opacity}
    .v17-moon{position:absolute;left:50%;top:59%;width:min(22vw,260px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%) scale(var(--v17-moon-scale,.72));opacity:var(--v17-moon-opacity,.08);background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.42) 0 4%,transparent 5%),radial-gradient(circle at 62% 66%,rgba(40,39,54,.12) 0 9%,transparent 10%),radial-gradient(circle at 70% 34%,rgba(44,43,60,.11) 0 7%,transparent 8%),radial-gradient(circle at 38% 72%,rgba(55,53,72,.09) 0 8%,transparent 9%),radial-gradient(circle at 35% 32%,#f2f1e8,#d9d9d4 58%,#b8b5c7 100%);box-shadow:0 0 36px rgba(215,211,255,.15),0 0 110px rgba(130,117,225,.11);filter:saturate(.78);will-change:transform,opacity}
    .v17-moon-cloud{position:absolute;top:56%;width:62vw;height:28vh;filter:blur(9px);opacity:var(--v17-moon-cloud-opacity,.44);background:radial-gradient(ellipse at 30% 48%,rgba(230,230,238,.14),transparent 34%),radial-gradient(ellipse at 58% 55%,rgba(183,178,221,.13),transparent 36%),radial-gradient(ellipse at 78% 42%,rgba(238,238,244,.10),transparent 30%)}
    .v17-moon-cloud-left{left:-18vw;transform:translate3d(var(--v17-moon-left-x,0vw),var(--v17-moon-left-y,0px),0)}
    .v17-moon-cloud-right{right:-18vw;transform:translate3d(var(--v17-moon-right-x,0vw),var(--v17-moon-right-y,0px),0)}
    @media(max-width:820px){.v17-cloud-bank{width:105vw;min-width:0;height:27vh;min-height:170px;top:20%;opacity:.34}.v17-cloud-left{left:-48vw}.v17-cloud-right{right:-48vw}.v17-moon{width:min(42vw,220px);top:61%}.v17-moon-cloud{width:100vw;height:24vh;top:58%}.v17-moon-cloud-left{left:-46vw}.v17-moon-cloud-right{right:-46vw}}
  `;
  document.head.appendChild(style);

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const smootherstep = value => {
    const t = clamp01(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };

  function installScene() {
    const atmosphere = document.querySelector('.v16-atmosphere');
    if (!atmosphere) return false;
    atmosphere.querySelector('.v17-scroll-scenes')?.remove();
    const scene = document.createElement('div');
    scene.className = 'v17-scroll-scenes';
    scene.setAttribute('aria-hidden','true');
    scene.innerHTML = '<div class="v17-gate v17-cloud-scene"><span class="v17-cloud-glow"></span><span class="v17-cloud-bank v17-cloud-left"></span><span class="v17-cloud-bank v17-cloud-right"></span></div><div class="v17-gate v17-moon-scene"><span class="v17-moon"></span><span class="v17-moon-cloud v17-moon-cloud-left"></span><span class="v17-moon-cloud v17-moon-cloud-right"></span></div>';
    atmosphere.appendChild(scene);
    return true;
  }

  let raf = 0;
  let targetY = window.scrollY;
  let visualY = targetY;

  function update() {
    raf = 0;
    targetY = window.scrollY;
    visualY += (targetY - visualY) * .18;

    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - innerHeight);
    const p = clamp01(visualY / max);
    const mobile = innerWidth <= 820;

    const cloudOpen = smootherstep((p - .015) / .29);
    const cloudShift = cloudOpen * (mobile ? 36 : 27);
    const moonScene = smootherstep((p - .22) / .12);
    const moonOpen = smootherstep((p - .27) / .31);
    const moonProgress = smootherstep((p - .31) / .26);
    const moonShift = moonOpen * (mobile ? 34 : 25);

    doc.style.setProperty('--v17-cloud-left-x', `${(-cloudShift).toFixed(2)}vw`);
    doc.style.setProperty('--v17-cloud-right-x', `${cloudShift.toFixed(2)}vw`);
    doc.style.setProperty('--v17-cloud-left-y', `${(-visualY * .018).toFixed(1)}px`);
    doc.style.setProperty('--v17-cloud-right-y', `${(-visualY * .014).toFixed(1)}px`);
    doc.style.setProperty('--v17-cloud-scale', (1 + cloudOpen * .05).toFixed(4));
    doc.style.setProperty('--v17-cloud-glow-scale', (.82 + cloudOpen * .18).toFixed(4));
    doc.style.setProperty('--v17-cloud-glow-opacity', (.06 + cloudOpen * .13).toFixed(4));

    doc.style.setProperty('--v17-moon-scene-opacity', moonScene.toFixed(4));
    doc.style.setProperty('--v17-moon-left-x', `${(-moonShift).toFixed(2)}vw`);
    doc.style.setProperty('--v17-moon-right-x', `${moonShift.toFixed(2)}vw`);
    doc.style.setProperty('--v17-moon-left-y', `${(-visualY * .012).toFixed(1)}px`);
    doc.style.setProperty('--v17-moon-right-y', `${(-visualY * .01).toFixed(1)}px`);
    doc.style.setProperty('--v17-moon-cloud-opacity', (.44 - moonProgress * .13).toFixed(4));
    doc.style.setProperty('--v17-moon-scale', (.72 + moonProgress * .28).toFixed(4));
    doc.style.setProperty('--v17-moon-opacity', (.08 + moonProgress * .82).toFixed(4));

    if (Math.abs(targetY - visualY) > .3) raf = requestAnimationFrame(update);
  }

  function schedule() {
    targetY = window.scrollY;
    if (!raf) raf = requestAnimationFrame(update);
  }

  function boot() {
    if (!installScene()) {
      const observer = new MutationObserver(() => {
        if (!installScene()) return;
        observer.disconnect();
        schedule();
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(() => observer.disconnect(),12000);
    }
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
})();
