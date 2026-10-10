import type {Video} from './core';
export const CARD_SELECTOR='ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,yt-lockup-view-model,ytd-reel-item-renderer,yt-shorts-lockup-view-model,ytm-shorts-lockup-view-model,ytm-shorts-lockup-view-model-v2,ytd-reel-video-renderer,[data-study-card]';
const TITLE_SELECTOR='#video-title,#video-title-link,.yt-lockup-metadata-view-model__title,.yt-lockup-metadata-view-model-wiz__title,.shortsLockupViewModelHostMetadataTitle,.ytShortsLockupViewModelHostMetadataTitle,#title h2,#title yt-formatted-string,h3 a,h3,[data-study-title]';
function text(e:Element|null){return (e?.textContent||'').replace(/\s+/g,' ').trim();}
function channelContext(){return text(document.querySelector('ytd-channel-header-renderer #channel-name,.yt-page-header-view-model__page-header-title,yt-page-header-renderer h1,ytd-c4-tabbed-header-renderer #channel-name')).slice(0,200);}
export function extractCard(card:Element):Video|null{
 const player=card.matches('ytd-reel-video-renderer');
 if(player&&!card.hasAttribute('is-active')&&!card.hasAttribute('active')){
  const rect=card.getBoundingClientRect();if(rect.bottom<=0||rect.top>=innerHeight||rect.height===0)return null;
 }
 const link=[...card.querySelectorAll<HTMLAnchorElement>('a[href]'),...(card instanceof HTMLAnchorElement?[card]:[])].find(a=>{try{const u=new URL(a.href,location.href);return u.pathname==='/watch'&&u.searchParams.has('v')||/^\/shorts\/[^/]+/.test(u.pathname);}catch{return false;}});
 let url:URL|undefined;if(link)url=new URL(link.href,location.href);else if(player&&location.pathname.startsWith('/shorts/'))url=new URL(location.href);
 if(!url)return null;
 const id=player?(card.getAttribute('video-id')||url.pathname.split('/')[2]):url.pathname.startsWith('/shorts/')?url.pathname.split('/')[2]:url.searchParams.get('v');
 if(!id||!/^[a-zA-Z0-9_-]{3,80}$/.test(id))return null;
 const titleNode=card.querySelector(TITLE_SELECTOR);const title=titleNode?.getAttribute('title')||text(titleNode)||link?.getAttribute('title')||link?.getAttribute('aria-label')||card.querySelector('a[aria-label]')?.getAttribute('aria-label')||'';
 if(!title.trim())return null;
 const context=channelContext();
 return {id,title:title.slice(0,500),channel:(text(card.querySelector('ytd-channel-name a,#channel-name a,#channel-name,.yt-content-metadata-view-model__metadata-row a,.yt-content-metadata-view-model-wiz__metadata-row a,[data-study-channel]'))||context).slice(0,200),description:text(card.querySelector('.metadata-snippet-text,#description-text,[data-study-description]')).slice(0,1000),duration:text(card.querySelector('ytd-thumbnail-overlay-time-status-renderer,.yt-badge-shape__text,.yt-badge-shape-wiz__text,[data-study-duration]')).slice(0,30),shorts:player||url.pathname.startsWith('/shorts/'),pageContext:context?`Channel page: ${context}`:''};
}
export function findCards(root:ParentNode=document):Element[]{
 const candidates=[...root.querySelectorAll(CARD_SELECTOR)];
 // Cover standalone Shorts links in layouts that have no known renderer wrapper.
 for(const a of root.querySelectorAll<HTMLAnchorElement>('a[href*="/shorts/"]'))if(!a.closest(CARD_SELECTOR)&&a.querySelector('img,yt-image'))candidates.push(a);
 return candidates.filter(card=>!card.parentElement?.closest(CARD_SELECTOR));
}
