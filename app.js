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
let _toastT;
/* Toast in das gerade offene Fenster (Dialog) rendern, sonst in den Body. Ein modales Fenster
   macht alles AUSSERHALB von sich „unberührbar" (inert); liegt der Toast im Fenster, bleibt er
   sichtbar UND wischbar. (Ersetzt das frühere Popover/Top-Layer-Konstrukt.) */
function toastHost(){ return $$('dialog').find(d=>d.open) || document.body; }
function toast(msg,kind){
  kind=(kind==='error'||kind==='notice')?kind:'success';
  const wrap=$('#toast'), host=toastHost();
  if(wrap.parentElement!==host) host.appendChild(wrap);   // zum offenen Fenster (bzw. Body) holen
  wrap.innerHTML='';
  const card=document.createElement('div'); card.className='toast-card '+kind;
  card.innerHTML=TOAST_ICON[kind];
  const s=document.createElement('span'); s.className='t-msg'; s.textContent=msg; card.appendChild(s);
  wrap.appendChild(card);
  requestAnimationFrame(()=>wrap.classList.add('show'));   // einblenden
  clearTimeout(_toastT); _toastT=setTimeout(hideToast,4000);
  swipeToast(card);
}
function hideToast(){
  clearTimeout(_toastT);
  $('#toast').classList.remove('show');
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

/* Eigene Bestätigen-Rückfrage statt native confirm(): gestaltbar, Hell/Dunkel, mit Symbol.
   Promise löst zu true (bestätigt) bzw. false (Abbrechen/Esc/Klick daneben). Optionen:
   icon ('trash'|'info') + tone ('danger'|'notice'), title, message, confirmLabel, cancelLabel,
   danger (roter Füll-Knopf statt blau), previewHTML (Vorschau-Karte), detailsText (ausklappbar),
   requireCheck (Pflicht-Häkchen; schaltet den Bestätigen-Knopf erst frei). */
const CONFIRM_ICON={
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
};
function askConfirm(opts){
  opts=opts||{};
  const dlg=$('#confirmDlg'), extra=$('#confirmExtra'), ok=$('#confirmOk'), icon=$('#confirmIcon');
  icon.innerHTML=opts.icon?(CONFIRM_ICON[opts.icon]||''):'';
  icon.className='cdlg-ic'+(opts.tone?' tone-'+opts.tone:'');
  icon.hidden=!opts.icon;
  $('#confirmTitle').textContent=opts.title||'Sicher?';
  const msg=$('#confirmMsg');
  if(opts.messageHTML){ msg.innerHTML=opts.messageHTML; msg.hidden=false; }   // messageHTML nur mit App-eigenen Texten (kein Nutzer-Input)
  else { msg.textContent=opts.message||''; msg.hidden=!opts.message; }
  extra.innerHTML='';
  if(opts.previewHTML) extra.insertAdjacentHTML('beforeend','<div class="cdlg-prev">'+opts.previewHTML+'</div>');
  if(opts.detailsText){
    extra.insertAdjacentHTML('beforeend','<details class="cdlg-det"><summary>Technische Details</summary><div class="cdlg-info"></div></details>');
    extra.querySelector('.cdlg-info').textContent=opts.detailsText;
  }
  if(opts.noteText){                                 // Hinweiszeile mit Info-Symbol (z. B. Backup-Notiz)
    extra.insertAdjacentHTML('beforeend','<div class="cdlg-note">'+CONFIRM_ICON.info+'<span></span></div>');
    extra.querySelector('.cdlg-note span').textContent=opts.noteText;
  }
  ok.className=opts.danger?'btn-fill-danger':'btn-fill';
  ok.textContent=opts.confirmLabel||'OK';
  ok.disabled=!!opts.requireCheck;                 // bei Pflicht-Häkchen erst nach dem Ankreuzen aktiv
  if(opts.requireCheck){
    extra.insertAdjacentHTML('beforeend','<label class="cdlg-check"><input type="checkbox"><span></span></label>');
    const chk=extra.querySelector('.cdlg-check input');
    extra.querySelector('.cdlg-check span').textContent=opts.requireCheck;
    chk.addEventListener('change',()=>{ ok.disabled=!chk.checked; });
  }
  $('#confirmCancel').textContent=opts.cancelLabel||'Abbrechen';
  dlg.returnValue='';
  dlg.showModal();
  return new Promise(res=>{
    dlg.addEventListener('close',function h(){       // Aufräumen passiert beim nächsten Aufbau (oben), nicht hier –
      dlg.removeEventListener('close',h);            // sonst könnte ein verzögertes close-Ereignis frischen Inhalt löschen.
      res(dlg.returnValue==='ok');
    });
  });
}

/* ---------- Speicherung ---------- */
const LS_KEY='bp_entries', LS_SET='bp_settings';
const SET_DEFAULT={colorDots:true,guideLines:true,theme:'auto',accent:'ozean',
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
function persistSettings(){
  try{ localStorage.setItem(LS_SET,JSON.stringify(settings)); }catch(e){ quotaToast(e); }   // Spiegel/Fallback
  if(_db) idbSetMeta('settings',settings).catch(()=>{});                                     // robuster Hauptspeicher
}
function saveSettings(){ persistSettings(); scheduleAutoBackup(); }                           // Nutzer-Änderung: auch Auto-Backup-Datei aktualisieren

let entries=[];
let settings=loadSettings();

/* Beim Start: IndexedDB öffnen, Daten laden, ggf. einmalig aus localStorage migrieren. */
async function initStorage(){
  try{
    _db=await openDB();
    // Einstellungen robust laden / einmalig aus localStorage migrieren (gleiches Muster wie entries)
    try{
      const s=await idbGetMeta('settings');
      if(s && typeof s==='object'){
        settings=Object.assign({},SET_DEFAULT,s);
        settings.thr=Object.assign({},SET_DEFAULT.thr,s.thr||{});
        try{ localStorage.setItem(LS_SET,JSON.stringify(settings)); }catch{}   // schnellen Spiegel sofort wiederherstellen (kein Theme-Flash beim nächsten Start)
      }else{
        await idbSetMeta('settings',settings);
      }
    }catch{}
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

/* ---------- Plausibilitäts-Bereiche (nur zur Warnung, blockieren nicht) ---------- */
const RANGES={sys:[70,260],dia:[40,160],pulse:[30,220]};
const inRange=(v,[a,b])=>v!=null&&v>=a&&v<=b;

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
function category(e){            // Gesamt-Ampel: der schlechtere von Sys/Dia (medizinischer Standard)
  const t=settings.thr;
  if(e.sys>=t.sysR||e.dia>=t.diaR) return 'r';
  if(e.sys>=t.sysY||e.dia>=t.diaY) return 'y';
  return 'g';
}
/* Ampel für EINEN Wert (Sys bzw. Dia getrennt) – differenzierter als die Gesamt-Ampel.
   Gibt 'g'/'y'/'r' zurück (bzw. 'n' = neutral, z. B. Puls ohne Schwellenwerte). */
function catVal(v,y,r){ if(v==null||isNaN(v)) return 'n'; if(v>=r) return 'r'; if(v>=y) return 'y'; return 'g'; }
function catValFor(key,v){ const t=settings.thr;
  if(key==='sys') return catVal(v,t.sysY,t.sysR);
  if(key==='dia') return catVal(v,t.diaY,t.diaR);
  return 'n'; }
/* Ampel-Kategorie → CSS-Token bzw. Text (überall geteilt: Dashboard, Verlauf, Detail, Diagramm). */
const CAT_INK ={g:'var(--g-ink)', y:'var(--y-ink)', r:'var(--r-ink)', n:'var(--muted)'};
const CAT_SOFT={g:'var(--g-soft)',y:'var(--y-soft)',r:'var(--r-soft)',n:'var(--surf2)'};
const CAT_BAR ={g:'var(--g-bar)', y:'var(--y-bar)', r:'var(--r-bar)', n:'var(--muted)'};
const CAT_LABEL={g:'Im Ziel', y:'Erhöht', r:'Zu hoch', n:'–'};

/* ---------- Erfassen (geführte Eingabe) ----------
   Ein Feld nach dem anderen (Sys → Dia → Puls) über einen eigenen Ziffernblock: große Vorschauzahl,
   Segment-Kacheln mit Ampel-Rückmeldung (catVal), Fortschrittspunkte, Datum/Uhrzeit- und Notiz-Sheet.
   Speichert über addEntry (neu) bzw. updateEntry (Bearbeiten). Nachbau des Designs – Datenlogik unverändert. */
const CAP_FIELDS=[{seg:'SYS',name:'Systolisch',unit:'mmHg',key:'sys'},
                  {seg:'DIA',name:'Diastolisch',unit:'mmHg',key:'dia'},
                  {seg:'PULS',name:'Puls',unit:'bpm',key:'pulse'}];
/* Rahmenfarbe der „erledigten" Kachel (weiches Ampel-Linien-Pendant zu CAT_SOFT/-BAR). */
const CAT_LINE={g:'color-mix(in srgb,var(--g-bar) 34%,var(--line))',
                y:'color-mix(in srgb,var(--y-bar) 34%,var(--line))',
                r:'color-mix(in srgb,var(--r-bar) 34%,var(--line))', n:'var(--line)'};
const cap={f:['','',''],step:0,editing:false,editId:null,note:'',date:new Date(),returnTab:'dashboard',dtView:{y:0,m:0},saving:false};

const WD_SHORT=['So','Mo','Di','Mi','Do','Fr','Sa'];
const MO_FULL=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const sameDay=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const pad2=n=>String(n).padStart(2,'0');
/* Datum-Chip: „Heute, 09:41" / „Gestern, …" / „Mi, 24. Jun, …" */
function capDateLabel(d){
  const now=new Date(), y=new Date(now); y.setDate(y.getDate()-1);
  let day;
  if(sameDay(d,now)) day='Heute';
  else if(sameDay(d,y)) day='Gestern';
  else day=WD_SHORT[d.getDay()]+', '+d.getDate()+'. '+MO_FULL[d.getMonth()].slice(0,3);
  return day+', '+pad2(d.getHours())+':'+pad2(d.getMinutes());
}
function capSyncDateChip(){ $('#capDateLabel').textContent=capDateLabel(cap.date); }

/* Öffnen. entry gesetzt → Bearbeiten-Modus; sonst neue Messung. returnTab = Ziel beim Schließen/Speichern. */
function startCapture(entry,returnTab){
  cap.returnTab=returnTab||'dashboard'; cap.saving=false; cap.step=0;
  if(entry){
    cap.editing=true; cap.editId=entry.id;
    cap.f=[String(entry.sys),String(entry.dia),String(entry.pulse)];
    cap.note=entry.note||''; cap.date=new Date(entry.ts);
  }else{
    cap.editing=false; cap.editId=null;
    cap.f=['','','']; cap.note=''; cap.date=new Date();
  }
  $('#capTitle').textContent=cap.editing?'Messung bearbeiten':'Neue Messung';
  $('#capSave').hidden=true; $('#capDtSheet').hidden=true; $('#capNoteSheet').hidden=true;
  capSyncDateChip(); capUpdate();
  showTab('capture');
}

/* Alles Sichtbare an den Zustand angleichen (Zahl, Einheit, Fortschritt, Kacheln, Knöpfe, Hinweis). */
function capUpdate(){
  const i=cap.step, raw=cap.f[i], cfg=CAP_FIELDS[i];
  $('#capBig').textContent=raw;
  $('#capUnit').textContent=cfg.name.toUpperCase()+' · '+cfg.unit;
  $$('#capProgress span').forEach(s=>{ const k=+s.dataset.i;
    s.classList.toggle('active',k===i);
    s.classList.toggle('filled',k!==i&&cap.f[k].length>0); });
  $$('#tab-capture .cap-tile').forEach(t=>{
    const k=+t.dataset.i, r=cap.f[k], has=r.length>0, active=k===i, done=has&&!active&&k<2;
    const cat=done?catValFor(CAP_FIELDS[k].key,parseInt(r,10)):null;
    t.classList.toggle('active',active); t.classList.toggle('empty',!has);
    const box=t.querySelector('.cap-tile-box'), seg=t.querySelector('.cap-tile-seg'),
          val=t.querySelector('.cap-tile-val'), pill=t.querySelector('.cap-tile-pill');
    val.textContent=has?r:'––';
    if(done){
      box.style.background=CAT_SOFT[cat]; box.style.borderColor=CAT_LINE[cat];
      seg.style.color=CAT_INK[cat]; val.style.color=CAT_INK[cat];
      pill.innerHTML='<span class="cap-pill" style="background:'+CAT_SOFT[cat]+';color:'+CAT_INK[cat]+'">'
        +'<span class="d" style="background:'+CAT_BAR[cat]+'"></span>'+CAT_LABEL[cat]+'</span>';
    }else{
      box.style.background=''; box.style.borderColor=''; seg.style.color=''; val.style.color=''; pill.innerHTML='';
    }
  });
  $('#capInk').style.left='calc('+i+' * (100% - 16px) / 3 + '+(8*i)+'px)';
  const allFilled=cap.f.every(v=>v.length>0), last=i>=2, next=$('#capNext');
  next.textContent=last?'Speichern':'Weiter';
  next.disabled=last?!allFilled:raw.length===0;
  let hint='';
  for(let k=0;k<3;k++){ const v=cap.f[k]; if(v.length&&!inRange(parseInt(v,10),RANGES[CAP_FIELDS[k].key])){ hint='Ungewöhnlicher Wert – bitte prüfen.'; break; } }
  $('#capHint').textContent=hint;
  $('#capNoteBtn').textContent=cap.note.trim()?'✓ Notiz':'+ Notiz';
}
function capBump(){ const b=$('#capBig'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

function capPressDigit(d){
  const i=cap.step; if(cap.f[i].length>=3) return;
  cap.f[i]+=d;
  if(cap.f[i].length>=3&&i<2) cap.step=i+1;   // nach 3 Ziffern automatisch weiter
  capUpdate(); capBump();
}
function capPressBack(){
  const i=cap.step;
  if(cap.f[i].length){ cap.f[i]=cap.f[i].slice(0,-1); capUpdate(); return; }
  if(i>0){ cap.step=i-1; capUpdate(); }
}
function capGoStep(i){ if(i!==cap.step){ cap.step=i; capUpdate(); } }
function capNext(){
  if(cap.step<2){ if(cap.f[cap.step].length===0) return; cap.step++; capUpdate(); }
  else capSave();
}
function capClose(){ if(!cap.saving) showTab(cap.returnTab); }
function capSave(){
  if(cap.saving) return;
  const sys=parseInt(cap.f[0],10), dia=parseInt(cap.f[1],10), pulse=parseInt(cap.f[2],10);
  if(!Number.isFinite(sys)||!Number.isFinite(dia)||!Number.isFinite(pulse)) return;
  cap.saving=true;
  const note=cap.note.trim();
  if(cap.editing&&cap.editId) updateEntry(cap.editId,{ts:cap.date.toISOString(),sys,dia,pulse,note});
  else addEntry({id:uid(),ts:cap.date.toISOString(),sys,dia,pulse,note});
  $('#capSave').hidden=false;                 // Häkchen-Overlay, dann Zielscreen
  const back=cap.returnTab;
  setTimeout(()=>{ $('#capSave').hidden=true; cap.saving=false; renderAll(); updateReminder(); showTab(back); },780);
}

/* ----- Datum & Uhrzeit (Bottom-Sheet) ----- */
function capOpenDt(){ cap.dtView={y:cap.date.getFullYear(),m:cap.date.getMonth()}; capRenderDt(); $('#capDtSheet').hidden=false; }
function capCloseDt(){ $('#capDtSheet').hidden=true; }
function capSetDtQuick(which){
  const c=cap.date; let d;
  if(which==='jetzt') d=new Date();
  else if(which==='heute'){ d=new Date(); d.setHours(c.getHours(),c.getMinutes(),0,0); }
  else { d=new Date(); d.setDate(d.getDate()-1); d.setHours(c.getHours(),c.getMinutes(),0,0); }
  cap.date=d; cap.dtView={y:d.getFullYear(),m:d.getMonth()}; capRenderDt(); capSyncDateChip();
}
function capDtPrevMonth(){ let {y,m}=cap.dtView; m--; if(m<0){m=11;y--;} cap.dtView={y,m}; capRenderDt(); }
function capDtNextMonth(){ const n=new Date(); let {y,m}=cap.dtView;
  if(y>n.getFullYear()||(y===n.getFullYear()&&m>=n.getMonth())) return;     // nicht in die Zukunft
  m++; if(m>11){m=0;y++;} cap.dtView={y,m}; capRenderDt(); }
function capPickDay(day){ const c=cap.date; cap.date=new Date(cap.dtView.y,cap.dtView.m,day,c.getHours(),c.getMinutes(),0,0); capRenderDt(); capSyncDateChip(); }
function capStepHour(delta){ const d=new Date(cap.date); d.setHours((cap.date.getHours()+delta+24)%24); cap.date=d; capRenderDt(); capSyncDateChip(); }
function capStepMin(delta){ const d=new Date(cap.date); d.setMinutes((cap.date.getMinutes()+delta+60)%60); cap.date=d; capRenderDt(); capSyncDateChip(); }
function capRenderDt(){
  const e=cap.date, now=new Date(), yest=new Date(now); yest.setDate(yest.getDate()-1);
  const vy=cap.dtView.y, vm=cap.dtView.m;
  const isNow=sameDay(e,now)&&Math.abs(e-now)<60000;
  const q=[['jetzt','Jetzt',isNow],['heute','Heute',sameDay(e,now)&&!isNow],['gestern','Gestern',sameDay(e,yest)]];
  const xIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let html='<div class="cap-sheet-grab"></div>'
    +'<div class="cap-sheet-head"><div class="cap-sheet-title">Datum &amp; Uhrzeit</div>'
    +'<button class="cap-x" data-act="close" type="button" aria-label="Schließen">'+xIcon+'</button></div>'
    +'<div class="cap-dt-quick">'+q.map(([k,l,on])=>'<button type="button" data-act="quick" data-q="'+k+'" class="'+(on?'on':'')+'">'+l+'</button>').join('')+'</div>';
  const canNext=!(vy>now.getFullYear()||(vy===now.getFullYear()&&vm>=now.getMonth()));
  html+='<div class="cap-cal"><div class="cap-cal-head">'
    +'<button class="cap-cal-nav" data-act="prevm" type="button" aria-label="Vorheriger Monat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>'
    +'<div class="cap-cal-title">'+MO_FULL[vm]+' '+vy+'</div>'
    +'<button class="cap-cal-nav" data-act="nextm" type="button" aria-label="Nächster Monat"'+(canNext?'':' disabled')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>'
    +'</div><div class="cap-cal-wd">'+['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>'<span>'+w+'</span>').join('')+'</div>';
  const first=new Date(vy,vm,1), startW=(first.getDay()+6)%7, dim=new Date(vy,vm+1,0).getDate();
  const todayMid=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let cells='';
  for(let b=0;b<startW;b++) cells+='<span></span>';
  for(let day=1;day<=dim;day++){
    const cd=new Date(vy,vm,day), future=cd>todayMid, sel=sameDay(cd,e), today=sameDay(cd,now);
    const cls=[sel?'sel':'',today?'today':'',future?'future':''].filter(Boolean).join(' ');
    cells+=future ? '<button type="button" class="'+cls+'" disabled>'+day+'</button>'
                  : '<button type="button" class="'+cls+'" data-act="day" data-day="'+day+'">'+day+'</button>';
  }
  html+='<div class="cap-cal-grid">'+cells+'</div></div>';
  const up='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
  const dn='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const step=(val,lbl,ua,da)=>'<div class="cap-step"><button type="button" data-act="'+ua+'">'+up+'</button>'
    +'<div class="cap-step-val tnum">'+val+'</div><button type="button" data-act="'+da+'">'+dn+'</button>'
    +'<div class="cap-step-lbl">'+lbl+'</div></div>';
  html+='<div class="cap-time">'+step(pad2(e.getHours()),'STD','hup','hdn')
    +'<div class="cap-time-colon">:</div>'+step(pad2(e.getMinutes()),'MIN','mup','mdn')+'</div>'
    +'<button class="cap-sheet-apply" data-act="close" type="button">Übernehmen</button>';
  $('#capDtPanel').innerHTML=html;
}

/* ----- Notiz (Bottom-Sheet) ----- */
function capOpenNote(){ $('#capNoteTa').value=cap.note; $('#capNoteSheet').hidden=false; setTimeout(()=>$('#capNoteTa').focus(),50); }
function capCloseNote(){ $('#capNoteSheet').hidden=true; }
function capApplyNote(){ cap.note=$('#capNoteTa').value; capCloseNote(); capUpdate(); }

/* ----- Verkabelung ----- */
$('#capKeys').addEventListener('click',ev=>{ const b=ev.target.closest('.cap-key'); if(!b) return;
  const k=b.dataset.k; if(k==='back') capPressBack(); else capPressDigit(k); });
$('#capNext').addEventListener('click',capNext);
$('#capClose').addEventListener('click',capClose);
$('#capDateChip').addEventListener('click',capOpenDt);
$('#capNoteBtn').addEventListener('click',capOpenNote);
$$('#capProgress span').forEach(s=>s.addEventListener('click',()=>capGoStep(+s.dataset.i)));
$$('#tab-capture .cap-tile').forEach(t=>t.addEventListener('click',()=>capGoStep(+t.dataset.i)));
$('#capDtPanel').addEventListener('click',ev=>{ const b=ev.target.closest('[data-act]'); if(!b||b.disabled) return;
  const a=b.dataset.act;
  if(a==='close') capCloseDt();
  else if(a==='quick') capSetDtQuick(b.dataset.q);
  else if(a==='prevm') capDtPrevMonth();
  else if(a==='nextm') capDtNextMonth();
  else if(a==='day') capPickDay(+b.dataset.day);
  else if(a==='hup') capStepHour(1); else if(a==='hdn') capStepHour(-1);
  else if(a==='mup') capStepMin(1); else if(a==='mdn') capStepMin(-1);
});
$('#capDtScrim').addEventListener('click',capCloseDt);
$('#capNoteScrim').addEventListener('click',capCloseNote);
$('#capNoteX').addEventListener('click',capCloseNote);
$('#capNoteApply').addEventListener('click',capApplyNote);
/* Physische Tastatur (Komfort am Desktop + echte Tastatur): nur im Erfassen-Screen aktiv. */
document.addEventListener('keydown',ev=>{
  if(currentTab!=='capture') return;
  const dtOpen=!$('#capDtSheet').hidden, noteOpen=!$('#capNoteSheet').hidden;
  if(dtOpen||noteOpen){ if(ev.key==='Escape'){ capCloseDt(); capCloseNote(); } return; }
  if(ev.key>='0'&&ev.key<='9'){ capPressDigit(ev.key); ev.preventDefault(); }
  else if(ev.key==='Backspace'){ capPressBack(); ev.preventDefault(); }
  else if(ev.key==='Enter'){ if(!$('#capNext').disabled) capNext(); ev.preventDefault(); }
  else if(ev.key==='Escape'){ capClose(); }
});

/* ---------- Tabelle ---------- */
/* ---------- Verlauf (Liste) ----------
   Chronologische Liste (neu, ersetzt die alte Tabelle). Sys und Dia je in ihrer eigenen Ampelfarbe
   (catVal), Zeilenpunkt = der schlechtere von beiden. Zeitraum unten: 7/30/90 Tage + „Zeitraum"
   (Von–Bis-Sheet). Zeile antippen → Detail-Screen. Nutzt die geteilte Filter-Basis (filters → getFiltered). */
let verlaufRange='30';
const RANK={n:0,g:1,y:2,r:3};
const worseCat=(a,b)=>RANK[b]>RANK[a]?b:a;
const IC_CHEV='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const IC_NOTE_SM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14M5 10h14M5 15h8"/></svg>';

/* 7/30/90 → filters.from/to setzen; 'custom' behält die im Zeitraum-Sheet gewählten Werte. */
function applyVerlaufRange(){
  const k=verlaufRange;
  if(k==='7'||k==='30'||k==='90'){ filters.from=new Date(Date.now()-(+k)*864e5).toISOString().slice(0,10); filters.to=''; }
}
function renderTable(){
  applyVerlaufRange();
  const list=getFiltered().slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const rangeLabel={'7':'Letzte 7 Tage','30':'Letzte 30 Tage','90':'Letzte 90 Tage','custom':'Eigener Zeitraum'}[verlaufRange];
  $('#vhSub').textContent=rangeLabel+' · '+list.length+' '+(list.length===1?'Messung':'Messungen');
  $$('#vFilter .vh-pill').forEach(p=>p.classList.toggle('active',p.dataset.r===verlaufRange));
  const vl=$('#vList'), ve=$('#vEmpty');
  if(!list.length){
    vl.innerHTML='';
    ve.innerHTML=!entries.length
      ? 'Noch keine Messung erfasst.<br>Tippe unten auf das <b style="color:var(--accent)">+</b>.'
      : 'Keine Messungen in diesem Zeitraum.';
    ve.hidden=false;
  }else{
    ve.hidden=true;
    let html='';
    list.forEach((e,i)=>{
      const d=new Date(e.ts);
      const dateLabel=WD_SHORT[d.getDay()]+', '+pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.';
      const time=pad2(d.getHours())+':'+pad2(d.getMinutes());
      const sc=catValFor('sys',e.sys), dc=catValFor('dia',e.dia), oc=worseCat(sc,dc);
      const delay=Math.min(i*0.04,0.32);
      html+='<button class="vrow" type="button" data-id="'+e.id+'" style="animation-delay:'+delay+'s">'
        +'<span class="vrow-dot" style="background:'+CAT_BAR[oc]+'"></span>'
        +'<span class="vrow-main"><span class="vrow-date">'+dateLabel+'</span>'
        +'<span class="vrow-sub">'+time+(e.note?IC_NOTE_SM:'')+'</span></span>'
        +'<span class="vrow-v tnum" style="color:'+CAT_INK[sc]+'">'+e.sys+'</span>'
        +'<span class="vrow-v tnum" style="color:'+CAT_INK[dc]+'">'+e.dia+'</span>'
        +'<span class="vrow-p tnum">'+e.pulse+'</span>'
        +'<span class="vrow-chev">'+IC_CHEV+'</span>'
        +'</button>';
    });
    vl.innerHTML=html;
  }
  if(currentTab==='table') requestAnimationFrame(positionVInk);
}
/* Gleitende Markierung unter die aktive Zeitraum-Pille legen (misst deren Position). */
function positionVInk(){
  const bar=$('#vFilter'); if(!bar) return;
  const active=bar.querySelector('.vh-pill.active'), ink=$('#vInk');
  if(!active||!ink) return;
  ink.style.top=active.offsetTop+'px'; ink.style.height=active.offsetHeight+'px';
  ink.style.width=active.offsetWidth+'px'; ink.style.transform='translateX('+active.offsetLeft+'px)';
  ink.style.opacity='1';
}
/* Zeile antippen → Detail. */
$('#vList').addEventListener('click',ev=>{ const b=ev.target.closest('.vrow'); if(b) showDetail(b.dataset.id); });
/* Zeitraum-Pillen. */
$('#vFilter').addEventListener('click',ev=>{
  const b=ev.target.closest('.vh-pill'); if(!b) return;
  if(b.dataset.r==='custom'){ openRangeSheet(); return; }
  verlaufRange=b.dataset.r; renderTable();
});
/* Zeitraum-Sheet (Von–Bis). */
function openRangeSheet(){ $('#rsFrom').value=filters.from||''; $('#rsTo').value=filters.to||''; $('#rangeSheet').hidden=false; }
function closeRangeSheet(){ $('#rangeSheet').hidden=true; }
$('#rangeSheet').addEventListener('click',ev=>{ if(ev.target.closest('[data-act=close]')) closeRangeSheet(); });
$('#rsApply').addEventListener('click',()=>{
  let from=$('#rsFrom').value, to=$('#rsTo').value;
  if(from&&to&&from>to){ const t=from; from=to; to=t; }   // vertauscht → richtig herum
  filters.from=from; filters.to=to; verlaufRange='custom';
  closeRangeSheet(); renderTable();
});
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&!$('#rangeSheet').hidden){ ev.preventDefault(); closeRangeSheet(); } });

/* ----- Zeitraum-Chips (nur noch vom Diagramm genutzt; wird in Stufe 5 vereinheitlicht) ----- */
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
/* ---------- Detail (Einzelmessung) ----------
   Öffnet aus einer Verlauf-Zeile: großer Sys/Dia-Wert in Ampelfarbe, Status-Pille, Puls, volles Datum
   + Tageszeit, „Position im Ampelbereich" (Skala mit Marker), datengetriebener Kontext-Satz, Notiz.
   Aktionen unten: Zurück · Bearbeiten (→ geführte Eingabe im Bearbeiten-Modus) · Löschen (askConfirm). */
let detailId=null;
const IC_CAL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v4M16 3v4"/></svg>';
const IC_SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>';
const IC_MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const IC_NOTE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14M5 10h14M5 15h8"/></svg>';
const TOD_LABEL={morgens:'Morgen','tagsüber':'Tages',abends:'Abend'};
const todOf=h=>h<11?'morgens':h<17?'tagsüber':'abends';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* Kontext-Satz: Vergleich mit dem Schnitt derselben Tageszeit (morgens/tagsüber/abends). */
function detContext(e){
  const tod=todOf(new Date(e.ts).getHours());
  const same=entries.filter(x=>todOf(new Date(x.ts).getHours())===tod);
  const avg=k=>Math.round(same.reduce((a,x)=>a+x[k],0)/same.length);
  const as=avg('sys'), ad=avg('dia'), diff=e.sys-as, lbl=TOD_LABEL[tod];
  let strong;
  if(diff>=8) strong='Deutlich über deinem '+lbl+'-Schnitt';
  else if(diff>=3) strong='Etwas über deinem '+lbl+'-Schnitt';
  else if(diff<=-3) strong='Unter deinem '+lbl+'-Schnitt';
  else strong='Im Bereich deines '+lbl+'-Schnitts';
  return '<b>'+strong+'</b> ('+as+'/'+ad+') der letzten Wochen.';
}

function showDetail(id){ detailId=id; showTab('detail'); }
function renderDetail(id){
  const e=entries.find(x=>x.id===id);
  if(!e){ showTab('table'); return; }
  const sc=catValFor('sys',e.sys), dc=catValFor('dia',e.dia), oc=worseCat(sc,dc);
  const d=new Date(e.ts), tod=todOf(d.getHours());
  const fullDate=d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const time=pad2(d.getHours())+':'+pad2(d.getMinutes()), t=settings.thr;
  const sysPct=clamp((e.sys-90)/80*100,4,96), diaPct=clamp((e.dia-50)/60*100,4,96);
  /* Skala-Verlauf grün/gelb/rot – Umschlagpunkte aus den eingestellten Schwellenwerten. */
  const grad=(dom0,span,y,r)=>{ const yp=clamp((y-dom0)/span*100,0,100), rp=clamp((r-dom0)/span*100,0,100);
    return 'linear-gradient(90deg,var(--g-soft) 0 '+yp+'%,var(--y-soft) '+yp+'% '+rp+'%,var(--r-soft) '+rp+'% 100%)'; };
  const scaleRow=(lab,valTxt,valColor,g,pct,mk)=>
    '<div class="det-scale-row"><div class="det-scale-top">'
    +'<span class="det-scale-lab">'+lab+'</span>'
    +'<span class="det-scale-val tnum" style="color:'+valColor+'">'+valTxt+'</span></div>'
    +'<div class="det-scale-bar" style="background:'+g+'"><span class="det-scale-mk" style="left:'+pct+'%;background:'+mk+'"></span></div></div>';

  let html='<div class="det-hero">'
    +'<span class="det-pill" style="background:'+CAT_SOFT[oc]+';color:'+CAT_INK[oc]+'"><span class="d" style="background:'+CAT_BAR[oc]+'"></span>'+CAT_LABEL[oc]+'</span>'
    +'<div class="det-nums">'
      +'<div class="det-col"><span class="det-num tnum" style="color:'+CAT_INK[sc]+'">'+e.sys+'</span><span class="det-num-l" style="color:'+CAT_INK[sc]+'">SYS</span></div>'
      +'<span class="det-slash">/</span>'
      +'<div class="det-col"><span class="det-num tnum" style="color:'+CAT_INK[dc]+'">'+e.dia+'</span><span class="det-num-l" style="color:'+CAT_INK[dc]+'">DIA</span></div>'
    +'</div>'
    +'<div class="det-meta">mmHg<span class="sep"></span><span class="hb">'+IC_HEART+'<b class="tnum">'+e.pulse+'</b> Puls</span></div>'
  +'</div>';
  html+='<div class="det-card det-date"><div class="det-date-ic">'+IC_CAL+'</div>'
    +'<div class="det-date-main"><div class="det-date-1">'+fullDate+'</div>'
    +'<div class="det-date-2">'+time+'<span class="sep"></span>'+(tod==='abends'?IC_MOON:IC_SUN)+tod+'</div></div></div>';
  html+='<div class="det-card det-scale"><div class="det-scale-h">POSITION IM AMPELBEREICH</div>'
    +scaleRow('Systolisch',e.sys+' · '+CAT_LABEL[sc],CAT_INK[sc],grad(90,80,t.sysY,t.sysR),sysPct,CAT_BAR[sc])
    +scaleRow('Diastolisch',e.dia+' · '+CAT_LABEL[dc],CAT_INK[dc],grad(50,60,t.diaY,t.diaR),diaPct,CAT_BAR[dc])
  +'</div>';
  html+='<div class="det-ctx">'+detContext(e)+'</div>';
  if(e.note) html+='<div class="det-card det-note">'+IC_NOTE+'<div class="det-note-txt">„'+escapeHtml(e.note)+'"</div></div>';
  $('#detBody').innerHTML=html;
}
/* Detail-Aktionen: Zurück / Bearbeiten / Löschen. */
$('#detBack').addEventListener('click',()=>showTab('table'));
$('#detEdit').addEventListener('click',()=>{ const e=entries.find(x=>x.id===detailId); if(e) startCapture(e,'detail'); });
$('#detDelete').addEventListener('click',()=>{
  const e=entries.find(x=>x.id===detailId); if(!e) return;
  const prev='<div class="pd">'+fmtDate(e.ts)+' · '+fmtTime(e.ts)+'</div>'
    +'<div class="pv"><span style="color:'+CAT_INK[catValFor('sys',e.sys)]+'">'+e.sys+'</span> / <span style="color:'+CAT_INK[catValFor('dia',e.dia)]+'">'+e.dia+'</span> · Puls '+e.pulse+'</div>';
  askConfirm({icon:'trash',tone:'danger',danger:true,title:'Eintrag löschen?',message:'Dieser Eintrag wird dauerhaft entfernt.',previewHTML:prev,confirmLabel:'Löschen'})
    .then(ok=>{ if(ok){ removeEntry(detailId); showTab('table'); toast('Eintrag gelöscht'); } });
});

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

/* ---------- Dashboard (Startseite) ----------
   Kennzahlen nach dashboard-spezifikation.md: rollierende Fenster (7/30 Tage), Trend gegen die
   Vorwoche, Ampel-Verteilung über 30 Tage. Rechnet aus den echten Einträgen (ts/sys/dia/pulse). */
const ageDays=ts=>(Date.now()-new Date(ts).getTime())/86400000;          // Alter eines Eintrags in Tagen
function meanKey(list,key){ return list.length?Math.round(list.reduce((s,e)=>s+e[key],0)/list.length):null; }
function relTime(ts){
  const diff=Date.now()-new Date(ts).getTime();
  const min=Math.round(diff/60000);
  if(min<1) return 'gerade eben';
  if(min<60) return 'vor '+min+' Min.';
  const hrs=Math.round(min/60);
  if(hrs<24) return 'vor '+hrs+' Std.';
  const days=Math.round(hrs/24);
  return days===1?'gestern':'vor '+days+' Tagen';
}
function fmtLongDate(d){ return new Date(d).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'}); }
/* Prozente ganzzahlig runden, aber so, dass die Summe exakt 100 % bleibt (größte Reste zuerst). */
function roundTo100(raw){
  const fl=raw.map(v=>Math.floor(v));
  const rem=100-fl.reduce((a,b)=>a+b,0);
  const order=raw.map((v,i)=>[v-Math.floor(v),i]).sort((a,b)=>b[0]-a[0]);
  for(let k=0;k<rem&&k<order.length;k++) fl[order[k][1]]++;
  return fl;
}
/* Trend-Chip: neutraler Pfeil (rauf/runter/gleich) + Betrag. Bewusst KEINE Wertung gut/schlecht –
   die Farbe trägt die Gesamt-Ampel (siehe Datenspezifikation). '—' wenn kein Vergleich möglich. */
function trendChip(diff){
  if(diff==null) return '<span class="dtrend">—</span>';
  const a=Math.abs(diff);
  const d=diff<0?'M12 5v13M18 12l-6 6-6-6':diff>0?'M12 19V6M6 12l6-6 6 6':'M5 12h14';
  return '<span class="dtrend"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>'+a+'</span>';
}
function legRow(color,name,count,pct){
  return '<div class="dleg-row"><span class="dleg-sq" style="background:'+color+'"></span>'
    +'<span class="dleg-name">'+name+'</span>'
    +'<span class="dleg-val"><b>'+count+'</b> · '+pct+'%</span></div>';
}
const IC_GAUGE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 18a8 8 0 1 1 15 0"/><path d="M12 18l3.6-4.6"/><circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>';
const IC_ACT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4.5l2-6 3.5 12 2.5-8 1.6 2H22"/></svg>';
const IC_HEART='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.3l-1.4-1.3C5.4 14.2 2 11.1 2 7.6 2 5 4 3 6.5 3c1.7 0 3.3 1 4.1 2.4h.8C12.2 4 13.8 3 15.5 3 18 3 20 5 20 7.6c0 3.5-3.4 6.6-8.6 11.4L12 20.3z"/></svg>';
const IC_DIST='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="2" width="8" height="20" rx="4"/><circle cx="12" cy="7.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="16.5" r="1.6" fill="currentColor" stroke="none"/></svg>';

function renderDashboard(){
  const host=$('#dashboard'); if(!host) return;
  const de=$('#dashDate'); if(de) de.textContent=fmtLongDate(new Date());
  if(!entries.length){
    host.innerHTML='<div class="dcard" style="padding:22px 18px;text-align:center">'
      +'<div style="font-size:15px;font-weight:800;margin-bottom:6px">Noch keine Messung erfasst.</div>'
      +'<div style="font-size:13px;color:var(--muted);line-height:1.5">Tippe unten auf das <b style="color:var(--accent)">+</b>, um deine erste Messung einzutragen.</div>'
      +'</div>';
    return;
  }
  const sorted=entries.slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const last=sorted[0];
  const lc=category(last), sc=catValFor('sys',last.sys), dc=catValFor('dia',last.dia);

  const cur=entries.filter(e=>ageDays(e.ts)<=7);                          // letzte 7 Tage
  const prev=entries.filter(e=>{const a=ageDays(e.ts);return a>7&&a<=14;}); // die 7 Tage davor
  const trend=(k)=>{ const a=meanKey(cur,k),b=meanKey(prev,k); return (a==null||b==null)?null:a-b; };
  const sys7=meanKey(cur,'sys'), dia7=meanKey(cur,'dia'), pul7=meanKey(cur,'pulse');
  const na='<span class="dtile-num" style="color:var(--muted)">–</span>';

  const cur30=entries.filter(e=>ageDays(e.ts)<=30);                       // letzte 30 Tage
  let g=0,y=0,r=0; cur30.forEach(e=>{const c=category(e); if(c==='r')r++;else if(c==='y')y++;else g++;});
  const total=cur30.length;

  let html='';
  // Hero: Letzte Messung – Sys/Dia je in ihrer eigenen Ampelfarbe, dazu die Gesamt-Ampel als Pille
  html+='<div class="dcard dcard-pad">'
    +'<div class="dhero-top">'
      +'<div class="dhead-l"><span class="dicon">'+IC_GAUGE+'</span>'
        +'<div><div class="dhead-t1">Letzte Messung</div><div class="dhead-t2">'+relTime(last.ts)+'</div></div></div>'
      +'<span class="dpill" style="background:'+CAT_SOFT[lc]+';color:'+CAT_INK[lc]+'"><span class="ddot" style="background:'+CAT_BAR[lc]+'"></span>'+CAT_LABEL[lc]+'</span>'
    +'</div>'
    +'<div class="dhero-nums">'
      +'<div style="display:flex;align-items:flex-end;gap:3px">'
        +'<div class="dbig"><span class="n" style="color:'+CAT_INK[sc]+'">'+last.sys+'</span><span class="l" style="color:'+CAT_INK[sc]+'">SYS</span></div>'
        +'<span class="dslash">/</span>'
        +'<div class="dbig"><span class="n" style="color:'+CAT_INK[dc]+'">'+last.dia+'</span><span class="l" style="color:'+CAT_INK[dc]+'">DIA</span></div>'
      +'</div>'
      +'<div class="dhero-side"><div class="u">mmHg</div><div class="p">Puls '+last.pulse+'</div></div>'
    +'</div>'
  +'</div>';

  // Kacheln: Ø Blutdruck (7 Tage) mit Trend + Ø Puls (7 Tage) mit Trend
  html+='<div class="dtiles">'
    +'<div class="dtile wide">'
      +'<div class="dhead-l"><span class="dicon">'+IC_ACT+'</span><div><div class="dhead-t1">Blutdruck</div><div class="dhead-t2">Ø 7 Tage · mmHg</div></div></div>'
      +'<div class="dtile-avgs">'
        +'<div class="dtile-col"><div class="dtile-cell">'+(sys7!=null?'<span class="dtile-num">'+sys7+'</span>':na)+'<span class="dtile-lbl">SYS</span></div>'+trendChip(trend('sys'))+'</div>'
        +'<div class="dtile-div"></div>'
        +'<div class="dtile-col"><div class="dtile-cell">'+(dia7!=null?'<span class="dtile-num">'+dia7+'</span>':na)+'<span class="dtile-lbl">DIA</span></div>'+trendChip(trend('dia'))+'</div>'
      +'</div>'
      +'<div class="dtile-foot">vs. Vorwoche</div>'
    +'</div>'
    +'<div class="dtile" style="text-align:center">'
      +'<div class="dhead-l" style="justify-content:center"><span class="dicon pulse">'+IC_HEART+'</span><div class="dhead-t1">Puls</div></div>'
      +'<div class="dtile-pulse"><div class="dtile-cell">'+(pul7!=null?'<span class="dtile-num">'+pul7+'</span>':na)+'<span class="dtile-lbl">BPM</span></div>'+trendChip(trend('pulse'))+'</div>'
      +'<div class="dtile-foot">vs. Vorwoche</div>'
    +'</div>'
  +'</div>';

  // Ampel-Verteilung (30 Tage) als Ring + Legende
  html+='<div class="dcard dcard-pad">'
    +'<div class="dhero-top" style="margin-bottom:12px">'
      +'<div class="dhead-l"><span class="dicon">'+IC_DIST+'</span><div><div class="dhead-t1">Ampel-Verteilung</div><div class="dhead-t2">Letzte 30 Tage</div></div></div>'
      +'<span style="font-size:10.5px;font-weight:700;color:var(--muted)">'+total+' '+(total===1?'Messung':'Messungen')+'</span>'
    +'</div>';
  if(!total){
    html+='<div style="font-size:13px;color:var(--muted);padding:2px 2px 4px">Noch keine Daten in den letzten 30 Tagen.</div>';
  }else{
    const p=roundTo100([g/total*100,y/total*100,r/total*100]), pg=p[0],py=p[1],pr=p[2];
    const seg='conic-gradient(var(--g-bar) 0 '+pg+'%,var(--y-bar) '+pg+'% '+(pg+py)+'%,var(--r-bar) '+(pg+py)+'% 100%)';
    html+='<div class="ddist-body">'
      +'<div class="ring" style="background:'+seg+'"><div class="ring-c"><span class="ring-pct" style="color:var(--g-ink)">'+pg+'%</span><span class="ring-lbl">im Ziel</span></div></div>'
      +'<div class="dleg">'+legRow('var(--g-bar)','Im Ziel',g,pg)+legRow('var(--y-bar)','Erhöht',y,py)+legRow('var(--r-bar)','Zu hoch',r,pr)+'</div>'
    +'</div>';
  }
  html+='</div>';
  host.innerHTML=html;
}

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
const BACKUP_VER=2;
/* Nur die „Vorlieben" sichern – geräte-interne Erinnerungs-Merker (firstDirtyAt/snoozeUntil) bleiben außen vor. */
function backupSettings(){ const {colorDots,guideLines,theme,accent,reminderDays,thr}=settings; return {colorDots,guideLines,theme,accent,reminderDays,thr}; }
function backupData(){ return {app:'blutdruck',version:BACKUP_VER,exportedAt:new Date().toISOString(),entries,settings:backupSettings()}; }
function backupBlob(){ return new Blob([JSON.stringify(backupData(),null,2)],{type:'text/plain'}); }
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
    const wantSave=await askConfirm({
      icon:'info',tone:'notice',title:'Teilen nicht möglich',
      message:'Das direkte Teilen hat dein Browser oder Handy nicht erlaubt. Stattdessen als Datei speichern?',
      detailsText:info,confirmLabel:'Speichern'
    });
    if(wantSave){ download(backupBlob(),backupName()); markBackedUp(); toast('Backup gespeichert'); }
  }
}

/* Auto-Backup-Datei: einmal anlegen/wählen, danach immer dieselbe Datei automatisch überschreiben.
   Nur Chromium (Chrome/Edge/Android); sonst ausgegraut. Beide System-Dialoge nötig:
   Speichern (neu anlegen) UND Öffnen (bestehende wählen). */
const FS_SUPPORTED=typeof window.showSaveFilePicker==='function'&&typeof window.showOpenFilePicker==='function';

/* „Neue Datei anlegen": Speichern-Dialog ist hier korrekt (man legt bewusst neu an).
   Datei anlegen, sofort verknüpfen und den aktuellen Stand hineinschreiben. */
async function createBackupFile(){
  if(!FS_SUPPORTED){ toast('Auf diesem Gerät nicht verfügbar','notice'); return; }
  try{
    const handle=await window.showSaveFilePicker({
      suggestedName:'blutdruck-backup.txt',
      types:[{description:'Textdatei',accept:{'text/plain':['.txt']}}]
    });
    await idbSetMeta('backupHandle',handle);
    await writeToHandle(handle);
    await refreshLinkFileUI();
    toast('Backup-Datei angelegt & verknüpft');
  }catch(e){ if(e&&e.name!=='AbortError') toast('Anlegen fehlgeschlagen','error'); }
}
/* „Bestehende wählen"/„Datei ändern": Öffnen-Dialog (kein Vorschlagsname, keine „Ersetzen?"-Frage).
   Datensicher: erst Datei-Inhalt einlesen und mit den App-Daten ZUSAMMENFÜHREN (damit eine reichere
   Datei nichts verliert), dann verknüpfen und den vereinigten Stand zurückschreiben. */
async function pickBackupFile(){
  if(!FS_SUPPORTED){ toast('Auf diesem Gerät nicht verfügbar','notice'); return; }
  try{
    const [handle]=await window.showOpenFilePicker({
      types:[{description:'Backup-Datei',accept:{'text/plain':['.txt'],'application/json':['.json']}}],
      multiple:false
    });
    if(!(await ensurePerm(handle))){ toast('Keine Schreibrechte für die Datei','error'); return; }
    let merged=null;
    try{ merged=mergeEntriesFromData(JSON.parse(await (await handle.getFile()).text())); }catch{}
    await idbSetMeta('backupHandle',handle);
    await writeToHandle(handle);
    await refreshLinkFileUI();
    toast(merged&&merged.added ? 'Verknüpft · '+merged.added+' neu übernommen' : 'Backup-Datei verknüpft');
    if(merged) offerSettingsRestore(merged.settings);
  }catch(e){ if(e&&e.name!=='AbortError') toast('Verknüpfen fehlgeschlagen','error'); }
}
/* Verknüpfung lösen: die Datei selbst bleibt unangetastet, nur das Handle wird vergessen. */
async function unlinkBackupFile(){
  try{ await idbSetMeta('backupHandle',null); }catch{}
  await refreshLinkFileUI();
  toast('Verknüpfung gelöst','notice');
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
/* Merge-Kern, geteilt von „Backup wiederherstellen" und „Bestehende Datei wählen": vereinigt die
   übergebenen Daten mit den vorhandenen Einträgen (nach id). Gibt {added,updated} zurück oder null,
   wenn nichts Gültiges drinsteckt. */
function mergeEntriesFromData(data){
  const arr=Array.isArray(data)?data:(data&&Array.isArray(data.entries)?data.entries:null);   // altes Array ODER neues Objekt {entries,settings}
  if(!arr) return null;
  const valid=arr.filter(x=>x&&typeof x==='object'&&Number.isFinite(+x.sys)&&Number.isFinite(+x.dia)&&Number.isFinite(+x.pulse)&&x.ts)
    .map(x=>({id:x.id||uid(),ts:new Date(x.ts).toISOString(),sys:+x.sys,dia:+x.dia,pulse:+x.pulse,note:x.note?String(x.note):''}));
  if(!valid.length) return null;
  const map=new Map(entries.map(e=>[e.id,e]));
  let added=0, updated=0;
  valid.forEach(e=>{ if(map.has(e.id)) updated++; else added++; map.set(e.id,e); });
  entries=[...map.values()]; saveEntries(); markDirty(); refreshData();
  return {added,updated,settings:(!Array.isArray(data)&&data&&data.settings)||null};
}
/* Im Backup enthaltene Einstellungen auf Wunsch übernehmen (geteilt von „Wiederherstellen" und „Auswählen"/„Ändern"). */
let _pendingRestoreSettings=null;
function offerSettingsRestore(s){
  if(!s || typeof s!=='object') return;
  _pendingRestoreSettings=s;
  $('#restoreDlg').showModal();          // eigenes Fenster statt Browser-confirm (sprechende Knopf-Texte)
}
function applyBackupSettings(s){
  ['colorDots','guideLines','theme','accent','reminderDays','thr'].forEach(k=>{ if(s[k]!==undefined) settings[k]=s[k]; });
  settings.thr=Object.assign({},SET_DEFAULT.thr,settings.thr||{});
  saveSettings(); applyTheme(); applySettingsUI(); renderTable();
  if(currentTab==='chart') renderChart();
  toast('Einstellungen übernommen');
}
function importJSON(file){
  const r=new FileReader();
  r.onload=()=>{
    let res=null;
    try{ res=mergeEntriesFromData(JSON.parse(r.result)); }catch{}
    if(res){ toast(`Wiederhergestellt: ${res.added} neu, ${res.updated} aktualisiert`); offerSettingsRestore(res.settings); }
    else toast('Wiederherstellen fehlgeschlagen: ungültige Datei','error');
  };
  r.readAsText(file);
}

/* Alle Messwerte löschen. Die externe Backup-Datei bleibt erhalten und wird NICHT überschrieben:
   Auto-Backup wird abgebrochen und die Verknüpfung gelöst. */
async function clearAllData(){
  const n=entries.length;
  const ok=await askConfirm({
    icon:'trash',tone:'danger',danger:true,title:'Alle Daten löschen?',
    messageHTML:'Alle <b>'+n+' Messwerte</b> werden dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.',
    noteText:'Eine bereits gespeicherte Backup-Datei bleibt erhalten, wird aber nicht mehr automatisch aktualisiert.',
    requireCheck:'Ja, ich möchte alle '+n+' Werte löschen',confirmLabel:'Alle löschen'
  });
  if(!ok) return;
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
// Nicht unterstützte Optionen sichtbar lassen, aber deaktivieren + kurzen Grund anzeigen
const SHARE_SUPPORTED=!!(navigator.canShare&&(()=>{ try{ return navigator.canShare({files:[new File([''],'x.txt',{type:'text/plain'})]}); }catch{ return false; } })());
function disableMenuItem(btnId,reasonId,text){ const b=$('#'+btnId); if(b) b.disabled=true; const r=$('#'+reasonId); if(r){ r.textContent=text; r.hidden=false; } }
if(!SHARE_SUPPORTED) disableMenuItem('mShare','mShareReason','Dein Browser kann das Teilen nicht.');
// Auto-Backup-Datei: Name der verknüpften Datei + Aktionen anzeigen/aktualisieren.
// (Browser geben aus Sicherheitsgründen nur den Dateinamen her – keinen vollständigen Pfad,
//  und können die Datei/den Ordner nicht im Datei-Manager öffnen.)
/* Auto-Backup-Bereich auffrischen: Zustandstext (rot/grün) + die zwei Knöpfe (Text & Aktion) je
   nachdem, ob eine Datei verknüpft ist. Bei nicht unterstütztem Browser ausgegraut mit Grund. */
async function refreshLinkFileUI(){
  const box=$('#linkFileBox'), name=$('#linkFileName'), b1=$('#lfBtn1'), b2=$('#lfBtn2');
  if(!box) return;
  if(!FS_SUPPORTED){                        // Browser kann keine Datei-Verknüpfung → ausgrauen + Grund
    box.style.opacity='.5'; b1.disabled=b2.disabled=true;
    name.textContent='Auf diesem Gerät nicht verfügbar'; name.className='reason';
    b1.textContent='Neu anlegen'; b2.textContent='Auswählen';
    return;
  }
  box.style.opacity=''; b1.disabled=b2.disabled=false;
  let handle=null; try{ handle=await idbGetMeta('backupHandle'); }catch{}
  if(handle){                               // verknüpft → grün; links „Lösen", rechts „Ändern"
    name.textContent='Verknüpft: '+handle.name; name.className='reason is-linked';
    b1.textContent='Lösen';   b1.onclick=unlinkBackupFile;
    b2.textContent='Ändern';  b2.onclick=pickBackupFile;
  }else{                                    // nicht verknüpft → rot; links „Neu anlegen", rechts „Auswählen"
    name.textContent='Keine Datei verknüpft'; name.className='reason is-unlinked';
    b1.textContent='Neu anlegen'; b1.onclick=createBackupFile;
    b2.textContent='Auswählen';   b2.onclick=pickBackupFile;
  }
}
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
// Belegter Speicher als reine Info – mit Kapazität und Prozent, sofern der Browser eine Quota
// liefert. Der frühere Persistenz-Status („Dauerhaft gesichert?" + „Aktivieren"-Link) entfällt:
// dauerhaften Speicher fordert die App ohnehin beim Start automatisch an (requestPersistence in
// init), und die Backups sichern zusätzlich ab.
const fmtBytes=b=>{ const mb=b/1048576; return (mb>=1024?(mb/1024).toFixed(1)+' GB':mb.toFixed(1)+' MB').replace('.',','); };
async function updateStorageStatus(){
  const el=$('#storageStatus'); if(!el) return;
  try{
    const est=(navigator.storage&&navigator.storage.estimate)?await navigator.storage.estimate():null;
    if(est&&est.usage!=null){
      let t=fmtBytes(est.usage)+' belegt';
      if(est.quota){                       // Kapazität bekannt → „belegt von Kapazität · Prozent"
        const pct=est.usage/est.quota*100, pctStr=pct<0.1?'<0,1':pct.toFixed(1).replace('.',',');
        t=fmtBytes(est.usage)+' von '+fmtBytes(est.quota)+' belegt · '+pctStr+' %';
      }
      el.textContent=t; el.hidden=false;
    } else el.hidden=true;
  }catch{ el.hidden=true; }
}

/* ---------- Backup-Erinnerung ---------- */
const DAY=86400000;
function markDirty(){ if(!settings.firstDirtyAt){ settings.firstDirtyAt=new Date().toISOString(); persistSettings(); } }
function markBackedUp(){ settings.firstDirtyAt=null; settings.snoozeUntil=0; persistSettings(); updateReminder(); }   // persistSettings statt saveSettings: kein erneutes Auto-Backup (sonst Endlosschleife)
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
$('#reminderLater').addEventListener('click',()=>{ settings.snoozeUntil=Date.now()+DAY; persistSettings(); updateReminder(); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) updateReminder(); });

/* ---------- Einstellungen / Menü ---------- */
/* Akzentfarben: je 5 kuratierte Töne mit eigenem Hell-/Dunkel-Wert (bewusst kühler Blau–
   Violett–Cyan-Bogen + Neutral, damit sie sich klar von Ampel und Puls abheben). */
const ACCENT_SETS={
  ozean:{light:'#2b6cf0',dark:'#5b8cf5'},
  indigo:{light:'#4f46e5',dark:'#7c84f5'},
  violett:{light:'#7c3aed',dark:'#9670f0'},
  petrol:{light:'#0e83a6',dark:'#26a7c9'},
  graphit:{light:'#4a5566',dark:'#7e8a9e'}
};
/* Effektiver Hell/Dunkel-Zustand: „dark"/„light" fest, sonst der Systemwunsch. */
function resolveDark(){
  const t=settings.theme;
  if(t==='dark') return true;
  if(t==='light') return false;
  return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}
/* --accent hängt von Akzentwahl UND Hell/Dunkel ab → per JS auf :root setzen. Die ganze App
   folgt automatisch, da alles über var(--accent) läuft (Alias --primary → --accent). */
function applyAccent(){
  const set=ACCENT_SETS[settings.accent]||ACCENT_SETS.ozean;
  document.documentElement.style.setProperty('--accent', set[resolveDark()?'dark':'light']);
}
function applyTheme(){
  const t=settings.theme;
  if(t==='auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme',t);
  applyAccent();
}
/* Im Auto-Modus dem Systemwechsel folgen: die Struktur-/Ampelfarben schaltet CSS selbst um,
   nur der modus-abhängige Akzentwert muss nachgezogen werden. */
if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ if(settings.theme==='auto') applyAccent(); });
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
// Wiederherstellen-Rückfrage: oben Werte+Einstellungen, unten nur Werte. Raustippen/Esc = nur Werte.
$('#restoreWith').addEventListener('click',()=>{ $('#restoreDlg').close(); const s=_pendingRestoreSettings; _pendingRestoreSettings=null; if(s) applyBackupSettings(s); });
$('#restoreOnly').addEventListener('click',()=>{ _pendingRestoreSettings=null; $('#restoreDlg').close(); });
$('#restoreDlg').addEventListener('cancel',()=>{ _pendingRestoreSettings=null; });
$('#restoreDlg').addEventListener('click',e=>{ if(e.target===e.currentTarget){ _pendingRestoreSettings=null; e.currentTarget.close(); } });
// Bestätigen-Rückfrage (#confirmDlg): OK setzt returnValue='ok', alles andere (Abbrechen/Esc/daneben) = Abbruch.
$('#confirmOk').addEventListener('click',()=>{ const d=$('#confirmDlg'); d.returnValue='ok'; d.close(); });
$('#confirmCancel').addEventListener('click',()=>{ const d=$('#confirmDlg'); d.returnValue=''; d.close(); });
$('#confirmDlg').addEventListener('click',e=>{ if(e.target===e.currentTarget) e.currentTarget.close(); });
// Toast nicht im gerade geschlossenen Fenster „einsperren": zurück in den Body holen, damit eine
// noch sichtbare Meldung nahtlos unten stehen bleibt (z. B. „Backup geteilt" vor dem Schließen).
$$('dialog').forEach(d=>d.addEventListener('close',()=>{ const w=$('#toast'); if(w.parentElement===d) document.body.appendChild(w); }));
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
let currentTab='dashboard';
function showTab(name){
  currentTab=name;
  $$('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+name));
  $$('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  // Screens mit eigenem Kopf (kein „Blutdruck"-Header): Dashboard, Erfassen, Verlauf, Detail
  const hdr=$('header.app'); if(hdr) hdr.hidden=['dashboard','capture','table','detail'].includes(name);
  // Vollbild ohne Tab-Bar (eigene Fußzeile): Erfassen + Detail
  const nav=$('nav.bottom'); if(nav) nav.style.display=(name==='capture'||name==='detail')?'none':'';
  if(name==='dashboard') renderDashboard();
  if(name==='table') renderTable();
  if(name==='detail') renderDetail(detailId);
  if(name==='chart') renderChart();
}
$$('.navbtn[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));   // Menü-Button (ohne data-tab) löst keinen Tab-Wechsel aus
$('#fabCapture').addEventListener('click',()=>startCapture());                                 // zentraler +-Knopf → neue Messung
function refreshData(){ renderTable(); if(currentTab==='chart') renderChart(); if(currentTab==='dashboard') renderDashboard(); if(currentTab==='detail') renderDetail(detailId); }
function renderAll(){ renderTable(); if(currentTab==='chart') renderChart(); if(currentTab==='dashboard') renderDashboard(); if(currentTab==='detail') renderDetail(detailId); }
/* Höhe der Tab-Bar messen → CSS-Variable --navh (der Verlauf-Screen lässt genau diesen Platz unten frei). */
function setNavH(){ const n=$('nav.bottom'); if(n&&n.offsetHeight) document.documentElement.style.setProperty('--navh',n.offsetHeight+'px'); }
window.addEventListener('load',setNavH);
window.addEventListener('resize',()=>{ setNavH(); if(currentTab==='chart') renderChart(); if(currentTab==='table') positionVInk(); });

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
  applyTheme(); applySettingsUI();     // aus IndexedDB geladene Einstellungen nachziehen (falls localStorage leer war)
  syncFilterInputs(); setActiveRangeChip(0);
  updateReminder(); setNavH();
  showTab('dashboard');   // Verlauf rendert beim ersten Öffnen (showTab → renderTable)

}
init();
