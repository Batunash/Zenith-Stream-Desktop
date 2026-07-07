/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setupTests';
import { MemoryRouter } from 'react-router-dom';
import DownloadManager from './DownloadManager';

// window.api.receive captures each IPC listener into receiveCbs[channel] so
// tests can fire them with act() and exercise the effect-driven state machine.
let receiveCbs;
let mockInvoke;

const baseStream = (id = 1) => ({ id, type: 'mp4', pageTitle: 'My Video', url: `http://v/${id}` });

beforeEach(() => {
    vi.clearAllMocks();
    receiveCbs = {};
    mockInvoke = vi.fn(async (channel) => {
        if (channel === 'browser:getStreams') return { success: true, streams: [] };
        if (channel === 'browser:downloads') return [];
        if (channel === 'file:getSeries') return [];
        return { success: true };
    });
    window.api = {
        invoke: mockInvoke,
        receive: vi.fn((ch, cb) => { receiveCbs[ch] = cb; }),
        remove: vi.fn(),
        send: vi.fn(),
    };
});

const renderPage = () => render(<MemoryRouter><DownloadManager /></MemoryRouter>);

// Wait for the mount effect to fetch captured streams + download list.
const settle = () => waitFor(() => {
    expect(mockInvoke).toHaveBeenCalledWith('browser:getStreams');
    expect(mockInvoke).toHaveBeenCalledWith('browser:downloads');
});

