"""Musik — Spotify-Bibliothek, Suche und Abspielen als Dashboard in HA.

Baut auf der Spotify-Integration auf (deren Anmeldung, deren Entität für die
Abspielleiste). Abgespielt wird auf Spotify-Connect-Geräten (Echos) über die
Web-API und auf Sonos über HAs Sonos-Integration (Spotify-Freigabelinks).
"""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from . import websocket
from .const import DOMAIN
from .spotify import Spotify

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

KARTE_URL = "/musik_static"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    await hass.http.async_register_static_paths(
        [StaticPathConfig(KARTE_URL, str(Path(__file__).parent / "www"), cache_headers=False)]
    )
    websocket.anmelden(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN] = Spotify(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.pop(DOMAIN, None)
    return True
