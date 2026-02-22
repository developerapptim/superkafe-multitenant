import React from 'react';
import { useNavigate } from 'react-router-dom';

const InvalidSlug = () => {
  const navigate = useNavigate();

  const handleGoToLogin = () => {
    navigate('/auth/login');
  };

  const handleGoToSetup = () => {
    navigate('/setup-cafe');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '20px'
        }}>
          ⚠️
        </div>
        
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#333',
          marginBottom: '12px'
        }}>
          Invalid Cafe URL
        </h1>
        
        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '30px',
          lineHeight: '1.5'
        }}>
          The cafe URL you're trying to access is not valid. Please check the URL format and try again.
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleGoToLogin}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#4338CA'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#4F46E5'}
          >
            Go to Login
          </button>
          
          <button
            onClick={handleGoToSetup}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#4F46E5',
              border: '2px solid #4F46E5',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#F5F3FF';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'white';
            }}
          >
            Create New Cafe
          </button>
        </div>

        <p style={{
          fontSize: '14px',
          color: '#999',
          marginTop: '30px'
        }}>
          Need help? Contact support
        </p>
      </div>
    </div>
  );
};

export default InvalidSlug;
