/*
 * Musik-Karte für Home Assistant (Spotify über die Integration „musik").
 *
 *   type: custom:musik-card
 *
 * Holt Bibliothek, Inhalte und Suche über die WebSocket-Befehle musik/*,
 * spielt über musik/abspielen auf Echo (Spotify Connect) oder Sonos.
 * Die Abspielleiste liest die HA-Entität des Ziels: bei Connect-Geräten die
 * Spotify-Entität, bei Sonos den Lautsprecher selbst.
 *
 * ⚠️ Kein Build-Schritt, kein Lit: reines Web Component, Aufbau wie die
 * BetterTube-Karte. hass kommt mehrmals pro Sekunde — gezeichnet wird nur
 * die Leiste neu, Listen bleiben stehen.
 */

const VERSION = "0.1.1";
const REITER = [
  ["zuletzt", "Zuletzt", "M13.5 8H12v5l4.28 2.54.72-1.21-3.5-2.08V8M13 3a9 9 0 0 0-9 9H1l3.96 4.03L9 12H6a7 7 0 1 1 7 7 6.9 6.9 0 0 1-4.95-2.05l-1.41 1.42A9 9 0 1 0 13 3"],
  ["playlists", "Playlists", "M15 6H3v2h12zm0 4H3v2h12zM3 16h8v-2H3zM17 6v8.18A3 3 0 0 0 16 14a3 3 0 1 0 3 3V8h3V6z"],
  ["songs", "Songs", "m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"],
  ["alben", "Alben", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5m0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1"],
  ["kuenstler", "Künstler", "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4"],
  ["podcasts", "Podcasts", "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3m5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72z"],
  ["suche", "Suche", "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"],
];
const SUCHARTEN = [["alles", "Alles"], ["track", "Songs"], ["artist", "Künstler"], ["album", "Alben"], ["playlist", "Playlists"], ["show", "Podcasts"]];
const ABSCHNITTE = [["track", "Songs"], ["artist", "Künstler"], ["album", "Alben"], ["playlist", "Playlists"], ["show", "Podcasts"]];

const svg = (pfad, gr = 20) =>
  `<svg viewBox="0 0 24 24" width="${gr}" height="${gr}" aria-hidden="true"><path fill="currentColor" d="${pfad}"/></svg>`;
const ICON = {
  marke: "M12 3v10.55A4 4 0 1 0 14 17V7h4V3z",
  play: "M8 5v14l11-7z",
  pause: "M6 19h4V5H6zm8-14v14h4V5z",
  zurueck: "M6 6h2v12H6zm3.5 6 8.5 6V6z",
  vor: "M6 18l8.5-6L6 6zM16 6v12h2V6z",
  zufall: "M10.59 9.17 5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04z",
  neu: "M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z",
  links: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z",
  laut: "M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02",
  echo: "M12 2C8.13 2 5 3.34 5 5v14c0 1.66 3.13 3 7 3s7-1.34 7-3V5c0-1.66-3.13-3-7-3m0 2c2.76 0 4.5.82 4.97 1-.47.18-2.21 1-4.97 1S7.5 5.18 7.03 5c.47-.18 2.21-1 4.97-1",
  lautsprecher: "M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 1.99 2 1.99L17 22c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-5 2c1.1 0 2 .9 2 2s-.9 2-2 2a2 2 0 1 1 0-4m0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3",
  geraet: "M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1m-1 9h-4v-7h4z",
  herz: "m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z",
};
const KACHELARTEN = new Set(["playlist", "album", "artist", "show", "lieblinge"]);

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);

