import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TranslateSubtitleForm from './TranslateSubtitleForm';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('TranslateSubtitleForm Component', () => {
  const mockAnalysis = {
    subtitles: [
      { index: 0, type: 'srt', language: 'eng', title: 'English' },
      { index: 1, type: 'pgs', language: 'ger' }, // unsupported
    ],
  };

  beforeEach(() => {
    window.api = {
      receive: vi.fn(),
      remove: vi.fn(),
      invoke: vi.fn().mockResolvedValue({ success: true, srtPath: 'test.srt' }),
    };
  });

  it('renders warning if no text subtitles available', () => {
    render(
      <TranslateSubtitleForm
        analysis={{ subtitles: [{ index: 0, type: 'pgs', language: 'eng' }] }}
      />
    );
    expect(screen.getByText('translate.no_text_subs')).toBeInTheDocument();
  });

  it('renders form and can select languages', async () => {
    render(<TranslateSubtitleForm videoPath="test.mp4" analysis={mockAnalysis} />);

    // Default source should be auto-selected (eng is available)
    const sourceSelect = screen.getAllByRole('combobox')[0];
    expect(sourceSelect.value).toBe('0');

    // Default target is 'en'
    const targetSelect = screen.getAllByRole('combobox')[1];
    expect(targetSelect.value).toBe('en');

    // Change target to 'tr'
    fireEvent.change(targetSelect, { target: { value: 'tr' } });
    expect(targetSelect.value).toBe('tr');

    // Click translate
    const translateBtn = screen.getByRole('button');
    fireEvent.click(translateBtn);

    expect(window.api.invoke).toHaveBeenCalledWith(
      'media:translateSubtitle',
      expect.objectContaining({
        targetLang: 'tr',
      })
    );
  });

  it('handles source selection change', () => {
    render(<TranslateSubtitleForm videoPath="test.mp4" analysis={mockAnalysis} />);
    const sourceSelect = screen.getAllByRole('combobox')[0];

    // Change source to empty and verify error
    act(() => {
      fireEvent.change(sourceSelect, { target: { value: '' } });
    });
    expect(sourceSelect.value).toBe('');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /translate_btn/i }));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /translate_btn/i }));
    });

    // The option uses this text, and the error banner uses this text.
    // So there should be 2 instances if the error banner is shown.
    const warnings = screen.getAllByText(/translate\.select_source/i);
    expect(warnings.length).toBeGreaterThan(1);
  });

  it('handles target language change and NO_KEY error', async () => {
    window.api.invoke.mockResolvedValueOnce({ success: false, code: 'NO_KEY' });
    render(<TranslateSubtitleForm videoPath="test.mp4" analysis={mockAnalysis} />);

    const targetSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(targetSelect, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /translate_btn/i }));
    expect(screen.getByText('translate.select_target')).toBeInTheDocument();

    // Now set target and trigger NO_KEY
    fireEvent.change(targetSelect, { target: { value: 'tr' } });
    fireEvent.click(screen.getByRole('button', { name: /translate_btn/i }));

    // Wait for the async API invoke
    await screen.findByText('translate.no_key_warning');

    // Click settings button
    const settingsBtn = screen.getByRole('button', { name: /open_settings/i });
    fireEvent.click(settingsBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('handles standard errors', async () => {
    window.api.invoke.mockResolvedValueOnce({ success: false, error: 'Custom Error' });
    render(<TranslateSubtitleForm videoPath="test.mp4" analysis={mockAnalysis} />);

    fireEvent.click(screen.getByRole('button', { name: /translate_btn/i }));
    await screen.findByText('Custom Error');
  });

  it('handles fallback error if no error string provided', async () => {
    window.api.invoke.mockResolvedValueOnce({ success: false });
    render(<TranslateSubtitleForm videoPath="test.mp4" analysis={mockAnalysis} />);

    fireEvent.click(screen.getByRole('button', { name: /translate_btn/i }));
    await screen.findByText('common.error');
  });

  it('receives IPC progress events and updates stage correctly', () => {
    let progressCallback = null;
    window.api.receive.mockImplementation((channel, cb) => {
      if (channel === 'media:translateSubtitle:progress') {
        progressCallback = cb;
      }
    });

    render(<TranslateSubtitleForm videoPath="test.mp4" analysis={mockAnalysis} />);

    const translateBtn = screen.getByRole('button', { name: /translate_btn/i });
    act(() => {
      fireEvent.click(translateBtn);
    });

    act(() => {
      progressCallback({ stage: 'extract', percent: 10 });
    });
    expect(screen.getAllByText(/translate\.extracting/i).length).toBeGreaterThan(0);

    act(() => {
      progressCallback({ stage: 'waiting', reason: 'rate_limit', retryIn: 5 });
    });
    expect(screen.getAllByText(/translate\.waiting_rate/i).length).toBeGreaterThan(0);

    act(() => {
      progressCallback({ stage: 'waiting', reason: 'pace', retryIn: 2 });
    });
    expect(screen.getAllByText(/translate\.waiting_pace/i).length).toBeGreaterThan(0);

    act(() => {
      progressCallback({ stage: 'translate', percent: 50 });
    });
    expect(screen.getAllByText(/translate\.translating/i).length).toBeGreaterThan(0);

    act(() => {
      progressCallback({ stage: 'translate', percent: 50, batchIndex: 1, batchTotal: 5 });
    });
    expect(screen.getAllByText(/translate\.translating_batch/i).length).toBeGreaterThan(0);

    // Unknown stage fallback
    act(() => {
      progressCallback({ stage: 'unknown_stage_test' });
    });
    // No specific text to assert, just checking it doesn't throw and covers the default case
  });
});
