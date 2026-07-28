import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-[#2D5240] flex flex-col fixed inset-y-0 left-0">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white">
            Group<span className="text-[#8FBF9F]">Hub</span>
          </h1>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <p className="px-3 mb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Menu
          </p>
          <button
            onClick={() => navigate("/groups")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 rounded-lg transition-colors ${
              isActive("/groups") ? "bg-white/10 text-white" : "hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            Groups
          </button>
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 mb-2 text-sm text-white/60 truncate">
            {user?.firstName} {user?.lastName}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/60 rounded-lg hover:bg-white/5 hover:text-white/80 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-60 bg-[#F2F0EA] min-h-screen p-8">
        <Outlet />
      </main>
    </div>
  );
}
