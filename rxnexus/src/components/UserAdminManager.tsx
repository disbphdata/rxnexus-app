import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { i18n } from '../lib/i18n';
import { User, UserRole } from '../types';
import { Shield, Plus, Trash2, Edit2, Lock, Check, Database } from 'lucide-react';

const AVAILABLE_ROLES: { id: UserRole; name: string }[] = [
  { id: 'Admin', name: 'Admin' },
  { id: 'Pharmacist', name: 'Pharmacist' },
  { id: 'Pharmacist Assistant', name: 'Pharmacist Assistant' },
  { id: 'Nurse', name: 'Nurse' },
  { id: 'Doctor', name: 'Doctor' },
  { id: 'Pharmacy Stock Clerk', name: 'Pharmacy Stock Clerk (Warehouse)' }
];

export default function UserAdminManager() {
  const {
    currentUser,
    users,
    bookings = [],
    drugs = [],
    logs = [],
    owingMeds = [],
    language,
    createUser,
    updateUser,
    deleteUser,
    fetchUsers,
    spawnAlert
  } = useApp();

  const t = i18n[language];

  // Estimate Firestore document physical footprint size
  const estimateDocSize = (doc: any) => {
    if (!doc) return 0;
    // JSON length in characters/bytes is a standard web-safe proxy
    const str = JSON.stringify(doc);
    return str.length + 120; // Adding 120 bytes for document path, ID and indices overhead
  };

  const estimateCollectionSize = (list: any[]) => {
    if (!list || list.length === 0) return 0;
    return list.reduce((acc, item) => acc + estimateDocSize(item), 0);
  };

  const bookingsSize = estimateCollectionSize(bookings);
  const drugsSize = estimateCollectionSize(drugs);
  const usersSize = estimateCollectionSize(users);
  const logsSize = estimateCollectionSize(logs);
  const owingMedsSize = estimateCollectionSize(owingMeds);

  const totalBytes = bookingsSize + drugsSize + usersSize + logsSize + owingMedsSize;

  // Format Helper
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Protect access control block
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin');

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(['Nurse']);
  const [password, setPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [addPanel, setAddPanel] = useState(false);

  // Edit Staff Modal dialog state
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [editErrorMsg, setEditErrorMsg] = useState('');

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [currentUser]);

  if (!isAdmin) {
    return (
      <div className="bg-red-50/50 border border-red-200 rounded-xl p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-4 shadow-sm animate-fade-in">
        <div className="w-14 h-14 bg-red-100/50 rounded-full flex items-center justify-center text-red-600">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-red-800">{t.adminOnly}</h2>
        <p className="text-xs text-red-700 leading-normal">
          Your active login role is <span className="font-bold underline">{currentUser?.role || 'Guest'}</span>.
          Accessing this portal requires system root credentials.
        </p>
      </div>
    );
  }

  // Toggling roles in NEW USER form
  const handleToggleRole = (roleItem: UserRole) => {
    if (selectedRoles.includes(roleItem)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter(r => r !== roleItem));
      }
    } else {
      setSelectedRoles([...selectedRoles, roleItem]);
    }
  };

  // Toggling roles in EDIT USER form
  const handleToggleEditRole = (roleItem: UserRole) => {
    if (editRoles.includes(roleItem)) {
      if (editRoles.length > 1) {
        setEditRoles(editRoles.filter(r => r !== roleItem));
      }
    } else {
      setEditRoles([...editRoles, roleItem]);
    }
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !name.trim() || !password.trim()) {
      setErrorMsg('All credential parameters are mandatory!');
      return;
    }

    if (selectedRoles.length === 0) {
      setErrorMsg('At least one assigned role is required!');
      return;
    }

    const payload = {
      username: username.trim(),
      name: name.trim(),
      role: selectedRoles[0], // primary fallback role for legacy system checks
      roles: selectedRoles,
      password: password.trim()
    };

    const res = await createUser(payload);
    if (res.success) {
      setUsername('');
      setName('');
      setPassword('');
      setSelectedRoles(['Nurse']);
      setAddPanel(false);
    } else {
      setErrorMsg(res.error || 'Server rejected staff creation');
    }
  };

  const handleOpenEdit = (staff: User) => {
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditPassword('');
    // Ensure we fall back to their .role if .roles is missing or empty
    const currentRoles = staff.roles && staff.roles.length > 0 ? staff.roles : [staff.role];
    setEditRoles(currentRoles);
    setEditErrorMsg('');
  };

  const handleApproveUser = async (staff: User) => {
    const res = await updateUser(staff.id, { approved: true });
    if (res.success) {
      spawnAlert(language === 'TH' ? 'อนุมัติผู้ใช้งานเสร็จสิ้น' : 'Staff credential registration approved successfully!', 'success');
    } else {
      spawnAlert(res.error || 'Failed to approve registration template credentials', 'info');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditErrorMsg('');
    if (!editingStaff) return;

    if (!editName.trim()) {
      setEditErrorMsg('Staff Full Name is required!');
      return;
    }

    if (editRoles.length === 0) {
      setEditErrorMsg('At least one assigned role is required!');
      return;
    }

    const payload: any = {
      name: editName.trim(),
      role: editRoles[0], // primary fallback role
      roles: editRoles
    };

    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    const res = await updateUser(editingStaff.id, payload);
    if (res.success) {
      setEditingStaff(null);
    } else {
      setEditErrorMsg(res.error || 'Server rejected staff profile modifications');
    }
  };

  return (
    <div className="space-y-6">
      {/* Introduction layout */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-500" />
            {t.userCatalog}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Assign credentials and clinical clearance tokens across hospital staffs
          </p>
        </div>

        {!addPanel && (
          <button
            id="open-register-staff-btn"
            onClick={() => setAddPanel(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t.addNewUser}
          </button>
        )}
      </div>

      {/* Grid addition Form */}
      {addPanel && (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
          <div className="flex border-b border-slate-200 pb-3 mb-4 justify-between items-center">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">{t.addNewUser}</h3>
            <button
              id="cancel-staff-btn"
              type="button"
              onClick={() => {
                setAddPanel(false);
                setErrorMsg('');
              }}
              className="text-xs text-slate-450 font-bold px-2 py-1 bg-white border border-slate-200 rounded cursor-pointer hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleRegisterStaff} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">{t.userId} / Username *</label>
                <input
                  id="staff-username-input"
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Username / Staff ID"
                  className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">{t.staffName} *</label>
                <input
                  id="staff-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Mrs. Clara Nurse"
                  className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">{t.password} *</label>
                <input
                  id="staff-password-input"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">
                Assign Roles (Multiple Selection Allowed) *
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ROLES.map((roleObj) => {
                  const isChecked = selectedRoles.includes(roleObj.id);
                  return (
                    <button
                      key={roleObj.id}
                      type="button"
                      onClick={() => handleToggleRole(roleObj.id)}
                      className={`px-3 py-2 rounded-lg border text-[11px] font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                        isChecked
                          ? 'bg-blue-650 bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                        isChecked ? 'bg-white border-white text-blue-650 text-blue-600' : 'bg-slate-50 border-slate-350'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      {roleObj.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <p className="text-red-650 text-red-600 font-bold bg-white text-[10px] uppercase p-2.5 rounded border border-red-100">
                ⚠️ {errorMsg}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAddPanel(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-staff-btn"
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-xs cursor-pointer"
              >
                Register Credentials
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Real-time Firebase Firestore Space Footprint Widget */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-5 sm:p-6 space-y-5">
        <div id="firebase-usage-stats-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Database className="w-5.5 h-5.5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                {language === 'TH' ? 'ข้อมูลการใช้พื้นที่จัดเก็บฐานข้อมูล Cloud Firestore' : 'Cloud Firestore Database Metrics'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'TH' ? 'แสดงข้อมูลขนาดพื้นที่แบบเรียลไทม์จำแนกตามประเภทข้อมูลของคลินิก' : 'Real-time database footprint and byte estimates across clinic modules'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] text-emerald-600 font-extrabold uppercase font-mono tracking-wider">
              {language === 'TH' ? 'ซิงก์ข้อมูลสดเรียลไทม์' : 'Live Syncing'}
            </span>
          </div>
        </div>

        {/* Top summary row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 flex flex-col justify-between space-y-2">
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
              {language === 'TH' ? 'พื้นที่ที่ใช้ทั้งหมด (MB/KB)' : 'Total Database Storage'}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-900 tracking-tight leading-none">
                {formatSize(totalBytes)}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                ({totalBytes.toLocaleString()} bytes)
              </span>
            </div>
            <div className="text-[9px] text-slate-400">
              {language === 'TH' ? 'คำนวณจากขนาดเอกสารและเมทาดาต้าหลัก' : 'Approximate JSON physical storage space'}
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 flex flex-col justify-between space-y-2">
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
              {language === 'TH' ? 'จำนวนเอกสารรวมทุกโมดูล' : 'Total System Documents'}
            </div>
            <div className="text-2xl font-black text-slate-800 tracking-tight leading-none">
              {(bookings.length + drugs.length + users.length + logs.length + owingMeds.length).toLocaleString()} <span className="text-xs text-slate-400 font-bold uppercase">Docs</span>
            </div>
            <div className="text-[9px] text-slate-400">
              {language === 'TH' ? 'นับจากจำนวนเรคคอร์ดทั้งหมดบนคลาวด์' : 'Total unique data nodes saved'}
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 flex flex-col justify-between space-y-2">
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
              {language === 'TH' ? 'โควตาฟรีคงเหลือ (Firestore Tier)' : 'Free Tier Utilization'}
            </div>
            <div>
              <div className="text-sm font-extrabold text-emerald-700 block leading-tight">
                {(totalBytes / (1024 * 1024 * 1024) * 100).toFixed(6)}% used
              </div>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                {language === 'TH' ? 'เหลือพื้นที่ฟรีอีก 99.99% (จากโควตา 1 GB)' : '99.99%+ remaining of 1,000,000 KB'}
              </span>
            </div>
            <div className="text-[9px] text-slate-400">
              {language === 'TH' ? 'ความจุฟรีคงไว้สูงโดยรอบระบบ' : 'Daily reads/writes quota independent'}
            </div>
          </div>
        </div>

        {/* Visual progress share allocation */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>{language === 'TH' ? 'สัดส่วนพื้นที่แบ่งตามโมดูล' : 'Space Allocation Mix'}</span>
            <span>{totalBytes > 0 ? '100% Shared' : '0 B'}</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/30">
            {bookingsSize > 0 && <div style={{ width: `${(bookingsSize / (totalBytes || 1)) * 100}%` }} className="bg-blue-500 h-full transition-all" title="Bookings" />}
            {drugsSize > 0 && <div style={{ width: `${(drugsSize / (totalBytes || 1)) * 100}%` }} className="bg-emerald-500 h-full transition-all" title="Drugs" />}
            {usersSize > 0 && <div style={{ width: `${(usersSize / (totalBytes || 1)) * 100}%` }} className="bg-purple-500 h-full transition-all" title="Users" />}
            {owingMedsSize > 0 && <div style={{ width: `${(owingMedsSize / (totalBytes || 1)) * 100}%` }} className="bg-amber-500 h-full transition-all" title="Owings" />}
            {logsSize > 0 && <div style={{ width: `${(logsSize / (totalBytes || 1)) * 100}%` }} className="bg-slate-500 h-full transition-all" title="System Logs" />}
          </div>
        </div>

        {/* Explicit collection grid break-down items */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Bookings */}
          <div className="border border-blue-100 bg-blue-50/20 p-3 rounded-xl space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[10px] uppercase truncate">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>{language === 'TH' ? 'รายการจองยา' : 'Bookings'}</span>
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 leading-tight">
                {formatSize(bookingsSize)}
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                {bookings.length} docs ({(totalBytes > 0 ? (bookingsSize / totalBytes) * 100 : 0).toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Drugs */}
          <div className="border border-emerald-100 bg-emerald-50/20 p-3 rounded-xl space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[10px] uppercase truncate">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{language === 'TH' ? 'เวชภัณฑ์และยา' : 'Drugs'}</span>
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 leading-tight">
                {formatSize(drugsSize)}
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                {drugs.length} docs ({(totalBytes > 0 ? (drugsSize / totalBytes) * 100 : 0).toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Users */}
          <div className="border border-purple-100 bg-purple-50/20 p-3 rounded-xl space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-purple-700 font-bold text-[10px] uppercase truncate">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>{language === 'TH' ? 'การมอบหมายสิทธิ์' : 'Admin Assign Role'}</span>
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 leading-tight">
                {formatSize(usersSize)}
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                {users.length} docs ({(totalBytes > 0 ? (usersSize / totalBytes) * 100 : 0).toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Owings */}
          <div className="border border-amber-100 bg-amber-50/20 p-3 rounded-xl space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[10px] uppercase truncate">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>{language === 'TH' ? 'รายการยาค้างส่ง' : 'Owing Meds'}</span>
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 leading-tight">
                {formatSize(owingMedsSize)}
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                {owingMeds.length} docs ({(totalBytes > 0 ? (owingMedsSize / totalBytes) * 100 : 0).toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="border border-slate-200 bg-slate-50/20 p-3 rounded-xl space-y-1.5 col-span-2 md:col-span-1 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[10px] uppercase truncate">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span>{language === 'TH' ? 'ประวัติระบบ' : 'System Logs'}</span>
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 leading-tight">
                {formatSize(logsSize)}
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                {logs.length} docs ({(totalBytes > 0 ? (logsSize / totalBytes) * 100 : 0).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Registered Staff Card views */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <th className="p-4">Staff Member</th>
                <th className="p-4 font-mono">User ID / Username</th>
                <th className="p-4">Assigned Roles</th>
                <th className="p-4">System Identity Code</th>
                <th className="p-4 text-center">Security Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((staff) => {
                const currentRolesList = staff.roles && staff.roles.length > 0 ? staff.roles : [staff.role];
                return (
                  <tr key={staff.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="p-4 font-bold text-slate-800 text-xs sm:text-sm">
                      {staff.name}
                      {staff.approved === false && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider animate-pulse">
                          Pending Approval
                        </span>
                      )}
                      {staff.id === '585982' && (
                        <span className="ml-2 text-[9px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                          Root Admin
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-600 select-all">{staff.username}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {currentRolesList.map((r) => (
                          <span key={r} className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                            r === 'Admin'
                              ? 'bg-red-550 bg-red-50 text-red-600 border-red-100'
                              : r === 'Pharmacist'
                              ? 'bg-blue-50 text-blue-600 border-blue-100'
                              : r === 'Nurse'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : r === 'Doctor'
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                              : r === 'Pharmacist Assistant'
                              ? 'bg-cyan-50 text-cyan-600 border-cyan-100'
                              : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-[10px] text-slate-400 select-all">{staff.id}</td>
                    <td className="p-4 whitespace-nowrap text-center">
                      {staff.id === '585982' ? (
                        <span className="text-[10px] text-slate-300 font-mono italic">Protected</span>
                      ) : (
                        <div className="flex gap-2 justify-center items-center">
                          {staff.approved === false && (
                            <button
                              type="button"
                              onClick={() => handleApproveUser(staff)}
                              className="px-2.5 py-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-all cursor-pointer uppercase flex items-center gap-1 hover:border-emerald-400 shrink-0"
                            >
                              <Check className="w-3 h-3" />
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(staff)}
                            className="px-2.5 py-1 text-[10px] font-bold text-blue-600 border border-blue-100 hover:bg-blue-50 rounded-md transition-all cursor-pointer uppercase flex items-center gap-1 hover:border-blue-300"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(staff)}
                            className="px-2.5 py-1 text-[10px] font-bold text-red-600 border border-red-100 hover:bg-red-50 rounded-md transition-all cursor-pointer uppercase flex items-center gap-1 hover:border-red-300"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editing Staff Modal Overlay dialog */}
      {editingStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden max-h-[85vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-700">
                  Edit Staff Credentials & Access Control
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  User Account Profile ID: {editingStaff.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-slate-450 hover:text-slate-600 text-sm font-mono p-1 hover:bg-slate-100 rounded-lg cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Staff Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-500 font-semibold">Change Password (Optional)</label>
                  <span className="text-[9px] text-slate-400 font-mono">Leave blank to keep current</span>
                </div>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">
                  Assigned Roles (Multiple Selection Allowed) *
                </label>
                <div className="flex flex-col gap-1.5">
                  {AVAILABLE_ROLES.map((roleObj) => {
                    const isChecked = editRoles.includes(roleObj.id);
                    return (
                      <button
                        key={roleObj.id}
                        type="button"
                        onClick={() => handleToggleEditRole(roleObj.id)}
                        className={`w-full px-3 py-2.5 rounded-lg border text-left text-xs font-bold uppercase transition-all flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                            isChecked ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'bg-slate-50 border-slate-350'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          {roleObj.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editErrorMsg && (
                <p className="text-red-650 text-red-600 font-bold bg-white text-[10px] uppercase p-2.5 rounded border border-red-100">
                  ⚠️ {editErrorMsg}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-xs cursor-pointer"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Staff Deletion Confirmation Tab Modal Dialogue */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-2xl border border-rose-100 shadow-2xl max-w-md w-full flex flex-col overflow-hidden leading-relaxed text-slate-700">
            {/* Header */}
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between text-rose-800">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-600 shrink-0" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider">
                  {language === 'TH' ? 'หน้าต่างยืนยันการถอดถอนผู้ใช้ระบบ' : 'Confirm Security Access Revocation'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="text-rose-450 hover:text-rose-600 font-mono text-sm hover:bg-rose-100/50 px-2 py-1 rounded-md cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs font-sans">
              <div className="bg-rose-50/50 border border-rose-100/50 rounded-xl p-4 space-y-2">
                <div className="text-[10px] text-rose-505 text-rose-500 font-black uppercase tracking-wider">
                  {language === 'TH' ? 'พนักงานที่ได้รับผลกระทบ' : 'Affected Staff Member Profile'}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-rose-100/30 pb-2">
                  <div>
                    <span className="text-slate-400 block text-[9px]">{language === 'TH' ? 'ชื่อเครื่องหลัก' : 'Username / Key'}</span>
                    <strong className="text-slate-800 font-mono text-[12px]">{userToDelete.username}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">{language === 'TH' ? 'ชื่อ-นามสกุล บุคลากร' : 'Staff Member Name'}</span>
                    <strong className="text-slate-800 text-[12px]">{userToDelete.name}</strong>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] mb-1">{language === 'TH' ? 'ระดับสิทธิ์เข้าถึงทั้งหมด' : 'Assigned System Roles'}</span>
                  <div className="flex flex-wrap gap-1">
                    {(userToDelete.roles && userToDelete.roles.length > 0 ? userToDelete.roles : [userToDelete.role]).map((r) => (
                      <span key={r} className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-rose-100/60 text-rose-800 border border-rose-200/50">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-slate-500 space-y-2 leading-relaxed">
                <p className="font-semibold text-rose-700">
                  {language === 'TH' 
                    ? '⚠️ คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้!' 
                    : '⚠️ Warning: This action is permanent and irreversible!'}
                </p>
                <p>
                  {language === 'TH'
                    ? 'บัญชีผู้ใช้นี้จะได้รับการถอดถอนออกจากระบบจัดซื้อและบริหารยา RxNexus ในทันที คีย์ ID สิทธิ์การเข้าถึงทั้งหมดจะถูกล้างออกจากระบบหลัก'
                    : 'All database permissions and credentials associated with this security account will be permanently deprovisioned and expunged from RxNexus registry.'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer"
              >
                {language === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await deleteUser(userToDelete.id);
                  if (res.success) {
                    setUserToDelete(null);
                    spawnAlert(language === 'TH' ? 'ลบบัญชีผู้ใช้งานถาวรเรียบร้อยแล้ว' : 'Staff credential revoked and permanently deleted.', 'success');
                  } else {
                    spawnAlert(res.error || 'Failed to revoke permissions', 'info');
                  }
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-md cursor-pointer hover:shadow-lg"
              >
                {language === 'TH' ? 'ยืนยันลบอย่างถาวร' : 'Confirm Perm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
