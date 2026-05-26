import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

export default function AuthInput({
  type = 'text',
  label,
  placeholder,
  value,
  onChange,
  error = null,
  icon: CustomIcon = null,
  showPasswordToggle = false,
  autoFocus = false,
  required = false,
  disabled = false,
  name,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Determine icon based on type
  const getIcon = () => {
    if (CustomIcon) return CustomIcon;
    if (type === 'email') return Mail;
    if (type === 'password') return Lock;
    if (type === 'text' && name === 'username') return User;
    return null;
  };

  const Icon = getIcon();
  const inputType = showPasswordToggle && showPassword ? 'text' : type;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Icon */}
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon size={20} className="text-gray-400" />
          </div>
        )}

        {/* Input */}
        <motion.input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            w-full h-12 px-4 rounded-xl
            ${Icon ? 'pl-12' : 'pl-4'}
            ${showPasswordToggle ? 'pr-12' : 'pr-4'}
            bg-gray-900/50 backdrop-blur-md
            border-2 transition-all duration-300
            text-white placeholder-gray-500
            ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20'
                : isFocused
                  ? 'border-cyan-500 ring-4 ring-cyan-500/20'
                  : 'border-cyan-500/30 hover:border-cyan-500/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            focus:outline-none
          `}
          whileFocus={{ scale: 1.01 }}
        />

        {/* Password Toggle */}
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-red-400 flex items-center gap-1"
        >
          <span className="text-red-500">•</span> {error}
        </motion.p>
      )}
    </div>
  );
}
