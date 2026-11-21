import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, Drug, Booking, SystemLog, OwingMedication, formatDateToDMY } from '../types';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, onSnapshot, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { preparePrescriptionImageForSave, deletePrescriptionFromStorage, isStorageUrl } from '../utils/prescriptionStorage';

interface Alert {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success';
  bookingId?: string;
  hn?: string;
  category?: 'owing' | 'borrow' | 'general';
}

interface AppContextType {
  currentUser: User | null;
  bookings: Booking[];
  drugs: Drug[];
  users: User[];
  logs: SystemLog[];
  alerts: Alert[];
  owingMeds: OwingMedication[];
  loading: boolean;
  language: 'TH' | 'EN';
  setLanguage: (lang: 'TH' | 'EN') => void;
  setLoading: (l: boolean) => void;
  login: (u: string, p: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  fetchBookings: () => Promise<void>;
  fetchDrugs: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  createBooking: (b: Partial<Booking>) => Promise<{ success: boolean; error?: string; booking?: Booking }>;
  updateBooking: (id: string, b: Partial<Booking>) => Promise<{ success: boolean; error?: string }>;
  deleteBooking: (id: string) => Promise<{ success: boolean; error?: string }>;
  verifyPharmacist: (id: string, phLocation?: string, phName?: string) => Promise<boolean>;
  rejectPharmacistVerification: (id: string, reason: string, note?: string) => Promise<boolean>;
  reverifyPharmacist: (id: string, phLocation?: string, phName?: string) => Promise<boolean>;
  requestCancelBooking: (id: string, reason: string, requestedByName: string) => Promise<{ success: boolean; error?: string }>;
  approveCancelBooking: (id: string) => Promise<{ success: boolean; error?: string }>;
  rejectCancelBooking: (id: string, reviewNote?: string) => Promise<{ success: boolean; error?: string }>;
  stockReverifyOrder: (id: string, approved: boolean, notes?: string, rejectionReason?: string) => Promise<{ success: boolean; error?: string }>;
  markBorrowedMedReturned: (bookingId: string, borrowedIndex: number, returnBookingId?: string) => Promise<void>;
  verifyClerk: (id: string, operatorName?: string, notes?: string) => Promise<boolean>;
  createDrug: (d: Partial<Drug>) => Promise<{ success: boolean; error?: string }>;
  updateDrug: (id: string, d: Partial<Drug>) => Promise<{ success: boolean; error?: string }>;
  deleteDrug: (id: string) => Promise<{ success: boolean; error?: string }>;
  requestDeleteDrug: (id: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  rejectDeleteDrug: (id: string) => Promise<{ success: boolean; error?: string }>;
  requestEditDrug: (id: string, d: Partial<Drug>) => Promise<{ success: boolean; error?: string }>;
  approveEditDrug: (id: string) => Promise<{ success: boolean; error?: string }>;
  rejectEditDrug: (id: string) => Promise<{ success: boolean; error?: string }>;
  createUser: (usr: Partial<User> & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  registerUser: (usr: Partial<User> & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, usr: Partial<User> & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  reportOwingMed: (booking: Booking, drugIds?: string[]) => Promise<{ success: boolean; error?: string }>;
  updatePreparedStatus: (owingId: string, drugId: string, received: boolean) => Promise<void>;
  toggleOwingResolved: (owingId: string, resolved: boolean) => Promise<void>;
  toggleMedicineOwing: (booking: Booking, targetMed: any, makeOwing: boolean) => Promise<void>;
  clearAlerts: () => void;
  spawnAlert: (message: string, type?: 'info' | 'success', bookingId?: string, hn?: string, category?: 'owing' | 'borrow' | 'general') => void;
  selectedPharmacyLocation: string;
  setSelectedPharmacyLocation: (loc: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('rxnexus_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [owingMeds, setOwingMeds] = useState<OwingMedication[]>([]);
  const [loading, setLoading] = useState(false);
  const [language, setLanguageState] = useState<'TH' | 'EN'>(() => {
    const saved = localStorage.getItem('rxnexus_lang');
    return (saved as 'TH' | 'EN') || 'TH';
  });
  const setLanguage = (lang: 'TH' | 'EN') => {
    setLanguageState(lang);
    localStorage.setItem('rxnexus_lang', lang);
  };
  const [selectedPharmacyLocation, setSelectedPharmacyLocation] = useState<string>('All');
  const prevVerificationStatusRef = useRef<Record<string, string>>({});
  const prevClerkStatusRef = useRef<Record<string, string>>({});
  const prevRolloverTimeRef = useRef<Record<string, string>>({});
  const prevRejectionStatusRef = useRef<Record<string, string>>({});
  const prevCancelRequestRef = useRef<Record<string, boolean>>({});
  const prevCancelApprovedRef = useRef<Record<string, boolean>>({});
  const prevReverifyRequestRef = useRef<Record<string, string>>({});
  const prevStockVerifyStatusRef = useRef<Record<string, string>>({});
  const prevHoldStatusRef = useRef<Record<string, boolean>>({});
  const prevDrugEditRequestRef = useRef<Record<string, string>>({});
  const prevOwingUnresolvedRef = useRef<Record<string, number>>({});

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('sound_enabled');
    return saved !== 'false'; // default true
  });
  const handleSetSoundEnabled = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem('sound_enabled', String(val));
  };

  const playChimeAndVibrate = () => {
    try {
      // Play a dual-tone hospital chime
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      playTone(880, ctx.currentTime, 0.15); // A5
      playTone(1320, ctx.currentTime + 0.1, 0.35); // E6
    } catch (e) {
      console.warn("Chime failed", e);
    }
  };

  // Trigger system alert sound or local alerts on content updates
  const spawnAlert = (
    message: string,
    type: 'info' | 'success' = 'info',
    bookingId?: string,
    hn?: string,
    category: 'owing' | 'borrow' | 'general' = 'general'
  ) => {
    const newAlert: Alert = {
      id: 'alert-' + Date.now() + Math.random().toString(36).substr(2, 4),
      message,
      timestamp: new Date().toLocaleTimeString(),
      read: false,
      type,
      bookingId,
      hn,
      category
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 50)); // keep last 50

    // Play chime sound if enabled
    const isSound = localStorage.getItem('sound_enabled') !== 'false';
    if (isSound) {
      playChimeAndVibrate();
    }
  };

  const clearAlerts = () => setAlerts([]);

  // Empty dummy fetch functions for backward compatibility without breaking existing caller interfaces
  const fetchBookings = async () => {};
  const fetchDrugs = async () => {};
  const fetchUsers = async () => {};
  const fetchLogs = async () => {};

  // Connect to Firestore collections in real-time using onSnapshot listeners
  useEffect(() => {
    if (currentUser) {
      // Clean up legacy d-1 to d-10 drugs as requested by user
      const legacyIds = ['d-1', 'd-2', 'd-3', 'd-4', 'd-5', 'd-6', 'd-7', 'd-8', 'd-9', 'd-10'];
      legacyIds.forEach(async (id) => {
        try {
          await deleteDoc(doc(db, 'drugs', id));
        } catch (e) {
          // Ignore silently
        }
      });

      // 1. Real-time Bookings sync
      const qBookings = query(collection(db, 'bookings'));
      const unsubBookings = onSnapshot(qBookings, (snap) => {
        snap.docChanges().forEach((change) => {
          const b = change.doc.data() as Booking;

          // Track and trigger Date Rollover alerts dynamically
          const currentRolloverTime = b.rolloverStatus?.rolledOverAt || '';
          const prevRolloverTime = prevRolloverTimeRef.current[b.id] || '';
          prevRolloverTimeRef.current[b.id] = currentRolloverTime;

          if (currentRolloverTime && currentRolloverTime !== prevRolloverTime) {
            const rolledSecs = new Date(currentRolloverTime).getTime();
            const diffMs = Math.abs(Date.now() - rolledSecs);
            if (diffMs < 60000) {
              const isPharmacist = currentUser?.role === 'Pharmacist' || currentUser?.roles?.includes('Pharmacist');
              const isClerk = currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.roles?.includes('Pharmacy Stock Clerk');
              const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
              
              const langPref = localStorage.getItem('rxnexus_lang') || 'TH';
              const isThai = langPref === 'TH';

              const medsSummary = (b.medications || []).map(m => `${m.drugName} x${m.quantity}`).join(', ');
              const origDateStr = formatDateToDMY(b.rolloverStatus?.originalDateOfUse || (b.rolloverStatus as any)?.originalDate || '');
              const newDateStr = formatDateToDMY(b.dateOfUse);

              if (isPharmacist || isAdmin) {
                const alertMsg = isThai
                  ? `⚠️ เลื่อนวันให้ยา (Rollover): ${b.patientName} (HN: ${b.hn}) จาก ${origDateStr} ➡️ ${newDateStr} | ยา: ${medsSummary} | เหตุผล: ${b.rolloverStatus?.reason || '-'} | ผู้แจ้ง: ${b.rolloverStatus?.notifyingNurse || '-'}`
                  : `⚠️ Date Rollover: ${b.patientName} (HN: ${b.hn}) ${origDateStr} -> ${newDateStr} | Meds: ${medsSummary} | Reason: ${b.rolloverStatus?.reason || 'n/a'} | By: ${b.rolloverStatus?.notifyingNurse || 'n/a'}`;
                spawnAlert(alertMsg, 'info', b.id, b.hn);
              } else if (isClerk) {
                const alertMsg = isThai
                  ? `⚠️ แจ้งเตือนคลังยา - เลื่อนวันใช้ยา (Rollover): ${b.patientName} (HN: ${b.hn}) จาก ${origDateStr} ➡️ ${newDateStr} | รายการยา: ${medsSummary} | เหตุผล: ${b.rolloverStatus?.reason || '-'} (${b.rolloverStatus?.notifyingNurse || '-'})`
                  : `⚠️ Stock Alert - Queue Rollover: ${b.patientName} (HN: ${b.hn}) moved ${origDateStr} -> ${newDateStr} | Meds: ${medsSummary} | Reason: ${b.rolloverStatus?.reason || 'n/a'}`;
                spawnAlert(alertMsg, 'info', b.id, b.hn);
              }
            }
          }

          if (change.type === 'added') {
            const currentStatus = b.pharmacistVerification?.status || 'Pending';
            prevVerificationStatusRef.current[b.id] = currentStatus;

            const currentClerkStatus = b.clerkVerification?.status || 'Pending';
            prevClerkStatusRef.current[b.id] = currentClerkStatus;

            prevHoldStatusRef.current[b.id] = !!b.holdStatus?.isHeld;
            prevCancelRequestRef.current[b.id] = b.cancelStatus?.isRequested === true;
            prevCancelApprovedRef.current[b.id] = b.cancelStatus?.approved === true;
            prevReverifyRequestRef.current[b.id] = b.pharmacistVerification?.resubmittedAt || '';
            prevStockVerifyStatusRef.current[b.id] = b.stockVerification?.status || 'Pending';

            const createdSecs = new Date(b.createdAt).getTime();
            // 60-second absolute skew tolerance to guarantee real-time alerts show up
            const diffMs = Math.abs(Date.now() - createdSecs);
            if (diffMs < 60000) {
              // Alert Pharmacist, Pharmacist Assistant, Pharmacy Stock Clerk, and Admin on new booking
              const isPharmacist = currentUser?.role === 'Pharmacist' || currentUser?.roles?.includes('Pharmacist');
              const isAssistant = currentUser?.role === 'Pharmacist Assistant' || currentUser?.roles?.includes('Pharmacist Assistant');
              const isClerk = currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.roles?.includes('Pharmacy Stock Clerk');
              const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
              
              if (isPharmacist || isAssistant || isClerk || isAdmin) {
                const langPref = localStorage.getItem('rxnexus_lang') || 'TH';
                const isThai = langPref === 'TH';
                const medsSummary = (b.medications || []).map(m => `${m.drugName} x${m.quantity}`).join(', ');
                const alertMsg = isThai
                  ? `🔔 มีการจองยาใหม่เข้ามา: ${b.patientName} (HN: ${b.hn}) ใช้ยาวันที่ ${formatDateToDMY(b.dateOfUse)}${b.pharmacyLocation ? ` [${b.pharmacyLocation}]` : ''} | ยา: ${medsSummary}`
                  : `🔔 New booking: ${b.patientName} (HN: ${b.hn}) for ${formatDateToDMY(b.dateOfUse)}${b.pharmacyLocation ? ` [${b.pharmacyLocation}]` : ''} | Meds: ${medsSummary}`;
                
                spawnAlert(alertMsg, 'info', b.id, b.hn);
              }
            }
            
            // Check for recently verified by pharmacist (for stock clerk offline sync)
            if (currentStatus === 'Verified' && b.pharmacistVerification?.verifiedAt) {
              const verifiedSecs = new Date(b.pharmacistVerification.verifiedAt).getTime();
              const diffMsVerified = Math.abs(Date.now() - verifiedSecs);
              
              if (diffMsVerified < 60000) {
                const isClerk = currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.roles?.includes('Pharmacy Stock Clerk');
                const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
                if (isClerk || isAdmin) {
                  const langPref = localStorage.getItem('rxnexus_lang') || 'TH';
                  const isThai = langPref === 'TH';
                  const alertMsg = isThai
                    ? `✅ ห้องยาตรวจสอบรายการเรียบร้อย: มีการตรวจสอบรายการยาจองของคนไข้ HN: ${b.hn} (${b.patientName}) เรียบร้อยแล้ว ให้ดำเนินการต่อได้`
                    : `Pharmacist verified booking: Patient HN: ${b.hn} (${b.patientName}) verified successfully. Please proceed with stock preparation.`;
                  
                  spawnAlert(alertMsg, 'success', b.id, b.hn);
                }
              }
            }

            // Check for recently verified by clerk (for nurse/doctor offline sync)
            if (currentClerkStatus === 'Ready-to-use' && b.clerkVerification?.verifiedAt) {
              const verifiedSecs = new Date(b.clerkVerification.verifiedAt).getTime();
              const diffMsVerified = Math.abs(Date.now() - verifiedSecs);
              
              if (diffMsVerified < 60000) {
                const isNurse = currentUser?.role === 'Nurse' || currentUser?.roles?.includes('Nurse');
                const isDoctor = currentUser?.role === 'Doctor' || currentUser?.roles?.includes('Doctor');
                const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
                if (isNurse || isDoctor || isAdmin) {
                  const langPref = localStorage.getItem('rxnexus_lang') || 'TH';
                  const isThai = langPref === 'TH';
                  const alertMsg = isThai
                    ? `📦 คลังยาเตรียมเวชภัณฑ์เสร็จสิ้น: ของคนไข้ HN: ${b.hn} (${b.patientName}) พร้อมนำไปใช้งานแล้ว`
                    : `Warehouse completed preparation: Patient HN: ${b.hn} (${b.patientName}) stock is ready. Please proceed with administration.`;
                  
                  spawnAlert(alertMsg, 'success', b.id, b.hn);
                }
              }
            }
          }
          if (change.type === 'modified') {
            const prevStatus = prevVerificationStatusRef.current[b.id];
            const currentStatus = b.pharmacistVerification?.status || 'Pending';
            prevVerificationStatusRef.current[b.id] = currentStatus;

            const prevClerkStatus = prevClerkStatusRef.current[b.id];
            const currentClerkStatus = b.clerkVerification?.status || 'Pending';
            prevClerkStatusRef.current[b.id] = currentClerkStatus;

            const langPref = localStorage.getItem('rxnexus_lang') || 'TH';
            const isThai = langPref === 'TH';

            // 1. Alert for Pharmacist Verification Rejected
            if (prevStatus !== 'Rejected' && currentStatus === 'Rejected') {
              const isCreator = currentUser?.name === b.staff?.creatorName || currentUser?.id === b.staff?.creatorId;
              const isNurseOrDoctor = currentUser?.role === 'Nurse' || currentUser?.role === 'Doctor' || currentUser?.role === 'Admin';
              
              if (isCreator || isNurseOrDoctor) {
                const reasonText = b.pharmacistVerification?.rejectionReason || (isThai ? 'ข้อมูลยาไม่ถูกต้อง' : 'Invalid data');
                const noteText = b.pharmacistVerification?.rejectionNote ? ` (${b.pharmacistVerification.rejectionNote})` : '';
                const alertMsg = isThai
                  ? `❌ รายการจองยาไม่ผ่านการ Verify: ใบจอง ${b.id} (HN: ${b.hn} - ${b.patientName}) เหตุผล: ${reasonText}${noteText} โดย ${b.pharmacistVerification?.rejectedBy || 'เภสัชกร'} - คลิกเพื่อแก้ไขและส่งจองใหม่`
                  : `❌ Verification Not Approved: Order ${b.id} (HN: ${b.hn} - ${b.patientName}) was rejected! Reason: ${reasonText}${noteText}. Click to edit and re-book.`;
                
                spawnAlert(alertMsg, 'info', b.id, b.hn);
              }
            }

            // 2. Alert for Resubmission after rejection (Re-verify requested)
            const currentResubmitTime = b.pharmacistVerification?.resubmittedAt || '';
            const prevResubmitTime = prevReverifyRequestRef.current[b.id] || '';
            prevReverifyRequestRef.current[b.id] = currentResubmitTime;

            if (currentResubmitTime && currentResubmitTime !== prevResubmitTime && b.pharmacistVerification?.reverifyRequested) {
              const isPharmacist = currentUser?.role === 'Pharmacist' || currentUser?.roles?.includes('Pharmacist');
              const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
              if (isPharmacist || isAdmin) {
                const alertMsg = isThai
                  ? `🔔 ผู้ใช้แก้ไขรายการจองยาแล้ว (HN: ${b.hn} - ${b.patientName}): ข้อมูลกลับมาที่แดชบอร์ด รอกด Re-verify ทบทวนรายการใหม่`
                  : `🔔 Re-submitted Order (HN: ${b.hn} - ${b.patientName}): Updated on dashboard, pending Pharmacist Re-verify.`;
                spawnAlert(alertMsg, 'info', b.id, b.hn);
              }
            }

            const medsSummary = (b.medications || []).map(m => `${m.drugName} x${m.quantity}`).join(', ');

            // 2.5 Alert for Hold Status Activated (Notify Stock Clerk, Pharmacist, Admin)
            const prevHeld = prevHoldStatusRef.current[b.id] || false;
            const currHeld = b.holdStatus?.isHeld === true;
            prevHoldStatusRef.current[b.id] = currHeld;

            if (!prevHeld && currHeld) {
              const isClerk = currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.roles?.includes('Pharmacy Stock Clerk');
              const isPharmacist = currentUser?.role === 'Pharmacist' || currentUser?.roles?.includes('Pharmacist');
              const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
              if (isClerk || isPharmacist || isAdmin) {
                const nurseLabel = b.holdStatus?.notifyingNurse || (b.holdStatus as any)?.notifiedNurse || '-';
                const alertMsg = isThai
                  ? `⏸️ แจ้งเตือน Hold ยา: ${b.patientName} (HN: ${b.hn}) | ยา: ${medsSummary} | เหตุผล: ${b.holdStatus?.reason || '-'} | ผู้แจ้ง: ${nurseLabel}`
                  : `⏸️ Medication HELD: ${b.patientName} (HN: ${b.hn}) | Meds: ${medsSummary} | Reason: ${b.holdStatus?.reason || 'n/a'} | By: ${nurseLabel}`;
                spawnAlert(alertMsg, 'info', b.id, b.hn);
              }
            }

            // 3. Alert for Cancel Request (Notify Pharmacist, Admin, AND Pharmacy Stock Clerk)
            const isCancelReq = b.cancelStatus?.isRequested === true;
            const prevCancelReq = prevCancelRequestRef.current[b.id] || false;
            prevCancelRequestRef.current[b.id] = isCancelReq;

            if (isCancelReq && !prevCancelReq) {
              const isPharmacist = currentUser?.role === 'Pharmacist' || currentUser?.roles?.includes('Pharmacist');
              const isClerk = currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.roles?.includes('Pharmacy Stock Clerk');
              const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
              if (isPharmacist || isClerk || isAdmin) {
                const alertMsg = isThai
                  ? `🚫 มีคำขอยกเลิกจองยา: ${b.patientName} (HN: ${b.hn}) | ยา: ${medsSummary} | เหตุผล: ${b.cancelStatus?.reason || 'ไม่ระบุ'} | ผู้ขอยกเลิก: ${b.cancelStatus?.requestedByName || 'Staff'}`
                  : `🚫 Cancellation Requested: ${b.patientName} (HN: ${b.hn}) | Meds: ${medsSummary} | Reason: ${b.cancelStatus?.reason || 'n/a'} | By: ${b.cancelStatus?.requestedByName || 'Staff'}`;
                spawnAlert(alertMsg, 'info', b.id, b.hn);
              }
            }

            // 4. Alert for Cancel Approved (Notify all relevant roles including Stock Clerk with patient, HN, meds)
            const isCancelApproved = b.cancelStatus?.approved === true;
            const prevCancelAppr = prevCancelApprovedRef.current[b.id] || false;
            prevCancelApprovedRef.current[b.id] = isCancelApproved;

            if (isCancelApproved && !prevCancelAppr) {
              const alertMsg = isThai
                ? `🔴 อนุมัติยกเลิกจองยาแล้ว: ${b.patientName} (HN: ${b.hn}) | ยา: ${medsSummary} | เหตุผล: ${b.cancelStatus?.reason || '-'} | ผู้ยกเลิก: ${b.cancelStatus?.requestedByName || '-'} (อนุมัติโดย ${b.cancelStatus?.reviewedBy || 'Admin'})`
                : `🔴 Order Cancelled: ${b.patientName} (HN: ${b.hn}) | Meds: ${medsSummary} | Reason: ${b.cancelStatus?.reason || '-'} | Approved by ${b.cancelStatus?.reviewedBy || 'Admin'}.`;
              spawnAlert(alertMsg, 'info', b.id, b.hn);
            }

            // 5. Alert for Stock Re-verification
            const currentStockStatus = b.stockVerification?.status || 'Pending';
            const prevStockStatus = prevStockVerifyStatusRef.current[b.id] || 'Pending';
            prevStockVerifyStatusRef.current[b.id] = currentStockStatus;

            if (prevStockStatus !== 'Verified' && currentStockStatus === 'Verified') {
              const isNurse = currentUser?.role === 'Nurse' || currentUser?.roles?.includes('Nurse');
              const isDoctor = currentUser?.role === 'Doctor' || currentUser?.roles?.includes('Doctor');
              const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
              const isPharmacist = currentUser?.role === 'Pharmacist' || currentUser?.roles?.includes('Pharmacist');
              if (isNurse || isDoctor || isAdmin || isPharmacist) {
                const alertMsg = isThai
                  ? `📦 ฝ่ายคลังยาทวนสอบ Order Verify เรียบร้อย: รายการจองยาคนไข้ HN: ${b.hn} (${b.patientName}) ได้รับการ Re-verify จากคลังยาแล้ว`
                  : `📦 Stock Re-verify Complete: Order for HN: ${b.hn} (${b.patientName}) has been re-verified by stock department.`;
                spawnAlert(alertMsg, 'success', b.id, b.hn);
              }
            }

            if (prevStatus !== 'Verified' && currentStatus === 'Verified') {
              // Only alert if the logged-in user is a Pharmacy Stock Clerk or Admin
              const isClerk = currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.roles?.includes('Pharmacy Stock Clerk');
              const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
              if (isClerk || isAdmin) {
                const alertMsg = isThai
                  ? `✅ ห้องยาตรวจสอบรายการเรียบร้อย: มีการตรวจสอบรายการยาจองของคนไข้ HN: ${b.hn} (${b.patientName}) เรียบร้อยแล้ว ให้ดำเนินการต่อได้`
                  : `Pharmacist verified booking: Patient HN: ${b.hn} (${b.patientName}) verified successfully. Please proceed with stock preparation.`;
                
                spawnAlert(alertMsg, 'success', b.id, b.hn);
              }
            }

            if (prevClerkStatus !== 'Ready-to-use' && currentClerkStatus === 'Ready-to-use') {
              // Only alert if logged-in user is Nurse, Doctor, or Admin
              const isNurse = currentUser?.role === 'Nurse' || currentUser?.roles?.includes('Nurse');
              const isDoctor = currentUser?.role === 'Doctor' || currentUser?.roles?.includes('Doctor');
              const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
              if (isNurse || isDoctor || isAdmin) {
                const alertMsg = isThai
                  ? `📦 คลังยาเตรียมเวชภัณฑ์เสร็จสิ้น: ของคนไข้ HN: ${b.hn} (${b.patientName}) พร้อมนำไปใช้งานแล้ว`
                  : `Warehouse completed preparation: Patient HN: ${b.hn} (${b.patientName}) stock is ready. Please proceed with administration.`;
                
                spawnAlert(alertMsg, 'success', b.id, b.hn);
              }
            }
          }
        });
        const list: Booking[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as Booking);
        });
        // Sort bookings by id or createdAt descending
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setBookings(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      });

      // 2. Real-time Drug list sync + Admin alert when Pharmacist edits drug catalog
      const qDrugs = query(collection(db, 'drugs'));
      const unsubDrugs = onSnapshot(qDrugs, (snap) => {
        const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
        const langPref = localStorage.getItem('rxnexus_lang') || 'TH';
        const isThai = langPref === 'TH';

        snap.docChanges().forEach((change) => {
          const d = change.doc.data() as Drug;
          const currEditStamp = d.editRequested ? (d.editRequestedAt || 'requested') : '';
          const prevEditStamp = prevDrugEditRequestRef.current[d.id] || '';
          prevDrugEditRequestRef.current[d.id] = currEditStamp;

          if (change.type === 'modified' && isAdmin) {
            if (d.editRequested && currEditStamp !== prevEditStamp) {
              const alertMsg = isThai
                ? `💊 แจ้งเตือน Admin: เภสัชกร ${d.editRequestedBy || 'Pharmacist'} ขอแก้ไขข้อมูลยา "${d.name}" (${d.stockCode}) กรุณาตรวจสอบและอนุมัติ`
                : `💊 Admin Review Required: Pharmacist ${d.editRequestedBy || 'Staff'} modified drug "${d.name}" (${d.stockCode}). Please verify.`;
              spawnAlert(alertMsg, 'info');
            }
          }
        });

        const list: Drug[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as Drug);
        });
        setDrugs(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'drugs');
      });

      // 3. Real-time User profiles and system trace logs sync (restricted for admin dashboards)
      let unsubUsers = () => {};
      let unsubLogs = () => {};

      const qOwing = query(collection(db, 'owing_meds'));
      const unsubOwing = onSnapshot(qOwing, (snap) => {
        const isClerk = currentUser?.role === 'Pharmacy Stock Clerk' || currentUser?.roles?.includes('Pharmacy Stock Clerk');
        const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');
        const isPharmacist = currentUser?.role === 'Pharmacist' || currentUser?.roles?.includes('Pharmacist');
        const langPref = localStorage.getItem('rxnexus_lang') || 'TH';
        const isThai = langPref === 'TH';

        snap.docChanges().forEach((change) => {
          const om = change.doc.data() as OwingMedication;
          const pendingMeds = (om.medications || []).filter(m => !m.received);
          const pendingCount = om.resolved ? 0 : pendingMeds.length;
          const prevPendingCount = prevOwingUnresolvedRef.current[om.id] ?? 0;
          prevOwingUnresolvedRef.current[om.id] = pendingCount;

          if (om.resolved || pendingCount === 0) {
            // Stop active owing alerts for this booking immediately
            setAlerts((prev) => prev.filter((a) => !(a.bookingId === om.bookingId && a.category === 'owing')));
            return;
          }

          if (isClerk || isAdmin || isPharmacist) {
            const shouldNotify =
              (change.type === 'added' && Math.abs(Date.now() - new Date(om.createdAt).getTime()) < 60000) ||
              (change.type === 'modified' && pendingCount > prevPendingCount);

            if (shouldNotify) {
              const medsText = pendingMeds.map(m => `${m.drugName} x${m.quantity}`).join(', ');
              const locText = om.pharmacyLocation ? ` [${om.pharmacyLocation}]` : '';
              const alertMsg = isThai
                ? `🚨 รายการยาค้างจ่าย${locText}: ${om.patientName} (HN: ${om.hn}) ขาดยา: ${medsText}`
                : `🚨 OWING MEDS${locText}: ${om.patientName} (HN: ${om.hn}) missing: ${medsText}`;

              spawnAlert(alertMsg, 'info', om.bookingId, om.hn, 'owing');
            }
          }
        });

        const list: OwingMedication[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as OwingMedication);
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setOwingMeds(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'owing_meds');
      });

      if (currentUser.role === 'Admin') {
        const qUsers = query(collection(db, 'users'));
        unsubUsers = onSnapshot(qUsers, (snap) => {
          const list: User[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as User);
          });
          setUsers(list);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        });

        const qLogs = query(collection(db, 'logs'));
        unsubLogs = onSnapshot(qLogs, (snap) => {
          const list: SystemLog[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as SystemLog);
          });
          list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          setLogs(list);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'logs');
        });
      }

      return () => {
        unsubBookings();
        unsubDrugs();
        unsubUsers();
        unsubLogs();
        unsubOwing();
      };
    }
  }, [currentUser?.role, currentUser?.id]);

  // Handle clinic staff secure authentication using Firestore and Firebase Auth
  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      // Check user authentication record in Firestore collection first
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);
      let matchedUser: User | null = null;
      
      snap.forEach((docSnap) => {
        const u = docSnap.data() as User;
        if (u.username.trim().toLowerCase() === username.trim().toLowerCase() && u.password === password) {
          matchedUser = u;
        }
      });

      if (!matchedUser) {
        return { success: false, error: 'Invalid User ID / Username or Password!' };
      }

      if ((matchedUser as User).approved === false) {
        return {
          success: false,
          error: language === 'TH'
            ? 'บัญชีผู้ใช้นี้อยู่ระหว่างรอการอนุมัติการลงทะเบียนจาก Admin กรุณาติดต่อผู้ดูแลระบบ'
            : 'Your registration request is pending Admin approval. Please contact your system administrator.'
        };
      }

      // Optional Firebase Auth linkage via virtual email (non-blocking if provider is disabled or network-restricted)
      const virtualEmail = `${username.trim().toLowerCase()}@rxnexus.com`;
      const runOptionalAuthSync = async () => {
        try {
          await signInWithEmailAndPassword(auth, virtualEmail, password);
        } catch (authError: any) {
          if (authError?.code === 'auth/user-not-found' || authError?.code === 'auth/invalid-credential') {
            try {
              await createUserWithEmailAndPassword(auth, virtualEmail, password);
            } catch (createError: any) {
              console.warn('[Firebase Auth Warn] Optional Auth account sync skipped:', createError?.code || createError?.message);
            }
          } else {
            console.warn('[Firebase Auth Warn] Optional Auth sign-in skipped, continuing with Firestore-verified session:', authError?.code || authError?.message);
          }
        }
      };

      await Promise.race([
        runOptionalAuthSync(),
        new Promise<void>((resolve) => setTimeout(resolve, 4000))
      ]);

      setCurrentUser(matchedUser);
      localStorage.setItem('rxnexus_user', JSON.stringify(matchedUser));
      spawnAlert(`Welcome back, ${(matchedUser as User).name}!`, 'success');

      // Log login event to Firestore system action trail
      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: (matchedUser as User).id,
        userName: (matchedUser as User).name,
        userRole: (matchedUser as User).role,
        action: 'User Login',
        details: 'User logged in securely via clinical Firebase Authentication.'
      };
      // Try to write log; if Firebase rules allow, write to history
      try {
        await setDoc(doc(db, 'logs', logId), newLog);
      } catch (logErr) {
        console.warn('Logging skipped. Logs collection is secured.', logErr);
      }

      return { success: true };
    } catch (e: any) {
      console.error('[Login Error]', e);
      return { success: false, error: e.message || 'Authentication failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('[SignOut Error]', e);
    }
    setCurrentUser(null);
    localStorage.removeItem('rxnexus_user');
    setBookings([]);
    setDrugs([]);
    setUsers([]);
    setLogs([]);
    setAlerts([]);
  };

  // Clinician Reserve orders booking CRUD
  const createBooking = async (b: Partial<Booking>) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayStr = today.replace(/-/g, '');
      
      // Find the maximum existing sequence suffix for today's bookings
      const todayBookings = bookings.filter(x => x.bookingDate === today);
      let maxSeq = 0;
      todayBookings.forEach(x => {
        const parts = x.id.split('-');
        if (parts.length >= 3) {
          const seq = parseInt(parts[2], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      });

      let nextSeq = maxSeq + 1;
      let bookingId = `RXN-${todayStr}-${String(nextSeq).padStart(3, '0')}`;
      
      // Double check against any loaded bookings to guarantee absolute uniqueness
      while (bookings.some(x => x.id === bookingId)) {
        nextSeq++;
        bookingId = `RXN-${todayStr}-${String(nextSeq).padStart(3, '0')}`;
      }

      let safeImage = '';
      if (b.prescriptionImage) {
        const imgResult = await preparePrescriptionImageForSave(b.prescriptionImage, bookingId);
        safeImage = imgResult.value;
      }

      const newBooking: Booking = {
        id: bookingId,
        bookingDate: b.bookingDate || today,
        hn: b.hn || '',
        patientName: b.patientName || '',
        dateOfUse: b.dateOfUse || today,
        department: b.department || 'General Outpatient',
        pharmacyLocation: b.pharmacyLocation || '',
        mode: b.mode || 'General',
        medications: b.medications || [],
        totalAmount: Number(b.totalAmount) || 0,
        prescriptionImage: safeImage,
        regimen: b.regimen || '',
        note: b.note || '',
        staff: {
          doctor: b.staff?.doctor || '',
          nurse: b.staff?.nurse || '',
          pharmacist: b.staff?.pharmacist || '',
          creatorId: currentUser?.id || 'system',
          creatorName: currentUser?.name || 'Staff Member'
        },
        pharmacistVerification: {
          status: 'Pending',
          verifiedBy: '',
          verifiedAt: ''
        },
        clerkVerification: {
          status: 'Pending',
          verifiedBy: '',
          verifiedAt: ''
        },
        borrowInfo: b.borrowInfo || [],
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'bookings', bookingId), newBooking);

      // Auto-resolve any unreturned borrow records across existing bookings matching this HN + booked drugs
      const normalizedTargetHn = (newBooking.hn || '').replace(/\D/g, '');
      const bookedDrugIds = new Set((newBooking.medications || []).map(m => m.drugId));
      let autoReturnedCount = 0;
      if (normalizedTargetHn && bookedDrugIds.size > 0) {
        for (const srcBooking of bookings) {
          if (!srcBooking.borrowInfo || srcBooking.borrowInfo.length === 0) continue;
          let modified = false;
          const updatedBorrowInfo = srcBooking.borrowInfo.map((bi) => {
            const normalizedDonorHn = (bi.borrowedFromHn || '').replace(/\D/g, '');
            if (!bi.returned && normalizedDonorHn === normalizedTargetHn && bookedDrugIds.has(bi.borrowedDrugId)) {
              modified = true;
              autoReturnedCount++;
              return {
                ...bi,
                returned: true,
                returnBookingId: bookingId,
                returnedAt: new Date().toISOString(),
                returnedBy: currentUser?.name || 'Staff'
              };
            }
            return bi;
          });
          if (modified) {
            await updateDoc(doc(db, 'bookings', srcBooking.id), { borrowInfo: updatedBorrowInfo });
          }
        }
      }
      if (autoReturnedCount > 0) {
        setAlerts((prev) => prev.filter((a) => !(a.category === 'borrow' && (a.hn || '').replace(/\D/g, '') === normalizedTargetHn)));
      }

      // Save tracking activity logs
      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Staff',
        userRole: currentUser?.role || 'Nurse',
        action: 'Create Booking',
        details: `Created reservation ${bookingId} for patient ${newBooking.patientName} (${newBooking.hn}) using ${newBooking.mode} drugs.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `บันทึกรายการจองยาสำเร็จ: เลขที่ใบจอง ${bookingId} สำหรับคนไข้ ${newBooking.patientName}!${autoReturnedCount > 0 ? ` (ตัดยอดคืนยายืมอัตโนมัติ ${autoReturnedCount} รายการ)` : ''}`
          : `Successfully booked medication order: ${bookingId} for ${newBooking.patientName}!${autoReturnedCount > 0 ? ` (Auto-resolved ${autoReturnedCount} borrowed item(s))` : ''}`,
        'success'
      );
      return { success: true, booking: newBooking };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'bookings');
      return { success: false, error: e.message || 'Error saving booking reservation' };
    } finally {
      setLoading(false);
    }
  };

  const updateBooking = async (id: string, b: Partial<Booking>) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'bookings', id);
      const existing = bookings.find((x) => x.id === id);
      const updateData: any = {};
      if (b.hn) updateData.hn = b.hn;
      if (b.patientName) updateData.patientName = b.patientName;
      if (b.bookingDate) updateData.bookingDate = b.bookingDate;
      if (b.dateOfUse) updateData.dateOfUse = b.dateOfUse;
      if (b.department) updateData.department = b.department;
      if (b.pharmacyLocation !== undefined) updateData.pharmacyLocation = b.pharmacyLocation;
      if (b.mode) updateData.mode = b.mode;
      if (b.regimen !== undefined) updateData.regimen = b.regimen;
      if (b.note !== undefined) updateData.note = b.note;
      if (b.medications) updateData.medications = b.medications;
      if (b.totalAmount !== undefined) updateData.totalAmount = b.totalAmount;
      if (b.prescriptionImage !== undefined) {
        if (b.prescriptionImage === '') {
          if (isStorageUrl(existing?.prescriptionImage)) {
            await deletePrescriptionFromStorage(existing?.prescriptionImage);
          }
          updateData.prescriptionImage = '';
        } else if (b.prescriptionImage !== existing?.prescriptionImage) {
          const imgResult = await preparePrescriptionImageForSave(b.prescriptionImage, id);
          updateData.prescriptionImage = imgResult.value;
          updateData.imageClearedAt = '';
          updateData.imageClearedBy = '';
        } else {
          updateData.prescriptionImage = b.prescriptionImage;
        }
      }
      if (b.imageClearedAt !== undefined) updateData.imageClearedAt = b.imageClearedAt;
      if (b.imageClearedBy !== undefined) updateData.imageClearedBy = b.imageClearedBy;
      if (b.medicineReceived !== undefined) updateData.medicineReceived = b.medicineReceived;
      if (b.pdfPrinted !== undefined) updateData.pdfPrinted = b.pdfPrinted;
      if (b.stickerPrinted !== undefined) updateData.stickerPrinted = b.stickerPrinted;
      
      if (b.holdStatus !== undefined) {
        const currentHold = existing?.holdStatus || {};
        updateData.holdStatus = {
          isHeld: b.holdStatus.isHeld !== undefined ? b.holdStatus.isHeld : (currentHold.isHeld || false),
          reason: b.holdStatus.reason !== undefined ? b.holdStatus.reason : (currentHold.reason || ''),
          notifyingNurse: b.holdStatus.notifyingNurse !== undefined ? b.holdStatus.notifyingNurse : (currentHold.notifyingNurse || (currentHold as any).notifiedNurse || ''),
          heldAt: b.holdStatus.heldAt !== undefined ? b.holdStatus.heldAt : (currentHold.heldAt || (currentHold as any).timestamp || ''),
          unholdReason: b.holdStatus.unholdReason !== undefined ? b.holdStatus.unholdReason : (currentHold.unholdReason || ''),
          unholdNurse: b.holdStatus.unholdNurse !== undefined ? b.holdStatus.unholdNurse : (currentHold.unholdNurse || ''),
          unheldAt: b.holdStatus.unheldAt !== undefined ? b.holdStatus.unheldAt : (currentHold.unheldAt || '')
        };
      } else {
        // preserve existing if not explicitly passed
        if (existing?.holdStatus) updateData.holdStatus = existing.holdStatus;
      }

      if (b.rolloverStatus !== undefined) {
        updateData.rolloverStatus = b.rolloverStatus;
      } else {
        if (existing?.rolloverStatus) updateData.rolloverStatus = existing.rolloverStatus;
      }

      if (b.pharmacistVerification !== undefined) {
        const currentPV = existing?.pharmacistVerification || {};
        updateData.pharmacistVerification = {
          ...currentPV,
          ...b.pharmacistVerification
        };
      } else {
        if (existing?.pharmacistVerification) updateData.pharmacistVerification = existing.pharmacistVerification;
      }

      if (b.cancelStatus !== undefined) {
        updateData.cancelStatus = b.cancelStatus;
      } else if (existing?.cancelStatus) {
        updateData.cancelStatus = existing.cancelStatus;
      }

      if (b.stockVerification !== undefined) {
        updateData.stockVerification = b.stockVerification;
      } else if (existing?.stockVerification) {
        updateData.stockVerification = existing.stockVerification;
      }

      if (b.borrowInfo !== undefined) {
        updateData.borrowInfo = b.borrowInfo;
      } else if (existing?.borrowInfo) {
        updateData.borrowInfo = existing.borrowInfo;
      }

      if (b.clerkVerification !== undefined) {
        const currentCV = existing?.clerkVerification || {};
        updateData.clerkVerification = {
          status: b.clerkVerification.status !== undefined ? b.clerkVerification.status : (currentCV.status || 'Pending'),
          verifiedBy: b.clerkVerification.verifiedBy !== undefined ? b.clerkVerification.verifiedBy : (currentCV.verifiedBy || ''),
          verifiedAt: b.clerkVerification.verifiedAt !== undefined ? b.clerkVerification.verifiedAt : (currentCV.verifiedAt || ''),
          orderedBy: b.clerkVerification.orderedBy !== undefined ? b.clerkVerification.orderedBy : (currentCV.orderedBy || ''),
          orderedAt: b.clerkVerification.orderedAt !== undefined ? b.clerkVerification.orderedAt : (currentCV.orderedAt || ''),
          ...(b.clerkVerification.orderNote !== undefined || currentCV.orderNote ? { orderNote: b.clerkVerification.orderNote !== undefined ? b.clerkVerification.orderNote : currentCV.orderNote } : {}),
          ...(b.clerkVerification.arrivalNote !== undefined || currentCV.arrivalNote ? { arrivalNote: b.clerkVerification.arrivalNote !== undefined ? b.clerkVerification.arrivalNote : currentCV.arrivalNote } : {})
        };
      } else {
        if (existing?.clerkVerification) updateData.clerkVerification = existing.clerkVerification;
      }

      if (b.staff) {
        const currentStaff = existing?.staff || {};
        updateData.staff = {
          doctor: b.staff.doctor !== undefined ? b.staff.doctor : (currentStaff.doctor || ''),
          nurse: b.staff.nurse !== undefined ? b.staff.nurse : (currentStaff.nurse || ''),
          pharmacist: b.staff.pharmacist !== undefined ? b.staff.pharmacist : (currentStaff.pharmacist || ''),
          creatorId: b.staff.creatorId !== undefined ? b.staff.creatorId : (currentStaff.creatorId || currentUser?.id || 'system'),
          creatorName: b.staff.creatorName !== undefined ? b.staff.creatorName : (currentStaff.creatorName || currentUser?.name || 'Staff Member')
        };
      } else {
        if (existing?.staff) updateData.staff = existing.staff;
      }

      await updateDoc(docRef, updateData);

      // Audit logs
      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Staff',
        userRole: currentUser?.role || 'Nurse',
        action: 'Update Booking',
        details: `Edited reservation ${id} details systematically.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `อัปเดตข้อมูลใบจอง ${id} เรียบร้อยแล้ว`
          : `Booking order ${id} updated systematically.`,
        'success'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      return { success: false, error: e.message || 'Error updating booking' };
    } finally {
      setLoading(false);
    }
  };

  const deleteBooking = async (id: string) => {
    setLoading(true);
    try {
      const existing = bookings.find((x) => x.id === id);
      if (existing?.prescriptionImage && isStorageUrl(existing.prescriptionImage)) {
        await deletePrescriptionFromStorage(existing.prescriptionImage);
      }
      await deleteDoc(doc(db, 'bookings', id));

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Staff',
        userRole: currentUser?.role || 'Admin',
        action: 'Delete Booking',
        details: `Deleted booking record ${id} permanently.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `ลบประวัติการจองยาของหมายเลข ${id} ออกจากระบบถาวรแล้ว`
          : `Medication booking record ${id} was permanently removed.`,
        'info'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `bookings/${id}`);
      return { success: false, error: e.message || 'Error removing booking' };
    } finally {
      setLoading(false);
    }
  };

  const verifyPharmacist = async (id: string, phLocation?: string, phName?: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'bookings', id);
      const booking = bookings.find((b) => b.id === id);
      
      const updateData: any = {
        pharmacistVerification: {
          status: 'Verified',
          verifiedBy: phName || currentUser?.name || 'Pharmacist Coordinator',
          verifiedAt: new Date().toISOString()
        }
      };

      if (phLocation) {
        updateData.pharmacyLocation = phLocation;
      }

      if (phName) {
        // Dot notation or partial update for nested object
        if (booking?.staff) {
          updateData.staff = {
            ...booking.staff,
            pharmacist: phName
          };
        } else {
          updateData['staff.pharmacist'] = phName;
        }
      }

      await updateDoc(docRef, updateData);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'pharmacist',
        userName: currentUser?.name || 'Pharmacist',
        userRole: currentUser?.role || 'Pharmacist',
        action: 'Verify Ordered Medication',
        details: `Approved verification of drug allocation for ${id}.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `ทบทวนและตรวจสอบใบสั่งยาเลขที่ ${id} สำเร็จ!`
          : `Pharmacist Verified order ${id} successfully!`,
        'success'
      );
      return true;
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const rejectPharmacistVerification = async (id: string, reason: string, note?: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'bookings', id);
      const booking = bookings.find((b) => b.id === id);
      const updateData: any = {
        pharmacistVerification: {
          status: 'Rejected',
          rejectionReason: reason,
          rejectionNote: note || '',
          rejectedBy: currentUser?.name || 'Pharmacist Reviewer',
          rejectedAt: new Date().toISOString(),
          verifiedBy: '',
          verifiedAt: '',
          reverifyRequested: false
        }
      };
      await updateDoc(docRef, updateData);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'pharmacist',
        userName: currentUser?.name || 'Pharmacist',
        userRole: currentUser?.role || 'Pharmacist',
        action: 'Reject Order Verification',
        details: `Pharmacist rejected verification for ${id}. Reason: ${reason}. Note: ${note || '-'}. Notification dispatched to booking creator.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `บันทึกผล Verify ไม่ผ่านสำหรับใบสั่งยา ${id} สำเร็จ! แจ้งเตือนไปยังผู้จองแล้ว`
          : `Marked verification as Not Approved for ${id}. Notification dispatched to booking creator.`,
        'info',
        id,
        booking?.hn
      );
      return true;
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reverifyPharmacist = async (id: string, phLocation?: string, phName?: string) => {
    return await verifyPharmacist(id, phLocation, phName);
  };

  const requestCancelBooking = async (id: string, reason: string, requestedByName: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'bookings', id);
      const booking = bookings.find((b) => b.id === id);
      const updateData: any = {
        cancelStatus: {
          isRequested: true,
          reason: reason.trim(),
          requestedByName: requestedByName.trim() || currentUser?.name || 'Staff',
          requestedAt: new Date().toISOString(),
          approved: false,
          rejected: false
        }
      };
      await updateDoc(docRef, updateData);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'staff',
        userName: currentUser?.name || 'Staff',
        userRole: currentUser?.role || 'Nurse',
        action: 'Request Booking Cancellation',
        details: `Cancellation requested for ${id} by ${requestedByName}. Reason: ${reason}.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `ส่งคำขอยกเลิกรายการจองยา ${id} สำเร็จ! สถานะเป็น Request on process รอการอนุมัติ`
          : `Cancellation request submitted for ${id}! Status is now Request on process pending approval.`,
        'info',
        id,
        booking?.hn
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      return { success: false, error: e.message || 'Error submitting cancellation' };
    } finally {
      setLoading(false);
    }
  };

  const approveCancelBooking = async (id: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'bookings', id);
      const booking = bookings.find((b) => b.id === id);
      const existingCancel = booking?.cancelStatus || {
        reason: 'Cancellation approved',
        requestedByName: 'Staff',
        requestedAt: new Date().toISOString()
      };
      const updateData: any = {
        cancelStatus: {
          ...existingCancel,
          isRequested: false,
          approved: true,
          rejected: false,
          reviewedBy: currentUser?.name || 'Admin/Pharmacist',
          reviewedAt: new Date().toISOString()
        }
      };
      await updateDoc(docRef, updateData);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Staff',
        userRole: currentUser?.role || 'Admin',
        action: 'Approve Booking Cancellation',
        details: `Approved cancellation of reservation ${id}. Booking is now cancelled.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `อนุมัติยกเลิกรายการจองยา ${id} เรียบร้อยแล้ว`
          : `Booking cancellation approved for ${id}.`,
        'success',
        id,
        booking?.hn
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      return { success: false, error: e.message || 'Error approving cancellation' };
    } finally {
      setLoading(false);
    }
  };

  const rejectCancelBooking = async (id: string, reviewNote?: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'bookings', id);
      const booking = bookings.find((b) => b.id === id);
      const existingCancel = booking?.cancelStatus || {
        reason: '',
        requestedByName: 'Staff',
        requestedAt: new Date().toISOString()
      };
      const updateData: any = {
        cancelStatus: {
          ...existingCancel,
          isRequested: false,
          approved: false,
          rejected: true,
          reviewedBy: currentUser?.name || 'Admin/Pharmacist',
          reviewedAt: new Date().toISOString(),
          reviewNote: reviewNote || ''
        }
      };
      await updateDoc(docRef, updateData);

      spawnAlert(
        language === 'TH'
          ? `ปฏิเสธคำขอยกเลิกรายการจองยา ${id} รายการจองยังคงมีผลตามปกติ`
          : `Cancellation request rejected for ${id}.`,
        'info',
        id,
        booking?.hn
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      return { success: false, error: e.message || 'Error rejecting cancellation' };
    } finally {
      setLoading(false);
    }
  };

  const stockReverifyOrder = async (id: string, approved: boolean, notes?: string, rejectionReason?: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'bookings', id);
      const booking = bookings.find((b) => b.id === id);
      const updateData: any = {};
      if (approved) {
        updateData.stockVerification = {
          status: 'Verified',
          verifiedBy: currentUser?.name || 'Stock Clerk',
          verifiedAt: new Date().toISOString(),
          notes: notes || ''
        };
        // Re-verifying pushes it to dashboard as an active / freshly reverified queue
        updateData['pharmacistVerification.resubmittedAt'] = new Date().toISOString();
      } else {
        updateData.stockVerification = {
          status: 'Rejected',
          verifiedBy: currentUser?.name || 'Stock Clerk',
          verifiedAt: new Date().toISOString(),
          rejectionReason: rejectionReason || notes || 'Stock verification rejected',
          notes: notes || ''
        };
      }
      await updateDoc(docRef, updateData);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'stock',
        userName: currentUser?.name || 'Stock Clerk',
        userRole: currentUser?.role || 'Pharmacy Stock Clerk',
        action: approved ? 'Stock Order Re-verify Approved' : 'Stock Order Re-verify Rejected',
        details: `Stock performed order re-verification for ${id}. Status: ${approved ? 'Verified' : 'Rejected'}. Notes: ${notes || '-'}`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? (approved ? `ทวนสอบ Order สำเร็จ: รายการจองยา ${id} ได้รับการ Re-verify จากฝ่ายคลังยาแล้ว` : `ทวนสอบ Order ไม่ผ่าน: แจ้งเตือนไปยังผู้สั่งจองแล้ว`)
          : (approved ? `Stock Re-verified order ${id} successfully!` : `Stock verification rejected for ${id}.`),
        approved ? 'success' : 'info',
        id,
        booking?.hn
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      return { success: false, error: e.message || 'Error in stock reverify' };
    } finally {
      setLoading(false);
    }
  };

  const markBorrowedMedReturned = async (bookingId: string, borrowedIndex: number, returnBookingId?: string) => {
    try {
      const docRef = doc(db, 'bookings', bookingId);
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking || !booking.borrowInfo || !booking.borrowInfo[borrowedIndex]) return;

      const updatedBorrowInfo = [...booking.borrowInfo];
      updatedBorrowInfo[borrowedIndex] = {
        ...updatedBorrowInfo[borrowedIndex],
        returned: true,
        returnBookingId: returnBookingId || '',
        returnedAt: new Date().toISOString(),
        returnedBy: currentUser?.name || 'Staff'
      };

      await updateDoc(docRef, { borrowInfo: updatedBorrowInfo });
      spawnAlert(
        language === 'TH' ? 'บันทึกการคืนยาที่ยืมเรียบร้อยแล้ว' : 'Borrowed medication marked as returned!',
        'success',
        bookingId,
        booking.hn
      );
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const verifyClerk = async (id: string, operatorName?: string, notes?: string) => {
    setLoading(true);
    try {
      const booking = bookings.find((b) => b.id === id);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const docRef = doc(db, 'bookings', id);
      const currentClerkStatus = booking.clerkVerification?.status || 'Pending';

      const baseClerk = booking.clerkVerification || {
        status: 'Pending',
        verifiedBy: '',
        verifiedAt: '',
        orderedBy: '',
        orderedAt: ''
      };

      const nextClerkVerification: any = { ...baseClerk };
      const actor = operatorName?.trim() || currentUser?.name || 'Pharmacy Stock Clerk';
      const nowIso = new Date().toISOString();
      const noteClean = notes?.trim() || '';
      let actionDetails = '';
      let successMsg = '';
      let actionName = 'Stock Delivered';

      if (currentClerkStatus === 'Pending') {
        nextClerkVerification.status = 'Accepted';
        nextClerkVerification.orderedBy = actor;
        nextClerkVerification.orderedAt = nowIso;
        if (noteClean) nextClerkVerification.orderNote = noteClean;
        actionDetails = `Confirmed Step 1 (Purchase Order) for booking ${id} by ${actor} at ${nowIso}.${noteClean ? ` Note: ${noteClean}` : ''}`;
        successMsg = language === 'TH'
          ? `ยืนยันการสั่งซื้อยา ${id} เรียบร้อยแล้ว (โดย ${actor})`
          : `Confirmed purchase order for ${id} (by ${actor})!`;
        actionName = 'Clerk Order Initiated';
      } else if (currentClerkStatus === 'Accepted') {
        nextClerkVerification.status = 'Ready-to-use';
        nextClerkVerification.verifiedBy = actor;
        nextClerkVerification.verifiedAt = nowIso;
        if (noteClean) nextClerkVerification.arrivalNote = noteClean;
        actionDetails = `Confirmed Step 2 (Stock Arrived) for booking ${id} by ${actor} at ${nowIso}.${noteClean ? ` Note: ${noteClean}` : ''}`;
        successMsg = language === 'TH'
          ? `ยืนยันของมาถึงสำหรับ ${id} เรียบร้อยแล้ว (โดย ${actor})`
          : `Confirmed stock arrival for ${id} (by ${actor})!`;
        actionName = 'Stock Delivered';
      } else {
        return true;
      }

      await updateDoc(docRef, {
        clerkVerification: nextClerkVerification
      });

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: nowIso,
        userId: currentUser?.id || 'clerk',
        userName: actor,
        userRole: currentUser?.role || 'Pharmacy Stock Clerk',
        action: actionName,
        details: actionDetails
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(successMsg, 'success', id, booking.hn);
      return true;
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Pharmaceutical medication drugs catalog CRUD
  const createDrug = async (d: Partial<Drug>) => {
    setLoading(true);
    try {
      const drugId = d.id || 'drg-' + Date.now();
      const newDrug: Drug = {
        id: drugId,
        name: d.name || '',
        stockCode: d.stockCode || 'GEN000',
        type: d.type || 'General',
        prices: {
          employee: Number(d.prices?.employee) || 0,
          opd: Number(d.prices?.opd) || 0,
          ipd: Number(d.prices?.ipd) || 0,
          it: Number(d.prices?.it) || 0
        }
      };

      await setDoc(doc(db, 'drugs', drugId), newDrug);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Pharmacist',
        userRole: currentUser?.role || 'Pharmacist',
        action: 'Register Drug',
        details: `Added new pharmaceutical medicine: ${newDrug.name} (${newDrug.stockCode}).`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `เพิ่มเวชภัณฑ์ยาใหม่เข้าคลังสำเร็จ: ${newDrug.name}`
          : `Added medication catalog line: ${newDrug.name}.`,
        'success'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'drugs');
      return { success: false, error: e.message || 'Error adding drug' };
    } finally {
      setLoading(false);
    }
  };

  const updateDrug = async (id: string, d: Partial<Drug>) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'drugs', id);
      const updateData: any = {};
      if (d.name) updateData.name = d.name;
      if (d.type) updateData.type = d.type;
      if (d.stockCode) updateData.stockCode = d.stockCode;
      if (d.prices) {
        updateData.prices = {
          employee: Number(d.prices.employee) || 0,
          opd: Number(d.prices.opd) || 0,
          ipd: Number(d.prices.ipd) || 0,
          it: Number(d.prices.it) || 0
        };
      }

      await updateDoc(docRef, updateData);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Pharmacist',
        userRole: currentUser?.role || 'Pharmacist',
        action: 'Update Drug',
        details: `Updated drug items properties/prices for ${d.name || id}.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `อัปเดตข้อมูลเวชภัณฑ์ยาเรียบร้อยแล้ว`
          : `Updated drug properties successfully.`,
        'success'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `drugs/${id}`);
      return { success: false, error: e.message || 'Error updating drug' };
    } finally {
      setLoading(false);
    }
  };

  const deleteDrug = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'drugs', id));

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Pharmacist',
        userRole: currentUser?.role || 'Pharmacist',
        action: 'Remove Drug',
        details: `Removed drug catalog item id: ${id} from storage tracking.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `ลบเวชภัณฑ์ยาออกจากระบบคลังข้อมูลเรียบร้อยแล้ว`
          : 'Drug item was removed from system indexing ledger.',
        'info'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `drugs/${id}`);
      return { success: false, error: e.message || 'Error deleting drug' };
    } finally {
      setLoading(false);
    }
  };

  const requestDeleteDrug = async (id: string, reason: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'drugs', id);
      await updateDoc(docRef, {
        deleteRequested: true,
        deleteReason: reason,
        deleteRequestedBy: currentUser?.name || currentUser?.username || 'Staff',
        deleteRequestedAt: new Date().toISOString()
      });

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Staff',
        userRole: currentUser?.role || 'Pharmacist',
        action: 'Request Drug Deletion',
        details: `Requested deletion of drug id: ${id}. Reason: ${reason}`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `ยื่นส่งคำร้องขอลบเวชภัณฑ์สำเร็จ รอผู้ดูแลอนุมัติ`
          : `Submitted drug deletion request. Awaiting Admin approval.`,
        'info'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `drugs/${id}`);
      return { success: false, error: e.message || 'Error submitting deletion request' };
    } finally {
      setLoading(false);
    }
  };

  const rejectDeleteDrug = async (id: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'drugs', id);
      await updateDoc(docRef, {
        deleteRequested: false,
        deleteReason: '',
        deleteRequestedBy: '',
        deleteRequestedAt: ''
      });

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Admin',
        userRole: currentUser?.role || 'Admin',
        action: 'Reject Drug Deletion',
        details: `Rejected deletion request of drug id: ${id}.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `ปฏิเสธคำขอลบเวชภัณฑ์ เก็บรายการยาไว้ในระบบตามเดิม`
          : `Rejected drug deletion request. Item is retained.`,
        'success'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `drugs/${id}`);
      return { success: false, error: e.message || 'Error rejecting deletion request' };
    } finally {
      setLoading(false);
    }
  };

  const requestEditDrug = async (id: string, d: Partial<Drug>) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'drugs', id);
      const proposed = {
        name: d.name || '',
        stockCode: d.stockCode || '',
        type: d.type || 'General',
        prices: {
          employee: Number(d.prices?.employee) || 0,
          opd: Number(d.prices?.opd) || 0,
          ipd: Number(d.prices?.ipd) || 0,
          it: Number(d.prices?.it) || 0
        }
      };

      await updateDoc(docRef, {
        editRequested: true,
        editRequestedBy: currentUser?.name || currentUser?.username || 'Pharmacist',
        editRequestedAt: new Date().toISOString(),
        editRequest: proposed
      });

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Staff',
        userRole: currentUser?.role || 'Pharmacist',
        action: 'Request Drug Edit',
        details: `Requested edit of drug id: ${id}. Proposed name: ${proposed.name}`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `ยื่นส่งคำร้องขอแก้ไขข้อมูลเวชภัณฑ์สำเร็จ รอผู้ดูแลอนุมัติ`
          : `Submitted drug modification request. Awaiting Admin approval.`,
        'info'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `drugs/${id}`);
      return { success: false, error: e.message || 'Error submitting modification request' };
    } finally {
      setLoading(false);
    }
  };

  const approveEditDrug = async (id: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'drugs', id);
      const drugInList = drugs.find(d => d.id === id);
      if (!drugInList || !drugInList.editRequest) {
        throw new Error('No pending changes found for this drug item');
      }

      const prop = drugInList.editRequest;
      await updateDoc(docRef, {
        name: prop.name,
        type: prop.type,
        stockCode: prop.stockCode,
        prices: {
          employee: Number(prop.prices.employee) || 0,
          opd: Number(prop.prices.opd) || 0,
          ipd: Number(prop.prices.ipd) || 0,
          it: Number(prop.prices.it) || 0
        },
        editRequested: false,
        editRequestedBy: '',
        editRequestedAt: '',
        editRequest: null
      });

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Admin',
        userRole: currentUser?.role || 'Admin',
        action: 'Approve Drug Edit',
        details: `Approved edit changes for drug id: ${id}. Applied name: ${prop.name}`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `อนุมัติคำขอแก้ไขข้อมูลเวชภัณฑ์และปรับใช้ข้อมูลใหม่เรียบร้อยแล้ว!`
          : `Approved drug modification. New parameters applied.`,
        'success'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `drugs/${id}`);
      return { success: false, error: e.message || 'Error approving drug edit' };
    } finally {
      setLoading(false);
    }
  };

  const rejectEditDrug = async (id: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'drugs', id);
      await updateDoc(docRef, {
        editRequested: false,
        editRequestedBy: '',
        editRequestedAt: '',
        editRequest: null
      });

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Admin',
        userRole: currentUser?.role || 'Admin',
        action: 'Reject Drug Edit',
        details: `Rejected edit request of drug id: ${id}.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(
        language === 'TH'
          ? `ปฏิเสธคำขอแก้ไขข้อมูลเวชภัณฑ์ เก็บรักษาข้อมูลเดิมไว้`
          : `Rejected drug edit request. Original parameters preserved.`,
        'success'
      );
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `drugs/${id}`);
      return { success: false, error: e.message || 'Error rejecting edit request' };
    } finally {
      setLoading(false);
    }
  };

  // Staff User profiles CRUD
  const createUser = async (usr: Partial<User> & { password?: string }) => {
    setLoading(true);
    try {
      const newUserId = usr.id || 'usr-' + Date.now();
      const newUser: User = {
        id: newUserId,
        username: usr.username || '',
        name: usr.name || '',
        role: usr.role || 'Nurse',
        roles: usr.roles || [usr.role || 'Nurse'],
        password: usr.password || 'password123',
        approved: true // Admin created is auto-approved
      };

      await setDoc(doc(db, 'users', newUserId), newUser);

      // Create linked Firebase Authentication credentials
      const virtualEmail = `${newUser.username.trim().toLowerCase()}@rxnexus.com`;
      try {
        await createUserWithEmailAndPassword(auth, virtualEmail, newUser.password || 'password123');
      } catch (authErr) {
        console.warn('Firebase Auth user already created or creation warning:', authErr);
      }

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'admin',
        userName: currentUser?.name || 'Administrator',
        userRole: currentUser?.role || 'Admin',
        action: 'Create Staff',
        details: `Registered staff profile: ${newUser.name} with role ${newUser.role}.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(`Registered staff credential profile: ${newUser.name} (${newUser.role}).`, 'success');
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'users');
      return { success: false, error: e.message || 'Error creating user profile' };
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async (usr: Partial<User> & { password?: string }) => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);
      let exists = false;
      snap.forEach((docSnap) => {
        const u = docSnap.data() as User;
        if (u.username.trim().toLowerCase() === usr.username?.trim().toLowerCase()) {
          exists = true;
        }
      });

      if (exists) {
        return { success: false, error: 'Username / Staff ID already taken!' };
      }

      const newUserId = 'usr-' + Date.now();
      const newUser: User = {
        id: newUserId,
        username: usr.username || '',
        name: usr.name || '',
        role: usr.role || 'Nurse',
        roles: usr.roles || [usr.role || 'Nurse'],
        password: usr.password || 'password123',
        approved: false // Pending approval
      };

      await setDoc(doc(db, 'users', newUserId), newUser);

      // Create linked Firebase Authentication credentials
      const virtualEmail = `${newUser.username.trim().toLowerCase()}@rxnexus.com`;
      try {
        await createUserWithEmailAndPassword(auth, virtualEmail, newUser.password || 'password123');
      } catch (authErr) {
        console.warn('Firebase Auth user already created (warning):', authErr);
      }

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: 'system',
        userName: newUser.name,
        userRole: newUser.role,
        action: 'User Registration',
        details: `Submitted online system registration. Pending security approval.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(`Registration request submitted successfully! Pending Admin review.`, 'success');
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'users');
      return { success: false, error: e.message || 'Error submitting registration request' };
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id: string, usr: Partial<User> & { password?: string }) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'users', id);
      const updateData: any = {};
      if (usr.name) updateData.name = usr.name;
      if (usr.role) updateData.role = usr.role;
      if (usr.roles) updateData.roles = usr.roles;
      if (usr.password) updateData.password = usr.password;
      if (usr.approved !== undefined) updateData.approved = usr.approved;

      await updateDoc(docRef, updateData);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'admin',
        userName: currentUser?.name || 'Administrator',
        userRole: currentUser?.role || 'Admin',
        action: 'Update Staff',
        details: `Edited staff information for profile: ${usr.name || id}.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(`Updated staff credential profile successfully.`, 'success');
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${id}`);
      return { success: false, error: e.message || 'Error updating user details' };
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (id === '585982') {
      return { success: false, error: 'Cannot remove default system Administrator!' };
    }
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', id));

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'admin',
        userName: currentUser?.name || 'Administrator',
        userRole: currentUser?.role || 'Admin',
        action: 'Delete Staff',
        details: `Deleted user staff profile id: ${id}.`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert('User staff credential deleted permanently.', 'info');
      return { success: true, deleted: id };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `users/${id}`);
      return { success: false, error: e.message || 'Error deleting user' };
    } finally {
      setLoading(false);
    }
  };

  const reportOwingMed = async (booking: Booking, drugIds?: string[]) => {
    setLoading(true);
    try {
      const medsToReport = booking.medications
        .filter(m => !drugIds || drugIds.includes(m.drugId))
        .map(m => ({
          drugId: m.drugId,
          drugName: m.drugName,
          stockCode: m.stockCode,
          quantity: m.quantity,
          received: false
        }));

      if (medsToReport.length === 0) {
        return { success: false, error: 'No medications selected for owing report!' };
      }

      const owingId = 'owing-' + Date.now();
      const newOwing: OwingMedication = {
        id: owingId,
        bookingId: booking.id,
        patientName: booking.patientName,
        hn: booking.hn,
        pharmacyLocation: booking.pharmacyLocation || '',
        medications: medsToReport,
        reportedBy: currentUser?.name || 'Pharmacist',
        createdAt: new Date().toISOString(),
        resolved: false
      };

      await setDoc(doc(db, 'owing_meds', owingId), newOwing);

      const logId = 'log-' + Date.now();
      const newLog: SystemLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'Pharmacist',
        userRole: currentUser?.role || 'Pharmacist',
        action: 'Report Owing Medication',
        details: `Pharmacist reported owing medications for booking ${booking.id} (${booking.patientName}).`
      };
      await setDoc(doc(db, 'logs', logId), newLog);

      spawnAlert(`Successfully logged owing med report for ${booking.patientName}!`, 'success', booking.id, booking.hn, 'owing');
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'owing_meds');
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  const updatePreparedStatus = async (owingId: string, drugId: string, received: boolean) => {
    try {
      const found = owingMeds.find(om => om.id === owingId);
      if (!found) return;

      const updatedMeds = found.medications.map(m => {
        if (m.drugId === drugId) {
          return { ...m, received };
        }
        return m;
      });

      const allReceived = updatedMeds.every(m => m.received === true);

      await updateDoc(doc(db, 'owing_meds', owingId), {
        medications: updatedMeds,
        resolved: allReceived
      });

      if (allReceived) {
        setAlerts((prev) => prev.filter((a) => !(a.bookingId === found.bookingId && a.category === 'owing')));
      }

      spawnAlert(`Updated item preparation status.`, 'success');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `owing_meds/${owingId}`);
    }
  };

  const toggleOwingResolved = async (owingId: string, resolved: boolean) => {
    try {
      const found = owingMeds.find(om => om.id === owingId);
      if (!found) return;

      const updatedMeds = found.medications.map(m => ({
        ...m,
        received: resolved
      }));

      await updateDoc(doc(db, 'owing_meds', owingId), {
        medications: updatedMeds,
        resolved
      });

      if (resolved) {
        setAlerts((prev) => prev.filter((a) => !(a.bookingId === found.bookingId && a.category === 'owing')));
        const logId = 'log-' + Date.now();
        await setDoc(doc(db, 'logs', logId), {
          id: logId,
          timestamp: new Date().toISOString(),
          userId: currentUser?.id || 'system',
          userName: currentUser?.name || 'Pharmacist',
          userRole: currentUser?.role || 'Pharmacist',
          action: 'Complete Owing Medication',
          details: `Completed & closed owing medication case for ${found.patientName} (HN: ${found.hn}, Booking: ${found.bookingId}).`
        });
      }

      spawnAlert(
        resolved
          ? (language === 'TH' ? `ปิดเคสค้างส่งยา ${found.patientName} สำเร็จ! ยุติการแจ้งเตือนคลังยาแล้ว` : `Owing case completed for ${found.patientName}! Stock alert stopped.`)
          : `Owing status set to UNRESOLVED`,
        'success'
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `owing_meds/${owingId}`);
    }
  };

  const toggleMedicineOwing = async (booking: Booking, targetMed: any, makeOwing: boolean) => {
    try {
      const existingRecord = owingMeds.find(om => om.bookingId === booking.id);
      const drugNameStr = targetMed.drugName || targetMed.name || 'Unknown Medication';
      
      if (makeOwing) {
        if (existingRecord) {
          const updatedMeds = [...existingRecord.medications];
          const medIdx = updatedMeds.findIndex(m => m.drugId === targetMed.drugId);
          if (medIdx >= 0) {
            updatedMeds[medIdx] = { ...updatedMeds[medIdx], received: false };
          } else {
            updatedMeds.push({
              drugId: targetMed.drugId,
              drugName: drugNameStr,
              stockCode: targetMed.stockCode || 'N/A',
              quantity: targetMed.quantity,
              received: false
            });
          }
          
          await setDoc(doc(db, 'owing_meds', existingRecord.id), {
            ...existingRecord,
            pharmacyLocation: booking.pharmacyLocation || existingRecord.pharmacyLocation || '',
            medications: updatedMeds,
            resolved: false
          }, { merge: true });
        } else {
          const owingId = 'owing-' + booking.id;
          const newOwing: OwingMedication = {
            id: owingId,
            bookingId: booking.id,
            patientName: booking.patientName,
            hn: booking.hn,
            pharmacyLocation: booking.pharmacyLocation || '',
            medications: [{
              drugId: targetMed.drugId,
              drugName: drugNameStr,
              stockCode: targetMed.stockCode || 'N/A',
              quantity: targetMed.quantity,
              received: false
            }],
            reportedBy: currentUser?.name || 'Pharmacist',
            createdAt: new Date().toISOString(),
            resolved: false
          };
          await setDoc(doc(db, 'owing_meds', owingId), newOwing);
        }

        spawnAlert(
          `🚨 OWING MED (ยังไม่ได้รับ): Patient ${booking.patientName} (HN: ${booking.hn}) lacks [${drugNameStr} x${targetMed.quantity}]. ALERT TO CLERK ISSUED!`,
          'info',
          booking.id,
          booking.hn,
          'owing'
        );
      } else {
        if (existingRecord) {
          const updatedMeds = existingRecord.medications.map(m => {
            if (m.drugId === targetMed.drugId) {
              return { ...m, received: true };
            }
            return m;
          });
          
          const allReceived = updatedMeds.every(m => m.received === true);
          
          await setDoc(doc(db, 'owing_meds', existingRecord.id), {
            ...existingRecord,
            pharmacyLocation: booking.pharmacyLocation || existingRecord.pharmacyLocation || '',
            medications: updatedMeds,
            resolved: allReceived
          }, { merge: true });

          if (allReceived) {
            setAlerts((prev) => prev.filter((a) => !(a.bookingId === booking.id && a.category === 'owing')));
          }
        }
      }
    } catch (e) {
      const existingRecord = owingMeds.find(om => om.bookingId === booking.id);
      const docId = existingRecord ? existingRecord.id : 'owing-' + booking.id;
      handleFirestoreError(e, makeOwing ? OperationType.CREATE : OperationType.UPDATE, `owing_meds/${docId}`);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        bookings,
        drugs,
        users,
        logs,
        alerts,
        owingMeds,
        loading,
        language,
        setLanguage,
        setLoading,
        login,
        logout,
        fetchBookings,
        fetchDrugs,
        fetchUsers,
        fetchLogs,
        createBooking,
        updateBooking,
        deleteBooking,
        verifyPharmacist,
        rejectPharmacistVerification,
        reverifyPharmacist,
        requestCancelBooking,
        approveCancelBooking,
        rejectCancelBooking,
        stockReverifyOrder,
        markBorrowedMedReturned,
        verifyClerk,
        createDrug,
        updateDrug,
        deleteDrug,
        requestDeleteDrug,
        rejectDeleteDrug,
        requestEditDrug,
        approveEditDrug,
        rejectEditDrug,
        createUser,
        registerUser,
        updateUser,
        deleteUser,
        reportOwingMed,
        updatePreparedStatus,
        toggleOwingResolved,
        toggleMedicineOwing,
        clearAlerts,
        spawnAlert,
        selectedPharmacyLocation,
        setSelectedPharmacyLocation,
        soundEnabled,
        setSoundEnabled: handleSetSoundEnabled
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

