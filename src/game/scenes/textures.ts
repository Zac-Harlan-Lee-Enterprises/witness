import type Phaser from 'phaser';
import { ellipse, makeCanvas, rgba, type Ctx } from '../art/paint';

/**
 * Small shared textures for the world: focus ring and verb symbols, sparkles,
 * birds, glows, exit chevrons. Painted once per game at 2× like everything
 * else; shapes (not just colours) carry meaning.
 */
export const TEX = {
  ring: 'fx-ring',
  glyphTalk: 'fx-glyph-talk',
  glyphLook: 'fx-glyph-look',
  glyphUse: 'fx-glyph-use',
  sparkle: 'fx-sparkle',
  star: 'fx-star',
  bundle: 'fx-bundle',
  mote: 'fx-mote',
  bird: 'fx-bird',
  pigeon: 'fx-pigeon',
  pigeonFly: 'fx-pigeon-fly',
  hawk: 'fx-hawk-shadow',
  glint: 'fx-glint',
  glow: 'fx-glow',
  chevron: 'fx-chevron',
} as const;

const INK = '#4a2a14';
const PAPER = '#fff8e8';

function add(
  textures: Phaser.Textures.TextureManager,
  key: string,
  w: number,
  h: number,
  paint: (c: Ctx) => void,
): void {
  if (textures.exists(key)) return;
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) paint(ctx);
  textures.addCanvas(key, canvas);
}

