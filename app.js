"use strict";
/* =========================================================
   Blutdruck-App – alles in einer Datei
   Abschnitte: Utils · Speicherung · Parser · Erfassen ·
   Tabelle · Diagramm · Export/Import · App-Steuerung · PWA
   ========================================================= */

/* ---------- Utils ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID()
                   : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const fmtDate = d => new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
const fmtTime = d => new Date(d).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
function toLocalInput(iso){
  const d=new Date(iso), p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = s => new Date(s).toISOString();
const todayStr = () => { const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`; };
const stampDateTime = () => { const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

/* Toast in 3 Kategorien (success/notice/error): farbiges Feld mit Icon, 4 s sichtbar, wegwischbar. */
const TOAST_ICON={
  success:'<svg class="t-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.4l3 3 6-6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  notice:'<svg class="t-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l9.5 17H2.5z" fill="currentColor"/><path d="M12 9.5v4.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.15" fill="#fff"/></svg>',
  error:'<svg class="t-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l9.5 17H2.5z" fill="currentColor"/><path d="M12 9.5v4.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.15" fill="#fff"/></svg>'
};
let _toastT,_toastHideT;
function toast(msg,kind){
  kind=(kind==='error'||kind==='notice')?kind:'success';
  const wrap=$('#toast'); wrap.innerHTML=''; clearTimeout(_toastHideT);
  const card=document.createElement('div'); card.className='toast-card '+kind;
  card.innerHTML=TOAST_ICON[kind];
  const s=document.createElement('span'); s.className='t-msg'; s.textContent=msg; card.appendChild(s);
  wrap.appendChild(card);
  // In den Top-Layer heben, damit der Toast auch ÜBER dem offenen Menü sichtbar ist (Fallback: ignoriert)
  try{ if(wrap.showPopover && !wrap.matches(':popover-open')) wrap.showPopover(); }catch{}
  requestAnimationFrame(()=>wrap.classList.add('show'));   // einblenden
  clearTimeout(_toastT); _toastT=setTimeout(hideToast,4000);
  swipeToast(card);
}
function hideToast(){
  clearTimeout(_toastT);
  const wrap=$('#toast'); wrap.classList.remove('show');
  clearTimeout(_toastHideT);   // erst ausblenden (Transition), dann aus dem Top-Layer nehmen
  _toastHideT=setTimeout(()=>{ wrap.classList.remove('show'); try{ if(wrap.hidePopover && wrap.matches(':popover-open')) wrap.hidePopover(); }catch{} },260);
}
/* Toast horizontal wegwischen (Pointer = Finger + Maus); beim Berühren pausiert der Auto-Timer. */
function swipeToast(card){
  let startX=0,dx=0,drag=false;
  card.addEventListener('pointerdown',e=>{ drag=true; startX=e.clientX; dx=0; card.style.transition='none'; clearTimeout(_toastT); try{card.setPointerCapture(e.pointerId);}catch{} });
  card.addEventListener('pointermove',e=>{ if(!drag) return; dx=e.clientX-startX; card.style.transform='translateX('+dx+'px)'; card.style.opacity=String(Math.max(0,1-Math.abs(dx)/200)); });
  const end=()=>{ if(!drag) return; drag=false; card.style.transition='';
    if(Math.abs(dx)>60){ card.style.transform='translateX('+(dx>0?420:-420)+'px)'; card.style.opacity='0'; setTimeout(hideToast,200); }
    else{ card.style.transform=''; card.style.opacity=''; clearTimeout(_toastT); _toastT=setTimeout(hideToast,4000); } };
  card.addEventListener('pointerup',end); card.addEventListener('pointercancel',end);
}

/* ---------- Speicherung ---------- */
const LS_KEY='bp_entries', LS_SET='bp_settings';
const SET_DEFAULT={colorDots:true,guideLines:true,theme:'auto',
  reminderDays:3,firstDirtyAt:null,snoozeUntil:0,
  thr:{sysY:130,sysR:140,diaY:85,diaR:90}};

/* IndexedDB ist der robuste Hauptspeicher (überlebt Speicherdruck/ITP deutlich besser
   als localStorage und fasst viel mehr Daten). localStorage bleibt als Spiegel/Fallback. */
const DB_NAME='blutdruck', DB_VER=1, STORE_E='entries', STORE_M='meta';
let _db=null;
function openDB(){
  return new Promise((res,rej)=>{
    if(!('indexedDB' in window)){ rej(new Error('no-indexeddb')); return; }
    const rq=indexedDB.open(DB_NAME,DB_VER);
    rq.onupgradeneeded=()=>{
      const db=rq.result;
      if(!db.objectStoreNames.contains(STORE_E)) db.createObjectStore(STORE_E,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STORE_M)) db.createObjectStore(STORE_M); // für Backup-Datei-Handle
    };
    rq.onsuccess=()=>res(rq.result);
    rq.onerror=()=>rej(rq.error);
  });
}
function idbAll(){
  return new Promise((res,rej)=>{
    const rq=_db.transaction(STORE_E,'readonly').objectStore(STORE_E).getAll();
    rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>rej(rq.error);
  });
}
function idbWriteAll(list){
  return new Promise((res,rej)=>{
    const tx=_db.transaction(STORE_E,'readwrite'), st=tx.objectStore(STORE_E);
    st.clear(); list.forEach(e=>st.put(e)); // kompletter Stand in einer Transaktion
    tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
  });
}
function idbGetMeta(key){
  return new Promise((res,rej)=>{
    if(!_db){ res(null); return; }
    const rq=_db.transaction(STORE_M,'readonly').objectStore(STORE_M).get(key);
    rq.onsuccess=()=>res(rq.result??null); rq.onerror=()=>rej(rq.error);
  });
}
function idbSetMeta(key,val){
  return new Promise((res,rej)=>{
    if(!_db){ rej(new Error('no-db')); return; }
    const tx=_db.transaction(STORE_M,'readwrite'); tx.objectStore(STORE_M).put(val,key);
    tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
  });
}

