(() => {
  if (window.__SKYNET_MOTION_SCROLL_SCENES_V1__) return;
  window.__SKYNET_MOTION_SCROLL_SCENES_V1__ = true;

  const style = document.createElement('style');
  style.id = 'motionScrollScenesV1Styles';
  style.textContent = `
    .v17-scroll-scenes{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
    .v17-gate{position:absolute;inset:0;pointer-events:none}
    .v17-cloud-bank{position:absolute;width:72vw;height:34vh;min-width:520px;min-height:220px;top:18%;filter:blur(10px);opacity:.42;will-change:transform,opacity;background:
      radial-gradient(ellipse at 24% 52%,rgba(238,238,246,.16),transparent 36%),
      radial-gradient(ellipse at 48% 44%,rgba(199,194,239,.14),transparent 34%),
      radial-gradient(ellipse at 72% 58%,rgba(238,238,246,.12),transparent 32%)}
    .v17-cloud-left{left:-24vw;transform:translate3d(calc(var(--v17-cloud-open,0) * -27vw),calc(var(--v17-scroll-drift,0px) * -.018),0) scale(calc(1 + var(--v17-cloud-open,0) * .05))}
    .v17-cloud-right{right:-24vw;transform:translate3d(calc(var(--v17-cloud-open,0) * 27vw),calc(var(--v17-scroll-drift,0px) * -.014),0) scale(calc(1 + var(--v17-cloud-open,0) * .05))}
    .v17-cloud-glow{position:absolute;left:50%;top:31%;width:56vw;height:28vh;transform:translate(-50%,-50%) scale(calc(.82 + var(--v17-cloud-open,0) * .18));opacity:calc(.06 + var(--v17-cloud-open,0) * .13);background:radial-gradient(ellipse,rgba(133,120,225,.22),transparent 67%);filter:blur(26px)}

    .v17-moon-scene{position:absolute;inset:0;opacity:var(--v17-moon-progress,0);will-change:opacity}
    .v17-moon{position:absolute;left:50%;top:59%;width:min(22vw,260px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%) scale(calc(.72 + var(--v17-moon-progress,0) * .28));opacity:calc(.08 + var(--v17-moon-progress,0) * .82);background:
      radial-gradient(circle at 34% 28%,rgba(255,255,255,.42) 0 4%,transparent 5%),
      radial-gradient(circle at 62% 66%,rgba(40,39,54,.12) 0 9%,transparent 10%),
      radial-gradient(circle at 70% 34%,rgba(44,43,60,.11) 0 7%,transparent 8%),
      radial-gradient(circle at 38% 72%,rgba(55,53,72,.09) 0 8%,transparent 9%),
      radial-gradient(circle at 35% 32%,#f2f1e8,#d9d9d4 58%,#b8b5c7 100%);
      box-shadow:0 0 36px rgba(215,211,255,.15),0 0 110px rgba(130,117,225,.11);filter:saturate(.78);will-change:transform,opacity}
    .v17-moon-cloud{position:absolute;top:56%;width:62vw;height:28vh;filter:blur(9px);opacity:calc(.44 - var(--v17-moon-progress,0) * .13);background:
      radial-gradient(ellipse at 30% 48%,rgba(230,230,238,.14),transparent 34%),
      radial-gradient(ellipse at 58% 55%,rgba(183,178,221,.13),transparent 36%),
      radial-gradient(ellipse at 78% 42%,rgba(238,238,244,.10),transparent 30%)}
    .v17-moon-cloud-left{left:-18vw;transform:translate3d(calc(var(--v17-moon-open,0) * -25vw),calc(var(--v17-scroll-drift,0px) * -.012),0)}
    .v17-moon-cloud-right{right:-18vw;transform:translate3d(calc(var(--v17-moon-open,0) * 25vw),calc(var(--v17-scroll-drift,0px) * -.01),0)}

    @media(max-width:820px){
      .v17-cloud-bank{width:105vw;min-width:0;height:27vh;min-height:170px;top:20%;opacity:.34}
      .v17-cloud-left{left:-48vw;transform:translate3d(calc(var(--v17-cloud-open,0) * -36vw),0,0)}
      .v17-cloud-right{right:-48vw;transform:translate3d(calc(var(--v17-cloud-open,0) * 36vw),0,0)}
      .v17-moon{width:min(42vw,220px);top:61%}
      .v17-moon-cloud{width:100vw;height:24vh;top:58%}
      .v17-moon-cloud-left{left:-46vw;transform:translate3d(calc(var(--v17-moon-open,0) * -34vw),0,0)}
      .v17-moon-cloud-right{right:-46vw;transform:translate3d(calc(var(--v17-moon-open,0) * 34vw),0,0)}
    }
  `;
  document.head.appendChild(style);

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function smootherstep(value) {
    const t = clamp01(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function installScene() {
    const atmosphere = document.querySelector('.v16-atmosphere');
    if (!atmosphere || atmosphere.querySelector('.v17-scroll-scenes')) return Boolean(atmosphere);

    const scene = document.createElement('div');
    scene.className = 'v17-scroll-scenes';
    scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = `
      <div class="v17-gate v17-cloud-scene">
        <span class="v17-cloud-glow"></span>
        <span class="v17-cloud-bank v17-cloud-left"></span>
        <span class="v17-cloud-bank v17-cloud-right"></span>
      </div>
      <div class="v17-gate v17-moon-scene">
        <span class="v17-moon"></span>
        <span class="v17-moon-cloud v17-moon-cloud-left"></span>
        <span class="v17-moon-cloud v17-moon-cloud-right"></span>
      </div>`;
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

    // First gate: clouds start closed and progressively part during the first third.
    const cloudOpen = smootherstep((p - .015) / .29);

    // Second gate: farther down, another cloud layer opens to reveal the moon.
    const moonOpen = smootherstep((p - .27) / .31);
    const moonProgress = smootherstep((p - .31) / .26);

    doc.style.setProperty('--v17-cloud-open', cloudOpen.toFixed(4));
    doc.style.setProperty('--v17-moon-open', moonOpen.toFixed(4));
    doc.style.setProperty('--v17-moon-progress', moonProgress.toFixed(4));
    doc.style.setProperty('--v17-scroll-drift', `${visualY.toFixed(1)}px`);

    if (Math.abs(targetY - visualY) > .3) raf = requestAnimationFrame(update);
  }

  function schedule() {
    targetY = window.scrollY;
    if (!raf) raf = requestAnimationFrame(update);
  }

  const boot = () => {
    if (!installScene()) {
      const observer = new MutationObserver(() => {
        if (!installScene()) return;
        observer.disconnect();
        schedule();
      });
      observer.observe(document.documentElement, { childList:true, subtree:true });
      setTimeout(() => observer.disconnect(), 12000);
    }
    schedule();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  addEventListener('scroll', schedule, { passive:true });
  addEventListener('resize', schedule, { passive:true });
})();
