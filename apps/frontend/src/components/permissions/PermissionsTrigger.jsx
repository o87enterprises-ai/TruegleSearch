import { useEffect, useState } from 'react';

const PermissionsTrigger = ({ children, onSearchComplete }) => {
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (!hasTriggered && onSearchComplete) {
      onSearchComplete();
      setHasTriggered(true);
    }
  }, [hasTriggered, onSearchComplete]);

  return (
    <>
      {children}
    </>
  );
};

export default PermissionsTrigger;