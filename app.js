// Background service worker.
// - Once a day (03:00 local, or first Chrome start after), asks GitHub for the
//   latest release and shows a NEW badge when the installed version is older.
// - Every minute, compares the manifest on disk with the running version and
//   reloads itself when the updater has replaced the files.

// Config is layered: config.json (local override, never shipped in the zip)
// wins over config.default.json (shipped defaults, replaced on every update).
async function loadConfig() {
  const res = await fetch(chrome.runtime.getURL("config.default.json"));
  let config = await res.json();
  try {
    const local = await fetch(chrome.runtime.getURL("config.json"));
    config = { ...config, ...(await local.json()) };
  } catch (e) {
    // No local override — use defaults.
  }
  return config;
}

async function checkForUpdate() {
  try {
    const cfg = await loadConfig();
    const res = await fetch(`${cfg.apiBase}/repos/${cfg.repo}/releases/latest`);
    if (!res.ok) return;
    const release = await res.json();
    const latest = (release.tag_name || "").replace(/^v/, "");
    const current = chrome.runtime.getManifest().version;

    await chrome.storage.local.set({
      latest,
      current,
      releaseUrl: release.html_url || `https://github.com/${cfg.repo}/releases/latest`,
      checkedAt: Date.now(),
    });

    if (latest && latest !== current) {
      chrome.action.setBadgeText({ text: "NEW" });
      chrome.action.setBadgeBackgroundColor({ color: "#c62828" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (e) {
    // Network unavailable — the next scheduled check will retry.
  }
}

// The updater overwrites files while Chrome is running; unpacked extensions
// serve resources straight from disk, so the manifest file reveals the new
// version before we are actually running it.
async function reloadIfFilesUpdated() {
  try {
    const res = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    const diskVersion = (await res.json()).version;
    if (diskVersion !== chrome.runtime.getManifest().version) {
      chrome.runtime.reload();
    }
  } catch (e) {
    // Folder temporarily unreadable (mid-overwrite) — try again next minute.
  }
}

function scheduleAlarms() {
  const next = new Date();
  next.setHours(3, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  // Missed alarms (PC off at 03:00) fire on the next Chrome start.
  chrome.alarms.create("update-check", { when: next.getTime(), periodInMinutes: 1440 });
  chrome.alarms.create("reload-check", { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleAlarms();
  checkForUpdate();
});

// Safety net: if the daily alarm was missed and not rescheduled, still check
// at most once per day on browser start.
chrome.runtime.onStartup.addListener(async () => {
  const { checkedAt = 0 } = await chrome.storage.local.get("checkedAt");
  if (Date.now() - checkedAt > 20 * 60 * 60 * 1000) checkForUpdate();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "update-check") checkForUpdate();
  if (alarm.name === "reload-check") reloadIfFilesUpdated();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg === "check-now") {
    checkForUpdate().then(() => sendResponse("done"));
    return true; // keep the message channel open for the async response
  }
});
