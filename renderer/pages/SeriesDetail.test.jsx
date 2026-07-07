/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SeriesDetail from './SeriesDetail';

// --- Stub the 7 presentational children. Each stub renders its props as plain
// data and exposes one button per callback, so every SeriesDetail handler is
// directly clickable without depending on the real children's UI or mount
// effects (e.g. ConversionModal calls `media:analyze` on mount and references an
// undefined `t`, which would throw if rendered for real). Index-based testids
// avoid special characters in paths/season names.
vi.mock('../components/SeriesBanner', () => ({
  default: ({ metadata, seasonCount, onBack, onAutoTranslate }) => (
    <div data-testid="series-banner">
      <span data-testid="banner-title">{metadata?.title ?? ''}</span>
      <span data-testid="banner-season-count">{String(seasonCount)}</span>
      <button data-testid="banner-back" onClick={onBack}>
        back
      </button>
      <button data-testid="banner-auto-translate" onClick={onAutoTranslate}>
        auto
      </button>
    </div>
  ),
}));
vi.mock('../components/SeasonList', () => ({
  default: ({ seasons, activeSeason, onSelect, onAdd, onDelete }) => (
    <div data-testid="season-list">
      <span data-testid="active-season">{activeSeason ?? ''}</span>
      {seasons.map((s, i) => (
        <div key={s} data-testid={`season-${i}`}>
          <span>{s}</span>
          <button data-testid={`select-${i}`} onClick={() => onSelect(s)}>
            select
          </button>
          <button data-testid={`delete-season-${i}`} onClick={() => onDelete(s)}>
            x
          </button>
        </div>
      ))}
      <button data-testid="add-season" onClick={onAdd}>
        add
      </button>
    </div>
  ),
}));
vi.mock('../components/EpisodeList', () => ({
  default: ({
    episodes,
    onUpload,
    onDelete,
    onConvert,
    onTranslate,
    conversionState,
    uploadDisabled,
  }) => (
    <div data-testid="episode-list">
      <button data-testid="upload-btn" onClick={onUpload} disabled={!!uploadDisabled}>
        upload
      </button>
      {episodes.map((ep, i) => (
        <div key={ep.path} data-testid={`ep-${i}`}>
          <span>{ep.name}</span>
          <button data-testid={`ep-del-${i}`} onClick={() => onDelete(ep.path)}>
            del
          </button>
          <button data-testid={`ep-convert-${i}`} onClick={() => onConvert(ep)}>
            convert
          </button>
          <button data-testid={`ep-translate-${i}`} onClick={() => onTranslate(ep)}>
            translate
          </button>
          <span data-testid={`ep-conv-${i}`}>{conversionState?.[ep.path]?.progress ?? '-'}</span>
        </div>
      ))}
    </div>
  ),
}));
vi.mock('../components/TransferList', () => ({
  default: ({ transfers }) => (
    <div data-testid="transfer-list">
      {Object.entries(transfers || {}).map(([file, t]) => (
        <div key={file} data-testid={`transfer-${file}`}>
          {t.percent}:{t.status}
          {t.error ? `:${t.error}` : ''}
        </div>
      ))}
    </div>
  ),
}));
vi.mock('../components/ConversionModal', () => ({
  default: ({ filePath, onClose, onStart }) => (
    <div data-testid="conversion-modal">
      <span data-testid="conv-file">{filePath}</span>
      <button data-testid="conv-start" onClick={() => onStart({ format: 'mp4' })}>
        start
      </button>
      <button data-testid="conv-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));
vi.mock('../components/TranslateSubtitleModal', () => ({
  default: ({ videoPath, onClose }) => (
    <div data-testid="translate-modal">
      <span data-testid="translate-file">{videoPath}</span>
      <button data-testid="translate-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));
vi.mock('../components/AutoTranslateModal', () => ({
  default: ({ seriesName, episodes, onClose }) => (
    <div data-testid="auto-translate-modal">
      <span data-testid="auto-name">{seriesName}</span>
      <span data-testid="auto-eps">{String(episodes.length)}</span>
      <button data-testid="auto-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

const FOLDER = 'TestShow';

let mockInvoke, receiveCbs, mockRemove;

beforeEach(() => {
  vi.clearAllMocks();
  receiveCbs = {};
  mockInvoke = vi.fn(async (channel) => {
    if (channel === 'file:getSeriesDetail')
      return { title: 'Test Show', type: 'serie', seasons: ['Season 1', 'Season 2'] };
    if (channel === 'file:getEpisodes') return [];
    return { success: true, isExist: true };
  });
  mockRemove = vi.fn();
  window.api = {
    invoke: mockInvoke,
    receive: vi.fn((ch, cb) => {
      receiveCbs[ch] = cb;
      return vi.fn();
    }),
    remove: mockRemove,
  };
  window.confirm = vi.fn(() => true);
  window.alert = vi.fn();
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/series/${FOLDER}`]}>
      <Routes>
        <Route path="/series/:folderName" element={<SeriesDetail />} />
      </Routes>
    </MemoryRouter>
  );

// Wait for the detail fetch + the first-season episodes fetch to settle.
const settled = () =>
  waitFor(() => {
    expect(mockInvoke).toHaveBeenCalledWith('file:getSeriesDetail', FOLDER);
    expect(mockInvoke).toHaveBeenCalledWith('file:getEpisodes', {
      folderName: FOLDER,
      season: 'Season 1',
    });
  });

const countCh = (ch) => mockInvoke.mock.calls.filter((c) => c[0] === ch).length;

describe('SeriesDetail - rendering & data loading', () => {
  it('renders the loading screen first, then seasons + episodes after fetch', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'Test Show', type: 'serie', seasons: ['Season 1', 'Season 2'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1.mp4', path: 'p1' }];
      return null;
    });
    renderPage();
    expect(screen.getByText('common.loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('season-0')).toBeInTheDocument());
    expect(screen.getByTestId('season-1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('E1.mp4')).toBeInTheDocument());
    expect(screen.getByTestId('banner-title').textContent).toBe('Test Show');
    expect(screen.getByTestId('banner-season-count').textContent).toBe('2');
    expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    expect(mockInvoke).toHaveBeenCalledWith('file:getEpisodes', {
      folderName: FOLDER,
      season: 'Season 1',
    });
  });

  it('auto-selects the first season and fetches its episodes', async () => {
    renderPage();
    await settled();
    expect(screen.getByTestId('active-season').textContent).toBe('Season 1');
  });

  it('with no seasons, falls to the else branch: loading off, no episode fetch', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail') return { title: 'Empty', type: 'serie', seasons: [] };
      return [];
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('season-list')).toBeInTheDocument());
    expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(/season-\d/)).toHaveLength(0);
    expect(mockInvoke).not.toHaveBeenCalledWith('file:getEpisodes', expect.anything());
  });

  it('alerts and redirects to "/" when the detail returns an error', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail') return { error: 'Not found' };
      return null;
    });
    renderPage();
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('detail.not_found'));
    expect(screen.queryByTestId('series-banner')).not.toBeInTheDocument();
  });

  it('logs to console.error when getSeriesDetail rejects', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail') throw new Error('boom');
      return null;
    });
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(screen.queryByTestId('series-banner')).not.toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('SeriesDetail - season switching', () => {
  it('refetches episodes when a different season is selected', async () => {
    mockInvoke.mockImplementation(async (ch, args) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'Test Show', type: 'serie', seasons: ['Season 1', 'Season 2'] };
      if (ch === 'file:getEpisodes')
        return args.season === 'Season 2'
          ? [{ name: 'S2E1', path: 's2e1' }]
          : [{ name: 'S1E1', path: 's1e1' }];
      return null;
    });
    renderPage();
    await settled();
    expect(screen.getByText('S1E1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('select-1'));
    await waitFor(() => expect(screen.getByText('S2E1')).toBeInTheDocument());
    expect(mockInvoke).toHaveBeenCalledWith('file:getEpisodes', {
      folderName: FOLDER,
      season: 'Season 2',
    });
    expect(screen.getByTestId('active-season').textContent).toBe('Season 2');
  });
});

describe('SeriesDetail - add season', () => {
  it('parses the max season number and creates the next, then activates it', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [];
      return { success: true, isExist: true };
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('season-0')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-season'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:createSeason', {
        serieName: FOLDER,
        seasonId: 'Season 2',
      })
    );
    await waitFor(() => expect(screen.getByTestId('active-season').textContent).toBe('Season 2'));
    expect(screen.getByTestId('season-1')).toBeInTheDocument();
  });

  it('creates "Season 1" when there are no existing seasons', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail') return { title: 'S', type: 'serie', seasons: [] };
      if (ch === 'file:getEpisodes') return [];
      return { success: true, isExist: true };
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('season-list')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-season'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:createSeason', {
        serieName: FOLDER,
        seasonId: 'Season 1',
      })
    );
    expect(screen.getByTestId('season-0')).toBeInTheDocument();
    expect(screen.getByTestId('active-season').textContent).toBe('Season 1');
  });

  it('alerts the error message when createSeason returns isExist:false', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [];
      if (ch === 'file:createSeason')
        return { success: false, isExist: false, message: 'Duplicate' };
      return null;
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('season-0')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-season'));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('common.error: Duplicate'));
  });
});

describe('SeriesDetail - delete season', () => {
  it('deletes the active season, resets active to the first remaining + clears episodes', async () => {
    mockInvoke.mockImplementation(async (ch, args) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1', 'Season 2'] };
      if (ch === 'file:getEpisodes')
        return args.season === 'Season 2'
          ? [{ name: 'S2E1', path: 's2e1' }]
          : [{ name: 'S1E1', path: 's1e1' }];
      if (ch === 'file:deleteSeason') return { success: true };
      return null;
    });
    renderPage();
    await settled();
    expect(screen.getByText('S1E1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('delete-season-0'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:deleteSeason', {
        folderName: FOLDER,
        season: 'Season 1',
      })
    );
    expect(screen.queryByText('Season 1')).not.toBeInTheDocument();
    expect(screen.getByTestId('active-season').textContent).toBe('Season 2');
  });

  it('deleting a non-active season keeps the active season unchanged', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1', 'Season 2'] };
      if (ch === 'file:getEpisodes') return [{ name: 'S1E1', path: 's1e1' }];
      if (ch === 'file:deleteSeason') return { success: true };
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('delete-season-1'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:deleteSeason', {
        folderName: FOLDER,
        season: 'Season 2',
      })
    );
    expect(screen.queryByText('Season 2')).not.toBeInTheDocument();
    expect(screen.getByTestId('active-season').textContent).toBe('Season 1');
    expect(screen.getByText('S1E1')).toBeInTheDocument();
  });

  it('does not invoke deleteSeason when confirm is dismissed', async () => {
    renderPage();
    await settled();
    window.confirm = vi.fn(() => false);
    fireEvent.click(screen.getByTestId('delete-season-0'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockInvoke).not.toHaveBeenCalledWith('file:deleteSeason', expect.anything());
  });

  it('makes no state change when deleteSeason returns success:false', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1', 'Season 2'] };
      if (ch === 'file:getEpisodes') return [];
      if (ch === 'file:deleteSeason') return { success: false };
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('delete-season-0'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:deleteSeason', expect.anything())
    );
    expect(screen.getByTestId('season-0')).toBeInTheDocument();
    expect(screen.getByTestId('season-1')).toBeInTheDocument();
  });
});

describe('SeriesDetail - upload episode', () => {
  it('alerts the select-season warning and returns when there is no active season', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail') return { title: 'S', type: 'serie', seasons: [] };
      if (ch === 'file:getEpisodes') return [];
      return null;
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('upload-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('upload-btn'));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('detail.select_season_warn'));
    expect(mockInvoke).not.toHaveBeenCalledWith('dialog:openVideoFiles', expect.anything());
    expect(mockInvoke).not.toHaveBeenCalledWith('file:addEpisode', expect.anything());
  });

  it('opens the dialog with multiSelections:true for a serie and adds episodes', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [];
      if (ch === 'dialog:openVideoFiles') return ['p1', 'p2'];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('upload-btn'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('dialog:openVideoFiles', { multiSelections: true })
    );
    expect(mockInvoke).toHaveBeenCalledWith('file:addEpisode', {
      serieName: FOLDER,
      seasonId: 'Season 1',
      videos: [{ path: 'p1' }, { path: 'p2' }],
    });
    expect(screen.getByTestId('transfer-p1').textContent).toBe('0:pending');
    expect(screen.getByTestId('transfer-p2').textContent).toBe('0:pending');
  });

  it('opens the dialog with multiSelections:false for a movie', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'M', type: 'movie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [];
      if (ch === 'dialog:openVideoFiles') return ['p9'];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('upload-btn'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('dialog:openVideoFiles', { multiSelections: false })
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      'file:addEpisode',
      expect.objectContaining({ videos: [{ path: 'p9' }] })
    );
  });

  it('disables the upload button for a movie that already has 1 episode', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'M', type: 'movie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    expect(screen.getByTestId('upload-btn')).toBeDisabled();
  });

  it('returns early when the dialog returns an empty file list', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [];
      if (ch === 'dialog:openVideoFiles') return [];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('upload-btn'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockInvoke).not.toHaveBeenCalledWith('file:addEpisode', expect.anything());
    expect(screen.queryByTestId('transfer-p1')).not.toBeInTheDocument();
  });

  it('returns early when the dialog returns null', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [];
      if (ch === 'dialog:openVideoFiles') return null;
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('upload-btn'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockInvoke).not.toHaveBeenCalledWith('file:addEpisode', expect.anything());
  });
});

describe('SeriesDetail - delete episode', () => {
  it('removes the episode from the list on success', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      if (ch === 'file:deleteEpisode') return { success: true };
      return null;
    });
    renderPage();
    await settled();
    expect(screen.getByText('E1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ep-del-0'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('file:deleteEpisode', 'p1'));
    expect(screen.queryByText('E1')).not.toBeInTheDocument();
  });

  it('does not invoke deleteEpisode when confirm is dismissed', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    window.confirm = vi.fn(() => false);
    fireEvent.click(screen.getByTestId('ep-del-0'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockInvoke).not.toHaveBeenCalledWith('file:deleteEpisode', expect.anything());
  });
});

describe('SeriesDetail - conversion', () => {
  it('opens the conversion modal with the episode path', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    expect(screen.queryByTestId('conversion-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ep-convert-0'));
    expect(screen.getByTestId('conversion-modal')).toBeInTheDocument();
    expect(screen.getByTestId('conv-file').textContent).toBe('p1');
  });

  it('on success invokes media:process, clears conversion state, and refetches episodes', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('ep-convert-0'));
    const before = countCh('file:getEpisodes');
    fireEvent.click(screen.getByTestId('conv-start'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('media:process', {
        filePath: 'p1',
        userPreferences: { format: 'mp4' },
      })
    );
    await waitFor(() => expect(countCh('file:getEpisodes')).toBe(before + 1));
    expect(screen.queryByTestId('conversion-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('ep-conv-0').textContent).toBe('-');
  });

  it('on failure logs to console.error and keeps the processing entry', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      if (ch === 'media:process') throw new Error('boom');
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('ep-convert-0'));
    const before = countCh('file:getEpisodes');
    fireEvent.click(screen.getByTestId('conv-start'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(countCh('file:getEpisodes')).toBe(before);
    expect(screen.getByTestId('ep-conv-0').textContent).toBe('0');
    spy.mockRestore();
  });

  it('closes the conversion modal via the close button', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('ep-convert-0'));
    expect(screen.getByTestId('conversion-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('conv-close'));
    await waitFor(() => expect(screen.queryByTestId('conversion-modal')).not.toBeInTheDocument());
  });
});

describe('SeriesDetail - translate', () => {
  it('opens the translate modal with the episode path', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('ep-translate-0'));
    expect(screen.getByTestId('translate-modal')).toBeInTheDocument();
    expect(screen.getByTestId('translate-file').textContent).toBe('p1');
  });

  it('closes the translate modal via the close button', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('ep-translate-0'));
    fireEvent.click(screen.getByTestId('translate-close'));
    await waitFor(() => expect(screen.queryByTestId('translate-modal')).not.toBeInTheDocument());
  });
});

describe('SeriesDetail - auto-translate', () => {
  it('opens the auto-translate modal with the title + episode count', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'Test Show', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('banner-auto-translate'));
    expect(screen.getByTestId('auto-translate-modal')).toBeInTheDocument();
    expect(screen.getByTestId('auto-name').textContent).toBe('Test Show');
    expect(screen.getByTestId('auto-eps').textContent).toBe('1');
  });

  it('falls back to folderName when metadata has no title', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail') return { type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [];
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('banner-auto-translate'));
    expect(screen.getByTestId('auto-name').textContent).toBe(FOLDER);
  });

  it('closes the auto-translate modal via the close button', async () => {
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('banner-auto-translate'));
    fireEvent.click(screen.getByTestId('auto-close'));
    await waitFor(() =>
      expect(screen.queryByTestId('auto-translate-modal')).not.toBeInTheDocument()
    );
  });
});

describe('SeriesDetail - banner navigation', () => {
  it('navigates to "/" via the banner back button', async () => {
    renderPage();
    await settled();
    expect(screen.getByTestId('series-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('banner-back'));
    await waitFor(() => expect(screen.queryByTestId('series-banner')).not.toBeInTheDocument());
  });
});

describe('SeriesDetail - IPC listeners', () => {
  it('file:addEpisode:progress updates the transfer percent + status', async () => {
    renderPage();
    await settled();
    act(() => {
      receiveCbs['file:addEpisode:progress']?.({ file: 'p9', percent: 42 });
    });
    await waitFor(() =>
      expect(screen.getByTestId('transfer-p9').textContent).toBe('42:transferring')
    );
  });

  it('file:addEpisode:done with error sets error status and does NOT refetch episodes', async () => {
    renderPage();
    await settled();
    const before = countCh('file:getEpisodes');
    act(() => {
      receiveCbs['file:addEpisode:done']?.({ file: 'p9', error: 'boom' });
    });
    await waitFor(() =>
      expect(screen.getByTestId('transfer-p9').textContent).toBe('100:error:boom')
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(countCh('file:getEpisodes')).toBe(before);
  });

  it('file:addEpisode:done without error sets completed status and refetches episodes', async () => {
    renderPage();
    await settled();
    const before = countCh('file:getEpisodes');
    act(() => {
      receiveCbs['file:addEpisode:done']?.({ file: 'p9' });
    });
    await waitFor(() =>
      expect(screen.getByTestId('transfer-p9').textContent).toBe('100:completed')
    );
    await waitFor(() => expect(countCh('file:getEpisodes')).toBe(before + 1));
  });

  it('media:progress updates the conversion state for the matching file', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      return null;
    });
    renderPage();
    await settled();
    expect(screen.getByTestId('ep-conv-0').textContent).toBe('-');
    act(() => {
      receiveCbs['media:progress']?.({ filePath: 'p1', percent: 75 });
    });
    await waitFor(() => expect(screen.getByTestId('ep-conv-0').textContent).toBe('75'));
  });
});

describe('SeriesDetail - unmount cleanup', () => {
  it('removes all three IPC listeners on unmount', async () => {
    const { unmount } = renderPage();
    await settled();
    const before = mockRemove.mock.calls.length;
    unmount();
    expect(mockRemove.mock.calls.length).toBe(before + 3);
    const removed = mockRemove.mock.calls.map((c) => c[0]);
    expect(removed).toContain('file:addEpisode:progress');
    expect(removed).toContain('file:addEpisode:done');
    expect(removed).toContain('media:progress');
  });
});

describe('SeriesDetail - branch coverage edges', () => {
  it('covers the || 0 fallback in the season-number sort comparator via no-digit names', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Alpha', 'Beta'] };
      if (ch === 'file:getEpisodes') return [];
      return { success: true, isExist: true };
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('season-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-season'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:createSeason', {
        serieName: FOLDER,
        seasonId: 'Season 1',
      })
    );
    await waitFor(() => expect(screen.getByTestId('active-season').textContent).toBe('Season 1'));
  });

  it('resets activeSeason to null when deleting the only remaining season', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      if (ch === 'file:deleteSeason') return { success: true };
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('delete-season-0'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:deleteSeason', {
        folderName: FOLDER,
        season: 'Season 1',
      })
    );
    expect(screen.queryAllByTestId(/season-\d/)).toHaveLength(0);
    expect(screen.getByTestId('active-season').textContent).toBe('');
  });

  it('leaves the episode list unchanged when deleteEpisode returns success:false', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail')
        return { title: 'S', type: 'serie', seasons: ['Season 1'] };
      if (ch === 'file:getEpisodes') return [{ name: 'E1', path: 'p1' }];
      if (ch === 'file:deleteEpisode') return { success: false };
      return null;
    });
    renderPage();
    await settled();
    fireEvent.click(screen.getByTestId('ep-del-0'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('file:deleteEpisode', 'p1'));
    expect(screen.getByText('E1')).toBeInTheDocument();
  });

  it('covers the || [] fallback when the detail payload omits the seasons key', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:getSeriesDetail') return { title: 'NoSeasonsField', type: 'serie' };
      if (ch === 'file:getEpisodes') return [];
      return null;
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('season-list')).toBeInTheDocument());
    expect(screen.queryAllByTestId(/season-\d/)).toHaveLength(0);
    expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith('file:getEpisodes', expect.anything());
  });
});