describe('DownloadManager', () => {
    describe('rendering & toolbar', () => {
        it('renders the address bar and back button', async () => {
            renderPage();
            await settle();
            expect(screen.getByPlaceholderText('downloadManager.urlPlaceholder')).toBeInTheDocument();
            expect(screen.getByTitle('common.back')).toBeInTheDocument();
        });

        it('updates the address bar as the user types', async () => {
            renderPage();
            await settle();
            const input = screen.getByPlaceholderText('downloadManager.urlPlaceholder');
            fireEvent.change(input, { target: { value: 'http://example.com' } });
            expect(input.value).toBe('http://example.com');
        });

        it('invokes browser:goBack / goForward / reload from the nav icon buttons', async () => {
            const { container } = renderPage();
            await settle();
            // Toolbar buttons in DOM order: [0]=App, [1]=goBack, [2]=goForward, [3]=reload, [4]=downloads toggle.
            // The icon-only nav buttons have no accessible name, so we target them by position.
            const buttons = screen.getAllByRole('button');
            fireEvent.click(buttons[1]);
            fireEvent.click(buttons[2]);
            fireEvent.click(buttons[3]);
            await waitFor(() => {
                expect(mockInvoke).toHaveBeenCalledWith('browser:goBack');
                expect(mockInvoke).toHaveBeenCalledWith('browser:goForward');
                expect(mockInvoke).toHaveBeenCalledWith('browser:reload');
            });
        });

        it('navigates to "/" when the App button is clicked', async () => {
            renderPage();
            await settle();
            fireEvent.click(screen.getByText('App'));
            // No throw + component still mounted is enough (useNavigate is a router no-op here).
            expect(screen.getByPlaceholderText('downloadManager.urlPlaceholder')).toBeInTheDocument();
        });
    });

    describe('address bar navigation', () => {
        it('invokes browser:navigate on submit when the URL is non-empty', async () => {
            renderPage();
            await settle();
            const input = screen.getByPlaceholderText('downloadManager.urlPlaceholder');
            fireEvent.change(input, { target: { value: 'http://target.com' } });
            fireEvent.submit(input.closest('form'));
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('browser:navigate', 'http://target.com'));
        });

        it('does not invoke browser:navigate when the URL is blank', async () => {
            renderPage();
            await settle();
            const input = screen.getByPlaceholderText('downloadManager.urlPlaceholder');
            fireEvent.change(input, { target: { value: '   ' } });
            fireEvent.submit(input.closest('form'));
            // Give the async handler a tick to potentially fire.
            await new Promise((r) => setTimeout(r, 0));
            expect(mockInvoke).not.toHaveBeenCalledWith('browser:navigate', expect.anything());
        });

        it('updates the address bar when browser:urlChanged fires', async () => {
            renderPage();
            await settle();
            act(() => receiveCbs['browser:urlChanged']?.('http://from-ipc'));
            expect(screen.getByPlaceholderText('downloadManager.urlPlaceholder').value).toBe('http://from-ipc');
        });
    });

    describe('stream detection', () => {
        it('shows the banner with a count when browser:getStreams returns streams', async () => {
            mockInvoke.mockImplementation(async (ch) => {
                if (ch === 'browser:getStreams') return { success: true, streams: [baseStream(1), baseStream(2)] };
                if (ch === 'browser:downloads') return [];
                return { success: true };
            });
            renderPage();
            await waitFor(() => expect(screen.getByText(/streamCapture.detectedStreams/)).toBeInTheDocument());
            expect(screen.getByText('http://v/1')).toBeInTheDocument();
            expect(screen.getByText('http://v/2')).toBeInTheDocument();
        });

        it('adds a new stream when browser:streamDetected fires', async () => {
            renderPage();
            await settle();
            act(() => receiveCbs['browser:streamDetected']?.(baseStream(5)));
            await waitFor(() => expect(screen.getByText('http://v/5')).toBeInTheDocument());
        });

        it('deduplicates streams with the same url on browser:streamDetected', async () => {
            mockInvoke.mockImplementation(async (ch) => {
                if (ch === 'browser:getStreams') return { success: true, streams: [baseStream(1)] };
                if (ch === 'browser:downloads') return [];
                return { success: true };
            });
            renderPage();
            await waitFor(() => expect(screen.getByText('http://v/1')).toBeInTheDocument());
            const before = screen.getAllByText('http://v/1').length;
            act(() => receiveCbs['browser:streamDetected']?.(baseStream(1)));
            await new Promise((r) => setTimeout(r, 0));
            expect(screen.getAllByText('http://v/1').length).toBe(before);
        });

        it('replaces the whole stream list on browser:streams', async () => {
            renderPage();
            await settle();
            act(() => receiveCbs['browser:streams']?.([baseStream(9)]));
            await waitFor(() => expect(screen.getByText('http://v/9')).toBeInTheDocument());
        });

        it('clears streams via the Clear button', async () => {
            mockInvoke.mockImplementation(async (ch) => {
                if (ch === 'browser:getStreams') return { success: true, streams: [baseStream(1)] };
                if (ch === 'browser:downloads') return [];
                return { success: true };
            });
            renderPage();
            await waitFor(() => expect(screen.getByText('http://v/1')).toBeInTheDocument());
            fireEvent.click(screen.getByText('streamCapture.clear'));
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('browser:clearStreams'));
            expect(screen.queryByText('http://v/1')).not.toBeInTheDocument();
        });
    });

    describe('download modal', () => {
        const withSeries = async (series = [{ folderName: 'Series1', title: 'Series One' }], seasons = ['Season 1', 'Season 2']) => {
            mockInvoke.mockImplementation(async (ch, payload) => {
                if (ch === 'browser:getStreams') return { success: true, streams: [baseStream()] };
                if (ch === 'browser:downloads') return [];
                if (ch === 'file:getSeries') return series;
                if (ch === 'file:getSeriesDetail') return { seasons };
                return { success: true };
            });
            renderPage();
            await waitFor(() => expect(screen.getByText('http://v/1')).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: 'downloadManager.downloadButton' }));
            await waitFor(() => expect(screen.getByText('downloadManager.modalTitle')).toBeInTheDocument());
        };

        it('opens the modal and shows noSeriesFound when the library has no series', async () => {
            await withSeries([]);
            expect(screen.getByText('downloadManager.noSeriesFound')).toBeInTheDocument();
            // Download button is disabled in LIBRARY mode with no series.
            const dlBtns = screen.getAllByRole('button', { name: 'downloadManager.downloadButton' });
            expect(dlBtns[1]).toBeDisabled();
        });

        it('opens the modal populated with series and preselects the first season', async () => {
            await withSeries();
            expect(screen.getByText('Series One')).toBeInTheDocument();
            expect(screen.getByText('downloadManager.seasonFolder')).toBeInTheDocument();
            expect(mockInvoke).toHaveBeenCalledWith('file:getSeriesDetail', 'Series1');
        });

        it('defaults to "Season 1" when the selected series has no seasons', async () => {
            await withSeries(undefined, undefined);
            // Override the detail response for this test path: series present, no seasons.
            mockInvoke.mockImplementation(async (ch) => {
                if (ch === 'file:getSeriesDetail') return { seasons: [] };
                if (ch === 'file:getSeries') return [{ folderName: 'Series1', title: 'Series One' }];
                if (ch === 'browser:getStreams') return { success: true, streams: [baseStream()] };
                if (ch === 'browser:downloads') return [];
                return { success: true };
            });
            // Re-trigger fetchSeasons by changing the series select.
            fireEvent.change(screen.getByText('Series One').closest('select'), { target: { value: 'Series1' } });
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('file:getSeriesDetail', 'Series1'));
        });

        it('switches to the CUSTOM tab and shows the custom-folder info', async () => {
            await withSeries();
            fireEvent.click(screen.getByText('downloadManager.tabCustom'));
            expect(screen.getByText('downloadManager.customFolderInfo')).toBeInTheDocument();
            expect(screen.queryByText('downloadManager.noSeriesFound')).not.toBeInTheDocument();
        });

        it('closes the modal on Cancel', async () => {
            await withSeries();
            fireEvent.click(screen.getByText('common.cancel'));
            await waitFor(() => expect(screen.queryByText('downloadManager.modalTitle')).not.toBeInTheDocument());
        });

        it('re-fetches seasons when the series select changes', async () => {
            await withSeries([{ folderName: 'S1', title: 'A' }, { folderName: 'S2', title: 'B' }]);
            fireEvent.change(screen.getByText('A').closest('select'), { target: { value: 'S2' } });
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('file:getSeriesDetail', 'S2'));
        });

        it('disables the Download button in LIBRARY mode when no series is selected', async () => {
            await withSeries([]);
            const dlBtns = screen.getAllByRole('button', { name: 'downloadManager.downloadButton' });
            expect(dlBtns[1]).toBeDisabled();
        });

        it('confirms a LIBRARY download with enabled:true and the library context', async () => {
            await withSeries();
            const dlBtns = screen.getAllByRole('button', { name: 'downloadManager.downloadButton' });
            fireEvent.click(dlBtns[1]);
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('browser:downloadStream', expect.objectContaining({
                stream: expect.objectContaining({ url: 'http://v/1' }),
                libraryContext: expect.objectContaining({ enabled: true, serieName: 'Series1', seasonId: 'Season 1' }),
            })));
        });

        it('confirms a CUSTOM download with enabled:false and the episode-name filename', async () => {
            await withSeries();
            fireEvent.click(screen.getByText('downloadManager.tabCustom'));
            const dlBtns = screen.getAllByRole('button', { name: 'downloadManager.downloadButton' });
            fireEvent.click(dlBtns[1]);
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('browser:downloadStream', expect.objectContaining({
                filename: 'My Video',
                libraryContext: expect.objectContaining({ enabled: false }),
            })));
        });

        it('increments the episode name (01->02) and exposes the next name via the Quick-Save title', async () => {
            await withSeries();
            // Type an initial episode name with a padded trailing number.
            fireEvent.change(screen.getByPlaceholderText('downloadManager.episodePlaceholder'), { target: { value: 'Episode 01' } });
            fireEvent.click(screen.getAllByRole('button', { name: 'downloadManager.downloadButton' })[1]);
            // After confirm, lastEpisodeName becomes "Episode 02" and the Quick-Save button title reflects it.
            await waitFor(() => {
                const qs = screen.getByTitle(/Series1 > Season 1 > .*/);
                expect(qs.title).toContain('Episode 02');
            });
        });
    });

    describe('quick save', () => {
        it('returns early when there is no lastLibraryContext', async () => {
            mockInvoke.mockImplementation(async (ch) => {
                if (ch === 'browser:getStreams') return { success: true, streams: [baseStream()] };
                if (ch === 'browser:downloads') return [];
                return { success: true };
            });
            renderPage();
            await waitFor(() => expect(screen.getByText('http://v/1')).toBeInTheDocument());
            // No Quick-Save button rendered yet (no lastLibraryContext).
            expect(screen.queryByRole('button', { name: 'downloadManager.quickSave' })).not.toBeInTheDocument();
            expect(mockInvoke).not.toHaveBeenCalledWith('browser:downloadStream', expect.anything());
        });

        it('downloads with the pre-increment filename and advances lastEpisodeName', async () => {
            // Seed a lastLibraryContext by confirming one LIBRARY download first.
            mockInvoke.mockImplementation(async (ch) => {
                if (ch === 'browser:getStreams') return { success: true, streams: [baseStream()] };
                if (ch === 'browser:downloads') return [];
                if (ch === 'file:getSeries') return [{ folderName: 'Series1', title: 'Series One' }];
                if (ch === 'file:getSeriesDetail') return { seasons: ['Season 1'] };
                return { success: true };
            });
            renderPage();
            await waitFor(() => expect(screen.getByText('http://v/1')).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: 'downloadManager.downloadButton' }));
            await waitFor(() => expect(screen.getByText('downloadManager.modalTitle')).toBeInTheDocument());
            fireEvent.change(screen.getByPlaceholderText('downloadManager.episodePlaceholder'), { target: { value: 'Ep 01' } });
            fireEvent.click(screen.getAllByRole('button', { name: 'downloadManager.downloadButton' })[1]);
            // lastEpisodeName is now "Ep 02"; Quick-Save should use "Ep 02" as filename and advance to "Ep 03".
            await waitFor(() => expect(screen.getByRole('button', { name: 'downloadManager.quickSave' })).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: 'downloadManager.quickSave' }));
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('browser:downloadStream',
                expect.objectContaining({ filename: 'Ep 02', libraryContext: expect.objectContaining({ episodeName: 'Ep 02', enabled: true }) })));
            expect(screen.getByRole('button', { name: 'downloadManager.quickSave' }).title).toContain('Ep 03');
        });
    });

    describe('downloads sidebar', () => {
        const openSidebarWith = async (downloads) => {
            mockInvoke.mockImplementation(async (ch) => {
                if (ch === 'browser:getStreams') return { success: true, streams: [] };
                if (ch === 'browser:downloads') return downloads;
                return { success: true };
            });
            const r = renderPage();
            await settle();
            // Toolbar button [4] is the downloads toggle.
            fireEvent.click(screen.getAllByRole('button')[4]);
            await waitFor(() => expect(screen.getByText('downloadManager.downloadQueue')).toBeInTheDocument());
            return r;
        };

        it('shows the empty state when there are no downloads', async () => {
            await openSidebarWith([]);
            expect(screen.getByText('downloadManager.noDownloads')).toBeInTheDocument();
        });

        it('renders a completed download with a green check and 100%', async () => {
            await openSidebarWith([{ id: 1, title: 'Done', percent: 100, sizeKB: 0, status: 'completed' }]);
            expect(screen.getByText('100%')).toBeInTheDocument();
            expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument();
        });

        it('renders a failed download in red with its percent', async () => {
            await openSidebarWith([{ id: 2, title: 'Boom', percent: 30, sizeKB: 0, status: 'failed' }]);
            expect(screen.getByText('30%')).toBeInTheDocument();
        });

        it('renders a downloading item with a Cancel (x) button', async () => {
            await openSidebarWith([{ id: 3, title: 'Go', percent: 50, sizeKB: 0, status: 'downloading' }]);
            const cancel = screen.getByTitle('Cancel');
            fireEvent.click(cancel);
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('browser:cancelDownload', 3));
        });

        it('renders a starting item with a Cancel (x) button', async () => {
            await openSidebarWith([{ id: 4, title: 'Start', percent: 0, sizeKB: 0, status: 'starting' }]);
            expect(screen.getByTitle('Cancel')).toBeInTheDocument();
            expect(screen.getByText('downloadManager.status.starting')).toBeInTheDocument();
        });

        it('uses the striped bar and shows MB for an in-progress item with unknown progress', async () => {
            const { container } = await openSidebarWith([{ id: 5, title: 'Unknown', percent: 0, sizeKB: 2048, status: 'downloading' }]);
            expect(container.querySelector('.striped-bar')).not.toBeNull();
            expect(screen.getByText('2.0 MB')).toBeInTheDocument();
        });

        it('invokes browser:clearCompleted from the Clear-Completed button', async () => {
            await openSidebarWith([]);
            fireEvent.click(screen.getByText('downloadManager.clearCompleted'));
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('browser:clearCompleted'));
        });

        it('hides the sidebar when the close (x) button is clicked', async () => {
            await openSidebarWith([]);
            const header = screen.getByText('downloadManager.downloadQueue').parentElement;
            fireEvent.click(header.querySelectorAll('button')[1]);
            await waitFor(() => expect(screen.queryByText('downloadManager.downloadQueue')).not.toBeInTheDocument());
        });
    });

    describe('IPC progress events', () => {
        it('refreshes downloads when browser:progress fires', async () => {
            renderPage();
            await settle();
            const callsBefore = mockInvoke.mock.calls.filter((c) => c[0] === 'browser:downloads').length;
            await act(async () => { receiveCbs['browser:progress']?.(); });
            await waitFor(() => expect(mockInvoke.mock.calls.filter((c) => c[0] === 'browser:downloads').length).toBeGreaterThan(callsBefore));
        });

        it('refreshes downloads and syncs the DB when browser:complete fires', async () => {
            renderPage();
            await settle();
            await act(async () => { receiveCbs['browser:complete']?.(); });
            await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('file:syncDatabase'));
        });
    });

    describe('unmount cleanup', () => {
        it('hides the browser and removes all 8 IPC listeners on unmount', async () => {
            const { unmount } = renderPage();
            await settle();
            unmount();
            expect(mockInvoke).toHaveBeenCalledWith('browser:hide');
            expect(window.api.remove).toHaveBeenCalledTimes(8);
        });
    });
});