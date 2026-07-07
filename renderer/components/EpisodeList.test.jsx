import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import EpisodeList from './EpisodeList';

// react-icons renders each icon as an inline <svg aria-hidden> sibling of the
// adjacent text node inside the button, so getByText(' Convert') misses it
// (text is "broken up by multiple elements"). Querying by role/accessible name
// is the robust approach for those icon+label buttons.
const mockEpisodes = [
  { name: 'Episode 1.mp4', path: '/videos/ep1.mp4', size: 1048576 },
  { name: 'Episode 2.mkv', path: '/videos/ep2.mkv', size: 2097152 },
];

describe('EpisodeList', () => {
  const mockOnUpload = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnConvert = vi.fn();
  const mockOnTranslate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('shows an empty state when there are no episodes', () => {
      render(<EpisodeList episodes={[]} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.getByText('detail.empty_season')).toBeInTheDocument();
    });
  });

  describe('Episodes Display', () => {
    it('renders the provided episodes', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.getByText('Episode 1.mp4')).toBeInTheDocument();
      expect(screen.getByText('Episode 2.mkv')).toBeInTheDocument();
    });

    it('displays the episode size in MB', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    });

    it('shows the season in the title', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={3} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.getByText('detail.episodes_title')).toBeInTheDocument();
    });
  });

  describe('Upload Button', () => {
    it('shows the upload button when not disabled', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} uploadDisabled={false} />);
      expect(screen.getByText('detail.upload_file')).toBeInTheDocument();
    });

    it('hides the upload button when disabled', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} uploadDisabled={true} />);
      expect(screen.queryByText('detail.upload_file')).not.toBeInTheDocument();
    });

    it('calls onUpload when the upload button is clicked', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} uploadDisabled={false} />);
      fireEvent.click(screen.getByText('detail.upload_file'));
      expect(mockOnUpload).toHaveBeenCalledTimes(1);
    });
  });

  describe('Action Buttons', () => {
    it('shows a convert button for non-MP4 files', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.getByRole('button', { name: /Convert/ })).toBeInTheDocument();
    });

    it('shows an edit button for MP4 files', () => {
      const mp4Episodes = [{ name: 'Episode.mp4', path: '/vid/ep.mp4', size: 100 }];
      render(<EpisodeList episodes={mp4Episodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
    });

    it('calls onConvert when the convert button is clicked', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      fireEvent.click(screen.getByRole('button', { name: /Convert/ }));
      expect(mockOnConvert).toHaveBeenCalledTimes(1);
    });

    it('shows a delete button for each episode', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.getAllByText('🗑️')).toHaveLength(2);
    });

    it('calls onDelete with the episode path when the delete button is clicked', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      fireEvent.click(screen.getAllByText('🗑️')[0]);
      expect(mockOnDelete).toHaveBeenCalledWith('/videos/ep1.mp4');
    });
  });

  describe('Translate Button', () => {
    it('shows a translate button when onTranslate is provided', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} onTranslate={mockOnTranslate} />);
      expect(screen.getAllByTitle('translate.tooltip').length).toBeGreaterThan(0);
    });

    it('calls onTranslate when the translate button is clicked', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} onTranslate={mockOnTranslate} />);
      fireEvent.click(screen.getAllByTitle('translate.tooltip')[0]);
      expect(mockOnTranslate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Processing State', () => {
    it('shows a spinner when an episode is processing', () => {
      const conversionState = { '/videos/ep1.mp4': { status: 'processing', progress: 50 } };
      const { container } = render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} conversionState={conversionState} />);
      expect(container.querySelector('.icon-spin')).toBeTruthy();
    });

    it('hides the convert/edit action buttons for the processing episode', () => {
      const processingEpisodes = [{ name: 'Episode 1.mp4', path: '/videos/ep1.mp4', size: 1048576 }];
      const conversionState = { '/videos/ep1.mp4': { status: 'processing', progress: 50 } };
      render(<EpisodeList episodes={processingEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} conversionState={conversionState} />);
      expect(screen.queryAllByText(/ Convert| Edit/)).toHaveLength(0);
    });

    it('shows the progress percentage when processing', () => {
      const conversionState = { '/videos/ep1.mp4': { status: 'processing', progress: 75 } };
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} conversionState={conversionState} />);
      expect(screen.getByText('%75')).toBeInTheDocument();
    });
  });

  describe('Format Tags', () => {
    it('shows an MKV/AVI tag for non-MP4 files (not processing)', () => {
      render(<EpisodeList episodes={mockEpisodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.getByText('MKV/AVI')).toBeInTheDocument();
    });

    it('does not show a format tag for MP4 files', () => {
      const mp4Episodes = [{ name: 'Episode.mp4', path: '/vid/ep.mp4', size: 100 }];
      render(<EpisodeList episodes={mp4Episodes} activeSeason={1} onUpload={mockOnUpload} onDelete={mockOnDelete} onConvert={mockOnConvert} />);
      expect(screen.queryByText('MKV/AVI')).not.toBeInTheDocument();
    });
  });
});