/* Browser bitten, den Speicher dauerhaft zu behalten (Schutz gegen Auto-Löschung/Eviction). */
async function requestPersistence(){
  try{
    if(navigator.storage && navigator.storage.persist){
      if(!(await navigator.storage.persisted())) await navigator.storage.persist();
    }
  }catch{}
}

function loadEntries(){ try{const a=JSON.parse(localStorage.getItem(LS_KEY)||'[]');return Array.isArray(a)?a:[];}catch{return[];} }
function quotaToast(e){ if(e&&e.name==='QuotaExceededError') toast('Speicher voll – bitte Backup sichern','error'); }
function saveEntries(){
  try{ localStorage.setItem(LS_KEY,JSON.stringify(entries)); }catch(e){ quotaToast(e); }   // Spiegel/Fallback
  if(_db) idbWriteAll(entries).then(scheduleAutoBackup).catch(quotaToast);                  // robuster Hauptspeicher
}
function loadSettings(){
  let s; try{ s=Object.assign({},SET_DEFAULT,JSON.parse(localStorage.getItem(LS_SET)||'{}')); }catch{ s={...SET_DEFAULT}; }
  s.thr=Object.assign({},SET_DEFAULT.thr,s.thr||{}); // Schwellenwerte immer vollständig halten
  return s;
}
function saveSettings(){ localStorage.setItem(LS_SET,JSON.stringify(settings)); }

let entries=[];
let settings=loadSettings();

/* Beim Start: IndexedDB öffnen, Daten laden, ggf. einmalig aus localStorage migrieren. */
async function initStorage(){
  try{
    _db=await openDB();
    const fromDb=await idbAll();
    if(fromDb.length){ entries=fromDb; }
    else{
      const fromLs=loadEntries();          // einmalige Migration aus localStorage
      entries=fromLs;
      if(fromLs.length) await idbWriteAll(fromLs);
    }
  }catch{
    entries=loadEntries();                  // kompletter Fallback ohne IndexedDB
  }
}

function addEntry(e){ entries.push(e); saveEntries(); markDirty(); }
function updateEntry(id,patch){ const i=entries.findIndex(x=>x.id===id); if(i>=0){entries[i]={...entries[i],...patch};saveEntries();markDirty();} }
function removeEntry(id){ entries=entries.filter(x=>x.id!==id); saveEntries(); markDirty(); }

/* ---------- Parser ---------- */
const RANGES={sys:[70,260],dia:[40,160],pulse:[30,220]};
const inRange=(v,[a,b])=>v!=null&&v>=a&&v<=b;
function parseInput(str){
  const nums=(String(str).match(/\d+/g)||[]).map(n=>parseInt(n,10));
  return {sys:nums[0]??null,dia:nums[1]??null,pulse:nums[2]??null,count:nums.length};
}

/* ---------- Filter / Sortierung (geteilt von Tabelle + Diagramm) ---------- */
let sortKey='ts', sortDir='desc';
const filters={from:'',to:'',sysMin:'',sysMax:'',diaMin:'',diaMax:'',pulMin:'',pulMax:'',note:''};

function getFiltered(){
  return entries.filter(e=>{
    const t=new Date(e.ts).getTime();
    if(filters.from && t<new Date(filters.from+'T00:00:00').getTime()) return false;
    if(filters.to   && t>new Date(filters.to+'T23:59:59').getTime()) return false;
    const numOk=(v,mn,mx)=>!((mn!==''&&v<+mn)||(mx!==''&&v>+mx));
    if(!numOk(e.sys,filters.sysMin,filters.sysMax)) return false;
    if(!numOk(e.dia,filters.diaMin,filters.diaMax)) return false;
    if(!numOk(e.pulse,filters.pulMin,filters.pulMax)) return false;
    if(filters.note && !(e.note||'').toLowerCase().includes(filters.note.toLowerCase())) return false;
    return true;
  });
}
function getSorted(){
  const list=getFiltered(), dir=sortDir==='asc'?1:-1;
  return list.sort((a,b)=>{
    const av=sortKey==='ts'?new Date(a.ts).getTime():a[sortKey];
    const bv=sortKey==='ts'?new Date(b.ts).getTime():b[sortKey];
    return av<bv?-dir:av>bv?dir:0;
  });
}
function category(e){            // Farbstufe nach den nutzerdefinierten Schwellenwerten
  const t=settings.thr;
  if(e.sys>=t.sysR||e.dia>=t.diaR) return 'r';
  if(e.sys>=t.sysY||e.dia>=t.diaY) return 'y';
  return 'g';
}