function dauerText(s) {
  s = Math.round(s || 0);
  if (s <= 0) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sek = s % 60;
  return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(sek).padStart(2, "0")}`;
}

function merke(k, w) { try { localStorage.setItem(`musik.${k}`, w); } catch (_) { /* privat */ } }
function lies(k) { try { return localStorage.getItem(`musik.${k}`); } catch (_) { return null; } }

class MusikCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._reiter = lies("reiter") || "playlists";
    this._ziel = lies("ziel") || null;
    this._suche = lies("suche") || "";
    this._suchart = lies("suchart") || "alles";
    this._stapel = []; // geöffnete Playlists/Alben/Künstler, oberstes = sichtbar
    this._cache = {};
    this._geraeteListe = [];
  }

  getCardSize() { return 12; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  static getStubConfig() { return {}; }

  set hass(hass) {
    const erstes = !this._hass;
    this._hass = hass;
    if (erstes) {
      this._aufbauen();
      this._geraeteLaden();
      this._laden();
    }
    this._leisteZeichnen();
  }

  // ---------- Geräte ----------

  async _geraeteLaden() {
    try {
      const d = await this._hass.callWS({ type: "musik/geraete" });
      this._geraeteListe = d.geraete || [];
      this._spotify = d.spotify;
    } catch (err) {
      this._melden(`Geräte: ${err.message || err}`, 5000, true);
    }
    this._geraeteZeichnen();
    this._leisteZeichnen(true);
  }

  _zielGeraet() {
    const g = this._geraeteListe;
    let z = g.find((x) => x.id === this._ziel);
    if (!z && this._ziel) {
      // Connect-Kennungen ändern sich nicht, aber ein schlafendes Gerät fehlt
      // in der Liste — dann trotzdem anzeigen statt still umzuschalten.
      const name = lies("zielname");
      if (name) z = { id: this._ziel, name, art: this._ziel.startsWith("entity:") ? "sonos" : "speaker", weg: true, entitaet: this._ziel.startsWith("entity:") ? this._ziel.slice(7) : this._spotify };
    }
    if (!z) z = g.find((x) => x.aktiv) || g[0];
    if (z) this._ziel = z.id;
    return z;
  }

  _geraeteZeichnen() {
    const el = this.shadowRoot.getElementById("geraete");
    const ziel = this._zielGeraet();
    const liste = [...this._geraeteListe];
    if (ziel?.weg) liste.push(ziel);
    el.innerHTML = liste.map((g) => {
      const st = g.entitaet && this._hass.states[g.entitaet];
      const spielt = g.art === "sonos" ? st?.state === "playing" : g.aktiv && st?.state === "playing";
      const icon = g.art === "sonos" ? ICON.lautsprecher : /speaker/.test(g.art) ? ICON.echo : ICON.geraet;
      return `<button data-ziel="${esc(g.id)}" data-name="${esc(g.name)}" class="${g.id === ziel?.id ? "an" : ""} ${g.weg ? "weg" : ""}" title="${esc(g.name)}${g.weg ? " (gerade nicht erreichbar)" : ""}">
        ${svg(icon, 18)}<span>${esc(g.name)}</span>${spielt ? '<i class="punkt"></i>' : ""}</button>`;
    }).join("") + `<button class="auffrischen" id="geraeteNeu" title="Geräte neu suchen">${svg(ICON.neu, 18)}</button>`;
  }

  // ---------- Aufbau ----------

  _aufbauen() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>${STIL}</style>
      <ha-card>
        <div class="kopf">
          <div class="marke">${svg(ICON.marke, 26)}<span>Musik</span></div>
          <div class="geraete" id="geraete"></div>
        </div>
        <div class="leiste" id="leiste" hidden></div>
        <nav class="reiter" id="reiter">
          ${REITER.map(([k, t, p]) => `<button data-reiter="${k}" title="${t}" aria-label="${t}" class="${k === this._reiter ? "an" : ""}">${svg(p, 18)}<span>${t}</span></button>`).join("")}
          <button class="neu-laden" id="neuLaden" title="Neu laden">${svg(ICON.neu, 18)}</button>
        </nav>
        <div id="suchbereich" ${this._reiter === "suche" ? "" : "hidden"}>
          <form class="suchfeld" id="suchfeld">
            <input id="suchtext" type="search" placeholder="Songs, Künstler, Alben, Podcasts …" value="${esc(this._suche)}" autocomplete="off">
            <button type="submit">${svg(REITER[6][2], 20)}</button>
          </form>
          <div class="chips" id="sucharten">${SUCHARTEN.map(([k, t]) => `<button data-art="${k}" class="${k === this._suchart ? "an" : ""}">${t}</button>`).join("")}</div>
        </div>
        <div class="inhalt" id="inhalt"></div>
        <div class="meldung" id="meldung"></div>
      </ha-card>`;
    const $ = (id) => this.shadowRoot.getElementById(id);
    $("reiter").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-reiter]");
      if (!b) return;
      this._reiter = b.dataset.reiter;
      this._stapel = [];
      merke("reiter", this._reiter);
      this.shadowRoot.querySelectorAll("#reiter button[data-reiter]").forEach((x) => x.classList.toggle("an", x === b));
      $("suchbereich").hidden = this._reiter !== "suche";
      if (this._reiter === "suche") $("suchtext").focus();
      this._laden();
    });
    $("neuLaden").addEventListener("click", () => {
      delete this._cache[this._schluessel()];
      this._laden();
      this._geraeteLaden();
    });
    $("suchfeld").addEventListener("submit", (e) => {
      e.preventDefault();
      this._suche = $("suchtext").value.trim();
      merke("suche", this._suche);
      this._stapel = [];
      $("suchtext").blur(); // Tastatur am Handy weg
      this._laden();
    });
    $("sucharten").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-art]");
      if (b) this._suchartSetzen(b.dataset.art);
    });
    $("geraete").addEventListener("click", (e) => {
      if (e.target.closest("#geraeteNeu")) return this._geraeteLaden();
      const b = e.target.closest("button[data-ziel]");
      if (!b) return;
      this._ziel = b.dataset.ziel;
      merke("ziel", this._ziel);
      merke("zielname", b.dataset.name);
      this._geraeteZeichnen();
      this._leisteZeichnen(true);
    });
    $("inhalt").addEventListener("click", (e) => this._inhaltKlick(e));
    $("leiste").addEventListener("click", (e) => this._leisteKlick(e));
    $("leiste").addEventListener("change", (e) => {
      if (e.target.id === "lautstaerke") {
        this._hass.callService("media_player", "volume_set", { entity_id: this._leisteEntitaet(), volume_level: Number(e.target.value) / 100 });
      }
    });
    this._uhr = setInterval(() => this._leisteZeichnen(), 1000);
  }

  disconnectedCallback() { clearInterval(this._uhr); this._uhr = null; }
  connectedCallback() { if (this._hass && !this._uhr && this.shadowRoot) this._uhr = setInterval(() => this._leisteZeichnen(), 1000); }

  _suchartSetzen(art) {
    this._suchart = art;
    merke("suchart", art);
    this._stapel = [];
    this.shadowRoot.querySelectorAll("#sucharten button").forEach((x) => x.classList.toggle("an", x.dataset.art === art));
    this._laden();
  }

  // ---------- Abspielleiste ----------

  _leisteEntitaet() {
    return this._zielGeraet()?.entitaet || this._spotify;
  }

  _leisteZeichnen(erzwingen = false) {
    const el = this.shadowRoot?.getElementById("leiste");
    if (!el || !this._hass) return;
    const eid = this._leisteEntitaet();
    const st = eid && this._hass.states[eid];
    const ziel = this._zielGeraet();
    const a = st?.attributes || {};
    // Bei Connect-Zielen zeigt die Spotify-Entität, was IRGENDWO läuft —
    // die Leiste nur, wenn es auf diesem Gerät läuft.
    const passt = ziel?.art === "sonos" || !a.source || a.source === ziel?.name;
    const aktiv = st && ["playing", "paused", "buffering"].includes(st.state) && passt;
    el.hidden = !aktiv;
    if (!aktiv) { this._leisteKennung = null; return; }
    let pos = a.media_position || 0;
    if (st.state === "playing" && a.media_position_updated_at) pos += (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000;
    const dauer = a.media_duration || 0;
    pos = Math.max(0, dauer ? Math.min(pos, dauer) : pos);
    const kennung = [eid, st.state, a.media_title, a.entity_picture, a.shuffle, Math.round((a.volume_level || 0) * 100)].join("|");
    if (erzwingen || kennung !== this._leisteKennung) {
      this._leisteKennung = kennung;
      const bild = a.entity_picture ? `<img src="${esc(a.entity_picture)}" alt="">` : `<div class="leer">${svg(ICON.marke, 28)}</div>`;
      el.innerHTML = `
        ${bild}
        <div class="was">
          <div class="t">${esc(a.media_title || "Unbekannt")}</div>
          <div class="k">${esc([a.media_artist, a.source ? `auf ${a.source}` : `auf ${a.friendly_name || eid}`].filter(Boolean).join(" · "))}</div>
          <div class="fort"><span id="zeitL"></span><div class="balken"><i id="balken"></i></div><span id="zeitR"></span></div>
        </div>
        <div class="knoepfe">
          ${"shuffle" in a ? `<button data-aktion="zufall" class="klein ${a.shuffle ? "an" : ""}" title="Zufall">${svg(ICON.zufall, 18)}</button>` : ""}
          <button data-aktion="zurueck" title="Zurück">${svg(ICON.zurueck)}</button>
          <button data-aktion="spielpause" class="gross" title="Abspielen/Pause">${svg(st.state === "playing" ? ICON.pause : ICON.play, 28)}</button>
          <button data-aktion="vor" title="Weiter">${svg(ICON.vor)}</button>
        </div>
        ${"volume_level" in a ? `<label class="laut">${svg(ICON.laut, 18)}<input id="lautstaerke" type="range" min="0" max="100" value="${Math.round(a.volume_level * 100)}"></label>` : ""}`;
      const balken = el.querySelector(".fort .balken");
      balken.addEventListener("click", (e) => {
        const d = this._hass.states[eid]?.attributes.media_duration;
        if (!d) return;
        const r = balken.getBoundingClientRect();
        this._hass.callService("media_player", "media_seek", { entity_id: eid, seek_position: ((e.clientX - r.left) / r.width) * d });
      });
    }
    const b = this.shadowRoot.getElementById("balken");
    if (b) b.style.width = `${dauer ? (pos / dauer) * 100 : 0}%`;
    this.shadowRoot.getElementById("zeitL").textContent = dauerText(pos) || "0:00";
    this.shadowRoot.getElementById("zeitR").textContent = dauerText(dauer);
  }

  _leisteKlick(e) {
    const b = e.target.closest("button[data-aktion]");
    if (!b) return;
    const eid = this._leisteEntitaet();
    const id = { entity_id: eid };
    switch (b.dataset.aktion) {
      case "spielpause": return this._hass.callService("media_player", "media_play_pause", id);
      case "zurueck": return this._hass.callService("media_player", "media_previous_track", id);
      case "vor": return this._hass.callService("media_player", "media_next_track", id);
      case "zufall": return this._hass.callService("media_player", "shuffle_set", { ...id, shuffle: !this._hass.states[eid]?.attributes.shuffle });
    }
  }

  // ---------- Listen ----------

  _oben() { return this._stapel[this._stapel.length - 1]; }

  _schluessel() {
    const o = this._oben();
    if (o) return `inhalt:${o.uri}`;
    if (this._reiter === "suche") return `suche:${this._suchart}:${this._suche}`;
    return `liste:${this._reiter}`;
  }

  _anfrage(offset = 0) {
    const o = this._oben();
    if (o) return { type: "musik/inhalt", uri: o.uri, offset };
    if (this._reiter === "suche") return { type: "musik/suche", q: this._suche, typ: this._suchart, offset };
    return { type: "musik/liste", art: this._reiter, offset };
  }

  async _laden() {
    const inhalt = this.shadowRoot.getElementById("inhalt");
    const schluessel = this._schluessel();
    this._beobachter?.disconnect();
    if (this._reiter === "suche" && !this._oben() && !this._suche) {
      inhalt.innerHTML = `<div class="hinweis">Wonach suchst du?</div>`;
      return;
    }
    if (!this._cache[schluessel]) {
      inhalt.innerHTML = `${this._kopfHtml()}<div class="laedt"><i></i><i></i><i></i></div>`;
      try {
        this._cache[schluessel] = await this._hass.callWS(this._anfrage());
      } catch (err) {
        if (schluessel === this._schluessel()) inhalt.innerHTML = `${this._kopfHtml()}<div class="hinweis fehler">Laden fehlgeschlagen: ${esc(err.message || err)}</div>`;
        return;
      }
    }
    if (schluessel !== this._schluessel()) return;
    const d = this._cache[schluessel];
    if (!d.eintraege) return this._allesZeichnen(d);
    this._eintraege = d.eintraege;
    if (!d.eintraege.length) {
      inhalt.innerHTML = `${this._kopfHtml()}<div class="hinweis">Nichts gefunden.</div>`;
      return;
    }
    inhalt.innerHTML = `${this._kopfHtml()}${this._listeHtml(d.eintraege)}${d.weiter != null ? `<div class="mehr" id="mehr"><button>Mehr anzeigen</button></div>` : ""}`;
    if (d.weiter != null) this._mehrBeobachten(schluessel);
  }

  /** Kopf einer geöffneten Playlist/eines Albums: Bild, Name, Abspielen, Zufall. */
  _kopfHtml() {
    const o = this._oben();
    if (!o) return "";
    const rund = o.art === "artist" ? "rund" : "";
    const art = { playlist: "Playlist", album: o.typ === "single" ? "Single" : "Album", artist: "Künstler", show: "Podcast", lieblinge: "Playlist" }[o.art] || "";
    return `<div class="detail">
      <button class="zurueckpfeil" data-aktion="zurueck" title="Zurück">${svg(ICON.links, 22)}</button>
      ${this._bildHtml(o, `cover ${rund}`)}
      <div class="detail-text">
        <div class="klein">${esc(art)}</div>
        <h2>${esc(o.titel)}</h2>
        <div class="unter">${esc([o.unter, o.jahr].filter(Boolean).join(" · "))}</div>
        <div class="detail-knoepfe">
          <button class="spielen" data-aktion="kontext">${svg(ICON.play, 22)}<span>Abspielen</span></button>
          <button class="zweit" data-aktion="kontext-zufall">${svg(ICON.zufall, 20)}<span>Zufall</span></button>
        </div>
      </div>
    </div>`;
  }

  _bildHtml(e, klasse = "") {
    if (e.art === "lieblinge") return `<div class="bildchen lieblinge ${klasse}">${svg(ICON.herz, 40)}</div>`;
    return e.bild
      ? `<img class="bildchen ${klasse}" loading="lazy" src="${esc(e.bild)}" alt="">`
      : `<div class="bildchen leer ${klasse}">${svg(ICON.marke, 32)}</div>`;
  }

  _listeHtml(eintraege) {
    // Gemischte Listen gibt es nicht: entweder Kacheln oder Titelzeilen
    if (KACHELARTEN.has(eintraege[0]?.art)) return `<div class="raster" id="ziel">${eintraege.map((e) => this._kachel(e)).join("")}</div>`;
    return `<div class="titelliste" id="ziel">${eintraege.map((e) => this._zeile(e)).join("")}</div>`;
  }

  _kachel(e) {
    return `<div class="kachel" data-uri="${esc(e.uri)}" tabindex="0" role="button">
      <div class="kachelbild">${this._bildHtml(e, e.art === "artist" ? "rund" : "")}
        <button class="los" data-spielen="${esc(e.uri)}" title="Abspielen">${svg(ICON.play, 26)}</button></div>
      <div class="titel">${esc(e.titel)}</div>
      <div class="meta">${esc([e.unter, e.jahr].filter(Boolean).join(" · "))}</div>
    </div>`;
  }

  _zeile(e) {
    const laeuft = this._laeuft(e);
    // Albumtitel bringen kein eigenes Bild mit — dann das Cover des Albums
    const bild = e.bild || this._oben()?.bild;
    return `<button class="zeile ${e.gesperrt ? "gesperrt" : ""} ${laeuft ? "laeuft" : ""}" data-titel="${esc(e.uri)}">
      ${this._bildHtml({ ...e, bild })}
      <div class="zeile-text">
        <div class="titel">${esc(e.titel)}</div>
        <div class="meta">${e.explizit ? '<b class="e">E</b>' : ""}${esc([e.unter, this._oben()?.art === "album" ? "" : e.album].filter(Boolean).join(" · "))}</div>
      </div>
      <span class="dauer">${dauerText(e.dauer)}</span>
    </button>`;
  }

  _laeuft(e) {
    const st = this._hass.states[this._leisteEntitaet()];
    return st && ["playing", "paused"].includes(st.state) && st.attributes.media_title === e.titel;
  }

  _allesZeichnen(d) {
    const inhalt = this.shadowRoot.getElementById("inhalt");
    this._eintraege = ABSCHNITTE.flatMap(([art]) => d[art] || []);
    const teile = ABSCHNITTE.filter(([art]) => d[art]?.length).map(([art, name]) => {
      const liste = art === "track" ? d[art].slice(0, 6) : d[art];
      const html = art === "track"
        ? `<div class="titelliste">${liste.map((e) => this._zeile(e)).join("")}</div>`
        : `<div class="reihe">${liste.map((e) => this._kachel(e)).join("")}</div>`;
      return `<section><div class="abschnitt"><h3>${name}</h3><button data-alle="${art}">Alle anzeigen</button></div>${html}</section>`;
    });
    inhalt.innerHTML = teile.join("") || `<div class="hinweis">Nichts gefunden.</div>`;
  }

  _mehrBeobachten(schluessel) {
    const anker = this.shadowRoot.getElementById("mehr");
    const ziel = this.shadowRoot.getElementById("ziel");
    const laden = async () => {
      const d = this._cache[schluessel];
      if (this._laedtMehr || schluessel !== this._schluessel() || d.weiter == null) return;
      this._laedtMehr = true;
      anker.innerHTML = `<div class="laedt"><i></i><i></i><i></i></div>`;
      try {
        const neu = await this._hass.callWS(this._anfrage(d.weiter));
        const bekannt = new Set(d.eintraege.map((e) => e.uri));
        const frisch = neu.eintraege.filter((e) => !bekannt.has(e.uri));
        d.eintraege.push(...frisch);
        d.weiter = frisch.length ? neu.weiter : null;
        if (schluessel === this._schluessel()) {
          ziel.insertAdjacentHTML("beforeend", frisch.map((e) => (KACHELARTEN.has(e.art) ? this._kachel(e) : this._zeile(e))).join(""));
        }
      } catch (err) {
        d.weiter = null;
        this._melden(`Weitere: ${err.message || err}`, 5000, true);
      } finally {
        this._laedtMehr = false;
      }
      if (d.weiter == null) { this._beobachter?.disconnect(); anker.remove(); }
      else anker.innerHTML = `<button>Mehr anzeigen</button>`;
    };
    anker.addEventListener("click", (e) => { if (e.target.closest("button")) laden(); });
    this._beobachter = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) laden(); }, { rootMargin: "600px" });
    this._beobachter.observe(anker);
  }

  _finde(uri) {
    return (this._eintraege || []).find((e) => e.uri === uri) || (this._oben()?.uri === uri ? this._oben() : null);
  }

  _inhaltKlick(e) {
    const aktion = e.target.closest("[data-aktion]")?.dataset.aktion;
    if (aktion === "zurueck") { this._stapel.pop(); return this._laden(); }
    if (aktion === "kontext" || aktion === "kontext-zufall") return this._kontextSpielen(this._oben(), aktion === "kontext-zufall");
    const alle = e.target.closest("[data-alle]");
    if (alle) return this._suchartSetzen(alle.dataset.alle);
    const spielen = e.target.closest("[data-spielen]");
    if (spielen) return this._kontextSpielen(this._finde(spielen.dataset.spielen), false);
    const kachel = e.target.closest("[data-uri]");
    if (kachel) {
      const eintrag = this._finde(kachel.dataset.uri);
      if (eintrag) { this._stapel.push(eintrag); this._laden(); this.scrollIntoView?.({ block: "start", behavior: "smooth" }); }
      return;
    }
    const zeile = e.target.closest("[data-titel]");
    if (zeile) this._titelSpielen(this._finde(zeile.dataset.titel));
  }

  // ---------- Abspielen ----------

  _kontextSpielen(eintrag, zufall) {
    if (!eintrag) return;
    if (eintrag.art === "lieblinge") {
      // Kein Kontext-Link für Lieblingssongs — die geladenen Titel schicken
      const titel = (this._cache[`inhalt:${eintrag.uri}`]?.eintraege || []).map((x) => x.uri);
      if (!titel.length) return this._melden("Erst öffnen, dann abspielen", 3000);
      return this._spielen({ uris: zufall ? mische(titel).slice(0, 50) : titel.slice(0, 50), zufall }, eintrag.titel);
    }
    return this._spielen({ kontext: eintrag.uri, zufall }, eintrag.titel);
  }

  _titelSpielen(e) {
    if (!e || e.gesperrt) return;
    const o = this._oben();
    if (o && o.art !== "lieblinge" && o.art !== "artist") {
      return this._spielen({ kontext: o.uri, uri: e.uri, platz: e.platz }, e.titel);
    }
    // Lose Titel (Songs, Zuletzt, Suche): ab diesem Titel weiter durch die Liste
    const liste = (this._eintraege || []).filter((x) => x.art === e.art && !x.gesperrt);
    const ab = liste.findIndex((x) => x.uri === e.uri);
    const uris = (this._reiter === "suche" && !o ? [e] : liste.slice(ab, ab + 50)).map((x) => x.uri);
    return this._spielen({ uri: e.uri, uris }, e.titel);
  }

  async _spielen(auftrag, titel) {
    const ziel = this._zielGeraet();
    if (!ziel) return this._melden("Kein Gerät gefunden — Spotify-App einmal auf einem Gerät öffnen", 6000, true);
    this._melden(`Starte „${titel}“ auf ${ziel.name} …`);
    try {
      await this._hass.callWS({ type: "musik/abspielen", ziel: ziel.id, ...auftrag });
      this._melden(`Läuft auf ${ziel.name}`, 2500);
      setTimeout(() => this._geraeteLaden(), 2500);
    } catch (err) {
      this._melden(`Fehler: ${err.message || err}`, 7000, true);
    }
  }

  _melden(text, ms = 0, fehler = false) {
    const el = this.shadowRoot.getElementById("meldung");
    clearTimeout(this._meldungUhr);
    el.textContent = text;
    el.classList.toggle("sichtbar", !!text);
    el.classList.toggle("fehler", fehler);
    if (ms) this._meldungUhr = setTimeout(() => el.classList.remove("sichtbar"), ms);
  }
}

