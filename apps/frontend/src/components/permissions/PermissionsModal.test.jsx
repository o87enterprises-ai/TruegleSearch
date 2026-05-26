import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PermissionsModal from './PermissionsModal';

vi.mock('../../api/browserSettings', () => ({
  default: {
    setSearchEngine: vi.fn(),
    setHomepage: vi.fn(),
    setAIAssistant: vi.fn(),
    setAll: vi.fn(),
    getBrowserInfo: vi.fn(() => ({ name: 'Chrome', supportsAPI: true })),
    getInstructions: vi.fn(() => ({
      title: 'Manual Setup for Chrome',
      steps: ['Step 1', 'Step 2', 'Step 3']
    }))
  }
}));

vi.mock('../../hooks/permissions/usePermissions', () => ({
  usePermissions: vi.fn(() => ({
    permissions: {
      searchEngine: false,
      homepage: false,
      aiAssistant: false
    },
    togglePermission: vi.fn(),
    acceptPermissions: vi.fn(),
    dismissModal: vi.fn(),
    browserInfo: { name: 'Chrome', supportsAPI: true }
  }))
}));

vi.mock('../../utils/cn', () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' '))
}));

describe('PermissionsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render without crashing', () => {
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Make Truegle Your Default')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<PermissionsModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Make Truegle Your Default')).not.toBeInTheDocument();
  });

  it('should render three permission toggles', () => {
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText('Set as Default Search Engine')).toBeInTheDocument();
    expect(screen.getByText('Set as Homepage')).toBeInTheDocument();
    expect(screen.getByText('Set as AI Assistant Default')).toBeInTheDocument();
  });

  it('should display benefit text for each permission', () => {
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText('Get instant results without switching tabs')).toBeInTheDocument();
    expect(screen.getByText('Start every browsing session with Truegle')).toBeInTheDocument();
    expect(screen.getByText('Quick AI answers from your keyboard')).toBeInTheDocument();
  });

  it('should have Accept Selected button', () => {
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    expect(acceptButton).toBeInTheDocument();
  });

  it('should have Skip for now button', () => {
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const skipButton = screen.getByRole('button', { name: /skip for now/i });
    expect(skipButton).toBeInTheDocument();
  });

  it('should have close button', () => {
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const closeButton = screen.getByRole('button', { name: /close modal/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PermissionsModal isOpen={true} onClose={onClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when Skip button is clicked', () => {
    const onClose = vi.fn();
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    const mockDismissModal = vi.fn();
    usePermissions.mockReturnValue({
      permissions: { searchEngine: false, homepage: false, aiAssistant: false },
      togglePermission: vi.fn(),
      acceptPermissions: vi.fn(),
      dismissModal: mockDismissModal,
      browserInfo: { name: 'Chrome', supportsAPI: true }
    });
    
    render(<PermissionsModal isOpen={true} onClose={onClose} />);
    
    const skipButton = screen.getByRole('button', { name: /skip for now/i });
    fireEvent.click(skipButton);
    
    expect(mockDismissModal).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should disable Accept button when no permissions are selected', () => {
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    expect(acceptButton).toBeDisabled();
  });

  it('should enable Accept button when at least one permission is selected', () => {
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    usePermissions.mockReturnValue({
      permissions: { searchEngine: true, homepage: false, aiAssistant: false },
      togglePermission: vi.fn(),
      acceptPermissions: vi.fn(),
      dismissModal: vi.fn(),
      browserInfo: { name: 'Chrome', supportsAPI: true }
    });
    
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    expect(acceptButton).not.toBeDisabled();
  });

  it('should show loading state when permissions are being set', async () => {
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    const mockAcceptPermissions = vi.fn().mockImplementation(() => new Promise(() => {}));
    
    usePermissions.mockReturnValue({
      permissions: { searchEngine: true, homepage: true, aiAssistant: true },
      togglePermission: vi.fn(),
      acceptPermissions: mockAcceptPermissions,
      dismissModal: vi.fn(),
      browserInfo: { name: 'Chrome', supportsAPI: true }
    });
    
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    fireEvent.click(acceptButton);
    
    await waitFor(() => {
      expect(screen.getByText('Setting defaults...')).toBeInTheDocument();
    });
  });

  it('should show success message when permissions are set successfully', async () => {
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    const mockAcceptPermissions = vi.fn().mockResolvedValue({ success: true });
    
    usePermissions.mockReturnValue({
      permissions: { searchEngine: true, homepage: true, aiAssistant: true },
      togglePermission: vi.fn(),
      acceptPermissions: mockAcceptPermissions,
      dismissModal: vi.fn(),
      browserInfo: { name: 'Chrome', supportsAPI: true }
    });
    
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    fireEvent.click(acceptButton);
    
    await waitFor(() => {
      expect(screen.getByText('Permissions set successfully!')).toBeInTheDocument();
    });
  });

  it('should show error message when setting permissions fails', async () => {
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    const mockAcceptPermissions = vi.fn().mockResolvedValue({ 
      success: false, 
      error: 'API not available' 
    });
    
    usePermissions.mockReturnValue({
      permissions: { searchEngine: true, homepage: true, aiAssistant: true },
      togglePermission: vi.fn(),
      acceptPermissions: mockAcceptPermissions,
      dismissModal: vi.fn(),
      browserInfo: { name: 'Chrome', supportsAPI: true }
    });
    
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    fireEvent.click(acceptButton);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to set permissions automatically')).toBeInTheDocument();
    });
  });

  it('should show manual setup instructions when browser does not support API', async () => {
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    usePermissions.mockReturnValue({
      permissions: { searchEngine: true, homepage: true, aiAssistant: true },
      togglePermission: vi.fn(),
      acceptPermissions: vi.fn(),
      dismissModal: vi.fn(),
      browserInfo: { name: 'Safari', supportsAPI: false }
    });
    
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    fireEvent.click(acceptButton);
    
    await waitFor(() => {
      expect(screen.getByText('Manual Setup for Safari')).toBeInTheDocument();
    });
  });

  it('should display manual setup steps', async () => {
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    const BROWSER_API = require('../../api/browserSettings').default;
    
    BROWSER_API.getInstructions.mockReturnValue({
      title: 'Manual Setup for Chrome',
      steps: ['Open Chrome settings', 'Click "Search engine"', 'Select "Truegle"']
    });
    
    usePermissions.mockReturnValue({
      permissions: { searchEngine: true, homepage: true, aiAssistant: true },
      togglePermission: vi.fn(),
      acceptPermissions: vi.fn(),
      dismissModal: vi.fn(),
      browserInfo: { name: 'Chrome', supportsAPI: false }
    });
    
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    fireEvent.click(acceptButton);
    
    await waitFor(() => {
      expect(screen.getByText('Open Chrome settings')).toBeInTheDocument();
      expect(screen.getByText('Click "Search engine"')).toBeInTheDocument();
      expect(screen.getByText('Select "Truegle"')).toBeInTheDocument();
    });
  });

  it('should have correct accessibility attributes', () => {
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby', 'permissions-title');
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(<PermissionsModal isOpen={true} onClose={onClose} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should close when clicking outside modal', () => {
    const onClose = vi.fn();
    render(<PermissionsModal isOpen={true} onClose={onClose} />);
    
    const overlay = document.querySelector('.fixed.inset-0');
    fireEvent.click(overlay);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should not close when clicking inside modal', () => {
    const onClose = vi.fn();
    render(<PermissionsModal isOpen={true} onClose={onClose} />);
    
    const modalContent = screen.getByText('Make Truegle Your Default').parentElement;
    fireEvent.click(modalContent);
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onFirstSearch callback when modal is dismissed', () => {
    const onClose = vi.fn();
    const onFirstSearch = vi.fn();
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    
    usePermissions.mockReturnValue({
      permissions: { searchEngine: true, homepage: true, aiAssistant: true },
      togglePermission: vi.fn(),
      acceptPermissions: vi.fn(),
      dismissModal: vi.fn(),
      browserInfo: { name: 'Chrome', supportsAPI: true }
    });
    
    render(<PermissionsModal isOpen={true} onClose={onClose} onFirstSearch={onFirstSearch} />);
    
    const skipButton = screen.getByRole('button', { name: /skip for now/i });
    fireEvent.click(skipButton);
    
    expect(onFirstSearch).toHaveBeenCalled();
  });

  it('should render with Truegle brand styling', () => {
    const { container } = render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const modal = container.querySelector('.bg-gradient-to-br');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveClass('from-neutral-900/95');
  });

  it('should show Back button in manual setup view', async () => {
    const { usePermissions } = require('../../hooks/permissions/usePermissions');
    usePermissions.mockReturnValue({
      permissions: { searchEngine: true, homepage: true, aiAssistant: true },
      togglePermission: vi.fn(),
      acceptPermissions: vi.fn(),
      dismissModal: vi.fn(),
      browserInfo: { name: 'Safari', supportsAPI: false }
    });
    
    render(<PermissionsModal isOpen={true} onClose={vi.fn()} />);
    
    const acceptButton = screen.getByRole('button', { name: /accept selected/i });
    fireEvent.click(acceptButton);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });
  });
});