import {reasonLabel, summarize, type PublicState, type Reason} from './core';
import {installed, onStateUpdate, rpc} from './client';
const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
let state: PublicState;
let windowId: number | undefined;
if (installed) chrome.windows.getCurrent().then(window => {windowId=window.id;}).catch(()=>undefined);
let scope: 'live'|'rehearsal' = installed && !new URLSearchParams(location.search).has('demo') ? 'live' : 'rehearsal';
let currentTab = 'focus';
let busy = false;
let preferenceDirty = false;
let noticeTimer: ReturnType<typeof setTimeout>;
function notice(message:string,success=false) {clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').classList.toggle('success',success);$('notice').hidden=false;if(success)noticeTimer=setTimeout(()=>{$('notice').hidden=true;},3500);}
function tab(name:string) {
  currentTab=name;
  for(const button of document.querySelectorAll<HTMLElement>('[data-tab]')) {const chosen=button.dataset.tab===name;button.classList.toggle('selected',chosen);if(chosen)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  for(const view of document.querySelectorAll<HTMLElement>('.view')) view.hidden=view.id!==`view-${name}`;
}
function render() {
  const s=scope==='rehearsal'?state.rehearsalSettings:state.settings;
  $('enabled' as string).toggleAttribute('data-enabled',s.enabled);
  ($('enabled') as HTMLInputElement).checked=s.enabled;
  ($('filter-shorts') as HTMLInputElement).checked=s.filterShorts;
  if(!preferenceDirty){($('allow-preference') as HTMLTextAreaElement).value=s.allowPreference;($('hide-preference') as HTMLTextAreaElement).value=s.hidePreference;}
  $('preference-status').textContent=preferenceDirty?'Unsaved changes':'Preferences saved';
  $('preferences-summary').textContent=s.allowPreference||s.hidePreference?'Personal preferences are active.':'Tell FocusMaxx what to allow and hide.';
  const chips=$('keyword-list');
  // Preserve focused remove buttons during counter updates.
  if (chips.dataset.signature !== JSON.stringify(s.keywords)) {
    chips.dataset.signature=JSON.stringify(s.keywords);chips.replaceChildren();
    for (const keyword of s.keywords) {
      const chip=document.createElement('span');chip.className='keyword-chip';
      const label=document.createElement('span');label.textContent=keyword;
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove keyword ${keyword}`);
      remove.addEventListener('click',()=>action(async()=>{const selected=scope==='rehearsal'?state.rehearsalSettings:state.settings;await save({keywords:selected.keywords.filter(k=>k!==keyword)});}));
      chip.append(label,remove);chips.append(chip);
    }
  }
  if(document.activeElement!==$('model'))($('model') as HTMLInputElement).value=s.model;
  $('mode-copy').textContent=s.enabled ? 'Balanced filtering is on.' : 'Balanced filtering is off.';
  $('key-status').textContent=state.hasKey ? 'A key is saved. Its value is never shown here.' : 'No key connected. Enter it here, never in chat.';
  ($('remove-key') as HTMLButtonElement).disabled=!state.hasKey || busy;
  $('scope-label').textContent=scope==='live'?'Live':'Rehearsal';$('scope-label').classList.toggle('rehearsal',scope==='rehearsal');
  ($('metric-scope') as HTMLSelectElement).value=scope;
  const stats=scope==='live'?state.stats:state.rehearsal;const summary=summarize(stats);
  for(const name of ['checked','allowed','covered'] as const)$(name).textContent=String(summary[name]);
  $('uncertain').textContent=`${summary.uncertain} uncertain · kept visible`;
  const meter=$('distribution');meter.replaceChildren();
  for(let i=0;i<40;i++) {const tick=document.createElement('span');if(summary.checked){const point=(i+.5)/40*summary.checked;tick.className=point<summary.allowed?'learning':'covered';}meter.append(tick);}
  meter.setAttribute('aria-label',`${summary.allowed} visible videos; ${summary.covered} covered, including ${summary.uncertain} uncertain`);
  $('activity-count').textContent=String(summary.checked);
  $('activity-empty').hidden=summary.checked>0;
  $('activity-empty').textContent=scope==='rehearsal'?'Open the rehearsal page to try the filter on authored sample videos.':'Open YouTube with Study Mode enabled to see your first results.';
  const reasons=$('reason-list');reasons.replaceChildren();
  for(const reason of ['entertainment','excluded','preferred','uncertain','connection'] as Reason[]) {
    const row=document.createElement('div');row.className='reason-row';
    const name=document.createElement('span');name.textContent=reasonLabel[reason];
    const track=document.createElement('div');track.className='reason-track';const fill=document.createElement('span');fill.style.width=`${summary.checked?summary.reasons[reason]/summary.checked*100:0}%`;track.append(fill);
    const count=document.createElement('strong');count.textContent=String(summary.reasons[reason]);row.append(name,track,count);reasons.append(row);
  }
  const mins=Math.max(0,Math.floor((Date.now()-stats.startedAt)/60000));$('activity-time').textContent=mins?`Session started ${mins} min ago`:'Session just started';
  const label=$('connection-label');
  label.textContent=scope==='rehearsal'?'Rehearsal · authored decisions':!state.hasKey?'Connect Jev in Settings':state.connection.ok?'Jev connected':state.connection.message;
  $('connection-dot').classList.toggle('connected',scope==='live' && installed && state.connection.ok);
  $('connection-action').textContent=scope==='rehearsal'?'Live':installed&&state.hasKey?'Retry':'Connect';
}
async function refresh() {state=await rpc('GET_STATE');render();}
async function action(fn:()=>Promise<void>,button?:HTMLButtonElement) {
  if(busy)return;busy=true;if(button)button.disabled=true;
  try{await fn();}catch(e){notice(e instanceof Error?e.message:'Something went wrong. Try again.');}
  finally{busy=false;if(button)button.disabled=false;if(state)render();}
}
async function save(settings:Record<string,unknown>) {state=await rpc('SAVE_SETTINGS',{settings,scope});render();}
for(const button of document.querySelectorAll<HTMLElement>('[data-tab]'))button.addEventListener('click',()=>tab(button.dataset.tab!));
$('enabled').addEventListener('change',()=>action(async()=>{await save({enabled:($('enabled') as HTMLInputElement).checked});if(state.settings.enabled&&!state.hasKey&&installed)notice('FocusMaxx is on. Connect Jev in Settings; videos stay visible until decisions are available.');}));
$('filter-shorts').addEventListener('change',()=>action(()=>save({filterShorts:($('filter-shorts') as HTMLInputElement).checked})));
$('preferences-link').addEventListener('click',()=>tab('preferences'));
for(const id of ['allow-preference','hide-preference'])$(id).addEventListener('input',()=>{preferenceDirty=true;$('preference-status').textContent='Unsaved changes';});
$('preferences-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{const allow=($('allow-preference') as HTMLTextAreaElement).value,hide=($('hide-preference') as HTMLTextAreaElement).value;await save({allowPreference:allow,hidePreference:hide});preferenceDirty=($('allow-preference') as HTMLTextAreaElement).value!==allow||($('hide-preference') as HTMLTextAreaElement).value!==hide;render();notice(preferenceDirty?'Preferences saved. New edits are still unsaved.':'Preferences saved. Your feed is being re-evaluated.',true);},$<HTMLButtonElement>('save-preferences'));});
$('keyword-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{
  const input=$('keyword-input') as HTMLInputElement;const keyword=input.value.trim().replace(/\s+/g,' ');
  if(!keyword)return;
  const selected=scope==='rehearsal'?state.rehearsalSettings:state.settings;
  if(selected.keywords.some(k=>k.toLowerCase()===keyword.toLowerCase())){input.value='';return;}
  if(selected.keywords.length>=20)throw new Error('You can add up to 20 keywords. Remove one to add another.');
  await save({keywords:[...selected.keywords,keyword]});input.value='';input.focus();
} );});
$('key-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{const input=$('api-key') as HTMLInputElement;if(!input.value.trim())throw new Error('Enter your key, or use Remove saved key.');state=await rpc('SAVE_KEY',{key:input.value});input.value='';notice('Key saved privately. Test the connection next.',true);});});
$('test-connection').addEventListener('click',()=>action(async()=>{notice('Checking a live Jev decision…');state=await rpc('TEST_CONNECTION');notice('Live Jev connection verified.',true);},$<HTMLButtonElement>('test-connection')));
$('remove-key').addEventListener('click',()=>action(async()=>{state=await rpc('SAVE_KEY',{key:''});notice('Saved key removed.',true);}));
$('save-model').addEventListener('click',()=>action(async()=>{const model=($('model') as HTMLInputElement).value;if(!/^jev-[a-zA-Z0-9.-]{1,40}$/.test(model))throw new Error('Use a Jev model name such as jev-latest.');await save({model});notice('Model saved.',true);}));
$('metric-scope').addEventListener('change',()=>{preferenceDirty=false;scope=($('metric-scope') as HTMLSelectElement).value as typeof scope;render();});
$('activity-link').addEventListener('click',()=>tab('activity'));
$('reset-session').addEventListener('click',()=>action(async()=>{state=await rpc('RESET_SESSION',{scope});notice('A fresh session is ready.',true);}));
for(const id of ['demo','settings-demo'])$(id).addEventListener('click',()=>action(async()=>{await rpc('OPEN_DEMO');scope='rehearsal';preferenceDirty=false;render();}));
$('open-youtube').addEventListener('click',()=>action(async()=>{scope='live';preferenceDirty=false;render();await rpc('OPEN_YOUTUBE');}));
$('sidebar').addEventListener('click',()=>action(async()=>{if(installed && windowId !== undefined) await chrome.sidePanel.open({windowId});else throw new Error('Use this control from the installed Chrome extension.');}));
$('connection-action').addEventListener('click',()=>{if(scope==='rehearsal'){if(installed){scope='live';preferenceDirty=false;render();}else tab('settings');return;}if(installed&&state.hasKey)action(async()=>{await rpc('RETRY');notice('Retry requested. Check Settings if the connection still fails.',true);});else tab('settings');});
onStateUpdate(()=>{refresh().catch(()=>undefined);});
refresh().then(()=>{if(location.pathname.endsWith('/settings.html'))tab('settings');if(!installed)notice('Local rehearsal. All sample judgments are authored; no live Jev calls.');}).catch(e=>notice(e.message));
