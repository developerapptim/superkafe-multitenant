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
            <style>
              {`@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap');`}
            </style>
            <img
              src="https://res.cloudinary.com/dhjqb65mf/image/upload/v1771859487/SuperKafe_i51g7i.png"
              alt="SuperKafe Logo"
              className="h-10 w-auto"
            />
            <span
              className="text-2xl font-semibold tracking-tight text-[#4A2311] ml-1 mt-1"
              style={{ fontFamily: "'Fredoka', 'Nunito', 'Quicksand', sans-serif" }}
            >
              SuperKafe
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
