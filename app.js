(() => {
  const nav = document.querySelector("#coreNav");
  const navItems = [...document.querySelectorAll(".nav-item")];
  const sectionButtons = [...document.querySelectorAll("[data-section]")];
  const views = [...document.querySelectorAll("[data-view]")];
  const activityLine = document.querySelector("#activityLine");

  let activeSection = "desktop";
  let autoIndex = 0;
  let autoDirection = 1;
  let autoTimer = null;
  let resumeTimer = null;
  let hoveringNav = false;

  const moveLineTo = item => {
    if (!item || !activityLine || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    activityLine.style.width = `${itemRect.width}px`;
    activityLine.style.transform = `translateX(${itemRect.left - navRect.left}px)`;
  };

  const setPreview = item => {
    navItems.forEach(navItem => navItem.classList.toggle("is-preview", navItem === item));
    if (item) moveLineTo(item);
  };

  const stopAuto = () => {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = null;
  };

  const scheduleAutoStep = (delay = 1350) => {
    stopAuto();
    autoTimer = setTimeout(runAutoStep, delay);
  };

  const runAutoStep = () => {
    if (hoveringNav) return;
    moveLineTo(navItems[autoIndex]);

    if (autoIndex === navItems.length - 1) autoDirection = -1;
    else if (autoIndex === 0) autoDirection = 1;

    autoIndex += autoDirection;
    scheduleAutoStep(1450);
  };

  const resumeAutoLater = () => {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      navItems.forEach(item => item.classList.remove("is-preview"));
      hoveringNav = false;
      const closestIndex = navItems.reduce((best, item, index) => {
        const lineCenter = activityLine.getBoundingClientRect().left + activityLine.getBoundingClientRect().width / 2;
        const rect = item.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - lineCenter);
        return distance < best.distance ? { index, distance } : best;
      }, { index: 0, distance: Infinity }).index;
      autoIndex = closestIndex;
      runAutoStep();
    }, 1200);
  };

  const activate = section => {
    activeSection = section;
    navItems.forEach(item => item.classList.toggle("is-active", item.dataset.section === section));
    views.forEach(view => view.classList.toggle("is-active", view.dataset.view === section));
    window.dispatchEvent(new CustomEvent("neonmind:navigate", { detail: { section } }));
  };

  navItems.forEach(item => {
    item.addEventListener("mouseenter", () => {
      hoveringNav = true;
      stopAuto();
      if (resumeTimer) clearTimeout(resumeTimer);
      setPreview(item);
    });
  });

  nav.addEventListener("mouseleave", resumeAutoLater);

  sectionButtons.forEach(button => {
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

  requestAnimationFrame(() => {
    moveLineTo(navItems[0]);
    scheduleAutoStep(1450);
  });

  window.addEventListener("resize", () => {
    const preview = navItems.find(item => item.classList.contains("is-preview"));
    moveLineTo(preview || navItems[Math.max(0, Math.min(autoIndex, navItems.length - 1))]);
  });
})();