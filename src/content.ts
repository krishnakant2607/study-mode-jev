import {reasonLabel, type Stats, type Decision, type PublicState, type Settings, type Video} from './core';
import {CARD_SELECTOR, extractCard, findCards} from './detector';
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
  overlay.querySelector('.study-cover-sub')!.textContent = reason === 'pending' ? 'Checking learning relevance' : 'Study Mode keeps your attention here';
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
  else cover(card, d.reason ? reasonLabel[d.reason] : 'Hidden by Study Mode', d.reason || 'uncertain');
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
      if (enabled && requestEpoch === epoch && tracked.get(card)?.signature === signature) cover(card, 'Connection unavailable', 'connection');
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
      if (!video) {if (card.querySelector('a[href*="/watch?v="],a[href^="/shorts/"]')) cover(card,'Waiting for video details','uncertain');continue;}
      const signature = JSON.stringify(video);
      const old = tracked.get(card);
      if (old?.signature === signature && old.epoch === epoch) {if (!old.queued) enqueue(card); continue;}
      const row = {video, signature, epoch, queued:false}; tracked.set(card,row);
      const known = decisions.get(signature);
      if (known) {apply(card,known); row.queued = true;}
      else {cover(card, 'Checking…'); observer.observe(card); enqueue(card);}
    }
    if (settings?.hideShorts) {
      for (const shelf of document.querySelectorAll('ytd-reel-shelf-renderer,yt-horizontal-list-renderer:has(a[href^="/shorts/"])')) cover(shelf, 'Shorts are hidden', 'shorts');
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
document.addEventListener('DOMContentLoaded', schedule);
document.addEventListener('scroll', schedule, {passive:true});
const mutations = new MutationObserver(records => {
  const relevant = records.filter(r => !(r.target instanceof Element) || !r.target.closest('.study-cover'));
  if (!relevant.length) return;
  // Cover inserted/reused candidates in this mutation microtask, before the debounced scan.
  if (enabled) {
    const candidates = new Set<Element>();
    for (const record of relevant) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const parent = target?.closest(CARD_SELECTOR); if (parent) candidates.add(parent);
      for (const node of record.addedNodes) if (node instanceof Element && !node.matches('.study-cover')) {
        if (node.matches(CARD_SELECTOR) && !node.parentElement?.closest(CARD_SELECTOR)) candidates.add(node);
        for (const card of findCards(node)) candidates.add(card);
      }
    }
    for (const card of candidates) {
      const video = extractCard(card);
      if (video && tracked.get(card)?.signature !== JSON.stringify(video)) cover(card, 'Checking…');
      else if (!video && card.querySelector('a[href*="/watch?v="],a[href^="/shorts/"]')) cover(card, 'Waiting for video details', 'uncertain');
    }
  }
  schedule();
});
mutations.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','title','aria-label']});
if (installed) chrome.runtime.onMessage.addListener(message => {if (message.type === 'STUDY_STATE') stateChanged(message.state);});
send('GET_STATE').then(stateChanged).catch(() => {
  // No settings can be read after an extension reload; preserve covers and instruct recovery.
  for (const card of document.querySelectorAll('.study-covered')) cover(card,'Reload this tab to reconnect','connection');
});
if (isDemo && installed) chrome.storage.onChanged.addListener(changes => {
  if (changes.rehearsalSettings || (changes.rehearsal?.newValue as Stats | undefined)?.startedAt !== (changes.rehearsal?.oldValue as Stats | undefined)?.startedAt) send('GET_STATE').then(stateChanged).catch(() => undefined);
});

if (isDemo && !installed) {let signature=""; const refresh=()=>send("GET_STATE").then((state:PublicState)=>{const next=JSON.stringify([state.rehearsalSettings,state.rehearsal.startedAt]);if(signature!==next){signature=next;stateChanged(state);}});addEventListener("storage",refresh);addEventListener("study-preview-update",refresh);}
