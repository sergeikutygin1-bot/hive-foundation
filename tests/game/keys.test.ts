// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createFocusTracker, routeKey } from '../../src/game/keys';

const button = () => document.createElement('button');
const keyboardFocused = () => true;
const mouseFocused = () => false;

describe('routeKey', () => {
  it('gives Space to the game when a button only has mouse focus (clicked, then Space)', () => {
    expect(routeKey({ key: ' ', target: button(), ctrlKey: false, metaKey: false, altKey: false }, mouseFocused)).toBe('game');
  });

  it('lets a keyboard-focused button keep Space and Enter', () => {
    expect(routeKey({ key: ' ', target: button(), ctrlKey: false, metaKey: false, altKey: false }, keyboardFocused)).toBe('ui');
    expect(routeKey({ key: 'Enter', target: button(), ctrlKey: false, metaKey: false, altKey: false }, keyboardFocused)).toBe('ui');
  });

  it('still routes other shortcuts to the game from a focused button', () => {
    expect(routeKey({ key: 'h', target: button(), ctrlKey: false, metaKey: false, altKey: false }, keyboardFocused)).toBe('game');
  });

  it('never steals typing or browser shortcuts', () => {
    const input = document.createElement('input');
    expect(routeKey({ key: 'h', target: input, ctrlKey: false, metaKey: false, altKey: false }, mouseFocused)).toBe('ui');
    expect(routeKey({ key: 'r', target: document.body, ctrlKey: false, metaKey: true, altKey: false }, mouseFocused)).toBe('ignore');
  });

  it('routes keys on the page body to the game', () => {
    expect(routeKey({ key: ' ', target: document.body, ctrlKey: false, metaKey: false, altKey: false }, mouseFocused)).toBe('game');
  });
});

describe('createFocusTracker', () => {
  it('treats focus that follows a pointer press as mouse focus, and Tab as keyboard focus', () => {
    const tracker = createFocusTracker(window);
    expect(tracker.isKeyboardFocused()).toBe(true);
    window.dispatchEvent(new MouseEvent('pointerdown'));
    expect(tracker.isKeyboardFocused()).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(tracker.isKeyboardFocused()).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(tracker.isKeyboardFocused()).toBe(true);
    tracker.dispose();
  });
});
