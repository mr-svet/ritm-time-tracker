// SDK is loaded only by /tg. Never persist initData or credentials on the device.
const basePath=document.documentElement.dataset.basePath||'';
const webApp=window.Telegram?.WebApp;
document.documentElement.dataset.miniapp='true';
const params=new URLSearchParams(location.search);
history.replaceState(null,'',basePath+'/tg'+(params.has('view')?'?view='+encodeURIComponent(params.get('view')):''));
if(webApp){
 webApp.ready();webApp.expand();
 const updateInsets=()=>{
  for(const [name,value] of Object.entries(webApp.contentSafeAreaInset??{}))document.documentElement.style.setProperty('--tg-safe-'+name,Math.max(0,Number(value)||0)+'px');
 };
 updateInsets();webApp.onEvent('contentSafeAreaChanged',updateInsets);
 webApp.BackButton.onClick(()=>{if(new URLSearchParams(location.search).get('view'))history.back();else webApp.close();});
 const updateBack=()=>new URLSearchParams(location.search).get('view')?webApp.BackButton.show():webApp.BackButton.hide();
 window.addEventListener('popstate',updateBack);window.addEventListener('ritm:navigate',updateBack);updateBack();
 const supported=version=>typeof webApp.isVersionAtLeast==='function'&&webApp.isVersionAtLeast(version);
 window.addEventListener('ritm:dirty',event=>{if(!supported('6.2'))return;try{if(event.detail.dirty)webApp.enableClosingConfirmation?.();else webApp.disableClosingConfirmation?.();}catch{}});
 const updateViewport=()=>{const height=Number(webApp.viewportStableHeight)||Number(webApp.viewportHeight);if(height>0)document.documentElement.style.setProperty('--ritm-viewport-height',height+'px');};
 updateViewport();webApp.onEvent('viewportChanged',updateViewport);
}
await import('./app.mjs');
