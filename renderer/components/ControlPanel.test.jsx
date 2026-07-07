import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Share ONE navigate fn across renders so navigation assertions can observe it.
const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import ControlPanel from './ControlPanel';

describe('ControlPanel', () => {
  const mockToggleServer = vi.fn();
  const mockOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the server status section', () => {
    render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
    expect(screen.getByText('control_panel.server_status')).toBeInTheDocument();
  });

  describe('Server Status Display', () => {
    it('shows running status when the server is running', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      expect(screen.getByText('control_panel.running')).toBeInTheDocument();
    });

    it('shows stopped status when the server is stopped', () => {
      render(<ControlPanel isServerRunning={false} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      expect(screen.getByText('control_panel.stopped')).toBeInTheDocument();
    });
  });

  describe('Server Button', () => {
    it('shows the start server button when stopped', () => {
      render(<ControlPanel isServerRunning={false} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      expect(screen.getByText('control_panel.start_server')).toBeInTheDocument();
    });

    it('shows the stop server button when running', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      expect(screen.getByText('control_panel.stop_server')).toBeInTheDocument();
    });

    it('calls toggleServer when the server button is clicked', () => {
      render(<ControlPanel isServerRunning={false} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      fireEvent.click(screen.getByText('control_panel.start_server'));
      expect(mockToggleServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation Buttons', () => {
    it('renders the add serie button', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      expect(screen.getByText('control_panel.add_serie')).toBeInTheDocument();
    });

    it('renders the download manager button', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      expect(screen.getByText('control_panel.download_manager')).toBeInTheDocument();
    });

    it('renders the settings button', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      expect(screen.getByText('control_panel.settings')).toBeInTheDocument();
    });

    it('navigates to /add-series when the add serie button is clicked', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      fireEvent.click(screen.getByText('control_panel.add_serie'));
      expect(mockNavigate).toHaveBeenCalledWith('/add-series');
    });

    it('navigates to /download when the download manager button is clicked', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      fireEvent.click(screen.getByText('control_panel.download_manager'));
      expect(mockNavigate).toHaveBeenCalledWith('/download');
    });

    it('calls onOpenSettings when the settings button is clicked', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      fireEvent.click(screen.getByText('control_panel.settings'));
      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Styles', () => {
    it('renders a column-flex container', () => {
      const { container } = render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      expect(container.querySelector('[style*="flex-direction: column"]')).toBeTruthy();
    });
  });

  describe('Hover handlers', () => {
    it('toggles opacity on the server button via mouseEnter/mouseLeave', () => {
      render(<ControlPanel isServerRunning={false} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      const btn = screen.getByText('control_panel.start_server').closest('button');
      fireEvent.mouseEnter(btn);
      expect(btn.style.opacity).toBe('0.9');
      fireEvent.mouseLeave(btn);
      expect(btn.style.opacity).toBe('1');
    });

    it('toggles background on the add-serie button via mouseEnter/mouseLeave', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      const btn = screen.getByText('control_panel.add_serie').closest('button');
      fireEvent.mouseEnter(btn);
      expect(btn).toHaveStyle({ backgroundColor: '#444' });
      fireEvent.mouseLeave(btn);
      expect(btn).toHaveStyle({ backgroundColor: '#333' });
    });

    it('toggles background on the download-manager button via mouseEnter/mouseLeave', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      const btn = screen.getByText('control_panel.download_manager').closest('button');
      fireEvent.mouseEnter(btn);
      expect(btn).toHaveStyle({ backgroundColor: '#444' });
      fireEvent.mouseLeave(btn);
      expect(btn).toHaveStyle({ backgroundColor: '#333' });
    });

    it('toggles background on the settings button via mouseEnter/mouseLeave', () => {
      render(<ControlPanel isServerRunning={true} toggleServer={mockToggleServer} onOpenSettings={mockOpenSettings} />);
      const btn = screen.getByText('control_panel.settings').closest('button');
      fireEvent.mouseEnter(btn);
      expect(btn).toHaveStyle({ backgroundColor: '#444' });
      fireEvent.mouseLeave(btn);
      expect(btn).toHaveStyle({ backgroundColor: '#333' });
    });
  });
});