import {cleanSettings, defaults, decide, newStats, normalizeVideo, record, type PublicState, type Settings} from './core';
import {fixtureJudgment} from './fixtures';
export const installed = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
const PREVIEW_KEY = 'focusmaxx-rehearsal-v3';
function readPreview(): PublicState {
  try {const stored = localStorage.getItem(PREVIEW_KEY); if (stored) {const state=JSON.parse(stored);state.settings=cleanSettings(state.settings);state.rehearsalSettings=cleanSettings(state.rehearsalSettings);return state;}} catch { /* A private window can restrict storage. */ }
  return {settings:{...defaults},rehearsalSettings:{...defaults,enabled:true,keywords:['python']},hasKey:false,stats:newStats(),rehearsal:newStats(),connection:{ok:false,message:'Rehearsal · authored decisions, no live inference',at:0}};
}
function writePreview(state: PublicState) {
  localStorage.setItem(PREVIEW_KEY,JSON.stringify(state));
  dispatchEvent(new CustomEvent('study-preview-update',{detail:state}));
}
export async function rpc(type: string, extra: Record<string,unknown> = {}): Promise<any> {
  if (installed) {
    const result = await chrome.runtime.sendMessage({type,...extra});
    if (!result?.ok) throw new Error(result?.error || 'Extension unavailable. Reload the page.');
    return result.data;
  }
  const state = readPreview();
  if (type === 'GET_STATE') return state;
  if (type === 'SAVE_SETTINGS') {
    const rehearsal = extra.scope === 'rehearsal';
    const base = rehearsal ? state.rehearsalSettings : state.settings;
    const settings = cleanSettings((extra.settings || {}) as Partial<Settings>,base);
    if (JSON.stringify(settings) !== JSON.stringify(base)) state[rehearsal ? 'rehearsal' : 'stats'] = newStats();
    state[rehearsal ? 'rehearsalSettings' : 'settings']=settings;writePreview(state);return state;
  }
  if (type === 'RESET_SESSION') {state[extra.scope==='rehearsal'?'rehearsal':'stats']=newStats();writePreview(state);return state;}
  if (type === 'CLASSIFY') {
    const video=normalizeVideo(extra.video);
    const decision=decide(fixtureJudgment(video,state.rehearsalSettings),video,state.rehearsalSettings,'rehearsal');
    state.rehearsal=record(state.rehearsal,video.id,decision);writePreview(state);return decision;
  }
  if (type === 'OPEN_DEMO') {window.open('demo.html','_blank','noopener');return {ok:true};}
  if (type === 'OPEN_SIDEBAR') {window.open('sidebar.html','_blank','noopener');return {ok:true};}
  if (type === 'RETRY') {writePreview(state);return state;}
  if (type === 'OPEN_YOUTUBE') {window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(state.settings.keywords.join(' OR ') || 'educational tutorials'),'_blank','noopener');return {ok:true};}
  throw new Error('This is a local rehearsal. Connect your key in the installed Chrome extension.');
}
export function onStateUpdate(listener: (state?: PublicState) => void) {
  if (installed) {
    chrome.storage.onChanged.addListener(changes => {if (changes.settings || changes.rehearsalSettings || changes.stats || changes.rehearsal || changes.connection || changes.apiKey) listener();});
    chrome.runtime.onMessage.addListener(m => {if (m.type==='STUDY_UPDATED') listener();});
  } else {
    addEventListener('storage', e=>{if(e.key===PREVIEW_KEY)listener();});
    addEventListener('study-preview-update', ()=>listener());
  }
}
