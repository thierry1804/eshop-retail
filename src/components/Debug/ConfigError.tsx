import React from 'react';

interface ConfigErrorProps {
  error: string;
  details?: string;
}

export const ConfigError: React.FC<ConfigErrorProps> = ({ error, details }) => {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 border border-red-200">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-lg">⚠️</span>
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-red-800">Erreur de Configuration</h3>
          </div>
        </div>
        
        <div className="text-sm text-red-700 mb-4">
          <p className="font-medium">{error}</p>
          {details && (
            <p className="mt-2 text-red-600">{details}</p>
          )}
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-red-800 mb-2">Solution :</h4>
          <ol className="text-sm text-red-700 space-y-1">
            <li>1. Créez un fichier <code className="bg-red-100 px-1 rounded">.env</code> à la racine du projet</li>
            <li>2. Ajoutez vos clés Supabase :</li>
          </ol>
          <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
{`VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_clé_anon_supabase`}
          </pre>
          <p className="text-xs text-red-600 mt-2">
            Vous trouverez ces informations dans votre dashboard Supabase → Settings → API
          </p>
        </div>
      </div>
    </div>
  );
};
