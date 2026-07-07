/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AddSeriesPage from './AddSerie';
import { fetchSeriesByImdb } from '../services/tmdbService';
import { extractImdbId } from '../utils/formatters';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

vi.mock('../services/tmdbService', () => ({
  fetchSeriesByImdb: vi.fn(),
}));

vi.mock('../utils/formatters', () => ({
  extractImdbId: vi.fn(),
}));

const mockInvoke = vi.fn();
const alertMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.api = { invoke: mockInvoke };
  // Default: TMDB key present (len > 10) -> auto tab enabled on mount.
  mockInvoke.mockImplementation(async (ch) => {
    if (ch === 'settings:get') return { TMDB_API_KEY: 'valid_api_key_for_testing' };
    if (ch === 'file:createSerie') return { success: true };
    if (ch === 'dialog:openFileImage') return null;
    return null;
  });
  extractImdbId.mockReturnValue('tt0000001');
  fetchSeriesByImdb.mockResolvedValue(null);
  window.alert = alertMock;
});

const renderPage = () =>
  render(
    <BrowserRouter>
      <AddSeriesPage />
    </BrowserRouter>
  );

// Wait for the mount effect (settings:get) to settle, then the link input is
// present on the auto tab (hasApiKey true).
const settleAuto = () =>
  waitFor(() =>
    expect(screen.getByPlaceholderText('add_series.link_placeholder')).toBeInTheDocument()
  );

// Drive the auto-tab fetch flow: render, type a link, click fetch, await preview.
const doFetch = async (responseData) => {
  const utils = renderPage();
  await settleAuto();
  fireEvent.change(screen.getByPlaceholderText('add_series.link_placeholder'), {
    target: { value: 'http://imdb.com/title/tt1234567' },
  });
  if (responseData !== undefined) fetchSeriesByImdb.mockResolvedValue(responseData);
  fireEvent.click(screen.getByText('add_series.fetch_btn'));
  if (responseData)
    await waitFor(() => expect(screen.getByText(responseData.title)).toBeInTheDocument());
  else
    await waitFor(() =>
      expect(screen.getByPlaceholderText('add_series.link_placeholder')).toBeInTheDocument()
    );
  return utils;
};

describe('AddSeriesPage - mount & settings effect', () => {
  it('enables the link tab when TMDB_API_KEY is present and > 10 chars', async () => {
    renderPage();
    await settleAuto();
    const linkTab = screen.getByText('🔗 add_series.tab_link').closest('button');
    expect(linkTab).not.toBeDisabled();
  });

  it('falls back to VITE_TMDB_API_KEY when TMDB_API_KEY is missing (|| second operand)', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return { VITE_TMDB_API_KEY: 'valid_vite_key_for_testing' };
      return null;
    });
    renderPage();
    await settleAuto();
    expect(screen.getByText('🔗 add_series.tab_link').closest('button')).not.toBeDisabled();
  });

  it('defaults to the manual tab when no API key is configured (hasKey false)', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      return null;
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    expect(screen.getByText('🔗 add_series.tab_link').closest('button')).toBeDisabled();
    expect(screen.queryByPlaceholderText('add_series.link_placeholder')).not.toBeInTheDocument();
  });

  it('treats a short key (<= 10 chars) as no key and defaults to manual', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return { TMDB_API_KEY: 'short' };
      return null;
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    expect(screen.getByText('🔗 add_series.tab_link').closest('button')).toBeDisabled();
  });
});

