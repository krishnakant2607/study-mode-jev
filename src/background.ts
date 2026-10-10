import {RUBRIC_VERSION, cacheKey, cleanSettings, decide, defaults, newStats, normalizeVideo, parseJudgment, record, requestFor, type Judgment, type PublicState, type Settings, type Stats, type Video, type Decision} from './core';
import {fixtureJudgment} from './fixtures';

type CacheEntry = {judgment: Judgment; at: number};
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<{judgment: Judgment; latencyMs: number}>>();
let credentialRevision = 0;
let active = 0;
const waiters: (() => void)[] = [];
let writes = Promise.resolve();
const connectionDefault = {ok: false, message: 'Connect Jev. Videos stay visible until evaluated.', at: 0};
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  const current = await chrome.storage.local.get(['settings', 'rehearsalSettings', 'stats', 'rehearsal', 'connection', 'judgmentCache','rubricVersion']);
  if (current.judgmentCache && typeof current.judgmentCache === 'object') {
    for (const [key, value] of Object.entries(current.judgmentCache).slice(-1000)) {
      const entry = value as CacheEntry;
      if (entry && typeof entry.at === 'number' && Date.now()-entry.at < 86400000 && key.includes(RUBRIC_VERSION) && Object.values(entry.judgment || {}).length === 3 && Object.values(entry.judgment).every(x => typeof x === 'number' && x >= 0 && x <= 1)) cache.set(key, entry);
    }
  }
  await chrome.storage.local.set({settings: cleanSettings(current.settings || defaults), rehearsalSettings: cleanSettings(current.rehearsalSettings || {...defaults, enabled:true, keywords:['python']}), rubricVersion:RUBRIC_VERSION, stats:current.rubricVersion===RUBRIC_VERSION?current.stats||newStats():newStats(),rehearsal:current.rubricVersion===RUBRIC_VERSION?current.rehearsal||newStats():newStats(), connection: current.connection || connectionDefault});
})();

async function snapshot(): Promise<PublicState> {
  await ready;
  const x = await chrome.storage.local.get(['settings', 'rehearsalSettings', 'apiKey', 'stats', 'rehearsal', 'connection']);
  return {settings: cleanSettings(x.settings), rehearsalSettings: cleanSettings(x.rehearsalSettings || {...defaults, enabled:true, keywords:['python']}), hasKey: Boolean(x.apiKey), stats: (x.stats as Stats) || newStats(), rehearsal: (x.rehearsal as Stats) || newStats(), connection: (x.connection as PublicState["connection"]) || connectionDefault};
}
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const work = writes.then(fn);
  writes = work.then(() => undefined, () => undefined);
  return work;
}
async function broadcast() {
  const state = await snapshot();
  const tabs = await chrome.tabs.query({url: 'https://www.youtube.com/*'});
  await Promise.all(tabs.map(t => t.id ? chrome.tabs.sendMessage(t.id, {type: 'STUDY_STATE', state}).catch(() => undefined) : undefined));
  chrome.runtime.sendMessage({type: 'STUDY_UPDATED'}).catch(() => undefined);
}
async function acquire() {
  if (active >= 3) {await new Promise<void>(resolve => waiters.push(resolve)); return;}
  active++;
}
function release() {const next=waiters.shift();if(next)next();else active--;}

async function callJev(video: Video, settings: Settings, key: string, transport: typeof fetch = fetch) {
  await acquire();
  const started = Date.now();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await transport('https://api.typesafe.ai/v1/systemone', {
          method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
          body: JSON.stringify(requestFor(video, settings)), signal: AbortSignal.timeout(6500)
        });
      } catch {
        if (attempt === 0) continue;
        throw new Error('Jev could not be reached. Check your network; videos stay visible.');
      }
      if (!response.ok) {
        if (attempt === 0 && [429, 500, 502, 503, 504, 529].includes(response.status)) {
          await new Promise(resolve => setTimeout(resolve, 500)); continue;
        }
        if (response.status === 401 || response.status === 403) throw new Error('Your Jev key was rejected. Update it in Settings.');
        if (response.status === 429) throw new Error('Jev is rate limited. Pause briefly, then retry.');
        throw new Error(`Jev returned HTTP ${response.status}. Videos stay visible.`);
      }
      let raw: unknown;
      try {raw = await response.json();} catch {throw new Error('Jev returned an unreadable response. Videos stay visible.');}
      return {judgment: parseJudgment(raw), latencyMs: Date.now() - started};
    }
    throw new Error('Jev did not return a decision.');
  } finally {release();}
}

