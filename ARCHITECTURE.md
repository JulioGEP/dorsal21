# EIXA Hub - Arquitectura

## Objectiu

Mantenir el projecte modular, entenedor i preparat per créixer sense perdre compatibilitat amb Firebase ni amb les dades existents.

## Estructura actual

- `index.html`: punt d'entrada de l'aplicació.
- `styles.css`: sistema visual global.
- `js/app.js`: coordinació de navegació i vistes existents.
- `js/core/firebase.js`: inicialització de Firebase i exportació de les APIs utilitzades.
- `js/core/state.js`: estat global de sessió i navegació.
- `js/core/utils.js`: funcions comunes de format i seguretat.
- `js/services/media.js`: tractament i compressió d'imatges.
- `js/firebase-config.js`: configuració pública del client Firebase.

## Regles d'evolució

1. Les noves funcionalitats no han d'afegir inicialització Firebase duplicada.
2. Les utilitats compartides han d'anar a `js/core`.
3. La lògica d'accés a serveis externs ha d'anar a `js/services`.
4. Les dades existents de Firestore no es migren ni s'eliminen sense una versió de migració explícita.
5. Cada versió ha de mantenir compatibilitat amb la versió publicada anterior.

## Proper pas arquitectònic

Separar gradualment les vistes de `app.js` en fitxers dins de `js/views` sense canviar la UX ni el model de dades.