describe('AddSeriesPage - handleFetch', () => {
  it('shows error_link and skips loading when extractImdbId returns null', async () => {
    extractImdbId.mockReturnValue(null);
    renderPage();
    await settleAuto();
    fireEvent.change(screen.getByPlaceholderText('add_series.link_placeholder'), {
      target: { value: 'invalid_link' },
    });
    fireEvent.click(screen.getByText('add_series.fetch_btn'));
    await waitFor(() => expect(screen.getByText('add_series.error_link')).toBeInTheDocument());
    // setLoading(true) is gated AFTER the imdbId check, so loading stays false (button label stays the fetch text).
    expect(screen.getByText('add_series.fetch_btn')).toBeInTheDocument();
  });

  it('fetches and shows the preview for a serie (contentType stays serie)', async () => {
    await doFetch({
      title: 'Test Show',
      rating: '8.5',
      overview: 'Test overview',
      image: 'http://test.com/image.jpg',
      type: 'serie',
      numberOfSeasons: 2,
    });
    expect(screen.getByText('Test Show')).toBeInTheDocument();
    expect(screen.getByText('Test overview')).toBeInTheDocument();
    expect(screen.getByText(/IMDB:/)).toBeInTheDocument();
    expect(fetchSeriesByImdb).toHaveBeenCalledWith('tt0000001');
  });

  it('sets contentType to movie when fetched data type is movie', async () => {
    await doFetch({
      title: 'Movie Title',
      rating: '7.0',
      overview: 'An overview',
      image: 'http://test.com/m.jpg',
      type: 'movie',
      numberOfSeasons: 5,
    });
    expect(screen.getByText('Movie Title')).toBeInTheDocument();
  });

  it('shows error_not_found when fetchSeriesByImdb returns null', async () => {
    renderPage();
    await settleAuto();
    fireEvent.change(screen.getByPlaceholderText('add_series.link_placeholder'), {
      target: { value: 'http://imdb.com/title/tt9999999' },
    });
    fetchSeriesByImdb.mockResolvedValue(null);
    fireEvent.click(screen.getByText('add_series.fetch_btn'));
    await waitFor(() => expect(screen.getByText('add_series.error_not_found')).toBeInTheDocument());
  });

  it('shows common.error and clears loading when fetchSeriesByImdb rejects', async () => {
    renderPage();
    await settleAuto();
    fireEvent.change(screen.getByPlaceholderText('add_series.link_placeholder'), {
      target: { value: 'http://imdb.com/title/tt9999999' },
    });
    fetchSeriesByImdb.mockRejectedValue(new Error('network'));
    fireEvent.click(screen.getByText('add_series.fetch_btn'));
    await waitFor(() => expect(screen.getByText('common.error')).toBeInTheDocument());
    // finally ran -> loading false -> fetch button label restored.
    expect(screen.getByText('add_series.fetch_btn')).toBeInTheDocument();
  });
});

