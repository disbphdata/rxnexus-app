import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Database, Download, AlertTriangle, Trash2, Calendar, ImageOff, CloudUpload, HardDrive, CheckCircle2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  isStorageUrl,
  isBase64Image,
  estimateBase64Bytes,
  uploadBase64ToStorage,
  deletePrescriptionFromStorage
} from '../utils/prescriptionStorage';
import { compressImage } from '../utils/imageCompressor';

export default function DatabaseMaintenance() {
  const { bookings, language, spawnAlert, currentUser } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);

  // Monthly archive states
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [isImporting, setIsImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Keep record, clear old prescriptionImage states
  const [clearImageMonths, setClearImageMonths] = useState<1 | 2 | 3>(1);
  const [onlyCompletedForImageClear, setOnlyCompletedForImageClear] = useState<boolean>(true);
  const [showClearImagesConfirm, setShowClearImagesConfirm] = useState(false);

  // Migrate Base64 -> Firebase Storage states
  const [isMigratingStorage, setIsMigratingStorage] = useState(false);
  const [migrateProgress, setMigrateProgress] = useState<{ current: number; total: number } | null>(null);
  const [storageRuleHint, setStorageRuleHint] = useState<string>('');

  // Storage stats across all bookings
  const storageStats = useMemo(() => {
    let base64Count = 0;
    let base64Bytes = 0;
    let storageUrlCount = 0;
    let clearedCount = 0;

    bookings.forEach((b) => {
      if (isBase64Image(b.prescriptionImage)) {
        base64Count++;
        base64Bytes += estimateBase64Bytes(b.prescriptionImage);
      } else if (isStorageUrl(b.prescriptionImage)) {
        storageUrlCount++;
      } else if (b.imageClearedAt) {
        clearedCount++;
      }
    });

    return {
      base64Count,
      base64Bytes,
      base64MB: (base64Bytes / (1024 * 1024)).toFixed(2),
      storageUrlCount,
      clearedCount
    };
  }, [bookings]);

  // Filter old images eligible for "Keep Record, Clear Image"
  const oldImageBookings = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - clearImageMonths);

    return bookings.filter((b) => {
      if (!b.prescriptionImage) return false;
      const targetDateStr = b.dateOfUse || b.bookingDate;
      if (!targetDateStr) return false;
      const targetDate = new Date(targetDateStr);
      if (isNaN(targetDate.getTime()) || targetDate >= cutoffDate) return false;

      if (onlyCompletedForImageClear) {
        const isDone =
          b.clerkVerification?.status === 'Ready-to-use' ||
          b.cancelStatus?.approved === true;
        if (!isDone) return false;
      }
      return true;
    });
  }, [bookings, clearImageMonths, onlyCompletedForImageClear]);

  const reclaimableImageStats = useMemo(() => {
    let bytes = 0;
    let storageCount = 0;
    oldImageBookings.forEach((b) => {
      if (isBase64Image(b.prescriptionImage)) {
        bytes += estimateBase64Bytes(b.prescriptionImage);
      } else if (isStorageUrl(b.prescriptionImage)) {
        storageCount++;
      }
    });
    return {
      totalCount: oldImageBookings.length,
      storageCount,
      mbLabel: (bytes / (1024 * 1024)).toFixed(2)
    };
  }, [oldImageBookings]);

  // Filter 6 month old bookings
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const oldBookings = bookings.filter((b) => {
    if (!b.dateOfUse) return false;
    const bookingDate = new Date(b.dateOfUse);
    return bookingDate < sixMonthsAgo;
  });

  const targetYearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const monthlyBookings = bookings.filter((b) => {
    return b.dateOfUse && b.dateOfUse.startsWith(targetYearMonth);
  });

  const handleExportMonthlyJSON = () => {
    if (monthlyBookings.length === 0) {
      spawnAlert(
        language === 'TH'
          ? `ไม่มีข้อมูลของเดือน ${targetYearMonth} ให้ดาวน์โหลด`
          : `No bookings found for ${targetYearMonth}`,
        'error'
      );
      return;
    }

    const jsonString = JSON.stringify(monthlyBookings, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `med_bookings_${targetYearMonth}_archive.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    spawnAlert(
      language === 'TH'
        ? `สำรองไฟล์รายเดือนของ ${targetYearMonth} เรียบร้อยแล้ว (${monthlyBookings.length} รายการ)`
        : `Exported monthly JSON file for ${targetYearMonth} (${monthlyBookings.length} records)`,
      'success'
    );
  };

  const handleImportMonthlyJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!Array.isArray(parsed)) {
          throw new Error(
            language === 'TH'
              ? 'รูปแบบไฟล์ไม่ถูกต้อง (ต้องเป็นอาเรย์ของข้อมูล)'
              : 'Invalid file structure: must be an array of bookings'
          );
        }

        let importCount = 0;
        for (const item of parsed) {
          if (item && item.id && item.patientName) {
            await setDoc(doc(db, 'bookings', item.id), item);
            importCount++;
          }
        }

        const logId = 'log-' + Date.now();
        await setDoc(doc(db, 'logs', logId), {
          id: logId,
          timestamp: new Date().toISOString(),
          userId: currentUser?.id || 'system',
          userName: currentUser?.name || 'Admin',
          userRole: currentUser?.role || 'Admin',
          action: 'Monthly Archive Import',
          details: `Imported and restored ${importCount} booking records from JSON file backup.`
        });

        spawnAlert(
          language === 'TH'
            ? `นำเข้าข้อมูลและกู้คืนสำเร็จจำนวน ${importCount} รายการ!`
            : `Successfully imported and restored ${importCount} clinical records!`,
          'success'
        );
      } catch (err: any) {
        console.error(err);
        spawnAlert(
          language === 'TH'
            ? 'เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + err.message
            : 'Error importing file: ' + err.message,
          'error'
        );
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExportDataCSV = () => {
    if (bookings.length === 0) {
      spawnAlert(language === 'TH' ? 'ไม่มีข้อมูลให้ดาวน์โหลด' : 'No data to export', 'error');
      return;
    }

    const headers = [
      'ID', 'HN', 'Patient Name', 'Date Of Use', 'Department',
      'Pharmacy Location', 'Doctor', 'Nurse', 'Pharmacist', 'Created At',
      'Status (Pharmacist)', 'Status (Clerk)'
    ];

    const rows = bookings.map((b) => [
      b.id,
      b.hn,
      `"${b.patientName}"`,
      b.dateOfUse,
      `"${b.department || ''}"`,
      `"${b.pharmacyLocation || ''}"`,
      `"${b.staff?.doctor || ''}"`,
      `"${b.staff?.nurse || ''}"`,
      `"${b.staff?.pharmacist || ''}"`,
      b.createdAt,
      b.pharmacistVerification?.status || '',
      b.clerkVerification?.status || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((e) => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `med_bookings_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    spawnAlert('Exported CSV Successfully.', 'success');
  };

  // Execute: Keep booking record & audit trail, clear only prescriptionImage
  const executeClearOldImagesOnly = async () => {
    setShowClearImagesConfirm(false);
    setIsProcessing(true);
    let clearedCount = 0;
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || 'Admin';

    try {
      for (const b of oldImageBookings) {
        if (isStorageUrl(b.prescriptionImage)) {
          await deletePrescriptionFromStorage(b.prescriptionImage);
        }
        await updateDoc(doc(db, 'bookings', b.id), {
          prescriptionImage: '',
          imageClearedAt: nowIso,
          imageClearedBy: operatorName
        });
        clearedCount++;
      }

      const logId = 'log-' + Date.now();
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        timestamp: nowIso,
        userId: currentUser?.id || 'system',
        userName: operatorName,
        userRole: currentUser?.role || 'Admin',
        action: 'Clear Old Images (Keep Records)',
        details: `Cleared prescriptionImage from ${clearedCount} bookings older than ${clearImageMonths} month(s) (~${reclaimableImageStats.mbLabel} MB freed). All clinical booking records & timestamps preserved.`
      });

      spawnAlert(
        language === 'TH'
          ? `ล้างรูปเก่าสำเร็จ ${clearedCount} รายการ (ประหยัด ~${reclaimableImageStats.mbLabel} MB) โดยประวัติการจองยังอยู่ครบ 100%`
          : `Cleared old images from ${clearedCount} bookings (~${reclaimableImageStats.mbLabel} MB freed). All records preserved.`,
        'success'
      );
    } catch (e: any) {
      console.error(e);
      spawnAlert(
        language === 'TH'
          ? 'เกิดข้อผิดพลาดระหว่างล้างรูปเก่า กรุณาตรวจสอบสิทธิ์การเชื่อมต่อ'
          : 'Failed to clear some old images. Please check permissions.',
        'error'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute: Migrate legacy Base64 images in Firestore into Firebase Storage URLs
  const executeMigrateBase64ToStorage = async () => {
    const base64Targets = bookings.filter((b) => isBase64Image(b.prescriptionImage));
    if (base64Targets.length === 0) {
      spawnAlert(
        language === 'TH' ? 'ไม่มีรูป Base64 ค้างใน Firestore แล้ว' : 'No Base64 images pending migration.',
        'info'
      );
      return;
    }

    setIsMigratingStorage(true);
    setStorageRuleHint('');
    setMigrateProgress({ current: 0, total: base64Targets.length });

    let migratedCount = 0;
    try {
      for (let i = 0; i < base64Targets.length; i++) {
        const target = base64Targets[i];
        setMigrateProgress({ current: i + 1, total: base64Targets.length });

        let payload = target.prescriptionImage;
        if (payload.length > 350000) {
          try {
            payload = await compressImage(payload, 1000, 1000, 0.70);
          } catch {
            // Keep original compressed base64 if re-compress fails
          }
        }

        const uploadRes = await uploadBase64ToStorage(payload, target.id, 8000);
        if (!uploadRes.success || !uploadRes.url) {
          if (i === 0) {
            const errDetail = uploadRes.error || 'Unknown error';
            setStorageRuleHint(
              language === 'TH'
                ? `Firebase Storage ยังไม่เปิดสิทธิ์เขียนไฟล์ (${errDetail}) — กรุณาเปิดใช้ Storage และนำกติกาจากไฟล์ storage.rules ไปวางใน Firebase Console > Storage > Rules ก่อนครับ`
                : `Firebase Storage upload blocked (${errDetail}). Please enable Firebase Storage & apply rules from storage.rules in Firebase Console.`
            );
            spawnAlert(
              language === 'TH'
                ? 'ไม่สามารถอัปโหลดขึ้น Firebase Storage ได้ (ข้อมูลเดิมปลอดภัย ไม่มีการแก้ไข)'
                : 'Firebase Storage unavailable. Existing images remain intact in Firestore.',
              'error'
            );
            return;
          }
          continue;
        }

        await updateDoc(doc(db, 'bookings', target.id), {
          prescriptionImage: uploadRes.url
        });
        migratedCount++;
      }

      if (migratedCount > 0) {
        const logId = 'log-' + Date.now();
        await setDoc(doc(db, 'logs', logId), {
          id: logId,
          timestamp: new Date().toISOString(),
          userId: currentUser?.id || 'system',
          userName: currentUser?.name || 'Admin',
          userRole: currentUser?.role || 'Admin',
          action: 'Migrate Images to Firebase Storage',
          details: `Migrated ${migratedCount} prescription images from Firestore Base64 to Firebase Storage URLs.`
        });

        spawnAlert(
          language === 'TH'
            ? `ย้ายรูปไป Firebase Storage สำเร็จ ${migratedCount} รายการ! Firestore เหลือเก็บเฉพาะ URL`
            : `Migrated ${migratedCount} images to Firebase Storage URLs!`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Migration error:', err);
      spawnAlert(
        language === 'TH' ? 'เกิดข้อผิดพลาดในการย้ายรูป: ' + err.message : 'Migration error: ' + err.message,
        'error'
      );
    } finally {
      setIsMigratingStorage(false);
      setMigrateProgress(null);
    }
  };

  const handleClearOldData = async () => {
    if (oldBookings.length === 0) {
      spawnAlert(language === 'TH' ? 'ไม่มีข้อมูลที่เก่ากว่า 6 เดือนให้ลบ' : 'No records older than 6 months found.', 'info');
      return;
    }

    setShowClearConfirm(true);
  };

  const executeClearOldData = async () => {
    setShowClearConfirm(false);
    setIsProcessing(true);
    let successCount = 0;

    try {
      for (const b of oldBookings) {
        if (isStorageUrl(b.prescriptionImage)) {
          await deletePrescriptionFromStorage(b.prescriptionImage);
        }
        await deleteDoc(doc(db, 'bookings', b.id));
        successCount++;
      }

      const logId = 'log-' + Date.now();
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Admin',
        userRole: currentUser?.role || 'Admin',
        action: 'Batch Delete (6 Month Auto-Clear)',
        details: `Deleted ${successCount} booking records that were older than 6 months.`
      });

      spawnAlert(`Successfully deleted ${successCount} old records.`, 'success');
    } catch (e: any) {
      console.error(e);
      spawnAlert('Failed to clear some records. Please check your connection and permissions.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {language === 'TH' ? 'การจัดการฐานข้อมูลและพื้นที่เก็บรูป (Database & Storage Maintenance)' : 'Database & Image Storage Maintenance'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {language === 'TH'
                ? 'เก็บรูปบน Firebase Storage (URL) ล้างเฉพาะรูปเก่าโดยคงประวัติการจองครบถ้วน และสำรองข้อมูลรายเดือน'
                : 'Store prescription images via Firebase Storage URLs, clear old images while keeping records intact, and backup monthly.'}
            </p>
          </div>
        </div>

        {/* Live Cloud Image & Storage Breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 block">รูปใน Firebase Storage (URL)</span>
            <span className="text-lg font-extrabold text-emerald-600 font-mono">
              {storageStats.storageUrlCount} <span className="text-xs font-sans text-slate-500">รายการ</span>
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 block">รูป Base64 ใน Firestore</span>
            <span className="text-lg font-extrabold text-amber-600 font-mono">
              {storageStats.base64Count} <span className="text-xs font-sans text-slate-500">(~{storageStats.base64MB} MB)</span>
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 block">ล้างรูปแล้ว (เก็บประวัติครบ)</span>
            <span className="text-lg font-extrabold text-blue-600 font-mono">
              {storageStats.clearedCount} <span className="text-xs font-sans text-slate-500">รายการ</span>
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 block">ใบจองทั้งหมดในระบบ</span>
            <span className="text-lg font-extrabold text-slate-800 font-mono">
              {bookings.length} <span className="text-xs font-sans text-slate-500">รายการ</span>
            </span>
          </div>
        </div>

        {/* Section 1: Long-Term Space Saving (Keep Record Clear Image + Migrate to Firebase Storage) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A: Keep Record, Clear Old Prescription Image */}
          <div className="border border-emerald-200 bg-emerald-50/35 p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                <ImageOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {language === 'TH' ? 'ล้างเฉพาะรูปเก่า (เก็บประวัติครบ 100%)' : 'Keep Record, Clear Old Images'}
                </h3>
                <span className="text-[11px] text-emerald-700 font-semibold">แนะนำสำหรับโรงพยาบาล · ไม่ลบ HN / ยา / Audit</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'TH'
                ? 'ลบเฉพาะไฟล์ภาพใบสั่งยา (prescriptionImage) ของเคสเก่าเกินกำหนด เพื่อคืนพื้นที่และทำให้หน้า Dashboard โหลดเร็วขึ้น โดยข้อมูลผู้ป่วย รายการยา ผู้ทวนสอบ และ Timestamp ทั้งหมดยังอยู่ครบ'
                : 'Removes only old prescriptionImage payloads while preserving patient, medication, and audit timestamps.'}
            </p>

            <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-emerald-200/70">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {language === 'TH' ? 'เกณฑ์อายุข้อมูลที่ต้องการล้างรูป' : 'Clear Images Older Than'}
                </label>
                <select
                  value={clearImageMonths}
                  onChange={(e) => setClearImageMonths(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold text-slate-700"
                >
                  <option value={1}>เก่ากว่า 1 เดือน (1 Month+)</option>
                  <option value={2}>เก่ากว่า 2 เดือน (2 Months+)</option>
                  <option value={3}>เก่ากว่า 3 เดือน (3 Months+)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={onlyCompletedForImageClear}
                  onChange={(e) => setOnlyCompletedForImageClear(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span>เฉพาะเคสที่ของมาถึง (2/2) หรือยกเลิกแล้วเท่านั้น</span>
              </label>
            </div>

            <div className="w-full bg-white border border-emerald-100 rounded-lg p-3 text-xs text-slate-700 font-mono flex justify-between items-center">
              <span>เป้าหมายล้างรูป:</span>
              <span className="font-bold text-emerald-700">
                {reclaimableImageStats.totalCount} รูป (~{reclaimableImageStats.mbLabel} MB)
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (oldImageBookings.length === 0) {
                  spawnAlert(
                    language === 'TH'
                      ? `ยังไม่มีรูปที่เก่ากว่า ${clearImageMonths} เดือนตามเงื่อนไข`
                      : 'No matching old images found.',
                    'info'
                  );
                  return;
                }
                setShowClearImagesConfirm(true);
              }}
              disabled={isProcessing || oldImageBookings.length === 0}
              className="w-full mt-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-bold shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ImageOff className="w-4 h-4" />
              <span>{language === 'TH' ? 'ล้างเฉพาะรูปเก่า (เก็บประวัติไว้)' : 'Clear Old Images Only'}</span>
            </button>
          </div>

          {/* Card B: Firebase Storage URL Mode & Migration */}
          <div className="border border-sky-200 bg-sky-50/35 p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg text-sky-700">
                <CloudUpload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {language === 'TH' ? 'เก็บรูปบน Firebase Storage (URL Only)' : 'Firebase Storage URL Mode'}
                </h3>
                <span className="text-[11px] text-sky-700 font-semibold">ทำงานอัตโนมัติทุกใบจองใหม่ + ย้ายรูปเก่าได้</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'TH'
                ? 'เมื่อจองยาใหม่ ระบบจะอัปโหลดรูปที่บีบอัดแล้วไปยัง Firebase Storage และบันทึกเฉพาะลิงก์ URL ลงใน Firestore ทำให้โหลดตาราง Dashboard เร็วขึ้นมาก (และหาก Storage ยังไม่เปิดสิทธิ์ ระบบจะสลับเก็บ Base64 สำรองให้อัตโนมัติไม่ให้ข้อมูลหาย)'
                : 'New bookings upload compressed JPEG images to Firebase Storage and store only the lightweight URL in Firestore (with automatic Base64 fallback).'}
            </p>

            <div className="w-full bg-white border border-sky-100 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Storage Bucket:</span>
                <span className="font-mono font-bold text-slate-700">prescriptions/*.jpg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">รูป Base64 เก่าที่รอย้ายขึ้น Storage:</span>
                <span className="font-mono font-bold text-amber-600">{storageStats.base64Count} รูป (~{storageStats.base64MB} MB)</span>
              </div>
            </div>

            {storageRuleHint && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-[11px] leading-relaxed">
                {storageRuleHint}
              </div>
            )}

            {migrateProgress && (
              <div className="bg-white border border-sky-200 rounded-xl p-2.5 text-xs font-mono text-sky-700 flex items-center justify-between">
                <span>กำลังอัปโหลดขึ้น Firebase Storage...</span>
                <span className="font-bold">{migrateProgress.current} / {migrateProgress.total}</span>
              </div>
            )}

            <button
              type="button"
              onClick={executeMigrateBase64ToStorage}
              disabled={isMigratingStorage || storageStats.base64Count === 0}
              className="w-full mt-auto flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl text-sm font-bold shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <HardDrive className="w-4 h-4" />
              <span>
                {isMigratingStorage
                  ? 'กำลังย้ายรูปไป Storage...'
                  : storageStats.base64Count === 0
                  ? 'ย้ายรูปขึ้น Storage ครบหมดแล้ว'
                  : `ย้ายรูปเก่า ${storageStats.base64Count} รูปไป Storage`}
              </span>
            </button>
          </div>
        </div>

        {/* Section 2: Original Export CSV & Purge 6-Month Old Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Card */}
          <div className="border border-indigo-100 bg-indigo-50/30 p-6 rounded-2xl flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">
                {language === 'TH' ? 'ดึงไฟล์ข้อมูลทั้งหมด (Export CSV)' : 'Export Database (CSV)'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 flex-1">
              {language === 'TH'
                ? 'ดาวน์โหลดข้อมูลรายการจองยาทั้งหมดที่มีอยู่ ณ ปัจจุบัน นำไปเซฟเป็นไฟล์ Excel เพื่อจัดเก็บประวัติ.'
                : 'Download all existing medication bookings as a standalone CSV file to keep on your local machine / Excel.'}
            </p>
            <div className="w-full bg-white border border-indigo-100 rounded-lg p-3 text-sm text-slate-700 font-mono flex justify-between items-center">
              <span>Total Records:</span>
              <span className="font-bold">{bookings.length}</span>
            </div>
            <button
              onClick={handleExportDataCSV}
              disabled={isProcessing}
              className="w-full mt-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {language === 'TH' ? 'ส่งออกข้อมูล (Export)' : 'Export CSV File'}
            </button>
          </div>

          {/* Delete 6 Months Card */}
          <div className="border border-red-100 bg-red-50/30 p-6 rounded-2xl flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg text-red-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">
                {language === 'TH' ? 'ล้างข้อมูล 6 เดือนย้อนหลัง' : 'Purge 6-Month Old Data'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 flex-1">
              {language === 'TH'
                ? 'ลบข้อมูลรายการจองยาทั้งแถวที่มี Date of Use เกิน 6 เดือนย้อนหลัง เพื่อประหยัดพื้นที่จัดเก็บบน Cloud (โปรด Export JSON/CSV ก่อนลบ)'
                : 'Permanently delete bookings with a "Date of Use" older than 6 months to free up cloud Firestore limits.'}
            </p>
            <div className="w-full bg-white border border-red-100 rounded-lg p-3 text-sm text-slate-700 font-mono flex justify-between items-center">
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> 6+ Months (Target):</span>
              <span className="font-bold text-red-600">{oldBookings.length} items</span>
            </div>
            <button
              onClick={handleClearOldData}
              disabled={isProcessing || oldBookings.length === 0}
              className="w-full mt-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {isProcessing
                ? (language === 'TH' ? 'กำลังดำเนินการ...' : 'Processing...')
                : (language === 'TH' ? 'ยืนยันการล้างข้อมูลทิ้ง' : 'Confirm Delete Old Data')}
            </button>
          </div>
        </div>

        {/* Monthly File Storage & Retrieval Section */}
        <div className="border border-slate-200 p-6 rounded-2xl bg-slate-50/50 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">📁</span>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {language === 'TH' ? 'ระบบจัดเก็บและกู้คืนข้อมูลรายเดือน (Monthly Archive Storage & Retrieval)' : 'Monthly Archive Storage & Retrieval'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'TH'
                  ? 'เลือกปี/เดือน เพื่อสำรองข้อมูลรายเดือนเป็นไฟล์ JSON หรืออัปโหลดไฟล์ที่บันทึกไว้กลับเข้าระบบ'
                  : 'Select Month & Year to backup records to JSON or upload backup files to restore them.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                {language === 'TH' ? 'เลือกปี ค.ศ.' : 'Select Year'}
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-indigo-500/25"
              >
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                {language === 'TH' ? 'เลือกเดือน' : 'Select Month'}
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-indigo-500/25"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {language === 'TH'
                      ? new Date(2026, m - 1).toLocaleDateString('th-TH', { month: 'long' })
                      : new Date(2026, m - 1).toLocaleDateString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white border border-slate-200 p-2 rounded text-xs text-slate-700 font-mono flex justify-between items-center h-[38px]">
              <span>{language === 'TH' ? 'ยอดจองในเดือนนี้:' : 'Month Bookings:'}</span>
              <span className="font-bold text-indigo-600">{monthlyBookings.length} items</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleExportMonthlyJSON}
              disabled={monthlyBookings.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {language === 'TH' ? `ส่งออกข้อมูลเดือน ${targetYearMonth} (JSON)` : `Export ${targetYearMonth} JSON`}
            </button>

            <div className="flex-1 relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportMonthlyJSON}
                disabled={isImporting}
                className="hidden"
                id="monthly-json-upload-input"
              />
              <label
                htmlFor="monthly-json-upload-input"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold shadow hover:shadow-md transition-all active:scale-95 cursor-pointer text-center select-none"
              >
                <span>📤</span>
                {isImporting
                  ? (language === 'TH' ? 'กำลังนำเข้าและบันทึก...' : 'Importing & Restoring...')
                  : (language === 'TH' ? 'กู้คืน / นำเข้าไฟล์รายเดือน (Import JSON)' : 'Import & Restore Month (JSON)')}
              </label>
            </div>
          </div>
        </div>

        <div className="border border-amber-200 bg-amber-50 p-4 rounded-xl flex items-start gap-4 text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">
            <strong>{language === 'TH' ? 'คำแนะนำ' : 'Administrator Guidance'}:</strong>{' '}
            {language === 'TH'
              ? 'เพื่อป้องกันข้อมูลสูญหายแบบถาวร แนะนำให้กด Export JSON รายเดือนเก็บไว้ในเครื่องก่อนล้างรูปหรือล้างข้อมูล 6 เดือนย้อนหลังทุกครั้ง'
              : 'To prevent permanent loss of historical clinical data, ALWAYS export a JSON/CSV backup before clearing old images or purging 6-month records.'}
          </p>
        </div>
      </div>

      {/* Confirmation Modal: Keep Record, Clear Old Images */}
      {showClearImagesConfirm && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full flex flex-col overflow-hidden">
            <div className="p-5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <ImageOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-emerald-950 uppercase tracking-tight">
                  ยืนยันล้างเฉพาะรูปใบสั่งยาเก่า
                </h3>
                <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  จำนวน {reclaimableImageStats.totalCount} รูป (เก่ากว่า {clearImageMonths} เดือน · ~{reclaimableImageStats.mbLabel} MB)
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3 text-xs leading-relaxed text-slate-600">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-emerald-900 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  ข้อมูลผู้ป่วย (HN / ชื่อ), รายการยา, ราคา, ผู้จอง, เภสัชทวนสอบ, คลัง 1/2-2/2 และ Audit Log จะยังอยู่ครบถ้วน 100% (ลบเฉพาะไฟล์รูปเท่านั้น)
                </span>
              </div>
              <p className="text-slate-500">
                หากต้องการเก็บรูปใบสั่งยาเก่าไว้ดูย้อนหลัง แนะนำให้กด <strong>ส่งออกข้อมูลรายเดือน (JSON)</strong> เก็บไว้ก่อนดำเนินการครับ
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearImagesConfirm(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeClearOldImagesOnly}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 cursor-pointer"
              >
                ยืนยันล้างเฉพาะรูปเก่า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Clear Old Data Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-scale-up">
            <div className="p-5 bg-red-50 border-b border-red-100/60 flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-red-950 uppercase tracking-tight">
                  {language === 'TH' ? 'ยืนยันการล้างข้อมูลคิวจองยา' : 'Confirm Historical Ledger Purge'}
                </h3>
                <p className="text-[10px] text-red-600 font-medium mt-0.5">
                  Count: {oldBookings.length} records (&gt;6 months old)
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3 text-xs leading-relaxed text-slate-600 font-sans">
              <p className="font-semibold text-rose-700 text-xs">
                {language === 'TH'
                  ? '⚠️ คำเตือนสำคัญ: การดำเนินการลบข้อมูลคิวจองที่เก่ากว่า 6 เดือนนี้ ไม่สามารถย้อนกลับได้!'
                  : '⚠️ CRITICAL WARNING: This purge operation is permanent and cannot be undone!'}
              </p>
              <p>
                {language === 'TH'
                  ? `คุณกำลังจะลบข้อมูลคิวการจองและบันทึกผู้ป่วยที่เก่ากว่า 6 เดือน ทั้งหมดจำนวน ${oldBookings.length} รายการออกอย่างถาวร กรุณาตรวจสอบว่าคุณได้ทำการดาวน์โหลดไฟล์สำรองข้อมูล (CSV / JSON) ไว้เรียบร้อยแล้ว`
                  : `You are about to permanently clear all ${oldBookings.length} historical bookings and patient drug queue records older than 6 months. Please guarantee you have executed a backup export first.`}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeClearOldData}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md hover:shadow-lg active:scale-95 duration-150 cursor-pointer"
              >
                {language === 'TH' ? 'ยืนยันล้างข้อมูลถาวร' : 'Confirm Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
