// Runs against an isolated Chromium profile, authored YouTube DOM fixtures,
// and an explicitly mocked transport. It does not claim live Jev accuracy.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.STUDY_PLAYWRIGHT_MODULE || 'playwright');
const folder=resolve('dist');const artifacts=resolve('artifacts');await mkdir(artifacts,{recursive:true});
const profile=await mkdtemp(resolve(tmpdir(),'study-mode-test-'));
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${folder}`,`--load-extension=${folder}`],viewport:{width:1280,height:900}});
const failures=[];const checks=[];
try{
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:15000});
  const id=new URL(worker.url()).hostname;const base=`chrome-extension://${id}/`;
  await worker.evaluate(()=>{
    globalThis.__calls=0;
    globalThis.fetch=async(_url,options)=>{
      globalThis.__calls++;
      const request=JSON.parse(options.body);const title=request.state.video.title.toLowerCase();const keywords=request.state.learning_keywords.map(k=>k.toLowerCase());
      const j={education:.99,entertainment:.01,relevance:.99,clickbait:.01,sufficient:.99};
      if(/snake|prank|memes/.test(title)){j.education=.01;j.entertainment=.99;}
      if(keywords.length&&!keywords.some(k=>title.includes(k)))j.relevance=.01;

      if(title.includes('unclear')){j.education=.5;j.sufficient=.3;}
      if(title.includes('rich overnight'))j.clickbait=.99;
      return new Response(JSON.stringify({answers:Object.fromEntries(Object.entries(j).map(([key,noul])=>[key,{type:'noul',noul}]))}),{status:200});
    };
  });
  const panel=await context.newPage();panel.on('pageerror',e=>failures.push(e.message));await panel.goto(base+'panel.html');
  await panel.getByRole('button',{name:'Settings',exact:true}).click();await panel.getByLabel('TypeSafe API key').fill('dummy-browser-test-key');await panel.getByRole('button',{name:'Save key',exact:true}).click();
  await panel.getByRole('button',{name:'Test connection',exact:true}).click();await panel.getByText('Live Jev connection verified.',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Focus',exact:true}).click();await panel.getByLabel('Your keywords',{exact:true}).fill('python');await panel.getByLabel('Your keywords',{exact:true}).press('Enter');await panel.getByRole('button',{name:'Remove keyword python',exact:true}).waitFor();await panel.getByLabel('Enable Study Mode').check();checks.push('Packaged popup saves a private key, verifies the mocked transport, and starts a Python session.');
  const card=(tag,id,title,extra='')=>`<${tag} id="${id}"><div><a id="thumbnail" href="/watch?v=${id}"><img alt="thumbnail" width="120" height="68"></a><h3><a id="video-title" href="/watch?v=${id}">${title}</a></h3><ytd-channel-name><a>Learning Channel</a></ytd-channel-name><ytd-thumbnail-overlay-time-status-renderer>12:00</ytd-thumbnail-overlay-time-status-renderer>${extra}</div></${tag}>`;
  const html=`<!doctype html><html><head><style>body{background:#111;color:white}ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,yt-lockup-view-model{display:block;position:relative;min-height:150px;width:450px;margin:12px}</style></head><body>${card('ytd-rich-item-renderer','home_python','Python functions tutorial')}${card('ytd-video-renderer','search_snake','Giant python snake prank')}${card('ytd-compact-video-renderer','related_js','JavaScript closures tutorial')}${card('yt-lockup-view-model','lockup_python','Python project tutorial')}${card('ytd-video-renderer','unclear_card','Python unclear teaser')}${card('ytd-video-renderer','clickbait_card','Learn Python and get rich overnight')}${card('ytd-video-renderer','dsa_card','DSA sorting tutorial')}${card('ytd-video-renderer','dsa_fun','DSA memes')}</body></html>`;
  await context.route('https://www.youtube.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  const feed=await context.newPage();feed.on('pageerror',e=>failures.push(e.message));await feed.goto('https://www.youtube.com/results?search_query=python');
  await feed.locator('#search_snake[data-study-reason="entertainment"]').waitFor();
  await feed.locator('#related_js[data-study-reason="off_topic"]').waitFor();
  await feed.locator('#unclear_card[data-study-reason="uncertain"]').waitFor();
  await feed.locator('#clickbait_card[data-study-reason="clickbait"]').waitFor();
  assert.equal(await feed.locator('#home_python').getAttribute('data-study-reason'),null);
  assert.equal(await feed.locator('#lockup_python').getAttribute('data-study-reason'),null);
  assert.equal(await feed.locator('#search_snake #video-title').isVisible(),false);
  assert.equal(await feed.locator('#search_snake > div:not(.study-cover)').getAttribute('inert'),'');
  checks.push('Home, search, related and lockup fixtures are detected; covered titles are invisible and inert.');
  await feed.evaluate(()=>{const card=document.getElementById('home_python');card.querySelector('#video-title').textContent='Giant python snake prank';});
  await feed.locator('#home_python[data-study-reason="entertainment"]').waitFor();checks.push('A previously permitted DOM card is covered when YouTube reuses it for entertainment.');
  const previousCalls=await worker.evaluate(()=>globalThis.__calls);
  await feed.evaluate(()=>{const duplicate=document.getElementById('lockup_python').cloneNode(true);duplicate.id='duplicate_python';document.body.prepend(duplicate);});
  await new Promise(resolve=>setTimeout(resolve,250));
  assert.equal(await worker.evaluate(()=>globalThis.__calls),previousCalls);checks.push('Duplicate cards reuse judgments without another model call.');
  await panel.getByLabel('Your keywords',{exact:true}).fill('dsa');await panel.getByLabel('Your keywords',{exact:true}).press('Enter');
  await panel.getByRole('button',{name:'Remove keyword dsa',exact:true}).waitFor();
  await feed.locator('#dsa_card').scrollIntoViewIfNeeded();
  await feed.waitForFunction(()=>!document.getElementById('dsa_card').classList.contains('study-covered'));
  await feed.locator('#dsa_fun').scrollIntoViewIfNeeded();await feed.locator('#dsa_fun[data-study-reason="entertainment"]').waitFor();
  assert.equal(await feed.locator('#lockup_python').getAttribute('data-study-reason'),null);
  await panel.getByLabel('Your keywords',{exact:true}).fill('PYTHON');await panel.getByLabel('Your keywords',{exact:true}).press('Enter');
  assert.equal(await panel.getByRole('button',{name:'Remove keyword python',exact:true}).count(),1);
  checks.push('Enter adds Python and DSA independently; either lesson is allowed, matching memes stay covered, and duplicate chips are rejected.');
  await panel.getByRole('button',{name:'Remove keyword python',exact:true}).click();await panel.getByRole('button',{name:'Remove keyword python',exact:true}).waitFor({state:'hidden'});
  await panel.getByRole('button',{name:'Remove keyword dsa',exact:true}).click();await panel.getByRole('button',{name:'Remove keyword dsa',exact:true}).waitFor({state:'hidden'});
  await panel.getByLabel('Your keywords',{exact:true}).fill('javascript');await panel.getByLabel('Your keywords',{exact:true}).press('Enter');await panel.getByRole('button',{name:'Remove keyword javascript',exact:true}).waitFor();
  await feed.locator('#related_js').scrollIntoViewIfNeeded();
  await feed.locator('#lockup_python[data-study-reason="off_topic"]').waitFor();
  await feed.waitForFunction(()=>!document.getElementById('related_js').classList.contains('study-covered'));
  checks.push('Keyword removal and replacement reclassify existing cards and restores the relevant lesson.');
  await feed.evaluate(()=>{const card=document.createElement('ytd-video-renderer');card.id='late_details';card.innerHTML='<div><a href="/watch?v=late_details"></a><h3 id="video-title"></h3></div>';document.body.prepend(card);});
  await feed.locator('#late_details[data-study-reason="uncertain"]').waitFor();
  await feed.locator('#late_details').scrollIntoViewIfNeeded();
  await feed.locator('#late_details #video-title').evaluate(el=>{el.textContent='JavaScript beginner tutorial';});
  await feed.waitForFunction(()=>!document.getElementById('late_details').classList.contains('study-covered'));
  checks.push('Cards with delayed titles remain covered until metadata permits classification.');
  await panel.getByLabel('Enable Study Mode').uncheck();await feed.waitForFunction(()=>document.querySelectorAll('.study-covered').length===0);assert.equal(await feed.locator('#search_snake #video-title').isVisible(),true);assert.equal(await feed.locator('#search_snake > div:not(.study-cover)').getAttribute('inert'),null);checks.push('Disabling Study Mode restores original content and keyboard interaction.');
  const demo=await context.newPage();demo.on('pageerror',e=>failures.push(e.message));await demo.goto(base+'demo.html');await demo.locator('.study-covered[data-study-reason="entertainment"]').first().waitFor();
  const embedded=demo.frameLocator('iframe');
  await embedded.getByLabel('Your keywords',{exact:true}).fill('dsa');await embedded.getByLabel('Your keywords',{exact:true}).press('Enter');await embedded.getByRole('button',{name:'Remove keyword dsa',exact:true}).waitFor();
  await demo.locator('[data-study-card]').filter({hasText:'DSA: binary search'}).scrollIntoViewIfNeeded();
  await demo.waitForFunction(()=>[...document.querySelectorAll('[data-study-card]')].some(c=>c.textContent.includes('DSA: binary search')&&!c.classList.contains('study-covered')));
  await panel.getByRole('button',{name:'Activity',exact:true}).click();await panel.getByLabel('Activity source').selectOption('rehearsal');
  await panel.getByRole('button',{name:'Focus',exact:true}).click();
  await demo.evaluate(()=>window.scrollTo(0,0));
  await panel.locator('#notice').waitFor({state:'hidden',timeout:6000});
  await panel.setViewportSize({width:420,height:700});await panel.screenshot({path:resolve(artifacts,'panel.png'),fullPage:true,animations:'disabled'});
  await demo.screenshot({path:resolve(artifacts,'rehearsal.png'),fullPage:false,animations:'disabled'});
  const sidebar=await context.newPage();sidebar.on('pageerror',e=>failures.push(e.message));await sidebar.setViewportSize({width:320,height:850});await sidebar.goto(base+'sidebar.html?demo=1');
  assert.equal(await sidebar.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await sidebar.screenshot({path:resolve(artifacts,'sidebar-320.png'),fullPage:true,animations:'disabled'});
  const state=await worker.evaluate(async()=>await chrome.storage.local.get(['settings','rehearsalSettings','stats','rehearsal']));assert.deepEqual(state.settings.keywords,['javascript']);assert.equal(state.settings.enabled,false);assert.deepEqual(state.rehearsalSettings.keywords,['python','dsa']);
  checks.push('The extension-owned rehearsal works without live inference; a 320px sidebar has no horizontal overflow.');
  assert.deepEqual(failures,[]);await writeFile(resolve(artifacts,'browser-results.json'),JSON.stringify({checks,pageErrors:failures,source:'Authored DOM fixtures and mocked transport; no real YouTube/TypeSafe validation'},null,2));
  console.log(checks.map(x=>'PASS '+x).join('\n'));
}finally{await context.close();}
