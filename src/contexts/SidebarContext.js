import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';

const SidebarContext = createContext(null);

export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openSidebar = useCallback(() => setIsOpen(true), []);
  const closeSidebar = useCallback(() => setIsOpen(false), []);
  const toggleSidebar = useCallback(() => setIsOpen(prev => !prev), []);

  const value = useMemo(
    () => ({ isOpen, openSidebar, closeSidebar, toggleSidebar }),
    [isOpen, openSidebar, closeSidebar, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used inside <SidebarProvider>');
  }
  return ctx;
};
