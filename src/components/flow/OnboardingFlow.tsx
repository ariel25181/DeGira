import React, { useState } from 'react';
import {
  Wine,
  Music,
  Ticket,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  User,
  Building,
  HelpCircle,
  ShieldCheck,
  Zap,
  Share2,
  Wrench,
  X,
  Key,
  Copy,
  Check,
} from 'lucide-react';
import { useSession } from '../../context/SessionContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { TOUR, TourStep } from '../../content/tour.ts';
import { UserRole } from '../../types/index.ts';
import { saveActiveSession } from '../../lib/degiraSession.ts';
import {
  TEST_ACCOUNTS,
  findTestAccountByEmail,
  validateTestAccountPassword,
  TestAccount,
} from '../../data/testAccounts.ts';

interface OnboardingFlowProps {
  onComplete: (role: UserRole) => void;
  initialRole?: UserRole;
  startAtTour?: boolean;
  onOpenShare?: () => void;
  onOpenFeedback?: () => void;
  onClose?: () => void;
}

type FlowStep = 'profile_select' | 'auth' | 'tour';

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  initialRole,
  startAtTour = false,
  onOpenShare,
  onOpenFeedback,
  onClose,
}) => {
  const { signIn, signUp, state } = useSession();
  let setUserDisplayName: ((name: string) => void) | undefined;
  let loginAsAccount: ((acc: TestAccount) => void) | undefined;
  try {
    const app = useApp();
    setUserDisplayName = app.setUserDisplayName;
    loginAsAccount = app.loginAsAccount;
  } catch {
    // Safe fallback if mounted without AppProvider in isolated unit tests
  }

  // Role in terms of UserRole: 'bar' | 'musico' | 'espectador'
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole || 'musico');
  const [step, setStep] = useState<FlowStep>(startAtTour ? 'tour' : 'profile_select');

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember24h, setRemember24h] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Tour state
  const [tourIndex, setTourIndex] = useState(0);

  // Map user role to tour audience key
  const audienceKey = selectedRole === 'bar' ? 'anfitrion' : selectedRole === 'musico' ? 'musico' : 'publico';
  const tourSteps: TourStep[] = TOUR[audienceKey] || TOUR.musico;

  // Handler for Role Selection (Step 1)
  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setAuthError(null);
    setStep('auth');
  };

  // Handler for Auth Submission (Step 2)
  const handleAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setAuthError('Por favor completá tu email y contraseña.');
      return;
    }
    if (password.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    // 1. Check if email belongs to a pre-configured test account
    const testAccount = findTestAccountByEmail(email);
    if (testAccount) {
      if (!validateTestAccountPassword(testAccount, password)) {
        setAuthError(
          `Contraseña incorrecta para ${testAccount.displayName}. La contraseña configurada es "${testAccount.password}" (o la universal "degira2026").`
        );
        setAuthLoading(false);
        return;
      }

      // Valid test account
      if (loginAsAccount) {
        loginAsAccount(testAccount);
      } else {
        if (setUserDisplayName) setUserDisplayName(testAccount.displayName);
        saveActiveSession({
          role: testAccount.role,
          userName: testAccount.displayName,
          userEmail: testAccount.email,
          remember24h,
        });
      }
      setSelectedRole(testAccount.role);
      setAuthLoading(false);
      setTourIndex(0);
      setStep('tour');
      return;
    }

    // 2. Otherwise try standard auth
    try {
      const err = authMode === 'login'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

      if (err) {
        setAuthError(err);
        setAuthLoading(false);
      } else {
        // Success: record user name and move to Step 3 (Guided Tour)
        const nameToSave = displayName.trim() || email.split('@')[0];
        if (setUserDisplayName) setUserDisplayName(nameToSave);
        saveActiveSession({
          role: selectedRole,
          userName: nameToSave,
          userEmail: email.trim(),
          remember24h,
        });

        setAuthLoading(false);
        setTourIndex(0);
        setStep('tour');
      }
    } catch {
      // In case of network failure or demo environment, advance gracefully
      const nameToSave = displayName.trim() || email.split('@')[0] || (selectedRole === 'bar' ? 'Bar Test 1' : selectedRole === 'musico' ? 'Músico Test 1' : 'Usuario Público 1');
      if (setUserDisplayName) setUserDisplayName(nameToSave);
      saveActiveSession({
        role: selectedRole,
        userName: nameToSave,
        userEmail: email.trim() || `${selectedRole}@degira.com.ar`,
        remember24h,
      });

      setAuthLoading(false);
      setTourIndex(0);
      setStep('tour');
    }
  };

  // Quick fill or 1-tap login with test account
  const handleApplyTestAccount = (acc: TestAccount, autoLogin: boolean = false) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedRole(acc.role);
    setDisplayName(acc.displayName);
    setAuthMode('login');
    setAuthError(null);

    if (autoLogin) {
      if (loginAsAccount) {
        loginAsAccount(acc);
      } else {
        if (setUserDisplayName) setUserDisplayName(acc.displayName);
        saveActiveSession({
          role: acc.role,
          userName: acc.displayName,
          userEmail: acc.email,
          remember24h,
        });
      }
      setSelectedRole(acc.role);
      setTourIndex(0);
      setStep('tour');
    }
  };

  // Demo / Guest fast access
  const handleGuestOrDemoAccess = () => {
    const demoName = selectedRole === 'bar' ? 'Bar Test 1' : selectedRole === 'musico' ? 'Músico Test 1' : 'Usuario Público 1';
    const demoEmail = selectedRole === 'bar' ? 'bar1@degira.com.ar' : selectedRole === 'musico' ? 'musico1@degira.com.ar' : 'publico1@degira.com.ar';
    if (setUserDisplayName) setUserDisplayName(demoName);
    saveActiveSession({
      role: selectedRole,
      userName: demoName,
      userEmail: demoEmail,
      remember24h,
    });

    setTourIndex(0);
    setStep('tour');
  };

  // Handler for Tour Completion (Step 3 -> Step 4)
  const handleFinishTour = () => {
    onComplete(selectedRole);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">

        {/* Top Progress indicator bar with quick actions */}
        <div className="px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 gap-2">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              DeGira • Bienvenida
            </span>

            {/* Quick utility buttons: Compartir and Feedback */}
            <div className="flex items-center gap-1.5">
              {onOpenShare && (
                <button
                  type="button"
                  onClick={onOpenShare}
                  aria-label="Compartir app"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-[11px] font-bold transition-all active:scale-95"
                  title="Compartir DeGira con amigos o músicos"
                >
                  <Share2 className="w-3 h-3 stroke-[2.2]" />
                  <span>Compartir</span>
                </button>
              )}

              {onOpenFeedback && (
                <button
                  type="button"
                  onClick={onOpenFeedback}
                  aria-label="Reportar bug o enviar feedback"
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                  title="Reportar bug, sugerir mejora o dar feedback"
                >
                  <Wrench className="w-3.5 h-3.5" />
                </button>
              )}

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar ventana"
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors ml-1"
                  title="Cerrar y continuar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <span className="font-medium text-slate-400 hidden sm:inline ml-1">
                {step === 'profile_select' && 'Paso 1 de 3: Selección de Perfil'}
                {step === 'auth' && 'Paso 2 de 3: Ingreso a la Cuenta'}
                {step === 'tour' && `Paso 3 de 3: Tour Guiado (${tourIndex + 1}/${tourSteps.length})`}
              </span>
            </div>
          </div>

          <div className="flex gap-1.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                step === 'profile_select' ? 'w-1/3 bg-amber-400' :
                step === 'auth' ? 'w-2/3 bg-amber-400' : 'w-full bg-amber-400'
              }`}
            />
          </div>
        </div>

        {/* STEP 1: PERFIL SELECTION */}
        {step === 'profile_select' && (
          <div className="p-6 sm:p-7 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-lg shadow-amber-500/20 group relative">
                <img
                  src="./icons/degira-van.jpg"
                  alt="DeGira Camioneta VW Hippie Años 60"
                  className="w-full h-full object-cover"
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                ¿Cómo vas a ingresar a DeGira?
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Elegí tu perfil para personalizar la cartelera, convocatorias de bares y opciones de navegación.
              </p>
            </div>

            <div className="space-y-3">
              {/* Option 1: Anfitrión de Bar */}
              <button
                onClick={() => handleSelectRole('bar')}
                className="w-full group text-left p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-amber-500/60 transition-all duration-200 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
                  <Wine className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                      Soy Anfitrión de Bar
                    </h2>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Locales
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Tengo un bar, restaurante o sala en Buenos Aires y quiero programar bandas en vivo, publicar convocatorias y gestionar pagos protegidos.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 self-center" />
              </button>

              {/* Option 2: Músico o Banda */}
              <button
                onClick={() => handleSelectRole('musico')}
                className="w-full group text-left p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-amber-500/60 transition-all duration-200 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
                  <Music className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                      Soy Músico o Banda
                    </h2>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Artistas
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Quiero encontrar fechas para tocar, postularme a convocatorias con cachet garantizado, ofrecer mi disponibilidad y cobrar seguro.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 self-center" />
              </button>

              {/* Option 3: Público General */}
              <button
                onClick={() => handleSelectRole('espectador')}
                className="w-full group text-left p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-amber-500/60 transition-all duration-200 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-purple-500/20 shrink-0 group-hover:scale-105 transition-transform">
                  <Ticket className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                      Soy Público General
                    </h2>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      Espectadores
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Quiero descubrir los mejores recitales en vivo en la Ciudad de Buenos Aires, filtrar por barrio y género, y reservar mesas.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 self-center" />
              </button>
            </div>

            {/* Banner destacado: Compartir la App con otros usuarios */}
            <div className="pt-2">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-950/80 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
                <div className="flex items-center gap-3 text-left w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
                    <Share2 className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <span>¿Querés invitar a tu banda, colegas o un bar?</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Compartí el enlace por WhatsApp, Telegram, X o código QR
                    </p>
                  </div>
                </div>

                {onOpenShare && (
                  <button
                    type="button"
                    onClick={onOpenShare}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all shrink-0 active:scale-95"
                  >
                    <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Compartir app</span>
                  </button>
                )}
              </div>
            </div>

            {/* Acciones secundarias: explorar sin configurar y feedback */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
              <button
                type="button"
                onClick={() => handleSelectRole('espectador')}
                className="hover:text-amber-400 transition-colors flex items-center gap-1 font-medium"
              >
                <span>Explorar cartelera sin cuenta</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              {onOpenFeedback && (
                <button
                  type="button"
                  onClick={onOpenFeedback}
                  className="hover:text-amber-400 flex items-center gap-1 transition-colors text-slate-400 font-medium"
                >
                  <Wrench className="w-3 h-3" />
                  <span>Reportar bug / Feedback</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: CREAR CUENTA O INICIAR SESIÓN */}
        {step === 'auth' && (
          <div className="p-6 sm:p-7 space-y-5">
            {/* Back button & Role header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('profile_select')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Cambiar perfil
              </button>
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
                {selectedRole === 'bar' && <Wine className="w-3.5 h-3.5 text-amber-400" />}
                {selectedRole === 'musico' && <Music className="w-3.5 h-3.5 text-amber-400" />}
                {selectedRole === 'espectador' && <Ticket className="w-3.5 h-3.5 text-purple-400" />}
                <span className="font-bold text-slate-200">
                  {selectedRole === 'bar' ? 'Anfitrión de Bar' : selectedRole === 'musico' ? 'Músico o Banda' : 'Público General'}
                </span>
              </div>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-xl font-black text-slate-100 tracking-tight">
                {authMode === 'login' ? 'Iniciar Sesión en DeGira' : 'Crear tu Cuenta en DeGira'}
              </h2>
              <p className="text-xs text-slate-400">
                {authMode === 'login'
                  ? 'Ingresá con tu correo para acceder a tu panel de actividades.'
                  : 'Registrate para gestionar fechas, acuerdos y calificaciones verificadas.'}
              </p>
            </div>

            {/* Mode switch tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  authMode === 'login'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Ya tengo cuenta
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  authMode === 'signup'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Crear nueva cuenta
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {selectedRole === 'bar' ? 'Nombre del Bar o Sala' : selectedRole === 'musico' ? 'Nombre Artístico / Banda' : 'Nombre Completo'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      {selectedRole === 'bar' ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <input
                      type="text"
                      required={authMode === 'signup'}
                      placeholder={selectedRole === 'bar' ? 'Ej: Bar Test 1' : selectedRole === 'musico' ? 'Ej: Músico Test 1' : 'Ej: Usuario Público 1'}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-500 outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="tunombre@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Opción permanecer logueado (24hs) */}
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 py-1 select-none">
                <input
                  type="checkbox"
                  checked={remember24h}
                  onChange={(e) => setRemember24h(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 accent-amber-500"
                />
                <span className="font-medium text-slate-300">
                  Quiero permanecer logueado (duración 24 horas)
                </span>
              </label>

              {authError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <span>Conectando con DeGira…</span>
                ) : (
                  <>
                    <span>{authMode === 'login' ? 'Ingresar a mi Cuenta' : 'Crear Cuenta y Continuar'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access / Continue as Guest */}
            <div className="pt-2 border-t border-slate-800 text-center space-y-2">
              {selectedRole === 'espectador' ? (
                <button
                  type="button"
                  onClick={handleGuestOrDemoAccess}
                  className="w-full py-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-xs font-bold text-slate-200 transition-colors"
                >
                  Continuar como Espectador Invitado (Sin contraseña)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGuestOrDemoAccess}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                >
                  ⚡ Ingreso rápido de demostración ({selectedRole === 'bar' ? 'Modo Bar' : 'Modo Músico'})
                </button>
              )}
            </div>

            {/* DIRECTORY OF TEST ACCOUNTS FOR EASY CREDENTIAL TESTING */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cuentas y Contraseñas de Prueba</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  (Clic para rellenar o entrar directo)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {TEST_ACCOUNTS.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 flex items-center justify-between gap-2 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={acc.avatarUrl}
                        alt={acc.displayName}
                        className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-800"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-xs text-slate-200 font-bold truncate">
                            {acc.displayName}
                          </strong>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                              acc.role === 'bar'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : acc.role === 'musico'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {acc.role === 'bar' ? 'Bar' : acc.role === 'musico' ? 'Músico' : 'Público'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          <span className="text-slate-300">{acc.email}</span> • Pass:{' '}
                          <span className="text-amber-300 font-bold">{acc.password}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApplyTestAccount(acc, false)}
                        title="Rellenar campos de login"
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors"
                      >
                        Rellenar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTestAccount(acc, true)}
                        title="Ingresar directamente con esta cuenta"
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <span>Entrar</span>
                        <ArrowRight className="w-3 h-3 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: GUIDED TOUR FOR THE SELECTED ROLE */}
        {step === 'tour' && (
          <div className="p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Tour Guiado: {selectedRole === 'bar' ? 'Anfitrión de Bar' : selectedRole === 'musico' ? 'Músico o Banda' : 'Público General'}
              </span>
              <button
                onClick={handleFinishTour}
                className="text-xs text-slate-400 hover:text-slate-200 font-semibold"
              >
                Saltar tour
              </button>
            </div>

            {/* Card for current step */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-inner">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-4xl shadow-md">
                {tourSteps[tourIndex]?.emoji || '🎵'}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-100 tracking-tight">
                  {tourSteps[tourIndex]?.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
                  {tourSteps[tourIndex]?.body}
                </p>
              </div>

              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {tourSteps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTourIndex(idx)}
                    aria-label={`Ir al paso ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === tourIndex
                        ? 'w-6 bg-amber-400'
                        : idx < tourIndex
                        ? 'w-2 bg-amber-500/50'
                        : 'w-2 bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={tourIndex === 0}
                onClick={() => setTourIndex((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-bold text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>

              {tourIndex < tourSteps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTourIndex((prev) => Math.min(tourSteps.length - 1, prev + 1))}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Siguiente paso</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishTour}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <span>¡Ver menú de actividades! 🚀</span>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
