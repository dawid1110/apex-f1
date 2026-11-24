import {createReplayEngine, formatLap, formatGap, formatClock} from './engine.js';
import {fetchLatestSnapshot} from './api.js';

// Resolve from this module so root hosting and GitHub project subpaths both work.
const APP_BASE = new URL('./', import.meta.url);
const appUrl = path => new URL(path, APP_BASE).href;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite = n => typeof n === 'number' && Number.isFinite(n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const color = c => /^#[\da-f]{6}$/i.test(c || '') ? c : '#8c9da9';
const paths = {
  flag:'<path d="M5 21V4m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  chart:'<path d="M4 4v16h16M8 14l4-5 4 3 4-7"/>',
  tyre:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m6 5 2 3m8 8 2 3M5 18l3-2m8-8 3-2M11 3l1 5m0 8 1 5M3 11l5 1m8 0 5 1"/>',
  trophy:'<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v7m-4 1h8M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4"/>',
  radio:'<circle cx="12" cy="12" r="2"/><path d="M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  settings:'<path d="m9 3-.6 2.1-2 .9-2-.5-2 3.5 1.4 1.6V13L2.5 15l2 3.5 2-.5 2 .9L9 21h4l.6-2.1 2-.9 2 .5 2-3.5-1.4-1.6V11l1.3-2-2-3.5-2 .5-2-.9L13 3Z" transform="translate(1 0)"/><circle cx="12" cy="12" r="3"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m0 3h.01"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  collapse:'<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  rain:'<path d="M5 16a5 5 0 0 1-1-10 6 6 0 0 1 11-1 5 5 0 1 1 3 11M7 19l-1 3m7-3-1 3m7-3-1 3"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',
  pause:'<path d="M7 5h3v14H7zm7 0h3v14h-3z"/>',
  replay:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  rewind:'<path d="m11 5-8 7 8 7V5Zm10 0-8 7 8 7V5Z"/>',
  forward:'<path d="m3 5 8 7-8 7V5Zm10 0 8 7-8 7V5Z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8L21 9h-8l0-7Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0m-4 4h.01"/>',
  offline:'<path d="m3 3 18 18M2 8a16 16 0 0 1 3-2m4-2a16 16 0 0 1 13 4M5 12a11 11 0 0 1 4-2m5 0a11 11 0 0 1 5 2M8 16a6 6 0 0 1 8 0m-4 4h.01"/>',
  helmet:'<path d="M21 12a9 9 0 1 0-9 9h6l3-5v-4ZM12 9h9m-9 0v5h8M4 17h7"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  car:'<path d="M5 16H3V9l3-5h12l3 5v7h-2M5 16h14M5 16v4m14-4v4M3 9h18M6 12h2m8 0h2"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
const apexMark = '<svg class="apex-mark" viewBox="0 0 40 36" fill="none" aria-hidden="true"><path d="M2 31 20 3l6 9-12 19H2Zm18 0 9-14 9 14H20Z" fill="currentColor"/></svg>';
const tyreClass = compound => ({SOFT:'soft',MEDIUM:'medium',HARD:'hard',INTERMEDIATE:'intermediate',WET:'wet'}[compound] || 'unknown');
const tyreLabel = compound => ({SOFT:'Miękka',MEDIUM:'Pośrednia',HARD:'Twarda',INTERMEDIATE:'Przejściowa',WET:'Deszczowa'}[compound] || 'Brak danych');
const tyre = (compound, age) => `<span class="tyre ${tyreClass(compound)}" title="${tyreLabel(compound)}">${esc(compound && compound !== 'UNKNOWN' ? compound[0] : '?')}</span>${finite(age) ? `<span class="tyre-age" title="Wiek opony w okrążeniach">${age}</span>` : ''}`;
const storageKey = 'apex-preferences-v1:' + APP_BASE.pathname;
let preferences = {};
try { preferences = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}
const state = {page:'race',mode:'replay',playing:true,speed:4,t:0,selected:4,compareA:4,compareB:81,gapMode:'interval',favorites:[4],compact:false,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,haptics:true,seasonView:'after',...preferences};
state.page='race';state.mode='replay';state.playing=true;state.speed=4;
let data, engine, snap, replayEngine, replayData, latestInfo=null, apiController=null, refreshTimer=null;
let retryCount=0;
let renderAt=0, lastFrame=0, lastTableSignature='', lastFocusSignature='', lastEventSignature='', toastTimer, tourStep=0, tourWasPlaying=false, activeModal=null, beforeModalFocus=null, installEvent=null, wakeLock=null, loopStarted=false;
let trackPath='', mapNodes=new Map(), rafId;

function persist() {
  try {localStorage.setItem(storageKey, JSON.stringify({selected:state.selected,compareA:state.compareA,compareB:state.compareB,gapMode:state.gapMode,favorites:state.favorites,compact:state.compact,reducedMotion:state.reducedMotion,haptics:state.haptics}));} catch {}
}
function toast(message) {
  const box=$('#toast');box.textContent=message;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),3500);
}
function haptic() {if(state.haptics&&navigator.vibrate)navigator.vibrate(8);}
function formatDate(date, options={day:'numeric',month:'long',year:'numeric'}) {return new Intl.DateTimeFormat('pl-PL',{...options,timeZone:'Europe/Warsaw'}).format(new Date(date));}
function displayName(row) {return esc(row?.lastName || row?.code || 'Kierowca');}
function modeLabel() {return state.mode==='replay'?'ODTWARZANIE':latestInfo?.isLive?'NA ŻYWO':'ARCHIWUM';}
function selectedRow() {return snap.rows.find(d=>d.number===state.selected)||snap.rows[0];}

