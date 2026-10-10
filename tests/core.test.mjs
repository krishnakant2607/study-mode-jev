import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,cleanKeywords,matchesKeywords,cleanSettings,normalizeVideo,cacheKey,requestFor,parseJudgment,decide,newStats,record,summarize} from '../dist/test-modules/core.js';
import {samples,fixtureJudgment} from '../dist/test-modules/fixtures.js';
const video=samples[0].video;
const settings={...defaults,enabled:true,keywords:['Python']};
const good=samples[0].judgments.python;
test('Python intent keeps coding and covers snakes and programming memes',()=>{
  assert.equal(decide(fixtureJudgment(video,['Python']),video,settings,'rehearsal').kind,'allow');
  for(const index of [1,3])assert.equal(decide(fixtureJudgment(samples[index].video,['Python']),samples[index].video,settings,'rehearsal').reason,'entertainment');
});
test('off-topic education, uncertain evidence, clickbait and Shorts remain covered',()=>{
  assert.equal(decide(samples[4].judgments.python,samples[4].video,settings,'live').reason,'off_topic');
  assert.equal(decide({...good,sufficient:.5},video,settings,'live').reason,'uncertain');
  assert.equal(decide({...good,education:.79},video,settings,'live').reason,'uncertain');
  assert.equal(decide({...good,clickbait:.95},video,settings,'live').reason,'clickbait');
  assert.equal(decide(good,{...video,shorts:true},settings,'live').reason,'shorts');
  assert.equal(decide({...good,clickbait:.95},video,{...settings,hideClickbait:false},'live').kind,'allow');
});
test('general learning preserves educational entertainment without requiring a topic match',()=>{
  assert.equal(decide(samples[5].judgments.python,samples[5].video,{...settings,keywords:[]},'live').kind,'allow');
});
test('malformed or incomplete model answers never produce a permissive judgment',()=>{
  const answers=Object.fromEntries(Object.entries(good).map(([key,noul])=>[key,{type:'noul',noul}]));
  assert.deepEqual(parseJudgment({answers}),good);
  for(const bad of [NaN,Infinity,-.1,1.1,'0.98',undefined])assert.throws(()=>parseJudgment({answers:{...answers,education:{type:'noul',noul:bad}}}));
  assert.throws(()=>parseJudgment({answers:{education:{type:'noul',noul:1}}}));
});
test('topic, model and evidence invalidate cached judgments; policy toggles reuse judgments',()=>{
  const key=cacheKey(video,settings);
  assert.notEqual(key,cacheKey(video,{...settings,keywords:['JavaScript']}));
  assert.notEqual(key,cacheKey({...video,title:'Different video'},settings));
  assert.notEqual(key,cacheKey(video,{...settings,model:'jev-1.13.0'}));
  assert.equal(key,cacheKey(video,{...settings,hideClickbait:false}));
});
test('counts replace a repeated or changed decision rather than inflate checked videos',()=>{
  let stats=newStats();stats=record(stats,'same',{kind:'allow',source:'live'});stats=record(stats,'same',{kind:'cover',reason:'uncertain',source:'cache'});
  stats=record(stats,'other',{kind:'cover',reason:'entertainment',source:'live'});
  assert.equal(summarize(stats).checked,2);assert.equal(summarize(stats).covered,2);assert.equal(summarize(stats).uncertain,1);
  assert.ok(newStats().startedAt>stats.startedAt);
});
test('bounded metadata and explicit questions retain the intended state',()=>{
  assert.equal(cleanSettings({keywords:['  Python   programming ']}).keywords[0],'Python programming');
  assert.equal(cleanSettings(null).enabled,false);
  assert.throws(()=>normalizeVideo({id:'<script>',title:'bad'}));
  assert.equal(normalizeVideo({...video,title:'x'.repeat(1000)}).title.length,500);
  const request=requestFor(video,settings);assert.equal(request.state.learning_keywords[0],'Python');assert.equal(Object.keys(request.questions).length,5);
  assert.ok(request.questions.education.instructions.includes('untrusted'));
});

test('multiple keywords match any full keyword in metadata and still block matching entertainment',()=>{
  const multiple={...settings,keywords:['python','dsa']};
  assert.equal(decide(fixtureJudgment(samples[0].video,multiple.keywords),samples[0].video,multiple,'rehearsal').kind,'allow');
  assert.equal(decide(fixtureJudgment(samples[9].video,multiple.keywords),samples[9].video,multiple,'rehearsal').kind,'allow');
  assert.equal(decide(fixtureJudgment(samples[10].video,multiple.keywords),samples[10].video,multiple,'rehearsal').reason,'entertainment');
  assert.equal(matchesKeywords({...video,title:'Pythonic tools',channel:'Learn',description:''},['python']),false);
  assert.equal(matchesKeywords({...video,title:'C++ beginner guide',channel:'Learn',description:''},['c++']),true);
  assert.equal(matchesKeywords({...video,title:'Sorting lesson',description:'Worked DSA examples'},multiple.keywords),true);
  assert.deepEqual(cleanKeywords([' python ','PYTHON','dsa',null,'']),['python','dsa']);
  assert.deepEqual(cleanSettings({topic:'Python'}).keywords,['Python']);
  assert.equal(cacheKey(video,multiple),cacheKey(video,{...multiple,keywords:['DSA','PYTHON']}));
});
