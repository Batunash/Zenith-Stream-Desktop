/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';

// Mock react-i18next
const changeLanguageMock = vi.fn();
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
        const dict = {
            'settings.title': 'Settings',
            'settings.section_server': 'Server',
            'settings.port': 'Port',
            'settings.media_dir': 'Media Directory',
            'settings.api_key': 'API Key',
            'settings.section_ai': 'AI Settings',
            'settings.ai_provider': 'AI Provider',
            'settings.save_restart': 'Save',
            'settings.dir_warning': 'Please select a directory',
            'settings.restarting': 'Restarting',
            'settings.logout_confirm': 'Are you sure you want to logout?',
            'common.error': 'Error',
            'common.processing': 'Processing',
            'settings.sync_db': 'Sync DB',
            'settings.logout': 'Logout',
            'settings.restart_confirm': 'Restart to apply?'
        };
        return dict[key] || key;
    },
    i18n: { changeLanguage: changeLanguageMock, language: 'en' }
  })
}));

// Mock qrcode.react to avoid canvas/svg issues in jsdom
vi.mock('qrcode.react', () => ({
    QRCodeSVG: () => <div data-testid="qr-code">QR</div>
}));

const mockInvoke = vi.fn();

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.api = { invoke: mockInvoke };
    window.alert = vi.fn();
    window.confirm = vi.fn();
  });

  const renderComponent = (props = {}) => render(
    <MemoryRouter>
      <SettingsPage {...props} />
    </MemoryRouter>
  );

  it('loads and displays initial settings', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { PORT: '4000', MEDIA_DIR: '/my/media', TMDB_API_KEY: 'test_key', AI_PROVIDER: 'gemini' };
        if (channel === 'server:getNetworkInfo') return { ip: '192.168.1.100' };
        return {};
    });

    renderComponent();

    await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('settings:get');
    });

    expect(screen.getByDisplayValue('4000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/my/media')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test_key')).toBeInTheDocument();
    expect(screen.getByDisplayValue('settings.provider_gemini')).toBeInTheDocument();
    
    // Check network info text
    expect(screen.getByText('http://192.168.1.100:4000')).toBeInTheDocument();
  });

  it('loads with VITE_TMDB_API_KEY fallback and clicks back button', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { VITE_TMDB_API_KEY: 'vite_key' };
        if (channel === 'server:getNetworkInfo') return {};
        return {};
    });

    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    expect(screen.getByDisplayValue('vite_key')).toBeInTheDocument();

    const backBtn = screen.getByText('← common.back');
    fireEvent.click(backBtn);
    // Uses navigate('/') internally, we just ensure it doesn't throw and triggers the handler
  });

  it('handles directory selection', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return {};
        if (channel === 'server:getNetworkInfo') return {};
        if (channel === 'dialog:openDirectory') return '/new/path';
        return {};
    });

    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    const btn = screen.getByText('settings.select_btn');
    fireEvent.click(btn);

    await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dialog:openDirectory');
        expect(screen.getByDisplayValue('/new/path')).toBeInTheDocument();
    });
  });

  it('saves settings and handles restart', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { MEDIA_DIR: '/some/dir' };
        if (channel === 'server:getNetworkInfo') return {};
        if (channel === 'settings:save') return { success: true };
        if (channel === 'app:restart') return {};
        return {};
    });

    window.confirm.mockReturnValueOnce(true);

    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    // Change a setting
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '8080' } });

    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('settings:save', expect.objectContaining({
            PORT: '8080'
        }));
        expect(window.confirm).toHaveBeenCalled();
        expect(mockInvoke).toHaveBeenCalledWith('app:restart');
    });
  });

  it('shows alert if trying to save without media directory', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { MEDIA_DIR: '' }; // Empty dir
        if (channel === 'server:getNetworkInfo') return {};
        return {};
    });

    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    expect(window.alert).toHaveBeenCalledWith('Please select a directory');
    expect(mockInvoke).not.toHaveBeenCalledWith('settings:save', expect.anything());
  });

  it('handles loadData catch block', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Load Error'));
    renderComponent();
    await waitFor(() => {
        expect(screen.getByText('http://127.0.0.1:3000')).toBeInTheDocument();
    });
  });

  it('changes language on button click', async () => {
    mockInvoke.mockResolvedValue({});
    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));
    
    const langs = [
        { title: 'Türkçe', code: 'tr' },
        { title: 'English', code: 'en' },
        { title: 'Español', code: 'es' },
        { title: 'Deutsch', code: 'de' },
        { title: 'Français', code: 'fr' },
        { title: 'Русский', code: 'ru' }
    ];

    langs.forEach(lang => {
        const btn = screen.getByTitle(lang.title);
        fireEvent.click(btn);
        expect(changeLanguageMock).toHaveBeenCalledWith(lang.code);
    });
  });

  it('handles save error from IPC', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { MEDIA_DIR: '/some/dir' };
        if (channel === 'settings:save') return { success: false, error: 'Write failed' };
        return {};
    });

    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Error: Write failed');
    });
  });

  it('handles isSetupRequired prop during save', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { MEDIA_DIR: '/some/dir' };
        if (channel === 'settings:save') return { success: true };
        return {};
    });

    const onConfigUpdate = vi.fn();
    renderComponent({ isSetupRequired: true, onConfigUpdate });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
        expect(onConfigUpdate).toHaveBeenCalled();
        expect(window.alert).toHaveBeenCalledWith('Restarting');
        expect(mockInvoke).toHaveBeenCalledWith('app:restart');
    });
  });

  it('handles restart confirm cancel', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { MEDIA_DIR: '/some/dir' };
        if (channel === 'settings:save') return { success: true };
        return {};
    });
    window.confirm.mockReturnValueOnce(false);

    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith('Restart to apply?');
        expect(mockInvoke).not.toHaveBeenCalledWith('app:restart');
    });
  });

  it('handles Sync Database action', async () => {
    mockInvoke.mockResolvedValue({});
    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    fireEvent.click(screen.getByText('🔄 Sync DB'));
    expect(window.alert).toHaveBeenCalledWith('Processing');
    expect(mockInvoke).toHaveBeenCalledWith('file:syncDatabase');
  });

  it('handles Logout action', async () => {
    mockInvoke.mockResolvedValue({});
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload: reloadMock }, writable: true });
    
    // Test cancel
    window.confirm.mockReturnValueOnce(false);
    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));
    
    fireEvent.click(screen.getByText('🚪 Logout'));
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to logout?');
    expect(reloadMock).not.toHaveBeenCalled();

    // Test confirm
    window.confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByText('🚪 Logout'));
    expect(reloadMock).toHaveBeenCalled();
  });

  it('updates input fields', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { 
            PORT: '4000', 
            MEDIA_DIR: '/media', 
            TMDB_API_KEY: '', 
            AI_PROVIDER: 'nvidia',
            NVIDIA_API_KEY: '',
            GEMINI_API_KEY: '',
            JWT_SECRET: '' 
        };
        return {};
    });

    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    // PORT
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '8080' } });
    
    // TMDB_API_KEY
    fireEvent.change(screen.getByPlaceholderText('API Key...'), { target: { value: 'new_tmdb_key' } });
    
    // JWT_SECRET
    const inputs = document.querySelectorAll('input[type="password"]');
    // We mock settings:get to return JWT_SECRET: '' initially. Let's just find the first password input
    fireEvent.change(inputs[0], { target: { value: 'new_jwt_secret' } });
  });

  it('updates AI Provider and API Keys', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { AI_PROVIDER: 'nvidia' };
        return {};
    });
    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    // Change AI provider to gemini
    const providerSelect = screen.getByRole('combobox');
    fireEvent.change(providerSelect, { target: { value: 'gemini' } });
    
    // Gemini key input should appear
    const geminiInput = screen.getByPlaceholderText('AIza...');
    fireEvent.change(geminiInput, { target: { value: 'gemini_key' } });

    // Change AI provider back to nvidia
    fireEvent.change(providerSelect, { target: { value: 'nvidia' } });

    // Nvidia key input should appear
    const nvidiaInput = screen.getByPlaceholderText('nvapi-...');
    fireEvent.change(nvidiaInput, { target: { value: 'nvidia_key' } });
  });

  it('updates JWT secret', async () => {
    mockInvoke.mockImplementation(async (channel) => {
        if (channel === 'settings:get') return { JWT_SECRET: 'old_secret' };
        return {};
    });
    renderComponent();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('settings:get'));

    const inputs = document.querySelectorAll('input[type="password"]');
    // Assuming NVIDIA is the first password input by default, JWT is the second
    // But let's just find the one whose value is old_secret
    let jwtInput = Array.from(inputs).find(el => el.value === 'old_secret');
    fireEvent.change(jwtInput, { target: { value: 'new_secret' } });
  });
});