function mische(liste) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STIL = `
  :host { --m-gruen: #1db954; --m-rund: var(--ha-card-border-radius, 12px); display: block; }
  ha-card { padding: 16px; overflow: hidden; }
  [hidden] { display: none !important; }
  button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
  .kopf { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 12px; }
  .marke { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 600; color: var(--primary-text-color); margin-right: auto; }
  .marke svg { color: var(--m-gruen); }
  .geraete { display: flex; flex-wrap: wrap; gap: 6px; }
  .geraete button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 18px;
    background: var(--secondary-background-color); color: var(--secondary-text-color); font-size: 13px; }
  .geraete button.an { background: var(--m-gruen); color: #fff; }
  .geraete button.weg { opacity: .5; }
  .geraete button.auffrischen { padding: 6px 8px; }
  .geraete .punkt { width: 7px; height: 7px; border-radius: 50%; background: var(--m-gruen); }
  .geraete button.an .punkt { background: #fff; }

  .leiste { display: grid; grid-template-columns: 72px 1fr auto auto; align-items: center; gap: 14px;
    padding: 10px; margin-bottom: 14px; border-radius: var(--m-rund); background: var(--secondary-background-color); }
  .leiste img, .leiste .leer { width: 72px; height: 72px; object-fit: cover; border-radius: 6px; background: #000; display: grid; place-items: center; color: var(--m-gruen); }
  .leiste .was { min-width: 0; }
  .leiste .t { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .leiste .k { font-size: 13px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fort { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
  .fort .balken { flex: 1; height: 6px; border-radius: 3px; background: var(--divider-color); cursor: pointer; overflow: hidden; }
  .fort .balken i { display: block; height: 100%; width: 0; background: var(--m-gruen); }
  .knoepfe { display: flex; align-items: center; gap: 4px; }
  .knoepfe button { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; }
  .knoepfe button:hover { background: var(--divider-color); }
  .knoepfe .klein { color: var(--secondary-text-color); }
  .knoepfe .klein.an { color: var(--m-gruen); }
  .knoepfe .gross { width: 52px; height: 52px; background: var(--m-gruen); color: #fff; }
  .knoepfe .gross:hover { background: var(--m-gruen); filter: brightness(1.1); }
  .laut { display: flex; align-items: center; gap: 6px; color: var(--secondary-text-color); }
  .laut input { width: 110px; accent-color: var(--m-gruen); }

  .reiter { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--divider-color); margin-bottom: 14px; }
  .reiter button { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; white-space: nowrap;
    color: var(--secondary-text-color); border-bottom: 3px solid transparent; font-weight: 500; }
  .reiter button.an { color: var(--primary-text-color); border-bottom-color: var(--m-gruen); }
  .reiter .neu-laden { margin-left: auto; }

  .suchfeld { display: flex; gap: 8px; margin-bottom: 10px; }
  .suchfeld input { flex: 1; min-width: 0; padding: 10px 14px; border-radius: 22px; font: inherit;
    border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); }
  .suchfeld button { width: 44px; border-radius: 22px; background: var(--secondary-background-color); display: grid; place-items: center; }
  .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin-bottom: 14px; }
  .chips button { padding: 6px 14px; border-radius: 16px; background: var(--secondary-background-color); font-size: 13px; white-space: nowrap; }
  .chips button.an { background: var(--primary-text-color); color: var(--card-background-color); }

  .detail { display: flex; align-items: flex-end; gap: 18px; margin-bottom: 18px; position: relative; }
  .detail .zurueckpfeil { position: absolute; left: -4px; top: -4px; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
    background: rgba(0,0,0,.55); color: #fff; z-index: 1; }
  .detail .cover { width: 180px; height: 180px; flex: none; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
  .detail .cover.rund { border-radius: 50%; }
  .detail-text { min-width: 0; }
  .detail-text .klein { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--secondary-text-color); }
  .detail-text h2 { margin: 4px 0; font-size: 28px; line-height: 1.15; color: var(--primary-text-color);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .detail-text .unter { color: var(--secondary-text-color); font-size: 14px; }
  .detail-knoepfe { display: flex; gap: 10px; margin-top: 14px; }
  .detail-knoepfe button { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 24px; font-weight: 600; }
  .detail-knoepfe .spielen { background: var(--m-gruen); color: #fff; }
  .detail-knoepfe .zweit { background: var(--secondary-background-color); }

  .bildchen { display: block; object-fit: cover; background: var(--secondary-background-color); }
  .bildchen.leer, .bildchen.lieblinge { display: grid; place-items: center; color: var(--secondary-text-color); }
  .bildchen.lieblinge { background: linear-gradient(135deg, #450af5, #8e8ee5); color: #fff; }
  .rund { border-radius: 50% !important; }

  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px 14px; }
  .reihe { display: grid; grid-auto-flow: column; grid-auto-columns: 160px; gap: 14px; overflow-x: auto; scrollbar-width: thin; padding-bottom: 6px; }
  .kachel { display: flex; flex-direction: column; gap: 6px; min-width: 0; cursor: pointer; padding: 8px; margin: -8px; border-radius: 10px; }
  .kachel:hover { background: var(--secondary-background-color); }
  .kachelbild { position: relative; aspect-ratio: 1; }
  /* absolut: sonst dehnt ein hochformatiges Bild die quadratische Box */
  .kachelbild .bildchen { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 8px; }
  .kachel .los { position: absolute; right: 8px; bottom: 8px; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
    background: var(--m-gruen); color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,.35); opacity: 0; transform: translateY(6px); transition: all .15s; }
  .kachel:hover .los, .kachel:focus-within .los { opacity: 1; transform: none; }
  @media (hover: none) { .kachel .los { opacity: 1; transform: none; width: 38px; height: 38px; } }
  .titel { font-weight: 600; font-size: 14px; line-height: 1.35; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { font-size: 12.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta .e { display: inline-block; font-size: 10px; padding: 0 4px; margin-right: 5px; border-radius: 2px; background: var(--secondary-text-color); color: var(--card-background-color); }

  .titelliste { display: flex; flex-direction: column; }
  .zeile { display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: 12px; padding: 6px 8px; border-radius: 6px; text-align: left; }
  .zeile:hover { background: var(--secondary-background-color); }
  .zeile .bildchen { width: 48px; height: 48px; border-radius: 4px; }
  .zeile-text { min-width: 0; }
  .zeile.laeuft .titel { color: var(--m-gruen); }
  .zeile.gesperrt { opacity: .4; cursor: default; }
  .zeile .dauer { font-size: 13px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }

  section { margin-bottom: 22px; }
  .abschnitt { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
  .abschnitt h3 { margin: 0; font-size: 18px; color: var(--primary-text-color); }
  .abschnitt button { font-size: 13px; font-weight: 600; color: var(--secondary-text-color); }
  .abschnitt button:hover { text-decoration: underline; }

  .mehr { display: flex; justify-content: center; padding: 20px 0 4px; }
  .mehr button { padding: 8px 18px; border-radius: 18px; background: var(--secondary-background-color); color: var(--primary-text-color); }
  .hinweis { padding: 40px 12px; text-align: center; color: var(--secondary-text-color); }
  .hinweis.fehler { color: var(--error-color, #db4437); }
  .laedt { display: flex; justify-content: center; gap: 8px; padding: 48px 0; }
  .laedt i { width: 10px; height: 10px; border-radius: 50%; background: var(--m-gruen); animation: puls 1s infinite ease-in-out; }
  .laedt i:nth-child(2) { animation-delay: .15s; } .laedt i:nth-child(3) { animation-delay: .3s; }
  @keyframes puls { 0%, 80%, 100% { transform: scale(.5); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }

  .meldung { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none;
    padding: 10px 18px; border-radius: 8px; background: #323232; color: #fff; font-size: 14px; transition: all .2s; z-index: 10; max-width: 90vw; }
  .meldung.sichtbar { opacity: 1; transform: translate(-50%, 0); }
  .meldung.fehler { background: var(--error-color, #db4437); }

  @media (max-width: 600px) {
    ha-card { padding: 12px; }
    .kopf { flex-direction: column; align-items: stretch; }
    .geraete { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin: 0 -12px; padding: 0 12px; }
    .geraete button { flex: none; }
    .leiste { grid-template-columns: 56px 1fr; }
    .leiste img, .leiste .leer { width: 56px; height: 56px; }
    .knoepfe { grid-column: 1 / -1; justify-content: center; }
    .laut { grid-column: 1 / -1; justify-content: center; }
    .raster { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 14px 10px; }
    .reihe { grid-auto-columns: 130px; }
    .detail { flex-direction: column; align-items: center; text-align: center; }
    .detail .cover { width: 200px; height: 200px; }
    .detail-knoepfe { justify-content: center; }
    .detail-text h2 { font-size: 22px; }
    .reiter button span { display: none; }
    .reiter button.an span { display: inline; }
  }
`;

customElements.define("musik-card", MusikCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "musik-card", name: "Musik", description: "Spotify: Bibliothek, Suche, Abspielen auf Echo und Sonos." });
console.info(`%c Musik-Karte ${VERSION} `, "background:#1db954;color:#fff;border-radius:3px");
