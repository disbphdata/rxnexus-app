import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, CheckCircle, Clock, AlertTriangle, ShieldCheck, Check, Calendar, Filter, FileText, Printer, ArrowLeft } from 'lucide-react';
import { Booking, formatDateToDMY } from '../types';

export default function OwingMedPanel() {
  const {
    bookings,
    owingMeds,
    language,
    currentUser,
    toggleMedicineOwing,
    toggleOwingResolved,
    updateBooking
  } = useApp();

  // Settings Filter Parameters - Mirroring ReportPrinter.tsx
  const [filterType, setFilterType] = useState<'useDate' | 'bookingDate'>('useDate');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3); // 3 days in advance reservation default
    return d.toISOString().split('T')[0];
  });
  const [drugClass, setDrugClass] = useState<'All' | 'General' | 'Oncology'>('All');
  const [hnQuery, setHnQuery] = useState<string>('');
  const [ignoreDate, setIgnoreDate] = useState<boolean>(true);

  // Filter mode for display: Only list bookings with Owing medicines, or list All matching criteria
  const [owingFilterMode, setOwingFilterMode] = useState<'onlyOwing' | 'all' | 'onlyReady'>('onlyOwing');
  const [locationFilter, setLocationFilter] = useState<string>('All');

  const uniqueLocations = Array.from(
    new Set([
      'Phar IV',
      'Phar A1',
      'Phar E3',
      'Phar E6',
      'Phar D',
      ...bookings.map((b) => (b.pharmacyLocation || '').trim()).filter(Boolean)
    ])
  );

  // Checkbox helpers for each drug
  const isDrugOwing = (bookingId: string, drugId: string): boolean => {
    const oRecord = owingMeds?.find(om => om.bookingId === bookingId);
    if (!oRecord) return false;
    const m = oRecord.medications.find(item => item.drugId === drugId);
    return m ? !m.received : false;
  };

  const handleToggleDrugOwing = async (b: Booking, item: any) => {
    const currentOwing = isDrugOwing(b.id, item.drugId);
    await toggleMedicineOwing(b, item, !currentOwing);
  };

  const hasActiveOwingForBooking = (bookingId: string): boolean => {
    const oRecord = owingMeds?.find(om => om.bookingId === bookingId);
    if (!oRecord || oRecord.resolved) return false;
    return oRecord.medications.some(m => !m.received);
  };

  // Load bookings that fit criteria
  const activeBookings = bookings.filter((b) => {
    // 1. Filter by specific category (General vs Oncology)
    const matchesCategory = drugClass === 'All' ? true : b.mode === drugClass;

    // 2. Filter by date logic (Date Range Between startDate and endDate inclusive)
    const dateToCheck = filterType === 'useDate' ? b.dateOfUse : b.bookingDate;
    const matchesDate = ignoreDate ? true : (dateToCheck >= startDate && dateToCheck <= endDate);

    // 3. Filter by HN query
    const matchesHn = hnQuery
      ? b.hn.replace(/-/g, '').toLowerCase().includes(hnQuery.replace(/-/g, '').toLowerCase()) ||
        b.patientName.toLowerCase().includes(hnQuery.toLowerCase())
      : true;

    // 4. Filter by Pharmacy Location
    const matchesLocation =
      locationFilter === 'All' ? true : (b.pharmacyLocation || '').trim() === locationFilter;

    if (!matchesCategory || !matchesDate || !matchesHn || !matchesLocation) return false;

    // 4. Filter by owing state
    const hasOwing = hasActiveOwingForBooking(b.id);
    if (owingFilterMode === 'onlyOwing') return hasOwing;
    if (owingFilterMode === 'onlyReady') return !hasOwing;
    return true;
  });

  const isStockClerkOrStaff =
    currentUser?.role === 'Pharmacy Stock Clerk' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'Pharmacist' ||
    currentUser?.role === 'Pharmacist Assistant';

  return (
    <div id="owing-meds-panel" className="space-y-6">
      {/* Header card banner */}
      <div className="bg-gradient-to-r from-red-700 via-amber-700 to-amber-600 rounded-2xl p-6 md:p-8 text-white shadow-lg space-y-2">
        <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase flex items-center gap-2">
          <span>📦</span>
          {language === 'TH' ? 'ระบบแจ้งเตือนยาค้างส่งจากคลังยา' : 'Action Required: Stock Preparation'}
        </h2>
        <p className="text-xs text-white/90 leading-relaxed font-semibold">
          {language === 'TH'
            ? 'ตรวจสอบ บันทึก และแก้ไขสถานะยาค้างรับจากคลัง ("ยังไม่ได้รับ") กดทำเครื่องหมายถูกที่ช่องหน้าชื่อยาค้างเพื่อแจกจ่ายสัญญาณระบบด่วนแจ้งตู้ปูดสเตชั่นทันที!'
            : 'Track and manage outstanding medication line gaps. Check the checkbox immediately in front of each drug name to flag the drug as NOT READY in inventory, triggering dispatcher notifications.'}
        </p>
      </div>

      {/* Grid Settings Filter Parameters (Similar to ReportPrinter) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-2 flex items-center gap-2">
          <Filter className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            {language === 'TH' ? 'ตัวกรองวิเคราะห์สถิติส่งยา' : 'Ledger Query Filters'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          {/* 1. Classification Mode Selection */}
          <div>
            <label className="block text-slate-500 mb-1 font-bold uppercase text-[10px] tracking-wider">
              {language === 'TH' ? 'โหมดประเภทช่วงเวลา' : 'Timeframe Mode'}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('useDate')}
                className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                  filterType === 'useDate'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Date of Use
              </button>
              <button
                onClick={() => setFilterType('bookingDate')}
                className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                  filterType === 'bookingDate'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Booking Date
              </button>
            </div>
          </div>

          {/* 2. Select Date Range */}
          <div>
            <label className="block text-slate-500 mb-1 font-bold uppercase text-[10px] tracking-wider">
              {language === 'TH' ? 'ช่วงเวลาจัดเตรียม' : 'Date Range (From - To)'}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={ignoreDate}
                  className="w-full bg-slate-50 disabled:bg-slate-100 disabled:text-slate-350 border border-slate-200 px-2 py-1 rounded-md text-xs focus:outline-hidden font-mono"
                />
              </div>
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={ignoreDate}
                  className="w-full bg-slate-50 disabled:bg-slate-100 disabled:text-slate-350 border border-slate-200 px-2 py-1 rounded-md text-xs focus:outline-hidden font-mono"
                />
              </div>
            </div>
            
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                id="ow-ignore-date"
                type="checkbox"
                checked={ignoreDate}
                onChange={(e) => setIgnoreDate(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3 cursor-pointer"
              />
              <label htmlFor="ow-ignore-date" className="text-[10px] text-slate-400 font-bold select-none cursor-pointer">
                {language === 'TH' ? 'ทุกช่วงเวลา (All time)' : 'Ignore Date Limit (All time)'}
              </label>
            </div>
          </div>

          {/* 3. Medicinal Classification filter */}
          <div>
            <label className="block text-slate-500 mb-1 font-bold uppercase text-[10px] tracking-wider">
              {language === 'TH' ? 'หมวดยาจัดกลุ่ม' : 'Medicinal Category'}
            </label>
            <select
              value={drugClass}
              onChange={(e) => setDrugClass(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="All">{language === 'TH' ? 'ยาทุกประเภท (Both Drug Classes)' : 'Both Drug Classes'}</option>
              <option value="General">{language === 'TH' ? 'ยากลุ่มทั่วไป (General Meds)' : 'General Medicines'}</option>
              <option value="Oncology">{language === 'TH' ? 'ยากลุ่มเฉพาะทางเคมีบำบัด (Oncology Line)' : 'Oncology Spec Lines'}</option>
            </select>
          </div>

          {/* 3.5 Pharmacy Location Filter */}
          <div>
            <label className="block text-slate-500 mb-1 font-bold uppercase text-[10px] tracking-wider">
              {language === 'TH' ? 'ห้องยา (Location)' : 'Pharmacy Location'}
            </label>
            <select
              id="owing-location-filter"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="All">{language === 'TH' ? 'ทุกห้องยา (All)' : 'All Locations'}</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Search patient HN or name */}
          <div>
            <label className="block text-slate-500 mb-1 font-bold uppercase text-[10px] tracking-wider">
              {language === 'TH' ? 'ค้นหาแบบ HN หรือชื่อผู้ป่วย' : 'Patient HN or Name Search'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={hnQuery}
                onChange={(e) => setHnQuery(e.target.value)}
                placeholder="e.g., 02-xx-xxxxxx"
                className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-xs focus:outline-hidden focus:border-amber-500 font-mono"
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-1">
              {language === 'TH' ? 'กรองด้วยข้อมูลเพื่อความแคบแคบ' : 'Filters dynamically based on key credentials'}
            </p>
          </div>
        </div>

        {/* Lower row - Overall Filter State selection (Only with Active Owing vs All) */}
        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 max-w-lg w-full sm:w-auto">
            <button
              onClick={() => setOwingFilterMode('onlyOwing')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                owingFilterMode === 'onlyOwing'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'TH' ? 'เฉพาะยาค้างจ่าย' : 'Only Active Owing'}
            </button>
            <button
              onClick={() => setOwingFilterMode('all')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                owingFilterMode === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'TH' ? 'ใบสั่งทั้งหมด' : 'All Bookings'}
            </button>
            <button
              onClick={() => setOwingFilterMode('onlyReady')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                owingFilterMode === 'onlyReady'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'TH' ? 'รายการยาที่ได้รับครบ' : 'No Owing / Ready'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="text-right text-[11px] font-bold text-slate-500 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg select-none">
              🔍 {language === 'TH' ? `พบแถวรายการ ${activeBookings.length} ใบสั่งยา` : `Found ${activeBookings.length} clinical profiles`}
            </div>
          </div>
        </div>
      </div>

      {/* Primary listings database list */}
      {activeBookings.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <FileText className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
          <p className="text-xs font-bold uppercase tracking-wider">
            {language === 'TH' ? 'ไม่พบใบสั่งยาทรานแซกชั่นเชื่อมโยง' : 'No matching patient profiles found.'}
          </p>
          <p className="text-[10px] text-slate-350">
            {language === 'TH' ? 'กรุณาปรับเงื่อนไขปฏิทิน คีย์เวิร์ด หรือเปลี่ยนจาก "เฉพาะค้างจ่าย" เป็น "ใบสั่งทั้งหมด"' : 'Try adjusting dates, patient search keywords, or switching filter mode to "All Bookings" to view more.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {activeBookings.map((b) => {
            const hasOwing = hasActiveOwingForBooking(b.id);
            return (
              <div
                key={b.id}
                className={`bg-white rounded-2xl border shadow-xs p-5 md:p-6 transition-all duration-200 relative overflow-hidden ${
                  hasOwing
                    ? 'border-red-200 bg-red-50/5 hover:border-red-300'
                    : 'border-emerald-200/60 bg-emerald-50/5'
                }`}
              >
                {/* Visual ribbon indicator side */}
                <div className={`absolute top-0 left-0 w-1.5 h-full ${hasOwing ? 'bg-red-500' : 'bg-emerald-500'}`}></div>

                {/* Header info bar inside card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                  <div className="space-y-0.5 pl-2 sm:pl-0">
                    <span className="font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Booking Reference ID: {b.id}
                    </span>
                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                      {b.patientName}
                      <span className="text-[11px] font-mono tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black whitespace-nowrap inline-block">HN: {b.hn}</span>
                    </h3>
                    
                    <div className="text-[10.5px] text-slate-400 font-semibold flex items-center gap-x-2.5 gap-y-1 flex-wrap">
                      <span>• Location: <strong className="text-slate-600 uppercase text-[10px]">{b.pharmacyLocation || 'N/A'}</strong></span>
                      <span>• Dept: <strong className="text-slate-600">{b.department}</strong></span>
                      <span>• Prescribing MD: <strong className="text-slate-600">{b.staff.doctor}</strong></span>
                      <span>• Date of Use: <strong className="text-amber-800 font-mono">{formatDateToDMY(b.dateOfUse)}</strong></span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2.5 shrink-0 pl-2 sm:pl-0">
                    <div className="flex items-center gap-2">
                      {/* Instant Status Tags */}
                      {hasOwing ? (
                        <span className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-full text-[10px] font-black tracking-wide uppercase flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          {language === 'TH' ? '🚨 ตรวจพบค้างส่ง' : '🚨 OWING DETECTED'}
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-black tracking-wide uppercase flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {language === 'TH' ? '✓ ยาครบพร้อมจ่าย' : '✓ ALL MEDS READY'}
                        </span>
                      )}

                      {/* Badge Category */}
                      <span className={`px-2 py-1 rounded-md text-[9px] font-extrabold uppercase font-mono border ${
                        b.mode === 'Oncology' ? 'bg-red-50/60 text-red-600 border-red-100' : 'bg-blue-50/60 text-blue-600 border-blue-100'
                      }`}>
                        {b.mode}
                      </span>
                    </div>

                    {/* Highly prominent, beautiful toggle for general medicine received/prepared status & Complete action */}
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {isStockClerkOrStaff && (
                        <label className="flex items-center gap-2 cursor-pointer bg-amber-50/40 border border-amber-200 hover:border-amber-400 hover:bg-amber-50/80 px-3 py-1.5 rounded-xl transition-all select-none">
                          <input
                            type="checkbox"
                            checked={b.medicineReceived === true}
                            onChange={async (e) => {
                              await updateBooking(b.id, { medicineReceived: e.target.checked });
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-[10px] font-black text-slate-750 uppercase tracking-wide">
                            {language === 'TH' ? 'ยืนยันรับยาจากสต็อกพร้อมใช้งาน' : 'Received/Prepared from stock'}
                          </span>
                        </label>
                      )}

                      {hasOwing && (currentUser?.role === 'Pharmacist' || currentUser?.role === 'Pharmacist Assistant' || currentUser?.role === 'Nurse' || currentUser?.role === 'Admin') && (
                        <button
                          id={`complete-owing-${b.id}`}
                          type="button"
                          onClick={async () => {
                            const oRecord = owingMeds?.find(om => om.bookingId === b.id);
                            if (oRecord) {
                              await toggleOwingResolved(oRecord.id, true);
                            }
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{language === 'TH' ? 'Complete (ได้รับยาครบแล้ว)' : 'Complete (Stop Stock Alert)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Patient Medications Checklist */}
                <div className="mt-4 space-y-3 pl-2 sm:pl-0">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    {language === 'TH' ? 'รายการยาในใบสั่ง (ทำเครื่องหมายถูกเมื่อยา "ยังไม่เตรียม / ค้างจ่าย")' : 'Ordered Medicines (Check the box to set medicine status as "NOT READY / OWING")'}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {b.medications.map((item, idx) => {
                      const isOwing = isDrugOwing(b.id, item.drugId);
                      const canToggle = isStockClerkOrStaff;

                      return (
                        <label
                          key={idx}
                          className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                            isOwing
                              ? 'bg-rose-50/50 border-rose-300 text-rose-900 shadow-xs shadow-rose-100/50'
                              : 'bg-slate-50 border-slate-150 hover:border-slate-300 text-slate-800'
                          }`}
                        >
                          {/* Checkbox placement directly IN FRONT OF (left of) drug description */}
                          <input
                            type="checkbox"
                            checked={isOwing}
                            disabled={!canToggle}
                            onChange={() => handleToggleDrugOwing(b, item)}
                            className="rounded text-rose-600 focus:ring-rose-500 border-slate-300 w-5 h-5 cursor-pointer disabled:opacity-50 shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-0.5">
                                <span className={`font-extrabold block leading-snug break-words whitespace-normal text-[11px] sm:text-xs md:text-sm ${isOwing ? 'text-rose-950' : 'text-slate-900'}`}>
                                  {item.drugName}
                                </span>
                                <span className="font-mono text-[9.5px] text-slate-400 block">Stock ID: {item.stockCode}</span>
                              </div>
                              <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-md self-center shrink-0 ${
                                isOwing ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-slate-200/80 text-slate-800'
                              }`}>
                                x{item.quantity}
                              </span>
                            </div>

                            {isOwing && (
                              <div className="border-t border-dashed border-slate-200/60 mt-2.5 pt-2 flex items-center justify-between text-[10px]">
                                <span className="font-bold uppercase text-rose-700 font-black animate-pulse">
                                  {language === 'TH' ? '⚠️ ค้างจ่ายส่งล่าช้า (Not Ready)' : '⚠️ Not Ready / Owing'}
                                </span>
                                <span className="text-[9px] bg-rose-100 border border-rose-200 font-extrabold text-rose-750 px-1.5 py-0.5 rounded uppercase font-sans animate-bounce shrink-0">
                                  Flagged Alert
                                </span>
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
