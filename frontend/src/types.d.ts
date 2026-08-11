/**
 * Global type declarations for types not present in TypeScript's lib.dom.d.ts.
 */

/**
 * The BeforeInstallPromptEvent is fired by Chromium-based browsers when
 * a PWA meets installability criteria. It allows sites to show a custom
 * install prompt instead of the browser's default mini-infobar.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  /** Platforms on which the event was dispatched. */
  readonly platforms: string[];

  /** Shows the native install prompt. Must be called from a user gesture context. */
  prompt(): Promise<void>;

  /** Resolves with the user's choice after prompt() is called. */
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}
