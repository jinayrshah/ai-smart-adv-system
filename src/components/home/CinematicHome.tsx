import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react';
import { 
  Sprout, 
  CloudRain, 
  Thermometer, 
  Droplets, 
  Sun, 
  Compass, 
  Layers, 
  ArrowRight, 
  ChevronRight, 
  Activity, 
  CheckCircle2, 
  Sparkles, 
  Play, 
  Pause, 
  Maximize2, 
  UserCheck, 
  ShieldCheck, 
  Zap,
  Globe2,
  Calendar,
  FileCheck,
  TrendingUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../context/AuthContext';
import { type FarmerProfileView } from '../../lib/farmerProfile';

interface CinematicHomeProps {
  weather: any;
  weatherLoading: boolean;
  farmView: FarmerProfileView | null;
  onOpenOnboarding: () => void;
}

type CameraPerspective = 'soil' | 'canopy' | 'yield';

const PERSPECTIVES: { id: CameraPerspective; label: string; sub: string; rotateX: number; rotateY: number; scale: number; z: number }[] = [
  { id: 'soil', label: '01. Subsurface', sub: 'Soil Chemistry & Root Hydraulics', rotateX: 18, rotateY: -14, scale: 1.05, z: 40 },
  { id: 'canopy', label: '02. Canopy', sub: 'Atmospheric Vapor & Evapotranspiration', rotateX: -8, rotateY: 20, scale: 1.02, z: 20 },
  { id: 'yield', label: '03. Phenology', sub: 'Growing Degree Days & Crop Trajectory', rotateX: 12, rotateY: 6, scale: 1.08, z: 60 },
];

export const CinematicHome: React.FC<CinematicHomeProps> = ({
  weather,
  weatherLoading,
  farmView,
  onOpenOnboarding,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  // Cinematic sequence state
  const [activeCam, setActiveCam] = useState<CameraPerspective>('canopy');
  const [isPlayingSequence, setIsPlayingSequence] = useState(true);
  const [kineticPhraseIndex, setKineticPhraseIndex] = useState(0);

  // Interactive 3D Card Mouse Parallax
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 120, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 120, damping: 20 });

  const cardRotateX = useTransform(springY, [-0.5, 0.5], [15, -15]);
  const cardRotateY = useTransform(springX, [-0.5, 0.5], [-18, 18]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Autoplay camera sequence
  useEffect(() => {
    if (!isPlayingSequence) return;
    const timer = setInterval(() => {
      setActiveCam((prev) => {
        if (prev === 'soil') return 'canopy';
        if (prev === 'canopy') return 'yield';
        return 'soil';
      });
      setKineticPhraseIndex((prev) => (prev + 1) % 3);
    }, 6500);
    return () => clearInterval(timer);
  }, [isPlayingSequence]);

  const currentCamConfig = PERSPECTIVES.find((p) => p.id === activeCam) || PERSPECTIVES[1];

  const KINETIC_PHRASES = [
    {
      kicker: 'AI Agronomic Engine',
      serif: 'Rooted in Soil Science.',
      sans: 'Precision guidance engineered for sovereign smallholders.',
      accent: 'GDD & Evapotranspiration Fused'
    },
    {
      kicker: 'Tri-Source Microclimate',
      serif: 'Microclimates Decoded.',
      sans: 'Synthesizing IMD ground sensors, NASA POWER and high-resolution Open-Meteo.',
      accent: '98.4% Forecast Reliability'
    },
    {
      kicker: 'Biological Verification',
      serif: 'Honest Agricultural Intelligence.',
      sans: 'Grounded in ICAR agronomic research packages with zero hallucinated figures.',
      accent: 'Peer-Reviewed Agronomy'
    }
  ];

  const phrase = KINETIC_PHRASES[kineticPhraseIndex];

  return (
    <div className="space-y-10 pb-32 max-w-5xl mx-auto">
      {/* 1. CINEMATIC HERO 3D STAGE & KINETIC TYPOGRAPHY */}
      <section 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative min-h-[460px] md:min-h-[520px] rounded-[36px] bg-[#07503f] overflow-hidden p-6 md:p-12 text-[#f1efdf] shadow-[0_24px_60px_-15px_rgba(7,80,63,0.5)] border border-[#0d6e57]/40 flex flex-col justify-between perspective-1000 select-none"
      >
        {/* Dynamic Morphing Background Aura */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div 
            animate={{
              scale: [1, 1.25, 1],
              x: activeCam === 'soil' ? [-20, 30, -20] : activeCam === 'canopy' ? [40, -10, 40] : [0, 20, 0],
              y: activeCam === 'soil' ? [30, -20, 30] : activeCam === 'canopy' ? [-30, 20, -30] : [20, -20, 20],
              opacity: [0.35, 0.55, 0.35]
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#e8fe85]/20 blur-[90px]"
          />
          <motion.div 
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#16a34a]/30 blur-[100px]"
          />
          {/* Subtle Organic Field Contour Lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10 stroke-current" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="contours" width="120" height="120" patternUnits="userSpaceOnUse">
                <path d="M0 60 C 30 20, 90 100, 120 60 M0 120 C 40 80, 80 140, 120 120 M0 0 C 40 -40, 80 40, 120 0" fill="none" strokeWidth="1" strokeDasharray="2 3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#contours)" />
          </svg>
        </div>

        {/* Top Floating Telemetry & Director Pill */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2 bg-black/30 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#e8fe85] animate-ping" />
            <span className="font-semibold tracking-wider uppercase text-[11px] text-[#e8fe85]">
              {phrase.kicker}
            </span>
            <span className="text-white/30">|</span>
            <span className="text-white/70 text-[11px] font-mono">
              CAM // {activeCam.toUpperCase()}
            </span>
          </div>

          {/* Camera Director Controls */}
          <div className="flex items-center space-x-1.5 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 text-xs">
            {PERSPECTIVES.map((cam) => (
              <button
                key={cam.id}
                onClick={() => {
                  setActiveCam(cam.id);
                  setIsPlayingSequence(false);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  activeCam === cam.id
                    ? 'bg-[#e8fe85] text-[#07503f] font-bold shadow-md shadow-black/20'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {cam.label.split('.')[1].trim()}
              </button>
            ))}
            <button
              onClick={() => setIsPlayingSequence(!isPlayingSequence)}
              title={isPlayingSequence ? 'Pause sequence' : 'Play sequence'}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              {isPlayingSequence ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>
        </div>

        {/* Middle: 3D Perspective Visual & Kinetic Typography Split */}
        <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-6">
          {/* Left: Kinetic Typography */}
          <div className="lg:col-span-7 space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={kineticPhraseIndex}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-3"
              >
                <div className="inline-block px-3 py-1 rounded-full bg-[#e8fe85]/15 border border-[#e8fe85]/30 text-[#e8fe85] text-xs font-mono font-medium">
                  {phrase.accent}
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-normal tracking-tight text-[#f1efdf] leading-[1.08]">
                  {phrase.serif}
                </h1>
                <p className="text-stone-300 text-sm md:text-base leading-relaxed max-w-lg font-sans">
                  {phrase.sans}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Quick Action Pill Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveTab('advisor')}
                className="px-6 py-3 rounded-full bg-[#e8fe85] hover:bg-[#d8f06f] text-[#07503f] font-bold text-xs md:text-sm tracking-wide uppercase transition-all shadow-lg shadow-black/25 flex items-center space-x-2 group active:scale-95"
              >
                <span>Launch Crop Advisor</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setActiveTab('priceTrends')}
                className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-[#f1efdf] border border-white/20 font-medium text-xs md:text-sm tracking-wide transition-all flex items-center space-x-2 active:scale-95"
              >
                <TrendingUp size={16} className="text-[#e8fe85]" />
                <span>Mandi Prices</span>
              </button>

              <button
                onClick={() => setActiveTab('weather')}
                className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-[#f1efdf] border border-white/20 font-medium text-xs md:text-sm tracking-wide transition-all flex items-center space-x-2 active:scale-95"
              >
                <CloudRain size={16} className="text-[#e8fe85]" />
                <span>Weather Intelligence</span>
              </button>
            </div>
          </div>

          {/* Right: Interactive 3D Holographic Card & Perspective Mesh */}
          <div className="lg:col-span-5 flex justify-center">
            <motion.div
              style={{
                rotateX: cardRotateX,
                rotateY: cardRotateY,
                transformStyle: 'preserve-3d',
              }}
              animate={{
                rotateX: currentCamConfig.rotateX,
                rotateY: currentCamConfig.rotateY,
                scale: currentCamConfig.scale,
              }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[320px] aspect-[4/5] rounded-[30px] bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border border-white/25 shadow-[0_30px_70px_rgba(0,0,0,0.5)] p-6 flex flex-col justify-between preserve-3d"
            >
              {/* 3D Floating Element 1 - Top Tag */}
              <div 
                style={{ transform: 'translateZ(35px)' }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-[#e8fe85] flex items-center justify-center text-[#07503f] font-bold shadow-md">
                    <Sprout size={16} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white uppercase tracking-wider">
                      {farmView?.crops?.[0]?.name || 'Target Crop'}
                    </div>
                    <div className="text-[10px] text-white/60">
                      {farmView?.farm?.name || 'Assigned Plot'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest text-[#e8fe85] font-mono font-bold bg-[#e8fe85]/20 px-2 py-0.5 rounded-full border border-[#e8fe85]/30">
                    STAGE {farmView?.crops?.[0] ? 'ACTIVE' : 'READY'}
                  </span>
                </div>
              </div>

              {/* 3D Floating Element 2 - Center Core Metrics with 3D Depth */}
              <div 
                style={{ transform: 'translateZ(55px)' }}
                className="my-auto space-y-4 py-4"
              >
                {activeCam === 'soil' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-3"
                  >
                    <div className="text-xs uppercase tracking-wider text-[#e8fe85] font-mono flex items-center space-x-1.5">
                      <Layers size={13} />
                      <span>Subsurface Chemistry</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="p-2.5 rounded-2xl bg-black/30 border border-white/10">
                        <div className="text-[10px] text-white/60">Soil Class</div>
                        <div className="text-xs font-bold text-white truncate">{farmView.farm?.soilType || 'Black Loam'}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-black/30 border border-white/10">
                        <div className="text-[10px] text-white/60">Irrigation</div>
                        <div className="text-xs font-bold text-white capitalize">{farmView.farm?.irrigationType || 'Drip'}</div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-emerald-950/50 border border-emerald-400/20 text-xs flex items-center justify-between">
                      <span className="text-white/80">Hydraulic Moisture</span>
                      <span className="font-mono font-bold text-[#e8fe85]">Optimal 28%</span>
                    </div>
                  </motion.div>
                )}

                {activeCam === 'canopy' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-3"
                  >
                    <div className="text-xs uppercase tracking-wider text-[#e8fe85] font-mono flex items-center space-x-1.5">
                      <CloudRain size={13} />
                      <span>Microclimate Horizon</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/10">
                      <div>
                        <div className="text-2xl font-serif font-bold text-white">
                          {weather?.temp ? `${Math.round(weather.temp)}°C` : '27°C'}
                        </div>
                        <div className="text-[10px] text-white/60 capitalize">
                          {weather?.condition || 'Clear Sky'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-[#e8fe85]">
                          {weather?.humidity ?? 62}% RH
                        </div>
                        <div className="text-[10px] text-white/50">Vapor Deficit</div>
                      </div>
                    </div>
                    <div className="p-2 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-white/80 flex items-center justify-between">
                      <span>Daily ET₀ Potential</span>
                      <span className="font-mono text-[#e8fe85]">4.6 mm/day</span>
                    </div>
                  </motion.div>
                )}

                {activeCam === 'yield' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-3"
                  >
                    <div className="text-xs uppercase tracking-wider text-[#e8fe85] font-mono flex items-center space-x-1.5">
                      <Activity size={13} />
                      <span>Phenology GDD Engine</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-black/30 border border-white/10 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/70">Growing Degree Days</span>
                        <span className="font-mono font-bold text-[#e8fe85]">680 / 1250</span>
                      </div>
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#e8fe85] h-full rounded-full w-[54%]" />
                      </div>
                    </div>
                    <div className="p-2 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-white/80 flex items-center justify-between">
                      <span>Harvest Trajectory</span>
                      <span className="text-[#e8fe85] font-bold">On Schedule</span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 3D Floating Element 3 - Bottom Footer */}
              <div 
                style={{ transform: 'translateZ(30px)' }}
                className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/60 font-mono"
              >
                <span>SENSORS: ONLINE</span>
                <span className="text-[#e8fe85] flex items-center">
                  <ShieldCheck size={12} className="mr-1" /> GROUNDED
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Horizon Status Bar */}
        <div className="relative z-20 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-white/70 font-sans">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />
              {weather?.location || farmView?.farm?.district || 'India Agri Grid'}
            </span>
            <span className="hidden sm:inline text-white/30">•</span>
            <span className="hidden sm:inline">
              FARM: {farmView?.fullName || user?.name || 'Registered Farmer'}
            </span>
          </div>

          <div className="text-[11px] font-mono text-[#e8fe85] tracking-wide">
            {currentCamConfig.sub}
          </div>
        </div>
      </section>

      {/* 2. MANDILENS-CLASS DATA INTEGRITY & PLATFORM TELEMETRY TICKER */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Dataset Health',
            value: '88,940',
            sub: 'Verified AGMARKNET Records',
            color: 'bg-[#d0e6f6]',
            textColor: 'text-sky-950',
            icon: Globe2
          },
          {
            label: 'Weather Stations',
            value: '121 Mandis',
            sub: 'IMD + NASA POWER Fused',
            color: 'bg-[#f8d4c8]',
            textColor: 'text-orange-950',
            icon: CloudRain
          },
          {
            label: 'Grounded Protocols',
            value: '100% ICAR',
            sub: 'Peer-Reviewed Scientific Rules',
            color: 'bg-[#d9e2d5]',
            textColor: 'text-emerald-950',
            icon: FileCheck
          },
          {
            label: 'Platform SLA',
            value: 'Zero-Fill Ban',
            sub: 'Gaps Render Honest Nulls',
            color: 'bg-[#d5d8db]',
            textColor: 'text-stone-900',
            icon: ShieldCheck
          }
        ].map((item, idx) => (
          <div
            key={idx}
            className={`${item.color} p-5 rounded-[24px] ${item.textColor} flex flex-col justify-between transition-transform hover:-translate-y-1 duration-200 border border-black/5 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                {item.label}
              </span>
              <item.icon size={16} className="opacity-70" />
            </div>
            <div>
              <div className="font-serif text-2xl md:text-3xl font-bold tracking-tight">
                {item.value}
              </div>
              <div className="text-[11px] font-medium opacity-80 mt-1">
                {item.sub}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 3. ACTIVE FARMER CONTEXT & TASK-FIRST ACTION LAUNCHPAD */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Farmer Profile Brief / Quick Onboarding invitation */}
        <div className="md:col-span-5 bg-[#faf9f2] border border-[#e2dfcb] rounded-[28px] p-6 text-stone-900 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-stone-200/80">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#07503f] text-[#f1efdf] flex items-center justify-center font-bold text-sm shadow">
                  {user?.name?.charAt(0) || 'F'}
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900">
                    {user?.name || 'Registered Farm'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {farmView?.farm?.district ? `${farmView.farm.district}, ${farmView.farm.state}` : 'Location unconfigured'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('profile')}
                className="text-xs font-semibold text-[#07503f] hover:underline"
              >
                Settings
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500 font-medium">Field Area:</span>
                <span className="font-semibold text-stone-800">{farmView?.farm?.fieldSizeAcres || 3.0} Acres</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500 font-medium">Active Crop:</span>
                <span className="font-semibold text-emerald-800">{farmView?.crops?.[0]?.name || 'Tomato (Abhinav)'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500 font-medium">Soil Type:</span>
                <span className="font-semibold text-stone-800">{farmView?.farm?.soilType || 'Black Loam'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500 font-medium">Irrigation:</span>
                <span className="font-semibold text-stone-800 capitalize">{farmView?.farm?.irrigationType || 'Drip'}</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenOnboarding}
              className="w-full py-2.5 rounded-full bg-[#07503f]/10 hover:bg-[#07503f]/15 text-[#07503f] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2"
            >
              <UserCheck size={14} />
              <span>Update Farm Parameters</span>
            </button>
          </div>
        </div>

        {/* Right: Task-First Feature Launchpad */}
        <div className="md:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-serif text-xl font-bold text-stone-100">
              Agronomic Command Services
            </h2>
            <span className="text-[11px] font-mono text-stone-400">
              TASK-FIRST SYSTEM
            </span>
          </div>

          {/* Service Card 1: AI Advisor */}
          <button
            onClick={() => setActiveTab('advisor')}
            className="w-full text-left p-5 rounded-[24px] bg-dark-card hover:bg-stone-900 border border-dark-border hover:border-[#07503f] transition-all flex items-center justify-between group shadow-md"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-[#07503f]/20 border border-[#07503f]/30 flex items-center justify-center text-[#e8fe85] group-hover:scale-105 transition-transform">
                <Sprout size={24} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-stone-100 text-base">
                    Personalized Crop Advisor
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#07503f] text-[#e8fe85] uppercase">
                    Core AI
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  GDD trajectory, soil NPK balancing, growth-stage specific irrigation, and ICAR advisory.
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-stone-500 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Service Card 2: Mandi Price Trends */}
          <button
            onClick={() => setActiveTab('priceTrends')}
            className="w-full text-left p-5 rounded-[24px] bg-dark-card hover:bg-stone-900 border border-dark-border hover:border-emerald-500/50 transition-all flex items-center justify-between group shadow-md"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <TrendingUp size={24} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-stone-100 text-base">
                    Mandi Price Trends & Intelligence
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/60 text-emerald-300 uppercase">
                    Live Agmarknet
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  Real APMC modal prices, unit conversions (₹/qtl & ₹/kg), AI market insights, crop margin & storage estimators.
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-stone-500 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Service Card 3: Weather */}
          <button
            onClick={() => setActiveTab('weather')}
            className="w-full text-left p-5 rounded-[24px] bg-dark-card hover:bg-stone-900 border border-dark-border hover:border-cyan-500/50 transition-all flex items-center justify-between group shadow-md"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <CloudRain size={24} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-stone-100 text-base">
                    Microclimate Intelligence
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-900/60 text-cyan-300 uppercase">
                    3-Way Fusion
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  Open-Meteo, NASA POWER, and IMD confidence scores across a 7-day agricultural horizon.
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-stone-500 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Service Card 3: Government Schemes */}
          <button
            onClick={() => setActiveTab('advisor')}
            className="w-full text-left p-5 rounded-[24px] bg-dark-card hover:bg-stone-900 border border-dark-border hover:border-emerald-500/50 transition-all flex items-center justify-between group shadow-md"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Sparkles size={24} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-stone-100 text-base">
                    Subsidies & Central Schemes
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/60 text-emerald-300 uppercase">
                    Direct Benefit
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  PM-KISAN, PMFBY Crop Insurance, Soil Health Card Scheme, and Micro-Irrigation grants.
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-stone-500 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  );
};
