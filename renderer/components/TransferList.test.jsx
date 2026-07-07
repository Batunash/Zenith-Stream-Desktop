import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransferList from './TransferList';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe('TransferList Component', () => {
  it('renders nothing when transfers object is empty', () => {
    const { container } = render(<TransferList transfers={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders transferring state correctly', () => {
    const transfers = {
      'C:\\path\\to\\video1.mp4': { percent: 45, status: 'transferring' },
    };
    render(<TransferList transfers={transfers} />);

    expect(screen.getByText('video1.mp4')).toBeInTheDocument();
    expect(screen.getByText('%45')).toBeInTheDocument();
  });

  it('renders completed state correctly', () => {
    const transfers = {
      '/path/to/video2.mkv': { percent: 100, status: 'completed' },
    };
    render(<TransferList transfers={transfers} />);

    expect(screen.getByText('video2.mkv')).toBeInTheDocument();
    expect(screen.getByText('transfer.status_completed')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const transfers = {
      'video3.avi': { percent: 10, status: 'error', error: 'Disk full' },
    };
    render(<TransferList transfers={transfers} />);

    expect(screen.getByText('video3.avi')).toBeInTheDocument();
    expect(screen.getByText('transfer.status_error')).toBeInTheDocument();
    expect(screen.getByText('Disk full')).toBeInTheDocument();
  });
});
