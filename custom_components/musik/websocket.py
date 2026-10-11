"""WebSocket-Befehle für die Dashboard-Karte (musik-card.js)."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er

from .const import CONNECT, DOMAIN, ENTITAET
from .spotify import Spotify, SpotifyFehler

_LOGGER = logging.getLogger(__name__)

LISTEN = ["playlists", "songs", "alben", "kuenstler", "podcasts", "zuletzt"]
SUCHARTEN = ["alles", "track", "artist", "album", "playlist", "show"]


@callback
def anmelden(hass: HomeAssistant) -> None:
    for befehl in (ws_liste, ws_inhalt, ws_suche, ws_geraete, ws_abspielen):
        websocket_api.async_register_command(hass, befehl)


def _befehl(funktion):
    """Gemeinsames Gerüst: Spotify holen, Fehler verständlich an die Karte."""

    async def huelle(hass: HomeAssistant, conn: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
        sp: Spotify | None = hass.data.get(DOMAIN)
        if sp is None:
            conn.send_error(msg["id"], "nicht_eingerichtet", "Musik ist nicht eingerichtet")
            return
        try:
            conn.send_result(msg["id"], await funktion(hass, sp, msg))
        except SpotifyFehler as err:
            conn.send_error(msg["id"], "spotify", str(err))
        except Exception as err:
            _LOGGER.exception("Musik: %s fehlgeschlagen", msg["type"])
            conn.send_error(msg["id"], "fehler", str(err))

    return huelle


@websocket_api.websocket_command(
    {vol.Required("type"): "musik/liste", vol.Required("art"): vol.In(LISTEN), vol.Optional("offset", default=0): int}
)
@websocket_api.async_response
@_befehl
async def ws_liste(hass, sp: Spotify, msg):
    return await sp.liste(msg["art"], msg["offset"])


@websocket_api.websocket_command(
    {vol.Required("type"): "musik/inhalt", vol.Required("uri"): str, vol.Optional("offset", default=0): int}
)
@websocket_api.async_response
@_befehl
async def ws_inhalt(hass, sp: Spotify, msg):
    return await sp.inhalt(msg["uri"], msg["offset"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "musik/suche",
        vol.Required("q"): str,
        vol.Optional("typ", default="alles"): vol.In(SUCHARTEN),
        vol.Optional("offset", default=0): int,
    }
)
@websocket_api.async_response
@_befehl
async def ws_suche(hass, sp: Spotify, msg):
    return await sp.suche(msg["q"].strip(), msg["typ"], msg["offset"])


def _sonos(hass: HomeAssistant) -> list[str]:
    reg = er.async_get(hass)
    return sorted(
        e.entity_id for e in reg.entities.values()
        if e.platform == "sonos" and e.domain == "media_player" and not e.disabled_by
    )


def _spotify_entitaet(hass: HomeAssistant) -> str | None:
    reg = er.async_get(hass)
    return next((e.entity_id for e in reg.entities.values() if e.platform == "spotify" and e.domain == "media_player"), None)


def _vergleich(name: str) -> str:
    return name.lower().removeprefix("sonos ").strip()


@websocket_api.websocket_command({vol.Required("type"): "musik/geraete"})
@websocket_api.async_response
@_befehl
async def ws_geraete(hass, sp: Spotify, msg):
    """Echos & Co. über Spotify Connect, Sonos über HA — Sonos nie doppelt."""
    sonos = []
    for eid in _sonos(hass):
        st = hass.states.get(eid)
        if st is None:
            continue
        name = st.attributes.get("friendly_name", eid)
        # „Bad" neben „Echo Bad" wäre mehrdeutig
        if not name.lower().startswith("sonos"):
            name = f"Sonos {name}"
        sonos.append({"id": ENTITAET + eid, "name": name, "art": "sonos", "entitaet": eid})
    sonos_namen = {_vergleich(s["name"]) for s in sonos}
    try:
        connect = await sp.geraete()
    except SpotifyFehler as err:
        _LOGGER.warning("Musik: Spotify-Geräte nicht abrufbar: %s", err)
        connect = []
    spotify_eid = _spotify_entitaet(hass)
    liste = [
        {"id": CONNECT + g["id"], "name": g["name"], "art": g["typ"].lower(), "aktiv": g["aktiv"], "entitaet": spotify_eid}
        for g in connect if _vergleich(g["name"]) not in sonos_namen
    ]
    return {"geraete": liste + sonos, "spotify": spotify_eid}


@websocket_api.websocket_command(
    {
        vol.Required("type"): "musik/abspielen",
        vol.Required("ziel"): str,
        vol.Optional("kontext"): vol.Any(str, None),
        vol.Optional("uri"): vol.Any(str, None),
        vol.Optional("uris"): [str],
        vol.Optional("platz"): vol.Any(int, None),
        vol.Optional("zufall"): vol.Any(bool, None),
    }
)
@websocket_api.async_response
@_befehl
async def ws_abspielen(hass, sp: Spotify, msg):
    ziel = msg["ziel"]
    if ziel.startswith(CONNECT):
        await sp.abspielen(ziel.removeprefix(CONNECT), msg.get("kontext"), msg.get("uri"), msg.get("uris"), msg.get("zufall"))
        return {}
    if ziel.startswith(ENTITAET):
        await _sonos_abspielen(hass, ziel.removeprefix(ENTITAET), msg)
        return {}
    raise SpotifyFehler(f"Unbekanntes Ziel: {ziel}")


async def _sonos_abspielen(hass: HomeAssistant, eid: str, msg: dict) -> None:
    """Sonos spielt Spotify über Freigabelinks in die eigene Warteschlange.

    Ein Kontext (Playlist/Album/Podcast/Künstler) kommt komplett in die
    Schlange, dann springt sonos.play_queue zum angetippten Titel. Für
    „Lieblingssongs" gibt es keinen Link — da kommen die Titel einzeln.
    ⚠️ Setzt voraus, dass Spotify in der Sonos-App verknüpft ist.
    """
    kontext, uri, platz = msg.get("kontext"), msg.get("uri"), msg.get("platz")
    rufe = hass.services.async_call
    if kontext and not kontext.endswith(":collection"):
        await rufe("media_player", "play_media", {
            "entity_id": eid, "media_content_id": kontext, "media_content_type": "playlist", "enqueue": "replace",
        }, blocking=True)
        if platz and kontext.split(":")[1] in ("playlist", "album", "show"):
            await rufe("sonos", "play_queue", {"entity_id": eid, "queue_position": platz}, blocking=True)
    else:
        uris = msg.get("uris") or ([uri] if uri else [])
        if not uris:
            raise SpotifyFehler("Nichts zum Abspielen")
        await rufe("media_player", "play_media", {
            "entity_id": eid, "media_content_id": uris[0], "media_content_type": "music", "enqueue": "replace",
        }, blocking=True)

        async def rest() -> None:
            for u in uris[1:]:
                try:
                    await rufe("media_player", "play_media", {
                        "entity_id": eid, "media_content_id": u, "media_content_type": "music", "enqueue": "add",
                    }, blocking=True)
                except Exception as err:  # einzelner Titel nicht verfügbar
                    _LOGGER.debug("Musik: %s nicht eingereiht: %s", u, err)

        if len(uris) > 1:
            hass.async_create_background_task(rest(), "musik_sonos_einreihen")
    if msg.get("zufall") is not None:
        await rufe("media_player", "shuffle_set", {"entity_id": eid, "shuffle": msg["zufall"]}, blocking=True)
