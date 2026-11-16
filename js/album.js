// ألبوم العمل: عدة صور لنفس القطعة (واجهة منزل، جرن، مغسلة...) = بطاقة وحدة + عارض بتقليب الصور.
// الصور اللي إلها نفس «grp» (أو grp تبعها = id صورة تانية) بنفس القسم بتنعرض كعمل واحد.
// الغلاف = أول صورة بالترتيب (gi الأصغر، وبعدها الأقدم).
(function(){
  var keyOf=function(it){return (it&&(it.grp||it.id)||'')+'|'+String(it&&it.category||'').trim()};
  // list مرتبة جاهزة → [{it: الغلاف, pics: [كل صور العمل]}] بنفس ترتيب أول ظهور
  function group(list){
    var out=[],at={};
    (list||[]).forEach(function(it){if(!it)return;var k=keyOf(it);
      if(at[k])at[k].pics.push(it);else{at[k]={it:it,pics:[it]};out.push(at[k])}});
    out.forEach(function(e){if(e.pics.length<2)return;
      e.pics.sort(function(a,b){return ((a.gi==null?1e9:a.gi)-(b.gi==null?1e9:b.gi))||((a.createdAt||0)-(b.createdAt||0))});
      e.it=e.pics[0]});
    return out;
  }
  // غلاف العمل اللي فيه هالصورة (لـ«أحدث أعمالنا»: العمل بيبين مرة وحدة وبصورة غلافه)
  function coverOf(it,all){var k=keyOf(it),g=group((all||[]).filter(function(x){return keyOf(x)===k}));return g.length?g[0].it:it}

  var CSS='.alb-ov{position:fixed;inset:0;z-index:400;background:rgba(20,13,8,.95);display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 12px 14px;font-family:Cairo,Tahoma,Arial,sans-serif}'
    +'.alb-ov.on{display:flex}'
    +'.alb-stage{position:relative;flex:1 1 0;min-height:0;width:100%;touch-action:pan-y}'
    +'.alb-stage img{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 12px 44px rgba(0,0,0,.55);user-select:none;-webkit-user-drag:none}'
    +'.alb-b{position:absolute;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(217,185,140,.65);background:rgba(59,36,20,.72);color:#F5ECDD;cursor:pointer;font:inherit;line-height:1;padding:0;border-radius:50%}'
    +'.alb-b:hover{background:#9A6A3A;border-color:#D9B98C}.alb-b:focus-visible{outline:2px solid #E6C48F;outline-offset:3px}'
    +'.alb-x{top:10px;right:12px;width:42px;height:42px;font-size:26px}.alb-rtl .alb-x{right:auto;left:12px}'
    +'.alb-nav{top:50%;transform:translateY(-50%);width:48px;height:48px;z-index:2}.alb-nav svg{width:22px;height:22px}'
    +'.alb-l{left:6px}.alb-r{right:6px}'
    +'.alb-n{position:absolute;top:18px;left:18px;color:#D9B98C;font-weight:800;font-size:15px;direction:ltr;font-variant-numeric:tabular-nums}.alb-rtl .alb-n{left:auto;right:18px}'
    +'.alb-cap,.alb-th,.alb-price{flex:0 0 auto}.alb-cap{color:#F5ECDD;font-weight:800;font-size:16px;text-align:center;max-width:92vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.alb-th{display:flex;gap:6px;max-width:100%;overflow-x:auto;padding:3px;scrollbar-width:thin}'
    +'.alb-th button{flex:0 0 auto;width:58px;height:58px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#2A190D;cursor:pointer;opacity:.55}'
    +'.alb-th button[aria-current=true]{border-color:#D9B98C;opacity:1}.alb-th button:focus-visible{outline:2px solid #E6C48F;outline-offset:2px}'
    +'.alb-th img{width:100%;height:100%;object-fit:cover;display:block}'
    +'.alb-price{display:inline-flex;align-items:center;gap:6px;background:#16774A;color:#fff!important;font-weight:800;font-size:15px;padding:10px 22px;border-radius:12px;text-decoration:none!important}'
    +'.alb-price:hover{background:#125f3b}'
    +'.alb-one .alb-nav,.alb-one .alb-n,.alb-one .alb-th{display:none}'
    +'@media(max-width:560px){.alb-nav{width:40px;height:40px}.alb-th button{width:48px;height:48px}.alb-ov{padding-top:52px}}';
  var ARROW=function(d){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(d<0?'M15 5l-7 7 7 7':'M9 5l7 7-7 7')+'"/></svg>'};
  var ov,els={},cur=null,back=null;
  function fr(){return (document.documentElement.lang||'').slice(0,2)==='fr'}
  function rtl(){return (document.documentElement.dir||getComputedStyle(document.documentElement).direction)==='rtl'}
  function build(){
    if(ov)return;
    var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    var L=fr()?{x:'Fermer',p:'Photo précédente',n:'Photo suivante',g:'Photos de cette réalisation'}:{x:'إغلاق',p:'الصورة السابقة',n:'الصورة التالية',g:'صور هذا العمل'};
    ov=document.createElement('div');ov.className='alb-ov'+(rtl()?' alb-rtl':'');ov.id='albumOverlay';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
    // السهم اللي على جهة «التالي»: يسار بالعربي، يمين بالفرنسي
    ov.innerHTML='<span class="alb-n" aria-live="polite"></span><button type="button" class="alb-b alb-x" aria-label="'+L.x+'">×</button>'
      +'<div class="alb-stage"><button type="button" class="alb-b alb-nav alb-l" data-d="'+(rtl()?1:-1)+'" aria-label="'+(rtl()?L.n:L.p)+'">'+ARROW(-1)+'</button><img alt=""><button type="button" class="alb-b alb-nav alb-r" data-d="'+(rtl()?-1:1)+'" aria-label="'+(rtl()?L.p:L.n)+'">'+ARROW(1)+'</button></div>'
      +'<div class="alb-cap"></div><div class="alb-th" role="group" aria-label="'+L.g+'"></div><a class="alb-price" target="_blank" rel="nofollow noopener" href="#"></a>';
    document.body.appendChild(ov);
    els={n:ov.querySelector('.alb-n'),img:ov.querySelector('.alb-stage img'),cap:ov.querySelector('.alb-cap'),th:ov.querySelector('.alb-th'),price:ov.querySelector('.alb-price'),x:ov.querySelector('.alb-x'),stage:ov.querySelector('.alb-stage')};
    els.x.addEventListener('click',close);
    ov.addEventListener('click',function(e){
      var b=e.target.closest('.alb-nav');if(b){go(+b.dataset.d);return}
      var t=e.target.closest('.alb-th button');if(t){show(+t.dataset.i);return}
      if(e.target===ov||e.target===els.stage)close()});
    els.price.addEventListener('click',function(e){if(cur&&cur.price&&cur.price.click)cur.price.click(cur.pics[cur.i].src,e)});
    document.addEventListener('keydown',function(e){if(!cur)return;
      if(e.key==='Escape')close();
      else if(e.key==='ArrowLeft')go(rtl()?1:-1);
      else if(e.key==='ArrowRight')go(rtl()?-1:1)});
    // السحب بالإصبع: متل تقليب الصفحات (بالعربي السحب لليمين = التالي)
    var x0=null,y0=0;
    els.stage.addEventListener('touchstart',function(e){if(e.touches.length===1){x0=e.touches[0].clientX;y0=e.touches[0].clientY}},{passive:true});
    els.stage.addEventListener('touchend',function(e){if(x0==null)return;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
      if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)go((dx>0)===rtl()?1:-1)},{passive:true});
  }
  function go(d){if(!cur||cur.pics.length<2)return;show((cur.i+d+cur.pics.length)%cur.pics.length)}
  function show(i){
    if(!cur)return;cur.i=i;var p=cur.pics[i],n=cur.pics.length;
    els.img.src=p.src;els.img.alt=p.alt||cur.cap||'';
    els.n.textContent=(i+1)+' / '+n;
    [].forEach.call(els.th.children,function(b,k){b.setAttribute('aria-current',k===i?'true':'false');if(k===i&&b.scrollIntoView)try{b.scrollIntoView({block:'nearest',inline:'center'})}catch(_){}});
    if(n>1){var nx=new Image();nx.src=cur.pics[(i+1)%n].src} // الصورة التالية بتتحمّل سلف
    if(cur.price){var my=cur,want=i;els.price.href=cur.price.base||'#';
      try{Promise.resolve(cur.price.href?cur.price.href(p.src):'').then(function(h){if(h&&cur===my&&cur.i===want)els.price.href=h}).catch(function(){})}catch(_){}}
  }
  // o = {pics:[{src,alt}], i, cap, price:{label, base, href(src)→رابط أو وعد, click(src,event)}}
  function open(o){
    if(!o||!o.pics||!o.pics.length)return;
    build();cur={pics:o.pics,i:0,cap:o.cap||'',price:o.price||null};back=document.activeElement;
    ov.classList.toggle('alb-one',o.pics.length<2);
    els.cap.textContent=cur.cap;els.cap.style.display=cur.cap?'':'none';
    els.th.innerHTML=o.pics.length>1?o.pics.map(function(p,k){return '<button type="button" data-i="'+k+'" aria-label="'+(k+1)+' / '+o.pics.length+'"><img src="'+String(p.src).replace(/"/g,'&quot;')+'" alt="" loading="lazy"></button>'}).join(''):'';
    els.price.style.display=cur.price?'':'none';if(cur.price)els.price.textContent=cur.price.label||'';
    ov.classList.add('on');document.documentElement.style.overflow='hidden';
    show(Math.max(0,Math.min(o.pics.length-1,o.i||0)));
    try{els.x.focus({preventScroll:true})}catch(_){}
  }
  function close(){if(!ov)return;ov.classList.remove('on');document.documentElement.style.overflow='';els.img.removeAttribute('src');cur=null;
    if(back&&back.focus)try{back.focus({preventScroll:true})}catch(_){}}
  window.Album={group:group,coverOf:coverOf,keyOf:keyOf,open:open,close:close};
})();
