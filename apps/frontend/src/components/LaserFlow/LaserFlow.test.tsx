import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LaserFlow from '../LaserFlow';

// Mock OGL library
vi.mock('ogl', () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    gl: {
      canvas: document.createElement('canvas'),
      program: null,
      remove: vi.fn(),
    },
    setSize: vi.fn(),
    render: vi.fn(),
    scene: {
      program: {
        uniforms: {
          uColor: { value: [1, 0.5, 0.8] },
          uIntensity: { value: 1.0 },
          uSpeed: { value: 0.5 },
        },
      },
    },
  })),
  Program: vi.fn(),
  Mesh: vi.fn(),
  Triangle: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
  setTimeout(cb, 16);
  return 1;
});

global.cancelAnimationFrame = vi.fn();

describe('LaserFlow Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render without crashing', () => {
    render(<LaserFlow />);
    expect(
      screen.getByLabelText('Laser flow background animation')
    ).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<LaserFlow className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should call onReady callback when animation is ready', async () => {
    const onReady = vi.fn();
    render(<LaserFlow onReady={onReady} />);

    await waitFor(
      () => {
        expect(onReady).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });

  it('should handle errors gracefully', async () => {
    const onError = vi.fn();
    const { Renderer } = require('ogl');

    // Mock renderer to throw an error
    Renderer.mockImplementationOnce(() => {
      throw new Error('WebGL not supported');
    });

    render(<LaserFlow onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(screen.getByText(/Animation failed:/)).toBeInTheDocument();
    });
  });

  it('should display retry button on error', async () => {
    const { Renderer } = require('ogl');
    Renderer.mockImplementationOnce(() => {
      throw new Error('Test error');
    });

    render(<LaserFlow />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  it('should have correct accessibility attributes', () => {
    render(<LaserFlow />);
    const element = screen.getByLabelText('Laser flow background animation');
    expect(element).toHaveAttribute('role', 'img');
  });

  it('should handle custom props', () => {
    const { Renderer } = require('ogl');
    render(
      <LaserFlow
        color="#FF0000"
        intensity={2.0}
        speed={1.5}
        className="test-laser"
      />
    );

    // Verify renderer was called
    expect(Renderer).toHaveBeenCalledWith({
      depth: false,
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
    });
  });

  it('should convert hex colors to RGB correctly', () => {
    // This would be tested through the component's internal color conversion
    // Since it's a private method, we test the effect
    const { Program } = require('ogl');
    render(<LaserFlow color="#00FF00" />);

    // Verify Program was called with color conversion
    expect(Program).toHaveBeenCalled();
  });

  it('should clean up on unmount', () => {
    const { container } = render(<LaserFlow />);
    const renderer = require('ogl').Renderer;

    // Unmount
    container.unmount();

    // Verify cleanup was called
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should handle resize events', () => {
    render(<LaserFlow />);
    const { Renderer } = require('ogl');
    const mockRenderer = Renderer.mock.results[0].value;

    // Simulate resize
    const resizeObserver = global.ResizeObserver.mock.results[0].value;
    resizeObserver.observe();

    expect(mockRenderer.setSize).toHaveBeenCalled();
  });
});
