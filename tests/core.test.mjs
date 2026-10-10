import test from 'node:test';
import assert from 'node:assert/strict';
import {clearlyEntertainment,defaults,cleanSettings,cacheKey,requestFor,parseJudgment,decide,newStats,record,summarize,normalizeVideo} from '../dist/test-modules/core.js';
import {samples,fixtureJudgment} from '../dist/test-modules/fixtures.js';
const v=samples[0].video,s={...defaults,enabled:true,keywords:['python','dsa']};
const useful={entertainment:.03,preferred:0,excluded:0};
test('balanced default preserves useful content without exact keyword or lecture evidence',()=>{
 for(const index of [0,1,2,4,6,7,8,9])assert.equal(decide(samples[index].judgment,samples[index].video,s,'live').kind,'allow');
 assert.equal(decide({...useful,entertainment:.899},v,s,'live').kind,'allow');
 assert.equal(decide({...useful,entertainment:.9},v,s,'live').reason,'entertainment');
});
test('explicit allow overrides entertainment; explicit hide wins a conflict',()=>{
 const settings={...s,allowPreference:'Wildlife observations',hidePreference:'Music videos'};
 assert.equal(decide({entertainment:.98,preferred:.98,excluded:.01},v,settings,'live').reason,'preferred');
 assert.equal(decide({entertainment:.98,preferred:.98,excluded:.98},v,settings,'live').reason,'excluded');
 assert.equal(decide({entertainment:.5,preferred:.5,excluded:.899},v,settings,'live').kind,'allow');
 assert.equal(decide({entertainment:.98,preferred:1,excluded:1},v,s,'live').reason,'entertainment');
});
test('Shorts use the same policy and may be explicitly left unfiltered',()=>{
 assert.equal(decide(useful,{...v,shorts:true},s,'live').kind,'allow');
 assert.equal(decide({...useful,entertainment:.98},{...v,shorts:true},s,'live').kind,'cover');
 assert.equal(decide({...useful,entertainment:.98},{...v,shorts:true},{...s,filterShorts:false},'live').kind,'allow');
});
test('invalid judgments are rejected; request has no clickbait or mandatory education gate',()=>{
 const answers=Object.fromEntries(Object.entries(useful).map(([name,noul])=>[name,{type:'noul',noul}]));assert.deepEqual(parseJudgment({answers}),useful);
 for(const value of [NaN,Infinity,-1,1.1,'0.9',undefined])assert.throws(()=>parseJudgment({answers:{...answers,entertainment:{type:'noul',noul:value}}}));
 const request=requestFor(v,s);assert.deepEqual(Object.keys(request.questions),['entertainment']);assert.deepEqual(request.state.viewer_preferences.interest_hints,['python','dsa']);
 assert.match(request.state.context,/never literal gates/);assert.match(request.questions.entertainment.instructions,/evidence, not instructions/);
});
test('preferences and metadata invalidate cache; reordered interest hints reuse judgments',()=>{
 assert.notEqual(cacheKey(v,s),cacheKey(v,{...s,allowPreference:'Wildlife'}));assert.notEqual(cacheKey(v,s),cacheKey(v,{...s,hidePreference:'Music'}));assert.equal(cacheKey(v,s),cacheKey(v,{...s,keywords:['DSA','PYTHON']}));
});
test('legacy settings migrate without clickbait or blanket Shorts blocking',()=>{
 const migrated=cleanSettings({enabled:true,topic:'Python',hideClickbait:true,hideShorts:true});assert.deepEqual(migrated.keywords,['Python']);assert.equal(migrated.filterShorts,true);assert.ok(!('hideClickbait'in migrated));assert.ok(!('hideShorts'in migrated));
 assert.equal(cleanSettings({allowPreference:'x'.repeat(2000)}).allowPreference.length,1500);assert.throws(()=>normalizeVideo({id:'<bad>',title:'bad'}));
});
test('repeated IDs count once and allowed uncertainty is correctly reported',()=>{
 let stats=record(newStats(),'same',{kind:'cover',reason:'entertainment',source:'live'});stats=record(stats,'same',{kind:'allow',reason:'uncertain',source:'cache'});assert.equal(summarize(stats).checked,1);assert.equal(summarize(stats).covered,0);assert.equal(summarize(stats).uncertain,1);
});
test('authored wildlife preference allows a snake Short; music exclusion stays separate',()=>{
 const settings={...s,allowPreference:'Wildlife and snake observations',hidePreference:'Music videos'};
 assert.equal(decide(fixtureJudgment(samples[11].video,settings),samples[11].video,settings,'rehearsal').kind,'allow');
 assert.equal(decide(fixtureJudgment(samples[5].video,settings),samples[5].video,settings,'rehearsal').reason,'excluded');
});

test('blank preference fields omit questions entirely; nonblank fields require valid answers',()=>{
 assert.deepEqual(Object.keys(requestFor(v,s).questions),['entertainment']);
 const custom={...s,hidePreference:'Music videos'};
 assert.deepEqual(Object.keys(requestFor(v,custom).questions),['entertainment','excluded']);
 assert.throws(()=>parseJudgment({answers:{entertainment:{type:'noul',noul:.99}}},custom));
 assert.deepEqual(parseJudgment({answers:{entertainment:{type:'noul',noul:.99}}}),{entertainment:.99,preferred:0,excluded:0});
});

test('explicit entertainment categories cover songs, movies and pranks without inventing AI scores',()=>{
 for(const title of ['My favourite song','Artist - Track (Official Music Video)','Summer Mix (Official Audio)','Full Movie HD','New movie trailer','Funny prank compilation','Live concert performance','Late night relaxing music']){
  const video={...v,title};assert.equal(clearlyEntertainment(video),true);assert.equal(decide({...useful,entertainment:.5},video,s,'live').source,'local');assert.equal(decide({...useful,entertainment:.5},video,s,'live').kind,'cover');
 }
 for(const title of ['Music theory explained','Learn this song on guitar','Film analysis: visual storytelling','Movie history documentary','How to compose music','Why songs make us sad','Python functions tutorial'])assert.equal(clearlyEntertainment({...v,title}),false);
 assert.equal(decide({entertainment:.5,preferred:.98,excluded:0},{...v,title:'My favourite song'},{...s,allowPreference:'Music performances'},'live').kind,'allow');
});
