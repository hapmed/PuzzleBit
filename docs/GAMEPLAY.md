# Gameplay — PuzzleBit

## Bucle principal

1. Elegir nivel en el mapa.
2. Intercambiar piezas para formar matches.
3. Encadenar cascadas y ganar puntos.
4. Cumplir el objetivo antes de agotar los movimientos.
5. Ganar estrellas y desbloquear el siguiente nivel.

## Tablero

- 8×8 por defecto (configurable por nivel).
- 5–6 tipos de pieza.
- Sin matches al generar el tablero inicial.
- Intercambio solo entre piezas adyacentes.
- Si no hay match, el intercambio se revierte.
- Si no hay movimientos posibles, se mezcla el tablero.

## Puntuación

- 10 puntos por pieza eliminada.
- Bonus por cascada: ×1.5, ×2, ×2.5…
- Bonus por pieza especial.
- Bonus por movimientos restantes al ganar.
- Estrellas según la puntuación final.

## Piezas especiales

| Pieza | Efecto |
|---|---|
| Rayada horizontal | Limpia la fila |
| Rayada vertical | Limpia la columna |
| Envuelta | Explota en 3×3 |
| Bomba | Combina con otra especial |

Las combinaciones de especiales se definen en Fase 2.

## Objetivos

- **Puntuación:** llegar a X puntos.
- **Recolectar:** eliminar N piezas de un tipo.
- **Limpiar:** quitar celdas especiales del tablero.
- **Ingredientes:** llevar piezas al fondo.

El MVP usa solo puntuación; el resto llega después.

## Niveles

- Datos en [`data/levels.json`](../data/levels.json).
- 10 niveles iniciales.
- Dificultad por movimientos, tipos de pieza y objetivo.
- Desbloqueo secuencial.
- Estrellas: 1, 2 y 3 según puntuación.

## Ranking

- Por nivel: mejor puntuación.
- Global: suma de mejores puntuaciones.
- Nickname local en el MVP.
- El servidor valida rangos y nivel.
- Sin anti-cheat fuerte: es un juego para la casa.

## PWA

- Los niveles se cachean para jugar offline.
- El progreso se guarda localmente y se sincroniza al volver online.
- Instalable en móvil y escritorio.
- Botón de instalación cuando el navegador lo permita.

## Boosters (fase 4)

- Martillo: rompe una pieza.
- Mezclar: reordena el tablero.
- Movimiento extra.
- Se ganan por nivel o se compran con monedas del juego (sin dinero real).
