import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const Module = require('module');

// Stable axios mock so imageDownloader can close over it once at load time.
const axiosMock = vi.fn();
const origReq = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'axios') return axiosMock;
  return origReq.apply(this, arguments);
};
delete require.cache[require.resolve('./imageDownloader')];
const { downloadImage } = require('./imageDownloader');
Module.prototype.require = origReq;

// A fake writable stream: `on` captures handlers and can auto-fire
// 'finish' or 'error' on a microtask so the inner Promise settles deterministically.
function makeWriteStream({ finish, error } = {}) {
  const handlers = {};
  const ws = {
    on: vi.fn((event, cb) => {
      handlers[event] = cb;
      if (event === 'finish' && finish) queueMicrotask(cb);
      if (event === 'error' && error) queueMicrotask(() => cb(error));
      return ws;
    }),
    pipe: vi.fn(() => ws),
    __handlers: handlers,
  };
  return ws;
}

let origConsoleError;

describe('Image Downloader', () => {
  const mockUrl = 'https://example.com/image.jpg';
  const mockDestPath = '/tmp/test-image.jpg';

  beforeEach(() => {
    vi.clearAllMocks();
    origConsoleError = console.error;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = origConsoleError;
  });

  it('downloads an image successfully and pipes to the writer', async () => {
    axiosMock.mockResolvedValue({ data: { pipe: vi.fn() } });
    global.__fsMock.createWriteStream.mockReturnValue(makeWriteStream({ finish: true }));

    await downloadImage(mockUrl, mockDestPath);

    expect(axiosMock).toHaveBeenCalledWith(expect.objectContaining({
      url: mockUrl,
      method: 'GET',
      responseType: 'stream',
    }));
    expect(global.__fsMock.createWriteStream).toHaveBeenCalledWith(mockDestPath);
  });

  it('handles a network error and logs it', async () => {
    axiosMock.mockRejectedValue(new Error('Network error'));

    const result = await downloadImage(mockUrl, mockDestPath);
    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('handles a 404 response', async () => {
    axiosMock.mockRejectedValue({ message: 'Request failed with status code 404', response: { status: 404 } });

    const result = await downloadImage(mockUrl, mockDestPath);
    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('uses the correct axios configuration', async () => {
    axiosMock.mockResolvedValue({ data: { pipe: vi.fn() } });
    global.__fsMock.createWriteStream.mockReturnValue(makeWriteStream({ finish: true }));

    await downloadImage(mockUrl, mockDestPath);

    expect(axiosMock).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      responseType: 'stream',
    }));
  });

  it('handles a timeout error', async () => {
    axiosMock.mockRejectedValue({ message: 'timeout of 5000ms exceeded', code: 'ECONNABORTED' });

    const result = await downloadImage(mockUrl, mockDestPath);
    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('handles an invalid URL', async () => {
    axiosMock.mockRejectedValue(new Error('Invalid URL'));

    const result = await downloadImage('not-a-valid-url', mockDestPath);
    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('propagates a writer error (the rejection is NOT swallowed by try/catch)', async () => {
    // downloadImage does `return new Promise(...)` WITHOUT await, so the inner
    // rejection is returned to the caller instead of being caught by `catch`.
    const writeErr = new Error('write failed');
    axiosMock.mockResolvedValue({ data: { pipe: vi.fn() } });
    global.__fsMock.createWriteStream.mockReturnValue(makeWriteStream({ error: writeErr }));

    let caught;
    try {
      await downloadImage(mockUrl, mockDestPath);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBe(writeErr);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('pipes the response stream into the file writer', async () => {
    const pipeFn = vi.fn();
    axiosMock.mockResolvedValue({ data: { pipe: pipeFn } });
    const ws = makeWriteStream({ finish: true });
    global.__fsMock.createWriteStream.mockReturnValue(ws);

    await downloadImage(mockUrl, mockDestPath);

    expect(pipeFn).toHaveBeenCalledWith(ws);
  });
});