import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ collapsed = false }) => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = i18n.language;
  const label = currentLanguage === 'zh' ? '中文' : 'FR';

  return (
    <div className="relative group flex-shrink-0">
      <button
        type="button"
        className={`app-sidebar-nav-item flex items-center rounded-md transition-colors ${
          collapsed ? 'justify-center w-8 h-8' : 'gap-1 px-2 py-1.5'
        } text-xs font-medium`}
        title={t('language.switchLanguage')}
      >
        <Globe size={14} />
        {!collapsed && <span>{label}</span>}
      </button>

      <div
        className={`absolute bottom-full mb-1 ${
          collapsed ? 'left-0' : 'right-0'
        } w-36 rounded-md border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 z-50`}
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
          boxShadow: 'var(--app-shadow-panel)'
        }}
      >
        <div className="py-1">
          <button
            type="button"
            onClick={() => changeLanguage('fr')}
            className="block w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--app-surface-muted)]"
            style={{
              color: currentLanguage === 'fr' ? 'var(--app-primary-deep)' : 'var(--app-ink)',
              fontWeight: currentLanguage === 'fr' ? 600 : 400
            }}
          >
            {t('language.french')}
          </button>
          <button
            type="button"
            onClick={() => changeLanguage('zh')}
            className="block w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--app-surface-muted)]"
            style={{
              color: currentLanguage === 'zh' ? 'var(--app-primary-deep)' : 'var(--app-ink)',
              fontWeight: currentLanguage === 'zh' ? 600 : 400
            }}
          >
            {t('language.chinese')}
          </button>
        </div>
      </div>
    </div>
  );
};
