import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { loadCity, type LoadedCity } from './app/cityLoader';
import { GameSession } from './app/GameSession';
import { createNewGame } from './simulation/game';
import { SaveGameRepository } from './storage/saveGameRepository';
import { IndexedDbStore, isIndexedDbAvailable, MemoryStore } from './storage/keyValueStore';
import { TrafficMap } from './components/TrafficMap';
import { formatCurrency, formatDate, formatKm, formatPercent } from './ui/format';
import { getAllAvenueSegments } from './simulation/traffic/network';
import { estimateProject, type ProjectEstimate } from './simulation/projects/estimate';
import { congestionLevel } from './simulation/traffic/congestion';
import { dateForDay } from './simulation/time/clock';
import { CONGESTION_LEVELS } from './config/traffic';
import { PROJECT_CONFIG, type ProjectTypeId } from './config/projects';
import { generateContractorBids, type ContractorBid } from './simulation/projects/contractors';
import {
  calculateSubwayLengthKm,
  estimateSubwayCost,
  findSubwayCatchmentSegments,
  type SubwayStationPoint,
} from './simulation/projects/subwayHelper';
import { t } from './i18n';
import { CITY_CATALOG, findCity } from './data/cityCatalog';

export default function App() {
  const [screen, setScreen] = useState<'title' | 'city' | 'loading' | 'game'>('title');
  const [loadingCityId, setLoadingCityId] = useState<string>('lima');
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
  const [mapLayerMode, setMapLayerMode] = useState<'surface' | 'subterranean'>('surface');
  const [selectedRoadIndices, setSelectedRoadIndices] = useState<number[]>([]);
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectTypeId>('bikeLane');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftIndices, setDraftIndices] = useState<number[]>([]);
  const [selectedBidIndex, setSelectedBidIndex] = useState<number>(0);

  // Freeform Subway Drafting State
  const [isDraftingSubway, setIsDraftingSubway] = useState(false);
  const [subwayDraftStations, setSubwayDraftStations] = useState<SubwayStationPoint[]>([]);

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

  // Primary selected road index for inspection
  const primarySelectedRoadIndex = selectedRoadIndices[0] ?? null;

  // Detect if selected road has an active project on it
  const activeProjectOnSegment = useMemo(() => {
    if (selectedRoadIndices.length === 0 || !loadedCity || !sessionSnapshot) return null;
    const segIds = new Set(
      selectedRoadIndices.map((i) => loadedCity.ctx.network.segments[i]?.id).filter(Boolean),
    );
    return sessionSnapshot.state.projects.find((p) => p.segmentIds.some((id) => segIds.has(id))) ?? null;
  }, [selectedRoadIndices, loadedCity, sessionSnapshot]);

  // Recalculate preview estimate when draft changes
  const projectEstimate = useMemo<ProjectEstimate | null>(() => {
    if (!isDrafting || !sessionSnapshot || !loadedCity || draftIndices.length === 0) {
      return null;
    }
    return estimateProject(sessionSnapshot.state, loadedCity.ctx, {
      typeId: selectedProjectType,
      indices: draftIndices,
    });
  }, [isDrafting, selectedProjectType, draftIndices, sessionSnapshot, loadedCity]);

  // Generate 3 contractor bids when estimate exists
  const contractorBids = useMemo<ContractorBid[]>(() => {
    if (!projectEstimate || !sessionSnapshot) return [];
    return generateContractorBids(
      selectedProjectType,
      projectEstimate.cost,
      projectEstimate.constructionDays,
      sessionSnapshot.state.clock.day,
    );
  }, [projectEstimate, selectedProjectType, sessionSnapshot]);

  const selectedBid = contractorBids[selectedBidIndex] ?? contractorBids[0];

  // Freeform Subway length and cost
  const subwayLengthKm = useMemo(() => {
    return calculateSubwayLengthKm(subwayDraftStations);
  }, [subwayDraftStations]);

  const subwayBaseCost = useMemo(() => {
    return estimateSubwayCost(subwayLengthKm, subwayDraftStations.length);
  }, [subwayLengthKm, subwayDraftStations.length]);

  const subwayContractorBids = useMemo<ContractorBid[]>(() => {
    if (!sessionSnapshot || subwayDraftStations.length < 2) return [];
    return generateContractorBids(
      'subway',
      subwayBaseCost,
      Math.max(300, Math.round(subwayLengthKm * 90)),
      sessionSnapshot.state.clock.day,
    );
  }, [sessionSnapshot, subwayDraftStations.length, subwayBaseCost, subwayLengthKm]);

  const selectedSubwayBid = subwayContractorBids[selectedBidIndex] ?? subwayContractorBids[0];

  const allAvenueIndices = useMemo(() => {
    if (primarySelectedRoadIndex === null || !loadedCity) return [];
    return getAllAvenueSegments(loadedCity.ctx.network, primarySelectedRoadIndex);
  }, [primarySelectedRoadIndex, loadedCity]);

  const isFullAvenueSelected = useMemo(() => {
    if (selectedRoadIndices.length <= 1 || allAvenueIndices.length <= 1) return false;
    return allAvenueIndices.every((i) => selectedRoadIndices.includes(i));
  }, [selectedRoadIndices, allAvenueIndices]);

  const selectedTotalKm = useMemo(() => {
    if (!loadedCity || selectedRoadIndices.length === 0) return 0;
    return (
      selectedRoadIndices.reduce((sum, i) => sum + (loadedCity.ctx.network.segments[i]?.lengthM ?? 0), 0) /
      1000
    );
  }, [selectedRoadIndices, loadedCity]);

  const avgCongestion = useMemo(() => {
    if (selectedRoadIndices.length === 0 || !sessionSnapshot) return 0;
    const sum = selectedRoadIndices.reduce((acc, i) => acc + (sessionSnapshot.traffic.congestion[i] ?? 0), 0);
    return sum / selectedRoadIndices.length;
  }, [selectedRoadIndices, sessionSnapshot]);

  const startNewGame = async (cityId: string) => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setSession(null);
    setSelectedRoadIndices([]);
    setDraftIndices([]);
    setIsDrafting(false);
    setIsDraftingSubway(false);
    setSubwayDraftStations([]);
    setMapLayerMode('surface');
    setResumeError(null);
    setLoadingCityId(cityId);
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

  const handleSelectSegment = (index: number | null) => {
    if (isDraftingSubway) return;
    if (isDrafting) {
      if (index === null) return;
      setDraftIndices((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
      );
    } else {
      setSelectedRoadIndices(index !== null ? [index] : []);
    }
  };

  // Double-click on a segment selects the whole avenue!
  const handleDoubleClickSegment = (index: number) => {
    if (isDraftingSubway) return;
    if (!loadedCity) return;
    const avenueIndices = getAllAvenueSegments(loadedCity.ctx.network, index);
    if (isDrafting) {
      // In drafting mode: toggle or add entire avenue
      setDraftIndices((prev) => {
        const hasAll = avenueIndices.length > 0 && avenueIndices.every((i) => prev.includes(i));
        if (hasAll) {
          const set = new Set(avenueIndices);
          return prev.filter((i) => !set.has(i));
        } else {
          return Array.from(new Set([...prev, ...avenueIndices]));
        }
      });
    } else {
      // In normal mode: if already showing the full avenue, toggle back to single segment
      setSelectedRoadIndices((prev) => {
        const isAlreadyFullAvenue =
          prev.length > 1 && avenueIndices.length > 1 && avenueIndices.every((i) => prev.includes(i));
        return isAlreadyFullAvenue ? [index] : avenueIndices;
      });
    }
  };

  const startDraftingType = (typeId: ProjectTypeId) => {
    if (typeId === 'subway') {
      startDraftingSubway();
      return;
    }
    setIsDraftingSubway(false);
    setSelectedProjectType(typeId);
    setIsDrafting(true);
    setSelectedBidIndex(0);
    // Pause simulation while drafting/planning
    session?.setSpeed(0);
    if (selectedRoadIndices.length > 0 && draftIndices.length === 0) {
      setDraftIndices(selectedRoadIndices);
    }
  };

  const handleApproveDraft = () => {
    if (!session || !isDrafting || draftIndices.length === 0 || !selectedBid) return;
    const res = session.approve({
      typeId: selectedProjectType,
      indices: draftIndices,
      contractorBid: selectedBid,
    });
    if (res.ok) {
      setIsDrafting(false);
      const targetIndices = [...draftIndices];
      setDraftIndices([]);
      setSelectedRoadIndices(targetIndices); // Auto-select approved project route!
      // Resume simulation at normal speed (1x)
      session.setSpeed(1);
    } else {
      alert(`Cannot approve project: ${t(`draft.error.${res.reason}` as string)}`);
    }
  };

  const handleCancelDraft = () => {
    setIsDrafting(false);
    setDraftIndices([]);
    // Resume simulation at normal speed
    session?.setSpeed(1);
  };

  const handleAddSubwayStation = (lngLat: [number, number]) => {
    const num = subwayDraftStations.length + 1;
    setSubwayDraftStations((prev) => [
      ...prev,
      { name: `Estación ${num}`, coordinates: lngLat },
    ]);
  };

  const startDraftingSubway = () => {
    setIsDrafting(false);
    setDraftIndices([]);
    setIsDraftingSubway(true);
    setSubwayDraftStations([]);
    setSelectedBidIndex(0);
    setMapLayerMode('subterranean'); // auto-switch to subterranean view!
    session?.setSpeed(0); // pause simulation
  };

  const handleApproveSubwayDraft = () => {
    if (!session || !loadedCity || subwayDraftStations.length < 2) return;
    const bid = subwayContractorBids[selectedBidIndex] ?? subwayContractorBids[0];
    const tunnelCoordinates = subwayDraftStations.map((s) => s.coordinates);
    const catchmentIndices = findSubwayCatchmentSegments(loadedCity.ctx.network, subwayDraftStations);

    const res = session.approve({
      typeId: 'subway',
      indices: catchmentIndices.length > 0 ? catchmentIndices : [0],
      contractorBid: bid,
      subwayStations: subwayDraftStations,
      subwayAlignment: tunnelCoordinates,
      customName: `Línea Subterránea (${subwayDraftStations.length} est. · ${subwayLengthKm} km)`,
      customCost: subwayBaseCost,
      customStreetKm: subwayLengthKm,
    });

    if (res.ok) {
      setIsDraftingSubway(false);
      setSubwayDraftStations([]);
      session.setSpeed(1);
    } else {
      alert(`Cannot approve subway: ${t(`draft.error.${res.reason}` as string)}`);
    }
  };

  const handleCancelSubwayDraft = () => {
    setIsDraftingSubway(false);
    setSubwayDraftStations([]);
    session?.setSpeed(1);
  };

  if (screen === 'title') {
    return (
      <main className="start-screen">
        <p className="eyebrow">Lima · Transport & Politics Simulation</p>
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
    const difficultyBadges: Record<string, { label: string; color: string; bg: string }> = {
      easy: { label: 'Fácil', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)' },
      normal: { label: 'Medio', color: '#fde047', bg: 'rgba(234, 179, 8, 0.15)' },
      hard: { label: 'Difícil', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.15)' },
      extreme: { label: 'Muy Difícil', color: '#f87171', bg: 'rgba(239, 68, 68, 0.2)' },
    };

    const cityCoordinates: Record<string, string> = {
      buenos_aires: '34° S · 58° W',
      santiago: '33° S · 70° W',
      lima: '12° S · 77° W',
      cdmx: '19° N · 99° W',
    };

    return (
      <main className="city-screen" style={{ minHeight: '100vh', padding: '6vh max(5vw, 24px)' }}>
        <button className="back" onClick={() => setScreen('title')}>
          ← {t('city.back')}
        </button>
        <p className="eyebrow">{t('city.selectTitle')}</p>
        <h1 style={{ marginBottom: '24px' }}>Select your city</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', maxWidth: '1100px', width: '100%' }}>
          {CITY_CATALOG.map((city) => {
            const badge = difficultyBadges[city.difficulty] ?? difficultyBadges.normal;
            return (
              <section key={city.id} className="city-card" style={{ margin: 0, padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div className="map-mark" style={{ minHeight: '90px', width: '90px', padding: '14px', fontSize: '26px', flexShrink: 0 }}>
                    {city.badgeCode}
                    <small style={{ marginTop: '16px', fontSize: '9px' }}>{cityCoordinates[city.id] ?? ''}</small>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          color: badge.color,
                          backgroundColor: badge.bg,
                          border: `1px solid ${badge.color}40`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {badge.label}
                      </span>
                      <small style={{ color: '#88a090', fontSize: '12px' }}>{city.flag}</small>
                    </div>
                    <h2 style={{ fontSize: '22px', margin: '4px 0 6px' }}>{city.name}, {city.country}</h2>
                    <p style={{ fontSize: '12px', margin: 0, color: '#a0b4a4', lineHeight: 1.45 }}>
                      {t(city.transitSummaryKey)}
                    </p>
                  </div>
                </div>

                <dl style={{ margin: '8px 0 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div>
                    <dt>{t('city.annualBudget')}</dt>
                    <dd style={{ color: '#b8e86c', fontSize: '14px' }}>${(city.initialBudget / 1e6).toFixed(0)}M</dd>
                  </div>
                  <div>
                    <dt>{t('city.roadNetwork')}</dt>
                    <dd style={{ fontSize: '12px' }}>{city.streetsCount.toLocaleString()} Calles</dd>
                  </div>
                  <div>
                    <dt>{t('city.population')}</dt>
                    <dd style={{ fontSize: '12px' }}>{city.population?.value ? (city.population.value / 1e6).toFixed(1) + 'M hab.' : 'N/A'}</dd>
                  </div>
                </dl>

                <button
                  className="primary"
                  style={{ width: '100%', marginTop: '6px', padding: '10px 14px', fontSize: '13px' }}
                  onClick={() => startNewGame(city.id)}
                >
                  {t('city.becomeMinister')} <span>→</span>
                </button>
              </section>
            );
          })}
        </div>

        {/* Coming soon note */}
        <div style={{ marginTop: '24px', maxWidth: '1100px', width: '100%' }}>
          <div className="city-card coming-soon" style={{ padding: '14px 20px', margin: 0 }}>
            <div>
              <span className="eyebrow" style={{ color: '#eab308', margin: 0 }}>Próximamente</span>
              <h3 style={{ margin: '4px 0', fontSize: '15px' }}>Bogotá, Colombia</h3>
              <p style={{ fontSize: '12px', margin: 0 }}>TransMilenio BRT, Corredor Carrera Séptima y Metro Línea 1 en construcción.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (screen === 'loading' || !sessionSnapshot || !loadedCity) {
    return (
      <main className="start-screen">
        <h2>{t('city.loading', { city: findCity(loadingCityId)?.name ?? 'City' })}</h2>
      </main>
    );
  }

  const { state, traffic, speed } = sessionSnapshot;
  const selectedRoad =
    primarySelectedRoadIndex !== null ? loadedCity.ctx.network.segments[primarySelectedRoadIndex] : null;

  // Next elections calculation (5 years = 1825 days)
  const daysInTerm = state.clock.day - state.politics.term.startDay;
  const daysUntilElection = Math.max(0, 1825 - daysInTerm);

  return (
    <main className="game-shell">
      {/* Top HUD */}
      <header className="hud">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            sessionRef.current?.stop();
            sessionRef.current = null;
            setSession(null);
            setScreen('title');
          }}
        >
          FIX MY <i>TRAFFIC</i>
        </a>
        <div className="city-name">
          {loadedCity.bundle.roads.city.name}, {loadedCity.bundle.roads.city.country}{' '}
          <small>{loadedCity.bundle.roads.city.name} · Supabase Synced</small>
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
          <span style={{ color: state.finance.totalBribesReceived > 0 ? '#eab308' : '#eef2eb', fontWeight: 600 }}>
            {formatCurrency(state.finance.personalBalance)}
          </span>
        </div>

        <div className="metric approval">
          <small>{t('hud.approval')}</small>
          <b style={{ color: state.politics.approval >= 0.45 ? '#b8e86c' : state.politics.approval >= 0.25 ? '#eab308' : '#ef4444' }}>
            {formatPercent(state.politics.approval)}
          </b>
        </div>

        <div className="metric">
          <small>{t('hud.corruption')}</small>
          <b style={{ color: state.politics.corruption >= 0.50 ? '#ef4444' : state.politics.corruption >= 0.25 ? '#eab308' : '#22c55e' }}>
            {formatPercent(state.politics.corruption)}
          </b>
        </div>

        <div className="metric">
          <small>Term {state.politics.term.number}</small>
          <span>{daysUntilElection}d left</span>
        </div>

        {/* Speed Controls: 60 real seconds = 1 game day at 1x */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[0, 1, 5, 15, 30].map((s) => (
            <button
              key={s}
              className="advance"
              style={{
                background: speed === s ? '#b8e86c' : 'transparent',
                color: speed === s ? '#101713' : '#dff7a8',
                fontWeight: speed === s ? 'bold' : 'normal',
                padding: '6px 8px',
              }}
              title={s === 0 ? 'Pause' : `${s}× Speed`}
              onClick={() => session?.setSpeed(s)}
            >
              {s === 0 ? '⏸' : `${s}×`}
            </button>
          ))}
          <button
            className="advance"
            style={{ padding: '6px 8px' }}
            title="Advance 30 simulated days instantly"
            onClick={() => session?.advanceDays(30)}
          >
            +30d
          </button>
        </div>
      </header>

      {/* Level Switcher (Surface vs Subterranean) */}
      <div className="map-layer-switcher">
        <button
          className={mapLayerMode === 'surface' ? 'active' : ''}
          onClick={() => setMapLayerMode('surface')}
        >
          ☀️ Superficie
        </button>
        <button
          className={`subterranean ${mapLayerMode === 'subterranean' ? 'active' : ''}`}
          onClick={() => setMapLayerMode('subterranean')}
        >
          🚇 Subterráneo
        </button>
      </div>

      {/* Main Map with Google Maps Traffic + Public Transit */}
      <TrafficMap
        cityId={loadedCity.bundle.roads.city.id}
        network={loadedCity.ctx.network}
        traffic={traffic}
        transit={loadedCity.bundle.transit}
        activeProjects={state.projects}
        center={loadedCity.bundle.roads.city.center}
        selectedSegmentIndices={selectedRoadIndices}
        corridorIndices={draftIndices}
        mapLayerMode={mapLayerMode}
        isDraftingSubway={isDraftingSubway}
        subwayDraftStations={subwayDraftStations}
        onSelectSegment={handleSelectSegment}
        onDoubleClickSegment={handleDoubleClickSegment}
        onAddSubwayStation={handleAddSubwayStation}
      />

      {/* Left Sidebar: Projects and Infrastructure Tools */}
      <aside className="left-panel">
        <p className="eyebrow">{t('tools.title')}</p>
        <h2>{t('tools.title')}</h2>

        {/* Bike Lane */}
        <button
          className={`project-type ${isDrafting && selectedProjectType === 'bikeLane' ? 'active' : ''}`}
          onClick={() => startDraftingType('bikeLane')}
        >
          <span>{PROJECT_CONFIG.bikeLane.icon}</span>
          <span>
            {t('tools.bikeLane')}
            <small>{t('tools.bikeLaneDesc')}</small>
          </span>
        </button>

        {/* BRT Bus Corridor */}
        <button
          className={`project-type ${isDrafting && selectedProjectType === 'brt' ? 'active' : ''}`}
          onClick={() => startDraftingType('brt')}
        >
          <span>{PROJECT_CONFIG.brt.icon}</span>
          <span>
            {t('tools.brt')}
            <small>{t('tools.brtDesc')}</small>
          </span>
        </button>

        {/* Elevated Metro */}
        <button
          className={`project-type ${isDrafting && selectedProjectType === 'elevatedMetro' ? 'active' : ''}`}
          onClick={() => startDraftingType('elevatedMetro')}
        >
          <span>{PROJECT_CONFIG.elevatedMetro.icon}</span>
          <span>
            {t('tools.elevatedMetro')}
            <small>{t('tools.elevatedMetroDesc')}</small>
          </span>
        </button>

        {/* Subterranean Metro */}
        <button
          className={`project-type ${isDraftingSubway ? 'active' : ''}`}
          onClick={() => startDraftingSubway()}
        >
          <span>{PROJECT_CONFIG.subway.icon}</span>
          <span>
            {t('tools.subway')}
            <small>Modo Libre · Tuneladora TBM</small>
          </span>
        </button>

        {/* Roundabout / Interchange */}
        <button
          className={`project-type ${isDrafting && selectedProjectType === 'roundabout' ? 'active' : ''}`}
          onClick={() => startDraftingType('roundabout')}
        >
          <span>{PROJECT_CONFIG.roundabout.icon}</span>
          <span>
            {t('tools.roundabout')}
            <small>{t('tools.roundaboutDesc')}</small>
          </span>
        </button>

        {/* Legend */}
        <div className="legend">
          <p className="eyebrow">{t('map.legend')}</p>
          {CONGESTION_LEVELS.map((lvl) => (
            <span key={lvl.id}>
              <i style={{ background: lvl.color }} />
              {t(`congestion.${lvl.id}` as string)}
            </span>
          ))}
          {/* Dynamic Real Public Transit for the selected city */}
          {loadedCity.bundle.transit.routes.length > 0 && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #28372b' }}>
              <p className="eyebrow" style={{ fontSize: '9px', marginBottom: '6px', color: '#94a99b' }}>
                Red de Transporte ({loadedCity.bundle.roads.city.name})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '150px', overflowY: 'auto' }}>
                {loadedCity.bundle.transit.routes.map((r) => (
                  <span
                    key={r.id}
                    style={{
                      fontSize: '11px',
                      color: r.colour || '#00e676',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={r.name}
                  >
                    <span
                      style={{
                        width: '12px',
                        height: '3px',
                        background: r.colour || '#00e676',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.ref ? `[${r.ref}] ` : ''}{r.name}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Projects List */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <p className="eyebrow" style={{ margin: 0 }}>{t('tools.activeProjects')}</p>
            <span style={{ fontSize: '10px', color: '#88a090' }}>({state.projects.length})</span>
          </div>
          {state.projects.length === 0 ? (
            <p className="muted">{t('tools.noProjects')}</p>
          ) : (
            state.projects.map((p) => {
              const projectSegmentIndices = p.segmentIds
                .map((id) => loadedCity.ctx.network.indexById.get(id))
                .filter((idx): idx is number => idx !== undefined);

              const isSelected =
                projectSegmentIndices.length > 0 &&
                selectedRoadIndices.length > 0 &&
                projectSegmentIndices.some((idx) => selectedRoadIndices.includes(idx));

              return (
                <div
                  key={p.id}
                  style={{
                    background: isSelected ? '#192b1f' : '#0e1711',
                    border: isSelected ? '1px solid #00f0ff' : '1px solid #203025',
                    padding: '8px 10px',
                    marginBottom: '8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Haz clic para seleccionar esta obra en el mapa"
                  onClick={() => {
                    if (projectSegmentIndices.length > 0) {
                      setSelectedRoadIndices(projectSegmentIndices);
                    }
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{PROJECT_CONFIG[p.typeId]?.icon} {p.name}</span>
                    <span style={{ fontSize: '10px', color: '#b8e86c' }}>{formatPercent(p.progress)}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#99aa9d', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t(`project.phase.${p.phase}` as string)}</span>
                    <span style={{ color: '#88a090', fontSize: '10px' }}>{p.contractor?.name ?? 'Ministerio'}</span>
                  </div>
                  <button
                    className="advance"
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '3px 6px',
                      fontSize: '10px',
                      borderColor: '#ef4444',
                      color: '#fca5a5',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`¿Deseas rescindir el contrato de "${p.name}"? Se recuperará parte del presupuesto y se liberarán los carriles cerrados.`)) {
                        session?.cancel(p.id);
                      }
                    }}
                  >
                    ✕ Cancelar / Rescindir Contrato
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Sidebar: Contextual Info & Inspector / Draft Proposal */}
      <aside className="right-panel">
        {isDraftingSubway ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="eyebrow" style={{ color: '#c084fc', margin: 0 }}>Subsuelo · Modo Libre</p>
              <button
                className="advance"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={handleCancelSubwayDraft}
              >
                Cerrar ✕
              </button>
            </div>
            <h2>🚇 Metro Subterráneo (TBM)</h2>
            <p className="muted" style={{ fontSize: '12px' }}>
              Haz clic en cualquier punto del mapa para colocar estaciones subterráneas. El túnel perforará el subsuelo entre cada estación libremente.
            </p>

            <div className="proposal">
              <span>
                Estaciones colocadas: <b>{subwayDraftStations.length}</b>
              </span>
              <span>
                Longitud de túnel: <b>{formatKm(subwayLengthKm)}</b>
              </span>
              <span>
                Costo estimado:{' '}
                <b>{formatCurrency(Math.round(subwayBaseCost * (selectedSubwayBid?.costMultiplier ?? 1)))}</b>
              </span>
              <span>
                Disrupción superficial: <b style={{ color: '#86efac' }}>Mínima (solo pozos de acceso)</b>
              </span>
              <span>
                Alivio proyectado: <b className="positive">-40% tráfico en el área</b>
              </span>
            </div>

            {subwayDraftStations.length > 0 && (
              <div style={{ margin: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <p className="eyebrow" style={{ margin: 0 }}>Trazado de Estaciones</p>
                  <button
                    className="advance"
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                    onClick={() => setSubwayDraftStations((prev) => prev.slice(0, -1))}
                  >
                    ↩ Deshacer última
                  </button>
                </div>
                <div className="subway-stations-list">
                  {subwayDraftStations.map((st, idx) => (
                    <div key={idx} className="station-item">
                      <span>🚇 {st.name}</span>
                      <small style={{ color: '#889988' }}>
                        {st.coordinates[0].toFixed(3)}, {st.coordinates[1].toFixed(3)}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bidding proposals for subway */}
            {subwayContractorBids.length > 0 && (
              <>
                <p className="eyebrow" style={{ margin: '8px 0 4px' }}>Licitación de Obra Subterránea</p>
                <div className="bidding-list">
                  {subwayContractorBids.map((bid, idx) => (
                    <div
                      key={bid.id}
                      className={`contractor-card ${selectedBidIndex === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedBidIndex(idx)}
                    >
                      <div className="contractor-name">
                        <span>{bid.name}</span>
                        {bid.bribeOffer > 0 ? (
                          <span className="bribe-badge">Soborno: +{formatCurrency(bid.bribeOffer)}</span>
                        ) : bid.reputation === 'excellent' ? (
                          <span className="tech-badge">ISO Auditoría</span>
                        ) : (
                          <span className="risk-badge">Low Cost</span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '11px', color: '#c4cec5' }}>
                        {bid.headline}
                      </p>
                      <ul className="pro-list">
                        {bid.pros.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                      <ul className="con-list">
                        {bid.cons.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#889988' }}>
                        <span>Costo: {Math.round(bid.costMultiplier * 100)}%</span>
                        {bid.corruptionRisk > 0 && (
                          <span style={{ color: '#ef4444' }}>Riesgo fiscal: +{Math.round(bid.corruptionRisk * 100)}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="primary full"
                  disabled={
                    subwayDraftStations.length < 2 ||
                    state.finance.publicBudget < subwayBaseCost * (selectedSubwayBid?.costMultiplier ?? 1)
                  }
                  onClick={handleApproveSubwayDraft}
                >
                  {subwayDraftStations.length < 2
                    ? 'Coloca al menos 2 estaciones en el mapa'
                    : 'Aprobar Contrato & Iniciar Tuneladora'}
                </button>
              </>
            )}

            <button
              className="advance"
              style={{ marginTop: '8px', width: '100%' }}
              onClick={handleCancelSubwayDraft}
            >
              Cancelar Trazado Subterráneo
            </button>
          </div>
        ) : isDrafting ? (
          <div>
            <p className="eyebrow">{t('draft.title')}</p>
            <h2>
              {PROJECT_CONFIG[selectedProjectType]?.icon} {t(`tools.${selectedProjectType}` as string)}
            </h2>
            <p className="muted">{t('draft.hint')}</p>

            {(draftIndices.length > 0 || selectedRoadIndices.length > 0) && (
              <button
                className="advance"
                style={{
                  marginBottom: '12px',
                  width: '100%',
                  borderColor: '#00f0ff',
                  color: '#00f0ff',
                  background: '#0e1c18',
                }}
                onClick={() => {
                  const seed = draftIndices[0] ?? primarySelectedRoadIndex;
                  if (seed !== null && seed !== undefined && loadedCity) {
                    const expanded = getAllAvenueSegments(loadedCity.ctx.network, seed);
                    setDraftIndices(expanded);
                  }
                }}
              >
                🛣️ {t('draft.selectStreet')} ({loadedCity.ctx.network.segments[draftIndices[0] ?? primarySelectedRoadIndex!]?.name || 'Avenida'})
              </button>
            )}

            {projectEstimate ? (
              <div className="proposal">
                <span>
                  {t('draft.length')} <b>{formatKm(projectEstimate.streetKm)}</b>
                </span>
                <span>
                  {t('draft.cost')}{' '}
                  <b>{formatCurrency(Math.round(projectEstimate.cost * (selectedBid?.costMultiplier ?? 1)))}</b>
                </span>
                <span>
                  {t('draft.duration')}{' '}
                  <b>
                    {Math.round(
                      (projectEstimate.planningDays + projectEstimate.constructionDays) *
                        (selectedBid?.durationMultiplier ?? 1),
                    )}{' '}
                    days
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

                <hr style={{ borderColor: '#2d3c30', margin: '12px 0 8px' }} />

                {/* 3 Contractor Proposals (Licitación) */}
                <p className="eyebrow" style={{ margin: '4px 0' }}>{t('bidding.sectionTitle')}</p>
                <div className="bidding-list">
                  {contractorBids.map((bid, idx) => (
                    <div
                      key={bid.id}
                      className={`contractor-card ${selectedBidIndex === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedBidIndex(idx)}
                    >
                      <div className="contractor-name">
                        <span>{bid.name}</span>
                        {bid.bribeOffer > 0 ? (
                          <span className="bribe-badge">Soborno: +{formatCurrency(bid.bribeOffer)}</span>
                        ) : bid.reputation === 'excellent' ? (
                          <span className="tech-badge">ISO Auditoría</span>
                        ) : (
                          <span className="risk-badge">Low Cost</span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '11px', color: '#c4cec5' }}>
                        {bid.headline}
                      </p>
                      <ul className="pro-list">
                        {bid.pros.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                      <ul className="con-list">
                        {bid.cons.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#889988' }}>
                        <span>Costo: {Math.round(bid.costMultiplier * 100)}%</span>
                        {bid.corruptionRisk > 0 && (
                          <span style={{ color: '#ef4444' }}>Riesgo fiscal: +{Math.round(bid.corruptionRisk * 100)}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

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
              onClick={handleCancelDraft}
            >
              {t('draft.cancel')}
            </button>
          </div>
        ) : selectedRoad ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="eyebrow" style={{ margin: 0 }}>
                {isFullAvenueSelected ? 'Avenida Completa' : t('road.inspect')}
              </p>
              <button
                className="advance"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => setSelectedRoadIndices([])}
              >
                Deseleccionar ✕
              </button>
            </div>
            <h2>{selectedRoad.name || t('road.unnamed')}</h2>

            {/* Quick Avenue Expand / Collapse Controls */}
            {allAvenueIndices.length > 1 && (
              <div style={{ margin: '6px 0 12px' }}>
                {!isFullAvenueSelected ? (
                  <button
                    className="advance"
                    style={{
                      width: '100%',
                      background: '#13211a',
                      borderColor: '#00f0ff',
                      color: '#00f0ff',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                    title="Doble clic en el mapa también selecciona toda la vía"
                    onClick={() => setSelectedRoadIndices(allAvenueIndices)}
                  >
                    <span>🛣️ <b>Seleccionar toda la vía</b> ({allAvenueIndices.length} tramos)</span>
                    <small style={{ color: '#889988', fontSize: '10px' }}>
                      (O haz doble clic sobre el tramo en el mapa)
                    </small>
                  </button>
                ) : (
                  <div
                    style={{
                      background: '#0e1c18',
                      border: '1px solid #00f0ff',
                      borderRadius: '4px',
                      padding: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#00f0ff' }}>
                      ✓ Toda la vía ({selectedRoadIndices.length} tramos · {formatKm(selectedTotalKm)})
                    </span>
                    <button
                      className="advance"
                      style={{ fontSize: '10px', padding: '2px 8px' }}
                      onClick={() => setSelectedRoadIndices([primarySelectedRoadIndex!])}
                    >
                      Solo 1 tramo
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Active Project Banner on this Road if present */}
            {activeProjectOnSegment && (
              <div style={{ background: '#19221a', border: '1px solid #ef4444', borderRadius: '4px', padding: '10px', margin: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="eyebrow" style={{ color: '#ef4444', margin: 0 }}>Proyecto en Ejecución</span>
                  <span style={{ fontSize: '11px', color: '#b8e86c' }}>{formatPercent(activeProjectOnSegment.progress)}</span>
                </div>
                <h3 style={{ margin: '4px 0 2px', fontSize: '15px' }}>
                  {PROJECT_CONFIG[activeProjectOnSegment.typeId]?.icon} {activeProjectOnSegment.name}
                </h3>
                <p style={{ fontSize: '11px', color: '#a0b0a3', margin: '2px 0 8px' }}>
                  Contratista: <b>{activeProjectOnSegment.contractor?.name ?? 'Estándar'}</b> · Fase: {t(`project.phase.${activeProjectOnSegment.phase}` as string)}
                </p>
                <button
                  className="advance"
                  style={{ width: '100%', borderColor: '#ef4444', color: '#fca5a5', padding: '6px' }}
                  onClick={() => {
                    if (confirm(`¿Deseas rescindir el contrato de "${activeProjectOnSegment.name}"? Se recuperará el 70% del presupuesto asignado y se liberarán los carriles cerrados.`)) {
                      session?.cancel(activeProjectOnSegment.id);
                    }
                  }}
                >
                  ✕ Rescindir contrato (+70% reembolso)
                </button>
              </div>
            )}

            <div className="congestion">
              <i
                style={{
                  background:
                    CONGESTION_LEVELS.find(
                      (l) => l.id === congestionLevel(avgCongestion),
                    )?.color ?? '#22c55e',
                }}
              />
              <div>
                <strong>
                  {t(`congestion.${congestionLevel(avgCongestion)}` as string)}
                </strong>
                <small>
                  {t('road.score', {
                    value: avgCongestion.toFixed(2),
                  })}
                </small>
              </div>
            </div>

            <dl>
              <div>
                <dt>{t('road.length')}</dt>
                <dd>{formatKm(selectedTotalKm)} ({selectedRoadIndices.length} {selectedRoadIndices.length === 1 ? 'tramo' : 'tramos'})</dd>
              </div>
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
                <dd>{selectedRoad.lanes} {selectedRoad.oneway ? '(sentido único)' : '(doble sentido)'}</dd>
              </div>
            </dl>

            <button
              className="primary full"
              style={{ marginTop: '20px' }}
              onClick={() => {
                startDraftingType('bikeLane');
              }}
            >
              {t('road.proposeProject')} <span>→</span>
            </button>
          </div>
        ) : (
          <div>
            <p className="eyebrow">{t('road.inspect')}</p>
            <h2>Explorar red vial</h2>
            <p className="muted">
              Haz clic en cualquier calle o avenida del mapa para inspeccionar su demanda, saturación de carriles y proponer obras de transporte.
            </p>
            <p className="muted" style={{ fontSize: '11px', marginTop: '12px' }}>
              Tip: También puedes hacer clic en un área vacía del mapa para deseleccionar.
            </p>
          </div>
        )}
      </aside>

      {/* Bottom Briefing / News Feed (Ministry Intelligence) */}
      <section className="event-feed">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <p className="eyebrow" style={{ margin: 0 }}>Despacho Ministerial · Boletín de Inteligencia</p>
          <small style={{ color: '#6ee7b7', fontSize: '10px' }}>En vivo</small>
        </div>
        {state.news.slice(0, 3).map((item) => (
          <p className={`event ${item.severity}`} key={item.id}>
            <span>●</span>
            {t(item.key as string, item.params)}
          </p>
        ))}
      </section>

      {/* Game Over Modal */}
      {state.status === 'gameOver' && (
        <div className="game-over-overlay">
          <div className="game-over-box">
            <h1>{t('gameover.title')}</h1>
            <p>
              {state.gameOverReason === 'impeached'
                ? t('gameover.impeached')
                : state.gameOverReason === 'corruptionScandal'
                ? t('gameover.corruptionScandal')
                : t('gameover.electionDefeat')}
            </p>
            <div style={{ background: '#0f1712', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>Days in office:</span>
                <b>{state.clock.day} days</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>Final approval:</span>
                <b>{formatPercent(state.politics.approval)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>Public funds spent:</span>
                <b>{formatCurrency(state.finance.totalPublicSpent)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Personal bank balance:</span>
                <b style={{ color: '#eab308' }}>{formatCurrency(state.finance.personalBalance)}</b>
              </div>
            </div>
            <button
              className="primary full"
              onClick={() => {
                sessionRef.current?.stop();
                sessionRef.current = null;
                setSession(null);
                setScreen('city');
              }}
            >
              {t('gameover.restart')} <span>↺</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
