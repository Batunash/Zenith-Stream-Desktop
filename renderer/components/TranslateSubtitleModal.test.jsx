/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import TranslateSubtitleModal from './TranslateSubtitleModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

// Mock the child form to simplify modal test
vi.mock('./TranslateSubtitleForm', () => ({
  default: ({ videoPath, analysis }) => (
    <div data-testid="translate-form">
      Form for {videoPath} - Subs: {analysis?.subtitles?.length || 0}
    </div>
  ),
}));

describe('TranslateSubtitleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.api = { invoke: vi.fn() };
  });

  it('renders loading state initially if no preset analysis is provided', async () => {
    // mock to resolve slowly
    window.api.invoke.mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ success: true, data: { subtitles: [] } }), 100))
    );

    render(<TranslateSubtitleModal videoPath="/my/video.mp4" onClose={vi.fn()} />);

    expect(screen.getByText('translate.title')).toBeInTheDocument();
    expect(screen.getByText('video.mp4')).toBeInTheDocument();
    expect(screen.getByText('common.loading')).toBeInTheDocument();

    // Wait for resolve
    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('translate-form')).toBeInTheDocument();
    });
  });

  it('renders form immediately if preset analysis is provided', () => {
    const preset = { subtitles: [1, 2] };
    render(
      <TranslateSubtitleModal videoPath="/my/video.mp4" presetAnalysis={preset} onClose={vi.fn()} />
    );

    expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('translate-form')).toHaveTextContent('Subs: 2');
    expect(window.api.invoke).not.toHaveBeenCalled();
  });

  it('handles close button', () => {
    const handleClose = vi.fn();
    render(
      <TranslateSubtitleModal videoPath="/my/video.mp4" presetAnalysis={{}} onClose={handleClose} />
    );

    // Find close button by standard icon class or role if possible. In component it's a button with FaTimes.
    // We can just grab the first button (since the header has a close button)
    const closeBtns = screen.getAllByRole('button');
    fireEvent.click(closeBtns[0]);

    expect(handleClose).toHaveBeenCalled();
  });

  it('handles API errors gracefully during analysis', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.api.invoke.mockRejectedValueOnce(new Error('Network error'));

    render(<TranslateSubtitleModal videoPath="/my/video.mp4" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(console.error).toHaveBeenCalledWith(expect.any(Error));
  });
});
