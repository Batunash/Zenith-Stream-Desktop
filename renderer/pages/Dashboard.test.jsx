/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('react-virtualized-auto-sizer', () => ({
  default: ({ children }) => children({ width: 1000, height: 1000 }),
}));

vi.mock('react-window', () => ({
  FixedSizeGrid: ({ children, columnCount, rowCount }) => {
    const Component = children;
    const items = [];
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < columnCount; c++) {
        items.push(<Component key={`${r}-${c}`} rowIndex={r} columnIndex={c} style={{}} />);
      }
    }
    return <div>{items}</div>;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => {
      if (key === 'dashboard.delete_confirm') return `Delete ${params.title}?`;
      const dict = {
        'dashboard.title': 'Dashboard',
        'dashboard.no_series_title': 'No series',
        'dashboard.no_series_desc': 'Empty list',
      };
      return dict[key] || key;
    },
  }),
}));

const mockInvoke = vi.fn();

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.api = { invoke: mockInvoke };
    window.confirm = vi.fn();
    window.alert = vi.fn();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

  it('renders empty state when no series', async () => {
    mockInvoke.mockResolvedValueOnce([]); // getSeries
    mockInvoke.mockResolvedValueOnce({ running: false }); // status

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No series')).toBeInTheDocument();
      expect(screen.getByText('Empty list')).toBeInTheDocument();
    });
  });

  it('renders series cards and handles server toggle', async () => {
    const mockSeries = [
      { id: 1, title: 'Test Series 1', folderName: 'Test_Series_1', posterPath: null },
      { id: 2, title: 'Test Series 2', folderName: 'Test_Series_2', posterPath: null },
    ];
    mockInvoke.mockImplementation(async (channel) => {
      if (channel === 'file:getSeries') return mockSeries;
      if (channel === 'server:status') return { running: false };
      if (channel === 'server:start') return { success: true };
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Series 1')).toBeInTheDocument();
      expect(screen.getByText('Test Series 2')).toBeInTheDocument();
    });

    // Test server toggle from ControlPanel
    // Server is initially false, so clicking the toggle should call server:start
    const toggleBtn = screen.getByRole('button', { name: /start/i }); // Using regex because t() might return 'Server Start'
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('server:start');
    });
  });

  it('handles delete series', async () => {
    const mockSeries = [{ id: 1, title: 'DeleteMe', folderName: 'del_me' }];
    mockInvoke.mockResolvedValueOnce(mockSeries); // file:getSeries
    mockInvoke.mockResolvedValueOnce({ running: true }); // server:status

    window.confirm.mockReturnValueOnce(true);
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:deleteSerie') return { success: true };
      if (ch === 'file:getSeries') return mockSeries;
      return [];
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('DeleteMe')).toBeInTheDocument();
    });

    // Hover over the card to reveal delete button
    fireEvent.mouseEnter(screen.getByText('DeleteMe').closest('div').parentElement);

    const deleteBtn = screen.getByText('🗑️');
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith('Delete DeleteMe?');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('file:deleteSerie', 'del_me');
      expect(screen.queryByText('DeleteMe')).not.toBeInTheDocument();
    });
  });

  it('handles ControlPanel navigation and interactions', async () => {
    mockInvoke.mockResolvedValueOnce([]); // getSeries
    mockInvoke.mockResolvedValueOnce({ running: true }); // server:status
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('control_panel.running')).toBeInTheDocument();
    });

    // Toggle to stop server
    const toggleBtn = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(toggleBtn);
    expect(mockInvoke).toHaveBeenCalledWith('server:stop');

    // Simulate mouse enter/leave on toggle
    fireEvent.mouseEnter(toggleBtn);
    fireEvent.mouseLeave(toggleBtn);

    // Test add series
    const addSeriesBtn = screen.getByRole('button', { name: /add_serie/i });
    fireEvent.mouseEnter(addSeriesBtn);
    fireEvent.mouseLeave(addSeriesBtn);
    fireEvent.click(addSeriesBtn);

    // Test download manager
    const downloadBtn = screen.getByRole('button', { name: /download_manager/i });
    fireEvent.mouseEnter(downloadBtn);
    fireEvent.mouseLeave(downloadBtn);
    fireEvent.click(downloadBtn);

    // Test settings
    const settingsBtn = screen.getByRole('button', { name: /settings/i });
    fireEvent.mouseEnter(settingsBtn);
    fireEvent.mouseLeave(settingsBtn);
    fireEvent.click(settingsBtn);
  });

  it('handles IPC errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockRejectedValueOnce(new Error('Load Error')); // file:getSeries
    mockInvoke.mockRejectedValueOnce(new Error('Status Error')); // server:status

    renderComponent();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading series:', expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith('IPC Hatası (Status):', expect.any(Error));
    });

    // Toggle server error
    mockInvoke.mockRejectedValueOnce(new Error('Toggle Error'));
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('IPC Hatası (Start/Stop):', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('handles delete series error', async () => {
    const mockSeries = [{ id: 1, title: 'ErrorDelete', folderName: 'err_del' }];
    mockInvoke.mockResolvedValueOnce(mockSeries); // file:getSeries
    mockInvoke.mockResolvedValueOnce({ running: false }); // server:status

    window.confirm.mockReturnValueOnce(true);
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:deleteSerie') return { success: false, error: 'File locked' };
      if (ch === 'file:getSeries') return mockSeries;
      return [];
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ErrorDelete')).toBeInTheDocument();
    });

    fireEvent.mouseEnter(screen.getByText('ErrorDelete').closest('div').parentElement);
    fireEvent.click(screen.getByText('🗑️'));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('common.error: File locked');
    });
  });

  it('handles delete series exception', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockSeries = [{ id: 1, title: 'CrashDelete', folderName: 'crash_del' }];
    mockInvoke.mockResolvedValueOnce(mockSeries);
    mockInvoke.mockResolvedValueOnce({ running: false });

    window.confirm.mockReturnValueOnce(true);
    mockInvoke.mockImplementation(async (ch) => {
      if (ch === 'file:deleteSerie') throw new Error('Crash');
      if (ch === 'file:getSeries') return mockSeries;
      return [];
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('CrashDelete')).toBeInTheDocument();
    });

    fireEvent.mouseEnter(screen.getByText('CrashDelete').closest('div').parentElement);
    fireEvent.click(screen.getByText('🗑️'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('handles delete cancellation', async () => {
    const mockSeries = [{ id: 1, title: 'CancelDelete', folderName: 'cancel_del' }];
    mockInvoke.mockResolvedValueOnce(mockSeries);
    mockInvoke.mockResolvedValueOnce({ running: false });

    window.confirm.mockReturnValueOnce(false); // Cancel

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('CancelDelete')).toBeInTheDocument();
    });

    fireEvent.mouseEnter(screen.getByText('CancelDelete').closest('div').parentElement);
    fireEvent.click(screen.getByText('🗑️'));

    expect(mockInvoke).not.toHaveBeenCalledWith('file:deleteSerie', expect.anything());
  });

  it('tests SeriesCard image variations', async () => {
    window.api.paths = { userData: 'C:\\Users\\Test\\AppData\\Roaming\\VideoHub' };

    const mockSeries = [
      { id: 1, title: 'HTTP Image', image: 'http://example.com/img.jpg' },
      {
        id: 2,
        title: 'Full Path Image',
        fullPosterPath: 'C:\\Users\\Test\\AppData\\Roaming\\VideoHub\\posters\\img.jpg',
      },
      { id: 3, title: 'Broken Image', fullPosterPath: '/broken/img.jpg' },
    ];

    mockInvoke.mockResolvedValueOnce(mockSeries); // file:getSeries
    mockInvoke.mockResolvedValueOnce({ running: false }); // server:status

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('HTTP Image')).toBeInTheDocument();
      expect(screen.getByText('Full Path Image')).toBeInTheDocument();
    });

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('src', 'http://example.com/img.jpg');
    // For 'Full Path Image', it should normalize by replacing the userData path:
    expect(images[1]).toHaveAttribute('src', 'media://posters/img.jpg');

    // Simulate image error to trigger fallback
    fireEvent.error(images[2]);
    expect(images[2]).toHaveAttribute('src', 'https://via.placeholder.com/300x450?text=No+Image');

    // Click on a card
    fireEvent.click(screen.getByText('HTTP Image').closest('div').parentElement);
  });
});
