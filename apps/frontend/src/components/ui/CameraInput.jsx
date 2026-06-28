import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CameraInput = ({
  onImageCapture,
  onSearchSubmit,
  disabled = false,
  size = 16,
  className = "",
  showPreview = true
}) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [deviceId, setDeviceId] = useState(null);
  const [devices, setDevices] = useState([]);

  // Get available camera devices
  useEffect(() => {
    const getCameraDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        
        if (videoDevices.length > 0) {
          setDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting camera devices:', err);
      }
    };

    getCameraDevices();
  }, []);

  // Initialize camera stream
  useEffect(() => {
    if (isCameraOpen && deviceId) {
      startCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen, deviceId]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      
      const constraints = {
        video: { deviceId: { exact: deviceId } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError(err.message);
      setIsCameraOpen(false);
    }
  };

  const switchCamera = async () => {
    if (!devices || devices.length <= 1) return;

    const currentIndex = devices.findIndex(device => device.deviceId === deviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setDeviceId(devices[nextIndex].deviceId);
  };

  const captureImage = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageDataUrl);
    onImageCapture && onImageCapture(imageDataUrl);

    // Trigger search submission if provided
    onSearchSubmit && onSearchSubmit(imageDataUrl);

    // Stop the camera after capturing
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target.result;
      setCapturedImage(imageDataUrl);
      onImageCapture && onImageCapture(imageDataUrl);

      // Trigger search submission if provided
      onSearchSubmit && onSearchSubmit(imageDataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Camera button */}
      <motion.button
        type="button"
        onClick={() => setIsCameraOpen(true)}
        disabled={disabled}
        className={`
          flex items-center justify-center
          p-1 rounded-full transition-all duration-200
          ${disabled 
            ? 'text-gray-500 cursor-not-allowed' 
            : 'text-gray-400 hover:text-white hover:bg-white/10'
          }
        `}
        whileHover={!disabled ? { scale: 1.1 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        aria-label="Open camera"
      >
        <Camera size={size} />
      </motion.button>

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              stopCamera();
              setCapturedImage(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="relative w-full max-w-2xl bg-black p-6 rounded-2xl border border-neutral-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Camera</h3>
                <button
                  onClick={() => {
                    stopCamera();
                    setCapturedImage(null);
                  }}
                  className="text-gray-400 hover:text-white p-1 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              {cameraError ? (
                <div className="text-red-500 text-center py-8">
                  <p>Error accessing camera: {cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {!capturedImage ? (
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-contain"
                      />
                      
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <button
                          onClick={captureImage}
                          className="w-16 h-16 rounded-full bg-red-500 border-4 border-white flex items-center justify-center"
                        >
                          <div className="w-12 h-12 rounded-full bg-red-500"></div>
                        </button>
                      </div>
                      
                      {devices.length > 1 && (
                        <button
                          onClick={switchCamera}
                          className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white"
                        >
                          <RotateCcw size={20} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                      <img 
                        src={capturedImage} 
                        alt="Captured" 
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                        <button
                          onClick={() => setCapturedImage(null)}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg"
                        >
                          Retake
                        </button>
                        <button
                          onClick={() => {
                            stopCamera();
                            setCapturedImage(null);
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg"
                        >
                          Use Photo
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-center">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg cursor-pointer">
                      <Upload size={18} />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                    </label>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CameraInput;