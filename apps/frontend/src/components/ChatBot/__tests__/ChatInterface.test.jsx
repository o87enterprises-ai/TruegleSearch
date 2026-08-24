import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ChatInterface from '../ChatInterface';

// Mock the aiAPI
vi.mock('../../../services/api', () => ({
  aiAPI: {
    chat: vi.fn().mockResolvedValue({
      data: {
        response: {
          choices: [{
            message: {
              content: 'Mocked AI response'
            }
          }]
        }
      }
    })
  }
}));

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: ({ children }) => <div>{children}</div>,
    AnimatePresence: ({ children }) => <div>{children}</div>,
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    X: () => <span>X</span>,
    Send: () => <span>Send</span>,
    Sparkles: () => <span>Sparkles</span>,
    RefreshCw: () => <span>RefreshCw</span>,
    ThumbsUp: () => <span>ThumbsUp</span>,
    ThumbsDown: () => <span>ThumbsDown</span>,
  };
});

describe('ChatInterface', () => {
  const mockOnClose = vi.fn();
  const initialProps = {
    isOpen: true,
    onClose: mockOnClose,
    initialSummary: 'Initial summary',
    context: 'general'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders correctly when open', () => {
    render(<ChatInterface {...initialProps} />);
    
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Ask follow-up questions for deeper insights')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask a follow-up question...')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ChatInterface {...initialProps} isOpen={false} />);
    
    expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument();
  });

  it('displays initial summary message', () => {
    render(<ChatInterface {...initialProps} />);
    
    expect(screen.getByText('Initial summary')).toBeInTheDocument();
  });

  it('allows user to type and send a message', async () => {
    render(<ChatInterface {...initialProps} />);
    
    const input = screen.getByPlaceholderText('Ask a follow-up question...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  it('calls aiAPI.chat when sending a message', async () => {
    const { aiAPI } = await import('../../../services/api');
    render(<ChatInterface {...initialProps} />);
    
    const input = screen.getByPlaceholderText('Ask a follow-up question...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(aiAPI.chat).toHaveBeenCalledWith('Test message');
    });
  });

  it('displays AI response after sending a message', async () => {
    render(<ChatInterface {...initialProps} />);
    
    const input = screen.getByPlaceholderText('Ask a follow-up question...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Mocked AI response')).toBeInTheDocument();
    });
  });

  it('shows loading state while waiting for AI response', async () => {
    // Mock a delayed response
    const { aiAPI } = await import('../../../services/api');
    vi.mocked(aiAPI.chat).mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          data: {
            response: {
              choices: [{
                message: {
                  content: 'Delayed response'
                }
              }]
            }
          }
        }), 100)
      )
    );
    
    render(<ChatInterface {...initialProps} />);
    
    const input = screen.getByPlaceholderText('Ask a follow-up question...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    // Check that loading indicator appears
    expect(screen.getByText('RefreshCw')).toBeInTheDocument(); // The spinner icon
    
    await waitFor(() => {
      expect(screen.getByText('Delayed response')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    const { aiAPI } = await import('../../../services/api');
    vi.mocked(aiAPI.chat).mockRejectedValue({
      response: {
        data: {
          message: 'API Error occurred'
        }
      }
    });
    
    render(<ChatInterface {...initialProps} />);
    
    const input = screen.getByPlaceholderText('Ask a follow-up question...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText(/I'm sorry, but I encountered an error processing your request/)).toBeInTheDocument();
      expect(screen.getByText('API Error occurred')).toBeInTheDocument();
    });
  });

  it('closes the chat when close button is clicked', () => {
    render(<ChatInterface {...initialProps} />);
    
    const closeButton = screen.getByText('X');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('submits message when Enter key is pressed', async () => {
    const { aiAPI } = await import('../../../services/api');
    render(<ChatInterface {...initialProps} />);
    
    const input = screen.getByPlaceholderText('Ask a follow-up question...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(aiAPI.chat).toHaveBeenCalledWith('Test message');
    });
  });

  it('does not submit message when Shift+Enter is pressed', async () => {
    const { aiAPI } = await import('../../../services/api');
    render(<ChatInterface {...initialProps} />);
    
    const input = screen.getByPlaceholderText('Ask a follow-up question...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', shiftKey: true });
    
    // Wait a bit to ensure no API call was made
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(aiAPI.chat).not.toHaveBeenCalled();
  });

  it('shows different header text for OSINT context', () => {
    render(<ChatInterface {...initialProps} context="osint" />);
    
    expect(screen.getByText('OSINT/SEO AI Assistant')).toBeInTheDocument();
  });
});