/* ---------- Erfassen ---------- */
const input=$('#bpInput');
function setChip(id,val,range){
  const el=$('#'+id);
  el.querySelector('.v').textContent=val!=null?val:'–';
  el.classList.toggle('filled',val!=null);
  el.classList.toggle('warn',val!=null&&!inRange(val,range));
}
function updatePreview(){
  const {sys,dia,pulse,count}=parseInput(input.value);
  setChip('chipSys',sys,RANGES.sys);
  setChip('chipDia',dia,RANGES.dia);
  setChip('chipPulse',pulse,RANGES.pulse);
  const ready=sys!=null&&dia!=null&&pulse!=null;
  $('#saveBtn').disabled=!ready;
  let warn='';
  if(ready){
    if(!inRange(sys,RANGES.sys)||!inRange(dia,RANGES.dia)||!inRange(pulse,RANGES.pulse))
      warn='Ungewöhnlicher Wert – bitte prüfen.';
    if(count>3) warn='Mehr als 3 Zahlen erkannt – es zählen die ersten drei.';
  }
  $('#captureWarn').textContent=warn;
}
function saveCapture(){
  const {sys,dia,pulse}=parseInput(input.value);
  if(sys==null||dia==null||pulse==null) return;
  addEntry({id:uid(),ts:new Date().toISOString(),sys,dia,pulse,note:$('#noteInput').value.trim()});
  input.value=''; $('#noteInput').value=''; setNote(false); updatePreview();
  renderAll();
  toast('Gespeichert');
  updateReminder();
  input.focus();
}
function setNote(show){
  const w=$('#noteWrap');
  const open = show!==undefined ? show : w.hasAttribute('hidden');
  if(open){ w.removeAttribute('hidden'); $('#noteToggle').textContent='– Notiz ausblenden'; $('#noteInput').focus(); }
  else { w.setAttribute('hidden',''); $('#noteToggle').textContent='+ Notiz hinzufügen'; }
}
input.addEventListener('input',updatePreview);
input.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault(); if(!$('#saveBtn').disabled) saveCapture();} });
$('#saveBtn').addEventListener('click',saveCapture);
$('#noteToggle').addEventListener('click',()=>setNote());

/* ---------- Tabelle ---------- */
function updateSortIndicators(){
  $$('th[data-key]').forEach(th=>{
    th.querySelector('.arrow').textContent = th.dataset.key===sortKey ? (sortDir==='asc'?'▲':'▼') : '';
  });
}
function renderTable(){
  const list=getSorted(), tb=$('#tbody'); tb.innerHTML='';
  $('#emptyTable').style.display=list.length?'none':'block';
  for(const e of list){
    const tr=document.createElement('tr');
    tr.tabIndex=0; tr.setAttribute('role','button');
    const dot=settings.colorDots?`<span class="dot ${category(e)}"></span>`:'';
    const note=e.note?`<span class="note-ic" title="${escapeHtml(e.note)}">📝</span>`:'';
    tr.innerHTML=`<td class="c-date">${dot}<div><div class="d">${fmtDate(e.ts)}</div>`+
      `<div class="t muted">${fmtTime(e.ts)} ${note}</div></div></td>`+
      `<td class="num">${e.sys}</td><td class="num">${e.dia}</td><td class="num">${e.pulse}</td>`;
    tr.addEventListener('click',()=>openEdit(e.id));
    tr.addEventListener('keydown',ev=>{ if(ev.key==='Enter') openEdit(e.id); });
    tb.appendChild(tr);
  }
  updateSortIndicators();
}
$$('th[data-key]').forEach(th=>th.addEventListener('click',()=>{
  const k=th.dataset.key;
  if(sortKey===k) sortDir=sortDir==='asc'?'desc':'asc';
  else { sortKey=k; sortDir=k==='ts'?'desc':'asc'; }
  renderTable();
}));

/* ----- Filter-Bedienung ----- */
$('#filterBtn').addEventListener('click',()=>{
  const p=$('#filterPanel'); p.classList.toggle('open');
  $('#filterBtn').classList.toggle('active',p.classList.contains('open'));
});
Object.keys(filters).forEach(k=>{
  const el=$('#f_'+k); if(!el) return;
  el.addEventListener('input',()=>{ filters[k]=el.value; clearRangeChips(); refreshData(); });
});
function syncFilterInputs(){ Object.keys(filters).forEach(k=>{const el=$('#f_'+k); if(el) el.value=filters[k];}); }
function clearRangeChips(){ $$('.chip-range').forEach(c=>c.classList.remove('active')); }
function setActiveRangeChip(days){
  $$('.chip-range').forEach(c=>c.classList.toggle('active',+c.dataset.days===days));
}
$$('.chip-range').forEach(c=>c.addEventListener('click',()=>{
  const d=+c.dataset.days;
  if(d){ filters.from=new Date(Date.now()-d*864e5).toISOString().slice(0,10); filters.to=''; }
  else { filters.from=''; filters.to=''; }
  syncFilterInputs(); setActiveRangeChip(d); refreshData();
}));
function resetView(){
  sortKey='ts'; sortDir='desc';
  Object.keys(filters).forEach(k=>filters[k]='');
  syncFilterInputs(); setActiveRangeChip(0); refreshData();
  toast('Eingabe zurückgesetzt','notice');
}
$('#resetBtn').addEventListener('click',resetView);
$('#resetBtn2').addEventListener('click',resetView);

