/**
 * Los Simuladores — lógica principal
 * ----------------------------------
 * Secciones:
 *  1. Estado y persistencia (localStorage — capítulos/vistos/comentarios)
 *  2. Auth admin (hash SHA-256 en config.js — sin clave en texto plano)
 *  3. Vistas y navegación
 *  4. Episodios / reproductor / comentarios
 *  5. UI helpers (toast, modales)
 */
(function () {
  "use strict";

  const CFG = window.SITE_CONFIG || {};
  const STORAGE_KEY = CFG.storageKey || "simuladores_v5";

  let supabase = null;
  function initSupabase() {
    if (supabase) return supabase;
    if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseAnonKey) return null;
    try {
      supabase = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    } catch (e) {
      console.warn("Supabase init failed", e);
      return null;
    }
    return supabase;
  }

  function mapEpFromDb(row) {
    return {
      id: Number(row.id),
      season: Number(row.season),
      number: Number(row.number),
      title: row.title || "",
      desc: row.description || row.desc || "",
      duration: row.duration != null ? Number(row.duration) : null,
      url: row.url || "",
      thumb: row.thumb || "",
    };
  }

  function mapEpToDb(ep) {
    return {
      id: Number(ep.id),
      season: Number(ep.season),
      number: Number(ep.number),
      title: ep.title || "",
      description: ep.desc || ep.description || "",
      duration: Number(ep.duration) || 0,
      url: ep.url || "",
      thumb: ep.thumb || "",
      updated_at: new Date().toISOString(),
    };
  }

  async function cloudSaveEpisode(ep) {
    const sb = initSupabase();
    if (!sb) return { ok: false, error: "Sin Supabase" };
    const { error } = await sb.from("episodes").upsert(mapEpToDb(ep), { onConflict: "id" });
    return { ok: !error, error: error && error.message };
  }

  async function cloudDeleteEpisode(id) {
    const sb = initSupabase();
    if (!sb) return { ok: false, error: "Sin Supabase" };
    const { error } = await sb.from("episodes").delete().eq("id", id);
    return { ok: !error, error: error && error.message };
  }

  async function cloudSaveSettings(data) {
    const sb = initSupabase();
    if (!sb) return { ok: false, error: "Sin Supabase" };
    const { error } = await sb.from("site_settings").upsert(
      { id: 1, data: data, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    return { ok: !error, error: error && error.message };
  }


  // —— Estado ——
  let episodes = [];
  let settings = {};
  let comments = {}; // { [episodeId]: [{id,name,text,ts}] }
  let watched = {};
  let continueId = null;
  let isAdmin = false;
  let currentSeason = 1;
  let currentPlayId = null;
  let searchQuery = "";
  let adminToken = null;
  let adminExpires = 0;

  // =========================================================
  // 1. Persistencia
  // =========================================================
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        settings = Object.assign({}, defaultSettings(), data.settings || {});
        episodes = Array.isArray(data.episodes) && data.episodes.length
          ? data.episodes
          : [];
        comments = data.comments || {};
        watched = data.watched || {};
        continueId = data.continueId != null ? Number(data.continueId) : null;
        if (continueId && isNaN(continueId)) continueId = null;
      } else {
        settings = defaultSettings();
      }
    } catch {
      settings = defaultSettings();
    }
  }

  function defaultSettings() {
    return {
      siteName: CFG.siteName,
      badgeText: CFG.badgeText,
      heroTitle: CFG.heroTitle,
      heroSubtitle: CFG.heroSubtitle,
      heroBg: CFG.heroBg || "fondo-simuladores.jpg",
      tabTitle: CFG.tabTitle,
      ogDescription: CFG.ogDescription,
      donateUrl: CFG.donateUrl,
      donateText: CFG.donateText,
      s1Color: (CFG.seasons && CFG.seasons[1] && CFG.seasons[1].color) || "#3eb34f",
      s2Color: (CFG.seasons && CFG.seasons[2] && CFG.seasons[2].color) || "#2a7a94",
      ads: { enabled: false, homeTop: "", homeBottom: "", playerBelow: "" },
      cfBeacon: "",
    };
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ settings, episodes, comments, watched, continueId })
      );
    } catch {
      toast("No se pudo guardar (almacenamiento lleno o bloqueado)");
    }
  }

  async function loadEpisodes() {
    // 1) JSON local primero (rápido) — evita "0 capítulos" varios segundos
    let defaults = [];
    try {
      const res = await fetch("js/episodes.json", { cache: "no-store" });
      defaults = await res.json();
    } catch {
      defaults = [];
    }
    if (defaults.length) {
      if (episodes.length) mergeDefaultEpisodes(defaults);
      else episodes = defaults.map((e) => JSON.parse(JSON.stringify(e)));
      persist();
      try {
        updateHomeCounts();
      } catch (_) {}
    }

    // 2) Supabase con timeout corto (si DNS falla no bloquea la UI)
    const sb = initSupabase();
    if (sb) {
      try {
        const timeout = new Promise((_, rej) =>
          setTimeout(() => rej(new Error("supabase-timeout")), 2500)
        );
        const query = sb.from("episodes").select("*").order("season").order("number");
        const { data, error } = await Promise.race([query, timeout]);
        if (!error && data && data.length) {
          episodes = data.map(mapEpFromDb);
          persist();
          try {
            updateHomeCounts();
            renderEpisodes();
          } catch (_) {}
          try {
            const st = await Promise.race([
              sb.from("site_settings").select("data").eq("id", 1).maybeSingle(),
              new Promise((_, rej) => setTimeout(() => rej(new Error("st-timeout")), 2000)),
            ]);
            if (st && st.data && st.data.data) {
              settings = Object.assign(defaultSettings(), st.data.data);
              persist();
              applySettings();
            }
          } catch (_) {}
          return;
        }
        if (error) console.warn("Supabase episodes:", error.message);
      } catch (e) {
        console.warn("Supabase load skipped:", e && e.message ? e.message : e);
      }
    }

    if (!episodes.length) {
      toast("No se pudieron cargar los capítulos");
    }
  }

  function mergeDefaultEpisodes(defaults) {
    if (!Array.isArray(defaults) || !defaults.length) return;
    const byId = new Map(episodes.map((e) => [Number(e.id), e]));
    defaults.forEach((d) => {
      const id = Number(d.id);
      const cur = byId.get(id);
      if (!cur) {
        episodes.push(JSON.parse(JSON.stringify(d)));
        byId.set(id, episodes[episodes.length - 1]);
      } else {
        // El episodes.json del servidor manda en contenido público
        // (así un deploy actualiza miniaturas/links para todos).
        // localStorage solo conserva vistos/comentarios aparte.
        if (d.url != null && String(d.url).trim()) cur.url = d.url;
        if (d.thumb != null && String(d.thumb).trim()) cur.thumb = d.thumb;
        if (d.title) cur.title = d.title;
        if (d.desc != null) cur.desc = d.desc;
        if (d.description != null && !d.desc) cur.desc = d.description;
        if (d.duration != null) cur.duration = d.duration;
        if (d.season != null) cur.season = d.season;
        if (d.number != null) cur.number = d.number;
      }
    });
  }

  // =========================================================
  // 2. Auth admin (servidor)
  // =========================================================
  function setAdmin(on) {
    isAdmin = !!on;
    document.body.classList.toggle("is-admin", isAdmin);
    const bar = document.getElementById("adminBar");
    const toggle = document.getElementById("adminToggleBtn");
    if (bar) bar.style.display = isAdmin ? "flex" : "none";
    if (toggle && !isAdmin) toggle.style.display = "none";
    const addS = document.getElementById("addEpSeasonBtn");
    if (addS) addS.style.display = isAdmin ? "inline-flex" : "none";
    if (!isAdmin) {
      adminToken = null;
      adminExpires = 0;
      sessionStorage.removeItem("admin_session");
    }
    renderEpisodes();
    renderComments();
  }

  async function restoreAdminSession() {
    try {
      const sb = initSupabase();
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (data && data.session) {
          const em = (data.session.user && data.session.user.email) || "";
          if (!CFG.adminEmail || em.toLowerCase() === String(CFG.adminEmail).toLowerCase()) {
            adminToken = data.session.access_token;
            adminExpires = Date.now() + (Number(CFG.adminSessionMinutes) || 60) * 60 * 1000;
            setAdmin(true);
            scheduleAdminTimeout();
            return;
          }
        }
      }
      const s = JSON.parse(sessionStorage.getItem("admin_session") || "null");
      if (s && s.token && s.expiresAt > Date.now()) {
        // sin sesión supabase no hay escritura en nube
        sessionStorage.removeItem("admin_session");
      }
    } catch (_) {}
  }

  function scheduleAdminTimeout() {
    const ms = Math.max(0, adminExpires - Date.now());
    if (!ms) return;
    setTimeout(() => {
      if (Date.now() >= adminExpires) {
        setAdmin(false);
        toast("Sesión admin expirada");
      }
    }, ms + 50);
  }

  async function tryLogin() {
    const err = document.getElementById("loginError");
    if (err) err.textContent = "";
    const emailEl = document.getElementById("adminEmail");
    const email = ((emailEl && emailEl.value.trim()) || CFG.adminEmail || "").trim();
    const password = (document.getElementById("adminPassword").value || "");
    if (!email || !password) {
      if (err) err.textContent = "Completá email y contraseña de Supabase";
      return;
    }
    const now = Date.now();
    if (window.__adminLockUntil && now < window.__adminLockUntil) {
      const m = Math.ceil((window.__adminLockUntil - now) / 60000);
      if (err) err.textContent = "Demasiados intentos. Probá en " + m + " min.";
      return;
    }
    function failCount() {
      window.__adminFails = (window.__adminFails || 0) + 1;
      if (window.__adminFails >= 5) {
        window.__adminLockUntil = now + 15 * 60 * 1000;
        window.__adminFails = 0;
        if (err) err.textContent = "Bloqueado 15 minutos";
        return true;
      }
      return false;
    }
    const sb = initSupabase();
    if (!sb) {
      if (err) err.textContent = "Supabase no está disponible. Revisá la conexión.";
      return;
    }
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data || !data.session) {
        if (failCount()) return;
        if (err) err.textContent = (error && error.message) || "Credenciales incorrectas";
        return;
      }
      const userEmail = (data.user && data.user.email) || "";
      if (CFG.adminEmail && userEmail.toLowerCase() !== String(CFG.adminEmail).toLowerCase()) {
        await sb.auth.signOut();
        if (err) err.textContent = "Ese usuario no es admin de este sitio";
        return;
      }
      window.__adminFails = 0;
      const mins = Number(CFG.adminSessionMinutes) || 60;
      adminExpires = Date.now() + mins * 60 * 1000;
      adminToken = data.session.access_token;
      sessionStorage.setItem(
        "admin_session",
        JSON.stringify({ token: adminToken, expiresAt: adminExpires })
      );
      const modal = document.getElementById("loginModal");
      if (modal) modal.classList.remove("open");
      const pass = document.getElementById("adminPassword");
      if (pass) pass.value = "";
      setAdmin(true);
      scheduleAdminTimeout();
      toast("Admin online (Supabase)");
    } catch (e) {
      console.warn("Supabase login error", e);
      if (err) err.textContent = "No se pudo conectar con Supabase";
    }
  }


  /** Desbloquear botón Admin: Ctrl+Shift+A o 7 toques / long-press en el logo */
  function setupAdminUnlock() {
    const logo = document.getElementById("logoHome");
    const toggle = document.getElementById("adminToggleBtn");
    function showToggle() {
      if (toggle) {
        toggle.style.display = "inline-flex";
        toast("Admin desbloqueado");
      }
    }
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.code === "KeyA")) {
        e.preventDefault();
        showToggle();
      }
    });
    if (!logo) return;
    let taps = 0,
      tapTimer,
      pressTimer;
    logo.addEventListener("click", (e) => {
      taps++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => (taps = 0), 2200);
      if (taps >= 7) {
        taps = 0;
        e.preventDefault();
        showToggle();
      }
    });
    const start = () => {
      pressTimer = setTimeout(showToggle, 2500);
    };
    const end = () => clearTimeout(pressTimer);
    logo.addEventListener("touchstart", start, { passive: true });
    logo.addEventListener("touchend", end);
    logo.addEventListener("mousedown", start);
    logo.addEventListener("mouseup", end);
    logo.addEventListener("mouseleave", end);
    if (location.hash === "#admin") showToggle();
  }

  // =========================================================
  // 3. Vistas
  // =========================================================
  function showView(id) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applySettings() {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text || "";
    };
    set("siteNameLabel", settings.siteName || CFG.siteName);
    set("badgeText", settings.badgeText || "");
    set("heroTitle", settings.heroTitle || "");
    set("heroSubtitle", settings.heroSubtitle || "");
    document.title = settings.tabTitle || CFG.tabTitle || "Los Simuladores";
    document.documentElement.style.setProperty("--s1", settings.s1Color || "#3eb34f");
    document.documentElement.style.setProperty("--s2", settings.s2Color || "#2a7a94");
    document.documentElement.style.setProperty("--accent", settings.s1Color || "#3eb34f");

    const bg = settings.heroBg || CFG.heroBg || "fondo-simuladores.jpg";
    const hero = document.getElementById("heroBg");
    if (hero) hero.style.backgroundImage = 'url("' + bg.replace(/"/g, '\\"') + '")';

    const dona = document.getElementById("donateText");
    if (dona) dona.textContent = settings.donateText || CFG.donateText || "";
    const donaBtn = document.getElementById("donateLink");
    if (donaBtn) donaBtn.href = settings.donateUrl || CFG.donateUrl || "#";

    updateHomeCounts();
    renderAds();
    applyCloudflare();
  }

  function updateHomeCounts() {
    const c1 = document.getElementById("homeCount1");
    const c2 = document.getElementById("homeCount2");
    if (c1) c1.textContent = episodes.filter((e) => e.season === 1).length;
    if (c2) c2.textContent = episodes.filter((e) => e.season === 2).length;
  }

  function applyCloudflare() {
    const token = (settings.cfBeacon || "").trim();
    let s = document.getElementById("cfAnalytics");
    if (!token) {
      if (s) s.remove();
      return;
    }
    if (s) s.remove();
    s = document.createElement("script");
    s.id = "cfAnalytics";
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token }));
    document.head.appendChild(s);
  }

  function injectHtmlWithScripts(container, htmlCode) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.innerHTML = htmlCode;
    Array.from(wrap.childNodes).forEach((node) => {
      if (node.nodeName === "SCRIPT") {
        const s = document.createElement("script");
        Array.from(node.attributes || []).forEach((a) => s.setAttribute(a.name, a.value));
        if (node.textContent) s.text = node.textContent;
        container.appendChild(s);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    });
    const trimmed = String(htmlCode).trim();
    if (/^https?:\/\/\S+\.js(\?|$)/i.test(trimmed) && !container.querySelector("script")) {
      const s = document.createElement("script");
      s.src = trimmed;
      s.async = true;
      container.appendChild(s);
    }
  }

  function renderAds() {
    const ads = settings.ads || {};
    [
      ["adHomeTop", ads.homeTop],
      ["adHomeBottom", ads.homeBottom],
      ["adPlayerBelow", ads.playerBelow],
    ].forEach(([id, code]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const inner = el.querySelector(".ad-inner") || el;
      if (ads.enabled && code && String(code).trim()) {
        el.classList.add("has-ad");
        try {
          injectHtmlWithScripts(inner, String(code));
        } catch {
          inner.innerHTML = code;
        }
      } else {
        el.classList.remove("has-ad");
        inner.innerHTML = "";
      }
    });
  }

  // =========================================================
  // 4. Episodios / player
  // =========================================================
  function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t || "";
    return d.innerHTML;
  }

  function normalizeUrl(u) {
    if (!u) return "";
    u = String(u).trim().replace(/^["']|["']$/g, "");
    const m = u.match(/https?:\/\/[^\s"'<>]+/i);
    if (m) u = m[0];
    if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
    return u;
  }

  function toEmbedUrl(url) {
    url = normalizeUrl(url);
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "ok.ru" || host === "www.ok.ru") {
        const m = url.match(/video[\/_](\d+)/i) || u.pathname.match(/(\d{6,})/);
        if (m) return { type: "iframe", src: "https://ok.ru/videoembed/" + m[1] };
      }
      if (host.includes("youtube.com") || host === "youtu.be") {
        let id = u.searchParams.get("v");
        if (!id && u.pathname.includes("/embed/")) id = u.pathname.split("/embed/")[1].split("/")[0];
        if (!id && host === "youtu.be") id = u.pathname.split("/").filter(Boolean)[0];
        if (id)
          return {
            type: "iframe",
            src: "https://www.youtube-nocookie.com/embed/" + id + "?rel=0",
          };
      }
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { type: "video", src: url };
      return { type: "iframe", src: url };
    } catch {
      return null;
    }
  }

  function openSeason(n) {
    currentSeason = n;
    document.body.classList.remove("theme-s1", "theme-s2");
    document.body.classList.add(n === 1 ? "theme-s1" : "theme-s2");
    const title = document.getElementById("seasonTitle");
    if (title)
      title.textContent =
        (CFG.seasons && CFG.seasons[n] && CFG.seasons[n].name) || "Temporada " + n;
    searchQuery = "";
    const si = document.getElementById("searchInput");
    if (si) si.value = "";
    showView("viewSeason");
    renderEpisodes();
    renderContinue();
  }

  function renderEpisodes() {
    const grid = document.getElementById("episodesGrid");
    if (!grid) return;
    const q = (searchQuery || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    let list = episodes
      .filter((e) => e.season === currentSeason)
      .sort((a, b) => a.number - b.number);
    if (q) {
      list = list.filter((e) => {
        const blob = (e.title + " " + (e.desc || "") + " ep " + e.number)
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}/gu, "");
        return blob.includes(q);
      });
    }
    grid.innerHTML = list
      .map((ep) => {
        const thumb = ep.thumb
          ? '<img src="' + escapeHtml(ep.thumb) + '" alt="" loading="lazy" />'
          : '<div class="ep-thumb-placeholder">Sin miniatura</div>';
        const seen = watched[ep.id]
          ? '<span class="ep-watched-badge">Visto</span>'
          : "";
        const adminBtns = isAdmin
          ? '<button type="button" class="btn-sm" data-edit="' +
            ep.id +
            '">Editar</button><button type="button" class="btn-sm btn-danger" data-del="' +
            ep.id +
            '">Eliminar</button>'
          : "";
        return (
          '<article class="episode-card" data-id="' +
          ep.id +
          '">' +
          '<div class="ep-thumb-wrap" data-play="' +
          ep.id +
          '">' +
          thumb +
          "</div>" +
          '<div class="ep-body">' +
          '<div class="ep-meta">EP ' +
          String(ep.number).padStart(2, "0") +
          (ep.duration ? " · " + ep.duration + " min" : "") +
          " " +
          seen +
          "</div>" +
          '<h3 class="ep-title">' +
          escapeHtml(ep.title) +
          "</h3>" +
          '<p class="ep-desc">' +
          escapeHtml(ep.desc || "") +
          "</p>" +
          '<div class="ep-actions">' +
          '<button type="button" class="btn-play" data-play="' +
          ep.id +
          '">▶ Reproducir</button>' +
          '<button type="button" class="btn-sm" data-toggle-seen="' +
          ep.id +
          '">' +
          (watched[ep.id] ? "No visto" : "Visto") +
          "</button>" +
          adminBtns +
          "</div></div></article>"
        );
      })
      .join("");
  }

  function playEpisode(id) {
    const ep = episodes.find((e) => e.id === id);
    if (!ep) {
      showView("view404");
      return;
    }
    id = Number(id);
    currentPlayId = id;
    continueId = id;
    watched[id] = true;
    persist();
    document.body.classList.remove("theme-s1", "theme-s2");
    document.body.classList.add(ep.season === 1 ? "theme-s1" : "theme-s2");
    document.getElementById("playerMeta").textContent =
      "EP " + String(ep.number).padStart(2, "0") + " · Temporada " + ep.season;
    document.getElementById("playerTitle").textContent = ep.title;

    const frame = document.getElementById("playerFrame");
    const emb = toEmbedUrl(ep.url);
    const orig = ep.url || "";
    if (!emb) {
      frame.innerHTML =
        '<div class="player-fallback">No hay link de video para este capítulo.</div>';
    } else if (emb.type === "video") {
      frame.innerHTML =
        '<video controls autoplay playsinline src="' + escapeHtml(emb.src) + '"></video>';
      const v = frame.querySelector("video");
      v.addEventListener("ended", onEpisodeEnded);
    } else {
      frame.innerHTML =
        '<iframe id="mainVideoFrame" src="' +
        escapeHtml(emb.src) +
        '" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>' +
        '<div class="player-fallback" id="embedBlockedHint" style="display:none;flex-direction:column;gap:0.75rem">' +
        "<p>El video está bloqueado por una extensión (Privacy Badger, uBlock, etc.) o por el sitio de origen.</p>" +
        '<a class="btn btn-primary" href="' +
        escapeHtml(orig) +
        '" target="_blank" rel="noopener">Ver en el sitio original</a>' +
        "</div>";
      setTimeout(() => {
        const ifr = document.getElementById("mainVideoFrame");
        const hint = document.getElementById("embedBlockedHint");
        if (ifr && hint && ifr.clientHeight < 40) {
          ifr.style.display = "none";
          hint.style.display = "flex";
        }
      }, 2200);
    }

    const same = episodes
      .filter((e) => e.season === ep.season)
      .sort((a, b) => a.number - b.number);
    const idx = same.findIndex((e) => e.id === ep.id);
    const prev = document.getElementById("playerPrev");
    const next = document.getElementById("playerNext");
    if (prev) {
      prev.style.visibility = idx > 0 ? "visible" : "hidden";
      prev.onclick = () => idx > 0 && playEpisode(same[idx - 1].id);
    }
    if (next) {
      next.style.visibility = idx < same.length - 1 ? "visible" : "hidden";
      next.onclick = () => idx < same.length - 1 && playEpisode(same[idx + 1].id);
    }

    showView("viewPlayer");
    renderComments();
    renderContinue();
  }

  function onEpisodeEnded() {
    continueId = null;
    persist();
    renderContinue();
  }

  function renderContinue() {
    const wraps = document.querySelectorAll("[data-continue-wrap]");
    const ep = continueId != null
      ? episodes.find((e) => Number(e.id) === Number(continueId))
      : null;
    wraps.forEach((wrap) => {
      if (!ep) {
        wrap.style.display = "none";
        return;
      }
      wrap.style.display = "block";
      const nameEl = wrap.querySelector("[data-continue-name]");
      const thumbEl = wrap.querySelector("[data-continue-thumb]");
      if (nameEl) {
        nameEl.textContent =
          "T" + ep.season + " · EP " + String(ep.number).padStart(2, "0") + " — " + ep.title;
      }
      if (thumbEl) {
        if (ep.thumb) {
          thumbEl.innerHTML = '<img src="' + escapeHtml(ep.thumb) + '" alt="" />';
          thumbEl.style.display = "block";
        } else {
          thumbEl.innerHTML = "";
          thumbEl.style.display = "none";
        }
      }
    });
  }

  function surpriseMe() {
    const unseen = episodes.filter((e) => !watched[e.id]);
    const pool = unseen.length ? unseen : episodes;
    if (!pool.length) return;
    const ep = pool[Math.floor(Math.random() * pool.length)];
    playEpisode(ep.id);
  }

  // Comentarios
  function renderComments() {
    const list = document.getElementById("commentsList");
    if (!list || !currentPlayId) return;
    const items = comments[currentPlayId] || [];
    list.innerHTML = items
      .map(
        (c) =>
          '<div class="comment-item"><button type="button" class="comment-del" data-cid="' +
          c.id +
          '" title="Borrar">✕</button><span class="who">' +
          escapeHtml(c.name) +
          '</span><span class="when">' +
          new Date(c.ts).toLocaleString() +
          "</span><div>" +
          escapeHtml(c.text) +
          "</div></div>"
      )
      .join("");
  }

  // =========================================================
  // 5. UI helpers
  // =========================================================
  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2800);
  }

  function openModal(id) {
    document.getElementById(id).classList.add("open");
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove("open");
  }

  // Episode form
  let epThumbPending = null;

  function openAdd() {
    document.getElementById("modalTitle").textContent = "Agregar capítulo";
    document.getElementById("epId").value = "";
    document.getElementById("epSeason").value = String(currentSeason || 1);
    document.getElementById("epNumber").value = "";
    document.getElementById("epTitle").value = "";
    document.getElementById("epDesc").value = "";
    document.getElementById("epDuration").value = "";
    document.getElementById("epUrl").value = "";
    document.getElementById("epThumb").value = "";
    epThumbPending = null;
    openModal("episodeModal");
  }

  function openEdit(id) {
    const ep = episodes.find((e) => e.id === id);
    if (!ep) return;
    document.getElementById("modalTitle").textContent = "Editar capítulo";
    document.getElementById("epId").value = ep.id;
    document.getElementById("epSeason").value = ep.season;
    document.getElementById("epNumber").value = ep.number;
    document.getElementById("epTitle").value = ep.title || "";
    document.getElementById("epDesc").value = ep.desc || "";
    document.getElementById("epDuration").value = ep.duration || "";
    document.getElementById("epUrl").value = ep.url || "";
    document.getElementById("epThumb").value = ep.thumb || "";
    epThumbPending = null;
    openModal("episodeModal");
  }

  async function saveEpisode(e) {
    e.preventDefault();
    if (!isAdmin) return;
    const idVal = document.getElementById("epId").value;
    const obj = {
      id: idVal ? Number(idVal) : Math.max(0, ...episodes.map((x) => x.id)) + 1,
      season: Number(document.getElementById("epSeason").value),
      number: Number(document.getElementById("epNumber").value),
      title: document.getElementById("epTitle").value.trim(),
      desc: document.getElementById("epDesc").value.trim(),
      duration: Number(document.getElementById("epDuration").value) || null,
      url: normalizeUrl(document.getElementById("epUrl").value),
      thumb: epThumbPending || document.getElementById("epThumb").value.trim() || "",
    };
    if (obj.thumb && !obj.thumb.startsWith("data:")) obj.thumb = normalizeUrl(obj.thumb);
    // data: URLs enormes no van bien a la DB — avisar
    if (obj.thumb && obj.thumb.startsWith("data:") && obj.thumb.length > 200000) {
      toast("Miniatura muy pesada: usá una URL o imagen más chica");
      return;
    }
    const idx = episodes.findIndex((x) => x.id === obj.id);
    if (idx >= 0) episodes[idx] = obj;
    else episodes.push(obj);
    persist();
    const cloud = await cloudSaveEpisode(obj);
    closeModal("episodeModal");
    renderEpisodes();
    updateHomeCounts();
    epThumbPending = null;
    toast(cloud.ok ? "Capítulo guardado (online)" : "Guardado local. Nube: " + (cloud.error || "error"));
  }

  async function deleteEpisode(id) {
    if (!isAdmin || !confirm("¿Eliminar este capítulo?")) return;
    episodes = episodes.filter((e) => e.id !== id);
    persist();
    const cloud = await cloudDeleteEpisode(id);
    renderEpisodes();
    updateHomeCounts();
    toast(cloud.ok ? "Eliminado (online)" : "Eliminado local. Nube: " + (cloud.error || "error"));
  }

  function openSettings() {
    document.getElementById("setSiteName").value = settings.siteName || "";
    document.getElementById("setBadge").value = settings.badgeText || "";
    document.getElementById("setHeroTitle").value = settings.heroTitle || "";
    document.getElementById("setHeroSub").value = settings.heroSubtitle || "";
    document.getElementById("setHeroBg").value = settings.heroBg || "";
    document.getElementById("setS1Color").value = settings.s1Color || "#3eb34f";
    document.getElementById("setS2Color").value = settings.s2Color || "#2a7a94";
    document.getElementById("setAdsEnabled").checked = !!(settings.ads && settings.ads.enabled);
    document.getElementById("adHomeTopCode").value = (settings.ads && settings.ads.homeTop) || "";
    document.getElementById("adHomeBottomCode").value =
      (settings.ads && settings.ads.homeBottom) || "";
    document.getElementById("adPlayerCode").value =
      (settings.ads && settings.ads.playerBelow) || "";
    document.getElementById("setCfBeacon").value = settings.cfBeacon || "";
    openModal("settingsModal");
  }

  function saveSettingsFromForm() {
    if (!isAdmin) return;
    settings.siteName = document.getElementById("setSiteName").value.trim();
    settings.badgeText = document.getElementById("setBadge").value.trim();
    settings.heroTitle = document.getElementById("setHeroTitle").value.trim();
    settings.heroSubtitle = document.getElementById("setHeroSub").value.trim();
    settings.heroBg = document.getElementById("setHeroBg").value.trim();
    settings.s1Color = document.getElementById("setS1Color").value;
    settings.s2Color = document.getElementById("setS2Color").value;
    settings.ads = {
      enabled: document.getElementById("setAdsEnabled").checked,
      homeTop: document.getElementById("adHomeTopCode").value,
      homeBottom: document.getElementById("adHomeBottomCode").value,
      playerBelow: document.getElementById("adPlayerCode").value,
    };
    settings.cfBeacon = document.getElementById("setCfBeacon").value.trim();
    persist();
    applySettings();
    closeModal("settingsModal");
    cloudSaveSettings(settings).then((cloud) => {
      toast(cloud.ok ? "Ajustes guardados (online)" : "Ajustes locales. Nube: " + (cloud.error || "error"));
    });
  }

  function doExport() {
    const blob = new Blob(
      [JSON.stringify({ settings, episodes, comments, watched, continueId }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "simuladores-backup.json";
    a.click();
    toast("Descarga iniciada");
  }

  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (data.settings) settings = Object.assign(defaultSettings(), data.settings);
        if (Array.isArray(data.episodes)) episodes = data.episodes;
        if (data.comments) comments = data.comments;
        if (data.watched) watched = data.watched;
        if (data.continueId !== undefined) continueId = data.continueId;
        persist();
        applySettings();
        renderEpisodes();
        renderContinue();
        toast("Datos importados");
      } catch {
        toast("JSON inválido");
      }
    };
    r.readAsText(file);
  }

  // =========================================================
  // Eventos + init
  // =========================================================
  function bind() {
    document.getElementById("logoHome").addEventListener("click", (e) => {
      e.preventDefault();
      showView("viewHome");
    openFromQuery();
      renderContinue();
    });
    document.getElementById("cardS1").addEventListener("click", () => openSeason(1));
    document.getElementById("cardS2").addEventListener("click", () => openSeason(2));
    document.getElementById("btnSurprise").addEventListener("click", surpriseMe);
    document.getElementById("backHome").addEventListener("click", () => {
      showView("viewHome");
      renderContinue();
    });
    document.getElementById("backFromPlayer").addEventListener("click", () => {
      openSeason(currentSeason || 1);
    });
    document.getElementById("searchInput").addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderEpisodes();
    });
    document.querySelectorAll("[data-continue-play]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (continueId) playEpisode(Number(continueId));
      });
    });
    document.querySelectorAll("[data-continue-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        continueId = null;
        persist();
        renderContinue();
      });
    });
    const fsBtn = document.getElementById("playerFullscreen");
    if (fsBtn) {
      fsBtn.addEventListener("click", () => {
        const wrap = document.getElementById("playerFrame");
        if (wrap && wrap.requestFullscreen) wrap.requestFullscreen();
      });
    }

    document.getElementById("episodesGrid").addEventListener("click", (e) => {
      const t = e.target.closest("[data-play],[data-edit],[data-del],[data-toggle-seen]");
      if (!t) return;
      if (t.dataset.play) playEpisode(Number(t.dataset.play));
      if (t.dataset.edit) openEdit(Number(t.dataset.edit));
      if (t.dataset.del) deleteEpisode(Number(t.dataset.del));
      if (t.dataset.toggleSeen) {
        const id = Number(t.dataset.toggleSeen);
        watched[id] = !watched[id];
        persist();
        renderEpisodes();
      }
    });

    document.getElementById("adminToggleBtn").addEventListener("click", () =>
      openModal("loginModal")
    );
    document.getElementById("btnLogin").addEventListener("click", tryLogin);
    document.getElementById("cancelLogin").addEventListener("click", () =>
      closeModal("loginModal")
    );
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      try {
        const sb = initSupabase();
        if (sb) await sb.auth.signOut();
      } catch (_) {}
      setAdmin(false);
      toast("Saliste del modo admin");
    });
    document.getElementById("settingsBtn").addEventListener("click", openSettings);
    document.getElementById("addEpBtn").addEventListener("click", openAdd);
    document.getElementById("addEpSeasonBtn").addEventListener("click", openAdd);
    document.getElementById("btnSaveSettings").addEventListener("click", saveSettingsFromForm);
    document.getElementById("cancelSettings").addEventListener("click", () =>
      closeModal("settingsModal")
    );
    document.getElementById("episodeForm").addEventListener("submit", saveEpisode);
    document.getElementById("cancelEpisode").addEventListener("click", () =>
      closeModal("episodeModal")
    );
    document.getElementById("exportData").addEventListener("click", doExport);
    document.getElementById("importDataBtn").addEventListener("click", () =>
      document.getElementById("importFile").click()
    );
    document.getElementById("importFile").addEventListener("change", (e) => {
      if (e.target.files[0]) importData(e.target.files[0]);
    });

    const safeClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    };
    safeClick("contactBtn", () => openModal("contactModal"));
    safeClick("creditsBtn", () => openModal("creditsModal"));
    safeClick("legalBtn", () => openModal("legalModal"));
    safeClick("faqBtn", () => openModal("faqModal"));
    safeClick("closeContact", () => closeModal("contactModal"));
    safeClick("closeCredits", () => closeModal("creditsModal"));
    safeClick("closeLegal", () => closeModal("legalModal"));
    safeClick("closeFaq", () => closeModal("faqModal"));

    document.getElementById("commentForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!currentPlayId) return;
      const name = document.getElementById("commentName").value.trim() || "Anónimo";
      const text = document.getElementById("commentText").value.trim();
      if (!text) return;
      if (!comments[currentPlayId]) comments[currentPlayId] = [];
      comments[currentPlayId].push({
        id: Date.now(),
        name,
        text,
        ts: Date.now(),
      });
      persist();
      document.getElementById("commentText").value = "";
      renderComments();
    });
    document.getElementById("commentsList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cid]");
      if (!btn || !isAdmin) return;
      if (!confirm("¿Borrar este comentario?")) return;
      const cid = Number(btn.dataset.cid);
      comments[currentPlayId] = (comments[currentPlayId] || []).filter((c) => c.id !== cid);
      persist();
      renderComments();
    });

    const thumbFile = document.getElementById("epThumbFile");
    if (thumbFile) {
      thumbFile.addEventListener("change", (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 400 * 1024) return toast("Imagen muy grande (máx 400 KB)");
        const r = new FileReader();
        r.onload = () => {
          epThumbPending = r.result;
          toast("Miniatura lista");
        };
        r.readAsDataURL(f);
      });
    }
  }


  function runIntroSplash() {
    const el = document.getElementById("introSplash");
    if (!el) return;
    // Una vez por pestaña/sesión; si ya se vio, saltear
    try {
      if (sessionStorage.getItem("simuladores_intro_seen") === "1") {
        el.classList.add("is-done");
        el.style.display = "none";
        return;
      }
    } catch (_) {}
    const finish = () => {
      el.classList.add("is-done");
      try { sessionStorage.setItem("simuladores_intro_seen", "1"); } catch (_) {}
      setTimeout(() => { el.style.display = "none"; }, 500);
    };
    // Duración total ~1.6s
    setTimeout(finish, 1600);
    el.addEventListener("click", finish, { once: true });
  }


  function openFromQuery() {
    try {
      const q = new URLSearchParams(location.search);
      const s = Number(q.get("s") || q.get("season") || 0);
      const ep = Number(q.get("ep") || q.get("e") || 0);
      if (s === 1 || s === 2) {
        openSeason(s);
        if (ep > 0) {
          const found = episodes.find((x) => Number(x.season) === s && Number(x.number) === ep);
          if (found) setTimeout(() => playEpisode(Number(found.id)), 200);
        }
      }
    } catch (_) {}
  }

  async function init() {
    runIntroSplash();
    loadState();
    await loadEpisodes();
    applySettings();
    bind();
    setupAdminUnlock();
    await restoreAdminSession();
    showView("viewHome");
    renderContinue();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
