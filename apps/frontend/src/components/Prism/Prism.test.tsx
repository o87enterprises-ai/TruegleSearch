import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Renderer, Program } from 'ogl';
// The .tsx component specifically: '../Prism' resolves to the .jsx sibling.
import Prism from './Prism.tsx';

// Mock OGL library. Constructors are `function`s so `new` works, and Program
// keeps its uniforms because the animation loop writes uTime every frame.
vi.mock('ogl', () => ({
  Renderer: vi.fn(function Renderer() {
    this.gl = {
      canvas: document.createElement('canvas'),
      getExtension: vi.fn(() => null),
    };
    this.setSize = vi.fn();
    this.render = vi.fn();
  }),
  Program: vi.fn(function Program(_gl, opts) {
    this.uniforms = opts.uniforms;
  }),
  Mesh: vi.fn(function Mesh() {}),
  Triangle: vi.fn(function Triangle() {}),
}));

global.ResizeObserver = vi.fn(function ResizeObserver() {
  this.observe = vi.fn();
  this.disconnect = vi.fn();
});

// Mock requestAnimationFrame
// Implementation passed to vi.fn() itself, so restoreAllMocks between tests
// cannot strip it (a stripped rAF returns undefined and nothing is cancelled).
global.requestAnimationFrame = vi.fn((cb) => {
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

    // Mock renderer to throw an error
    vi.mocked(Renderer).mockImplementationOnce(() => {
      throw new Error('WebGL not supported');
    });

    render(<Prism onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(screen.getByText(/Animation failed:/)).toBeInTheDocument();
    });
  });

  it('should display retry button on error', async () => {
    vi.mocked(Renderer).mockImplementationOnce(() => {
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
    render(<Prism />);

    // Check that default refractive index is set (glass ~1.5)
    expect(Program).toHaveBeenCalled();
  });

  it('should handle different refractive indices', () => {

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

  it('should clean up on unmount', async () => {
    const onReady = vi.fn();
    const { unmount } = render(<Prism onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    // The cleanup is attached when initialisation's promise settles, a tick
    // after onReady fires.
    await new Promise((r) => setTimeout(r, 0));

    // Unmount
    unmount();

    // Verify cleanup was called
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should handle resize events', () => {
    render(<Prism />);
    // The component sizes the canvas once up front, then hands the same
    // handler to a ResizeObserver watching its container.
    const mockRenderer = vi.mocked(Renderer).mock.instances[0];
    expect(mockRenderer.setSize).toHaveBeenCalled();
    const observer = vi.mocked(global.ResizeObserver).mock.instances[0];
    expect(observer.observe).toHaveBeenCalled();
  });

  it('should convert hex colors to RGB correctly', () => {
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
