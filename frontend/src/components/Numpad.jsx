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
      <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
        <div className="flex justify-center gap-3">
          {[...Array(maxLength)].map((_, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0.8 }}
              animate={{ scale: value.length > index ? 1 : 0.8 }}
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                value.length > index
                  ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white shadow-lg'
                  : 'bg-gray-50 border border-gray-300 text-gray-400'
              }`}
            >
              {value.length > index ? '●' : '○'}
            </motion.div>
          ))}
        </div>
        
        {/* PIN Length Indicator */}
        <div className="mt-4 text-center text-sm text-gray-600">
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
                h-16 rounded-xl font-semibold text-xl transition-all border
                ${isNumber
                  ? 'bg-white border-gray-200 text-gray-900 hover:border-amber-700 hover:shadow-lg'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
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
          className="w-full mt-4 py-4 bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-amber-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Masuk
        </motion.button>
      )}
    </div>
  );
};

export default Numpad;
