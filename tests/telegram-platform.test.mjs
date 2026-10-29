import test from 'node:test';
import assert from 'node:assert/strict';
import {telegramAppearance,telegramGeometry,installTelegramPlatform} from '../telegram-platform.mjs';

test('fresh Mini App starts in Russian and follows Telegram theme',()=>{
 assert.deepEqual(telegramAppearance({miniapp:true,colorScheme:'light'}),{language:'ru',theme:'light',themeSource:'telegram'});
 assert.equal(telegramAppearance({miniapp:true,colorScheme:'dark'}).theme,'dark');
 assert.deepEqual(telegramAppearance({miniapp:false,colorScheme:'light'}),{language:'en',theme:'dark',themeSource:'manual'});
});
test('manual and legacy choices win, automatic theme keeps following Telegram',()=>{
 assert.deepEqual(telegramAppearance({miniapp:true,colorScheme:'light',prefs:{language:'en',theme:'dark'}}),{language:'en',theme:'dark',themeSource:'manual'});
 assert.deepEqual(telegramAppearance({miniapp:true,colorScheme:'light',prefs:{language:'ru',theme:'dark',themeSource:'telegram'}}),{language:'ru',theme:'light',themeSource:'telegram'});
 assert.equal(telegramAppearance({miniapp:true,colorScheme:'dark',legacy:{theme:'light'}}).theme,'light');
 assert.equal(telegramAppearance({miniapp:true,prefs:{language:'invalid',theme:'invalid'}}).language,'ru');
 assert.equal(telegramAppearance({miniapp:true,prefs:null}).language,'ru');
});
test('device and Telegram safe areas combine without adding overlapping insets',()=>{
 const g=telegramGeometry({safeAreaInset:{top:44,bottom:34,left:-3},contentSafeAreaInset:{top:80,bottom:0,right:Infinity},viewportStableHeight:800,viewportHeight:800},500,true);
 assert.deepEqual(g.insets,{top:80,bottom:34,left:0,right:0});
 assert.equal(g.stable,800);assert.equal(g.visible,500);assert.equal(g.keyboard,true);
 assert.equal(telegramGeometry({viewportStableHeight:800,viewportHeight:500},500,false).keyboard,false);
 assert.equal(telegramGeometry({viewportStableHeight:800,viewportHeight:800},790,true).keyboard,false);
});

function platformHarness(){
 const win=new EventTarget(),doc=new EventTarget(),sdkEvents={},css={},calls=[];
 win.CustomEvent=class extends Event{constructor(type,options){super(type);this.detail=options.detail;}};
 win.location={search:''};win.history={back:()=>calls.push('back')};win.visualViewport=new EventTarget();win.visualViewport.height=800;
 win.setTimeout=fn=>fn();
 doc.documentElement={dataset:{},style:{setProperty:(key,value)=>css[key]=value}};doc.activeElement={matches:()=>false};
 const sdk={colorScheme:'light',viewportHeight:800,viewportStableHeight:800,safeAreaInset:{bottom:34},ready:()=>calls.push('ready'),expand:()=>calls.push('expand'),onEvent:(name,fn)=>sdkEvents[name]=fn,isVersionAtLeast:()=>true,BackButton:{onClick:fn=>sdkEvents.back=fn,show:()=>calls.push('show'),hide:()=>calls.push('hide')},close:()=>calls.push('close'),enableClosingConfirmation:()=>calls.push('dirty'),disableClosingConfirmation:()=>calls.push('clean'),setHeaderColor:color=>calls.push(color),setBackgroundColor:color=>calls.push(color)};
 installTelegramPlatform(sdk,win,doc);
 return {win,doc,sdk,sdkEvents,css,calls,emit:(name,detail)=>win.dispatchEvent(new win.CustomEvent(name,{detail}))};
}
test('SDK events update theme, device insets, viewport and chat navigation',()=>{
 const h=platformHarness(),themes=[];
 h.win.addEventListener('ritm:telegram-theme',e=>themes.push(e.detail.theme));
 h.sdk.colorScheme='dark';h.sdkEvents.themeChanged();assert.deepEqual(themes,['dark']);
 h.sdk.safeAreaInset.bottom=40;h.sdkEvents.safeAreaChanged();assert.equal(h.css['--tg-safe-bottom'],'40px');
 h.doc.activeElement={matches:()=>true};h.win.visualViewport.height=480;h.win.visualViewport.dispatchEvent(new Event('resize'));
 assert.equal(h.doc.documentElement.dataset.keyboard,'true');assert.equal(h.css['--ritm-visible-height'],'480px');
 h.sdk.viewportStableHeight=480;h.sdk.viewportHeight=480;h.sdkEvents.viewportChanged();
 assert.equal(h.doc.documentElement.dataset.keyboard,'true','keyboard stays detected when Telegram settles at the shorter height');
 h.emit('ritm:dirty',{dirty:true});assert.ok(h.calls.includes('dirty'));
 h.emit('ritm:appearance',{theme:'light'});assert.ok(h.calls.includes('#edf4fa'));
 h.win.location.search='?view=stats';h.emit('ritm:navigate');h.sdkEvents.back();assert.ok(h.calls.includes('show'));assert.ok(h.calls.includes('back'));
 h.emit('ritm:open-chat');assert.equal(h.calls.at(-1),'close');
});
test('older Telegram clients can omit new inset and chrome methods',()=>{
 assert.doesNotThrow(()=>installTelegramPlatform({ready(){},expand(){},onEvent(){}},new EventTarget(),{documentElement:{dataset:{},style:{setProperty(){}}}}));
});

test('visitor picture follows theme while owner keeps the selected scene',async()=>{
 const {dayScene}=await import('../telegram-platform.mjs');
 assert.equal(dayScene({guest:true,theme:'light',selected:'coast'}),'mountains');
 assert.equal(dayScene({guest:true,theme:'dark',selected:'mountains'}),'forest');
 assert.equal(dayScene({theme:'light',selected:'coast'}),'coast');
 assert.equal(dayScene({theme:'dark',selected:'lake'}),'lake');
 assert.equal(dayScene({selected:'invalid'}),'forest');
});
test('light chart palette is presentation-only, opaque and distinct; dark colors remain unchanged',async()=>{
 const {presentationColor}=await import('../telegram-platform.mjs');
 const colors=['#42d7a6','#7ba7ff','#f5b95f','#b799fa','#ee829d','#6dd4e6','#c6d788'];
 assert.equal(new Set(colors.map(c=>presentationColor(c,'light'))).size,colors.length);
 for(const color of colors){assert.equal(presentationColor(color,'dark'),color);assert.match(presentationColor(color,'light'),/^#[0-9a-f]{6}$/);assert.notEqual(presentationColor(color,'light'),color);}
 assert.equal(presentationColor('#123456','dark'),'#123456');
 assert.match(presentationColor('#123456','light'),/^#[0-9a-f]{6}$/);
});