function badge(c: Ctx, draw: (c: Ctx) => void): void {
  // A round "coin" behind the symbol, with a small tail pointing down.
  c.fillStyle = PAPER;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(12, 11, 9.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(9, 19.5);
  c.lineTo(12, 24);
  c.lineTo(15, 19.5);
  c.fill();
  draw(c);
}

export function makeSharedTextures(textures: Phaser.Textures.TextureManager): void {
  add(textures, TEX.ring, 40, 18, (c) => {
    // A soft golden ring on the ground under whatever you can interact with.
    c.strokeStyle = rgba('#ffe7a0', 0.95);
    c.lineWidth = 2.2;
    c.beginPath();
    c.ellipse(20, 9, 16, 6.5, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = rgba('#b8860b', 0.55);
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(20, 9.8, 16, 6.5, 0, 0.2, Math.PI - 0.2);
    c.stroke();
  });
  add(textures, TEX.glyphTalk, 24, 25, (c) =>
    badge(c, (g) => {
      // Speech: three dots in a bubble.
      g.fillStyle = INK;
      for (const x of [7.5, 12, 16.5]) {
        g.beginPath();
        g.arc(x, 11, 1.6, 0, Math.PI * 2);
        g.fill();
      }
    }),
  );
  add(textures, TEX.glyphLook, 24, 25, (c) =>
    badge(c, (g) => {
      // Examine: a magnifying lens.
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(11, 10, 4, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(14, 13);
      g.lineTo(17, 16);
      g.stroke();
    }),
  );
  add(textures, TEX.glyphUse, 24, 25, (c) =>
    badge(c, (g) => {
      // Use/open/take: an open hand.
      g.fillStyle = INK;
      g.beginPath();
      g.roundRect(8.5, 9, 7, 7, 2);
      g.fill();
      for (let i = 0; i < 4; i++)
        g.fillRect(8.6 + i * 1.8, 5 + (i === 0 || i === 3 ? 1.5 : 0), 1.3, 5);
      g.fillRect(15, 10, 3, 1.4);
    }),
  );
  add(textures, TEX.sparkle, 10, 10, (c) => {
    const g = c.createRadialGradient(5, 5, 0, 5, 5, 5);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.4, 'rgba(255,220,120,0.8)');
    g.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 10, 10);
  });
  add(textures, TEX.star, 18, 18, (c) => {
    // A four-pointed glint — the "something to notice" mark.
    c.fillStyle = 'rgba(255,246,210,0.95)';
    c.beginPath();
    c.moveTo(9, 0);
    c.quadraticCurveTo(10, 8, 18, 9);
    c.quadraticCurveTo(10, 10, 9, 18);
    c.quadraticCurveTo(8, 10, 0, 9);
    c.quadraticCurveTo(8, 8, 9, 0);
    c.fill();
  });
  add(textures, TEX.bundle, 16, 14, (c) => {
    // A little satchel: "you received something".
    c.fillStyle = '#8f6a40';
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    c.roundRect(2, 4, 12, 9, 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#6b4a2a';
    c.fillRect(2, 4, 12, 3.5);
    c.beginPath();
    c.arc(8, 4, 3.5, Math.PI, 2 * Math.PI);
    c.stroke();
  });
  add(textures, TEX.mote, 6, 6, (c) => {
    const g = c.createRadialGradient(3, 3, 0, 3, 3, 3);
    g.addColorStop(0, 'rgba(255,245,220,0.9)');
    g.addColorStop(1, 'rgba(255,245,220,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 6, 6);
  });
  add(textures, TEX.bird, 12, 6, (c) => {
    c.strokeStyle = '#3a2c20';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(1, 4);
    c.quadraticCurveTo(3.5, 0.5, 6, 3.5);
    c.quadraticCurveTo(8.5, 0.5, 11, 4);
    c.stroke();
  });
  add(textures, TEX.pigeon, 10, 8, (c) => {
    ellipse(c, 5, 5, 3.6, 2.4, '#8a8e96');
    ellipse(c, 7.6, 3.6, 1.6, 1.5, '#6f737c');
    ellipse(c, 3.6, 4.6, 1.8, 1.2, '#a8acb3');
    c.fillStyle = '#c97a3a';
    c.fillRect(8.9, 3.4, 1, 0.6);
    ellipse(c, 5, 7.2, 3.2, 0.8, 'rgba(0,0,0,0.25)');
  });
  add(textures, TEX.pigeonFly, 12, 8, (c) => {
    c.fillStyle = '#8a8e96';
    c.beginPath();
    c.moveTo(1, 5);
    c.quadraticCurveTo(4, 0.5, 6, 4);
    c.quadraticCurveTo(8, 0.5, 11, 5);
    c.quadraticCurveTo(6, 6.5, 1, 5);
    c.fill();
  });
  add(textures, TEX.hawk, 48, 24, (c) => {
    // The shadow of a hawk soaring overhead, drawn nose-up (it is turned to
    // face the way it glides: systems/flight.ts): a small round head, broad
    // wings with fingered tips, and a fanned tail, so head and tail read.
    c.fillStyle = 'rgba(30,24,40,0.9)';
    c.beginPath();
    c.moveTo(24, 2.5);
    c.quadraticCurveTo(26.2, 3, 26, 6);
    c.quadraticCurveTo(34, 5.5, 44, 8);
    c.lineTo(47, 9);
    c.lineTo(44.5, 9.8);
    c.lineTo(46.5, 10.8);
    c.lineTo(43.5, 11.2);
    c.quadraticCurveTo(34, 12.5, 27, 13.5);
    c.lineTo(29.5, 21.5);
    c.quadraticCurveTo(24, 23.5, 18.5, 21.5);
    c.lineTo(21, 13.5);
    c.quadraticCurveTo(14, 12.5, 4.5, 11.2);
    c.lineTo(1.5, 10.8);
    c.lineTo(3.5, 9.8);
    c.lineTo(1, 9);
    c.lineTo(4, 8);
    c.quadraticCurveTo(14, 5.5, 22, 6);
    c.quadraticCurveTo(21.8, 3, 24, 2.5);
    c.fill();
  });
  add(textures, TEX.glint, 32, 32, (c) => {
    const g = c.createLinearGradient(0, 0, 32, 32);
    g.addColorStop(0.35, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(230,248,255,0.55)');
    g.addColorStop(0.65, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
  });
  add(textures, TEX.glow, 160, 160, (c) => {
    const g = c.createRadialGradient(80, 80, 4, 80, 80, 80);
    g.addColorStop(0, 'rgba(255,214,140,0.75)');
    g.addColorStop(0.45, 'rgba(255,170,80,0.28)');
    g.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 160, 160);
  });
  add(textures, TEX.chevron, 16, 12, (c) => {
    // Points right; rotated for other directions.
    c.fillStyle = rgba(PAPER, 0.95);
    c.strokeStyle = INK;
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(2, 1.5);
    c.lineTo(9, 6);
    c.lineTo(2, 10.5);
    c.lineTo(5, 6);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(8, 1.5);
    c.lineTo(15, 6);
    c.lineTo(8, 10.5);
    c.lineTo(11, 6);
    c.closePath();
    c.fill();
    c.stroke();
  });
}
