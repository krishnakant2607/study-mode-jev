import type {Judgment, Video} from './core';
export type Sample = {video: Video; judgments: Record<string, Judgment>};
const yes: Judgment = {education: .98, entertainment: .02, relevance: .98, clickbait: .03, sufficient: .99};
const fun: Judgment = {education: .02, entertainment: .99, relevance: .02, clickbait: .65, sufficient: .98};
export const samples: Sample[] = [
  {video: {id: 'python_lesson', title: 'Python functions, explained with real examples', channel: 'The Coding Classroom', description: 'Learn parameters, return values and reusable functions.', duration: '14:32', shorts: false}, judgments: {python: yes, javascript: {...yes, relevance: .08}}},
  {video: {id: 'snake_video', title: 'Giant python surprises everyone at the zoo', channel: 'Wild Moments', description: 'An unexpected animal encounter.', duration: '8:12', shorts: false}, judgments: {python: fun, javascript: fun}},
  {video: {id: 'python_project', title: 'Build a Python expense tracker from scratch', channel: 'Build & Learn', description: 'A practical project covering CSV files and functions.', duration: '28:45', shorts: false}, judgments: {python: yes, javascript: {...yes, relevance: .05}}},
  {video: {id: 'coding_memes', title: 'Python developers react to programming memes', channel: 'After Hours', description: 'Funny reactions and jokes.', duration: '11:06', shorts: false}, judgments: {python: {...fun, relevance: .9}, javascript: fun}},
  {video: {id: 'javascript_lesson', title: 'JavaScript closures: a visual explanation', channel: 'The Coding Classroom', description: 'Understand lexical scope through worked examples.', duration: '17:20', shorts: false}, judgments: {python: {...yes, relevance: .05}, javascript: yes}},
  {video: {id: 'physics_lesson', title: 'The physics behind impossible basketball shots', channel: 'Everyday Science', description: 'An entertaining explanation of projectile motion.', duration: '12:40', shorts: false}, judgments: {python: {...yes, relevance: .03}, javascript: {...yes, relevance: .03}}},
  {video: {id: 'coding_short', title: 'One Python trick in sixty seconds', channel: 'Quick Code', description: 'A short demonstration of list slicing.', duration: '0:59', shorts: true}, judgments: {python: yes, javascript: {...yes, relevance: .02}}},
  {video: {id: 'unclear_video', title: 'You need to see this…', channel: 'Something New', description: '', duration: '9:15', shorts: false}, judgments: {python: {...yes, education: .5, sufficient: .25, relevance: .5}, javascript: {...yes, education: .5, sufficient: .25, relevance: .5}}},
  {video: {id: 'riches_video', title: 'Learn Python and get RICH overnight — the secret method', channel: 'Shortcut Academy', description: 'Big promises with no clear lesson.', duration: '10:10', shorts: false}, judgments: {python: {...yes, education: .85, clickbait: .99}, javascript: {...yes, relevance: .02, clickbait: .99}}},
  {video: {id:'dsa_lesson',title:'DSA: binary search and time complexity explained',channel:'Algorithm Classroom',description:'Learn data structures and algorithms through worked examples.',duration:'21:05',shorts:false},judgments:{python:{...yes,relevance:.02},javascript:{...yes,relevance:.02},dsa:yes}},
  {video: {id:'dsa_memes',title:'DSA interview memes that are too relatable',channel:'After Hours',description:'Funny interview reactions.',duration:'7:40',shorts:false},judgments:{python:fun,javascript:fun,dsa:{...fun,relevance:.99}}}

];
export function fixtureJudgment(v: Video, keywords: string[]): Judgment {
  const sample = samples.find(s => s.video.id === v.id && s.video.title === v.title);
  if (!sample) throw new Error('This item has no authored rehearsal judgment.');
  if (!keywords.length) return {...sample.judgments.python, relevance: .98};
  const choices = keywords.map(k => sample.judgments[k.toLowerCase()]).filter(Boolean);
  if (choices.length) return {...sample.judgments.python, relevance:Math.max(...choices.map(j=>j.relevance))};
  return {...sample.judgments.python, relevance:.5, sufficient:.5};
}
