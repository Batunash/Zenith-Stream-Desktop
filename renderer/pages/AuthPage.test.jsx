/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import AuthPage from './AuthPage';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const keys = {
        'auth.welcome': 'Welcome',
        'auth.create_account': 'Create Account',
        'auth.subtitle': 'Please login',
        'auth.username': 'Username',
        'auth.password': 'Password',
        'auth.fill_all': 'Please fill all fields',
        'auth.login_btn': 'Login',
        'auth.register_btn': 'Register',
        'auth.no_account': 'No account?',
        'auth.has_account': 'Already have an account?',
        'auth.unexpected_error': 'Unexpected error',
        'auth.server_timeout': 'Timeout',
        'common.processing': 'Processing...'
      };
      return keys[key] || key;
    }
  })
}));

const mockInvoke = vi.fn();
const mockOnLoginSuccess = vi.fn();

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.api = { invoke: mockInvoke };
    window.alert = vi.fn(); // mock alert for register success
  });

  const renderComponent = () => render(<AuthPage onLoginSuccess={mockOnLoginSuccess} />);

  it('renders login form by default', () => {
    renderComponent();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('toggles to register form when link is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Register', { selector: 'span' }));
    
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('shows error if fields are empty on submit', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    
    expect(screen.getByText('Please fill all fields')).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('calls auth:login and onLoginSuccess when login is successful', async () => {
    mockInvoke.mockResolvedValueOnce({ success: true, user: { ID: 1, USERNAME: 'testuser' } });
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.getByText('Processing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('auth:login', { username: 'testuser', password: 'password123' });
      expect(mockOnLoginSuccess).toHaveBeenCalledWith({ ID: 1, USERNAME: 'testuser' });
    });
  });

  it('shows error message if login fails', async () => {
    mockInvoke.mockResolvedValueOnce({ success: false, message: 'Invalid credentials' });
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      expect(mockOnLoginSuccess).not.toHaveBeenCalled();
    });
  });

    it('calls auth:register, shows alert, and switches to login on successful registration', async () => {
        mockInvoke.mockResolvedValueOnce({ success: true, message: 'User created' });
        renderComponent();

        // Switch to register mode
        fireEvent.click(screen.getByText('Register', { selector: 'span' }));
        
        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newuser' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'newpass' } });
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));

        await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('auth:register', { username: 'newuser', password: 'newpass' });
        expect(window.alert).toHaveBeenCalledWith('User created');
        // Should switch back to login mode (Wait, 'Welcome' is the login title)
        expect(screen.getByText('Welcome')).toBeInTheDocument();
        });
    });

    it('handles unexpected errors gracefully', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockInvoke.mockRejectedValueOnce(new Error('Network error'));
        renderComponent();

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: 'Login' }));

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });

        expect(console.error).toHaveBeenCalledWith(expect.any(Error));
    });
});
