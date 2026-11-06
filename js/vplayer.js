// مشغّل الفيديو لمعرض الفيديو (العربي والفرنسي)
// - البطاقة بتعرض صورة مصغّرة بس (preload="none")؛ الفيديو ما بينزل إلا لما الزائر يضغط «مشاهدة»
// - بيفتح بنافذة فوق الصفحة بدون ما يطلع الزائر من الموقع، وبيوقف وبيفضّي الذاكرة لما تنسكّر
// - الفيديو اللي ما إلو صورة غلاف: منجيب أول لقطة منه بس لما توصل بطاقته للشاشة
(function(){
  var FR = (document.documentElement.lang || '').indexOf('fr') === 0;
  var T = FR ? {close:'Fermer', title:'Vidéo'} : {close:'إغلاق', title:'فيديو'};

  var css = document.createElement('style');
  css.textContent = '.vp-ov{position:fixed;inset:0;z-index:400;background:rgba(18,11,6,.94);display:none;align-items:center;justify-content:center;padding:56px 14px 20px;flex-direction:column;gap:12px}'
    + '.vp-ov.on{display:flex}.vp-ov video{width:min(1100px,100%);max-height:calc(100vh - 140px);background:#000;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
    + '.vp-ov .vp-t{color:#F3E6D2;font-weight:800;font-size:16px;text-align:center;max-width:1100px}'
    + '.vp-ov .vp-x{position:absolute;top:12px;' + (FR ? 'right' : 'left') + ':14px;width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(217,185,140,.6);background:rgba(0,0,0,.35);color:#fff;font-size:24px;line-height:1;cursor:pointer}'
    + '.vp-ov .vp-x:hover{background:#9A6A3A}body.vp-lock{overflow:hidden}';
  document.head.appendChild(css);

  var ov, vid, ttl, lastFocus;
  function build(){
    ov = document.createElement('div'); ov.className = 'vp-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', T.title);
    ov.innerHTML = '<button type="button" class="vp-x" aria-label="' + T.close + '">×</button><video controls playsinline preload="none"></video><div class="vp-t" dir="auto"></div>';
    document.body.appendChild(ov);
    vid = ov.querySelector('video'); ttl = ov.querySelector('.vp-t');
    ov.querySelector('.vp-x').addEventListener('click', close);
    ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && ov.classList.contains('on')) close(); });
  }
  function open(src, title, poster){
    if (!ov) build();
    lastFocus = document.activeElement;
    vid.poster = poster || '';
    vid.src = src;
    ttl.textContent = title || '';
    ov.classList.add('on'); document.body.classList.add('vp-lock');
    ov.querySelector('.vp-x').focus();
    var p = vid.play(); if (p && p.catch) p.catch(function(){}); // التشغيل بعد ضغطة الزائر فقط
  }
  function close(){
    vid.pause(); vid.removeAttribute('src'); vid.load();
    ov.classList.remove('on'); document.body.classList.remove('vp-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-vsrc]');
    if (!b) return;
    e.preventDefault();
    open(b.getAttribute('data-vsrc'), b.getAttribute('data-vtitle') || '', b.getAttribute('data-vposter') || '');
  });

  // لقطة أولى للفيديوهات بدون غلاف — بس لما تقرب من الشاشة
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function(es){
    es.forEach(function(en){ if (!en.isIntersecting) return; var v = en.target; io.unobserve(v); v.preload = 'metadata'; try{ v.load(); }catch(_){} });
  }, {rootMargin: '200px'}) : null;
  function scan(){
    document.querySelectorAll('.vthumb video[data-lazy]:not([data-seen])').forEach(function(v){ v.setAttribute('data-seen', '1'); if (io) io.observe(v); });
  }
  window.__vpScan = scan;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
