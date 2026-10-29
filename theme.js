class GalaxyTheme {
  constructor() {
    this.config = {
      blurHomeBackground: false,
      useCurrSongAsHome: false,
      useHomeEverywhere: false,
      blurAllBackgrounds: false,
      showHeaderImage: false,
    };
    this.isDim = false;
    this.defImage = "https://raw.githubusercontent.com/cplus2jules/spicetify-glass/main/assets/default_bg.jpg";
    this.startImage = localStorage.getItem("galaxy:startupBg");
    this.lyricsAccent = localStorage.getItem("galaxy:lyricsAccent");
    this.notDimPages = ["/playlist/", "/artist/", "/album/", "/folder/", "/collection/tracks"];
    this.bgContainer = null;
    this.bgImage = null;
    this.onEntityPage = false;
    this.pageToken = 0;
    this.reelEl = null;
  }

  async init() {
    if (!(Spicetify.Player?.data && Spicetify.Platform && Spicetify.CosmosAsync)) {
      setTimeout(() => this.init(), 100);
      return;
    }
    console.log("Galaxy theme starting...");

    // Clean up temp images
    Object.keys(localStorage).forEach((item) => {
      if (item.includes("galaxy:temp")) localStorage.removeItem(item);
    });

    this.parseOptions();
    this.applyLyricsAccent();
    this.createBackgroundElements();
    this.setupScrollListeners();
    this.setupDeviceIcons();
    this.setupEditButtons();
    this.setupPlaylistEditObserver();

    // Listeners
    Spicetify.Platform.History.listen(this.onPageChange.bind(this));
    Spicetify.Player.addEventListener("songchange", this.onSongChange.bind(this));

    // Initial load
    this.onPageChange(Spicetify.Platform.History.location);
  }

  applyLyricsAccent() {
    const style = document.documentElement.style;
    this.lyricsAccent ? style.setProperty("--BeautifulLyrics-Accent", this.lyricsAccent) : style.removeProperty("--BeautifulLyrics-Accent");
  }

  parseOptions() {
    this.config.blurHomeBackground = JSON.parse(localStorage.getItem("blurHomeBackground"));
    this.config.useCurrSongAsHome = JSON.parse(localStorage.getItem("useCurrentSongAsHome"));
    this.config.useHomeEverywhere = JSON.parse(localStorage.getItem("useHomeEverywhere"));
    this.config.blurAllBackgrounds = JSON.parse(localStorage.getItem("blurAllBackgrounds"));
    this.config.showHeaderImage = JSON.parse(localStorage.getItem("showHeaderImage"));
  }

  waitForElement(els, func, timeout = 100) {
    const queries = els.map((el) => document.querySelector(el));
    if (queries.every((a) => a)) {
      func(queries);
    } else if (timeout > 0) {
      setTimeout(() => this.waitForElement(els, func, timeout - 1), 50);
    }
  }

  createBackgroundElements() {
    if (document.querySelector(".bg-main-container")) return;
    this.bgContainer = document.createElement("div");
    this.bgContainer.className = "bg-main-container";
    
    let blurLayers = '';
    for (let i = 1; i <= 5; i++) {
       blurLayers += `<div class="gradual-blur-layer gradual-blur-layer-${i}"></div>`;
    }
    
    this.bgContainer.innerHTML = `
        <div class="bg-image-container"><img class="bg-main-image"></div>
        <div class="bg-cover-gradient"><span></span><span></span><span></span><span></span></div>
        <div class="gradual-blur-container">${blurLayers}</div>
    `;
    this.bgImage = this.bgContainer.querySelector(".bg-main-image");
    document.body.prepend(this.bgContainer);
  }

  setBg(imageData) {
    if (this.bgImage) this.bgImage.src = imageData;
  }

  async applyAmbientBg() {
    if (this.config.useCurrSongAsHome || this.startImage) {
      this.config.useCurrSongAsHome ? this.fetchCurrTrackAlbumImage() : this.setBg(this.startImage);
      this.setCoverGradient(null);
      return;
    }
    const token = this.pageToken;
    const color = await this.fetchTrackColor();
    if (token !== this.pageToken || this.onEntityPage) return;
    this.setCoverGradient(color ? { base: color, light: color } : {});
  }

  async fetchTrackColor() {
    const uri = Spicetify.Player.data?.item?.uri;
    if (!uri?.startsWith("spotify:track:")) return null;
    try {
      const res = await Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.fetchExtractedColorForTrackEntity, { uri });
      return res?.data?.trackUnion?.albumOfTrack?.coverArt?.extractedColors?.colorDark?.hex || null;
    } catch (e) {
      return null;
    }
  }

  setHeaderCover(src) {
    const value = src ? `url("${src}")` : "none";
    if (value === this.headerCoverValue) return;
    this.headerCoverValue = value;
    document.documentElement.style.setProperty("--galaxy-header-cover", value);
  }

  setCoverGradient(colors) {
    if (!this.bgContainer) return;
    const style = this.bgContainer.style;
    if (colors?.base && colors.base !== style.getPropertyValue("--galaxy-cover-base")) style.setProperty("--galaxy-cover-base", colors.base);
    if (colors?.light && colors.light !== style.getPropertyValue("--galaxy-cover-light")) style.setProperty("--galaxy-cover-light", colors.light);
    const on = !!colors;
    if (this.bgContainer.classList.contains("cover-gradient") === on) return;
    this.bgContainer.classList.toggle("cover-gradient", on);
    document.documentElement.classList.toggle("galaxy-gradient-bg", on);
  }

  static toCoverUrl(url) {
    if (!url) return null;
    const id = url.startsWith("spotify:image:") ? url.split(":")[2] : url.split("/image/")[1];
    return id ? `https://i.scdn.co/image/${id.replace("00001e02", "0000b273")}` : null;
  }

  async getReelCovers(type, uri, max = 8) {
    const GQL = Spicetify.GraphQL;
    let urls = [];
    try {
      if (type === "playlist") {
        const res = await Spicetify.Platform.PlaylistAPI.getContents(uri, { limit: 100 });
        urls = res.items.map((item) => item.album?.images?.[0]?.url);
      } else if (type === "artist") {
        const res = await GQL.Request(GQL.Definitions.queryArtistOverview, { uri, locale: "", includePrerelease: false });
        urls = res.data.artistUnion.discography.topTracks.items.map((item) => item.track.albumOfTrack?.coverArt?.sources?.[0]?.url);
      }
    } catch (e) {
      console.log("Galaxy: couldn't load reel covers", e);
    }
    const headerImg = document.querySelector('[data-testid="entity-header"] img.main-entityHeader-image');
    if (!urls.length && headerImg?.src && !headerImg.src.startsWith("spotify:mosaic")) urls = [headerImg.src];
    const unique = [...new Set(urls.map(GalaxyTheme.toCoverUrl).filter(Boolean))];
    for (let i = unique.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unique[i], unique[j]] = [unique[j], unique[i]];
    }
    return unique.slice(0, max);
  }

  async loadHeaderReel(type, uid) {
    const token = this.pageToken;
    const uri = `spotify:${type}:${uid}`;
    await new Promise((resolve) => this.waitForElement(['[data-testid="entity-header"] img.main-entityHeader-image'], resolve, 40));
    const covers = await this.getReelCovers(type, uri);
    if (token !== this.pageToken || !covers.length) return;
    this.reelEl = this.buildHeaderReel(covers);
    this.ensureHeaderReel();
  }

  buildHeaderReel(covers) {
    const FILL = 1100, SETTLE = 700, HOLD = 3000;
    const SATURATIONS = [0, 0.4, 1, 1, 1.8];
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reel = document.createElement("div");
    reel.className = "galaxy-header-reel";
    const canvas = document.createElement("canvas");
    reel.append(canvas);
    const ctx = canvas.getContext("2d");
    const images = covers.map((src) => Object.assign(new Image(), { crossOrigin: "anonymous", decoding: "async", src }));
    const ready = (img) => img.complete && img.naturalWidth > 0;

    let current = null;
    let next = null;
    let grid = null;
    let start = 0;
    let index = -1;
    let dpr = 1;

    const fit = () => {
      dpr = devicePixelRatio || 1;
      const w = Math.round(reel.clientWidth * dpr), h = Math.round(reel.clientHeight * dpr);
      if (canvas.width === w && canvas.height === h) return false;
      Object.assign(canvas, { width: w, height: h });
      return true;
    };
    const placement = (img) => {
      const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      return { scale, x: (img.naturalWidth - canvas.width / scale) / 2, y: (img.naturalHeight - canvas.height / scale) * 0.35 };
    };
    const drawCover = (img, alpha = 1) => {
      const p = placement(img);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, p.x, p.y, canvas.width / p.scale, canvas.height / p.scale, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    };

    const makeGrid = () => {
      const cell = Math.round(Math.max(28 * dpr, canvas.width / (10 + Math.random() * 6)));
      const cols = Math.ceil(canvas.width / cell), rows = Math.ceil(canvas.height / cell);
      const phaseX = Math.floor(Math.random() * 3), phaseY = Math.floor(Math.random() * 2);
      const seed = { x: Math.random() * cols, y: Math.random() * rows };
      const patches = new Map();
      const tiles = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = Math.floor((col + phaseX) / 3), py = Math.floor((row + phaseY) / 2);
          const key = `${px}:${py}`;
          if (!patches.has(key)) {
            const moved = Math.random() < 0.4;
            patches.set(key, {
              pivot: { x: (px * 3 - phaseX + 1.5) * cell, y: (py * 2 - phaseY + 1) * cell },
              shift: moved ? { x: (Math.random() - 0.5) * canvas.width * 0.4, y: (Math.random() - 0.5) * canvas.height * 0.4 } : { x: 0, y: 0 },
              zoom: moved ? 1 + Math.random() * 0.8 : 1,
            });
          }
          tiles.push({
            col, row,
            span: Math.random() < 0.06 ? 2 : 1,
            patch: patches.get(key),
            sat: SATURATIONS[Math.floor(Math.random() * SATURATIONS.length)],
            order: Math.hypot(col - seed.x, (row - seed.y) * 1.2) + Math.random() * 3,
          });
        }
      }
      tiles.sort((a, b) => a.order - b.order);
      return { cell, tiles };
    };

    const drawTile = (img, tile) => {
      const p = placement(img);
      const size = grid.cell * tile.span;
      const x = tile.col * grid.cell, y = tile.row * grid.cell;
      const { pivot, shift, zoom } = tile.patch;
      const srcSize = size / zoom;
      const sx = Math.min(Math.max(pivot.x + shift.x + (x - pivot.x) / zoom, 0), canvas.width - srcSize);
      const sy = Math.min(Math.max(pivot.y + shift.y + (y - pivot.y) / zoom, 0), canvas.height - srcSize);
      if (tile.sat !== 1) ctx.filter = `saturate(${tile.sat})`;
      ctx.drawImage(img, p.x + sx / p.scale, p.y + sy / p.scale, srcSize / p.scale, srcSize / p.scale, x, y, size, size);
      ctx.filter = "none";
      if (tile.sat < 1) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * (1 - tile.sat)})`;
        ctx.fillRect(x, y, size, size);
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = dpr;
      ctx.strokeRect(x + dpr / 2, y + dpr / 2, size - dpr, size - dpr);
    };

    let drawn = 0;
    let settled = true;
    let mosaic = null;
    const redrawAll = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (current) drawCover(current);
      for (let i = 0; i < drawn; i++) drawTile(next, grid.tiles[i]);
    };
    const frame = (now) => {
      if (fit()) redrawAll();
      const t = now - start;
      const p = Math.min(1, t / FILL);
      const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const shown = Math.ceil(grid.tiles.length * eased);
      for (; drawn < shown; drawn++) drawTile(next, grid.tiles[drawn]);
      if (t > FILL) {
        if (!mosaic) {
          mosaic = document.createElement("canvas");
          Object.assign(mosaic, { width: canvas.width, height: canvas.height });
          mosaic.getContext("2d").drawImage(canvas, 0, 0);
        }
        const q = Math.min(1, (t - FILL) / SETTLE);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(mosaic, 0, 0, canvas.width, canvas.height);
        drawCover(next, q * q * (3 - 2 * q));
      }
      if (t < FILL + SETTLE) {
        this.reelFrame = requestAnimationFrame(frame);
        return;
      }
      mosaic = null;
      current = next;
      settled = true;
      this.reelTimeout = setTimeout(advance, HOLD);
    };

    const show = (img) => {
      document.documentElement.classList.add("galaxy-reel-active");
      this.sampleColors(img);
      fit();
      if (reduceMotion) {
        current = img;
        drawCover(current);
        this.reelTimeout = setTimeout(advance, HOLD);
        return;
      }
      next = img;
      grid = makeGrid();
      drawn = 0;
      mosaic = null;
      settled = false;
      start = performance.now();
      this.reelFrame = requestAnimationFrame(frame);
    };

    const advance = () => {
      if (images.length === 1 && current) return;
      for (let step = 1; step <= images.length; step++) {
        const candidate = (index + step) % images.length;
        if (ready(images[candidate]) && images[candidate] !== current) {
          index = candidate;
          show(images[candidate]);
          return;
        }
      }
      this.reelTimeout = setTimeout(advance, 300);
    };

    this.reelResize = new ResizeObserver(() => {
      if (settled && current && fit()) drawCover(current);
    });
    this.reelResize.observe(reel);

    advance();
    return reel;
  }

  sampleColors(img) {
    const ctx = (this.sampleCtx ||= document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
    ctx.canvas.width = ctx.canvas.height = 24;
    let data;
    try {
      ctx.drawImage(img, 0, 0, 24, 24);
      data = ctx.getImageData(0, 0, 24, 24).data;
    } catch (e) {
      return;
    }
    const px = [];
    for (let i = 0; i < data.length; i += 4) px.push([data[i], data[i + 1], data[i + 2]]);
    const toRgb = (list) => {
      const sum = list.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
      return `rgb(${sum.map((v) => Math.round(v / list.length)).join(", ")})`;
    };
    const vivid = [...px].sort((a, b) => (Math.max(...b) - Math.min(...b)) - (Math.max(...a) - Math.min(...a)));
    const accent = toRgb(vivid.slice(0, px.length / 4));
    this.setCoverGradient({ base: toRgb(px), light: accent });
    document.querySelector('[data-testid="entity-header"]')
      ?.style.setProperty("--galaxy-title-color", `oklch(from ${accent} max(l, 0.86) min(c, 0.14) h)`);
  }

  ensureHeaderReel() {
    const header = document.querySelector('[data-testid="entity-header"]');
    if (this.reelEl && header && !header.contains(this.reelEl)) header.prepend(this.reelEl);
  }

  clearHeaderReel() {
    cancelAnimationFrame(this.reelFrame);
    clearTimeout(this.reelTimeout);
    this.reelResize?.disconnect();
    this.reelEl?.remove();
    this.reelEl = null;
    document.documentElement.classList.remove("galaxy-reel-active");
  }

  getPlaylistImage(uid) {
    const custom = localStorage.getItem("galaxy:playlistBg:" + uid);
    if (custom) this.setHeaderCover(custom);
    return custom;
  }

  async fetchCurrTrackAlbumImage() {
    const data = Spicetify.Player.data.item.metadata;
    const albumUri = data.album_uri.split(":")[2];
    if (localStorage.getItem(`galaxy:tempAlbumImage:${albumUri}`)) {
      this.setBg(localStorage.getItem(`galaxy:tempAlbumImage:${albumUri}`));
      return;
    }
    this.setBg(data.image_xlarge_url);
  }

  observeEntityImage(customUid) {
    if (this.entityObserver) this.entityObserver.disconnect();
    this.setHeaderCover(null);
    const hasCustomCover = !!(customUid && this.getPlaylistImage(customUid));

    let lastSrc = "";
    let gotColors = false;
    const checkForImage = () => {
       this.ensureHeaderReel();
       this.ensureFontButton();
       const colorLayer = !gotColors && !this.reelEl && (document.querySelector('[data-testid="entity-header"] > div[style*="--background-base"]') ||
                          document.querySelector('.before-scroll-node [data-testid="background-image"] + div[style*="--background-base"]') ||
                          document.querySelector('[data-testid="entity-header"] > div[style*="background-color"]'));
       if (colorLayer) {
           gotColors = true;
           const style = getComputedStyle(colorLayer);
           const base = colorLayer.style.backgroundColor || style.getPropertyValue("--background-base").trim();
           const light = style.getPropertyValue("--background-base-min-contrast").trim() ||
                         style.getPropertyValue("--background-tinted-base").trim() || base;
           if (base && !this.reelEl) this.setCoverGradient({ base, light });
       }
       if (hasCustomCover) return;

       const img = document.querySelector('[data-testid="entity-header"] img.main-entityHeader-image') ||
                   document.querySelector(".main-entityHeader-imageContainer img");

       if (img && img.src && img.src !== lastSrc) {
           lastSrc = img.src;
           // If it's a blob or placeholder, skip or wait
           if (img.src.startsWith("blob:") || img.src.includes("placeholder")) return;
           this.setHeaderCover(img.src.replaceAll("00001e02", "0000b273"));
       }
    };

    // Quick polling for React render delay
    setTimeout(checkForImage, 50);
    setTimeout(checkForImage, 300);
    setTimeout(checkForImage, 800);

    this.waitForElement([".main-view-container"], (elements) => {
      const mainContent = elements.find(e => e);
      if(!mainContent) return;

      let queued = false;
      this.entityObserver = new MutationObserver(() => {
         if (queued) return;
         queued = true;
         requestAnimationFrame(() => {
           queued = false;
           checkForImage();
         });
      });
      // Watch the entire structural tree for changes! Destroys bug where React component unmount breaks observer.
      this.entityObserver.observe(mainContent, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    });
  }

  loopOptions(page) {
    const bgBlurContainer = document.querySelector(".gradual-blur-container");
    if (!bgBlurContainer) return;

    bgBlurContainer.classList.toggle("blur-enabled", (page === "/" ? this.config.blurHomeBackground : this.config.blurAllBackgrounds) || false);
    if (!this.onEntityPage && !this.usesTrackImage) this.applyAmbientBg();
    
    if (this.config.showHeaderImage && !document.querySelector("style[galaxy-showHeaderImage]")) {
      const style = document.createElement("style");
      style.setAttribute("galaxy-showHeaderImage", "");
      style.innerHTML = `
      .playlist-playlist-playlistImageContainer,
      .main-entityHeader-imageContainer { display: block; } 
      .main-entityHeader-headerText { align-items: start; }
      .main-entityHeader-title { text-align: left; }
      .main-entityHeader-shadow { box-shadow: none;}`;
      document.body.append(style);
    } else if (!this.config.showHeaderImage && document.querySelector("style[galaxy-showHeaderImage]")) {
      document.querySelector("style[galaxy-showHeaderImage]").remove();
    }
  }

  onPageChange({ pathname }) {
    const [, type, uid] = pathname.split("/");
    if (this.entityObserver) this.entityObserver.disconnect();
    this.setHeaderCover(null);
    this.clearHeaderReel();
    this.closeFontMenu();
    this.pageToken++;
    const isLiked = pathname === "/collection/tracks";
    this.fontPageUri = isLiked ? "spotify:collection:tracks" : ["playlist", "album", "artist"].includes(type) ? `spotify:${type}:${uid}` : null;
    document.documentElement.classList.toggle("galaxy-liked-page", isLiked);
    document.documentElement.classList.toggle("galaxy-album-page", type === "album");
    document.documentElement.classList.toggle("galaxy-profile-page", type === "user");
    this.onEntityPage = !this.config.useHomeEverywhere && (["playlist", "album", "artist"].includes(type) || isLiked);
    this.usesTrackImage = !this.config.useHomeEverywhere && type === "lyrics";

    if (this.onEntityPage) {
      this.observeEntityImage(type === "playlist" ? uid : undefined);
      const hasBanner = type === "playlist" && localStorage.getItem("galaxy:playlistBg:" + uid);
      if (!isLiked && !hasBanner && type !== "album") this.loadHeaderReel(type, uid);
    } else if (this.usesTrackImage) {
      this.fetchCurrTrackAlbumImage();
      this.setCoverGradient(null);
    }

    this.isDim = !(this.notDimPages.some((page) => pathname.includes(page)) || pathname === "/");
    const bgImageWrapper = this.bgContainer.children[0];
    // Removed gradient mask - using CSS gradual blur instead

    this.waitForElement([".main-topBar-topbarContentWrapper"], ([topbarWrapper]) => {
      this.isDim ? topbarWrapper.classList.add("center") : topbarWrapper.classList.remove("center");
    });
    

    this.loopOptions(pathname);
  }

  onSongChange() {
    const pathname = Spicetify.Platform.History.location.pathname;
    if (this.usesTrackImage) this.fetchCurrTrackAlbumImage();
    this.loopOptions(pathname);
  }
  
  static TITLE_FONTS = [
    { id: "default", label: "Instrument Serif", family: "Instrument Serif", query: "Instrument+Serif:ital@0;1", style: "italic", weight: 400 },
    { id: "spotify", label: "Spotify", family: null },
    { id: "playfair", label: "Playfair Display", family: "Playfair Display", query: "Playfair+Display:ital,wght@1,700", style: "italic", weight: 700 },
    { id: "dmserif", label: "DM Serif Display", family: "DM Serif Display", query: "DM+Serif+Display", style: "normal", weight: 400 },
    { id: "fraunces", label: "Fraunces", family: "Fraunces", query: "Fraunces:opsz,wght@9..144,800", style: "normal", weight: 800 },
    { id: "pinyon", label: "Pinyon Script", family: "Pinyon Script", query: "Pinyon+Script", style: "normal", weight: 400 },
    { id: "greatvibes", label: "Great Vibes", family: "Great Vibes", query: "Great+Vibes", style: "normal", weight: 400 },
    { id: "bebas", label: "Bebas Neue", family: "Bebas Neue", query: "Bebas+Neue", style: "normal", weight: 400 },
    { id: "syne", label: "Syne", family: "Syne", query: "Syne:wght@800", style: "normal", weight: 800 },
    { id: "unbounded", label: "Unbounded", family: "Unbounded", query: "Unbounded:wght@700", style: "normal", weight: 700 },
    { id: "spacegrotesk", label: "Space Grotesk", family: "Space Grotesk", query: "Space+Grotesk:wght@700", style: "normal", weight: 700 },
  ];

  loadTitleFont(font) {
    if (!font.query || document.querySelector(`link[data-galaxy-font="${font.id}"]`)) return;
    const link = Object.assign(document.createElement("link"), {
      rel: "stylesheet",
      href: `https://fonts.googleapis.com/css2?family=${font.query}&display=swap`,
    });
    link.dataset.galaxyFont = font.id;
    document.head.append(link);
  }

  applyTitleFont(header = document.querySelector('[data-testid="entity-header"]')) {
    if (!header || !this.fontPageUri) return;
    const id = localStorage.getItem(`galaxy:titleFont:${this.fontPageUri}`) || "default";
    const font = GalaxyTheme.TITLE_FONTS.find((f) => f.id === id) || GalaxyTheme.TITLE_FONTS[0];
    if (header.dataset.galaxyFont === font.id) return;
    header.dataset.galaxyFont = font.id;
    this.loadTitleFont(font);
    if (font.family) {
      header.style.setProperty("--galaxy-title-font", `"${font.family}", Georgia, serif`);
      header.style.setProperty("--galaxy-title-style", font.style);
      header.style.setProperty("--galaxy-title-weight", font.weight);
    } else {
      ["--galaxy-title-font", "--galaxy-title-style", "--galaxy-title-weight"].forEach((v) => header.style.removeProperty(v));
      header.style.setProperty("--galaxy-title-font", "inherit");
      header.style.setProperty("--galaxy-title-style", "normal");
      header.style.setProperty("--galaxy-title-weight", "900");
    }
  }

  ensureFontButton() {
    const header = document.querySelector('[data-testid="entity-header"]');
    if (!header || !this.fontPageUri) return;
    this.applyTitleFont(header);
    if (header.querySelector(".galaxy-font-button")) return;
    const button = document.createElement("button");
    button.className = "galaxy-font-button";
    button.type = "button";
    button.textContent = "Aa";
    button.setAttribute("aria-label", "Title font");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.fontMenu ? this.closeFontMenu() : this.openFontMenu(button);
      button.setAttribute("aria-expanded", String(!!this.fontMenu));
    });
    header.append(button);
  }

  openFontMenu(button) {
    const title = document.querySelector('[data-testid="entity-header"] .main-entityHeader-title')?.innerText.trim() || "Aa";
    const current = localStorage.getItem(`galaxy:titleFont:${this.fontPageUri}`) || "default";
    const menu = document.createElement("div");
    menu.className = "galaxy-font-menu";
    menu.setAttribute("role", "menu");
    for (const font of GalaxyTheme.TITLE_FONTS) {
      this.loadTitleFont(font);
      const item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(font.id === current));
      item.innerHTML = `<span class="galaxy-font-sample"></span><span class="galaxy-font-name"></span>`;
      const sample = item.firstChild;
      sample.textContent = title;
      if (font.family) Object.assign(sample.style, { fontFamily: `"${font.family}"`, fontStyle: font.style, fontWeight: font.weight });
      item.lastChild.textContent = font.label;
      item.addEventListener("click", () => {
        font.id === "default"
          ? localStorage.removeItem(`galaxy:titleFont:${this.fontPageUri}`)
          : localStorage.setItem(`galaxy:titleFont:${this.fontPageUri}`, font.id);
        this.applyTitleFont();
        this.closeFontMenu();
      });
      menu.append(item);
    }
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.right = `${innerWidth - rect.right}px`;
    document.body.append(menu);
    this.fontMenu = menu;
    this.fontMenuDismiss = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !menu.contains(event.target)) this.closeFontMenu();
    };
    setTimeout(() => {
      document.addEventListener("click", this.fontMenuDismiss);
      document.addEventListener("keydown", this.fontMenuDismiss);
    });
  }

  closeFontMenu() {
    document.querySelector(".galaxy-font-button")?.setAttribute("aria-expanded", "false");
    this.fontMenu?.remove();
    this.fontMenu = null;
    document.removeEventListener("click", this.fontMenuDismiss);
    document.removeEventListener("keydown", this.fontMenuDismiss);
  }

  static DEVICE_ICONS = {
    echoDot: '<path d="M7.88 20A9 9 0 1 1 16.12 20Z"/><path d="M8.5 17q3.5 1.6 7 0"/>',
    echoPop: '<path d="M3 19a9 9 0 0 1 18 0z"/><path d="M8 12.5h8"/>',
    echo: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M8.5 5h7"/>',
    echoShow: '<path d="M3 19 5 5h14l2 14z"/><path d="M6.6 8h10.8l1.2 7.5H5.4z"/>',
    echoStudio: '<rect x="5" y="3" width="14" height="18" rx="5"/><circle cx="12" cy="13" r="3.5"/>',
    fireTv: '<rect x="2" y="9" width="15" height="6" rx="1.5"/><path d="M17 11h4v2h-4"/>',
    macbook: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M1 20h22"/><path d="M10.5 4.5h3"/>',
    imac: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 13.5h20"/><path d="M9.5 17 9 21h6l-.5-4"/>',
    macMini: '<rect x="2" y="9" width="20" height="7" rx="2"/><path d="M5 19h14"/>',
    iphone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10.5 5h3"/>',
    ipad: '<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11.5 4.5h1"/>',
    homepodMini: '<path d="M7.88 4A9 9 0 1 0 16.12 4Z"/><path d="M9.5 6.5h5"/>',
    homepod: '<rect x="6" y="2" width="12" height="20" rx="6"/><ellipse cx="12" cy="5.5" rx="3" ry="1"/>',
    appleTv: '<rect x="3" y="8" width="18" height="8" rx="3"/><path d="M6 19h12"/>',
    appleWatch: '<rect x="6" y="5" width="12" height="14" rx="3.5"/><path d="M9 5V2h6v3M9 19v3h6v-3"/>',
    nestMini: '<ellipse cx="12" cy="13" rx="10" ry="5"/><path d="M2 13v-1.5q10-6 20 0V13"/>',
    nestAudio: '<rect x="7" y="2" width="10" height="20" rx="5"/><path d="M10.5 6h.01M12 6h.01M13.5 6h.01"/>',
    nestHub: '<path d="M4 3h16a1 1 0 0 1 1 1v11H3V4a1 1 0 0 1 1-1z"/><path d="M5 15l1 5h12l1-5"/>',
    googleHome: '<path d="M7 22h10l1-13H6z"/><path d="M6 9l12-3"/>',
    chromecast: '<rect x="2" y="8" width="13" height="8" rx="4"/><path d="M15 12h2a3 3 0 0 0 3-3V4"/>',
    sonosOne: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9.5 5h5"/>',
    sonosEra300: '<path d="M5 3h14l-3 9 3 9H5l3-9z"/>',
    sonosPortable: '<rect x="7" y="5" width="10" height="17" rx="4"/><path d="M9.5 2.5h5"/>',
    soundbar: '<rect x="1" y="9" width="22" height="6" rx="3"/><path d="M5 12h.01M19 12h.01"/>',
    portableSpeaker: '<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M3 10v4M21 10v4"/>',
    avr: '<rect x="1" y="7" width="22" height="10" rx="1.5"/><circle cx="17" cy="12" r="2.5"/><path d="M4 11h6"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
    tv: '<rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M8 21l1.5-4h5l1.5 4"/>',
    playstation: '<path d="M8 2q-3 10 0 20h8q3-10 0-20z"/><path d="M12 2v20"/>',
    xbox: '<rect x="6" y="2" width="12" height="20" rx="1.5"/><circle cx="12" cy="5.5" r="1.5"/>',
    androidPhone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 5h.01"/>',
    androidTablet: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M5 12h.01"/>',
    laptop: '<rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M1 19.5h22"/><path d="M12 7h.01"/>',
    roundWatch: '<circle cx="12" cy="12" r="6"/><path d="M9 6.8 9.5 2h5l.5 4.8M9 17.2l.5 4.8h5l.5-4.8"/>',
    car: '<path d="M3 17v-5l2-5h14l2 5v5z"/><path d="M3 17v3h3v-3M18 17v3h3v-3M3 12h18"/><path d="M7 14.5h.01M17 14.5h.01"/>',
  };

  deviceIconKey(device) {
    const brand = (device.brandDisplayName || "").toLowerCase();
    const model = (device.modelDisplayName || "").toLowerCase().replace(/_/g, " ");
    const name = (device.name || "").toLowerCase();
    const type = (device.type || "").toLowerCase();
    const has = (...words) => words.some((w) => model.includes(w) || name.includes(w));
    const is = (...brands) => brands.some((b) => brand.includes(b));

    if (is("amazon") || has("echo")) {
      if (has("dot")) return "echoDot";
      if (has("pop")) return "echoPop";
      if (has("show")) return "echoShow";
      if (has("studio")) return "echoStudio";
      if (has("fire") || type === "tv" || type === "stb") return "fireTv";
      return "echo";
    }
    if (is("apple")) {
      if (has("iphone") || type === "smartphone") return "iphone";
      if (has("ipad") || type === "tablet") return "ipad";
      if (has("watch") || type === "smartwatch") return "appleWatch";
      if (has("homepod mini", "audioaccessory5")) return "homepodMini";
      if (has("homepod", "audioaccessory")) return "homepod";
      if (has("apple tv", "appletv") || type === "tv" || type === "stb") return "appleTv";
      if (has("imac")) return "imac";
      if (has("mac mini", "macmini")) return "macMini";
      if (type === "computer" || has("macbook")) return "macbook";
    }
    if (is("google")) {
      if (has("nest mini", "home mini")) return "nestMini";
      if (has("nest audio")) return "nestAudio";
      if (has("hub")) return "nestHub";
      if (has("chromecast") || type.startsWith("cast")) return "chromecast";
      if (has("pixel watch") || type === "smartwatch") return "roundWatch";
      if (has("google home")) return "googleHome";
    }
    if (is("sonos")) {
      if (has("beam", "arc", "ray")) return "soundbar";
      if (has("era 300")) return "sonosEra300";
      if (has("move", "roam")) return "sonosPortable";
      if (has("ace")) return "headphones";
      return "sonosOne";
    }
    if (is("sony") && has("playstation", "ps4", "ps5")) return "playstation";
    if (is("microsoft") && has("xbox")) return "xbox";
    if (has("soundbar", "sound bar")) return "soundbar";
    if (is("jbl", "ultimate ears", "marshall") || has("soundlink", "boom", "flip", "charge")) return "portableSpeaker";
    if (has("headphone", "buds", "quietcomfort", "wh-1000")) return "headphones";

    return {
      smartphone: "androidPhone",
      tablet: "androidTablet",
      computer: "laptop",
      chromebook: "laptop",
      tv: "tv",
      stb: "fireTv",
      game_console: "xbox",
      avr: "avr",
      automobile: "car",
      smartwatch: "roundWatch",
      cast_video: "chromecast",
      cast_audio: "chromecast",
      audio_dongle: "chromecast",
      speaker: "sonosOne",
    }[type] || null;
  }

  setupDeviceIcons() {
    this.waitForElement([".Root__right-sidebar-peek"], ([sidebar]) => {
      let queued = false;
      const apply = () => {
        queued = false;
        const devices = Spicetify.Platform.ConnectAPI?.getState?.()?.devices || [];
        sidebar.querySelectorAll('[data-testid="device-icon"], [data-testid="main-icon"]').forEach((svg) => {
          const state = Spicetify.Platform.ConnectAPI?.getState?.();
          let device = null;
          for (let row = svg.parentElement, i = 0; row && i < 8 && !device; row = row.parentElement, i++) {
            const text = row.innerText || "";
            device = devices.find((d) => d.name && !d.isLocal && text.includes(d.name)) ||
                     (/this computer/i.test(text) ? devices.find((d) => d.isLocal) : null);
          }
          if (!device && svg.dataset.testid === "device-icon") device = state?.activeDevice;
          const key = device && this.deviceIconKey(device);
          if (!key || svg.dataset.galaxyIcon === key) return;
          svg.dataset.galaxyIcon = key;
          svg.setAttribute("viewBox", "0 0 24 24");
          svg.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GalaxyTheme.DEVICE_ICONS[key]}</g>`;
        });
      };
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(apply);
      }).observe(sidebar, { childList: true, subtree: true });
      apply();
    });
  }

  setupScrollListeners() {
      this.waitForElement(["#main-view"], ([mainView]) => {
          let queued = false;
          mainView.addEventListener("scroll", (event) => {
              const node = event.target;
              if (queued || !node.matches?.("[data-overlayscrollbars-viewport]")) return;
              queued = true;
              requestAnimationFrame(() => {
                  queued = false;
                  const atTop = node.scrollTop < 120;
                  const atEnd = node.scrollHeight - node.scrollTop - node.clientHeight <= 1;
                  const fade = atTop ? "bottom" : atEnd ? "top" : "full";
                  if (node.getAttribute("fade") !== fade) node.setAttribute("fade", fade);
              });
          }, { capture: true, passive: true });
      });
  }

  setupEditButtons() {
    const ensure = () => {
      if (document.getElementById("galaxy-settings-button")) return;
      const neighbour = document.querySelector('#global-nav-bar button[aria-label="What\'s New"]') ||
                        document.querySelector('#global-nav-bar [data-testid="user-widget-link"]');
      if (!neighbour) return;
      const button = document.createElement("button");
      button.id = "galaxy-settings-button";
      button.className = neighbour.className;
      button.type = "button";
      button.setAttribute("aria-label", "Theme settings");
      button.title = "Theme settings";
      button.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4h7M13 4h1M2 12h1M7 12h7"/><circle cx="11" cy="4" r="2"/><circle cx="5" cy="12" r="2"/></svg>`;
      button.addEventListener("click", () => this.openHomeSettingsModal());
      neighbour.before(button);
    };
    this.waitForElement(["#global-nav-bar"], ([nav]) => {
      ensure();
      new MutationObserver(ensure).observe(nav, { childList: true, subtree: true });
    });
  }

  openHomeSettingsModal() {
    const content = document.createElement("div");
    content.className = "galaxy-settings";
    content.innerHTML = `
      <section>
        <h3>Background</h3>
        <div class="galaxy-bg-modes" role="radiogroup" aria-label="Background">
          <button type="button" role="radio" data-mode="gradient"><span class="galaxy-bg-swatch galaxy-bg-swatch--gradient"></span>Animated gradient</button>
          <button type="button" role="radio" data-mode="image"><span class="galaxy-bg-swatch galaxy-bg-swatch--image"></span>Custom image</button>
        </div>
        <div class="galaxy-bg-image">
          <input type="text" class="galaxy-input" placeholder="Image URL (recommended)" spellcheck="false">
          <button type="button" class="galaxy-button galaxy-file-button">Choose file</button>
          <input type="file" accept="image/*" hidden>
        </div>
      </section>
      <section>
        <h3>Lyrics colour</h3>
        <div class="galaxy-bg-modes" role="radiogroup" aria-label="Lyrics colour">
          <button type="button" role="radio" data-lyrics="song"><span class="galaxy-bg-swatch galaxy-lyrics-swatch--song"></span>Match the song</button>
          <button type="button" role="radio" data-lyrics="custom"><span class="galaxy-bg-swatch galaxy-lyrics-swatch--custom"></span>Custom colour</button>
        </div>
        <label class="galaxy-lyrics-picker">
          <span>Colour</span>
          <input type="color" class="galaxy-color-input">
        </label>
      </section>
      <section class="galaxy-toggles">
        <h3>Options</h3>
      </section>
      <div class="galaxy-settings-footer">
        <button type="button" class="galaxy-button galaxy-button--primary galaxy-save">Save</button>
      </div>`;

    let mode = this.startImage ? "image" : "gradient";
    let image = this.startImage;
    const modes = content.querySelectorAll("[data-mode]");
    const imageRow = content.querySelector(".galaxy-bg-image");
    const urlInput = imageRow.querySelector(".galaxy-input");
    const fileInput = imageRow.querySelector('input[type="file"]');
    const imageSwatch = content.querySelector(".galaxy-bg-swatch--image");
    const render = () => {
      modes.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
      imageRow.hidden = mode !== "image";
      imageSwatch.style.backgroundImage = image ? `url("${image}")` : "";
    };
    modes.forEach((b) => b.addEventListener("click", () => {
      mode = b.dataset.mode;
      render();
    }));
    if (image && !image.startsWith("data:")) urlInput.value = image;
    urlInput.addEventListener("input", () => {
      image = urlInput.value.trim() || null;
      render();
    });
    imageRow.querySelector(".galaxy-file-button").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const ratio = Math.min(1, 1600 / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          image = canvas.toDataURL("image/jpeg", 0.8);
          urlInput.value = "";
          render();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

    let lyricsAccent = this.lyricsAccent;
    const lyricsModes = content.querySelectorAll("[data-lyrics]");
    const lyricsPicker = content.querySelector(".galaxy-lyrics-picker");
    const colorInput = lyricsPicker.querySelector("input");
    const customSwatch = content.querySelector(".galaxy-lyrics-swatch--custom");
    colorInput.value = lyricsAccent || "#c7a6ff";
    const renderLyrics = () => {
      lyricsModes.forEach((b) => b.setAttribute("aria-checked", String((b.dataset.lyrics === "custom") === !!lyricsAccent)));
      lyricsPicker.hidden = !lyricsAccent;
      customSwatch.style.setProperty("--galaxy-swatch-color", colorInput.value);
    };
    lyricsModes.forEach((b) => b.addEventListener("click", () => {
      lyricsAccent = b.dataset.lyrics === "custom" ? colorInput.value : null;
      renderLyrics();
    }));
    colorInput.addEventListener("input", () => {
      lyricsAccent = colorInput.value;
      renderLyrics();
    });
    renderLyrics();

    const toggles = content.querySelector(".galaxy-toggles");
    const options = [
      ["useCurrentSongAsHome", "Use the playing song's cover as the background"],
      ["useHomeEverywhere", "Use the home background on every page"],
      ["blurHomeBackground", "Blur a custom image on Home"],
      ["blurAllBackgrounds", "Blur a custom image on other pages"],
    ];
    for (const [key, label] of options) {
      const row = document.createElement("label");
      row.className = "galaxy-toggle-row";
      row.innerHTML = `<span></span><input type="checkbox" role="switch">`;
      row.firstChild.textContent = label;
      row.lastChild.checked = !!JSON.parse(localStorage.getItem(key));
      row.lastChild.dataset.key = key;
      toggles.append(row);
    }

    content.querySelector(".galaxy-save").addEventListener("click", () => {
      const next = mode === "image" ? image : null;
      try {
        next ? localStorage.setItem("galaxy:startupBg", next) : localStorage.removeItem("galaxy:startupBg");
        this.startImage = next;
      } catch (e) {
        Spicetify.showNotification("That image is too large; use a URL instead");
        return;
      }
      lyricsAccent ? localStorage.setItem("galaxy:lyricsAccent", lyricsAccent) : localStorage.removeItem("galaxy:lyricsAccent");
      this.lyricsAccent = lyricsAccent;
      this.applyLyricsAccent();
      toggles.querySelectorAll("input").forEach((input) => localStorage.setItem(input.dataset.key, input.checked));
      this.parseOptions();
      this.onPageChange(Spicetify.Platform.History.location);
      Spicetify.PopupModal.hide();
    });

    render();
    Spicetify.PopupModal.display({ title: "Theme settings", content });
  }

  setupPlaylistEditObserver() {
      // Observe the edit playlist popup to inject custom background input
      const bannerInput = document.createElement("input");
      bannerInput.type = "file";
      bannerInput.className = "banner-input";
      bannerInput.accept = "image/*";
      
      const editObserver = new MutationObserver((mutation_list) => {
          for (let mutation of mutation_list) {
              if (mutation.addedNodes.length) {
                  const popupContent = mutation.addedNodes[0].querySelector(".main-playlistEditDetailsModal-content");
                  if (!popupContent) continue;
                  
                  const coverSelect = popupContent.querySelector(".main-playlistEditDetailsModal-albumCover");
                  if(!coverSelect) continue;
                  
                  const bannerSelect = coverSelect.cloneNode(true);
                  bannerSelect.id = "banner-select";
                  
                  const [, , uid] = Spicetify.Platform.History.location.pathname.split("/");
                  const base64 = localStorage.getItem("galaxy:playlistBg:" + uid);
                  
                  if (base64) {
                      bannerSelect.querySelector("img").src = base64;
                      bannerSelect.querySelector("img").removeAttribute("srcset");
                  }
                  
                  const srcInput = document.createElement("input");
                  srcInput.type = "text";
                  srcInput.classList.add("main-playlistEditDetailsModal-textElement", "main-playlistEditDetailsModal-titleInput");
                  srcInput.id = "src-input";
                  srcInput.placeholder = "Banner image URL (recommended)";
                  
                  bannerSelect.querySelector(".main-playlistEditDetailsModal-imageDropDownButton")?.remove();
                  
                  popupContent.append(bannerSelect);
                  popupContent.append(bannerInput);
                  popupContent.append(srcInput);
                  
                  const editButton = bannerSelect.querySelector(".main-editImageButton-image");
                  if(editButton) {
                      editButton.onclick = () => bannerInput.click();
                  }
                  
                  bannerInput.onchange = () => {
                      if (!bannerInput.files.length) return;
                      const reader = new FileReader();
                      reader.onload = (e) => {
                          const imgElement = new Image();
                          imgElement.onload = () => {
                              const canvas = document.createElement("canvas");
                              let { width, height } = imgElement;
                              if (width > 1200 || height > 1200) {
                                  const ratio = Math.min(1200 / width, 1200 / height);
                                  width *= ratio; height *= ratio;
                              }
                              canvas.width = width; canvas.height = height;
                              const ctx = canvas.getContext("2d");
                              ctx.drawImage(imgElement, 0, 0, width, height);
                              bannerSelect.querySelector("img").src = canvas.toDataURL("image/jpeg", 0.7);
                              srcInput.value = "";
                          };
                          imgElement.src = e.target.result;
                      };
                      reader.readAsDataURL(bannerInput.files[0]);
                  };
                  
                  const saveBtn = popupContent.querySelector(".main-playlistEditDetailsModal-save button");
                  if(saveBtn) {
                      saveBtn.addEventListener("click", () => {
                          const val = srcInput.value || bannerSelect.querySelector("img").src;
                          if (val && val !== coverSelect.querySelector("img").src) {
                              try { localStorage.setItem("galaxy:playlistBg:" + uid, val); } catch(e) {}
                          }
                          this.getPlaylistImage(uid);
                      });
                  }
              }
          }
      });
      editObserver.observe(document.body, { childList: true });
  }

}

// Initialize Theme
new GalaxyTheme().init();
