/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import SeasonList from './SeasonList';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe('SeasonList', () => {
  const mockSeasons = ['Season 1', 'Season 2'];

  it('renders seasons correctly', () => {
    render(<SeasonList seasons={mockSeasons} activeSeason="Season 1" isMovie={false} />);
    expect(screen.getByText('Season 1')).toBeInTheDocument();
    expect(screen.getByText('Season 2')).toBeInTheDocument();
    expect(screen.getByText('detail.new_season')).toBeInTheDocument();
  });

  it('handles season selection', () => {
    const handleSelect = vi.fn();
    render(
      <SeasonList
        seasons={mockSeasons}
        activeSeason="Season 1"
        onSelect={handleSelect}
        isMovie={false}
      />
    );

    fireEvent.click(screen.getByText('Season 2'));
    expect(handleSelect).toHaveBeenCalledWith('Season 2');
  });

  it('handles add season button click', () => {
    const handleAdd = vi.fn();
    render(
      <SeasonList seasons={mockSeasons} activeSeason="Season 1" onAdd={handleAdd} isMovie={false} />
    );

    fireEvent.click(screen.getByText('detail.new_season'));
    expect(handleAdd).toHaveBeenCalled();
  });

  it('hides add season button if isMovie is true', () => {
    render(<SeasonList seasons={mockSeasons} activeSeason="Season 1" isMovie={true} />);
    expect(screen.queryByText('detail.new_season')).not.toBeInTheDocument();
  });

  it('handles delete season badge click', () => {
    const handleDelete = vi.fn();
    render(
      <SeasonList
        seasons={mockSeasons}
        activeSeason="Season 1"
        onDelete={handleDelete}
        isMovie={false}
      />
    );

    // The delete badge has a title 'common.delete'
    const deleteBadges = screen.getAllByTitle('common.delete');
    expect(deleteBadges.length).toBe(2);

    fireEvent.click(deleteBadges[1]);
    expect(handleDelete).toHaveBeenCalledWith('Season 2');
  });
});
