"""Spotify-Web-API über die Anmeldung der Spotify-Integration.

Kein eigenes OAuth: Die Spotify-Integration hält Token und Erneuerung, wir
leihen uns ihre OAuth2Session. Abfragen gehen roh an die Web-API — die
spotifyaio-Modelle scheitern an Feldern, die Spotify seit Feb. 2026 nicht
mehr liefert, und die Karte braucht ohnehin nur wenige Felder.

⚠️ Gesperrt (403) für Entwickler-Apps: /browse/*, Top-Songs eines Künstlers,
/playlists/{id}/tracks (→ /items nehmen).
"""

from __future__ import annotations

import asyncio
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import API, LISTE_SEITE, SUCHE_ABRUFE, SUCHE_SEITE


class SpotifyFehler(HomeAssistantError):
    """Antwort mit Fehlerstatus — die Meldung geht so an die Karte."""


def _bild(bilder: list[dict] | None, ziel: int = 300) -> str | None:
    """Das Bild, das am nächsten an `ziel` Pixel Breite liegt."""
    bilder = [b for b in bilder or [] if b and b.get("url")]
    if not bilder:
        return None
    return min(bilder, key=lambda b: abs((b.get("width") or ziel) - ziel))["url"]


def eintrag(o: dict | None, bild: str | None = None) -> dict | None:
    """Spotify-Objekt → schlanker Eintrag für die Karte."""
    if not o or not o.get("uri"):
        return None
    art = o.get("type")
    e: dict[str, Any] = {"uri": o["uri"], "id": o.get("id"), "art": art, "titel": o.get("name") or ""}
    if art == "track":
        e["unter"] = ", ".join(k["name"] for k in o.get("artists") or [])
        e["album"] = (o.get("album") or {}).get("name")
        e["bild"] = _bild((o.get("album") or {}).get("images"), 64) or bild
        e["dauer"] = round((o.get("duration_ms") or 0) / 1000)
        e["explizit"] = bool(o.get("explicit"))
        if o.get("is_playable") is False:
            e["gesperrt"] = True
    elif art == "episode":
        e["unter"] = (o.get("show") or {}).get("name") or o.get("release_date")
        e["bild"] = _bild(o.get("images"), 64) or bild
        e["dauer"] = round((o.get("duration_ms") or 0) / 1000)
        e["datum"] = o.get("release_date")
        e["gehoert"] = (o.get("resume_point") or {}).get("fully_played", False)
    elif art == "album":
        e["unter"] = ", ".join(k["name"] for k in o.get("artists") or [])
        e["jahr"] = (o.get("release_date") or "")[:4]
        e["bild"] = _bild(o.get("images"))
        e["typ"] = o.get("album_type")
    elif art == "artist":
        e["unter"] = "Künstler"
        e["bild"] = _bild(o.get("images"))
    elif art == "playlist":
        e["unter"] = (o.get("owner") or {}).get("display_name")
        e["bild"] = _bild(o.get("images"))
        e["anzahl"] = (o.get("items") or o.get("tracks") or {}).get("total")
    elif art == "show":
        e["unter"] = o.get("publisher")
        e["bild"] = _bild(o.get("images"))
    else:
        return None
    return e


def _ohne_doppelte(eintraege: list[dict | None]) -> list[dict]:
    gesehen: set[str] = set()
    aus = []
    for e in eintraege:
        if e and e["uri"] not in gesehen:
            gesehen.add(e["uri"])
            aus.append(e)
    return aus


