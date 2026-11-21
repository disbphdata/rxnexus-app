import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { i18n } from '../lib/i18n';
import { Drug } from '../types';
import { Plus, Trash, Edit2, Check, X, ShieldAlert, ArrowUpDown, Search, ShieldCheck, RotateCcw, ZoomIn, ZoomOut, CheckCircle, Clock, Eye, AlertCircle, FileText } from 'lucide-react';

export default function StockManager() {
  const {
    currentUser,
    drugs,
    bookings,
    language,
    createDrug,
    updateDrug,
    deleteDrug,
    requestDeleteDrug,
    rejectDeleteDrug,
    requestEditDrug,
    approveEditDrug,
    rejectEditDrug,
    stockReverifyOrder,
    spawnAlert
  } = useApp();

  const t = i18n[language];

  const isPharmacistOrAdmin = currentUser?.role === 'Pharmacist' || currentUser?.role === 'Admin';

  // Toggle register new product drawer
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Deletion request states
  const [pendingDeleteDrugId, setPendingDeleteDrugId] = useState<string | null>(null);
  const [deleteReasonText, setDeleteReasonText] = useState('');
  const [adminDeletingDrug, setAdminDeletingDrug] = useState<Drug | null>(null);
  const [adminRejectingDrug, setAdminRejectingDrug] = useState<Drug | null>(null);

  // List Searching & Classification Filters
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listTypeFilter, setListTypeFilter] = useState<'All' | 'General' | 'Oncology'>('All');

  // Stock Order Re-verification States
  const [activeStockTab, setActiveStockTab] = useState<'catalog' | 'reverify'>('catalog');
  const [activeAuditBooking, setActiveAuditBooking] = useState<any | null>(null);
  const [auditNotes, setAuditNotes] = useState('');
  const [auditInspector, setAuditInspector] = useState(currentUser?.name || '');
  const [isAuditRejecting, setIsAuditRejecting] = useState(false);
  const [auditRejectReason, setAuditRejectReason] = useState('');
  const [auditZoom, setAuditZoom] = useState(1);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState<'General' | 'Oncology'>('General');
  const [stockCode, setStockCode] = useState('');
  const [priceEmployee, setPriceEmployee] = useState('');
  const [priceOPD, setPriceOPD] = useState('');
  const [priceIPD, setPriceIPD] = useState('');
  const [priceIT, setPriceIT] = useState('');

  const [formError, setFormError] = useState('');

  // Clear fields helper
  const resetForm = () => {
    setName('');
    setType('General');
    setStockCode('');
    setPriceEmployee('');
    setPriceOPD('');
    setPriceIPD('');
    setPriceIT('');
    setFormError('');
    setShowAddForm(false);
    setEditId(null);
  };

  const handleRegisterDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !stockCode.trim()) {
      setFormError('Drug Name and Stock Code are mandatory parameters!');
      return;
    }

    const prices = {
      employee: parseFloat(priceEmployee) || 0,
      opd: parseFloat(priceOPD) || 0,
      ipd: parseFloat(priceIPD) || 0,
      it: parseFloat(priceIT) || 0
    };

    const payload = {
      name: name.trim(),
      type,
      stockCode: stockCode.toUpperCase().trim(),
      prices
    };

    if (editId) {
      // Editing
      let res;
      if (currentUser?.role === 'Admin') {
        res = await updateDrug(editId, payload);
      } else {
        res = await requestEditDrug(editId, payload);
      }
      if (res.success) {
        resetForm();
      } else {
        setFormError(res.error || 'Server rejected pricing modification');
      }
    } else {
      // Registering new
      const res = await createDrug(payload);
      if (res.success) {
        resetForm();
      } else {
        setFormError(res.error || 'Duplicate stock code or invalid payload parameters');
      }
    }
  };

  const startEdit = (drug: Drug) => {
    setEditId(drug.id);
    setName(drug.name);
    setType(drug.type);
    setStockCode(drug.stockCode);
    setPriceEmployee(String(drug.prices.employee));
    setPriceOPD(String(drug.prices.opd));
    setPriceIPD(String(drug.prices.ipd));
    setPriceIT(String(drug.prices.it));
    setShowAddForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Subsystem Tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl border border-slate-300 w-full sm:w-auto self-start flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setActiveStockTab('catalog')}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
            activeStockTab === 'catalog'
              ? 'bg-white text-slate-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>📦</span>
          <span>{t.stockCatalog}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveStockTab('reverify')}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
            activeStockTab === 'reverify'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{language === 'TH' ? 'ทวนสอบ Order Verify (Stock Re-verify)' : 'Stock Order Re-verification'}</span>
          {bookings.filter(b => !b.cancelStatus?.approved && b.stockVerification?.status !== 'Verified').length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-black">
              {bookings.filter(b => !b.cancelStatus?.approved && b.stockVerification?.status !== 'Verified').length}
            </span>
          )}
        </button>
      </div>

      {activeStockTab === 'catalog' && (
        <div className="space-y-6">
          {/* Stock catalog introductory layout */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            {t.stockCatalog}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Dynamic catalog management for clinical therapeutic rates and standard codes
          </p>
        </div>

        {isPharmacistOrAdmin && !showAddForm && (
          <button
            id="open-register-drug-btn"
            onClick={() => setShowAddForm(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t.addNewDrug}
          </button>
        )}
      </div>

      {/* Admin Deletion Requests Pending Approval Panel */}
      {currentUser?.role === 'Admin' && drugs.some(d => d.deleteRequested) && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-4 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
            <span className="font-extrabold uppercase tracking-wide">{t.deleteRequestTitle}</span>
          </div>
          
          <div className="space-y-3">
            {drugs.filter(d => d.deleteRequested).map(drug => (
              <div key={drug.id} className="bg-white border border-amber-200/80 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs shadow-2xs">
                <div className="space-y-1.5 md:max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{drug.name}</span>
                    <span className="font-mono text-[9.5px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">{drug.stockCode}</span>
                  </div>
                  <div className="text-slate-600">
                    <span className="font-semibold text-slate-500 mr-1">{t.deleteReason}:</span>
                    <span className="text-red-700 font-bold bg-red-50/50 px-2.5 py-0.5 rounded border border-red-100/50">{drug.deleteReason || '-'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>{t.deleteRequestedBy}: <strong className="text-slate-600">{drug.deleteRequestedBy || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>{t.deleteDate}: <strong className="text-slate-600">{drug.deleteRequestedAt ? new Date(drug.deleteRequestedAt).toLocaleString() : 'N/A'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => setAdminDeletingDrug(drug)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase rounded-lg transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t.btnApproveDelete}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await rejectDeleteDrug(drug.id);
                      if (res.success) {
                        spawnAlert(language === 'TH' ? 'ปฏิเสธคำขอลบแล้ว' : 'Deletion request rejected.', 'success');
                      } else {
                        spawnAlert(res.error || 'Failed to reject delete', 'info');
                      }
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t.btnRejectDelete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Edit Requests Pending Approval Panel */}
      {currentUser?.role === 'Admin' && drugs.some(d => d.editRequested) && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-5 space-y-4 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 text-blue-600" />
            <span className="font-extrabold uppercase tracking-wide">{t.editRequestTitle}</span>
          </div>
          
          <div className="space-y-3">
            {drugs.filter(d => d.editRequested).map(drug => {
              const req = drug.editRequest;
              if (!req) return null;
              
              // Helper to check for difference
              const nameDiff = drug.name !== req.name;
              const typeDiff = drug.type !== req.type;
              const empDiff = drug.prices.employee !== req.prices.employee;
              const opdDiff = drug.prices.opd !== req.prices.opd;
              const ipdDiff = drug.prices.ipd !== req.prices.ipd;
              const itDiff = drug.prices.it !== req.prices.it;

              return (
                <div key={drug.id} className="bg-white border border-blue-200/80 p-4 rounded-xl flex flex-col gap-4 text-xs shadow-2xs">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{drug.name}</span>
                        <span className="font-mono text-[9.5px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">{drug.stockCode}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>{t.editRequestedBy}: <strong className="text-slate-600">{drug.editRequestedBy || 'N/A'}</strong></span>
                        <span>•</span>
                        <span>{language === 'TH' ? 'ขอเสนอแก้วันที่' : 'Requested at'}: <strong className="text-slate-600">{drug.editRequestedAt ? new Date(drug.editRequestedAt).toLocaleString() : 'N/A'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await approveEditDrug(drug.id);
                          if (res.success) {
                            spawnAlert(language === 'TH' ? 'อนุมัติการแก้ไขรายการยาสำเร็จ' : 'Drug modification approved successfully!', 'success');
                          } else {
                            spawnAlert(res.error || 'Failed to approve edit', 'info');
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase rounded-lg transition-colors shadow-xs flex items-center gap-1 cursor-pointer font-sans"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t.btnApproveEdit}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await rejectEditDrug(drug.id);
                          if (res.success) {
                            spawnAlert(language === 'TH' ? 'ปฏิเสธการแก้ไขรายการยาแล้ว' : 'Drug modification request rejected.', 'success');
                          } else {
                            spawnAlert(res.error || 'Failed to reject edit', 'info');
                          }
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-sans"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t.btnRejectEdit}
                      </button>
                    </div>
                  </div>

                  {/* Proposed Changes Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-medium">
                    <div className="md:col-span-2 space-y-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Drug Identity</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px]">Name</span>
                          <span className="text-slate-500 line-through block">{drug.name}</span>
                          <span className={`block font-bold ${nameDiff ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}>{req.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">Classification</span>
                          <span className="text-slate-400 line-through block">{drug.type}</span>
                          <span className={`block font-bold ${typeDiff ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}>{req.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pricing Matrix Comparison (Bath - ฿)</div>
                      <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono text-center">
                        <div className="p-1 rounded bg-white">
                          <span className="text-slate-400 block text-[8px] font-sans truncate">Employee</span>
                          <span className="text-slate-400 line-through block font-medium">฿{drug.prices.employee}</span>
                          <span className={`block font-bold ${empDiff ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}>฿{req.prices.employee}</span>
                        </div>
                        <div className="p-1 rounded bg-white">
                          <span className="text-slate-400 block text-[8px] font-sans truncate">OPD</span>
                          <span className="text-slate-400 line-through block font-medium">฿{drug.prices.opd}</span>
                          <span className={`block font-bold ${opdDiff ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}>฿{req.prices.opd}</span>
                        </div>
                        <div className="p-1 rounded bg-white">
                          <span className="text-slate-400 block text-[8px] font-sans truncate">IPD</span>
                          <span className="text-slate-400 line-through block font-medium">฿{drug.prices.ipd}</span>
                          <span className={`block font-bold ${ipdDiff ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}>฿{req.prices.ipd}</span>
                        </div>
                        <div className="p-1 rounded bg-white pb-1">
                          <span className="text-slate-400 block text-[8px] font-sans truncate text-blue-800 font-semibold font-sans">IT RATE</span>
                          <span className="text-slate-400 line-through block font-medium">฿{drug.prices.it}</span>
                          <span className={`block font-bold ${itDiff ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}>฿{req.prices.it}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Reason Prompt Dialog Modal */}
      {pendingDeleteDrugId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{language === 'TH' ? 'ระบุเหตุผลการดำเนินการขอลบยา' : 'Deletion Authorization Request'}</span>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              {t.deleteWarning}
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                {t.deleteReason} *
              </label>
              <textarea
                required
                rows={3}
                value={deleteReasonText}
                onChange={(e) => setDeleteReasonText(e.target.value)}
                placeholder={language === 'TH' ? 'ระบุสาเหตุที่ต้องการลบ เช่น ลิสต์ผิดหมวดหมู่, ยายกเลิกเบิกจ่าย...' : 'Specify why this medicine should be removed...'}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs font-medium focus:outline-hidden focus:border-red-500 focus:bg-white"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteDrugId(null);
                  setDeleteReasonText('');
                }}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!deleteReasonText.trim()) {
                    spawnAlert(t.deleteReasonRequired, 'info');
                    return;
                  }
                  const res = await requestDeleteDrug(pendingDeleteDrugId, deleteReasonText.trim());
                  if (res.success) {
                    setPendingDeleteDrugId(null);
                    setDeleteReasonText('');
                    spawnAlert(language === 'TH' ? 'ส่งคำขอลบยาสำเร็จแล้ว' : 'Deletion authorization request submitted successfully!', 'success');
                  } else {
                    spawnAlert(res.error || 'Failed to submit request', 'info');
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-xs cursor-pointer"
              >
                {language === 'TH' ? 'ส่งคำขอลบยาสำเร็จ' : 'Send Deletion Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Overlay Drawer */}
      {showAddForm && (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
          <div className="flex border-b border-neutral-200 pb-3 mb-4 justify-between items-center">
            <h3 className="font-bold text-sm text-neutral-700">
              {editId ? t.editDrug : t.addNewDrug}
            </h3>
            <button
              id="cancel-drug-btn"
              type="button"
              onClick={resetForm}
              className="text-xs text-neutral-400 hover:text-neutral-500 font-bold p-1 bg-white border border-neutral-200 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleRegisterDrug} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">{t.drugName} *</label>
                <input
                  id="drug-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Aspirin 100mg"
                  className="w-full bg-white border border-neutral-200 px-3 py-2 rounded-xl focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">{t.stockCode} *</label>
                <input
                  id="stock-code-input"
                  type="text"
                  required
                  value={stockCode}
                  onChange={(e) => setStockCode(e.target.value)}
                  placeholder="e.g., GEN098"
                  className="w-full bg-white border border-neutral-200 px-3 py-2 rounded-xl focus:outline-hidden focus:border-emerald-500 font-mono"
                  disabled={!!editId} // Prevent tampering code
                />
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">{t.reportsType} *</label>
                <select
                  id="drug-type-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as 'General' | 'Oncology')}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 rounded-xl focus:outline-hidden"
                >
                  <option value="General">General Category</option>
                  <option value="Oncology">Oncology Category</option>
                </select>
              </div>
            </div>

            {/* Pricing Matrix values */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                {t.unitPrices}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-neutral-200">
                  <span className="block text-neutral-500 mb-1 text-[10px] uppercase font-bold">1. {t.typeEmployee}</span>
                  <input
                    id="price-employee-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={priceEmployee}
                    onChange={(e) => setPriceEmployee(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-neutral-50 border border-neutral-200 px-2 py-1.5 rounded-lg focus:outline-hidden text-right font-mono text-xs font-semibold"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-neutral-200">
                  <span className="block text-neutral-500 mb-1 text-[10px] uppercase font-bold">2. {t.typeOPD}</span>
                  <input
                    id="price-opd-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={priceOPD}
                    onChange={(e) => setPriceOPD(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-neutral-50 border border-neutral-200 px-2 py-1.5 rounded-lg focus:outline-hidden text-right font-mono text-xs font-semibold"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-neutral-200">
                  <span className="block text-neutral-500 mb-1 text-[10px] uppercase font-bold">3. {t.typeIPD}</span>
                  <input
                    id="price-ipd-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={priceIPD}
                    onChange={(e) => setPriceIPD(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-neutral-50 border border-neutral-200 px-2 py-1.5 rounded-lg focus:outline-hidden text-right font-mono text-xs font-semibold"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-neutral-200">
                  <span className="block text-neutral-500 mb-1 text-[10px] uppercase font-bold">4. {t.typeIT}</span>
                  <input
                    id="price-it-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={priceIT}
                    onChange={(e) => setPriceIT(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-neutral-50 border border-neutral-200 px-2 py-1.5 rounded-lg focus:outline-hidden text-right font-mono text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {formError && (
              <p className="text-red-500 font-bold bg-white text-[11px] p-2 rounded-lg border border-red-100 block">
                ⚠️ {formError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-neutral-200 text-neutral-600 rounded-xl font-semibold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                id="submit-drug-btn"
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer"
              >
                {editId ? 'Commit Modifications' : 'Register Medication'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of registered pharmacy lines */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
        {/* Search & Filter Bar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Left: Classification filter */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setListTypeFilter('All')}
              className={`flex-1 sm:flex-none px-4 py-1.5 font-bold text-[11px] uppercase tracking-wider rounded transition-all cursor-pointer ${
                listTypeFilter === 'All'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'TH' ? 'ทั้งหมด' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setListTypeFilter('General')}
              className={`flex-1 sm:flex-none px-4 py-1.5 font-bold text-[11px] uppercase tracking-wider rounded transition-all cursor-pointer ${
                listTypeFilter === 'General'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.modeGeneral}
            </button>
            <button
              type="button"
              onClick={() => setListTypeFilter('Oncology')}
              className={`flex-1 sm:flex-none px-4 py-1.5 font-bold text-[11px] uppercase tracking-wider rounded transition-all cursor-pointer ${
                listTypeFilter === 'Oncology'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.modeOncology}
            </button>
          </div>

          {/* Right: Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder={language === 'TH' ? 'ค้นหารายการเวชภัณฑ์ยา...' : 'Search medicine catalog...'}
              className="w-full bg-white border border-slate-200 pl-10 pr-8 py-2 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 transition-all font-sans font-medium"
            />
            {listSearchQuery && (
              <button
                type="button"
                onClick={() => setListSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <th className="p-4">DRUG NAME</th>
              <th className="p-4">Classification</th>
              <th className="p-4">Stock Code</th>
              <th className="p-4 text-center">Employee Rate</th>
              <th className="p-4 text-center">OPD Rate</th>
              <th className="p-4 text-center">IPD Rate</th>
              <th className="p-4 text-center">IT RATE</th>
              {isPharmacistOrAdmin && <th className="p-4 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(() => {
              const filteredList = drugs.filter((drug) => {
                const q = listSearchQuery.toLowerCase().trim();
                const matchesSearch =
                  !q ||
                  drug.name.toLowerCase().includes(q) ||
                  drug.stockCode.toLowerCase().includes(q) ||
                  drug.id.toLowerCase().includes(q);
                const matchesType = listTypeFilter === 'All' ? true : drug.type === listTypeFilter;
                return matchesSearch && matchesType;
              });

              if (filteredList.length === 0) {
                return (
                  <tr>
                    <td colSpan={isPharmacistOrAdmin ? 8 : 7} className="p-8 text-center text-slate-400 font-medium">
                      {language === 'TH' ? '❌ ไม่พบรายการเวชภัณฑ์ยาที่ตรงตามเงื่อนไข' : '❌ No medicines found matching filter parameters'}
                    </td>
                  </tr>
                );
              }

              return filteredList.map((drug) => (
              <tr key={drug.id} className="hover:bg-neutral-50/40 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="font-bold text-neutral-800 text-xs sm:text-sm block">{drug.name}</span>
                      <span className="text-[10px] text-neutral-400 select-all">{drug.id}</span>
                    </div>
                    {drug.deleteRequested && (
                      <span className="text-[9px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded tracking-wide animate-pulse">
                        {language === 'TH' ? 'รออนุมัติลบ' : 'Pending Delete'}
                      </span>
                    )}
                    {drug.editRequested && (
                      <span className="text-[9px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded tracking-wide animate-pulse">
                        {language === 'TH' ? 'รออนุมัติแก้ไข' : 'Pending Edit'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    drug.type === 'Oncology'
                      ? 'bg-red-50 text-red-600 border border-red-100'
                      : 'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                    {drug.type === 'Oncology' ? t.modeOncology : t.modeGeneral}
                  </span>
                </td>
                <td className="p-4 font-mono font-bold text-slate-600 select-all">{drug.stockCode}</td>
                <td className="p-4 text-center font-mono text-neutral-500 font-medium">฿{(drug.prices.employee || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                <td className="p-4 text-center font-mono text-neutral-500 font-medium">฿{(drug.prices.opd || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                <td className="p-4 text-center font-mono text-neutral-500 font-medium">฿{(drug.prices.ipd || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                <td className="p-4 text-center font-mono font-bold text-blue-800">฿{(drug.prices.it || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                
                {isPharmacistOrAdmin && (
                  <td className="p-4">
                    <div className="flex gap-2 justify-center items-center">
                      <button
                        type="button"
                        onClick={() => !(drug.deleteRequested || drug.editRequested) && startEdit(drug)}
                        disabled={!!drug.deleteRequested || !!drug.editRequested}
                        className={`p-1 px-2.5 border rounded transition-all flex items-center gap-1 uppercase ${
                          drug.deleteRequested || drug.editRequested
                            ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                            : 'hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer font-bold'
                        }`}
                        title={drug.deleteRequested || drug.editRequested ? "Pending Approval" : "Edit pricing catalog matrix"}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span className="text-[9px] tracking-wider">Edit</span>
                      </button>
 
                      <button
                        type="button"
                        onClick={async () => {
                          if (currentUser?.role === 'Admin') {
                            setAdminDeletingDrug(drug);
                          } else {
                            setPendingDeleteDrugId(drug.id);
                            setDeleteReasonText('');
                          }
                        }}
                        disabled={!!drug.deleteRequested || !!drug.editRequested}
                        className={`p-1 rounded transition-colors ${
                          drug.deleteRequested || drug.editRequested
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer'
                        }`}
                        title={drug.deleteRequested || drug.editRequested ? "Pending Approval" : "Delete product item"}
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>

      {/* Admin Custom Delete Confirmation Modal */}
      {adminDeletingDrug && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-scale-up">
            <div className="p-5 bg-red-50 border-b border-red-100/60 flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <Trash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-red-950 uppercase tracking-tight">
                  {language === 'TH' ? 'ยืนยันการลบรายการยาถาวร' : 'Confirm Drug Catalog Delete'}
                </h3>
                <p className="text-[10px] text-red-600 font-medium mt-0.5 font-mono">
                  CODE: {adminDeletingDrug.stockCode}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3 text-xs leading-relaxed text-slate-600 font-sans">
              <p className="font-semibold text-rose-700 text-xs">
                {language === 'TH'
                  ? '⚠️ คำเตือน: การกระทำนี้เป็นการลบข้อมูลอย่างถาวรและไม่สามารถเรียกคืนได้!'
                  : '⚠️ Warning: This action is permanent and cannot be undone!'}
              </p>
              <p>
                {language === 'TH'
                  ? `คุณกำลังจะลบรายการยา "${adminDeletingDrug.name}" ออกจากระบบหลัก การกระทำนี้จะลบราคาทั้งหมดและจะไม่สามารถเลือกยานี้ในการจองครั้งถัดไปได้`
                  : `You are about to permanently purge "${adminDeletingDrug.name}" from the active therapeutic catalog. Future reservations will no longer be able to select this medication code.`}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAdminDeletingDrug(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const drugId = adminDeletingDrug.id;
                  setAdminDeletingDrug(null);
                  const res = await deleteDrug(drugId);
                  if (res.success) {
                    spawnAlert(language === 'TH' ? 'ลบรายการยาเรียบร้อยแล้ว' : 'Drug item deleted permanently from catalog.', 'success');
                  } else {
                    spawnAlert(res.error || 'Failed to delete drug', 'info');
                  }
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
      )}

      {/* Stock Re-verification Queue Subsystem */}
      {activeStockTab === 'reverify' && (
        <div className="space-y-6 animate-fade-in font-sans">
          {/* Re-verify Header */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>{language === 'TH' ? 'Stock - ทวนสอบ Order Verify' : 'Stock Order Re-verification'}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {language === 'TH'
                  ? 'ทวนสอบความถูกต้องของเวชภัณฑ์ยา ยอดสต็อก และส่งข้อมูลกลับไปยังแดชบอร์ดนับเป็นการจองยามาใหม่'
                  : 'Audit inventory fulfillment and re-verify orders to display actively on the clinical dashboard as newly verified.'}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                placeholder={language === 'TH' ? 'ค้นหาชื่อผู้ป่วย, HN, หรือยา...' : 'Search Patient, HN, Drug...'}
                className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:bg-white"
              />
            </div>
          </div>

          {/* Bookings Table for Stock Re-verification */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {(() => {
              const filteredAuditBookings = bookings.filter((b) => {
                if (b.cancelStatus?.approved) return false;
                if (!auditSearchQuery.trim()) return true;
                const q = auditSearchQuery.toLowerCase();
                return (
                  b.patientName.toLowerCase().includes(q) ||
                  b.hn.toLowerCase().includes(q) ||
                  b.medications.some(m => m.drugName.toLowerCase().includes(q) || m.stockCode.toLowerCase().includes(q))
                );
              });

              if (filteredAuditBookings.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <ShieldCheck className="w-12 h-12 mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">
                      {language === 'TH' ? 'ไม่พบรายการที่ต้องทวนสอบในขณะนี้' : 'No orders in re-verification queue'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {language === 'TH' ? 'รายการจองใหม่ทั้งหมดจะแสดงที่นี่เพื่อทวนสอบสต็อก' : 'Active incoming bookings will appear here for stock review.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="p-3.5">HN / Patient Name</th>
                        <th className="p-3.5">Date of Use</th>
                        <th className="p-3.5">Department</th>
                        <th className="p-3.5">Medications</th>
                        <th className="p-3.5 text-center">Pharmacist Status</th>
                        <th className="p-3.5 text-center">Stock Audit Status</th>
                        <th className="p-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredAuditBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5">
                            <span className="font-bold text-slate-900 block text-[13px]">{b.patientName}</span>
                            <span className="font-mono text-blue-700 font-bold text-[10.5px]">HN: {b.hn}</span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-semibold text-slate-800">{b.dateOfUse}</span>
                          </td>
                          <td className="p-3.5 font-medium text-slate-600">{b.department}</td>
                          <td className="p-3.5 max-w-xs">
                            <div className="space-y-1">
                              {b.medications.map((m, mIdx) => (
                                <div key={mIdx} className="flex justify-between text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-150">
                                  <span className="font-medium text-slate-800 truncate max-w-[140px]">{m.drugName}</span>
                                  <span className="font-mono font-bold text-indigo-700">x{m.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {b.pharmacistVerification?.status === 'Verified' ? (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Verified
                              </span>
                            ) : b.pharmacistVerification?.status === 'Rejected' ? (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                ✗ Not Approved
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                ⏳ Pending Rx
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {b.stockVerification?.status === 'Verified' ? (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                                  ✓ Re-verified
                                </span>
                                <span className="block text-[8.5px] text-slate-400 font-mono">
                                  {b.stockVerification.verifiedBy}
                                </span>
                              </div>
                            ) : b.stockVerification?.status === 'Rejected' ? (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                ✗ Stock Issue
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
                                รอทวนสอบ
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAuditBooking(b);
                                setAuditInspector(currentUser?.name || 'Stock Clerk');
                                setAuditNotes(b.stockVerification?.notes || '');
                                setIsAuditRejecting(false);
                                setAuditRejectReason('');
                                setAuditZoom(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer mx-auto ${
                                b.stockVerification?.status === 'Verified'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{language === 'TH' ? 'ทวนสอบ Order' : 'Re-verify'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Side-by-Side Stock Re-verify Modal */}
      {activeAuditBooking && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
            {/* Left: Scan Preview */}
            <div className="flex-1 bg-slate-50 p-5 flex flex-col justify-between border-r border-slate-100 overflow-y-auto max-h-[45vh] md:max-h-none">
              <div className="mb-3 flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {language === 'TH' ? 'ภาพสแกนใบสั่งยา (STOCK AUDIT SCAN)' : 'PRESCRIPTION AUDIT SCAN'}
                </span>
                {activeAuditBooking.prescriptionImage && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs shadow-3xs">
                    <button
                      type="button"
                      onClick={() => setAuditZoom((prev) => Math.max(0.5, prev - 0.25))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono font-bold text-blue-600 min-w-[38px] text-center text-[10px]">
                      {Math.round(auditZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setAuditZoom((prev) => Math.min(4, prev + 0.25))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200/60 p-4 min-h-[250px] overflow-auto">
                {activeAuditBooking.prescriptionImage ? (
                  <img
                    src={activeAuditBooking.prescriptionImage}
                    alt="Prescription"
                    className="max-h-[380px] w-auto object-contain rounded-lg transition-transform duration-150"
                    style={{ transform: `scale(${auditZoom})` }}
                  />
                ) : (
                  <div className="text-center p-8 text-slate-400 space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-500">
                      {language === 'TH' ? 'ไม่มีรูปภาพสแกนใบสั่งยา' : 'No prescription scan uploaded'}
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-3 text-center text-[10px] text-slate-400 font-mono">
                Stock Re-verification Ledger Engine
              </div>
            </div>

            {/* Right: Items Checklist & Actions */}
            <div className="flex-1 p-5 md:p-6 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-none space-y-4">
              <div className="space-y-4">
                <div className="border-b border-slate-150 pb-3">
                  <h3 className="font-extrabold text-sm text-indigo-900 uppercase flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <span>{language === 'TH' ? 'Stock - ทวนสอบ Order Verify' : 'Stock Order Re-verification'}</span>
                  </h3>
                  <p className="text-[10.5px] text-slate-550 mt-1">
                    {language === 'TH'
                      ? 'ทวนสอบความถูกต้องของเวชภัณฑ์ยา ยอดสต็อก และส่งข้อมูลกลับไปยังแดชบอร์ดนับเป็นการจองยามาใหม่'
                      : 'Audit inventory fulfillment and re-verify order to display actively on clinical dashboard.'}
                  </p>
                </div>

                {/* Patient Profile */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Patient</span>
                    <span className="font-bold text-slate-800">{activeAuditBooking.patientName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">HN</span>
                    <span className="font-mono font-bold text-blue-700">{activeAuditBooking.hn}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Date of Use</span>
                    <span className="font-semibold text-slate-700">{activeAuditBooking.dateOfUse}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Department</span>
                    <span className="font-semibold text-slate-700">{activeAuditBooking.department}</span>
                  </div>
                </div>

                {/* Medications List */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-extrabold tracking-wide text-slate-400 block">
                    {language === 'TH' ? 'รายการเวชภัณฑ์ยาที่ต้องทวนสอบ' : 'ITEMS TO RE-VERIFY'}
                  </span>
                  <div className="border border-slate-200/60 rounded-xl overflow-hidden shadow-3xs">
                    <table className="w-full text-left text-[11px] border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-[9.5px] uppercase font-extrabold text-slate-500">
                          <th className="p-2.5">Medication</th>
                          <th className="p-2.5">Stock Code</th>
                          <th className="p-2.5 text-center">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {activeAuditBooking.medications.map((m: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold text-slate-800">{m.drugName}</td>
                            <td className="p-2.5 font-mono text-slate-500">{m.stockCode}</td>
                            <td className="p-2.5 text-center font-bold text-blue-600">{m.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {isAuditRejecting ? (
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl space-y-2">
                    <label className="block text-[10px] font-bold text-rose-800 uppercase">
                      {language === 'TH' ? 'ระบุสาเหตุที่ทวนสอบไม่ผ่าน *' : 'Specify Stock Issue Reason *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={auditRejectReason}
                      onChange={(e) => setAuditRejectReason(e.target.value)}
                      placeholder="เช่น ยาในคลังไม่เพียงพอ / ล็อตยาหมดอายุ"
                      className="w-full bg-white border border-rose-200 p-2 rounded-lg text-xs font-semibold focus:outline-hidden"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] uppercase font-extrabold tracking-wide text-slate-400 mb-1">
                        {language === 'TH' ? 'ผู้ทวนสอบคลังยา *' : 'Stock Reviewer *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={auditInspector}
                        onChange={(e) => setAuditInspector(e.target.value)}
                        placeholder="e.g. Stock Coordinator"
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-extrabold tracking-wide text-slate-400 mb-1">
                        {language === 'TH' ? 'บันทึกทวนสอบคลัง (Lot / Notes)' : 'Lot / Notes'}
                      </label>
                      <input
                        type="text"
                        value={auditNotes}
                        onChange={(e) => setAuditNotes(e.target.value)}
                        placeholder="e.g. Lot 2026-X Verified"
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveAuditBooking(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {language === 'TH' ? 'ปิดหน้าต่าง' : 'Close'}
                </button>

                {isAuditRejecting ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsAuditRejecting(false)}
                      className="px-3 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {language === 'TH' ? 'ย้อนกลับ' : 'Back'}
                    </button>
                    <button
                      type="button"
                      disabled={!auditRejectReason.trim()}
                      onClick={async () => {
                        const res = await stockReverifyOrder(activeAuditBooking.id, false, auditNotes, auditRejectReason);
                        if (res.success) setActiveAuditBooking(null);
                      }}
                      className="px-4.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm active:scale-95"
                    >
                      {language === 'TH' ? 'ยืนยันทวนสอบไม่ผ่าน' : 'Confirm Reject'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsAuditRejecting(true)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-250 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {language === 'TH' ? 'ทวนสอบไม่ผ่าน' : 'Stock Issue'}
                    </button>
                    <button
                      type="button"
                      disabled={!auditInspector.trim()}
                      onClick={async () => {
                        const res = await stockReverifyOrder(activeAuditBooking.id, true, auditNotes);
                        if (res.success) setActiveAuditBooking(null);
                      }}
                      className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 duration-150"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{language === 'TH' ? 'ทวนสอบ Order สำเร็จ (Re-verify)' : 'Confirm Stock Re-verify'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
