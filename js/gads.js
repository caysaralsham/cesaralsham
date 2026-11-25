// تتبّع إعلانات جوجل (Google Ads): بيحسب «إحالة ناجحة» لما زائر يكبس على واتساب أو رقم الهاتف أو «اطلب السعر».
// هيك جوجل بيعرف أي إعلان جاب زبون فعلاً، وبيتعلّم يعرض الإعلان للناس اللي بتتواصل.
// إجراء الإحالة بحساب الإعلانات: «تواصل واتساب أو هاتف من الموقع» (AW-18562354670).
(function(){
  if(/^\/(my|studio-q7m4|links\/admin|admin-works|logo-tool|qs-home|home)/.test(location.pathname)) return; // الأدوات الخاصة
  var ID='AW-18562354670', SEND_TO=ID+'/x_8aCNnur78dEO6bnJNF';
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){dataLayer.push(arguments);};
  gtag('js',new Date()); gtag('config',ID);
  var s=document.createElement('script'); s.async=true; s.src='https://www.googletagmanager.com/gtag/js?id='+ID;
  (document.head||document.documentElement).appendChild(s);

  var last=0;
  function conv(){
    var now=Date.now(); if(now-last<1500) return; last=now; // ضغطة مزدوجة = وحدة
    try{ gtag('event','conversion',{send_to:SEND_TO,value:1.0,currency:'USD',transport_type:'beacon'}); }catch(e){}
  }
  window.__gadsConv=conv;
  // روابط واتساب والهاتف بكل الصفحات
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest&&e.target.closest('a[href*="wa.me/"],a[href*="api.whatsapp.com"],a[href^="whatsapp:"],a[href^="tel:"]');
    if(a) conv();
  },true);
  // زر «اطلب السعر» اللي بيفتح واتساب بنافذة (price-req.js)
  var wrap=function(){ if(window.askPrice&&!window.askPrice.__gads){ var o=window.askPrice; window.askPrice=function(){ conv(); return o.apply(this,arguments); }; window.askPrice.__gads=true; } };
  wrap(); document.addEventListener('DOMContentLoaded',wrap); window.addEventListener('load',wrap);
})();