/* ---------- Bearbeiten / Löschen ---------- */
let editId=null;
function openEdit(id){
  const e=entries.find(x=>x.id===id); if(!e) return;
  editId=id;
  $('#edDt').value=toLocalInput(e.ts);
  $('#edSys').value=e.sys; $('#edDia').value=e.dia; $('#edPulse').value=e.pulse;
  $('#edNote').value=e.note||'';
  $('#editDlg').showModal();
}
$('#edSave').addEventListener('click',()=>{
  const sys=+$('#edSys').value, dia=+$('#edDia').value, pulse=+$('#edPulse').value, dt=$('#edDt').value;
  if(!dt||!Number.isFinite(sys)||!Number.isFinite(dia)||!Number.isFinite(pulse)){ toast('Bitte alle Werte ausfüllen','notice'); return; }
  updateEntry(editId,{ts:fromLocalInput(dt),sys,dia,pulse,note:$('#edNote').value.trim()});
  $('#editDlg').close(); refreshData(); toast('Aktualisiert');
});
$('#edDelete').addEventListener('click',()=>{
  if(confirm('Diesen Eintrag wirklich löschen?')){ removeEntry(editId); $('#editDlg').close(); refreshData(); toast('Eintrag gelöscht'); }
});
$('#edCancel').addEventListener('click',()=>$('#editDlg').close());

/* ---------- Diagramm (Canvas) ---------- */
let chartGeo=null;
const niceStep=raw=>[10,20,25,50,100].find(s=>s>=raw)||100;

