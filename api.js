/** Public OpenF1 adapter. No credentials and no fabricated live fallback.
 * Historical data is public. Live data may require the provider's subscription.
 */
import {createReplayEngine} from './engine.js';
const BASE='https://api.openf1.org/v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export class F1DataError extends Error {
  constructor(code,message,details={}) {super(message);this.name='F1DataError';this.code=code;Object.assign(this,details);}
}
const delay=(ms,signal)=>new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new DOMException('Aborted','AbortError'));
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  function abort(){clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));}
  signal?.addEventListener('abort',abort,{once:true});
});
function createClient({signal,timeout=15000}={}) {
  let nextStart=0;
  return async function get(endpoint,params={}) {
    for(let attempt=0;attempt<3;attempt++) {
      const wait=Math.max(0,nextStart-Date.now());nextStart=Math.max(Date.now(),nextStart)+420;
      if(wait)await delay(wait,signal);
      const controller=new AbortController();
      const abort=()=>controller.abort(signal?.reason);
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      signal?.addEventListener('abort',abort,{once:true});
      const timeoutId=setTimeout(()=>controller.abort(),timeout);
      const url=new URL(`${BASE}/${endpoint}`);
      for(const [key,value]of Object.entries(params))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
      try {
        const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
        if(response.status===401||response.status===403)throw new F1DataError('LIVE_ACCESS_REQUIRED','Dane na żywo wymagają dostępu u dostawcy OpenF1. Archiwalne demo pozostaje dostępne.',{status:response.status});
        if(response.status===429) {
          if(attempt<2) {await delay(Math.min(8000,Math.max(1000,Number(response.headers.get('Retry-After')||2)*1000)),signal);continue;}
          throw new F1DataError('RATE_LIMIT','OpenF1 ogranicza teraz liczbę zapytań. Spróbuj ponownie za chwilę.',{status:429});
        }
        if(!response.ok) {
          if(response.status>=500&&attempt<2){await delay(1000*(attempt+1),signal);continue;}
          throw new F1DataError('PROVIDER_ERROR',`Dostawca danych zwrócił błąd ${response.status}.`,{status:response.status});
        }
        const json=await response.json();
        if(!Array.isArray(json))throw new F1DataError('INVALID_RESPONSE','Dostawca zwrócił nieprawidłowy format danych.');
        return json;
      }catch(error){
        if(error instanceof F1DataError)throw error;
        if(signal?.aborted)throw new DOMException('Aborted','AbortError');
        if(controller.signal.aborted)throw new F1DataError('TIMEOUT','Odpowiedź OpenF1 trwała zbyt długo. Demo działa bez połączenia.');
        throw new F1DataError('NETWORK','Nie udało się połączyć z OpenF1. Sprawdź połączenie lub wróć do demo.',{cause:error});
      }finally{clearTimeout(timeoutId);signal?.removeEventListener('abort',abort);}
    }
  };
}
function normalize(session,raw,active=false) {
  const epoch=Date.parse(session.date_start);
  const t=date=>(Date.parse(date)-epoch)/1000;
  const drivers=raw.drivers.map(d=>({number:d.driver_number,code:d.name_acronym,firstName:d.first_name,lastName:d.last_name,team:d.team_name,color:d.team_colour?`#${d.team_colour}`:'#9ca3af',headshot:d.headshot_url}));
  const laps=raw.laps.filter(l=>l.date_start).map(l=>({driver:l.driver_number,lap:l.lap_number,t:t(l.date_start),duration:l.lap_duration,sectors:[l.duration_sector_1,l.duration_sector_2,l.duration_sector_3],pitOut:l.is_pit_out_lap}));
  const firstLaps=laps.filter(l=>l.lap===1).map(l=>l.t);
  const resultLaps=raw.results.map(r=>r.number_of_laps).filter(finite);
  const totalLaps=Math.max(1,...laps.map(l=>l.lap),...resultLaps);
  const knownFinish=laps.filter(l=>l.duration>0).map(l=>l.t+l.duration);
  const dataset={
    session:{...session,name:`${session.country_name} · ${session.year||new Date(session.date_start).getFullYear()}`,circuit:session.circuit_short_name,totalLaps,totalLapsKnown:!active,isActive:active,raceStart:firstLaps.length?Math.min(...firstLaps):0,raceEnd:Math.max(0,...knownFinish)},
    drivers,laps,
    positions:raw.positions.map(p=>({t:t(p.date),driver:p.driver_number,position:p.position})),
    intervals:raw.intervals.map(p=>({t:t(p.date),driver:p.driver_number,gap:p.gap_to_leader,interval:p.interval})),
    stints:raw.stints.map(s=>({driver:s.driver_number,stint:s.stint_number,from:s.lap_start,to:s.lap_end,compound:s.compound,ageStart:s.tyre_age_at_start})),
    pit:raw.pit.map(p=>({t:t(p.date),driver:p.driver_number,lap:p.lap_number,duration:p.stop_duration,laneDuration:p.lane_duration??p.pit_duration})),
    weather:raw.weather.map(w=>({t:t(w.date),air:w.air_temperature,track:w.track_temperature,rain:w.rainfall,humidity:w.humidity,windSpeed:w.wind_speed})),
    raceControl:raw.raceControl.map(r=>({t:t(r.date),category:r.category,flag:r.flag,scope:r.scope,sector:r.sector,driver:r.driver_number,lap:r.lap_number,message:r.message})),
    results:raw.results.map(r=>({driver:r.driver_number,position:r.position,laps:r.number_of_laps,dnf:r.dnf,dns:r.dns,dsq:r.dsq,gap:r.gap_to_leader,duration:r.duration})),
    track:null
  };
  return dataset;
}

