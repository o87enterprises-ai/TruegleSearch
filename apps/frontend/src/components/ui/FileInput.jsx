import { useState, useRef } from 'react';
import { Paperclip, File, X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FileInput = ({
  onFileSelect,
  onSearchSubmit,
  disabled = false,
  size = 16,
  className = "",
  accept = "*/*",
  multiple = false
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };

  const processFiles = (files) => {
    const processedFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file
    }));

    setSelectedFiles(prev => [...prev, ...processedFiles]);
    onFileSelect && onFileSelect(processedFiles);

    // Trigger search submission if provided
    onSearchSubmit && onSearchSubmit(processedFiles);
  };

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const files = Array.from(event.dataTransfer.files);
      processFiles(files);
    }
  };

  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1">
        {/* File input button */}
        <motion.button
          type="button"
          onClick={() => fileInputRef.current?.click()}
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
          aria-label="Upload file"
        >
          <Paperclip size={size} />
        </motion.button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Drag and drop overlay */}
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="w-96 p-8 bg-neutral-900 border-2 border-dashed border-cyan-500 rounded-2xl text-center"
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <Upload size={48} className="mx-auto text-cyan-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Drop files here</h3>
                <p className="text-neutral-400">Upload your files to search</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected files preview */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-64 bg-neutral-800/90 backdrop-blur-sm rounded-lg p-3 z-10 shadow-xl"
          >
            <h4 className="text-sm font-medium text-white mb-2">Selected Files</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between bg-neutral-700/50 p-2 rounded">
                  <div className="flex items-center gap-2 truncate">
                    <File size={14} className="text-cyan-400 flex-shrink-0" />
                    <span className="text-xs text-white truncate">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="text-neutral-400 hover:text-white p-0.5 rounded-full"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileInput;