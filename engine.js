/**
 * PITWALL replay engine. Plain ES module, no dependencies.
 * All timing values are seconds relative to session.date_start.
 * Timing tables use observations at or before t. Track progress is an explicitly
 * estimated interpolation along a circuit, NOT measured vehicle GPS telemetry.
 */
const finite = value => typeof value === 'number' && Number.isFinite(value);
const numberOrNull = value => finite(value) ? value : null;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sorted = entries => (entries || []).filter(x => x && finite(x.t)).slice().sort((a,b) => a.t-b.t);

export function lastAt(entries, t) {
  let lo=0, hi=entries.length-1, index=-1;
  while(lo<=hi) { const mid=(lo+hi)>>1; if(entries[mid].t<=t) {index=mid;lo=mid+1;} else hi=mid-1; }
  return index<0 ? null : entries[index];
}
function indexByDriver(entries) {
  const map=new Map();
  for(const entry of sorted(entries)) {
    const key=Number(entry.driver);
    if(!map.has(key)) map.set(key,[]);
    map.get(key).push(entry);
  }
  return map;
}
export function formatLap(seconds, empty='—') {
  if(!finite(seconds) || seconds<=0) return empty;
  const millis=Math.round(seconds*1000), mins=Math.floor(millis/60000);
  return `${mins}:${String(Math.floor(millis/1000)%60).padStart(2,'0')}.${String(millis%1000).padStart(3,'0')}`;
}
export function formatGap(value, leader=false) {
  if(leader) return 'LIDER';
  if(value===null || value===undefined || value==='') return '—';
  if(finite(value)) return `+${Math.max(0,value).toFixed(3)}`;
  return String(value).replace(/LAPS?/gi,'okr.');
}
export function formatClock(seconds) {
  if(!finite(seconds)) return '—';
  const s=Math.max(0,Math.floor(seconds));
  return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
const FLAG_LABELS={GREEN:'Zielona flaga',YELLOW:'Żółta flaga',DOUBLE_YELLOW:'Podwójna żółta',RED:'Czerwona flaga',SC:'Safety Car',VSC:'Virtual Safety Car',CHEQUERED:'Koniec wyścigu',WAITING:'Przed startem'};
function flagsAt(events,t,started,finished) {
  let globalFlag=started?'GREEN':'WAITING', flagSource=null;
  const sectors=new Map();
  for(const event of events) {
    if(event.t>t) break;
    const flag=String(event.flag||'').toUpperCase().replace(/ /g,'_');
    const message=String(event.message||'').toUpperCase();
    if(/VIRTUAL SAFETY CAR DEPLOYED/.test(message)) {globalFlag='VSC';flagSource=event;}
    else if(/SAFETY CAR DEPLOYED/.test(message)) {globalFlag='SC';flagSource=event;}
    else if(/SAFETY CAR IN THIS LAP|VIRTUAL SAFETY CAR ENDING/.test(message)) flagSource=event;
    else if(/SAFETY CAR IN PIT LANE|VIRTUAL SAFETY CAR ENDED/.test(message)) {globalFlag='GREEN';flagSource=event;}
    if(String(event.scope||'').toLowerCase()==='sector' && event.sector!=null) {
      if(flag==='CLEAR'||flag==='GREEN') sectors.delete(event.sector);
      else if(flag==='YELLOW'||flag==='DOUBLE_YELLOW') sectors.set(event.sector,{flag,event});
    } else if(flag && (event.scope==='Track'||event.scope==='TRACK')) {
      if(flag==='GREEN'||flag==='CLEAR') {globalFlag='GREEN';flagSource=event;if(flag==='GREEN')sectors.clear();}
      else if(['RED','YELLOW','DOUBLE_YELLOW','CHEQUERED'].includes(flag)) {globalFlag=flag;flagSource=event;}
    }
  }
  if(!started)globalFlag='WAITING';
  if(finished)globalFlag='CHEQUERED';
  if(globalFlag==='GREEN' && sectors.size) {
    const active=[...sectors.values()];
    globalFlag=active.some(x=>x.flag==='DOUBLE_YELLOW')?'DOUBLE_YELLOW':'YELLOW';
    flagSource=active[active.length-1].event;
  }
  return {flag:globalFlag,flagLabel:FLAG_LABELS[globalFlag]||globalFlag,flagSource,yellowSectors:[...sectors.keys()]};
}
function isExplicitRetirement(event,driver) {
  if(Number(event.driver)!==driver && !new RegExp(`\\bCAR\\s+${driver}\\b`).test(String(event.message||'').toUpperCase())) return false;
  return /\bRETIRED\b|\bRETIREMENT\b|\bWILL NOT RESTART\b/.test(String(event.message||'').toUpperCase());
}

export function createReplayEngine(data) {
  if(!data || !data.session || !Array.isArray(data.drivers)) throw new Error('Nieprawidłowy zestaw danych wyścigu.');
  const session=data.session;
  const drivers=data.drivers.map(d=>({...d,number:Number(d.number)}));
  const laps=indexByDriver(data.laps), positions=indexByDriver(data.positions), intervals=indexByDriver(data.intervals), pits=indexByDriver(data.pit);
  const stints=new Map();
  for(const stint of data.stints||[]) {
    const driver=Number(stint.driver);
    if(!stints.has(driver))stints.set(driver,[]);
    stints.get(driver).push(stint);
  }
  for(const items of stints.values())items.sort((a,b)=>a.from-b.from);
  const weather=sorted(data.weather), events=sorted(data.raceControl);
  const allLaps=sorted(data.laps);
  const totalLaps=Number(session.totalLaps)||Math.max(1,...allLaps.map(l=>Number(l.lap)||0));
  const firstLaps=allLaps.filter(l=>l.lap===1).map(l=>l.t);
  const startTime=finite(session.raceStart)?session.raceStart:(firstLaps.length?Math.min(...firstLaps):0);
  const finishes=allLaps.filter(l=>finite(l.duration)&&l.duration>0).map(l=>l.t+l.duration);
  const endTime=Math.max(finite(session.raceEnd)?session.raceEnd:startTime,...finishes)+0.01;
  const flagTime=finite(session.raceEnd)?session.raceEnd:endTime;
  const initialPositions=new Map(drivers.map(d=>[d.number,lastAt(positions.get(d.number)||[],startTime)?.position??null]));
  const results=new Map((data.results||[]).map(r=>[Number(r.driver??r.number??r.driver_number),r]));

  function completedFor(driver,t) {
    const entries=laps.get(Number(driver))||[];
    const completed=[];
    for(let i=0;i<entries.length;i++) {
      const item=entries[i];
      if(item.t>t)break;
      const end=finite(item.duration)&&item.duration>0?item.t+item.duration:entries[i+1]?.t;
      if(finite(end) && end<=t+0.001)completed.push({...item,end});
    }
    return completed;
  }
  function driverLaps(driver,t=endTime,limit=12) {
    return completedFor(driver,t).filter(l=>finite(l.duration)&&l.duration>0).slice(-Math.max(1,limit)).map(l=>({lap:l.lap,time:l.duration,duration:l.duration,sectors:l.sectors||[],pitOut:!!l.pitOut,t:l.t,end:l.end}));
  }
  function timeForLap(lap) {
    const number=clamp(Math.round(Number(lap)||1),1,totalLaps);
    const entries=allLaps.filter(l=>l.lap===number);
    return entries.length?Math.min(...entries.map(l=>l.t)):startTime;
  }
  function snapshot(inputTime) {
    const t=finite(Number(inputTime))?Number(inputTime):startTime;
    const started=t>=startTime,finished=session.isActive!==true&&t>=endTime;
    const visibleEvents=events.filter(e=>e.t<=t);
    const deletedLaps=new Set();
    for(const event of visibleEvents){
      const message=String(event.message||'').toUpperCase();
      const car=message.match(/\bCAR\s+(\d+)\b/),lap=message.match(/\bLAP\s+(\d+)\b/);
      if(car&&lap){const key=`${car[1]}:${lap[1]}`;if(/REINSTATED/.test(message))deletedLaps.delete(key);else if(/DELETED/.test(message))deletedLaps.add(key);}
    }
    let fastestLap=null;
    const bestSectors=[Infinity,Infinity,Infinity];
    const rows=drivers.map(driver=>{
      const number=driver.number;
      const driverLapsAll=laps.get(number)||[];
      const current=lastAt(driverLapsAll,t);
      const complete=completedFor(number,t);
      const timed=complete.filter(l=>finite(l.duration)&&l.duration>0);
      const last=timed[timed.length-1]||null;
      const validTimed=timed.filter(l=>!deletedLaps.has(`${number}:${l.lap}`));
      const best=validTimed.reduce((a,b)=>!a||b.duration<a.duration?b:a,null);
      for(const lap of complete.filter(l=>!deletedLaps.has(`${number}:${l.lap}`)))for(let i=0;i<3;i++)if(finite(lap.sectors?.[i])&&lap.sectors[i]>0)bestSectors[i]=Math.min(bestSectors[i],lap.sectors[i]);
      if(best && (!fastestLap||best.duration<fastestLap.time)) fastestLap={driver:number,number,code:driver.code,time:best.duration,lap:best.lap,t:best.end,color:driver.color};
      const place=lastAt(positions.get(number)||[],t);
      const timing=lastAt(intervals.get(number)||[],t);
      const completedLaps=complete.length?Math.max(...complete.map(l=>l.lap)):0;
      const currentLap=started?Math.min(totalLaps,current?.lap||Math.max(1,completedLaps)):0;
      const driverStints=stints.get(number)||[];
      const stint=driverStints.filter(s=>s.from<=currentLap).at(-1)||null;
      const pitEvents=(pits.get(number)||[]).filter(p=>p.t<=t);
      const lastPit=pitEvents.at(-1);
      const pitDuration=lastPit?.laneDuration??lastPit?.duration??lastPit?.pitDuration??lastPit?.pit_duration;
      const inPit=lastPit && finite(pitDuration) && t<lastPit.t+pitDuration;
      const retirement=visibleEvents.find(e=>isExplicitRetirement(e,number));
      const result=results.get(number);
      const finishedResult=finished&&result;
      const finalRecordedLap=driverLapsAll.at(-1);
      const inferredRetirement=!!(result?.dnf && finalRecordedLap && t>=(finite(finalRecordedLap.duration)&&finalRecordedLap.duration>0?finalRecordedLap.t+finalRecordedLap.duration:finalRecordedLap.t));
      const retired=!!retirement || inferredRetirement || !!(finishedResult&&(result.dnf===true||/retired|dnf/i.test(String(result.status||'')))) || (finite(result?.retiredAt)&&t>=result.retiredAt);
      let status=!started?'not-started':result?.dns?'dns':retired?'retired':inPit?'pit':session.totalLapsKnown!==false&&completedLaps>=totalLaps?'finished':'running';
      if(finished && !retired && !result?.dns)status=result?.dsq?'disqualified':'finished';
      const latestEnd=complete.at(-1)?.end;
      if(status==='running'&&finite(latestEnd)&&t-latestEnd>Math.max(180,(last?.duration||90)*2.2)&&(!current||current.t<=latestEnd))status='inactive';
      let progress=0;
      if(current&&started) {
        // Using archived lap duration interpolates position uniformly around the
        // track; corner speed, lapped traffic, and exact GPS are NOT represented.
        const duration=finite(current.duration)&&current.duration>0?current.duration:(last?.duration||90);
        progress=clamp((t-current.t)/duration,0,0.999);
      }
      if(status==='finished')progress=0;
      const position=finished&&result?(result.position??null):(place?.position??null);
      const finalGap=finished&&result?(result.gap??null):(timing?.gap??null);
      const initial=initialPositions.get(number);
      return {...driver,position,positionChange:finite(initial)&&finite(position)?initial-position:0,
        gap:position===1?0:finalGap,interval:position===1?0:(timing?.interval??null),
        gapSeconds:position===1?0:numberOrNull(finalGap),intervalSeconds:position===1?0:numberOrNull(timing?.interval),timingUpdatedAt:timing?.t??null,
        completedLaps,currentLap,lastLap:last?.duration??null,lastLapNumber:last?.lap??null,lastLapDeleted:last?deletedLaps.has(`${number}:${last.lap}`):false,bestLap:best?.duration??null,
        sectors:last?.sectors||[null,null,null],bestSectors:[0,1,2].map(i=>{const s=complete.filter(l=>!deletedLaps.has(`${number}:${l.lap}`)).map(l=>l.sectors?.[i]).filter(v=>finite(v)&&v>0);return s.length?Math.min(...s):null;}),
        compound:stint?.compound||'UNKNOWN',tyreAge:stint?Math.max(0,(Number(stint.ageStart)||0)+currentLap-stint.from):null,
        stint:stint?.stint??null,stintStart:stint?.from??null,pitStops:pitEvents.length,status,progress,progressEstimated:true,
        retirementEstimated:inferredRetirement&&!retirement,laps:driverLaps(number,t,12)};
    }).sort((a,b)=>(a.position??999)-(b.position??999)||(a.status==='dns'?1:0)-(b.status==='dns'?1:0)||a.number-b.number);
    if(finished){
      for(let i=0;i<rows.length;i++){
        const row=rows[i],previous=rows[i-1];
        if(row.position===1){row.interval=0;row.intervalSeconds=0;continue;}
        if(row.position==null){row.interval=null;row.intervalSeconds=null;continue;}
        const result=results.get(row.number),ahead=previous&&results.get(previous.number);
        if(result&&ahead){
          if(finite(result.gap)&&finite(ahead.gap)){row.interval=Math.max(0,result.gap-ahead.gap);}
          else if(finite(result.laps)&&finite(ahead.laps)&&ahead.laps>result.laps){row.interval=`+${ahead.laps-result.laps} LAP`;}
          else row.interval=null;
          row.intervalSeconds=numberOrNull(row.interval);
        }
      }
    }
    const leader=rows.find(r=>r.position===1)||rows[0];
    const lap=started?Math.min(totalLaps,Math.max(1,leader?.currentLap||0)):0;
    const flagState=flagsAt(events,t,started,session.isActive!==true&&t>=flagTime);
    return {t,session,lap,totalLaps,totalLapsKnown:session.totalLapsKnown!==false,progress:clamp((t-startTime)/Math.max(1,endTime-startTime),0,1),
      ...flagState,weather:lastAt(weather,t),rows,events:visibleEvents.slice(-12).reverse(),fastestLap,
      bestSectors:bestSectors.map(v=>Number.isFinite(v)?v:null),started,finished,startTime,endTime,
      source:'OpenF1',mode:'replay',trackEstimated:true};
  }
  return {session,startTime,endTime,totalLaps,drivers,track:data.track||null,events,snapshot,driverLaps,timeForLap};
}