function renderShell() {
  const nav=[['race','flag','Centrum wyścigu'],['analysis','chart','Porównanie tempa'],['strategy','tyre','Strategia opon'],['standings','trophy','Klasyfikacja sezonu']];
  $('#app').innerHTML=`
    <aside class="rail" aria-label="Nawigacja główna">
      <button class="rail-brand" data-action="page" data-page="race" aria-label="APEX — centrum wyścigu">${apexMark}</button>
      <nav class="rail-nav">${nav.map(([id,ico,label])=>`<button class="rail-link ${state.page===id?'active':''}" data-action="page" data-page="${id}" aria-label="${label}" ${state.page===id?'aria-current="page"':''}>${icon(ico)}<span class="tooltip">${label}</span></button>`).join('')}</nav>
      <div class="rail-spacer"></div>
      <div class="rail-footer"><button class="rail-link" data-action="source" aria-label="Źródło danych">${icon('radio')}<span class="tooltip">Źródło danych</span></button><button class="rail-link" data-action="tour" aria-label="Uruchom interaktywne demo">${icon('help')}<span class="tooltip">Odkryj APEX</span></button><button class="rail-link" data-action="settings" aria-label="Ustawienia">${icon('settings')}<span class="tooltip">Ustawienia</span></button><div class="avatar" title="Twój pit wall">AP</div></div>
    </aside>
    <main class="workspace">
      <header class="topbar"><div class="product-wordmark"><div class="wordmark">APEX</div><span class="wordmark-divider"></span><span class="product-label">YOUR PERSONAL PIT WALL</span></div><div class="top-actions"><span class="connection-offline">Offline</span><button class="source-pill" id="source-badge" data-action="source">${icon('replay')}<span>${modeLabel()}</span></button><button class="button ghost" data-action="source">${icon('layers')}<span class="source-button-text">Dane sesji</span></button><button class="icon-button fullscreen-button" data-action="fullscreen" aria-label="Przełącz pełny ekran">${icon('expand')}</button></div></header>
      <section class="race-heading" aria-label="Informacje o wyścigu"><div><div class="eyebrow"><span class="italy-flag" id="country-flag"><i></i><i></i><i></i></span><span id="race-eyebrow">FORMULA 1 · RUNDA 16 / 2025</span></div><h1 id="race-title">Grand Prix Włoch</h1><p class="race-subtitle"><span id="race-circuit">Autodromo Nazionale Monza</span><span class="divider">/</span><span id="race-date">7 września 2025</span></p></div><div class="race-summary"><div class="lap-meter"><div class="label">Okrążenie</div><div class="lap-number" id="lap-number">36 <span>/ 53</span></div><div class="lap-meter-track"><i id="lap-progress"></i></div></div><div class="weather-summary"><div class="weather-icon" id="weather-icon">${icon('sun')}</div><div class="weather-stats"><span>Powietrze</span><strong id="air-temp">—</strong><span>Tor</span><strong id="track-temp">—</strong></div></div></div></section>
      <div class="page-tabs"><div class="tab-list" role="tablist" aria-label="Widok danych wyścigu">${[['race','flag','Wyścig'],['analysis','chart','Tempo'],['strategy','tyre','Strategia'],['standings','trophy','Sezon']].map(([id,ico,label])=>`<button role="tab" aria-selected="${state.page===id}" class="tab ${state.page===id?'active':''}" data-action="page" data-page="${id}">${icon(ico)}${label}</button>`).join('')}</div><div class="race-status" id="race-status"><i class="status-light"></i><span class="status-prefix">Tor</span><strong>Zielona flaga</strong></div></div>
      <div id="live-notice"></div><section id="page-content"></section><footer class="source-footnote"><span>Dane: <a href="https://openf1.org/" target="_blank" rel="noopener noreferrer">OpenF1</a> · Projekt niezależny, niezwiązany z Formula 1.</span><span>Stworzone dla wyścigu. Zaprojektowane na tablet.</span></footer>
    </main>
    <section class="playback" aria-label="Sterowanie odtwarzaniem" id="playback"></section>`;
  renderPage(); renderPlayback(); renderTop(); applyPreferences();
}
function renderTop() {
  $('#lap-number').innerHTML=`${snap.lap || '—'} <span>/ ${snap.totalLapsKnown===false?'—':snap.totalLaps}</span>`;
  $('#lap-progress').style.width=`${snap.totalLapsKnown!==false&&snap.totalLaps?snap.lap/snap.totalLaps*100:0}%`;
  $('#air-temp').textContent=finite(snap.weather?.air)?`${snap.weather.air.toFixed(1)}°`:'—';
  $('#track-temp').textContent=finite(snap.weather?.track)?`${snap.weather.track.toFixed(1)}°`:'—';
  $('#weather-icon').innerHTML=icon(snap.weather?.rain?'rain':'sun');
  const status=$('#race-status');status.className=`race-status ${/YELLOW|SC/.test(snap.flag)?'yellow':snap.flag==='RED'?'red':''}`;
  status.innerHTML=`<i class="status-light"></i><span class="status-prefix">Tor</span><strong>${esc(snap.flagLabel)}</strong>`;
  const badge=$('#source-badge');badge.classList.toggle('live',!!latestInfo?.isLive&&state.mode!=='replay');badge.innerHTML=`${icon(state.mode==='replay'?'replay':latestInfo?.isLive?'radio':'clock')}<span>${modeLabel()}</span>`;
  if(state.mode!=='replay') {
    $('#race-title').textContent=`Grand Prix ${data.session.circuit_short_name || data.session.country_name}`;
    $('#race-circuit').textContent=data.session.circuit_short_name||'Sesja wyścigowa';
    $('#race-date').textContent=formatDate(data.session.date_start);
    $('#race-eyebrow').textContent=`FORMULA 1 · ${data.session.year} · ${latestInfo?.isLive?'AKTUALNA SESJA':'OSTATNIA DOSTĘPNA SESJA'}`;
    $('#country-flag').classList.toggle('hidden',data.session.country_code!=='ITA');
  } else {
    $('#race-title').textContent='Grand Prix Włoch';$('#race-circuit').textContent='Autodromo Nazionale Monza';$('#race-date').textContent='7 września 2025';$('#race-eyebrow').textContent='FORMULA 1 · RUNDA 16 / 2025';$('#country-flag').classList.remove('hidden');
  }
}
function renderPage() {
  lastTableSignature='';lastFocusSignature='';lastEventSignature='';mapNodes.clear();
  $$('.rail-link[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===state.page);if(el.dataset.page===state.page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $$('.tab[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===state.page);el.setAttribute('aria-selected',String(el.dataset.page===state.page));});
  if(state.page==='race') renderRace();
  else if(state.page==='analysis')renderAnalysis();
  else if(state.page==='strategy')renderStrategy();
  else if(state.page==='standings')renderStandings();
  renderNotice();
}
function renderNotice() {
  $('#live-notice').innerHTML=state.mode==='replay'?'':`<div class="live-notice"><span>${latestInfo?.isLive?'<strong>Połączono z sesją.</strong> Dane odświeżane co 60 s.':`<strong>Dane archiwalne.</strong> ${esc(latestInfo?.warning||'Ostatnia dostępna zakończona sesja.')}`}<br><span class="secondary">Dane z: ${latestInfo?esc(formatDate(latestInfo.lastUpdate,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})):''}</span></span><button class="button small" data-action="demo">Wróć do demo</button></div>`;
}
function renderRace() {
  $('#page-content').innerHTML=`<div class="dashboard"><section class="panel timing-panel" aria-label="Klasyfikacja kierowców"><div class="panel-heading"><h2 class="panel-title">Klasyfikacja</h2><div class="table-mode" aria-label="Rodzaj odstępu"><button data-action="gap-mode" data-mode="interval" class="${state.gapMode==='interval'?'active':''}" aria-pressed="${state.gapMode==='interval'}">Interwał</button><button data-action="gap-mode" data-mode="gap" class="${state.gapMode==='gap'?'active':''}" aria-pressed="${state.gapMode==='gap'}">Do lidera</button></div></div><div class="timing-scroll"><table class="timing-table"><thead><tr><th scope="col">Poz.</th><th scope="col">Kierowca</th><th scope="col" id="gap-heading">${state.gapMode==='interval'?'Odstęp':'Do lidera'}</th><th scope="col">Opona</th></tr></thead><tbody id="timing-body"></tbody></table></div><div class="timing-footer"><span>${icon('info')}Dotknij kierowcy, aby go śledzić</span><span class="driver-count">${snap.rows.length} kierowców</span></div></section><div class="race-right"><section class="panel track-panel" id="track-panel" aria-label="Mapa toru"><div class="panel-heading"><h2 class="panel-title">Na torze</h2><div class="panel-heading-right"><span class="track-meta">${icon('pin')}<span>${esc(data.session.circuit_short_name || 'Monza')}</span><span class="length-label">· ${state.mode==='replay'?'5,793 km':'mapa'}</span></span><button class="icon-button" data-action="expand-map" aria-label="Powiększ mapę toru">${icon('expand')}</button></div></div><div class="track-stage" id="track-stage"></div><div class="map-legend"><span><i></i>Śledzony kierowca</span><span class="approx">Pozycje przybliżone z czasów okrążeń</span></div></section><div class="lower-cards"><section class="panel focus-panel" id="focus-panel" aria-label="Wybrany kierowca"></section><section class="panel events-panel" aria-label="Komunikaty dyrekcji wyścigu"><div class="panel-heading"><h2 class="panel-title">Race Control</h2><span class="panel-kicker">FIA</span></div><div class="events-list" id="events-list"></div><div class="events-footer"><span>Oś czasu wyścigu</span><button data-action="events">Wszystkie</button></div></section></div></div></div>`;
  renderTiming(); renderFocus(); renderEvents(); buildTrack(); updateTrack();
}
function rowStatus(row) {return ({retired:'DNF',dns:'DNS',disqualified:'DSQ',inactive:'BRAK',pit:'PIT'}[row.status]||'');}
function renderTiming() {
  const body=$('#timing-body');if(!body)return;
  const signature=JSON.stringify(snap.rows.map(r=>[r.number,r.position,r.status,r.gap,r.interval,r.compound,r.tyreAge,state.selected,state.gapMode,state.favorites.includes(r.number)]));
  if(signature===lastTableSignature)return;lastTableSignature=signature;
  const activeNumber=document.activeElement?.dataset?.driver;
  body.innerHTML=snap.rows.map((r,index)=>{
    const status=rowStatus(r),isOut=['retired','dns','disqualified'].includes(r.status),leader=r.position===1&&!isOut;
    const value=state.gapMode==='interval'?r.interval:r.gap;
    return `<tr tabindex="0" role="row" data-action="driver" data-driver="${r.number}" class="${state.selected===r.number?'selected':''}" aria-label="${esc(r.firstName)} ${esc(r.lastName)}, ${isOut?status:'pozycja '+(r.position||index+1)}. ${leader?'Lider':state.gapMode==='interval'?'Odstęp do poprzedzającego '+formatGap(value):'Strata do lidera '+formatGap(value)}"><td class="rank">${isOut?'—':String(r.position||index+1).padStart(2,'0')}</td><td class="driver-cell"><div class="driver-cell-inner"><span class="team-line" style="background:${color(r.color)}"></span><div><div class="driver-name">${displayName(r)}${state.favorites.includes(r.number)?'<span class="fav-dot">✦</span>':''}</div><div class="driver-team">${esc(r.team)}</div></div></div></td><td class="gap-cell ${leader?'leader':''} ${!leader&&!status&&finite(value)&&value<1?'close-gap':''}" title="${state.gapMode==='interval'?'Różnica do kierowcy bezpośrednio przed nim':'Strata do prowadzącego wyścig'}">${status||formatGap(value,leader)}</td><td class="tyre-cell">${isOut?'<span class="secondary">—</span>':tyre(r.compound,r.tyreAge)}</td></tr>`;
  }).join('');
  if(activeNumber)body.querySelector(`[data-driver="${activeNumber}"]`)?.focus({preventScroll:true});
}
function renderFocus() {
  const panel=$('#focus-panel');if(!panel)return;const r=selectedRow();if(!r)return;
  const signature=JSON.stringify([r.number,r.position,r.lastLap,r.bestLap,r.compound,r.tyreAge,r.sectors,r.status,r.lastLapDeleted,snap.bestSectors,state.favorites.includes(r.number)]);if(signature===lastFocusSignature)return;lastFocusSignature=signature;
  const favorite=state.favorites.includes(r.number);
  panel.style.setProperty('--team-color',color(r.color));
  panel.innerHTML=`<div class="panel-heading"><h2 class="panel-title">Twój kierowca</h2><button class="icon-button ${favorite?'selected':''}" data-action="favorite" aria-label="${favorite?'Usuń z ulubionych':'Dodaj do ulubionych'}" aria-pressed="${favorite}">${icon('star')}</button></div><div class="focus-driver"><div class="focus-number">${r.number}</div><div><div class="focus-first">${esc(r.firstName)}</div><div class="focus-name">${displayName(r)}</div><div class="focus-team"><i></i>${esc(r.team)}</div></div><div class="focus-rank">${['retired','dns'].includes(r.status)?rowStatus(r):'P'+(r.position||'—')}</div></div><div class="focus-metrics"><div><div class="metric-label">Ostatnie okrążenie</div><div class="metric-value">${formatLap(r.lastLap)}</div></div><div><div class="metric-label">Najlepsze okrążenie</div><div class="metric-value best">${formatLap(r.bestLap)}</div></div></div><div class="sector-bars">${r.sectors.map((s,i)=>`<div class="sector-bar"><div class="sector-fill ${!r.lastLapDeleted&&finite(s)&&s<=snap.bestSectors[i]+.001?'fastest':!r.lastLapDeleted&&finite(s)&&s<=r.bestSectors[i]+.001?'pb':''}"></div><div class="sector-caption"><span>S${i+1}</span><strong>${finite(s)?s.toFixed(3):'—'}</strong></div></div>`).join('')}</div><div class="focus-bottom"><span>${tyre(r.compound)} <span style="margin-left:4px">${finite(r.tyreAge)?r.tyreAge+' okr.':'—'}</span></span><button data-action="compare-selected">${icon('chart')}Porównaj tempo</button></div>`;
}
function translateEvent(event) {
  const msg=String(event.message||'');let m;
  if(msg==='DRS ENABLED')return 'DRS aktywowany';
  if(msg==='DRS DISABLED')return 'DRS wyłączony';
  if(msg==='CHEQUERED FLAG')return 'Flaga w szachownicę. Koniec wyścigu.';
  if(msg==='GREEN LIGHT - PIT EXIT OPEN')return 'Zielone światło. Wyjazd z alei serwisowej otwarty.';
  if(msg==='PIT EXIT CLOSED')return 'Wyjazd z alei serwisowej zamknięty.';
  if((m=msg.match(/^YELLOW IN TRACK SECTOR (\d+)/)))return `Żółta flaga w sektorze porządkowym ${m[1]}.`;
  if((m=msg.match(/^CLEAR IN TRACK SECTOR (\d+)/)))return `Tor czysty w sektorze porządkowym ${m[1]}.`;
  if(msg.includes('SAFETY CAR DEPLOYED'))return msg.includes('VIRTUAL')?'Wirtualny samochód bezpieczeństwa.':'Samochód bezpieczeństwa na torze.';
  if(msg==='GREEN LIGHT')return 'Zielone światło. Wyścig rozpoczęty.';
  if((m=msg.match(/^CAR (\d+) \((\w+)\).*TIME.*DELETED.*LAP (\d+)/)))return `${m[2]} · Usunięty czas okrążenia ${m[3]}. ${msg.includes('TRACK LIMITS')?'Przekroczenie limitów toru.':''}`;
  if((m=msg.match(/^BLACK AND WHITE FLAG FOR CAR (\d+) \((\w+)\)/)))return `${m[2]} · Czarno-biała flaga. Ostrzeżenie za limity toru.`;
  return msg.charAt(0)+msg.slice(1).toLowerCase();
}
function eventMarkup(event) {
  const type=event.flag==='YELLOW'||event.flag==='DOUBLE_YELLOW'?'yellow':event.flag==='RED'?'red':'';
  return `<div class="event-item ${type}" title="${esc(event.message)}"><div class="event-time">${finite(event.lap)?'OKR. '+event.lap+' · ':''}${formatClock(event.t-engine.startTime)}</div><p class="event-text">${esc(translateEvent(event))}</p></div>`;
}
function renderEvents() {
  const box=$('#events-list');if(!box)return;const relevant=snap.events.filter(e=>e.t>=engine.startTime-30).slice(0,5);const signature=JSON.stringify(relevant);if(signature===lastEventSignature)return;lastEventSignature=signature;
  box.innerHTML=relevant.length?relevant.map(eventMarkup).join(''):'<div class="empty-state">Czekamy na komunikaty dyrekcji wyścigu.</div>';
}
function buildTrack() {
  const el=$('#track-stage');if(!el)return;
  if(!data.track?.points?.length) {
    el.innerHTML=`<div class="live-map-message">${icon('pin')}<h3>Aktualna tabela czasów</h3><p>Dla tej sesji dostępne są czasy i klasyfikacja. Animowaną mapę Monzy zobaczysz w pełnym demo wyścigu.</p><button class="button small" data-action="demo">Otwórz demo Monzy</button></div>`;
    $('#track-panel .map-legend').classList.add('hidden');return;
  }
  const points=data.track.points;trackPath='M'+points.map(p=>p.map(v=>Number(v).toFixed(1)).join(',')).join('L')+'Z';
  // Points are measured from one archived lap; uniform screen scale preserves circuit geometry.
  el.innerHTML=`<svg class="track-svg" id="track-svg" viewBox="0 85 1000 430" role="img" aria-label="Monza, przybliżone pozycje kierowców na podstawie czasów okrążeń"><defs><filter id="map-soft-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter></defs><text class="track-center-title" x="490" y="315" text-anchor="middle">MONZA</text><text class="track-center-sub" x="490" y="341" text-anchor="middle">THE TEMPLE OF SPEED</text><path d="${trackPath}" fill="none" stroke="#a0d36d" stroke-width="15" opacity=".055" filter="url(#map-soft-glow)"/><path d="${trackPath}" class="track-outline"/><path d="${trackPath}" class="track-inner"/><path d="${trackPath}" class="track-glow" stroke-dasharray="100 5000" stroke-dashoffset="-40"/><g id="start-marker"></g><g id="map-drivers"></g></svg>`;
  const start=points[0];$('#start-marker').innerHTML=`<path d="M${start[0]-7} ${start[1]-12}v24m5-24v24m5-24v24" stroke="#dbe8d3" stroke-width="2"/><text x="${start[0]+15}" y="${start[1]-15}" class="track-corner-label">START / META</text>`;
  const container=$('#map-drivers');
  const ordered=snap.rows.slice().sort((a,b)=>a.number===state.selected?1:b.number===state.selected?-1:(b.position||99)-(a.position||99));
  container.innerHTML=ordered.map(r=>`<g class="map-driver ${r.number===state.selected?'selected':''}" data-action="driver" data-driver="${r.number}" role="button" tabindex="0" aria-label="Śledź ${esc(r.firstName)} ${esc(r.lastName)}"><circle class="halo" r="16"/><circle class="core" r="8" fill="${color(r.color)}"/><rect class="driver-label-bg" x="-19" y="-35" width="38" height="19" rx="4"/><text text-anchor="middle" y="-22">${esc(r.code)}</text></g>`).join('');
  for(const node of $$('.map-driver',container))mapNodes.set(Number(node.dataset.driver),node);
}
function pointAt(progress) {
  const points=data.track.points, fractions=data.track.timeFractions;
  if(fractions?.length===points.length) {
    let lo=0,hi=fractions.length-1;while(lo<hi){const mid=Math.floor((lo+hi+1)/2);if(fractions[mid]<=progress)lo=mid;else hi=mid-1;}
    const next=Math.min(lo+1,points.length-1),ratio=clamp((progress-fractions[lo])/Math.max(.0001,fractions[next]-fractions[lo]),0,1);
    return [points[lo][0]+(points[next][0]-points[lo][0])*ratio,points[lo][1]+(points[next][1]-points[lo][1])*ratio];
  }
  const index=progress*(points.length-1),a=Math.floor(index),b=Math.min(a+1,points.length-1),f=index-a;return [points[a][0]+(points[b][0]-points[a][0])*f,points[a][1]+(points[b][1]-points[a][1])*f];
}
function updateTrack() {
  if(!data.track?.points||!mapNodes.size)return;
  for(const row of snap.rows) {
    const node=mapNodes.get(row.number);if(!node)continue;
    const hidden=['retired','dns','disqualified','inactive'].includes(row.status);node.style.display=hidden?'none':'';if(hidden)continue;
    const p=pointAt(row.progress);node.setAttribute('transform',`translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);node.classList.toggle('selected',row.number===state.selected);
    const text=node.querySelector('text');text.style.opacity=row.number===state.selected||row.position<=5?'1':'.55';
  }
  const selected=mapNodes.get(state.selected);if(selected)selected.parentNode.appendChild(selected);
}
function renderPlayback() {
  const el=$('#playback');
  if(state.mode!=='replay') {el.innerHTML=`<div class="live-footer"><span>${icon('radio')} <strong>${latestInfo?.isLive?'Połączenie z sesją':'Archiwum OpenF1'}</strong> · ${esc(data.session.circuit_short_name)} ${data.session.year}</span><div class="top-actions"><button class="button small" data-action="refresh-latest">${icon('replay')}Odśwież</button><button class="button small primary" data-action="demo">Pełne demo</button></div></div>`;return;}
  el.innerHTML=`<div class="playback-buttons"><button class="replay-reset" data-action="restart" aria-label="Odtwórz od startu" title="Od startu">${icon('replay')}</button><button class="play-pause" id="play-pause" data-action="play" aria-label="${state.playing?'Wstrzymaj':'Odtwarzaj'}">${icon(state.playing?'pause':'play')}</button><button class="replay-reset skip" data-action="skip" data-seconds="30" aria-label="Przewiń o 30 sekund" title="30 sekund do przodu">${icon('forward')}</button><button class="speed-button" id="speed-button" data-action="speed" aria-label="Zmień prędkość odtwarzania">${state.speed}×</button></div><div class="playback-timeline"><div class="timeline-top"><strong>${icon('replay')}<span>POWTÓRKA WYŚCIGU</span></strong><span class="mono" id="playback-time"></span></div><div class="range-wrap"><input class="timeline-range" id="timeline" type="range" min="${engine.startTime}" max="${engine.endTime}" value="${state.t}" step="0.001" aria-label="Moment wyścigu" aria-valuetext="Okrążenie ${snap.lap} z ${snap.totalLaps}"></div><div class="timeline-markers"><span>START</span><span>OKR. 15</span><span>OKR. 30</span><span>OKR. 45</span><span>META</span></div></div><div class="playback-end"><div class="demo-label">PRAWDZIWE DANE<strong>Monza 2025</strong></div><button class="tour-button" data-action="tour">${icon('play')}<span>Poznaj APEX</span></button></div>`;
  updatePlayback();
}
function updatePlayback() {
  if(state.mode!=='replay')return;const range=$('#timeline');if(!range)return;
  if(document.activeElement!==range||!state.seeking)range.value=state.t;
  range.style.setProperty('--value',`${snap.progress*100}%`);range.setAttribute('aria-valuetext',`Okrążenie ${snap.lap} z ${snap.totalLaps}, ${formatClock(state.t-engine.startTime)}`);
  $('#playback-time').textContent=`${formatClock(state.t-engine.startTime)} / ${formatClock(engine.endTime-engine.startTime)}`;
  const play=$('#play-pause');play.innerHTML=icon(state.playing?'pause':'play');play.setAttribute('aria-label',state.playing?'Wstrzymaj':'Odtwarzaj');$('#speed-button').textContent=`${state.speed}×`;
}
function driverOptions(selected) {return snap.rows.filter(r=>r.status!=='dns').map(r=>`<option value="${r.number}" ${r.number===selected?'selected':''}>${esc(r.firstName)} ${esc(r.lastName)}</option>`).join('');}
function renderAnalysis() {
  const eligible=snap.rows.filter(r=>r.status!=='dns');
  if(!eligible.some(r=>r.number===state.compareA))state.compareA=eligible[0]?.number;
  if(!eligible.some(r=>r.number===state.compareB)||state.compareB===state.compareA)state.compareB=eligible.find(r=>r.number!==state.compareA)?.number;
  $('#page-content').innerHTML=`<div class="section-heading"><div><h2>Tempo pod lupą</h2><p>Dwa samochody. Te same okrążenia. Wszystko w jednym miejscu.</p></div><div class="compare-selectors"><div class="select-wrap"><select id="compare-a" aria-label="Pierwszy kierowca do porównania">${driverOptions(state.compareA)}</select></div><span class="versus">VS</span><div class="select-wrap"><select id="compare-b" aria-label="Drugi kierowca do porównania">${driverOptions(state.compareB)}</select></div></div></div><div class="analysis-grid" id="analysis-grid"></div>`;
  updateAnalysis();
}
function compareCard(r) {
  return `<section class="panel compare-card" style="--team-color:${color(r.color)}"><div class="compare-card-head"><div><h3 class="compare-driver-name">${esc(r.firstName)} ${displayName(r)}</h3><p class="compare-driver-team">${esc(r.team)} · ${r.status==='retired'?'DNF':'P'+(r.position||'—')}</p></div><span class="compare-number">${r.number}</span></div><div class="compare-metrics"><div><div class="metric-label">Ostatnie okrążenie</div><div class="metric-value">${formatLap(r.lastLap)}</div></div><div><div class="metric-label">Najlepsze okrążenie</div><div class="metric-value" style="color:var(--purple)">${formatLap(r.bestLap)}</div></div><div><div class="metric-label">Opona / wiek</div><div class="metric-value">${tyre(r.compound,r.tyreAge)}</div></div></div></section>`;
}
function updateAnalysis() {
  const el=$('#analysis-grid');if(!el)return;const a=snap.rows.find(r=>r.number===state.compareA),b=snap.rows.find(r=>r.number===state.compareB);if(!a||!b)return;
  const al=engine.driverLaps(a.number,state.t,53),bl=engine.driverLaps(b.number,state.t,53);
  const common=al.filter(l=>bl.some(m=>m.lap===l.lap)).slice(-12).map(l=>({lap:l.lap,a:l,b:bl.find(m=>m.lap===l.lap)}));
  const clean=common.filter(l=>!l.a.pitOut&&!l.b.pitOut&&l.a.time<Math.min(a.bestLap||Infinity,b.bestLap||Infinity)*1.15&&l.b.time<Math.min(a.bestLap||Infinity,b.bestLap||Infinity)*1.15);
  const last5=clean.slice(-5),meanA=last5.length?last5.reduce((s,l)=>s+l.a.time,0)/last5.length:null,meanB=last5.length?last5.reduce((s,l)=>s+l.b.time,0)/last5.length:null;
  const diff=finite(meanA)&&finite(meanB)?Math.abs(meanA-meanB):null,winner=meanA<meanB?a:b;
  el.innerHTML=`${compareCard(a)}${compareCard(b)}<section class="panel chart-panel"><div class="chart-panel-top"><div><h3 class="panel-title">Historia czasów okrążeń</h3><p>Ostatnie wspólne, ukończone okrążenia · niżej oznacza szybciej</p></div><div class="chart-legend"><span><i style="background:${color(a.color)}"></i>${esc(a.code)}</span><span><i style="background:${a.color===b.color?'#eff0e2':color(b.color)}"></i>${esc(b.code)}</span></div></div>${common.length>=2?lapChart(common,a,b):'<div class="chart-empty">Potrzebujemy co najmniej dwóch wspólnych, ukończonych okrążeń.<br>Przesuń suwak wyścigu do przodu.</div>'}</section><div class="comparison-insight">${icon('bolt')}<span>${finite(diff)?`<strong>${esc(winner.firstName)} ${esc(winner.lastName)}</strong> ma średnio <strong>${diff.toFixed(3)} s</strong> przewagi na ${last5.length} ostatnich wspólnych okrążeniach bez wyjazdów z boksu i czasów przekraczających 115% najlepszego okrążenia tej pary. To porównanie zarejestrowanego tempa, bez prognozy wyniku.`:'Przewiń wyścig, aby porównać rzeczywiste tempo. Wykres pokazuje wyłącznie okrążenia ukończone do wybranego momentu.'}</span></div>`;
}
function lapChart(laps,a,b) {
  const w=920,h=260,pad={l:65,r:25,t:10,b:33},times=laps.flatMap(l=>[l.a.time,l.b.time]),min=Math.floor(Math.min(...times))-1,max=Math.ceil(Math.max(...times))+1;
  const x=i=>pad.l+i*(w-pad.l-pad.r)/Math.max(1,laps.length-1),y=t=>pad.t+(max-t)/(max-min)*(h-pad.t-pad.b);
  const lines=[0,.25,.5,.75,1].map(f=>{const val=min+f*(max-min);return `<line class="chart-grid" x1="${pad.l}" x2="${w-pad.r}" y1="${y(val)}" y2="${y(val)}"/><text class="chart-axis" x="${pad.l-12}" y="${y(val)+4}" text-anchor="end">${val.toFixed(1)} s</text>`;}).join('');
  const ca=color(a.color),cb=a.color===b.color?'#eff0e2':color(b.color);
  return `<svg class="lap-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Porównanie czasów ${esc(a.lastName)} i ${esc(b.lastName)} od okrążenia ${laps[0].lap} do ${laps.at(-1).lap}">${lines}${laps.map((l,i)=>`<text class="chart-axis" x="${x(i)}" y="${h-5}" text-anchor="middle">${l.lap}</text>`).join('')}${[['a',ca],['b',cb]].map(([key,c])=>`<polyline class="chart-line" stroke="${c}" ${key==='b'?'stroke-dasharray="6 4"':''} points="${laps.map((l,i)=>`${x(i)},${y(l[key].time)}`).join(' ')}"/>${laps.map((l,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(l[key].time)}" r="4.5" fill="${c}"><title>${key==='a'?esc(a.code):esc(b.code)} · Okr. ${l.lap} · ${formatLap(l[key].time)}</title></circle>`).join('')}`).join('')}</svg>`;
}
function renderStrategy() {
  $('#page-content').innerHTML=`<div class="section-heading"><div><h2>Wyścig rozgrywa się także w boksach</h2><p>Rzeczywiste stinty, mieszanki i postoje do wybranego momentu.</p></div></div><div id="strategy-content"></div>`;updateStrategy();
}
function updateStrategy() {
  const el=$('#strategy-content');if(!el)return;
  const pits=(data.pit||[]).filter(p=>p.t<=state.t),timed=pits.filter(p=>finite(p.duration)&&p.duration>0&&finite(p.laneDuration)&&p.t+p.laneDuration<=state.t),quickest=timed.reduce((a,b)=>!a||b.duration<a.duration?b:a,null),driver=quickest&&snap.rows.find(r=>r.number===quickest.driver);
  const active=snap.rows.filter(r=>!['retired','dns','disqualified'].includes(r.status)),compounds={};active.forEach(r=>compounds[r.compound]=(compounds[r.compound]||0)+1);const main=Object.entries(compounds).sort((a,b)=>b[1]-a[1])[0];
  el.innerHTML=`<div class="strategy-top"><div class="panel stat-card"><div><div class="label">Pit stopy</div><div class="stat-value">${pits.length}</div><div class="stat-note">Zarejestrowane w tej sesji</div></div><div class="stat-icon">${icon('tyre')}</div></div><div class="panel stat-card"><div><div class="label">Najszybszy postój</div><div class="stat-value">${quickest?quickest.duration.toFixed(1)+' s':'—'}</div><div class="stat-note">${driver?`${esc(driver.code)} · okrążenie ${quickest.lap}`:'Brak zakończonych postojów'}</div></div><div class="stat-icon">${icon('bolt')}</div></div><div class="panel stat-card"><div><div class="label">Dominująca mieszanka</div><div class="stat-value">${main?tyreLabel(main[0]):'—'}</div><div class="stat-note">${main?main[1]+' kierowców na torze':'Przed startem'}</div></div><div class="stat-icon">${icon('layers')}</div></div></div><section class="panel strategy-table-panel"><div class="panel-heading"><h3 class="panel-title">Historia opon</h3><div class="strategy-legend"><span>${tyre('SOFT')}Miękka</span><span>${tyre('MEDIUM')}Pośrednia</span><span>${tyre('HARD')}Twarda</span></div></div><div class="strategy-table-wrap"><div class="strategy-row strategy-row-head"><span>KIEROWCA</span><span>OKRĄŻENIA 1–${snap.totalLaps}</span><span>PIT</span></div>${snap.rows.map(r=>{
    const stints=(data.stints||[]).filter(s=>s.driver===r.number&&s.from<=r.currentLap&&r.status!=='dns').sort((a,b)=>a.from-b.from);
    return `<div class="strategy-row"><div class="strategy-driver"><span class="strategy-rank">${r.position||'—'}</span><span class="team-line" style="height:18px;background:${color(r.color)}"></span><strong>${esc(r.code)}</strong></div><div class="stint-bars"><div class="stint-bg"></div>${stints.map(s=>{const end=Math.min(s.to||r.currentLap,r.currentLap),length=Math.max(0,end-s.from+1),width=length/snap.totalLaps*100;return `<div class="stint-bar ${tyreClass(s.compound)}" style="width:${width}%" title="${esc(r.code)} · ${tyreLabel(s.compound)} · okr. ${s.from}–${end}"><span>${esc(s.compound?.[0]||'?')}</span>${width>8?`<span>${length}</span>`:''}</div>`;}).join('')}</div><div class="strategy-pits">${r.pitStops}</div></div>`;
  }).join('')}</div><p class="strategy-note">Długość paska oznacza liczbę okrążeń na mieszance. Przyszłe stinty są ukryte. Czas postoju to czas obsługi bolidu; nie obejmuje całego przejazdu przez aleję serwisową.</p></section>`;
}
function renderStandings() {
  const historical=state.mode==='replay'&&Array.isArray(data.championship);
  if(!historical){$('#page-content').innerHTML=`<section class="panel"><div class="empty-state"><h2>Klasyfikacja sezonu</h2><p style="margin:15px 0">Dane tej sesji obejmują wyniki wyścigu. Klasyfikację sezonu przed i po GP Włoch 2025 znajdziesz w demo.</p><button class="button primary" data-action="demo">Otwórz demo</button></div></section>`;return;}
  const after=state.seasonView==='after',rows=[...data.championship].sort((a,b)=>(after?a.positionAfter:a.positionBefore)-(after?b.positionAfter:b.positionBefore)),max=Math.max(...rows.map(r=>after?r.pointsAfter:r.pointsBefore));
  $('#page-content').innerHTML=`<div class="section-heading"><div><h2>Walka o mistrzostwo</h2><p>Sezon 2025 · klasyfikacja ${after?'po':'przed'} Grand Prix Włoch. Zapis historyczny.</p></div><div class="tab-list"><button class="tab ${!after?'active':''}" data-action="season-view" data-value="before">Przed wyścigiem</button><button class="tab ${after?'active':''}" data-action="season-view" data-value="after">Po wyścigu</button></div></div><div class="standings-layout"><section class="panel standings-panel"><div class="panel-heading"><h3 class="panel-title">Kierowcy</h3><span class="panel-kicker">PUNKTY</span></div><div class="standings-rows">${rows.map(r=>{const d=data.drivers.find(d=>d.number===r.driver)||{number:r.driver,code:'DOO',firstName:'Jack',lastName:'Doohan',team:'Alpine',color:'#0093cc'},pos=after?r.positionAfter:r.positionBefore,points=after?r.pointsAfter:r.pointsBefore;return `<div class="standings-row"><span class="standings-pos">${String(pos).padStart(2,'0')}</span><span class="team-line" style="background:${color(d.color)}"></span><div class="standings-name"><strong>${esc(d.firstName)} ${esc(d.lastName)}</strong><div class="standings-bar"><i style="width:${points/max*100}%;background:${color(d.color)}"></i></div></div><strong class="standings-points">${points}</strong></div>`;}).join('')}</div></section><section class="panel standings-panel constructors"><div class="panel-heading"><h3 class="panel-title">Konstruktorzy</h3><span class="panel-kicker">PUNKTY</span></div><div class="standings-rows">${[...data.constructors].sort((a,b)=>(after?a.positionAfter:a.positionBefore)-(after?b.positionAfter:b.positionBefore)).map(r=>{const d=data.drivers.find(d=>d.team===r.team),points=after?r.pointsAfter:r.pointsBefore,maxTeam=Math.max(...data.constructors.map(c=>after?c.pointsAfter:c.pointsBefore));return `<div class="standings-row"><span class="standings-pos">${String(after?r.positionAfter:r.positionBefore).padStart(2,'0')}</span><span class="team-line" style="background:${color(d?.color)}"></span><div class="standings-name"><strong>${esc(r.team)}</strong><div class="standings-bar"><i style="width:${points/maxTeam*100}%;background:${color(d?.color)}"></i></div></div><strong class="standings-points">${points}</strong></div>`;}).join('')}</div><p class="strategy-note">Ten widok nie podąża za suwakiem powtórki. Przełącznik pokazuje opublikowaną klasyfikację przed lub po całym wyścigu.</p></section></div>`;
}
function setPage(page) {state.page=page;haptic();renderPage();window.scrollTo({top:0,behavior:state.reducedMotion?'instant':'smooth'});}
function seek(t) {if(state.mode!=='replay')return;state.t=clamp(Number(t),engine.startTime,engine.endTime);if(engine.endTime-state.t<.01)state.t=engine.endTime;if(state.t>=engine.endTime)state.playing=false;snap=engine.snapshot(state.t);renderNow(true);}
function renderNow(force=false) {
  renderTop();updatePlayback();
  if(state.page==='race'){renderTiming();renderFocus();renderEvents();updateTrack();}
  if(force&&state.page==='analysis')updateAnalysis();
  if(force&&state.page==='strategy')updateStrategy();
}
function tick(now) {
  const delta=lastFrame?Math.min((now-lastFrame)/1000,1):0;lastFrame=now;
  if(state.mode==='replay'&&state.playing&&!document.hidden&&!state.seeking) {
    state.t=Math.min(engine.endTime,state.t+delta*state.speed);const reachedEnd=state.t>=engine.endTime;if(reachedEnd){state.playing=false;toast('Flaga w szachownicę. Wyścig zakończony.');}
    if(reachedEnd||now-renderAt>(state.reducedMotion?750:160)){snap=engine.snapshot(state.t);renderNow(reachedEnd);if(Math.floor(state.t)!==state.lastSecond){state.lastSecond=Math.floor(state.t);if(state.page==='analysis')updateAnalysis();if(state.page==='strategy')updateStrategy();}renderAt=now;}
  }
  rafId=requestAnimationFrame(tick);
}

function showModal(title,subtitle,body,{wide=false,eyebrow='APEX / PIT WALL'}={}) {
  beforeModalFocus=document.activeElement;activeModal=title;
  $('#modal-root').innerHTML=`<div class="modal-backdrop" data-close-backdrop="true"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><div class="eyebrow">${esc(eyebrow)}</div><h2 id="modal-title">${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="icon-button modal-close" data-action="close-modal" aria-label="Zamknij okno">${icon('close')}</button></header><div class="modal-body">${body}</div></section></div>`;
  document.body.style.overflow='hidden';$('.modal-close')?.focus();
}
function closeModal() {
  if($('#modal-root .tour-overlay')){endTour();return;}
  $('#modal-root').innerHTML='';activeModal=null;document.body.style.overflow='';beforeModalFocus?.focus?.({preventScroll:true});
}
function showSource() {
  showModal('Dane, którym możesz zaufać','Wybierz zapis wyścigu lub sprawdź ostatnią dostępną sesję.',`
    <div class="data-choice"><div class="data-choice-icon">${icon('replay')}</div><div class="data-choice-text"><h3>Monza 2025 · pełna powtórka</h3><p>Rzeczywiste czasy, odstępy i strategie. Działa bez klucza API.</p></div><button class="button primary small" data-action="demo">Odtwarzaj</button></div>
    <div class="data-choice latest"><div class="data-choice-icon">${icon('radio')}</div><div class="data-choice-text"><h3>Ostatnia dostępna sesja</h3><p>Pobierz klasyfikację i czasy bezpośrednio z OpenF1.</p></div><button class="button small" id="fetch-latest" data-action="fetch-latest">Sprawdź</button></div>
    <div id="data-status" class="data-status">${icon('info')} Dostęp bez logowania obejmuje archiwum. <strong>Transmisja LIVE wymaga płatnego dostępu OpenF1</strong>, który nie jest podłączony do tej aplikacji. Powtórka nigdy nie jest oznaczana jako LIVE.</div>
    <div class="data-details"><h3>Co dokładnie oglądasz?</h3><p>Pozycje, odstępy, czasy, opony, pogoda i komunikaty pochodzą z zapisu wyścigu. Obrys Monzy jest zrekonstruowany z telemetrii. Ruch bolidów jest interpolacją czasów okrążeń, a nie dokładnym odtworzeniem GPS. DNF w trakcie powtórki może być wnioskowane z końca zapisu kierowcy.</p><div class="meta-row"><span>Sesja demo</span><strong>GP Włoch · 7 września 2025</strong></div><div class="meta-row"><span>Źródło</span><strong><a href="https://openf1.org/docs/" target="_blank" rel="noopener noreferrer">OpenF1 · dokumentacja</a></strong></div><div class="meta-row"><span>Zakres danych demo</span><strong>20 kierowców · 53 okrążenia</strong></div></div>`);
}
async function loadLatest({silent=false}={}) {
  if(apiController) return;
  if(!navigator.onLine){toast('Jesteś offline. Powtórka Monzy jest dostępna.');return;}
  apiController=new AbortController();const button=$('#fetch-latest');if(button)button.disabled=true;
  function progress(message){const s=$('#data-status');if(s){s.className='data-status loading';s.innerHTML=`<span class="spinner"></span><span>${esc(message)}</span>`;}}
  try {
    latestInfo=await fetchLatestSnapshot({signal:apiController.signal,onStatus:progress});retryCount=0;
    data=latestInfo.dataset;engine=latestInfo.engine||createReplayEngine(data);snap=latestInfo.snapshot;state.mode=latestInfo.mode;state.playing=false;state.t=snap.t;
    if(!snap.rows.some(r=>r.number===state.selected))state.selected=snap.rows[0].number;
    if(!silent)closeModal();renderShell();
    if(!silent)toast(`Wczytano ${data.session.circuit_short_name} ${data.session.year} · ${latestInfo.isLive?'bieżąca sesja':'dane archiwalne'}`);
    clearTimeout(refreshTimer);if(latestInfo.isLive)refreshTimer=setTimeout(()=>loadLatest({silent:true}),60000);
  } catch(error) {
    if(error.name==='AbortError')return;
    const message=error.code==='LIVE_ACCESS_REQUIRED'?'Trwa sesja lub obowiązuje okno dostępu LIVE. OpenF1 wymaga wtedy subskrypcji. Pełna powtórka Monzy działa od razu, bez konta.':error.message||'Nie udało się pobrać danych. Powtórka Monzy jest nadal dostępna.';
    const el=$('#data-status');if(el){el.className='data-status error';el.textContent=message;}else toast(message);
    if(silent&&latestInfo){latestInfo.isLive=false;latestInfo.warning='Połączenie przerwane. Wyświetlamy ostatni pobrany zapis; dane nie są aktualne.';state.mode='archive';renderTop();renderNotice();renderPlayback();if(retryCount<3){retryCount++;refreshTimer=setTimeout(()=>{if(state.mode!=='replay')loadLatest({silent:true});},60000*retryCount);}}
  } finally {apiController=null;const b=$('#fetch-latest');if(b)b.disabled=false;}
}
function enterDemo() {
  apiController?.abort();apiController=null;clearTimeout(refreshTimer);latestInfo=null;closeModal();data=replayData;engine=replayEngine;state.mode='replay';state.t=data.session.defaultTime;state.playing=true;state.speed=4;state.page='race';snap=engine.snapshot(state.t);if(!snap.rows.some(r=>r.number===state.selected))state.selected=4;renderShell();toast('Powtórka GP Włoch 2025 · prawdziwe dane wyścigu');
}
function showSettings() {
  showModal('Twój sposób oglądania','Dostosuj pit wall do swojego tabletu.',`
    <div class="settings-row"><div><h3>Zwarta tabela</h3><p>Więcej kierowców jednocześnie na ekranie.</p></div><button class="toggle ${state.compact?'on':''}" role="switch" aria-checked="${state.compact}" aria-label="Zwarta tabela" data-action="toggle-setting" data-setting="compact"></button></div>
    <div class="settings-row"><div><h3>Ogranicz animacje</h3><p>Spokojniejszy ruch i rzadsze odświeżanie mapy.</p></div><button class="toggle ${state.reducedMotion?'on':''}" role="switch" aria-checked="${state.reducedMotion}" aria-label="Ogranicz animacje" data-action="toggle-setting" data-setting="reducedMotion"></button></div>
    <div class="settings-row"><div><h3>Odpowiedź dotykowa</h3><p>Krótka wibracja na wspieranych urządzeniach.</p></div><button class="toggle ${state.haptics?'on':''}" role="switch" aria-checked="${state.haptics}" aria-label="Odpowiedź dotykowa" data-action="toggle-setting" data-setting="haptics"></button></div>
    <div class="settings-row"><div><h3>Powtórka offline</h3><p>Monza 2025 i interfejs zapisane na urządzeniu.</p></div><span class="offline-ready ${state.offlineReady?'ready':''}">${state.offlineReady?'Gotowa':'Jeszcze niedostępna'}</span></div>
    <div class="settings-row"><div><h3>Pełny ekran</h3><p>Skup się na wyścigu. Dostępność zależy od przeglądarki.</p></div><button class="button small" data-action="fullscreen">${icon('expand')}Włącz</button></div>
    <div class="install-help"><h3>Aplikacja na ekranie głównym</h3><p>${installEvent?'Zainstaluj APEX, aby otwierać go jak osobną aplikację.':'iPad: otwórz w Safari, wybierz Udostępnij i „Do ekranu głównego”. Android: menu przeglądarki i „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.'} Po pierwszym pełnym załadowaniu powtórka jest zapisywana do użytku offline, jeśli przeglądarka pozwala na pamięć lokalną.</p>${installEvent?`<button class="button small primary" data-action="install" style="margin-top:12px">${icon('download')}Zainstaluj APEX</button>`:''}</div>
    <p class="settings-caption">Skróty: spacja — pauza; strzałki w lewo/prawo — 30 s; Escape — zamknij okno. Preferencje i ulubieni kierowcy są zapisywani na tym urządzeniu.</p>`);
}
function applyPreferences(){document.body.classList.toggle('compact',state.compact);document.body.classList.toggle('reduce-motion',state.reducedMotion);document.body.classList.toggle('offline',!navigator.onLine);}
async function toggleFullscreen() {
  try {
    if(document.fullscreenElement){await document.exitFullscreen();return;}
    if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    else toast('Na tym tablecie użyj „Dodaj do ekranu głównego”, aby otworzyć pełny ekran.');
  }catch{toast('Przeglądarka nie pozwoliła na pełny ekran. Możesz dodać APEX do ekranu głównego.');}
}
function showAllEvents() {const events=(data.raceControl||[]).filter(e=>e.t<=state.t&&e.t>=engine.startTime-30).reverse();showModal('Wiadomości z toru','Komunikaty dyrekcji wyścigu do wybranego momentu. Pełny oryginał jest dostępny po najechaniu na wpis.',`<div class="events-modal-list">${events.length?events.map(eventMarkup).join(''):'<div class="empty-state">Nie ma jeszcze komunikatów z wyścigu.</div>'}</div>`,{wide:true,eyebrow:'RACE CONTROL / HISTORIA'});}
const tourSteps=[
  {title:'Cały wyścig. Jeden ekran.',text:'APEX to Twój prywatny pit wall. Oglądasz prawdziwy zapis GP Włoch 2025: klasyfikację, odstępy, pogodę i komunikaty dyrekcji. Demo rusza od 36. okrążenia.',visual:'flag',page:'race',time:36},
  {title:'Wybierz swojego kierowcę.',text:'Dotknij dowolnego wiersza tabeli lub bolidu na mapie. Kierowca zostanie wyróżniony, a jego czasy, sektory i opony pojawią się poniżej. Gwiazdka zapisuje go w ulubionych.',visual:'driver',page:'race',time:36},
  {title:'Zobacz, kto naprawdę jest szybszy.',text:'W zakładce Tempo porównasz dwóch kierowców na tych samych, ukończonych okrążeniach. Wykres i średnia pokażą różnicę, którą sama pozycja w wyścigu może ukrywać.',visual:'chart',page:'analysis',time:39},
  {title:'Prześledź strategię od startu.',text:'Sprawdź mieszanki, długości stintów i faktyczne postoje. Przesuwaj oś czasu, aby zobaczyć rozwój wyścigu — przyszłe dane pozostają ukryte aż do ich momentu.',visual:'tyre',page:'strategy',time:45},
  {title:'Ty kontrolujesz tempo.',text:'Wstrzymuj, przewijaj i przyspieszaj powtórkę od 1× do 32×. W „Dane sesji” możesz też pobrać ostatni dostępny wyścig. Powtórka jest gotowa. Czas wejść na pit wall.',visual:'play',page:'race',time:36}
];
function startTour() {if(state.mode!=='replay')enterDemo();closeModal();tourWasPlaying=state.playing;state.playing=false;tourStep=0;renderTour();}
function renderTour() {
  const step=tourSteps[tourStep];state.page=step.page;state.t=engine.timeForLap(step.time)+20;snap=engine.snapshot(state.t);renderPage();renderTop();updatePlayback();
  let visual=icon(step.visual);
  if(step.visual==='driver')visual=`<div class="tour-preview-row"><span class="position">02</span><span class="team-line" style="background:#f47600"></span><strong>Lando Norris</strong><span class="gap">${formatGap(snap.rows.find(r=>r.number===4)?.gap)}</span>${tyre('HARD')}</div>`;
  if(step.visual==='chart')visual='<svg class="tour-mini-chart" viewBox="0 0 300 100" aria-hidden="true"><path d="M0 80h300M0 45h300M0 10h300" stroke="#425336" stroke-dasharray="3 5"/><polyline points="0,78 42,56 85,63 128,35 171,47 214,22 257,29 300,10"/><polyline points="0,89 42,73 85,78 128,65 171,61 214,44 257,58 300,33" style="stroke:#ff995e;opacity:.8"/></svg>';
  $('#modal-root').innerHTML=`<div class="tour-overlay"><section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title"><button class="icon-button modal-close" data-action="tour-close" aria-label="Zamknij demo">${icon('close')}</button><div class="tour-visual">${visual}</div><div class="tour-step-tag">ODKRYJ APEX · ${tourStep+1} / ${tourSteps.length}</div><h2 id="tour-title">${step.title}</h2><p>${step.text}</p><div class="tour-controls"><div class="tour-dots">${tourSteps.map((s,i)=>`<span class="${i===tourStep?'active':''}"></span>`).join('')}</div><div style="display:flex;gap:9px">${tourStep?'<button class="button small" data-action="tour-back">Wstecz</button>':''}<button class="button primary" data-action="tour-next">${tourStep===tourSteps.length-1?'Zaczynamy':'Dalej'}</button></div></div></section></div>`;
  activeModal='tour';document.body.style.overflow='';$('[data-action="tour-next"]')?.focus();
}
function endTour() {$('#modal-root').innerHTML='';activeModal=null;document.body.style.overflow='';state.page='race';state.t=data.session.defaultTime;snap=engine.snapshot(state.t);state.playing=true;renderPage();renderTop();updatePlayback();toast('Pit wall gotowy. Dotknij kierowcy, aby go śledzić.');}

document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');
  if(!el){if(event.target.matches('[data-close-backdrop]'))closeModal();return;}
  const action=el.dataset.action;
  if(action==='page')setPage(el.dataset.page);
  else if(action==='driver'){state.selected=Number(el.dataset.driver);haptic();persist();lastTableSignature='';lastFocusSignature='';renderTiming();renderFocus();updateTrack();}
  else if(action==='gap-mode'){state.gapMode=el.dataset.mode;persist();$$('.table-mode button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.gapMode);b.setAttribute('aria-pressed',b.dataset.mode===state.gapMode);});$('#gap-heading').textContent=state.gapMode==='interval'?'Odstęp':'Do lidera';renderTiming();}
  else if(action==='favorite'){const r=selectedRow();state.favorites=state.favorites.includes(r.number)?state.favorites.filter(n=>n!==r.number):[...state.favorites,r.number];persist();renderFocus();renderTiming();toast(state.favorites.includes(r.number)?`${r.firstName} ${r.lastName} w ulubionych`:'Usunięto kierowcę z ulubionych');}
  else if(action==='compare-selected'){state.compareA=state.selected;if(state.compareB===state.compareA)state.compareB=snap.rows.find(r=>r.number!==state.compareA&&r.status!=='dns')?.number;setPage('analysis');persist();}
  else if(action==='play'){if(state.t>=engine.endTime)seek(engine.startTime);state.playing=!state.playing;lastFrame=0;updatePlayback();haptic();}
  else if(action==='restart'){seek(engine.startTime);state.playing=true;updatePlayback();toast('Odtwarzanie od startu wyścigu');}
  else if(action==='skip')seek(state.t+Number(el.dataset.seconds||30));
  else if(action==='speed'){const speeds=[1,2,4,8,16,32];state.speed=speeds[(speeds.indexOf(state.speed)+1)%speeds.length];updatePlayback();toast(`Prędkość odtwarzania ${state.speed}×`);}
  else if(action==='source')showSource();
  else if(action==='settings')showSettings();
  else if(action==='close-modal')closeModal();
  else if(action==='fullscreen')toggleFullscreen();
  else if(action==='expand-map'){const panel=$('#track-panel'),expanded=panel.classList.toggle('track-expanded');el.innerHTML=icon(expanded?'collapse':'expand');el.setAttribute('aria-label',expanded?'Zmniejsz mapę toru':'Powiększ mapę toru');}
  else if(action==='fetch-latest'||action==='refresh-latest'){if(action==='refresh-latest')showSource();loadLatest();}
  else if(action==='demo')enterDemo();
  else if(action==='toggle-setting'){const key=el.dataset.setting;state[key]=!state[key];persist();applyPreferences();el.classList.toggle('on',state[key]);el.setAttribute('aria-checked',String(state[key]));haptic();}
  else if(action==='events')showAllEvents();
  else if(action==='tour')startTour();
  else if(action==='tour-close')endTour();
  else if(action==='tour-next'){if(tourStep<tourSteps.length-1){tourStep++;renderTour();}else endTour();}
  else if(action==='tour-back'){tourStep=Math.max(0,tourStep-1);renderTour();}
  else if(action==='season-view'){state.seasonView=el.dataset.value;renderStandings();}
  else if(action==='install'&&installEvent){installEvent.prompt();const result=await installEvent.userChoice;if(result.outcome==='accepted')toast('APEX został dodany do Twoich aplikacji.');installEvent=null;showSettings();}
  else if(action==='retry-init')location.reload();
});
document.addEventListener('input',event=>{if(event.target.id==='timeline'){state.seeking=true;seek(event.target.value);}});
document.addEventListener('change',event=>{
  if(event.target.id==='timeline'){state.seeking=false;lastFrame=0;}
  if(event.target.id==='compare-a'||event.target.id==='compare-b'){
    const isA=event.target.id==='compare-a',old=isA?state.compareA:state.compareB;state[isA?'compareA':'compareB']=Number(event.target.value);
    if(state.compareA===state.compareB)state[isA?'compareB':'compareA']=old;
    persist();renderAnalysis();
  }
});
document.addEventListener('pointerup',()=>{state.seeking=false;});
document.addEventListener('keydown',event=>{
  if(event.key==='Tab'&&activeModal){const focusables=$$('button:not([disabled]),a[href],select,input,[tabindex="0"]',$('#modal-root')),first=focusables[0],last=focusables.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;}
  if(event.key==='Escape'){if(activeModal)closeModal();else if($('#track-panel')?.classList.contains('track-expanded'))$('[data-action="expand-map"]')?.click();return;}
  if(event.key==='Enter'&&event.target.matches('[data-action="driver"]')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
  if(activeModal||event.target.matches('input,select,textarea,button,a')||state.mode!=='replay')return;
  if(event.code==='Space'){event.preventDefault();if(state.t>=engine.endTime)seek(engine.startTime);state.playing=!state.playing;updatePlayback();}
  if(event.key==='ArrowRight'){event.preventDefault();seek(state.t+30);}
  if(event.key==='ArrowLeft'){event.preventDefault();seek(state.t-30);}
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;});
window.addEventListener('online',()=>{applyPreferences();toast('Połączenie przywrócone.');});
window.addEventListener('offline',()=>{applyPreferences();toast('Tryb offline. Zapisana powtórka działa dalej.');});
document.addEventListener('visibilitychange',()=>{lastFrame=0;});
window.addEventListener('pagehide',()=>{apiController?.abort();clearTimeout(refreshTimer);});

async function init() {
  try {
    const response=await fetch(appUrl('replay.json'));if(!response.ok)throw new Error(`HTTP ${response.status}`);
    replayData=await response.json();data=replayData;replayEngine=createReplayEngine(data);engine=replayEngine;
    state.t=data.session.defaultTime||engine.timeForLap(36)+20;snap=engine.snapshot(state.t);
    if(!snap.rows.some(r=>r.number===state.selected))state.selected=4;
    renderShell();if(!loopStarted){loopStarted=true;rafId=requestAnimationFrame(tick);}
    if('serviceWorker'in navigator)navigator.serviceWorker.register(appUrl('sw.js'), {scope: APP_BASE.href}).then(async()=>{await navigator.serviceWorker.ready;state.offlineReady=!!(await caches.match(appUrl('replay.json')));}).catch(()=>{state.offlineReady=false;});
    if(new URLSearchParams(location.search).get('demo')==='tour')startTour();
  }catch(error){$('#app').innerHTML=`<div class="boot-screen"><div class="boot-logo">APEX</div><div class="boot-error"><h1 style="font-size:26px">Nie udało się wczytać wyścigu</h1><p style="margin:15px 0;color:var(--muted)">Przy pierwszym uruchomieniu potrzebne jest połączenie z internetem. Spróbuj za chwilę.</p><button class="button primary" data-action="retry-init">Spróbuj ponownie</button></div></div>`;console.error('APEX initialization:',error);}
}
init();
