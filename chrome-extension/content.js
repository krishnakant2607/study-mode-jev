"use strict";
(() => {
  // src/core.ts
  var DEFAULT_MODEL = "jev-latest";
  var BLOCK_THRESHOLD = 0.9;
  var defaults = { enabled: false, keywords: [], allowPreference: "", hidePreference: "", filterShorts: true, model: DEFAULT_MODEL };
  var sessionClock = 0;
  var newStats = () => ({ startedAt: sessionClock = Math.max(Date.now(), sessionClock + 1), events: [] });
  function cleanKeywords(raw) {
    const unique = /* @__PURE__ */ new Map();
    for (const value of raw) if (typeof value === "string") {
      const k = value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 60);
      if (k && !unique.has(k.toLowerCase())) unique.set(k.toLowerCase(), k);
    }
    return [...unique.values()].slice(0, 20);
  }
  function cleanSettings(raw, base = defaults) {
    const v2 = raw && typeof raw === "object" ? raw : {};
    const preference = (x, fallback) => typeof x === "string" ? x.trim().slice(0, 1500) : fallback;
    return { enabled: typeof v2.enabled === "boolean" ? v2.enabled : base.enabled, keywords: Array.isArray(v2.keywords) ? cleanKeywords(v2.keywords) : typeof v2.topic === "string" ? cleanKeywords([v2.topic]) : [...base.keywords], allowPreference: preference(v2.allowPreference, base.allowPreference), hidePreference: preference(v2.hidePreference, base.hidePreference), filterShorts: typeof v2.filterShorts === "boolean" ? v2.filterShorts : base.filterShorts, model: typeof v2.model === "string" && /^jev-[a-zA-Z0-9.-]{1,40}$/.test(v2.model) ? v2.model : base.model };
  }
  function normalizeVideo(raw) {
    const v2 = raw;
    if (!v2 || typeof v2.id !== "string" || !/^[a-zA-Z0-9_-]{3,80}$/.test(v2.id) || typeof v2.title !== "string") throw new Error("Invalid video metadata.");
    const text2 = (x, n) => typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, n) : "";
    return { id: v2.id, title: text2(v2.title, 500), channel: text2(v2.channel, 200), description: text2(v2.description, 1e3), duration: text2(v2.duration, 30), shorts: v2.shorts === true, pageContext: text2(v2.pageContext, 300) };
  }
  function decide(j, v2, s, source) {
    if (v2.shorts && !s.filterShorts) return { kind: "allow", source: "local" };
    if (s.hidePreference && j.excluded >= BLOCK_THRESHOLD) return { kind: "cover", reason: "excluded", source, judgment: j };
    if (s.allowPreference && j.preferred >= BLOCK_THRESHOLD) return { kind: "allow", reason: "preferred", source, judgment: j };
    if (j.entertainment >= BLOCK_THRESHOLD) return { kind: "cover", reason: "entertainment", source, judgment: j };
    return { kind: "allow", reason: j.entertainment > 0.1 ? "uncertain" : void 0, source, judgment: j };
  }
  function record(stats, id, d, at = Date.now()) {
    const event = { id, kind: d.kind, reason: d.reason, at, source: d.source, latencyMs: d.latencyMs };
    const events = [...stats.events];
    const index = events.findIndex((e) => e.id === id);
    if (index >= 0) events[index] = event;
    else events.push(event);
    return { ...stats, events: events.slice(-1500) };
  }
  var reasonLabel = { entertainment: "Entertainment", excluded: "Matches your hide preference", preferred: "Matches your allow preference", uncertain: "Uncertain \xB7 kept visible", connection: "Unavailable \xB7 kept visible" };

  // src/detector.ts
  var CARD_SELECTOR = "ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,yt-lockup-view-model,ytd-reel-item-renderer,yt-shorts-lockup-view-model,ytm-shorts-lockup-view-model,ytm-shorts-lockup-view-model-v2,ytd-reel-video-renderer,[data-study-card]";
  var TITLE_SELECTOR = "#video-title,#video-title-link,.yt-lockup-metadata-view-model__title,.yt-lockup-metadata-view-model-wiz__title,.shortsLockupViewModelHostMetadataTitle,.ytShortsLockupViewModelHostMetadataTitle,#title h2,#title yt-formatted-string,h3 a,h3,[data-study-title]";
  function text(e) {
    return (e?.textContent || "").replace(/\s+/g, " ").trim();
  }
  function channelContext() {
    return text(document.querySelector("ytd-channel-header-renderer #channel-name,.yt-page-header-view-model__page-header-title,yt-page-header-renderer h1,ytd-c4-tabbed-header-renderer #channel-name")).slice(0, 200);
  }
  function extractCard(card) {
    const player = card.matches("ytd-reel-video-renderer");
    if (player && !card.hasAttribute("is-active") && !card.hasAttribute("active")) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.height === 0) return null;
    }
    const link = [...card.querySelectorAll("a[href]"), ...card instanceof HTMLAnchorElement ? [card] : []].find((a) => {
      try {
        const u = new URL(a.href, location.href);
        return u.pathname === "/watch" && u.searchParams.has("v") || /^\/shorts\/[^/]+/.test(u.pathname);
      } catch {
        return false;
      }
    });
    let url;
    if (link) url = new URL(link.href, location.href);
    else if (player && location.pathname.startsWith("/shorts/")) url = new URL(location.href);
    if (!url) return null;
    const id = player ? card.getAttribute("video-id") || url.pathname.split("/")[2] : url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
    if (!id || !/^[a-zA-Z0-9_-]{3,80}$/.test(id)) return null;
    const titleNode = card.querySelector(TITLE_SELECTOR);
    const title = titleNode?.getAttribute("title") || text(titleNode) || link?.getAttribute("title") || link?.getAttribute("aria-label") || card.querySelector("a[aria-label]")?.getAttribute("aria-label") || "";
    if (!title.trim()) return null;
    const context = channelContext();
    return { id, title: title.slice(0, 500), channel: (text(card.querySelector("ytd-channel-name a,#channel-name a,#channel-name,.yt-content-metadata-view-model__metadata-row a,.yt-content-metadata-view-model-wiz__metadata-row a,[data-study-channel]")) || context).slice(0, 200), description: text(card.querySelector(".metadata-snippet-text,#description-text,[data-study-description]")).slice(0, 1e3), duration: text(card.querySelector("ytd-thumbnail-overlay-time-status-renderer,.yt-badge-shape__text,.yt-badge-shape-wiz__text,[data-study-duration]")).slice(0, 30), shorts: player || url.pathname.startsWith("/shorts/"), pageContext: context ? `Channel page: ${context}` : "" };
  }
  function findCards(root = document) {
    const candidates = [...root.querySelectorAll(CARD_SELECTOR)];
    for (const a of root.querySelectorAll('a[href*="/shorts/"]')) if (!a.closest(CARD_SELECTOR) && a.querySelector("img,yt-image")) candidates.push(a);
    return candidates.filter((card) => !card.parentElement?.closest(CARD_SELECTOR));
  }

  // src/fixtures.ts
  var useful = { entertainment: 0.03, preferred: 0, excluded: 0 };
  var fun = { entertainment: 0.98, preferred: 0, excluded: 0 };
  var v = (id, title, description, shorts = false, channel = "FocusMaxx sample channel") => ({ id, title, description, shorts, channel, duration: shorts ? "0:45" : "14:32" });
  var samples = [
    { video: v("python_lesson", "GraphRAG in Python: practical knowledge graphs", "A worked programming demonstration."), judgment: useful },
    { video: v("snake_video", "Python snake behaviour: field observations", "Wildlife research observations of movement and hunting.", false, "Wildlife Field Notes"), judgment: { ...useful, entertainment: 0.15 } },
    { video: v("pydantic_lesson", "Pydantic AI crash course", "A framework walkthrough for agent developers."), judgment: useful },
    { video: v("coding_memes", "Python developers react to programming memes", "Funny reactions and jokes."), judgment: fun },
    { video: v("javascript_lesson", "LangGraph: agent workflows explained", "A practical developer tool demonstration."), judgment: useful },
    { video: v("music_video", "Live music performance: evening session", "A full musical performance.", false, "Music Sessions"), judgment: fun },
    { video: v("coding_short", "One Python trick in sixty seconds", "A short explanation of list slicing.", true), judgment: useful },
    { video: v("unclear_video", "You need to see this\u2026", ""), judgment: { ...useful, entertainment: 0.5 } },
    { video: v("dramatic_lesson", "This Python trick will BLOW YOUR MIND", "An explained demonstration of generators."), judgment: useful },
    { video: v("dsa_lesson", "DSA: binary search and time complexity", "Worked data structures and algorithms examples."), judgment: useful },
    { video: v("dsa_memes", "DSA interview memes that are too relatable", "Funny interview reactions.", true), judgment: fun },
    { video: v("wildlife_short", "Snake movement captured in the field", "Wildlife observation without narration.", true, "Wildlife Field Notes"), judgment: { ...useful, entertainment: 0.92 } }
  ];
  function fixtureJudgment(video, settings2) {
    const sample = samples.find((s) => s.video.id === video.id && s.video.title === video.title);
    if (!sample) throw new Error("No authored rehearsal judgment for this sample.");
    const j = { ...sample.judgment };
    if (/wildlife|animal|snake|documentar/i.test(settings2.allowPreference) && /snake|wildlife/i.test(video.title)) j.preferred = 0.98;
    if (/music/i.test(settings2.allowPreference) && video.id === "music_video") j.preferred = 0.98;
    if (/music/i.test(settings2.hidePreference) && video.id === "music_video") j.excluded = 0.99;
    if (/memes|pranks/i.test(settings2.hidePreference) && /memes|pranks/i.test(video.title)) j.excluded = 0.99;
    return j;
  }

  // src/client.ts
  var installed = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  var PREVIEW_KEY = "focusmaxx-rehearsal-v3";
  function readPreview() {
    try {
      const stored = localStorage.getItem(PREVIEW_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        state.settings = cleanSettings(state.settings);
        state.rehearsalSettings = cleanSettings(state.rehearsalSettings);
        return state;
      }
    } catch {
    }
    return { settings: { ...defaults }, rehearsalSettings: { ...defaults, enabled: true, keywords: ["python"] }, hasKey: false, stats: newStats(), rehearsal: newStats(), connection: { ok: false, message: "Rehearsal \xB7 authored decisions, no live inference", at: 0 } };
  }
  function writePreview(state) {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(state));
    dispatchEvent(new CustomEvent("study-preview-update", { detail: state }));
  }
  async function rpc(type, extra = {}) {
    if (installed) {
      const result = await chrome.runtime.sendMessage({ type, ...extra });
      if (!result?.ok) throw new Error(result?.error || "Extension unavailable. Reload the page.");
      return result.data;
    }
    const state = readPreview();
    if (type === "PAGE_STATUS") return { message: "This is the authored rehearsal. Use Check this YouTube page in the installed extension on a real YouTube tab." };
    if (type === "GET_STATE") return state;
    if (type === "SAVE_SETTINGS") {
      const rehearsal = extra.scope === "rehearsal";
      const base = rehearsal ? state.rehearsalSettings : state.settings;
      const settings2 = cleanSettings(extra.settings || {}, base);
      if (JSON.stringify(settings2) !== JSON.stringify(base)) state[rehearsal ? "rehearsal" : "stats"] = newStats();
      state[rehearsal ? "rehearsalSettings" : "settings"] = settings2;
      writePreview(state);
      return state;
    }
    if (type === "RESET_SESSION") {
      state[extra.scope === "rehearsal" ? "rehearsal" : "stats"] = newStats();
      writePreview(state);
      return state;
    }
    if (type === "CLASSIFY") {
      const video = normalizeVideo(extra.video);
      const decision = decide(fixtureJudgment(video, state.rehearsalSettings), video, state.rehearsalSettings, "rehearsal");
      state.rehearsal = record(state.rehearsal, video.id, decision);
      writePreview(state);
      return decision;
    }
    if (type === "OPEN_DEMO") {
      window.open("demo.html", "_blank", "noopener");
      return { ok: true };
    }
    if (type === "OPEN_SIDEBAR") {
      window.open("sidebar.html", "_blank", "noopener");
      return { ok: true };
    }
    if (type === "RETRY") {
      writePreview(state);
      return state;
    }
    if (type === "OPEN_YOUTUBE") {
      window.open("https://www.youtube.com/results?search_query=" + encodeURIComponent(state.settings.keywords.join(" OR ") || "educational tutorials"), "_blank", "noopener");
      return { ok: true };
    }
    throw new Error("This is a local rehearsal. Connect your key in the installed Chrome extension.");
  }

  // src/content.ts
  var settings;
  var enabled = false;
  var epoch = 0;
  var active = 0;
  var scanning = false;
  var scheduled;
  var tracked = /* @__PURE__ */ new Map();
  var queue = [];
  var decisions = /* @__PURE__ */ new Map();
  var isDemo = location.pathname.endsWith("/demo.html") && location.hostname !== "www.youtube.com";
  var send = rpc;
  function cover(card, label, reason = "pending") {
    card.classList.add("study-covered");
    card.setAttribute("data-study-reason", reason);
    const row = tracked.get(card);
    let overlay = row?.overlay || card.querySelector(":scope > .study-cover");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "study-cover";
      overlay.innerHTML = '<span class="study-cover-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 6h5v12H5zm9 0h5v12h-5z" fill="currentColor"/></svg></span><strong></strong><span class="study-cover-sub"></span>';
      card.append(overlay);
      if (row) row.overlay = overlay;
    }
    overlay.querySelector("strong").textContent = label;
    overlay.querySelector(".study-cover-sub").textContent = reason === "pending" ? "FocusMaxx checks your preferences" : "FocusMaxx keeps distractions out";
    for (const child of [...card.children]) if (child !== overlay) {
      if (!child.hasAttribute("data-study-original-inert")) child.setAttribute("data-study-original-inert", child.hasAttribute("inert") ? "1" : "0");
      child.setAttribute("inert", "");
    }
  }
  function reveal(card) {
    card.classList.remove("study-covered");
    card.removeAttribute("data-study-reason");
    card.querySelector(":scope > .study-cover")?.remove();
    const row = tracked.get(card);
    if (row) row.overlay = void 0;
    for (const child of [...card.children]) {
      const previous = child.getAttribute("data-study-original-inert");
      if (previous === "0") child.removeAttribute("inert");
      child.removeAttribute("data-study-original-inert");
    }
  }
  function apply(card, d) {
    if (d.kind === "allow") reveal(card);
    else {
      cover(card, d.reason ? reasonLabel[d.reason] : "Hidden by FocusMaxx", d.reason || "entertainment");
      for (const video of card.querySelectorAll("video")) video.pause();
    }
  }
  function visible(card) {
    const rect = card.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > -200 && rect.top < innerHeight + 500;
  }
  function enqueue(card) {
    const row = tracked.get(card);
    if (!row || row.queued || !visible(card)) return;
    row.queued = true;
    queue.push(card);
    pump();
  }
  async function pump() {
    while (enabled && active < 3 && queue.length) {
      const card = queue.shift();
      const row = tracked.get(card);
      if (!row || !card.isConnected || row.epoch !== epoch) continue;
      const signature = row.signature;
      const requestEpoch = epoch;
      const video = row.video;
      active++;
      send("CLASSIFY", { video }).then((decision) => {
        const current = tracked.get(card);
        if (!enabled || requestEpoch !== epoch || current?.signature !== signature || !card.isConnected) return;
        if (JSON.stringify(extractCard(card)) !== JSON.stringify(video)) {
          schedule();
          return;
        }
        decisions.set(signature, decision);
        apply(card, decision);
      }).catch(() => {
        if (enabled && requestEpoch === epoch && tracked.get(card)?.signature === signature) reveal(card);
      }).finally(() => {
        active--;
        pump();
      });
    }
  }
  function scan() {
    if (scanning || !document.body) return;
    scanning = true;
    try {
      for (const [card] of tracked) if (!card.isConnected) {
        tracked.delete(card);
        observer.unobserve(card);
      }
      if (!enabled) {
        for (const card of document.querySelectorAll(".study-covered")) reveal(card);
        return;
      }
      for (const card of findCards()) {
        const video = extractCard(card);
        if (!video) {
          reveal(card);
          continue;
        }
        const signature = JSON.stringify(video);
        const old = tracked.get(card);
        if (old?.signature === signature && old.epoch === epoch) {
          if (!old.queued) enqueue(card);
          continue;
        }
        const row = { video, signature, epoch, queued: false };
        tracked.set(card, row);
        const known = decisions.get(signature);
        if (known) {
          apply(card, known);
          row.queued = true;
        } else {
          reveal(card);
          observer.observe(card);
          enqueue(card);
        }
      }
    } finally {
      scanning = false;
    }
  }
  function schedule() {
    clearTimeout(scheduled);
    scheduled = setTimeout(scan, 100);
  }
  var observer = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) enqueue(entry.target);
  }, { rootMargin: "500px" });
  function stateChanged(state) {
    settings = isDemo ? state.rehearsalSettings : state.settings;
    enabled = settings.enabled;
    epoch++;
    queue.length = 0;
    decisions.clear();
    for (const card of document.querySelectorAll(".study-covered")) reveal(card);
    tracked.clear();
    observer.disconnect();
    document.documentElement.classList.toggle("study-mode-active", enabled);
    scan();
  }
  function protect(event) {
    if (!enabled || !(event.target instanceof Element)) return;
    if (event.target.closest(".study-covered")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  for (const event of ["click", "pointerover", "mouseover", "focusin"]) document.addEventListener(event, protect, true);
  document.addEventListener("yt-navigate-finish", schedule);
  document.addEventListener("play", (event) => {
    if (enabled && event.target instanceof HTMLVideoElement && event.target.closest(".study-covered")) event.target.pause();
  }, true);
  document.addEventListener("DOMContentLoaded", schedule);
  document.addEventListener("scroll", schedule, { passive: true });
  var mutations = new MutationObserver((records) => {
    const relevant = records.filter((r) => !(r.target instanceof Element) || !r.target.closest(".study-cover"));
    if (!relevant.length) return;
    if (enabled) {
      for (const [card, row] of tracked) if (card.isConnected && JSON.stringify(extractCard(card)) !== row.signature) reveal(card);
    }
    schedule();
  });
  mutations.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href", "title", "aria-label", "video-id", "is-active", "active"] });
  if (installed) chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message.type === "STUDY_STATE") stateChanged(message.state);
    if (message.type === "FOCUS_PAGE_STATUS") {
      const cards = findCards();
      const results = [...decisions.entries()];
      const samples2 = results.filter(([, d]) => d.kind === "allow" && d.judgment).sort((a, b) => b[1].judgment.entertainment - a[1].judgment.entertainment).slice(0, 5).map(([signature, d]) => ({ title: JSON.parse(signature).title, judgment: d.judgment }));
      reply({ enabled, recognized: cards.length, readable: cards.filter((c) => extractCard(c)).length, evaluated: results.length, covered: cards.filter((c) => c.classList.contains("study-covered")).length, unavailable: results.filter(([, d]) => d.reason === "connection").length, pending: queue.length + active, samples: samples2 });
    }
  });
  send("GET_STATE").then(stateChanged).catch(() => {
    for (const card of document.querySelectorAll(".study-covered")) reveal(card);
  });
  if (isDemo && installed) chrome.storage.onChanged.addListener((changes) => {
    if (changes.rehearsalSettings || changes.rehearsal?.newValue?.startedAt !== changes.rehearsal?.oldValue?.startedAt) send("GET_STATE").then(stateChanged).catch(() => void 0);
  });
  if (isDemo && !installed) {
    let signature = "";
    const refresh = () => send("GET_STATE").then((state) => {
      const next = JSON.stringify([state.rehearsalSettings, state.rehearsal.startedAt]);
      if (signature !== next) {
        signature = next;
        stateChanged(state);
      }
    });
    addEventListener("storage", refresh);
    addEventListener("study-preview-update", refresh);
  }
})();
