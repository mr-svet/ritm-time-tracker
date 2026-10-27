import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Agentation} from 'agentation';

// A separate React root: the journal itself remains a plain JavaScript app.
function Feedback(){
 const [path,setPath]=useState(location.pathname);
 const [authorized,setAuthorized]=useState(false);
 useEffect(()=>{
  let alive=true;
  const check=async()=>{
   try{
    const response=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});
    const session=response.ok?await response.json():null;
    if(alive)setAuthorized(session?.authenticated===true&&session.role==='owner');
   }catch{if(alive)setAuthorized(false);}
  };
  const onClick=event=>{if(event.target instanceof Element&&event.target.closest('[data-action="logout"]'))setAuthorized(false);};
  const onVisibility=()=>{if(!document.hidden)void check();};
  void check();
  const timer=setInterval(check,10000);
  document.addEventListener('click',onClick,true);
  document.addEventListener('visibilitychange',onVisibility);
  return ()=>{alive=false;clearInterval(timer);document.removeEventListener('click',onClick,true);document.removeEventListener('visibilitychange',onVisibility);};
 },[]);
 useEffect(()=>{
  const update=()=>setPath(location.pathname);
  const timer=setInterval(update,500);
  addEventListener('popstate',update);
  return ()=>{clearInterval(timer);removeEventListener('popstate',update);};
 },[]);
 if(!authorized)return null;
 return React.createElement(Agentation,{key:path,appName:'Ritm',endpoint:'http://localhost:4747'});
}
const host=document.createElement('div');
host.id='ritm-agentation';
document.body.append(host);
createRoot(host).render(React.createElement(Feedback));
