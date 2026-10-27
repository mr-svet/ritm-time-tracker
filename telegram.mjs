// SDK is loaded only by /tg. Never persist initData or credentials on the device.
import {installTelegramPlatform} from './telegram-platform.mjs';
const basePath=document.documentElement.dataset.basePath||'';
const webApp=window.Telegram?.WebApp;
document.documentElement.dataset.miniapp='true';
const params=new URLSearchParams(location.search);
history.replaceState(null,'',basePath+'/tg'+(params.has('view')?'?view='+encodeURIComponent(params.get('view')):''));
installTelegramPlatform(webApp,window,document);
await import('./app.mjs');