describe('AddSeriesPage - saveAuto', () => {
  const fetchedSerie = {
    title: 'Auto Serie',
    rating: '8.0',
    overview: 'O',
    image: 'http://test.com/s.jpg',
    type: 'serie',
    numberOfSeasons: 2,
  };

  it('saves a serie with numberOfSeasons from fetchedData and navigates', async () => {
    await doFetch(fetchedSerie);
    fireEvent.click(screen.getByText('add_series.add_this_serie'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:createSerie', {
        serieName: 'Auto Serie',
        metadata: expect.objectContaining({
          type: 'serie',
          numberOfSeasons: 2,
          title: 'Auto Serie',
        }),
      })
    );
    expect(alertMock).toHaveBeenCalledWith('add_series.success_added');
  });

  it('uses numberOfSeasons 0 when fetched serie data omits numberOfSeasons (|| 0)', async () => {
    await doFetch({ ...fetchedSerie, numberOfSeasons: undefined });
    fireEvent.click(screen.getByText('add_series.add_this_serie'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'file:createSerie',
        expect.objectContaining({ metadata: expect.objectContaining({ numberOfSeasons: 0 }) })
      )
    );
  });

  it('forces numberOfSeasons to 1 when saving a movie', async () => {
    await doFetch({ ...fetchedSerie, type: 'movie', numberOfSeasons: 9, title: 'Auto Movie' });
    fireEvent.click(screen.getByText('add_series.add_this_serie'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'file:createSerie',
        expect.objectContaining({
          serieName: 'Auto Movie',
          metadata: expect.objectContaining({ type: 'movie', numberOfSeasons: 1 }),
        })
      )
    );
  });

  it('alerts the error message when createSerie returns success:false', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return { TMDB_API_KEY: 'valid_api_key_for_testing' };
      if (ch === 'file:createSerie') return { success: false, message: 'Duplicate' };
      return null;
    });
    await doFetch(fetchedSerie);
    fireEvent.click(screen.getByText('add_series.add_this_serie'));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('common.error: Duplicate'));
  });

  it('alerts common.error and logs when createSerie rejects (catch)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return { TMDB_API_KEY: 'valid_api_key_for_testing' };
      if (ch === 'file:createSerie') throw new Error('IPC boom');
      return null;
    });
    await doFetch(fetchedSerie);
    fireEvent.click(screen.getByText('add_series.add_this_serie'));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('common.error'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('AddSeriesPage - preview cancel & image wrapper', () => {
  it('clears the preview when the cancel button is clicked', async () => {
    await doFetch({
      title: 'Cancel Me',
      rating: '5',
      overview: 'v',
      image: 'http://t/i.jpg',
      type: 'serie',
      numberOfSeasons: 1,
    });
    expect(screen.getByText('Cancel Me')).toBeInTheDocument();
    fireEvent.click(screen.getByText('common.cancel'));
    await waitFor(() => expect(screen.queryByText('Cancel Me')).not.toBeInTheDocument());
  });

  it('renders the previewPoster with the fetched http image on the auto tab', async () => {
    const { container } = await doFetch({
      title: 'Img',
      rating: '5',
      overview: 'v',
      image: 'http://t/i.jpg',
      type: 'serie',
      numberOfSeasons: 1,
    });
    // On the auto tab only previewPoster (alt="") renders; its src mirrors fetchedData.image verbatim.
    const poster = container.querySelector('img');
    expect(poster.getAttribute('src')).toBe('http://t/i.jpg');
  });

  it('renders a file:// src on the manual tab when the uploaded image is not http (non-http branch)', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      if (ch === 'dialog:openFileImage') return 'local/pic.jpg';
      return null;
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    fireEvent.click(screen.getByText('📁 add_series.select_file'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('dialog:openFileImage'));
    // imageWrapper img is the only img on the manual tab (alt="Önizleme"); non-http -> file:// prefix.
    expect(screen.getByAltText('Önizleme').getAttribute('src')).toBe('file://local/pic.jpg');
  });

  it('hides the preview image when the onError handler fires (manual tab)', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      if (ch === 'dialog:openFileImage') return 'http://x/i.jpg';
      return null;
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    fireEvent.click(screen.getByText('📁 add_series.select_file'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('dialog:openFileImage'));
    const img = screen.getByAltText('Önizleme');
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
  });
});

describe('AddSeriesPage - manual tab interactions', () => {
  // Manual tab on mount: no API key.
  const renderManual = () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      if (ch === 'file:createSerie') return { success: true };
      return null;
    });
    const r = renderPage();
    return r;
  };
  const awaitManual = () =>
    waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());

  it('updates the title via handleManualChange', async () => {
    const { container } = renderManual();
    await awaitManual();
    const titleInput = container.querySelector('input');
    fireEvent.change(titleInput, { target: { value: 'My Title' } });
    expect(titleInput.value).toBe('My Title');
  });

  it('updates the overview via handleManualChange (textarea)', async () => {
    const { container } = renderManual();
    await awaitManual();
    const overviewTA = container.querySelector('textarea');
    fireEvent.change(overviewTA, { target: { value: 'My overview text' } });
    expect(overviewTA.value).toBe('My overview text');
  });

  it('changes contentType when the select changes (serie -> movie)', async () => {
    const { container } = renderManual();
    await awaitManual();
    const select = container.querySelector('select');
    fireEvent.change(select, { target: { value: 'movie' } });
    expect(select.value).toBe('movie');
  });

  it('sets the image via handleAddImage when the dialog returns a path', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      if (ch === 'dialog:openFileImage') return 'http://images/p.jpg';
      return null;
    });
    renderPage();
    await awaitManual();
    fireEvent.click(screen.getByText('📁 add_series.select_file'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('dialog:openFileImage'));
    expect(screen.getByAltText('Önizleme').getAttribute('src')).toBe('http://images/p.jpg');
  });

  it('leaves the image empty when handleAddImage dialog returns null', async () => {
    renderManual();
    await awaitManual();
    fireEvent.click(screen.getByText('📁 add_series.select_file'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('dialog:openFileImage'));
    expect(screen.getByText('add_series.waiting_image')).toBeInTheDocument();
  });
});

