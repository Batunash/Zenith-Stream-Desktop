import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import FormInput from './FormInput';

describe('FormInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with a label', () => {
      render(<FormInput label="Test Label" onChange={mockOnChange} />);
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('renders with a placeholder', () => {
      render(<FormInput label="Test" placeholder="Enter value" onChange={mockOnChange} />);
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    });

    it('renders an input with the given type', () => {
      const { container } = render(<FormInput label="Test" type="email" onChange={mockOnChange} />);
      expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
    });

    it('defaults to type="text"', () => {
      const { container } = render(<FormInput label="Test" onChange={mockOnChange} />);
      expect(container.querySelector('input[type="text"]')).toBeInTheDocument();
    });
  });

  describe('Required Field', () => {
    it('shows the required indicator when required is true', () => {
      render(<FormInput label="Name" required={true} onChange={mockOnChange} />);
      const star = screen.getByText('*');
      expect(star).toBeInTheDocument();
      expect(star).toHaveStyle('color: rgb(229, 9, 20)');
    });

    it('does not show the required indicator when required is false', () => {
      render(<FormInput label="Name" required={false} onChange={mockOnChange} />);
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });
  });

  describe('Input Behavior', () => {
    it('calls onChange when the input value changes', () => {
      render(<FormInput label="Test" onChange={mockOnChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new value' } });
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('has the value controlled by the prop', () => {
      render(<FormInput label="Test" value="initial" onChange={mockOnChange} />);
      expect(screen.getByRole('textbox')).toHaveValue('initial');
    });

    it('has the correct styling', () => {
      render(<FormInput label="Test" onChange={mockOnChange} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveStyle('background-color: rgb(34, 34, 34)');
      expect(input).toHaveStyle('border-radius: 8px');
    });
  });

  describe('Text Area Mode', () => {
    it('renders a textarea when isTextArea is true', () => {
      render(<FormInput label="Description" isTextArea={true} onChange={mockOnChange} />);
      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    });

    it('has rows=4 for the textarea', () => {
      render(<FormInput label="Description" isTextArea={true} onChange={mockOnChange} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
    });

    it('has resize:vertical for the textarea', () => {
      render(<FormInput label="Description" isTextArea={true} onChange={mockOnChange} />);
      expect(screen.getByRole('textbox')).toHaveStyle('resize: vertical');
    });

    it('calls onChange when the textarea value changes', () => {
      render(<FormInput label="Description" isTextArea={true} onChange={mockOnChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new description' } });
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Different Input Types', () => {
    it('renders a password input', () => {
      const { container } = render(<FormInput label="Password" type="password" onChange={mockOnChange} />);
      expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
    });

    it('renders an email input', () => {
      const { container } = render(<FormInput label="Email" type="email" onChange={mockOnChange} />);
      expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
    });

    it('renders a number input', () => {
      const { container } = render(<FormInput label="Age" type="number" onChange={mockOnChange} />);
      expect(container.querySelector('input[type="number"]')).toBeInTheDocument();
    });
  });

  describe('Label Styling', () => {
    it('has the correct label color', () => {
      render(<FormInput label="Test Label" onChange={mockOnChange} />);
      expect(screen.getByText('Test Label')).toHaveStyle('color: rgb(204, 204, 204)');
    });

    it('has the correct label font size', () => {
      render(<FormInput label="Test Label" onChange={mockOnChange} />);
      expect(screen.getByText('Test Label')).toHaveStyle('font-size: 0.9rem');
    });
  });

  describe('Wrapper Styling', () => {
    it('has margin-bottom on its wrapper div', () => {
      const { container } = render(<FormInput label="Test" onChange={mockOnChange} />);
      expect(container.firstChild).toHaveStyle('margin-bottom: 20px');
    });
  });
});