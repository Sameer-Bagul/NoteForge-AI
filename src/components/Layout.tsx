import { Outlet } from 'react-router-dom';
import Header from './Header';

const Layout = () => {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
