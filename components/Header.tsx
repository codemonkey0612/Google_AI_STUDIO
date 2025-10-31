import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HomeIcon } from './Icons'; 

const Header: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("ログアウトに失敗しました:", error);
      // Optionally show an error message to the user
    }
  };

  return (
    <header className="bg-sky-700 text-white p-4 shadow-lg sticky top-0 z-40">
      <div className="container mx-auto flex justify-between items-center">
        <div 
          onClick={() => navigate('/dashboard')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard');}}
          aria-label="トップページへ"
          className="flex items-center space-x-3 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <HomeIcon className="w-7 h-7" aria-hidden={false}/>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">プロジェクトマネージャーPro</h1>
        </div>
        {currentUser && (
          <button
            onClick={handleLogout}
            aria-label="ログアウト"
            className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 px-4 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-sky-700 text-sm"
          >
            ログアウト
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;