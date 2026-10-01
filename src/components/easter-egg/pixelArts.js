/*
 * Pixel art definitions for Tapesh Space Shooter Easter Egg.
 *
 * All pixel art is drawn as 2D arrays of color strings.
 * Each inner array is a row, each element is a color or null (transparent).
 * Resolution is intentionally low for that retro arcade feel.
 */

// Tapesh logo simplified as a ship - the heartbeat wave becomes wings
export const PLAYER_PIXELS = [
  [null, null, '#e0b45c', null, null],
  [null, '#e0b45c', '#e0b45c', '#e0b45c', null],
  ['#ffffff', '#e0b45c', '#ffffff', '#e0b45c', '#ffffff'],
  [null, '#ffffff', '#ffffff', '#ffffff', null],
  ['#e0b45c', '#e0b45c', '#e0b45c', '#e0b45c', '#e0b45c'],
  ['#ffffff', '#e0b45c', null, '#e0b45c', '#ffffff'],
  [null, '#ffffff', null, '#ffffff', null],
];

// Player thrust/engine glow
export const PLAYER_THRUST = [
  [null, '#b99a86', null],
  ['#b99a86', '#ff9717', '#b99a86'],
  ['#ff9717', '#ffffff', '#ff9717'],
  ['#b99a86', '#ff9717', '#b99a86'],
  [null, '#b99a86', null],
];

// Simple heart - a medical/patient enemy
export const ENEMY_HEART_PIXELS = [
  [null, '#e26d6d', '#e26d6d', null, '#e26d6d', '#e26d6d', null],
  ['#e26d6d', '#ffffff', '#ffffff', '#e26d6d', '#ffffff', '#ffffff', '#e26d6d'],
  ['#e26d6d', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e26d6d'],
  [null, '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', null],
  [null, null, '#ffffff', '#ffffff', '#ffffff', null, null],
  [null, null, null, '#ffffff', null, null, null],
];

// Brain/neuron - smart enemy
export const ENEMY_BRAIN_PIXELS = [
  [null, '#937fcd', '#937fcd', null, '#937fcd', '#937fcd', null],
  ['#937fcd', '#ffffff', '#ffffff', '#937fcd', '#ffffff', '#ffffff', '#937fcd'],
  ['#937fcd', '#ffffff', '#937fcd', '#ffffff', '#937fcd', '#ffffff', '#937fcd'],
  [null, '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', null],
  [null, '#937fcd', '#ffffff', '#ffffff', '#ffffff', '#937fcd', null],
  [null, null, '#937fcd', '#937fcd', '#937fcd', null, null],
];

// Bacteria - organic enemy
export const ENEMY_BACTERIA_PIXELS = [
  [null, null, '#61d192', null, null],
  [null, '#61d192', '#ffffff', '#61d192', null],
  ['#61d192', '#ffffff', '#ffffff', '#ffffff', '#61d192'],
  [null, '#61d192', '#ffffff', '#61d192', null],
  [null, null, '#61d192', null, null],
];

// DNA helix - scientific enemy
export const ENEMY_DNA_PIXELS = [
  ['#5b8cc7', null, '#ffffff', null, '#5b8cc7'],
  [null, '#ffffff', '#ffffff', '#ffffff', null],
  ['#5b8cc7', '#ffffff', null, '#ffffff', '#5b8cc7'],
  [null, '#ffffff', '#ffffff', '#ffffff', null],
  ['#5b8cc7', null, '#ffffff', null, '#5b8cc7'],
];

// Test/question - exam enemy
export const ENEMY_TEST_PIXELS = [
  [null, '#77b787', '#77b787', '#77b787', null],
  [null, '#77b787', '#ffffff', '#77b787', null],
  ['#77b787', '#ffffff', '#ffffff', '#ffffff', '#77b787'],
  [null, '#77b787', '#77b787', '#77b787', null],
  [null, null, '#77b787', null, null],
];

// Book - knowledge enemy
export const ENEMY_BOOK_PIXELS = [
  ['#604e42', '#604e42', '#604e42', '#604e42'],
  ['#ffffff', '#604e42', '#604e42', '#ffffff'],
  ['#604e42', '#ffffff', '#604e42', '#604e42'],
  ['#ffffff', '#604e42', '#604e42', '#ffffff'],
  ['#604e42', '#604e42', '#604e42', '#604e42'],
];

// Flashcard - quick enemy
export const ENEMY_FLASHCARD_PIXELS = [
  [null, '#ab8e7c', '#ab8e7c', null],
  ['#ab8e7c', '#ffffff', '#ffffff', '#ab8e7c'],
  ['#ab8e7c', '#ffffff', '#ffffff', '#ab8e7c'],
  ['#ab8e7c', '#ab8e7c', '#ab8e7c', '#ab8e7c'],
];

// Microscope - mini boss
export const ENEMY_MINIBOSS_PIXELS = [
  [null, null, '#b99a86', null, null, '#b99a86', null, null],
  [null, '#b99a86', '#ffffff', '#b99a86', '#b99a86', '#ffffff', '#b99a86', null],
  ['#b99a86', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#b99a86'],
  [null, '#b99a86', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#b99a86', null],
  [null, null, '#b99a86', '#ffffff', '#ffffff', '#b99a86', null, null],
  [null, '#b99a86', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#b99a86', null],
  ['#b99a86', '#ffffff', '#ffffff', '#b99a86', '#b99a86', '#ffffff', '#ffffff', '#b99a86'],
  [null, null, '#b99a86', null, null, '#b99a86', null, null],
];

// Power-up: Rapid Fire (orange)
export const POWERUP_RAPID_PIXELS = [
  [null, '#ff9717', null],
  ['#ff9717', '#ffffff', '#ff9717'],
  [null, '#ff9717', null],
];

// Power-up: Double Shot (green)
export const POWERUP_DOUBLE_PIXELS = [
  ['#61d192', null, '#61d192'],
  [null, '#ffffff', null],
  ['#61d192', null, '#61d192'],
];

// Power-up: Shield (blue)
export const POWERUP_SHIELD_PIXELS = [
  ['#5b8cc7', '#ffffff', '#5b8cc7'],
  ['#ffffff', '#ffffff', '#ffffff'],
  ['#5b8cc7', '#ffffff', '#5b8cc7'],
];

// Power-up: Pulse (purple)
export const POWERUP_PULSE_PIXELS = [
  [null, '#937fcd', null],
  ['#937fcd', '#ffffff', '#937fcd'],
  ['#937fcd', '#ffffff', '#937fcd'],
  [null, '#937fcd', null],
];

// Explosion particle colors
export const EXPLOSION_COLORS = ['#ff9717', '#e0b45c', '#e26d6d', '#ffffff'];

// Score popup color
export const SCORE_POPUP_COLOR = '#e0b45c';

// Boss health bar colors
export const BOSS_HEALTH_COLOR = '#e26d6d';
export const BOSS_HEALTH_BG_COLOR = '#242426';