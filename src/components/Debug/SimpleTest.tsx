import React from 'react';

export const SimpleTest: React.FC = () => {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f3f4f6',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#1f2937', marginBottom: '1rem' }}>🧪 Test Simple</h1>
        <p style={{ color: '#6b7280' }}>Si vous voyez ceci, React fonctionne !</p>
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.5rem', 
          backgroundColor: '#dbeafe', 
          borderRadius: '0.25rem',
          fontSize: '0.875rem'
        }}>
          ✅ Application chargée avec succès
        </div>
      </div>
    </div>
  );
};
