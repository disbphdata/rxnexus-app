import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Drug } from '../types';
import { Plus, Trash, Printer, Search, RefreshCw, ChevronDown, X } from 'lucide-react';
import { printElementByNewWindow } from '../utils/print';

interface EstimatedMedication {
  drugId: string;
  drugName: string;
  stockCode: string;
  quantity: number;
  prices: {
    employee: number;
    opd: number;
    ipd: number;
    it: number;
  };
}

export default function PriceEstimation() {
  const { drugs, language, spawnAlert, currentUser } = useApp();

  // Form States
  const [patientName, setPatientName] = useState('');
  const [hn, setHn] = useState('');
  const [regimen, setRegimen] = useState('');
  const [estimationDate] = useState(new Date().toISOString().split('T')[0]);

  // Selected Medications State
  const [selectedMeds, setSelectedMeds] = useState<EstimatedMedication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);
  const [patientType, setPatientType] = useState<'employee' | 'opd' | 'ipd' | 'it'>('opd');

  // Filter only Oncology drugs for this estimator
  const oncologyDrugs = drugs.filter(
    (d) => d.type === 'Oncology' || d.type === 'Onco' || d.name.toLowerCase().includes('onco')
  );

  const filteredDrugs = oncologyDrugs.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.stockCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddDrug = (drug: Drug) => {
    const exists = selectedMeds.find((m) => m.drugId === drug.id);
    if (exists) {
      spawnAlert(
        language === 'TH' ? 'เวชภัณฑ์ยานี้ถูกเลือกไปแล้ว' : 'This drug has already been selected',
        'info'
      );
      return;
    }

    const newMed: EstimatedMedication = {
      drugId: drug.id,
      drugName: drug.name,
      stockCode: drug.stockCode,
      quantity: 1,
      prices: {
        employee: drug.prices?.employee || 0,
        opd: drug.prices?.opd || 0,
        ipd: drug.prices?.ipd || 0,
        it: drug.prices?.it || 0,
      }
    };

    setSelectedMeds([...selectedMeds, newMed]);
    setSearchQuery('');
    setShowDrugDropdown(false);
  };

  const handleRemoveDrug = (drugId: string) => {
    setSelectedMeds(selectedMeds.filter((m) => m.drugId !== drugId));
  };

  const handleQuantityChange = (drugId: string, qty: number) => {
    if (qty < 1) return;
    setSelectedMeds(
      selectedMeds.map((m) => (m.drugId === drugId ? { ...m, quantity: qty } : m))
    );
  };

  const handleReset = () => {
    setPatientName('');
    setHn('');
    setRegimen('');
    setPatientType('opd');
    setSelectedMeds([]);
    setSearchQuery('');
  };

  const handlePrint = () => {
    if (!patientName.trim()) {
      spawnAlert(language === 'TH' ? 'กรุณาระบุชื่อคนไข้ก่อนพิมพ์' : 'Please specify Patient Name before printing', 'error');
      return;
    }
    if (selectedMeds.length === 0) {
      spawnAlert(language === 'TH' ? 'กรุณาเลือกยารักษาอย่างน้อย 1 รายการ' : 'Please select at least 1 drug', 'error');
      return;
    }

    // Call print utility on the hidden print-optimized element
    const success = printElementByNewWindow('onco-estimation-printable-slip', `Price_Estimation_${hn || 'patient'}`);
    if (success) {
      spawnAlert(language === 'TH' ? 'ส่งคำสั่งพิมพ์สำเร็จ' : 'Print job initiated successfully', 'success');
    }
  };

  const totals = useMemo(() => {
    return selectedMeds.reduce(
      (acc, m) => {
        return {
          employee: acc.employee + (m.prices?.employee || 0) * m.quantity,
          opd: acc.opd + (m.prices?.opd || 0) * m.quantity,
          ipd: acc.ipd + (m.prices?.ipd || 0) * m.quantity,
          it: acc.it + (m.prices?.it || 0) * m.quantity,
        };
      },
      { employee: 0, opd: 0, ipd: 0, it: 0 }
    );
  }, [selectedMeds]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Configuration Header Panel */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
                {language === 'TH' ? 'คำนวณประมาณการค่ายาเคมีบำบัด' : 'Oncology Medication Price Estimator'}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {language === 'TH'
                  ? '* สำหรับประเมินและพิมพ์เอกสารมอบคนไข้โดยเฉพาะ (ไม่มีการบันทึกฐานข้อมูล)'
                  : '* For pricing evaluation and instant printing only (no database saving)'}
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {language === 'TH' ? 'ล้างฟอร์ม' : 'Reset Form'}
          </button>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans mb-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1">
              {language === 'TH' ? 'ชื่อ-นามสกุล คนไข้ *' : 'Patient Name *'}
            </label>
            <input
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder={language === 'TH' ? 'ระบุชื่อคนไข้' : 'e.g. John Doe'}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-purple-500/20 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1">
              {language === 'TH' ? 'รหัส HN คนไข้' : 'Patient HN'}
            </label>
            <input
              type="text"
              value={hn}
              onChange={(e) => setHn(e.target.value)}
              placeholder="e.g. 50-XXXXXX"
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-purple-500/20 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1">
              {language === 'TH' ? 'สูตรยาเคมี (Regimen)' : 'Regimen Code'}
            </label>
            <input
              type="text"
              value={regimen}
              onChange={(e) => setRegimen(e.target.value)}
              placeholder="e.g. FOLFOX, GemCarbo"
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs focus:ring-2 focus:ring-purple-500/20 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Privilege Type Button Selection */}
        <div className="border-t border-slate-100 pt-3">
          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-2">
            {language === 'TH' ? 'สิทธิ์การรักษา / ราคายาที่ต้องการประเมิน *' : 'Privilege / Selected Medication Price Rate *'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['employee', 'opd', 'ipd', 'it'] as const).map((type) => {
              const labelMap = {
                employee: 'Employee',
                opd: 'OPD',
                ipd: 'IPD',
                it: 'IT'
              };
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPatientType(type)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase transition-all border text-center cursor-pointer ${
                    patientType === type
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {labelMap[type]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Drug Selection Input Area */}
        <div className="mt-5 relative font-sans">
          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1">
            {language === 'TH' ? 'ค้นหาและเลือกยาเคมีบำบัด Oncology *' : 'Search & Add Oncology Drug *'}
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDrugDropdown(true);
              }}
              onFocus={() => setShowDrugDropdown(true)}
              placeholder={
                language === 'TH'
                  ? 'ค้นหาด้วยชื่อยา หรือรหัสเวชภัณฑ์ยาเคมีบำบัด...'
                  : 'Search oncology med catalog name or Stock Code...'
              }
              className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-xs focus:outline-hidden focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown List */}
          {showDrugDropdown && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 font-sans">
              {filteredDrugs.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  {language === 'TH' ? 'ไม่พบข้อมูลยาเคมีบำบัดในคลัง' : 'No matching oncology drugs found'}
                </div>
              ) : (
                filteredDrugs.map((drug) => {
                  return (
                    <button
                      key={drug.id}
                      type="button"
                      onClick={() => handleAddDrug(drug)}
                      className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block">{drug.name}</span>
                        <span className="text-[9.5px] text-slate-400 font-mono">Code: {drug.stockCode}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-purple-700 block text-xs">
                          ฿{((patientType === 'employee' ? drug.prices?.employee :
                              patientType === 'ipd' ? drug.prices?.ipd :
                              patientType === 'it' ? drug.prices?.it :
                              drug.prices?.opd) || 0).toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Unit Price ({patientType.toUpperCase()})
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected Medications Table for UI Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/65 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider font-sans">
            {language === 'TH' ? 'รายการยาที่ประเมินร่วม' : 'Estimated Drugs List'} ({selectedMeds.length})
          </h3>
          <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded uppercase font-mono">
            {patientType.toUpperCase()} RATE
          </span>
        </div>

        {selectedMeds.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            {language === 'TH'
              ? 'ยังไม่มีการเลือกยา กรุณาพิมพ์ค้นหาด้านบนแล้วเลือกยาเคมีเพื่อคำนวณราคา'
              : 'No drugs selected yet. Use the search input above to add oncology medicines.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                  <th className="p-3">Stock Code</th>
                  <th className="p-3">{language === 'TH' ? 'รายการเวชภัณฑ์ยา Oncology' : 'Oncology Drug Name'}</th>
                  <th className="p-3 text-right">{language === 'TH' ? 'ราคาต่อหน่วย' : 'Unit Price'}</th>
                  <th className="p-3 text-center" style={{ width: '100px' }}>{language === 'TH' ? 'จำนวน' : 'Qty'}</th>
                  <th className="p-3 text-right">{language === 'TH' ? 'ราคารวมทั้งหมด' : 'Total Price'}</th>
                  <th className="p-3 text-center" style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-xs">
                {selectedMeds.map((med) => {
                  const unitPrice = patientType === 'employee' ? med.prices.employee :
                                    patientType === 'ipd' ? med.prices.ipd :
                                    patientType === 'it' ? med.prices.it :
                                    med.prices.opd;
                  return (
                    <tr key={med.drugId} className="hover:bg-slate-55/20 transition-colors">
                      <td className="p-3 font-mono text-[10px] text-slate-500">{med.stockCode}</td>
                      <td className="p-3 font-bold text-slate-800">{med.drugName}</td>
                      <td className="p-3 text-right font-semibold text-slate-600">
                        ฿{unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(med.drugId, med.quantity - 1)}
                            className="w-5 h-5 border border-slate-200 rounded flex items-center justify-center text-xs font-bold hover:bg-slate-100 disabled:opacity-40"
                            disabled={med.quantity <= 1}
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-slate-800">{med.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(med.drugId, med.quantity + 1)}
                            className="w-5 h-5 border border-slate-200 rounded flex items-center justify-center text-xs font-bold hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-right font-black text-slate-800">
                        ฿{(unitPrice * med.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDrug(med.drugId)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Remove drug"
                        >
                          <Trash className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-purple-50/40 border-t-2 border-purple-100 font-bold">
                  <td colSpan={4} className="p-4 text-right text-slate-700 font-extrabold uppercase tracking-wide">
                    {language === 'TH' ? 'ประมาณการค่ารักษารวมสุทธิ (Grand Total Estimated Amount):' : 'Grand Total Estimated Amount:'}
                  </td>
                  <td className="p-4 text-right text-base font-black text-purple-850">
                    ฿{((patientType === 'employee' ? totals.employee :
                        patientType === 'ipd' ? totals.ipd :
                        patientType === 'it' ? totals.it :
                        totals.opd)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Instant Printing CTA bar */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handlePrint}
          className="px-6 py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-sm font-black shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer font-sans"
        >
          <Printer className="w-4 h-4" />
          {language === 'TH' ? 'พิมพ์ใบประมาณการราคายา' : 'Print Price Estimation Slip'}
        </button>
      </div>

      {/* Hidden Print-Optimized Element (Target for printElementByNewWindow) */}
      <div id="onco-estimation-printable-slip" className="hidden">
        <div className="font-sans text-slate-900 leading-normal p-4 space-y-6 max-w-[210mm] mx-auto bg-white border border-slate-100">
          
          {/* Document Header - Refined Layout with Pattaya Logo */}
          <div className="flex justify-between items-center pb-4 border-b-2 border-slate-300">
            <div className="flex items-center gap-3.5">
              <img
                src="https://static.bangkokhospital.com/uploads/2025/08/pattaya.svg"
                alt="Bangkok Hospital Pattaya Logo"
                className="h-12 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
              <div className="border-l border-slate-300 pl-3.5">
                <h2 className="text-base font-black tracking-tight text-blue-900 uppercase">
                  {language === 'TH' ? 'โรงพยาบาลกรุงเทพพัทยา' : 'BANGKOK HOSPITAL PATTAYA'}
                </h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                  {language === 'TH' ? 'ฝ่ายบริการเภสัชกรรม คลินิกเคมีบำบัดและมะเร็งวิทยา' : 'Pharmacy Services Dept — Oncology Therapeutics'}
                </p>
              </div>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-500 space-y-0.5">
              <p>DATE / วันที่: {estimationDate}</p>
              <p className="font-bold text-purple-700 uppercase tracking-wider">{language === 'TH' ? 'เอกสารประเมินราคายาเคมีบำบัด' : 'FOR ESTIMATION ONLY'}</p>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center my-4">
            <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">
              {language === 'TH' ? 'ใบประมาณการราคายาเคมีบำบัดและเวชภัณฑ์' : 'ONCOLOGY MEDICATION PRICE ESTIMATION REPORT'}
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold font-mono mt-1.5 leading-none">
              {language === 'TH' ? 'เอกสารประมาณการค่ายาเพื่อประกอบการตัดสินใจรักษาพยาบาล' : 'OFFICIAL CLINICAL MEDICATION COST VALUATION'}
            </p>
          </div>

          {/* Patient Details Subgrid */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
            <div>
              <span className="text-slate-500 font-bold uppercase text-[10.5px] block">{language === 'TH' ? 'ชื่อคนไข้ (Patient Name)' : 'Patient Name'}:</span>
              <span className="font-bold text-slate-900 text-sm">{patientName || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold uppercase text-[10.5px] block">{language === 'TH' ? 'หมายเลขคนไข้ (HN)' : 'HN Number'}:</span>
              <span className="font-bold font-mono text-slate-900 text-sm">{hn || '-'}</span>
            </div>
            <div className="pt-1">
              <span className="text-slate-500 font-bold uppercase text-[10.5px] block">{language === 'TH' ? 'สูตรเคมีบำบัด (Regimen)' : 'Regimen Code'}:</span>
              <span className="font-bold text-slate-800 text-[13px]">{regimen || '-'}</span>
            </div>
            <div className="pt-1">
              <span className="text-slate-500 font-bold uppercase text-[10.5px] block">{language === 'TH' ? 'สิทธิ์การรักษา' : 'Privilege Rate'}:</span>
              <span className="font-bold text-indigo-700 uppercase text-[13px]">
                {patientType === 'employee' && (language === 'TH' ? 'สิทธิ์พนักงาน (BHP Employee)' : 'BHP Employee')}
                {patientType === 'opd' && (language === 'TH' ? 'สิทธิ์ผู้ป่วยนอก (OPD)' : 'Outpatient (OPD)')}
                {patientType === 'ipd' && (language === 'TH' ? 'สิทธิ์ผู้ป่วยใน (IPD)' : 'Inpatient (IPD)')}
                {patientType === 'it' && (language === 'TH' ? 'สิทธิ์เบิกตรง (IT)' : 'Direct Billing (IT)')}
              </span>
            </div>
          </div>

          {/* Core Estimates Table */}
          <div className="border border-slate-300 rounded-md overflow-hidden">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700 text-[11px] uppercase">
                  <th className="p-2.5 font-mono tracking-wider" style={{ width: '16%' }}>Stock Code</th>
                  <th className="p-2.5" style={{ width: '44%' }}>{language === 'TH' ? 'รายการเวชภัณฑ์ยา Oncology' : 'Oncology Med Item'}</th>
                  <th className="p-2.5 text-right" style={{ width: '15%' }}>{language === 'TH' ? 'ราคาต่อหน่วย' : 'Unit Price'}</th>
                  <th className="p-2.5 text-center" style={{ width: '10%' }}>{language === 'TH' ? 'จำนวน' : 'Qty'}</th>
                  <th className="p-2.5 text-right" style={{ width: '15%' }}>{language === 'TH' ? 'ราคารวม' : 'Subtotal'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedMeds.map((med) => {
                  const unitPrice = patientType === 'employee' ? med.prices.employee :
                                    patientType === 'ipd' ? med.prices.ipd :
                                    patientType === 'it' ? med.prices.it :
                                    med.prices.opd;
                  return (
                    <tr key={med.drugId}>
                      <td className="p-2.5 font-mono text-xs text-slate-600">{med.stockCode}</td>
                      <td className="p-2.5 font-bold text-slate-900">{med.drugName}</td>
                      <td className="p-2.5 text-right font-semibold text-slate-700">
                        ฿{unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-900 text-sm">{med.quantity}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        ฿{(unitPrice * med.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
                {/* Empty rows to make the table look official and structured */}
                {selectedMeds.length < 5 &&
                  Array.from({ length: 5 - selectedMeds.length }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-7">
                      <td className="p-2 font-mono"></td>
                      <td className="p-2"></td>
                      <td className="p-2 text-right"></td>
                      <td className="p-2 text-center"></td>
                      <td className="p-2 text-right"></td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t border-slate-300 font-black text-slate-900">
                  <td colSpan={4} className="p-2.5 text-right uppercase tracking-wider text-xs">
                    {language === 'TH' ? 'ประมาณการราคารวมสุทธิทั้งสิ้น (Grand Total Estimated Cost):' : 'Grand Total Estimated Cost:'}
                  </td>
                  <td className="p-2.5 text-right font-extrabold text-purple-900 text-base">
                    ฿{((patientType === 'employee' ? totals.employee :
                        patientType === 'ipd' ? totals.ipd :
                        patientType === 'it' ? totals.it :
                        totals.opd)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Disclaimers & Signatures */}
          <div className="space-y-4 pt-4">
            <div className="border border-amber-200 bg-amber-50/50 p-3 rounded-lg text-slate-700 text-xs space-y-1">
              <p className="font-extrabold text-amber-800 flex items-center gap-1">
                ⚠️ {language === 'TH' ? 'ข้อตกลงและคำชี้แจงในการประมาณการค่ายา' : 'Terms & Disclaimers of Estimates'}
              </p>
              <p>
                {language === 'TH'
                  ? '1. ราคาดังกล่าวข้างต้นเป็นราคาประเมินและสรุปเฉพาะค่ายาและสารน้ำบำบัดรักษาเท่านั้น ไม่รวมค่าบริการโรงพยาบาล, ค่าอุปกรณ์การแพทย์, ค่าห้องสังเกตการณ์ หรือค่าแล็บรักษาอื่นๆ'
                  : '1. The above pricing is strictly an estimation of oncology medication cost. Hospital diagnostic labs, observation ward services, and clinical supplies are billed separately.'}
              </p>
              <p>
                {language === 'TH'
                  ? '2. ราคาเวชภัณฑ์ยาอาจมีการเปลี่ยนแปลงและผันผวนตามสิทธิ์ และดุลยพินิจร่วมในการบริหารของแพทย์ผู้ให้การรักษาจริงในวันเข้ารับบริการบำบัดจริง'
                  : '2. Clinical drug pricing is highly dynamic and subject to variation based on physician modifications and patient privilege re-evaluations.'}
              </p>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-[11px]">
              <div className="text-center pt-8 border-t border-slate-200/60 max-w-[200px] mx-auto w-full">
                <p className="font-bold text-slate-800">......................................................</p>
                <p className="text-slate-500 font-medium mt-1">({patientName || '......................................................'})</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{language === 'TH' ? 'ผู้ป่วย / ญาติผู้รับทราบราคาประเมิน' : 'Patient / Relative Acknowledgment'}</p>
              </div>

              <div className="text-center pt-8 border-t border-slate-200/60 max-w-[200px] mx-auto w-full">
                <p className="font-bold text-slate-800">......................................................</p>
                <p className="text-slate-500 font-semibold mt-1">({currentUser?.name || 'Pharmacist Operator'})</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{language === 'TH' ? 'เภสัชกรผู้ให้ข้อมูลประมาณการค่ายา' : 'Clinical Pharmacist Operator'}</p>
              </div>
            </div>
          </div>

          {/* Footer branding */}
          <div className="text-center text-[8.5px] text-slate-400 uppercase tracking-widest pt-6 border-t border-slate-100 no-break">
            {language === 'TH' ? 'พิมพ์จากระบบจองและสำรองยาเวชภัณฑ์ RxNexus — โรงพยาบาลกรุงเทพพัทยา' : 'PREPARED VIA RXNEXUS MEDICATION SYSTEM — BANGKOK HOSPITAL PATTAYA'}
          </div>

        </div>
      </div>
    </div>
  );
}