function renderChart(){
  const list=getFiltered().slice().sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  renderStats(list);
  const canvas=$('#chart'), wrap=canvas.parentElement;
  const empty=$('#chartEmpty');
  if(!list.length){ empty.style.display='block'; canvas.style.display='none'; chartGeo=null; return; }
  empty.style.display='none'; canvas.style.display='block';

  const dpr=window.devicePixelRatio||1, cssW=wrap.clientWidth-28, cssH=260;
  canvas.style.height=cssH+'px';
  canvas.width=Math.max(1,Math.floor(cssW*dpr)); canvas.height=Math.floor(cssH*dpr);
  const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssW,cssH);

  const padL=34,padR=10,padT=12,padB=24, W=cssW-padL-padR, H=cssH-padT-padB, x0=padL, y0=padT;
  let mn=Infinity,mx=-Infinity;
  list.forEach(e=>['sys','dia','pulse'].forEach(k=>{ if(e[k]<mn)mn=e[k]; if(e[k]>mx)mx=e[k]; }));
  if(settings.guideLines){ const t=settings.thr; mn=Math.min(mn,t.diaY); mx=Math.max(mx,t.sysR); }
  mn=Math.floor((mn-10)/10)*10; mx=Math.ceil((mx+10)/10)*10; if(mn===mx){mn-=10;mx+=10;}

  const tMin=new Date(list[0].ts).getTime(), tMax=new Date(list.at(-1).ts).getTime(), spanT=(tMax-tMin)||1;
  const X=t=>x0+((new Date(t).getTime()-tMin)/spanT)*W;
  const Y=v=>y0+(1-(v-mn)/(mx-mn))*H;

  ctx.font='11px system-ui,sans-serif'; ctx.textBaseline='middle';
  const border=cssVar('--border'), muted=cssVar('--muted');
  const step=niceStep((mx-mn)/4);
  ctx.lineWidth=1;
  for(let v=Math.ceil(mn/step)*step; v<=mx; v+=step){
    const y=Y(v);
    ctx.strokeStyle=border; ctx.globalAlpha=.6; ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x0+W,y); ctx.stroke(); ctx.globalAlpha=1;
    ctx.fillStyle=muted; ctx.textAlign='right'; ctx.fillText(String(v),x0-5,y);
  }
  if(settings.guideLines){
    const t=settings.thr; // Linien an den Ampel-Schwellenwerten (gelb/rot)
    [[t.sysY,'--cat-y'],[t.diaY,'--cat-y'],[t.sysR,'--cat-r'],[t.diaR,'--cat-r']].forEach(([v,c])=>{
      if(v>=mn&&v<=mx){ const y=Y(v); ctx.save(); ctx.strokeStyle=cssVar(c); ctx.globalAlpha=.4; ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x0+W,y); ctx.stroke(); ctx.restore(); }
    });
  }
  ctx.fillStyle=muted; ctx.textBaseline='top'; ctx.textAlign='center';
  const ticks=list.length<=1?[list[0]]:[list[0],list[Math.floor((list.length-1)/2)],list.at(-1)];
  ticks.forEach(e=>{ const x=Math.min(Math.max(X(e.ts),x0+16),x0+W-16); ctx.fillText(fmtDate(e.ts),x,y0+H+6); });

  [['sys','--c-sys'],['dia','--c-dia'],['pulse','--c-pulse']].forEach(([k,c])=>{
    const col=cssVar(c); ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=2; ctx.beginPath();
    list.forEach((e,i)=>{ const x=X(e.ts),y=Y(e[k]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); ctx.stroke();
    list.forEach(e=>{ ctx.beginPath(); ctx.arc(X(e.ts),Y(e[k]),2.6,0,7); ctx.fill(); });
  });
  chartGeo={list,X};
}
function renderStats(list){
  const el=$('#stats');
  if(!list.length){ el.innerHTML='<div class="stat" style="grid-column:1/-1"><span class="muted">Keine Daten im gewählten Zeitraum.</span></div>'; return; }
  const avg=k=>Math.round(list.reduce((s,e)=>s+e[k],0)/list.length);
  const mn=k=>Math.min(...list.map(e=>e[k])), mx=k=>Math.max(...list.map(e=>e[k]));
  el.innerHTML=
    `<div class="stat"><span>Messungen</span><b>${list.length}</b></div>`+
    `<div class="stat"><span>Ø Sys/Dia</span><b>${avg('sys')}/${avg('dia')}</b></div>`+
    `<div class="stat"><span>Ø Puls</span><b>${avg('pulse')}</b></div>`+
    `<div class="stat"><span>Sys</span><b>${mn('sys')}–${mx('sys')}</b></div>`+
    `<div class="stat"><span>Dia</span><b>${mn('dia')}–${mx('dia')}</b></div>`;
}
/* Tooltip */
function chartPoint(ev){
  if(!chartGeo) return;
  const r=ev.currentTarget.getBoundingClientRect(), px=ev.clientX-r.left;
  let best=null,bd=Infinity;
  chartGeo.list.forEach(e=>{ const d=Math.abs(chartGeo.X(e.ts)-px); if(d<bd){bd=d;best=e;} });
  if(!best) return;
  const tip=$('#chartTip');
  tip.innerHTML=`<b>${fmtDate(best.ts)} ${fmtTime(best.ts)}</b><br>Sys ${best.sys} · Dia ${best.dia} · Puls ${best.pulse}`;
  tip.style.left=Math.min(Math.max(chartGeo.X(best.ts),60),r.width-60)+'px';
  tip.style.top='30px'; tip.classList.add('show');
  clearTimeout(tip._t); tip._t=setTimeout(()=>tip.classList.remove('show'),2200);
}
$('#chart').addEventListener('pointerdown',chartPoint);

/* ---------- Export / Import ---------- */
function download(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
const csvCell=v=>{ v=String(v); return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
function exportCSV(){
  if(!entries.length){ toast('Noch keine Werte zum Exportieren','notice'); return; }
  const rows=[['Datum','Uhrzeit','Systolisch','Diastolisch','Puls','Notiz']];
  entries.slice().sort((a,b)=>new Date(a.ts)-new Date(b.ts))
    .forEach(e=>rows.push([fmtDate(e.ts),fmtTime(e.ts),e.sys,e.dia,e.pulse,(e.note||'').replace(/\r?\n/g,' ')]));
  const csv='﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
  download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`blutdruck-${todayStr()}.csv`);
  toast('CSV exportiert');
}
// Backup-Datei: Inhalt bleibt JSON (JSON.stringify), aber Endung .txt und Typ text/plain –
// einheitlich für alle Backup-Wege und nötig fürs Teilen auf Android (Chrome lehnt .json beim
// share() ab). Wiederherstellen liest per JSON.parse, die Datei-Endung spielt dabei keine Rolle.
function backupName(){ return `blutdruck-backup-${stampDateTime()}.txt`; }
function backupBlob(){ return new Blob([JSON.stringify(entries,null,2)],{type:'text/plain'}); }
function exportJSON(){
  if(!entries.length){ toast('Noch keine Werte zum Sichern','notice'); return; }
  download(backupBlob(),backupName());
  markBackedUp();
  toast('Backup gespeichert');
}

/* Backup über das native Teilen-Menü weitergeben (Cloud/Mail/Messenger); Fallback: Download. */
async function shareBackup(){
  if(!entries.length){ toast('Noch keine Werte zum Sichern','notice'); return; }
  // backupName()/backupBlob() liefern bereits .txt / text/plain (siehe oben).
  const file=new File([backupBlob()],backupName(),{type:'text/plain'});
  if(!(navigator.canShare && navigator.canShare({files:[file]}))){  // Teilen nicht möglich → Download
    $('#menuDlg').close(); exportJSON(); return;
  }
  // Diagnose-Werte GENAU vor dem Teilen festhalten (für die Fehlersuche am Handy):
  // War die frische Tipp-Erlaubnis (Nutzer-Aktivierung) aktiv? Läuft die App als installierte
  // PWA oder als Browser-Tab? Welcher Browser? (z. B. Samsung Internet teilt Dateien oft nicht.)
  const ua=navigator.userActivation;
  const act=ua?('act='+ua.isActive+'/'+ua.hasBeenActive):'act=?';
  const mode=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)?'PWA':'Tab';
  const m=/SamsungBrowser\/[\d.]+|Edg\/\d+|Chrome\/\d+|Firefox\/\d+/.exec(navigator.userAgent||'');
  const brand=m?m[0]:'Browser?';
  try{
    // Menü NICHT vor dem Teilen schließen: sonst geht auf Android die frische Tipp-Erlaubnis
    // (transiente Nutzer-Aktivierung) verloren und das Teilen wird blockiert. Erst danach schließen.
    await navigator.share({files:[file]});   // ohne title – manche Ziele lehnen die Kombi sonst ab
    markBackedUp(); toast('Backup geteilt'); $('#menuDlg').close();
  }catch(e){
    if(e&&e.name==='AbortError') return;      // Nutzer hat das Teilen abgebrochen – Menü offen lassen
    $('#menuDlg').close();
    // Teilen ging nicht – freundlich erklären und den Nutzer entscheiden lassen, ob stattdessen
    // heruntergeladen wird. Technische Info nachgestellt (zum Vorlesen/Abfotografieren für die Diagnose).
    const err=e?((e.name||'Fehler')+(e.message?': '+e.message:'')):'Unbekannter Fehler';
    const info=err+' · '+act+' · '+mode+' · '+brand;
    if(confirm('Das direkte Teilen hat dein Browser/Handy nicht erlaubt.\n\nStattdessen als Datei speichern (Download)?\n\n(Technische Info: '+info+')')){
      download(backupBlob(),backupName()); markBackedUp(); toast('Backup gespeichert');
    }
  }
}

/* Backup-Datei einmal wählen, danach immer dieselbe Datei (optional automatisch) überschreiben.
   Nur Chromium (Chrome/Edge/Android); sonst per Feature-Detection ausgeblendet. */
const FS_SUPPORTED=typeof window.showSaveFilePicker==='function';
async function chooseBackupFile(){
  if(!FS_SUPPORTED){ toast('Auf diesem Gerät nicht verfügbar','notice'); return; }
  try{
    const handle=await window.showSaveFilePicker({
      suggestedName:'blutdruck-backup.txt',
      types:[{description:'Textdatei',accept:{'text/plain':['.txt']}}]
    });
    await idbSetMeta('backupHandle',handle);
    await writeToHandle(handle);
    toast('Backup-Datei verknüpft');
  }catch(e){ if(e&&e.name!=='AbortError') toast('Verknüpfen fehlgeschlagen','error'); }
}
async function writeToHandle(handle){
  const w=await handle.createWritable();
  await w.write(backupBlob()); await w.close();
  markBackedUp();
}
async function ensurePerm(handle){
  const opt={mode:'readwrite'};
  if(await handle.queryPermission(opt)==='granted') return true;
  return (await handle.requestPermission(opt))==='granted';
}
async function autoBackupIfLinked(){
  if(!FS_SUPPORTED) return;
  try{
    const handle=await idbGetMeta('backupHandle');
    if(!handle || !(await ensurePerm(handle))) return;
    await writeToHandle(handle);
  }catch{}
}
let _abT=0;
function scheduleAutoBackup(){ clearTimeout(_abT); _abT=setTimeout(autoBackupIfLinked,1500); }
function importJSON(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      if(!Array.isArray(data)) throw 0;
      const valid=data.filter(x=>x&&typeof x==='object'&&Number.isFinite(+x.sys)&&Number.isFinite(+x.dia)&&Number.isFinite(+x.pulse)&&x.ts)
        .map(x=>({id:x.id||uid(),ts:new Date(x.ts).toISOString(),sys:+x.sys,dia:+x.dia,pulse:+x.pulse,note:x.note?String(x.note):''}));
      if(!valid.length) throw 0;
      const map=new Map(entries.map(e=>[e.id,e]));
      let added=0, updated=0;
      valid.forEach(e=>{ if(map.has(e.id)) updated++; else added++; map.set(e.id,e); });
      entries=[...map.values()]; saveEntries(); markDirty(); refreshData();
      toast(`Wiederhergestellt: ${added} neu, ${updated} aktualisiert`);
    }catch{ toast('Wiederherstellen fehlgeschlagen: ungültige Datei','error'); }
  };
  r.readAsText(file);
}

