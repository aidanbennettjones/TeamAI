import './locale/i18n';

import { useState } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';

import About from './About';
import Spinner from './components/Spinner';
import Conversation from './conversation/Conversation';
import { SharedConversation } from './conversation/SharedConversation';
import { useDarkTheme, useMediaQuery } from './hooks';
import useTokenAuth from './hooks/useTokenAuth';
import Navigation from './Navigation';
import PageNotFound from './PageNotFound';
import Setting from './settings';

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthLoading } = useTokenAuth();

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <>{children}</>;
}

function MainLayout() {
  const { isMobile } = useMediaQuery();
  const [navOpen, setNavOpen] = useState(!isMobile);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full dark:bg-raisin-black">
      <Navigation navOpen={navOpen} setNavOpen={setNavOpen} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const [, , componentMounted] = useDarkTheme();
  if (!componentMounted) {
    return <div />;
  }
  return (
    <div className="h-full relative overflow-auto">
      <Routes>
        <Route
          element={
            <AuthWrapper>
              <MainLayout />
            </AuthWrapper>
          }
        >
          <Route index element={<Conversation />} />
          <Route path="/about" element={<About />} />
          <Route path="/settings" element={<Setting />} />
        </Route>
        <Route path="/share/:identifier" element={<SharedConversation />} />
        <Route path="/*" element={<PageNotFound />} />
      </Routes>
    </div>
  );
}
