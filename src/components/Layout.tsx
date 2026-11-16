import { Outlet } from 'react-router-dom';
import { AppNavRail } from './navigation/AppNavRail';

const Layout = () => {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-row">
      <AppNavRail />
      <main className="flex-1 overflow-hidden flex flex-col min-h-0 min-w-0">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
