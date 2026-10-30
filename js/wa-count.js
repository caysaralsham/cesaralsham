// عدّاد «طلب السعر عبر واتساب»: كل ما زائر يكبس على زر واتساب أو «اطلب السعر» بالموقع
// بنزيد عدّاد اليوم بـ 1 (ومرة وحدة باليوم لعدّ الزوار المختلفين)، مع اسم العمل/القسم.
// ما في اسم ولا رقم ولا أي بيانات شخصية. القراءة بس لصاحب الموقع (قاعدة cesar_price_clicks).
// ملاحظة: هيك منعرف مين فتح واتساب ليطلب، مش مين بعت الرسالة فعلاً (هاد بدو ربط رسمي مع واتساب).
(function(){
  if(/^\/(my|studio-q7m4|links\/admin|admin-works|logo-tool|qs-home|home)/.test(location.pathname)) return; // الأدوات الخاصة ما بتنعد
  var P='basel-7b29b', KEY='AIzaSyDi1Pn7guMnyc0CetV8Z9IUC-k0gtav2_8';
  var ROOT='projects/'+P+'/databases/(default)/documents', API='https://firestore.googleapis.com/v1/'+ROOT+':commit?key='+KEY;
  function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function catKey(t){ // اسم العمل/القسم كمفتاح قصير (بلا رموز ممنوعة بأسماء الحقول)
    t=String(t||'').split('|')[0].replace(/\*\*/g,'').replace(/[`.\[\]*~\/\\#$]/g,' ').replace(/\s+/g,' ').trim().slice(0,40);
    return t||'عام';
  }
  var last=0;
  function hit(what){
    var now=Date.now(); if(now-last<1500) return; last=now; // ضغطة مزدوجة = وحدة
    var day=today(), first=false;
    try{ if(localStorage.getItem('wa_seen')!==day){ localStorage.setItem('wa_seen',day); first=true; } }catch(e){}
    var k=catKey(what);
    var tr=[{fieldPath:'count',increment:{integerValue:'1'}},{fieldPath:'uniq',increment:{integerValue:first?'1':'0'}},{fieldPath:'cats.`'+k.replace(/`/g,'')+'`',increment:{integerValue:'1'}}];
    var body={writes:[{update:{name:ROOT+'/cesar_price_clicks/'+day,fields:{date:{stringValue:day}}},updateMask:{fieldPaths:['date']},updateTransforms:tr}]};
    try{ fetch(API,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(function(){}); }catch(e){}
  }
  window.__waHit=hit;
  // روابط واتساب العادية (الهيدر، الفوتر، صفحات الأقسام، زر السعر بالمعرض)
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest&&e.target.closest('a[href*="wa.me/"],a[href*="api.whatsapp.com"],a[href*="whatsapp://"]'); if(!a) return;
    var what=a.getAttribute('data-work')||'';
    if(!what){ try{ var t=new URL(a.href,location.href).searchParams.get('text')||''; var m=t.match(/:\s*([^\n]+)/); what=m?m[1]:''; }catch(_){} }
    if(!what){ var h=document.querySelector('h1'); what=(location.pathname.indexOf('/a3mal-')>=0||location.pathname.indexOf('/fr/a3mal-')>=0)&&h?h.textContent:'واتساب عام'; }
    hit(what);
  },true);
  // زر «اطلب السعر» اللي بيفتح واتساب بنافذة (price-req.js)
  var wrap=function(){ if(window.askPrice&&!window.askPrice.__counted){ var o=window.askPrice; window.askPrice=function(name){ hit(name); return o.apply(this,arguments); }; window.askPrice.__counted=true; } };
  wrap(); document.addEventListener('DOMContentLoaded',wrap); window.addEventListener('load',wrap);
})();
