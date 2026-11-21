import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  ClipboardCheck,
  UserCheck,
  PackageCheck,
  ShieldCheck,
  Layers,
  AlertTriangle
} from 'lucide-react';

type GuideRoleTab = 'overview' | 'nurse' | 'pharmacist' | 'stock' | 'admin';

export default function RoleInstructionTab() {
  const { currentUser, language } = useApp();

  const mapUserRoleToTab = (): GuideRoleTab => {
    switch (currentUser?.role) {
      case 'Nurse':
        return 'nurse';
      case 'Pharmacist':
      case 'Pharmacist Assistant':
        return 'pharmacist';
      case 'Pharmacy Stock Clerk':
        return 'stock';
      case 'Admin':
        return 'admin';
      default:
        return 'overview';
    }
  };

  const [selectedRole, setSelectedRole] = useState<GuideRoleTab>(mapUserRoleToTab);

  useEffect(() => {
    setSelectedRole(mapUserRoleToTab());
  }, [currentUser?.role]);

  const roleTabs: Array<{ id: GuideRoleTab; labelTH: string; labelEN: string; badge: string }> = [
    { id: 'overview', labelTH: 'ภาพรวม 4 ขั้นตอน', labelEN: '4-Step Overview', badge: 'All' },
    { id: 'nurse', labelTH: 'พยาบาล (Nurse)', labelEN: 'Nurse', badge: 'Role 1' },
    { id: 'pharmacist', labelTH: 'เภสัชกร (Pharmacist)', labelEN: 'Pharmacist', badge: 'Role 2' },
    { id: 'stock', labelTH: 'คลังยา (Stock Clerk)', labelEN: 'Stock Clerk', badge: 'Role 3' },
    { id: 'admin', labelTH: 'ผู้ดูแล (Admin)', labelEN: 'Admin', badge: 'Role 4' }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5 font-sans">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {language === 'TH'
                ? 'คู่มือการใช้งานแบบง่าย แยกตามตำแหน่ง (Role Instruction)'
                : 'Simple Role-Based User Instructions'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {language === 'TH'
                ? `แสดงขั้นตอนการทำงานที่เข้าใจง่ายตรงตามสิทธิ์ของคุณ (${currentUser?.role || 'Staff'})`
                : `Quick step-by-step guide tailored to your role (${currentUser?.role || 'Staff'}).`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <a
            href="/RxNexus_Role_Instructions.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{language === 'TH' ? 'เปิดไฟล์ PDF (5 หน้า)' : 'Open PDF Guide'}</span>
          </a>
          <a
            href="/RxNexus_User_Guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{language === 'TH' ? 'คู่มือฉบับเต็ม PDF' : 'Full Manual PDF'}</span>
          </a>
        </div>
      </div>

      {/* Role Selector Pills */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-2 flex flex-wrap gap-1.5">
        {roleTabs.map((tab) => {
          const isActive = selectedRole === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedRole(tab.id)}
              className={`flex-1 min-w-[130px] px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-slate-200'
                }`}
              >
                {tab.badge}
              </span>
              <span>{language === 'TH' ? tab.labelTH : tab.labelEN}</span>
            </button>
          );
        })}
      </div>

      {/* OVERVIEW */}
      {selectedRole === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white rounded-xl p-4 sm:p-5">
            <h3 className="text-base sm:text-lg font-extrabold">
              {language === 'TH' ? 'ภาพรวมการทำงาน 4 ขั้นตอนง่ายๆ ของ RxNexus' : 'RxNexus 4-Step Clinical Workflow'}
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 mt-1">
              {language === 'TH'
                ? 'ทุกแผนกมองเห็นสถานะเดียวกันแบบ Real-time บน Dashboard และบันทึกชื่อผู้ดำเนินการ + เวลาอัตโนมัติทุกขั้นตอน'
                : 'Every role views real-time updates on a shared Dashboard with automatic operator & timestamp logging.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-1.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">1</div>
              <h4 className="font-bold text-sm text-slate-800">จองยา (Booking)</h4>
              <p className="text-xs text-slate-600">พยาบาล / เภสัชกรกรอกข้อมูลและพิมพ์ชื่อยา (Auto-Suggest) → ส่ง Alert ทันที</p>
            </div>
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-1.5">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">2</div>
              <h4 className="font-bold text-sm text-slate-800">ทวนสอบ (Verify Rx)</h4>
              <p className="text-xs text-slate-600">เฉพาะ <strong>เภสัชกร</strong> ซูมดูใบสั่งยาและกด Approve หรือ Reject + Note</p>
            </div>
            <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-1.5">
              <div className="w-7 h-7 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">3</div>
              <h4 className="font-bold text-sm text-slate-800">คลังยืนยัน 2 ขั้น</h4>
              <p className="text-xs text-slate-600">กด <strong>1/2 สั่งซื้อ</strong> → กด <strong>2/2 ของมาถึง</strong> ผ่าน Shortcut Detail + Timestamp</p>
            </div>
            <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-1.5">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">4</div>
              <h4 className="font-bold text-sm text-slate-800">รับยา &amp; ปิดงาน</h4>
              <p className="text-xs text-slate-600">พยาบาลเช็กของถึง / จัดการ Hold-เปลี่ยนวัน / ยืม-คืนยาข้ามคนไข้</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-3">ตำแหน่ง (Role)</th>
                  <th className="p-3">หน้าแรกอัตโนมัติ</th>
                  <th className="p-3">หน้าที่หลัก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="p-3 font-bold text-blue-700">พยาบาล (Nurse)</td>
                  <td className="p-3 font-semibold">ลงทะเบียนจองยา</td>
                  <td className="p-3">จองยา, พิมพ์ใบราคา PDF, แก้ใบจองถูกส่งกลับ, ยืม/คืนยา, แจ้ง Hold/เปลี่ยนวัน</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-emerald-700">เภสัชกร (Pharmacist)</td>
                  <td className="p-3 font-semibold">Dashboard</td>
                  <td className="p-3">ทวนสอบ Verify Rx (ซูมใบสั่ง), จองยาระบุห้องยา, ติดตามยาค้างส่ง, ขอแก้ Stock ยา</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-amber-700">คลังยา (Stock Clerk)</td>
                  <td className="p-3 font-semibold">Dashboard</td>
                  <td className="p-3">กดยืนยัน 1/2 สั่งซื้อ → 2/2 ของถึง (Shortcut Detail + Timestamp), พิมพ์ใบจัดยา A4</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-indigo-700">ผู้ดูแล (Admin)</td>
                  <td className="p-3 font-semibold">Dashboard</td>
                  <td className="p-3">อนุมัติผู้ใช้ใหม่, อนุมัติแก้/ลบยา, ตรวจ Audit Log, สำรองข้อมูล &amp; ล้างรูปเก่า</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NURSE */}
      {selectedRole === 'nurse' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="bg-gradient-to-r from-blue-700 to-sky-600 text-white rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold">Role 1: พยาบาล (Nurse) — จองยาไว · แก้ไข · ยืม/คืนยา · Hold</h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-0.5">Login ด้วยรหัสประจำแผนก → เปิดหน้า "ลงทะเบียนจองยา" ให้อัตโนมัติ</p>
            </div>
            <UserCheck className="w-8 h-8 opacity-80 shrink-0 hidden sm:block" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-blue-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                วิธีจองยาใน 1 นาที (Booking Drug)
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>เลือกประเภท: <strong>ยาทั่วไป</strong> หรือ <strong>ยามะเร็ง (Oncology)</strong></li>
                <li>กรอกข้อมูลจำเป็น: <strong>HN (10 หลัก 02-xx-xxxxxx)</strong>, <strong>ชื่อผู้ป่วย</strong>, <strong>แผนก</strong>, <strong>วันที่ใช้ยา</strong></li>
                <li>ช่องยา: พิมพ์คำค้น (<strong>Auto-Suggest</strong>) แล้วคลิกเลือกตัวยา ไม่ต้องเลื่อน Scroll ยาว</li>
                <li>ใส่ <strong>จำนวน</strong>, เลือกสิทธิราคา (<strong>OPD / IPD / Employee / IT</strong>), ใส่ Note/แนบรูป แล้วกด <strong>บันทึกข้อมูล</strong></li>
              </ul>
            </div>

            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-sky-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-sky-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                ตรวจสถานะ &amp; พิมพ์ใบราคาให้ผู้ป่วย
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>เปิดแท็บ <strong>Dashboard</strong> เพื่อดูสถานะ Real-time ว่าเภสัชตรวจและคลังสั่ง/รับของถึงไหนแล้ว</li>
                <li>กดปุ่ม <strong>PDF</strong> ท้ายแถวรายการเพื่อพิมพ์ใบประเมินราคาให้ผู้ป่วยตรวจสอบได้ทันที</li>
                <li>ดูคิวนัดล่วงหน้าได้ในเมนู <strong>ปฏิทินคิวผู้ป่วย</strong></li>
              </ul>
            </div>

            <div className="border border-rose-200 bg-rose-50/40 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-rose-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-rose-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                เมื่อใบจองถูกส่งกลับ (Verify ไม่ผ่าน)
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>รายการจะขึ้นป้ายสีแดง <strong>Verify ไม่ผ่าน</strong> พร้อมเสียงแจ้งเตือน</li>
                <li>กด <strong>ดูเหตุผล</strong> เพื่ออ่าน Note จากเภสัชกรว่าให้แก้ไขจุดใด</li>
                <li>กดปุ่ม <strong>แก้ไขเพื่อจองใหม่</strong> (ข้อมูลเดิมอยู่ครบ) แก้แล้วบันทึกส่ง <strong>Re-verify Rx</strong> ได้ทันที</li>
              </ul>
            </div>

            <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-amber-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                Hold · เปลี่ยนวัน · ยืม-คืนยา · ค้างส่ง
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li><strong>Hold / เปลี่ยนวัน:</strong> กดปุ่มที่แถวรายการ ใส่เหตุผล+ชื่อพยาบาล เพื่อเตือนคลังชะลอเตรียมยา (ปลดด้วย <strong>Continue</strong>)</li>
                <li><strong>ยืมยาข้ามคนไข้:</strong> เลือกยืมยาในฟอร์มจอง ระบบจับ HN ต้นทางให้และแจ้งให้กด <strong>จองยาคืน HN</strong> เมื่อพร้อมคืน</li>
                <li><strong>ยาค้างส่ง:</strong> เปิดเมนู <strong>รายการยาค้างส่ง</strong> แล้วติ๊กยิง Alert เร่งด่วนไปที่คลังได้</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* PHARMACIST */}
      {selectedRole === 'pharmacist' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold">Role 2: เภสัชกร (Pharmacist) — ทวนสอบ Verify Rx · ซูมใบสั่ง · ยาค้างส่ง</h3>
              <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">มีสิทธิ์เพียงตำแหน่งเดียวในการทวนสอบคำสั่งจองยา (Verify Rx) ก่อนส่งต่อคลังยา</p>
            </div>
            <CheckCircle2 className="w-8 h-8 opacity-80 shrink-0 hidden sm:block" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                ทวนสอบคำสั่งจองยา (Verify Rx / Re-verify)
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>หน้า Dashboard แยกแท็บ <strong>รายการจองยาทั่วไป</strong> และ <strong>Oncology</strong> ชัดเจน (ป้ายสีแดง <strong>รอตรวจสอบ</strong>)</li>
                <li>กดปุ่ม <strong>Verify Rx</strong> (หรือ <strong>Re-verify Rx</strong> หลังผู้จองแก้ส่งกลับมา)</li>
                <li>หมุนลูกกลิ้งเมาส์ <strong>(Mouse Scroll Zoom)</strong> บนรูปใบสั่งยาเพื่อซูมดูรายละเอียดและขนาดยา</li>
                <li>เลือก <strong>ห้องยาจ่ายจริง</strong> (Phar IV / A1 / E3 / E6 / D) และตรวจชื่อเภสัชกรผู้ทวนสอบ</li>
              </ul>
            </div>

            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-teal-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-teal-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                ตัดสินใจ: Approve หรือ Verify ไม่ผ่าน
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li><strong>ถูกต้องครบถ้วน:</strong> กด <strong>Approve</strong> → สถานะเปลี่ยนเป็น <strong>"ยอมรับแล้ว"</strong> (คลังยาจึงจะกดยืนยันสั่งซื้อต่อได้)</li>
                <li><strong>พบจุดผิดพลาด:</strong> กด <strong>Not Approved</strong> → เลือกเหตุผลและ <strong>บังคับใส่ Note</strong> ส่งกลับผู้จองแก้ไขโดยไม่ลบข้อมูล</li>
                <li>ตรวจเคส <strong>Hold / เปลี่ยนวัน</strong> จากแถบแจ้งเตือนบน Dashboard เพื่อชะลอเตรียมยา</li>
              </ul>
            </div>

            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-blue-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                จองยาเองในนามเภสัชกร
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>เปิดเมนู <strong>ลงทะเบียนจองยา</strong> กรอก ชื่อผู้ป่วย, HN, แผนก, ยา Auto-Suggest, จำนวน</li>
                <li>เลือก <strong>ห้องยาที่จองใช้ยา (Pharmacy Location)</strong> ให้ตรงห้องจ่ายจริง (Phar IV / A1 / E3 / E6 / D)</li>
                <li>ใส่ Note และกดพิมพ์ <strong>PDF</strong> ให้ผู้ป่วยตรวจสอบราคายาได้ทันที</li>
              </ul>
            </div>

            <div className="border border-rose-200 bg-rose-50/40 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-rose-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-rose-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                ยาค้างส่ง · อนุมัติยกเลิก · ขอแก้ Stock ยา
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li><strong>รายการยาค้างส่ง:</strong> กรองตามห้องยาที่ดูแล แล้วติ๊กยิง Urgent Alert ตามยาไปคลัง</li>
                <li><strong>คำขอยกเลิกจากวอร์ด:</strong> กด <strong>อนุมัติยกเลิก</strong> หรือ <strong>ปฏิเสธ</strong> ได้ทันทีบนตาราง</li>
                <li><strong>ขอแก้/ลบรายการยา:</strong> เข้าเมนู <strong>คลังข้อมูลยาและราคา</strong> ระบุเหตุผล → ส่งให้ Admin อนุมัติ</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* STOCK CLERK */}
      {selectedRole === 'stock' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold">Role 3: เจ้าหน้าที่คลังยา (Stock Clerk) — กดยืนยัน 2 ขั้นตอน + Shortcut Detail</h3>
              <p className="text-xs sm:text-sm text-amber-100 mt-0.5">ไม่ต้องทวนสอบ Stock ซ้ำ: หลังเภสัชทวนสอบแล้ว กด 1/2 สั่งซื้อ → กด 2/2 ของมาถึง พร้อม Timestamp</p>
            </div>
            <PackageCheck className="w-8 h-8 opacity-80 shrink-0 hidden sm:block" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-indigo-200 bg-indigo-50/45 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-indigo-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                ขั้นที่ 1: กด "ยืนยันการสั่งซื้อ (1/2)"
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>ดูรายการที่เภสัชทวนสอบเสร็จแล้ว (สถานะ <strong>รอยืนยันสั่งซื้อ</strong>)</li>
                <li>เมื่อสั่งซื้อยาจริงแล้ว กดปุ่ม <span className="font-bold text-indigo-700">ยืนยันการสั่งซื้อ (1/2)</span></li>
                <li>หน้าต่าง <strong>Shortcut Detail</strong> จะแสดง ชื่อผู้ป่วย, HN, ห้องยา, รายการยา + Stock Code, ชื่อเภสัช, Note ครบในจอเดียว</li>
                <li>ตรวจชื่อผู้ยืนยัน + ใส่เลข <strong>PO / หมายเหตุ</strong> (ถ้ามี) → กด <strong>ยืนยันการสั่งซื้อจริง (บันทึกเวลา)</strong></li>
                <li>ตารางบันทึกเวลาทันทีเป็น <strong>1. สั่ง: ชื่อ วัน/เวลา</strong></li>
              </ul>
            </div>

            <div className="border border-emerald-200 bg-emerald-50/45 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                ขั้นที่ 2: กด "ยืนยันของมาถึง (2/2)"
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>เมื่อของมาส่งถึงคลังจริง กดปุ่มสีเขียว <span className="font-bold text-emerald-700">ยืนยันของมาถึง (2/2)</span></li>
                <li>หน้าต่าง <strong>Shortcut Detail</strong> จะแสดงประวัติขั้นที่ 1 (ผู้กดสั่งซื้อและเวลาสั่ง) ให้ทวนสอบก่อนรับเข้า</li>
                <li>ตรวจชื่อผู้รับของ + ใส่เลข <strong>Lot / หมายเหตุ</strong> (ถ้ามี) → กด <strong>ยืนยันของมาถึงจริง (บันทึกเวลา)</strong></li>
                <li>สถานะเปลี่ยนเป็น <strong>ของมาถึงแล้ว</strong> พร้อมแสดงเวลาทั้ง <strong>1. สั่ง:</strong> และ <strong>2. ถึง:</strong></li>
              </ul>
            </div>

            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-amber-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                ติดตามยาค้างส่ง &amp; แจ้งเตือน Hold
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li><strong>Hold / เปลี่ยนวัน:</strong> แสดงแถบแจ้งเตือนทันที เพื่อชะลอการจัดเตรียมยา</li>
                <li><strong>แท็บรายการยาค้างส่ง (Owings):</strong> กรองตามห้องยา (Phar IV, A1, E3, E6, D) และติ๊กจบงานเมื่อส่งยาครบ</li>
                <li>นำเมาส์ไปชี้ที่ช่อง <strong>Stock:</strong> เพื่อดูรายละเอียด PO, Lot และเวลาเต็มได้ตลอด</li>
              </ul>
            </div>

            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-sky-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-sky-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                พิมพ์ใบจัดเตรียมยา A4 (Report รายการยา)
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>เข้าเมนู <strong>Report รายการยา</strong> กรองตามวันที่ใช้/วันที่จอง, ช่วงวัน และ <strong>ห้องยา</strong></li>
                <li>พิมพ์เอกสาร A4 (ไม่ตกขอบ): มีทั้งตารางสรุปยอดและตารางแยกรายคนไข้ครบช่อง <strong>☐ ติ๊ก</strong>, <strong>Stock Code</strong> และยอด <strong>Qty</strong></li>
              </ul>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>ลำดับสถานะช่อง Stock:</strong> รอเภสัชทวนสอบ → รอยืนยันสั่งซื้อ (กด 1/2) → ยืนยันสั่งซื้อแล้ว (กด 2/2) → <strong>ของมาถึงแล้ว</strong>
            </span>
          </div>
        </div>
      )}

      {/* ADMIN */}
      {selectedRole === 'admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="bg-gradient-to-r from-indigo-700 to-slate-800 text-white rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold">Role 4: ผู้ดูแลระบบ (Admin) — ผู้ใช้ · อนุมัติคลังยา · Audit Log · ล้างรูปเก่า</h3>
              <p className="text-xs sm:text-sm text-indigo-100 mt-0.5">ควบคุมความปลอดภัย การอนุมัติสิทธิ์ และบริหารพื้นที่ฐานข้อมูลโรงพยาบาล</p>
            </div>
            <ShieldCheck className="w-8 h-8 opacity-80 shrink-0 hidden sm:block" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-indigo-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                อนุมัติผู้ใช้ใหม่ (จัดการข้อมูลเจ้าหน้าที่)
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>ตรวจสอบบัญชีพนักงานสมัครใหม่ในเมนู <strong>จัดการข้อมูลเจ้าหน้าที่</strong></li>
                <li>กำหนดสิทธิ์ Role ให้ถูกต้อง (Nurse / Pharmacist / Stock Clerk / Admin) แล้วกดอนุมัติ</li>
              </ul>
            </div>

            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-indigo-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                อนุมัติแก้ไข / ลบ Stock ยา (REQ-16)
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>เมื่อเภสัชกรส่งคำขอแก้ชื่อ/ราคาหรือขอลบยา จะขึ้น Banner แจ้งเตือนด้านบน</li>
                <li>เปิด <strong>คลังข้อมูลยาและราคา</strong> ตรวจเหตุผลแล้วกด <strong>อนุมัติ</strong> หรือ <strong>ปฏิเสธ</strong></li>
              </ul>
            </div>

            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-sky-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-sky-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                ตรวจบันทึกประวัติระบบ (Audit Trail)
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>ตรวจสอบประวัติย้อนหลังได้ 100%: ผู้จอง, เภสัช Verify, คลังยืนยัน 1/2-2/2 (PO/Lot), Hold และยกเลิก</li>
                <li>เฉพาะ Admin เท่านั้นที่ลบรายการจองยาถาวรจากตารางหลักได้</li>
              </ul>
            </div>

            <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                จัดการฐานข้อมูล &amp; ล้างรูปเก่า (Keep Record)
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>เมนู <strong>จัดการฐานข้อมูล</strong>: ดูพื้นที่ Base64 / Firebase Storage แบบสดๆ</li>
                <li>เลือก <strong>ล้างเฉพาะรูปเก่า (1-3 เดือน)</strong> โดยประวัติการจองและ Audit Log ยังอยู่ครบ หรือย้ายรูปขึ้น Firebase Storage</li>
                <li>Export CSV / JSON รายเดือน และล้างข้อมูลเก่าเกิน 6 เดือน</li>
              </ul>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>แนะนำให้ Export JSON รายเดือนเก็บไว้ในเครื่องก่อนล้างรูปหรือล้างข้อมูลเก่าทุกครั้ง</span>
          </div>
        </div>
      )}
    </div>
  );
}
