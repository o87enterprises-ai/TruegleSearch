export interface LaserFlowProps {
  /** CSS class name for styling */
  className?: string;
  /** Laser color in hex format */
  color?: string;
  /** Animation intensity multiplier */
  intensity?: number;
  /** Animation speed multiplier */
  speed?: number;
  /** Callback when animation is ready */
  onReady?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export interface LaserFlowState {
  /** Current animation status */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Error message if failed */
  error: string;
  /** Performance metrics */
  metrics?: {
    /** Frame time in milliseconds */
    frameTime: number;
    /** Memory usage in bytes */
    memoryUsage: number;
    /** Animation frame count */
    frameCount: number;
  };
}
