import React from 'react';
import { PurchaseOrder } from '../../types';

interface DeliveryProgressBarProps {
  order: PurchaseOrder;
  compact?: boolean;
}

export const DeliveryProgressBar: React.FC<DeliveryProgressBarProps> = ({ order, compact = false }) => {
  if (!order.expected_delivery_date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const orderDate = new Date(order.order_date);
  orderDate.setHours(0, 0, 0, 0);
  
  const expectedDate = new Date(order.expected_delivery_date);
  expectedDate.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((expectedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Calculer le pourcentage de progression
  let percentage = 0;
  let status: 'normal' | 'warning' | 'overdue' = 'normal';
  let color = 'bg-blue-500';
  let bgColor = 'bg-blue-100';

  if (totalDays > 0) {
    percentage = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
    
    if (daysRemaining < 0) {
      // Date dépassée
      status = 'overdue';
      color = 'bg-red-500';
      bgColor = 'bg-red-100';
      percentage = 100;
    } else if (daysRemaining <= 3) {
      // Proche de la date (3 jours ou moins)
      status = 'warning';
      color = 'bg-orange-500';
      bgColor = 'bg-orange-100';
    }
  } else {
    // Date de livraison avant ou égale à la date de commande
    if (daysRemaining < 0) {
      status = 'overdue';
      color = 'bg-red-500';
      bgColor = 'bg-red-100';
    }
    percentage = 100;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          status === 'overdue' ? 'text-red-600' :
          status === 'warning' ? 'text-orange-600' :
          'text-gray-600'
        }`}>
          {daysRemaining < 0 
            ? `${Math.abs(daysRemaining)}j en retard`
            : daysRemaining === 0
            ? 'Aujourd\'hui'
            : `${daysRemaining}j`
          }
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {status === 'overdue' 
            ? 'Date de livraison dépassée'
            : status === 'warning'
            ? 'Livraison imminente'
            : 'Progression de la livraison'
          }
        </span>
        <span className={`text-sm font-semibold ${
          status === 'overdue' ? 'text-red-600' :
          status === 'warning' ? 'text-orange-600' :
          'text-blue-600'
        }`}>
          {daysRemaining < 0 
            ? `${Math.abs(daysRemaining)} jour${Math.abs(daysRemaining) > 1 ? 's' : ''} en retard`
            : daysRemaining === 0
            ? 'Livraison prévue aujourd\'hui'
            : `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}`
          }
        </span>
      </div>
      <div className={`h-3 ${bgColor} rounded-full overflow-hidden`}>
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Commande: {new Date(order.order_date).toLocaleDateString()}</span>
        <span>Livraison prévue: {new Date(order.expected_delivery_date).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

