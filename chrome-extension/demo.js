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
  const text = [v.title, v.channel, v.description].join(" ").normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
  return keywords.some((keyword) => {
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "u").test(text);
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
  const text = (x, limit) => typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, limit) : "";
  return { id: v.id, title: text(v.title, 500), channel: text(v.channel, 200), description: text(v.description, 1e3), duration: text(v.duration, 30), shorts: v.shorts === true };
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
    const settings = cleanSettings(extra.settings || {}, base);
    if (JSON.stringify(settings.keywords) !== JSON.stringify(base.keywords)) state[rehearsal ? "rehearsal" : "stats"] = newStats();
    state[rehearsal ? "rehearsalSettings" : "settings"] = settings;
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
function onStateUpdate(listener) {
  if (installed) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.settings || changes.rehearsalSettings || changes.stats || changes.rehearsal || changes.connection || changes.apiKey) listener();
    });
    chrome.runtime.onMessage.addListener((m) => {
      if (m.type === "STUDY_UPDATED") listener();
    });
  } else {
    addEventListener("storage", (e) => {
      if (e.key === PREVIEW_KEY) listener();
    });
    addEventListener("study-preview-update", () => listener());
  }
}

// src/demo.ts
var cards = document.getElementById("cards");
var art = (kind) => kind === 0 ? '<path d="M30 30h150v100H30z" fill="#303936"/><path d="m65 65-20 15 20 15m65-30 20 15-20 15m-25-38-15 65" fill="none" stroke="#b8d1c0" stroke-width="8" stroke-linecap="round"/>' : kind === 1 ? '<path d="M40 40c80 0 0 90 80 90s65-80 0-60" fill="none" stroke="#d0aa78" stroke-width="18" stroke-linecap="round"/><circle cx="153" cy="70" r="3" fill="#151515"/>' : '<rect x="35" y="25" width="150" height="105" rx="8" fill="#343332"/><path d="M55 50h70m-70 20h110m-110 20h85m-85 20h55" stroke="#bdb5a8" stroke-width="5" stroke-linecap="round"/>';
function add(index) {
  const sample = samples[index % samples.length];
  const v = sample.video;
  const card = document.createElement("article");
  card.className = "demo-video";
  card.dataset.studyCard = "";
  const link = document.createElement("a");
  link.href = v.shorts ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`;
  link.addEventListener("click", (e) => e.preventDefault());
  const thumbnail = document.createElement("div");
  thumbnail.className = "demo-thumbnail";
  thumbnail.innerHTML = `<svg viewBox="0 0 220 160" aria-hidden="true">${art(index % 3)}</svg>`;
  const duration = document.createElement("span");
  duration.className = "demo-duration";
  duration.dataset.studyDuration = "";
  duration.textContent = v.duration;
  thumbnail.append(duration);
  const title = document.createElement("h3");
  title.dataset.studyTitle = "";
  title.textContent = v.title;
  const channel = document.createElement("div");
  channel.className = "channel";
  channel.dataset.studyChannel = "";
  channel.textContent = v.channel;
  const description = document.createElement("span");
  description.hidden = true;
  description.dataset.studyDescription = "";
  description.textContent = v.description;
  link.append(thumbnail, title, channel, description);
  card.append(link);
  cards.append(card);
}
samples.forEach((_, index) => add(index));
var added = 0;
document.getElementById("add-card").addEventListener("click", () => add(added++));
async function refresh() {
  const state = await rpc("GET_STATE");
  document.getElementById("demo-keywords").textContent = state.rehearsalSettings.keywords.join(" \xB7 ") || "General learning";
  const count = state.rehearsal.events.length;
  document.getElementById("demo-status").textContent = count ? `${count} unique samples checked` : "Checking authored samples\u2026";
}
onStateUpdate(() => {
  refresh().catch(() => void 0);
});
refresh();
if (installed) document.querySelector(".demo-badge").textContent = "Rehearsal \xB7 authored decisions";
