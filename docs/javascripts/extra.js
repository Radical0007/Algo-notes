(() => {
  const setupReadingProgress = () => {
    let progress = document.querySelector(".reading-progress");
    if (!progress) {
      progress = document.createElement("div");
      progress.className = "reading-progress";
      progress.setAttribute("aria-hidden", "true");
      document.body.appendChild(progress);
    }

    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      progress.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    };

    window.removeEventListener("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    update();
  };

  if (typeof document$ !== "undefined") {
    document$.subscribe(setupReadingProgress);
  } else {
    document.addEventListener("DOMContentLoaded", setupReadingProgress);
  }
})();
