import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TitleBar from './TitleBar';
import React from 'react';

describe('TitleBar Component', () => {
  beforeEach(() => {
    window.api = {
      send: vi.fn()
    };
  });

  it('renders application title', () => {
    render(<TitleBar />);
    expect(screen.getByText('Zenith Stream')).toBeInTheDocument();
  });

  it('calls window:minimize on minimize button click', () => {
    render(<TitleBar />);
    const minBtn = screen.getByTitle('Küçült');
    fireEvent.click(minBtn);
    expect(window.api.send).toHaveBeenCalledWith('window:minimize');
  });

  it('calls window:maximize on maximize button click', () => {
    render(<TitleBar />);
    const maxBtn = screen.getByTitle('Büyüt');
    fireEvent.click(maxBtn);
    expect(window.api.send).toHaveBeenCalledWith('window:maximize');
  });

  it('calls window:close on close button click', () => {
    render(<TitleBar />);
    const closeBtn = screen.getByTitle('Kapat');
    fireEvent.click(closeBtn);
    expect(window.api.send).toHaveBeenCalledWith('window:close');
  });
});
