// حركات الصفحة الرئيسية (GSAP + ScrollTrigger)
// - تُحمَّل بعد اكتمال الصفحة حتى لا تؤثر على سرعة الظهور أو نتيجة Google
// - لا تُخفي أي محتوى قبل تحميلها: لو تعطّلت المكتبة، الصفحة تبقى كما هي
// - تتوقف تماماً لمن فعّل "تقليل الحركة" في هاتفه
(function(){
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/';
  function load(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function idle(fn){
    if ('requestIdleCallback' in window) requestIdleCallback(fn, {timeout: 2000});
    else setTimeout(fn, 300);
  }
  function start(){
    load(CDN + 'gsap.min.js')
      .then(function(){ return load(CDN + 'ScrollTrigger.min.js'); })
      .then(init)
      .catch(function(){ /* بدون حركات — الصفحة تعمل طبيعياً */ });
  }
  if (document.readyState === 'complete') idle(start);
  else window.addEventListener('load', function(){ idle(start); });

  function inView(el){
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  function init(){
    var gsap = window.gsap, ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);

    // تنسيق اللمعة (مشترك بين الصفحة العربية والفرنسية)
    var st = document.createElement('style');
    st.textContent = '.mo-shine{background:linear-gradient(100deg,var(--mo-base) 0%,var(--mo-base) calc(var(--shine,140%) - 18%),#E9C995 var(--shine,140%),var(--mo-base) calc(var(--shine,140%) + 18%),var(--mo-base) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}';
    document.head.appendChild(st);

    // الصفحة العربية: #home — الصفحة الفرنسية: أول قسم داخل main
    var hero = document.getElementById('home') || document.querySelector('main > section:first-child');

    // 1) لمعة برونزية تمرّ مرة واحدة على العنوان
    var acc = document.getElementById('heroTitleAccent') || (hero && hero.querySelector('h1'));
    if (acc){
      acc.style.setProperty('--mo-base', getComputedStyle(acc).color);
      acc.classList.add('mo-shine');
      gsap.fromTo(acc, {'--shine': '-40%'}, {
        '--shine': '140%', duration: 1.8, ease: 'power2.inOut', delay: .15,
        onComplete: function(){ acc.classList.remove('mo-shine'); }
      });
    }

    // 2) محتوى الواجهة يبتعد بهدوء عند النزول (عمق خفيف)
    var heroBits = hero ? hero.querySelectorAll(':scope > svg, :scope > h1, :scope > p, :scope > .btn, :scope > .cta') : [];
    if (heroBits.length){
      gsap.to(heroBits, {
        y: -36, opacity: .45, ease: 'none',
        scrollTrigger: {trigger: hero, start: 'top top', end: '+=420', scrub: .6}
      });
    }

    // 3ب) عناوين الأقسام في الصفحة الفرنسية تصعد بهدوء
    gsap.utils.toArray('main .sec > h2').forEach(function(h){
      if (inView(h)) return;
      gsap.fromTo(h, {y: 18, opacity: 0}, {
        y: 0, opacity: 1, duration: .8, ease: 'power3.out',
        scrollTrigger: {trigger: h, start: 'top 92%', once: true}
      });
    });

    // 3) الخط الذهبي تحت عناوين الأقسام يمتد عند ظهوره
    gsap.utils.toArray('.section-head .rule').forEach(function(r){
      if (inView(r)) return;
      gsap.fromTo(r, {scaleX: 0}, {
        scaleX: 1, duration: 1, ease: 'power3.out',
        scrollTrigger: {trigger: r, start: 'top 90%', once: true}
      });
    });

    // 4) صور معرض الأعمال تظهر بالتتابع (العربية والفرنسية)
    var batchTriggers = [];
    window.__motionShowcase = function(){
      batchTriggers.forEach(function(t){ t.kill(); });
      batchTriggers = [];
      var els = gsap.utils.toArray('#homeShowcase .sc-item, main .grid > .card').filter(function(el){ return !inView(el); });
      if (!els.length){ ST.refresh(); return; }
      gsap.set(els, {opacity: 0, y: 34, scale: .96});
      batchTriggers = ST.batch(els, {
        start: 'top 92%', once: true,
        onEnter: function(b){
          gsap.to(b, {opacity: 1, y: 0, scale: 1, duration: .75, stagger: .09, ease: 'power3.out', overwrite: true});
        }
      });
      ST.refresh();
    };
    window.__motionShowcase();

    // 5) أرقام "من نحن" تعدّ من الصفر
    gsap.utils.toArray('.stat b').forEach(function(b){
      var m = (b.textContent || '').trim().match(/^(\D*)(\d+)(\D*)$/);
      if (!m || inView(b)) return;
      var pre = m[1], end = parseInt(m[2], 10), suf = m[3], o = {v: 0};
      ST.create({
        trigger: b, start: 'top 92%', once: true,
        onEnter: function(){
          gsap.to(o, {v: end, duration: 1.6, ease: 'power2.out',
            onUpdate: function(){ b.textContent = pre + Math.round(o.v) + suf; }});
        }
      });
    });

    // 6) صورة "من نحن" تتحرك أبطأ من الصفحة (عمق)
    var about = document.getElementById('aboutImg');
    if (about){
      gsap.fromTo(about, {y: 28}, {
        y: -28, ease: 'none',
        scrollTrigger: {trigger: '#about', start: 'top bottom', end: 'bottom top', scrub: true}
      });
    }

    // الصور تُحمَّل تدريجياً وتغيّر طول الصفحة — نعيد الحساب
    window.addEventListener('load', function(){ ST.refresh(); });
    setTimeout(function(){ ST.refresh(); }, 1500);
  }
})();
