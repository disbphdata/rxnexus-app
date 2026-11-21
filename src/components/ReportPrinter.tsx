import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { i18n } from '../lib/i18n';
import { Booking, formatDateToDMY } from '../types';
import { Printer, Calendar, FileText, Filter, CheckCircle, Eye, ArrowLeft, BookOpen, Check, X, Receipt } from 'lucide-react';
import { printElementByNewWindow } from '../utils/print';

export default function ReportPrinter({ singleBooking, onClose }: { singleBooking?: Booking, onClose?: () => void }) {
  const { bookings, language, currentUser, updateBooking, owingMeds, toggleMedicineOwing, selectedPharmacyLocation, setSelectedPharmacyLocation } = useApp();
  const t = i18n[language];

  const formatTimestamp = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const datePart = d.toLocaleDateString(language === 'TH' ? 'th-TH' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString(language === 'TH' ? 'th-TH' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${datePart} ${timePart}`;
    } catch (e) {
      return isoStr;
    }
  };

  // Parameters for advanced routing/filtration
  const [filterType, setFilterType] = useState<'useDate' | 'bookingDate'>('useDate');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3); // 3 days in advance reservation default
    return d.toISOString().split('T')[0];
  });
  const [drugClass, setDrugClass] = useState<'All' | 'General' | 'Oncology'>('All');
  const [pharmacyLocation, setPharmacyLocation] = useState<string>(selectedPharmacyLocation || 'All');
  const [hnQuery, setHnQuery] = useState<string>('');
  const [ignoreDate, setIgnoreDate] = useState<boolean>(false);
  
  // HTML Fully Printable View Mode
  const [isHtmlPrintActive, setIsHtmlPrintActive] = useState(!!singleBooking);
  // 'voucher' (staff) or 'receipt' (patient) - active when singleBooking is defined
  const [printType, setPrintType] = useState<'voucher' | 'receipt'>('voucher');
  // Report scope: 'aggregate' (รวม) or 'patient' (ต่อคนไข้ 1 คน)
  const [reportScope, setReportScope] = useState<'aggregate' | 'patient'>(singleBooking ? 'patient' : 'aggregate');
  const [selectedPatientHn, setSelectedPatientHn] = useState<string>(singleBooking ? singleBooking.hn : '');

  const standardLocations = ['Phar IV', 'Phar A1', 'Phar E3', 'Phar E6', 'Phar D'];
  const uniqueLocations = Array.from(new Set([
    ...standardLocations,
    ...bookings.map(b => b.pharmacyLocation).filter(Boolean)
  ])) as string[];

  const uniquePatients = React.useMemo(() => {
    const map = new Map<string, { hn: string; patientName: string; count: number; department: string }>();
    bookings.forEach(b => {
      if (!map.has(b.hn)) {
        map.set(b.hn, { hn: b.hn, patientName: b.patientName, count: 1, department: b.department });
      } else {
        const item = map.get(b.hn)!;
        item.count += 1;
      }
    });
    return Array.from(map.values());
  }, [bookings]);

  React.useEffect(() => {
    if (reportScope === 'patient' && !selectedPatientHn && uniquePatients.length > 0) {
      setSelectedPatientHn(uniquePatients[0].hn);
    }
  }, [reportScope, selectedPatientHn, uniquePatients]);

  const targetPatientBookings = React.useMemo(() => {
    if (singleBooking) return [singleBooking];
    if (!selectedPatientHn) return [];
    return bookings.filter(b => b.hn === selectedPatientHn);
  }, [singleBooking, selectedPatientHn, bookings]);

  const targetPatientPrimary = targetPatientBookings[0] || singleBooking;

  // If user is a Pharmacy Stock Clerk, enforce selecting a specific pharmacy location
  React.useEffect(() => {
    if (currentUser?.role === 'Pharmacy Stock Clerk' && (pharmacyLocation === 'All' || !pharmacyLocation)) {
      const firstLoc = selectedPharmacyLocation && selectedPharmacyLocation !== 'All' 
        ? selectedPharmacyLocation 
        : (uniqueLocations[0] || 'Phar IV');
      setPharmacyLocation(firstLoc);
      setSelectedPharmacyLocation(firstLoc);
    }
  }, [currentUser?.role, uniqueLocations, pharmacyLocation]);

  const isDrugOwing = (bookingId: string, drugId: string): boolean => {
    const oRecord = owingMeds?.find(om => om.bookingId === bookingId);
    if (!oRecord) return false;
    const m = oRecord.medications.find(item => item.drugId === drugId);
    return m ? !m.received : false;
  };

  const hasActiveOwingForBooking = (bookingId: string): boolean => {
    const oRecord = owingMeds?.find(om => om.bookingId === bookingId);
    if (!oRecord || oRecord.resolved) return false;
    return oRecord.medications.some(m => !m.received);
  };

  // Load bookings that fit criteria
  const activeBookings = bookings.filter((b) => {
    const matchesCategory = drugClass === 'All' ? true : b.mode === drugClass;
    const matchesLocation = pharmacyLocation === 'All' ? true : b.pharmacyLocation === pharmacyLocation;
    const dateToCheck = filterType === 'useDate' ? b.dateOfUse : b.bookingDate;
    const matchesDate = ignoreDate ? true : (dateToCheck >= startDate && dateToCheck <= endDate);
    const matchesHn = hnQuery
      ? b.hn.replace(/-/g, '').toLowerCase().includes(hnQuery.replace(/-/g, '').toLowerCase())
      : true;

    return matchesCategory && matchesLocation && matchesDate && matchesHn;
  });

  // Calculate aggregated medicine totals for warehouse delivery
  const aggregatedMeds: { [key: string]: { name: string; sku: string; qty: number; category: string } } = {};
  activeBookings.forEach((b) => {
    b.medications.forEach((m) => {
      if (aggregatedMeds[m.drugId]) {
        aggregatedMeds[m.drugId].qty += m.quantity;
      } else {
        aggregatedMeds[m.drugId] = {
          name: m.drugName,
          sku: m.stockCode,
          qty: m.quantity,
          category: b.mode
        };
      }
    });
  });

  const summaryList = Object.values(aggregatedMeds);

  // Trigger HTML printing by extracting the printable area and casting it inside a custom styles-retaining popup window
  const handlePrint = () => {
    const element = document.getElementById('printable-area');
    console.log('[Print Debug] #printable-area DOM element check:', element ? 'element exists' : 'element does not exist');
    
    if (!element) {
      console.warn('[Print Debug] #printable-area element not found in current DOM tree. Falling back to default window.print()');
      window.print();
      return;
    }

    console.log('[Print Debug] #printable-area element verified successfully. Initializing printElementByNewWindow.');
    const title = singleBooking ? `Receipt_${singleBooking.hn}` : 'Aggregate_Requisition_Supply_Bill';
    printElementByNewWindow('printable-area', title);
  };

  // RENDER FULLSCREEN PRINT-OPTIMIZED PREVIEW AND WORKSPACE
  if (isHtmlPrintActive) {
    const isPatientReceipt = singleBooking && printType === 'receipt';
    const isStaffVoucher = singleBooking && printType === 'voucher';
    const isBulkReport = !singleBooking;

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9999] overflow-y-auto text-slate-900 font-sans p-2 sm:p-6 lg:p-10 flex flex-col items-center print-overlay-wrapper">
        {/* Print stylesheets */}
        <style>{`
          @media print {
            /* Set all unnecessary UI elements, navigation bars, backgrounds, and headers to display: none */
            header,
            aside,
            nav,
            button,
            .print\\:hidden,
            .print-hidden,
            .print-hidden-element,
            #owing-medication-clerk-urgent-banner,
            .print-overlay-wrapper > div:not(#printable-area) {
              display: none !important;
            }

            html, body, #root, .print-overlay-wrapper, main, section {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              position: static !important;
            }

            html, body, #root, .print-overlay-wrapper {
              background-color: #ffffff !important;
              background-image: none !important;
            }

            .print-overlay-wrapper {
              position: static !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              width: 100% !important;
              overflow: visible !important;
            }

            #printable-area {
              display: block !important;
              visibility: visible !important;
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 0 !important;
              box-sizing: border-box !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              color: #0f172a !important;
              background-color: #ffffff !important;
              overflow: visible !important;
            }

            #printable-area * {
              overflow: visible !important;
            }

            #printable-area table:not(.print-layout-shell) {
              width: 100% !important;
              max-width: 100% !important;
            }

            .print-layout-shell {
              width: 100% !important;
              border-collapse: separate !important;
              border-spacing: 0 !important;
            }

            .print-layout-shell > thead {
              display: table-header-group !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }

            .print-layout-shell > tfoot {
              display: table-footer-group !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .print-layout-shell > thead > tr,
            .print-layout-shell > thead > tr > td,
            .print-layout-shell > tfoot > tr,
            .print-layout-shell > tfoot > tr > td {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .print-layout-shell > thead > tr {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }

            .print-layout-shell > tbody,
            .print-layout-shell > tbody > tr,
            .print-layout-shell > tbody > tr > td {
              page-break-inside: auto !important;
              break-inside: auto !important;
            }

            table:not(.print-layout-shell) > thead {
              display: table-header-group !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }

            table:not(.print-layout-shell) > thead > tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }

            table:not(.print-layout-shell) > tbody > tr,
            .print-compact-table tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: auto !important;
              break-after: auto !important;
            }

            .print-compact-table th, .print-compact-table td {
              padding: 5px 5px !important;
              line-height: 1.35 !important;
              overflow-wrap: anywhere !important;
              word-break: normal !important;
            }

            .print-page-break-after {
              page-break-after: always !important;
              break-after: page !important;
            }
          }
        `}</style>

        {/* Floating Print Control Banner */}
        <div className="w-full max-w-4xl mb-4 bg-slate-100 p-3 sm:p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl print:hidden z-[10000]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <p className="text-xs text-slate-800 font-black uppercase tracking-wide">
                {reportScope === 'patient'
                  ? (language === 'TH' ? `ตัวอย่างใบรายงานจองยาต่อคนไข้ (HN: ${targetPatientPrimary?.hn || '-'})` : `Patient Reservation Report (HN: ${targetPatientPrimary?.hn || '-'})`)
                  : isPatientReceipt
                    ? (language === 'TH' ? 'ตัวอย่างใบเสร็จตรวจสอบยาคนไข้ (Patient Receipt)' : 'Patient Medication Receipt Preview')
                    : isStaffVoucher
                      ? (language === 'TH' ? 'ตัวอย่างใบเตรียมเครื่องมือเวชภัณฑ์แพทย์ (Staff Voucher)' : 'Staff Requisition Voucher Preview')
                      : (language === 'TH' ? 'ตัวอย่างใบเบิกรายการสะสมรวมฝ่ายโลจิสติกส์' : 'Aggregate Requisition & Supply Bill')}
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-none mt-1">
                {language === 'TH'
                  ? 'ตรวจสอบความถูกต้อง ทรงเอกสารขนาด A4 แล้วกดเรียกปริ้นภายนอก'
                  : 'Check parameters, adjust layout, and trigger browser print dialog.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Switcher: Aggregate vs Per-Patient */}
            <div className="flex bg-slate-200 p-1 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setReportScope('aggregate')}
                className={`px-3 py-1.5 rounded-md text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  reportScope === 'aggregate'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {language === 'TH' ? '📊 รายงานรวม' : '📊 Batch'}
              </button>
              <button
                type="button"
                onClick={() => setReportScope('patient')}
                className={`px-3 py-1.5 rounded-md text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  reportScope === 'patient'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {language === 'TH' ? '👤 ต่อคนไข้ 1 คน' : '👤 Per Patient'}
              </button>
            </div>

            {/* Per-Patient HN Selector */}
            {reportScope === 'patient' && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-3xs">
                <span className="text-[9.5px] font-black text-slate-500 uppercase">HN:</span>
                <select
                  value={selectedPatientHn}
                  onChange={(e) => setSelectedPatientHn(e.target.value)}
                  className="bg-transparent text-xs font-bold text-blue-900 focus:outline-hidden cursor-pointer max-w-[190px]"
                >
                  {uniquePatients.map(p => (
                    <option key={p.hn} value={p.hn}>
                      {p.hn} - {p.patientName} ({p.department})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Conditional control switch for single bookings */}
            {singleBooking && reportScope === 'patient' && (
              <div className="flex bg-slate-200 p-1 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setPrintType('voucher')}
                  className={`px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    printType === 'voucher'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Voucher
                </button>
                <button
                  type="button"
                  onClick={() => setPrintType('receipt')}
                  className={`px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    printType === 'receipt'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Receipt
                </button>
              </div>
            )}

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              {language === 'TH' ? 'เริ่มพิมพ์ / เซฟ PDF' : 'Print / Save PDF'}
            </button>
            <button
              onClick={() => {
                setIsHtmlPrintActive(false);
                if (onClose) onClose();
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {language === 'TH' ? 'กลับไประบบงาน' : 'Return to App'}
            </button>
          </div>
        </div>

        {/* Paper Container sheet (Designed strictly for A4 format) */}
        <div
          id="printable-area"
          className="w-full max-w-[210mm] min-h-[297mm] print:min-h-0 bg-white text-slate-900 border border-slate-300 shadow-2xl p-5 sm:p-8 box-border print:border-0 print:p-0 print:shadow-none font-sarabun shrink-0"
        >
          <table className="w-full border-separate border-spacing-0 print-layout-shell">
            <thead className="print-repeating-header">
              <tr>
                <td
                  className="p-0 pb-4 border-0 align-top bg-white"
                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                >
                  {/* Repeating Header Letterhead on every printed page */}
                  <div className="flex justify-between items-center pb-3 border-b-2 border-slate-300">
                    <div className="flex items-center gap-3">
                      <img
                        src="https://static.bangkokhospital.com/uploads/2025/08/pattaya.svg"
                        alt="Bangkok Hospital Pattaya Logo"
                        className="h-10 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="text-right">
                      <h1 className="text-xs font-black text-slate-500 tracking-widest font-sarabun tabular-nums uppercase">
                        BANGKOK HOSPITAL PATTAYA • RX-NEXUS
                      </h1>
                      <p className="text-[11px] text-slate-500 font-semibold uppercase leading-none mt-1">
                        OUTPATIENT SOURCING LOGISTICS CENTER
                      </p>
                    </div>
                  </div>

                  {/* Repeating Document Title Header */}
                  <div className="text-center mt-4 mb-1">
                    <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-tight font-sarabun">
                      {reportScope === 'patient'
                        ? (language === 'TH' ? 'ใบรายงานรายการจองยาแยกต่อคนไข้ (รายบุคคล)' : 'Individual Patient Medication Reservation Report')
                        : isPatientReceipt
                          ? (language === 'TH' ? 'ใบรับยาเวชภัณฑ์สำรองผู้ป่วยนอก' : 'Outpatient Medication Receipt & Sourcing Summary')
                          : isStaffVoucher
                            ? (language === 'TH' ? 'ใบรายละเอียดเวชภัณฑ์' : 'Patient Medication Requisition Voucher')
                            : (language === 'TH' ? 'ใบจัดเตรียมเวชภัณฑ์' : 'Aggregate Sourcing Logistics & Supply Bill')}
                    </h2>
                    <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold font-sarabun tabular-nums mt-1.5 leading-none">
                      {reportScope === 'patient'
                        ? (language === 'TH' ? 'BANGKOK HOSPITAL PATTAYA • OFFICIAL PATIENT MEDICATION RECORD' : 'OFFICIAL PATIENT DISPENSARY RECORD')
                        : isPatientReceipt
                          ? (language === 'TH' ? 'เอกสารมอบสิทธิ์ผู้ป่วยในการตรวจสอบรับ' : 'OFFICIAL PATIENT DISPENSARY RECEIPT')
                          : isStaffVoucher
                            ? (language === 'TH' ? '' : 'SYSTEM CLINIC INFRASTRUCTURE VOUCHER')
                            : (language === 'TH' ? 'รายงานตรวจสอบยอดรายการยาจอง' : 'LEDGER REPORT — DETAILED INDIVIDUAL ALLOCATIONS')}
                    </p>
                  </div>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-0 border-0 align-top">
            {/* Layout: Single Patient Booking Report (ต่อคนไข้ 1 คน ว่า HN นั้นมีจองยาอะไรไปบ้าง) */}
            {reportScope === 'patient' && targetPatientPrimary && (
              <div className="space-y-6">
                {/* Patient Profile Demographics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 uppercase font-black tracking-wider text-[10px] block">HN</span>
                    <span className="font-sarabun tabular-nums font-black text-blue-900 text-[15px] tracking-wide">{targetPatientPrimary.hn}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-black tracking-wider text-[10px] block">{t.patientName}</span>
                    <span className="font-extrabold text-slate-800 text-[15px]">{targetPatientPrimary.patientName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-black tracking-wider text-[10px] block">{t.dateOfUse}</span>
                    <span className="font-bold text-slate-800 font-sarabun text-[13px]">{formatDateToDMY(targetPatientPrimary.dateOfUse)}</span>
                    <span className="block text-[10.5px] text-slate-500 font-bold uppercase">{targetPatientPrimary.department}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 uppercase font-black tracking-wider text-[10px] block">Prescribing Physician</span>
                    <span className="font-black text-slate-900 text-[13px] font-sarabun">{targetPatientPrimary.staff?.doctor || '-'}</span>
                    <span className="block text-[10.5px] text-slate-500 font-bold">{targetPatientPrimary.staff?.nurse ? `RN: ${targetPatientPrimary.staff.nurse}` : ''}</span>
                  </div>
                </div>

                {/* Table of all medications for this patient HN */}
                <div>
                  <div className="flex justify-between items-center mb-2 pl-1.5 border-l-2 border-blue-900">
                    <span className="text-xs text-slate-800 font-black uppercase tracking-wider">
                      {language === 'TH' ? `รายการเวชภัณฑ์ยาที่สั่งจองสำหรับ HN: ${targetPatientPrimary.hn}` : `Prescribed Medications Itemization for HN: ${targetPatientPrimary.hn}`}
                    </span>
                    <span className="text-[11px] text-slate-500 font-bold">
                      {targetPatientBookings.length} {language === 'TH' ? 'ใบสั่งจอง' : 'Orders linked'}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden print:overflow-visible bg-white shadow-3xs">
                    <table className="w-full table-fixed text-left text-[13px] border-collapse">
                      <colgroup>
                        <col className="w-[5%]" />
                        <col className="w-[5%]" />
                        <col className="w-[26%]" />
                        <col className="w-[15%]" />
                        <col className="w-[11%]" />
                        <col className="w-[7%]" />
                        <col className="w-[8%]" />
                        <col className="w-[11%]" />
                        <col className="w-[12%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-black uppercase text-[10.5px] border-b border-slate-200">
                          <th className="py-2 px-1 text-center">☐</th>
                          <th className="py-2 px-1 text-center">#</th>
                          <th className="py-2 px-2">Medication Name / ชื่อยา</th>
                          <th className="py-2 px-1.5 text-center">Stock Code</th>
                          <th className="py-2 px-1 text-center">Class</th>
                          <th className="py-2 px-1 text-center">Type</th>
                          <th className="py-2 px-1 text-center">Qty</th>
                          <th className="py-2 px-1.5 text-right">Unit Price</th>
                          <th className="py-2 px-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {targetPatientBookings.flatMap((b) =>
                          b.medications.map((item) => ({
                            ...item,
                            bookingMode: b.mode,
                            bookingId: b.id,
                            regimen: b.regimen,
                            dateOfUse: b.dateOfUse
                          }))
                        ).map((item, idx) => (
                          <tr key={idx} className="bg-white hover:bg-slate-50/20">
                            <td className="py-2 px-1 text-center text-slate-500 font-sans text-base">☐</td>
                            <td className="py-2 px-1 text-center text-slate-500 font-sarabun text-xs">{idx + 1}</td>
                            <td className="py-2 px-2 font-bold text-slate-900 text-[13px] break-words">
                              {item.drugName}
                              {item.regimen && (
                                <span className="ml-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold inline-block">
                                  {item.regimen}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-1.5 text-center text-slate-600 font-extrabold font-sarabun text-xs break-words">{item.stockCode}</td>
                            <td className="py-2 px-1 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                item.bookingMode === 'Oncology' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {item.bookingMode}
                              </span>
                            </td>
                            <td className="py-2 px-1 text-center uppercase text-[11px] font-bold text-slate-600">{item.priceType || 'OPD'}</td>
                            <td className="py-2 px-1 text-center font-black text-slate-900 text-[15px] font-sarabun">{item.quantity}</td>
                            <td className="py-2 px-1.5 text-right font-bold text-slate-700 font-sarabun text-xs">฿{item.unitPrice.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right font-black text-slate-900 font-sarabun text-xs">฿{item.totalPrice.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50/20 font-bold border-t border-slate-200">
                          <td colSpan={8} className="py-3 px-2 text-right uppercase text-xs text-slate-700 tracking-wider font-black">
                            {language === 'TH' ? 'ยอดรวมมูลค่าเวชภัณฑ์ทั้งสิ้น:' : 'Total Amount Due:'}
                          </td>
                          <td className="py-3 px-2 text-right text-blue-900 text-base font-black font-sarabun">
                            ฿{targetPatientBookings.reduce((sum, b) => sum + b.totalAmount, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Regimen, Clinical Notes & Borrow Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] font-sans">
                  {(targetPatientPrimary.regimen || targetPatientPrimary.note) && (
                    <div className="p-3 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-1.5">
                      {targetPatientPrimary.regimen && (
                        <div>
                          <span className="text-indigo-600 font-black uppercase text-[10.5px] tracking-wider block">Treatment Regimen / สูตรการรักษา</span>
                          <span className="font-extrabold text-indigo-950 bg-white border border-indigo-200 px-2 py-0.5 rounded inline-block text-xs font-sarabun">{targetPatientPrimary.regimen}</span>
                        </div>
                      )}
                      {targetPatientPrimary.note && (
                        <div>
                          <span className="text-slate-600 font-black uppercase text-[10.5px] tracking-wider block">Special Instructions / บันทึกเพิ่มเติม</span>
                          <p className="text-slate-800 font-medium text-xs whitespace-pre-wrap bg-white p-2 rounded border border-slate-200/60">{targetPatientPrimary.note}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Borrowed Medication notice if present */}
                  {targetPatientPrimary.borrowInfo && targetPatientPrimary.borrowInfo.length > 0 && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                      <span className="font-black text-amber-900 uppercase text-[10.5px] tracking-wider block flex items-center gap-1">
                        <span>🤝</span> {language === 'TH' ? 'รายการยืมยาจากคนไข้คนอื่น (Borrowed Meds Ledger)' : 'Borrowed Medication Record'}
                      </span>
                      {targetPatientPrimary.borrowInfo.map((bItem, idx) => (
                        <div key={idx} className="bg-white/80 p-1.5 rounded border border-amber-200 text-xs">
                          <span className="font-bold text-slate-800">• {bItem.borrowedDrugName} x{bItem.quantity}</span>
                          <span className="text-slate-600 ml-1.5">ยืมมาจาก HN: <strong className="font-sarabun tabular-nums text-blue-700">{bItem.borrowedFromHn}</strong> ({bItem.borrowedFromPatientName || '-'})</span>
                          <span className={`ml-2 px-1 rounded text-[10px] font-bold ${bItem.returned ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {bItem.returned ? 'คืนแล้ว' : 'รอจองคืน'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Clinical Verification Ledger */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-sans">
                  <div className="space-y-1">
                    <p className="font-black text-slate-500 uppercase tracking-widest text-[10.5px]">Clinical Verification Status</p>
                    <p>• Pharmacist Verify: <span className="font-extrabold text-emerald-700 uppercase">{targetPatientPrimary.pharmacistVerification?.status || 'Pending'}</span> ({targetPatientPrimary.pharmacistVerification?.verifiedBy || targetPatientPrimary.staff?.pharmacist || 'Pending'})</p>
                    <p>• Stock / Logistics Arrival: <span className="font-extrabold text-blue-700 uppercase">{targetPatientPrimary.clerkVerification?.status || 'Pending'}</span> ({targetPatientPrimary.clerkVerification?.verifiedBy || 'Pending'})</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="font-black text-slate-500 uppercase tracking-widest text-[10.5px]">Dispensation Destination</p>
                    <p>• Pharmacy Room: <span className="font-bold text-slate-800">{targetPatientPrimary.pharmacyLocation || 'Phar IV'}</span></p>
                    <p>• Department: <span className="font-bold text-slate-800">{targetPatientPrimary.department}</span></p>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-3 gap-6 text-center pt-6 border-t border-slate-200 text-xs text-slate-600 font-sans">
                  <div>
                    <div className="border-b border-slate-300 pb-1 mb-1 font-sarabun text-slate-800 font-bold min-h-[22px] text-[13px]">
                      {targetPatientPrimary.staff?.doctor}
                    </div>
                    <span className="text-[11px] uppercase font-bold text-slate-500">Prescribing Physician (แพทย์)</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-300 pb-1 mb-1 font-sarabun text-slate-800 font-bold min-h-[22px] text-[13px]">
                      {targetPatientPrimary.pharmacistVerification?.verifiedBy || targetPatientPrimary.staff?.pharmacist || ''}
                    </div>
                    <span className="text-[11px] uppercase font-bold text-slate-500">Reviewing Pharmacist (เภสัชกร)</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-300 pb-1 mb-1 font-sarabun text-slate-800 font-bold min-h-[22px] text-[13px]">
                      {targetPatientPrimary.staff?.nurse || currentUser?.name || ''}
                    </div>
                    <span className="text-[11px] uppercase font-bold text-slate-500">Nurse / Receiving Officer (พยาบาล)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Layout 1 & 2: Single Booking Staff Voucher / Patient Receipt if explicitly requested */}
            {reportScope === 'patient' && singleBooking && isStaffVoucher && false && (
              <div className="space-y-6">
                {/* General demo stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-[10px] sm:text-xs">
                  <div>
                    <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block">Sourcing ID</span>
                    <span className="font-bold text-blue-900 font-sarabun">{singleBooking.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block">{t.patientName}</span>
                    <span className="font-bold text-slate-800">{singleBooking.patientName}</span>
                    <span className="block text-[10px] text-slate-500 font-extrabold whitespace-nowrap font-sarabun">HN: {singleBooking.hn}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block">{t.bookingDate}</span>
                    <span className="font-bold text-slate-700 font-sarabun text-xs">{formatDateToDMY(singleBooking.bookingDate)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block">{t.dateOfUse}</span>
                    <span className="font-black text-slate-900 text-sm font-sarabun">{formatDateToDMY(singleBooking.dateOfUse)}</span>
                    <span className="block text-[8px] text-slate-400 font-bold uppercase">{singleBooking.department}</span>
                  </div>
                </div>

                {/* Table of items */}
                <div>
                  <div className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2 pl-1 border-l-2 border-blue-900">
                    Sourced Medications Itemization
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-550 font-bold uppercase text-[8.5px] border-b border-slate-200">
                          <th className="py-2 px-3">Medication Description</th>
                          <th className="py-2 px-3 text-center">stock code</th>
                          <th className="py-2 px-3 text-center w-20">Qty</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-101 font-medium text-slate-700 select-none">
                        {singleBooking.medications.map((item, idx) => (
                          <tr key={idx} className="bg-white">
                            <td className="py-2 px-3 font-semibold text-slate-900">{item.drugName}</td>
                            <td className="py-2 px-3 text-center text-slate-400 font-extrabold font-sarabun text-xs">{item.stockCode}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-900 text-sm font-sarabun">{item.quantity}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800 font-sarabun">฿{item.unitPrice.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-black text-slate-900 font-sarabun">฿{item.totalPrice.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                          <td colSpan={4} className="py-3 px-3 text-right text-slate-500 text-[9px] tracking-wider uppercase font-black">Total Amount Due:</td>
                          <td className="py-3 px-3 text-right text-blue-900 text-base font-black font-sarabun">฿{singleBooking.totalAmount.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Regimen and Notes if present */}
                {(singleBooking.regimen || singleBooking.note) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-indigo-50/45 border border-indigo-150/75 text-xs text-indigo-950 font-medium font-sans">
                    {singleBooking.regimen && (
                      <div>
                        <span className="text-indigo-600 uppercase font-black tracking-wider text-[8px] block mb-1">Treatment Regimen</span>
                        <span className="font-extrabold bg-white border border-indigo-150 rounded px-1.5 py-0.5 inline-block">{singleBooking.regimen}</span>
                      </div>
                    )}
                    {singleBooking.note && (
                      <div>
                        <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block mb-1">Special Notes / Clinical Directions</span>
                        <p className="text-slate-700 bg-white border border-slate-150 rounded p-2 text-[11px] font-medium whitespace-pre-wrap">{singleBooking.note}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Clinical verification */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50/50 border border-slate-200 text-[10px] text-slate-600">
                  <div className="space-y-1">
                    <p className="font-black text-slate-400 uppercase tracking-widest text-[8px] mb-1">Clinic Officers</p>
                    <p>• Prescribing Physician: <span className="font-bold text-slate-800">{singleBooking.staff.doctor}</span></p>
                    <p>• Requesting Ward Nurse: <span className="font-bold text-slate-800">{singleBooking.staff.nurse || 'N/A'}</span></p>
                    <p>• Verifying Pharmacist: <span className="font-bold text-slate-800">{singleBooking.staff.pharmacist || 'Wait for sign'}</span></p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="font-black text-slate-400 uppercase tracking-widest text-[8px] mb-1">Verify Sync Checklist</p>
                    <p>• RPh Status: <span className="font-bold text-emerald-700 uppercase">{singleBooking.pharmacistVerification.status}</span></p>
                    <p>• Stock Status: <span className="font-bold text-blue-700 uppercase">{singleBooking.clerkVerification.status}</span></p>
                    <p>• Dispatch Receipt: <span className="font-bold text-slate-700 uppercase">{singleBooking.medicineReceived ? 'PREPARED' : 'PENDING'}</span></p>
                  </div>
                </div>

                {/* Signature panels */}
                <div className="grid grid-cols-2 gap-10 text-center pt-8 border-t border-slate-200 text-xs text-slate-500">
                  <div className="space-y-4">
                    <div className="border-b border-dashed border-slate-400 w-44 mx-auto h-7"></div>
                    <p className="uppercase text-[8px] font-black text-slate-400 mt-1">Requesting Officer (Nurse Sign)</p>
                  </div>
                  <div className="space-y-4">
                    <div className="border-b border-dashed border-slate-400 w-44 mx-auto h-7 flex items-end justify-center pb-0.5">
                      {singleBooking.pharmacistVerification.status === 'Verified' && (
                        <span className="font-black text-blue-900 text-[11px] font-sarabun">{singleBooking.pharmacistVerification.verifiedBy}</span>
                      )}
                    </div>
                    <p className="uppercase text-[8px] font-black text-slate-400 mt-1">Dispensing Pharmacist Sign (RPh)</p>
                  </div>
                </div>
              </div>
            )}
            {/* Layout 2: Patient Receipt */}
            {isPatientReceipt && singleBooking && (
              <div className="space-y-6">
                {/* Patient Banner block */}
                <div className="p-4 rounded-xl bg-amber-50/55 border border-amber-200/90 text-[13px]">
                  <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4 gap-x-4">
                    <div>
                      <span className="text-amber-700 font-extrabold uppercase text-[10.5px] tracking-wider block">Patient Name / ชื่อผู้ป่วย</span>
                      <span className="font-black text-slate-900 text-[15px] leading-tight block mt-0.5">{singleBooking.patientName}</span>
                    </div>
                    <div>
                      <span className="text-amber-700 font-extrabold uppercase text-[10.5px] tracking-wider block">Patient HN / รหัสโรงพยาบาล</span>
                      <span className="font-bold text-slate-800 text-[15px] block mt-0.5 whitespace-nowrap font-sarabun">{singleBooking.hn}</span>
                    </div>
                    <div>
                      <span className="text-amber-700 font-extrabold uppercase text-[10.5px] tracking-wider block">Clinic Ward / แผนกรับบริการ</span>
                      <span className="font-bold text-slate-800 text-[13px] block mt-0.5">{singleBooking.department}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-700 font-extrabold uppercase text-[10.5px] tracking-wider block">Reservation Date / วันที่ต้องใช้</span>
                      <span className="font-black text-amber-900 text-[15px] block mt-0.5 font-sarabun">{formatDateToDMY(singleBooking.dateOfUse)}</span>
                    </div>
                  </div>
                </div>

                {/* Sourced Medications */}
                <div>
                  <div className="text-xs text-amber-800 font-black uppercase tracking-wider mb-2 pl-1.5 border-l-2 border-amber-500 flex justify-between">
                    <span>💊 Prescribed Medications List / รายการใบสั่งยาจัดเตรียม</span>
                    <span className="font-sarabun italic font-medium text-[10px] text-slate-500 uppercase">Pre-arranged and Reserved</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden print:overflow-visible shadow-xs bg-white">
                    <table className="w-full text-left text-[13px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-black uppercase tracking-wider text-[10.5px] border-b border-slate-200">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Medication Name / ชื่อยา</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">Stock Code</th>
                          <th className="py-2.5 px-3 text-center">Qty / จำนวน</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Subtotal / ยอดรวมย่อย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {singleBooking.medications.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/20">
                            <td className="py-2.5 px-3 text-slate-500 font-semibold font-sarabun text-xs">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 text-[13px]">{item.drugName}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 font-bold whitespace-nowrap font-sarabun text-xs">{item.stockCode}</td>
                            <td className="py-2.5 px-3 text-center font-black text-slate-900 text-[15px] font-sarabun">{item.quantity} units</td>
                            <td className="py-2.5 px-3 text-right font-bold font-sarabun text-xs">฿{item.unitPrice.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900 font-sarabun text-[13px]">฿{item.totalPrice.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-amber-50/20 font-bold border-t border-slate-200">
                          <td colSpan={5} className="py-3 px-3 text-right uppercase text-xs text-slate-600 tracking-wider">
                            Total Valuation / ยอดมูลค่ารักษาสุทธิ:
                          </td>
                          <td className="py-3 px-3 text-right text-amber-950 text-base font-black font-sarabun">
                            ฿{singleBooking.totalAmount.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Regimen and Patient Note if present */}
                {(singleBooking.regimen || singleBooking.note) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-indigo-50/40 border border-indigo-200 text-[13px] text-slate-700 font-sans">
                    {singleBooking.regimen && (
                      <div>
                        <span className="text-indigo-600 font-extrabold uppercase text-[10.5px] tracking-wider block mb-1">Treatment Regimen / สูตรยานัดพบ</span>
                        <span className="font-black text-indigo-950 block bg-indigo-100/50 border border-indigo-200 px-2 py-1 rounded inline-block font-sarabun text-xs">{singleBooking.regimen}</span>
                      </div>
                    )}
                    {singleBooking.note && (
                      <div>
                        <span className="text-slate-600 font-extrabold uppercase text-[10.5px] tracking-wider block mb-1">Extra Instructions / รายละเอียดบันทึกเพิ่มเติม</span>
                        <p className="text-slate-800 font-medium text-xs block whitespace-pre-wrap">{singleBooking.note}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Friendly Client Guidance Notes */}
                <div className="p-3 bg-amber-50/75 rounded-lg border border-amber-200 text-xs text-amber-950/90 leading-relaxed font-medium space-y-1 page-break-inside-avoid">
                  <p className="font-extrabold text-[13px] uppercase tracking-wide text-amber-900">
                    ⚠️ Dear Patient Notice / คำแนะนำสำหรับคนไข้ในการบริการ:
                  </p>
                  <p>1. Please hand over this receipt printed copy or slide display to the outpatient pharmacy dispensing window on <span className="font-sarabun font-bold">{formatDateToDMY(singleBooking.dateOfUse)}</span> to complete your physical verification and pick up your reservation.</p>
                  <p className="italic text-slate-600">1. กรุณานำใบรับที่พิมพ์นี้ (หรือแสดงรูปหน้าจอ) มาติดต่อห้องยาผู้ป่วยนอก ณ วันที่ <span className="font-sarabun font-bold">{formatDateToDMY(singleBooking.dateOfUse)}</span> เพื่อความรวดเร็วในการรับบริการ</p>
                </div>
              </div>
            )}

            {/* Layout 3: Bulk Sourcing Logistics & Supply Bill */}
            {isBulkReport && (
              <div className="space-y-4">
                {/* Meta and parameters summary */}
                <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-lg p-3.5 text-xs bg-slate-50 print-meta-text">
                  <div className="space-y-1 text-slate-600 font-medium font-sans">
                    <div>
                      • {language === 'TH' ? 'กรองประเภทช่วงเวลา:' : 'Timeframe Filter:'}{' '}
                      <span className="font-extrabold text-slate-800">{filterType === 'useDate' ? 'Date of Use' : 'Booking Date'}</span>
                    </div>
                    <div>
                      • {language === 'TH' ? 'ขอบเขตประเภทช่วงเวลาคิว:' : 'Medicinal Category:'}{' '}
                      <span className="font-extrabold text-slate-800">{drugClass}</span>
                    </div>
                    <div>
                      • {language === 'TH' ? 'ผู้ตรวจสอบยื่นใบสั่งเบิก:' : 'Sourced By:'}{' '}
                      <span className="font-extrabold text-slate-800">
                        {currentUser?.name || 'Logistics Officer'} ({currentUser?.role || 'Staff'})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-slate-600 font-medium text-right font-sans">
                    <div>
                      • {language === 'TH' ? 'วันที่สกัดข้อมูลพิมพ์:' : 'Printed Date:'}{' '}
                      <span className="font-bold text-slate-800">
                        {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH')}
                      </span>
                    </div>
                    <div>
                      • {language === 'TH' ? 'รวมยอดใบจองคิว:' : 'Total Linked Profiles:'}{' '}
                      <span className="font-bold text-slate-800">{activeBookings.length} bookings</span>
                    </div>
                    <div>
                      • {language === 'TH' ? 'สถานะตรวจสอบเบิกจ่าย:' : 'Logistics Voucher Status:'}{' '}
                      <span className="text-emerald-700 font-black bg-emerald-50 px-1.5 py-0.5 border border-emerald-200 rounded text-[11px]">
                        Active Aggregate Sourcing
                      </span>
                    </div>
                  </div>
                </div>

                {/* LOCATIONS GROUPED LISTING */}
                {(() => {
                  // Find all unique locations within active bookings
                  const activeLocs = Array.from(new Set<string>(
                    activeBookings.map(b => (b.pharmacyLocation || '').trim())
                  )).sort((a, b) => {
                    if (!a) return 1;
                    if (!b) return -1;
                    return a.localeCompare(b);
                  });

                  if (activeLocs.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-400 font-extrabold uppercase font-sans text-sm">
                        No items found matching the selected parameters.
                      </div>
                    );
                  }

                  return activeLocs.map((locKey, locIdx) => {
                    const locBookings = activeBookings.filter(b => (b.pharmacyLocation || '').trim() === locKey);
                    if (locBookings.length === 0) return null;

                    // Local aggregated medicine totals for this room
                    const locAggregatedMeds: { [key: string]: { name: string; sku: string; qty: number; category: string } } = {};
                    locBookings.forEach((b) => {
                      b.medications.forEach((m) => {
                        if (locAggregatedMeds[m.drugId]) {
                          locAggregatedMeds[m.drugId].qty += m.quantity;
                        } else {
                          locAggregatedMeds[m.drugId] = {
                            name: m.drugName,
                            sku: m.stockCode,
                            qty: m.quantity,
                            category: b.mode
                          };
                        }
                      });
                    });
                    const locSummaryList = Object.values(locAggregatedMeds);
                    const displayLocLabel = locKey || (language === 'TH' ? 'ไม่ได้ระบุห้องยา (Unspecified Location)' : 'Unspecified Pharmacy Location');

                    return (
                      <div key={locKey || locIdx} className="space-y-4 border border-slate-200 p-4 rounded-xl bg-white shadow-xs mt-4">
                        {/* Elegant Location Band Header */}
                        <div
                          className="bg-slate-800 text-white px-3.5 py-2 rounded-lg text-[13px] font-black uppercase tracking-wider flex items-center justify-between font-sans"
                          style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>📍</span>
                            <span>{language === 'TH' ? `คลังสำรอง / ห้องยา: ${displayLocLabel}` : `Pharmacy Location: ${displayLocLabel}`}</span>
                          </span>
                          <span className="bg-slate-700 px-2.5 py-0.5 rounded text-xs">
                            {locBookings.length} {language === 'TH' ? 'รายการจอง' : 'Bookings'}
                          </span>
                        </div>

                        {/* Sourcing summary totals for this room */}
                        {currentUser?.role !== 'Pharmacist' && currentUser?.role !== 'Pharmacist Assistant' && (
                          <div className="space-y-1.5 pl-0.5">
                            <p
                              className="text-xs font-black text-slate-600 uppercase tracking-wider border-b border-slate-100 pb-1 font-sans"
                              style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}
                            >
                              📝 {language === 'TH' ? `สรุปรายการยาจอง: ${displayLocLabel}` : `Sourcing Summary Totals: ${displayLocLabel}`}
                            </p>
                            <div className="border border-slate-200 rounded-lg overflow-hidden print:overflow-visible bg-white">
                              <table className="w-full table-fixed text-left border-collapse print-compact-table text-xs">
                                <colgroup>
                                  <col className="w-[5%]" />
                                  <col className="w-[46%]" />
                                  <col className="w-[22%]" />
                                  <col className="w-[13%]" />
                                  <col className="w-[14%]" />
                                </colgroup>
                                <thead>
                                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10.5px] border-b border-slate-200">
                                    <th className="py-1.5 px-1.5 text-center">☐</th>
                                    <th className="py-1.5 px-2">Medicine Description / รหัสเวชภัณฑ์</th>
                                    <th className="py-1.5 px-2 text-center">Stock Code</th>
                                    <th className="py-1.5 px-1.5 text-center">Class</th>
                                    <th className="py-1.5 px-2 text-right">Demand Qty</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {locSummaryList.map((item, idx) => (
                                    <tr key={idx} className="bg-white">
                                      <td className="py-1.5 px-1.5 text-center text-slate-500 font-sans text-sm">☐</td>
                                      <td className="py-1.5 px-2 font-semibold text-slate-900 text-[13px] break-words">{item.name}</td>
                                      <td className="py-1.5 px-2 text-center text-slate-600 font-bold font-sarabun text-xs break-words">{item.sku}</td>
                                      <td className="py-1.5 px-1.5 text-center">
                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase rounded border border-slate-200 leading-none">
                                          {item.category}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-black text-indigo-900 text-[15px] font-sarabun">
                                        {item.qty}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Individual Patient Allocations for this room */}
                        <div className="space-y-1.5 pl-0.5">
                          <p
                            className="text-xs font-black text-slate-600 uppercase tracking-wider border-b border-slate-100 pb-1 font-sans"
                            style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}
                          >
                            👥 {language === 'TH' ? `รายละเอียดการจองยาแยกรายบุคคล: ${displayLocLabel}` : `Individual Patient Allocations: ${displayLocLabel}`}
                          </p>
                          <div className="border border-slate-200 rounded-lg overflow-hidden print:overflow-visible bg-white">
                            <table className="w-full table-fixed text-left border-collapse print-compact-table text-xs">
                              <colgroup>
                                <col className="w-[4%]" />
                                <col className="w-[4%]" />
                                <col className="w-[14%]" />
                                <col className="w-[16%]" />
                                <col className="w-[12%]" />
                                <col className="w-[25%]" />
                                <col className="w-[17%]" />
                                <col className="w-[8%]" />
                              </colgroup>
                              <thead>
                                <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10.5px] border-b border-slate-200">
                                  <th className="py-1.5 px-1 text-center">☐</th>
                                  <th className="py-1.5 px-1 text-center font-semibold">#</th>
                                  <th className="py-1.5 px-1 text-center">HN</th>
                                  <th className="py-1.5 px-1.5">{language === 'TH' ? 'ชื่อผู้ป่วย' : 'Patient Name'}</th>
                                  <th className="py-1.5 px-1 text-center font-bold">{language === 'TH' ? 'วันที่ต้องใช้' : 'Date of Use'}</th>
                                  <th className="py-1.5 px-1.5">{language === 'TH' ? 'ชื่อยาเวชภัณฑ์สำรอง' : 'Drug Name'}</th>
                                  <th className="py-1.5 px-1 text-center">Stock Code</th>
                                  <th className="py-1.5 px-1.5 text-right">Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {locBookings.flatMap((b) => 
                                  b.medications.map((m) => ({
                                    hn: b.hn,
                                    patientName: b.patientName,
                                    dateOfUse: b.dateOfUse,
                                    drugName: m.drugName,
                                    stockCode: m.stockCode,
                                    quantity: m.quantity,
                                    regimen: b.regimen,
                                    holdStatus: b.holdStatus,
                                    rolloverStatus: b.rolloverStatus
                                  }))
                                ).map((row, rIdx) => (
                                  <tr key={rIdx} className="bg-white hover:bg-slate-50/10 font-medium">
                                    <td className="py-1.5 px-1 text-center text-slate-500 font-sans text-sm">☐</td>
                                    <td className="py-1.5 px-1 text-center text-slate-500 font-sarabun font-semibold text-xs">{rIdx + 1}</td>
                                    <td className="py-1.5 px-1 text-center font-bold text-slate-800 font-sarabun text-xs tracking-tight break-words">{row.hn}</td>
                                    <td className="py-1.5 px-1.5 font-extrabold text-slate-950 text-[12.5px] break-words">
                                      <span className="block leading-snug">{row.patientName}</span>
                                      {row.holdStatus?.isHeld && (
                                        <div className="mt-1 flex flex-col gap-0.5">
                                          <span className="self-start px-1.5 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded text-[9.5px] font-black inline-flex flex-wrap items-center gap-1">
                                            <span>Hold</span>
                                            {(row.holdStatus.heldAt || (row.holdStatus as any).timestamp) && (
                                              <span className="font-sarabun tabular-nums text-[8.5px] font-bold opacity-85 border-l border-red-300 pl-1">
                                                {formatTimestamp(row.holdStatus.heldAt || (row.holdStatus as any).timestamp)}
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      )}
                                      {row.rolloverStatus && (
                                        <div className="mt-1 flex flex-col gap-0.5">
                                          <span className="self-start px-1.5 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded text-[9.5px] font-black inline-flex flex-wrap items-center gap-1">
                                            <span>{language === 'TH' ? 'เปลี่ยนวัน' : 'Rollover'}</span>
                                            {(row.rolloverStatus.rolledOverAt || (row.rolloverStatus as any).rolledOverAt) && (
                                              <span className="font-sarabun tabular-nums text-[8.5px] font-bold opacity-85 border-l border-purple-300 pl-1">
                                                {formatTimestamp(row.rolloverStatus.rolledOverAt || (row.rolloverStatus as any).rolledOverAt)}
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-1 text-center text-slate-700 font-bold font-sarabun text-xs whitespace-nowrap">{formatDateToDMY(row.dateOfUse)}</td>
                                    <td className="py-1.5 px-1.5 font-black text-slate-900 text-[12.5px] leading-snug break-words">
                                      <span>{row.drugName}</span>
                                      {row.regimen && (
                                        <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-sm text-[10px] px-1 py-0.5 ml-1 whitespace-nowrap inline-block">
                                          ({row.regimen})
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-1 text-center text-slate-600 font-bold font-sarabun text-xs break-all">{row.stockCode}</td>
                                    <td className="py-1.5 px-1.5 text-right font-black text-blue-900 text-[15px] font-sarabun whitespace-nowrap">{row.quantity}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-50 font-bold border-t border-slate-200">
                                  <td colSpan={7} className="py-2 px-2 text-right uppercase text-[11px] text-slate-600 tracking-wider font-sans">
                                    {language === 'TH' ? 'รวมยอดจัดสรรห้องนี้:' : 'Total Quantity For Location:'}
                                  </td>
                                  <td className="py-2 px-1.5 text-right font-black text-slate-900 text-[15px] font-sarabun whitespace-nowrap">
                                    {locSummaryList.reduce((sum, item) => sum + item.qty, 0)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

                {/* Signatures check block */}
                <div className="grid grid-cols-2 gap-10 text-center pt-6 border-t border-slate-200 text-xs text-slate-600 no-break">
                  <div className="space-y-4">
                    <div className="border-b border-dashed border-slate-400 w-48 mx-auto h-6"></div>
                    <p className="uppercase text-[11px] font-black text-slate-500 mt-1">Dispensing Logistics Associate</p>
                  </div>
                  <div className="space-y-4">
                    <div className="border-b border-dashed border-slate-400 w-48 mx-auto h-6 flex items-end justify-center pb-0.5">
                      <span className="font-black text-blue-900 text-xs">{currentUser?.name || 'Verified Pharmacist'}</span>
                    </div>
                    <p className="uppercase text-[11px] font-black text-slate-500 mt-1">Authorized Verification Pharmacist (RPh Lead)</p>
                  </div>
                </div>
              </div>
            )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // STANDARD IN-APP VIEW DESIGN WITH FLOATING OPEN FULLSCREEN BUTTON
  if (singleBooking) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-slate-400" />
            {t.medicationBookReport}
          </span>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setPrintType('voucher');
                setIsHtmlPrintActive(true);
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              {language === 'TH' ? 'พิมพ์ใบเบิกเจ้าหน้าที่' : 'Print Staff Voucher'}
            </button>
            <button
              onClick={() => {
                setPrintType('receipt');
                setIsHtmlPrintActive(true);
              }}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5" />
              {language === 'TH' ? 'พิมพ์ใบเสร็จคนไข้' : 'Print Patient Receipt'}
            </button>
          </div>
        </div>

        {/* Informative Preview Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs font-sans">
          <div className="border-b-2 border-slate-101 pb-4 text-center">
            <h1 className="text-base font-black text-slate-800 uppercase">BANGKOK HOSPITAL PATTAYA</h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">RXNexus Prescription Sourcing Preview</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 text-xs text-slate-600 font-medium">
            <div>
              <p className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">Booking ID</p>
              <p className="font-bold text-slate-800 text-sm font-sarabun">{singleBooking.id}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">{t.bookingDate}</p>
              <p className="font-semibold text-slate-755 text-[11px] font-sarabun">{formatDateToDMY(singleBooking.bookingDate)}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">{t.patientName}</p>
              <p className="font-bold text-slate-805">{singleBooking.patientName}</p>
              <p className="text-[11px] text-slate-450 font-bold font-sarabun whitespace-nowrap">HN: {singleBooking.hn}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">{t.dateOfUse}</p>
              <p className="font-bold text-slate-800 text-[11px] font-sarabun">{formatDateToDMY(singleBooking.dateOfUse)}</p>
              <p className="text-[10px] text-slate-450 font-bold uppercase">{singleBooking.department}</p>
            </div>
          </div>

          {/* Med list */}
          <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-550 font-bold border-b border-slate-200 uppercase tracking-divider text-[9.5px]">
                  <th className="p-3">Medicine Description</th>
                  <th className="p-3">stock code</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-101 text-slate-700">
                {singleBooking.medications.map((item, idx) => (
                  <tr key={idx} className="font-medium text-slate-650 hover:bg-slate-55/15">
                    <td className="p-3 font-semibold text-slate-800">{item.drugName}</td>
                    <td className="p-3 text-slate-450 font-bold font-sarabun">{item.stockCode}</td>
                    <td className="p-3 text-center font-bold text-sm text-slate-850 font-sarabun">{item.quantity}</td>
                    <td className="p-3 text-right font-semibold font-sarabun">฿{item.unitPrice.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-slate-900 font-sarabun">฿{item.totalPrice.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/70 font-bold text-slate-850">
                  <td colSpan={4} className="p-3 text-right text-slate-500 tracking-wider">TOTAL AMOUNT DUE:</td>
                  <td className="p-3 text-right text-blue-900 text-sm font-bold font-sarabun">฿{singleBooking.totalAmount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Regimen and Notes if present */}
          {(singleBooking.regimen || singleBooking.note) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 rounded-lg bg-indigo-50/40 border border-indigo-100 text-xs text-slate-700">
              {singleBooking.regimen && (
                <div>
                  <span className="text-indigo-600 font-bold uppercase text-[9px] tracking-wider block mb-1">Treatment Regimen</span>
                  <span className="font-extrabold text-indigo-950 bg-white border border-indigo-200/50 px-2 py-0.5 rounded inline-block">{singleBooking.regimen}</span>
                </div>
              )}
              {singleBooking.note && (
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block mb-1">Special Notes / Directions</span>
                  <p className="text-slate-700 bg-white border border-slate-200/50 rounded p-2 text-[11px] font-medium whitespace-pre-wrap">{singleBooking.note}</p>
                </div>
              )}
            </div>
          )}

          {/* Verification labels */}
          <div className="grid grid-cols-2 gap-4 mt-6 p-4 rounded-lg border border-slate-100 bg-slate-50/60 text-[10px] text-slate-505">
            <div>
              <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Sourcing MD / RN Officers</p>
              <p>• MD: <span className="font-semibold text-slate-700">{singleBooking.staff.doctor}</span></p>
              <p>• RN: <span className="font-semibold text-slate-700">{singleBooking.staff.nurse || 'N/A'}</span></p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Ledger Sync status</p>
              <p>Pharmacist Verification: <span className="font-semibold text-slate-705">{singleBooking.pharmacistVerification.status}</span></p>
              <p>Clerk Dispatch Check: <span className="font-semibold text-slate-705">{singleBooking.clerkVerification.status}</span></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List summary bulk sourcing reporting page
  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            {t.reportsTitle}
          </h2>
          <p className="text-[11px] text-slate-450 mt-0.5">{t.reportsDashboard}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope switch on non-print page */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setReportScope('aggregate')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                reportScope === 'aggregate'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {language === 'TH' ? '📊 รายงานรวม' : '📊 Batch Summary'}
            </button>
            <button
              type="button"
              onClick={() => setReportScope('patient')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                reportScope === 'patient'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {language === 'TH' ? '👤 ต่อคนไข้ 1 คน' : '👤 Per Patient'}
            </button>
          </div>

          {reportScope === 'patient' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-3xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase">HN:</span>
              <select
                value={selectedPatientHn}
                onChange={(e) => setSelectedPatientHn(e.target.value)}
                className="bg-transparent text-xs font-bold text-blue-900 focus:outline-hidden cursor-pointer max-w-[200px]"
              >
                {uniquePatients.map(p => (
                  <option key={p.hn} value={p.hn}>
                    {p.hn} - {p.patientName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            id="print-bulk-report-btn"
            onClick={() => {
              setIsHtmlPrintActive(true);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            {reportScope === 'patient'
              ? (language === 'TH' ? 'พิมพ์รายงานคนไข้นี้ PDF' : 'Print Patient Report')
              : (language === 'TH' ? 'พิมพ์รายงานรวม PDF' : 'Print Batch Report')}
          </button>
        </div>
      </div>

      {/* Grid Settings Filter Parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm text-xs items-start print:hidden">
        <div className="space-y-1.5">
          <label className="block text-slate-500 font-bold uppercase text-[10px] tracking-wider mb-1">
            {t.modeSelect}
          </label>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setFilterType('useDate')}
              className={`flex-1 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all shadow-xs ${
                filterType === 'useDate' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Rx Use Date
            </button>
            <button
              onClick={() => setFilterType('bookingDate')}
              className={`flex-1 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all shadow-xs ${
                filterType === 'bookingDate' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Order Date
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-slate-500 font-bold uppercase text-[10px] tracking-wider mb-1">
            Date Range Filter
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                id="report-start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={ignoreDate}
                className="w-full bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 border border-slate-200 px-2 py-1.5 rounded-md text-xs font-medium text-slate-700 focus:outline-hidden focus:border-blue-500 font-sarabun tabular-nums shadow-xs"
              />
            </div>
            <div>
              <input
                id="report-end-date-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={ignoreDate}
                className="w-full bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 border border-slate-200 px-2 py-1.5 rounded-md text-xs font-medium text-slate-700 focus:outline-hidden focus:border-blue-500 font-sarabun tabular-nums shadow-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <input
              id="report-ignore-date-checkbox"
              type="checkbox"
              checked={ignoreDate}
              onChange={(e) => setIgnoreDate(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3 cursor-pointer"
            />
            <label htmlFor="report-ignore-date-checkbox" className="text-[10px] text-slate-500 font-bold uppercase tracking-wider select-none cursor-pointer">
              {language === 'TH' ? 'ทุกช่วงเวลาสะสม' : 'All time records'}
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-slate-500 font-bold uppercase text-[10px] tracking-wider mb-1">
            {t.reportsType}
          </label>
          <select
            id="report-drug-class-select"
            value={drugClass}
            onChange={(e) => setDrugClass(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold focus:outline-hidden cursor-pointer hover:bg-slate-100 transition-colors shadow-xs text-slate-700"
          >
            <option value="All">{t.reportsAll}</option>
            <option value="General">{t.tabGeneral}</option>
            <option value="Oncology">{t.tabOncology}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-slate-500 font-bold uppercase text-[10px] tracking-wider mb-1">
            {language === 'TH' ? 'ล็อกห้องยา (Location)' : 'Pharmacy Location'}
          </label>
          <select
            id="report-pharmacy-location-select"
            value={pharmacyLocation}
            onChange={(e) => {
              const val = e.target.value;
              setPharmacyLocation(val);
              setSelectedPharmacyLocation(val);
            }}
            className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold focus:outline-hidden cursor-pointer hover:bg-slate-100 transition-colors uppercase shadow-xs text-slate-700"
          >
            {currentUser?.role !== 'Pharmacy Stock Clerk' && (
              <option value="All">{language === 'TH' ? 'แสดงทั้งหมด (All)' : 'All Locations'}</option>
            )}
            {uniqueLocations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-slate-500 font-bold uppercase text-[10px] tracking-wider mb-1">
            {language === 'TH' ? 'ค้นหาด้วย HN ผู้ป่วย' : 'Patient HN Search'}
          </label>
          <input
            id="report-patient-hn-input"
            type="text"
            value={hnQuery}
            onChange={(e) => setHnQuery(e.target.value)}
            placeholder="e.g., 02-xx-xxxxxx"
            className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-sarabun tabular-nums transition-colors shadow-xs text-slate-700 font-medium"
          />
        </div>

        <div className="flex h-full flex-col justify-end">
          <label className="block text-transparent font-bold uppercase text-[10px] tracking-wider mb-1 select-none">
            Status
          </label>
          <div className="w-full text-center bg-blue-50/80 border border-blue-200/60 text-blue-800 py-2 px-1.5 rounded-lg font-black text-xs uppercase tracking-wider h-[34px] flex items-center justify-center shadow-[inset_0_1px_3px_rgb(0,0,0,0.05)]">
            🔍 Found {activeBookings.length}
          </div>
        </div>
      </div>

      {/* Aggregated view summary cards in viewport */}
      {activeBookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm mt-6">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            {language === 'TH' ? 'ไม่พบข้อมูลใบจองตามเงื่อนไขที่เลือก' : 'No clinical bookings recorded for the parameters chosen.'}
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            {language === 'TH' ? 'กรุณาปรับเงื่อนไขตัวกรองด้านบนใหม่' : 'Adjust classification toggles or calendar date inputs above'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs font-sans space-y-8 mt-6">
          <div className="border-b-2 border-slate-100 pb-5 text-center">
            <h1 className="text-base font-black text-slate-800 uppercase">BANGKOK HOSPITAL PATTAYA</h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-sarabun tabular-nums">Aggregate Logistics Sourcing Ledger Preview</p>
            <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-widest leading-none">
              Filter: {filterType === 'useDate' ? 'DATE OF DIRECT USE' : 'BOOKING DATE'} = {ignoreDate ? 'ALL TIME' : `${formatDateToDMY(startDate)} to ${formatDateToDMY(endDate)}`} ({drugClass} Classification)
            </p>
          </div>

          {currentUser?.role !== 'Pharmacist' && currentUser?.role !== 'Pharmacist Assistant' && (
            <div className="space-y-3 bg-slate-50/80 p-5 rounded-lg border border-slate-200">
              <h3 className="font-bold text-[10px] uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-slate-500" />
                {language === 'TH' ? 'ยอดสรุปเบิกเวชภัณฑ์รวมตามรหัสคลัง (Requisition Inventory Totals)' : 'Warehouse Sourcing Order summary totals'}
              </h3>

              <table className="w-full text-xs text-left border-collapse bg-white rounded-lg border border-slate-200 overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[9px] border-b border-slate-200 font-bold font-sans">
                    <th className="p-3">Generic / Medicine Trade Name</th>
                    <th className="p-3 whitespace-nowrap">Stock Code</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Unified Sourcing Demand (Qty)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-101 text-slate-700 flex-none h-auto">
                  {summaryList.map((item, index) => (
                    <tr key={index} className="text-slate-655 font-medium hover:bg-slate-50/50 bg-white">
                      <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="p-3 font-bold text-slate-500 font-sarabun tabular-nums whitespace-nowrap">{item.sku}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          item.category === 'Oncology' ? 'bg-red-50 text-red-600 border-red-105' : 'bg-blue-50 text-blue-600 border-blue-105'
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-blue-700 text-sm">{item.qty} units</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detailed patient medication layout - as requested "หน้า report drug detail ให้ขึ้นเป็นรายชื่อคนไข้แยกราย-ยาที่ใช้ ด้วย" */}
          <div className="space-y-3 bg-slate-50/80 p-5 rounded-lg border border-slate-200">
            <h3 className="font-bold text-[10px] uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-500" />
                {language === 'TH' ? 'รายละเอียดจัดสรรยาจำเพาะเจาะจงรายคิวเวชภัณฑ์ (Report Drug Details)' : 'Report Drug Details (Individual Allocations)'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 font-sarabun tabular-nums">
                {activeBookings.flatMap(b => b.medications).length} lines
              </span>
            </h3>

            <div className="overflow-x-auto border border-slate-200 bg-white rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-550 font-semibold uppercase tracking-wider text-[9px] border-b border-slate-200">
                    <th className="p-3 text-center w-10">☐</th>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">{language === 'TH' ? 'คนไข้ / รหัส HN' : 'Patient / HN'}</th>
                    <th className="p-3 text-center whitespace-nowrap">{language === 'TH' ? 'วันที่ต้องใช้' : 'Date of Use'}</th>
                    <th className="p-3">{language === 'TH' ? 'ชื่อยาเวชภัณฑ์สำรอง' : 'Drug Name'}</th>
                    <th className="p-3 text-center whitespace-nowrap">Stock Code</th>
                    <th className="p-3 text-center whitespace-nowrap">{language === 'TH' ? 'ห้องยา' : 'Location'}</th>
                    <th className="p-3 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-101 text-slate-700">
                  {activeBookings.flatMap((b) => 
                    b.medications.map((m) => ({
                      hn: b.hn,
                      patientName: b.patientName,
                      dateOfUse: b.dateOfUse,
                      pharmacyLocation: b.pharmacyLocation,
                      drugName: m.drugName,
                      stockCode: m.stockCode,
                      quantity: m.quantity,
                      regimen: b.regimen,
                      holdStatus: b.holdStatus,
                      rolloverStatus: b.rolloverStatus
                    }))
                  ).map((row, idx) => (
                    <tr key={idx} className="font-medium hover:bg-slate-50/50 bg-white">
                      <td className="p-3 text-center text-slate-400 font-sans text-sm">☐</td>
                      <td className="p-3 text-center text-slate-400 font-sarabun font-semibold text-[11px]">{idx + 1}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900">{row.patientName}</span>
                            {row.holdStatus?.isHeld && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded text-[9px] font-black whitespace-nowrap inline-flex items-center gap-1">
                                <span>Hold</span>
                                {(row.holdStatus.heldAt || (row.holdStatus as any).timestamp) && (
                                  <span className="font-sarabun tabular-nums text-[8px] font-bold opacity-80 border-l border-red-300 pl-1">
                                    {formatTimestamp(row.holdStatus.heldAt || (row.holdStatus as any).timestamp)}
                                  </span>
                                )}
                              </span>
                            )}
                            {row.rolloverStatus && (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded text-[9px] font-black whitespace-nowrap inline-flex items-center gap-1">
                                <span>{language === 'TH' ? 'เปลี่ยนวัน' : 'Rollover'}</span>
                                {(row.rolloverStatus.rolledOverAt || (row.rolloverStatus as any).rolledOverAt) && (
                                  <span className="font-sarabun tabular-nums text-[8px] font-bold opacity-80 border-l border-purple-300 pl-1">
                                    {formatTimestamp(row.rolloverStatus.rolledOverAt || (row.rolloverStatus as any).rolledOverAt)}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-450 block font-sarabun font-extrabold whitespace-nowrap">HN: {row.hn}</span>
                      </td>
                      <td className="p-3 text-center text-slate-600 font-bold whitespace-nowrap font-sarabun text-xs">{formatDateToDMY(row.dateOfUse)}</td>
                      <td className="p-3 font-semibold text-slate-800">
                        {row.drugName}
                        {row.regimen && (
                          <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-sm text-[9px] px-1 py-0.5 ml-1.5 whitespace-nowrap inline-block">
                            ({row.regimen})
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-bold font-sarabun whitespace-nowrap text-xs">{row.stockCode}</td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px] border border-slate-200 font-sarabun uppercase">
                          {row.pharmacyLocation || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-indigo-950 text-sm font-sarabun whitespace-nowrap">{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
