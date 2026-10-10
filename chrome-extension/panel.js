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
function summarize(stats) {
  const allowed = stats.events.filter((e) => e.kind === "allow").length;
  const reasons = { entertainment: 0, excluded: 0, preferred: 0, uncertain: 0, connection: 0 };
  for (const e of stats.events) if (e.reason && e.reason in reasons) reasons[e.reason]++;
  return { checked: stats.events.length, allowed, covered: stats.events.length - allowed, uncertain: reasons.uncertain + reasons.connection, reasons };
}
var reasonLabel = { entertainment: "Entertainment", excluded: "Matches your hide preference", preferred: "Matches your allow preference", uncertain: "Uncertain \xB7 kept visible", connection: "Unavailable \xB7 kept visible" };

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

// src/client.ts
var installed = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
var PREVIEW_KEY = "focusmaxx-rehearsal-v3";
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
    if (JSON.stringify(settings) !== JSON.stringify(base)) state2[rehearsal ? "rehearsal" : "stats"] = newStats();
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
    const decision = decide(fixtureJudgment(video, state2.rehearsalSettings), video, state2.rehearsalSettings, "rehearsal");
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
var preferenceDirty = false;
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
  $("filter-shorts").checked = s.filterShorts;
  if (!preferenceDirty) {
    $("allow-preference").value = s.allowPreference;
    $("hide-preference").value = s.hidePreference;
  }
  $("preference-status").textContent = preferenceDirty ? "Unsaved changes" : "Preferences saved";
  $("preferences-summary").textContent = s.allowPreference || s.hidePreference ? "Personal preferences are active." : "Tell FocusMaxx what to allow and hide.";
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
  if (document.activeElement !== $("model")) $("model").value = s.model;
  $("mode-copy").textContent = s.enabled ? "Balanced filtering is on." : "Balanced filtering is off.";
  $("key-status").textContent = state.hasKey ? "A key is saved. Its value is never shown here." : "No key connected. Enter it here, never in chat.";
  $("remove-key").disabled = !state.hasKey || busy;
  $("scope-label").textContent = scope === "live" ? "Live" : "Rehearsal";
  $("scope-label").classList.toggle("rehearsal", scope === "rehearsal");
  $("metric-scope").value = scope;
  const stats = scope === "live" ? state.stats : state.rehearsal;
  const summary = summarize(stats);
  for (const name of ["checked", "allowed", "covered"]) $(name).textContent = String(summary[name]);
  $("uncertain").textContent = `${summary.uncertain} uncertain \xB7 kept visible`;
  const meter = $("distribution");
  meter.replaceChildren();
  for (let i = 0; i < 40; i++) {
    const tick = document.createElement("span");
    if (summary.checked) {
      const point = (i + 0.5) / 40 * summary.checked;
      tick.className = point < summary.allowed ? "learning" : "covered";
    }
    meter.append(tick);
  }
  meter.setAttribute("aria-label", `${summary.allowed} visible videos; ${summary.covered} covered, including ${summary.uncertain} uncertain`);
  $("activity-count").textContent = String(summary.checked);
  $("activity-empty").hidden = summary.checked > 0;
  $("activity-empty").textContent = scope === "rehearsal" ? "Open the rehearsal page to try the filter on authored sample videos." : "Open YouTube with Study Mode enabled to see your first results.";
  const reasons = $("reason-list");
  reasons.replaceChildren();
  for (const reason of ["entertainment", "excluded", "preferred", "uncertain", "connection"]) {
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
  if (state.settings.enabled && !state.hasKey && installed) notice("FocusMaxx is on. Connect Jev in Settings; videos stay visible until decisions are available.");
}));
$("filter-shorts").addEventListener("change", () => action(() => save({ filterShorts: $("filter-shorts").checked })));
$("preferences-link").addEventListener("click", () => tab("preferences"));
for (const id of ["allow-preference", "hide-preference"]) $(id).addEventListener("input", () => {
  preferenceDirty = true;
  $("preference-status").textContent = "Unsaved changes";
});
$("preferences-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(async () => {
    const allow = $("allow-preference").value, hide = $("hide-preference").value;
    await save({ allowPreference: allow, hidePreference: hide });
    preferenceDirty = $("allow-preference").value !== allow || $("hide-preference").value !== hide;
    render();
    notice(preferenceDirty ? "Preferences saved. New edits are still unsaved." : "Preferences saved. Your feed is being re-evaluated.", true);
  }, $("save-preferences"));
});
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
  preferenceDirty = false;
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
  preferenceDirty = false;
  render();
}));
$("open-youtube").addEventListener("click", () => action(async () => {
  scope = "live";
  preferenceDirty = false;
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
      preferenceDirty = false;
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
