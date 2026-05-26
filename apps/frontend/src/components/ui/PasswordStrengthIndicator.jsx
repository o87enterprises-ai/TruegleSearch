import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export default function PasswordStrengthIndicator({
  password,
  showRequirements = true,
}) {
  // Calculate password strength
  const getStrength = (pass) => {
    if (!pass) return { level: 0, label: '', color: '' };

    let score = 0;
    const checks = {
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[^A-Za-z0-9]/.test(pass),
    };

    if (checks.length) score++;
    if (checks.uppercase) score++;
    if (checks.lowercase) score++;
    if (checks.number) score++;
    if (checks.special) score++;

    if (score <= 2)
      return { level: 1, label: 'Weak', color: 'bg-red-500', checks };
    if (score <= 3)
      return { level: 2, label: 'Medium', color: 'bg-yellow-500', checks };
    if (score <= 4)
      return { level: 3, label: 'Strong', color: 'bg-green-500', checks };
    return { level: 4, label: 'Very Strong', color: 'bg-green-600', checks };
  };

  const strength = getStrength(password);

  if (!password) return null;

  return (
    <div className="mt-3">
      {/* Strength Bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(strength.level / 4) * 100}%` }}
            className={`h-full ${strength.color} transition-all duration-300`}
          />
        </div>
        <span
          className={`text-sm font-medium ${
            strength.level === 1
              ? 'text-red-400'
              : strength.level === 2
                ? 'text-yellow-400'
                : 'text-green-400'
          }`}
        >
          {strength.label}
        </span>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && strength.checks && (
        <div className="space-y-1">
          <Requirement met={strength.checks.length}>
            At least 8 characters
          </Requirement>
          <Requirement met={strength.checks.uppercase}>
            One uppercase letter
          </Requirement>
          <Requirement met={strength.checks.number}>One number</Requirement>
          <Requirement met={strength.checks.special}>
            One special character
          </Requirement>
        </div>
      )}
    </div>
  );
}

function Requirement({ met, children }) {
  return (
    <div
      className={`flex items-center gap-2 text-xs transition-colors ${
        met ? 'text-green-400' : 'text-gray-500'
      }`}
    >
      {met ? (
        <Check size={14} className="text-green-500" />
      ) : (
        <X size={14} className="text-gray-600" />
      )}
      <span>{children}</span>
    </div>
  );
}
