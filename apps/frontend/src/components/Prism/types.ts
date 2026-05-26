export interface PrismProps {
  /** CSS class name for styling */
  className?: string;
  /** Prism material color in hex format */
  color?: string;
  /** Light source color in hex format */
  lightColor?: string;
  /** Animation intensity multiplier */
  intensity?: number;
  /** Initial rotation angle in radians */
  rotation?: number;
  /** Refractive index for light bending simulation */
  refractiveIndex?: number;
  /** Callback when animation is ready */
  onReady?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export interface PrismState {
  /** Current animation status */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Error message if failed */
  error: string;
  /** Performance metrics */
  metrics?: {
    /** Ray marching steps per frame */
    stepsPerFrame: number;
    /** Frame time in milliseconds */
    frameTime: number;
    /** Refraction calculations per second */
    refractionsPerSecond: number;
  };
}
