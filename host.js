(() => {
  const token = new URLSearchParams(location.search).get("token");
  if (!token || location.protocol !== "http:") return;

  const api = async (path, body) => {
    const options = body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
    const response = await fetch(`${path}?token=${encodeURIComponent(token)}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Windows-Funktion fehlgeschlagen");
    return data;
  };

  let state = { claimVisible: true, rightPanelMode: "claim", shortcuts: [], openWindows: [] };
  let explorerPath = "::drives";
  let explorerParent = null;
  let explorerView = localStorage.getItem("neonExplorerView") || "large";
  let selectedExplorer = null;
  let notificationFilter = "all";
  let previousWindowCount = null;
  let lastSystemAlert = "";
  let clipboardItem = null;
  let desktopIconSize = localStorage.getItem("neonDesktopIconSize") || "medium";
  let desktopAlignGrid = localStorage.getItem("neonDesktopAlignGrid") !== "false";
  let desktopAutoArrange = localStorage.getItem("neonDesktopAutoArrange") === "true";
  let desktopSort = localStorage.getItem("neonDesktopSort") || "name";
  let windowsDesktopPath = "";
  let selectedTaskWindow = null;
  let playlistTracks = [];
  let playlistIndex = -1;
  let calendarMode = "day";
  let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let calendarSelectedDate = "";
  const APP_VERSION = "1.0.5";
  const RELEASES_API = "https://api.github.com/repos/NeonMindHP/desktop_core_windows_release/releases/latest";
  const themeCatalog = {
    neonmind: { name: "NeonMind Original", icon: "N" },
    cyber: { name: "Cyber Gaming", icon: "◉" },
    tropical: { name: "Tropical Comic 420", icon: "☘" },
    space: { name: "Deep Space Universe", icon: "✦" },
    caribbean: { name: "Caribbean Summer", icon: "☀" },
  };
  const applyTheme = (theme = localStorage.getItem("neonDesktopTheme") || "neonmind") => {
    const selected = themeCatalog[theme] ? theme : "neonmind";
    const root = document.querySelector("#desktop");
    root.classList.remove(...Object.keys(themeCatalog).map((key) => `theme-${key}`));
    root.classList.add(`theme-${selected}`);
    root.dataset.theme = selected;
    localStorage.setItem("neonDesktopTheme", selected);
  };
  const explorerHistory = [];
  const notifications = [];
  const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const nativeIcon = (path, fallback = "▤") => `
    <span class="native-icon">
      <img src="/api/icon?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}" alt="" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true">
      <i>${fallback}</i>
    </span>`;

  const pinCatalog = {
    explorer: { icon: "▣", title: "NeonMind Explorer" },
    browser: { icon: "◎", title: "Standardbrowser" },
    downloads: { icon: "↓", title: "Downloads" },
    settings: { icon: "⚙", title: "Einstellungen" },
  };
  const getPinned = () => {
    try { return JSON.parse(localStorage.getItem("neonTaskbarPins") || '["explorer","browser"]'); }
    catch { return ["explorer", "browser"]; }
  };
  const renderPinnedApps = () => {
    const pins = getPinned().filter((key) => pinCatalog[key]);
    document.querySelector("#pinnedApps").innerHTML = pins.map((key) => {
      const item = pinCatalog[key];
      return `<button class="pinned-app-button" data-pin-action="${key}" title="${item.title}">${item.icon}</button>`;
    }).join("");
    document.querySelectorAll("[data-pin-toggle]").forEach((button) => button.classList.toggle("is-pinned", pins.includes(button.dataset.pinToggle)));
  };
  const togglePin = (key) => {
    const pins = getPinned();
    const next = pins.includes(key) ? pins.filter((item) => item !== key) : [...pins, key];
    localStorage.setItem("neonTaskbarPins", JSON.stringify(next));
    renderPinnedApps();
  };

  const playlistAudio = document.querySelector("#playlistAudio");
  const renderPlaylist = () => {
    const activeLabel = document.querySelector("#mediaActiveLabel");
    document.querySelector("#playlistNow").textContent = playlistIndex >= 0 && playlistTracks[playlistIndex]
      ? `JETZT: ${playlistTracks[playlistIndex].name}`
      : "Noch keine eigene Musik geladen";
    if (activeLabel && playlistIndex >= 0 && playlistTracks[playlistIndex]) activeLabel.textContent = playlistTracks[playlistIndex].name;
    document.querySelector("#playlistList").innerHTML = playlistTracks.map((track, index) => `
      <button class="playlist-track ${index === playlistIndex ? "is-active" : ""}" data-playlist-index="${index}">
        <i>${index === playlistIndex && !playlistAudio.paused ? "Ⅱ" : "▶"}</i><span>${escapeHtml(track.name)}</span>
      </button>`).join("");
  };
  const playPlaylistTrack = async (index) => {
    if (!playlistTracks.length) return false;
    playlistIndex = (index + playlistTracks.length) % playlistTracks.length;
    playlistAudio.src = playlistTracks[playlistIndex].url;
    await playlistAudio.play();
    renderPlaylist();
    return true;
  };
  const addPlaylistFiles = (files) => {
    const audioFiles = [...files].filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(file.name));
    playlistTracks.push(...audioFiles.map((file) => ({ name: file.webkitRelativePath || file.name, url: URL.createObjectURL(file) })));
    if (playlistIndex < 0 && playlistTracks.length) playlistIndex = 0;
    renderPlaylist();
    addNotification("Musik Core", `${audioFiles.length} Titel zur Playlist hinzugefügt`);
  };

  const addNotification = (title, text, category = "core") => {
    notifications.unshift({ title, text, category, time: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) });
    notifications.splice(16);
    renderNotifications();
    showToast(`${title} · ${text}`);
  };

  const renderNotifications = () => {
    const list = document.querySelector("#notificationList");
    if (!list) return;
    const visible = notificationFilter === "all" ? notifications : notifications.filter((item) => item.category === notificationFilter);
    list.innerHTML = visible.length ? visible.map((item) => `
      <div class="notification-item" data-category="${item.category}"><strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.text)}<small>${item.time}</small></div>
    `).join("") : `<div class="notification-item"><strong>Alles ruhig</strong>In diesem Kanal gibt es noch keine Meldung.</div>`;
  };

  const applyRightPanel = () => {
    const messageZone = document.querySelector(".message-zone");
    const widgetZone = document.querySelector("#widgetZone");
    const mode = state.rightPanelMode || (state.claimVisible ? "claim" : "system");
    messageZone.hidden = mode !== "claim";
    widgetZone.hidden = mode === "claim" || mode === "empty";
    if (!widgetZone.hidden) activateWidget(mode);
  };

  const renderShortcuts = () => {
    const rail = document.querySelector(".shortcut-rail");
    const dragHandle = rail.querySelector(".shortcut-drag-handle");
    rail.innerHTML = `
      <div class="shortcut-options">
        <button class="shortcut shortcut-options__toggle" data-host-action="shortcut-options"><i>＋</i><span>Optionen</span></button>
        <div class="shortcut-options__menu" id="shortcutOptionsMenu" hidden>
          <button data-host-action="add-file">＋ Datei</button>
          <button data-host-action="add-folder">＋ Ordner</button>
        </div>
      </div>` + state.shortcuts.map((item) => (
      `<button class="shortcut action" data-real-kind="${escapeHtml(item.Kind)}" data-real-target="${encodeURIComponent(item.Target)}" title="Rechtsklick für Funktionen">${nativeIcon(item.Target, escapeHtml(item.Glyph))}<span>${escapeHtml(item.Name)}</span></button>`
    )).join("");
    if (dragHandle) rail.prepend(dragHandle);
  };

  const applyBackground = () => {
    if (state.customBackground) {
      desktop.style.setProperty("--custom-wallpaper", `url("/api/background?token=${encodeURIComponent(token)}&v=${state.backgroundVersion}")`);
      desktop.classList.add("has-custom-background");
    } else {
      desktop.style.removeProperty("--custom-wallpaper");
      desktop.classList.remove("has-custom-background");
    }
  };

  const loadDesktopFiles = async () => {
    const result = await api("/api/desktop-items");
    windowsDesktopPath = result.path;
    result.items.sort((a, b) => {
      if (desktopSort === "date") return Number(b.modified || 0) - Number(a.modified || 0);
      if (desktopSort === "type") return String(a.extension || "").localeCompare(String(b.extension || ""), "de");
      return String(a.name).localeCompare(String(b.name), "de", { numeric: true });
    });
    const layer = document.querySelector("#desktopIconLayer");
    layer.classList.remove("size-large", "size-medium", "size-small");
    layer.classList.add(`size-${desktopIconSize}`);
    const iconWidth = desktopIconSize === "large" ? 112 : desktopIconSize === "small" ? 76 : 92;
    const cell = iconWidth + 12;
    let positions = {};
    try { positions = JSON.parse(localStorage.getItem("neonDesktopIconPositions") || "{}"); } catch {}
    layer.innerHTML = result.items.map((item, index) => {
      const columns = Math.max(1, Math.floor((layer.clientWidth - 175) / cell));
      const automatic = { x: 175 + ((index % columns) * cell), y: 8 + (Math.floor(index / columns) * cell) };
      const fallback = { x: 175 + ((index % Math.max(1, columns)) * cell), y: Math.max(8, layer.clientHeight - cell - (Math.floor(index / Math.max(1, columns)) * cell)) };
      const position = desktopAutoArrange ? automatic : (positions[item.path] || fallback);
      const alignedX = desktopAlignGrid ? Math.round(Number(position.x) / cell) * cell : Number(position.x);
      const alignedY = desktopAlignGrid ? Math.round(Number(position.y) / cell) * cell : Number(position.y);
      const safeX = Math.max(0, Math.min(Math.max(0, layer.clientWidth - iconWidth), alignedX || 0));
      const safeY = Math.max(0, Math.min(Math.max(0, layer.clientHeight - iconWidth), alignedY || 0));
      return `
      <button class="desktop-icon" style="left:${safeX}px;top:${safeY}px" data-explorer-target="${encodeURIComponent(item.path)}" data-explorer-name="${encodeURIComponent(item.name)}" data-explorer-directory="${item.directory}" title="${escapeHtml(item.name)} · Doppelklick öffnet">
        ${nativeIcon(item.path, item.directory ? "◇" : "▤")}<span>${escapeHtml(item.name)}</span>
      </button>`;
    }).join("");
    layer.classList.toggle("is-empty", result.items.length === 0);
  };

  const updateDesktopMenuState = () => {
    document.querySelector("#desktopAutoArrange").textContent = `${desktopAutoArrange ? "✓" : "○"} Symbole automatisch anordnen`;
    document.querySelector("#desktopAlignGrid").textContent = `${desktopAlignGrid ? "✓" : "○"} Symbole am Raster ausrichten`;
    const visible = !document.querySelector("#desktopIconLayer").classList.contains("is-hidden");
    document.querySelector("#desktopShowIcons").textContent = `${visible ? "✓" : "○"} Desktopsymbole anzeigen`;
  };

  const refreshState = async () => {
    state = await api("/api/state");
    renderShortcuts();
    applyRightPanel();
    applyBackground();
    renderAppBadge();
  };

  const openRealTarget = async (kind, target) => {
    await api("/api/open", { kind, target });
    showToast("Windows-Ordner wurde geöffnet");
    addNotification("Windows geöffnet", target || kind, "windows");
  };

  const renderAppBadge = () => {
    const button = document.querySelector('.taskbar__nav [data-action="apps"]');
    let badge = button.querySelector(".app-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "app-count";
      button.appendChild(badge);
    }
    badge.textContent = state.openWindows.length;
    button.classList.toggle("has-open-apps", state.openWindows.length > 0);
    const runningApps = document.querySelector("#runningApps");
    runningApps.innerHTML = state.openWindows.slice(0, 9).map((item) => `
      <button class="task-app-button" data-task-process-id="${item.Id}" aria-label="${escapeHtml(item.Title)}">
        ${nativeIcon(item.Path || "", "▣")}
        <span class="task-preview"><img src="/api/window-preview?token=${encodeURIComponent(token)}&id=${item.Id}&v=${Date.now()}" alt=""></span>
      </button>
    `).join("");
  };

  const activateWidget = (name) => {
    const fallback = ["system", "music", "calendar", "notifications", "ai", "weather", "social", "news"].includes(name) ? name : "system";
    document.querySelectorAll("[data-widget]").forEach((button) => button.classList.toggle("is-active", button.dataset.widget === fallback));
    document.querySelectorAll("[data-widget-view]").forEach((view) => view.classList.toggle("is-active", view.dataset.widgetView === fallback));
  };

  const setRightPanel = async (mode) => {
    await api("/api/panel", { mode });
    state.rightPanelMode = mode;
    state.claimVisible = mode === "claim";
    applyRightPanel();
    addNotification("Ansicht gewechselt", mode === "claim" ? "Werbeschrift" : mode);
  };

  const loadDrives = async () => {
    const data = await api("/api/drives");
    const list = document.querySelector("#driveList");
    list.innerHTML = data.drives.map((drive) => `
      <button data-host-action="explorer-path" data-explorer-target="${encodeURIComponent(drive.path)}">
        <span>${escapeHtml(drive.name)} · ${escapeHtml(drive.label)}</span>
        <strong>${drive.freeGb} GB frei</strong>
      </button>
    `).join("");
    const lowDrive = data.drives.find((drive) => drive.totalGb > 0 && drive.usedPercent >= 90);
    if (lowDrive && lastSystemAlert !== `drive-${lowDrive.path}`) {
      lastSystemAlert = `drive-${lowDrive.path}`;
      addNotification("Windows Speicher", `${lowDrive.name}: nur noch ${lowDrive.freeGb} GB frei`, "windows");
    }
  };

  const weatherVisual = (code, isDay) => {
    if (code === 0) return { icon: isDay ? "☀" : "☾", text: "Klar" };
    if ([1, 2].includes(code)) return { icon: "◒", text: "Leicht bewölkt" };
    if (code === 3) return { icon: "☁", text: "Bedeckt" };
    if ([45, 48].includes(code)) return { icon: "≋", text: "Nebel" };
    if ([51, 53, 55, 56, 57].includes(code)) return { icon: "⋰", text: "Nieselregen" };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: "☂", text: "Regen" };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: "✻", text: "Schnee" };
    if ([95, 96, 99].includes(code)) return { icon: "ϟ", text: "Gewitter" };
    return { icon: "◌", text: "Wechselhaft" };
  };

  const fetchWithTimeout = async (url, options = {}, timeout = 4500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  };

  const loadWeather = async (city = "") => {
    document.querySelector("#weatherDescription").textContent = "Wetter wird geladen …";
    const requestedCity = city || document.querySelector("#weatherCity").value.trim() || state.weatherCity || "Berlin";
    let weather;
    try {
      const geoResponse = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(requestedCity)}&count=1&language=de&format=json`);
      if (!geoResponse.ok) throw new Error("Ort konnte nicht geladen werden");
      const geo = await geoResponse.json();
      const place = geo.results?.[0];
      if (!place) throw new Error("Ort nicht gefunden");
      const forecastResponse = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
      if (!forecastResponse.ok) throw new Error("Wetterdienst nicht erreichbar");
      const forecast = await forecastResponse.json();
      weather = {
        location: place.name, country: place.country || "",
        temperature: Math.round(forecast.current.temperature_2m),
        feels: Math.round(forecast.current.apparent_temperature),
        code: forecast.current.weather_code, isDay: forecast.current.is_day,
        wind: Math.round(forecast.current.wind_speed_10m),
        min: Math.round(forecast.daily.temperature_2m_min[0]),
        max: Math.round(forecast.daily.temperature_2m_max[0]),
      };
      localStorage.setItem("neonWeatherCache", JSON.stringify({ weather, saved: Date.now() }));
    } catch (error) {
      const cached = JSON.parse(localStorage.getItem("neonWeatherCache") || "null");
      if (!cached?.weather) throw new Error("Wetter derzeit offline – der Core läuft weiter.");
      weather = cached.weather;
      document.querySelector("#weatherDescription").textContent = "Letzte gespeicherte Daten";
    }
    const visual = weatherVisual(Number(weather.code), Number(weather.isDay) === 1);
    document.querySelector("#weatherCity").value = weather.location.split(",")[0];
    document.querySelector("#weatherIcon").textContent = visual.icon;
    document.querySelector("#weatherTemperature").textContent = `${weather.temperature}°`;
    if (document.querySelector("#weatherDescription").textContent !== "Letzte gespeicherte Daten") document.querySelector("#weatherDescription").textContent = visual.text;
    document.querySelector("#weatherLocation").textContent = `${weather.location} · ${weather.country}`;
    document.querySelector("#weatherFeels").textContent = `${weather.feels}°`;
    document.querySelector("#weatherWind").textContent = `${weather.wind} km/h`;
    document.querySelector("#weatherRange").textContent = `${weather.min}° / ${weather.max}°`;
  };

  const loadNews = async () => {
    const list = document.querySelector("#newsList");
    list.innerHTML = `<div class="notification-item">Nachrichten werden geladen …</div>`;
    let items = [];
    let offline = false;
    try {
      const response = await fetchWithTimeout("https://www.tagesschau.de/api2u/homepage/", {}, 4500);
      if (!response.ok) throw new Error("News nicht erreichbar");
      const data = await response.json();
      items = (data.news || []).slice(0, 12).map((item) => ({
        title: item.title || "Tagesschau",
        link: item.shareURL || item.detailsweb || "https://www.tagesschau.de/",
        date: item.date ? new Date(item.date).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "",
        description: item.firstSentence || "",
      }));
      localStorage.setItem("neonNewsCache", JSON.stringify({ items, saved: Date.now() }));
    } catch {
      items = JSON.parse(localStorage.getItem("neonNewsCache") || "null")?.items || [];
      offline = true;
    }
    list.innerHTML = items.length ? `${offline ? '<div class="notification-item news-offline">Offline · letzte gespeicherte Meldungen</div>' : ""}${items.map((item) => `
      <button class="news-item" data-host-action="open-news" data-news-url="${encodeURIComponent(item.link)}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.date)}${item.description ? ` · ${escapeHtml(item.description)}` : ""}</span>
      </button>
    `).join("")}` : `<div class="notification-item">Weltnews derzeit offline – der Core bleibt weiter bedienbar.</div>`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let value = Number(bytes);
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
  };

  const showExplorer = async (path = "::drives", pushHistory = true) => {
    const result = await api("/api/list", { path });
    if (pushHistory && explorerPath && explorerPath !== result.rawPath) explorerHistory.push(explorerPath);
    explorerPath = result.rawPath;
    explorerParent = result.parent;
    closePanels();
    windowTitle.innerHTML = "<i></i> NEONMIND EXPLORER";
    windowPath.textContent = result.path;
    files.className = `files view-${explorerView}`;
    files.innerHTML = result.items.length ? result.items.map((item) => `
      <button class="file-card" draggable="true" data-host-action="${item.directory ? "explorer-path" : "explorer-file"}" data-explorer-target="${encodeURIComponent(item.path)}" data-explorer-name="${encodeURIComponent(item.name)}" data-explorer-directory="${item.directory}">
        ${nativeIcon(item.path, item.directory ? "◇" : "▤")}
        <span>${escapeHtml(item.name)}</span>
        <small>${item.directory ? (item.modified || "Ordner") : `${formatSize(item.size)}${item.modified ? ` · ${escapeHtml(item.modified)}` : ""}`}</small>
      </button>
    `).join("") : `<div class="file-card"><i>○</i><span>Dieser Ordner ist leer</span></div>`;
    windowPanel.classList.add("is-open");
    windowPanel.classList.remove("is-minimized");
    document.querySelector("#restoreExplorerButton").hidden = true;
    windowPanel.setAttribute("aria-hidden", "false");
    addNotification("Explorer", result.path);
  };

  const setExplorerView = (view) => {
    explorerView = view;
    localStorage.setItem("neonExplorerView", view);
    files.className = `files view-${view}`;
    addNotification("Explorer-Ansicht", view === "large" ? "Große Symbole" : view === "list" ? "Liste" : "Details");
  };

  const hideExplorerContextMenu = () => {
    document.querySelector("#explorerContextMenu").hidden = true;
  };

  const hideDesktopContextMenu = () => {
    document.querySelector("#desktopContextMenu").hidden = true;
  };

  const showItemContextMenu = (item, clientX, clientY) => {
    selectedExplorer = item;
    const menu = document.querySelector("#explorerContextMenu");
    const extension = item.name.includes(".") ? item.name.split(".").pop().toLowerCase() : "";
    const isImage = ["jpg", "jpeg", "png", "webp"].includes(extension);
    menu.querySelectorAll("[data-file-only]").forEach((button) => { button.hidden = item.directory; });
    menu.querySelectorAll("[data-folder-only]").forEach((button) => { button.hidden = !item.directory; });
    menu.querySelectorAll("[data-image-only]").forEach((button) => { button.hidden = !isImage; });
    menu.querySelectorAll("[data-mutable]").forEach((button) => { button.hidden = Boolean(item.pinned); });
    menu.querySelectorAll("[data-pinned-only]").forEach((button) => { button.hidden = !item.pinned; });
    menu.hidden = false;
    menu.style.left = `${Math.min(clientX, innerWidth - 200)}px`;
    menu.style.top = `${Math.min(clientY, Math.max(12, innerHeight - 470))}px`;
  };

  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const getCalendarEvents = () => {
    try { return JSON.parse(localStorage.getItem("neonCalendarEvents") || "[]"); }
    catch { return []; }
  };
  const renderCalendar = () => {
    const now = new Date();
    document.querySelector("#calendarDay").textContent = now.getDate().toString().padStart(2, "0");
    document.querySelector("#calendarWeekday").textContent = now.toLocaleDateString("de-DE", { weekday: "long" });
    document.querySelector("#calendarMonth").textContent = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    document.querySelector("#calendarFullDate").textContent = now.toLocaleDateString("de-DE");
    document.querySelector("#calendarDayView").hidden = calendarMode !== "day";
    document.querySelector("#calendarMonthView").hidden = calendarMode !== "month";
    document.querySelectorAll("[data-calendar-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.calendarMode === calendarMode));
    if (calendarMode !== "month") return;
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    document.querySelector("#calendarTitle").textContent = calendarCursor.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const events = getCalendarEvents();
    const cells = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => `<span class="calendar-weekday">${day}</span>`);
    for (let index = 0; index < firstOffset; index += 1) cells.push("<span></span>");
    for (let day = 1; day <= days; day += 1) {
      const current = new Date(year, month, day);
      const key = dateKey(current);
      const hasEvent = events.some((item) => item.date === key);
      cells.push(`<button class="calendar-cell ${dateKey(now) === key ? "is-today" : ""} ${calendarSelectedDate === key ? "is-selected" : ""}" data-calendar-date="${key}">${day}${hasEvent ? "<i></i>" : ""}</button>`);
    }
    document.querySelector("#calendarGrid").innerHTML = cells.join("");
    const visibleEvents = events.filter((item) => !calendarSelectedDate || item.date === calendarSelectedDate).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    document.querySelector("#calendarEventList").innerHTML = visibleEvents.length ? visibleEvents.map((item) => `
      <div class="calendar-event"><span><strong>${escapeHtml(item.title)}</strong><small>${new Date(`${item.date}T12:00:00`).toLocaleDateString("de-DE")}${item.time ? ` · ${escapeHtml(item.time)}` : ""}</small></span><button data-calendar-delete="${item.id}" title="Termin löschen">×</button></div>
    `).join("") : `<div class="calendar-empty">${calendarSelectedDate ? "Keine Termine an diesem Tag." : "Noch keine Termine gespeichert."}</div>`;
  };

  const addCalendarEvent = () => {
    const defaultDate = calendarSelectedDate || dateKey(new Date());
    const date = prompt("Datum des Termins (JJJJ-MM-TT):", defaultDate);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const title = prompt("Bezeichnung des Termins:");
    if (!title?.trim()) return;
    const time = prompt("Uhrzeit (optional, z. B. 18:30):", "") || "";
    const events = getCalendarEvents();
    events.push({ id: `${Date.now()}`, date, time, title: title.trim() });
    localStorage.setItem("neonCalendarEvents", JSON.stringify(events));
    calendarSelectedDate = date;
    calendarCursor = new Date(`${date}T12:00:00`);
    renderCalendar();
    addNotification("Kalender", `Termin „${title.trim()}“ gespeichert`);
  };

  const showSettings = () => {
    closePanels();
    windowTitle.innerHTML = "<i></i> NEONMIND EINSTELLUNGEN";
    windowPath.textContent = "Desktop anpassen";
    files.innerHTML = `
      ${Object.entries(themeCatalog).map(([key, theme]) => `
        <button class="file-card theme-card ${document.querySelector("#desktop").dataset.theme === key ? "is-selected" : ""}" data-host-action="theme-select" data-theme="${key}">
          <i>${theme.icon}</i><span>${theme.name}</span><small>${document.querySelector("#desktop").dataset.theme === key ? "AKTIV" : "DESIGN"}</small>
        </button>
      `).join("")}
      <button class="file-card" data-host-action="toggle-claim">
        <i>${state.claimVisible ? "◉" : "○"}</i>
        <span>Werbeschrift ${state.claimVisible ? "ausschalten" : "einschalten"}</span>
      </button>
      <button class="file-card" data-host-action="panel-system"><i>▥</i><span>System-Widget rechts</span></button>
      <button class="file-card" data-host-action="panel-music"><i>♫</i><span>Musik-Widget rechts</span></button>
      <button class="file-card" data-host-action="panel-calendar"><i>▦</i><span>Kalender rechts</span></button>
      <button class="file-card" data-host-action="panel-notifications"><i>●</i><span>Meldungen rechts</span></button>
      <button class="file-card" data-host-action="panel-weather"><i>☀</i><span>Wetter-Widget rechts</span></button>
      <button class="file-card" data-host-action="panel-social"><i>◎</i><span>Social-Widget rechts</span></button>
      <button class="file-card" data-host-action="panel-news"><i>▤</i><span>Weltnews-Widget rechts</span></button>
      <button class="file-card" data-host-action="panel-empty"><i>○</i><span>Rechte Fläche leer</span></button>
      <button class="file-card" data-host-action="add-folder">
        <i>＋</i><span>Ordner links hinzufügen</span>
      </button>
      <button class="file-card" data-host-action="add-app">
        <i>◈</i><span>Programm links hinzufügen</span>
      </button>
      <button class="file-card" data-host-action="pick-background">
        <i>▧</i><span>Eigenes Hintergrundbild auswählen</span>
      </button>
      <button class="file-card" data-host-action="clear-background">
        <i>○</i><span>NeonMind-Hintergrund wiederherstellen</span>
      </button>
      <button class="file-card" data-host-action="desktop-files-toggle">
        <i>▦</i><span>Desktop-Symbole ein- oder ausblenden</span>
      </button>
      <button class="file-card" data-host-action="desktop-icons-reset">
        <i>↺</i><span>Positionen der Desktop-Symbole zurücksetzen</span>
      </button>
      <button class="file-card" data-host-action="ai-toggle">
        <i>✦</i><span>NeonMind KI-Widget öffnen</span>
      </button>
      ${state.shortcuts.map((item) => `
        <button class="file-card" data-host-action="remove-shortcut" data-real-target="${encodeURIComponent(item.Target)}">
          <i>×</i><span>${escapeHtml(item.Name)} entfernen</span>
        </button>
      `).join("")}
    `;
    windowPanel.classList.add("is-open");
    windowPanel.setAttribute("aria-hidden", "false");
  };

  const showOpenApps = async () => {
    await refreshState();
    closePanels();
    windowTitle.innerHTML = "<i></i> OFFENE WINDOWS-PROGRAMME";
    windowPath.textContent = `${state.openWindows.length} Fenster geöffnet`;
    files.innerHTML = state.openWindows.length ? state.openWindows.map((item) => `
      <button class="file-card" data-host-action="focus-window" data-process-id="${item.Id}">
        <i>▣</i><span>${escapeHtml(item.Title)}</span>
      </button>
    `).join("") : `<div class="file-card"><i>○</i><span>Keine offenen Fenster gefunden</span></div>`;
    windowPanel.classList.add("is-open");
    windowPanel.setAttribute("aria-hidden", "false");
  };

  document.addEventListener("click", async (event) => {
    const taskAction = event.target.closest("[data-task-window-action]");
    if (taskAction && selectedTaskWindow) {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await api("/api/window-action", { id: selectedTaskWindow.id, action: taskAction.dataset.taskWindowAction });
        document.querySelector("#taskAppMenu").hidden = true;
        setTimeout(refreshOpenWindows, 350);
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    const taskButton = event.target.closest(".task-app-button");
    if (taskButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await api("/api/window-action", { id: Number(taskButton.dataset.taskProcessId), action: "focus" });
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    const pinToggle = event.target.closest("[data-pin-toggle]");
    if (pinToggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      togglePin(pinToggle.dataset.pinToggle);
      return;
    }

    const pinAction = event.target.closest("[data-pin-action]");
    if (pinAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const action = pinAction.dataset.pinAction;
      if (action === "explorer") await showExplorer("::drives");
      if (action === "browser") await api("/api/open", { kind: "Url", target: "https://www.google.com/" });
      if (action === "downloads") {
        const downloads = state.shortcuts.find((item) => item.Name === "Downloads");
        if (downloads) await showExplorer(downloads.Target);
      }
      if (action === "settings") showSettings();
      return;
    }

    const playlistPicker = event.target.closest("[data-playlist-pick]");
    if (playlistPicker) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector(playlistPicker.dataset.playlistPick === "folder" ? "#playlistFolderInput" : "#playlistFileInput").click();
      return;
    }
    const socialButton = event.target.closest("[data-social-url]");
    if (socialButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await api("/api/open", { kind: "Url", target: socialButton.dataset.socialUrl });
      addNotification("Social Core", "Dienst im Standardbrowser geöffnet");
      return;
    }
    const playlistTrack = event.target.closest("[data-playlist-index]");
    if (playlistTrack) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await playPlaylistTrack(Number(playlistTrack.dataset.playlistIndex));
      return;
    }
    if (event.target.closest("[data-playlist-clear]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      playlistAudio.pause();
      playlistTracks.forEach((track) => URL.revokeObjectURL(track.url));
      playlistTracks = [];
      playlistIndex = -1;
      playlistAudio.removeAttribute("src");
      renderPlaylist();
      return;
    }

    const filterButton = event.target.closest("[data-notification-filter]");
    if (filterButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notificationFilter = filterButton.dataset.notificationFilter;
      document.querySelectorAll("[data-notification-filter]").forEach((button) => button.classList.toggle("is-active", button === filterButton));
      renderNotifications();
      return;
    }

    const widgetButton = event.target.closest("[data-widget]");
    if (widgetButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await setRightPanel(widgetButton.dataset.widget);
      if (widgetButton.dataset.widget === "weather") loadWeather().catch((error) => showToast(error.message));
      if (widgetButton.dataset.widget === "news") loadNews().catch((error) => showToast(error.message));
      return;
    }

    const realShortcut = event.target.closest("[data-real-target]");
    if (realShortcut && !realShortcut.dataset.hostAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        const kind = realShortcut.dataset.realKind;
        const target = decodeURIComponent(realShortcut.dataset.realTarget);
        if (kind === "Folder") {
          await showExplorer(target);
        } else if (kind === "Shell" && target === "shell:MyComputerFolder") {
          await showExplorer("::drives");
        } else if (kind === "Shell" && target === "shell:RecycleBinFolder") {
          await showExplorer("::recycle");
        } else {
          await openRealTarget(kind, target);
        }
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    const originalFolder = event.target.closest("[data-folder]");
    if (originalFolder) {
      const shortcut = state.shortcuts.find((item) => item.Name === originalFolder.dataset.folder);
      if (shortcut) {
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
          if (originalFolder.closest(".window-panel") && shortcut.Kind === "Folder") {
            await showExplorer(shortcut.Target);
          } else {
            await openRealTarget(shortcut.Kind, shortcut.Target);
          }
        } catch (error) {
          showToast(error.message);
        }
        return;
      }
    }

    const hostAction = event.target.closest("[data-host-action]");
    if (hostAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        switch (hostAction.dataset.hostAction) {
          case "toggle-claim":
            await setRightPanel(state.claimVisible ? "system" : "claim");
            showSettings();
            break;
          case "panel-system":
            await setRightPanel("system");
            showSettings();
            break;
          case "panel-music":
            await setRightPanel("music");
            showSettings();
            break;
          case "panel-calendar":
            await setRightPanel("calendar");
            showSettings();
            break;
          case "panel-notifications":
            await setRightPanel("notifications");
            showSettings();
            break;
          case "panel-weather":
            await setRightPanel("weather");
            loadWeather().catch((error) => showToast(error.message));
            showSettings();
            break;
          case "panel-news":
            await setRightPanel("news");
            loadNews().catch((error) => showToast(error.message));
            showSettings();
            break;
          case "panel-social":
            await setRightPanel("social");
            showSettings();
            break;
          case "panel-empty":
            await setRightPanel("empty");
            showSettings();
            break;
          case "add-folder":
            await api("/api/pick-folder", {});
            await refreshState();
            document.querySelector("#shortcutOptionsMenu")?.setAttribute("hidden", "");
            break;
          case "add-file":
            await api("/api/pick-file", {});
            await refreshState();
            document.querySelector("#shortcutOptionsMenu")?.setAttribute("hidden", "");
            break;
          case "add-app":
            await api("/api/pick-app", {});
            await refreshState();
            showSettings();
            break;
          case "shortcut-options": {
            const menu = document.querySelector("#shortcutOptionsMenu");
            menu.hidden = !menu.hidden;
            break;
          }
          case "theme-select":
            applyTheme(hostAction.dataset.theme);
            addNotification("Template Switcher", `${themeCatalog[hostAction.dataset.theme]?.name || "Design"} aktiviert`);
            showSettings();
            break;
          case "desktop-files-toggle": {
            const layer = document.querySelector("#desktopIconLayer");
            layer.classList.toggle("is-hidden");
            localStorage.setItem("neonDesktopIconsVisible", layer.classList.contains("is-hidden") ? "false" : "true");
            if (!layer.classList.contains("is-hidden")) await loadDesktopFiles();
            updateDesktopMenuState();
            hideDesktopContextMenu();
            break;
          }
          case "desktop-icons-reset":
            localStorage.removeItem("neonDesktopIconPositions");
            await loadDesktopFiles();
            addNotification("Desktop-Symbole", "Positionen wurden neu angeordnet");
            break;
          case "ai-toggle": {
            await setRightPanel("ai");
            addNotification("KI Chat", "KI Chat ist jetzt im Widget Core aktiv");
            break;
          }
          case "open-chatgpt":
            await api("/api/open", { kind: "Url", target: "https://chatgpt.com/" });
            addNotification("KI Chat", "ChatGPT wurde mit deinem Browserprofil geöffnet");
            break;
          case "news-refresh":
            await loadNews();
            addNotification("Nachrichten", "Meldungen wurden aktualisiert");
            break;
          case "open-news":
            await api("/api/open", { kind: "Url", target: decodeURIComponent(hostAction.dataset.newsUrl) });
            break;
          case "session-logout":
          case "session-restart":
          case "session-shutdown": {
            const sessionAction = hostAction.dataset.hostAction.replace("session-", "");
            const label = sessionAction === "logout" ? "abmelden" : sessionAction === "restart" ? "neu starten" : "herunterfahren";
            if (!confirm(`Windows wirklich ${label}? Offene, nicht gespeicherte Arbeit kann verloren gehen.`)) break;
            await api("/api/session", { action: sessionAction });
            break;
          }
          case "app-exit":
            if (!confirm("NeonMind Desktop Core wirklich vollständig beenden?")) break;
            await api("/api/exit", {});
            break;
          case "pick-background": {
            const result = await api("/api/pick-background", {});
            if (result.ok) {
              await refreshState();
              addNotification("Hintergrund", "Eigenes Bild wurde aktiviert");
            }
            showSettings();
            break;
          }
          case "clear-background":
            await api("/api/clear-background", {});
            await refreshState();
            addNotification("Hintergrund", "NeonMind-Design wurde wiederhergestellt");
            showSettings();
            break;
          case "desktop-size-large":
          case "desktop-size-medium":
          case "desktop-size-small":
            desktopIconSize = hostAction.dataset.hostAction.replace("desktop-size-", "");
            localStorage.setItem("neonDesktopIconSize", desktopIconSize);
            await loadDesktopFiles();
            hideDesktopContextMenu();
            break;
          case "desktop-sort-name":
          case "desktop-sort-type":
          case "desktop-sort-date":
            desktopSort = hostAction.dataset.hostAction.replace("desktop-sort-", "");
            localStorage.setItem("neonDesktopSort", desktopSort);
            await loadDesktopFiles();
            hideDesktopContextMenu();
            break;
          case "desktop-auto-arrange":
            desktopAutoArrange = !desktopAutoArrange;
            localStorage.setItem("neonDesktopAutoArrange", String(desktopAutoArrange));
            await loadDesktopFiles();
            updateDesktopMenuState();
            break;
          case "desktop-align-grid":
            desktopAlignGrid = !desktopAlignGrid;
            localStorage.setItem("neonDesktopAlignGrid", String(desktopAlignGrid));
            await loadDesktopFiles();
            updateDesktopMenuState();
            break;
          case "desktop-refresh":
            await loadDesktopFiles();
            hideDesktopContextMenu();
            addNotification("Desktop", "Ansicht wurde aktualisiert");
            break;
          case "desktop-new-folder": {
            const name = prompt("Name des neuen Desktop-Ordners:");
            if (!name) break;
            await api("/api/create-desktop-folder", { name });
            await loadDesktopFiles();
            hideDesktopContextMenu();
            addNotification("Desktop", `Ordner „${name}“ erstellt`, "windows");
            break;
          }
          case "desktop-paste":
            if (!clipboardItem) throw new Error("Die NeonMind-Zwischenablage ist leer.");
            await api("/api/clipboard-paste", { source: clipboardItem.path, destination: windowsDesktopPath, move: clipboardItem.mode === "cut" });
            if (clipboardItem.mode === "cut") clipboardItem = null;
            await loadDesktopFiles();
            hideDesktopContextMenu();
            addNotification("Desktop", "Element wurde eingefügt", "windows");
            break;
          case "display-settings":
            await api("/api/system-settings", { page: "display" });
            hideDesktopContextMenu();
            break;
          case "personalization-settings":
            await api("/api/system-settings", { page: "personalization" });
            hideDesktopContextMenu();
            break;
          case "remove-shortcut":
            await api("/api/remove-shortcut", { target: decodeURIComponent(hostAction.dataset.realTarget) });
            await refreshState();
            showSettings();
            break;
          case "focus-window":
            await api("/api/focus", { id: Number(hostAction.dataset.processId) });
            break;
          case "playpause":
            if (playlistTracks.length) {
              if (!playlistAudio.src) await playPlaylistTrack(Math.max(0, playlistIndex));
              else if (playlistAudio.paused) await playlistAudio.play();
              else playlistAudio.pause();
              renderPlaylist();
            } else {
              await api("/api/media", { command: "playpause" });
            }
            showToast("Wiedergabe/Pause");
            addNotification("Media Core", "Wiedergabe/Pause");
            break;
          case "media-previous":
            if (playlistTracks.length) await playPlaylistTrack(playlistIndex - 1);
            else await api("/api/media", { command: "previous" });
            addNotification("Media Core", "Vorheriger Titel");
            break;
          case "media-next":
            if (playlistTracks.length) await playPlaylistTrack(playlistIndex + 1);
            else await api("/api/media", { command: "next" });
            addNotification("Media Core", "Nächster Titel");
            break;
          case "media-mute":
            await api("/api/media", { command: "mute" });
            addNotification("Media Core", "Stummschaltung umgeschaltet");
            break;
          case "task-manager":
            await api("/api/task-manager", {});
            addNotification("Windows System", "Task-Manager geöffnet", "windows");
            break;
          case "open-website":
            await api("/api/open", { kind: "Url", target: "https://neonmind-ai.com" });
            addNotification("NeonMind", "Website im Browser geöffnet");
            break;
          case "widget-close":
            await setRightPanel("empty");
            break;
          case "widget-dock": {
            const widget = document.querySelector("#widgetZone");
            widget.classList.remove("is-floating");
            widget.style.cssText = "";
            localStorage.removeItem("neonWidgetGeometry");
            addNotification("Widget", "Wieder rechts eingerastet");
            break;
          }
          case "open-explorer":
            await showExplorer("::drives");
            break;
          case "explorer-path":
            await showExplorer(decodeURIComponent(hostAction.dataset.explorerTarget));
            break;
          case "explorer-file":
            await openRealTarget("File", decodeURIComponent(hostAction.dataset.explorerTarget));
            break;
          case "explorer-back": {
            const previous = explorerHistory.pop() || "::drives";
            await showExplorer(previous, false);
            break;
          }
          case "explorer-up":
            await showExplorer(explorerParent || "::drives");
            break;
          case "explorer-refresh":
            await showExplorer(explorerPath, false);
            break;
          case "explorer-view-large":
            setExplorerView("large");
            break;
          case "explorer-view-list":
            setExplorerView("list");
            break;
          case "explorer-view-details":
            setExplorerView("details");
            break;
          case "explorer-new-folder": {
            if (explorerPath === "::drives") throw new Error("Bitte zuerst ein Laufwerk oder einen Ordner öffnen.");
            const name = prompt("Name des neuen Ordners:");
            if (!name) break;
            await api("/api/create-folder", { path: explorerPath, name });
            await showExplorer(explorerPath, false);
            addNotification("Explorer", `Ordner „${name}“ erstellt`, "windows");
            break;
          }
          case "explorer-minimize":
            windowPanel.classList.remove("is-open");
            windowPanel.classList.add("is-minimized");
            windowPanel.setAttribute("aria-hidden", "true");
            document.querySelector("#restoreExplorerButton").hidden = false;
            addNotification("Explorer", "Unten im Dock minimiert");
            break;
          case "explorer-restore":
            windowPanel.classList.add("is-open");
            windowPanel.classList.remove("is-minimized");
            windowPanel.setAttribute("aria-hidden", "false");
            document.querySelector("#restoreExplorerButton").hidden = true;
            break;
          case "explorer-maximize":
            windowPanel.classList.toggle("is-maximized");
            if (windowPanel.classList.contains("is-maximized")) windowPanel.classList.add("is-free");
            break;
          case "explorer-close":
            windowPanel.classList.remove("is-open", "is-minimized");
            windowPanel.setAttribute("aria-hidden", "true");
            document.querySelector("#restoreExplorerButton").hidden = true;
            break;
          case "explorer-open-selected":
            if (!selectedExplorer) break;
            if (selectedExplorer.directory) await showExplorer(selectedExplorer.path);
            else await openRealTarget("File", selectedExplorer.path);
            hideExplorerContextMenu();
            break;
          case "explorer-open-with":
            if (!selectedExplorer || selectedExplorer.directory) break;
            await api("/api/file-action", { action: "open-with", path: selectedExplorer.path });
            hideExplorerContextMenu();
            break;
          case "explorer-show-windows":
            if (!selectedExplorer) break;
            await api("/api/file-action", { action: "show-windows", path: selectedExplorer.path });
            hideExplorerContextMenu();
            break;
          case "explorer-terminal":
            if (!selectedExplorer) break;
            await api("/api/file-action", { action: "terminal", path: selectedExplorer.path });
            hideExplorerContextMenu();
            break;
          case "explorer-print":
            if (!selectedExplorer || selectedExplorer.directory) break;
            await api("/api/file-action", { action: "print", path: selectedExplorer.path });
            hideExplorerContextMenu();
            break;
          case "explorer-properties":
            if (!selectedExplorer) break;
            await api("/api/file-action", { action: "properties", path: selectedExplorer.path });
            hideExplorerContextMenu();
            break;
          case "remove-pinned-shortcut":
            if (!selectedExplorer?.pinned) break;
            await api("/api/remove-shortcut", { target: selectedExplorer.path });
            hideExplorerContextMenu();
            await refreshState();
            addNotification("Schnellzugriff", "Eintrag wurde aus der NeonMind-Leiste entfernt");
            break;
          case "explorer-shortcut":
            if (!selectedExplorer) break;
            await api("/api/file-action", { action: "shortcut", path: selectedExplorer.path });
            hideExplorerContextMenu();
            await loadDesktopFiles();
            addNotification("Desktop", "Verknüpfung wurde erstellt", "windows");
            break;
          case "explorer-set-background":
            if (!selectedExplorer) break;
            await api("/api/file-action", { action: "set-background", path: selectedExplorer.path });
            hideExplorerContextMenu();
            await refreshState();
            addNotification("Hintergrund", `„${selectedExplorer.name}“ wurde aktiviert`);
            break;
          case "explorer-copy":
          case "explorer-cut":
            if (!selectedExplorer) break;
            clipboardItem = { path: selectedExplorer.path, mode: hostAction.dataset.hostAction === "explorer-cut" ? "cut" : "copy" };
            hideExplorerContextMenu();
            addNotification("Zwischenablage", `${selectedExplorer.name} wurde ${clipboardItem.mode === "cut" ? "ausgeschnitten" : "kopiert"}`, "windows");
            break;
          case "explorer-paste-into":
            if (!selectedExplorer?.directory) break;
            if (!clipboardItem) throw new Error("Die NeonMind-Zwischenablage ist leer.");
            await api("/api/clipboard-paste", { source: clipboardItem.path, destination: selectedExplorer.path, move: clipboardItem.mode === "cut" });
            if (clipboardItem.mode === "cut") clipboardItem = null;
            hideExplorerContextMenu();
            await showExplorer(selectedExplorer.path, false);
            await loadDesktopFiles();
            addNotification("Explorer", "Element wurde eingefügt", "windows");
            break;
          case "explorer-rename": {
            if (!selectedExplorer) break;
            const name = prompt("Neuer Name:", selectedExplorer.name);
            if (!name || name === selectedExplorer.name) break;
            await api("/api/rename", { path: selectedExplorer.path, name });
            hideExplorerContextMenu();
            await showExplorer(explorerPath, false);
            await loadDesktopFiles();
            addNotification("Windows Explorer", `In „${name}“ umbenannt`, "windows");
            break;
          }
          case "explorer-move":
            if (!selectedExplorer) break;
            {
              const moved = await api("/api/move", { path: selectedExplorer.path });
              hideExplorerContextMenu();
              if (moved.ok) {
                await showExplorer(explorerPath, false);
                await loadDesktopFiles();
                addNotification("Windows Explorer", "Element wurde verschoben", "windows");
              }
            }
            break;
          case "explorer-delete":
            if (!selectedExplorer) break;
            if (!confirm(`„${selectedExplorer.name}“ in den Papierkorb verschieben?`)) break;
            await api("/api/delete", { path: selectedExplorer.path });
            hideExplorerContextMenu();
            await showExplorer(explorerPath, false);
            await loadDesktopFiles();
            addNotification("Windows Explorer", "Element liegt jetzt im Papierkorb", "windows");
            break;
        }
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "apps") {
        event.preventDefault();
        event.stopImmediatePropagation();
        await showOpenApps();
      } else if (action === "explorer") {
        event.preventDefault();
        event.stopImmediatePropagation();
        await showExplorer("::drives");
      } else if (action === "gallery") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const pictures = state.shortcuts.find((item) => item.Name === "Bilder");
        if (pictures) await showExplorer(pictures.Target);
      } else if (action === "trash") {
        event.preventDefault();
        event.stopImmediatePropagation();
        await openRealTarget("Shell", "shell:RecycleBinFolder");
      } else if (action === "settings") {
        event.preventDefault();
        event.stopImmediatePropagation();
        showSettings();
      } else if (action === "sound") {
        event.preventDefault();
        event.stopImmediatePropagation();
        await api("/api/media", { command: "playpause" });
        showToast("Wiedergabe/Pause");
      } else if (action === "core") {
        addNotification("Core Engine", coreToggle.classList.contains("is-on") ? "Core wird pausiert" : "Core wird aktiviert");
      } else if (action === "fullscreen") {
        addNotification("Darstellung", "Vollbildmodus umgeschaltet");
      } else if (action === "power") {
        event.preventDefault();
        event.stopImmediatePropagation();
        await api("/api/shutdown", {});
        window.close();
      }
    } catch (error) {
      showToast(error.message);
    }
  }, true);

  document.addEventListener("contextmenu", async (event) => {
    const taskButton = event.target.closest(".task-app-button");
    if (taskButton) {
      event.preventDefault();
      const id = Number(taskButton.dataset.taskProcessId);
      selectedTaskWindow = state.openWindows.find((item) => Number(item.Id) === id) || { id, Title: "Windows-Programm" };
      selectedTaskWindow.id = id;
      document.querySelector("#taskAppTitle").textContent = selectedTaskWindow.Title;
      const menu = document.querySelector("#taskAppMenu");
      menu.hidden = false;
      menu.style.left = `${Math.min(event.clientX, innerWidth - 205)}px`;
      menu.style.top = `${Math.min(event.clientY, innerHeight - 155)}px`;
      return;
    }

    const explorerItem = event.target.closest("[data-explorer-target]");
    if (explorerItem && (explorerItem.closest("#files") || explorerItem.classList.contains("desktop-icon"))) {
      event.preventDefault();
      showItemContextMenu({
        path: decodeURIComponent(explorerItem.dataset.explorerTarget),
        name: decodeURIComponent(explorerItem.dataset.explorerName),
        directory: explorerItem.dataset.explorerDirectory === "true",
      }, event.clientX, event.clientY);
      return;
    }
    const freeDesktop = event.target.closest(".desktop-stage");
    if (freeDesktop && !event.target.closest("button,.widget-zone,.panel,.explorer-context-menu")) {
      event.preventDefault();
      hideExplorerContextMenu();
      updateDesktopMenuState();
      const menu = document.querySelector("#desktopContextMenu");
      menu.hidden = false;
      menu.style.left = `${Math.min(event.clientX, innerWidth - 265)}px`;
      menu.style.top = `${Math.min(event.clientY, Math.max(12, innerHeight - 560))}px`;
      return;
    }
    const shortcut = event.target.closest("[data-real-target]");
    if (!shortcut || shortcut.dataset.hostAction) return;
    event.preventDefault();
    const shortcutKind = shortcut.dataset.realKind;
    if (["App", "Folder", "File"].includes(shortcutKind)) {
      showItemContextMenu({
        path: decodeURIComponent(shortcut.dataset.realTarget),
        name: shortcut.querySelector("span")?.textContent || "Verknüpfung",
        directory: shortcutKind === "Folder",
        pinned: true,
      }, event.clientX, event.clientY);
      return;
    }
    if (!confirm(`${shortcut.querySelector("span").textContent} links entfernen?`)) return;
    await api("/api/remove-shortcut", { target: decodeURIComponent(shortcut.dataset.realTarget) });
    await refreshState();
  });

  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".file-card[data-explorer-target]");
    if (!card || !event.dataTransfer) return;
    const path = decodeURIComponent(card.dataset.explorerTarget);
    const name = decodeURIComponent(card.dataset.explorerName || "");
    const fileUrl = `file:///${path.replace(/\\/g, "/").replace(/^\/+/, "")}`;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/uri-list", fileUrl);
    event.dataTransfer.setData("text/plain", path);
    if (card.dataset.explorerDirectory !== "true") {
      event.dataTransfer.setData("DownloadURL", `application/octet-stream:${name}:${fileUrl}`);
    }
    card.classList.add("is-native-drag");
  });

  document.addEventListener("dragend", (event) => {
    event.target.closest(".file-card")?.classList.remove("is-native-drag");
  });

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#explorerContextMenu")) hideExplorerContextMenu();
    if (!event.target.closest("#desktopContextMenu")) hideDesktopContextMenu();
    if (!event.target.closest("#taskAppMenu,.task-app-button")) document.querySelector("#taskAppMenu").hidden = true;
  });

  document.querySelector("#desktopIconLayer").addEventListener("dblclick", async (event) => {
    const icon = event.target.closest(".desktop-icon");
    if (!icon || icon.classList.contains("is-dragging")) return;
    const target = decodeURIComponent(icon.dataset.explorerTarget);
    try {
      if (icon.dataset.explorerDirectory === "true") await showExplorer(target);
      else await openRealTarget("File", target);
    } catch (error) {
      showToast(error.message);
    }
  });

  document.querySelector("#desktopIconLayer").addEventListener("pointerdown", (event) => {
    const icon = event.target.closest(".desktop-icon");
    if (!icon || event.button !== 0) return;
    if (!event.ctrlKey && !event.shiftKey && !icon.classList.contains("is-selected")) {
      document.querySelectorAll(".desktop-icon.is-selected").forEach((item) => item.classList.remove("is-selected"));
    }
    icon.classList.add("is-selected");
    if (desktopAutoArrange) {
      showToast("Automatische Anordnung ist aktiv");
      return;
    }
    event.preventDefault();
    const layer = document.querySelector("#desktopIconLayer");
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = icon.offsetLeft;
    const startTop = icon.offsetTop;
    let dragged = false;
    icon.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (!dragged && Math.hypot(deltaX, deltaY) < 4) return;
      dragged = true;
      icon.classList.add("is-dragging");
      icon.style.left = `${Math.max(0, Math.min(layer.clientWidth - icon.offsetWidth, startLeft + deltaX))}px`;
      icon.style.top = `${Math.max(0, Math.min(layer.clientHeight - icon.offsetHeight, startTop + deltaY))}px`;
    };
    const stop = () => {
      icon.removeEventListener("pointermove", move);
      icon.removeEventListener("pointerup", stop);
      icon.removeEventListener("pointercancel", stop);
      if (dragged) {
        if (desktopAlignGrid) {
          const iconWidth = desktopIconSize === "large" ? 112 : desktopIconSize === "small" ? 76 : 92;
          const cell = iconWidth + 12;
          icon.style.left = `${Math.max(0, Math.min(layer.clientWidth - icon.offsetWidth, Math.round(icon.offsetLeft / cell) * cell))}px`;
          icon.style.top = `${Math.max(0, Math.min(layer.clientHeight - icon.offsetHeight, Math.round(icon.offsetTop / cell) * cell))}px`;
        }
        let positions = {};
        try { positions = JSON.parse(localStorage.getItem("neonDesktopIconPositions") || "{}"); } catch {}
        positions[decodeURIComponent(icon.dataset.explorerTarget)] = { x: icon.offsetLeft, y: icon.offsetTop };
        localStorage.setItem("neonDesktopIconPositions", JSON.stringify(positions));
        setTimeout(() => icon.classList.remove("is-dragging"), 80);
      }
    };
    icon.addEventListener("pointermove", move);
    icon.addEventListener("pointerup", stop);
    icon.addEventListener("pointercancel", stop);
  });

  document.querySelector(".desktop-stage").addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(".desktop-icon,.shortcut-rail,.reactor,.message-zone,.widget-zone,.panel,.energy-footer,.taskbar,button,input,a")) return;
    event.preventDefault();
    const stage = event.currentTarget;
    const bounds = stage.getBoundingClientRect();
    const startX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const startY = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    if (!event.ctrlKey && !event.shiftKey) {
      document.querySelectorAll(".desktop-icon.is-selected").forEach((item) => item.classList.remove("is-selected"));
    }
    const box = document.createElement("div");
    box.className = "desktop-selection-box";
    box.style.left = `${startX}px`;
    box.style.top = `${startY}px`;
    stage.appendChild(box);
    stage.setPointerCapture(event.pointerId);

    const updateSelection = (moveEvent) => {
      const currentX = Math.max(0, Math.min(bounds.width, moveEvent.clientX - bounds.left));
      const currentY = Math.max(0, Math.min(bounds.height, moveEvent.clientY - bounds.top));
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      const selectionRect = { left: bounds.left + left, top: bounds.top + top, right: bounds.left + left + width, bottom: bounds.top + top + height };
      document.querySelectorAll(".desktop-icon").forEach((icon) => {
        const iconRect = icon.getBoundingClientRect();
        const overlaps = iconRect.right >= selectionRect.left && iconRect.left <= selectionRect.right && iconRect.bottom >= selectionRect.top && iconRect.top <= selectionRect.bottom;
        icon.classList.toggle("is-selected", overlaps);
      });
    };

    const finishSelection = () => {
      stage.removeEventListener("pointermove", updateSelection);
      stage.removeEventListener("pointerup", finishSelection);
      stage.removeEventListener("pointercancel", finishSelection);
      box.remove();
    };
    stage.addEventListener("pointermove", updateSelection);
    stage.addEventListener("pointerup", finishSelection);
    stage.addEventListener("pointercancel", finishSelection);
  });

  const saveGeometry = (key, element) => {
    if (!element.classList.contains("is-free") && !element.classList.contains("is-floating")) return;
    localStorage.setItem(key, JSON.stringify({
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      height: element.style.height,
    }));
  };

  const restoreGeometry = (key, element, className) => {
    try {
      const geometry = JSON.parse(localStorage.getItem(key));
      if (!geometry) return;
      element.classList.add(className);
      Object.assign(element.style, geometry);
    } catch {}
  };

  const makeMovable = (element, handle, floatingClass, storageKey, beforeMove) => {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || (event.target.closest("button,nav,input") && !event.target.closest(".layout-drag-handle"))) return;
      event.preventDefault();
      if (beforeMove) beforeMove();
      const desktopRect = document.querySelector("#desktop").getBoundingClientRect();
      const current = element.getBoundingClientRect();
      if (!element.classList.contains(floatingClass)) {
        element.classList.add(floatingClass);
        element.style.left = `${current.left - desktopRect.left}px`;
        element.style.top = `${current.top - desktopRect.top}px`;
        element.style.width = `${current.width}px`;
        element.style.height = `${current.height}px`;
      }
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = parseFloat(element.style.left) || current.left;
      const startTop = parseFloat(element.style.top) || current.top;
      const move = (moveEvent) => {
        const maxLeft = Math.max(8, desktopRect.width - element.offsetWidth - 8);
        const maxTop = Math.max(78, desktopRect.height - element.offsetHeight - 62);
        element.style.left = `${Math.max(8, Math.min(maxLeft, startLeft + moveEvent.clientX - startX))}px`;
        element.style.top = `${Math.max(78, Math.min(maxTop, startTop + moveEvent.clientY - startY))}px`;
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        saveGeometry(storageKey, element);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop, { once: true });
    });
  };

  const widgetElement = document.querySelector("#widgetZone");
  makeMovable(widgetElement, document.querySelector(".widget-header"), "is-floating", "neonWidgetGeometry");
  makeMovable(windowPanel, windowPanel.querySelector("header"), "is-free", "neonExplorerGeometry", () => {
    if (windowPanel.classList.contains("is-maximized")) windowPanel.classList.remove("is-maximized");
  });
  const shortcutRail = document.querySelector("#shortcutRail");
  const reactorZone = document.querySelector("#reactorZone");
  makeMovable(shortcutRail, shortcutRail.querySelector(".shortcut-drag-handle"), "is-floating", "neonShortcutGeometry");
  makeMovable(reactorZone, reactorZone.querySelector(".reactor-drag-handle"), "is-floating", "neonReactorGeometry", () => {
    const reactor = reactorZone.querySelector(".reactor");
    const size = Math.max(420, Math.round(reactor.getBoundingClientRect().width || 540));
    reactorZone.style.width = `${size}px`;
    reactorZone.style.height = `${size}px`;
  });
  restoreGeometry("neonWidgetGeometry", widgetElement, "is-floating");
  restoreGeometry("neonExplorerGeometry", windowPanel, "is-free");
  restoreGeometry("neonShortcutGeometry", shortcutRail, "is-floating");
  restoreGeometry("neonReactorGeometry", reactorZone, "is-floating");
  new ResizeObserver(() => {
    saveGeometry("neonWidgetGeometry", widgetElement);
    saveGeometry("neonExplorerGeometry", windowPanel);
  }).observe(widgetElement);
  new ResizeObserver(() => saveGeometry("neonExplorerGeometry", windowPanel)).observe(windowPanel);
  new ResizeObserver(() => saveGeometry("neonReactorGeometry", reactorZone)).observe(reactorZone);

  window.addEventListener("beforeunload", () => {
    navigator.sendBeacon(`/api/shutdown?token=${encodeURIComponent(token)}`);
  });

  const footerDay = document.querySelector("#footerDay");
  const updateWeekday = () => {
    footerDay.textContent = new Date().toLocaleDateString("de-DE", { weekday: "long" });
  };

  const updateSystemStatus = async () => {
    try {
      const system = await api("/api/system");
      document.querySelector("#cpuValue").textContent = `${system.cpu}%`;
      document.querySelector(".lower-status > button:first-child i b").style.width = `${system.cpu}%`;
      document.querySelector("#ramValue").textContent = `${system.ram}%`;
      document.querySelector("#ramBar").style.width = `${system.ram}%`;
      document.querySelector("#widgetCpu").textContent = `${system.cpu}%`;
      document.querySelector("#widgetCpuBar").style.width = `${system.cpu}%`;
      document.querySelector("#widgetRam").textContent = `${system.ram}%`;
      document.querySelector("#widgetRamBar").style.width = `${system.ram}%`;
      document.querySelector("#widgetSystemState").textContent = system.cpu > 85 ? "CORE UNTER LAST" : "CORE ONLINE";
      const alertKey = system.cpu > 90 ? "cpu" : system.ram > 90 ? "ram" : "";
      if (alertKey && alertKey !== lastSystemAlert) {
        lastSystemAlert = alertKey;
        addNotification("Windows System", alertKey === "cpu" ? `CPU-Auslastung bei ${system.cpu}%` : `Arbeitsspeicher bei ${system.ram}%`, "windows");
      } else if (!alertKey && (lastSystemAlert === "cpu" || lastSystemAlert === "ram")) {
        lastSystemAlert = "";
      }
    } catch {}
  };

  const refreshOpenWindows = async () => {
    try {
      const result = await api("/api/windows");
      state.openWindows = result.openWindows;
      renderAppBadge();
      if (previousWindowCount !== null && result.openWindows.length !== previousWindowCount) {
        addNotification("Windows Programme", `${result.openWindows.length} sichtbare Fenster geöffnet`, "windows");
      }
      previousWindowCount = result.openWindows.length;
    } catch {}
  };

  const refreshMediaStatus = async () => {
    if (playlistTracks.length && playlistIndex >= 0) return;
    try {
      const media = await api("/api/media-status");
      document.querySelector("#mediaActiveLabel").textContent =
        media.title || media.process || "Kein aktiver Titel oder Player erkannt.";
    } catch {}
  };

  const volumeSlider = document.querySelector("#volumeSlider");
  const widgetVolumeSlider = document.querySelector("#widgetVolumeSlider");
  const widgetVolumeValue = document.querySelector("#widgetVolumeValue");
  let previousVolume = Number(volumeSlider.value);
  const syncVolumeControls = (value) => {
    volumeSlider.value = value;
    widgetVolumeSlider.value = value;
    widgetVolumeValue.textContent = `${value}%`;
  };
  [volumeSlider, widgetVolumeSlider].forEach((slider) => {
    slider.addEventListener("input", () => {
      syncVolumeControls(Number(slider.value));
      playlistAudio.volume = Number(slider.value) / 100;
    });
    slider.addEventListener("change", async () => {
      const currentVolume = Number(slider.value);
      previousVolume = currentVolume;
      const result = await api("/api/volume", { value: currentVolume });
      syncVolumeControls(result.volume);
      addNotification("Media Core", `Systemlautstärke ${result.volume}%`, "core");
    });
  });
  const refreshVolume = async () => {
    try {
      const result = await api("/api/volume-state");
      previousVolume = result.volume;
      syncVolumeControls(result.volume);
      if (!playlistTracks.length) playlistAudio.volume = result.volume / 100;
    } catch {}
  };
  refreshVolume();
  playlistAudio.volume = previousVolume / 100;
  playlistAudio.addEventListener("ended", () => playPlaylistTrack(playlistIndex + 1));
  playlistAudio.addEventListener("play", renderPlaylist);
  playlistAudio.addEventListener("pause", renderPlaylist);
  document.querySelector("#playlistFileInput").addEventListener("change", (event) => addPlaylistFiles(event.target.files));
  document.querySelector("#playlistFolderInput").addEventListener("change", (event) => addPlaylistFiles(event.target.files));
  renderPinnedApps();
  renderPlaylist();
  applyTheme();

  document.querySelector("#weatherForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const city = document.querySelector("#weatherCity").value.trim();
    try {
      await loadWeather(city);
      addNotification("Wetter", `Wetter für ${city || "gespeicherten Ort"} wurde aktualisiert`);
    } catch (error) {
      showToast(error.message);
    }
  });

  document.querySelectorAll("[data-calendar-mode]").forEach((button) => button.addEventListener("click", () => {
    calendarMode = button.dataset.calendarMode;
    renderCalendar();
  }));
  document.querySelectorAll("[data-calendar-nav]").forEach((button) => button.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + Number(button.dataset.calendarNav), 1);
    calendarSelectedDate = "";
    renderCalendar();
  }));
  document.querySelector("#calendarAdd").addEventListener("click", addCalendarEvent);
  document.querySelector("#calendarGrid").addEventListener("click", (event) => {
    const cell = event.target.closest("[data-calendar-date]");
    if (!cell) return;
    calendarSelectedDate = calendarSelectedDate === cell.dataset.calendarDate ? "" : cell.dataset.calendarDate;
    renderCalendar();
  });
  document.querySelector("#calendarEventList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-calendar-delete]");
    if (!button) return;
    localStorage.setItem("neonCalendarEvents", JSON.stringify(getCalendarEvents().filter((item) => item.id !== button.dataset.calendarDelete)));
    renderCalendar();
  });

  document.querySelector("#aiChatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.querySelector("#aiChatInput");
    const message = input.value.trim();
    if (!message) return;
    const log = document.querySelector("#aiChatLog");
    log.insertAdjacentHTML("beforeend", `<div class="ai-bubble ai-bubble--user">${escapeHtml(message)}</div>`);
    input.value = "";
    const normalized = message.toLowerCase();
    let answer = "Das kann meine lokale Demo-KI noch nicht sicher beantworten. Für echte KI kannst du darunter dein persönliches ChatGPT öffnen.";
    if (/moin|hallo|hey/.test(normalized)) answer = "Moin! NeonMind Core ist online und bereit.";
    else if (/uhr|zeit/.test(normalized)) answer = `Es ist ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.`;
    else if (/datum|tag/.test(normalized)) answer = `Heute ist ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}.`;
    else if (/update|version/.test(normalized)) answer = `Installiert ist NeonMind Desktop Core ${APP_VERSION}. Der Core prüft GitHub automatisch auf neue Releases.`;
    else if (/wetter/.test(normalized)) answer = document.querySelector("#weatherLocation").textContent !== "---"
      ? `${document.querySelector("#weatherLocation").textContent}: ${document.querySelector("#weatherTemperature").textContent}, ${document.querySelector("#weatherDescription").textContent}.`
      : "Öffne zuerst den Wetter-Reiter, damit ich dir die zuletzt geladenen Daten nennen kann.";
    else if (/cpu|ram|system/.test(normalized)) answer = `Der Core meldet CPU ${document.querySelector("#cpuValue").textContent} und RAM ${document.querySelector("#ramValue").textContent}.`;
    setTimeout(() => {
      log.insertAdjacentHTML("beforeend", `<div class="ai-bubble ai-bubble--bot">${escapeHtml(answer)}</div>`);
      log.scrollTop = log.scrollHeight;
    }, 260);
  });

  const compareVersions = (left, right) => {
    const a = String(left).replace(/^v/i, "").split(".").map(Number);
    const b = String(right).replace(/^v/i, "").split(".").map(Number);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
    }
    return 0;
  };
  const checkForUpdates = async () => {
    try {
      const response = await fetchWithTimeout(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } }, 4000);
      if (!response.ok) return;
      const release = await response.json();
      if (compareVersions(release.tag_name, APP_VERSION) <= 0) return;
      const installer = (release.assets || []).find((asset) => /\.exe$/i.test(asset.name));
      const button = document.querySelector("#updateIndicator");
      button.hidden = false;
      button.dataset.updateUrl = installer?.browser_download_url || release.html_url;
      button.title = `NeonMind ${release.tag_name} ist verfügbar`;
      addNotification("Update verfügbar", `${release.tag_name} kann heruntergeladen werden.`);
    } catch {}
  };
  document.querySelector("#updateIndicator").addEventListener("click", async (event) => {
    const url = event.currentTarget.dataset.updateUrl;
    if (url) await api("/api/open", { kind: "Url", target: url });
  });

  refreshState().then(() => {
    document.querySelector("#weatherCity").value = state.weatherCity || "Berlin";
    if (state.rightPanelMode === "weather") loadWeather().catch((error) => showToast(error.message));
    if (state.rightPanelMode === "news") loadNews().catch((error) => showToast(error.message));
  }).catch((error) => showToast(error.message));
  updateWeekday();
  renderCalendar();
  renderNotifications();
  checkForUpdates();
  updateSystemStatus();
  loadDrives().catch(() => {});
  document.querySelector("#desktopIconLayer").classList.toggle("is-hidden", localStorage.getItem("neonDesktopIconsVisible") === "false");
  loadDesktopFiles().catch(() => {});
  addNotification("NeonMind Desktop", "Widget Core und Explorer sind bereit.", "core");
  setInterval(updateWeekday, 60000);
  setInterval(updateSystemStatus, 5000);
  setInterval(refreshOpenWindows, 2000);
  setInterval(refreshMediaStatus, 2500);
  setInterval(refreshVolume, 2000);
  setInterval(() => loadDrives().catch(() => {}), 30000);
})();
