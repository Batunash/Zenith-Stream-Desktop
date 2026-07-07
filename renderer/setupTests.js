import '@testing-library/jest-dom';

// Mock electron API
global.window.api = {
  invoke: vi.fn((channel) => {
    if (channel === 'file:getSeries') return Promise.resolve([]);
    if (channel === 'browser:getStreams') return Promise.resolve({ success: true, streams: [] });
    return Promise.resolve({ success: true });
  }),
  receive: vi.fn(),
  remove: vi.fn(),
  send: vi.fn(),
};

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
