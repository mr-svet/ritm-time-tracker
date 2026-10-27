import {TIMEZONES,localNow} from '../domain.mjs';

// Public city forecasts only. No journal data, account IDs or device location.
const forecasts=new Map(),locations=new Map();
const TTL=30*60*1000,RETRY=5*60*1000;
async function readJSON(url,fetchImpl){
 const response=await fetchImpl(url,{signal:AbortSignal.timeout(5000),redirect:'error',headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Weather provider unavailable');
 const bytes=Number(response.headers.get('content-length'));
 if(bytes>262144)throw new Error('Weather response too large');
 const text=await response.text();if(text.length>262144)throw new Error('Weather response too large');
 return JSON.parse(text);
}
export async function cityWeather({city,timezone,at=new Date(),fetchImpl=fetch}={}){
 const known=TIMEZONES.find(z=>z.city===city&&z.id===timezone);
 if(!known)return null;
 const date=localNow(timezone,at).date,key=`${timezone}|${city}`,cached=forecasts.get(key);
 if(cached?.date===date&&cached.until>at.getTime())return cached.promise;
 const promise=(async()=>{
  let location=locations.get(key);
  if(!location){
   const url=new URL('https://geocoding-api.open-meteo.com/v1/search');
   url.search=new URLSearchParams({name:city,count:'20',language:'ru',format:'json'}).toString();
   const geo=await readJSON(url,fetchImpl);
   location=geo.results?.filter(p=>p.timezone===timezone&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&/^PPL/.test(p.feature_code||'')).sort((a,b)=>(b.population||0)-(a.population||0))[0];
   if(!location)throw new Error('City not found');
   locations.set(key,{latitude:location.latitude,longitude:location.longitude});
  }
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.search=new URLSearchParams({latitude:String(location.latitude),longitude:String(location.longitude),timezone,daily:'weather_code,temperature_2m_max,temperature_2m_min',forecast_days:'1'}).toString();
  const data=await readJSON(url,fetchImpl),daily=data.daily;
  const value={city,timezone,date:daily?.time?.[0],min:daily?.temperature_2m_min?.[0],max:daily?.temperature_2m_max?.[0],code:daily?.weather_code?.[0]};
  if(value.date!==date||![value.min,value.max,value.code].every(Number.isFinite))throw new Error('Forecast unavailable');
  return value;
 })().catch(()=>{const row=forecasts.get(key);if(row?.promise===promise)row.until=Date.now()+RETRY;return null;});
 forecasts.set(key,{date,until:at.getTime()+TTL,promise});
 return promise;
}
