import { cn } from '../../utils/cn';

const Skeleton = ({ className, variant = 'rectangular', ...props }) => {
  const baseStyles = 'animate-pulse bg-neutral-800';

  const variantStyles = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4',
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    />
  );
};

const SkeletonText = ({ lines = 3, className }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={cn('h-4', i === lines - 1 && 'w-3/4')}
      />
    ))}
  </div>
);

const SkeletonCard = ({ className }) => (
  <div
    className={cn(
      'p-4 rounded-xl border border-white/10 bg-neutral-900/80 backdrop-blur-md',
      className
    )}
  >
    <div className="flex items-start gap-4">
      <Skeleton variant="circular" className="w-12 h-12 flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-1/3" />
        <SkeletonText lines={2} />
      </div>
    </div>
  </div>
);

const SkeletonAvatar = ({ size = 'md', className }) => {
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <Skeleton
      variant="circular"
      className={cn(sizeStyles[size], className)}
    />
  );
};

const SkeletonButton = ({ size = 'md', className }) => {
  const sizeStyles = {
    sm: 'h-8 w-20',
    md: 'h-10 w-24',
    lg: 'h-12 w-32',
  };

  return (
    <Skeleton
      className={cn('rounded-lg', sizeStyles[size], className)}
    />
  );
};

const SkeletonSearchResult = ({ className }) => (
  <div
    className={cn(
      'p-4 rounded-xl border border-white/10 bg-neutral-900/80 backdrop-blur-md space-y-3',
      className
    )}
  >
    {/* Source and date */}
    <div className="flex items-center gap-2">
      <Skeleton className="w-4 h-4 rounded" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
    {/* Title */}
    <Skeleton className="h-5 w-4/5" />
    {/* URL */}
    <Skeleton className="h-3 w-2/3" />
    {/* Description */}
    <SkeletonText lines={2} />
    {/* Actions */}
    <div className="flex items-center gap-2 pt-2">
      <Skeleton className="h-8 w-20 rounded-lg" />
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
  </div>
);

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonSearchResult,
};

export default Skeleton;
