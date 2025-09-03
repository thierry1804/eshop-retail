import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = i18n.language;

  return (
    <div className="relative group">
      <button
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        title={t('language.switchLanguage')}
      >
        <Globe size={16} />
        <span>{currentLanguage === 'zh' ? '中文' : 'FR'}</span>
      </button>
      
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="py-1">
          <button
            onClick={() => changeLanguage('fr')}
            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
              currentLanguage === 'fr' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
            }`}
          >
            {t('language.french')}
          </button>
          <button
            onClick={() => changeLanguage('zh')}
            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
              currentLanguage === 'zh' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
            }`}
          >
            {t('language.chinese')}
          </button>
        </div>
      </div>
    </div>
  );
};
