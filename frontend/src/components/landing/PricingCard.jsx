import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';

const PricingCard = ({ plan, index = 0, onSelect }) => {
  const { name, price, originalPrice, period, description, features, highlighted, badge } = plan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className={`rounded-2xl p-8 relative ${
        highlighted
          ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-3 border-amber-700 shadow-2xl transform scale-105'
          : 'bg-white border border-gray-200 shadow-lg'
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="px-4 py-1 bg-amber-700 text-white text-xs font-bold rounded-full shadow-md">
            {badge}
          </span>
        </div>
      )}
      
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">{name}</h3>
        {description && (
          <p className="text-sm text-gray-600 italic">{description}</p>
        )}
      </div>

      <div className="text-center mb-6">
        {originalPrice ? (
          <>
            {/* Harga Original (Coret) dengan periode */}
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-2xl text-gray-400 line-through">{originalPrice}</span>
              {period && <span className="text-gray-400 text-sm">/ {period}</span>}
            </div>
            {/* Harga Diskon (Lebih Kecil) */}
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold text-gray-900">{price}</span>
            </div>
          </>
        ) : (
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-gray-900">{price}</span>
            {period && <span className="text-gray-600 text-sm">/ {period}</span>}
          </div>
        )}
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, idx) => {
          // Check if feature is in parentheses (no checkmark)
          const isNote = feature.startsWith('(') && feature.endsWith(')');
          
          return (
            <li key={idx} className={`flex items-start gap-2 ${isNote ? 'ml-7' : ''}`}>
              {!isNote && <FiCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
              <span className={`text-sm ${isNote ? 'text-gray-600 italic' : 'text-gray-700'}`}>
                {feature}
              </span>
            </li>
          );
        })}
      </ul>

      <button
        onClick={() => onSelect && onSelect(plan)}
        className={`block w-full py-3 rounded-lg font-semibold text-center transition-all ${
          highlighted
            ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-white hover:shadow-lg hover:shadow-amber-700/50 transform hover:scale-105'
            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
        }`}
      >
        Pilih Paket
      </button>
    </motion.div>
  );
};

export default PricingCard;
