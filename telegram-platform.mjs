// Presentation only. Never read or persist initData, credentials or journal data.
export function dayScene({guest=false,theme='dark',selected='forest'}={}){
 if(guest)return theme==='light'?'mountains':'forest';
 return ['forest','dawn','mountains','lake','meadow','coast'].includes(selected)?selected:'forest';
}

export function presentationColor(value,theme='dark'){
 const color=/^#[0-9a-f]{6}$/i.test(value||'')?value.toLowerCase():'#a6bbb4';
 if(theme!=='light')return color;
 const defaults=['#42d7a6','#7ba7ff','#f5b95f','#b799fa','#ee829d','#6dd4e6','#c6d788'];
 const palette=['#18866f','#3876cb','#b47624','#825ac1','#bc5076','#21879f','#6c8528'];
 const index=defaults.indexOf(color);if(index>=0)return palette[index];
 const tint=[83,123,150];
 return '#'+[1,3,5].map((offset,i)=>Math.round(parseInt(color.slice(offset,offset+2),16)*.72+tint[i]*.28).toString(16).padStart(2,'0')).join('');
}

export function telegramAppearance({miniapp=false,prefs={},legacy={},colorScheme}={}){
 prefs=prefs&&typeof prefs==='object'?prefs:{};
 legacy=legacy&&typeof legacy==='object'?legacy:{};
 const validTheme=value=>['light','dark'].includes(value);
 const savedTheme=validTheme(prefs.theme)?prefs.theme:validTheme(legacy.theme)?legacy.theme:null;
 const automatic=miniapp&&(prefs.themeSource==='telegram'||!savedTheme);
 return {
  language:['ru','en'].includes(prefs.language)?prefs.language:miniapp?'ru':'en',
  theme:automatic?(validTheme(colorScheme)?colorScheme:'dark'):savedTheme||'dark',
  themeSource:automatic?'telegram':'manual'
 };
}

export function telegramGeometry(sdk={},visualHeight,editing=false,restingHeight=0){
 const size=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
 const insets=Object.fromEntries(['top','bottom','left','right'].map(side=>[side,Math.max(size(sdk.safeAreaInset?.[side]),size(sdk.contentSafeAreaInset?.[side]))]));
 const stable=size(sdk.viewportStableHeight)||size(sdk.viewportHeight);
 const candidates=[size(sdk.viewportHeight),size(visualHeight)].filter(Boolean);
 const visible=candidates.length?Math.min(...candidates):stable;
 return {insets,stable,visible,keyboard:editing&&Math.max(stable,size(restingHeight))-visible>120};
}

export function installTelegramPlatform(sdk,win,doc){
 if(!sdk)return;
 const root=doc.documentElement;
 const emit=(name,detail)=>win.dispatchEvent(new win.CustomEvent(name,{detail}));
 const supported=version=>typeof sdk.isVersionAtLeast==='function'&&sdk.isVersionAtLeast(version);
 let restingHeight=0;
 const updateGeometry=()=>{
  const editing=!!doc.activeElement?.matches?.('textarea,input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]),[contenteditable="true"]');
  const geometry=telegramGeometry(sdk,win.visualViewport?.height,editing,restingHeight);
  if(!editing)restingHeight=geometry.stable;
  for(const [side,value] of Object.entries(geometry.insets))root.style.setProperty('--tg-safe-'+side,value+'px');
  if(geometry.stable)root.style.setProperty('--ritm-viewport-height',geometry.stable+'px');
  if(geometry.visible)root.style.setProperty('--ritm-visible-height',geometry.visible+'px');
  const keyboardOpened=geometry.keyboard&&root.dataset.keyboard!=='true';
  root.dataset.keyboard=String(geometry.keyboard);
  if(keyboardOpened)doc.activeElement?.scrollIntoView?.({block:'nearest',inline:'nearest'});
 };
 const updateBack=()=>new URLSearchParams(win.location?.search||'').get('view')?sdk.BackButton?.show():sdk.BackButton?.hide();
 sdk.ready?.();sdk.expand?.();
 sdk.BackButton?.onClick(()=>{if(new URLSearchParams(win.location?.search||'').get('view'))win.history.back();else sdk.close?.();});
 win.addEventListener('popstate',updateBack);win.addEventListener('ritm:navigate',updateBack);
 sdk.onEvent?.('themeChanged',()=>emit('ritm:telegram-theme',{theme:sdk.colorScheme}));
 for(const name of ['safeAreaChanged','contentSafeAreaChanged','viewportChanged'])sdk.onEvent?.(name,updateGeometry);
 win.visualViewport?.addEventListener('resize',updateGeometry);
 for(const name of ['focusin','focusout'])doc.addEventListener?.(name,()=>win.setTimeout(updateGeometry,0));
 win.addEventListener('ritm:dirty',event=>{
  if(!supported('6.2'))return;
  try{if(event.detail.dirty)sdk.enableClosingConfirmation?.();else sdk.disableClosingConfirmation?.();}catch{}
 });
 win.addEventListener('ritm:appearance',event=>{
  if(!supported('6.1'))return;
  const color=event.detail.theme==='light'?'#edf4fa':'#051f20';
  try{sdk.setHeaderColor?.(color);sdk.setBackgroundColor?.(color);}catch{}
 });
 win.addEventListener('ritm:open-chat',()=>sdk.close?.());
 updateGeometry();updateBack();
}
