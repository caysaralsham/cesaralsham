// زر «أدواتي» الصغير: بيبين بس لصاحب البرامج لما يكون فايت من صفحة «أدواتي» (cesar-alcham.com/my)
// الزبائن ما بيشوفوه أبداً. ما بيبين جوّا الإطارات (متل محرك الرسم) ولا بالطباعة.
(function(){
  try{
    if(window.top !== window) return;
    var p = location.pathname.replace(/\/+$/, '');
    if(p === '/my'){ sessionStorage.setItem('fromMy','1'); return; }
    if(sessionStorage.getItem('fromMy') !== '1') return;
  }catch(e){ return; }
  function add(){
    if(document.getElementById('myBackBtn')) return;
    var st = document.createElement('style');
    st.textContent = '#myBackBtn{position:fixed;left:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;align-items:center;gap:4px;padding:6px 12px;border-radius:999px;background:rgba(59,36,20,.88);color:#F5ECDD;font:700 13px/1.2 Cairo,Tahoma,sans-serif;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.22);opacity:.9;direction:rtl}#myBackBtn:hover{opacity:1}@media print{#myBackBtn{display:none!important}}';
    document.head.appendChild(st);
    var a = document.createElement('a');
    a.id = 'myBackBtn'; a.href = '/my/'; a.textContent = '↩ أدواتي'; a.setAttribute('aria-label','رجوع إلى أدواتي');
    a.addEventListener('click', function(e){ e.preventDefault(); location.assign('/my/'); });
    document.body.appendChild(a);
  }
  if(document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
