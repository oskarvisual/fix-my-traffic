import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { loadCity, type LoadedCity } from './app/cityLoader';
import { GameSession } from './app/GameSession';
import { createNewGame } from './simulation/game';
import { SaveGameRepository } from './storage/saveGameRepository';
import { IndexedDbStore, isIndexedDbAvailable, MemoryStore } from './storage/keyValueStore';
import { TrafficMap } from './components/TrafficMap';
import { formatCurrency, formatDate, formatKm, formatPercent } from './ui/format';
import { expandStreet } from './simulation/traffic/network';
import { estimateProject, type ProjectEstimate } from './simulation/projects/estimate';
import { congestionLevel } from './simulation/traffic/congestion';
import { dateForDay } from './simulation/time/clock';
import { CONGESTION_LEVELS } from './config/traffic';
import { t } from './i18n';

export default function App() {
  const [screen, setScreen] = useState<'title' | 'city' | 'loading' | 'game'>('title');
  const [loadedCity, setLoadedCity] = useState<LoadedCity | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [saveRepo] = useState<SaveGameRepository>(() => {
    const store = isIndexedDbAvailable()
      ? new IndexedDbStore('fix-my-traffic-saves')
      : new MemoryStore();
    return new SaveGameRepository(store);
  });

  // Interaction State
  const [selectedRoadIndex, setSelectedRoadIndex] = useState<number | null>(null);
  const [isDraftingBikeLane, setIsDraftingBikeLane] = useState(false);
  const [draftIndices, setDraftIndices] = useState<number[]>([]);

  // Initialize storage repository and auto-resume
  useEffect(() => {
    let cancelled = false;
    void saveRepo
      .load()
      .then(async (saved) => {
        if (!saved || cancelled) return;
        setScreen('loading');
        try {
          const city = await loadCity(saved.cityId, saved.datasetVersion);
          if (cancelled) return;
          sessionRef.current?.stop();
          setLoadedCity(city);
          const sess = new GameSession(city.ctx, saved, saveRepo);
          sessionRef.current = sess;
          setSession(sess);
          sess.start();
          setScreen('game');
        } catch (error) {
          if (cancelled) return;
          console.error('Failed to resume game', error);
          setResumeError(error instanceof Error ? error.message : String(error));
          setScreen('title');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load saved game', error);
        setResumeError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [saveRepo]);

  useEffect(
    () => () => {
      sessionRef.current?.stop();
    },
    [],
  );

  // Hook into GameSession state
  const sessionSnapshot = useSyncExternalStore(
    session ? session.subscribe : () => () => {},
    session ? session.getSnapshot : () => null,
  );

  // Recalculate preview estimate when draft changes
  const projectEstimate = useMemo<ProjectEstimate | null>(() => {
    if (!isDraftingBikeLane || !sessionSnapshot || !loadedCity || draftIndices.length === 0) {
      return null;
    }
    return estimateProject(sessionSnapshot.state, loadedCity.ctx, {
      typeId: 'bikeLane',
      indices: draftIndices,
    });
  }, [isDraftingBikeLane, draftIndices, sessionSnapshot, loadedCity]);
  const startNewGame = async (cityId: string) => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setSession(null);
    setSelectedRoadIndex(null);
    setDraftIndices([]);
    setIsDraftingBikeLane(false);
    setResumeError(null);
    setScreen('loading');
    try {
      const city = await loadCity(cityId);
      setLoadedCity(city);

      const newGameState = createNewGame(
        {
          cityId,
          datasetVersion: city.bundle.roads.version.datasetVersion,
          trafficProviderId: city.traffic.providerId,
          seed: Date.now(),
        },
        city.ctx,
      );

      const sess = new GameSession(city.ctx, newGameState, saveRepo);
      sessionRef.current = sess;
      setSession(sess);
      sess.start();
      void sess.save();
      setScreen('game');
    } catch (err) {
      console.error(err);
      alert('Failed to load city data: ' + err);
      setScreen('city');
    }
  };

  const handleSelectSegment = (index: number) => {
    if (isDraftingBikeLane) {
      setDraftIndices((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
      );
    } else {
      setSelectedRoadIndex(index);
    }
  };

  const handleApproveDraft = () => {
    if (!session || !isDraftingBikeLane || draftIndices.length === 0) return;
    const res = session.approve({
      typeId: 'bikeLane',
      indices: draftIndices,
    });
    if (res.ok) {
      setIsDraftingBikeLane(false);
      setDraftIndices([]);
    } else {
      alert(`Cannot approve project: ${t(`draft.error.${res.reason}` as string)}`);
    }
  };

  if (screen === 'title') {
    return (
      <main className="start-screen">
        <p className="eyebrow">Lima · Transport simulation</p>
        <h1>
          FIX MY
          <br />
          <i>TRAFFIC</i>
        </h1>
        <p className="tagline">{t('app.tagline')}</p>
        <p style={{ color: '#889988', marginTop: '-20px', marginBottom: '30px' }}>
          {t('app.subtitle')}
        </p>
        <button className="primary" onClick={() => setScreen('city')}>
          {t('app.newGame')} <span>→</span>
        </button>
        {resumeError && <p className="load-error">{t('city.loadError', { error: resumeError })}</p>}
        <p className="disclaimer">{t('app.simulatedDisclaimer')}</p>
      </main>
    );
  }

  if (screen === 'city') {
    return (
      <main className="city-screen">
        <button className="back" onClick={() => setScreen('title')}>
          ← {t('city.back')}
        </button>
        <p className="eyebrow">{t('city.selectTitle')}</p>
        <h1>Lima, Peru</h1>
        <section className="city-card">
          <div className="map-mark">
            PE
            <br />
            <small>12° S · 77° W</small>
          </div>
          <div>
            <p className="eyebrow">First playable city</p>
            <h2>Inherit a city in motion</h2>
            <p>{t('city.lima.transit')}</p>
            <dl>
              <div>
                <dt>{t('city.difficulty')}</dt>
                <dd>{t('difficulty.hard')}</dd>
              </div>
              <div>
                <dt>{t('city.annualBudget')}</dt>
                <dd>$600M</dd>
              </div>
              <div>
                <dt>{t('city.roadNetwork')}</dt>
                <dd>Primary Arterial Graph</dd>
              </div>
            </dl>
          </div>
        </section>
        <button className="primary" onClick={() => startNewGame('lima')}>
          {t('city.becomeMinister')} <span>→</span>
        </button>
      </main>
    );
  }

  if (screen === 'loading' || !sessionSnapshot || !loadedCity) {
    return (
      <main className="start-screen">
        <h2>{t('city.loading', { city: 'Lima' })}</h2>
      </main>
    );
  }

  const { state, traffic, speed } = sessionSnapshot;
  const selectedRoad = selectedRoadIndex !== null ? loadedCity.ctx.network.segments[selectedRoadIndex] : null;

  return (
    <main className="game-shell">
      {/* Top HUD */}
      <header className="hud">
        <a className="brand" href="#" onClick={(e) => {
          e.preventDefault();
          sessionRef.current?.stop();
          sessionRef.current = null;
          setSession(null);
          setScreen('title');
        }}>
          FIX MY <i>TRAFFIC</i>
        </a>
        <div className="city-name">
          Lima, Peru <small>{t('hud.simulatedBadge')}</small>
        </div>

        <div className="metric">
          <small>{t('hud.date')}</small>
          {formatDate(dateForDay(state.clock.day))}
        </div>

        <div className="metric">
          <small>{t('hud.budget')}</small>
          {formatCurrency(state.finance.publicBudget)}
        </div>

        <div className="metric">
          <small>{t('hud.personal')}</small>
          {formatCurrency(state.finance.personalBalance)}
        </div>

        <div className="metric approval">
          <small>{t('hud.approval')}</small>
          <b>{formatPercent(state.politics.approval)}</b>
        </div>

        {/* Speed Controls */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[0, 1, 2, 4, 8].map((s) => (
            <button
              key={s}
              className="advance"
              style={{
                background: speed === s ? '#b8e86c' : 'transparent',
                color: speed === s ? '#101713' : '#dff7a8',
                fontWeight: speed === s ? 'bold' : 'normal',
                padding: '6px 10px',
              }}
              onClick={() => session?.setSpeed(s)}
            >
              {s === 0 ? '⏸' : `${s}×`}
            </button>
          ))}
          <button
            className="advance"
            style={{ padding: '6px 10px' }}
            title="Advance 30 days"
            onClick={() => session?.advanceDays(30)}
          >
            +30d
          </button>
        </div>
      </header>

      {/* Main Map */}
      <TrafficMap
        network={loadedCity.ctx.network}
        traffic={traffic}
        center={loadedCity.bundle.roads.city.center}
        selectedSegmentIndex={selectedRoadIndex}
        corridorIndices={draftIndices}
        onSelectSegment={handleSelectSegment}
      />

      {/* Left Sidebar: Projects */}
      <aside className="left-panel">
        <p className="eyebrow">{t('tools.title')}</p>
        <h2>{t('tools.title')}</h2>

        <button
          className={`project-type ${isDraftingBikeLane ? 'active' : ''}`}
          onClick={() => {
            setIsDraftingBikeLane(!isDraftingBikeLane);
            if (!isDraftingBikeLane && selectedRoadIndex !== null) {
              setDraftIndices([selectedRoadIndex]);
            }
          }}
        >
          🚲{' '}
          <span>
            {t('tools.bikeLane')}
            <small>{t('tools.bikeLaneDesc')}</small>
          </span>
        </button>

        <button className="project-type" disabled>
          🚌{' '}
          <span>
            {t('tools.brt')}
            <small>{t('tools.comingSoon')}</small>
          </span>
        </button>

        <button className="project-type" disabled>
          🚇{' '}
          <span>
            {t('tools.metro')}
            <small>{t('tools.comingSoon')}</small>
          </span>
        </button>

        <div className="legend">
          <p className="eyebrow">{t('map.legend')}</p>
          {CONGESTION_LEVELS.map((lvl) => (
            <span key={lvl.id}>
              <i style={{ background: lvl.color }} />
              {t(`congestion.${lvl.id}` as string)}
            </span>
          ))}
        </div>

        {/* Active Projects List */}
        <div style={{ marginTop: '20px' }}>
          <p className="eyebrow">{t('tools.activeProjects')}</p>
          {state.projects.length === 0 ? (
            <p className="muted">{t('tools.noProjects')}</p>
          ) : (
            state.projects.map((p) => (
              <div
                key={p.id}
                style={{
                  background: '#0e1711',
                  padding: '8px',
                  marginBottom: '8px',
                  borderRadius: '3px',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: '#99aa9d' }}>
                  {t(`project.phase.${p.phase}` as string)} · {formatPercent(p.progress)}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Right Sidebar: Contextual Info & Inspector / Draft Proposal */}
      <aside className="right-panel">
        {isDraftingBikeLane ? (
          <div>
            <p className="eyebrow">{t('draft.title')}</p>
            <h2>{t('draft.title')}</h2>
            <p className="muted">{t('draft.hint')}</p>

            {selectedRoadIndex !== null && (
              <button
                className="advance"
                style={{ marginBottom: '12px', width: '100%' }}
                onClick={() => {
                  const expanded = expandStreet(loadedCity.ctx.network, selectedRoadIndex, 8000);
                  setDraftIndices(expanded);
                }}
              >
                {t('draft.selectStreet')}
              </button>
            )}

            {projectEstimate ? (
              <div className="proposal">
                <span>
                  {t('draft.length')} <b>{formatKm(projectEstimate.streetKm)}</b>
                </span>
                <span>
                  {t('draft.cost')} <b>{formatCurrency(projectEstimate.cost)}</b>
                </span>
                <span>
                  {t('draft.duration')}{' '}
                  <b>
                    {projectEstimate.planningDays + projectEstimate.constructionDays} days
                  </b>
                </span>
                <span>
                  {t('draft.disruption')}{' '}
                  <b style={{ color: '#ef4444' }}>
                    +{formatPercent(
                      Math.max(
                        0,
                        projectEstimate.corridor.duringConstruction -
                          projectEstimate.corridor.now,
                      ),
                    )}
                  </b>
                </span>
                <span>
                  {t('draft.predicted')}{' '}
                  <b className="positive">
                    {formatPercent(
                      projectEstimate.corridor.now - projectEstimate.corridor.afterCompletion,
                    )}{' '}
                    relief
                  </b>
                </span>

                <hr style={{ borderColor: '#2d3c30', margin: '8px 0' }} />

                <button
                  className="primary full"
                  disabled={projectEstimate.error !== null}
                  onClick={handleApproveDraft}
                >
                  {t('draft.approve')}
                </button>
                {projectEstimate.error && (
                  <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>
                    {t(`draft.error.${projectEstimate.error}` as string)}
                  </p>
                )}
              </div>
            ) : (
              <p className="muted">{t('draft.error.empty')}</p>
            )}

            <button
              className="advance"
              style={{ marginTop: '8px', width: '100%' }}
              onClick={() => {
                setIsDraftingBikeLane(false);
                setDraftIndices([]);
              }}
            >
              {t('draft.cancel')}
            </button>
          </div>
        ) : selectedRoad ? (
          <div>
            <p className="eyebrow">{t('road.inspect')}</p>
            <h2>{selectedRoad.name || t('road.unnamed')}</h2>

            <div className="congestion">
              <i
                style={{
                  background:
                    CONGESTION_LEVELS.find(
                      (l) => l.id === congestionLevel(traffic.congestion[selectedRoad.index]),
                    )?.color ?? '#22c55e',
                }}
              />
              <div>
                <strong>
                  {t(`congestion.${congestionLevel(traffic.congestion[selectedRoad.index])}` as string)}
                </strong>
                <small>
                  {t('road.score', {
                    value: traffic.congestion[selectedRoad.index].toFixed(2),
                  })}
                </small>
              </div>
            </div>

            <dl>
              <div>
                <dt>{t('road.demand')}</dt>
                <dd>{Math.round(traffic.currentDemand[selectedRoad.index])} veh/h</dd>
              </div>
              <div>
                <dt>{t('road.capacity')}</dt>
                <dd>{Math.round(traffic.capacity[selectedRoad.index])} veh/h</dd>
              </div>
              <div>
                <dt>{t('road.lanes')}</dt>
                <dd>{selectedRoad.lanes}</dd>
              </div>
            </dl>

            <button
              className="primary full"
              style={{ marginTop: '20px' }}
              onClick={() => {
                setIsDraftingBikeLane(true);
                setDraftIndices([selectedRoad.index]);
              }}
            >
              {t('road.proposeBikeLane')} <span>→</span>
            </button>
          </div>
        ) : (
          <div>
            <p className="eyebrow">{t('road.inspect')}</p>
            <h2>Choose a corridor</h2>
            <p className="muted">{t('road.empty')}</p>
          </div>
        )}
      </aside>

      {/* Bottom Briefing / News Feed */}
      <section className="event-feed">
        <p className="eyebrow">{t('news.title')}</p>
        {state.news.slice(0, 3).map((item) => (
          <p className={`event ${item.severity}`} key={item.id}>
            <span>●</span>
            {t(item.key as string, item.params)}
          </p>
        ))}
      </section>
    </main>
  );
}
