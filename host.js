(() => {
  const token = new URLSearchParams(location.search).get("token");

  const api = async (path, body = {}) => {
    if (!token || location.protocol !== "http:") return null;
    const response = await fetch(`${path}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Core API ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  document.querySelector("#powerButton")?.addEventListener("click", async () => {
    if (!confirm("NeonMind Desktop Core wirklich vollständig beenden?")) return;
    try {
      await api("/api/exit", {});
    } catch {
      window.close();
    }
  });

  window.addEventListener("neonmind:navigate", event => {
    const section = event.detail?.section;
    if (section === "browser") window.open("https://www.google.de", "_blank", "noopener");
  });
})();