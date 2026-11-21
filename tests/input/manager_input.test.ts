import { describe, it, expect } from 'vitest';
import { ManagerInput } from '@/input/manager_input.js';

describe('InputManager', () => {
  it('should track key state changes', () => {
    const manager = new ManagerInput();
    expect(manager.isKeyDown('KeyW')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(manager.isKeyDown('KeyW')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(manager.isKeyDown('KeyW')).toBe(false);
  });

  it('should track QWERTZ Z only under layout-stable KeyZ for isKeyDown queries', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY', key: 'z' }));
    expect(manager.isKeyDown('KeyZ')).toBe(true);
    expect(manager.isKeyDown('KeyY')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyY', key: 'z' }));
    expect(manager.isKeyDown('KeyZ')).toBe(false);
  });

  it('should track QWERTZ Y only under layout-stable KeyY for isKeyDown queries', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'y' }));
    expect(manager.isKeyDown('KeyY')).toBe(true);
    expect(manager.isKeyDown('KeyZ')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', key: 'y' }));
    expect(manager.isKeyDown('KeyY')).toBe(false);
  });

  it('should track AZERTY W under layout-stable KeyW for isKeyDown queries', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'w' }));
    expect(manager.isKeyDown('KeyW')).toBe(true);
    expect(manager.isKeyDown('KeyZ')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', key: 'w' }));
    expect(manager.isKeyDown('KeyW')).toBe(false);
  });

  it('should track AZERTY A under layout-stable KeyA for isKeyDown queries', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'a' }));
    expect(manager.isKeyDown('KeyA')).toBe(true);
    expect(manager.isKeyDown('KeyQ')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'a' }));
    expect(manager.isKeyDown('KeyA')).toBe(false);
  });

  it('tracks Colemak physical S separately from the typed letter R', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 'r' }));
    expect(manager.isPhysicalKeyDown('KeyS')).toBe(true);
    expect(manager.isKeyDown('KeyR')).toBe(true);
    expect(manager.isKeyDown('KeyS')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', key: 'r' }));
    expect(manager.isPhysicalKeyDown('KeyS')).toBe(false);
    expect(manager.isKeyDown('KeyR')).toBe(false);
    manager.dispose();
  });

  it('tracks Colemak physical D separately from the typed letter S', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 's' }));
    expect(manager.isPhysicalKeyDown('KeyD')).toBe(true);
    expect(manager.isKeyDown('KeyS')).toBe(true);
    expect(manager.isKeyDown('KeyD')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 's' }));
    expect(manager.isPhysicalKeyDown('KeyD')).toBe(false);
    expect(manager.isKeyDown('KeyS')).toBe(false);
    manager.dispose();
  });

  it('releases Colemak physical S without clearing a held physical D', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 's' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', key: 'r' }));
    expect(manager.isPhysicalKeyDown('KeyS')).toBe(false);
    expect(manager.isPhysicalKeyDown('KeyD')).toBe(true);
    expect(manager.isKeyDown('KeyR')).toBe(false);
    expect(manager.isKeyDown('KeyS')).toBe(true);
    manager.dispose();
  });

  it('ignores an empty physical code while still storing the typed letter', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: '', key: 'w' }));
    expect(manager.isPhysicalKeyDown('')).toBe(false);
    expect(manager.isKeyDown('KeyW')).toBe(true);
    manager.dispose();
  });

  it('should release QWERTZ Y and Z independently without cross-clearing holds', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'y' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY', key: 'z' }));
    expect(manager.isKeyDown('KeyY')).toBe(true);
    expect(manager.isKeyDown('KeyZ')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', key: 'y' }));
    expect(manager.isKeyDown('KeyY')).toBe(false);
    expect(manager.isKeyDown('KeyZ')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyY', key: 'z' }));
    expect(manager.isKeyDown('KeyZ')).toBe(false);
  });

  it('should track multiple keys simultaneously', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    expect(manager.isKeyDown('KeyW')).toBe(true);
    expect(manager.isKeyDown('KeyS')).toBe(true);
    expect(manager.isKeyDown('KeyA')).toBe(true);
    expect(manager.isKeyDown('KeyD')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    expect(manager.isKeyDown('KeyW')).toBe(false);
    expect(manager.isKeyDown('KeyS')).toBe(false);
    expect(manager.isKeyDown('KeyA')).toBe(false);
    expect(manager.isKeyDown('KeyD')).toBe(false);
  });

  it('should reset all tracked keys', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    manager.reset();
    expect(manager.isKeyDown('KeyW')).toBe(false);
    expect(manager.isKeyDown('KeyS')).toBe(false);
  });

  it('should track flying camera keys correctly', () => {
    const manager = new ManagerInput();
    const flyingKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'];
    flyingKeys.forEach((key) => {
      expect(manager.isKeyDown(key)).toBe(false);
    });
    flyingKeys.forEach((key) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: key }));
    });
    flyingKeys.forEach((key) => {
      expect(manager.isKeyDown(key)).toBe(true);
    });
  });

  it('should return false for non-existent keys', () => {
    const manager = new ManagerInput();
    expect(manager.isKeyDown('NonExistentKey')).toBe(false);
  });

  it('should track mouse button state', () => {
    const manager = new ManagerInput();
    expect(manager.isRightMouseDown()).toBe(false);
    window.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }));
    expect(manager.isRightMouseDown()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 2 }));
    expect(manager.isRightMouseDown()).toBe(false);
  });

  it('should clear keys on reset including mouse buttons', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }));
    manager.reset();
    expect(manager.isKeyDown('KeyW')).toBe(false);
    expect(manager.isRightMouseDown()).toBe(false);
  });

  it('should stop tracking input after dispose', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(manager.isKeyDown('KeyW')).toBe(true);
    manager.dispose();
    expect(manager.isKeyDown('KeyW')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(manager.isKeyDown('KeyA')).toBe(false);
    window.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }));
    expect(manager.isRightMouseDown()).toBe(false);
  });
  /**
   * MacOS sends no keyup for a letter released while Command is held (Cmd+S,
   * Cmd+E). Releasing Command must release such letters, or the fly camera
   * keeps moving on the next right-button look.
   */
  it('releases letters whose keyup macOS swallowed when Command is released', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'MetaLeft', key: 'Meta' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', metaKey: true }));
    expect(manager.isPhysicalKeyDown('KeyE')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'MetaLeft', key: 'Meta' }));
    expect(manager.isPhysicalKeyDown('KeyE')).toBe(false);
    expect(manager.isKeyDown('KeyE')).toBe(false);
    expect(manager.isShiftDown()).toBe(true);
    manager.dispose();
  });

  /**
   * A key released while a page element stops the keyup must still count as
   * released, or the fly camera moves on its own on the next right-button
   * look.
   */
  it('sees a key release that a page element stops from bubbling', () => {
    const manager = new ManagerInput();
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.addEventListener('keyup', (event) => event.stopPropagation());
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
    expect(manager.isPhysicalKeyDown('KeyW')).toBe(true);
    field.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));
    expect(manager.isPhysicalKeyDown('KeyW')).toBe(false);
    field.remove();
    manager.dispose();
  });

  /**
   * Keys held when the window lost focus are not held anymore once it comes
   * back.
   */
  it('forgets held keys when the window regains focus', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd' }));
    expect(manager.isPhysicalKeyDown('KeyD')).toBe(true);
    window.dispatchEvent(new FocusEvent('focus'));
    expect(manager.isPhysicalKeyDown('KeyD')).toBe(false);
    manager.dispose();
  });

  /**
   * Command released in another app leaves no keyup here; the next right-button
   * press reports Command up, which must release the letters pressed with it.
   */
  it('releases letters held with Command when a pointer press reports Command up', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'MetaLeft', key: 'Meta', metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', metaKey: true }));
    expect(manager.isMetaDown()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerdown', { button: 2, metaKey: false }));
    expect(manager.isMetaDown()).toBe(false);
    expect(manager.isPhysicalKeyDown('KeyS')).toBe(false);
    expect(manager.isMouseButtonDown(2)).toBe(true);
    manager.dispose();
  });

  /** A press that reports Command held keeps the letters held with it. */
  it('keeps letters held with Command while pointer presses report Command down', () => {
    const manager = new ManagerInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'MetaLeft', key: 'Meta', metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', metaKey: true }));
    window.dispatchEvent(new PointerEvent('pointerdown', { button: 0, metaKey: true }));
    expect(manager.isPhysicalKeyDown('KeyS')).toBe(true);
    manager.dispose();
  });
});
