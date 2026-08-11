import 'vitest-canvas-mock';

import { vi } from 'vitest';

// Register Chart.js controllers/scales/plugins once (mirrors main.ts import)
import './app/shared/chart-config/chart-setup';

// Mock window.matchMedia — not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver — not available in jsdom, needed by Chart.js responsive
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(window as unknown as Record<string, unknown>)['ResizeObserver'] = ResizeObserverMock;
