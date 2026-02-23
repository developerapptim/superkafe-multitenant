import { useNavigate } from 'react-router-dom';
import { checkActiveSession, getDashboardUrl } from '../../utils/authHelper';

const LandingNavbar = () => {
  const navigate = useNavigate();

  const handleLoginClick = (e) => {
    e.preventDefault();
    
    const session = checkActiveSession();
    
    if (session) {
      const dashboardUrl = getDashboardUrl();
      if (dashboardUrl) {
        console.log('[NAVBAR] Active session found, redirecting to dashboard');
        navigate(dashboardUrl);
        return;
      }
    }
    
    // No active session, go to login page
    navigate('/auth/login');
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <img 
              src="https://res.cloudinary.com/dhjqb65mf/image/upload/v1771859487/SuperKafe_i51g7i.png" 
              alt="SuperKafe Logo" 
              className="h-10 w-auto"
            />
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
              by LockApp.id
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleLoginClick}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/auth/register')}
              className="px-6 py-2 text-sm font-medium bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-lg hover:shadow-lg hover:shadow-amber-700/50 transition-all"
            >
              Daftar
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default LandingNavbar;
