"use strict";
(() => {
  // src/core.ts
  var DEFAULT_MODEL = "jev-latest";
  var defaults = { enabled: false, keywords: [], hideClickbait: true, hideShorts: true, model: DEFAULT_MODEL };
  var sessionClock = 0;
  var newStats = () => ({ startedAt: sessionClock = Math.max(Date.now(), sessionClock + 1), events: [] });
  function cleanKeywords(raw) {
    const unique = /* @__PURE__ */ new Map();
    for (const value of raw) if (typeof value === "string") {
      const keyword = value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 60);
      if (keyword && !unique.has(keyword.toLowerCase())) unique.set(keyword.toLowerCase(), keyword);
    }
    return [...unique.values()].slice(0, 20);
  }
  function matchesKeywords(v, keywords) {
    if (!keywords.length) return true;
    const text2 = [v.title, v.channel, v.description].join(" ").normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
    return keywords.some((keyword) => {
      const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "u").test(text2);
    });
  }
  function cleanSettings(raw, base = defaults) {
    const values = raw && typeof raw === "object" ? raw : {};
    return {
      enabled: typeof values.enabled === "boolean" ? values.enabled : base.enabled,
      keywords: Array.isArray(values.keywords) ? cleanKeywords(values.keywords) : typeof values.topic === "string" ? cleanKeywords([values.topic]) : [...base.keywords],
      hideClickbait: typeof values.hideClickbait === "boolean" ? values.hideClickbait : base.hideClickbait,
      hideShorts: typeof values.hideShorts === "boolean" ? values.hideShorts : base.hideShorts,
      model: typeof values.model === "string" && /^jev-[a-zA-Z0-9.-]{1,40}$/.test(values.model) ? values.model : base.model
    };
  }
  function normalizeVideo(raw) {
    const v = raw;
    if (!v || typeof v.id !== "string" || !/^[a-zA-Z0-9_-]{3,80}$/.test(v.id) || typeof v.title !== "string") throw new Error("Invalid video metadata.");
    const text2 = (x, limit) => typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, limit) : "";
    return { id: v.id, title: text2(v.title, 500), channel: text2(v.channel, 200), description: text2(v.description, 1e3), duration: text2(v.duration, 30), shorts: v.shorts === true };
  }
  function decide(j, v, s, source) {
    if (s.hideShorts && v.shorts) return { kind: "cover", reason: "shorts", source: "local" };
    if (j.entertainment >= 0.75) return { kind: "cover", reason: "entertainment", source };
    if (s.keywords.length && (!matchesKeywords(v, s.keywords) || j.relevance <= 0.3)) return { kind: "cover", reason: "off_topic", source };
    if (s.hideClickbait && j.clickbait >= 0.8) return { kind: "cover", reason: "clickbait", source };
    if (j.sufficient < 0.8 || j.education < 0.8 || j.entertainment > 0.3 || s.keywords.length > 0 && j.relevance < 0.8) return { kind: "cover", reason: "uncertain", source };
    return { kind: "allow", source };
  }
  function record(stats, id, decision, at = Date.now()) {
    const event = { id, kind: decision.kind, reason: decision.reason, source: decision.source, latencyMs: decision.latencyMs, at };
    const existing = stats.events.findIndex((e) => e.id === id);
    const events = [...stats.events];
    if (existing >= 0) events[existing] = event;
    else events.push(event);
    return { ...stats, events: events.slice(-1500) };
  }
  var reasonLabel = { entertainment: "Entertainment", off_topic: "Outside your keywords", clickbait: "Likely clickbait", shorts: "Shorts", uncertain: "Uncertain content", connection: "Waiting for connection" };

  // src/detector.ts
  var CARD_SELECTOR = "ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,yt-lockup-view-model,[data-study-card]";
  var TITLE_SELECTOR = "#video-title,#video-title-link,.yt-lockup-metadata-view-model__title,.yt-lockup-metadata-view-model-wiz__title,h3 a,h3,[data-study-title]";
  function text(element) {
    return (element?.textContent || "").replace(/\s+/g, " ").trim();
  }
  function extractCard(card) {
    const link = [...card.querySelectorAll("a[href]")].find((a) => {
      try {
        const u = new URL(a.href, location.href);
        return u.pathname === "/watch" && u.searchParams.has("v") || /^\/shorts\/[^/]+/.test(u.pathname);
      } catch {
        return false;
      }
    });
    if (!link) return null;
    const url = new URL(link.href, location.href);
    const id = url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
    if (!id || !/^[a-zA-Z0-9_-]{3,80}$/.test(id)) return null;
    const titleElement = card.querySelector(TITLE_SELECTOR);
    const title = titleElement?.getAttribute("title") || text(titleElement) || link.getAttribute("title") || link.getAttribute("aria-label") || "";
    if (!title.trim()) return null;
    return {
      id,
      title: title.slice(0, 500),
      channel: text(card.querySelector("ytd-channel-name a,#channel-name a,.yt-content-metadata-view-model__metadata-row a,.yt-content-metadata-view-model-wiz__metadata-row a,[data-study-channel]")).slice(0, 200),
      description: text(card.querySelector(".metadata-snippet-text,#description-text,[data-study-description]")).slice(0, 1e3),
      duration: text(card.querySelector("ytd-thumbnail-overlay-time-status-renderer,.yt-badge-shape__text,.yt-badge-shape-wiz__text,[data-study-duration]")).slice(0, 30),
      shorts: url.pathname.startsWith("/shorts/")
    };
  }
  function findCards(root = document) {
    return [...root.querySelectorAll(CARD_SELECTOR)].filter((card) => !card.parentElement?.closest(CARD_SELECTOR));
  }

  // src/fixtures.ts
  var yes = { education: 0.98, entertainment: 0.02, relevance: 0.98, clickbait: 0.03, sufficient: 0.99 };
  var fun = { education: 0.02, entertainment: 0.99, relevance: 0.02, clickbait: 0.65, sufficient: 0.98 };
  var samples = [
    { video: { id: "python_lesson", title: "Python functions, explained with real examples", channel: "The Coding Classroom", description: "Learn parameters, return values and reusable functions.", duration: "14:32", shorts: false }, judgments: { python: yes, javascript: { ...yes, relevance: 0.08 } } },
    { video: { id: "snake_video", title: "Giant python surprises everyone at the zoo", channel: "Wild Moments", description: "An unexpected animal encounter.", duration: "8:12", shorts: false }, judgments: { python: fun, javascript: fun } },
    { video: { id: "python_project", title: "Build a Python expense tracker from scratch", channel: "Build & Learn", description: "A practical project covering CSV files and functions.", duration: "28:45", shorts: false }, judgments: { python: yes, javascript: { ...yes, relevance: 0.05 } } },
    { video: { id: "coding_memes", title: "Python developers react to programming memes", channel: "After Hours", description: "Funny reactions and jokes.", duration: "11:06", shorts: false }, judgments: { python: { ...fun, relevance: 0.9 }, javascript: fun } },
    { video: { id: "javascript_lesson", title: "JavaScript closures: a visual explanation", channel: "The Coding Classroom", description: "Understand lexical scope through worked examples.", duration: "17:20", shorts: false }, judgments: { python: { ...yes, relevance: 0.05 }, javascript: yes } },
    { video: { id: "physics_lesson", title: "The physics behind impossible basketball shots", channel: "Everyday Science", description: "An entertaining explanation of projectile motion.", duration: "12:40", shorts: false }, judgments: { python: { ...yes, relevance: 0.03 }, javascript: { ...yes, relevance: 0.03 } } },
    { video: { id: "coding_short", title: "One Python trick in sixty seconds", channel: "Quick Code", description: "A short demonstration of list slicing.", duration: "0:59", shorts: true }, judgments: { python: yes, javascript: { ...yes, relevance: 0.02 } } },
    { video: { id: "unclear_video", title: "You need to see this\u2026", channel: "Something New", description: "", duration: "9:15", shorts: false }, judgments: { python: { ...yes, education: 0.5, sufficient: 0.25, relevance: 0.5 }, javascript: { ...yes, education: 0.5, sufficient: 0.25, relevance: 0.5 } } },
    { video: { id: "riches_video", title: "Learn Python and get RICH overnight \u2014 the secret method", channel: "Shortcut Academy", description: "Big promises with no clear lesson.", duration: "10:10", shorts: false }, judgments: { python: { ...yes, education: 0.85, clickbait: 0.99 }, javascript: { ...yes, relevance: 0.02, clickbait: 0.99 } } },
    { video: { id: "dsa_lesson", title: "DSA: binary search and time complexity explained", channel: "Algorithm Classroom", description: "Learn data structures and algorithms through worked examples.", duration: "21:05", shorts: false }, judgments: { python: { ...yes, relevance: 0.02 }, javascript: { ...yes, relevance: 0.02 }, dsa: yes } },
    { video: { id: "dsa_memes", title: "DSA interview memes that are too relatable", channel: "After Hours", description: "Funny interview reactions.", duration: "7:40", shorts: false }, judgments: { python: fun, javascript: fun, dsa: { ...fun, relevance: 0.99 } } }
  ];
  function fixtureJudgment(v, keywords) {
    const sample = samples.find((s) => s.video.id === v.id && s.video.title === v.title);
    if (!sample) throw new Error("This item has no authored rehearsal judgment.");
    if (!keywords.length) return { ...sample.judgments.python, relevance: 0.98 };
    const choices = keywords.map((k) => sample.judgments[k.toLowerCase()]).filter(Boolean);
    if (choices.length) return { ...sample.judgments.python, relevance: Math.max(...choices.map((j) => j.relevance)) };
    return { ...sample.judgments.python, relevance: 0.5, sufficient: 0.5 };
  }

  // src/client.ts
  var installed = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  var PREVIEW_KEY = "study-mode-rehearsal-v1";
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
    if (type === "GET_STATE") return state;
    if (type === "SAVE_SETTINGS") {
      const rehearsal = extra.scope === "rehearsal";
      const base = rehearsal ? state.rehearsalSettings : state.settings;
      const settings2 = cleanSettings(extra.settings || {}, base);
      if (JSON.stringify(settings2.keywords) !== JSON.stringify(base.keywords)) state[rehearsal ? "rehearsal" : "stats"] = newStats();
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
      const decision = state.rehearsalSettings.hideShorts && video.shorts ? { kind: "cover", reason: "shorts", source: "local" } : !matchesKeywords(video, state.rehearsalSettings.keywords) ? { kind: "cover", reason: "off_topic", source: "local" } : decide(fixtureJudgment(video, state.rehearsalSettings.keywords), video, state.rehearsalSettings, "rehearsal");
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
    overlay.querySelector(".study-cover-sub").textContent = reason === "pending" ? "Checking learning relevance" : "Study Mode keeps your attention here";
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
    else cover(card, d.reason ? reasonLabel[d.reason] : "Hidden by Study Mode", d.reason || "uncertain");
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
        if (enabled && requestEpoch === epoch && tracked.get(card)?.signature === signature) cover(card, "Connection unavailable", "connection");
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
          if (card.querySelector('a[href*="/watch?v="],a[href^="/shorts/"]')) cover(card, "Waiting for video details", "uncertain");
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
          cover(card, "Checking\u2026");
          observer.observe(card);
          enqueue(card);
        }
      }
      if (settings?.hideShorts) {
        for (const shelf of document.querySelectorAll('ytd-reel-shelf-renderer,yt-horizontal-list-renderer:has(a[href^="/shorts/"])')) cover(shelf, "Shorts are hidden", "shorts");
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
  document.addEventListener("DOMContentLoaded", schedule);
  document.addEventListener("scroll", schedule, { passive: true });
  var mutations = new MutationObserver((records) => {
    const relevant = records.filter((r) => !(r.target instanceof Element) || !r.target.closest(".study-cover"));
    if (!relevant.length) return;
    if (enabled) {
      const candidates = /* @__PURE__ */ new Set();
      for (const record2 of relevant) {
        const target = record2.target instanceof Element ? record2.target : record2.target.parentElement;
        const parent = target?.closest(CARD_SELECTOR);
        if (parent) candidates.add(parent);
        for (const node of record2.addedNodes) if (node instanceof Element && !node.matches(".study-cover")) {
          if (node.matches(CARD_SELECTOR) && !node.parentElement?.closest(CARD_SELECTOR)) candidates.add(node);
          for (const card of findCards(node)) candidates.add(card);
        }
      }
      for (const card of candidates) {
        const video = extractCard(card);
        if (video && tracked.get(card)?.signature !== JSON.stringify(video)) cover(card, "Checking\u2026");
        else if (!video && card.querySelector('a[href*="/watch?v="],a[href^="/shorts/"]')) cover(card, "Waiting for video details", "uncertain");
      }
    }
    schedule();
  });
  mutations.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href", "title", "aria-label"] });
  if (installed) chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "STUDY_STATE") stateChanged(message.state);
  });
  send("GET_STATE").then(stateChanged).catch(() => {
    for (const card of document.querySelectorAll(".study-covered")) cover(card, "Reload this tab to reconnect", "connection");
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
