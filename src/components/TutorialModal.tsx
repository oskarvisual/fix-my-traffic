import React, { useState } from 'react';

export interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  cityName: string;
  initialStep?: number;
}

interface TutorialStepConfig {
  step: number;
  badge: string;
  title: string;
  subtitle: string;
  imageSrc?: string;
  placeholderLabel?: string;
  placeholderFilename?: string;
  bullets: Array<{ icon: string; title: string; desc: string }>;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  playerName,
  cityName,
  initialStep = 0,
}) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  const handleImageError = (stepIdx: number) => {
    setImageErrors((prev) => ({ ...prev, [stepIdx]: true }));
  };

  const steps: TutorialStepConfig[] = [
    // Step 0: The Induction & Appointment Announcement (User request: Congressman capture & appointment)
    {
      step: 0,
      badge: 'OFFICIAL APPOINTMENT · CITY HALL CEREMONY',
      title: `New Mayor ${playerName} Takes Office`,
      subtitle: `Appointed as Supreme Transportation Authority of ${cityName}`,
      imageSrc: '/assets/congressman.png',
      placeholderLabel: 'Official Press Induction Capture',
      placeholderFilename: 'congressman.png',
      bullets: [
        {
          icon: '🏛️',
          title: 'Executive Mandate',
          desc: `You hold absolute authority over municipal traffic, public transit investments, road expansions, and contractor awards in ${cityName}.`,
        },
        {
          icon: '🚦',
          title: 'Traffic Emergency',
          desc: 'Avenues are gridlocked at peak hours. Relieve bottlenecks or face public protests and declining approval ratings.',
        },
        {
          icon: '⚖️',
          title: 'Political Stakes',
          desc: 'Balance the municipal budget, manage citizen satisfaction, and resist illicit contractor bribes to avoid corruption investigations.',
        },
      ],
    },
    // Step 1: Road & Traffic Inspection
    {
      step: 1,
      badge: 'TUTORIAL 1/4 · MAP NAVIGATION',
      title: 'Inspect Roads & Traffic Bottlenecks',
      subtitle: 'Locate critical traffic jams and diagnose corridor capacity',
      imageSrc: '/assets/tutorial/step1-inspector.png',
      placeholderLabel: 'Screenshot: Road Traffic Inspector & Avenue Selection',
      placeholderFilename: 'step1-inspector.png',
      bullets: [
        {
          icon: '🖱️',
          title: 'Click Any Street',
          desc: 'Click any road on the map to inspect its lanes, current speed, vehicle throughput, and congestion level in the Right Panel.',
        },
        {
          icon: '⚡',
          title: 'Double-Click to Select Avenue',
          desc: 'Double-clicking any segment automatically selects the entire continuous avenue corridor for city-scale interventions.',
        },
        {
          icon: '🔴',
          title: 'Traffic Color Coding',
          desc: 'Green indicates smooth flow. Orange and dark red represent critical congestion where public complaints multiply.',
        },
      ],
    },
    // Step 2: Infrastructure Projects & Tenders
    {
      step: 2,
      badge: 'TUTORIAL 2/4 · PUBLIC WORKS',
      title: 'Draft Projects & Tender Public Works',
      subtitle: 'Transform road corridors with BRT, bike lanes, and additional capacity',
      imageSrc: '/assets/tutorial/step2-projects.png',
      placeholderLabel: 'Screenshot: Project Tools & Contractor Bidding Card',
      placeholderFilename: 'step2-projects.png',
      bullets: [
        {
          icon: '🛠️',
          title: 'Select an Intervention',
          desc: 'Use the Left Panel to choose Dedicated BRT Busways, Protected Bike Lanes, Extra Vehicle Lanes, Tolls, or Paving.',
        },
        {
          icon: '💼',
          title: 'Contractor Bidding & Kickbacks',
          desc: 'Review competing engineering contractors. Some offer fast completion or cheap rates, while shady firms offer under-the-table kickbacks.',
        },
        {
          icon: '🚧',
          title: 'Construction Detours',
          desc: 'Active projects temporarily disrupt traffic and create detour barricades. Time your works strategically!',
        },
      ],
    },
    // Step 3: Underground Subway Network
    {
      step: 3,
      badge: 'TUTORIAL 3/4 · METRO EXPANSION',
      title: 'Build Underground Subway Lines',
      subtitle: 'Design custom subterranean metro routes beneath the city',
      imageSrc: '/assets/tutorial/step3-subway.png',
      placeholderLabel: 'Screenshot: Subterranean Mode & Placing Subway Stations',
      placeholderFilename: 'step3-subway.png',
      bullets: [
        {
          icon: '🚇',
          title: 'Subterranean View Mode',
          desc: 'Toggle between "Surface" and "Subterranean" mode in the top switcher bar to view the underground domain.',
        },
        {
          icon: '📍',
          title: 'Freeform Station Placement',
          desc: 'Click "Draft Subway Line", then click directly on the map to position underground stations. Tunnels connect dynamically between stations.',
        },
        {
          icon: '🚄',
          title: 'High-Capacity Relief',
          desc: 'Subways provide unmatched passenger carrying capacity and permanently remove thousands of cars from surface arteries.',
        },
      ],
    },
    // Step 4: Politics, Approval & Corruption Trials
    {
      step: 4,
      badge: 'TUTORIAL 4/4 · POLITICAL SURVIVAL',
      title: 'Politics, Approval & Public Opinion',
      subtitle: 'Survive term elections without being ousted or impeached',
      imageSrc: '/assets/tutorial/step4-politics.png',
      placeholderLabel: 'Screenshot: Opinion Barometer, Term Clock & Breaking News',
      placeholderFilename: 'step4-politics.png',
      bullets: [
        {
          icon: '📊',
          title: 'Public Approval Barometer',
          desc: 'Citizen approval reflects transit reliability, commute times, and government efficiency. Keep it above 40% to survive.',
        },
        {
          icon: '⚖️',
          title: 'Anti-Corruption Prosecutor',
          desc: 'Accepting contractor bribes inflates your personal wallet, but if Corruption crosses 50%, criminal investigations will trigger your removal.',
        },
        {
          icon: '🗳️',
          title: 'The 5-Year Term Clock',
          desc: 'You have 1,825 simulated days until the next election. Build lasting transit infrastructure and leave your mark on the city!',
        },
      ],
    },
  ];

  const currentConfig = steps[currentStep] || steps[0];
  const isAppointmentScreen = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const isImageFailed = imageErrors[currentStep];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 8, 5, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#0d1712',
          border: isAppointmentScreen ? '2px solid #b8e86c' : '1px solid #2d4534',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: isAppointmentScreen
            ? '0 0 50px rgba(184, 232, 108, 0.25), 0 25px 60px rgba(0, 0, 0, 0.95)'
            : '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(184, 232, 108, 0.1)',
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            background: isAppointmentScreen
              ? 'linear-gradient(90deg, #182d1c, #101c13)'
              : 'linear-gradient(90deg, #132217, #0e1711)',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: isAppointmentScreen ? '#166534' : '#1e3a24',
                color: isAppointmentScreen ? '#86efac' : '#b8e86c',
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: '4px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {isAppointmentScreen && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#86efac',
                  }}
                />
              )}
              {currentConfig.badge}
            </span>
          </div>

          {/* Step indicators / Skip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              {steps.map((s, idx) => (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(idx)}
                  title={`Go to: ${s.title}`}
                  style={{
                    width: idx === currentStep ? '22px' : '7px',
                    height: '7px',
                    borderRadius: '4px',
                    backgroundColor: idx === currentStep ? '#b8e86c' : 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                />
              ))}
            </div>

            <button
              onClick={onClose}
              title="Close Tutorial"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#849587',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Main Photo / TV Screen / Screenshot Placeholder */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: isAppointmentScreen ? '240px' : '220px',
              backgroundColor: '#08100b',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #233728',
              marginBottom: '18px',
            }}
          >
            {currentConfig.imageSrc && !isImageFailed ? (
              <>
                <img
                  src={currentConfig.imageSrc}
                  alt={currentConfig.title}
                  onError={() => handleImageError(currentStep)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: isAppointmentScreen ? 'center 20%' : 'center center',
                    display: 'block',
                  }}
                />

                {isAppointmentScreen && (
                  <>
                    {/* TV broadcast overlay scanlines */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%), linear-gradient(90deg, rgba(34, 197, 94, 0.04), rgba(0, 0, 0, 0), rgba(34, 197, 94, 0.04))',
                        backgroundSize: '100% 3px, 6px 100%',
                        pointerEvents: 'none',
                      }}
                    />

                    {/* Lower-third chyron banner */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: '#15803d',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 12px',
                          alignSelf: 'flex-start',
                          marginLeft: '12px',
                          borderTopLeftRadius: '3px',
                          borderTopRightRadius: '3px',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        OFFICIAL GAZETTE · {cityName.toUpperCase()}
                      </div>
                      <div
                        style={{
                          backgroundColor: '#142719',
                          color: '#f0fdf4',
                          padding: '8px 14px',
                          fontSize: '13px',
                          fontWeight: 900,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          borderTop: '2px solid #b8e86c',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.85)',
                        }}
                      >
                        <span style={{ color: '#b8e86c', fontSize: '15px' }}>🏛️</span>
                        <span>
                          MAYOR {playerName.toUpperCase()} ASSUMES COMMAND OF TRANSPORTATION
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              // Placeholder Box for screenshots waiting to be added
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'repeating-linear-gradient(45deg, #0d1811, #0d1811 12px, #122218 12px, #122218 24px)',
                  border: '2px dashed #2d4534',
                  borderRadius: '8px',
                  padding: '20px',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📸</div>
                <div style={{ color: '#b8e86c', fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                  {currentConfig.placeholderLabel || 'Screenshot Slot'}
                </div>
                <div style={{ color: '#88a090', fontSize: '12px', maxWidth: '420px', lineHeight: 1.4 }}>
                  Drop your screenshot in{' '}
                  <code
                    style={{
                      backgroundColor: '#182d1f',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: '#a3e635',
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    public/assets/tutorial/{currentConfig.placeholderFilename || 'step.png'}
                  </code>{' '}
                  to display it here automatically.
                </div>
              </div>
            )}
          </div>

          {/* Step Titles */}
          <div style={{ marginBottom: '16px' }}>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 800,
                margin: '0 0 6px',
                color: '#f0fdf4',
                letterSpacing: '-0.02em',
              }}
            >
              {currentConfig.title}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#8ba091', lineHeight: 1.45 }}>
              {currentConfig.subtitle}
            </p>
          </div>

          {/* Key Bullet Points */}
          <div
            style={{
              display: 'grid',
              gap: '10px',
              backgroundColor: '#101c14',
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid #1f3324',
            }}
          >
            {currentConfig.bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '18px', lineHeight: 1.2, flexShrink: 0, marginTop: '1px' }}>
                  {b.icon}
                </span>
                <div style={{ fontSize: '13px', lineHeight: 1.45 }}>
                  <strong style={{ color: '#e2ece4', marginRight: '6px' }}>{b.title}:</strong>
                  <span style={{ color: '#97a89b' }}>{b.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Bottom Buttons (Requested: Close Tutorial on the Left, Start Tutorial on the Right) */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#0a130e',
            borderTop: '1px solid #1e3323',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {isAppointmentScreen ? (
            <>
              {/* Left Button: Close Tutorial */}
              <button
                className="advance"
                onClick={onClose}
                style={{
                  padding: '11px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#9fb1a3',
                  borderColor: '#2e4735',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>✕</span> Close Tutorial
              </button>

              {/* Right Button: Start Tutorial */}
              <button
                className="primary"
                onClick={() => setCurrentStep(1)}
                style={{
                  padding: '11px 24px',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: '#b8e86c',
                  color: '#101713',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>Start Tutorial</span>
                <span style={{ fontSize: '16px', lineHeight: 1 }}>→</span>
              </button>
            </>
          ) : (
            <>
              {/* Subsequent steps: Back / Previous button on the left */}
              <button
                className="advance"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                style={{
                  padding: '11px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#9fb1a3',
                  borderColor: '#2e4735',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="advance"
                  onClick={onClose}
                  style={{
                    padding: '11px 16px',
                    fontSize: '13px',
                    color: '#768779',
                    borderColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Skip
                </button>

                {isLastStep ? (
                  <button
                    className="primary"
                    onClick={onClose}
                    style={{
                      padding: '11px 24px',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: '#b8e86c',
                      color: '#101713',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>Start Governing</span>
                    <span style={{ fontSize: '16px', lineHeight: 1 }}>🚀</span>
                  </button>
                ) : (
                  <button
                    className="primary"
                    onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                    style={{
                      padding: '11px 22px',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: '#b8e86c',
                      color: '#101713',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>Next Step</span>
                    <span style={{ fontSize: '16px', lineHeight: 1 }}>→</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
