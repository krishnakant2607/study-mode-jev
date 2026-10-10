import {reasonLabel, type Stats, type Decision, type PublicState, type Settings, type Video} from './core';
import {extractCard, findCards} from './detector';
import {installed, rpc} from './client';
type Tracked = {video: Video; signature: string; epoch: number; queued: boolean; overlay?: HTMLElement};
let settings: Settings | undefined;
let enabled = false;
let epoch = 0;
let active = 0;
let scanning = false;
let scheduled: ReturnType<typeof setTimeout> | undefined;
const tracked = new Map<Element, Tracked>();
const queue: Element[] = [];
const decisions = new Map<string, Decision>();
const isDemo = location.pathname.endsWith('/demo.html') && location.hostname !== 'www.youtube.com';

const send = rpc;
function cover(card: Element, label: string, reason = 'pending') {
  card.classList.add('study-covered');
  card.setAttribute('data-study-reason', reason);
  const row = tracked.get(card);
  let overlay = row?.overlay || card.querySelector<HTMLElement>(':scope > .study-cover');
  if (!overlay) {
    overlay = document.createElement('div'); overlay.className = 'study-cover';
    overlay.innerHTML = '<span class="study-cover-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 6h5v12H5zm9 0h5v12h-5z" fill="currentColor"/></svg></span><strong></strong><span class="study-cover-sub"></span>';
    card.append(overlay);
    if (row) row.overlay = overlay;
  }
  overlay.querySelector('strong')!.textContent = label;
  overlay.querySelector('.study-cover-sub')!.textContent = reason === 'pending' ? 'FocusMaxx checks your preferences' : 'FocusMaxx keeps distractions out';
  // Hide the original from keyboard navigation and accessibility, not just pixels.
  for (const child of [...card.children]) if (child !== overlay) {
    if (!child.hasAttribute('data-study-original-inert')) child.setAttribute('data-study-original-inert', child.hasAttribute('inert') ? '1' : '0');
    child.setAttribute('inert','');
  }
}
function reveal(card: Element) {
  card.classList.remove('study-covered'); card.removeAttribute('data-study-reason');
  card.querySelector(':scope > .study-cover')?.remove();
  const row = tracked.get(card); if (row) row.overlay = undefined;
  for (const child of [...card.children]) {
    const previous = child.getAttribute('data-study-original-inert');
    if (previous === '0') child.removeAttribute('inert');
    child.removeAttribute('data-study-original-inert');
  }
}
function apply(card: Element, d: Decision) {
  if (d.kind === 'allow') reveal(card);
  else {cover(card,d.reason?reasonLabel[d.reason]:'Hidden by FocusMaxx',d.reason||'entertainment');for(const video of card.querySelectorAll('video'))video.pause();}
}
function visible(card: Element) {
  const rect = card.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > -200 && rect.top < innerHeight + 500;
}
function enqueue(card: Element) {
  const row = tracked.get(card);
  if (!row || row.queued || !visible(card)) return;
  row.queued = true; queue.push(card); pump();
}
async function pump() {
  while (enabled && active < 3 && queue.length) {
    const card = queue.shift()!; const row = tracked.get(card);
    if (!row || !card.isConnected || row.epoch !== epoch) continue;
    const signature = row.signature; const requestEpoch = epoch; const video = row.video;
    active++;
    send('CLASSIFY', {video}).then((decision: Decision) => {
      const current = tracked.get(card);
      if (!enabled || requestEpoch !== epoch || current?.signature !== signature || !card.isConnected) return;
      // Check reused cards immediately, before a stale result could expose their new contents.
      if (JSON.stringify(extractCard(card)) !== JSON.stringify(video)) {schedule(); return;}
      decisions.set(signature, decision); apply(card, decision);
    }).catch(() => {
      if (enabled && requestEpoch === epoch && tracked.get(card)?.signature === signature) reveal(card);
    }).finally(() => {active--; pump();});
  }
}
function scan() {
  if (scanning || !document.body) return;
  scanning = true;
  try {
    for (const [card] of tracked) if (!card.isConnected) {tracked.delete(card); observer.unobserve(card);}
    if (!enabled) {for (const card of document.querySelectorAll('.study-covered')) reveal(card); return;}
    for (const card of findCards()) {
      const video = extractCard(card);
      if (!video) {reveal(card);continue;}
      const signature = JSON.stringify(video);
      const old = tracked.get(card);
      if (old?.signature === signature && old.epoch === epoch) {if (!old.queued) enqueue(card); continue;}
      const row = {video, signature, epoch, queued:false}; tracked.set(card,row);
      const known = decisions.get(signature);
      if (known) {apply(card,known); row.queued = true;}
      else {reveal(card);observer.observe(card);enqueue(card);}
    }
  } finally {scanning = false;}
}
function schedule() {clearTimeout(scheduled); scheduled = setTimeout(scan, 100);}
const observer = new IntersectionObserver(entries => {for (const entry of entries) if (entry.isIntersecting) enqueue(entry.target);}, {rootMargin:'500px'});
function stateChanged(state: PublicState) {
  settings = isDemo ? state.rehearsalSettings : state.settings; enabled = settings.enabled;
  epoch++; queue.length = 0; decisions.clear();
  for (const card of document.querySelectorAll('.study-covered')) reveal(card);
  tracked.clear(); observer.disconnect();
  document.documentElement.classList.toggle('study-mode-active', enabled);
  scan();
}
function protect(event: Event) {
  if (!enabled || !(event.target instanceof Element)) return;
  if (event.target.closest('.study-covered')) {event.preventDefault(); event.stopImmediatePropagation();}
}
for (const event of ['click', 'pointerover', 'mouseover', 'focusin']) document.addEventListener(event, protect, true);
document.addEventListener('yt-navigate-finish', schedule);
document.addEventListener('play',event=>{if(enabled&&event.target instanceof HTMLVideoElement&&event.target.closest('.study-covered'))event.target.pause();},true);
document.addEventListener('DOMContentLoaded', schedule);
document.addEventListener('scroll', schedule, {passive:true});
const mutations = new MutationObserver(records => {
  const relevant = records.filter(r => !(r.target instanceof Element) || !r.target.closest('.study-cover'));
  if (!relevant.length) return;
  // Reused cards lose a stale cover immediately. Unknown content stays visible.
  if(enabled)for(const [card,row] of tracked)if(card.isConnected&&JSON.stringify(extractCard(card))!==row.signature)reveal(card);
  schedule();
});
mutations.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','title','aria-label','video-id','is-active','active']});
if (installed) chrome.runtime.onMessage.addListener((message,_sender,reply) => {
 if(message.type==='STUDY_STATE')stateChanged(message.state);
 if(message.type==='FOCUS_PAGE_STATUS'){
  const cards=findCards();const results=[...decisions.entries()];
  const samples=results.filter(([,d])=>d.kind==='allow'&&d.judgment).sort((a,b)=>b[1].judgment!.entertainment-a[1].judgment!.entertainment).slice(0,5).map(([signature,d])=>({title:(JSON.parse(signature) as Video).title,judgment:d.judgment}));
  reply({enabled,recognized:cards.length,readable:cards.filter(c=>extractCard(c)).length,evaluated:results.length,covered:cards.filter(c=>c.classList.contains('study-covered')).length,unavailable:results.filter(([,d])=>d.reason==='connection').length,pending:queue.length+active,samples});
 }
});
send('GET_STATE').then(stateChanged).catch(() => {
  // No settings can be read after an extension reload; restore the page under the balanced policy.
  for (const card of document.querySelectorAll('.study-covered')) reveal(card);
});
if (isDemo && installed) chrome.storage.onChanged.addListener(changes => {
  if (changes.rehearsalSettings || (changes.rehearsal?.newValue as Stats | undefined)?.startedAt !== (changes.rehearsal?.oldValue as Stats | undefined)?.startedAt) send('GET_STATE').then(stateChanged).catch(() => undefined);
});

if (isDemo && !installed) {let signature=""; const refresh=()=>send("GET_STATE").then((state:PublicState)=>{const next=JSON.stringify([state.rehearsalSettings,state.rehearsal.startedAt]);if(signature!==next){signature=next;stateChanged(state);}});addEventListener("storage",refresh);addEventListener("study-preview-update",refresh);}
