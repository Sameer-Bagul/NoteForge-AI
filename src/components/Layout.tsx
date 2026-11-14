import { Outlet } from 'react-router-dom';
import Header from './Header';

const Layout = () => {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto px-6 py-6 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