/**
 * Fetch latest started race available publicly. Never selects a future race.
 * Returns actual source timestamps. isLive is true ONLY when the session is
 * active and timing data is at most 120 seconds old; an old archive is not live.
 * onStatus accepts a short Polish progress message. All network calls cancellable.
 */
export async function fetchLatestSnapshot({signal,onStatus=()=>{},now=Date.now()}={}) {
  const get=createClient({signal});
  onStatus('Sprawdzanie ostatniej sesji…');
  const sessions=await get('sessions',{session_name:'Race'});
  const session=sessions.filter(s=>!s.is_cancelled&&Date.parse(s.date_start)<=now).sort((a,b)=>Date.parse(b.date_start)-Date.parse(a.date_start))[0];
  if(!session)throw new F1DataError('NO_SESSION','Brak dostępnej, rozpoczętej sesji wyścigowej w OpenF1.');
  const sessionKey=session.session_key;
  onStatus(`Pobieranie danych: ${session.circuit_short_name}…`);
  // At most three requests concurrently, request starts spaced >400ms apart.
  const raw={};
  for(const batch of [
    [['drivers','drivers'],['laps','laps'],['positions','position']],
    [['stints','stints'],['pit','pit'],['raceControl','race_control']],
    [['weather','weather'],['results','session_result']]
  ]) {
    await Promise.all(batch.map(async([key,path])=>{
      try {raw[key]=await get(path,{session_key:sessionKey});}
      catch(error) {
        // Results can be unpublished while a race is running; optional endpoint.
        if(key==='results'&&error.code==='PROVIDER_ERROR'){raw[key]=[];return;}
        throw error;
      }
    }));
  }
  const latestLapDate=Math.max(Date.parse(session.date_start),...raw.laps.map(l=>Date.parse(l.date_start)+(finite(l.lap_duration)?l.lap_duration*1000:0)).filter(finite));
  const from=new Date(latestLapDate-600000).toISOString();
  onStatus('Pobieranie aktualnych odstępów…');
  raw.intervals=await get('intervals',{session_key:sessionKey,'date>':from});
  if(!raw.drivers.length||!raw.laps.length)throw new F1DataError('NO_TIMING','Sesja nie ma jeszcze dostępnych czasów okrążeń. Archiwalne demo jest gotowe.');
  const active=now>=Date.parse(session.date_start)&&now<=Date.parse(session.date_end)&&!raw.results.length;
  const dataset=normalize(session,raw,active);
  const engine=createReplayEngine(dataset);
  const latestIntervalDate=Math.max(0,...raw.intervals.map(i=>Date.parse(i.date)).filter(finite));
  const latestPositionDate=Math.max(0,...raw.positions.map(i=>Date.parse(i.date)).filter(finite));
  const latestTimestamp=Math.max(latestLapDate,latestIntervalDate,latestPositionDate);
  const isLive=active && now-latestTimestamp<=120000 && now-latestTimestamp>=-5000;
  // Historical snapshots include all last cars crossing the finish line.
  const at=active?(latestTimestamp-Date.parse(session.date_start))/1000:engine.endTime;
  const snapshot=engine.snapshot(at);
  snapshot.mode=isLive?'live':'archive';
  // Session schedule end cannot prove a racing finish in an active data stream.
  if(active){snapshot.finished=false;if(snapshot.flag==='CHEQUERED'&&!snapshot.events.some(e=>e.flag==='CHEQUERED')){snapshot.flag='GREEN';snapshot.flagLabel='Zielona flaga';}}
  const checkedAt=new Date(now).toISOString();
  return {session:dataset.session,dataset,snapshot,engine,mode:isLive?'live':'archive',isLive,source:'OpenF1',checkedAt,lastUpdate:new Date(latestTimestamp).toISOString(),warning:isLive?null:active?'Dostępne dane nie są aktualne. Widok archiwalny; transmisja OpenF1 może wymagać płatnego dostępu.':'Ostatnia dostępna sesja zakończona. To dane archiwalne, nie transmisja na żywo.'};
}
