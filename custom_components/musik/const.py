"""Konstanten der Musik-Integration."""

DOMAIN = "musik"
API = "https://api.spotify.com/v1"

# ⚠️ Seit Spotifys Entwickler-Änderung (Feb. 2026) erlaubt die Suche
# höchstens 10 Treffer pro Abruf, Künstler-Alben ebenso. Mehr = mehrere
# Abrufe mit offset.
SUCHE_SEITE = 10
SUCHE_ABRUFE = 3
LISTE_SEITE = 50

# Kennung eines Abspielziels: Spotify-Connect-Gerät oder HA-Entität (Sonos)
CONNECT = "connect:"
ENTITAET = "entity:"
