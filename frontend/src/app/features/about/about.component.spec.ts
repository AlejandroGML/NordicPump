/**
 * AboutComponent Tests — CRITICAL #2 fix
 *
 * Spec: layout-shell > Route /:lang/about
 *   - Component renders at /:lang/about
 *   - Shows app title and description via i18n
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AboutComponent } from './about.component';

class FakeLoader implements TranslateLoader {
  getTranslation(_lang: string) {
    return of({
      about: {
        title: 'About NordicPump',
        description: 'NordicPump compares fuel prices in real time.',
      },
    });
  }
}

describe('AboutComponent', () => {
  let fixture: ComponentFixture<AboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: [
        provideTranslateService({
          lang: 'en',
          loader: { provide: TranslateLoader, useClass: FakeLoader },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutComponent);
    fixture.detectChanges();
  });

  it('should render the about title', () => {
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1.textContent).toContain('About NordicPump');
  });

  it('should render the about description', () => {
    const p = fixture.nativeElement.querySelector('p');
    expect(p).toBeTruthy();
    expect(p.textContent).toContain('NordicPump compares fuel prices');
  });

  it('should have a semantic article element', () => {
    const article = fixture.nativeElement.querySelector('article');
    expect(article).toBeTruthy();
  });

  it('should use text-display class on the heading', () => {
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1.className).toContain('text-display');
  });
});
