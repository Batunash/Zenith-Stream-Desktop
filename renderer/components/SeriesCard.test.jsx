import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SeriesCard from './SeriesCard';

describe('SeriesCard Component', () => {
  const mockData = {
    id: 1,
    title: 'Test Series',
    rating: '8.5',
    image: 'http://example.com/poster.jpg',
  };

  it('renders series title and poster', () => {
    render(<SeriesCard data={mockData} />);

    expect(screen.getByText('Test Series')).toBeInTheDocument();

    const img = screen.getByAltText('Test Series');
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('http://example.com/poster.jpg');
  });

  it('calls onClick with correct id when clicked', () => {
    const handleClick = vi.fn();
    render(<SeriesCard data={mockData} onClick={handleClick} />);

    const card = screen.getByText('Test Series').closest('div');
    fireEvent.click(card);

    expect(handleClick).toHaveBeenCalledWith(1);
  });

  it('renders local image paths correctly using media protocol', () => {
    const localData = {
      id: 2,
      title: 'Local Series',
      fullPosterPath: 'C:/mock/userdata/posters/local.jpg',
    };

    render(<SeriesCard data={localData} />);
    const img = screen.getByAltText('Local Series');

    expect(img.src).toBe('media://posters/local.jpg');
  });

  it('renders placeholder image when no image provided', () => {
    render(<SeriesCard data={{ id: 3, title: 'No Image Series' }} />);
    const img = screen.getByAltText('No Image Series');
    expect(img.src).toBe('https://via.placeholder.com/300x450?text=No+Img');
  });

  it('renders placeholder image on img error', () => {
    render(<SeriesCard data={mockData} />);
    const img = screen.getByAltText('Test Series');
    fireEvent.error(img);
    expect(img.src).toBe('https://via.placeholder.com/300x450?text=No+Image');
  });

  it('shows rating and delete button on hover', () => {
    const handleDelete = vi.fn();
    render(<SeriesCard data={mockData} onDelete={handleDelete} />);

    const card = screen.getByText('Test Series').closest('div');

    // Rating should not be visible initially
    expect(screen.queryByText('8.5')).not.toBeInTheDocument();

    // Hover
    fireEvent.mouseEnter(card);
    expect(screen.getByText('8.5')).toBeInTheDocument();

    // Delete Button should be visible
    const deleteBtn = screen.getByTitle('dashboard.delete_tooltip');
    expect(deleteBtn).toBeInTheDocument();

    // Click delete
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledWith(mockData);

    // Leave hover
    fireEvent.mouseLeave(card);
    expect(screen.queryByText('8.5')).not.toBeInTheDocument();
  });
});
