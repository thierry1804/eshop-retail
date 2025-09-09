import React, { useState, useEffect } from 'react';

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

export const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Intercepter les logs de performance
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog.apply(console, args);
      
      // Détecter les logs de performance
      const logMessage = args[0] as string;
      if (logMessage.includes('⏱️') && typeof args[1] === 'string') {
        const duration = parseFloat(args[1].match(/(\d+\.?\d*)ms/)?.[1] || '0');
        const name = logMessage.split(':')[0].replace('⏱️', '').trim();
        
        setMetrics(prev => [...prev, {
          name,
          duration,
          timestamp: Date.now()
        }].slice(-10)); // Garder seulement les 10 dernières métriques
      }
    };

    return () => {
      console.log = originalLog;
    };
  }, []);

  const averageDuration = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length 
    : 0;

  const slowestMetric = metrics.length > 0 
    ? metrics.reduce((max, m) => m.duration > max.duration ? m : max)
    : null;

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Afficher le moniteur de performance"
      >
        ⚡
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-y-auto z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">📊 Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Moyenne:</span>
          <span className="font-mono">{averageDuration.toFixed(1)}ms</span>
        </div>
        
        {slowestMetric && (
          <div className="flex justify-between">
            <span>Plus lent:</span>
            <span className="font-mono text-red-600">{slowestMetric.duration.toFixed(1)}ms</span>
          </div>
        )}
        
        <div className="border-t pt-2 mt-2">
          <div className="text-xs text-gray-500 mb-1">Dernières opérations:</div>
          {metrics.slice().reverse().map((metric, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="truncate">{metric.name}</span>
              <span className={`font-mono ${metric.duration > 1000 ? 'text-red-600' : metric.duration > 500 ? 'text-yellow-600' : 'text-green-600'}`}>
                {metric.duration.toFixed(0)}ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