/* Alle Messwerte löschen. Die externe Backup-Datei bleibt erhalten und wird NICHT überschrieben:
   Auto-Backup wird abgebrochen und die Verknüpfung gelöst. */
async function clearAllData(){
  if(!confirm('Wirklich ALLE Messwerte löschen? Das lässt sich nicht rückgängig machen.\n\nEine bereits gespeicherte Backup-Datei bleibt erhalten, wird aber nicht mehr automatisch aktualisiert.')) return;
  clearTimeout(_abT);                         // kein Auto-Backup der leeren Liste auslösen
  entries=[];
  try{ localStorage.removeItem(LS_KEY); }catch{}
  try{ if(_db){ await idbWriteAll([]); await idbSetMeta('backupHandle',null); } }catch{}
  markBackedUp(); refreshData();
  $('#menuDlg').close();
  toast('Alle Daten gelöscht');
}
$('#mExportCsv').addEventListener('click',()=>{ $('#menuDlg').close(); exportCSV(); });
$('#mExportJson').addEventListener('click',()=>{ $('#menuDlg').close(); exportJSON(); });
$('#mShare').addEventListener('click',()=>{ shareBackup(); });   // Menü erst nach dem Teilen schließen (Gesten-Schutz)
$('#mLinkFile').addEventListener('click',async ()=>{ await chooseBackupFile(); refreshLinkFileUI(); });
// Nicht unterstützte Optionen sichtbar lassen, aber deaktivieren + kurzen Grund anzeigen
const SHARE_SUPPORTED=!!(navigator.canShare&&(()=>{ try{ return navigator.canShare({files:[new File([''],'x.txt',{type:'text/plain'})]}); }catch{ return false; } })());
function disableMenuItem(btnId,reasonId,text){ const b=$('#'+btnId); if(b) b.disabled=true; const r=$('#'+reasonId); if(r){ r.textContent=text; r.hidden=false; } }
if(!SHARE_SUPPORTED) disableMenuItem('mShare','mShareReason','Dein Browser kann das Teilen nicht.');
if(!FS_SUPPORTED) disableMenuItem('mLinkFile','mLinkFileReason','Auf diesem Gerät nicht verfügbar.');
// Auto-Backup-Datei: Name der verknüpften Datei + Aktionen anzeigen/aktualisieren.
// (Browser geben aus Sicherheitsgründen nur den Dateinamen her – keinen vollständigen Pfad,
//  und können die Datei/den Ordner nicht im Datei-Manager öffnen.)
async function refreshLinkFileUI(){
  const box=$('#linkFileBox'); if(!box) return;
  if(!FS_SUPPORTED){ box.hidden=true; return; }
  try{
    const handle=await idbGetMeta('backupHandle');
    if(handle){ $('#linkFileName').textContent='Verknüpft: '+handle.name; box.hidden=false; }
    else box.hidden=true;
  }catch{ box.hidden=true; }
}
$('#mLinkWrite').addEventListener('click',async ()=>{
  try{
    const handle=await idbGetMeta('backupHandle');
    if(!handle){ refreshLinkFileUI(); return; }
    if(!(await ensurePerm(handle))){ toast('Keine Schreibrechte für die Datei','error'); return; }
    await writeToHandle(handle); toast('Backup gespeichert');
  }catch{ toast('Sichern fehlgeschlagen','error'); }
});
$('#mLinkChange').addEventListener('click',async ()=>{ await chooseBackupFile(); refreshLinkFileUI(); });
$('#mLinkUnlink').addEventListener('click',async ()=>{
  try{ await idbSetMeta('backupHandle',null); }catch{}
  refreshLinkFileUI(); toast('Verknüpfung gelöst','notice');
});
$('#mImport').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',e=>{ if(e.target.files[0]){ $('#menuDlg').close(); importJSON(e.target.files[0]); } e.target.value=''; });
$('#mClearAll').addEventListener('click',clearAllData);
$('#mHelp').addEventListener('click',()=>{ $('#menuDlg').close(); $('#helpDlg').showModal(); });
// Aufklappbare Abschnitte öffnen/schließen
$$('#menuDlg .acc-head[aria-controls]').forEach(h=>h.addEventListener('click',()=>{
  const open=h.getAttribute('aria-expanded')==='true';
  // Immer nur EIN Abschnitt offen: erst alle schließen ...
  $$('#menuDlg .acc-head[aria-controls]').forEach(o=>{
    o.setAttribute('aria-expanded','false');
    $('#'+o.getAttribute('aria-controls')).classList.remove('open');
    o.closest('.acc-sec').classList.remove('open');
  });
  // ... dann nur den geklickten öffnen, falls er vorher zu war (sonst bleibt alles zu)
  if(!open){
    h.setAttribute('aria-expanded','true');
    $('#'+h.getAttribute('aria-controls')).classList.add('open');
    h.closest('.acc-sec').classList.add('open');   // Karten-Optik des offenen Abschnitts
  }
}));
// Speicher-Status: dauerhaft gesichert? wie viel belegt?
async function updateStorageStatus(){
  const el=$('#storageStatus'); if(!el) return;
  try{
    const persisted=(navigator.storage&&navigator.storage.persisted)?await navigator.storage.persisted():false;
    let used='';
    if(navigator.storage&&navigator.storage.estimate){
      const est=await navigator.storage.estimate();
      if(est&&est.usage!=null) used=' · '+(est.usage/1048576).toFixed(1).replace('.',',')+' MB belegt';
    }
    el.textContent=(persisted?'Dauerhaft gesichert':'Nicht dauerhaft gesichert')+used;
    if(!persisted){
      const a=document.createElement('a'); a.href='#'; a.textContent=' Aktivieren';
      a.addEventListener('click',async ev=>{ ev.preventDefault(); await requestPersistence(); updateStorageStatus(); });
      el.appendChild(a);
    }
  }catch{ el.textContent='Speicher-Status nicht verfügbar'; }
}

