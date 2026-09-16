# EIXA Design System · DS-001

## Purpose
Create a single visual language for EIXA Hub. New screens must use design tokens and reusable components rather than introducing isolated styles.

## Source files
- `src/design/tokens.css`: colors, typography, spacing, radius, shadows and motion.
- `src/design/foundation.css`: document-level defaults and accessibility foundations.
- `src/design/components.css`: base reusable components and compatibility layer.
- `src/design/utilities.css`: minimal layout helpers.
- `src/design/index.css`: single entry point loaded by `index.html`.

## Component classes
- `.eixa-button` with `--primary`, `--secondary`, `--ghost`, `--danger`, `--success`.
- `.eixa-card` with `--interactive`, `--dark`, `--gold`.
- `.eixa-badge` with semantic variants.
- `.eixa-avatar` with `--lg` and `--xl`.
- `.eixa-progress` and `.eixa-progress__value`.
- `.eixa-metric`.
- `.eixa-alert`.
- `.eixa-empty-state`.
- `.eixa-section`.

## Rules
1. Do not add raw hexadecimal colors outside `tokens.css` unless documenting a temporary migration exception.
2. Do not create a new button or card style if an existing component can express the use case.
3. All interactive controls must have visible focus states and a minimum touch height of 44 px.
4. Every new component must work on mobile before it is considered complete.
5. Existing legacy classes remain available during gradual migration.

## Next sprint
DS-002 will migrate the Dashboard and Player Workspace markup to native EIXA component classes and add domain components: `PlayerCard`, `TeamCard`, `ObjectiveCard`, `MatchCard`, and `TrainingCard`.
