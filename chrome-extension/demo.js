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
function fixtureJudgment(video, settings) {
  const sample = samples.find((s) => s.video.id === video.id && s.video.title === video.title);
  if (!sample) throw new Error("No authored rehearsal judgment for this sample.");
  const j = { ...sample.judgment };
  if (/wildlife|animal|snake|documentar/i.test(settings.allowPreference) && /snake|wildlife/i.test(video.title)) j.preferred = 0.98;
  if (/music/i.test(settings.allowPreference) && video.id === "music_video") j.preferred = 0.98;
  if (/music/i.test(settings.hidePreference) && video.id === "music_video") j.excluded = 0.99;
  if (/memes|pranks/i.test(settings.hidePreference) && /memes|pranks/i.test(video.title)) j.excluded = 0.99;
  return j;
}

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
  const text = (x, n) => typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, n) : "";
  return { id: v2.id, title: text(v2.title, 500), channel: text(v2.channel, 200), description: text(v2.description, 1e3), duration: text(v2.duration, 30), shorts: v2.shorts === true, pageContext: text(v2.pageContext, 300) };
}
function clearlyEntertainment(v2) {
  const title = v2.title.normalize("NFKC");
  if (/\b(tutorial|lesson|course|explained|explanation|analysis|analyzing|analysing|documentary|research|science|history|review|breakdown|education|educational|learn|learning|technique|theory|how to|why|what is|understanding|guide|facts)\b|कैसे|सीखें|समझें|विश्लेषण|इतिहास/i.test(title)) return false;
  if (/\b(songs?|music|remix|mashup|karaoke|piano cover|guitar cover|acoustic cover|bhajan|qawwali|ghazal|official audio|lyric(?:s)?(?: video)?|full movie|full film|movie trailer|film trailer|movie scene|film scene|movie clip|film clip|pranks?|prank compilation|comedy sketch|meme compilation|memes|live concert|concert performance|music performance|dj mix|music mix|relaxing music|lofi (?:mix|music|beats)|slowed(?: and| \+)? reverb|sped up)\b|गाना|गीत|पूर्ण फिल्म/i.test(title)) return true;
  return /\bofficial (?:music )?video\b/i.test(title) && /vevo|music|records|t.series/i.test(v2.channel);
}
function decide(j, v2, s, source) {
  if (v2.shorts && !s.filterShorts) return { kind: "allow", source: "local" };
  if (s.hidePreference && j.excluded >= BLOCK_THRESHOLD) return { kind: "cover", reason: "excluded", source, judgment: j };
  if (s.allowPreference && j.preferred >= BLOCK_THRESHOLD) return { kind: "allow", reason: "preferred", source, judgment: j };
  if (clearlyEntertainment(v2)) return { kind: "cover", reason: "entertainment", source: "local", judgment: j };
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
    const settings = cleanSettings(extra.settings || {}, base);
    if (JSON.stringify(settings) !== JSON.stringify(base)) state[rehearsal ? "rehearsal" : "stats"] = newStats();
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
  const v2 = sample.video;
  const card = document.createElement("article");
  card.className = "demo-video";
  card.dataset.studyCard = "";
  const link = document.createElement("a");
  link.href = v2.shorts ? `https://www.youtube.com/shorts/${v2.id}` : `https://www.youtube.com/watch?v=${v2.id}`;
  link.addEventListener("click", (e) => e.preventDefault());
  const thumbnail = document.createElement("div");
  thumbnail.className = "demo-thumbnail";
  thumbnail.innerHTML = `<svg viewBox="0 0 220 160" aria-hidden="true">${art(index % 3)}</svg>`;
  const duration = document.createElement("span");
  duration.className = "demo-duration";
  duration.dataset.studyDuration = "";
  duration.textContent = v2.duration;
  thumbnail.append(duration);
  const title = document.createElement("h3");
  title.dataset.studyTitle = "";
  title.textContent = v2.title;
  const channel = document.createElement("div");
  channel.className = "channel";
  channel.dataset.studyChannel = "";
  channel.textContent = v2.channel;
  const description = document.createElement("span");
  description.hidden = true;
  description.dataset.studyDescription = "";
  description.textContent = v2.description;
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
