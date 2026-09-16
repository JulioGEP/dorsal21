# Changelog

## v1.7 · Dashboard Premium
- Nova pàgina d'inici amb jerarquia visual premium.
- KPI de club i preparació dels perfils.
- Alertes operatives basades en dades existents.
- Accions ràpides i activitat recent.
- Dashboard familiar simplificat.
- Sense canvis al model de dades ni a les regles de Firestore.

# Historial de versions

## v1.6

- Refactorització controlada sense canvis en el model de dades.
- Inicialització de Firebase separada del fitxer principal.
- Estat global centralitzat.
- Utilitats comunes i servei d'imatges modularitzats.
- Incorporació d'`ARCHITECTURE.md` i `CONTRIBUTING.md`.
- Perfil 360 i funcionalitats de la v1.5 conservades.

## v1.5

- Perfil 360 del jugador.
- Foto de perfil comprimida.
- Estat general, objectiu, cronologia i PDI inicial.

## DS-001
- Added EIXA Design System foundations and design tokens.
- Added reusable base components: Button, Card, Badge, Avatar, Progress, Metric, Alert, Empty State and Section.
- Added an incremental compatibility layer for the existing interface.
- Added a standalone `design-system.html` visual catalogue.
- Integrated the Design System into the production application without changing Firebase data or security rules.

## PW-002.1 · Player Workspace
- Nou component PlayerHero.
- KPIGrid amb Esport, Cos, Benestar i Compromís.
- ActionPanel contextual amb prioritats reals del perfil.
- Timeline reutilitzable.
- Progrés de l'objectiu editable.
- Integració completa amb EIXA Design System.

## v1.8.0 - Estabilitat i reptes
- Validació de sintaxi completa de `js/app.js`.
- Nou sistema de permisos bàsic per a personal intern.
- Els rols `superadmin`, `admin` i `coach` poden gestionar proves del Repte d'estiu.
- Creació, edició i eliminació de proves des del mateix mòdul.
- Navegació específica per a staff sense jugador associat.
- Proteccions per evitar errors quan el perfil o el jugador no existeixen.
- Regles Firestore actualitzades per als gestors de reptes.
