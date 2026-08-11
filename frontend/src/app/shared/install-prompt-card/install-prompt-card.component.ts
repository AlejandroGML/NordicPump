import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Install prompt card — placed beside the tank calculator.
 *
 * Design: nordicpump-redesign.html → .install
 * - Muted surface card with eyebrow + title + description
 * - "Add to home screen" secondary button
 * - Presentational: the actual beforeinstallprompt flow lives in the
 *   floating InstallPromptComponent banner
 */
@Component({
  selector: 'app-install-prompt-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  styles: [`
    .install {
      display: flex; flex-direction: column; justify-content: space-between;
      background: var(--color-surface-muted);
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius);
      padding: 18px;
      min-height: 100%;
    }
    .eyebrow { color: var(--color-text-subtle); text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; }
    h2 { margin-top: 6px; font-size: 20px; letter-spacing: -.02em; color: var(--color-text); }
    p { margin: 8px 0 17px; color: var(--color-text-muted); font-size: 13px; }
    .secondary-btn {
      min-height: 44px; border: 1px solid var(--color-hairline-strong);
      border-radius: var(--radius-sm); background: var(--color-surface);
      color: var(--color-text); padding: 0 14px; font-weight: 600;
      cursor: pointer;
    }
    .secondary-btn:disabled { opacity: .5; cursor: default; }
  `],
  template: `
    <aside class="card install">
      <div>
        <div class="eyebrow">{{ 'pwa.install.eyebrow' | translate }}</div>
        <h2>{{ 'pwa.install.title' | translate }}</h2>
        <p>{{ 'pwa.install.message' | translate }}</p>
      </div>
      <button
        class="secondary-btn"
        (click)="installed.set(true)"
        [disabled]="installed()"
      >
        {{ installed() ? ('pwa.install.done' | translate) : ('pwa.install.button' | translate) }}
      </button>
    </aside>
  `,
})
export class InstallPromptCardComponent {
  protected readonly installed = signal(false);
}
