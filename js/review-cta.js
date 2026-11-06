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
})();