async function evaluate(video: Video, rehearsal: boolean): Promise<Decision> {
  const revision = credentialRevision;
  const state = await snapshot();
  const settings = rehearsal ? state.rehearsalSettings : state.settings;
  const session = rehearsal ? state.rehearsal.startedAt : state.stats.startedAt;
  if (!settings.enabled && !rehearsal) return {kind: 'allow', source: 'local'};
  let decision: Decision;
  if (video.shorts && !settings.filterShorts) decision = {kind:'allow',source:'local'};
  else if (rehearsal) decision = decide(fixtureJudgment(video, settings), video, settings, 'rehearsal');
  else {
    const key = cacheKey(video, settings);
    const existing = cache.get(key);
    if (existing && Date.now() - existing.at < 24 * 60 * 60 * 1000) decision = decide(existing.judgment, video, settings, 'cache');
    else {
      const secret = await chrome.storage.local.get('apiKey');
      if (!secret.apiKey) decision = {kind: 'allow', reason: 'connection', source: 'local'};
      else {
        try {
          const requestKey = `${revision}:${key}`;
          let work = inflight.get(requestKey);
          if (!work) {
            work = callJev(video, settings, secret.apiKey as string);
            inflight.set(requestKey, work);
            work.finally(() => inflight.delete(requestKey)).catch(() => undefined);
          }
          const result = await work;
          await serial(async () => {
            if (revision !== credentialRevision) return;
            cache.set(key, {judgment: result.judgment, at: Date.now()});
            if (cache.size > 1000) cache.delete(cache.keys().next().value!);
            await chrome.storage.local.set({judgmentCache: Object.fromEntries(cache), connection: {ok: true, message: 'Jev connected', at: Date.now()}});
          });
          decision = {...decide(result.judgment, video, settings, 'live'), latencyMs: result.latencyMs};
        } catch (error) {
          await serial(async () => {if (revision === credentialRevision) await chrome.storage.local.set({connection: {ok: false, message: error instanceof Error ? error.message : 'Jev is unavailable.', at: Date.now()}});});
          decision = {kind: 'allow', reason: 'connection', source: 'local'};
        }
      }
    }
  }
  // A reply belonging to an old keyword/session must never reveal a new session's card.
  return serial(async () => {
    const latest = await snapshot();
    const now = rehearsal ? latest.rehearsal : latest.stats;
    if ((!rehearsal && revision !== credentialRevision) || JSON.stringify(rehearsal ? latest.rehearsalSettings : latest.settings) !== JSON.stringify(settings) || now.startedAt !== session) return {kind: 'allow', reason: 'uncertain', source: 'local'} as Decision;
    const field = rehearsal ? 'rehearsal' : 'stats';
    await chrome.storage.local.set({[field]: record(now, video.id, decision)});
    return decision;
  });
}

