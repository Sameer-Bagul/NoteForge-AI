import React, { createContext, useContext, useState } from 'react';

export type TabType = 'index' | 'mindmap' | 'quiz' | 'interview';

export interface StudioNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  topicsCount: number;
  quizCount?: number;
  interviewCount?: number;
  hasVideo: boolean;
  isStudioMode: boolean;
  onToggleStudioMode: () => void;
  isExportingPdf: boolean;
  onExportPdf: () => void;
  onDownloadMarkdown: () => void;
  onExportCmsJson: () => void;
  isDeleting: boolean;
  onDeleteNotebook: () => void;
  isArchived?: boolean;
}

interface NavRailContextType {
  studioProps: StudioNavProps | null;
  setStudioProps: React.Dispatch<React.SetStateAction<StudioNavProps | null>>;
}

const NavRailContext = createContext<NavRailContextType>({
  studioProps: null,
  setStudioProps: () => {},
});

export const NavRailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [studioProps, setStudioProps] = useState<StudioNavProps | null>(null);

  return (
    <NavRailContext.Provider value={{ studioProps, setStudioProps }}>
      {children}
    </NavRailContext.Provider>
  );
};

export const useNavRail = () => useContext(NavRailContext);

