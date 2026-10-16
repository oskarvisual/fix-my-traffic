import type { NewsItem, Project } from '../state';

export interface ProjectDayResult {
  project: Project;
  events: Omit<NewsItem, 'id'>[];
}

/**
 * Advances a project by one simulated day. Phases:
 * planning -> (procurement: instant for now, Phase 6) -> construction -> completed.
 */
export function advanceProjectDay(project: Project, day: number): ProjectDayResult {
  const events: Omit<NewsItem, 'id'>[] = [];
  let p = project;
  const base = { day, projectId: p.id, params: { name: p.name } };

  if (p.phase === 'planning' && day - p.phaseStartDay >= p.planningDays) {
    p = { ...p, phase: 'construction', phaseStartDay: day, progress: 0 };
    events.push({ ...base, severity: 'warning', key: 'news.constructionStarted' });
  } else if (p.phase === 'construction') {
    const progress = Math.min(1, (day - p.phaseStartDay) / Math.max(1, p.constructionDays));
    if (progress >= 1) {
      p = { ...p, phase: 'completed', progress: 1, completedDay: day, phaseStartDay: day };
      const key = p.typeId === 'subway' ? 'news.subwayCompleted' : 'news.projectCompleted';
      events.push({ ...base, severity: 'success', key });

    } else {
      p = { ...p, progress };
      const halfway = 0.5;
      if (project.progress < halfway && progress >= halfway) {
        events.push({ ...base, severity: 'info', key: 'news.projectHalfway' });
      }
    }
  }
  return { project: p, events };
}
