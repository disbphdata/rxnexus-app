import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { i18n } from '../lib/i18n';
import { Booking, formatDateToDMY } from '../types';
import { ChevronLeft, ChevronRight, HelpCircle, Check, Clock, Loader, Calendar as CalIcon, Pill, Activity, Layers } from 'lucide-react';

export default function QueueCalendar() {
  const { bookings, language, currentUser, deleteBooking } = useApp();
  const t = i18n[language];

  // Selected mode filter tab: 'All' | 'General' | 'Oncology'
  const [calendarTab, setCalendarTab] = useState<'All' | 'General' | 'Oncology'>('All');

  // Selected date reference for month navigation
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Month and Day names dictionaries
  const EN_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const TH_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const MONTHS = language === 'TH' ? TH_MONTHS : EN_MONTHS;

  const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const TH_WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const WEEKDAYS = language === 'TH' ? TH_WEEKDAYS : EN_WEEKDAYS;

  // Calendar math calculations
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create grid cells
  const cells: (Date | null)[] = [];
  // padding empty cells
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push(null);
  }
  // fill active date cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }

  // Prev/Next Navigators
  const navigatePrev = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const navigateNext = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Convert Date object to string format: YYYY-MM-DD
  const formatDateStr = (date: Date): string => {
    const yStr = date.getFullYear();
    const mStr = String(date.getMonth() + 1).padStart(2, '0');
    const dStr = String(date.getDate()).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  };

  // Calculate month-level booking counts for filter badges
  const monthBookings = bookings.filter((b) => {
    if (!b.dateOfUse) return false;
    const parts = b.dateOfUse.split('-');
    if (parts.length !== 3) return false;
    const bYear = parseInt(parts[0], 10);
    const bMonth = parseInt(parts[1], 10) - 1;
    return bYear === year && bMonth === month;
  });

  const countAll = monthBookings.length;
  const countGeneral = monthBookings.filter((b) => b.mode === 'General').length;
  const countOncology = monthBookings.filter((b) => b.mode === 'Oncology').length;

  return (
    <div className="space-y-6">
      {/* Category Tabs: คิวทั้งหมด / คิวยาทั่วไป / คิวยามะเร็ง */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => setCalendarTab('All')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            calendarTab === 'All'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>{language === 'TH' ? 'คิวทั้งหมด' : 'All Queues'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            calendarTab === 'All' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {countAll}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCalendarTab('General')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            calendarTab === 'General'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-blue-50/70 text-blue-700 hover:bg-blue-100/80 border border-blue-200/60'
          }`}
        >
          <Pill className="w-4 h-4 shrink-0" />
          <span>{language === 'TH' ? 'คิวยาทั่วไป' : 'General Meds Queue'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            calendarTab === 'General' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
          }`}>
            {countGeneral}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCalendarTab('Oncology')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            calendarTab === 'Oncology'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-red-50/70 text-red-700 hover:bg-red-100/80 border border-red-200/60'
          }`}
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span>{language === 'TH' ? 'คิวยามะเร็ง' : 'Oncology Meds Queue'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            calendarTab === 'Oncology' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-800'
          }`}>
            {countOncology}
          </span>
        </button>
      </div>

      {/* Calendar Header Control Pane */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <CalIcon className="w-5 h-5 text-blue-600" />
            {calendarTab === 'General'
              ? (language === 'TH' ? 'ปฏิทินคิวยาทั่วไป (General Meds)' : 'General Medication Queue Calendar')
              : calendarTab === 'Oncology'
              ? (language === 'TH' ? 'ปฏิทินคิวยามะเร็ง (Oncology Meds)' : 'Oncology Medication Queue Calendar')
              : t.calTitle}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{t.calSubtitle}</p>
        </div>

        {/* Month Picker controls */}
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 border border-slate-200 rounded-lg max-w-sm">
          <button
            onClick={navigatePrev}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-xs min-w-32 text-center text-slate-700 font-sans uppercase">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={navigateNext}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend Information bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase font-bold bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <span className="text-slate-400">{language === 'TH' ? 'ประเภทคิวยา:' : 'Class Keys:'}</span>
        <div className="flex items-center gap-1.5 font-sans">
          <span className="w-2 h-2 bg-blue-600 rounded"></span>
          <span className="text-blue-700">{t.calGenLegend}</span>
        </div>
        <div className="flex items-center gap-1.5 font-sans">
          <span className="w-2 h-2 bg-red-600 rounded"></span>
          <span className="text-red-700">{t.calOncoLegend}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto text-slate-400 font-semiboldNormal normal-case">
          <span>{language === 'TH' ? '⚠️ = รอยาพร้อมใช้' : '⚠️ = Pending Stock'}</span>
          <span>•</span>
          <span>{language === 'TH' ? '✅ = ยาพร้อมใช้งาน' : '✅ = Stock Delivered & Available'}</span>
        </div>
      </div>

      {/* Month Calendar Grid board */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 md:p-4 w-full overflow-x-hidden">
        <div className="w-full">
          {/* Week Day labels */}
          <div className="grid grid-cols-7 text-center font-bold text-[10px] md:text-xs text-slate-400 uppercase tracking-wider py-2 border-b border-slate-100">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Date body grid cells */}
          <div className="grid grid-cols-7 grid-auto-rows gap-1.5 mt-2 md:gap-2">
          {cells.map((dateObj, idx) => {
            if (!dateObj) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="bg-slate-50/40 border border-transparent rounded-lg"
                />
              );
            }

            const dateStr = formatDateStr(dateObj);
            // Query bookings allocated on this dateOfUse filtered by active tab
            const dayBookings = bookings.filter((b) => {
              if (b.dateOfUse !== dateStr) return false;
              if (calendarTab === 'General') return b.mode === 'General';
              if (calendarTab === 'Oncology') return b.mode === 'Oncology';
              return true;
            });
            const isToday = new Date().toDateString() === dateObj.toDateString();

            return (
              <div
                key={dateStr}
                className={`bg-white border rounded-md md:rounded-lg p-1 md:p-2 flex flex-col hover:shadow-xs transition-all min-h-[70px] md:min-h-[140px] xl:min-h-[160px] ${
                  isToday
                    ? 'border-blue-600 ring-1 md:ring-2 ring-blue-50 bg-blue-50/10'
                    : 'border-slate-100'
                }`}
              >
                {/* Date digit */}
                <div className="flex justify-between items-center mb-0.5 md:mb-1">
                  <span
                    className={`text-[10px] md:text-xs font-bold leading-none w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-blue-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    {dateObj.getDate()}
                  </span>
                  {dayBookings.length > 0 && (
                    <span className="text-[8px] md:text-[9px] text-slate-400 font-semibold font-mono">
                      ({dayBookings.length})
                    </span>
                  )}
                </div>

                {/* Day medication list elements inside card */}
                <div className="flex-1 space-y-0.5 md:space-y-1 overflow-y-auto max-h-[50px] md:max-h-[110px] xl:max-h-[135px] custom-mini-scroll">
                  {dayBookings.map((b) => {
                    const isAllClerkDelivered = b.clerkVerification.status === 'Ready-to-use';
                    const isOnco = b.mode === 'Oncology';
                    const isHeld = b.holdStatus?.isHeld === true;

                    let bgClass = '';
                    if (isHeld) {
                      bgClass = 'bg-slate-100 text-slate-500 hover:bg-slate-200 md:border-slate-350';
                    } else if (isOnco) {
                      bgClass = 'bg-red-50 text-red-700 hover:bg-red-100 md:border-red-200/50';
                    } else {
                      bgClass = 'bg-blue-50 text-blue-700 hover:bg-blue-100 md:border-blue-200/50';
                    }

                    return (
                      <div
                        id={`calendar-event-${b.id}`}
                        key={b.id}
                        onClick={() => setSelectedBooking(b)}
                        className={`p-0.5 md:p-1 rounded md:border text-[8px] md:text-[10px] font-semibold truncate cursor-pointer transition-all hover:scale-[1.02] flex items-center md:justify-between ${bgClass}`}
                        title={b.patientName}
                      >
                        <span className="truncate flex-1">
                          {isHeld ? (
                            <span className="font-extrabold text-[8.5px] mr-1">⏸️ HOLD | </span>
                          ) : (
                            <>
                              <span className="hidden md:inline">{isAllClerkDelivered ? '✅ ' : '⚠️ '}</span>
                              <span className="md:hidden">{isAllClerkDelivered ? '✅' : '⚠️'} </span>
                            </>
                          )}
                          {b.rolloverStatus && (
                            <span className="font-extrabold mr-1">🔄 </span>
                          )}
                          {b.patientName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Interactive Detail Modal dialog popup */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
            {/* Model Title */}
            <div className="p-5 bg-neutral-50 border-b border-neutral-100 flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${selectedBooking.mode === 'Oncology' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                  {selectedBooking.mode === 'Oncology' ? t.modeOncology : t.modeGeneral}
                </span>
                <h3 className="font-bold text-sm text-neutral-800 mt-1 mb-0.5">
                  {t.clickCalDetail} — {selectedBooking.id}
                </h3>
                <p className="text-[10px] text-neutral-400">Recorded on {formatDateToDMY(selectedBooking.bookingDate)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-bold font-mono p-1 hover:bg-neutral-100 rounded-lg cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>

            {/* Model Content body */}
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-neutral-400 mb-0.5">{t.patientName}</p>
                  <p className="font-bold text-neutral-800">{selectedBooking.patientName}</p>
                </div>
                <div>
                  <p className="text-neutral-400 mb-0.5">{t.hn}</p>
                  <p className="font-mono font-bold text-neutral-800 tracking-wider text-[11px] bg-slate-100 px-2 py-0.5 rounded inline-block whitespace-nowrap">{selectedBooking.hn}</p>
                </div>
                <div>
                  <p className="text-neutral-400 mb-0.5">{t.dateOfUse}</p>
                  <p className="font-bold text-neutral-800 text-[11px]">{formatDateToDMY(selectedBooking.dateOfUse)}</p>
                </div>
                <div>
                  <p className="text-neutral-400 mb-0.5">{t.department}</p>
                  <p className="font-bold text-neutral-700">{selectedBooking.department}</p>
                </div>
                {selectedBooking.pharmacyLocation && (
                  <div>
                    <p className="text-neutral-400 mb-0.5">{language === 'TH' ? 'ห้องยาที่จ่ายยา' : 'Pharmacy Location'}</p>
                    <p className="font-bold text-blue-700">{selectedBooking.pharmacyLocation}</p>
                  </div>
                )}
                {selectedBooking.regimen && (
                  <div>
                    <p className="text-neutral-400 mb-0.5">{language === 'TH' ? 'สูตรการรักษา' : 'Regimen'}</p>
                    <p className="font-bold text-indigo-700">{selectedBooking.regimen}</p>
                  </div>
                )}
              </div>

              {/* Medication Lists */}
              <div className="border border-neutral-100 rounded-xl overflow-hidden">
                <div className="p-2.5 bg-neutral-50 border-b border-neutral-100 font-bold text-xs text-neutral-600">
                  {t.medTitle}
                </div>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-neutral-50/50 text-neutral-400 font-semibold border-b border-offset border-neutral-100 text-[10px]">
                      <th className="p-2">{language === 'TH' ? 'รายการยา' : 'Item Description'}</th>
                      <th className="p-2 text-center">Stock Code</th>
                      <th className="p-2 text-center">{language === 'TH' ? 'จำนวน' : 'Qty'}</th>
                      <th className="p-2 text-right">{language === 'TH' ? 'ราคา/หน่วย' : 'Unit Price'}</th>
                      <th className="p-2 text-right">{language === 'TH' ? 'ราคารวม' : 'Subtotal'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {selectedBooking.medications.map((item, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50 text-neutral-600">
                        <td className="p-2 font-medium">{item.drugName}</td>
                        <td className="p-2 text-center font-mono text-[10px] text-neutral-500">{item.stockCode}</td>
                        <td className="p-2 text-center font-semibold">{item.quantity}</td>
                        <td className="p-2 text-right">฿{item.unitPrice.toLocaleString()}</td>
                        <td className="p-2 text-right font-bold text-neutral-800">฿{item.totalPrice.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50 text-neutral-700 font-bold">
                      <td colSpan={4} className="p-2 text-right uppercase tracking-wider">{t.totalAmount}:</td>
                      <td className="p-2 text-right text-emerald-700">฿{selectedBooking.totalAmount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {selectedBooking.note && (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-xs">
                  <p className="text-[10px] uppercase font-bold text-amber-800 mb-1">
                    {language === 'TH' ? 'หมายเหตุ / Note เพิ่มเติม' : 'Clinical Note'}
                  </p>
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedBooking.note}</p>
                </div>
              )}

              {/* Verified signatures status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-neutral-100 bg-neutral-50">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-neutral-400">Pharmacist Status</p>
                  {selectedBooking.pharmacistVerification.status === 'Verified' ? (
                    <div>
                      <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 shrink-0" /> Verified
                      </span>
                      <p className="text-[9px] text-neutral-400 mt-1">
                        By: {selectedBooking.pharmacistVerification.verifiedBy}
                      </p>
                    </div>
                  ) : (
                    <span className="text-amber-500 font-bold text-xs flex items-center gap-1">
                      ⚠️ Pending Allocation Review
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-neutral-400">Warehouse Delivery Status</p>
                  {selectedBooking.clerkVerification.status === 'Ready-to-use' ? (
                    <div>
                      <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 shrink-0" /> {t.calStatusReady}
                      </span>
                      <p className="text-[9px] text-neutral-400 mt-1">
                        Received: {selectedBooking.clerkVerification.verifiedBy}
                      </p>
                    </div>
                  ) : selectedBooking.clerkVerification?.status === 'Accepted' ? (
                    <div>
                      <span className="text-indigo-600 font-bold text-xs flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 shrink-0 animate-pulse text-indigo-500" /> ordered with Vendor
                      </span>
                      <p className="text-[9px] text-neutral-400 mt-1">
                        Ordered By: {selectedBooking.clerkVerification.orderedBy || 'Staff'}
                      </p>
                    </div>
                  ) : (
                    <span className="text-amber-500 font-bold text-xs flex items-center gap-1">
                      ⚠️ Awaiting Physical Drug Arrival
                    </span>
                  )}
                </div>
              </div>

              {/* Clinicians Signoffs validation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-500">
                <div>• {t.selectDoctor}: <span className="font-semibold text-neutral-700">{selectedBooking.staff.doctor}</span></div>
                <div>• {t.selectNurse}: <span className="font-semibold text-neutral-700">{selectedBooking.staff.nurse}</span></div>
              </div>

              {/* Hold and Rollover statuses */}
              {(selectedBooking.holdStatus?.reason || selectedBooking.rolloverStatus) && (
                <div className="p-3.5 rounded-xl border border-neutral-100 bg-slate-50 space-y-2 text-xs font-sans">
                  {selectedBooking.holdStatus?.isHeld && (
                    <div className="flex items-start gap-2 text-amber-800">
                      <span className="text-sm leading-none">⚠️</span>
                      <div>
                        <p className="font-bold text-amber-900">Medication Currently Held (ระงับชั่วคราว)</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Reason: <span className="font-medium text-slate-700">{selectedBooking.holdStatus.reason}</span>
                          {(selectedBooking.holdStatus.notifyingNurse || (selectedBooking.holdStatus as any).notifiedNurse) && (
                            <> | Notified by Nurse: <span className="font-medium text-slate-700">{selectedBooking.holdStatus.notifyingNurse || (selectedBooking.holdStatus as any).notifiedNurse}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {!selectedBooking.holdStatus?.isHeld && selectedBooking.holdStatus?.reason && (
                    <div className="flex items-start gap-2 text-emerald-800">
                      <span className="text-sm leading-none">🔄</span>
                      <div>
                        <p className="font-bold text-emerald-950">Medication Restored / Continued (คืนสถานะแล้ว)</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Unhold Reason: <span className="font-medium text-slate-705">{selectedBooking.holdStatus.unholdReason || selectedBooking.holdStatus.reason}</span>
                          {(selectedBooking.holdStatus.unholdNurse || selectedBooking.holdStatus.notifyingNurse || (selectedBooking.holdStatus as any).notifiedNurse) && (
                            <> | By Nurse: <span className="font-medium text-slate-705">{selectedBooking.holdStatus.unholdNurse || selectedBooking.holdStatus.notifyingNurse || (selectedBooking.holdStatus as any).notifiedNurse}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedBooking.rolloverStatus && (
                    <div className="flex items-start gap-2 text-purple-800 border-t border-slate-200/55 pt-2">
                      <span className="text-sm leading-none">📅</span>
                      <div>
                        <p className="font-bold text-purple-900">Rescheduled Rollover (เปลี่ยนวันบริหารให้ยา)</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Original Date: <span className="line-through">{formatDateToDMY(selectedBooking.rolloverStatus.originalDateOfUse || (selectedBooking.rolloverStatus as any).originalDate)}</span> ➡️ Rescheduled Date: <span className="font-bold text-purple-700">{formatDateToDMY(selectedBooking.rolloverStatus.newDateOfUse)}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Reason: <span className="font-medium text-slate-700">{selectedBooking.rolloverStatus.reason}</span>
                          {(selectedBooking.rolloverStatus.notifyingNurse || (selectedBooking.rolloverStatus as any).notifiedNurse) && (
                            <> | Reported by Nurse: <span className="font-medium text-slate-700">{selectedBooking.rolloverStatus.notifyingNurse || (selectedBooking.rolloverStatus as any).notifiedNurse}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Model Action footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-between items-center">
              <div>
                {currentUser?.role === 'Admin' && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>🗑️</span>
                    <span>{language === 'TH' ? 'ลบรายการ (Admin)' : 'Delete Order (Admin)'}</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-scale-up">
            <div className="p-5 bg-red-50 border-b border-red-100/60 flex items-center gap-3">
              <span className="text-xl">🚨</span>
              <div>
                <h3 className="font-bold text-sm text-red-950 uppercase tracking-tight">
                  {language === 'TH' ? 'ยืนยันลบข้อมูลการจองถาวร' : 'Confirm Clinical Delete'}
                </h3>
                <p className="text-[10px] text-red-600 font-medium mt-0.5 font-mono">
                  HN: {selectedBooking.hn} | {selectedBooking.patientName}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3 text-xs leading-relaxed text-slate-600 font-sans">
              <p className="font-semibold text-rose-700 text-xs">
                {language === 'TH'
                  ? '⚠️ คำเตือน: การกระทำนี้เป็นการลบข้อมูลการจองอย่างถาวรและไม่สามารถเรียกคืนได้!'
                  : '⚠️ Warning: This action is permanent and cannot be undone!'}
              </p>
              <p>
                {language === 'TH'
                  ? 'ประวัติคิวจองและรายการยาผู้ป่วยทั้งหมดจะถูกถอดถอนออกจากระบบหลักทันที'
                  : 'This patient clinical medication queue will be permanently expunged from RxNexus logs.'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = selectedBooking.id;
                  setShowDeleteConfirm(false);
                  setSelectedBooking(null);
                  await deleteBooking(id);
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md hover:shadow-lg active:scale-95 duration-150 cursor-pointer"
              >
                {language === 'TH' ? 'ยืนยันลบถาวร' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
