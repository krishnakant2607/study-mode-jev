import type {Video} from './core';
export const CARD_SELECTOR = 'ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,yt-lockup-view-model,[data-study-card]';
const TITLE_SELECTOR = '#video-title,#video-title-link,.yt-lockup-metadata-view-model__title,.yt-lockup-metadata-view-model-wiz__title,h3 a,h3,[data-study-title]';
function text(element: Element | null) {return (element?.textContent || '').replace(/\s+/g, ' ').trim();}
export function extractCard(card: Element): Video | null {
  const link = [...card.querySelectorAll<HTMLAnchorElement>('a[href]')].find(a => {
    try {const u = new URL(a.href, location.href); return u.pathname === '/watch' && u.searchParams.has('v') || /^\/shorts\/[^/]+/.test(u.pathname);} catch {return false;}
  });
  if (!link) return null;
  const url = new URL(link.href, location.href);
  const id = url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : url.searchParams.get('v');
  if (!id || !/^[a-zA-Z0-9_-]{3,80}$/.test(id)) return null;
  const titleElement = card.querySelector(TITLE_SELECTOR);
  const title = titleElement?.getAttribute('title') || text(titleElement) || link.getAttribute('title') || link.getAttribute('aria-label') || '';
  if (!title.trim()) return null;
  return {
    id, title: title.slice(0,500),
    channel: text(card.querySelector('ytd-channel-name a,#channel-name a,.yt-content-metadata-view-model__metadata-row a,.yt-content-metadata-view-model-wiz__metadata-row a,[data-study-channel]')).slice(0,200),
    description: text(card.querySelector('.metadata-snippet-text,#description-text,[data-study-description]')).slice(0,1000),
    duration: text(card.querySelector('ytd-thumbnail-overlay-time-status-renderer,.yt-badge-shape__text,.yt-badge-shape-wiz__text,[data-study-duration]')).slice(0,30),
    shorts: url.pathname.startsWith('/shorts/')
  };
}
export function findCards(root: ParentNode = document): Element[] {
  return [...root.querySelectorAll(CARD_SELECTOR)].filter(card => !card.parentElement?.closest(CARD_SELECTOR));
}
