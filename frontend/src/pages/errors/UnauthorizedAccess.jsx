import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthSession } from '../../utils/authHelper';
import { jwtDecode } from 'jwt-decode';

const UnauthorizedAccess = () => {
  const navigate = useNavigate();
  const [userDashboardUrl, setUserDashboardUrl] = useState(null);

  useEffect(() => {
    // Check if user is actually logged in to determine the right actions
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const actualTenant = decoded.tenantSlug || decoded.tenant;
        if (actualTenant) {
          setUserDashboardUrl(`/${actualTenant}/admin/dashboard`);
        }
      } catch (err) {
        console.error('Invalid token in UnauthorizedAccess', err);
      }
    }
  }, []);

  const handleGoToLogin = () => {
    // Clear session so they don't get auto-redirected back into the loop
    clearAuthSession();
    navigate('/auth/login');
  };

  const handleGoToMyDashboard = () => {
    if (userDashboardUrl) {
      navigate(userDashboardUrl);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
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
          🚫
        </div>

        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#333',
          marginBottom: '12px'
        }}>
          Unauthorized Access
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '30px',
          lineHeight: '1.5'
        }}>
          You don't have permission to access this cafe's dashboard. Please log in with the correct account or contact your administrator.
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {userDashboardUrl && (
            <button
              onClick={handleGoToMyDashboard}
              style={{
                padding: '12px 24px',
                backgroundColor: '#10B981', // Emerald green 
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#10B981'}
            >
              Go to My Dashboard
            </button>
          )}

          <button
            onClick={handleGoToLogin}
            style={{
              padding: '12px 24px',
              backgroundColor: userDashboardUrl ? '#EF4444' : '#4F46E5', // Red if logged in (logout), Indigo if not
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = userDashboardUrl ? '#DC2626' : '#4338CA'}
            onMouseOut={(e) => e.target.style.backgroundColor = userDashboardUrl ? '#EF4444' : '#4F46E5'}
          >
            {userDashboardUrl ? 'Logout & Switch Account' : 'Go to Login'}
          </button>

          <button
            onClick={handleGoBack}
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
            Go Back
          </button>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '16px',
          backgroundColor: '#FEF3C7',
          borderRadius: '8px',
          border: '1px solid #FCD34D'
        }}>
          <p style={{
            fontSize: '14px',
            color: '#92400E',
            margin: 0,
            lineHeight: '1.5'
          }}>
            <strong>Security Notice:</strong> This access attempt has been logged for security purposes.
          </p>
        </div>

        <p style={{
          fontSize: '14px',
          color: '#999',
          marginTop: '20px'
        }}>
          Need help? Contact support
        </p>
      </div>
    </div>
  );
};

export default UnauthorizedAccess;
