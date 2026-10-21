# Arte — PuzzleBit

## Dirección

Pixel art colorido y limpio, con piezas brillantes y animaciones exageradas.
Debe leerse bien en móvil y en escritorio, y ser distinto de Candy Crush.

## Especificaciones

| Elemento | Tamaño |
|---|---|
| Pieza | 48×48 px |
| Tablero | 8×8 piezas |
| Iconos UI | 24×24 / 32×32 |
| Retratos | 64×64 |
| Resolución lógica | 720×1280 vertical / 1280×720 horizontal |
| Escalado | nearest-neighbor |

## Piezas

- 6 formas/colores distinguibles también en daltonismo.
- Formas propuestas: círculo, cuadrado, rombo, estrella, hexágono, gota.
- Cada pieza: 3–5 colores + contorno.
- Brillo y sombra simples para dar volumen.
- Animación idle sutil (2–3 frames).

## Animaciones

- Selección: escala + brillo.
- Swap: movimiento suave con easing.
- Match: destello y partículas.
- Caída: rebote corto.
- Especial: onda de choque.
- Victoria: confeti pixel.
- Derrota: piezas grises.

## UI

- Fuente pixel legible a tamaño móvil.
- Mapa de niveles con camino y estrellas.
- HUD: movimientos, objetivo, puntuación.
- Botones grandes para táctil.
- Paleta: rosa, menta, limón, naranja, uva, azul.
- Fondo con parallax suave.

## Audio

- Efectos cortos: swap, match, cascada, especial, victoria.
- Música loop alegre y discreta.
- Volumen configurable y mute.

## Pipeline

1. Paleta y formas base.
2. Piezas y estados.
3. Animaciones.
4. UI y mapa.
5. Fondos y partículas.
6. Atlas y export.