/* ---------- Backup-Erinnerung ---------- */
const DAY=86400000;
function markDirty(){ if(!settings.firstDirtyAt){ settings.firstDirtyAt=new Date().toISOString(); saveSettings(); } }
function markBackedUp(){ settings.firstDirtyAt=null; settings.snoozeUntil=0; saveSettings(); updateReminder(); }
function reminderDaysDue(){
  const d=+settings.reminderDays||0;
  if(d<=0||!entries.length||!settings.firstDirtyAt) return 0;
  if(Date.now()<(settings.snoozeUntil||0)) return 0;
  const days=Math.floor((Date.now()-new Date(settings.firstDirtyAt).getTime())/DAY);
  return days>=d?days:0;
}
function updateReminder(){
  const days=reminderDaysDue(), el=$('#reminder');
  if(days){
    $('#reminderMsg').textContent=`Seit ${days} ${days===1?'Tag':'Tagen'} ungesicherte Änderungen – jetzt ein Backup speichern?`;
    el.hidden=false;
  } else el.hidden=true;
}
$('#reminderSave').addEventListener('click',()=>exportJSON());
$('#reminderLater').addEventListener('click',()=>{ settings.snoozeUntil=Date.now()+DAY; saveSettings(); updateReminder(); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) updateReminder(); });

