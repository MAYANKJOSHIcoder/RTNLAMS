import { createContext, useContext, useState, type ReactNode } from 'react';

interface ProjectContextType {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
}
const ProjectContext = createContext<ProjectContextType | undefined>(undefined);
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  return <ProjectContext.Provider value={{ projectId, setProjectId }}>{children}</ProjectContext.Provider>;
}
export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
export default ProjectContext;