class Spotify:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._ich: dict | None = None

    # ---------- Zugang ----------

    def _eintrag(self):
        eintraege = self.hass.config_entries.async_loaded_entries("spotify")
        if not eintraege:
            raise SpotifyFehler("Die Spotify-Integration ist nicht geladen")
        return eintraege[0]

    async def _anfrage(self, methode: str, pfad: str, **kw: Any) -> Any:
        sitzung = self._eintrag().runtime_data.session
        antwort = await sitzung.async_request(methode, API + pfad, **kw)
        if antwort.status == 204:
            return None
        if antwort.status >= 400:
            try:
                text = (await antwort.json())["error"]["message"]
            except Exception:  # kein JSON
                text = await antwort.text()
            raise SpotifyFehler(f"Spotify {antwort.status}: {text}")
        try:
            return await antwort.json()
        except Exception:  # leerer Körper trotz 200
            return None

    async def get(self, pfad: str, **params: Any) -> Any:
        return await self._anfrage("GET", pfad, params={k: v for k, v in params.items() if v is not None})

    async def ich(self) -> dict:
        if self._ich is None:
            self._ich = await self.get("/me")
        return self._ich

    def aktualisieren(self) -> None:
        """Spotify-Entität sofort nachziehen statt in bis zu 30 s."""
        koordinator = self._eintrag().runtime_data.coordinator
        self.hass.async_create_task(koordinator.async_refresh())

    # ---------- Listen ----------

    async def liste(self, art: str, offset: int = 0) -> dict:
        """Bibliothek: {"eintraege": [...], "weiter": offset|None}."""
        if art == "playlists":
            d = await self.get("/me/playlists", limit=LISTE_SEITE, offset=offset)
            eintraege = [eintrag(p) for p in d["items"]]
            if offset == 0:
                ich = await self.ich()
                lieblinge = await self.get("/me/tracks", limit=1)
                eintraege.insert(0, {
                    "uri": f"spotify:user:{ich['id']}:collection", "id": "lieblinge", "art": "lieblinge",
                    "titel": "Lieblingssongs", "unter": f"{lieblinge['total']} Songs", "bild": None,
                })
        elif art == "songs":
            d = await self.get("/me/tracks", limit=LISTE_SEITE, offset=offset)
            eintraege = [eintrag(x["track"]) for x in d["items"]]
        elif art == "alben":
            d = await self.get("/me/albums", limit=LISTE_SEITE, offset=offset)
            eintraege = [eintrag(x["album"]) for x in d["items"]]
        elif art == "podcasts":
            d = await self.get("/me/shows", limit=LISTE_SEITE, offset=offset)
            eintraege = [eintrag(x["show"]) for x in d["items"]]
        elif art == "kuenstler":
            # Gefolgte zuerst, dann die meistgehörten — beides klein, kein Blättern
            gefolgt, top = await asyncio.gather(
                self.get("/me/following", type="artist", limit=LISTE_SEITE),
                self.get("/me/top/artists", limit=LISTE_SEITE),
            )
            eintraege = [eintrag(a) for a in gefolgt["artists"]["items"]] + [eintrag(a) for a in top["items"]]
            return {"eintraege": _ohne_doppelte(eintraege), "weiter": None}
        elif art == "zuletzt":
            d = await self.get("/me/player/recently-played", limit=LISTE_SEITE)
            return {"eintraege": _ohne_doppelte([eintrag(x["track"]) for x in d["items"]]), "weiter": None}
        else:
            raise SpotifyFehler(f"Unbekannte Liste: {art}")
        weiter = offset + LISTE_SEITE if d.get("next") else None
        return {"eintraege": _ohne_doppelte(eintraege), "weiter": weiter}

    async def inhalt(self, uri: str, offset: int = 0) -> dict:
        """Inhalt einer Playlist, eines Albums, Künstlers oder Podcasts."""
        teile = uri.split(":")
        art, kennung = teile[1], teile[-1]
        if uri.endswith(":collection"):
            return await self.liste("songs", offset)
        if art == "playlist":
            d = await self.get(f"/playlists/{kennung}/items", limit=LISTE_SEITE, offset=offset)
            eintraege = [eintrag(x.get("item") or x.get("track")) for x in d["items"]]
            seite = LISTE_SEITE
        elif art == "album":
            d = await self.get(f"/albums/{kennung}/tracks", limit=LISTE_SEITE, offset=offset)
            eintraege = [eintrag(t) for t in d["items"]]
            seite = LISTE_SEITE
        elif art == "artist":
            d = await self.get(f"/artists/{kennung}/albums", include_groups="album,single,compilation",
                               limit=SUCHE_SEITE, offset=offset)
            eintraege = [eintrag(a) for a in d["items"]]
            seite = SUCHE_SEITE
        elif art == "show":
            d = await self.get(f"/shows/{kennung}/episodes", limit=LISTE_SEITE, offset=offset)
            eintraege = [eintrag(e) for e in d["items"]]
            seite = LISTE_SEITE
        else:
            raise SpotifyFehler(f"Kann {art} nicht öffnen")
        # Position im Kontext mitgeben — Sonos springt darüber zum Titel
        aus = []
        for i, e in enumerate(eintraege):
            if e:
                e["platz"] = offset + i
                aus.append(e)
        return {"eintraege": aus, "weiter": offset + seite if d.get("next") else None}

    async def suche(self, begriff: str, typ: str, offset: int = 0) -> dict:
        """„alles" = je 10 pro Art ohne Blättern, sonst 30 je Abruf (3 × 10)."""
        if typ == "alles":
            d = await self.get("/search", q=begriff, type="track,artist,album,playlist,show", limit=SUCHE_SEITE, market="from_token")
            return {
                art: _ohne_doppelte([eintrag(x) for x in (d.get(f"{art}s") or {}).get("items") or []])
                for art in ("track", "artist", "album", "playlist", "show")
            }
        seiten = await asyncio.gather(*(
            self.get("/search", q=begriff, type=typ, limit=SUCHE_SEITE, offset=offset + i * SUCHE_SEITE, market="from_token")
            for i in range(SUCHE_ABRUFE)
        ), return_exceptions=True)
        eintraege: list[dict | None] = []
        weiter: int | None = offset + SUCHE_SEITE * SUCHE_ABRUFE
        for s in seiten:
            if isinstance(s, Exception):
                if not eintraege and s is seiten[0]:
                    raise s
                weiter = None
                break
            teil = s[f"{typ}s"]
            eintraege += [eintrag(x) for x in teil["items"]]
            # ⚠️ „next" ist bei der Suche unzuverlässig (fehlt mitten drin) —
            # erst eine nicht volle Seite heißt wirklich Ende.
            if len(teil["items"]) < SUCHE_SEITE:
                weiter = None
                break
        return {"eintraege": _ohne_doppelte(eintraege), "weiter": weiter}

    # ---------- Geräte und Wiedergabe ----------

    async def geraete(self) -> list[dict]:
        d = await self.get("/me/player/devices")
        return [
            {"id": g["id"], "name": g["name"], "typ": g["type"], "aktiv": g["is_active"],
             "gesperrt": g["is_restricted"], "lautstaerke": g.get("volume_percent")}
            for g in d.get("devices") or [] if g.get("id")
        ]

    async def abspielen(self, geraet: str, kontext: str | None, uri: str | None, uris: list[str] | None, zufall: bool) -> None:
        if zufall is not None:
            try:
                await self._anfrage("PUT", "/me/player/shuffle", params={"state": "true" if zufall else "false", "device_id": geraet})
            except SpotifyFehler:
                pass  # Gerät noch nicht aktiv — Spotify merkt sich Zufall trotzdem meist
        koerper: dict[str, Any] = {}
        if kontext and not kontext.endswith(":collection"):
            koerper["context_uri"] = kontext
            if uri and kontext.split(":")[1] in ("playlist", "album", "show"):
                koerper["offset"] = {"uri": uri}
        elif uris:
            koerper["uris"] = uris
        elif uri:
            koerper["uris"] = [uri]
        try:
            await self._anfrage("PUT", "/me/player/play", params={"device_id": geraet}, json=koerper)
        except SpotifyFehler as err:
            # Schlafende Geräte kennt /play nicht — erst übergeben, dann nochmal
            if "404" not in str(err):
                raise
            await self._anfrage("PUT", "/me/player", json={"device_ids": [geraet], "play": False})
            await asyncio.sleep(1)
            await self._anfrage("PUT", "/me/player/play", params={"device_id": geraet}, json=koerper)
        self.aktualisieren()
