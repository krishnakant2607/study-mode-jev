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
function summarize(stats) {
  const allowed = stats.events.filter((e) => e.kind === "allow").length;
  const uncertain = stats.events.filter((e) => e.reason === "uncertain" || e.reason === "connection").length;
  const reasons = { entertainment: 0, off_topic: 0, clickbait: 0, shorts: 0, uncertain: 0, connection: 0 };
  for (const e of stats.events) if (e.reason) reasons[e.reason]++;
  return { checked: stats.events.length, allowed, covered: stats.events.length - allowed, uncertain, reasons };
}
var reasonLabel = { entertainment: "Entertainment", off_topic: "Outside your keywords", clickbait: "Likely clickbait", shorts: "Shorts", uncertain: "Uncertain content", connection: "Waiting for connection" };

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
      const state2 = JSON.parse(stored);
      state2.settings = cleanSettings(state2.settings);
      state2.rehearsalSettings = cleanSettings(state2.rehearsalSettings);
      return state2;
    }
  } catch {
  }
  return { settings: { ...defaults }, rehearsalSettings: { ...defaults, enabled: true, keywords: ["python"] }, hasKey: false, stats: newStats(), rehearsal: newStats(), connection: { ok: false, message: "Rehearsal \xB7 authored decisions, no live inference", at: 0 } };
}
function writePreview(state2) {
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(state2));
  dispatchEvent(new CustomEvent("study-preview-update", { detail: state2 }));
}
async function rpc(type, extra = {}) {
  if (installed) {
    const result = await chrome.runtime.sendMessage({ type, ...extra });
    if (!result?.ok) throw new Error(result?.error || "Extension unavailable. Reload the page.");
    return result.data;
  }
  const state2 = readPreview();
  if (type === "GET_STATE") return state2;
  if (type === "SAVE_SETTINGS") {
    const rehearsal = extra.scope === "rehearsal";
    const base = rehearsal ? state2.rehearsalSettings : state2.settings;
    const settings = cleanSettings(extra.settings || {}, base);
    if (JSON.stringify(settings.keywords) !== JSON.stringify(base.keywords)) state2[rehearsal ? "rehearsal" : "stats"] = newStats();
    state2[rehearsal ? "rehearsalSettings" : "settings"] = settings;
    writePreview(state2);
    return state2;
  }
  if (type === "RESET_SESSION") {
    state2[extra.scope === "rehearsal" ? "rehearsal" : "stats"] = newStats();
    writePreview(state2);
    return state2;
  }
  if (type === "CLASSIFY") {
    const video = normalizeVideo(extra.video);
    const decision = state2.rehearsalSettings.hideShorts && video.shorts ? { kind: "cover", reason: "shorts", source: "local" } : !matchesKeywords(video, state2.rehearsalSettings.keywords) ? { kind: "cover", reason: "off_topic", source: "local" } : decide(fixtureJudgment(video, state2.rehearsalSettings.keywords), video, state2.rehearsalSettings, "rehearsal");
    state2.rehearsal = record(state2.rehearsal, video.id, decision);
    writePreview(state2);
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
    writePreview(state2);
    return state2;
  }
  if (type === "OPEN_YOUTUBE") {
    window.open("https://www.youtube.com/results?search_query=" + encodeURIComponent(state2.settings.keywords.join(" OR ") || "educational tutorials"), "_blank", "noopener");
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

// src/panel.ts
var $ = (id) => document.getElementById(id);
var state;
var windowId;
if (installed) chrome.windows.getCurrent().then((window2) => {
  windowId = window2.id;
}).catch(() => void 0);
var scope = installed && !new URLSearchParams(location.search).has("demo") ? "live" : "rehearsal";
var currentTab = "focus";
var busy = false;
var noticeTimer;
function notice(message, success = false) {
  clearTimeout(noticeTimer);
  $("notice").textContent = message;
  $("notice").classList.toggle("success", success);
  $("notice").hidden = false;
  if (success) noticeTimer = setTimeout(() => {
    $("notice").hidden = true;
  }, 3500);
}
function tab(name) {
  currentTab = name;
  for (const button of document.querySelectorAll("[data-tab]")) {
    const chosen = button.dataset.tab === name;
    button.classList.toggle("selected", chosen);
    if (chosen) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  for (const view of document.querySelectorAll(".view")) view.hidden = view.id !== `view-${name}`;
}
function render() {
  const s = scope === "rehearsal" ? state.rehearsalSettings : state.settings;
  $("enabled").toggleAttribute("data-enabled", s.enabled);
  $("enabled").checked = s.enabled;
  $("hide-clickbait").checked = s.hideClickbait;
  $("hide-shorts").checked = s.hideShorts;
  const chips = $("keyword-list");
  if (chips.dataset.signature !== JSON.stringify(s.keywords)) {
    chips.dataset.signature = JSON.stringify(s.keywords);
    chips.replaceChildren();
    for (const keyword of s.keywords) {
      const chip = document.createElement("span");
      chip.className = "keyword-chip";
      const label2 = document.createElement("span");
      label2.textContent = keyword;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "\xD7";
      remove.setAttribute("aria-label", `Remove keyword ${keyword}`);
      remove.addEventListener("click", () => action(async () => {
        const selected = scope === "rehearsal" ? state.rehearsalSettings : state.settings;
        await save({ keywords: selected.keywords.filter((k) => k !== keyword) });
      }));
      chip.append(label2, remove);
      chips.append(chip);
    }
  }
  $("keyword-help").textContent = s.keywords.length ? "Matches any keyword in a video\u2019s title, channel or snippet. Entertainment stays covered." : "No keywords: keep educational videos across subjects.";
  if (document.activeElement !== $("model")) $("model").value = s.model;
  $("mode-copy").textContent = s.enabled ? "Distractions stay covered." : "Your feed is unchanged until you enable it.";
  $("key-status").textContent = state.hasKey ? "A key is saved. Its value is never shown here." : "No key connected. Enter it here, never in chat.";
  $("remove-key").disabled = !state.hasKey || busy;
  $("scope-label").textContent = scope === "live" ? "Live" : "Rehearsal";
  $("scope-label").classList.toggle("rehearsal", scope === "rehearsal");
  $("metric-scope").value = scope;
  const stats = scope === "live" ? state.stats : state.rehearsal;
  const summary = summarize(stats);
  for (const name of ["checked", "allowed", "covered"]) $(name).textContent = String(summary[name]);
  $("uncertain").textContent = `${summary.uncertain} uncertain \xB7 kept covered`;
  const meter = $("distribution");
  meter.replaceChildren();
  for (let i = 0; i < 40; i++) {
    const tick = document.createElement("span");
    if (summary.checked) {
      const point = (i + 0.5) / 40 * summary.checked;
      tick.className = point < summary.allowed ? "learning" : point < summary.checked - summary.uncertain ? "covered" : "uncertain";
    }
    meter.append(tick);
  }
  meter.setAttribute("aria-label", `${summary.allowed} learning videos; ${summary.covered} covered, including ${summary.uncertain} uncertain`);
  $("activity-count").textContent = String(summary.checked);
  $("activity-empty").hidden = summary.checked > 0;
  $("activity-empty").textContent = scope === "rehearsal" ? "Open the rehearsal page to try the filter on authored sample videos." : "Open YouTube with Study Mode enabled to see your first results.";
  const reasons = $("reason-list");
  reasons.replaceChildren();
  for (const reason of ["entertainment", "off_topic", "clickbait", "shorts", "uncertain", "connection"]) {
    const row = document.createElement("div");
    row.className = "reason-row";
    const name = document.createElement("span");
    name.textContent = reasonLabel[reason];
    const track = document.createElement("div");
    track.className = "reason-track";
    const fill = document.createElement("span");
    fill.style.width = `${summary.checked ? summary.reasons[reason] / summary.checked * 100 : 0}%`;
    track.append(fill);
    const count = document.createElement("strong");
    count.textContent = String(summary.reasons[reason]);
    row.append(name, track, count);
    reasons.append(row);
  }
  const mins = Math.max(0, Math.floor((Date.now() - stats.startedAt) / 6e4));
  $("activity-time").textContent = mins ? `Session started ${mins} min ago` : "Session just started";
  const label = $("connection-label");
  label.textContent = scope === "rehearsal" ? "Rehearsal \xB7 authored decisions" : !state.hasKey ? "Connect Jev in Settings" : state.connection.ok ? "Jev connected" : state.connection.message;
  $("connection-dot").classList.toggle("connected", scope === "live" && installed && state.connection.ok);
  $("connection-action").textContent = scope === "rehearsal" ? "Live" : installed && state.hasKey ? "Retry" : "Connect";
}
async function refresh() {
  state = await rpc("GET_STATE");
  render();
}
async function action(fn, button) {
  if (busy) return;
  busy = true;
  if (button) button.disabled = true;
  try {
    await fn();
  } catch (e) {
    notice(e instanceof Error ? e.message : "Something went wrong. Try again.");
  } finally {
    busy = false;
    if (button) button.disabled = false;
    if (state) render();
  }
}
async function save(settings) {
  state = await rpc("SAVE_SETTINGS", { settings, scope });
  render();
}
for (const button of document.querySelectorAll("[data-tab]")) button.addEventListener("click", () => tab(button.dataset.tab));
$("enabled").addEventListener("change", () => action(async () => {
  await save({ enabled: $("enabled").checked });
  if (state.settings.enabled && !state.hasKey && installed) notice("Study Mode is on. Connect Jev in Settings; videos stay covered until decisions are available.");
}));
$("hide-clickbait").addEventListener("change", () => action(() => save({ hideClickbait: $("hide-clickbait").checked })));
$("hide-shorts").addEventListener("change", () => action(() => save({ hideShorts: $("hide-shorts").checked })));
$("keyword-form").addEventListener("submit", (e) => {
  e.preventDefault();
  action(async () => {
    const input = $("keyword-input");
    const keyword = input.value.trim().replace(/\s+/g, " ");
    if (!keyword) return;
    const selected = scope === "rehearsal" ? state.rehearsalSettings : state.settings;
    if (selected.keywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
      input.value = "";
      return;
    }
    if (selected.keywords.length >= 20) throw new Error("You can add up to 20 keywords. Remove one to add another.");
    await save({ keywords: [...selected.keywords, keyword] });
    input.value = "";
    input.focus();
  });
});
$("key-form").addEventListener("submit", (e) => {
  e.preventDefault();
  action(async () => {
    const input = $("api-key");
    if (!input.value.trim()) throw new Error("Enter your key, or use Remove saved key.");
    state = await rpc("SAVE_KEY", { key: input.value });
    input.value = "";
    notice("Key saved privately. Test the connection next.", true);
  });
});
$("test-connection").addEventListener("click", () => action(async () => {
  notice("Checking a live Jev decision\u2026");
  state = await rpc("TEST_CONNECTION");
  notice("Live Jev connection verified.", true);
}, $("test-connection")));
$("remove-key").addEventListener("click", () => action(async () => {
  state = await rpc("SAVE_KEY", { key: "" });
  notice("Saved key removed.", true);
}));
$("save-model").addEventListener("click", () => action(async () => {
  const model = $("model").value;
  if (!/^jev-[a-zA-Z0-9.-]{1,40}$/.test(model)) throw new Error("Use a Jev model name such as jev-latest.");
  await save({ model });
  notice("Model saved.", true);
}));
$("metric-scope").addEventListener("change", () => {
  scope = $("metric-scope").value;
  render();
});
$("activity-link").addEventListener("click", () => tab("activity"));
$("reset-session").addEventListener("click", () => action(async () => {
  state = await rpc("RESET_SESSION", { scope });
  notice("A fresh session is ready.", true);
}));
for (const id of ["demo", "settings-demo"]) $(id).addEventListener("click", () => action(async () => {
  await rpc("OPEN_DEMO");
  scope = "rehearsal";
  render();
}));
$("open-youtube").addEventListener("click", () => action(async () => {
  scope = "live";
  render();
  await rpc("OPEN_YOUTUBE");
}));
$("sidebar").addEventListener("click", () => action(async () => {
  if (installed && windowId !== void 0) await chrome.sidePanel.open({ windowId });
  else throw new Error("Use this control from the installed Chrome extension.");
}));
$("connection-action").addEventListener("click", () => {
  if (scope === "rehearsal") {
    if (installed) {
      scope = "live";
      render();
    } else tab("settings");
    return;
  }
  if (installed && state.hasKey) action(async () => {
    await rpc("RETRY");
    notice("Retry requested. Check Settings if the connection still fails.", true);
  });
  else tab("settings");
});
onStateUpdate(() => {
  refresh().catch(() => void 0);
});
refresh().then(() => {
  if (location.pathname.endsWith("/settings.html")) tab("settings");
  if (!installed) notice("Local rehearsal. All sample judgments are authored; no live Jev calls.");
}).catch((e) => notice(e.message));
