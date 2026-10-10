// فحص بسيط إنو Pages Functions شغالة
export const onRequest=()=>new Response('functions-ok',{headers:{'content-type':'text/plain','cache-control':'no-store'}});
