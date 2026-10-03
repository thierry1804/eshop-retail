import React, { useState } from 'react';
import { devLog } from '../../lib/devLog';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { signIn } from '../../lib/supabase';

interface LoginFormProps {
  onLogin: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    devLog('🔐 LoginForm: Tentative de connexion...');
    const startTime = performance.now();
    
    setLoading(true);
    setError('');

    const { error } = await signIn(email, password);
    
    if (error) {
      console.error('❌ LoginForm: Erreur de connexion:', error);
      setError(t('auth.loginError'));
    } else {
      devLog('✅ LoginForm: Connexion réussie');
      onLogin();
    }
    
    const endTime = performance.now();
    devLog(`⏱️ LoginForm: Connexion terminée en ${(endTime - startTime).toFixed(2)}ms`);
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: 'var(--app-canvas)' }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="app-page-title" style={{ fontSize: '1.5rem', color: 'var(--app-primary)' }}>
            {t('app.title')}
          </h1>
          <p className="app-page-subtitle">{t('auth.login')}</p>
        </div>

        <form className="app-surface p-5 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div
              className="px-3 py-2 rounded-md text-sm"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--app-danger) 10%, var(--app-surface))',
                border: '1px solid color-mix(in srgb, var(--app-danger) 30%, var(--app-border))',
                color: 'var(--app-danger)'
              }}
            >
              {error}
            </div>
          )}

          <div className="app-field">
            <label htmlFor="email" className="app-label">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: 'var(--app-ink-muted)' }}
              />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="app-input pl-9"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
          </div>

          <div className="app-field mb-0">
            <label htmlFor="password" className="app-label">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: 'var(--app-ink-muted)' }}
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="app-input pl-9 pr-10"
                placeholder={t('auth.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 app-icon-btn"
                title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="app-btn app-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        </form>
      </div>
    </div>
  );
};