/* ---------- Einstellungen / Menü ---------- */
function applyTheme(){ const t=settings.theme; if(t==='auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',t); }
function applyThrUI(){
  const t=settings.thr;
  $('#thrSysY').value=t.sysY; $('#thrDiaY').value=t.diaY;
  $('#thrSysR').value=t.sysR; $('#thrDiaR').value=t.diaR;
}
function updateThrEnabled(){              // Schwellenwerte nur relevant, wenn Ampel oder Diagramm-Linien aktiv
  const on=settings.colorDots||settings.guideLines;
  $('#thrBlock').classList.toggle('is-disabled',!on);
  ['thrSysY','thrDiaY','thrSysR','thrDiaR','thrReset'].forEach(id=>{ $('#'+id).disabled=!on; });
}
function applyThemeSeg(){ $$('#themeSeg .seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.theme===settings.theme)); }
function applySettingsUI(){
  $('#setColor').checked=settings.colorDots;
  $('#setGuide').checked=settings.guideLines;
  $('#setReminderDays').value=settings.reminderDays;
  applyThemeSeg();
  applyThrUI();
  updateThrEnabled();
}
$('#menuBtn').addEventListener('click',()=>{ applySettingsUI(); updateStorageStatus(); refreshLinkFileUI(); $('#menuDlg').showModal(); });
$('#menuClose').addEventListener('click',()=>$('#menuDlg').close());
// Schließen nur, wenn der Klick die Backdrop-Fläche (das Dialog-Element selbst) trifft –
// robust gegen das Neu-Zentrieren beim Auf-/Zuklappen der Abschnitte.
$('#menuDlg').addEventListener('click',e=>{ if(e.target===e.currentTarget) e.currentTarget.close(); });
$('#helpClose').addEventListener('click',()=>$('#helpDlg').close());
$('#helpBack').addEventListener('click',()=>{ $('#helpDlg').close(); $('#menuDlg').showModal(); });   // zurück ins Menü
$('#helpDlg').addEventListener('click',e=>{ if(e.target===e.currentTarget) e.currentTarget.close(); });
$('#setColor').addEventListener('change',e=>{ settings.colorDots=e.target.checked; saveSettings(); updateThrEnabled(); renderTable(); });
$('#setGuide').addEventListener('change',e=>{ settings.guideLines=e.target.checked; saveSettings(); updateThrEnabled(); if(currentTab==='chart') renderChart(); });
$('#setReminderDays').addEventListener('input',e=>{
  let v=parseInt(e.target.value,10); if(!Number.isFinite(v)||v<0) v=0;
  settings.reminderDays=v; saveSettings(); updateReminder();
});
$$('#themeSeg .seg-btn').forEach(b=>b.addEventListener('click',()=>{ settings.theme=b.dataset.theme; saveSettings(); applyTheme(); applyThemeSeg(); if(currentTab==='chart') renderChart(); }));
[['thrSysY','sysY'],['thrDiaY','diaY'],['thrSysR','sysR'],['thrDiaR','diaR']].forEach(([id,key])=>{
  $('#'+id).addEventListener('input',e=>{
    const v=parseInt(e.target.value,10);
    if(Number.isFinite(v)){ settings.thr[key]=v; saveSettings(); renderTable(); } // Echtzeit-Aktualisierung der Tabelle
  });
});
$('#thrReset').addEventListener('click',()=>{ settings.thr={...SET_DEFAULT.thr}; saveSettings(); applyThrUI(); renderTable(); toast('Standardwerte wiederhergestellt','notice'); });

/* ---------- App-Steuerung ---------- */
let currentTab='capture';
function showTab(name){
  currentTab=name;
  $$('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+name));
  $$('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  if(name==='chart') renderChart();
  if(name==='capture') setTimeout(()=>input.focus(),60);
}
$$('.navbtn[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));   // Menü-Button (ohne data-tab) löst keinen Tab-Wechsel aus
function refreshData(){ renderTable(); if(currentTab==='chart') renderChart(); }
function renderAll(){ renderTable(); if(currentTab==='chart') renderChart(); }
window.addEventListener('resize',()=>{ if(currentTab==='chart') renderChart(); });

/* ---------- PWA: Manifest + Icon + Service Worker ---------- */
const SVG_ICON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'+
  '<rect width="512" height="512" rx="104" fill="#2563eb"/>'+
  '<path d="M76 270h82l38-104 58 196 46-128 30 72h86" fill="none" stroke="#ffffff" '+
  'stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function injectPWA(){
  $('#logo').innerHTML=SVG_ICON;   // Header-Logo bleibt scharfes Inline-SVG
  // Manifest + Icons sind jetzt echte Dateien im <head> (manifest.webmanifest, icon-192/512.png),
  // damit Android die App als echte App installiert (WebAPK) statt nur als Chrome-Verknüpfung.
  if('serviceWorker' in navigator)
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

/* ---------- Start ---------- */
async function init(){
  injectPWA(); applyTheme(); applySettingsUI();
  await requestPersistence();          // Speicher dauerhaft anfordern
  await initStorage();                 // Daten aus IndexedDB laden / migrieren
  syncFilterInputs(); setActiveRangeChip(0);
  updatePreview(); renderTable(); updateReminder();
  showTab('capture');
}
init();
