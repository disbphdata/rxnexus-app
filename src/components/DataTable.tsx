import React, { useState, useEffect, useRef, useDeferredValue } from 'react';
import { useApp } from '../context/AppContext';
import { i18n } from '../lib/i18n';
import { Booking, formatDateToDMY } from '../types';
import {
  Eye,
  CheckCircle,
  Clock,
  Trash,
  Edit,
  Check,
  Printer,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  X,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Ban,
  ClipboardCheck,
  ArrowRight,
  CornerDownRight,
  ExternalLink
} from 'lucide-react';

interface DataTableProps {
  onEditClick?: (id: string) => void;
  onPrintClick?: (booking: Booking) => void;
  initialSearchQuery?: string;
  searchResetTabNonce?: number;
  onSyncSearchQuery?: (query: string) => void;
}

export default function DataTable({
  onEditClick,
  onPrintClick,
  initialSearchQuery = '',
  searchResetTabNonce = 0,
  onSyncSearchQuery
}: DataTableProps) {
  const {
    currentUser,
    bookings,
    language,
    verifyPharmacist,
    rejectPharmacistVerification,
    reverifyPharmacist,
    requestCancelBooking,
    approveCancelBooking,
    rejectCancelBooking,
    markBorrowedMedReturned,
    verifyClerk,
    deleteBooking,
    updateBooking,
    loading,
    spawnAlert
  } = useApp();

  const t = i18n[language];

  // Selected classification tab: All vs General vs Oncology vs Hold vs Rejected vs CancelRequested
  const [activeTab, setActiveTab] = useState<'All' | 'General' | 'Oncology' | 'Hold' | 'Rejected' | 'CancelRequested'>('All');
  const deferredSearchQuery = useDeferredValue(initialSearchQuery.trim());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageZoom, setSelectedImageZoom] = useState<number>(1);
  const [verifyImageZoom, setVerifyImageZoom] = useState<number>(1);

  // Clinical Hold and Date Rescheduling (Rollover) triggers
  const [holdingBooking, setHoldingBooking] = useState<Booking | null>(null);
  const [unholdingBooking, setUnholdingBooking] = useState<Booking | null>(null);
  const [rollingBooking, setRollingBooking] = useState<Booking | null>(null);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);

  // Pharmacist verify modal states
  const [activeVerifyingBooking, setActiveVerifyingBooking] = useState<Booking | null>(null);
  const [verifyingLocation, setVerifyingLocation] = useState('');
  const [verifyingPharmacistName, setVerifyingPharmacistName] = useState('');
  const [isRejectingMode, setIsRejectingMode] = useState(false);
  const [rejectReasonPreset, setRejectReasonPreset] = useState('จองยาไม่ครบ (Incomplete Medication Booking)');
  const [rejectReasonCustom, setRejectReasonCustom] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  // Rejection details modal state (for user who booked to see why it was rejected)
  const [viewingRejectionBooking, setViewingRejectionBooking] = useState<Booking | null>(null);

  // Cancellation modal state (for all users to request cancellation with custom canceler name)
  const [cancelingBooking, setCancelingBooking] = useState<Booking | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState('แพทย์ปรับเปลี่ยนแผนการรักษา');
  const [cancelReasonCustom, setCancelReasonCustom] = useState('');
  const [cancelerName, setCancelerName] = useState('');

  const [holdReason, setHoldReason] = useState('');
  const [nurseName, setNurseName] = useState('');
  const [rolloverDate, setRolloverDate] = useState('');
  const [confirmingClerkBooking, setConfirmingClerkBooking] = useState<Booking | null>(null);
  const [clerkOperatorName, setClerkOperatorName] = useState('');
  const [clerkActionNote, setClerkActionNote] = useState('');

  const selectedImgZoomRef = useRef<HTMLDivElement | null>(null);
  const verifyImgZoomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (searchResetTabNonce > 0) {
      setActiveTab('All');
    }
  }, [searchResetTabNonce]);

  // Counts
  const rejectedCount = bookings.filter((b) => b.pharmacistVerification?.status === 'Rejected').length;
  const cancelReqCount = bookings.filter((b) => b.cancelStatus?.isRequested === true && !b.cancelStatus?.approved).length;

  const getOncoWaitingTime = (b: Booking) => {
    if (b.mode !== 'Oncology') return null;
    const startTimeStr = b.pharmacistVerification?.resubmittedAt || b.createdAt;
    if (!startTimeStr) return null;
    const startTime = new Date(startTimeStr).getTime();
    if (isNaN(startTime)) return null;

    if (b.pharmacistVerification?.status === 'Verified' && b.pharmacistVerification.verifiedAt) {
      const verifiedTime = new Date(b.pharmacistVerification.verifiedAt).getTime();
      const diffMs = Math.max(0, verifiedTime - startTime);
      const mins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      const timeStr = hrs > 0 ? `${hrs} ชม. ${remMins} นาที` : `${mins} นาที`;
      return {
        text: `Onco Waiting Time: ${timeStr} (Verified)`,
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        isVerified: true
      };
    } else {
      const now = Date.now();
      const diffMs = Math.max(0, now - startTime);
      const mins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      const timeStr = hrs > 0 ? `${hrs} ชม. ${remMins} นาที` : `${mins} นาที`;
      
      let colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (mins >= 30) {
        colorClass = 'bg-rose-50 text-rose-700 border-rose-300 font-extrabold animate-pulse';
      } else if (mins >= 15) {
        colorClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
      }
      return {
        text: `Onco รอ Verify: ${timeStr}`,
        colorClass,
        isVerified: false
      };
    }
  };

  // Filter queues
  const filteredBookings = bookings.filter((b) => {
    let belongsToTab = false;
    if (activeTab === 'All') {
      belongsToTab = true;
    } else if (activeTab === 'General' || activeTab === 'Oncology') {
      belongsToTab = b.mode === activeTab;
    } else if (activeTab === 'Hold') {
      belongsToTab = b.holdStatus?.isHeld === true;
    } else if (activeTab === 'Rejected') {
      belongsToTab = b.pharmacistVerification?.status === 'Rejected';
    } else if (activeTab === 'CancelRequested') {
      belongsToTab = b.cancelStatus?.isRequested === true && !b.cancelStatus?.approved;
    }

    const trimmedSearch = deferredSearchQuery;
    const matchesSearch =
      !trimmedSearch ||
      b.patientName.toLowerCase().includes(trimmedSearch.toLowerCase()) ||
      b.hn.replace(/-/g, '').includes(trimmedSearch.replace(/-/g, '')) ||
      b.hn.toLowerCase().includes(trimmedSearch.toLowerCase());

    if (!belongsToTab || !matchesSearch) return false;

    // When searching explicitly by HN or patient name, surface matching records across all dates
    if (trimmedSearch.length > 0) return true;

    // Check if within 5 days of use limit
    if (!b.dateOfUse) return true;
    try {
      const useDate = new Date(b.dateOfUse);
      useDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (useDate >= today) {
        return true;
      } else {
        const diffTime = today.getTime() - useDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 5;
      }
    } catch {
      return true;
    }
  });

  // Action validation based on User Roles
  const canVerifyAsPharmacist = currentUser?.role === 'Pharmacist' || currentUser?.role === 'Admin';
  const canVerifyAsClerk = currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.role === 'Admin';
  const canDeleteOrEdit = currentUser?.role === 'Admin' || currentUser?.role === 'Pharmacist' || currentUser?.role === 'Nurse' || currentUser?.role === 'Doctor';
  const canHoldAndRollover = currentUser?.role === 'Nurse' || currentUser?.role === 'Doctor' || currentUser?.role === 'Admin';

  const heldBookings = bookings.filter((b) => {
    const isHeld = b.holdStatus?.isHeld === true;
    const matchesSearch =
      !deferredSearchQuery ||
      b.patientName.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
      b.hn.replace(/-/g, '').includes(deferredSearchQuery.replace(/-/g, '')) ||
      b.hn.toLowerCase().includes(deferredSearchQuery.toLowerCase());
    return isHeld && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Full-width Category Tabs Bar (no horizontal scroll) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm">
        {/* Toggle tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-row lg:items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full gap-1.5">
          <button
            id="tab-all-btn"
            onClick={() => setActiveTab('All')}
            className={`lg:flex-1 px-3 py-2 font-semibold text-xs rounded-lg transition-all whitespace-nowrap flex items-center justify-center cursor-pointer ${
              activeTab === 'All'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {t.tabAll}
          </button>
          <button
            id="tab-general-btn"
            onClick={() => setActiveTab('General')}
            className={`lg:flex-1 px-3 py-2 font-semibold text-xs rounded-lg transition-all whitespace-nowrap flex items-center justify-center cursor-pointer ${
              activeTab === 'General'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {t.tabGeneral}
          </button>
          <button
            id="tab-oncology-btn"
            onClick={() => setActiveTab('Oncology')}
            className={`lg:flex-1 px-3 py-2 font-semibold text-xs rounded-lg transition-all whitespace-nowrap flex items-center justify-center cursor-pointer ${
              activeTab === 'Oncology'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {t.tabOncology}
          </button>
          <button
            id="tab-hold-btn"
            onClick={() => setActiveTab('Hold')}
            className={`lg:flex-1 px-3 py-2 font-semibold text-xs rounded-lg transition-all whitespace-nowrap flex items-center justify-center cursor-pointer ${
              activeTab === 'Hold'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {language === 'TH' ? 'รายการยา HOLD' : 'Held Medications'}
          </button>
          <button
            id="tab-rejected-btn"
            onClick={() => setActiveTab('Rejected')}
            className={`lg:flex-1 px-3 py-2 font-semibold text-xs rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'Rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{language === 'TH' ? 'Verify ไม่ผ่าน' : 'Not Approved'}</span>
            {rejectedCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'Rejected' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {rejectedCount}
              </span>
            )}
          </button>
          <button
            id="tab-cancel-req-btn"
            onClick={() => setActiveTab('CancelRequested')}
            className={`lg:flex-1 px-3 py-2 font-semibold text-xs rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'CancelRequested'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Ban className="w-3.5 h-3.5 shrink-0" />
            <span>{language === 'TH' ? 'คำขอยกเลิก' : 'Cancel Req'}</span>
            {cancelReqCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'CancelRequested' ? 'bg-white text-amber-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {cancelReqCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Clinically Held Medications Section - Visible under HOLD active tab */}
      {activeTab === 'Hold' ? (
        <div className="bg-white rounded-xl border border-red-200 shadow-xs overflow-hidden animate-fade-in-rapid">
          <div className="p-4 bg-rose-50 border-b border-rose-150 flex justify-between items-center bg-amber-50 border-amber-100">
            <h3 className="font-bold text-xs text-amber-800 uppercase tracking-tight flex items-center gap-2 font-sans">
              <span className="text-sm">⏸️</span>
              <span>{language === 'TH' ? 'รายการยา HOLD (พักใช้ชั่วคราว)' : 'Held Medications List'} ({heldBookings.length})</span>
            </h3>
          <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded leading-none uppercase font-sans">
            {language === 'TH' ? 'ระบบเฝ้าระวังยา' : 'Clinical Watchlist'}
          </span>
        </div>

        {heldBookings.length === 0 ? (
          <div className="p-5 text-center text-slate-400 font-medium text-[11px] bg-slate-50/10">
            {language === 'TH' ? 'ไม่มีรายการยาที่ถูกระงับ (Hold) ในขณะนี้' : 'No clinical medication bookings on clinical hold.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-550 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200">
                  <th className="p-3">ID</th>
                  <th className="p-3">{language === 'TH' ? 'คนไข้ / รหัส HN' : 'Patient / HN'}</th>
                  <th className="p-3">{language === 'TH' ? 'เหตุผลการ Hold' : 'Hold Reason'}</th>
                  <th className="p-3">{language === 'TH' ? 'พยาบาลผู้รับแจ้ง' : 'Notified Nurse'}</th>
                  <th className="p-3">{language === 'TH' ? 'วันที่ระงับ' : 'Hold Date'}</th>
                  {canHoldAndRollover && <th className="p-3 text-center">{language === 'TH' ? 'การจัดการ' : 'Action'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {heldBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/30">
                    <td className="p-3 font-semibold text-slate-600">{b.id}</td>
                    <td className="p-3 font-sans">
                      <span className="font-bold text-slate-800 block">{b.patientName}</span>
                      <span className="text-[9.5px] font-mono text-slate-400">HN: {b.hn}</span>
                    </td>
                    <td className="p-3 text-slate-700 bg-amber-50/20 max-w-xs truncate font-medium" title={b.holdStatus?.reason}>
                      {b.holdStatus?.reason || '-'}
                    </td>
                    <td className="p-3 font-bold text-slate-700">
                      👤 {b.holdStatus?.notifyingNurse || (b.holdStatus as any)?.notifiedNurse || '-'}
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[10px]">
                      {(b.holdStatus?.heldAt || (b.holdStatus as any)?.timestamp) ? (b.holdStatus.heldAt || (b.holdStatus as any).timestamp).substring(0, 16).replace('T', ' ') : '-'}
                    </td>
                    {canHoldAndRollover && (
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setUnholdingBooking(b);
                            setHoldReason('');
                            setNurseName('');
                            setRolloverDate(b.dateOfUse || '');
                          }}
                          className="px-2.5 py-1 text-[10px] inline-flex items-center justify-center font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs transition-colors cursor-pointer"
                        >
                          Continue (Unhold)
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      ) : (
        /* Main Ledger Table - Visible when Hold active tab is NOT selected */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-700 font-sans uppercase tracking-tight">
            {t.tableTitle} ({filteredBookings.length})
          </h3>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/20">
            <Clock className="w-10 h-10 text-slate-300 animate-pulse mb-3" />
            <p className="text-xs text-slate-400 font-medium">No pending or completed medication records found matching filters.</p>
            <p className="text-[10px] text-slate-300 mt-1">Ready to receive incoming clinical data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="p-4">{t.colBookingId}</th>
                  <th className="p-4">{t.colPatient}</th>
                  <th className="p-4">{t.colUseDate}</th>
                  <th className="p-4">{t.colMed}</th>
                  <th className="p-4">{t.colVerification}</th>
                  <th className="p-4 text-center">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
                  const clerkVerifiedValueDone = b.clerkVerification.status === 'Ready-to-use';
                  const phVerifiedValueDone = b.pharmacistVerification.status === 'Verified';

                  return (
                    <tr key={b.id} className={`hover:bg-slate-50/40 transition-all ${b.holdStatus?.isHeld ? 'bg-slate-100/70 opacity-75 border-l-4 border-l-amber-500 text-slate-400' : ''}`}>
                      {/* ID and time */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          {b.id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {language === 'TH' ? 'วันที่จอง' : 'Booked'}: {formatDateToDMY(b.bookingDate)}
                        </span>
                      </td>

                      {/* Patient and Hospital ID */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-slate-800 text-sm ${b.holdStatus?.isHeld ? 'text-slate-500 line-through' : ''}`}>
                            {b.patientName}
                          </span>
                          {clerkVerifiedValueDone && (
                            <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[11px]" title="Physically Delivered to Ward">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center text-[10px] text-slate-400 mt-1 text-xs">
                          {currentUser?.role === 'Pharmacist' || currentUser?.role === 'Admin' ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!phVerifiedValueDone) {
                                  setActiveVerifyingBooking(b);
                                  setVerifyingLocation(b.pharmacyLocation || '');
                                  setVerifyingPharmacistName(b.staff?.pharmacist || currentUser?.name || '');
                                } else {
                                  onSyncSearchQuery?.(b.hn);
                                  navigator.clipboard.writeText(b.hn);
                                  spawnAlert(language === 'TH' ? `คัดลอก HN: ${b.hn} และกรองข้อมูลเรียบร้อยแล้ว` : `Copied HN: ${b.hn} and filtered table!`, 'success');
                                }
                              }}
                              className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold tracking-wider whitespace-nowrap inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95 border ${
                                !phVerifiedValueDone
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-750 animate-pulse'
                                  : 'bg-slate-100/90 hover:bg-slate-200 text-slate-700 border-slate-200'
                              }`}
                              title={!phVerifiedValueDone ? (language === 'TH' ? "ด่วน: รอเภสัชกรตรวจสอบ คลิกเพื่อดำเนินการตรวจสอบทันที" : "Urgent: Awaiting pharmacist verification. Click to verify now!") : (language === 'TH' ? "คลิกเพื่อคัดลอก HN และกรองข้อมูลคนไข้" : "Click to copy HN and filter")}
                            >
                              {!phVerifiedValueDone && <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-ping shrink-0" />}
                              📋 HN: {b.hn} {!phVerifiedValueDone && (language === 'TH' ? ' (รอตรวจสอบ)' : ' (Awaiting Verify)')}
                            </button>
                          ) : (
                            <span className="font-mono bg-slate-100/90 text-slate-700 px-1.5 py-0.5 rounded text-[9.5px] font-bold tracking-wider whitespace-nowrap inline-block">HN: {b.hn}</span>
                          )}
                          <span>•</span>
                          <span className="uppercase">{b.medications[0]?.priceType || 'OPD'}</span>
                          <span>•</span>
                          <span>{b.department}</span>
                        </div>
                        {b.holdStatus?.isHeld && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap font-sans">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9.5px] font-black bg-amber-100 text-amber-800 border border-amber-250 leading-snug shadow-3xs">
                              <span>
                                ⏸️ Hold: {b.holdStatus.reason} ({b.holdStatus.notifyingNurse || (b.holdStatus as any).notifiedNurse})
                              </span>
                              {(b.holdStatus.heldAt || (b.holdStatus as any).timestamp) && (
                                <span className="font-mono text-[8.5px] text-amber-700 border-l border-amber-300 pl-1.5">
                                  {new Date(b.holdStatus.heldAt || (b.holdStatus as any).timestamp).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US')}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {b.rolloverStatus && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap font-sans">
                            <span className="inline-flex items-center gap-1.5 flex-wrap px-2 py-0.5 rounded text-[9.5px] font-black bg-purple-100 text-purple-800 border border-purple-250 leading-snug shadow-3xs">
                              <span>
                                📅 {language === 'TH' ? 'เลื่อนวันใช้ยา' : 'Rescheduled'}: {formatDateToDMY(b.rolloverStatus.originalDateOfUse || (b.rolloverStatus as any).originalDate)} ➡️ {formatDateToDMY(b.rolloverStatus.newDateOfUse || b.dateOfUse)} ({b.rolloverStatus.reason} | {b.rolloverStatus.notifyingNurse || (b.rolloverStatus as any).notifiedNurse})
                              </span>
                              {b.rolloverStatus.rolledOverAt && (
                                <span className="font-mono text-[8.5px] text-purple-700 border-l border-purple-300 pl-1.5">
                                  {new Date(b.rolloverStatus.rolledOverAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US')}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Date of use */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 text-[11px]">
                          {formatDateToDMY(b.dateOfUse)}
                        </span>
                        <p className="text-[10px] text-slate-400">Administration Date</p>
                      </td>

                      {/* Prescribed Items detail block */}
                      <td className="p-4 max-w-xs">
                        <div className="space-y-1">
                          {b.medications.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                              <span className="font-medium truncate max-w-[150px]">{item.drugName}</span>
                              <span className="font-semibold text-slate-800">x{item.quantity}</span>
                            </div>
                          ))}
                          <div className="text-right text-[10px] font-bold text-blue-600">
                            Total: ฿{b.totalAmount.toLocaleString()}
                          </div>
                          {b.regimen && (
                            <div className="text-left mt-1.5 pt-1.5 border-t border-slate-150">
                              <span className="font-bold text-indigo-800 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded-sm text-[9.5px] inline-block font-sans">
                                Regimen: <span className="font-medium text-indigo-950">{b.regimen}</span>
                              </span>
                            </div>
                          )}
                          {b.note && (
                            <div className="text-left mt-1.5 bg-slate-100/50 p-1.5 rounded border border-slate-200/50 text-[10.5px]">
                              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Note:</span>
                              <span className="text-slate-650 font-medium break-words block whitespace-pre-wrap">{b.note}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Verification Workflows */}
                      <td className="p-4">
                        <div className="flex flex-col gap-2 max-w-[200px]">
                          {/* Oncology Waiting Time Status Badge */}
                          {(() => {
                            const oncoWait = getOncoWaitingTime(b);
                            if (!oncoWait) return null;
                            return (
                              <div className={`text-[9.5px] px-2 py-0.5 rounded-md border font-bold flex items-center gap-1 shadow-3xs ${oncoWait.colorClass}`}>
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>{oncoWait.text}</span>
                              </div>
                            );
                          })()}

                          {/* Pharmacist validation status */}
                          {b.pharmacistVerification?.status === 'Rejected' ? (
                            <div className="flex flex-col gap-1 w-full font-sans">
                              <div className="flex items-center justify-between text-[10px] p-1.5 rounded-lg border bg-rose-50 border-rose-300 text-rose-800 font-bold">
                                <span className="flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>{language === 'TH' ? 'Verify ไม่ผ่าน' : 'Not Approved'}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setViewingRejectionBooking(b)}
                                  className="text-[9.5px] font-bold underline text-rose-700 hover:text-rose-900 ml-1 cursor-pointer"
                                  title="ดูเหตุผลที่ไม่ผ่าน"
                                >
                                  {language === 'TH' ? 'ดูเหตุผล' : 'Reason'}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => onEditClick && onEditClick(b.id)}
                                className="w-full py-1 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                              >
                                <Edit className="w-3 h-3" />
                                <span>{language === 'TH' ? 'แก้ไขเพื่อจองใหม่' : 'Edit & Re-submit'}</span>
                              </button>
                            </div>
                          ) : b.pharmacistVerification?.reverifyRequested ? (
                            <div className="flex flex-col gap-1 font-sans">
                              <div className="flex items-center justify-between text-[10px] p-1.5 rounded-lg border bg-purple-50 border-purple-300 text-purple-800 font-bold">
                                <span className="flex items-center gap-1">
                                  <RotateCcw className="w-3.5 h-3.5 text-purple-600 shrink-0 animate-spin" />
                                  <span>{language === 'TH' ? 'แก้ไขแล้ว (รอ Re-verify)' : 'Pending Re-verify'}</span>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="group relative flex flex-col gap-0.5 text-[10px] p-1.5 rounded-lg border bg-white border-slate-250 cursor-help"
                              title={
                                phVerifiedValueDone
                                  ? `Verified By: ${b.pharmacistVerification.verifiedBy}\nTime: ${new Date(b.pharmacistVerification.verifiedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US')}`
                                  : 'Pending pharmacist verification'
                              }
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-medium">{t.valPharmacist}:</span>
                                {phVerifiedValueDone ? (
                                  <span className="text-green-600 font-bold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> {t.accepted}
                                  </span>
                                ) : (
                                  <span className="text-amber-500 font-bold flex items-center gap-1">
                                    <Clock className="w-3 h-3 animate-pulse" /> {t.notVerified}
                                  </span>
                                )}
                              </div>
                              {phVerifiedValueDone && b.pharmacistVerification.verifiedBy && (
                                <div className="text-[9px] text-emerald-700 font-semibold flex items-center justify-between border-t border-slate-100 pt-0.5">
                                  <span className="truncate max-w-[115px]">โดย: {b.pharmacistVerification.verifiedBy}</span>
                                  {b.pharmacistVerification.verifiedAt && (
                                    <span className="font-mono text-[8.5px] text-slate-400">
                                      {new Date(b.pharmacistVerification.verifiedAt).toLocaleTimeString(language === 'TH' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Custom visual tooltip on hover */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-xs bg-slate-900/95 text-white text-[10px] p-2 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none border border-slate-800 font-sans leading-relaxed">
                                {phVerifiedValueDone ? (
                                  <div className="space-y-1">
                                    <p className="font-bold border-b border-white/10 pb-1 text-green-400 text-left">✓ Pharmacist Approved</p>
                                    <p className="text-left"><span className="text-slate-300">By:</span> {b.pharmacistVerification.verifiedBy}</p>
                                    <p className="text-left"><span className="text-slate-300">Time:</span> {b.pharmacistVerification.verifiedAt ? new Date(b.pharmacistVerification.verifiedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US') : '-'}</p>
                                  </div>
                                ) : (
                                  <p className="text-amber-400 font-medium text-left">Awaiting pharmacist validation</p>
                                )}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900/95" />
                              </div>
                            </div>
                          )}

                          {/* Stock Confirmation 2-Step Status & Timestamps */}
                          <div 
                            className="group relative flex flex-col gap-0.5 text-[10px] p-1.5 rounded-lg border bg-white border-slate-250 cursor-help"
                            title={
                              clerkVerifiedValueDone
                                ? `1. สั่งซื้อโดย: ${b.clerkVerification.orderedBy || '-'} (${b.clerkVerification.orderedAt ? new Date(b.clerkVerification.orderedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US') : '-'})\n2. ของมาถึงโดย: ${b.clerkVerification.verifiedBy || '-'} (${b.clerkVerification.verifiedAt ? new Date(b.clerkVerification.verifiedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US') : '-'})`
                                : b.clerkVerification?.status === 'Accepted'
                                ? `1. สั่งซื้อโดย: ${b.clerkVerification.orderedBy || '-'} (${b.clerkVerification.orderedAt ? new Date(b.clerkVerification.orderedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US') : '-'})\nรอของมาส่งจริง`
                                : phVerifiedValueDone
                                ? 'รอคลังกดยืนยันสั่งซื้อยา (ขั้นที่ 1)'
                                : 'รอเภสัชกรทวนสอบใบสั่งยาก่อน'
                            }
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 font-medium">Stock:</span>
                              {clerkVerifiedValueDone ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> {language === 'TH' ? 'ของมาถึงแล้ว' : 'Arrived'}
                                </span>
                              ) : b.clerkVerification?.status === 'Accepted' ? (
                                <span className="text-indigo-600 font-bold flex items-center gap-1 animate-pulse">
                                  <Clock className="w-3 h-3 text-indigo-500" /> {language === 'TH' ? 'ยืนยันสั่งซื้อแล้ว' : 'Ordered'}
                                </span>
                              ) : phVerifiedValueDone ? (
                                <span className="text-amber-600 font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3 animate-pulse" /> {language === 'TH' ? 'รอยืนยันสั่งซื้อ' : 'Pending Order'}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-semibold flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {language === 'TH' ? 'รอเภสัชทวนสอบ' : 'Awaiting Rx'}
                                </span>
                              )}
                            </div>

                            {(b.clerkVerification?.orderedAt || b.clerkVerification?.verifiedAt) && (
                              <div className="text-[8.5px] text-slate-500 border-t border-slate-100 pt-0.5 space-y-0.5 font-mono">
                                {b.clerkVerification.orderedAt && (
                                  <div className="flex justify-between gap-1">
                                    <span className="truncate text-indigo-700 font-sans font-semibold">
                                      1. สั่ง: {b.clerkVerification.orderedBy || '-'}
                                    </span>
                                    <span className="shrink-0">
                                      {new Date(b.clerkVerification.orderedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                )}
                                {clerkVerifiedValueDone && b.clerkVerification.verifiedAt && (
                                  <div className="flex justify-between gap-1 text-emerald-700 font-bold">
                                    <span className="truncate font-sans">
                                      2. ถึง: {b.clerkVerification.verifiedBy || '-'}
                                    </span>
                                    <span className="shrink-0">
                                      {new Date(b.clerkVerification.verifiedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Custom visual tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-xs bg-slate-900/95 text-white text-[10px] p-2.5 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none border border-slate-800 font-sans leading-relaxed">
                              {clerkVerifiedValueDone ? (
                                <div className="space-y-1 text-left">
                                  <p className="font-bold border-b border-white/10 pb-1 text-emerald-400">✓ ยืนยันครบ 2 ขั้นตอน (ของมาถึงแล้ว)</p>
                                  <p><span className="text-slate-300">1. ยืนยันสั่งซื้อ:</span> {b.clerkVerification.orderedBy || 'Staff'}</p>
                                  <p><span className="text-slate-300">เวลาสั่งซื้อ:</span> {b.clerkVerification.orderedAt ? new Date(b.clerkVerification.orderedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US') : '-'}</p>
                                  {b.clerkVerification.orderNote && <p><span className="text-slate-300">หมายเหตุสั่งซื้อ:</span> {b.clerkVerification.orderNote}</p>}
                                  <p className="border-t border-white/10 my-1 pt-1"><span className="text-slate-300">2. ยืนยันของมาถึง:</span> {b.clerkVerification.verifiedBy}</p>
                                  <p><span className="text-slate-300">เวลาของถึง:</span> {b.clerkVerification.verifiedAt ? new Date(b.clerkVerification.verifiedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US') : '-'}</p>
                                  {b.clerkVerification.arrivalNote && <p><span className="text-slate-300">หมายเหตุรับของ:</span> {b.clerkVerification.arrivalNote}</p>}
                                </div>
                              ) : b.clerkVerification?.status === 'Accepted' ? (
                                <div className="space-y-1 text-left">
                                  <p className="font-bold border-b border-white/10 pb-1 text-indigo-400">1. ยืนยันการสั่งซื้อยาแล้ว</p>
                                  <p><span className="text-slate-300">ผู้ยืนยัน:</span> {b.clerkVerification.orderedBy || 'Staff'}</p>
                                  <p><span className="text-slate-300">เวลา:</span> {b.clerkVerification.orderedAt ? new Date(b.clerkVerification.orderedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US') : '-'}</p>
                                  {b.clerkVerification.orderNote && <p><span className="text-slate-300">หมายเหตุ:</span> {b.clerkVerification.orderNote}</p>}
                                  <p className="text-amber-400 font-medium pt-1">รอการกดยืนยันครั้งที่ 2 เมื่อของมาถึง...</p>
                                </div>
                              ) : phVerifiedValueDone ? (
                                <p className="text-amber-400 font-medium text-left">เภสัชทวนสอบแล้ว · รอคลังกดยืนยันสั่งซื้อ (ขั้น 1)</p>
                              ) : (
                                <p className="text-slate-300 font-medium text-left">รอเภสัชกรทวนสอบรายการยาก่อนดำเนินการคลัง</p>
                              )}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900/95" />
                            </div>
                          </div>

                          {/* Cancellation Status Banner */}
                          {b.cancelStatus?.isRequested && !b.cancelStatus?.approved && (
                            <div className="flex flex-col gap-1 bg-amber-50 border border-amber-300 p-2 rounded-lg text-[9.5px] font-sans">
                              <span className="font-extrabold text-amber-800 flex items-center gap-1">
                                <Ban className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>{language === 'TH' ? 'คำขอยกเลิก (Request on process)' : 'Cancel Requested'}</span>
                              </span>
                              <p className="text-amber-900 font-medium leading-tight">
                                {language === 'TH' ? 'เหตุผล' : 'Reason'}: <span className="font-bold">{b.cancelStatus.reason}</span>
                              </p>
                              <p className="text-slate-600 text-[9px]">
                                {language === 'TH' ? 'ผู้ลงชื่อขอยกเลิก' : 'Signed By'}: <span className="font-bold text-slate-800">{b.cancelStatus.requestedByName}</span>
                              </p>
                              {(currentUser?.role === 'Admin' || currentUser?.role === 'Pharmacist') && (
                                <div className="flex gap-1 mt-1 pt-1 border-t border-amber-200">
                                  <button
                                    type="button"
                                    onClick={() => approveCancelBooking(b.id)}
                                    className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[9px] cursor-pointer shadow-3xs flex items-center justify-center gap-0.5"
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    <span>{language === 'TH' ? 'อนุมัติยกเลิก' : 'Approve'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => rejectCancelBooking(b.id)}
                                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold text-[9px] cursor-pointer"
                                  >
                                    {language === 'TH' ? 'ปฏิเสธ' : 'Reject'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {b.cancelStatus?.approved && (
                            <div className="text-[10px] px-2 py-1 rounded-lg bg-rose-100 text-rose-800 font-black border border-rose-300 text-center uppercase flex items-center justify-center gap-1 shadow-3xs">
                              <Ban className="w-3.5 h-3.5 text-rose-600" />
                              <span>{language === 'TH' ? 'ยกเลิกรายการแล้ว' : 'Cancelled'}</span>
                            </div>
                          )}

                          {/* Borrowed Medication Pending Return Alerts (Borrower Side) */}
                          {b.borrowInfo && b.borrowInfo.some(m => !m.returned) && (
                            <div className="bg-amber-100/90 border border-amber-300 p-2 rounded-lg text-[9.5px] space-y-1 font-sans">
                              <span className="font-extrabold text-amber-900 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>{language === 'TH' ? 'ยืมยาคนอื่น (รอจองคืน)' : 'Borrowed Med (Pending Return)'}</span>
                              </span>
                              {b.borrowInfo.map((item, bIdx) => {
                                if (item.returned) return null;
                                return (
                                  <div key={bIdx} className="text-amber-800 font-medium bg-white/80 p-1.5 rounded border border-amber-200">
                                    <div className="font-bold text-slate-800">• {item.borrowedDrugName} x{item.quantity}</div>
                                    <div className="text-[9px] text-slate-600">
                                      {language === 'TH' ? 'ยืมมาจาก' : 'Borrowed from'} HN: <span className="font-bold font-mono text-blue-700">{item.borrowedFromHn}</span>
                                      {item.borrowedFromPatientName ? ` (${item.borrowedFromPatientName})` : ''}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onEditClick) {
                                          localStorage.setItem('rxnexus_prefill_borrow_return', JSON.stringify({
                                            targetHn: item.borrowedFromHn,
                                            patientName: item.borrowedFromPatientName || '',
                                            drugId: item.borrowedDrugId,
                                            drugName: item.borrowedDrugName,
                                            quantity: item.quantity,
                                            originalBookingId: b.id,
                                            borrowIndex: bIdx
                                          }));
                                          onEditClick('NEW_BORROW_RETURN');
                                        }
                                      }}
                                      className="mt-1 w-full py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
                                    >
                                      <ArrowRight className="w-2.5 h-2.5" />
                                      <span>{language === 'TH' ? `จองยาคืน HN ${item.borrowedFromHn}` : `Book Return`}</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Donor/Lender HN Alert Badge (When another patient borrowed from this HN - REQ-14/15) */}
                          {(() => {
                            const normalizedSelfHn = (b.hn || '').replace(/\D/g, '');
                            if (!normalizedSelfHn) return null;
                            const lentRecords: Array<{ borrowerBooking: Booking; item: any; bIdx: number }> = [];
                            bookings.forEach((other) => {
                              if (other.id === b.id || other.cancelStatus?.approved) return;
                              (other.borrowInfo || []).forEach((bi, idx) => {
                                const donorMatch = (bi.borrowedFromHn || '').replace(/\D/g, '') === normalizedSelfHn;
                                const drugMatch = b.medications.some((m) => m.drugId === bi.borrowedDrugId);
                                if (!bi.returned && donorMatch && drugMatch) {
                                  lentRecords.push({ borrowerBooking: other, item: bi, bIdx: idx });
                                }
                              });
                            });
                            if (lentRecords.length === 0) return null;
                            return (
                              <div className="bg-orange-100/95 border border-orange-350 p-2 rounded-lg text-[9.5px] space-y-1 font-sans">
                                <span className="font-extrabold text-orange-900 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0 animate-pulse" />
                                  <span>{language === 'TH' ? 'ถูกยืมยาไปใช้ (รอจองคืน)' : 'Med Lent Out (Return Needed)'}</span>
                                </span>
                                {lentRecords.map(({ borrowerBooking, item, bIdx }, rIdx) => (
                                  <div key={rIdx} className="bg-white/85 p-1.5 rounded border border-orange-200 text-orange-900">
                                    <div className="font-bold text-slate-800">• {item.borrowedDrugName} x{item.quantity}</div>
                                    <div className="text-[9px] text-slate-600">
                                      {language === 'TH' ? 'ผู้ขอยืม' : 'Borrowed by'}: <span className="font-bold">{borrowerBooking.patientName}</span> ({borrowerBooking.hn})
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onEditClick) {
                                          localStorage.setItem('rxnexus_prefill_borrow_return', JSON.stringify({
                                            targetHn: b.hn,
                                            patientName: b.patientName,
                                            drugId: item.borrowedDrugId,
                                            drugName: item.borrowedDrugName,
                                            quantity: item.quantity,
                                            originalBookingId: borrowerBooking.id,
                                            borrowIndex: bIdx
                                          }));
                                          onEditClick('NEW_BORROW_RETURN');
                                        }
                                      }}
                                      className="mt-1 w-full py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold text-[9px] flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
                                    >
                                      <ArrowRight className="w-2.5 h-2.5" />
                                      <span>{language === 'TH' ? `จองยาคืนให้ HN นี้` : `Book Return for HN`}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Interactive Controls */}
                      <td className="p-4 text-center">
                        <div className="flex gap-2 justify-center items-center font-sans flex-wrap">
                          {/* Image preview modal launcher */}
                          {b.prescriptionImage ? (
                            <button
                              type="button"
                              onClick={() => setSelectedImage(b.prescriptionImage)}
                              className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Preview prescription scan"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-medium font-mono">Rx</span>
                            </button>
                          ) : b.imageClearedAt ? (
                            <span
                              className="p-1 px-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg font-medium cursor-help"
                              title={
                                language === 'TH'
                                  ? `ล้างเฉพาะรูปเพื่อประหยัดพื้นที่เมื่อ ${new Date(b.imageClearedAt).toLocaleDateString('th-TH')} (ประวัติการจองอยู่ครบ)`
                                  : `Image cleared on ${new Date(b.imageClearedAt).toLocaleDateString('en-US')} (record preserved)`
                              }
                            >
                              {language === 'TH' ? 'ล้างรูปแล้ว' : 'Img Cleared'}
                            </span>
                          ) : (
                            <span className="p-1 px-2 text-[10px] text-slate-300 bg-slate-50 rounded-lg cursor-not-allowed">
                              No Rx Image
                            </span>
                          )}

                          {/* Print PDF Action */}
                          {onPrintClick && (
                            <div className="flex flex-col gap-1 items-stretch">
                              <button
                                type="button"
                                id={`print-pdf-${b.id}`}
                                onClick={() => {
                                  updateBooking(b.id, { pdfPrinted: true });
                                  onPrintClick(b);
                                }}
                                className={`p-1.5 px-3.5 flex items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors overflow-hidden ${
                                  b.pdfPrinted 
                                    ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                                }`}
                                title="Print / Generate PDF Slip"
                              >
                                <Printer className="w-3.5 h-3.5 text-blue-500" />
                                <span>PDF</span>
                                {b.pdfPrinted && <CheckCircle className="w-3 h-3 text-blue-500" />}
                              </button>
                            </div>
                          )}

                          {/* Verify or Re-verify as pharmacist trigger */}
                          {canVerifyAsPharmacist && (!phVerifiedValueDone || b.pharmacistVerification?.status === 'Rejected') && (
                            <button
                              id={`verify-pharmacist-${b.id}`}
                              type="button"
                              onClick={() => {
                                setActiveVerifyingBooking(b);
                                setVerifyingLocation(b.pharmacyLocation || '');
                                setVerifyingPharmacistName(b.staff?.pharmacist || currentUser?.name || '');
                                setIsRejectingMode(false);
                              }}
                              disabled={loading}
                              className={`p-1 px-2.5 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1 ${
                                b.pharmacistVerification?.reverifyRequested || b.pharmacistVerification?.status === 'Rejected'
                                  ? 'bg-purple-600 hover:bg-purple-700'
                                  : 'bg-blue-500 hover:bg-blue-600'
                              }`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>
                                {b.pharmacistVerification?.reverifyRequested || b.pharmacistVerification?.status === 'Rejected'
                                  ? 'Re-verify Rx'
                                  : 'Verify Rx'}
                              </span>
                            </button>
                          )}

                          {/* Stock 2-Step Confirmation Trigger (1. Confirm Purchase Order -> 2. Confirm Arrived) */}
                          {!b.cancelStatus?.approved && canVerifyAsClerk && phVerifiedValueDone && !clerkVerifiedValueDone && (
                            <button
                              id={`verify-clerk-${b.id}`}
                              type="button"
                              onClick={() => {
                                setConfirmingClerkBooking(b);
                                setClerkOperatorName(currentUser?.name || '');
                                setClerkActionNote('');
                              }}
                              disabled={loading}
                              className={`p-1 px-2.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs text-white flex items-center gap-1 ${
                                b.clerkVerification?.status === 'Accepted'
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                              title={
                                b.clerkVerification?.status === 'Accepted'
                                  ? 'กดยืนยันครั้งที่ 2 เมื่อของมาถึงจริง (เปิด Shortcut Detail)'
                                  : 'กดยืนยันครั้งแรกเพื่อสั่งซื้อยาจริง (เปิด Shortcut Detail)'
                              }
                            >
                              <ClipboardCheck className="w-3 h-3" />
                              <span>
                                {b.clerkVerification?.status === 'Accepted'
                                  ? (language === 'TH' ? 'ยืนยันของมาถึง (2/2)' : 'Confirm Arrived (2/2)')
                                  : (language === 'TH' ? 'ยืนยันการสั่งซื้อ (1/2)' : 'Confirm Order (1/2)')}
                              </span>
                            </button>
                          )}

                          {/* Cancel booking trigger accessible to ALL user roles */}
                          {!b.cancelStatus?.approved && !b.cancelStatus?.isRequested && (
                            <button
                              type="button"
                              id={`cancel-booking-btn-${b.id}`}
                              onClick={() => {
                                setCancelingBooking(b);
                                setCancelReasonPreset('แพทย์ปรับเปลี่ยนแผนการรักษา');
                                setCancelReasonCustom('');
                                setCancelerName(currentUser?.name || '');
                              }}
                              className="p-1 px-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-md text-[9.5px] font-bold transition-all cursor-pointer flex items-center gap-0.5"
                              title="ขอยกเลิกรายการจองยา (Request Cancellation)"
                            >
                              <Ban className="w-3 h-3 text-rose-500" />
                              <span>{language === 'TH' ? 'ขอยกเลิก' : 'Cancel'}</span>
                            </button>
                          )}

                          {/* Staff modification tools */}
                          {canDeleteOrEdit && (
                            <div className="flex gap-1 items-center border-l border-slate-200 pl-2">
                              {onEditClick && (
                                <button
                                  type="button"
                                  onClick={() => onEditClick(b.id)}
                                  className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                  title="Edit reservation request"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {currentUser?.role === 'Admin' && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingBookingId(b.id)}
                                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                  title="Delete patient queue line"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Doctor & Nurse Clinical Hold + Rollover Option Choices */}
                          {canHoldAndRollover && (
                            <div className="flex gap-1.5 items-center border-l border-slate-200 pl-2 font-sans">
                              {!b.holdStatus?.isHeld ? (
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHoldingBooking(b);
                                      setHoldReason('');
                                      setNurseName('');
                                    }}
                                    className="p-1 px-1.5 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded text-[9.5px] font-black uppercase leading-none cursor-pointer"
                                    title="Hold medication queue"
                                  >
                                    Hold
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRollingBooking(b);
                                      setHoldReason('');
                                      setRolloverDate(b.dateOfUse);
                                      setNurseName('');
                                    }}
                                    className="p-1 px-1.5 border border-purple-250 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded text-[9.5px] font-black uppercase leading-none cursor-pointer"
                                    title="Change administration date"
                                  >
                                    {language === 'TH' ? 'เปลี่ยนวัน' : 'Rollover'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUnholdingBooking(b);
                                    setHoldReason('');
                                    setNurseName('');
                                    setRolloverDate(b.dateOfUse || '');
                                  }}
                                  className="p-1 px-1.5 border border-emerald-250 text-emerald-700 bg-emerald-55/70 hover:bg-emerald-100 rounded text-[9.5px] font-black uppercase leading-none cursor-pointer"
                                  title="Continue dispensing flow"
                                >
                                  Continue
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Embedded Prescription Preview Popup Modal with Zoom */}
      {selectedImage && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-fade-in" onClick={() => { setSelectedImage(null); setSelectedImageZoom(1); }}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
              <h3 className="font-bold text-xs text-slate-700">Enterprise Prescription Media Attachment</h3>
              
              <div className="flex items-center gap-2">
                {/* Zoom controls */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedImageZoom((prev) => Math.max(0.5, prev - 0.25))}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-bold text-blue-600 min-w-[40px] text-center text-[11px]">
                    {Math.round(selectedImageZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedImageZoom((prev) => Math.min(4, prev + 0.25))}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                    title="Zoom In (+)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedImageZoom(1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Reset (100%)"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelectedImage(null); setSelectedImageZoom(1); }}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div 
              ref={(el) => {
                if (el && el !== selectedImgZoomRef.current) {
                  selectedImgZoomRef.current = el;
                  el.addEventListener(
                    'wheel',
                    (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.deltaY < 0) {
                        setSelectedImageZoom((prev) => Math.min(4, prev + 0.2));
                      } else {
                        setSelectedImageZoom((prev) => Math.max(0.5, prev - 0.2));
                      }
                    },
                    { passive: false }
                  );
                }
              }}
              className="p-6 overflow-auto flex items-center justify-center bg-slate-900 min-h-[350px] relative"
            >
              <img
                src={selectedImage}
                alt="System Prescription Scan Viewer"
                className="max-h-[65vh] object-contain rounded-lg shadow-md border border-slate-800 transition-transform duration-150 ease-out cursor-grab active:cursor-grabbing"
                style={{ transform: `scale(${selectedImageZoom})` }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
              <span>Sourced digitally under RxNexus Patient Privacy framework</span>
              <span className="font-mono text-slate-400">{language === 'TH' ? 'ใช้ลูกกลิ้งเมาส์หรือปุ่มเพื่อย่อ-ขยาย' : 'Use mouse wheel or buttons to zoom'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Hold Medication Modal Popup */}
      {holdingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-sm text-amber-800 uppercase flex items-center gap-2">
              <span className="text-base">⚠️</span> {language === 'TH' ? 'Hold รายการยา' : 'Hold Medication'}
            </h3>
            <p className="text-[11.5px] text-slate-550 leading-normal">
              {language === 'TH' 
                ? `ระงับการสั่งและจ่ายยาชั่วคราวสำหรับคิวผู้ป่วย ${holdingBooking.patientName} (HN: ${holdingBooking.hn}) กรุณาระบุรายละเอียดและชื่อพยาบาล`
                : `Temporarily suspend medication dispensation for patient ${holdingBooking.patientName} (HN: ${holdingBooking.hn}).`
              }
            </p>
            
            <div className="space-y-3 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-705 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ระบุเหตุผลการ Hold *' : 'Hold Reason *'}
                </label>
                <input
                  type="text"
                  required
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder={language === 'TH' ? 'ระบุเหตุผล (เช่น อยู่ระหว่างปรึกษาแพทย์ปอด, ค่าเลือดต่ำ)' : 'dosage review, nurse advised, etc.'}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-705 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ชื่อพยาบาลที่แจ้ง (ผู้รับแจ้งความประสงค์) *' : 'Notifying Nurse Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={nurseName}
                  onChange={(e) => setNurseName(e.target.value)}
                  placeholder={language === 'TH' ? 'พยาบาลผู้รับแจ้งความประสงค์' : 'Reporting nurse name'}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setHoldingBooking(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!holdReason.trim() || !nurseName.trim()}
                onClick={() => {
                  updateBooking(holdingBooking.id, {
                    holdStatus: {
                      isHeld: true,
                      reason: holdReason,
                      notifyingNurse: nurseName,
                      heldAt: new Date().toISOString()
                    }
                  });
                  setHoldingBooking(null);
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                {language === 'TH' ? 'ระงับสั่งใช้ยา (Hold)' : 'Confirm Hold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Unhold / Resume Modal Popup */}
      {unholdingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-sm text-emerald-800 uppercase flex items-center gap-2">
              <span className="text-base">🔄</span> {language === 'TH' ? 'ดำเนินการให้ยาต่อ (Unhold)' : 'Continue (Unhold) Medication'}
            </h3>
            <p className="text-[11.5px] text-slate-550 leading-normal">
              {language === 'TH'
                ? `เริ่มดำเนินการจ่ายยาต่อตามปกติสำหรับผู้ป่วย ${unholdingBooking.patientName} (HN: ${unholdingBooking.hn})`
                : `Restore and continue clinical dispensation for ${unholdingBooking.patientName} (HN: ${unholdingBooking.hn}).`
              }
            </p>

            <div className="space-y-3 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-705 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ปรับเปลี่ยนวันที่บริหารให้ยา (เลือกวันที่ใหม่เพื่ออัปเดตปฏิทิน) *' : 'Reschedule Date of Use (select new date to update calendar) *'}
                </label>
                <input
                  type="date"
                  required
                  value={rolloverDate}
                  onChange={(e) => setRolloverDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-705 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ระบุเหตุผลในการคืนสถานะ (Unhold) *' : 'Unhold Reason *'}
                </label>
                <input
                  type="text"
                  required
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder={language === 'TH' ? 'เช่น ตรวจสอบแผนการรักษาเสร็จสิ้น, ผลเลือดปกติแล้ว' : 'postponement resolved, doctor approved, etc.'}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-705 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ชื่อพยาบาลผู้รับแจ้งคืนสถานะ *' : 'Reporting Nurse Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={nurseName}
                  onChange={(e) => setNurseName(e.target.value)}
                  placeholder={language === 'TH' ? 'พยาบาลผู้แจ้ง / ผู้รับประสงค์' : 'Nurse name'}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setUnholdingBooking(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!rolloverDate || !holdReason.trim() || !nurseName.trim()}
                onClick={() => {
                  updateBooking(unholdingBooking.id, {
                    dateOfUse: rolloverDate,
                    holdStatus: {
                      isHeld: false,
                      reason: unholdingBooking.holdStatus?.reason || '',
                      notifyingNurse: unholdingBooking.holdStatus?.notifyingNurse || '',
                      heldAt: unholdingBooking.holdStatus?.heldAt || new Date().toISOString(),
                      unholdReason: holdReason,
                      unholdNurse: nurseName,
                      unheldAt: new Date().toISOString()
                    }
                  });
                  setUnholdingBooking(null);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                {language === 'TH' ? 'ยืนยันจ่ายต่อ' : 'Confirm Unhold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Reschedule Date (Rollover) Modal Popup */}
      {rollingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-sm text-purple-800 uppercase flex items-center gap-2">
              <span className="text-base">📅</span> {language === 'TH' ? 'เปลี่ยนวันบริหารให้ยา / Rollover' : 'Rollover Medication Date'}
            </h3>
            <p className="text-[11.5px] text-slate-550 leading-normal">
              {language === 'TH'
                ? `เปลี่ยนวันบริหารการให้ยาจริงสำหรับคนไข้ ${rollingBooking.patientName} (HN: ${rollingBooking.hn})`
                : `Reschedule administration target date for ${rollingBooking.patientName} (HN: ${rollingBooking.hn}).`
              }
            </p>

            <div className="space-y-3 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-705 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ระบุวันที่ต้องการจัดใช้ใหม่ *' : 'New Date of Use *'}
                </label>
                <input
                  type="date"
                  required
                  value={rolloverDate}
                  onChange={(e) => setRolloverDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-purple-500/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-705 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ระบุสาเหตุการเปลี่ยนวันที่บริหารยา *' : 'Rollover Reason *'}
                </label>
                <input
                  type="text"
                  required
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder={language === 'TH' ? 'เช่น ผลข้างเคียงไข้สูงเลื่อนนัด, นัดจองทำแล็บเลื่อน, เกล็ดเลือดไม่ผ่านเกณฑ์' : 'Enter rollover triggers (e.g. platelets count post-dose low)'}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-purple-500/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-705 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ชื่อพยาบาลผู้สังเกตการณ์แจ้งประสานงาน *' : 'Notifying Nurse Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={nurseName}
                  onChange={(e) => setNurseName(e.target.value)}
                  placeholder={language === 'TH' ? 'ชื่อพยาบาลผู้ประสานงาน' : 'Nurse coordinator name'}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-purple-500/20 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRollingBooking(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!rolloverDate || !holdReason.trim() || !nurseName.trim()}
                onClick={() => {
                  updateBooking(rollingBooking.id, {
                    dateOfUse: rolloverDate,
                    pharmacistVerification: {
                      status: 'Pending',
                      verifiedBy: '',
                      verifiedAt: ''
                    },
                    rolloverStatus: {
                      originalDateOfUse: rollingBooking.dateOfUse,
                      newDateOfUse: rolloverDate,
                      reason: holdReason,
                      notifyingNurse: nurseName,
                      rolledOverAt: new Date().toISOString()
                    }
                  });
                  setRollingBooking(null);
                }}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                {language === 'TH' ? 'ยืนยันเลื่อนนัดยา' : 'Confirm Rollover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Side-by-Side Pharmacist Verification Modal */}
      {activeVerifyingBooking && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
            
            {/* Left Side: Prescription Scan (Picture Left) */}
            <div className="flex-1 bg-slate-50 p-5 flex flex-col justify-between border-r border-slate-100 overflow-y-auto max-h-[45vh] md:max-h-none">
              <div className="mb-3 flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {language === 'TH' ? 'รูปภาพใบสั่งยาต้นฉบับ / PRESCRIPTION IMAGE' : 'PRESCRIPTION DOCUMENT SCAN'}
                </span>
                
                {activeVerifyingBooking.prescriptionImage && (
                  <div className="flex items-center gap-1.5">
                    {/* Zoom Bar */}
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs shadow-3xs">
                      <button
                        type="button"
                        onClick={() => setVerifyImageZoom((prev) => Math.max(0.5, prev - 0.25))}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                        title="Zoom Out (-)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-bold text-blue-600 min-w-[38px] text-center text-[10px]">
                        {Math.round(verifyImageZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setVerifyImageZoom((prev) => Math.min(4, prev + 0.25))}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                        title="Zoom In (+)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerifyImageZoom(1)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Reset (100%)"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[9px] bg-blue-50 text-blue-700 font-mono font-bold">
                      {activeVerifyingBooking.id}
                    </span>
                  </div>
                )}
              </div>
              
              <div 
                ref={(el) => {
                  if (el && el !== verifyImgZoomRef.current) {
                    verifyImgZoomRef.current = el;
                    el.addEventListener(
                      'wheel',
                      (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.deltaY < 0) {
                          setVerifyImageZoom((prev) => Math.min(4, prev + 0.2));
                        } else {
                          setVerifyImageZoom((prev) => Math.max(0.5, prev - 0.2));
                        }
                      },
                      { passive: false }
                    );
                  }
                }}
                className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200/60 p-4 shadow-3xs min-h-[250px] overflow-auto relative"
              >
                {activeVerifyingBooking.prescriptionImage ? (
                  <img
                    src={activeVerifyingBooking.prescriptionImage}
                    alt="Prescription document"
                    className="max-h-[380px] w-auto object-contain rounded-lg transition-transform duration-150 ease-out cursor-grab active:cursor-grabbing"
                    style={{ transform: `scale(${verifyImageZoom})` }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-8 text-slate-400 space-y-2">
                    <span className="text-4xl block">📋</span>
                    <p className="text-xs font-bold text-slate-500">
                      {language === 'TH' ? 'ไม่มีการอัปโหลดไฟล์สแกนใบสั่งยา' : 'No prescription scan uploaded'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {language === 'TH' ? 'ใช้ใบจองยาแบบดั้งเดิมในการประเมินความปลอดภัยคนไข้' : 'Verify order using clinical profile ledger instead'}
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-3 text-center text-[10px] text-slate-400 font-mono">
                RxNexus Zero-Error Verification Engine
              </div>
            </div>

            {/* Right Side: Details and Setup Inputs (Details Right) */}
            <div className="flex-1 p-5 md:p-6 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-none space-y-4">
              <div className="space-y-4">
                <div className="border-b border-slate-150 pb-3">
                  <h3 className="font-extrabold text-sm text-blue-900 uppercase flex items-center gap-2">
                    <span>🔬</span> {language === 'TH' ? 'ประเมินและตรวจสอบใบสั่งยา (Verify Rx)' : 'Clinical Prescription Verification'}
                  </h3>
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    {language === 'TH' ? 'ทบทวนคำสั่งจองยา ตรวจสอบปริมาณ ขนาด และความถูกต้องของเวชภัณฑ์ยา' : 'Review reservation quantities, clinical targets and approve drug preparation.'}
                  </p>
                </div>

                {/* Patient Profile */}
                <div className="bg-slate-50/75 rounded-xl p-3 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">{language === 'TH' ? 'ข้อมูลคนไข้' : 'Patient Name'}</span>
                    <span className="font-bold text-slate-800 text-[13px]">{activeVerifyingBooking.patientName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">{language === 'TH' ? 'หมายเลข HN' : 'Hospital Number (HN)'}</span>
                    <span className="font-mono font-bold text-blue-700 text-[13px]">{activeVerifyingBooking.hn}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">{language === 'TH' ? 'วันที่สั่งใช้ยาจริง' : 'Date of Use'}</span>
                    <span className="font-semibold text-slate-700">{formatDateToDMY(activeVerifyingBooking.dateOfUse)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">{language === 'TH' ? 'แผนกที่สั่งใช้ยา' : 'Department'}</span>
                    <span className="font-semibold text-slate-700">{activeVerifyingBooking.department}</span>
                  </div>
                  {activeVerifyingBooking.regimen && (
                    <div className="col-span-2 border-t border-slate-200/50 pt-2 mt-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{language === 'TH' ? 'สูตรยาจองการรักษา (Regimen)' : 'Treatment Regimen'}</span>
                      <span className="font-semibold text-purple-700 font-mono text-[11px]">{activeVerifyingBooking.regimen}</span>
                    </div>
                  )}
                </div>

                {/* Medications Table */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-extrabold tracking-wide text-slate-400 block">
                    {language === 'TH' ? 'รายการเวชภัณฑ์ยาที่สั่งสำรอง' : 'ORDERED MEDICINES'}
                  </span>
                  <div className="border border-slate-200/60 rounded-xl overflow-hidden shadow-3xs">
                    <table className="w-full text-left text-[11px] border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-[9.5px] uppercase font-extrabold text-slate-500">
                          <th className="p-2.5">Medication Name</th>
                          <th className="p-2.5 text-center">Qty</th>
                          <th className="p-2.5 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {activeVerifyingBooking.medications.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/55">
                            <td className="p-2.5 font-bold text-slate-800">{m.drugName}</td>
                            <td className="p-2.5 text-center font-bold text-blue-600">{m.quantity}</td>
                            <td className="p-2.5 text-right font-semibold">฿{m.totalPrice.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Rejecting Mode or Verification Mode */}
                {isRejectingMode ? (
                  <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-xl space-y-3 font-sans animate-fade-in">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-tight">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>{language === 'TH' ? 'ระบุเหตุผล Verify ไม่ผ่าน (แจ้งเตือนผู้จอง)' : 'Specify Reason for Rejection'}</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        {language === 'TH' ? 'เลือกเหตุผลหลัก *' : 'Select Main Reason *'}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {[
                          'จองยาไม่ครบ (Incomplete Medication Booking)',
                          'จองยาผิดตัว (Incorrect Medication Selected)',
                          'ขนาดยาหรือจำนวนไม่ถูกต้อง (Incorrect Dosage/Qty)',
                          'ใบสั่งยาไม่ตรงกับข้อมูลในระบบ (Discrepancy)',
                          'อื่นๆ (ระบุเพิ่มเติม)'
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRejectReasonPreset(preset)}
                            className={`p-2 rounded-lg text-left text-[11px] font-semibold border transition-all cursor-pointer ${
                              rejectReasonPreset === preset
                                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/50'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {rejectReasonPreset === 'อื่นๆ (ระบุเพิ่มเติม)' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          {language === 'TH' ? 'ระบุเหตุผลอื่นๆ *' : 'Custom Reason *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={rejectReasonCustom}
                          onChange={(e) => setRejectReasonCustom(e.target.value)}
                          placeholder="e.g. รายการยานี้ต้องมีผล CrCl ล่าสุดก่อนจัดสรร"
                          className="w-full bg-white border border-slate-250 p-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-rose-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-1">
                        {language === 'TH' ? 'Note ระบุปัญหาที่พบ / คำแนะนำสำหรับผู้จองยา * (บังคับกรอก)' : 'Rejection Note / Problem Details * (Required)'}
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder={language === 'TH' ? 'กรุณาระบุปัญหาที่พบ เช่น ขาด Omeprazole 20mg 1x1 ac กรุณาแก้ไขแล้วส่งจองใหม่' : 'Required: Specify issue / correction instructions for requester.'}
                        className="w-full bg-white border border-rose-300 p-2 rounded-lg text-xs font-medium focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Previous rejection note if this is a resubmitted order */}
                    {activeVerifyingBooking.pharmacistVerification?.reverifyRequested && (
                      <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-xs space-y-1">
                        <span className="font-extrabold text-purple-900 flex items-center gap-1">
                          <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                          <span>{language === 'TH' ? 'รายการนี้ส่งมา Re-verify หลังได้รับการแก้ไขแล้ว' : 'Resubmitted Order for Re-verify'}</span>
                        </span>
                        {activeVerifyingBooking.pharmacistVerification?.rejectionReason && (
                          <p className="text-purple-800 text-[11px]">
                            {language === 'TH' ? 'เหตุผลเดิมที่ไม่ผ่าน' : 'Previous Rejection Reason'}: <span className="font-bold">{activeVerifyingBooking.pharmacistVerification.rejectionReason}</span>
                            {activeVerifyingBooking.pharmacistVerification.rejectionNote ? ` (${activeVerifyingBooking.pharmacistVerification.rejectionNote})` : ''}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Location & Reviewer input */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold tracking-wide text-slate-400 mb-1">
                          {language === 'TH' ? 'ห้องยาจ่ายยาจ่ายจริง *' : 'Pharmacy Location *'}
                        </label>
                        <select
                          required
                          value={verifyingLocation}
                          onChange={(e) => setVerifyingLocation(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        >
                          <option value="">-- Choose location --</option>
                          <option value="Phar IV">Phar IV</option>
                          <option value="Phar A1">Phar A1</option>
                          <option value="Phar E3">Phar E3</option>
                          <option value="Phar E6">Phar E6</option>
                          <option value="Phar D">Phar D</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-extrabold tracking-wide text-slate-400 mb-1">
                          {language === 'TH' ? 'เภสัชกรผู้ตรวจสอบทบทวน *' : 'Pharmacist Reviewer *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={verifyingPharmacistName}
                          onChange={(e) => setVerifyingPharmacistName(e.target.value)}
                          placeholder="e.g. Sarah Connor (PharmD)"
                          className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveVerifyingBooking(null);
                    setIsRejectingMode(false);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  {language === 'TH' ? 'ปิดหน้าต่าง' : 'Close'}
                </button>

                {isRejectingMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejectingMode(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      {language === 'TH' ? 'ย้อนกลับ' : 'Back'}
                    </button>
                    <button
                      type="button"
                      disabled={loading || !rejectNote.trim() || (rejectReasonPreset === 'อื่นๆ (ระบุเพิ่มเติม)' && !rejectReasonCustom.trim())}
                      onClick={async () => {
                        const finalReason = rejectReasonPreset === 'อื่นๆ (ระบุเพิ่มเติม)' ? rejectReasonCustom.trim() : rejectReasonPreset;
                        const success = await rejectPharmacistVerification(activeVerifyingBooking.id, finalReason, rejectNote);
                        if (success) {
                          setActiveVerifyingBooking(null);
                          setIsRejectingMode(false);
                        }
                      }}
                      className="px-4.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 duration-150"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{language === 'TH' ? 'ยืนยัน Verify ไม่ผ่าน (แจ้งเตือนผู้จอง)' : 'Confirm Not Approved & Alert User'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejectingMode(true)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>{language === 'TH' ? 'Verify ไม่ผ่าน (Not Approved)' : 'Not Approved'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={loading || !verifyingLocation || !verifyingPharmacistName.trim()}
                      onClick={async () => {
                        const success = await verifyPharmacist(activeVerifyingBooking.id, verifyingLocation, verifyingPharmacistName);
                        if (success) {
                          setActiveVerifyingBooking(null);
                        }
                      }}
                      className="px-4.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-95 duration-150"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>
                        {activeVerifyingBooking.pharmacistVerification?.reverifyRequested
                          ? (language === 'TH' ? 'ยืนยัน Re-verify สำเร็จ' : 'Approve Re-verify')
                          : (language === 'TH' ? 'ทบทวนสำเร็จ (Verify Complete)' : 'Verify Complete')}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 5. View Rejection Reason Modal (for User who booked) */}
      {viewingRejectionBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-950 uppercase">
                    {language === 'TH' ? 'รายละเอียดผลการ Verify ไม่ผ่าน' : 'Verification Rejection Details'}
                  </h3>
                  <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                    Order: {viewingRejectionBooking.id} • HN: {viewingRejectionBooking.hn}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingRejectionBooking(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-rose-100/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    {language === 'TH' ? 'เหตุผลหลักที่ไม่ผ่านการ Verify' : 'Primary Rejection Reason'}
                  </span>
                  <span className="font-extrabold text-rose-700 text-sm block mt-0.5">
                    {viewingRejectionBooking.pharmacistVerification?.rejectionReason || 'ไม่ระบุเหตุผล'}
                  </span>
                </div>

                {viewingRejectionBooking.pharmacistVerification?.rejectionNote && (
                  <div className="border-t border-slate-200/60 pt-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {language === 'TH' ? 'คำแนะนำเพิ่มเติมจากเภสัชกร' : 'Pharmacist Notes & Instructions'}
                    </span>
                    <p className="text-slate-700 font-medium text-xs mt-0.5 whitespace-pre-wrap">
                      {viewingRejectionBooking.pharmacistVerification.rejectionNote}
                    </p>
                  </div>
                )}

                <div className="border-t border-slate-200/60 pt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                  <div>
                    <span className="font-bold text-slate-400 block">Pharmacist Reviewer:</span>
                    <span className="font-semibold text-slate-700">{viewingRejectionBooking.pharmacistVerification?.rejectedBy || 'Pharmacist'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block">Rejected At:</span>
                    <span className="font-semibold text-slate-700 font-mono">
                      {viewingRejectionBooking.pharmacistVerification?.rejectedAt
                        ? new Date(viewingRejectionBooking.pharmacistVerification.rejectedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US')
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-slate-500 text-[11px] leading-relaxed">
                {language === 'TH'
                  ? '💡 ท่านสามารถกดปุ่ม "แก้ไขเพื่อจองใหม่" ด้านล่างเพื่อโหลดข้อมูลเดิม เพิ่มเติมหรือแก้ไขยาให้ครบถ้วนถูกต้อง แล้วกดยืนยันเพื่อ Re-verify ส่งจองยามาใหม่ได้ทันที'
                  : '💡 You can click "Edit & Re-submit" below to load the original booking details, adjust medications as requested, and resubmit for Pharmacist Re-verification.'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setViewingRejectionBooking(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50"
              >
                {language === 'TH' ? 'ปิด' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const bId = viewingRejectionBooking.id;
                  setViewingRejectionBooking(null);
                  if (onEditClick) onEditClick(bId);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 duration-150 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>{language === 'TH' ? 'แก้ไขเพื่อจองใหม่ (Edit & Re-submit)' : 'Edit & Re-submit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Cancel Booking Request Modal (accessible to all users) */}
      {cancelingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-amber-950 uppercase">
                  {language === 'TH' ? 'ขอยกเลิกรายการจองยา' : 'Request Medication Cancellation'}
                </h3>
                <p className="text-[10px] text-amber-700 font-mono mt-0.5">
                  ID: {cancelingBooking.id} • HN: {cancelingBooking.hn} ({cancelingBooking.patientName})
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'เลือกเหตุผลการขอยกเลิก *' : 'Cancellation Reason *'}
                </label>
                <div className="space-y-1.5">
                  {[
                    'คนไข้ปฏิเสธการรักษา',
                    'แพทย์ปรับเปลี่ยนแผนการรักษา',
                    'ขอยกเลิกนัดหมาย / ไม่มารับบริการ',
                    'คีย์รายการยาซ้ำซ้อน',
                    'ระบุเหตุผลอื่นๆ...'
                  ].map((preset) => (
                    <label
                      key={preset}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                        cancelReasonPreset === preset
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelPreset"
                        checked={cancelReasonPreset === preset}
                        onChange={() => setCancelReasonPreset(preset)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span>{preset}</span>
                    </label>
                  ))}
                </div>
              </div>

              {cancelReasonPreset === 'ระบุเหตุผลอื่นๆ...' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    {language === 'TH' ? 'ระบุเหตุผลเพิ่มเติม *' : 'Custom Reason *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={cancelReasonCustom}
                    onChange={(e) => setCancelReasonCustom(e.target.value)}
                    placeholder="เช่น ผู้ป่วยย้ายโรงพยาบาลกะทันหัน"
                    className="w-full bg-slate-50 border border-slate-250 p-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-amber-500 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  {language === 'TH' ? 'ลงชื่อคนขอยกเลิก (ไม่อิงตาม User Login) *' : 'Canceler Signature Name (Custom, not bound to user) *'}
                </label>
                <input
                  type="text"
                  required
                  value={cancelerName}
                  onChange={(e) => setCancelerName(e.target.value)}
                  placeholder={language === 'TH' ? 'เช่น พว. สมศรี ใจดี / นพ. ประเสริฐ' : 'e.g. Nurse Clara Barton / Dr. House'}
                  className="w-full bg-slate-50 border border-slate-250 p-2 rounded-lg text-xs font-bold focus:outline-hidden focus:border-amber-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  {language === 'TH'
                    ? '* สถานะจะถูกปรับเป็น Request on process และต้องได้รับการอนุมัติโดย Admin หรือเภสัชกร'
                    : '* Status will be set to Request on process and must be approved by Admin or Pharmacist.'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancelingBooking(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={loading || !cancelerName.trim() || (cancelReasonPreset === 'ระบุเหตุผลอื่นๆ...' && !cancelReasonCustom.trim())}
                onClick={async () => {
                  const finalReason = cancelReasonPreset === 'ระบุเหตุผลอื่นๆ...' ? cancelReasonCustom.trim() : cancelReasonPreset;
                  const res = await requestCancelBooking(cancelingBooking.id, finalReason, cancelerName);
                  if (res.success) {
                    setCancelingBooking(null);
                  }
                }}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 duration-150 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{language === 'TH' ? 'ส่งคำขอยกเลิก (Request on process)' : 'Submit Request on process'}</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Custom Delete Confirmation Modal */}
      {deletingBookingId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-scale-up">
            <div className="p-5 bg-red-50 border-b border-red-100/60 flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <Trash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-red-950 uppercase tracking-tight">
                  {language === 'TH' ? 'ยืนยันการลบรายการจองยา' : 'Confirm Clinical Delete'}
                </h3>
                <p className="text-[10px] text-red-600 font-medium mt-0.5">
                  ID: {deletingBookingId}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3 text-xs leading-relaxed text-slate-600">
              <p className="font-semibold text-rose-700 text-xs">
                {language === 'TH'
                  ? '⚠️ คำเตือน: การดำเนินการนี้ไม่สามารถย้อนกลับได้!'
                  : '⚠️ Warning: This action is permanent and cannot be undone!'}
              </p>
              <p>
                {language === 'TH'
                  ? 'การจองยาและข้อมูลผู้ป่วยของรายการนี้จะถูกลบออกจากฐานข้อมูล RxNexus ถาวรทันที ประวัติการอนุมัติและจัดเตรียมทั้งหมดจะสูญหาย'
                  : 'This reservation and all clinical associated data will be permanently purged from RxNexus servers. Verified histories and log references will remain archived.'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingBookingId(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteBooking(deletingBookingId);
                  setDeletingBookingId(null);
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md hover:shadow-lg active:scale-95 duration-150 cursor-pointer"
              >
                {language === 'TH' ? 'ยืนยันลบข้อมูลถาวร' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Clerk 2-Step Confirmation Shortcut Detail Modal Popup */}
      {confirmingClerkBooking && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in font-sans overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
            <div className={`p-5 border-b flex items-center justify-between gap-3 ${
              confirmingClerkBooking.clerkVerification?.status === 'Accepted'
                ? 'bg-emerald-50 border-emerald-100'
                : 'bg-indigo-50 border-indigo-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  confirmingClerkBooking.clerkVerification?.status === 'Accepted'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 uppercase">
                    {confirmingClerkBooking.clerkVerification?.status === 'Accepted'
                      ? (language === 'TH' ? 'ยืนยันครั้งที่ 2: ของมาถึงคลังแล้ว (Shortcut Detail)' : 'Step 2: Confirm Stock Arrived (Shortcut Detail)')
                      : (language === 'TH' ? 'ยืนยันครั้งที่ 1: ยืนยันการสั่งซื้อยา (Shortcut Detail)' : 'Step 1: Confirm Order Purchase (Shortcut Detail)')}
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">
                    {confirmingClerkBooking.id} • HN: {confirmingClerkBooking.hn} • {confirmingClerkBooking.mode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingClerkBooking(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-700 max-h-[72vh] overflow-y-auto">
              {/* Patient & Pharmacist Verification Shortcut Detail */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">ผู้ป่วย (Patient)</span>
                  <span className="font-bold text-slate-900 text-xs">{confirmingClerkBooking.patientName}</span>
                </div>
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">แผนก / ห้องยา (Dept / Loc)</span>
                  <span className="font-bold text-indigo-700">
                    {confirmingClerkBooking.department} • {confirmingClerkBooking.pharmacyLocation || 'ไม่ระบุห้องยา'}
                  </span>
                </div>
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">วันที่ต้องใช้ยา (Date of Use)</span>
                  <span className="font-mono font-bold text-slate-800">{formatDateToDMY(confirmingClerkBooking.dateOfUse)}</span>
                </div>
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">เภสัชกรทวนสอบแล้ว</span>
                  <span className="font-semibold text-emerald-700">
                    {confirmingClerkBooking.pharmacistVerification?.verifiedBy || '-'}
                    {confirmingClerkBooking.pharmacistVerification?.verifiedAt && (
                      <span className="block font-mono text-[9.5px] text-slate-500">
                        {new Date(confirmingClerkBooking.pharmacistVerification.verifiedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US')}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Step 1 Timestamp Audit when confirming Step 2 */}
              {confirmingClerkBooking.clerkVerification?.status === 'Accepted' && (
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 space-y-1">
                  <div className="text-[10px] font-extrabold text-indigo-800 uppercase flex items-center justify-between">
                    <span>ประวัติยืนยันครั้งที่ 1 (สั่งซื้อยาแล้ว)</span>
                    <span className="font-mono text-[10px]">
                      {confirmingClerkBooking.clerkVerification.orderedAt
                        ? new Date(confirmingClerkBooking.clerkVerification.orderedAt).toLocaleString(language === 'TH' ? 'th-TH' : 'en-US')
                        : '-'}
                    </span>
                  </div>
                  <div className="text-[11px] text-indigo-900">
                    ผู้กดยืนยันสั่งซื้อ: <span className="font-bold">{confirmingClerkBooking.clerkVerification.orderedBy || '-'}</span>
                    {confirmingClerkBooking.clerkVerification.orderNote && (
                      <span className="ml-2 text-slate-600">({confirmingClerkBooking.clerkVerification.orderNote})</span>
                    )}
                  </div>
                </div>
              )}

              {/* Medications Table */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {language === 'TH' ? 'รายละเอียดรายการยาที่ต้องดำเนินการ' : 'Medications Summary'}
                  </span>
                  <span className="text-[11px] font-bold text-blue-700">
                    รวม ฿{confirmingClerkBooking.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-40 overflow-y-auto bg-white">
                  {confirmingClerkBooking.medications.map((m, i) => (
                    <div key={i} className="p-2.5 flex justify-between items-center text-[11px]">
                      <div>
                        <span className="font-bold text-slate-800 block">{m.drugName}</span>
                        <span className="text-[9.5px] font-mono text-slate-400">Stock Code: {m.stockCode}</span>
                      </div>
                      <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">x{m.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {confirmingClerkBooking.note && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900">
                  <span className="font-bold">Note จากผู้จอง/เภสัชกร:</span> {confirmingClerkBooking.note}
                </div>
              )}

              {/* Operator & Optional PO / Lot Note + Live Timestamp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {confirmingClerkBooking.clerkVerification?.status === 'Accepted'
                      ? (language === 'TH' ? 'ผู้ยืนยันรับของมาถึง *' : 'Confirmed Arrived By *')
                      : (language === 'TH' ? 'ผู้ยืนยันการสั่งซื้อ *' : 'Confirmed Ordered By *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={clerkOperatorName}
                    onChange={(e) => setClerkOperatorName(e.target.value)}
                    placeholder="ชื่อเจ้าหน้าที่คลังยา"
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {confirmingClerkBooking.clerkVerification?.status === 'Accepted'
                      ? (language === 'TH' ? 'เลข Lot / หมายเหตุรับของ (ถ้ามี)' : 'Lot / Arrival Note (Optional)')
                      : (language === 'TH' ? 'เลข PO / หมายเหตุสั่งซื้อ (ถ้ามี)' : 'PO / Order Note (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={clerkActionNote}
                    onChange={(e) => setClerkActionNote(e.target.value)}
                    placeholder={
                      confirmingClerkBooking.clerkVerification?.status === 'Accepted'
                        ? 'เช่น Lot 2026-01, ส่งครบถ้วน'
                        : 'เช่น PO-69110042'
                    }
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="bg-slate-900 text-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>{language === 'TH' ? 'Timestamp ที่จะบันทึกอัตโนมัติ:' : 'Audit Timestamp:'}</span>
                </span>
                <span className="font-mono font-bold text-sky-300">
                  {new Date().toLocaleString(language === 'TH' ? 'th-TH' : 'en-US')}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingClerkBooking(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-100"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={loading || !clerkOperatorName.trim()}
                onClick={async () => {
                  const targetId = confirmingClerkBooking.id;
                  const opName = clerkOperatorName;
                  const noteVal = clerkActionNote;
                  setConfirmingClerkBooking(null);
                  await verifyClerk(targetId, opName, noteVal);
                }}
                className={`px-5 py-2 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm flex items-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed ${
                  confirmingClerkBooking.clerkVerification?.status === 'Accepted'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>
                  {confirmingClerkBooking.clerkVerification?.status === 'Accepted'
                    ? (language === 'TH' ? 'ยืนยันของมาถึงจริง (บันทึกเวลา)' : 'Confirm Arrived')
                    : (language === 'TH' ? 'ยืนยันการสั่งซื้อจริง (บันทึกเวลา)' : 'Confirm Purchase Order')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
