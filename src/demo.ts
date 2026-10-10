import {samples} from './fixtures';
import {installed, rpc, onStateUpdate} from './client';
import type {PublicState} from './core';
const cards=document.getElementById('cards')!;

const art=(kind:number)=>kind===0?'<path d="M30 30h150v100H30z" fill="#303936"/><path d="m65 65-20 15 20 15m65-30 20 15-20 15m-25-38-15 65" fill="none" stroke="#b8d1c0" stroke-width="8" stroke-linecap="round"/>':kind===1?'<path d="M40 40c80 0 0 90 80 90s65-80 0-60" fill="none" stroke="#d0aa78" stroke-width="18" stroke-linecap="round"/><circle cx="153" cy="70" r="3" fill="#151515"/>':'<rect x="35" y="25" width="150" height="105" rx="8" fill="#343332"/><path d="M55 50h70m-70 20h110m-110 20h85m-85 20h55" stroke="#bdb5a8" stroke-width="5" stroke-linecap="round"/>';
function add(index:number) {
  const sample=samples[index%samples.length];const v=sample.video;
  const card=document.createElement('article');card.className='demo-video';card.dataset.studyCard='';
  const link=document.createElement('a');link.href=v.shorts?`https://www.youtube.com/shorts/${v.id}`:`https://www.youtube.com/watch?v=${v.id}`;
  // Fictional video links do not navigate away during a rehearsal.
  link.addEventListener('click',e=>e.preventDefault());
  const thumbnail=document.createElement('div');thumbnail.className='demo-thumbnail';thumbnail.innerHTML=`<svg viewBox="0 0 220 160" aria-hidden="true">${art(index%3)}</svg>`;
  const duration=document.createElement('span');duration.className='demo-duration';duration.dataset.studyDuration='';duration.textContent=v.duration;thumbnail.append(duration);
  const title=document.createElement('h3');title.dataset.studyTitle='';title.textContent=v.title;
  const channel=document.createElement('div');channel.className='channel';channel.dataset.studyChannel='';channel.textContent=v.channel;
  const description=document.createElement('span');description.hidden=true;description.dataset.studyDescription='';description.textContent=v.description;
  link.append(thumbnail,title,channel,description);card.append(link);cards.append(card);
}
samples.forEach((_,index)=>add(index));let added=0;
document.getElementById('add-card')!.addEventListener('click',()=>add(added++));
async function refresh(){const state:PublicState=await rpc('GET_STATE');document.getElementById('demo-keywords')!.textContent=state.rehearsalSettings.keywords.join(' · ') || 'General learning';const count=state.rehearsal.events.length;document.getElementById('demo-status')!.textContent=count?`${count} unique samples checked`:'Checking authored samples…';}
onStateUpdate(()=>{refresh().catch(()=>undefined);});refresh();
if(installed)document.querySelector('.demo-badge')!.textContent='Rehearsal · authored decisions';
