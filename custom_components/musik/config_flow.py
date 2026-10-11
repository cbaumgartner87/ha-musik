"""Einrichtung ohne Eingaben — die Anmeldung kommt aus der Spotify-Integration."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class MusikConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if not self.hass.config_entries.async_entries("spotify"):
            return self.async_abort(reason="kein_spotify")
        if user_input is None:
            return self.async_show_form(step_id="user")
        return self.async_create_entry(title="Musik", data={})
