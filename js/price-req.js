// طلب السعر: بيفتح واتساب برسالة جاهزة (اسم الشغلة ورابط الصورة)
(function(){
  const WA='213541737888';
  const css=`.pr-ov{position:fixed;inset:0;background:rgba(30,18,10,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}
  .pr-box{background:#FBF6EE;color:#3B2414;border-radius:18px;width:100%;max-width:420px;padding:20px;font-family:Cairo,Tahoma,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.3);direction:rtl;text-align:right}
  .pr-box h3{margin:0 0 4px;font-size:18px}.pr-box .sub{font-size:13px;color:#7A5C40;margin-bottom:14px}
  .pr-b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:12px;padding:12px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;margin-bottom:10px;text-decoration:none}
  .pr-wa{background:#1F8F55;color:#fff}.pr-site{background:#9A6A3A;color:#fff}.pr-x{background:transparent;color:#7A5C40}
  .pr-box label{display:block;font-size:13px;font-weight:700;margin:8px 0 4px}.pr-box input,.pr-box textarea{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border:1px solid #E6D6BC;border-radius:10px;background:#F5ECDD}
  .pr-err{color:#A6453D;font-size:13px;min-height:1em;margin:6px 0}`;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  const esc=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function save(data){
    return firebase.firestore().collection('site_requests').add(Object.assign({at:Date.now(),page:location.pathname,done:false},data));
  }
  window.siteRequest=save;
  window.askPrice=function(name,link,waText){
    window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(waText||('السلام عليكم، أريد معرفة سعر هذا العمل: '+name+(link?'\n'+link:''))),'_blank');
  };
})();
