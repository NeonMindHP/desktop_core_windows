(() => {
  const navItems = [...document.querySelectorAll(".nav-item")];
  const sectionButtons = [...document.querySelectorAll("[data-section]")];
  const views = [...document.querySelectorAll("[data-view]")];
  let activeSection = "desktop";

  const setPreview = section => {
    navItems.forEach(item => item.classList.toggle("is-preview", item.dataset.section === section && section !== activeSection));
  };

  const activate = section => {
    activeSection = section;
    navItems.forEach(item => {
      item.classList.toggle("is-active", item.dataset.section === section);
      item.classList.remove("is-preview");
    });
    views.forEach(view => view.classList.toggle("is-active", view.dataset.view === section));
    window.dispatchEvent(new CustomEvent("neonmind:navigate", { detail: { section } }));
  };

  sectionButtons.forEach(button => {
    button.addEventListener("mouseenter", () => setPreview(button.dataset.section));
    button.addEventListener("mouseleave", () => setPreview(null));
    button.addEventListener("click", () => activate(button.dataset.section));
  });

  const updateClock = () => {
    const now = new Date();
    document.querySelector("#clockTime").textContent = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(now);
    document.querySelector("#clockDate").textContent = new Intl.DateTimeFormat("de-DE", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric"
    }).format(now).toUpperCase();
  };

  updateClock();
  setInterval(updateClock, 1000);
  activate("desktop");
})();