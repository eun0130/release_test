// Background service worker: periodically checks GitHub for a newer release.

const REPO = "eun0130/release_test";
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

async function checkForUpdate() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return;
    const release = await res.json();
    const latest = (release.tag_name || "").replace(/^v/, "");
    const current = chrome.runtime.getManifest().version;

    await chrome.storage.local.set({
      latest,
      current,
      releaseUrl: release.html_url || RELEASES_URL,
      checkedAt: Date.now(),
    });

    if (latest && latest !== current) {
      chrome.action.setBadgeText({ text: "NEW" });
      chrome.action.setBadgeBackgroundColor({ color: "#c62828" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (e) {
    // Network unavailable — try again on the next alarm.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("update-check", { periodInMinutes: 60 });
  checkForUpdate();
});

chrome.runtime.onStartup.addListener(checkForUpdate);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "update-check") checkForUpdate();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg === "check-now") {
    checkForUpdate().then(() => sendResponse("done"));
    return true; // keep the message channel open for the async response
  }
});
