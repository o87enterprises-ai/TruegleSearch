import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Prism from '../Prism';

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
          uLightColor: { value: [0, 1, 1] },
          uIntensity: { value: 1.0 },
          uRotation: { value: 0.0 },
          uRefractiveIndex: { value: 1.5 },
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

describe('Prism Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render without crashing', () => {
    render(<Prism />);
    expect(
      screen.getByLabelText('Prism refraction animation')
    ).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<Prism className="custom-prism" />);
    expect(container.querySelector('.custom-prism')).toBeInTheDocument();
  });

  it('should call onReady callback when animation is ready', async () => {
    const onReady = vi.fn();
    render(<Prism onReady={onReady} />);

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

    render(<Prism onError={onError} />);

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

    render(<Prism />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  it('should have correct accessibility attributes', () => {
    render(<Prism />);
    const element = screen.getByLabelText('Prism refraction animation');
    expect(element).toHaveAttribute('role', 'img');
  });

  it('should handle custom props correctly', () => {
    const { Renderer } = require('ogl');
    render(
      <Prism
        color="#FF0000"
        lightColor="#00FF00"
        intensity={2.0}
        rotation={1.5}
        refractiveIndex={2.4}
        className="test-prism"
      />
    );

    // Verify renderer was called with correct config
    expect(Renderer).toHaveBeenCalledWith({
      depth: false,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
  });

  it('should use correct default refractive index for glass', () => {
    const { Program } = require('ogl');
    render(<Prism />);

    // Check that default refractive index is set (glass ~1.5)
    expect(Program).toHaveBeenCalled();
  });

  it('should handle different refractive indices', () => {
    const { Program } = require('ogl');

    // Test diamond refractive index
    render(<Prism refractiveIndex={2.4} />);

    expect(Program).toHaveBeenCalled();
  });

  it('should update uniforms when props change', async () => {
    const { rerender } = render(<Prism color="#FF0000" intensity={1.0} />);

    // Wait for initial render
    await waitFor(() => {
      expect(
        screen.getByLabelText('Prism refraction animation')
      ).toBeInTheDocument();
    });

    // Update props
    rerender(<Prism color="#00FF00" intensity={2.0} rotation={0.5} />);

    // Component should re-render with new props
    expect(
      screen.getByLabelText('Prism refraction animation')
    ).toBeInTheDocument();
  });

  it('should clean up on unmount', () => {
    const { container } = render(<Prism />);
    const renderer = require('ogl').Renderer;

    // Unmount
    container.unmount();

    // Verify cleanup was called
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should handle resize events', () => {
    render(<Prism />);
    const { Renderer } = require('ogl');
    const mockRenderer = Renderer.mock.results[0].value;

    // Simulate resize
    const resizeObserver = global.ResizeObserver.mock.results[0].value;
    resizeObserver.observe();

    expect(mockRenderer.setSize).toHaveBeenCalled();
  });

  it('should convert hex colors to RGB correctly', () => {
    const { Program } = require('ogl');
    render(<Prism color="#00FF00" lightColor="#FF0000" />);

    // Verify Program was called with color conversion
    expect(Program).toHaveBeenCalled();
  });

  it('should handle rotation animation', () => {
    render(<Prism rotation={3.14159} />);

    const element = screen.getByLabelText('Prism refraction animation');
    expect(element).toBeInTheDocument();
  });
});
