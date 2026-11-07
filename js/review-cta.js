// رسالة وزر «قيّمنا على Google»: اللغة تتغير تلقائياً
// 1) إذا الزائر اختار لغة الموقع بنفسه (زر العربية / FR) بنحترم اختياره
// 2) غير هيك حسب لغة الهاتف أو المتصفح: عربي → عربي، فرنسي → فرنسي
// 3) أي لغة تانية → فرنسي
(function () {
  var KEY = 'cesar_lang';
  var T = {
    ar: { dir: 'rtl', btn: 'قيّم تجربتك معنا على Google', nw: 'يفتح في نافذة جديدة',
      msg: 'يسعدنا معرفة رأيكم في تجربتكم مع قيصر الشام للحجر والرخام. تقييمكم يساعدنا على تطوير خدماتنا. شكراً لثقتكم بنا.' },
    fr: { dir: 'ltr', btn: 'Donnez votre avis sur Google', nw: 's’ouvre dans un nouvel onglet',
      msg: 'Votre avis compte pour nous ! Partagez votre expérience avec César Alcham sur Google. Votre évaluation nous aide à améliorer nos services. Merci pour votre confiance.' }
  };
  function pick() {
    var s = '';
    try { s = localStorage.getItem(KEY) || ''; } catch (e) {}
    if (s === 'ar' || s === 'fr') return s;
    var l = String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase().slice(0, 2);
    return l === 'ar' ? 'ar' : 'fr';
  }
  function apply() {
    var L = pick(), t = T[L], i, a, s, n;
    n = document.querySelectorAll('[data-gr]');
    for (i = 0; i < n.length; i++) { n[i].setAttribute('lang', L); n[i].setAttribute('dir', t.dir); }
    n = document.querySelectorAll('[data-gr-msg]');
    for (i = 0; i < n.length; i++) n[i].textContent = t.msg;
    n = document.querySelectorAll('[data-gr-btn]');
    for (i = 0; i < n.length; i++) {
      a = n[i]; s = a.querySelector('.gr-t');
      if (s) s.textContent = t.btn;
      a.setAttribute('aria-label', t.btn + ' — ' + t.nw);
      a.setAttribute('lang', L); a.setAttribute('dir', t.dir);
    }
  }
  // اختيار اللغة يدوياً من زر تبديل اللغة بالهيدر
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[hreflang]') : null;
    if (!a) return;
    var v = a.getAttribute('hreflang');
    if (v === 'ar' || v === 'fr') { try { localStorage.setItem(KEY, v); } catch (x) {} }
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();

  // نافذة صغيرة «قيّم تجربتك» بعد دقيقة تصفّح بالموقع (مجموع الصفحات بنفس الزيارة)
  // ما بتطلع إلا مرة كل 30 يوم، وما بترجع أبداً إذا الزائر كبس زر التقييم
  var URL_R = 'https://g.page/r/CfglXtcD3yGBEBM/review', WAIT = 60000, GAP = 30 * 864e5;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function canShow() { if (ls('gr_done')) return false; var t = +ls('gr_pop_at') || 0; return Date.now() - t > GAP; }
  function pop() {
    if (!canShow() || document.getElementById('grPop')) return;
    var L = pick(), t = T[L];
    var css = document.createElement('style');
    css.textContent = '#grPop{position:fixed;z-index:9999;bottom:16px;inset-inline-start:16px;inset-inline-end:16px;margin:0 auto;max-width:380px;background:#FFFDF8;color:#2E1C10;border:1px solid #C9A06A;border-radius:16px;box-shadow:0 12px 34px rgba(0,0,0,.28);padding:16px 16px 14px;font-family:inherit;text-align:center;opacity:0;transform:translateY(16px);transition:opacity .35s,transform .35s}#grPop.on{opacity:1;transform:none}#grPop p{margin:4px 18px 12px;font-size:14px;line-height:1.75}#grPop .x{position:absolute;top:6px;inset-inline-end:8px;background:none;border:0;font-size:22px;line-height:1;color:#8A5A30;cursor:pointer;padding:4px 8px}#grPop a{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#8A5A30,#5E3A1E);color:#fff;text-decoration:none;font-weight:800;font-size:14.5px;padding:9px 18px;border-radius:999px;border:1px solid #C9A06A}#grPop a b{color:#F4C152}@media(prefers-reduced-motion:reduce){#grPop{transition:none}}';
    document.head.appendChild(css);
    var d = document.createElement('div'); d.id = 'grPop'; d.setAttribute('role', 'dialog'); d.setAttribute('lang', L); d.setAttribute('dir', t.dir);
    d.setAttribute('aria-label', t.btn);
    d.innerHTML = '<button class="x" type="button" aria-label="' + (L === 'ar' ? 'إغلاق' : 'Fermer') + '">×</button><p></p><a target="_blank" rel="noopener"><span></span> <b aria-hidden="true">★</b></a>';
    d.querySelector('p').textContent = t.msg; d.querySelector('a span').textContent = t.btn; d.querySelector('a').href = URL_R;
    document.body.appendChild(d); ls('gr_pop_at', String(Date.now()));
    requestAnimationFrame(function () { d.classList.add('on'); });
    function close() { d.classList.remove('on'); setTimeout(function () { d.remove(); }, 400); }
    d.querySelector('.x').onclick = close;
    d.querySelector('a').addEventListener('click', function () { ls('gr_done', '1'); close(); });
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
  }
  // كبسة على أي زر تقييم بالموقع = خلص، ما عاد نطلّع النافذة
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest ? e.target.closest('[data-gr-btn]') : null; if (a) ls('gr_done', '1'); }, true);
  if (canShow()) {
    var t0 = +ss('gr_t0'); if (!t0) { t0 = Date.now(); ss('gr_t0', String(t0)); }
    setTimeout(pop, Math.max(3000, WAIT - (Date.now() - t0)));
  }
})();
