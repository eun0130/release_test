// Background service worker — runs without any HTML page.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Release Test service worker installed");
  // Show a visible badge on the toolbar icon so it's easy to confirm it ran.
  chrome.action.setBadgeText({ text: "ON" });
  chrome.action.setBadgeBackgroundColor({ color: "#2e7d32" });
});
