async function render() {
  const { latest, releaseUrl } = await chrome.storage.local.get(["latest", "releaseUrl"]);
  const current = chrome.runtime.getManifest().version;

  document.getElementById("current").textContent = "v" + current;
  document.getElementById("latest").textContent = latest ? "v" + latest : "확인 안 됨";

  const status = document.getElementById("status");
  const linkRow = document.getElementById("link-row");

  if (!latest) {
    status.textContent = "최신 버전 정보를 아직 못 가져왔어요.";
    status.className = "";
    linkRow.hidden = true;
  } else if (latest !== current) {
    status.textContent = "새 버전이 있습니다!";
    status.className = "update";
    document.getElementById("release-link").href = releaseUrl;
    linkRow.hidden = false;
  } else {
    status.textContent = "최신 버전입니다.";
    status.className = "ok";
    linkRow.hidden = true;
  }
}

document.getElementById("check").addEventListener("click", () => {
  chrome.runtime.sendMessage("check-now", () => render());
});

render();