describe('AddSeriesPage - saveManual', () => {
  const renderManualWithImage = async (imagePath = 'C:\\posters\\pic.jpg') => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      if (ch === 'file:createSerie') return { success: true };
      if (ch === 'dialog:openFileImage') return imagePath;
      return null;
    });
    const r = renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    const titleInput = r.container.querySelector('input');
    fireEvent.change(titleInput, { target: { value: 'Manual Title' } });
    fireEvent.click(screen.getByText('📁 add_series.select_file'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('dialog:openFileImage'));
    return r;
  };

  it('alerts error_missing_fields when title is empty (short-circuit)', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      return null;
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('add_series.error_missing_fields'));
    expect(mockInvoke).not.toHaveBeenCalledWith('file:createSerie', expect.anything());
  });

  it('alerts error_missing_fields when title is filled but image is empty (second || operand)', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      return null;
    });
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    fireEvent.change(container.querySelector('input'), { target: { value: 'Has Title' } });
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('add_series.error_missing_fields'));
    expect(mockInvoke).not.toHaveBeenCalledWith('file:createSerie', expect.anything());
  });

  it('saves a serie with rating default 0.0 and overview default, then navigates', async () => {
    await renderManualWithImage();
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('file:createSerie', {
        serieName: 'Manual Title',
        metadata: expect.objectContaining({
          title: 'Manual Title',
          rating: '0.0',
          overview: 'Açıklama yok.',
          numberOfSeasons: 0,
          type: 'serie',
          imdb_id: null,
        }),
      })
    );
    expect(alertMock).toHaveBeenCalledWith('add_series.success_added');
  });

  it('uses the typed overview (overview || default truthy branch)', async () => {
    const { container } = await renderManualWithImage();
    fireEvent.change(container.querySelector('textarea'), { target: { value: 'Custom overview' } });
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'file:createSerie',
        expect.objectContaining({
          metadata: expect.objectContaining({ overview: 'Custom overview' }),
        })
      )
    );
  });

  it('saves a movie with numberOfSeasons 1 when contentType is movie', async () => {
    const r = await renderManualWithImage();
    fireEvent.change(r.container.querySelector('select'), { target: { value: 'movie' } });
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'file:createSerie',
        expect.objectContaining({
          metadata: expect.objectContaining({ numberOfSeasons: 1, type: 'movie' }),
        })
      )
    );
  });

  it('alerts the error message when createSerie returns success:false', async () => {
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      if (ch === 'file:createSerie') return { success: false, message: 'Exists' };
      if (ch === 'dialog:openFileImage') return 'C:\\p\\x.jpg';
      return null;
    });
    const r = renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    fireEvent.change(r.container.querySelector('input'), { target: { value: 'T' } });
    fireEvent.click(screen.getByText('📁 add_series.select_file'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('dialog:openFileImage'));
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('common.error: Exists'));
  });

  it('logs to console.error (no alert) when createSerie rejects (catch)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'settings:get') return {};
      if (ch === 'file:createSerie') throw new Error('IPC fail');
      if (ch === 'dialog:openFileImage') return 'C:\\p\\x.jpg';
      return null;
    });
    const r = renderPage();
    await waitFor(() => expect(screen.getByText('add_series.manual_title')).toBeInTheDocument());
    fireEvent.change(r.container.querySelector('input'), { target: { value: 'T' } });
    fireEvent.click(screen.getByText('📁 add_series.select_file'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('dialog:openFileImage'));
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(alertMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('AddSeriesPage - tab switching & navigation', () => {
  it('switches to the manual tab and back to auto, clearing the error', async () => {
    renderPage();
    await settleAuto();
    // Trigger an error first.
    extractImdbId.mockReturnValue(null);
    fireEvent.change(screen.getByPlaceholderText('add_series.link_placeholder'), {
      target: { value: 'bad' },
    });
    fireEvent.click(screen.getByText('add_series.fetch_btn'));
    await waitFor(() => expect(screen.getByText('add_series.error_link')).toBeInTheDocument());
    // Switch to manual -> auto tab click clears the error (setError(null)).
    fireEvent.click(screen.getByText('✏️ add_series.tab_manual'));
    expect(screen.getByText('add_series.manual_title')).toBeInTheDocument();
    fireEvent.click(screen.getByText('🔗 add_series.tab_link'));
    await waitFor(() =>
      expect(screen.queryByText('add_series.error_link')).not.toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText('add_series.link_placeholder')).toBeInTheDocument();
  });

  it('navigates to "/" via the back button', async () => {
    renderPage();
    await settleAuto();
    fireEvent.click(screen.getByText(/add_series.cancel_back/));
    // No throw + component still mounted is enough (useNavigate is a router no-op here).
    expect(screen.getByPlaceholderText('add_series.link_placeholder')).toBeInTheDocument();
  });
});
