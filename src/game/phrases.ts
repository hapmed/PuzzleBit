/** Frases originales de fin de partida, tono absurdo tipo arcade casero.
 *  Nada copiado de otros juegos: humor propio de PuzzleBit. */
export const WIN_PHRASES = [
  "¡Ganaste tan limpito que el tablero te pide autógrafo!",
  "¡La máquina está llorando en binario de la emoción!",
  "¡Ni en modo fácil te cortan la luz, campeón!",
  "¡Las piezas te ficharon para su equipo profesional!",
  "¡Eso fue más limpio que la mesa del abuelo!",
  "¡Tu dedo merece un contrato de patrocinio!",
  "¡Se rompió el marcador, salimos a buscar un fontanero!",
  "¡El confeti ya venía pagado de tu lado!",
  "¡Las estrellas bajaron solas a saludarte!",
  "¡El nivel de abajo ya está pidiendo clemencia!",
  "¡Triunfaste con estilo palanca y todo!",
  "¡Hasta la tostadora aplaudió, no sabemos cómo!",
  "¡Ganaste sin cosquillas ni trucos raros!",
  "¡El público entregó el pañuelo... de felicidad!",
];

export const LOSE_PHRASES = [
  "¡Se acaban los movimientos, quedan los nervios!",
  "¡La pieza exacta estaba 3 esquinas más allá, típico!",
  "¡El tablero confiesa: ese combo era trampa de fábrica!",
  "¡Casi casi... te felicito por el casi!",
  "¡Las estrellas se te escaparon por la ventana!",
  "¡El arcade respira tranquilo por esta vez!",
  "¡Perdiste con estilo, y eso también puntúa... en tu corazón!",
  "¡Ni con martillo cabe tanta desgracia!",
  "¡Zas, en toda la cara del marcador!",
  "¡Las piezas cantaron un lamento cúbico!",
  "¡El confeti se fue de paseo con otro jugador!",
  "¡Mañana el tablero vuelve a ser tu mejor amigo!",
  "¡Te quedaste a un swap de la gloria, como en las telenovelas!",
  "¡La fila de abajo suspendió en estilo, se nota!",
];

export function funnyPhrase(win: boolean): string {
  const list = win ? WIN_PHRASES : LOSE_PHRASES;
  return list[Math.floor(Math.random() * list.length)];
}
