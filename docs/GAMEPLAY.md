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
- 50 niveles de campaña (difultad, objetivos y bloqueadores crecientes).
- Dificultad por movimientos, tipos de pieza y objetivo.
- Desbloqueo secuencial.
- Estrellas: 1, 2 y 3 según puntuación.

## Modo infinito

- Desbloqueado tras completar cualquier nivel de campaña (nodo **∞** en el mapa).
- Niveles `id > 50` generados en el cliente de forma **determinista** (misma id →
  mismo nivel) en `src/game/endless.ts`, con dificultad creciente:
  - Objetivos rotando: puntuación, recolectar color, limpiar jelly (rombo),
    ingredientes (con objetivo secundario de puntuación).
  - Grilla 7×7 al inicio, 8×8 después; tipos 5→6 con la profundidad.
  - Cajas con HP 2 y jelly en rombos que crecen con el nivel.
- El usuario avanza de nivel ∞ N a N+1 al ganar; la progresión es propia e
  independiente de la campaña.
- Ranking: el backend acepta ids `1..100000` y suma los niveles infinitos al
  ranking global; por nivel aparecen si alguien los jugó.

## Reglas de rompe

- **Líneas de 3** del mismo color rompen normal.
- **Línea de 4** → nace una rayada (fila/columna).
- **Línea de 5** → nace una bomba.
- **Cruce T o L** → nace una wrapped (explosión 3×3).
- **Cuadro 2×2** → rompe las 4 piezas y nace una wrapped; si el cuadro está
  pegado a líneas del mismo color se fusionan con ellas y con 6+ celdas
  conectadas nace una **bomba**.
- **Dos cuadros pegados** → nace un **dado**: al dispararse gira y **repinta
  su vecindad 3×3 con un color suerte** (no elimina), lo que dispara cascadas
  por sí solo. Con líneas más largas u 8+ celdas conectadas manda la bomba.
- El generador inicial y las barajas jamás dejan cuadros o líneas sueltos.

## Sazonador arcade (90s)

- Pantalla de encendido con **INSERT COIN** (moneda anima con sonido) directa al
  siguiente nivel: cero menús intermedios.
- Intro `¿LISTO? → ¡YA!` con fanfarria y chip **HI-SCOR** en el HUD.
- **CRT:** scanlines suaves y flash de color en cada jugada, zoom "punch".
- **Cada rompe tiene su show:** onda expansiva desde el punto del rompe que
  cubre la pantalla, sacudida en cascadas, barrido de color cuando la cadena
  sube de nivel, **lluvia de destellos** al nacer una especial y
  **mega-rompe** (flash + triple onda + aguacero) para jugadas con especial
  que además estalla. Timings recortados: swap ~92 ms, caída ~118 ms.
- **Doble cuadro = triple onda**: anillo triple, aguacero dorado y voz propia.
- **Victoria**: confeti multicolor a todo lo ancho (5 tandas), flash dorado
  y ondas concéntricas antes del panel de estrellas.
- Partículas del color de cada pieza, `+N` flotante y banner de cascada con
  **tambores de anunciador** (vox2..vox5 generados) y **voz** por
  `speechSynthesis` es-ES (se puede callar con `localStorage pb.voiceoff=1`).
- **Mascota "estilo toasty"**: un momentazo al azar sale del rincón
  inferior derecho con la cara de pieza y su frase; si le das click rápido te
  asfalt asalta (+150..600 puntos, flash + voz). Se evita repetir seguido
  (cooldown 9 s).

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
