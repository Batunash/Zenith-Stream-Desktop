/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import SeriesBanner from './SeriesBanner';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe('SeriesBanner', () => {
  const mockMetadata = {
    title: 'Test Banner Title',
    rating: '9.0',
    overview: 'This is a test overview.',
    backdrop: 'http://example.com/backdrop.jpg',
    fullPosterPath: '/local/poster.jpg',
  };

  it('renders correctly with given metadata', () => {
    render(<SeriesBanner metadata={mockMetadata} seasonCount={3} />);

    expect(screen.getByText('Test Banner Title')).toBeInTheDocument();
    expect(screen.getByText('IMDB: 9.0')).toBeInTheDocument();
    expect(screen.getByText('3 detail.seasons')).toBeInTheDocument();
    expect(screen.getByText('This is a test overview.')).toBeInTheDocument();
  });

  it('renders correctly when backdrop is a local path', () => {
    const localMeta = { ...mockMetadata, backdrop: null };
    render(<SeriesBanner metadata={localMeta} seasonCount={1} />);

    expect(screen.getByText('Test Banner Title')).toBeInTheDocument();
    // Background image assertion would require checking styles, skipping for basic DOM assert
  });

  it('handles back button click', () => {
    const handleBack = vi.fn();
    render(<SeriesBanner metadata={mockMetadata} seasonCount={3} onBack={handleBack} />);

    const backBtn = screen.getByText('← common.back');
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalled();
  });

  it('renders auto translate button if onAutoTranslate is provided and handles click', () => {
    const handleTranslate = vi.fn();
    render(
      <SeriesBanner metadata={mockMetadata} seasonCount={3} onAutoTranslate={handleTranslate} />
    );

    const translateBtn = screen.getByText('auto_translate.button');
    expect(translateBtn).toBeInTheDocument();

    fireEvent.click(translateBtn);
    expect(handleTranslate).toHaveBeenCalled();
  });

  it('does not render auto translate button if onAutoTranslate is not provided', () => {
    render(<SeriesBanner metadata={mockMetadata} seasonCount={3} />);
    expect(screen.queryByText('auto_translate.button')).not.toBeInTheDocument();
  });
});
