import type {Judgment,Settings,Video} from './core';
export type Sample={video:Video;judgment:Judgment};
const useful:Judgment={entertainment:.03,preferred:0,excluded:0};
const fun:Judgment={entertainment:.98,preferred:0,excluded:0};
const v=(id:string,title:string,description:string,shorts=false,channel='FocusMaxx sample channel'):Video=>({id,title,description,shorts,channel,duration:shorts?'0:45':'14:32'});
export const samples:Sample[]=[
 {video:v('python_lesson','GraphRAG in Python: practical knowledge graphs','A worked programming demonstration.'),judgment:useful},
 {video:v('snake_video','Python snake behaviour: field observations','Wildlife research observations of movement and hunting.',false,'Wildlife Field Notes'),judgment:{...useful,entertainment:.15}},
 {video:v('pydantic_lesson','Pydantic AI crash course','A framework walkthrough for agent developers.'),judgment:useful},
 {video:v('coding_memes','Python developers react to programming memes','Funny reactions and jokes.'),judgment:fun},
 {video:v('javascript_lesson','LangGraph: agent workflows explained','A practical developer tool demonstration.'),judgment:useful},
 {video:v('music_video','Live music performance: evening session','A full musical performance.',false,'Music Sessions'),judgment:fun},
 {video:v('coding_short','One Python trick in sixty seconds','A short explanation of list slicing.',true),judgment:useful},
 {video:v('unclear_video','You need to see this…',''),judgment:{...useful,entertainment:.5}},
 {video:v('dramatic_lesson','This Python trick will BLOW YOUR MIND','An explained demonstration of generators.'),judgment:useful},
 {video:v('dsa_lesson','DSA: binary search and time complexity','Worked data structures and algorithms examples.'),judgment:useful},
 {video:v('dsa_memes','DSA interview memes that are too relatable','Funny interview reactions.',true),judgment:fun},
 {video:v('wildlife_short','Snake movement captured in the field','Wildlife observation without narration.',true,'Wildlife Field Notes'),judgment:{...useful,entertainment:.92}}
];
export function fixtureJudgment(video:Video,settings:Settings):Judgment{
 const sample=samples.find(s=>s.video.id===video.id&&s.video.title===video.title);if(!sample)throw new Error('No authored rehearsal judgment for this sample.');
 const j={...sample.judgment};
 // Explicit authored demonstration rules, never a substitute on real YouTube.
 if(/wildlife|animal|snake|documentar/i.test(settings.allowPreference)&&/snake|wildlife/i.test(video.title))j.preferred=.98;
 if(/music/i.test(settings.allowPreference)&&video.id==='music_video')j.preferred=.98;
 if(/music/i.test(settings.hidePreference)&&video.id==='music_video')j.excluded=.99;
 if(/memes|pranks/i.test(settings.hidePreference)&&/memes|pranks/i.test(video.title))j.excluded=.99;
 return j;
}
