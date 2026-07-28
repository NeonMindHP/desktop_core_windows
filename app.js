const desktop = document.querySelector("#desktop");
const startPanel = document.querySelector("#startPanel");
const windowPanel = document.querySelector("#windowPanel");
const windowTitle = document.querySelector("#windowTitle");
const windowPath = document.querySelector("#windowPath");
const files = document.querySelector("#files");
const toast = document.querySelector("#toast");
const message = document.querySelector("#message");
const coreToggle = document.querySelector('[data-action="core"]');
let toastTimer;
let messageIndex = 0;

const folders = {
  "Dieser PC": [
    ["▰", "Lokaler Datenträger (C:)"],
    ["▰", "NeonMind Drive"],
    ["◇", "Bilder"],
    ["↓", "Downloads"],
    ["⌘", "Projekte"],
    ["♫", "Musik"],
    ["▶", "Videos"],
    ["▤", "Dokumente"],
  ],
  Bilder: [
    ["◇", "NeonMind Gallery"],
    ["◇", "Wallpaper"],
    ["◇", "Screenshots"],
    ["◇", "App Designs"],
    ["◇", "Logos"],
    ["◇", "Uploads"],
  ],
  Downloads: [
    ["↓", "NeonMind_Gallery.apk"],
    ["↓", "Website_Backup.zip"],
    ["↓", "Reactor_Loop.mp4"],
    ["↓", "Projektdateien"],
  ],
  Projekte: [
    ["⌘", "NeonMind Gallery"],
    ["⌘", "Image Engine"],
    ["⌘", "Video Engine"],
    ["⌘", "Desktop Core"],
    ["⌘", "Xbox Hub"],
    ["⌘", "Atlas & Friends"],
  ],
  Papierkorb: [
    ["♲", "Der Papierkorb ist leer"],
  ],
};

const messages = [
  {
    title: "Dein Windows.<br><em>Nur deutlich geiler.</em>",
    text: "Ein Desktop-Core für Programme, Ordner und Projekte – klar, direkt und ohne langweiligen Standardlook.",
  },
  {
    title: "Alles im Blick.<br><em>Ohne Technik-Chaos.</em>",
    text: "Programme, Dateien und Systemstatus sitzen in einer gemeinsamen NeonMind-Oberfläche.",
  },
  {
    title: "Deine Projekte.<br><em>Direkt im Core.</em>",
    text: "Gallery, Image Engine und zukünftige NeonMind-Tools bekommen ihren festen Platz auf dem Desktop.",
  },
];

function updateClock() {
  const now = new Date();
  document.querySelector("#clock").textContent = now.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  document.querySelector("#date").textContent = now.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function showToast(text) {
  clearTimeout(toastTimer);
  toast.querySelector("span").textContent = text;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function closePanels() {
  startPanel.classList.remove("is-open");
  windowPanel.classList.remove("is-open");
  startPanel.setAttribute("aria-hidden", "true");
  windowPanel.setAttribute("aria-hidden", "true");
}

function toggleStart() {
  const open = !startPanel.classList.contains("is-open");
  closePanels();
  if (open) {
    startPanel.classList.add("is-open");
    startPanel.setAttribute("aria-hidden", "false");
  }
}

function openFolder(name = "Dieser PC") {
  const folderFiles = folders[name] || folders["Dieser PC"];
  startPanel.classList.remove("is-open");
  startPanel.setAttribute("aria-hidden", "true");
  windowTitle.innerHTML = `<i></i> NEONMIND EXPLORER`;
  windowPath.textContent = name;
  files.innerHTML = folderFiles.map(([icon, label]) => (
    `<button class="file-card" data-file="${label}"><i>${icon}</i><span>${label}</span></button>`
  )).join("");
  windowPanel.classList.add("is-open");
  windowPanel.setAttribute("aria-hidden", "false");
}

function setActiveNav(action) {
  document.querySelectorAll(".taskbar__nav button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.action === action);
  });
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      showToast("Vollbild aktiv · ESC beendet den Test");
    } else {
      await document.exitFullscreen();
    }
  } catch {
    showToast("Bitte F11 für den Vollbildmodus drücken");
  }
}

function runAction(action) {
  switch (action) {
    case "start":
      toggleStart();
      break;
    case "home":
      closePanels();
      setActiveNav("home");
      showToast("NeonMind Desktop bereit");
      break;
    case "apps":
      toggleStart();
      setActiveNav("apps");
      break;
    case "explorer":
      openFolder("Dieser PC");
      setActiveNav("explorer");
      break;
    case "gallery":
      openFolder("Bilder");
      setActiveNav("gallery");
      showToast("Gallery-Demo geöffnet");
      break;
    case "settings":
      setActiveNav("settings");
      showToast("Settings folgen in der echten Windows-App");
      break;
    case "trash":
      openFolder("Papierkorb");
      break;
    case "core": {
      const isOn = coreToggle.classList.toggle("is-on");
      desktop.classList.toggle("core-off", !isOn);
      coreToggle.querySelector("span").textContent = isOn ? "CORE ON" : "CORE OFF";
      showToast(isOn ? "Desktop Core aktiviert" : "Desktop Core pausiert");
      break;
    }
    case "fullscreen":
      toggleFullscreen();
      break;
    case "calendar":
      showToast("Kalender-Widget · Testversion");
      break;
    case "sound":
      showToast("Audio-Core · Testversion");
      break;
    case "power":
      showToast("Nur Demo – Windows wird natürlich nicht heruntergefahren");
      break;
    default:
      break;
  }
}

document.addEventListener("click", (event) => {
  const close = event.target.closest(".panel-close,.window-minimize");
  if (close) {
    close.closest(".panel").classList.remove("is-open");
    return;
  }

  const folderButton = event.target.closest("[data-folder]");
  if (folderButton) {
    openFolder(folderButton.dataset.folder);
    return;
  }

  const fileButton = event.target.closest("[data-file]");
  const nativeHost = location.protocol === "http:" && new URLSearchParams(location.search).has("token");
  if (fileButton && !nativeHost) {
    showToast(`${fileButton.dataset.file} · Demo-Auswahl`);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) runAction(actionButton.dataset.action);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePanels();
});

setInterval(() => {
  messageIndex = (messageIndex + 1) % messages.length;
  message.classList.remove("is-changing");
  void message.offsetWidth;
  message.querySelector("h1").innerHTML = messages[messageIndex].title;
  message.querySelector("p").textContent = messages[messageIndex].text;
  message.classList.add("is-changing");
}, 6200);

updateClock();
setInterval(updateClock, 1000);
setTimeout(() => showToast("NeonMind Desktop Core · Test bereit"), 700);
