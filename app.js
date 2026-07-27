(() => {
  "use strict";

  const config = window.ALBUM_CONFIG || {};
  const localItems = Array.isArray(window.MEDIA_LIST) ? window.MEDIA_LIST : [];
  let allItems = [];

  const els = {
    body: document.body,
    welcome: document.querySelector("#welcome"),
    welcomeTitle: document.querySelector("#welcomeTitle"),
    welcomeText: document.querySelector("#welcomeText"),
    enterAlbum: document.querySelector("#enterAlbum"),
    welcomeParticles: document.querySelector("#welcomeParticles"),
    floatingEffects: document.querySelector("#floatingEffects"),
    scrollProgress: document.querySelector("#scrollProgress"),
    heroPhotoA: document.querySelector("#heroPhotoA"),
    heroPhotoB: document.querySelector("#heroPhotoB"),
    pageTitle: document.querySelector("#pageTitle"),
    pageSubtitle: document.querySelector("#pageSubtitle"),
    brandTitle: document.querySelector("#brandTitle"),
    footerTitle: document.querySelector("#footerTitle"),
    totalCount: document.querySelector("#totalCount"),
    rotatingMessage: document.querySelector("#rotatingMessage"),
    letterTitle: document.querySelector("#letterTitle"),
    letterText: document.querySelector("#letterText"),
    signatureText: document.querySelector("#signatureText"),
    closingTitle: document.querySelector("#closingTitle"),
    closingText: document.querySelector("#closingText"),
    gallery: document.querySelector("#gallery"),
    emptyState: document.querySelector("#emptyState"),
    loadMore: document.querySelector("#loadMore"),
    filters: [...document.querySelectorAll(".filter")],
    surpriseButton: document.querySelector("#surpriseButton"),
    finalSurpriseButton: document.querySelector("#finalSurpriseButton"),
    heartRainButton: document.querySelector("#heartRainButton"),
    shareButton: document.querySelector("#shareButton"),
    musicButton: document.querySelector("#musicButton"),
    musicLabel: document.querySelector("#musicLabel"),
    backgroundMusic: document.querySelector("#backgroundMusic"),
    surpriseMessage: document.querySelector("#surpriseMessage"),
    surpriseText: document.querySelector("#surpriseText"),
    viewer: document.querySelector("#viewer"),
    viewerImage: document.querySelector("#viewerImage"),
    viewerVideo: document.querySelector("#viewerVideo"),
    viewerFrame: document.querySelector("#viewerFrame"),
    viewerTitle: document.querySelector("#viewerTitle"),
    viewerPosition: document.querySelector("#viewerPosition"),
    closeViewer: document.querySelector("#closeViewer"),
    previousItem: document.querySelector("#previousItem"),
    nextItem: document.querySelector("#nextItem"),
    loveButton: document.querySelector("#loveButton")
  };

  const messages =
    Array.isArray(config.messages) && config.messages.length
      ? config.messages
      : ["Contigo, cualquier momento se vuelve especial."];

  let visibleCount = Number(config.itemsPerPage) || 60;
  let activeIndex = 0;
  let filteredItems = [];
  let messageIndex = 0;
  let slideshowIndex = 0;
  let activeHeroLayer = "a";
  let surpriseTimer = null;
  let observer = null;
  let touchStartX = 0;
  let musicStarted = false;
  let musicPlaying = false;
  let audioLoadFailed = false;

  init();

  async function init() {
    applyConfig();
    setupWelcome();
    bindEvents();
    startMessageRotation();

    if (config.floatingHearts !== false) {
      startAmbientHearts();
    }

    setLoadingState();

    try {
      allItems = await loadItems();
    } catch (error) {
      console.error(error);
      showLoadError(error.message || "No se pudo conectar con Google Drive.");
      return;
    }

    setupSlideshow();
    applyFilter("all");
    animateCount();
  }

  function applyConfig() {
    const title = config.title || "Nuestra historia";
    const subtitle =
      config.subtitle ||
      "Cada fotografía guarda un instante que siempre vale la pena recordar.";

    document.title = title;
    els.pageTitle.textContent = title;
    els.brandTitle.textContent = title;
    els.footerTitle.textContent = title;
    els.welcomeTitle.textContent = title;
    els.pageSubtitle.textContent = subtitle;
    els.welcomeText.textContent = config.welcomeText || "";
    els.letterTitle.textContent = config.letterTitle || "";
    els.letterText.textContent = config.letterText || "";
    els.signatureText.textContent = config.signature || "Siempre tú y yo ♥";
    els.closingTitle.textContent = config.closingTitle || "";
    els.closingText.textContent = config.closingText || "";
  }

  async function loadItems() {
    const apiKey = String(config.googleDriveApiKey || "").trim();
    const folderId = String(config.driveFolderId || "").trim();

    if (!apiKey || apiKey.includes("PEGA_AQUI")) {
      if (localItems.length) return localItems;
      throw new Error("Falta pegar la nueva clave de Google Drive API en config.js.");
    }

    if (!folderId) {
      throw new Error("Falta el ID de la carpeta de Google Drive.");
    }

    const files = [];
    let pageToken = "";

    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        fields:
          "nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,createdTime,size)",
        pageSize: "1000",
        orderBy: "name_natural",
        key: apiKey
      });

      if (pageToken) params.set("pageToken", pageToken);

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`
      );

      const payload = await response.json();

      if (!response.ok) {
        const detail =
          payload?.error?.message ||
          "Google Drive rechazó la solicitud. Revisa la clave y los permisos.";
        throw new Error(detail);
      }

      files.push(...(payload.files || []));
      pageToken = payload.nextPageToken || "";
    } while (pageToken);

    return files
      .filter((file) =>
        String(file.mimeType || "").startsWith("image/") ||
        String(file.mimeType || "").startsWith("video/")
      )
      .map((file) => {
        const isVideo = String(file.mimeType).startsWith("video/");
        const thumbnail =
          file.thumbnailLink ||
          `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w1600`;

        return {
          id: file.id,
          name: cleanFilename(file.name),
          originalName: file.name,
          mimeType: file.mimeType,
          type: isVideo ? "video" : "image",
          thumbnailUrl: thumbnail.replace(/=s\d+$/, "=s1600"),
          imageUrl:
            `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w2400`,
          previewUrl:
            `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/preview`,
          createdTime: file.createdTime || "",
          size: Number(file.size || 0)
        };
      });
  }

  function cleanFilename(name) {
    return String(name || "Recuerdo")
      .replace(/\.(jpe?g|png|gif|webp|bmp|avif|heic|heif|mp4|mov|m4v|webm|avi)$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
  }

  function setLoadingState() {
    els.totalCount.textContent = "…";
    els.gallery.replaceChildren();
    els.emptyState.hidden = false;
    const title = els.emptyState.querySelector("h3");
    const text = els.emptyState.querySelector("p");
    if (title) title.textContent = "Cargando nuestros recuerdos…";
    if (text) text.textContent = "La primera carga puede tardar unos segundos.";
  }

  function showLoadError(message) {
    els.totalCount.textContent = "0";
    els.gallery.replaceChildren();
    els.emptyState.hidden = false;
    const title = els.emptyState.querySelector("h3");
    const text = els.emptyState.querySelector("p");
    if (title) title.textContent = "No pudimos cargar el álbum";
    if (text) text.textContent = message;
  }

  function setupWelcome() {
    if (config.introEnabled === false) {
      els.welcome.hidden = true;
      return;
    }

    els.body.classList.add("welcome-open");
    createWelcomeParticles();

    els.enterAlbum.addEventListener("click", () => {
      startMusic();
      createBurst(window.innerWidth / 2, window.innerHeight / 2, 22);
      els.welcome.classList.add("hide");
      els.body.classList.remove("welcome-open");

      window.setTimeout(() => {
        els.welcome.hidden = true;
      }, 950);
    });
  }

  function createWelcomeParticles() {
    for (let i = 0; i < 18; i += 1) {
      const heart = document.createElement("span");
      heart.className = "float-heart";
      heart.textContent = i % 4 === 0 ? "♡" : "♥";
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.fontSize = `${10 + Math.random() * 20}px`;
      heart.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
      heart.style.animationDuration = `${7 + Math.random() * 7}s`;
      heart.style.animationDelay = `${-Math.random() * 12}s`;
      els.welcomeParticles.appendChild(heart);
    }
  }

  function setupSlideshow() {
    const images = allItems.filter((item) => item.type === "image").slice(0, 8);
    if (!images.length) return;

    els.heroPhotoA.src = getCardImage(images[0]);
    els.heroPhotoA.classList.add("active");

    if (images.length === 1) return;

    const interval = Math.max(4, Number(config.slideshowSeconds) || 7) * 1000;

    window.setInterval(() => {
      slideshowIndex = (slideshowIndex + 1) % images.length;
      const nextSrc = getCardImage(images[slideshowIndex]);

      if (activeHeroLayer === "a") {
        els.heroPhotoB.src = nextSrc;
        els.heroPhotoB.classList.add("active");
        els.heroPhotoA.classList.remove("active");
        activeHeroLayer = "b";
      } else {
        els.heroPhotoA.src = nextSrc;
        els.heroPhotoA.classList.add("active");
        els.heroPhotoB.classList.remove("active");
        activeHeroLayer = "a";
      }
    }, interval);
  }

  function bindEvents() {
    els.filters.forEach((button) => {
      button.addEventListener("click", () => applyFilter(button.dataset.filter));
    });

    els.loadMore.addEventListener("click", () => {
      visibleCount += Number(config.itemsPerPage) || 60;
      render();
    });

    els.surpriseButton.addEventListener("click", showRandomSurprise);
    els.finalSurpriseButton.addEventListener("click", () => {
      showRandomSurprise();
      createHeartRain(35);
    });
    els.heartRainButton.addEventListener("click", () => createHeartRain(28));
    els.shareButton.addEventListener("click", sharePage);
    els.musicButton.addEventListener("click", toggleMusic);

    els.closeViewer.addEventListener("click", closeViewer);
    els.previousItem.addEventListener("click", () => moveViewer(-1));
    els.nextItem.addEventListener("click", () => moveViewer(1));
    els.loveButton.addEventListener("click", loveCurrentItem);

    els.viewer.addEventListener("click", (event) => {
      if (event.target === els.viewer) closeViewer();
    });

    els.viewer.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.changedTouches[0].clientX;
      },
      { passive: true }
    );

    els.viewer.addEventListener(
      "touchend",
      (event) => {
        const delta = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) < 55) return;
        moveViewer(delta > 0 ? -1 : 1);
      },
      { passive: true }
    );

    document.addEventListener("keydown", (event) => {
      if (!els.viewer.open) return;
      if (event.key === "ArrowLeft") moveViewer(-1);
      if (event.key === "ArrowRight") moveViewer(1);
      if (event.key === "Escape") closeViewer();
    });

    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    document.addEventListener("dblclick", (event) => {
      createBurst(event.clientX, event.clientY, 12);
    });
  }

  function applyFilter(filter) {
    visibleCount = Number(config.itemsPerPage) || 60;

    els.filters.forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === filter);
    });

    filteredItems =
      filter === "all"
        ? [...allItems]
        : allItems.filter((item) => item.type === filter);

    render();
  }

  function render() {
    els.gallery.replaceChildren();

    if (filteredItems.length === 0) {
      els.emptyState.hidden = false;
      els.loadMore.hidden = true;
      const title = els.emptyState.querySelector("h3");
      const text = els.emptyState.querySelector("p");
      if (title) title.textContent = "No encontramos fotos ni videos";
      if (text) text.textContent = "Verifica que los archivos estén dentro de la carpeta pública.";
      return;
    }

    els.emptyState.hidden = true;

    const fragment = document.createDocumentFragment();
    filteredItems.slice(0, visibleCount).forEach((item, index) => {
      fragment.appendChild(createCard(item, index));
    });

    els.gallery.appendChild(fragment);
    els.loadMore.hidden = visibleCount >= filteredItems.length;
    setupRevealObserver();
  }

  function createCard(item, index) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.setAttribute("aria-label", `Abrir ${item.name}`);
    card.addEventListener("click", () => openViewer(index));

    const image = document.createElement("img");
    image.src = getCardImage(item);
    image.alt = item.name;
    image.loading = "lazy";
    image.decoding = "async";

    image.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "card-media-fallback";
      fallback.innerHTML =
        `<div><span>${item.type === "video" ? "▶" : "♡"}</span>` +
        `No se pudo generar la vista previa</div>`;
      image.replaceWith(fallback);
    }, { once: true });

    card.appendChild(image);

    if (item.type === "video") {
      const badge = document.createElement("span");
      badge.className = "video-badge";
      badge.textContent = "▶";
      card.appendChild(badge);
    }

    const heart = document.createElement("span");
    heart.className = "card-heart";
    heart.textContent = "♡";
    heart.title = "Me encanta";
    heart.addEventListener("click", (event) => {
      event.stopPropagation();
      heart.classList.toggle("loved");
      heart.textContent = heart.classList.contains("loved") ? "♥" : "♡";
      createBurst(event.clientX, event.clientY, 9);
    });

    const info = document.createElement("span");
    info.className = "card-info";
    const title = document.createElement("strong");
    title.textContent = item.name;
    const type = document.createElement("span");
    type.textContent = item.type === "image" ? "FOTO" : "VIDEO";
    info.append(title, type);
    card.append(heart, info);

    return card;
  }

  function getCardImage(item) {
    return item.thumbnailUrl || item.imageUrl || safePath(item.path || "");
  }

  function setupRevealObserver() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px 80px" }
    );
    document.querySelectorAll(".card").forEach((card) => observer.observe(card));
  }

  function openViewer(index) {
    activeIndex = index;
    updateViewer();

    if (typeof els.viewer.showModal === "function") {
      els.viewer.showModal();
    } else {
      els.viewer.setAttribute("open", "");
    }
    document.body.style.overflow = "hidden";
  }

  function closeViewer() {
    els.viewerVideo.pause();
    els.viewerVideo.removeAttribute("src");
    els.viewerImage.removeAttribute("src");
    els.viewerFrame.removeAttribute("src");

    if (typeof els.viewer.close === "function") {
      els.viewer.close();
    } else {
      els.viewer.removeAttribute("open");
    }
    document.body.style.overflow = "";
  }

  function moveViewer(direction) {
    if (!filteredItems.length) return;
    activeIndex =
      (activeIndex + direction + filteredItems.length) % filteredItems.length;
    updateViewer();
  }

  function updateViewer() {
    const item = filteredItems[activeIndex];
    if (!item) return;

    els.viewerVideo.pause();
    els.viewerImage.hidden = true;
    els.viewerVideo.hidden = true;
    els.viewerFrame.hidden = true;
    els.viewerVideo.removeAttribute("src");
    els.viewerImage.removeAttribute("src");
    els.viewerFrame.removeAttribute("src");

    els.loveButton.classList.remove("loved");
    els.loveButton.innerHTML = "<span>♡</span> Me encanta";

    if (item.type === "image") {
      els.viewerImage.src = item.imageUrl || getCardImage(item);
      els.viewerImage.alt = item.name;
      els.viewerImage.hidden = false;
    } else if (item.previewUrl) {
      els.viewerFrame.src = `${item.previewUrl}?autoplay=1`;
      els.viewerFrame.hidden = false;
    } else {
      els.viewerVideo.src = safePath(item.path || "");
      els.viewerVideo.hidden = false;
    }

    els.viewerTitle.textContent = item.name;
    els.viewerPosition.textContent = `${activeIndex + 1} de ${filteredItems.length}`;
  }

  function loveCurrentItem() {
    els.loveButton.classList.toggle("loved");
    const loved = els.loveButton.classList.contains("loved");
    els.loveButton.innerHTML = loved
      ? "<span>♥</span> Guardado en el corazón"
      : "<span>♡</span> Me encanta";

    const rect = els.loveButton.getBoundingClientRect();
    createBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 14);
  }

  function startMessageRotation() {
    els.rotatingMessage.textContent = messages[0];
    window.setInterval(() => {
      els.rotatingMessage.classList.add("changing");
      window.setTimeout(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        els.rotatingMessage.textContent = messages[messageIndex];
        els.rotatingMessage.classList.remove("changing");
      }, 350);
    }, 5200);
  }

  function animateCount() {
    const target = allItems.length;
    if (!target) {
      els.totalCount.textContent = "0";
      return;
    }

    const duration = 1300;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      els.totalCount.textContent = Math.floor(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else els.totalCount.textContent = target;
    }

    requestAnimationFrame(tick);
  }

  function startAmbientHearts() {
    window.setInterval(() => {
      if (!document.hidden) createFloatingHeart(els.floatingEffects);
    }, 1300);
  }

  function createFloatingHeart(container) {
    const heart = document.createElement("span");
    heart.className = "float-heart";
    heart.textContent = Math.random() > 0.35 ? "♥" : "♡";
    heart.style.left = `${Math.random() * 100}%`;
    heart.style.fontSize = `${11 + Math.random() * 17}px`;
    heart.style.setProperty("--drift", `${-100 + Math.random() * 200}px`);
    heart.style.animationDuration = `${8 + Math.random() * 5}s`;
    container.appendChild(heart);
    window.setTimeout(() => heart.remove(), 14000);
  }

  function createHeartRain(amount = 25) {
    for (let i = 0; i < amount; i += 1) {
      window.setTimeout(() => createFloatingHeart(els.floatingEffects), i * 55);
    }
    showSurprise("Que nunca nos falten razones para volver a sonreír juntos.");
  }

  function createBurst(x, y, amount = 12) {
    for (let i = 0; i < amount; i += 1) {
      const heart = document.createElement("span");
      heart.className = "burst-heart";
      heart.textContent = i % 3 === 0 ? "♡" : "♥";
      heart.style.left = `${x}px`;
      heart.style.top = `${y}px`;
      heart.style.fontSize = `${12 + Math.random() * 16}px`;
      const angle = (Math.PI * 2 * i) / amount;
      const distance = 55 + Math.random() * 95;
      heart.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
      heart.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
      heart.style.setProperty("--r", `${-60 + Math.random() * 120}deg`);
      document.body.appendChild(heart);
      window.setTimeout(() => heart.remove(), 1400);
    }
  }

  function showRandomSurprise() {
    const message = messages[Math.floor(Math.random() * messages.length)];
    showSurprise(message);
    createBurst(
      window.innerWidth * (0.35 + Math.random() * 0.3),
      window.innerHeight * (0.35 + Math.random() * 0.25),
      18
    );
  }

  function showSurprise(message) {
    els.surpriseText.textContent = message;
    els.surpriseMessage.classList.add("show");
    if (surpriseTimer) window.clearTimeout(surpriseTimer);
    surpriseTimer = window.setTimeout(() => {
      els.surpriseMessage.classList.remove("show");
    }, 4200);
  }

  async function startMusic() {
    const file = String(config.musicFile || "").trim();
    if (!file || audioLoadFailed) return;

    if (!musicStarted) {
      els.backgroundMusic.src = safePath(file);
      els.backgroundMusic.volume = Math.min(
        1,
        Math.max(0, Number(config.musicVolume) || 0.55)
      );
      els.backgroundMusic.addEventListener("error", () => {
        audioLoadFailed = true;
        musicPlaying = false;
        updateMusicButton();
      }, { once: true });
      musicStarted = true;
    }

    try {
      await els.backgroundMusic.play();
      musicPlaying = true;
      updateMusicButton();
    } catch (error) {
      musicPlaying = false;
      updateMusicButton();
    }
  }

  function toggleMusic() {
    if (!musicStarted || els.backgroundMusic.paused) startMusic();
    else {
      els.backgroundMusic.pause();
      musicPlaying = false;
      updateMusicButton();
    }
  }

  function updateMusicButton() {
    els.musicButton.classList.toggle("playing", musicPlaying);
    if (els.musicLabel) {
      els.musicLabel.textContent = musicPlaying ? "Pausar canción" : "Nuestra canción";
    }
  }

  async function sharePage() {
    const shareData = {
      title: config.title || "Nuestra historia",
      text: "Quiero compartir contigo este álbum hecho con mucho cariño.",
      url: window.location.href
    };

    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(window.location.href);
        showSurprise("El enlace quedó copiado. Ya puedes compartirlo ♥");
      } else {
        showSurprise("Copia el enlace de la barra del navegador para compartirlo.");
      }
    } catch (error) {
      if (error && error.name !== "AbortError") {
        showSurprise("Copia el enlace de la barra del navegador para compartirlo.");
      }
    }
  }

  function updateScrollProgress() {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const progress = height > 0 ? (window.scrollY / height) * 100 : 0;
    els.scrollProgress.style.width = `${progress}%`;
  }

  function safePath(path) {
    const value = String(path || "");
    if (/^https?:\/\//i.test(value)) return value;
    return value
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }
})();
