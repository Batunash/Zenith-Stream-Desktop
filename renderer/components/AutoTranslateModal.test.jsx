/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AutoTranslateModal from './AutoTranslateModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

describe('AutoTranslateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.api = { invoke: vi.fn() };
  });

  const mockEpisodes = [
    { name: 'ep1.mp4', path: '/media/ep1.mp4', size: 10485760 },
    { name: 'ep2.mp4', path: '/media/ep2.mp4', size: 10485760 },
  ];

  it('renders and analyzes episodes on mount', async () => {
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze') {
        return { success: true, data: { subtitles: [{ index: 1, language: 'eng', type: 'srt' }] } };
      }
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('auto_translate.analyzing')).not.toBeInTheDocument();
      expect(screen.getByText('ep1.mp4')).toBeInTheDocument();
      expect(screen.getByText('ep2.mp4')).toBeInTheDocument();
    });
  });

  it('handles select all toggle', async () => {
    window.api.invoke.mockResolvedValue({ success: true, data: { subtitles: [] } });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());

    const selectAllBtn = screen.getByText('auto_translate.select_all');
    fireEvent.click(selectAllBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();

    fireEvent.click(screen.getByText('auto_translate.deselect_all'));
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('starts batch process on selected episodes', async () => {
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze')
        return { success: true, data: { subtitles: [{ index: 1, language: 'eng', type: 'srt' }] } };
      if (channel === 'media:translateSubtitle') return { success: true, srtPath: '/tmp/sub.srt' };
      if (channel === 'media:process') return { success: true };
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());

    // Select first episode
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    await waitFor(() => expect(checkboxes[0]).toBeChecked());

    // Start
    const startBtn = screen.getByText('auto_translate.start_batch');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(window.api.invoke).toHaveBeenCalledWith('media:translateSubtitle', expect.any(Object));
      expect(window.api.invoke).toHaveBeenCalledWith('media:process', expect.any(Object));
    });

    await waitFor(() => {
      expect(screen.getByText(/auto_translate\.summary/)).toBeInTheDocument();
    });
  });

  it('handles analysis without subtitles', async () => {
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze') return { success: true, data: { subtitles: [] } }; // empty subtitles
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('ep1.mp4')).toBeInTheDocument();
      // Should show no subtitles text or similar depending on implementation
    });
  });

  it('handles browse SRT functionality', async () => {
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze') return { success: true, data: { subtitles: [] } };
      if (channel === 'dialog:openSubtitleFile') return '/path/to/custom.srt';
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());

    // Change source to existing
    const sourceSelects = screen.getAllByRole('combobox').filter((el) => el.value === 'translate');
    fireEvent.change(sourceSelects[0], { target: { value: 'existing' } });

    // Click browse button
    const browseBtn = screen.getByText('common.select');
    fireEvent.click(browseBtn);

    await waitFor(() => {
      expect(window.api.invoke).toHaveBeenCalledWith('dialog:openSubtitleFile');
    });
  });

  it('throws error when starting with existing source but no SRT path', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze') return { success: true, data: { subtitles: [] } };
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    await waitFor(() => expect(checkboxes[0]).toBeChecked());

    // Change source to existing
    const sourceSelects = screen.getAllByRole('combobox').filter((el) => el.value === 'translate');
    fireEvent.change(sourceSelects[0], { target: { value: 'existing' } });

    fireEvent.click(screen.getByText('auto_translate.start_batch'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AutoTranslate] error for',
        'ep1.mp4',
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });

  it('processes with existing SRT successfully', async () => {
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze') return { success: true, data: { subtitles: [] } };
      if (channel === 'media:process') return { success: true };
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    await waitFor(() => expect(checkboxes[0]).toBeChecked());

    // Change source to existing
    const sourceSelects = screen.getAllByRole('combobox').filter((el) => el.value === 'translate');
    fireEvent.change(sourceSelects[0], { target: { value: 'existing' } });

    // Input an existing path
    const inputs = screen.getAllByPlaceholderText('auto_translate.existing_placeholder');
    fireEvent.change(inputs[0], { target: { value: '/tmp/existing.srt' } });

    fireEvent.click(screen.getByText('auto_translate.start_batch'));

    await waitFor(() => {
      expect(window.api.invoke).toHaveBeenCalledWith('media:process', {
        filePath: '/media/ep1.mp4',
        userPreferences: {
          selectedIndices: [],
          externalSubtitle: '/tmp/existing.srt',
        },
      });
    });
  });

  it('handles exception in startProcess', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze')
        return { success: true, data: { subtitles: [{ index: 1, language: 'eng', type: 'srt' }] } };
      if (channel === 'media:translateSubtitle') throw new Error('Network Error');
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    await waitFor(() => expect(checkboxes[0]).toBeChecked());

    fireEvent.click(screen.getByText('auto_translate.start_batch'));

    await waitFor(() => {
      expect(screen.getByText(/auto_translate\.summary/)).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AutoTranslate] error for',
        'ep1.mp4',
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });

  it('handles target language change', async () => {
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze')
        return { success: true, data: { subtitles: [{ index: 1, language: 'eng', type: 'srt' }] } };
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());

    const selects = screen.getAllByRole('combobox');
    // The first combobox is the target language select
    const select = selects[0];
    fireEvent.change(select, { target: { value: 'en' } });
    expect(select.value).toBe('en');
  });

  it('handles subtitle index change', async () => {
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze')
        return { success: true, data: { subtitles: [{ index: 1, language: 'eng', type: 'srt' }] } };
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());

    // Get the subtitle selection combobox (which is rendered when sourceType is 'translate')
    const subSelects = screen.getAllByDisplayValue('— auto_translate.select_source —');
    fireEvent.change(subSelects[0], { target: { value: '1' } });
    expect(subSelects[0].value).toBe('1');

    // Also test the empty string path
    fireEvent.change(subSelects[0], { target: { value: '' } });
    expect(subSelects[0].value).toBe('');
  });

  it('handles exception in analyzeAll on mount', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.api.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'media:analyze') throw new Error('Analyze Error');
      return {};
    });

    render(
      <MemoryRouter>
        <AutoTranslateModal seriesName="Test Series" episodes={mockEpisodes} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument());
    expect(consoleSpy).toHaveBeenCalledWith(
      '[AutoTranslate] analyze error for',
      'ep1.mp4',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