function internal(sender: chrome.runtime.MessageSender) {
  return sender.id === chrome.runtime.id && Boolean(sender.url?.startsWith(chrome.runtime.getURL('')));
}
function youtube(sender: chrome.runtime.MessageSender) {
  try {return sender.id === chrome.runtime.id && new URL(sender.url || '').origin === 'https://www.youtube.com' && sender.tab?.id !== undefined;} catch {return false;}
}
async function handle(message: Record<string, unknown>, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (!internal(sender) && !youtube(sender)) throw new Error('Unsupported sender.');
  if (message.type === 'GET_STATE') return snapshot();
  if (message.type === 'CLASSIFY') {
    const rehearsal = internal(sender) && sender.url!.split('?')[0] === chrome.runtime.getURL('demo.html');
    if (internal(sender) && !rehearsal) throw new Error('Classification must originate from YouTube or the rehearsal.');
    return evaluate(normalizeVideo(message.video), rehearsal);
  }
  if (!internal(sender)) throw new Error('This action is only available in extension settings.');
  if (message.type === 'SAVE_SETTINGS') {
    const rehearsal = message.scope === 'rehearsal';
    await serial(async () => {
      const before = await snapshot();
      const base = rehearsal ? before.rehearsalSettings : before.settings;
      const settings = cleanSettings((message.settings || {}) as Partial<Settings>, base);
      const changedSession = JSON.stringify(base) !== JSON.stringify(settings);
      await chrome.storage.local.set({[rehearsal ? 'rehearsalSettings' : 'settings']: settings, ...(changedSession ? {[rehearsal ? 'rehearsal' : 'stats']: newStats()} : {})});
    });
    if (!rehearsal) await broadcast();
    return snapshot();
  }
  if (message.type === 'SAVE_KEY') {
    const key = typeof message.key === 'string' ? message.key.trim() : '';
    if (key.length > 512 || /\s/.test(key)) throw new Error('Enter a valid API key without spaces.');
    await ready;
    await serial(async () => {
      credentialRevision++; cache.clear();
      await chrome.storage.local.set({judgmentCache: {}, apiKey: key, connection: {...connectionDefault, message: key ? 'Key saved. Test the connection.' : connectionDefault.message}});
    });
    await broadcast(); return snapshot();
  }
  if (message.type === 'TEST_CONNECTION') {
    const revision = credentialRevision;
    const x = await chrome.storage.local.get('apiKey');
    try {
      if (!x.apiKey) throw new Error('Add your Jev API key first.');
      const state = await snapshot();
      await callJev({id:'connection_test', title:'Python functions: a beginner lesson', channel:'Coding classroom', description:'A tutorial explaining function parameters and return values.', duration:'10:00', shorts:false}, state.settings, x.apiKey as string);
      await serial(async () => {
        if (revision !== credentialRevision) throw new Error('The key changed. Test the current key again.');
        await chrome.storage.local.set({connection: {ok: true, message: 'Live Jev connection verified', at: Date.now()}});
      });
    } catch (error) {
      await serial(async () => {if (revision === credentialRevision) await chrome.storage.local.set({connection: {ok:false, message:error instanceof Error ? error.message : 'Connection test failed.', at:Date.now()}});});
      throw error;
    }
    return snapshot();
  }
  if (message.type === 'RESET_SESSION') {
    await serial(() => chrome.storage.local.set({[message.scope === 'rehearsal' ? 'rehearsal' : 'stats']: newStats()}));
    await broadcast(); return snapshot();
  }
  if (message.type === 'RETRY') {await broadcast(); return snapshot();}
  if (message.type === 'OPEN_DEMO') {await chrome.tabs.create({url: chrome.runtime.getURL('demo.html')}); return {ok:true};}
  if (message.type === 'OPEN_YOUTUBE') {await chrome.tabs.create({url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent((await snapshot()).settings.keywords.join(' OR ') || 'educational tutorials')}); return {ok:true};}
  if (message.type === 'OPEN_SIDEBAR') {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs[0]?.windowId) throw new Error('Open this control from an active Chrome window.');
    await chrome.sidePanel.open({windowId: tabs[0].windowId}); return {ok:true};
  }
  throw new Error('Unknown action.');
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string' || message.type === 'STUDY_UPDATED') return false;
  handle(message, sender).then(data => sendResponse({ok:true, data}), error => sendResponse({ok:false, error: error instanceof Error ? error.message : 'The action failed.'}));
  return true;
});
chrome.runtime.onInstalled.addListener(() => ready.catch(() => undefined));
