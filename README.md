# Musik — Spotify-Dashboard für Home Assistant

Eigene Integration `musik` plus Dashboard-Karte `custom:musik-card`:
Bibliothek (Playlists, Lieblingssongs, Alben, Künstler, Podcasts, Zuletzt),
Suche und Abspielen auf Spotify-Connect-Geräten (Echo) und Sonos.

Baut auf der Core-Spotify-Integration auf und nutzt deren Anmeldung.

## Installation

1. `custom_components/musik` nach `config/custom_components/` kopieren, HA neu starten.
2. Integration „Musik" hinzufügen (keine Eingaben).
3. Ressource `/musik_static/musik-card.js?v=<VERSION>` (JavaScript-Modul) anlegen.
4. Dashboard mit `type: custom:musik-card` (am besten als Panel-Ansicht).

## Hinweise

- Spotify beschränkt Entwickler-Apps seit Feb. 2026: Suche max. 10 Treffer pro
  Abruf, `/browse/*` und Künstler-Top-Songs gesperrt.
- Sonos braucht Spotify in der Sonos-App verknüpft.
