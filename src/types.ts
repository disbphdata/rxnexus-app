export type UserRole = 'Admin' | 'Pharmacist' | 'Pharmacist Assistant' | 'Nurse' | 'Doctor' | 'Pharmacy Stock Clerk';

export interface User {
  id: string; // e.g., "585982"
  username: string; // For login
  name: string;
  role: UserRole;
  roles?: UserRole[];
  password?: string;
  approved?: boolean;
}

export interface DrugPrices {
  employee: number;
  opd: number;
  ipd: number;
  it: number;
}

export interface Drug {
  id: string;
  name: string;
  type: 'General' | 'Oncology';
  stockCode: string;
  prices: DrugPrices;
  deleteRequested?: boolean;
  deleteReason?: string;
  deleteRequestedBy?: string;
  deleteRequestedAt?: string;
  editRequested?: boolean;
  editRequestedBy?: string;
  editRequestedAt?: string;
  editRequest?: {
    name: string;
    type: 'General' | 'Oncology';
    stockCode: string;
    prices: DrugPrices;
  };
}

export interface BookingMedication {
  drugId: string;
  drugName: string;
  stockCode: string;
  quantity: number;
  priceType: 'employee' | 'opd' | 'ipd' | 'it';
  unitPrice: number;
  totalPrice: number;
}

export interface BookingStaff {
  doctor: string;
  nurse: string;
  pharmacist: string;
  creatorId: string;
  creatorName: string;
}

export interface Verification {
  status: 'Pending' | 'Accepted' | 'Verified' | 'Ready-to-use' | 'Rejected';
  verifiedBy: string;
  verifiedAt: string;
  orderedBy?: string;
  orderedAt?: string;
  orderNote?: string;
  arrivalNote?: string;
  rejectionReason?: string;
  rejectionNote?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  reverifyRequested?: boolean;
  resubmittedAt?: string;
  resubmittedBy?: string;
}

export interface BookingHoldStatus {
  isHeld: boolean;
  reason: string;
  notifyingNurse: string;
  heldAt: string;
  unholdReason?: string;
  unholdNurse?: string;
  unheldAt?: string;
}

export interface BookingRolloverStatus {
  originalDateOfUse: string;
  newDateOfUse: string;
  reason: string;
  notifyingNurse: string;
  rolledOverAt: string;
  pharmacistAlertRead?: boolean;
  clerkAlertRead?: boolean;
}

export interface BookingCancelStatus {
  isRequested: boolean;
  reason: string;
  requestedByName: string; // custom signature name (ไม่อิงตาม user)
  requestedAt: string;
  approved: boolean;
  rejected?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface StockVerification {
  status: 'Pending' | 'Verified' | 'Rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  rejectionReason?: string;
}

export interface BorrowedMedicationInfo {
  isBorrowed?: boolean;
  borrowedFromHn: string;
  borrowedFromPatientName?: string;
  borrowedDrugId: string;
  borrowedDrugName: string;
  quantity: number;
  borrowedByStaff?: string;
  borrowedBy?: string;
  borrowedAt: string;
  returned: boolean;
  returnBookingId?: string;
  returnedAt?: string;
  returnedBy?: string;
}

export interface Booking {
  id: string; // e.g., "RXN-20260520-001"
  bookingDate: string; // YYYY-MM-DD
  hn: string; // Auto-format "xx-xx-xxxxxx"
  patientName: string;
  dateOfUse: string; // YYYY-MM-DD
  department: string;
  pharmacyLocation?: string;
  mode: 'General' | 'Oncology';
  medications: BookingMedication[];
  totalAmount: number;
  prescriptionImage: string; // Firebase Storage URL or compressed JPEG base64
  imageClearedAt?: string;
  imageClearedBy?: string;
  regimen?: string;
  note?: string;
  staff: BookingStaff;
  pharmacistVerification: Verification;
  clerkVerification: Verification;
  medicineReceived?: boolean;
  pdfPrinted?: boolean;
  stickerPrinted?: boolean;
  createdAt: string;
  holdStatus?: BookingHoldStatus;
  rolloverStatus?: BookingRolloverStatus;
  cancelStatus?: BookingCancelStatus;
  stockVerification?: StockVerification;
  borrowInfo?: BorrowedMedicationInfo[];
}

export interface SystemLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
}

export interface DBState {
  users: User[];
  drugs: Drug[];
  bookings: Booking[];
  logs: SystemLog[];
}

export interface OwingMedication {
  id: string;
  bookingId: string;
  patientName: string;
  hn: string;
  pharmacyLocation?: string;
  medications: Array<{
    drugId: string;
    drugName: string;
    stockCode: string;
    quantity: number;
    received: boolean;
  }>;
  reportedBy: string;
  createdAt: string;
  resolved: boolean;
}

export function formatDateToDMY(dateStr: string): string {
  if (!dateStr) return '';
  // If already formatted as DD-MM-YYYY, return as is
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
    return dateStr;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }
  return dateStr;
}
