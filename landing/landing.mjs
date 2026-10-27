
    const about=document.getElementById('about-dialog');
    document.getElementById('about-open').addEventListener('click',()=>about.showModal());
    document.getElementById('about-close').addEventListener('click',()=>about.close());
    about.addEventListener('click',event=>{if(event.target===about){const rect=about.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)about.close();}});
  
// Preserve existing bookmarked journal hash links.
const legacy=location.hash.slice(1);if(['today','journal','stats','trends','settings'].includes(legacy))location.replace('/'+legacy);

// Keep keyboard skip navigation accessible without putting a fragment into the URL.
if(location.hash==='#main')history.replaceState(history.state,'',location.pathname+location.search);
document.querySelector('.skip').addEventListener('click',event=>{
 event.preventDefault();const main=document.getElementById('main');main.setAttribute('tabindex','-1');main.focus({preventScroll:true});
});

// Preload begins in HTML; decode finishes before the backdrop becomes visible.
const backdrop=document.querySelector('.landscape');
if(backdrop){
 const image=new Image();image.fetchPriority='high';image.src='/landing/breathe-forest-fast.jpg';
 image.decode().then(()=>backdrop.classList.add('is-ready')).catch(()=>{
  const fallback=new Image();fallback.src='/landing/breathe-forest.png';
  fallback.decode().then(()=>backdrop.classList.add('is-fallback','is-ready')).catch(()=>{});
 });
}

// Require a completed thumb drag; taps on the track do not open the journal.
const launchSlider=document.getElementById('slide-launch');
if(launchSlider){
 const handle=launchSlider.querySelector('.slide-handle'),label=launchSlider.querySelector('.slide-label');
 let progress=0,activePointer=null,startX=0,startProgress=0,committed=false;
 const travel=()=>Math.max(0,launchSlider.clientWidth-10-handle.getBoundingClientRect().width);
 const setProgress=value=>{progress=Math.max(0,Math.min(1,value));launchSlider.style.setProperty('--slide-offset',progress*travel()+'px');launchSlider.setAttribute('aria-valuenow',String(Math.round(progress*100)));};
 const openDemo=()=>{if(committed)return;committed=true;setProgress(1);launchSlider.classList.add('is-complete');label.textContent=launchSlider.dataset.opening;launchSlider.setAttribute('aria-valuetext',label.textContent);location.assign(launchSlider.dataset.href);};
 const finishDrag=(event,cancelled=false)=>{
  if(event.pointerId!==activePointer)return;
  activePointer=null;launchSlider.classList.remove('is-dragging');
  if(launchSlider.hasPointerCapture(event.pointerId))launchSlider.releasePointerCapture(event.pointerId);
  if(!cancelled&&progress>=.94)openDemo();else setProgress(0);
 };
 launchSlider.addEventListener('pointerdown',event=>{
  if(committed||activePointer!==null||event.button!==0)return;
  const rect=handle.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;
  event.preventDefault();activePointer=event.pointerId;startX=event.clientX;startProgress=progress;
  launchSlider.classList.add('is-dragging');launchSlider.setPointerCapture(event.pointerId);
 });
 launchSlider.addEventListener('pointermove',event=>{
  if(event.pointerId!==activePointer||committed)return;
  event.preventDefault();const length=travel();if(length)setProgress(startProgress+(event.clientX-startX)/length);
 });
 launchSlider.addEventListener('pointerup',event=>finishDrag(event));
 launchSlider.addEventListener('pointercancel',event=>finishDrag(event,true));
 launchSlider.addEventListener('lostpointercapture',event=>{if(event.pointerId===activePointer)finishDrag(event,true);});
 launchSlider.addEventListener('keydown',event=>{
  if(committed||activePointer!==null)return;
  if(event.key==='Enter'||event.key===' '){event.preventDefault();openDemo();}
  else if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();setProgress(event.key==='Home'?0:event.key==='End'?1:progress+(event.key==='ArrowRight'?0.1:-0.1));}
 });
 window.addEventListener('resize',()=>setProgress(progress));
 setProgress(0);
}
