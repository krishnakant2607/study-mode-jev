import test from 'node:test';
import assert from 'node:assert/strict';
let listener;let store={};const extensionId='abcdefghijklabcdefghijklabcdefgh';
globalThis.chrome={
  storage:{local:{setAccessLevel:async()=>{},get:async keys=>{const names=typeof keys==='string'?[keys]:keys;return Object.fromEntries(names.map(k=>[k,store[k]]));},set:async x=>{Object.assign(store,x);}}},
  runtime:{id:extensionId,getURL:path=>`chrome-extension://${extensionId}/${path}`,sendMessage:async()=>{},onMessage:{addListener:fn=>{listener=fn;}},onInstalled:{addListener:()=>{}}},
  tabs:{query:async()=>[],sendMessage:async()=>{},create:async()=>{}},sidePanel:{open:async()=>{}}
};
const panel={id:extensionId,url:`chrome-extension://${extensionId}/panel.html`};
const youtube={id:extensionId,url:'https://www.youtube.com/results?search_query=python',tab:{id:1}};
const rehearsal={id:extensionId,url:`chrome-extension://${extensionId}/demo.html`};
const video={id:'test_python',title:'Python functions tutorial',channel:'Learn',description:'Worked examples',duration:'10:00',shorts:false};
let calls=0;let fetcher=async()=>new Response(JSON.stringify({answers:Object.fromEntries(Object.entries({entertainment:.01,preferred:0,excluded:0}).map(([id,noul])=>[id,{type:'noul',noul}]))}),{status:200});
globalThis.fetch=async(...args)=>{calls++;return fetcher(...args);};
await import('../dist/background.js');
function send(type,extra={},sender=panel){return new Promise(resolve=>listener({type,...extra},sender,resolve));}
test('private credentials never enter the public state; unsupported origins are rejected',async()=>{
  assert.equal((await send('SAVE_KEY',{key:'dummy-test-key'})).ok,true);
  const state=await send('GET_STATE',{},youtube);assert.equal(state.data.hasKey,true);assert.ok(!JSON.stringify(state).includes('dummy-test-key'));
  assert.equal((await send('GET_STATE',{}, {id:extensionId,url:'https://evil.example',tab:{id:1}})).ok,false);
  assert.equal((await send('SAVE_SETTINGS',{settings:{enabled:true}},youtube)).ok,false);
});
test('concurrent duplicate cards share one live request and one counter',async()=>{
  await send('SAVE_SETTINGS',{settings:{enabled:true,keywords:['Python']}});const start=calls;
  const replies=await Promise.all(Array.from({length:5},()=>send('CLASSIFY',{video},youtube)));
  assert.ok(replies.every(x=>x.ok&&x.data.kind==='allow'));assert.equal(calls-start,1);
  assert.equal((await send('GET_STATE')).data.stats.events.length,1);
  await send('CLASSIFY',{video},youtube);assert.equal(calls-start,1);assert.ok(Object.keys(store.judgmentCache).length);
});
test('a response from an old topic never reveals or counts in the new session',async()=>{
  let resolveResponse;let started;const waiting=new Promise(resolve=>{started=resolve;});
  const goodFetcher=fetcher;fetcher=()=>{started();return new Promise(resolve=>{resolveResponse=resolve;});};
  const pending=send('CLASSIFY',{video:{...video,id:'old_topic'}},youtube);await waiting;
  await send('SAVE_SETTINGS',{settings:{keywords:['JavaScript']}});resolveResponse(await goodFetcher());
  const result=await pending;assert.equal(result.data.kind,'allow');assert.equal((await send('GET_STATE')).data.stats.events.length,0);fetcher=goodFetcher;
});
test('rehearsal settings and authored decisions are isolated from live settings and calls',async()=>{
  await send('SAVE_SETTINGS',{scope:'rehearsal',settings:{keywords:['Python'],enabled:true}});const start=calls;
  const fixture={id:'python_lesson',title:'GraphRAG in Python: practical knowledge graphs',channel:'The Coding Classroom',description:'A worked programming demonstration.',duration:'14:32',shorts:false};
  const result=await send('CLASSIFY',{video:fixture},rehearsal);assert.equal(result.data.source,'rehearsal');assert.equal(result.data.kind,'allow');assert.equal(calls,start);
  const state=(await send('GET_STATE')).data;assert.equal(state.settings.keywords[0],'JavaScript');assert.equal(state.rehearsalSettings.keywords[0],'Python');assert.equal(state.rehearsal.events.length,1);
});
test('missing key, rejected auth and malformed answers remain visible',async()=>{
  await send('SAVE_KEY',{key:''});let result=await send('CLASSIFY',{video:{...video,id:'missing_key',title:'JavaScript tutorial'}},youtube);assert.equal(result.data.reason,'connection');
  await send('SAVE_KEY',{key:'dummy-test-key'});const original=fetcher;
  fetcher=async()=>new Response('{}',{status:401});result=await send('CLASSIFY',{video:{...video,id:'rejected_auth',title:'JavaScript tutorial'}},youtube);assert.equal(result.data.kind,'allow');assert.match(store.connection.message,/rejected/);
  fetcher=async()=>new Response('{"answers":{}}',{status:200});result=await send('CLASSIFY',{video:{...video,id:'incomplete',title:'JavaScript tutorial'}},youtube);assert.equal(result.data.reason,'connection');fetcher=original;
});
test('a transient rate limit retries once; client cannot request fixture mode on YouTube',async()=>{
  let attempts=0;const original=fetcher;fetcher=async()=>++attempts===1?new Response('{}',{status:429}):original();
  const result=await send('CLASSIFY',{video:{...video,id:'rate_limit',title:'JavaScript tutorial'},rehearsal:true},youtube);assert.equal(result.data.source,'live');assert.equal(attempts,2);fetcher=original;
});

test('a failed repeat connection test clears previously verified status',async()=>{
  await send('TEST_CONNECTION');assert.equal(store.connection.ok,true);
  const original=fetcher;fetcher=async()=>new Response('{}',{status:401});
  assert.equal((await send('TEST_CONNECTION')).ok,false);assert.equal(store.connection.ok,false);fetcher=original;
});
test('removing a key invalidates pending requests and prevents cache or connection resurrection',async()=>{
  await send('SAVE_KEY',{key:'dummy-test-key'});await send('RESET_SESSION');
  let resolveResponse;let started;const waiting=new Promise(resolve=>{started=resolve;});
  const original=fetcher;fetcher=()=>{started();return new Promise(resolve=>{resolveResponse=resolve;});};
  const pending=send('CLASSIFY',{video:{...video,id:'removed_key_pending',title:'JavaScript tutorial'}},youtube);await waiting;
  await send('SAVE_KEY',{key:''});resolveResponse(await original());
  assert.equal((await pending).data.kind,'allow');assert.equal(store.connection.ok,false);
  assert.deepEqual(store.judgmentCache,{});assert.equal(store.stats.events.length,0);fetcher=original;
});

test('nonmatching keywords do not bypass Jev or cover useful content',async()=>{
  await send('SAVE_KEY',{key:'dummy-test-key'});await send('SAVE_SETTINGS',{settings:{keywords:['python','dsa'],enabled:true}});
  const before=calls;const result=await send('CLASSIFY',{video:{...video,id:'unrelated_lesson',title:'Pydantic AI framework course'}},youtube);
  assert.equal(result.data.kind,'allow');assert.equal(result.data.source,'live');assert.equal(calls,before+1);
});
