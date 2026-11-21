import React, { useState, useEffect, useRef, useMemo, useDeferredValue, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { i18n } from './lib/i18n';
import BookingForm from './components/BookingForm';
import DataTable from './components/DataTable';
import QueueCalendar from './components/QueueCalendar';
import StockManager from './components/StockManager';
import UserAdminManager from './components/UserAdminManager';
import ReportPrinter from './components/ReportPrinter';
import OwingMedPanel from './components/OwingMedPanel';
import DatabaseMaintenance from './components/DatabaseMaintenance';
import PriceEstimation from './components/PriceEstimation';
import RoleInstructionTab from './components/RoleInstructionTab';
import LoadingSpinner from './components/LoadingSpinner';
import BHPLogo from './components/BHPLogo';
import { Booking, UserRole } from './types';
import {
  Activity,
  Calendar,
  Layers,
  FileSpreadsheet,
  Users,
  History,
  LogOut,
  Globe,
  Bell,
  X,
  FileCheck,
  Shield,
  HelpCircle,
  PlusCircle,
  Clock,
  AlertCircle,
  Database,
  Calculator,
  BookOpen,
  Search,
  Printer,
  Edit,
  ArrowRight
} from 'lucide-react';

function DashboardLayout() {
  const {
    currentUser,
    alerts,
    language,
    setLanguage,
    logout,
    loading,
    clearAlerts,
    bookings,
    drugs,
    owingMeds,
    users,
    fetchUsers,
    soundEnabled,
    setSoundEnabled
  } = useApp();

  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      fetchUsers();
    }
  }, [currentUser]);

  const formatDateToDMY = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
      return dateStr;
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}-${month}-${year}`;
    }
    return dateStr;
  };

  const t = i18n[language];

  // Calculate unprepared upcoming bookings for Stock Clerk / Admin notification triggers
  const todayStr = new Date().toISOString().split('T')[0];

  const getDefaultTabForRole = (role?: UserRole) => {
    return role === 'Nurse' ? 'booking' : 'dashboard';
  };

  // Active UI Navigation Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'calendar' | 'stocks' | 'users' | 'reports' | 'logs' | 'owing' | 'maintenance' | 'estimation' | 'guide'>(() =>
    getDefaultTabForRole(currentUser?.role)
  );

  // Sync default landing page whenever logged-in user changes (REQ-02)
  useEffect(() => {
    if (currentUser) {
      setActiveTab(getDefaultTabForRole(currentUser.role));
    }
  }, [currentUser?.id, currentUser?.role]);

  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResetTabNonce, setSearchResetTabNonce] = useState(0);

  // Booking parameter state for Editing sequence
  const [editingBookingId, setEditingBookingId] = useState<string | undefined>(undefined);
  // Printing parameter state for Single Slip
  const [printingBooking, setPrintingBooking] = useState<Booking | null>(null);

  // Helper toggle for system alert drawer dropdown
  const [showAlertMenu, setShowAlertMenu] = useState(false);

  const canQuickEditFromSearch =
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'Pharmacist' ||
    currentUser?.role === 'Nurse' ||
    currentUser?.role === 'Doctor';

  const handleOpenBookingFromSearch = useCallback((booking: Booking) => {
    setGlobalSearchQuery(booking.hn || booking.patientName);
    setSearchResetTabNonce((n) => n + 1);
    setActiveTab('dashboard');
  }, []);

  const handleSubmitHeaderSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    setGlobalSearchQuery(q);
    setSearchResetTabNonce((n) => n + 1);
    setActiveTab('dashboard');
  }, []);

  const handleFocusHeaderSearch = useCallback(() => {
    setShowAlertMenu(false);
  }, []);

  const handleAlertClick = (al: any) => {
    if (al.hn) {
      setGlobalSearchQuery(al.hn);
      setSearchResetTabNonce((n) => n + 1);
      setActiveTab('dashboard');
      setShowAlertMenu(false);
    }
  };

  // Handle edit reservation sequence
  const triggerEdit = useCallback((id: string) => {
    setEditingBookingId(id);
    setActiveTab('booking');
  }, []);

  // Handle print slip sequence
  const triggerPrintSingle = useCallback((booking: Booking) => {
    setPrintingBooking(booking);
  }, []);

  // Safe reset when tab switches
  useEffect(() => {
    if (activeTab !== 'booking') {
      setEditingBookingId(undefined);
    }
    if (activeTab !== 'reports') {
      setPrintingBooking(null);
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 flex flex-col font-sans">
      {/* Dynamic Loading Overlay */}
      {loading && <LoadingSpinner />}

      {/* Main App Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-3 md:px-6 py-2 md:py-3.5 flex items-center justify-between print:hidden">
        {/* Brand identity */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <BHPLogo className="h-9 hidden md:block" />
          <div className="h-7 w-px bg-slate-200 hidden md:block"></div>
          <div>
            <h1 className="text-sm md:text-base font-black tracking-tight text-blue-900 leading-none">
              {t.appName}
            </h1>
            <span className="text-[8px] md:text-[9px] text-slate-400 font-bold tracking-wider uppercase block mt-0.5 md:mt-1">
              {language === 'TH' ? 'ระบบจองและสำรองยา' : 'Medication Reservation'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end min-w-0 ml-2">
          {/* Dual language picker */}
          <div className="flex bg-slate-50 p-0.5 md:p-1 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => setLanguage('TH')}
              className={`px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-semibold rounded transition-all ${
                language === 'TH' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400 font-medium hover:text-slate-700'
              }`}
            >
              TH
            </button>
            <button
              onClick={() => setLanguage('EN')}
              className={`px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-semibold rounded transition-all ${
                language === 'EN' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400 font-medium hover:text-slate-700'
              }`}
            >
              EN
            </button>
          </div>

          {/* Persistent Unified Global Booking Search Bar (next to Notification Bell) */}
          {currentUser && (
            <HeaderGlobalSearch
              bookings={bookings}
              language={language}
              isDashboardActive={activeTab === 'dashboard'}
              externalQuery={globalSearchQuery}
              canQuickEdit={canQuickEditFromSearch}
              formatDateToDMY={formatDateToDMY}
              onFocusSearch={handleFocusHeaderSearch}
              onDashboardSearchChange={setGlobalSearchQuery}
              onSelectBooking={handleOpenBookingFromSearch}
              onSubmitSearch={handleSubmitHeaderSearch}
              onPrintBooking={triggerPrintSingle}
              onEditBooking={triggerEdit}
            />
          )}

          {/* Alarm Notification Bells bell dropdown list */}
          {currentUser && (
            <div className="relative shrink-0">
              <button
                id="header-notification-bell"
                onClick={() => {
                  setShowAlertMenu(!showAlertMenu);
                }}
                className="p-1.5 md:p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition-all relative cursor-pointer"
                title="System Notifications"
              >
                <Bell className="w-3.5 h-3.5 md:w-4 md:h-4 animate-pulse" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold font-mono">
                    {alerts.length}
                  </span>
                )}
              </button>

              {showAlertMenu && (
                <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden py-1">
                  {/* Title & Preferences header */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200/60 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">Real-time alerts ({alerts.length})</span>
                      {alerts.length > 0 && (
                        <button
                          onClick={clearAlerts}
                          className="text-[10px] text-red-500 hover:underline cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-red-50 font-semibold"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    {/* Preferences Controls panel */}
                    <div className="pt-2 border-t border-slate-200/60 flex justify-center">
                      <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`flex items-center justify-center gap-1.5 py-1 px-4 w-full rounded-md border text-[10px] font-bold transition-all cursor-pointer ${
                          soundEnabled
                            ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-xs'
                            : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="Toggle Notification Sound Clink"
                      >
                        {soundEnabled ? '🔊 Notification Sound: ON' : '🔇 Notification Sound: OFF'}
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-[11px] text-slate-600 custom-mini-scroll">
                    {alerts.length === 0 ? (
                      <div className="py-6 px-4 text-center text-slate-400">
                        <span className="text-lg block mb-1">🔔</span>
                        All channels clear. No active alerts.
                      </div>
                    ) : (
                      alerts.map((al) => (
                        <div
                          key={al.id}
                          onClick={() => handleAlertClick(al)}
                          className={`p-3 space-y-1 transition-all duration-150 ${
                            al.hn
                              ? 'hover:bg-blue-50/55 cursor-pointer hover:text-blue-800'
                              : 'hover:bg-slate-50'
                          }`}
                          title={al.hn ? `Click to inspect HN: ${al.hn}` : undefined}
                        >
                          <p className="font-medium text-slate-800 flex items-start gap-1 leading-relaxed">
                            {al.hn && <span className="text-xs shrink-0 select-none">🔍</span>}
                            <span>{al.message}</span>
                          </p>
                          <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono tracking-tight gap-1.5 flex-wrap">
                            <span>{al.timestamp}</span>
                            {al.hn && (
                              <span className="text-[8.5px] text-blue-600 bg-blue-50 font-sans font-bold px-1.5 py-0.2 rounded border border-blue-100 uppercase tracking-wider block">
                                Link: {al.hn}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Signin profile chip */}
          <div className="flex items-center gap-2 md:gap-3 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-1 md:px-3 md:py-1.5 text-xs text-slate-600 shrink-0">
            <div className="w-6 h-6 md:w-7 md:h-7 bg-blue-600 rounded-md md:rounded-lg flex items-center justify-center text-white text-[10px] md:text-xs font-bold shadow-xs">
              {currentUser?.name[0]}
            </div>
            <div className="hidden md:block text-left font-sans">
              <p className="font-bold text-slate-800 text-xs">{currentUser?.name}</p>
              <span className="text-[10px] text-slate-500 uppercase font-mono">{currentUser?.role}</span>
            </div>
          </div>

          {/* Logout anchor */}
          <button
            onClick={logout}
            className="p-1.5 md:p-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/40 rounded-lg md:rounded-xl transition-all cursor-pointer shrink-0"
            title={t.logout}
          >
            <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
          </button>
        </div>
      </header>

      {/* Grid structure main content body layout */}
      <div className="flex-1 flex flex-col md:flex-row pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        {/* Sidebar Navigation Drawer (Desktop) */}
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col py-6 justify-between print:hidden shrink-0">
          <div className="space-y-4 px-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-3">
              Navigation Menu ({currentUser?.role})
            </p>

            <nav className="space-y-1 font-sans">
              <button
                onClick={() => setActiveTab('booking')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'booking'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                {t.navBooking}
              </button>

              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                {t.navDashboard}
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" />
                {t.navCalendar}
              </button>

              <button
                onClick={() => setActiveTab('stocks')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'stocks'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileCheck className="w-4 h-4 shrink-0" />
                {t.navStocks}
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                {t.reportsTitle}
              </button>

              {(currentUser?.role === 'Admin' ||
                currentUser?.role === 'Pharmacist' ||
                currentUser?.role === 'Nurse' ||
                currentUser?.role === 'Doctor') && (
                <button
                  onClick={() => setActiveTab('estimation')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'estimation'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Calculator className="w-4 h-4 shrink-0" />
                  {t.navEstimation}
                </button>
              )}

              {(currentUser?.role === 'Pharmacist' ||
                currentUser?.role === 'Pharmacist Assistant' ||
                currentUser?.role === 'Pharmacy Stock Clerk' ||
                currentUser?.role === 'Nurse' ||
                currentUser?.role === 'Admin') && (
                <button
                  onClick={() => setActiveTab('owing')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'owing'
                      ? 'bg-rose-50 text-rose-700 border border-rose-100/30'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 shrink-0 font-bold" />
                    <span>{language === 'TH' ? 'รายการยาค้างส่ง' : 'Owings List'}</span>
                  </div>
                  {owingMeds.filter(om => !om.resolved).length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black font-mono px-1.5 py-0.5 rounded-full animate-pulse">
                      {owingMeds.filter(om => !om.resolved).length}
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={() => setActiveTab('guide')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'guide'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                {language === 'TH' ? 'คู่มือใช้งานตาม Role' : 'Role Guide'}
              </button>

              {/* Admin clearance links */}
              {currentUser?.role === 'Admin' && (
                <>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 pt-6 px-3">
                    System Administration
                  </p>

                  <button
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      activeTab === 'users'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    {t.navUsers}
                  </button>

                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      activeTab === 'logs'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <History className="w-4 h-4 shrink-0" />
                    {t.navLogs}
                  </button>

                  <button
                    onClick={() => setActiveTab('maintenance')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      activeTab === 'maintenance'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Database className="w-4 h-4 shrink-0" />
                    {language === 'TH' ? 'จัดการฐานข้อมูล' : 'Data Maintenance'}
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* User Detail footer chip inside sidebar as seen in HTML design template */}
          <div className="mx-4 p-4 border-t border-slate-150 bg-slate-50/50 rounded-xl">
            <div className="flex items-center gap-3 font-sans">
              <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700">
                {currentUser?.name[0]}{currentUser?.name.split(' ')[1]?.[0] || ''}
              </div>
              <div className="flex flex-col overflow-hidden">
                <p className="text-xs font-semibold leading-none text-slate-800 truncate">{currentUser?.name}</p>
                <p className="text-[9px] text-slate-500 uppercase mt-1 tracking-wider font-bold truncate">
                  {currentUser?.role} • {currentUser?.username}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Modular Render Block Main view */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto min-w-0 space-y-4 md:space-y-6">
          {/* Clerk Actionable Unresolved Owings Banner */}
          {currentUser?.role === 'Pharmacy Stock Clerk' && owingMeds.some(om => !om.resolved) && (
            <div 
              id="clerk-unresolved-owings-banner"
              onClick={() => setActiveTab('owing')}
              className="bg-gradient-to-r from-amber-600 to-rose-600 border border-amber-500 rounded-2xl p-4 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 select-none animate-pulse print:hidden"
            >
              <div className="flex items-start gap-3.5">
                <div className="text-2xl p-2 bg-white/20 rounded-xl shrink-0">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide uppercase">
                    {language === 'TH' ? 'ด่วนที่สุด: มียาเวชภัณฑ์ค้างส่งในคลัง!' : 'URGENT: RESOLVE OWING MEDS IN STOCK'}
                  </h3>
                  <p className="text-xs text-amber-50 mt-1 font-semibold">
                    {language === 'TH'
                      ? `มีรายการค้างส่งยาค้างจ่ายของคนไข้ค้างจ่ายอยู่ ${owingMeds.filter(om => !om.resolved).length} รายการ กรุณานำส่งหรือกดตัดยอดเตรียมสต็อกด่วน`
                      : `Found ${owingMeds.filter(om => !om.resolved).length} active owing items waiting for dispatch prep. Click here to open the Owings Sourcing Desk.`}
                  </p>
                </div>
              </div>
              <button
                className="bg-white hover:bg-slate-100 text-amber-700 hover:text-rose-700 text-[10px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl shrink-0 transition-colors shadow-sm cursor-pointer"
              >
                {language === 'TH' ? 'เปิดศูนย์ค้างส่งยา' : 'OPERATE OWING DESK'}
              </button>
            </div>
          )}

          {/* Admin Pending Registration Alert Banner */}
          {currentUser?.role === 'Admin' && users.some(u => u.approved === false) && (
            <div 
              id="pending-users-alert-banner"
              onClick={() => setActiveTab('users')}
              className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 border-2 border-indigo-500 rounded-2xl p-5 shadow-2xl text-white space-y-3 cursor-pointer hover:shadow-xs transition-all animate-pulse relative overflow-hidden print:hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 animate-pulse"></div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/20 rounded-xl shrink-0 text-xl font-bold">
                  👤
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-black tracking-wide uppercase flex items-center gap-2">
                    {language === 'TH' ? 'แจ้งเตือน: มีการสมัครสมาชิกใหม่ค้างอนุมัติ!' : 'ALERT: PENDING STAFF REGISTRATIONS REQUIRING APPROVAL'}
                  </h3>
                  <p className="text-xs text-indigo-100 leading-relaxed mt-1 font-semibold">
                    {language === 'TH'
                      ? `พบพนักงานค้างอนุมัติในระบบจำนวน ${users.filter(u => u.approved === false).length} บัญชี กรุณาคลิกที่นี่เพื่อดำเนินการตรวจสอบและกดอนุมัติสิทธิ์การเข้าใช้งาน`
                      : `Found ${users.filter(u => u.approved === false).length} staff registrations pending verification clearance. Click here to open user catalog and authorize them.`}
                  </p>
                  <p className="text-[10px] text-blue-200 mt-1 font-mono font-bold hover:underline">
                    ➡️ {language === 'TH' ? 'คลิกเพื่อตัดไปยังหน้าการอนุมัติผู้ใช้หน้าอนุมัติทันที' : 'CLICK HERE TO CUT DIRECTLY TO APPROVAL CONTROL'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Admin Pending Drug Edit / Delete Alert Banner (REQ-16) */}
          {currentUser?.role === 'Admin' && drugs.some(d => d.editRequested || d.deleteRequested) && (
            <div
              id="pending-drug-edits-banner"
              onClick={() => setActiveTab('stocks')}
              className="bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-700 border-2 border-blue-400 rounded-2xl p-4 sm:p-5 shadow-xl text-white cursor-pointer hover:shadow-2xl transition-all relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-white/20 rounded-xl shrink-0 text-xl font-bold">
                  💊
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide uppercase">
                    {language === 'TH' ? 'แจ้งเตือน Admin: เภสัชกรแก้ไขข้อมูลยาในระบบ!' : 'ALERT: PHARMACIST DRUG CATALOG MODIFICATIONS PENDING REVIEW'}
                  </h3>
                  <p className="text-xs text-blue-100 mt-1 font-semibold">
                    {language === 'TH'
                      ? `มีรายการยาขอแก้ไข/ลบจำนวน ${drugs.filter(d => d.editRequested || d.deleteRequested).length} รายการ รอ Admin ตรวจสอบและกดอนุมัติ`
                      : `${drugs.filter(d => d.editRequested || d.deleteRequested).length} medication catalog change(s) pending Admin verification.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="bg-white text-blue-800 hover:bg-blue-50 text-[10px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl shrink-0 shadow-sm cursor-pointer self-end sm:self-center"
              >
                {language === 'TH' ? 'ตรวจสอบรายการยา' : 'REVIEW DRUG LIST'}
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DataTable
              onEditClick={triggerEdit}
              onPrintClick={triggerPrintSingle}
              initialSearchQuery={globalSearchQuery}
              searchResetTabNonce={searchResetTabNonce}
              onSyncSearchQuery={setGlobalSearchQuery}
            />
          )}

          {printingBooking && (
            <div className="fixed inset-0 z-[10000]">
              <ReportPrinter singleBooking={printingBooking} onClose={() => setPrintingBooking(null)} />
            </div>
          )}

          {activeTab === 'booking' && (
            <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
              <BookingForm
                key={editingBookingId || 'new'}
                editId={editingBookingId}
                onSuccess={() => {
                  setTimeout(() => setActiveTab('dashboard'), 1500);
                }}
                onCancel={() => setActiveTab('dashboard')}
              />
            </div>
          )}

          {activeTab === 'calendar' && (
            <QueueCalendar />
          )}

          {activeTab === 'stocks' && (
            <StockManager />
          )}

          {activeTab === 'reports' && (
            <ReportPrinter />
          )}

          {activeTab === 'estimation' && (currentUser?.role === 'Admin' ||
            currentUser?.role === 'Pharmacist' ||
            currentUser?.role === 'Nurse' ||
            currentUser?.role === 'Doctor') && (
            <PriceEstimation />
          )}

          {activeTab === 'owing' && (currentUser?.role === 'Pharmacist' ||
            currentUser?.role === 'Pharmacist Assistant' ||
            currentUser?.role === 'Pharmacy Stock Clerk' ||
            currentUser?.role === 'Nurse' ||
            currentUser?.role === 'Admin') && (
            <OwingMedPanel />
          )}

          {activeTab === 'users' && (
            <UserAdminManager />
          )}

          {activeTab === 'logs' && currentUser?.role === 'Admin' && (
            <AuditLogsDashboard />
          )}

          {activeTab === 'maintenance' && currentUser?.role === 'Admin' && (
            <DatabaseMaintenance />
          )}

          {activeTab === 'guide' && (
            <RoleInstructionTab />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Thumb Zone) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 z-50 flex justify-between items-center sm:px-6 px-2 h-16 print:hidden pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={() => setActiveTab('booking')}
          className="flex-1 flex flex-col items-center justify-center -mt-5"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform ${
            activeTab === 'booking' ? 'bg-blue-700 scale-110' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
            <PlusCircle className="w-6 h-6 text-white shrink-0" />
          </div>
          <span className={`text-[9px] font-bold tracking-wider mt-1 ${activeTab === 'booking' ? 'text-blue-600' : 'text-slate-400'}`}>
            {language === 'TH' ? 'จองยา' : 'Book'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center space-y-1 ${
            activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold tracking-wider">{language === 'TH' ? 'หน้าหลัก' : 'Home'}</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 flex flex-col items-center justify-center space-y-1 ${
            activeTab === 'calendar' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calendar className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold tracking-wider">{language === 'TH' ? 'ปฏิทิน' : 'Agenda'}</span>
        </button>

        {(currentUser?.role === 'Pharmacist' || currentUser?.role === 'Pharmacist Assistant' || currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.role === 'Nurse' || currentUser?.role === 'Admin') && (
          <button
            onClick={() => setActiveTab('owing')}
            className={`flex-1 flex flex-col items-center justify-center space-y-1 relative ${
              activeTab === 'owing' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {owingMeds.filter(om => !om.resolved).length > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[8px] font-black font-mono w-4 h-4 rounded-full flex items-center justify-center">
                  {owingMeds.filter(om => !om.resolved).length}
                </span>
              )}
            </div>
            <span className="text-[9px] font-bold tracking-wider">{language === 'TH' ? 'ค้างส่ง' : 'Owings'}</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 flex flex-col items-center justify-center space-y-1 ${
            activeTab === 'reports' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold tracking-wider">{language === 'TH' ? 'เมนู' : 'Menu'}</span>
        </button>
      </nav>

      {/* Minimalist credit line at the absolute bottom of DashboardLayout */}
      <footer className="py-2.5 text-center border-t border-slate-200/60 bg-white/40 print:hidden shrink-0 hidden md:block">
        <p className="text-[10px] text-slate-400 font-medium tracking-wide">
          Powered By <span className="font-semibold text-slate-500">Preeyapat P. (Pharmacist)</span>
        </p>
      </footer>
    </div>
  );
}

// Sub dashboard mapping audit trails
function AuditLogsDashboard() {
  const { logs, language, fetchLogs } = useApp();
  const t = i18n[language];

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            {t.navLogs}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Traceable action tracking for system compliance review</p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 font-mono text-[10px] uppercase font-bold rounded-lg text-slate-600 cursor-pointer transition-all"
        >
          Refresh Logs
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <th className="p-4">{t.logTimestamp}</th>
              <th className="p-4">Operator (Operator ID)</th>
              <th className="p-4">Role</th>
              <th className="p-4">{t.logAction}</th>
              <th className="p-4">{t.logDetails}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600 font-sans">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/40 transition-colors">
                <td className="p-4 whitespace-nowrap font-mono text-[10px] text-slate-400">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="p-4">
                  <span className="font-bold text-slate-800">{log.userName}</span>
                  <span className="block text-[9px] text-slate-400 font-mono font-normal">
                    ID: {log.userId}
                  </span>
                </td>
                <td className="p-4">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded">
                    {log.userRole}
                  </span>
                </td>
                <td className="p-4 font-bold text-blue-700">{log.action}</td>
                <td className="p-4 font-medium max-w-sm text-slate-700">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Security Authentication Gate (Login Screen)
function AuthGate() {
  const { login, registerUser, language, setLanguage } = useApp();
  const t = i18n[language];

  // Combined Login and Registration view states
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration specific states
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Nurse');

  const [errorMsg, setErrorMsg] = useState('');
  const [signing, setSigning] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSigning(true);

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Inputs cannot be empty!');
      setSigning(false);
      return;
    }

    const res = await login(username.trim(), password);
    setSigning(true); // Keep spinner while session updates
    setSigning(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Server connection failed - retry verification credentials');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSigning(true);

    if (!regName.trim() || !regUsername.trim() || !regPassword.trim()) {
      setErrorMsg('All fields are required!');
      setSigning(false);
      return;
    }

    const res = await registerUser({
      name: regName.trim(),
      username: regUsername.trim(),
      password: regPassword.trim(),
      role: regRole,
      roles: [regRole]
    });

    setSigning(false);
    if (res.success) {
      // Clear values and toggle to login tab
      setIsRegistering(false);
      setUsername(regUsername.trim());
      setRegName('');
      setRegUsername('');
      setRegPassword('');
      setRegRole('Nurse');
    } else {
      setErrorMsg(res.error || 'Registration failed');
    }
  };

  const AVAILABLE_ROLES_LOGIN: { id: UserRole; name: string; nameTh: string }[] = [
    { id: 'Admin', name: 'Admin', nameTh: 'ผู้ดูแลระบบ (Admin)' },
    { id: 'Pharmacist', name: 'Pharmacist', nameTh: 'เภสัชกร (Pharmacist)' },
    { id: 'Pharmacist Assistant', name: 'Assistant', nameTh: 'ผู้ช่วยเภสัชกร (Pharmacist Assistant)' },
    { id: 'Nurse', name: 'Nurse', nameTh: 'พยาบาล (Nurse)' },
    { id: 'Doctor', name: 'Doctor', nameTh: 'แพทย์ (Doctor)' },
    { id: 'Pharmacy Stock Clerk', name: 'Pharmacy Stock Clerk', nameTh: 'พนักงานคลังยา (Stock Clerk)' }
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 animate-fade-in">
      {/* Container Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-4">
          <BHPLogo className="h-16" />
          <div className="w-full h-px bg-slate-200/60 my-1"></div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-blue-950 font-sans uppercase">
              {isRegistering 
                ? (language === 'TH' ? 'ลงทะเบียนพนักงานใหม่' : 'Staff Registration')
                : t.loginTitle}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-normal font-semibold">
              {isRegistering
                ? (language === 'TH' ? 'กรอกข้อมูลส่วนบุคคลเพื่อรอการอนุมัติสิทธิ์เข้าใช้งานจาก Admin' : 'Submit clinical credential parameters for administrator screening')
                : t.loginSubtitle}
            </p>
          </div>
        </div>

        {errorMsg && (
          <p className="text-red-500 font-bold bg-red-50 p-3 rounded-xl border border-red-100 animate-pulse text-[11px] leading-relaxed">
            ⚠️ {errorMsg}
          </p>
        )}

        {/* Dynamic Mode Forms */}
        {!isRegistering ? (
          /* Login Section */
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">
                {t.username} *
              </label>
              <input
                id="login-username-input"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={language === 'TH' ? 'ระบุรหัสผู้ใช้ / ชื่อผู้ใช้' : 'Enter User ID / Username'}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">
                {t.password} *
              </label>
              <input
                id="login-password-input"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === 'TH' ? 'ระบุรหัสผ่านของคุณ' : 'Enter clearance password'}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={signing}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-sm uppercase tracking-wider disabled:opacity-55"
            >
              {signing ? 'Checking clearance keys...' : t.btnLogin}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setIsRegistering(true);
                }}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                {language === 'TH' ? 'สมัครสมาชิก / ลงทะเบียนเข้าใช้งานใหม่ ➡️' : 'Register New Staff Account ➡️'}
              </button>
            </div>
          </form>
        ) : (
          /* Registration Section */
          <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">
                {language === 'TH' ? 'ชื่อ-นามสกุล บุคลากร *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder={language === 'TH' ? 'เช่น นายสมชาย ดีใจ' : 'e.g., Mrs. Clara Nurse'}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">
                {language === 'TH' ? 'รหัสบุคลากร / ชื่อผู้ใช้ทางการ (Username) *' : 'Desired User ID / Username *'}
              </label>
              <input
                type="text"
                required
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="e.g., staff101"
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">
                {language === 'TH' ? 'รหัสผ่านคีย์ระบบ *' : 'Clearance Security Password *'}
              </label>
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">
                {language === 'TH' ? 'ตำแหน่งสิทธิ์ (Requested Position/Role) *' : 'Requested Action Role *'}
              </label>
              <select
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as any)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-hidden focus:border-blue-500 cursor-pointer text-xs font-semibold"
              >
                {AVAILABLE_ROLES_LOGIN.map((role) => (
                  <option key={role.id} value={role.id}>
                    {language === 'TH' ? role.nameTh : role.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={signing}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-sm uppercase tracking-wider disabled:opacity-55"
            >
              {signing ? 'Submitting request parameters...' : (language === 'TH' ? 'ส่งคำขออนุมัติลงทะเบียน' : 'Submit Registration Request')}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setIsRegistering(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-700 font-bold hover:underline cursor-pointer"
              >
                {language === 'TH' ? '⬅️ มีบัญชีอยู่แล้ว? กลับหน้าเข้าสู่ระบบ' : '⬅️ Already registered? Go to Login'}
              </button>
            </div>
          </form>
        )}

        {/* Dual language selection inside AuthGate */}
        <div className="flex justify-center gap-3 bg-slate-50 p-1 rounded-lg max-w-[120px] mx-auto border border-slate-200">
          <button
            onClick={() => setLanguage('TH')}
            className={`flex-1 py-0.5 text-[10px] font-bold rounded transition-all ${
              language === 'TH' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 font-semibold'
            }`}
          >
            TH
          </button>
          <button
            onClick={() => setLanguage('EN')}
            className={`flex-1 py-0.5 text-[10px] font-bold rounded transition-all ${
              language === 'EN' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 font-semibold'
            }`}
          >
            EN
          </button>
        </div>
      </div>
      {/* Minimalist credit line below the container card in AuthGate */}
      <p className="mt-4 text-[10px] text-slate-400 font-medium tracking-wide animate-fade-in">
        Powered By <span className="font-semibold text-slate-500">Preeyapat P. (Pharmacist)</span>
      </p>
    </div>
  );
}

interface HeaderGlobalSearchProps {
  bookings: Booking[];
  language: 'TH' | 'EN';
  isDashboardActive: boolean;
  externalQuery: string;
  canQuickEdit: boolean;
  formatDateToDMY: (dateStr: string) => string;
  onFocusSearch: () => void;
  onDashboardSearchChange: (query: string) => void;
  onSelectBooking: (booking: Booking) => void;
  onSubmitSearch: (query: string) => void;
  onPrintBooking: (booking: Booking) => void;
  onEditBooking: (id: string) => void;
}

const HeaderGlobalSearch = React.memo(function HeaderGlobalSearch({
  bookings,
  language,
  isDashboardActive,
  externalQuery,
  canQuickEdit,
  formatDateToDMY,
  onFocusSearch,
  onDashboardSearchChange,
  onSelectBooking,
  onSubmitSearch,
  onPrintBooking,
  onEditBooking
}: HeaderGlobalSearchProps) {
  const [searchTerm, setSearchTerm] = useState(externalQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const deferredTerm = useDeferredValue(searchTerm);

  // Sync external triggers (e.g. clicking an alert, clicking an HN chip, or switching tabs)
  useEffect(() => {
    setSearchTerm(externalQuery);
  }, [externalQuery]);

  // Ensure dropdown hides automatically when already viewing Dashboard
  useEffect(() => {
    if (isDashboardActive) {
      setIsOpen(false);
    }
  }, [isDashboardActive]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-index & pre-sort active bookings ONLY when bookings array changes (never per keystroke)
  const indexedActiveBookings = useMemo(() => {
    return bookings
      .filter((b) => !b.cancelStatus?.approved)
      .map((b) => {
        const hnLower = (b.hn || '').toLowerCase();
        return {
          booking: b,
          hnLower,
          hnDigits: hnLower.replace(/-/g, ''),
          nameLower: (b.patientName || '').toLowerCase(),
          dateOfUse: b.dateOfUse || ''
        };
      })
      .sort((a, b) => b.dateOfUse.localeCompare(a.dateOfUse));
  }, [bookings]);

  // Single O(n) pass against pre-normalized strings (no regex/sort on every keystroke)
  const searchResults = useMemo(() => {
    if (isDashboardActive) return [];
    const q = deferredTerm.trim();
    if (!q) return [];
    const qLower = q.toLowerCase();
    const qDigits = qLower.replace(/-/g, '');
    const prefixMatches: Booking[] = [];
    const otherMatches: Booking[] = [];

    for (let i = 0; i < indexedActiveBookings.length; i++) {
      const entry = indexedActiveBookings[i];
      const matchesHn =
        entry.hnLower.includes(qLower) ||
        (qDigits.length > 0 && entry.hnDigits.includes(qDigits));
      const matchesName = entry.nameLower.includes(qLower);

      if (matchesHn || matchesName) {
        if (qDigits.length > 0 && entry.hnDigits.startsWith(qDigits)) {
          prefixMatches.push(entry.booking);
        } else {
          otherMatches.push(entry.booking);
        }
      }
    }

    return prefixMatches.concat(otherMatches);
  }, [indexedActiveBookings, deferredTerm, isDashboardActive]);

  useEffect(() => {
    setHighlightedIdx(0);
  }, [deferredTerm]);

  const visibleResults = searchResults.slice(0, 10);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-[175px] sm:max-w-[250px] md:max-w-[290px] lg:max-w-[330px] min-w-[120px]">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none shrink-0" />
        <input
          id="header-global-search-input"
          type="text"
          value={searchTerm}
          onFocus={() => {
            onFocusSearch();
            if (!isDashboardActive && searchTerm.trim()) {
              setIsOpen(true);
            }
          }}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            if (isDashboardActive) {
              setIsOpen(false);
              onDashboardSearchChange(val);
            } else {
              setIsOpen(val.trim().length > 0);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            } else if (!isDashboardActive && e.key === 'ArrowDown' && visibleResults.length > 0) {
              e.preventDefault();
              setIsOpen(true);
              setHighlightedIdx((prev) => (prev < visibleResults.length - 1 ? prev + 1 : 0));
            } else if (!isDashboardActive && e.key === 'ArrowUp' && visibleResults.length > 0) {
              e.preventDefault();
              setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : visibleResults.length - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (!isDashboardActive) {
                const selected = visibleResults[highlightedIdx];
                if (selected && isOpen) {
                  setIsOpen(false);
                  onSelectBooking(selected);
                } else if (searchTerm.trim()) {
                  setIsOpen(false);
                  onSubmitSearch(searchTerm);
                }
              }
            }
          }}
          placeholder={language === 'TH' ? 'ค้นหา HN / ชื่อคนไข้...' : 'Search HN or patient...'}
          aria-label={language === 'TH' ? 'ค้นหารายการจองด้วย HN หรือชื่อคนไข้' : 'Global search bookings by patient HN or name'}
          className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 pl-8 pr-7 py-1.5 rounded-full text-xs text-slate-800 placeholder:text-slate-400 transition-all outline-hidden font-sarabun tabular-nums"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setIsOpen(false);
              onDashboardSearchChange('');
            }}
            className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/70 transition-colors cursor-pointer"
            title={language === 'TH' ? 'ล้างคำค้นหา' : 'Clear search'}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {!isDashboardActive && isOpen && searchTerm.trim().length > 0 && (
        <div
          id="header-global-search-dropdown"
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-[400px] md:w-[440px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden"
        >
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200/70 flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              {language === 'TH' ? 'รายการจองที่ใช้งานอยู่' : 'Active Bookings'} ({searchResults.length})
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {language === 'TH' ? 'คลิกเพื่อเปิดดูในหน้าหลัก' : 'Click to inspect'}
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 custom-mini-scroll">
            {visibleResults.length === 0 ? (
              <div className="py-7 px-4 text-center text-slate-400 text-xs">
                <p className="font-semibold text-slate-500">
                  {language === 'TH'
                    ? `ไม่พบรายการจองที่ตรงกับ "${searchTerm.trim()}"`
                    : `No active bookings matching "${searchTerm.trim()}"`}
                </p>
                <p className="text-[10.5px] mt-1">
                  {language === 'TH' ? 'ลองค้นหาด้วยเลข HN หรือชื่อ-นามสกุลผู้ป่วย' : 'Try searching by patient HN or name'}
                </p>
              </div>
            ) : (
              visibleResults.map((b, idx) => {
                const isHighlighted = idx === highlightedIdx;
                const isHeld = b.holdStatus?.isHeld === true;
                const isPharmacistVerified = b.pharmacistVerification?.status === 'Verified';
                const isRejected = b.pharmacistVerification?.status === 'Rejected';
                const medsPreview = b.medications
                  .slice(0, 2)
                  .map((m) => `${m.drugName} x${m.quantity}`)
                  .join(', ');
                const extraMedsCount = b.medications.length > 2 ? b.medications.length - 2 : 0;

                return (
                  <div
                    key={b.id}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={() => {
                      setIsOpen(false);
                      onSelectBooking(b);
                    }}
                    className={`px-3.5 py-2.5 cursor-pointer transition-colors flex items-start justify-between gap-2.5 ${
                      isHighlighted ? 'bg-blue-50/75' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-900 truncate max-w-[175px]">
                          {b.patientName}
                        </span>
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/70 px-1.5 py-0.2 rounded font-sarabun tabular-nums whitespace-nowrap">
                          HN: {b.hn}
                        </span>
                        <span
                          className={`text-[9.5px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                            b.mode === 'Oncology'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}
                        >
                          {b.mode}
                        </span>
                        {isHeld && (
                          <span className="text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded">
                            HOLD
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 truncate">
                        {medsPreview || (language === 'TH' ? 'ไม่มีรายการยา' : 'No medications')}
                        {extraMedsCount > 0 && (
                          <span className="text-slate-400 font-semibold"> +{extraMedsCount}</span>
                        )}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-600 tabular-nums">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatDateToDMY(b.dateOfUse)}
                        </span>
                        {b.pharmacyLocation && (
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold">
                            {b.pharmacyLocation}
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.2 rounded font-bold ${
                            isRejected
                              ? 'bg-rose-50 text-rose-700'
                              : isPharmacistVerified
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {isRejected ? 'Rejected' : isPharmacistVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                          onPrintBooking(b);
                        }}
                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-100/70 rounded-lg border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                        title={language === 'TH' ? 'พิมพ์ใบรายการยา' : 'Print Slip'}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {canQuickEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onEditBooking(b.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-100/70 rounded-lg border border-transparent hover:border-indigo-200 transition-colors cursor-pointer"
                          title={language === 'TH' ? 'แก้ไขใบจอง' : 'Edit Booking'}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {searchResults.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSubmitSearch(searchTerm);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 hover:bg-blue-50 border-t border-slate-200/70 text-[11px] font-bold text-blue-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>
                {language === 'TH'
                  ? `แสดงทั้งหมด ${searchResults.length} รายการในหน้าหลัก`
                  : `Show all ${searchResults.length} matching records in Dashboard`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
});

function MainAppShell() {
  const { currentUser } = useApp();
  return currentUser ? <DashboardLayout /> : <AuthGate />;
}

export default function App() {
  return (
    <AppProvider>
      <MainAppShell />
    </AppProvider>
  );
}
