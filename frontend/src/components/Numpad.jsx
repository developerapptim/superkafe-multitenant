import { motion } from 'framer-motion';
import { FiDelete } from 'react-icons/fi';

/**
 * Numpad Component - Visual numeric keypad untuk PIN input
 * Glassmorphism design dengan animasi smooth
 */
const Numpad = ({ value, onChange, maxLength = 6, onSubmit }) => {
  const handleNumberClick = (num) => {
    if (value.length < maxLength) {
      onChange(value + num);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const handleSubmit = () => {
    if (value.length >= 4 && onSubmit) {
      onSubmit(value);
    }
  };

  const numbers = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['C', 0, '⌫']
  ];

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* PIN Display */}
      <div className="mb-6 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6">
        <div className="flex justify-center gap-3">
          {[...Array(maxLength)].map((_, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0.8 }}
              animate={{ scale: value.length > index ? 1 : 0.8 }}
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                value.length > index
                  ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/30'
              }`}
            >
              {value.length > index ? '●' : '○'}
            </motion.div>
          ))}
        </div>
        
        {/* PIN Length Indicator */}
        <div className="mt-4 text-center text-sm text-white/60">
          {value.length} / {maxLength} digit
        </div>
      </div>

      {/* Numpad Grid */}
      <div className="grid grid-cols-3 gap-3">
        {numbers.flat().map((num, index) => {
          const isNumber = typeof num === 'number';
          const isClear = num === 'C';
          const isBackspace = num === '⌫';

          return (
            <motion.button
              key={index}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (isNumber) handleNumberClick(num);
                else if (isClear) handleClear();
                else if (isBackspace) handleBackspace();
              }}
              className={`
                h-16 rounded-xl font-semibold text-xl transition-all
                backdrop-blur-xl border
                ${isNumber
                  ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }
                active:scale-95
              `}
            >
              {isBackspace ? <FiDelete className="mx-auto" size={24} /> : num}
            </motion.button>
          );
        })}
      </div>

      {/* Submit Button */}
      {onSubmit && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={value.length < 4}
          className="w-full mt-4 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-semibold text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Masuk
        </motion.button>
      )}
    </div>
  );
};

export default Numpad;
