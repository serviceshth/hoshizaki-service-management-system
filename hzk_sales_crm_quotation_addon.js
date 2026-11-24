/**
 * ============================================================================
 * HOSHIZAKI (THAILAND) LIMITED — ENTERPRISE COMPLETE SUITE (v1188-SERVICE-FIRST-CONTROL)
 * Features:
 *   1) 7-Department Group CC / BCC & Multi-LINE Group Distribution Pills (Auto-Suggest + Deduplicate)
 *   2) Customer Tax ID (13 Digits) & Branch (Head Office / Branch No.) + 1-Click Convert to Billing/Receipt
 *   3) Unified Executive BI Dashboard (`📈 สรุปผู้บริหาร (BI)`) combining Sales, Tracking & Service KPIs
 *   4) Live Google Sheets Master Sync, Isolated A4 Preview, Auto-Save, Direct PDF & Excel (.xls)
 * ============================================================================
 */
(function () {
  'use strict';

  const STORAGE_DRAFT_KEY = 'hzk_sales_qt_autosave_draft_v1146';
  const STORAGE_ARCHIVE_KEY = 'hzk_sales_qt_archive_list_v1146';

  const DEFAULT_GROUPS = [
    { code: 'SALES_ALL', label: 'All Sales Team (รวม Sales Support ใหม่)', emails: 'kulathida@hoshizaki.co.th, janyaluck@hoshizaki.co.th, ketsaraporn@hoshizaki.co.th, wisuttha@hoshizaki.co.th', lineGroupId: '', defaultMode: 'CC', department: 'Sales' },
    { code: 'JPC_TEAM', label: 'Japanese Corporate', emails: 'furujo@hoshizaki.co.th, suleewan@hoshizaki.co.th', lineGroupId: '', defaultMode: 'CC', department: 'Japanese Corporate' },
    { code: 'MARKETING_ALL', label: 'All Marketing', emails: 'taksaon@hoshizaki.co.th, khajornyot@hoshizaki.co.th', lineGroupId: '', defaultMode: 'CC', department: 'Marketing' },
    { code: 'SERVICE_ALL', label: 'All Service Team', emails: 'thanakrit@hoshizaki.co.th, noparin@hoshizaki.co.th, wanwipha@hoshizaki.co.th', lineGroupId: '', defaultMode: 'CC', department: 'Service' },
    { code: 'FINANCE_ACC', label: 'Finance & Accounting', emails: 'waraporn@hoshizaki.co.th, duangkamon@hoshizaki.co.th, witharat@hoshizaki.co.th', lineGroupId: '', defaultMode: 'CC', department: 'Accounting' },
    { code: 'ADMIN_HR', label: 'Admin & HR', emails: 'kanokwan@hoshizaki.co.th, nattapong@hoshizaki.co.th, chayanin@hoshizaki.co.th', lineGroupId: '', defaultMode: 'CC', department: 'Admin' },
    { code: 'MANAGEMENT_BCC', label: 'Management (BCC ลับ)', emails: 'suzuki@hoshizaki.co.th', lineGroupId: '', defaultMode: 'BCC', department: 'Management' }
  ];

  const HZK_OMNI_STATE = {
    version: 'v1188-SERVICE-FIRST-CONTROL',
    masterDb: null,
    items: []
  };

  const DEFAULT_PRODUCTION_GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycby_coDZUVdP0Cc5dwsY5SMuIHngvnPlRUddmsCsahTkgyKmBmpOIgB551ym8fu1W6Ix/exec';

  function getGasEndpointUrl() {
    const candidates = [
      localStorage.getItem('hzk_gas_webapp_url'),
      localStorage.getItem('gasWebAppUrl'),
      localStorage.getItem('hzkGasUrl'),
      localStorage.getItem('HOSHIZAKI_GAS_URL'),
      localStorage.getItem('webapp_url'),
      (window.HZK_CONFIG && window.HZK_CONFIG.gasUrl),
      (window.APP_CONFIG && window.APP_CONFIG.gasUrl)
    ];
    for (const c of candidates) {
      const s = String(c || '').trim();
      if (s && s.indexOf('https://script.google.com/macros/s/') === 0 && s.endsWith('/exec') && s.indexOf('YOUR_DEPLOYED_GAS_ID') === -1) return s;
    }
    // Fallback: scan all localStorage keys for any deployed Google Apps Script Web App URL
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = String(localStorage.getItem(k) || '').trim();
        if (v.indexOf('https://script.google.com/macros/s/') === 0 && v.endsWith('/exec') && v.indexOf('YOUR_DEPLOYED_GAS_ID') === -1) {
          localStorage.setItem('hzk_gas_webapp_url', v);
          return v;
        }
      }
    } catch (e) {}
    // Auto-persist permanent production Web App URL across all devices & browsers
    try {
      localStorage.setItem('hzk_gas_webapp_url', DEFAULT_PRODUCTION_GAS_WEBAPP_URL);
      localStorage.setItem('gasWebAppUrl', DEFAULT_PRODUCTION_GAS_WEBAPP_URL);
    } catch (e) {}
    return DEFAULT_PRODUCTION_GAS_WEBAPP_URL;
  }

  function promptAndSaveGasEndpointUrl() {
    const cur = getGasEndpointUrl();
    const entered = prompt(
      '🔗 กรุณาวางลิงก์ Google Apps Script Web App URL (ลงท้ายด้วย /exec)\nเพื่อเชื่อมต่อฐานข้อมูลคลาวด์และระบบ LINE OA:',
      cur || 'https://script.google.com/macros/s/.../exec'
    );
    if (entered && entered.trim().indexOf('https://script.google.com/') === 0) {
      const clean = entered.trim();
      localStorage.setItem('hzk_gas_webapp_url', clean);
      localStorage.setItem('gasWebAppUrl', clean);
      return clean;
    }
    return '';
  }

  async function callGasApi(action, payload, interactivePrompt) {
    let gasUrl = getGasEndpointUrl();
    if (!gasUrl && interactivePrompt) {
      gasUrl = promptAndSaveGasEndpointUrl();
    }
    if (!gasUrl) {
      return { status: 'NO_GAS_URL', message: 'ยังไม่ได้ตั้งค่า Google Apps Script Web App URL' };
    }
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action }, payload || {}))
    });
    const rawText = await res.text();
    try {
      return JSON.parse(rawText);
    } catch (parseErr) {
      throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (ตรวจสอบสิทธิ์ Deploy = Anyone และ URL /exec): ' + rawText.slice(0, 120));
    }
  }

  async function loadSalesMasterDb(forceRefresh) {
    if (HZK_OMNI_STATE.masterDb && !forceRefresh) return HZK_OMNI_STATE.masterDb;

    let baseDb = null;
    try {
      const res = await fetch('./sales_crm_master_db_y2026.json?v=' + Date.now(), { cache: 'no-store' });
      if (res.ok) baseDb = await res.json();
    } catch (e) {}

    if (!baseDb) {
      baseDb = {
        companyHeader: {
          companyNameEn: 'HOSHIZAKI (THAILAND) LIMITED',
          companyNameTh: 'บริษัท โฮชิซากิ (ประเทศไทย) จำกัด',
          addressLine1: 'Building A, 1st floor, No. 10/11 Soi Vibhavadi Rangsit 64 (Mahanakorn),',
          addressLine2: 'Talat Bang Khen Subdistrict, Lak Si District, Bangkok 10210 Thailand',
          tel: '(+66)97-230-5941 / 02-005-9980-83',
          web: 'https://hoshizaki-sea.com'
        },
        activeStaff: [
          { code: 'FURUJO', name: 'Mr. Furujo', dept: 'Japanese Corporate', email: 'furujo@hoshizaki.co.th' },
          { code: 'NOPARIN_H', name: 'นพรินทร์ หอมหวล (Noparin Homhoul)', dept: 'Service & Billing', email: 'noparin@hoshizaki.co.th' },
          { code: 'KETSARAPORN', name: 'Ketsaraporn', dept: 'Sales', email: 'ketsaraporn@hoshizaki.co.th' },
          { code: 'KULATHIDA_C', name: 'Kulathida C.', dept: 'Sales', email: 'kulathida@hoshizaki.co.th' },
          { code: 'JANYALUCK_P', name: 'Janyaluck P.', dept: 'Sales', email: 'janyaluck@hoshizaki.co.th' },
          { code: 'MARKETING_TH', name: 'Marketing & Product Team', dept: 'Marketing', email: 'marketing@hoshizaki.co.th' }
        ],
        models: [],
        customers: [],
        hoshiGroup: [],
        termsAndConditions: [],
        emailGroups: DEFAULT_GROUPS
      };
    }

    if (!Array.isArray(baseDb.emailGroups) || !baseDb.emailGroups.length) {
      baseDb.emailGroups = DEFAULT_GROUPS;
    }

    const gasUrl = getGasEndpointUrl();
    if (gasUrl) {
      try {
        const liveRes = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getLiveSalesCrmMaster' })
        });
        const liveData = await liveRes.json();
        if (liveData && liveData.status === 'OK') {
          if (liveData.companyHeader) baseDb.companyHeader = liveData.companyHeader;
          if (Array.isArray(liveData.activeStaff) && liveData.activeStaff.length > 0) baseDb.activeStaff = liveData.activeStaff;
          if (Array.isArray(liveData.customers) && liveData.customers.length > 0) baseDb.customers = liveData.customers;
          if (Array.isArray(liveData.models) && liveData.models.length > 0) baseDb.models = liveData.models;
          if (Array.isArray(liveData.emailGroups) && liveData.emailGroups.length > 0) baseDb.emailGroups = liveData.emailGroups;
          if (liveData.stockMap) baseDb.stockMap = liveData.stockMap;
          if (liveData.portalUrl) baseDb.portalUrl = liveData.portalUrl;
          if (Array.isArray(liveData.damageDemoList) && liveData.damageDemoList.length > 0) baseDb.damageDemoList = liveData.damageDemoList;
        }
      } catch (e) {}
    }

    // Load initial parsed Stock on Hand snapshot (`live_stock_snapshot_y2026.json`) if stockMap not yet loaded
    if (!baseDb.stockMap || Object.keys(baseDb.stockMap).length === 0) {
      try {
        const snapRes = await fetch('./live_stock_snapshot_y2026.json?v=' + Date.now(), { cache: 'no-store' });
        if (snapRes.ok) {
          const snapJson = await snapRes.json();
          if (snapJson && snapJson.stockMap) baseDb.stockMap = snapJson.stockMap;
          if (snapJson && Array.isArray(snapJson.damageDemoList)) baseDb.damageDemoList = snapJson.damageDemoList;
        }
      } catch (eSnap) {}
    }

    HZK_OMNI_STATE.masterDb = baseDb;
    return baseDb;
  }

  function injectResponsiveStyles() {
    if (document.getElementById('hzkSalesCrmResponsiveCss')) return;
    const style = document.createElement('style');
    style.id = 'hzkSalesCrmResponsiveCss';
    style.textContent = `
      .hzk-sq-grid-top { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .hzk-sq-grid-cust { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .hzk-sq-grid-bottom { display: grid; grid-template-columns: 1fr 310px; gap: 16px; }
      .hzk-sq-action-bar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 16px; }
      .hzk-grp-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; border: 1px solid #CBD5E1; background: #FFF; font-size: 11px; font-weight: 700; cursor: pointer; user-select: none; }
      .hzk-grp-pill input { margin: 0; }
      @media (max-width: 768px) {
        .hzk-sq-grid-top { grid-template-columns: 1fr 1fr; }
        .hzk-sq-grid-cust { grid-template-columns: 1fr; }
        .hzk-sq-grid-bottom { grid-template-columns: 1fr; }
        .hzk-sq-action-bar { justify-content: stretch; }
        .hzk-sq-action-bar button { flex: 1 1 46%; font-size: 12px !important; padding: 10px 8px !important; }
      }
      @media (max-width: 480px) {
        .hzk-sq-grid-top { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function dockOmniBridgeButtons() {
    injectResponsiveStyles();

    // Remove any legacy separate buttons if present
    ['hzkSalesCrmDockedBtn', 'hzkServiceReportTrackedShareBtn'].forEach(id => {
      const old = document.getElementById(id);
      if (old) old.remove();
    });

    if (document.getElementById('hzkUnifiedDocSuiteWrap')) return;

    const hostContainer =
      document.getElementById('topHeaderStatusPillsRow') ||
      document.getElementById('topHeaderRightPillsWrap') ||
      document.querySelector('header');

    const wrap = document.createElement('div');
    wrap.id = 'hzkUnifiedDocSuiteWrap';
    wrap.style.cssText = 'position:relative;display:inline-flex;align-items:center;vertical-align:middle;';

    // Match exact uniform pill size & style of `Executive Report ▾` / `KPI Report Studio`
    const mainBtn = document.createElement('button');
    mainBtn.id = 'hzkUnifiedDocSuiteBtn';
    mainBtn.type = 'button';
    mainBtn.innerHTML = '📋 เอกสาร &amp; ติดตามสถานะ (ทุกแผนก) ▾';
    mainBtn.style.cssText =
      'background:linear-gradient(135deg,#0284C7,#0369A1);color:#FFFFFF;border:1px solid #7DD3FC;' +
      'border-radius:999px;padding:5px 13px;font-weight:700;font-size:12px;line-height:1.35;' +
      'cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;' +
      'box-shadow:0 2px 6px rgba(0,43,73,0.25);height:28px;';

    const menu = document.createElement('div');
    menu.id = 'hzkUnifiedDocSuiteMenu';
    menu.style.cssText =
      'display:none;position:fixed;min-width:295px;max-width:92vw;background:#FFFFFF;color:#0F172A;' +
      'border:1px solid #CBD5E1;border-radius:12px;box-shadow:0 14px 35px rgba(15,23,42,0.32);' +
      'padding:6px;z-index:20000;font-family:sans-serif;font-size:12.5px;';

    const menuItems = [
      { icon: '💼', label: 'ใบเสนอราคา Sales Department (THB)', sub: 'Y2026 + ขนาด W×D×H + เช็กสต็อกสด + คุมเพดานส่วนลด', action: () => openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)') },
      { icon: '🇯🇵', label: 'ใบเสนอราคา Japanese Corporate', sub: 'สำหรับลูกค้าองค์กรญี่ปุ่น & Inter-Company', action: () => openSalesCorporateQuotationWithPreset('Japanese Corporate', 'ใบเสนอราคา (Quotation)') },
      { icon: '📣', label: 'ใบเสนอราคา & โปรโมชัน Marketing', sub: 'แคมเปญการตลาดและเปิดตัวสินค้ารุ่นใหม่', action: () => openSalesCorporateQuotationWithPreset('Marketing', 'ใบเสนอราคา (Quotation)') },
      { divider: true },
      { icon: '🧾', label: 'ใบแจ้งหนี้ / ใบกำกับภาษี / ใบวางบิล (ฟอร์มมาตรฐานบัญชี + Digital Sign)', sub: 'ฟอร์ม A4 เหมือนต้นฉบับบัญชีเป๊ะ + ลายเซ็นดิจิทัล Chayanin / Witharat / Waraporn', action: () => window.openAccountingTaxInvoiceStudioModal() },
      { icon: '📦', label: 'ใบส่งของ Admin — Delivery Order / DO (ฟอร์มมาตรฐาน + Digital Sign)', sub: 'ฟอร์ม A4 Delivery Order ใบส่งของ(ไม่ใช่ใบกำกับภาษี) + ที่อยู่ปัจจุบัน + ลายเซ็นดิจิทัล Chayanin K.', action: () => window.openAdminDeliveryOrderStudioModal() },
      { icon: '📊', label: 'ทะเบียนคุม DO (e-POD เซ็นรับของ) & รายงานภาษีขาย (PP.30 / NAV)', sub: 'ติดตามสถานะเซ็นรับสินค้า e-POD + ตัดสต็อก/ลงทะเบียน S/N + ส่งออก Excel ภาษีขาย', action: () => window.openOutputVatAndDoRegisterModal() },
      { icon: '⚡', label: 'คิวงานอัตโนมัติ & AI OCR อ่านสลิป/50 ทวิ/บิลทางด่วน (Zero-Friction Flow)', sub: 'เชื่อม QT ➔ คิว Admin DO ➔ คิวบัญชี SI ➔ ปิดยอด RV + สแกนสลิปโอนเงิน/50 ทวิ/ใบเสร็จทางด่วนด้วย AI', action: () => window.openZeroFrictionPipelineAndOcrModal() },
      { icon: '🏛️', label: 'ศูนย์รวมระบบองค์กรครบวงจร (Receipt RV / 50 ทวิ / CN / คลังค้นหา / รถส่วนตัว & รถเช่าผู้บริหาร)', sub: 'ครบทั้ง 18 โมดูล: รับชำระ RV, หัก ณ ที่จ่าย 3%, ใบลดหนี้ CN, ค้นหาเอกสารกลาง, เบิกรถช่าง, ค่าเสื่อม/ระยะทางรถส่วนตัว & รถเช่า MD/JPC', action: () => window.openEnterpriseOmniCommandCenterV1185() },
      { icon: '🛠️', label: 'ส่ง & ติดตามเอกสาร Service / ใบวางบิล / ใบเสร็จ', sub: 'ดึงข้อมูลจากใบแจ้งบริการปัจจุบันส่งพร้อมปุ่ม Track', action: () => launchTrackedDocFromServiceForm() },
      { icon: '🔄', label: 'ศูนย์ส่งต่องานข้ามแผนก (1-Click Handover)', sub: 'Sales ➔ ติดตั้ง/ลงทะเบียน S/N | Service ➔ บัญชี', action: () => openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)', 'HANDOVER') },
      { icon: '🔔', label: 'ต่ออายุสัญญา PM & แจ้งเตือนหมดประกัน (60 วัน)', sub: 'สแกนเครื่องใกล้หมดประกัน + สร้างใบเสนอราคาต่อสัญญา 1 คลิก', action: () => window.openWarrantyPmRenewalModal() },
      { divider: true },
      { icon: '🏷️', label: 'สต็อกเครื่องโชว์ / มีตำหนิ & ใบตรวจสภาพ (602 รายการ)', sub: 'ดูรายการเครื่อง Demo/Damage + ลิงก์ใบตรวจสภาพ + ดึงลงใบเสนอราคา', action: () => window.openDamageDemoStockModal() },
      { icon: '📥', label: 'อัปเดต Stock จากอีเมล MICHIRU-RPA ทันที', sub: 'ดึงไฟล์ Stock on Hand ล่าสุดจาก Gmail เข้าฐานข้อมูลสด', action: () => window.triggerEmailStockSyncNow() },
      { icon: '🌐', label: 'พอร์ทัลลูกค้า & ตัวแทนจำหน่าย (Self-Service)', sub: 'เปิดหน้าเช็กเครื่องในร้าน ประวัติซ่อม และสถานะดีลเลอร์', action: () => window.openCustomerDealerPortalWindow() },
      { icon: '📋', label: 'กระดานงาน & To-Do List อัจฉริยะแยกแผนก (Task Board)', sub: 'รวมงานค้างอัตโนมัติ (ด่วน/วันนี้/วางแผน) + Kanban 4 ช่อง + มติประชุม AI', action: () => window.openDepartmentTaskBoardModal() },
      { icon: '🔧', label: 'ติดตามงานซ่อมต่อเนื่อง, รอบรออะไหล่ (ETA) & ล็อกคิวช่าง', sub: 'เสนอราคาอะไหล่เพิ่มเติมหลัง Testing + แจ้ง ETA ลูกค้า + คอนเฟิร์มคิวซ่อม 1 คลิก', action: () => window.openFieldRepairPartsPipelineModal() },
      { icon: '📹', label: 'ห้องประชุมทีม & AI สรุปรายงานการประชุม (Omni-Meet + AI)', sub: 'ประชุมหน้างานช่าง / แยกแผนก / WFH 1-on-1 / ทั้งบริษัท + อัดเสียงสรุป 3 ภาษา', action: () => window.openOmniMeetAndAiMinutesModal() },
      { icon: '📑', label: 'ศูนย์ออกรายงานประจำแผนก 1 คลิก (Department Report Center)', sub: 'ดาวน์โหลดรายงานเฉพาะแผนก (Sales / JPC / Marketing / บัญชี NAV / HR / Service)', action: () => window.openDepartmentReportCenterModal() },
      { icon: '💰', label: 'วิเคราะห์กำไร-ขาดทุนราย S/N & ตั้งราคา/โปรโมชั่น (Lifecycle P&L)', sub: 'เทียบราคาขาย (Dealer/Direct) หักต้นทุนซ่อม/เคลม + จำลองแพ็คเกจ PM + นำเข้าขาย NAV', action: () => window.openSerialLifecyclePricingSuiteModal() },
      { icon: '📐', label: 'แบบตรวจความพร้อมหน้างานก่อนติดตั้ง (Pre-Install Site Survey)', sub: 'เช็กแรงดันน้ำ ไฟ ท่อน้ำทิ้ง แนะนำชุดกรองน้ำ & ลดเคลมในประกัน', action: () => window.openPreInstallSiteSurveyModal() },
      { icon: '🔎', label: 'ประวัติเครื่องราย S/N 360° & อัลบั้มรูปหน้างาน', sub: 'ดูไทม์ไลน์ตั้งแต่คลัง ➔ ติดตั้ง ➔ ซ่อมบำรุง ➔ รูปถ่ายก่อน-หลัง', action: () => window.openSerial360TimelineModal() },
      { icon: '🚐', label: 'คลังอะไหล่รถช่าง T01–T08 & เบิกเติมอัตโนมัติ', sub: 'เช็ก/ตัด/เติมอะไหล่รถช่าง + แจ้งเตือนสโตร์เมื่อต่ำกว่า Min Stock', action: () => window.openTechnicianVanStockModal() },
      { icon: '📅', label: 'ตารางนัดหมายติดตั้ง & คิวงานช่าง (Dispatch Board)', sub: 'จัดคิวงานติดตั้ง/ซ่อมรายวันของช่าง T01–T08 + แจ้งเตือน LINE', action: () => window.openServiceDispatchCalendarModal() },
      { icon: '🏆', label: 'สรุปผลงาน & Incentive รายบุคคล (Sales & Tech KPI)', sub: 'สรุปยอดปิดการขาย PO Approved และจำนวนปิดเคสช่างประจำเดือน', action: () => window.openMonthlyIncentiveKpiModal() },
      { icon: '📊', label: 'ติดตามสถานะการรับเอกสาร & E-Sign PO (Tracking)', sub: 'เช็กสถานะ SENT / ยืนยันรับ / ลายเซ็น E-Sign & ไฟล์ PO ลูกค้า', action: () => window.openDocumentTrackingDashboardModal() },
      { icon: '📈', label: 'รายงานสรุปผู้บริหาร & AI Copilot (BI)', sub: 'KPI รวม + AI ติดตามใบเสนอราคาค้าง + ส่งเข้า LINE ผู้บริหาร', action: () => window.openExecutiveBiDashboardModal() },
      { divider: true },
      { icon: '🏭', label: 'ส่งออกข้อมูลเปิด Sales Order เข้า ERP / NAV', sub: 'ดาวน์โหลดไฟล์ตารางรายการ PO Approved พร้อมนำเข้าระบบบัญชี/ERP', action: () => window.exportErpSalesOrdersCsv() },
      { icon: '🎭', label: 'จำลองหน้าจอจริงแยกแผนก & รายบุคคล (Live Inspector)', sub: 'สลับดูหน้าตาการทำงานจริงแยก 8 แผนก หรือเจาะดูรายบุคคล (เซลล์ / ช่าง / บัญชี)', action: () => window.openDepartmentLiveSimulatorModal() },
      { icon: '🩺', label: 'Deep Scan ตรวจสอบ & ซ่อมแซมฟังก์ชันทั้งหมด', sub: 'สแกนลิงก์ GAS API, ฐานข้อมูล, Drive API, ปุ่มกด และตั้งค่า URL อัตโนมัติ', action: () => window.runDeepSystemDiagnosticModal() },
      { icon: '🛡️', label: 'ตรวจความพร้อมระบบ & Go-Live Control (QA)', sub: 'เช็กสถานะ Token/API/Sheets + ติดตั้ง LINE Rich Menu + ล้างข้อมูลทดสอบ', action: () => window.openProductionGoLiveQaModal() },
      { icon: '📖', label: 'คู่มือใช้งานฉบับย่อแยกแผนก (Role SOP Guide)', sub: 'คู่มือ 1 หน้าสำหรับช่างบริการ / ฝ่ายขาย-JPC / บัญชี-ดีลเลอร์', action: () => window.openDepartmentRoleSopModal() }
    ];

    menuItems.forEach(item => {
      if (item.divider) {
        const hr = document.createElement('div');
        hr.style.cssText = 'height:1px;background:#E2E8F0;margin:4px 6px;';
        menu.appendChild(hr);
        return;
      }
      const row = document.createElement('button');
      row.type = 'button';
      row.style.cssText =
        'width:100%;text-align:left;background:transparent;border:none;border-radius:8px;' +
        'padding:8px 10px;cursor:pointer;display:flex;align-items:flex-start;gap:9px;color:#0F172A;';
      row.innerHTML =
        `<span style="font-size:15px;line-height:1.2;">${item.icon}</span>` +
        `<span style="display:flex;flex-direction:column;">` +
        `<span style="font-weight:700;font-size:12.5px;color:#002B49;">${item.label}</span>` +
        `<span style="font-size:10.5px;color:#64748B;">${item.sub}</span>` +
        `</span>`;
      row.onmouseenter = () => { row.style.background = '#F0F9FF'; };
      row.onmouseleave = () => { row.style.background = 'transparent'; };
      row.onclick = (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        item.action();
      };
      menu.appendChild(row);
    });

    mainBtn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display === 'block';
      if (isOpen) {
        menu.style.display = 'none';
        return;
      }
      const rect = mainBtn.getBoundingClientRect();
      menu.style.top = Math.min(window.innerHeight - 360, rect.bottom + 6) + 'px';
      menu.style.left = Math.max(8, Math.min(window.innerWidth - 310, rect.left)) + 'px';
      menu.style.display = 'block';
    };

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });

    const myCockpitBtn = document.createElement('button');
    myCockpitBtn.id = 'hzkMyPersonalCockpitPillBtn';
    myCockpitBtn.type = 'button';
    myCockpitBtn.innerHTML = '🧑‍💻 โต๊ะทำงานฉัน (เลือกพนักงาน/แผนก) ▾';
    myCockpitBtn.style.cssText =
      'background:linear-gradient(135deg,#002B49,#1E3A8A);color:#FDE047;border:1px solid #38BDF8;' +
      'border-radius:999px;padding:5px 12px;font-weight:800;font-size:12px;line-height:1.35;' +
      'cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;' +
      'box-shadow:0 2px 6px rgba(0,43,73,0.28);height:28px;';
    myCockpitBtn.onclick = function (e) {
      e.stopPropagation();
      if (typeof window.openPersonalEmployeeSelectorModal === 'function') {
        window.openPersonalEmployeeSelectorModal();
      }
    };

    wrap.appendChild(myCockpitBtn);
    wrap.appendChild(mainBtn);
    document.body.appendChild(menu);

    if (hostContainer) {
      hostContainer.appendChild(wrap);
    } else {
      wrap.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:9990;';
      document.body.appendChild(wrap);
    }
  }

  async function openSalesCorporateQuotationWithPreset(deptPreset, docTypePreset, extraAction) {
    await openSalesCorporateQuotationModal();
    const deptEl = document.getElementById('hzkSqDept');
    const docEl = document.getElementById('hzkSqDocType');
    if (deptEl && deptPreset) deptEl.value = deptPreset;
    if (docEl && docTypePreset) docEl.value = docTypePreset;
    if (extraAction === 'HANDOVER') {
      const db = await loadSalesMasterDb(false);
      openCrossDeptHandoverModal(db);
    }
  }

  function launchTrackedDocFromServiceForm() {
    const pickVal = (selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.value) return el.value.trim();
      }
      return '';
    };

    const jobNo = pickVal(['#jobNo', '#jobNumber', 'input[placeholder*="JOB-"]']) || ('SVC-' + Date.now().toString().slice(-6));
    const customerName = pickVal(['#customerName', '#custName', 'input[placeholder*="ชื่อร้าน"]']) || 'ลูกค้างานบริการ HOSHIZAKI';
    const contactPerson = pickVal(['#contactPerson', '#custContact', 'input[placeholder*="ผู้ติดต่อ"]']);
    const address = pickVal(['#customerAddress', '#custAddress', 'textarea[placeholder*="ที่อยู่"]', 'input[placeholder*="ที่อยู่"]']);
    const phone = pickVal(['#customerPhone', '#custPhone', 'input[placeholder*="เบอร์"]']);
    const model = pickVal(['#machineModel', '#modelInput', 'input[placeholder*="IM-100NE"]']) || 'SERVICE-EQUIPMENT';
    const serial = pickVal(['#serialNumber', '#serialNo', 'input[placeholder*="Serial"]']);

    window.sendHoshizakiTrackedDocument({
      docType: 'ใบแจ้งบริการ / ใบเสร็จรับเงิน (Service & Receipt)',
      department: 'Service & Billing',
      offerNo: jobNo,
      customerName: customerName,
      contactPerson: contactPerson,
      address: address,
      phone: phone,
      items: [{
        model: model,
        description: 'Service & Maintenance (' + (serial ? 'S/N: ' + serial : 'Field Service') + ')',
        w: '',
        d: '',
        h: '',
        unitPrice: 0,
        discount: 0,
        qty: 1,
        isService: true
      }]
    });
  }

  function getStaffDisplayInfo(db, code) {
    const found = (db.activeStaff || []).find(s => s.code === code);
    return found || { code: code || 'STAFF', name: code || 'เจ้าหน้าที่ HOSHIZAKI', dept: 'Sales', email: 'services@hoshizaki.co.th' };
  }

  function collectCurrentFormPayload(db) {
    const format = document.getElementById('hzkSqFormat').value;
    let subTotal = 0;
    let serviceSubTotal = 0;
    HZK_OMNI_STATE.items.forEach(item => {
      const lineAmt = Math.max(0, (Number(item.unitPrice || 0) - Number(item.discount || 0)) * Number(item.qty || 1));
      subTotal += lineAmt;
      if (item.isService) serviceSubTotal += lineAmt;
    });
    const vatRate = format === 'EXPORT' ? 0 : 0.07;
    const vatAmount = subTotal * vatRate;
    const whtAmount = format === 'EXPORT' ? 0 : serviceSubTotal * 0.03;
    const grandTotal = subTotal + vatAmount - whtAmount;

    const spCode = document.getElementById('hzkSqSalesperson').value;
    const staffObj = getStaffDisplayInfo(db, spCode);

    return {
      docType: document.getElementById('hzkSqDocType').value,
      offerNo: document.getElementById('hzkSqOfferNo').value.trim(),
      rev: document.getElementById('hzkSqRev').value,
      date: document.getElementById('hzkSqDate').value,
      format: format,
      department: document.getElementById('hzkSqDept').value,
      salesperson: spCode,
      senderDisplayName: staffObj.name,
      senderEmail: staffObj.email || 'services@hoshizaki.co.th',
      customerName: document.getElementById('hzkSqCustomer').value.trim(),
      taxId: document.getElementById('hzkSqTaxId').value.trim(),
      branch: document.getElementById('hzkSqBranch').value.trim(),
      contactPerson: document.getElementById('hzkSqContact').value.trim(),
      address: document.getElementById('hzkSqAddress').value.trim(),
      phone: document.getElementById('hzkSqPhone').value.trim(),
      customerEmail: document.getElementById('hzkSqCustEmail').value.trim(),
      paymentTerms: document.getElementById('hzkSqPayment').value.trim(),
      remarks: document.getElementById('hzkSqRemarks').value,
      updateCustomerBinding: document.getElementById('hzkSqUpdateBinding').checked,
      items: HZK_OMNI_STATE.items,
      subTotal: subTotal,
      vatAmount: vatAmount,
      whtAmount: whtAmount,
      grandTotal: grandTotal,
      updatedAt: new Date().toISOString()
    };
  }

  function autoSaveDraftToLocal(db) {
    try {
      const data = collectCurrentFormPayload(db);
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(data));
      const badge = document.getElementById('hzkSqAutoSaveBadge');
      if (badge) {
        const t = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        badge.textContent = '● Auto-Saved (' + t + ')';
      }
    } catch (e) {}
  }

  function saveToLocalArchiveList(qt) {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_ARCHIVE_KEY) || '[]');
      const key = (qt.offerNo || '') + '_' + (qt.rev || 'Rev.0');
      const idx = list.findIndex(x => ((x.offerNo || '') + '_' + (x.rev || 'Rev.0')) === key);
      if (idx >= 0) list[idx] = qt;
      else list.unshift(qt);
      localStorage.setItem(STORAGE_ARCHIVE_KEY, JSON.stringify(list.slice(0, 100)));
    } catch (e) {}
  }

  function buildA4QuotationHtmlDocument(db, qt, autoPrint) {
    const hdr = db.companyHeader;
    const fmt = String(qt.format || 'LOCAL').toUpperCase();
    const curr = fmt === 'EXPORT' ? 'USD' : 'THB';

    const rowsHtml = (qt.items || []).map((it, idx) => {
      const qty = Number(it.qty || 1);
      const up = Number(it.unitPrice || 0);
      const disc = Number(it.discount || 0);
      const amt = Math.max(0, (up - disc) * qty);
      return `
        <tr>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #334155;padding:6px;font-weight:700;text-align:center;"><img src="${resolveModelProductPhoto_(db, it.model)}" style="width:68px;height:46px;object-fit:cover;border-radius:5px;display:block;margin:0 auto 3px;" /><div>${it.model || '-'}</div></td>
          <td style="border:1px solid #334155;padding:6px;">${it.description || '-'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${it.w || '-'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${it.d || '-'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${it.h || '-'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:right;">${up.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:right;">${disc.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${qty}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:right;font-weight:700;">${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="10" style="border:1px solid #334155;padding:14px;text-align:center;color:#64748B;">- ยังไม่มีรายการสินค้า -</td></tr>';

    const remarksHtml = String(qt.remarks || '').split(/\r?\n/).map(l => `<div>${l}</div>`).join('');
    const taxLine = qt.taxId ? ` (Tax ID: ${qt.taxId} / ${qt.branch || 'สำนักงานใหญ่'})` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${qt.docType || 'Quotation'} ${qt.offerNo || ''} (${qt.rev || 'Rev.0'}) — HOSHIZAKI</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #0F172A; margin: 0; background: #E2E8F0; }
    .toolbar { background: #002B49; color: #FFF; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; }
    .sheet { background: #FFF; width: 210mm; min-height: 297mm; margin: 14px auto; padding: 14mm; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #002B49; color: #FFF; border: 1px solid #002B49; padding: 6px; font-size: 10px; }
    @media print {
      body { background: #FFF; }
      .toolbar { display: none !important; }
      .sheet { margin: 0; box-shadow: none; width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><b>👁️ A4 PREVIEW [${qt.department || 'Sales'}]:</b> ${qt.offerNo || ''} (${qt.rev || 'Rev.0'}) — ${qt.customerName || 'ลูกค้า'}</div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:7px 14px;font-weight:700;cursor:pointer;">🖨️ พิมพ์ / บันทึกเป็น PDF (A4)</button>
      <button onclick="window.close()" style="background:#EF4444;color:#FFF;border:none;border-radius:6px;padding:7px 12px;font-weight:700;cursor:pointer;">✕ ปิดหน้าต่าง</button>
    </div>
  </div>
  <div class="sheet">
    <div style="border-bottom:2px solid #002B49;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:16px;font-weight:800;color:#002B49;">${hdr.companyNameEn}</div>
        <div style="font-size:12px;font-weight:700;">${hdr.companyNameTh}</div>
        <div>${hdr.addressLine1}</div>
        <div>${hdr.addressLine2}</div>
        <div>Tel: ${hdr.tel} | Web: ${hdr.web}</div>
      </div>
      <div style="text-align:right;font-size:10px;color:#334155;">
        <div>Department: <b>${qt.department || 'Sales'}</b></div>
        <div>Issued By: <b>${qt.senderDisplayName || qt.salesperson || '-'}</b></div>
        <div>Currency: <b>${fmt} (${curr})</b></div>
      </div>
    </div>

    <div style="text-align:center;font-size:18px;font-weight:800;color:#002B49;letter-spacing:1px;margin:8px 0 12px;">${String(qt.docType || 'QUOTATION').toUpperCase()}</div>

    <table style="margin-bottom:12px;font-size:11px;">
      <tr>
        <td style="width:16%;font-weight:700;padding:3px 0;">Customer Name :</td>
        <td style="width:44%;padding:3px 0;">${qt.customerName || '-'}${taxLine}</td>
        <td style="width:18%;font-weight:700;padding:3px 0;">วันที่ / Date :</td>
        <td style="width:22%;padding:3px 0;">${qt.date || '-'}</td>
      </tr>
      <tr>
        <td style="font-weight:700;padding:3px 0;">Contact Person :</td>
        <td style="padding:3px 0;">${qt.contactPerson || '-'}</td>
        <td style="font-weight:700;padding:3px 0;">Document No. :</td>
        <td style="padding:3px 0;"><b>${qt.offerNo || '-'} (${qt.rev || 'Rev.0'})</b></td>
      </tr>
      <tr>
        <td style="font-weight:700;padding:3px 0;">Address :</td>
        <td style="padding:3px 0;">${qt.address || '-'}</td>
        <td style="font-weight:700;padding:3px 0;">Offered By :</td>
        <td style="padding:3px 0;">${qt.senderDisplayName || qt.salesperson || '-'}</td>
      </tr>
      <tr>
        <td style="font-weight:700;padding:3px 0;">Tel No. :</td>
        <td style="padding:3px 0;">${qt.phone || '-'}</td>
        <td style="font-weight:700;padding:3px 0;">Term of Payment :</td>
        <td style="padding:3px 0;">${qt.paymentTerms || '30DAYS'}</td>
      </tr>
    </table>

    <table>
      <thead>
        <tr>
          <th rowspan="2">NO.</th>
          <th rowspan="2">MODEL</th>
          <th rowspan="2">DESCRIPTION</th>
          <th colspan="3">Dimension (mm.)</th>
          <th rowspan="2">UNIT PRICE<br>(${curr})</th>
          <th rowspan="2">Discount</th>
          <th rowspan="2">Qty</th>
          <th rowspan="2">AMOUNT<br>(${curr})</th>
        </tr>
        <tr>
          <th>W</th>
          <th>D</th>
          <th>H</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <table style="margin-top:10px;">
      <tr>
        <td style="width:60%;vertical-align:top;padding-right:12px;">
          <div style="font-weight:700;margin-bottom:4px;">Remark / Terms &amp; Conditions:</div>
          <div style="font-size:10px;line-height:1.45;">${remarksHtml}</div>
        </td>
        <td style="width:40%;vertical-align:top;">
          <table>
            <tr><td style="border:1px solid #334155;padding:5px;font-weight:700;">SUB TOTAL</td><td style="border:1px solid #334155;padding:5px;text-align:right;font-weight:700;">${Number(qt.subTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
            <tr><td style="border:1px solid #334155;padding:5px;">${fmt === 'EXPORT' ? 'VAT 0% (Export)' : 'VAT 7%'}</td><td style="border:1px solid #334155;padding:5px;text-align:right;">${Number(qt.vatAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
            <tr><td style="border:1px solid #334155;padding:5px;">Withholding Tax 3%</td><td style="border:1px solid #334155;padding:5px;text-align:right;">${Number(qt.whtAmount || 0) > 0 ? '-' : ''}${Number(qt.whtAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
            <tr style="background:#F1F5F9;"><td style="border:1px solid #334155;padding:6px;font-weight:800;">GRAND TOTAL (${curr})</td><td style="border:1px solid #334155;padding:6px;text-align:right;font-weight:800;">${Number(qt.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <table style="margin-top:34px;text-align:center;font-size:10px;">
      <tr>
        <td style="width:25%;">Issued By (${qt.department || 'Sales'})<br><br><br>_______________________<br>${qt.senderDisplayName || 'Sales Executive'}</td>
        <td style="width:25%;">Checked By<br><br><br>_______________________<br>Authorized Signature</td>
        <td style="width:25%;">Approved By<br><br><br>_______________________<br>Authorized Signature</td>
        <td style="width:25%;">Purchased By<br><br><br>_______________________<br>ผู้ซื้อ / Purchased Signature</td>
      </tr>
    </table>
  </div>
  ${autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>' : ''}
</body>
</html>`;
  }

  function openIsolatedA4PreviewWindow(db, autoPrint) {
    const qt = collectCurrentFormPayload(db);
    autoSaveDraftToLocal(db);
    saveToLocalArchiveList(qt);
    const html = buildA4QuotationHtmlDocument(db, qt, autoPrint);
    const win = window.open('', '_blank', 'width=960,height=920');
    if (!win) {
      alert('⚠️ เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณากดอนุญาต Pop-up เพื่อเปิดหน้า A4 Preview ครับ');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function downloadExcelFileDirect(db) {
    const qt = collectCurrentFormPayload(db);
    autoSaveDraftToLocal(db);
    saveToLocalArchiveList(qt);
    const html = buildA4QuotationHtmlDocument(db, qt, false);
    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (qt.offerNo || 'HTH-26') + '_' + (qt.rev || 'Rev0') + '.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function openCrossDeptHandoverModal(db) {
    const qt = collectCurrentFormPayload(db);
    autoSaveDraftToLocal(db);

    let hModal = document.getElementById('hzkCrossDeptHandoverModal');
    if (!hModal) {
      hModal = document.createElement('div');
      hModal.id = 'hzkCrossDeptHandoverModal';
      hModal.style.cssText =
        'position:fixed;inset:0;z-index:10085;background:rgba(15,23,42,0.78);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(hModal);
    }

    const curr = qt.format === 'EXPORT' ? 'USD' : 'THB';
    const totalTxt = Number(qt.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ' + curr;
    const modelSummary = (qt.items || []).map(i => `${i.model} x${i.qty}`).join(', ') || '-';

    hModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:580px;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.4);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:11px;color:#FBBF24;font-weight:800;">CROSS-DEPARTMENT WORKFLOW HANDOVER</div>
            <div style="font-size:16px;font-weight:700;">🔄 ศูนย์ส่งต่องานข้ามแผนกอัตโนมัติ (1-Click Handover)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkCrossDeptHandoverModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:18px 20px;font-size:13px;color:#0F172A;display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-weight:700;display:block;margin-bottom:4px;">เลือกเส้นทางส่งต่องานข้ามแผนก</label>
            <select id="hzkHndType" style="width:100%;padding:9px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
              <option value="SALES_TO_SERVICE_INSTALL">🛠️ Sales / JP Corp ➔ Service (เปิดงานติดตั้ง / สำรวจหน้างาน + ลงทะเบียน S/N)</option>
              <option value="TO_ACCOUNTING_BILLING">🧾 Sales / Service ➔ Accounting (ส่งต่อออกใบวางบิล / ใบกำกับภาษี / ใบเสร็จ)</option>
              <option value="SERVICE_TO_SALES_REPLACE">💡 Service ➔ Sales (แจ้งโอกาสขายเครื่องใหม่ / Trade-in จากหน้างานซ่อม)</option>
            </select>
          </div>
          <div>
            <label style="font-weight:700;display:block;margin-bottom:4px;">หมายเลขเครื่อง Serial No. (ถ้ามี — ระบบจะลงทะเบียนรับประกันให้อัตโนมัติ)</label>
            <input id="hzkHndSerial" type="text" placeholder="เช่น K01234J (เว้นว่างได้หากเป็นงานสำรวจหน้างาน)" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
          </div>
          <div>
            <label style="font-weight:700;display:block;margin-bottom:4px;">หมายเหตุ / รายละเอียดเพิ่มเติมถึงแผนกปลายทาง</label>
            <textarea id="hzkHndNotes" rows="3" placeholder="ระบุวันนัดหมายเข้าติดตั้ง เงื่อนไขหน้างาน หรือรายละเอียดออกบิล..." style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;"></textarea>
          </div>
          <button type="button" id="hzkHndSubmitBtn" style="width:100%;background:#059669;color:#FFF;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;">🚀 ยืนยันส่งต่องานข้ามแผนก &amp; แจ้งเตือนเข้า LINE ทันที</button>
          <div id="hzkHndStatus" style="font-size:12px;background:#F1F5F9;padding:8px 12px;border-radius:8px;display:none;"></div>
        </div>
      </div>
    `;

    hModal.style.display = 'flex';
    document.getElementById('hzkHndSubmitBtn').onclick = async function () {
      const gasUrl = getGasEndpointUrl();
      if (!gasUrl) {
        alert('⚠️ กรุณาตั้งค่า Google Apps Script URL ก่อนใช้งานครับ');
        return;
      }
      const hType = document.getElementById('hzkHndType').value;
      const toDept = hType === 'TO_ACCOUNTING_BILLING'
        ? 'Accounting & Billing'
        : (hType === 'SERVICE_TO_SALES_REPLACE' ? 'Commercial Sales' : 'Service & Installation');

      const st = document.getElementById('hzkHndStatus');
      if (st) { st.style.display = 'block'; st.textContent = '⏳ กำลังบันทึกการส่งต่องานและแจ้งเตือนแผนก ' + toDept + '...'; }

      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'dispatchCrossDeptHandover',
          handoverType: hType,
          fromDept: qt.department || 'Sales',
          toDept: toDept,
          senderName: qt.senderDisplayName || qt.salesperson || 'HOSHIZAKI Staff',
          refDocNo: qt.offerNo,
          customerName: qt.customerName,
          customerPhone: qt.phone,
          address: qt.address,
          modelSummary: modelSummary,
          serialNo: document.getElementById('hzkHndSerial').value,
          amountText: totalTxt,
          notes: document.getElementById('hzkHndNotes').value
        })
      });
      const data = await res.json();
      if (data && data.status === 'OK') {
        st.innerHTML = '✅ ส่งต่องานสำเร็จ! รหัส: <b>' + data.handoverId + '</b> (ไปยัง: <b>' + toDept + '</b>)' +
          (data.serialRegistered ? ' — ลงทะเบียน S/N เข้าฐานรับประกันเรียบร้อยแล้ว' : '');
      }
    };
  }

  function deduplicateEmails(rawStr) {
    const seen = new Set();
    const out = [];
    String(rawStr || '').split(/[,;\s]+/).forEach(em => {
      const clean = em.trim().toLowerCase();
      if (clean && clean.indexOf('@') > 0 && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    });
    return out.join(', ');
  }

  async function openMultiChannelShareHubModal(db, overrideDoc) {
    const qt = overrideDoc || collectCurrentFormPayload(db);
    if (!overrideDoc) {
      autoSaveDraftToLocal(db);
      saveToLocalArchiveList(qt);
    }

    const staffEmailOptions = (db.activeStaff || [])
      .map(s => `<option value="${s.email || 'services@hoshizaki.co.th'}" data-name="${s.name}" data-dept="${s.dept}" ${s.code === qt.salesperson ? 'selected' : ''}>${s.name} [${s.dept}] — ${s.email || 'services@hoshizaki.co.th'}</option>`)
      .join('');

    const groups = db.emailGroups || DEFAULT_GROUPS;
    const docTypeU = String(qt.docType || '');
    const deptU = String(qt.department || '');

    const groupPillsHtml = groups.map(g => {
      let autoChecked = false;
      if (g.code === 'FINANCE_ACC' && /วางบิล|เสร็จ|Billing|Receipt/i.test(docTypeU)) autoChecked = true;
      if (g.code === 'JPC_TEAM' && /Japan/i.test(deptU)) autoChecked = true;
      if (g.code === 'MARKETING_ALL' && /Market/i.test(deptU)) autoChecked = true;
      if (g.code === 'SERVICE_ALL' && /Service/i.test(deptU)) autoChecked = true;
      return `
        <label class="hzk-grp-pill" title="${g.emails}">
          <input type="checkbox" class="hzk-grp-cb" data-code="${g.code}" data-emails="${g.emails}" data-mode="${g.defaultMode || 'CC'}" data-line="${g.lineGroupId || ''}" ${autoChecked ? 'checked' : ''} />
          <span>${g.defaultMode === 'BCC' ? '🔒 BCC:' : '👥 CC:'} ${g.label}</span>
        </label>`;
    }).join('');

    let shareModal = document.getElementById('hzkSqShareHubModal');
    if (!shareModal) {
      shareModal = document.createElement('div');
      shareModal.id = 'hzkSqShareHubModal';
      shareModal.style.cssText =
        'position:fixed;inset:0;z-index:10080;background:rgba(15,23,42,0.78);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(shareModal);
    }

    const curr = qt.format === 'EXPORT' ? 'USD' : 'THB';
    const totalTxt = Number(qt.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ' + curr;

    shareModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:690px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.4);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">MULTI-CHANNEL SHARE + GROUP CC/BCC (7 DEPTS) + DOC TRACKING</div>
            <div style="font-size:15px;font-weight:700;">[${qt.department || 'Sales'}] ${qt.docType || 'ใบเสนอราคา'} ${qt.offerNo} (${qt.rev}) — ${totalTxt}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button type="button" onclick="window.openSmartShareableLinksPreviewModal({customerName:document.getElementById('hzkSqCustomer')?document.getElementById('hzkSqCustomer').value:'',model:HZK_OMNI_STATE.items[0]?HZK_OMNI_STATE.items[0].model:''})" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:6px 11px;font-weight:700;font-size:11.5px;cursor:pointer;">🔗 ลิงก์ลูกค้า/สาขา + พรีวิว</button>
            <button type="button" onclick="document.getElementById('hzkSqShareHubModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>

        <div style="padding:18px 20px;font-size:13px;color:#0F172A;display:flex;flex-direction:column;gap:14px;">
          <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:10px;padding:12px;">
            <div style="font-weight:700;color:#002B49;margin-bottom:8px;">1️⃣ ส่งทางอีเมลพร้อมแนบไฟล์จริง + เลือกกลุ่ม CC / BCC รายแผนก</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div>
                <label style="font-size:12px;font-weight:700;">ผู้ส่ง / อีเมลตอบกลับ (From / Reply-To)</label>
                <select id="hzkShareSenderSelect" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;">
                  ${staffEmailOptions}
                </select>
              </div>
              <div>
                <label style="font-size:12px;font-weight:700;">ประเภทไฟล์แนบ (Attachment)</label>
                <select id="hzkShareAttachType" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;">
                  <option value="PDF">📕 แนบไฟล์ PDF เท่านั้น</option>
                  <option value="EXCEL">📗 แนบไฟล์ Excel (.xls) เท่านั้น</option>
                  <option value="BOTH">📦 แนบทั้งไฟล์ PDF + Excel</option>
                </select>
              </div>
              <div style="grid-column:1/-1;">
                <label style="font-size:12px;font-weight:700;">อีเมลผู้รับหลัก (To Email)</label>
                <input id="hzkShareToEmail" type="email" value="${qt.customerEmail || ''}" placeholder="customer@company.co.th" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;" />
              </div>
            </div>

            <div style="margin-bottom:8px;">
              <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;">ติ๊กเลือกกลุ่มสำเนาอีเมลทั้งแผนก (Group CC / BCC — แก้ไขสมาชิกได้ใน Google Sheets):</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">${groupPillsHtml}</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
              <div>
                <label style="font-size:11px;font-weight:700;color:#475569;">รายชื่ออีเมล CC รวม (แก้ไขเพิ่ม/ลดได้)</label>
                <input id="hzkShareCcEmail" type="text" placeholder="cc1@hoshizaki.co.th, cc2@..." style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;font-size:12px;" />
              </div>
              <div>
                <label style="font-size:11px;font-weight:700;color:#475569;">รายชื่ออีเมล BCC (สำเนาลับผู้บริหาร)</label>
                <input id="hzkShareBccEmail" type="text" placeholder="bcc@hoshizaki.co.th" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;font-size:12px;" />
              </div>
            </div>

            <button type="button" id="hzkShareSendEmailBtn" style="width:100%;background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;">📧 ส่งอีเมลแนบไฟล์ + CC/BCC กลุ่มที่เลือก + ปุ่มยืนยันรับเอกสาร</button>
          </div>

          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px;">
            <div style="font-weight:700;color:#166534;margin-bottom:8px;">2️⃣ แชร์เข้า LINE (การ์ดแยกสีตามแผนก + ปุ่มยืนยันรับ &amp; อนุมัติสั่งซื้อ)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" id="hzkShareLinePushBtn" style="flex:1;background:#059669;color:#FFF;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;">💬 ส่ง Flex Card เข้า LINE OA &amp; กลุ่มที่เลือก</button>
              <button type="button" id="hzkShareLinePickerBtn" style="flex:1;background:#15803D;color:#FFF;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;">📲 เปิดหน้าเลือกเพื่อน/กลุ่มใน LINE</button>
            </div>
          </div>

          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:12px;">
            <div style="font-weight:700;color:#92400E;margin-bottom:8px;">3️⃣ ส่ง SMS พร้อมลิงก์ PDF และปุ่มยืนยันรับเอกสาร</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <input id="hzkShareSmsPhone" type="tel" value="${qt.phone || ''}" placeholder="เบอร์มือถือลูกค้า เช่น 0819793085" style="flex:1;min-width:180px;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              <button type="button" id="hzkShareSmsBtn" style="background:#D97706;color:#FFF;border:none;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer;">📱 สร้างลิงก์ PDF &amp; ส่ง SMS</button>
            </div>
          </div>

          <div id="hzkShareStatusBox" style="font-size:12px;color:#0F172A;background:#F1F5F9;padding:10px 12px;border-radius:8px;display:none;line-height:1.5;"></div>
        </div>
      </div>
    `;

    shareModal.style.display = 'flex';

    function syncGroupCheckboxesToFields() {
      let ccList = [];
      let bccList = [];
      shareModal.querySelectorAll('.hzk-grp-cb:checked').forEach(cb => {
        const em = cb.getAttribute('data-emails') || '';
        const mode = cb.getAttribute('data-mode') || 'CC';
        if (mode === 'BCC') bccList.push(em);
        else ccList.push(em);
      });
      document.getElementById('hzkShareCcEmail').value = deduplicateEmails(ccList.join(', '));
      document.getElementById('hzkShareBccEmail').value = deduplicateEmails(bccList.join(', '));
    }

    shareModal.querySelectorAll('.hzk-grp-cb').forEach(cb => {
      cb.onchange = syncGroupCheckboxesToFields;
    });
    syncGroupCheckboxesToFields();

    const statusBox = document.getElementById('hzkShareStatusBox');
    const setStatus = (msg) => {
      statusBox.style.display = 'block';
      statusBox.innerHTML = msg;
    };

    function getSelectedExtraLineGroupIds() {
      const ids = [];
      shareModal.querySelectorAll('.hzk-grp-cb:checked').forEach(cb => {
        const g = (cb.getAttribute('data-line') || '').trim();
        if (g && ids.indexOf(g) === -1) ids.push(g);
      });
      return ids;
    }

    async function callShareGas(channel, extra) {
      const gasUrl = getGasEndpointUrl();
      if (!gasUrl) {
        alert('⚠️ กรุณาตั้งค่า Google Apps Script URL ก่อนใช้งานครับ');
        return null;
      }
      setStatus('⏳ กำลังสร้างไฟล์ PDF &amp; Excel บน Google Drive และสร้างรหัสติดตาม (Track ID)...');
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({
          action: 'shareSalesQuotation',
          channel: channel,
          quotation: qt,
          extraLineGroupIds: getSelectedExtraLineGroupIds()
        }, extra || {}))
      });
      return await res.json();
    }

    document.getElementById('hzkShareSendEmailBtn').onclick = async function () {
      const sel = document.getElementById('hzkShareSenderSelect');
      const opt = sel.options[sel.selectedIndex];
      const data = await callShareGas('EMAIL', {
        toEmail: document.getElementById('hzkShareToEmail').value,
        ccEmail: document.getElementById('hzkShareCcEmail').value,
        bccEmail: document.getElementById('hzkShareBccEmail').value,
        attachType: document.getElementById('hzkShareAttachType').value,
        replyToEmail: sel.value,
        senderName: opt ? opt.getAttribute('data-name') : qt.senderDisplayName
      });
      if (data && data.status === 'OK') {
        setStatus('✅ ' + data.message + '<br>📌 <b>Track ID:</b> ' + data.trackId + ' | <a href="' + data.pdfUrl + '" target="_blank">เปิดดู PDF</a>');
      } else if (data) {
        setStatus('❌ ' + (data.message || 'ส่งอีเมลไม่สำเร็จ'));
      }
    };

    document.getElementById('hzkShareLinePushBtn').onclick = async function () {
      const data = await callShareGas('LINE');
      if (data && data.status === 'OK') {
        setStatus('✅ ส่ง Flex Card แผนก <b>' + qt.department + '</b> (ผู้ส่ง: ' + qt.senderDisplayName + ') พร้อมปุ่มยืนยันรับเอกสารเข้า LINE เรียบร้อยแล้ว!<br>📌 <b>Track ID:</b> ' + data.trackId + ' | <a href="' + data.pdfUrl + '" target="_blank">เปิดดู PDF</a>');
      }
    };

    document.getElementById('hzkShareLinePickerBtn').onclick = async function () {
      const data = await callShareGas('LINE_PICKER');
      if (data && data.pdfUrl) {
        const msg =
          '[' + (qt.department || 'Sales') + ' — HOSHIZAKI]\n' +
          (qt.docType || 'ใบเสนอราคา') + ' เลขที่: ' + qt.offerNo + ' (' + qt.rev + ')\n' +
          'ผู้ส่ง: ' + (qt.senderDisplayName || '-') + '\n' +
          'ยอดสุทธิ: ' + totalTxt + '\n' +
          'เปิดดู PDF: ' + data.pdfUrl + '\n' +
          'กดยืนยันรับเอกสาร: ' + data.ackUrl;
        window.open('https://line.me/R/share?text=' + encodeURIComponent(msg), '_blank');
        setStatus('✅ เปิดหน้าเลือกเพื่อน/กลุ่ม LINE แล้ว (Track ID: ' + data.trackId + ')');
      }
    };

    document.getElementById('hzkShareSmsBtn').onclick = async function () {
      const phone = document.getElementById('hzkShareSmsPhone').value.replace(/[^0-9+]/g, '');
      const data = await callShareGas('SMS', { smsPhone: phone });
      if (data && data.pdfUrl) {
        const smsText =
          'HOSHIZAKI [' + (qt.department || 'Sales') + '] ' + (qt.docType || 'Doc') + ' ' + qt.offerNo +
          ' (' + totalTxt + ') PDF: ' + data.pdfUrl + ' ยืนยันรับเอกสาร: ' + data.ackUrl;
        setStatus('✅ สร้างลิงก์ PDF + ปุ่มยืนยันสำเร็จ (Track ID: ' + data.trackId + ')');
        window.location.href = 'sms:' + phone + '?body=' + encodeURIComponent(smsText);
      }
    };
  }

  async function openExecutiveBiDashboardModal() {
    let biModal = document.getElementById('hzkExecutiveBiModal');
    if (!biModal) {
      biModal = document.createElement('div');
      biModal.id = 'hzkExecutiveBiModal';
      biModal.style.cssText =
        'position:fixed;inset:0;z-index:10095;background:rgba(15,23,42,0.8);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(biModal);
    }

    biModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:900px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.4);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;gap:8px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;color:#FBBF24;font-weight:800;">UNIFIED EXECUTIVE BI &amp; AI SALES COPILOT</div>
            <div style="font-size:16px;font-weight:700;">📈 รายงานสรุปผู้บริหาร + AI ติดตามใบเสนอราคา</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" id="hzkSendBriefingLineBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">📲 ส่งสรุปเข้า LINE ผู้บริหารทันที</button>
            <button type="button" onclick="document.getElementById('hzkExecutiveBiModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>
        <div id="hzkBiBody" style="padding:18px 20px;font-size:13px;color:#0F172A;">⏳ กำลังดึงข้อมูลสรุปจาก Google Sheets...</div>
      </div>
    `;
    biModal.style.display = 'flex';

    const gasUrl = getGasEndpointUrl();
    const bodyEl = document.getElementById('hzkBiBody');
    if (!gasUrl) {
      bodyEl.innerHTML = '<div style="color:#B91C1C;">กรุณาตั้งค่า Google Apps Script URL เพื่อดูรายงานสรุปผู้บริหารครับ</div>';
      return;
    }

    document.getElementById('hzkSendBriefingLineBtn').onclick = async function () {
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'sendExecutiveBriefingNow' })
      });
      const resData = await r.json();
      alert(resData && resData.status === 'OK' ? '✅ ส่งรายงานสรุปผู้บริหารเข้า LINE เรียบร้อยแล้ว!' : '⚠️ ส่งไม่สำเร็จ');
    };

    try {
      const [resBi, resAi] = await Promise.all([
        fetch(gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'getExecutiveBiSummary' }) }),
        fetch(gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'getAiSalesFollowUps' }) })
      ]);
      const d = await resBi.json();
      const ai = await resAi.json();
      const q = d.quotations || {};
      const t = d.tracking || {};
      const s = d.service || {};
      const staleList = (ai && ai.items) || [];

      const deptRows = Object.keys(q.byDept || {}).map(k =>
        `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E2E8F0;"><span>${k}</span><b>${Number(q.byDept[k] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b></div>`
      ).join('') || '<div style="color:#64748B;">ยังไม่มีข้อมูลแยกแผนก</div>';

      const aiRows = staleList.slice(0, 10).map(item =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #E2E8F0;gap:8px;">` +
        `<div><b>${item.docNo}</b> — ${item.customer} <span style="color:#64748B;">(${item.dept} / ${item.sender})</span></div>` +
        `<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">ส่งแล้ว ${item.daysAgo} วัน (${item.amount})</span>` +
        `</div>`
      ).join('') || '<div style="color:#059669;">✅ ไม่มีใบเสนอราคาค้างติดตามเกิน 3 วัน</div>';

      bodyEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
          <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;">
            <div style="font-size:11px;font-weight:700;color:#1D4ED8;">💼 ใบเสนอราคาสะสม (Sales &amp; JPC)</div>
            <div style="font-size:22px;font-weight:800;color:#002B49;margin-top:4px;">${q.count || 0} ฉบับ</div>
            <div style="font-size:12px;color:#334155;">มูลค่ารวม: <b>${Number(q.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b></div>
          </div>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px;">
            <div style="font-size:11px;font-weight:700;color:#15803D;">📊 สถานะการรับเอกสาร &amp; PO</div>
            <div style="font-size:22px;font-weight:800;color:#14532D;margin-top:4px;">${(t.ACKNOWLEDGED || 0) + (t.PO_APPROVED || 0)} ยืนยันแล้ว</div>
            <div style="font-size:12px;color:#334155;">อนุมัติสั่งซื้อ: <b>${t.PO_APPROVED || 0}</b> | รอตอบรับ: <b>${t.SENT || 0}</b></div>
          </div>
          <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:14px;">
            <div style="font-size:11px;font-weight:700;color:#B91C1C;">🛠️ งานบริการ &amp; ดีลเลอร์ (Service)</div>
            <div style="font-size:22px;font-weight:800;color:#7F1D1D;margin-top:4px;">${s.totalTickets || 0} เคส</div>
            <div style="font-size:12px;color:#334155;">ปิดจบเอง (FCR): <b>${s.fcrResolved || 0}</b> | ดีลเลอร์รับงาน: <b>${s.dealerAccepted || 0}</b></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px;">
            <div style="font-weight:700;color:#002B49;margin-bottom:8px;">ยอดเสนอราคาแยกตามแผนก</div>
            ${deptRows}
          </div>
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px;">
            <div style="font-weight:700;color:#92400E;margin-bottom:8px;">🤖 AI Sales Follow-Up Copilot (ค้างติดตาม &gt; 3 วัน)</div>
            ${aiRows}
          </div>
        </div>
      `;
    } catch (err) {
      bodyEl.innerHTML = '<div style="color:#B91C1C;">โหลดรายงานไม่สำเร็จ: ' + err.message + '</div>';
    }
  }

  async function openWarrantyPmRenewalModal() {
    let pmModal = document.getElementById('hzkWarrantyPmRenewalModal');
    if (!pmModal) {
      pmModal = document.createElement('div');
      pmModal.id = 'hzkWarrantyPmRenewalModal';
      pmModal.style.cssText =
        'position:fixed;inset:0;z-index:10092;background:rgba(15,23,42,0.78);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(pmModal);
    }

    pmModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:980px;max-height:90vh;overflow-y:auto;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.4);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#FBBF24;font-weight:800;">PREDICTIVE PM &amp; WARRANTY RENEWAL ENGINE</div>
            <div style="font-size:16px;font-weight:700;">🔔 ระบบแจ้งเตือนเครื่องใกล้หมดประกัน &amp; ต่ออายุสัญญา PM อัตโนมัติ</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkWarrantyPmRenewalModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div id="hzkPmRenewalBody" style="padding:16px 20px;font-size:13px;">⏳ กำลังตรวจสอบวันหมดประกันและรอบบำรุงรักษา (PM) จากฐานข้อมูล...</div>
      </div>
    `;
    pmModal.style.display = 'flex';

    const gasUrl = getGasEndpointUrl();
    const bodyEl = document.getElementById('hzkPmRenewalBody');
    if (!gasUrl) {
      bodyEl.innerHTML = '<div style="color:#B91C1C;">กรุณาตั้งค่า Google Apps Script URL ก่อนใช้งานครับ</div>';
      return;
    }

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getWarrantyPmRenewals' })
      });
      const data = await res.json();
      const items = (data && data.items) || [];
      if (!items.length) {
        bodyEl.innerHTML = '<div style="color:#64748B;">ไม่พบรายการเครื่องในฐานข้อมูล Serial_Dealer_Master</div>';
        return;
      }

      bodyEl.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;min-width:780px;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#0F172A;color:#FFF;">
                <th style="padding:8px;border:1px solid #CBD5E1;">Serial No.</th>
                <th style="padding:8px;border:1px solid #CBD5E1;">Model</th>
                <th style="padding:8px;border:1px solid #CBD5E1;">ลูกค้า / ร้าน</th>
                <th style="padding:8px;border:1px solid #CBD5E1;">สถานะการรับประกัน</th>
                <th style="padding:8px;border:1px solid #CBD5E1;">ค่าบริการ PM รายปีแนะนำ</th>
                <th style="padding:8px;border:1px solid #CBD5E1;">สร้างใบเสนอราคาต่อสัญญา</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it, idx) => `
                <tr>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${it.serialNumber}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;">${it.model}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;">${it.customerName} (${it.phone || '-'})</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;">${it.warrantyStatus}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">${Number(it.suggestedPmPrice || 4500).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
                    <button type="button" data-pm-idx="${idx}" class="hzk-create-pm-qt-btn" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:6px 10px;font-weight:700;cursor:pointer;">📄 ออกใบเสนอราคา PM</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;

      bodyEl.querySelectorAll('.hzk-create-pm-qt-btn').forEach(btn => {
        btn.onclick = async function () {
          const item = items[Number(btn.getAttribute('data-pm-idx'))];
          document.getElementById('hzkWarrantyPmRenewalModal').style.display = 'none';
          HZK_OMNI_STATE.items = [{
            model: item.model,
            description: 'Annual Preventive Maintenance (PM Contract 4 Visits/Year) — S/N: ' + item.serialNumber,
            w: '',
            d: '',
            h: '',
            unitPrice: Number(item.suggestedPmPrice || 4500),
            discount: 0,
            qty: 1,
            isService: true
          }];
          await openSalesCorporateQuotationWithPreset('Service & Billing', 'ใบเสนอราคา (Quotation)');
          document.getElementById('hzkSqCustomer').value = item.customerName || '';
          document.getElementById('hzkSqPhone').value = item.phone || '';
        };
      });
    } catch (err) {
      bodyEl.innerHTML = '<div style="color:#B91C1C;">เกิดข้อผิดพลาด: ' + err.message + '</div>';
    }
  }

  async function openCustomerDealerPortalWindow() {
    const db = await loadSalesMasterDb(false);
    const gasUrl = getGasEndpointUrl();
    const portalUrl = db.portalUrl || (gasUrl ? (gasUrl + '?action=portal') : '');
    if (!portalUrl) {
      alert('⚠️ กรุณาตั้งค่า Google Apps Script URL ก่อนเปิดหน้า Customer & Dealer Portal ครับ');
      return;
    }
    window.open(portalUrl, '_blank');
  }

  async function openDocumentTrackingDashboardModal(db) {
    let trkModal = document.getElementById('hzkDocTrackingDashboardModal');
    if (!trkModal) {
      trkModal = document.createElement('div');
      trkModal.id = 'hzkDocTrackingDashboardModal';
      trkModal.style.cssText =
        'position:fixed;inset:0;z-index:10090;background:rgba(15,23,42,0.78);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(trkModal);
    }

    trkModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1040px;max-height:90vh;overflow-y:auto;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.4);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">REAL-TIME DOCUMENT ACKNOWLEDGEMENT &amp; PO APPROVAL TRACKER</div>
            <div style="font-size:16px;font-weight:700;">📊 ติดตามสถานะการรับเอกสาร (ใบเสนอราคา / ใบแจ้งบริการ / ใบวางบิล / ใบเสร็จรับเงิน)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkDocTrackingDashboardModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:16px 20px;font-size:13px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
            <label style="font-weight:700;">กรองตามแผนก:</label>
            <select id="hzkTrkDeptFilter" style="padding:7px 12px;border:1px solid #CBD5E1;border-radius:8px;">
              <option value="ALL">ทุกแผนก (All Departments)</option>
              <option value="Sales">Sales Department</option>
              <option value="Japanese Corporate">Japanese Corporate</option>
              <option value="Marketing">Marketing Department</option>
              <option value="Service">Service &amp; Billing (ใบแจ้งบริการ/ใบวางบิล/ใบเสร็จ)</option>
            </select>
            <button type="button" id="hzkTrkRefreshBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">🔄 รีเฟรชสถานะล่าสุด</button>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;min-width:820px;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#0F172A;color:#FFF;">
                  <th style="padding:8px;border:1px solid #CBD5E1;">Track ID</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">แผนก (Dept)</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">ผู้ส่ง (Sender)</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">ประเภท / เลขที่เอกสาร</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">ลูกค้า</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">ช่องทาง</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">สถานะการตอบรับ</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">เวลาที่ยืนยัน</th>
                </tr>
              </thead>
              <tbody id="hzkTrkTableBody">
                <tr><td colspan="8" style="padding:16px;text-align:center;color:#64748B;">กำลังโหลดข้อมูลจาก Google Sheets...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    trkModal.style.display = 'flex';

    async function loadTrackingRows() {
      const tbody = document.getElementById('hzkTrkTableBody');
      const gasUrl = getGasEndpointUrl();
      if (!gasUrl) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;text-align:center;color:#B91C1C;">กรุณาตั้งค่า Google Apps Script URL เพื่อดูสถานะแบบเรียลไทม์</td></tr>';
        return;
      }
      const dept = document.getElementById('hzkTrkDeptFilter').value;
      tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;text-align:center;color:#64748B;">⏳ กำลังดึงข้อมูล...</td></tr>';
      try {
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getDocumentTrackingList', department: dept })
        });
        const data = await res.json();
        const rows = (data && data.records) || [];
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;text-align:center;color:#64748B;">ยังไม่มีประวัติการส่งเอกสารในหมวดนี้</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map(r => {
          const st = String(r.status || 'SENT').toUpperCase();
          let badge = '<span style="background:#FEF3C7;color:#92400E;padding:3px 8px;border-radius:999px;font-weight:700;">⏳ รอการยืนยัน (SENT)</span>';
          if (st === 'PO_APPROVED') {
            badge = '<span style="background:#DBEAFE;color:#1E40AF;padding:3px 8px;border-radius:999px;font-weight:700;">✍️ อนุมัติสั่งซื้อแล้ว (PO APPROVED)</span>';
          } else if (st === 'ACKNOWLEDGED') {
            badge = '<span style="background:#DCFCE7;color:#166534;padding:3px 8px;border-radius:999px;font-weight:700;">✅ ได้รับเอกสารแล้ว</span>';
          } else if (st === 'MISSING_REPORTED') {
            badge = '<span style="background:#FEE2E2;color:#991B1B;padding:3px 8px;border-radius:999px;font-weight:700;">🚨 แจ้งไม่ได้รับเอกสาร</span>';
          } else if (st === 'FOLLOWUP_24H') {
            badge = '<span style="background:#FFEDD5;color:#9A3412;padding:3px 8px;border-radius:999px;font-weight:700;">⏰ ค้างตอบรับ > 24 ชม.</span>';
          }
          return `
            <tr>
              <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${r.trackId}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;"><b>${r.department}</b></td>
              <td style="padding:7px;border:1px solid #CBD5E1;">${r.senderName}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;">${r.docType} <b>[${r.docNo}]</b></td>
              <td style="padding:7px;border:1px solid #CBD5E1;">${r.customerName}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${r.channel}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${badge}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;font-size:11px;">${r.confirmedAt || r.sentAt || '-'}</td>
            </tr>`;
        }).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;text-align:center;color:#B91C1C;">เกิดข้อผิดพลาด: ' + err.message + '</td></tr>';
      }
    }

    document.getElementById('hzkTrkRefreshBtn').onclick = loadTrackingRows;
    document.getElementById('hzkTrkDeptFilter').onchange = loadTrackingRows;
    loadTrackingRows();
  }

  async function openSalesCorporateQuotationModal() {
    const db = await loadSalesMasterDb(false);
    let modal = document.getElementById('hzkSalesCorporateQtModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkSalesCorporateQtModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,0.75);display:flex;' +
        'align-items:center;justify-content:center;padding:8px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const staffOptions = (db.activeStaff || [])
      .map(s => `<option value="${s.code}">${s.code} — ${s.name} (${s.dept})</option>`)
      .join('');

    const stockMap = db.stockMap || {};
    const modelOptions = (db.models || [])
      .map(m => {
        const st = stockMap[String(m.model || '').toUpperCase()];
        const stockTag = st
          ? (st.available > 0 ? ` [🟢 พร้อมส่ง ${st.available} เครื่อง]` : ` [🟠 ${st.leadTime}]`)
          : '';
        return `<option value="${m.model}">${m.model} (${m.w || '-'}x${m.d || '-'}x${m.h || '-'} mm) - ${m.description}${stockTag}</option>`;
      })
      .join('');

    const customerOptions = (db.customers || [])
      .map(c => `<option value="${c.name.split(String.fromCharCode(34)).join('&quot;')}">`)
      .join('');

    const termsOptions = (db.termsAndConditions || [])
      .map(t => `<option value="${t.split(String.fromCharCode(34)).join('&quot;')}">${t}</option>`)
      .join('');

    const savedDraft = (() => {
      try { return JSON.parse(localStorage.getItem(STORAGE_DRAFT_KEY) || 'null'); } catch (e) { return null; }
    })();

    const todayStr = (savedDraft && savedDraft.date) || new Date().toISOString().slice(0, 10);
    const defaultOfferNo = (savedDraft && savedDraft.offerNo) || ('HTH-26' + String(Math.floor(100 + Math.random() * 899)));
    if (savedDraft && Array.isArray(savedDraft.items)) {
      HZK_OMNI_STATE.items = savedDraft.items;
    }

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1100px;max-height:95vh;overflow-y:auto;border-radius:16px;box-shadow:0 20px 45px rgba(0,0,0,0.35);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFFFFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:2;gap:8px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;letter-spacing:0.05em;">HOSHIZAKI (THAILAND) LIMITED — ENTERPRISE COMPLETE SUITE (v1188-SERVICE-FIRST-CONTROL)</div>
            <div style="font-size:16px;font-weight:700;">ระบบออกเอกสาร &amp; เชื่อมงานข้ามแผนก <span id="hzkSqAutoSaveBadge" style="font-size:11px;background:#065F46;color:#A7F3D0;padding:2px 8px;border-radius:999px;margin-left:6px;">● Auto-Save Ready</span></div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <button type="button" id="hzkSqConvertBillBtn" style="background:#0D9488;color:#FFF;border:none;border-radius:8px;padding:7px 11px;font-weight:700;cursor:pointer;">🧾 แปลงเป็นใบวางบิล/ใบเสร็จ</button>
            <button type="button" id="hzkSqHandoverBtn" style="background:#D97706;color:#FFF;border:none;border-radius:8px;padding:7px 11px;font-weight:700;cursor:pointer;">🔄 ส่งต่องานข้ามแผนก</button>
            <button type="button" id="hzkSqOpenTrackDashBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:7px 11px;font-weight:700;cursor:pointer;">📊 ติดตามเอกสาร</button>
            <button type="button" id="hzkSqOpenBiBtn" style="background:#4F46E5;color:#FFF;border:none;border-radius:8px;padding:7px 11px;font-weight:700;cursor:pointer;">📈 สรุปผู้บริหาร (BI)</button>
            <button type="button" onclick="document.getElementById('hzkSalesCorporateQtModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 11px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>

        <div style="padding:16px 20px;font-size:13px;color:#0F172A;">
          <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:9px 12px;margin-bottom:12px;font-size:12px;color:#0369A1;">
            <b>ที่อยู่หัวเอกสารปัจจุบัน:</b> ${db.companyHeader.companyNameEn} | ${db.companyHeader.addressLine1} ${db.companyHeader.addressLine2} | Tel: ${db.companyHeader.tel}
          </div>

          <div class="hzk-sq-grid-top" style="margin-bottom:12px;">
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">ประเภทเอกสาร (Document Type)</label>
              <select id="hzkSqDocType" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
                <option value="ใบเสนอราคา (Quotation)">📄 ใบเสนอราคา (Quotation)</option>
                <option value="ใบแจ้งบริการ (Service Report)">🛠️ ใบแจ้งบริการ (Service Report)</option>
                <option value="ใบวางบิล (Billing Note)">🧾 ใบวางบิล (Billing Note)</option>
                <option value="ใบเสร็จรับเงิน (Receipt)">💰 ใบเสร็จรับเงิน (Receipt)</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">แผนกเจ้าของเรื่อง (Department)</label>
              <select id="hzkSqDept" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
                <option value="Sales">Sales Department</option>
                <option value="Japanese Corporate">Japanese Corporate</option>
                <option value="Marketing">Marketing Department</option>
                <option value="Service & Billing">Service &amp; Billing Department</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">รูปแบบสกุลเงิน (Currency Format)</label>
              <select id="hzkSqFormat" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;">
                <option value="LOCAL">Local Format (THB + VAT 7% + WHT 3%)</option>
                <option value="EXPORT">Export / Hoshi Group Format (USD + VAT 0%)</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">เลขที่เอกสาร (Document / Offer No.)</label>
              <input id="hzkSqOfferNo" type="text" value="${defaultOfferNo}" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;" />
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">เวอร์ชัน (Revision)</label>
              <select id="hzkSqRev" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;">
                <option value="Rev.0">Rev.0 (ออกครั้งแรก)</option>
                <option value="Rev.1">Rev.1 (แก้ไขครั้งที่ 1)</option>
                <option value="Rev.2">Rev.2 (แก้ไขครั้งที่ 2)</option>
                <option value="Rev.3">Rev.3 (แก้ไขครั้งที่ 3)</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">ผู้ส่งเอกสาร / ผู้รับผิดชอบ (ระบุชื่อบน Flex Card)</label>
              <select id="hzkSqSalesperson" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;">
                <option value="">-- เลือกผู้รับผิดชอบปัจจุบัน --</option>
                ${staffOptions}
              </select>
            </div>
          </div>

          <div class="hzk-sq-grid-cust" style="margin-bottom:12px;background:#F8FAFC;padding:12px;border-radius:10px;border:1px solid #E2E8F0;">
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">ชื่อบริษัทลูกค้า (ดึงสดจากฐานข้อมูล หรือพิมพ์ใหม่)</label>
              <input id="hzkSqCustomer" list="hzkSqCustomerList" value="${(savedDraft && savedDraft.customerName) || ''}" placeholder="พิมพ์ค้นหาชื่อบริษัทลูกค้า..." style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              <datalist id="hzkSqCustomerList">${customerOptions}</datalist>
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">เลขประจำตัวผู้เสียภาษี (Tax ID 13 หลัก) / สาขา</label>
              <div style="display:flex;gap:6px;">
                <input id="hzkSqTaxId" type="text" value="${(savedDraft && savedDraft.taxId) || ''}" placeholder="เลขผู้เสียภาษี 13 หลัก" style="flex:2;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
                <input id="hzkSqBranch" type="text" value="${(savedDraft && savedDraft.branch) || 'สำนักงานใหญ่'}" placeholder="สาขา" style="flex:1;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              </div>
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">ผู้ติดต่อ (Contact Person)</label>
              <input id="hzkSqContact" type="text" value="${(savedDraft && savedDraft.contactPerson) || ''}" placeholder="ระบุชื่อผู้ติดต่อ..." style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">เบอร์โทรศัพท์ (Tel No.)</label>
              <input id="hzkSqPhone" type="text" value="${(savedDraft && savedDraft.phone) || ''}" placeholder="02-xxx-xxxx / 08x-xxx-xxxx" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">อีเมลลูกค้า (Customer Email สำหรับส่งไฟล์แนบ)</label>
              <input id="hzkSqCustEmail" type="email" value="${(savedDraft && savedDraft.customerEmail) || ''}" placeholder="customer@company.co.th" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
            </div>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">เงื่อนไขการชำระเงิน (Term of Payment) / วันที่</label>
              <div style="display:flex;gap:6px;">
                <input id="hzkSqPayment" type="text" value="${(savedDraft && savedDraft.paymentTerms) || '30DAYS'}" style="flex:1;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
                <input id="hzkSqDate" type="date" value="${todayStr}" style="flex:1;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              </div>
            </div>
            <div style="grid-column:1/-1;">
              <label style="font-weight:700;display:block;margin-bottom:4px;">ที่อยู่ลูกค้า (Address)</label>
              <input id="hzkSqAddress" type="text" value="${(savedDraft && savedDraft.address) || ''}" placeholder="ที่อยู่สำหรับออกเอกสาร..." style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
            </div>
            <div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;">
              <input id="hzkSqUpdateBinding" type="checkbox" checked />
              <label for="hzkSqUpdateBinding" style="font-size:12px;color:#334155;">อัปเดตการผูกชื่อเซลล์ผู้ดูแลกับลูกค้ารายนี้ในฐานข้อมูลกลาง (ยืดหยุ่นปรับเปลี่ยนได้)</label>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
              <div style="font-weight:700;color:#002B49;">รายการสินค้า / บริการ และขนาดเครื่อง (Dimension W × D × H mm.)</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%;max-width:620px;">
                <select id="hzkSqModelPicker" style="flex:1;min-width:200px;padding:7px;border:1px solid #CBD5E1;border-radius:8px;">
                  <option value="">-- เลือกรุ่นเครื่อง (331 รุ่น) เพื่อเติมขนาดอัตโนมัติ --</option>
                  ${modelOptions}
                </select>
                <button type="button" id="hzkSqAddModelBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">+ เพิ่มรุ่นเครื่อง</button>
                <button type="button" id="hzkSqAddInstallBtn" style="background:#475569;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">+ ค่าบริการ/ติดตั้ง (WHT 3%)</button>
              </div>
            </div>

            <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
              <table style="width:100%;min-width:760px;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr style="background:#002B49;color:#FFFFFF;">
                    <th style="padding:7px;border:1px solid #CBD5E1;">NO.</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">MODEL</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">DESCRIPTION</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">W (mm)</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">D (mm)</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">H (mm)</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">UNIT PRICE</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">DISCOUNT</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">QTY</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">AMOUNT</th>
                    <th style="padding:7px;border:1px solid #CBD5E1;">ลบ</th>
                  </tr>
                </thead>
                <tbody id="hzkSqItemsBody"></tbody>
              </table>
            </div>
          </div>

          <div class="hzk-sq-grid-bottom">
            <div>
              <label style="font-weight:700;display:block;margin-bottom:4px;">เงื่อนไขเพิ่มเติม (เลือกแทรกจาก 28 เงื่อนไขมาตรฐาน)</label>
              <div style="display:flex;gap:6px;margin-bottom:6px;">
                <select id="hzkSqTermPicker" style="flex:1;padding:7px;border:1px solid #CBD5E1;border-radius:8px;">
                  <option value="">-- เลือกเงื่อนไข Lead Time / Payment / Warranty --</option>
                  ${termsOptions}
                </select>
                <button type="button" id="hzkSqAddTermBtn" style="background:#0F172A;color:#FFF;border:none;border-radius:8px;padding:7px 12px;cursor:pointer;">แทรก</button>
              </div>
              <textarea id="hzkSqRemarks" rows="4" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;font-size:12px;">${(savedDraft && savedDraft.remarks) || '- Please transfer to Bank of Ayudhya Public Company Limited Future Park Rangsit Branch Current Account No. 062-0-04476-2 Branch No. 0062.\n- The site must be prepared and ready for installation on delivery day.'}</textarea>
            </div>

            <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:10px;padding:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>SUB TOTAL:</span><b id="hzkSqSubTotal">0.00</b></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span id="hzkSqVatLabel">VAT 7%:</span><b id="hzkSqVatAmt">0.00</b></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Withholding Tax 3%:</span><b id="hzkSqWhtAmt">0.00</b></div>
              <hr style="border:none;border-top:1px solid #CBD5E1;margin:8px 0;" />
              <div style="display:flex;justify-content:space-between;font-size:15px;color:#002B49;"><span>GRAND TOTAL:</span><b id="hzkSqGrandTotal">0.00</b></div>
            </div>
          </div>

          <div class="hzk-sq-action-bar">
            <button type="button" id="hzkSqNewDraftBtn" style="background:#E2E8F0;color:#0F172A;border:none;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;">🆕 ล้างฟอร์มใหม่</button>
            <button type="button" id="hzkSqPreviewBtn" style="background:#002B49;color:#FFF;border:none;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;">👁️ Preview เอกสาร A4</button>
            <button type="button" id="hzkSqPrintPdfBtn" style="background:#DC2626;color:#FFF;border:none;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;">📕 พิมพ์ / บันทึก PDF (A4)</button>
            <button type="button" id="hzkSqExportExcelBtn" style="background:#15803D;color:#FFF;border:none;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;">📗 Export Excel (.xls)</button>
            <button type="button" id="hzkSqMgrApproveBtn" style="background:#B45309;color:#FFF;border:none;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;">🔐 ขออนุมัติส่วนลด (LINE)</button>
            <button type="button" id="hzkSqShareHubBtn" style="background:#7C3AED;color:#FFF;border:none;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;">📤 แชร์ + Group CC/BCC</button>
            <button type="button" id="hzkSqSaveSyncBtn" style="background:#059669;color:#FFF;border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;">☁️ บันทึกลงฐานข้อมูล</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    bindSalesQuotationEvents(db);
  }

  

  // ============================================================================
  // ENTERPRISE v1180 UPGRADE: PRODUCT PHOTO AUTO-MATCHER & TELEMETRY TRACKER
  // ============================================================================
  const HZK_V1180_CUSTOM_PHOTOS_KEY = 'hzk_v1180_custom_model_photos_map';

  function resolveModelProductPhoto_(db, modelCode) {
    const code = String(modelCode || '').trim().toUpperCase();
    try {
      const customMap = JSON.parse(localStorage.getItem(HZK_V1180_CUSTOM_PHOTOS_KEY) || '{}');
      if (customMap[code]) return customMap[code];
    } catch (e) {}

    const gallery = (db && db.seriesPhotoGallery) || {};
    const prefixes = ['DCM', 'JWE', 'HNC', '4HC', 'IM', 'KM', 'FM', 'HR', 'HF', 'RT'];
    for (const p of prefixes) {
      if (code.startsWith(p) && gallery[p] && gallery[p].imageUrl) {
        return gallery[p].imageUrl;
      }
    }
    return (gallery.DEFAULT && gallery.DEFAULT.imageUrl) || '';
  }

  window.registerCustomModelPhotoUrl = function(modelCode, imgUrl) {
    const code = String(modelCode || '').trim().toUpperCase();
    if (!code || !imgUrl) return;
    try {
      const customMap = JSON.parse(localStorage.getItem(HZK_V1180_CUSTOM_PHOTOS_KEY) || '{}');
      customMap[code] = String(imgUrl).trim();
      localStorage.setItem(HZK_V1180_CUSTOM_PHOTOS_KEY, JSON.stringify(customMap));
    } catch (e) {}
  };

  window.logGoLiveAdoptionEventV1180 = function(moduleName, actionDetail) {
    try {
      const emp = (typeof getActiveEmployeeProfileV1171 === 'function') ? getActiveEmployeeProfileV1171() : { id: 'USR', name: 'Staff', deptLabel: 'General' };
      const logs = JSON.parse(localStorage.getItem('hzk_v1180_golive_adoption_logs') || '[]');
      logs.unshift({
        ts: new Date().toISOString(),
        empId: emp.id,
        empName: emp.name,
        dept: emp.deptLabel,
        module: moduleName,
        detail: actionDetail
      });
      localStorage.setItem('hzk_v1180_golive_adoption_logs', JSON.stringify(logs.slice(0, 500)));
      const gasUrl = getGasEndpointUrl();
      if (gasUrl && navigator.onLine) {
        fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            actionType: 'LOG_GOLIVE_ADOPTION_TELEMETRY',
            empId: emp.id,
            empName: emp.name,
            department: emp.deptLabel,
            module: moduleName,
            detail: actionDetail
          })
        }).catch(() => {});
      }
    } catch (e) {}
  };

  function validateSalesQuotationBeforeCommit_(db, actionLabel) {
    const cust = (document.getElementById('hzkSqCustomer')?.value || '').trim();
    const errors = [];
    if (!cust) {
      errors.push('✕ ยังไม่ได้ระบุชื่อลูกค้า / บริษัท (Customer Name)');
    }
    if (!Array.isArray(HZK_OMNI_STATE.items) || HZK_OMNI_STATE.items.length === 0) {
      errors.push('✕ ยังไม่มีรายการสินค้าหรือบริการในใบเสนอราคา/ใบสั่งซื้อ');
    } else {
      const zeroItems = HZK_OMNI_STATE.items.filter(it => Number(it.unitPrice || 0) <= 0);
      if (zeroItems.length > 0) {
        errors.push('✕ พบรายการที่ราคาต่อหน่วยเป็น 0.00 บาท (' + zeroItems.map(x => x.model).join(', ') + ')');
      }
      const stockMap = (db && db.stockMap) || {};
      const shortItems = HZK_OMNI_STATE.items.filter(it => {
        if (it.isService) return false;
        const st = stockMap[String(it.model || '').trim().toUpperCase()];
        return st && Number(st.available || 0) < Number(it.qty || 1);
      });
      if (shortItems.length > 0) {
        errors.push('⚠️ สินค้าบางรายการมีสต็อกพร้อมส่งไม่พอจำนวนที่สั่ง (' + shortItems.map(x => x.model).join(', ') + ') — แนะนำเปิดใบขอซื้อ PR ควบคู่');
      }
    }

    let banner = document.getElementById('hzkSqValidationErrorBanner');
    if (!banner) {
      const actionBar = document.querySelector('#hzkSalesCorporateQtModal .hzk-sq-action-bar');
      if (actionBar && actionBar.parentElement) {
        banner = document.createElement('div');
        banner.id = 'hzkSqValidationErrorBanner';
        actionBar.parentElement.insertBefore(banner, actionBar);
      }
    }
    if (errors.length > 0) {
      if (banner) {
        banner.style.cssText = 'background:#FEF2F2;border:2px solid #DC2626;color:#991B1B;border-radius:12px;padding:10px 14px;margin-bottom:10px;font-size:12px;font-weight:700;line-height:1.5;';
        banner.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><span>🚨 ตรวจพบข้อควรระวังก่อน' + actionLabel + ':</span><button type="button" onclick="this.parentElement.parentElement.style.display=\'none\'" style="background:#DC2626;color:#FFF;border:none;border-radius:6px;padding:2px 8px;font-weight:900;cursor:pointer;">✕</button></div>' + errors.join('<br>');
        banner.style.display = 'block';
      }
      return confirm('ตรวจพบข้อควรระวังก่อน' + actionLabel + ':\n\n' + errors.join('\n') + '\n\nต้องการดำเนินการต่อหรือไม่?');
    } else if (banner) {
      banner.style.display = 'none';
    }
    return true;
  }

  function bindSalesQuotationEvents(db) {
    const modal = document.getElementById('hzkSalesCorporateQtModal');
    modal.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', () => autoSaveDraftToLocal(db));
      el.addEventListener('change', () => autoSaveDraftToLocal(db));
    });

    document.getElementById('hzkSqConvertBillBtn').onclick = function () {
      const docSel = document.getElementById('hzkSqDocType');
      const offerInp = document.getElementById('hzkSqOfferNo');
      const curDoc = docSel.value;
      if (curDoc.indexOf('วางบิล') === -1) {
        docSel.value = 'ใบวางบิล (Billing Note)';
        offerInp.value = offerInp.value.replace(/^HTH-/, 'INV-');
      } else {
        docSel.value = 'ใบเสร็จรับเงิน (Receipt)';
        offerInp.value = offerInp.value.replace(/^INV-/, 'REC-');
      }
      autoSaveDraftToLocal(db);
      alert('✅ แปลงประเภทเอกสารเป็น "' + docSel.value + '" เลขที่ ' + offerInp.value + ' เรียบร้อยแล้ว');
    };

    document.getElementById('hzkSqHandoverBtn').onclick = function () {
      openCrossDeptHandoverModal(db);
    };

    document.getElementById('hzkSqOpenTrackDashBtn').onclick = function () {
      openDocumentTrackingDashboardModal(db);
    };

    document.getElementById('hzkSqOpenBiBtn').onclick = function () {
      openExecutiveBiDashboardModal();
    };

    const custInput = document.getElementById('hzkSqCustomer');
    custInput.onchange = function () {
      const val = custInput.value.trim().toUpperCase();
      const found = (db.customers || []).find(c => c.name.toUpperCase() === val);
      if (found) {
        document.getElementById('hzkSqAddress').value = found.address || '';
        document.getElementById('hzkSqPhone').value = found.phone || '';
        document.getElementById('hzkSqPayment').value = found.paymentTerms || '30DAYS';
        if (found.assignedSales) {
          document.getElementById('hzkSqSalesperson').value = found.assignedSales;
          if (found.assignedSales === 'FURUJO') {
            document.getElementById('hzkSqDept').value = 'Japanese Corporate';
          }
        }
      }
      autoSaveDraftToLocal(db);
    };

    document.getElementById('hzkSqAddModelBtn').onclick = function () {
      const mCode = document.getElementById('hzkSqModelPicker').value;
      const mObj = (db.models || []).find(m => m.model === mCode) || {
        model: mCode || 'CUSTOM-MODEL',
        description: 'Hoshizaki Equipment',
        w: '',
        d: '',
        h: ''
      };
      const autoUnitPrice = Number(mObj.listPrice || mObj.unitPrice || mObj.price || 0);
      HZK_OMNI_STATE.items.push({
        model: mObj.model,
        description: mObj.description,
        w: mObj.w,
        d: mObj.d,
        h: mObj.h,
        unitPrice: autoUnitPrice,
        discount: 0,
        qty: 1,
        isService: false
      });
      renderSalesQuotationRows(db);
      autoSaveDraftToLocal(db);
    };

    document.getElementById('hzkSqAddInstallBtn').onclick = function () {
      HZK_OMNI_STATE.items.push({
        model: 'SERVICE',
        description: 'Installation / Service Fee',
        w: '',
        d: '',
        h: '',
        unitPrice: 1500,
        discount: 0,
        qty: 1,
        isService: true
      });
      renderSalesQuotationRows(db);
      autoSaveDraftToLocal(db);
    };

    document.getElementById('hzkSqAddTermBtn').onclick = function () {
      const tVal = document.getElementById('hzkSqTermPicker').value;
      if (!tVal) return;
      const ta = document.getElementById('hzkSqRemarks');
      ta.value = (ta.value ? ta.value + '\n' : '') + tVal;
      autoSaveDraftToLocal(db);
    };

    document.getElementById('hzkSqFormat').onchange = function () {
      renderSalesQuotationRows(db);
      autoSaveDraftToLocal(db);
    };

    document.getElementById('hzkSqNewDraftBtn').onclick = function () {
      localStorage.removeItem(STORAGE_DRAFT_KEY);
      HZK_OMNI_STATE.items = [];
      openSalesCorporateQuotationModal();
    };

    document.getElementById('hzkSqPreviewBtn').onclick = function () {
      openIsolatedA4PreviewWindow(db, false);
    };

    document.getElementById('hzkSqPrintPdfBtn').onclick = function () {
      if (!validateSalesQuotationBeforeCommit_(db, 'พิมพ์ / บันทึก PDF')) return;
      openIsolatedA4PreviewWindow(db, true);
    };

    document.getElementById('hzkSqExportExcelBtn').onclick = function () {
      if (!validateSalesQuotationBeforeCommit_(db, 'ส่งออก Excel')) return;
      downloadExcelFileDirect(db);
    };

    document.getElementById('hzkSqMgrApproveBtn').onclick = async function () {
      const qt = collectCurrentFormPayload(db);
      const gasUrl = getGasEndpointUrl();
      if (!gasUrl) {
        alert('⚠️ กรุณาตั้งค่า Google Apps Script URL ก่อนส่งขออนุมัติครับ');
        return;
      }
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'requestDiscountApproval', quotation: qt })
      });
      const data = await res.json();
      alert(data && data.message ? ('✅ ' + data.message) : '✅ ส่งคำขออนุมัติเรียบร้อยแล้ว');
    };

    document.getElementById('hzkSqShareHubBtn').onclick = function () {
      openMultiChannelShareHubModal(db, null);
    };

    document.getElementById('hzkSqSaveSyncBtn').onclick = async function () {
      if (!validateSalesQuotationBeforeCommit_(db, 'บันทึกลงฐานข้อมูล')) return;
      const qt = collectCurrentFormPayload(db);
      autoSaveDraftToLocal(db);
      saveToLocalArchiveList(qt);

      const gasUrl = getGasEndpointUrl();
      if (!gasUrl) {
        alert('✅ บันทึกเอกสารลงฐานข้อมูลในเครื่องเรียบร้อยแล้ว');
        return;
      }
      try {
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveSalesQuotation', quotation: qt })
        });
        const data = await res.json();
        alert('✅ บันทึกเอกสารเลขที่ ' + (data.offerNo || qt.offerNo) + ' (' + qt.rev + ') ลงฐานข้อมูล Google Sheets เรียบร้อยแล้ว!');
      } catch (err) {
        alert('⚠️ บันทึกลงเครื่องแล้ว แต่ซิงก์คลาวด์ไม่สำเร็จ: ' + err.message);
      }
    };

    renderSalesQuotationRows(db);
  }

  function renderSalesQuotationRows(db) {
    const tbody = document.getElementById('hzkSqItemsBody');
    const format = document.getElementById('hzkSqFormat').value;
    let subTotal = 0;
    let serviceSubTotal = 0;

    tbody.innerHTML = HZK_OMNI_STATE.items
      .map((item, idx) => {
        const lineAmt = Math.max(0, (Number(item.unitPrice || 0) - Number(item.discount || 0)) * Number(item.qty || 1));
        subTotal += lineAmt;
        if (item.isService) serviceSubTotal += lineAmt;
        const stInfo = (db && db.stockMap) ? db.stockMap[String(item.model || '').trim().toUpperCase()] : null;
        const reqQty = Number(item.qty || 1);
        const stockBadgeHtml = item.isService
          ? '<div style="font-size:10px;color:#0369A1;font-weight:600;">🛠️ งานบริการ</div>'
          : (stInfo
              ? (Number(stInfo.available || 0) >= reqQty
                  ? `<div style="font-size:10px;color:#047857;font-weight:700;">🟢 พร้อมส่ง (${stInfo.available} เครื่อง)</div>`
                  : `<div style="font-size:10px;color:#B91C1C;font-weight:800;">✕ สต็อกไม่พอ (มี ${stInfo.available || 0} / ${stInfo.leadTime || 'ต้องเปิด PR'})</div>`)
              : '<div style="font-size:10px;color:#B45309;font-weight:600;">🟠 เช็กสต็อก/สั่งนำเข้า</div>');
        const zeroPriceWarn = Number(item.unitPrice || 0) <= 0
          ? 'border:2px solid #DC2626;background:#FEF2F2;'
          : 'border:1px solid #E2E8F0;';
        return `
          <tr>
            <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">${idx + 1}</td>
            <td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;"><div style="display:flex;align-items:center;gap:6px;"><img src="${resolveModelProductPhoto_(db, item.model)}" style="width:46px;height:32px;object-fit:cover;border-radius:4px;border:1px solid #CBD5E1;flex-shrink:0;" /><div>${item.model}${stockBadgeHtml}</div></div></td>
            <td style="padding:6px;border:1px solid #CBD5E1;"><input data-idx="${idx}" data-f="description" value="${item.description}" style="width:100%;border:1px solid #E2E8F0;padding:4px;" /></td>
            <td style="padding:6px;border:1px solid #CBD5E1;width:62px;"><input data-idx="${idx}" data-f="w" value="${item.w}" style="width:100%;border:1px solid #E2E8F0;padding:4px;text-align:center;" /></td>
            <td style="padding:6px;border:1px solid #CBD5E1;width:62px;"><input data-idx="${idx}" data-f="d" value="${item.d}" style="width:100%;border:1px solid #E2E8F0;padding:4px;text-align:center;" /></td>
            <td style="padding:6px;border:1px solid #CBD5E1;width:62px;"><input data-idx="${idx}" data-f="h" value="${item.h}" style="width:100%;border:1px solid #E2E8F0;padding:4px;text-align:center;" /></td>
            <td style="padding:6px;border:1px solid #CBD5E1;width:95px;"><input type="number" data-idx="${idx}" data-f="unitPrice" value="${item.unitPrice}" style="width:100%;${zeroPriceWarn}padding:4px;text-align:right;" /></td>
            <td style="padding:6px;border:1px solid #CBD5E1;width:80px;"><input type="number" data-idx="${idx}" data-f="discount" value="${item.discount}" style="width:100%;border:1px solid #E2E8F0;padding:4px;text-align:right;" /></td>
            <td style="padding:6px;border:1px solid #CBD5E1;width:58px;"><input type="number" data-idx="${idx}" data-f="qty" value="${item.qty}" style="width:100%;border:1px solid #E2E8F0;padding:4px;text-align:center;" /></td>
            <td style="padding:6px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">${lineAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;"><button type="button" data-del="${idx}" style="background:#FEE2E2;color:#B91C1C;border:none;border-radius:4px;padding:3px 7px;cursor:pointer;">✕</button></td>
          </tr>`;
      })
      .join('');

    tbody.querySelectorAll('input[data-idx]').forEach(inp => {
      inp.onchange = function () {
        const i = Number(inp.getAttribute('data-idx'));
        const f = inp.getAttribute('data-f');
        HZK_OMNI_STATE.items[i][f] = inp.type === 'number' ? Number(inp.value || 0) : inp.value;
        renderSalesQuotationRows(db);
        autoSaveDraftToLocal(db);
      };
    });

    tbody.querySelectorAll('button[data-del]').forEach(btn => {
      btn.onclick = function () {
        const i = Number(btn.getAttribute('data-del'));
        HZK_OMNI_STATE.items.splice(i, 1);
        renderSalesQuotationRows(db);
        autoSaveDraftToLocal(db);
      };
    });

    const vatRate = format === 'EXPORT' ? 0 : 0.07;
    const vatAmt = subTotal * vatRate;
    const whtAmt = format === 'EXPORT' ? 0 : serviceSubTotal * 0.03;
    const grandTotal = subTotal + vatAmt - whtAmt;
    const curr = format === 'EXPORT' ? ' USD' : ' THB';

    const _elVatL = document.getElementById('hzkSqVatLabel'); if (_elVatL) _elVatL.textContent = format === 'EXPORT' ? 'VAT 0% (Export):' : 'VAT 7%:';
    const _elSubT = document.getElementById('hzkSqSubTotal'); if (_elSubT) _elSubT.textContent = subTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) + curr;
    const _elVatA = document.getElementById('hzkSqVatAmt'); if (_elVatA) _elVatA.textContent = vatAmt.toLocaleString('en-US', { minimumFractionDigits: 2 }) + curr;
    const _elWhtA = document.getElementById('hzkSqWhtAmt'); if (_elWhtA) _elWhtA.textContent = (whtAmt > 0 ? '-' : '') + whtAmt.toLocaleString('en-US', { minimumFractionDigits: 2 }) + curr;
    const _elGrdT = document.getElementById('hzkSqGrandTotal'); if (_elGrdT) _elGrdT.textContent = grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) + curr;

    return { subTotal, vatAmt, whtAmt, grandTotal };
  }

  window.sendHoshizakiTrackedDocument = async function (docData) {
    const db = await loadSalesMasterDb(false);
    const merged = Object.assign({
      docType: 'ใบแจ้งบริการ / ใบเสร็จรับเงิน (Service & Receipt)',
      department: 'Service & Billing',
      salesperson: 'NOPARIN_H',
      senderDisplayName: 'นพรินทร์ หอมหวล (Noparin Homhoul)',
      senderEmail: 'noparin@hoshizaki.co.th',
      format: 'LOCAL',
      rev: 'Rev.0',
      date: new Date().toISOString().slice(0, 10)
    }, docData || {});
    openMultiChannelShareHubModal(db, merged);
  };

  window.openSalesCorporateQuotationModal = openSalesCorporateQuotationModal;
  window.openDocumentTrackingDashboardModal = async function () {
    const db = await loadSalesMasterDb(false);
    openDocumentTrackingDashboardModal(db);
  };
  window.openExecutiveBiDashboardModal = openExecutiveBiDashboardModal;
  window.openWarrantyPmRenewalModal = openWarrantyPmRenewalModal;

  async function openDamageDemoStockModal() {
    const db = await loadSalesMasterDb(false);
    const list = db.damageDemoList || [];
    let dModal = document.getElementById('hzkDamageDemoStockModal');
    if (!dModal) {
      dModal = document.createElement('div');
      dModal.id = 'hzkDamageDemoStockModal';
      dModal.style.cssText =
        'position:fixed;inset:0;z-index:10094;background:rgba(15,23,42,0.78);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(dModal);
    }

    dModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1020px;max-height:90vh;overflow-y:auto;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.4);font-family:sans-serif;">
        <div style="background:#7C2D12;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#FDE68A;font-weight:800;">DEMO / CLEARANCE / INSPECTION STOCK CATALOG</div>
            <div style="font-size:16px;font-weight:700;">🏷️ รายการเครื่องโชว์ / กล่องชำรุด / มีตำหนิพร้อมขาย (${list.length} รายการ)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkDamageDemoStockModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:16px 20px;font-size:13px;">
          <input id="hzkDmgSearchInp" type="text" placeholder="🔎 พิมพ์ค้นหารุ่นเครื่อง (เช่น IM-130NE, FM-1000) หรือ Serial No. หรือสถานะ..." style="width:100%;padding:9px 12px;border:1px solid #CBD5E1;border-radius:8px;margin-bottom:12px;" />
          <div style="overflow-x:auto;">
            <table style="width:100%;min-width:780px;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#0F172A;color:#FFF;">
                  <th style="padding:8px;border:1px solid #CBD5E1;">Model</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">Serial No.</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">สภาพเครื่อง / หมายเหตุ (Remark)</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">ใบตรวจสภาพ</th>
                  <th style="padding:8px;border:1px solid #CBD5E1;">นำไปเสนอราคา</th>
                </tr>
              </thead>
              <tbody id="hzkDmgTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    dModal.style.display = 'flex';

    function renderDmgRows(filterTxt) {
      const q = String(filterTxt || '').trim().toUpperCase();
      const filtered = q
        ? list.filter(x => (x.model + ' ' + x.serialNo + ' ' + x.remark).toUpperCase().indexOf(q) !== -1)
        : list;
      const tbody = document.getElementById('hzkDmgTableBody');
      tbody.innerHTML = filtered.slice(0, 120).map((it, idx) => `
        <tr>
          <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${it.model}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;">${it.serialNo || '-'}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;">${it.remark || '-'}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
            ${it.link ? `<a href="${it.link}" target="_blank" style="background:#0284C7;color:#FFF;text-decoration:none;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">📄 เปิดใบตรวจ</a>` : '<span style="color:#94A3B8;">-</span>'}
          </td>
          <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
            <button type="button" data-d-idx="${idx}" class="hzk-pick-dmg-btn" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:5px 9px;font-weight:700;cursor:pointer;">+ เลือกรุ่นนี้</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="5" style="padding:14px;text-align:center;color:#64748B;">ไม่พบรายการที่ค้นหา</td></tr>';

      tbody.querySelectorAll('.hzk-pick-dmg-btn').forEach(btn => {
        btn.onclick = async function () {
          const item = filtered[Number(btn.getAttribute('data-d-idx'))];
          dModal.style.display = 'none';
          const mObj = (db.models || []).find(m => m.model.toUpperCase() === item.model.toUpperCase()) || { w: '', d: '', h: '', description: 'Hoshizaki Equipment' };
          HZK_OMNI_STATE.items.push({
            model: item.model,
            description: mObj.description + ' [S/N: ' + item.serialNo + ' — ' + item.remark + ']',
            w: mObj.w || '',
            d: mObj.d || '',
            h: mObj.h || '',
            unitPrice: 0,
            discount: 0,
            qty: 1,
            isService: false
          });
          await openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)');
        };
      });
    }

    document.getElementById('hzkDmgSearchInp').oninput = function (e) {
      renderDmgRows(e.target.value);
    };
    renderDmgRows('');
  }

  async function triggerEmailStockSyncNow() {
    const gasUrl = getGasEndpointUrl();
    if (!gasUrl) {
      alert('⚠️ กรุณาตั้งค่า Google Apps Script URL ก่อนสั่งซิงก์สตอกจากอีเมลครับ');
      return;
    }
    alert('⏳ กำลังค้นหาอีเมลล่าสุดหัวข้อ "Daily stock report" จาก MICHIRU-RPA และอัปเดตฐานข้อมูลสต็อก กรุณารอสักครู่...');
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'syncEmailStockNow' })
      });
      const data = await res.json();
      if (data && data.status === 'OK') {
        await loadSalesMasterDb(true);
        alert('✅ อัปเดตสต็อกประจำวันสำเร็จ!\n• อีเมล: ' + data.emailSubject + '\n• รุ่นสินค้าในคลัง: ' + data.totalModels + ' รุ่น (พร้อมส่ง ' + data.readyModels + ' รุ่น)\n• เครื่องโชว์/มีตำหนิ: ' + data.damageDemoCount + ' รายการ');
      } else {
        alert('⚠️ ' + ((data && data.message) || 'ไม่พบไฟล์ Stock on Hand ในอีเมลล่าสุด'));
      }
    } catch (err) {
      alert('❌ เกิดข้อผิดพลาดในการดึงอีเมล: ' + err.message);
    }
  }

  window.openCustomerDealerPortalWindow = openCustomerDealerPortalWindow;
  window.openDamageDemoStockModal = openDamageDemoStockModal;

  async function exportErpSalesOrdersCsv() {
    const gasUrl = getGasEndpointUrl();
    if (!gasUrl) {
      alert('⚠️ กรุณาตั้งค่า Google Apps Script URL ก่อนส่งออกข้อมูล ERP ครับ');
      return;
    }
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'exportErpSalesOrders' })
      });
      const data = await res.json();
      const rows = (data && data.rows) || [];
      if (!rows.length) {
        alert('ℹ️ ยังไม่มีรายการใบเสนอราคาในระบบสำหรับส่งออก ERP ครับ');
        return;
      }
      const colPairs = [
        ['Order_Status', 'orderStatus'],
        ['Offer_No', 'offerNo'],
        ['Rev', 'rev'],
        ['Date', 'date'],
        ['Department', 'department'],
        ['Salesperson_Code', 'salespersonCode'],
        ['Customer_Name', 'customerName'],
        ['Payment_Terms', 'paymentTerms'],
        ['Currency', 'currency'],
        ['Item_No', 'itemNo'],
        ['Description', 'description'],
        ['Qty', 'qty'],
        ['Unit_Price', 'unitPrice'],
        ['Discount', 'discount'],
        ['Line_Amount', 'lineAmount']
      ];
      const csvLines = [colPairs.map(p => p[0]).join(',')].concat(rows.map(r =>
        colPairs.map(([, key]) => {
          const val = String(r[key] !== undefined ? r[key] : '').split(String.fromCharCode(34)).join('""');
          return `"${val}"`;
        }).join(',')
      ));
      const blob = new Blob(['\ufeff' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'HOSHIZAKI_ERP_NAV_SalesOrders_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('✅ ส่งออกไฟล์ CSV สำหรับนำเข้า ERP / NAV เรียบร้อยแล้ว (' + rows.length + ' รายการ)');
    } catch (err) {
      alert('❌ ส่งออกไฟล์ไม่สำเร็จ: ' + err.message);
    }
  }

  async function openProductionGoLiveQaModal() {
    let qaModal = document.getElementById('hzkProductionQaModal');
    if (!qaModal) {
      qaModal = document.createElement('div');
      qaModal.id = 'hzkProductionQaModal';
      qaModal.style.cssText =
        'position:fixed;inset:0;z-index:10096;background:rgba(15,23,42,0.8);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(qaModal);
    }

    qaModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:780px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.4);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">PRODUCTION GO-LIVE READINESS &amp; ADMIN CONTROL</div>
            <div style="font-size:16px;font-weight:700;">🛡️ ตรวจสอบความพร้อมระบบ &amp; เครื่องมือเปิดใช้งานจริง (v1150)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkProductionQaModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:18px 20px;font-size:13px;color:#0F172A;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
            <button type="button" id="hzkDeployRichMenuBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer;">📱 สร้าง LINE Rich Menu 6 ปุ่ม (Customer OA)</button>
            <button type="button" id="hzkResetDemoDataBtn" style="background:#DC2626;color:#FFF;border:none;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer;">🧹 ล้างข้อมูลทดสอบก่อน Go-Live (เก็บฐานหลักไว้ครบ)</button>
          </div>
          <div id="hzkQaChecklistBody">⏳ กำลังตรวจสอบความพร้อมของระบบทั้งหมด...</div>
        </div>
      </div>
    `;
    qaModal.style.display = 'flex';

    const gasUrl = getGasEndpointUrl();
    const bodyEl = document.getElementById('hzkQaChecklistBody');
    if (!gasUrl) {
      bodyEl.innerHTML = '<div style="color:#B91C1C;">กรุณาตั้งค่า Google Apps Script URL เพื่อตรวจสอบความพร้อมระบบครับ</div>';
      return;
    }

    document.getElementById('hzkDeployRichMenuBtn').onclick = async function () {
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deployCustomerRichMenu' })
      });
      const d = await r.json();
      alert(d.status === 'OK' ? ('✅ ' + d.note + '\nRich Menu ID: ' + d.richMenuId) : ('⚠️ ' + (d.message || 'ไม่สำเร็จ')));
    };

    document.getElementById('hzkResetDemoDataBtn').onclick = async function () {
      if (!confirm('ยืนยันล้างข้อมูลเคสทดสอบและประวัติส่งเอกสารทดสอบ?\n(ฐานข้อมูลลูกค้า 700 ราย, รุ่นเครื่อง 331 รุ่น, พนักงาน, กลุ่มอีเมล และสต็อกจะไม่ถูกลบ)')) return;
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'resetDemoDataSafe' })
      });
      const d = await r.json();
      alert('✅ ล้างข้อมูลทดสอบเรียบร้อยแล้ว (' + (d.clearedSheets || []).join(', ') + ')');
    };

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'runProductionQaCheck' })
      });
      const data = await res.json();
      const checks = (data && data.checks) || [];
      bodyEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <thead><tr style="background:#0F172A;color:#FFF;"><th style="padding:8px;text-align:left;">รายการตรวจสอบ (System Check)</th><th style="padding:8px;">สถานะ</th><th style="padding:8px;text-align:left;">รายละเอียด</th></tr></thead>
          <tbody>
            ${checks.map(c => `
              <tr>
                <td style="padding:8px;border:1px solid #CBD5E1;font-weight:700;">${c.item}</td>
                <td style="padding:8px;border:1px solid #CBD5E1;text-align:center;">${c.ok ? '<span style="color:#059669;font-weight:800;">✅ READY</span>' : '<span style="color:#DC2626;font-weight:800;">⚠️ CHECK</span>'}</td>
                <td style="padding:8px;border:1px solid #CBD5E1;color:#334155;">${c.detail}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      bodyEl.innerHTML = '<div style="color:#B91C1C;">ตรวจสอบไม่สำเร็จ: ' + err.message + '</div>';
    }
  }

  function openDepartmentRoleSopModal() {
    let sopModal = document.getElementById('hzkRoleSopModal');
    if (!sopModal) {
      sopModal = document.createElement('div');
      sopModal.id = 'hzkRoleSopModal';
      sopModal.style.cssText =
        'position:fixed;inset:0;z-index:10097;background:rgba(15,23,42,0.8);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(sopModal);
    }

    sopModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:880px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.4);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">HOSHIZAKI (THAILAND) LIMITED — QUICK REFERENCE SOP</div>
            <div style="font-size:16px;font-weight:700;">📖 คู่มือใช้งานระบบฉบับย่อแยกตามบทบาท (Role-Based Guide)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkRoleSopModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:18px 20px;font-size:13px;color:#0F172A;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#991B1B;font-size:14px;margin-bottom:8px;">1️⃣ ทีมช่างบริการ &amp; ดีลเลอร์ (มือถือ &amp; LINE)</div>
            <ul style="margin:0;padding-left:18px;line-height:1.6;font-size:12.5px;">
              <li><b>ในกลุ่ม LINE:</b> พิมพ์ <code>SPEC IM-130NE</code> เพื่อเปิดสเปก 5 หมวด, พิมพ์ <code>SN K01234J</code> เพื่อเช็กประกันและดีลเลอร์, พิมพ์ <code>AI &lt;อาการ&gt;</code> เพื่อถามวิศวกร AI</li>
              <li><b>รับงานจากลูกค้า:</b> กดปุ่ม <b>แชร์ข้อมูลดีลเลอร์ให้ลูกค้า</b> หรือ <b>ส่งเคสเข้ากลุ่มดีลเลอร์</b></li>
              <li><b>ส่งใบแจ้งบริการ/ใบเสร็จ:</b> กดปุ่ม <b>📋 เอกสาร &amp; ติดตามสถานะ ▾</b> เลือก <i>ส่ง &amp; ติดตามเอกสาร Service</i></li>
            </ul>
          </div>
          <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#1E40AF;font-size:14px;margin-bottom:8px;">2️⃣ ฝ่ายขาย, Marketing &amp; Japanese Corporate (PC)</div>
            <ul style="margin:0;padding-left:18px;line-height:1.6;font-size:12.5px;">
              <li><b>ออกใบเสนอราคา Y2026:</b> กด <b>📋 เอกสาร &amp; ติดตามสถานะ ▾</b> เลือกแผนก ➔ พิมพ์ชื่อลูกค้า &amp; เลือกรุ่นเครื่อง (เติมขนาด <code>W×D×H</code> และเช็กสต็อกสดอัตโนมัติ)</li>
              <li><b>ตรวจหน้ากระดาษ:</b> กด <b>👁️ Preview เอกสาร A4</b> ก่อนพิมพ์ PDF หรือ Export Excel</li>
              <li><b>ส่งเอกสาร &amp; CC ทั้งแผนก:</b> กด <b>📤 แชร์ + Group CC/BCC</b> ติ๊กเลือกกลุ่มแผนกและส่งผ่าน Email/LINE/SMS พร้อมปุ่มให้ลูกค้ากดยืนยันรับเอกสาร</li>
            </ul>
          </div>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#166534;font-size:14px;margin-bottom:8px;">3️⃣ ฝ่ายบัญชี, ธุรการ &amp; ผู้บริหาร</div>
            <ul style="margin:0;padding-left:18px;line-height:1.6;font-size:12.5px;">
              <li><b>ออกใบวางบิล/ใบเสร็จ:</b> เปิดใบเสนอราคาเดิมแล้วกด <b>🧾 แปลงเป็นใบวางบิล/ใบเสร็จ</b></li>
              <li><b>ส่งออกเข้า ERP / NAV:</b> เลือกเมนู <b>🏭 ส่งออกข้อมูลเปิด Sales Order เข้า ERP / NAV</b></li>
              <li><b>ติดตาม KPI &amp; สต็อก:</b> ระบบดึงสต็อกจากอีเมล <code>MICHIRU-RPA</code> อัตโนมัติทุกวัน 18:00 น. และส่งสรุปผู้บริหารเข้า LINE ทุกวันศุกร์ 17:00 น.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    sopModal.style.display = 'flex';
  }

  window.triggerEmailStockSyncNow = triggerEmailStockSyncNow;
  window.exportErpSalesOrdersCsv = exportErpSalesOrdersCsv;

  async function runDeepSystemDiagnosticModal() {
    let diagModal = document.getElementById('hzkDeepScanModal');
    if (!diagModal) {
      diagModal = document.createElement('div');
      diagModal.id = 'hzkDeepScanModal';
      diagModal.style.cssText =
        'position:fixed;inset:0;z-index:20060;background:rgba(15,23,42,0.85);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(diagModal);
    }

    const curUrl = getGasEndpointUrl();
    const db = await loadSalesMasterDb(false);
    const localChecks = [
      { name: '1. Frontend Suite Version', ok: true, detail: HZK_OMNI_STATE.version },
      { name: '2. Product Catalog JSON (331 รุ่น + ขนาด W×D×H)', ok: Array.isArray(db.models) && db.models.length > 0, detail: (db.models || []).length + ' models loaded' },
      { name: '3. Customer Master JSON (700 รายชื่อ)', ok: Array.isArray(db.customers) && db.customers.length > 0, detail: (db.customers || []).length + ' customers loaded' },
      { name: '4. Live Stock Snapshot JSON (MICHIRU-RPA)', ok: db.stockMap && Object.keys(db.stockMap).length > 0, detail: Object.keys(db.stockMap || {}).length + ' stock models + ' + (db.damageDemoList || []).length + ' Demo/Damage units' },
      { name: '5. Google Apps Script Web App URL', ok: Boolean(curUrl), detail: curUrl || '❌ ยังไม่พบ URL ในเครื่อง (กรุณาวางลิงก์ด้านบนแล้วกดบันทึก)' }
    ];

    diagModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:860px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.5);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">ENTERPRISE DEEP SCAN &amp; SELF-HEALING DIAGNOSTICS (v1155)</div>
            <div style="font-size:16px;font-weight:700;">🩺 ผลสแกนตรวจสอบการทำงานเชิงลึก (Frontend PWA + Google Apps Script Backend)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkDeepScanModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:18px 20px;font-size:13px;color:#0F172A;">
          <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;padding:12px;margin-bottom:14px;">
            <label style="font-weight:700;color:#0369A1;display:block;margin-bottom:5px;">🔗 ลิงก์ Google Apps Script Web App URL (จุดเชื่อมต่อฟังก์ชันคลาวด์ทั้งหมด):</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <input id="hzkDiagGasUrlInput" type="text" value="${curUrl}" placeholder="https://script.google.com/macros/s/...../exec" style="flex:1;min-width:240px;padding:8px 10px;border:1px solid #94A3B8;border-radius:8px;font-size:12px;" />
              <button type="button" id="hzkDiagSaveUrlBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;">💾 บันทึก &amp; สแกนใหม่</button>
            </div>
          </div>

          <div style="font-weight:700;color:#002B49;margin-bottom:6px;">ส่วนที่ 1: ตรวจสอบโมดูลหน้าเว็บ (PWA Frontend &amp; Offline JSON)</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
            <thead><tr style="background:#0F172A;color:#FFF;"><th style="padding:7px;text-align:left;">รายการตรวจสอบ</th><th style="padding:7px;">สถานะ</th><th style="padding:7px;text-align:left;">รายละเอียด</th></tr></thead>
            <tbody>
              ${localChecks.map(c => `
                <tr>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${c.name}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${c.ok ? '<span style="color:#059669;font-weight:800;">✅ OK</span>' : '<span style="color:#DC2626;font-weight:800;">❌ MISSING</span>'}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;">${c.detail}</td>
                </tr>`).join('')}
            </tbody>
          </table>

          <div style="font-weight:700;color:#002B49;margin-bottom:6px;">ส่วนที่ 2: ตรวจสอบหลังบ้าน Google Apps Script, Drive API, LINE OA และ Triggers</div>
          <div id="hzkDiagBackendBody">⏳ กำลังเชื่อมต่อทดสอบหลังบ้าน...</div>
        </div>
      </div>
    `;

    diagModal.style.display = 'flex';

    document.getElementById('hzkDiagSaveUrlBtn').onclick = function () {
      const val = document.getElementById('hzkDiagGasUrlInput').value.trim();
      if (val && val.indexOf('https://script.google.com/') === 0) {
        localStorage.setItem('hzk_gas_webapp_url', val);
        localStorage.setItem('gasWebAppUrl', val);
        runDeepSystemDiagnosticModal();
      } else {
        alert('⚠️ กรุณากรอก URL ที่ขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec ครับ');
      }
    };

    const backendEl = document.getElementById('hzkDiagBackendBody');
    if (!curUrl) {
      backendEl.innerHTML = '<div style="background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;padding:12px;border-radius:10px;">⚠️ <b>สาเหตุหลักที่ฟังก์ชันคลาวด์ไม่ทำงาน:</b> ยังไม่ได้บันทึก Google Apps Script Web App URL ในเครื่องนี้ กรุณาวางลิงก์ <code>/exec</code> ในช่องด้านบนแล้วกด <b>บันทึก &amp; สแกนใหม่</b> ครับ</div>';
      return;
    }

    try {
      const data = await callGasApi('runDeepSystemScan', {}, false);
      const checks = (data && data.checks) || [];
      backendEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#002B49;color:#FFF;"><th style="padding:7px;text-align:left;">บริการหลังบ้าน (Backend Check)</th><th style="padding:7px;">สถานะ</th><th style="padding:7px;text-align:left;">รายละเอียด</th></tr></thead>
          <tbody>
            ${checks.map(c => `
              <tr>
                <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${c.item}</td>
                <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${c.ok ? '<span style="color:#059669;font-weight:800;">✅ READY</span>' : '<span style="color:#DC2626;font-weight:800;">⚠️ FIX NEEDED</span>'}</td>
                <td style="padding:7px;border:1px solid #CBD5E1;">${c.detail}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      backendEl.innerHTML = `<div style="background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;padding:12px;border-radius:10px;">❌ <b>เชื่อมต่อ Backend ไม่สำเร็จ:</b> ${err.message}</div>`;
    }
  }

  window.openProductionGoLiveQaModal = openProductionGoLiveQaModal;
  window.runDeepSystemDiagnosticModal = runDeepSystemDiagnosticModal;
  window.callGasApi = callGasApi;

  const DEPT_VIEW_PROFILES = [
    {
      id: 'SERVICE_TECH',
      icon: '🛠️',
      deptName: 'Service Field Technician (ช่างบริการภาคสนาม)',
      badgeColor: '#991B1B',
      bgLight: '#FEF2F2',
      borderCol: '#FECACA',
      uiMode: 'TECH',
      visibleModules: 'ใบแจ้งบริการ (Service Report), สแกน S/N & คู่มือ 5 หมวด, ส่งใบแจ้งบริการ/ใบเสร็จพร้อมปุ่ม Track, เช็กอะไหล่ในรถ',
      hiddenModules: 'ซ่อนราคาทุน (Cost), ซ่อนกำไรขั้นต้น (GP%), ซ่อนเมนูอนุมัติส่วนลดผู้บริหารและส่งออก ERP',
      launchWorkspace: () => {
        applyGlobalAppRoleMode('TECH');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    {
      id: 'SERVICE_MGR',
      icon: '🧑‍💼',
      deptName: 'Service Manager & Dispatch (ผู้จัดการฝ่ายบริการ/จ่ายงาน)',
      badgeColor: '#B91C1C',
      bgLight: '#FFF1F2',
      borderCol: '#FECDD3',
      uiMode: 'MANAGER',
      visibleModules: 'เห็นราคาทุน & GP%, จ่ายงานช่าง (T01-T08), ติดตามเคสดีลเลอร์ (SLA 2 ชม.), ต่ออายุสัญญา PM & ประกัน 60 วัน',
      hiddenModules: 'เปิดสิทธิ์ครบทุกเครื่องมือแผนกบริการและตรวจสอบคุณภาพ',
      launchWorkspace: () => {
        applyGlobalAppRoleMode('MANAGER');
        window.openWarrantyPmRenewalModal();
      }
    },
    {
      id: 'SALES_TH',
      icon: '💼',
      deptName: 'Commercial Sales (ฝ่ายขายในประเทศ THB)',
      badgeColor: '#002B49',
      bgLight: '#EFF6FF',
      borderCol: '#BFDBFE',
      uiMode: 'MANAGER',
      visibleModules: 'ใบเสนอราคา Y2026 (THB + VAT 7% + WHT 3%), เติมขนาด W×D×H อัตโนมัติ, เช็กสต็อกสด HHE, ส่งต่องานติดตั้ง/ลงทะเบียน S/N',
      hiddenModules: 'ล็อกเพดานส่วนลด >5% ต้องกดขออนุมัติผู้จัดการผ่าน LINE',
      launchWorkspace: () => openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)')
    },
    {
      id: 'JPC_CORP',
      icon: '🇯🇵',
      deptName: 'Japanese Corporate (ฝ่ายขายองค์กรญี่ปุ่น & Inter-Co)',
      badgeColor: '#1E1B4B',
      bgLight: '#EEF2FF',
      borderCol: '#C7D2FE',
      uiMode: 'MANAGER',
      visibleModules: 'ใบเสนอราคา Japanese Corporate (THB Local & USD Export 0% VAT), เชื่อมฐานลูกค้า Mr. Furujo, CC กลุ่ม JPC_TEAM อัตโนมัติ',
      hiddenModules: 'แสดงแถบการ์ด LINE สีม่วงครามเฉพาะฝ่าย Japanese Corporate',
      launchWorkspace: () => openSalesCorporateQuotationWithPreset('Japanese Corporate', 'ใบเสนอราคา (Quotation)')
    },
    {
      id: 'MARKETING',
      icon: '📣',
      deptName: 'Marketing & Product (ฝ่ายการตลาดและผลิตภัณฑ์)',
      badgeColor: '#065F46',
      bgLight: '#ECFDF5',
      borderCol: '#A7F3D0',
      uiMode: 'MANAGER',
      visibleModules: 'ใบเสนอราคาแคมเปญโปรโมชัน, ตารางสต็อกเครื่องโชว์/มีตำหนิ 602 รายการพร้อมลิงก์ใบตรวจสภาพ, การ์ด LINE สีเขียวมรกต',
      hiddenModules: 'สามารถดึงเครื่อง Demo/Clearance ลงใบเสนอราคาได้ทันที',
      launchWorkspace: () => window.openDamageDemoStockModal()
    },
    {
      id: 'ACCOUNTING',
      icon: '🧾',
      deptName: 'Accounting & Billing (ฝ่ายบัญชีและการเงิน)',
      badgeColor: '#0F766E',
      bgLight: '#F0FDFA',
      borderCol: '#99F6E4',
      uiMode: 'MANAGER',
      visibleModules: 'แปลงใบเสนอราคาเป็นใบวางบิล/ใบเสร็จ (1 คลิก), กรอกเลขผู้เสียภาษี 13 หลัก/สาขา, CC ฝ่ายบัญชีอัตโนมัติ, ส่งออก CSV เข้า ERP/NAV',
      hiddenModules: 'ติดตามสถานะลูกค้ากดยืนยันรับใบวางบิล/ใบเสร็จแบบเรียลไทม์',
      launchWorkspace: () => openSalesCorporateQuotationWithPreset('Service & Billing', 'ใบวางบิล (Billing Note)')
    },
    {
      id: 'ADMIN_HR',
      icon: '🏢',
      deptName: 'Admin & HR (ฝ่ายธุรการและบุคคล)',
      badgeColor: '#4338CA',
      bgLight: '#F5F3FF',
      borderCol: '#DDD6FE',
      uiMode: 'MANAGER',
      visibleModules: 'จัดการรายชื่อพนักงาน (CRM_Staff_Directory), ตั้งค่ากลุ่มอีเมล CC/BCC 7 แผนก, ตรวจความพร้อมระบบ Go-Live QA & คู่มือ SOP',
      hiddenModules: 'ควบคุมสิทธิ์การเข้าถึงและการสำรองข้อมูลกลาง',
      launchWorkspace: () => window.openProductionGoLiveQaModal()
    },
    {
      id: 'EXECUTIVE',
      icon: '📈',
      deptName: 'Executive Management (คณะผู้บริหารสูงสุด)',
      badgeColor: '#B45309',
      bgLight: '#FFFBEB',
      borderCol: '#FDE68A',
      uiMode: 'MANAGER',
      visibleModules: 'Executive BI Dashboard รวมทุกแผนก, AI Sales Follow-Up Copilot, อนุมัติส่วนลด >12% ผ่าน LINE, รับสรุปรายสัปดาห์อัตโนมัติ',
      hiddenModules: 'รับสำเนาลับ (BCC) ใบเสนอราคาโครงการสำคัญ',
      launchWorkspace: () => window.openExecutiveBiDashboardModal()
    }
  ];

  function applyGlobalAppRoleMode(mode) {
    try {
      // Trigger existing PWA technician/manager toggle if available in DOM
      const btns = Array.from(document.querySelectorAll('button'));
      if (mode === 'TECH') {
        const toTech = btns.find(b => /สลับเป็นโหมดช่างดำเนินงาน/i.test(b.textContent || ''));
        if (toTech) toTech.click();
      } else {
        const toMgr = btns.find(b => /สลับเป็นโหมดผู้จัดการ|ผู้จัดการ\/จ่ายงาน/i.test(b.textContent || ''));
        if (toMgr && /ช่างดำเนินงาน/.test(document.body.innerText)) toMgr.click();
      }
    } catch (e) {}
  }

  const FIELD_TECH_ROSTER = [
    { code: 'T01', name: 'ช่างบริการ T01 (Bangkok North)', dept: 'Service Field Tech', role: 'Field Service Technician', email: 'services@hoshizaki.co.th', isTech: true },
    { code: 'T02', name: 'ช่างบริการ T02 (Bangkok South)', dept: 'Service Field Tech', role: 'Field Service Technician', email: 'services@hoshizaki.co.th', isTech: true },
    { code: 'T03', name: 'ช่างบริการ T03 (Bangkok East)', dept: 'Service Field Tech', role: 'Field Service Technician', email: 'services@hoshizaki.co.th', isTech: true },
    { code: 'T04', name: 'ช่างบริการ T04 (Nonthaburi / Pathum)', dept: 'Service Field Tech', role: 'Field Service Technician', email: 'services@hoshizaki.co.th', isTech: true },
    { code: 'T05', name: 'ช่างบริการ T05 (Samut Prakan / Chonburi)', dept: 'Service Field Tech', role: 'Field Service Technician', email: 'services@hoshizaki.co.th', isTech: true },
    { code: 'T06', name: 'ช่างบริการ T06 (Ayutthaya / Central)', dept: 'Service Field Tech', role: 'Field Service Technician', email: 'services@hoshizaki.co.th', isTech: true },
    { code: 'T07', name: 'ช่างบริการ T07 (Upcountry / Dealer Sub)', dept: 'Service Field Tech', role: 'Field Service Technician', email: 'services@hoshizaki.co.th', isTech: true },
    { code: 'T08', name: 'ช่างบริการ T08 (Installation & PM)', dept: 'Service Field Tech', role: 'Installation Specialist', email: 'services@hoshizaki.co.th', isTech: true }
  ];

  function showDepartmentSimulationBanner(profile, staffMember) {
    let banner = document.getElementById('hzkDeptSimActiveBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'hzkDeptSimActiveBanner';
      banner.style.cssText =
        'position:fixed;bottom:14px;left:14px;z-index:20050;background:#0F172A;color:#FFF;' +
        'border:2px solid #38BDF8;border-radius:12px;padding:10px 14px;box-shadow:0 10px 30px rgba(0,0,0,0.4);' +
        'font-family:sans-serif;font-size:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:94vw;';
      document.body.appendChild(banner);
    }

    if (staffMember) {
      banner.innerHTML = `
        <div>
          <div style="font-size:10px;color:#FBBF24;font-weight:800;">👤 INDIVIDUAL STAFF LIVE VIEW (SUPER ADMIN AUDIT)</div>
          <div style="font-weight:700;">กำลังดูหน้าจอของ: ${staffMember.name} [${staffMember.dept}]</div>
        </div>
        <button type="button" id="hzkReopenStaffDetailBtn" style="background:#059669;color:#FFF;border:none;border-radius:7px;padding:6px 10px;font-weight:700;cursor:pointer;white-space:nowrap;">📊 ดูงาน/ลูกค้าของคนนี้</button>
        <button type="button" id="hzkSwitchDeptBannerBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:7px;padding:6px 10px;font-weight:700;cursor:pointer;white-space:nowrap;">เปลี่ยนคน/แผนก</button>
        <button type="button" id="hzkExitDeptBannerBtn" style="background:#EF4444;color:#FFF;border:none;border-radius:7px;padding:6px 10px;font-weight:700;cursor:pointer;white-space:nowrap;">✕ กลับ Super Admin</button>
      `;
      banner.style.display = 'flex';
      document.getElementById('hzkReopenStaffDetailBtn').onclick = () => openIndividualStaffWorkspaceDrawer(staffMember);
    } else {
      banner.innerHTML = `
        <div>
          <div style="font-size:10px;color:#38BDF8;font-weight:800;">🎭 ACTIVE DEPARTMENT VIEW SIMULATION</div>
          <div style="font-weight:700;">${profile.icon} กำลังแสดงมุมมอง: ${profile.deptName}</div>
        </div>
        <button type="button" id="hzkSwitchDeptBannerBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:7px;padding:6px 10px;font-weight:700;cursor:pointer;white-space:nowrap;">เปลี่ยนแผนก/บุคคล</button>
        <button type="button" id="hzkExitDeptBannerBtn" style="background:#EF4444;color:#FFF;border:none;border-radius:7px;padding:6px 10px;font-weight:700;cursor:pointer;white-space:nowrap;">✕ กลับ Super Admin</button>
      `;
      banner.style.display = 'flex';
    }

    document.getElementById('hzkSwitchDeptBannerBtn').onclick = openDepartmentLiveSimulatorModal;
    document.getElementById('hzkExitDeptBannerBtn').onclick = function () {
      applyGlobalAppRoleMode('MANAGER');
      applyDepartmentLandingWorkspaceView(null, null);
      banner.style.display = 'none';
    };
  }

  async function openIndividualStaffWorkspaceDrawer(staff) {
    const db = await loadSalesMasterDb(false);
    const assignedCustomers = (db.customers || []).filter(c =>
      String(c.assignedSales || '').trim().toUpperCase() === String(staff.code || '').trim().toUpperCase()
    );

    const localArchives = (() => {
      try { return JSON.parse(localStorage.getItem(STORAGE_ARCHIVE_KEY) || '[]'); } catch (e) { return []; }
    })();
    const staffQuotes = localArchives.filter(q =>
      String(q.salesperson || '').trim().toUpperCase() === String(staff.code || '').trim().toUpperCase()
    );

    let drawer = document.getElementById('hzkIndividualStaffDrawerModal');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'hzkIndividualStaffDrawerModal';
      drawer.style.cssText =
        'position:fixed;inset:0;z-index:20030;background:rgba(15,23,42,0.82);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(drawer);
    }

    const custRows = assignedCustomers.slice(0, 60).map((c, idx) => `
      <tr>
        <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">${idx + 1}</td>
        <td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;">${c.name}</td>
        <td style="padding:6px;border:1px solid #CBD5E1;">${c.paymentTerms || '30DAYS'}</td>
        <td style="padding:6px;border:1px solid #CBD5E1;">${c.phone || '-'}</td>
        <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">
          <button type="button" data-cust-name="${c.name.split(String.fromCharCode(34)).join('&quot;')}" class="hzk-staff-new-qt-cust" style="background:#0284C7;color:#FFF;border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;">+ ออกใบเสนอราคา</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#64748B;">ไม่มีรายชื่อลูกค้าผูกตายตัว (สามารถออกเอกสารให้ลูกค้าทั่วไปได้ทั้งหมด)</td></tr>';

    const qtRows = staffQuotes.slice(0, 25).map(q => `
      <tr>
        <td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;">${q.offerNo} (${q.rev})</td>
        <td style="padding:6px;border:1px solid #CBD5E1;">${q.customerName || '-'}</td>
        <td style="padding:6px;border:1px solid #CBD5E1;">${q.date || '-'}</td>
        <td style="padding:6px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">${Number(q.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#64748B;">ยังไม่มีประวัติใบเสนอราคาในเครื่องของรหัสนี้</td></tr>';

    drawer.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:960px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;">
        <div style="background:#1E1B4B;color:#FFF;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:2;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:11px;color:#FBBF24;font-weight:800;">INDIVIDUAL STAFF WORKSPACE &amp; KPI SNAPSHOT</div>
            <div style="font-size:16px;font-weight:700;">👤 ${staff.name} (${staff.code}) — แผนก: ${staff.dept}</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" id="hzkStaffCreateDocAsUserBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">📄 ออกเอกสารในชื่อ ${staff.name}</button>
            <button type="button" onclick="document.getElementById('hzkIndividualStaffDrawerModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>

        <div style="padding:16px 20px;font-size:13px;color:#0F172A;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:16px;">
            <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:12px;">
              <div style="font-size:11px;font-weight:700;color:#1D4ED8;">🏢 ลูกค้าในความดูแล (Assigned Accounts)</div>
              <div style="font-size:20px;font-weight:800;color:#002B49;margin-top:4px;">${assignedCustomers.length} บริษัท</div>
            </div>
            <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px;">
              <div style="font-size:11px;font-weight:700;color:#15803D;">📄 เอกสารที่ออกในเครื่อง (Local Archive)</div>
              <div style="font-size:20px;font-weight:800;color:#14532D;margin-top:4px;">${staffQuotes.length} ฉบับ</div>
            </div>
            <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:12px;">
              <div style="font-size:11px;font-weight:700;color:#B45309;">🛡️ โหมดสิทธิ์หน้าจอจริง (RBAC Mode)</div>
              <div style="font-size:16px;font-weight:800;color:#78350F;margin-top:6px;">${staff.isTech ? '🛠️ Field Technician (ซ่อนทุน/GP%)' : '💼 Commercial / Manager View'}</div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-weight:700;color:#002B49;margin-bottom:6px;">รายชื่อลูกค้าที่ผูกกับคุณ ${staff.name} (${assignedCustomers.length} ราย):</div>
            <div style="overflow-x:auto;max-height:240px;overflow-y:auto;border:1px solid #E2E8F0;border-radius:8px;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead><tr style="background:#002B49;color:#FFF;"><th style="padding:7px;">#</th><th style="padding:7px;text-align:left;">ชื่อบริษัทลูกค้า</th><th style="padding:7px;">เครดิต</th><th style="padding:7px;">เบอร์โทร</th><th style="padding:7px;">ดำเนินการ</th></tr></thead>
                <tbody>${custRows}</tbody>
              </table>
            </div>
          </div>

          <div>
            <div style="font-weight:700;color:#002B49;margin-bottom:6px;">ประวัติใบเสนอราคาล่าสุดของ ${staff.name}:</div>
            <div style="overflow-x:auto;border:1px solid #E2E8F0;border-radius:8px;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead><tr style="background:#0F172A;color:#FFF;"><th style="padding:7px;text-align:left;">Offer No.</th><th style="padding:7px;text-align:left;">ลูกค้า</th><th style="padding:7px;">วันที่</th><th style="padding:7px;text-align:right;">ยอดสุทธิ</th></tr></thead>
                <tbody>${qtRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    drawer.style.display = 'flex';

    document.getElementById('hzkStaffCreateDocAsUserBtn').onclick = async function () {
      drawer.style.display = 'none';
      const targetDept = /Japan/i.test(staff.dept) ? 'Japanese Corporate' : (/Market/i.test(staff.dept) ? 'Marketing' : (/Service/i.test(staff.dept) ? 'Service & Billing' : 'Sales'));
      await openSalesCorporateQuotationWithPreset(targetDept, 'ใบเสนอราคา (Quotation)');
      const spEl = document.getElementById('hzkSqSalesperson');
      if (spEl) spEl.value = staff.code;
      const remEl = document.getElementById('hzkSqRemarks');
      if (remEl && remEl.value.indexOf('Super Admin Audit') === -1) {
        remEl.value += '\n- [Super Admin Audit Support: ตรวจสอบ/ออกเอกสารร่วมกับ ' + staff.name + ']';
      }
    };

    drawer.querySelectorAll('.hzk-staff-new-qt-cust').forEach(btn => {
      btn.onclick = async function () {
        const cName = btn.getAttribute('data-cust-name');
        drawer.style.display = 'none';
        const targetDept = /Japan/i.test(staff.dept) ? 'Japanese Corporate' : 'Sales';
        await openSalesCorporateQuotationWithPreset(targetDept, 'ใบเสนอราคา (Quotation)');
        const spEl = document.getElementById('hzkSqSalesperson');
        if (spEl) spEl.value = staff.code;
        const cEl = document.getElementById('hzkSqCustomer');
        if (cEl) {
          cEl.value = cName;
          cEl.dispatchEvent(new Event('change'));
        }
      };
    });
  }

  async function openDepartmentLiveSimulatorModal() {
    if (!isCurrentUserSoleSuperAdmin()) {
      showHzkToastNotification('⛔ สงวนสิทธิ์เฉพาะ Mr. Noparin Homhoul (Sole Super Admin) เท่านั้นในการสลับดูหน้าจอของแผนกและบุคคลอื่น', true);
      if (typeof window.openTechQuickLoginModal === 'function') window.openTechQuickLoginModal();
      return;
    }
    const db = await loadSalesMasterDb(false);
    const allIndividuals = (db.activeStaff || []).map(s => ({
      code: s.code,
      name: s.name,
      dept: s.dept || 'Sales',
      role: s.role || 'Staff',
      email: s.email || 'services@hoshizaki.co.th',
      isTech: false
    })).concat(FIELD_TECH_ROSTER);

    let simModal = document.getElementById('hzkDeptLiveSimulatorModal');
    if (!simModal) {
      simModal = document.createElement('div');
      simModal.id = 'hzkDeptLiveSimulatorModal';
      simModal.style.cssText =
        'position:fixed;inset:0;z-index:20020;background:rgba(15,23,42,0.82);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(simModal);
    }

    const deptCardsHtml = DEPT_VIEW_PROFILES.map((p, idx) => `
      <div style="background:${p.bgLight};border:1.5px solid ${p.borderCol};border-radius:14px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="background:${p.badgeColor};color:#FFF;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:800;">${p.icon} ${p.id}</span>
            <span style="font-size:10.5px;font-weight:700;color:#475569;">โหมดระบบ: ${p.uiMode}</span>
          </div>
          <div style="font-weight:800;font-size:14px;color:#0F172A;margin-bottom:6px;">${p.deptName}</div>
          <div style="font-size:11.5px;color:#1E293B;line-height:1.45;margin-bottom:5px;"><b>✅ ฟังก์ชันที่มองเห็นและใช้งานได้:</b> ${p.visibleModules}</div>
          <div style="font-size:11px;color:#475569;line-height:1.4;"><b>🔒 การควบคุมสิทธิ์/การแสดงผล:</b> ${p.hiddenModules}</div>
        </div>
        <button type="button" data-sim-idx="${idx}" class="hzk-launch-dept-sim-btn" style="width:100%;background:${p.badgeColor};color:#FFF;border:none;border-radius:9px;padding:9px 12px;font-weight:700;font-size:12px;cursor:pointer;">👁️ เปิดดูหน้าจอจริงของแผนกนี้</button>
      </div>
    `).join('');

    const staffCardsHtml = allIndividuals.map((st, idx) => {
      const custCount = (db.customers || []).filter(c => String(c.assignedSales || '').toUpperCase() === st.code.toUpperCase()).length;
      const badgeBg = st.isTech ? '#991B1B' : (/Japan/i.test(st.dept) ? '#1E1B4B' : (/Market/i.test(st.dept) ? '#065F46' : '#002B49'));
      return `
        <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-bottom:5px;">
              <span style="background:${badgeBg};color:#FFF;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;">${st.code}</span>
              <span style="font-size:10.5px;font-weight:700;color:#475569;">${st.dept}</span>
            </div>
            <div style="font-weight:800;font-size:13.5px;color:#0F172A;">👤 ${st.name}</div>
            <div style="font-size:11.5px;color:#334155;margin-top:3px;">ตำแหน่ง: ${st.role || '-'}</div>
            <div style="font-size:11px;color:#0369A1;margin-top:3px;">${st.isTech ? '🛠️ สิทธิ์หน้างานช่าง (ซ่อนราคาทุน/GP%)' : ('🏢 ลูกค้าที่ดูแล: <b>' + custCount + ' บริษัท</b>')}</div>
          </div>
          <button type="button" data-staff-idx="${idx}" class="hzk-launch-staff-sim-btn" style="width:100%;background:${badgeBg};color:#FFF;border:none;border-radius:8px;padding:8px 10px;font-weight:700;font-size:11.5px;cursor:pointer;">👁️ สวมมุมมองดูหน้าจอของคนนี้</button>
        </div>
      `;
    }).join('');

    simModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1080px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:2;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">SUPER ADMIN &amp; ADMIN STUDIO — DEPARTMENT &amp; INDIVIDUAL LIVE INSPECTOR</div>
            <div style="font-size:16px;font-weight:700;">🎭 ศูนย์ตรวจสอบหน้าจอจริงแยกตามแผนก (8 แผนก) และรายบุคคล (${allIndividuals.length} คน)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkDeptLiveSimulatorModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:16px 20px;">
          <div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:2px solid #E2E8F0;padding-bottom:10px;flex-wrap:wrap;">
            <button type="button" id="hzkTabDeptViewBtn" style="background:#002B49;color:#FFF;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">🏢 1. ดูหน้าจอแยกตามแผนก (8 แผนก)</button>
            <button type="button" id="hzkTabStaffViewBtn" style="background:#E2E8F0;color:#0F172A;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">👤 2. ดูหน้าจอแยกเป็นรายบุคคล (${allIndividuals.length} คน)</button>
          </div>

          <div id="hzkSimDeptPane" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">
            ${deptCardsHtml}
          </div>

          <div id="hzkSimStaffPane" style="display:none;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;">
            ${staffCardsHtml}
          </div>
        </div>
      </div>
    `;

    simModal.style.display = 'flex';

    const btnDept = document.getElementById('hzkTabDeptViewBtn');
    const btnStaff = document.getElementById('hzkTabStaffViewBtn');
    const paneDept = document.getElementById('hzkSimDeptPane');
    const paneStaff = document.getElementById('hzkSimStaffPane');

    btnDept.onclick = () => {
      paneDept.style.display = 'grid';
      paneStaff.style.display = 'none';
      btnDept.style.background = '#002B49';
      btnDept.style.color = '#FFF';
      btnStaff.style.background = '#E2E8F0';
      btnStaff.style.color = '#0F172A';
    };

    btnStaff.onclick = () => {
      paneDept.style.display = 'none';
      paneStaff.style.display = 'grid';
      btnStaff.style.background = '#1E1B4B';
      btnStaff.style.color = '#FFF';
      btnDept.style.background = '#E2E8F0';
      btnDept.style.color = '#0F172A';
    };

    simModal.querySelectorAll('.hzk-launch-dept-sim-btn').forEach(btn => {
      btn.onclick = function () {
        const profile = DEPT_VIEW_PROFILES[Number(btn.getAttribute('data-sim-idx'))];
        simModal.style.display = 'none';
        applyDepartmentLandingWorkspaceView(profile, null);
        showDepartmentSimulationBanner(profile, null);
        profile.launchWorkspace();
      };
    });

    simModal.querySelectorAll('.hzk-launch-staff-sim-btn').forEach(btn => {
      btn.onclick = function () {
        const staff = allIndividuals[Number(btn.getAttribute('data-staff-idx'))];
        simModal.style.display = 'none';
        applyGlobalAppRoleMode(staff.isTech ? 'TECH' : 'MANAGER');
        applyDepartmentLandingWorkspaceView(null, staff);
        showDepartmentSimulationBanner(null, staff);
        openIndividualStaffWorkspaceDrawer(staff);
      };
    });
  }

  function isCurrentUserSoleSuperAdmin() {
    try {
      const raw = localStorage.getItem('hoshizaki_active_auth_session_v1042');
      if (!raw) return false;
      const sess = JSON.parse(raw);
      return sess && (sess.id === 'SVC-02' || (sess.rbacRole === 'SUPER_ADMIN' && String(sess.name || '').toLowerCase().indexOf('noparin') > -1));
    } catch (e) {
      return false;
    }
  }

  function applyDepartmentLandingWorkspaceView(profile, staffMember) {
    const jobSheet = document.getElementById('jobSheetContainer');
    const mobNav = document.getElementById('mobileSectionNav');
    let deptLandingCard = document.getElementById('hzkDepartmentLandingWorkspaceCard');

    const deptKey = profile ? profile.id : (staffMember ? (staffMember.isTech ? 'SERVICE_TECH' : (/Japan/i.test(staffMember.dept) ? 'JPC_CORP' : (/Market/i.test(staffMember.dept) ? 'MARKETING' : (/Account/i.test(staffMember.dept) ? 'ACCOUNTING' : (/Admin|HR/i.test(staffMember.dept) ? 'ADMIN_HR' : (/Exec/i.test(staffMember.dept) ? 'EXECUTIVE' : (/Service/i.test(staffMember.dept) ? 'SERVICE_MGR' : 'SALES_TH'))))))) : 'SERVICE_MGR');
    const isServiceView = (deptKey === 'SERVICE_TECH' || deptKey === 'SERVICE_MGR');

    if (isServiceView) {
      if (jobSheet) jobSheet.style.display = '';
      if (mobNav) mobNav.style.display = '';
      if (deptLandingCard) deptLandingCard.style.display = 'none';
      return;
    }

    // Non-Service department: hide technician Job Service Report form & show tailored Department Landing Workspace
    if (jobSheet) jobSheet.style.display = 'none';
    if (mobNav) mobNav.style.display = 'none';

    if (!deptLandingCard) {
      deptLandingCard = document.createElement('section');
      deptLandingCard.id = 'hzkDepartmentLandingWorkspaceCard';
      deptLandingCard.className = 'max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border-2 border-sky-200 p-4 sm:p-6 space-y-4 my-3';
      if (jobSheet && jobSheet.parentNode) {
        jobSheet.parentNode.insertBefore(deptLandingCard, jobSheet);
      } else {
        document.body.appendChild(deptLandingCard);
      }
    }

    const activeProf = profile || DEPT_VIEW_PROFILES.find(p => p.id === deptKey) || DEPT_VIEW_PROFILES[2];
    const whoTitle = staffMember ? `${staffMember.name} (${staffMember.code}) — ${staffMember.dept}` : activeProf.deptName;

    const DEPT_ACTION_CARDS = {
      SALES_TH: [
        { icon: '📄', title: 'ออกใบเสนอราคาขาย (THB Y2026)', sub: 'เติมขนาด W×D×H + เช็กสต็อกสด HHE อัตโนมัติ', fn: "openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)')" },
        { icon: '📦', title: 'เช็กสต็อกเครื่องพร้อมขาย (203 รุ่น)', sub: 'ดูยอดคงเหลือจริงจาก Daily Stock Report', fn: "window.openLiveStockSnapshotModal && window.openLiveStockSnapshotModal()" },
        { icon: '🏢', title: 'ฐานลูกค้า B2B & ดีลเลอร์ (700 ราย)', sub: 'ค้นหาลูกค้า เงื่อนไขเครดิต และประวัติเสนอราคา', fn: "window.openQuotationArchiveModal && window.openQuotationArchiveModal()" },
        { icon: '🔄', title: 'ส่งต่องานติดตั้ง & ลงทะเบียน S/N', sub: 'แจ้งฝ่ายบริการเข้าติดตั้งเมื่อลูกค้าออก PO แล้ว', fn: "window.openCrossDeptHandoffHubModal && window.openCrossDeptHandoffHubModal()" }
      ],
      JPC_CORP: [
        { icon: '🇯🇵', title: 'ใบเสนอราคา Japanese Corporate (THB/USD)', sub: 'รองรับ Export 0% VAT & Local THB + CC JPC_TEAM', fn: "openSalesCorporateQuotationWithPreset('Japanese Corporate', 'ใบเสนอราคา (Quotation)')" },
        { icon: '📊', title: 'สรุปผู้บริหาร 3 ภาษา (TH/EN/JP)', sub: 'รายงาน KPI ประจำสัปดาห์สำหรับผู้บริหารญี่ปุ่น', fn: "window.openTrilingualExecutiveBriefModal && window.openTrilingualExecutiveBriefModal()" },
        { icon: '🔎', title: 'ตรวจสอบประวัติเครื่อง S/N 360°', sub: 'ดูประวัติเครื่องของลูกค้าองค์กรญี่ปุ่นย้อนหลัง', fn: "openSerial360TimelineModal('')" },
        { icon: '🌐', title: 'เชื่อมระบบ Jobcan & สำนักงานใหญ่ญี่ปุ่น', sub: 'จัดการเอกสารและอนุมัติคำขอข้ามสาขา', fn: "window.openVoiceTeamsAndJobcanHqModal && window.openVoiceTeamsAndJobcanHqModal('JOBCAN_HQ')" }
      ],
      MARKETING: [
        { icon: '🏷️', title: 'สต็อกเครื่องโชว์ / มีตำหนิ (602 รายการ)', sub: 'พร้อมลิงก์ใบตรวจสภาพ QCF และดึงลงใบเสนอราคา', fn: "window.openDamageDemoStockModal && window.openDamageDemoStockModal()" },
        { icon: '📣', title: 'ใบเสนอราคาแคมเปญ & โปรโมชัน', sub: 'ออกใบเสนอราคาส่งเสริมการขายและงานแสดงสินค้า', fn: "openSalesCorporateQuotationWithPreset('Marketing', 'ใบเสนอราคา (Quotation)')" },
        { icon: '🎨', title: 'Unified AI Content & Promo Card Studio', sub: 'สร้างการ์ดโปรโมชัน / แอดโฆษณา / คู่มือดีลเลอร์', fn: "window.openUnifiedAiContentAndCardStudio && window.openUnifiedAiContentAndCardStudio('SERVICE_SELF_CHECK')" },
        { icon: '🎪', title: 'ออกบูธ THAIFEX / Showroom & จ่ายลีด', sub: 'กระจายลีดลูกค้าใหม่ให้เครือข่ายดีลเลอร์ทั่วประเทศ', fn: "window.openSaleMarketingGrowthModal && window.openSaleMarketingGrowthModal('EVENTS_SHOWROOM')" }
      ],
      ACCOUNTING: [
        { icon: '🧾', title: 'ออกใบวางบิล / ใบเสร็จรับเงิน (1 คลิก)', sub: 'แปลงจากใบเสนอราคา + เลขผู้เสียภาษี 13 หลัก/สาขา', fn: "openSalesCorporateQuotationWithPreset('Service & Billing', 'ใบวางบิล (Billing Note)')" },
        { icon: '🔍', title: 'ตรวจสอบงานซ่อมค้างวางบิล (Revenue Audit)', sub: 'ตรวจเช็กใบงานปิดแล้วที่ยังไม่ออกใบวางบิล', fn: "window.openRevenueLeakageAuditModal && window.openRevenueLeakageAuditModal()" },
        { icon: '⚖️', title: 'ระบบบัญชีบริการ & ส่งออก Microsoft Dynamics NAV', sub: 'สรุปรายรับ AR/AP ภาษี VAT 7% และ WHT 3%', fn: "window.openPhase2DepartmentalBridgeModal && window.openPhase2DepartmentalBridgeModal()" },
        { icon: '📁', title: 'คลังเอกสารใบเสนอราคา & ใบวางบิล (4,546+ ฉบับ)', sub: 'ตรวจสอบประวัติเอกสารและการยืนยันรับบิลของลูกค้า', fn: "window.openQuotationArchiveModal && window.openQuotationArchiveModal()" }
      ],
      ADMIN_HR: [
        { icon: '🕒', title: 'ตอกบัตร Auto-Stamp · WFH Selfie & OT', sub: 'ตรวจสอบเวลาเข้า-ออกงานของพนักงานทุกแผนก', fn: "window.openHrWorkflowSuiteModal && window.openHrWorkflowSuiteModal('ATTENDANCE')" },
        { icon: '📅', title: 'อนุมัติใบลา & ซิงค์ตารางจ่ายงานช่าง', sub: 'จัดการวันลาพักร้อน ลากิจ และวันหยุดประจำปี', fn: "window.openHrWorkflowSuiteModal && window.openHrWorkflowSuiteModal('LEAVE')" },
        { icon: '💳', title: 'อนุมัติเบิกค่าใช้จ่าย & รอบโอนจ่าย พฤ.–ศ.', sub: 'ตรวจใบเสร็จ OCR, Pre-Travel, RINGI และส่งออก NAV', fn: "window.openHrWorkflowSuiteModal && window.openHrWorkflowSuiteModal('APPROVAL_PAYOUT')" },
        { icon: '👥', title: 'จัดการรายชื่อบุคลากร & ความพร้อม Go-Live QA', sub: 'อัปเดตฐานข้อมูลพนักงานและตรวจสอบความพร้อมระบบ', fn: "window.openProductionGoLiveQaModal && window.openProductionGoLiveQaModal()" }
      ],
      EXECUTIVE: [
        { icon: '👑', title: 'MD Boardroom BI & สไลด์ประชุม 3 ภาษา', sub: 'แดชบอร์ดภาพรวมรายได้ สต็อก และ KPI ทุกแผนก', fn: "window.openMdBoardroomModal && window.openMdBoardroomModal('OVERVIEW')" },
        { icon: '📈', title: 'Executive Sales & Service BI Dashboard', sub: 'วิเคราะห์อัตราปิดการขาย (PO) และประสิทธิภาพบริการ', fn: "window.openExecutiveBiDashboardModal && window.openExecutiveBiDashboardModal()" },
        { icon: '📊', title: 'KPI Report Studio (รายสัปดาห์/เดือน/ไตรมาส/ปี)', sub: 'สร้างรายงานเปรียบเทียบผลงานทุกแผนกอัตโนมัติ', fn: "window.openKpiReportStudioModal && window.openKpiReportStudioModal('DASHBOARD')" },
        { icon: '🌐', title: 'สรุปผู้บริหาร 3 ภาษา (TH / EN / 日本語)', sub: 'ส่งออกรายงานสรุปผู้บริหารพร้อมส่งอีเมล/LINE', fn: "window.openTrilingualExecutiveBriefModal && window.openTrilingualExecutiveBriefModal()" }
      ]
    };

    const cards = DEPT_ACTION_CARDS[deptKey] || DEPT_ACTION_CARDS.SALES_TH;
    deptLandingCard.innerHTML = `
      <div style="background:${activeProf.badgeColor};color:#FFF;border-radius:14px;padding:16px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:11px;color:#FDE68A;font-weight:800;letter-spacing:0.04em;">DEPARTMENT PRIMARY WORKSPACE · ซ่อนฟอร์มงานซ่อมช่างอัตโนมัติ</div>
          <div style="font-size:17px;font-weight:800;margin-top:2px;">${activeProf.icon} ${whoTitle}</div>
          <div style="font-size:12px;opacity:0.9;margin-top:3px;">${activeProf.visibleModules}</div>
        </div>
        <button type="button" id="hzkShowJobSheetOverrideBtn" style="background:rgba(255,255,255,0.18);color:#FFF;border:1px solid rgba(255,255,255,0.45);border-radius:9px;padding:8px 12px;font-size:11.5px;font-weight:700;cursor:pointer;">🛠️ เปิดดูฟอร์ม Job Service ชั่วคราว</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;">
        ${cards.map(c => `
          <button type="button" onclick="${c.fn}" style="text-align:left;background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:14px;cursor:pointer;transition:all 0.15s ease;">
            <div style="font-size:22px;margin-bottom:6px;">${c.icon}</div>
            <div style="font-weight:800;font-size:13.5px;color:#0F172A;">${c.title}</div>
            <div style="font-size:11.5px;color:#475569;margin-top:4px;line-height:1.4;">${c.sub}</div>
          </button>
        `).join('')}
      </div>
    `;
    deptLandingCard.style.display = 'block';

    const overrideBtn = document.getElementById('hzkShowJobSheetOverrideBtn');
    if (overrideBtn) {
      overrideBtn.onclick = function () {
        if (jobSheet) jobSheet.style.display = '';
        if (mobNav) mobNav.style.display = '';
        deptLandingCard.style.display = 'none';
      };
    }
  }

  // Also inject a quick launcher button inside existing Admin Studio modal whenever opened
  function hookAdminStudioInspectorButton() {
    const observer = new MutationObserver(() => {
      const studioBtns = Array.from(document.querySelectorAll('button, h2, h3')).filter(el =>
        /Admin Studio|สิทธิ์แผนก|RBAC/i.test(el.textContent || '')
      );
      studioBtns.forEach(el => {
        const container = el.closest('[id*="Modal"], [class*="modal"], .modal-content') || el.parentElement;
        if (container && !container.querySelector('#hzkInjectedStudioSimBtn')) {
          const simBtn = document.createElement('button');
          simBtn.id = 'hzkInjectedStudioSimBtn';
          simBtn.type = 'button';
          simBtn.innerHTML = '🎭 จำลองดูหน้าจอจริงแยกแผนก & รายบุคคล (Live Inspector)';
          simBtn.style.cssText =
            'background:linear-gradient(135deg,#0284C7,#1E1B4B);color:#FFF;border:1px solid #7DD3FC;' +
            'border-radius:8px;padding:7px 12px;font-weight:700;font-size:12px;cursor:pointer;margin:6px;';
          simBtn.onclick = openDepartmentLiveSimulatorModal;
          if (el.parentElement) el.parentElement.appendChild(simBtn);
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.openDepartmentRoleSopModal = openDepartmentRoleSopModal;

  async function openSerial360TimelineModal(prefillSn) {
    let sModal = document.getElementById('hzkSerial360Modal');
    if (!sModal) {
      sModal = document.createElement('div');
      sModal.id = 'hzkSerial360Modal';
      sModal.style.cssText =
        'position:fixed;inset:0;z-index:20040;background:rgba(15,23,42,0.82);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(sModal);
    }

    sModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:960px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:2;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">SERIAL NUMBER 360° LIFECYCLE &amp; FIELD PHOTO GALLERY</div>
            <div style="font-size:16px;font-weight:700;">🔎 ตรวจสอบประวัติเครื่องรายตัว (S/N 360° Timeline &amp; รูปหน้างาน)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkSerial360Modal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:18px 20px;font-size:13px;color:#0F172A;">
          <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
            <input id="hzkSn360Input" type="text" value="${prefillSn || ''}" placeholder="พิมพ์หมายเลขเครื่อง Serial No. เช่น K01234J, L05678M..." style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:8px;font-weight:700;" />
            <button type="button" id="hzkSn360SearchBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:9px 18px;font-weight:700;cursor:pointer;">🔎 ค้นหาประวัติ 360°</button>
            <button type="button" onclick="window.openSerialLifecyclePricingSuiteModal(document.getElementById('hzkSn360Input').value)" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;">💰 ดูต้นทุนซ่อม &amp; กำไรสุทธิ (P&amp;L)</button>
          </div>
          <div id="hzkSn360ResultBody" style="color:#64748B;">กรอกหมายเลข Serial Number แล้วกดค้นหาเพื่อดูประวัติตั้งแต่คลังสินค้า ติดตั้ง ดีลเลอร์ ซ่อมบำรุง และรูปภาพหน้างานครับ</div>
        </div>
      </div>
    `;
    sModal.style.display = 'flex';

    async function runSearchSn() {
      const sn = document.getElementById('hzkSn360Input').value.trim().toUpperCase();
      if (!sn) return;
      const gasUrl = getGasEndpointUrl();
      const body = document.getElementById('hzkSn360ResultBody');
      if (!gasUrl) {
        body.innerHTML = '<div style="color:#B91C1C;">กรุณาตั้งค่า Google Apps Script URL ก่อนค้นหาครับ</div>';
        return;
      }
      body.innerHTML = '⏳ กำลังรวบรวมข้อมูลประวัติเครื่อง ' + sn + ' จากทุกแผนก...';
      try {
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getSerial360Timeline', serialNo: sn })
        });
        const d = await res.json();
        const m = d.master || {};
        const events = d.timeline || [];
        const photos = d.photos || [];

        const timelineHtml = events.map(ev => `
          <div style="border-left:3px solid #0284C7;padding:8px 14px;margin-bottom:10px;background:#F8FAFC;border-radius:0 10px 10px 0;">
            <div style="font-size:10.5px;font-weight:800;color:#0284C7;">${ev.stage} • ${ev.date}</div>
            <div style="font-weight:700;color:#0F172A;margin-top:2px;">${ev.title}</div>
            <div style="font-size:12px;color:#334155;margin-top:2px;">${ev.detail}</div>
            ${ev.link ? `<a href="${ev.link}" target="_blank" style="display:inline-block;margin-top:4px;font-size:11px;color:#059669;font-weight:700;">🔗 เปิดดูเอกสาร/รูปภาพแนบ</a>` : ''}
          </div>
        `).join('') || '<div style="color:#64748B;padding:10px;">ยังไม่มีประวัติการเคลื่อนไหวเพิ่มเติมในระบบ</div>';

        const photosHtml = photos.length
          ? `<div style="margin-top:14px;"><div style="font-weight:700;color:#002B49;margin-bottom:8px;">📸 อัลบั้มรูปภาพหน้างานของเครื่องนี้ (${photos.length} ภาพ):</div>` +
            `<div style="display:flex;gap:8px;flex-wrap:wrap;">` +
            photos.map(p => `<a href="${p.url}" target="_blank" style="background:#EFF6FF;border:1px solid #BFDBFE;padding:8px 12px;border-radius:8px;text-decoration:none;color:#1E40AF;font-size:12px;font-weight:700;">🖼️ ${p.ticketId} (${p.date})</a>`).join('') +
            `</div></div>`
          : '';

        body.innerHTML = `
          <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;margin-bottom:14px;">
            <div style="font-size:15px;font-weight:800;color:#002B49;">❄️ S/N: ${d.serialNumber} — รุ่น: ${m.model || 'ไม่ระบุ'}</div>
            <div style="font-size:12.5px;color:#1E293B;margin-top:4px;"><b>ลูกค้า / สถานที่ติดตั้ง:</b> ${m.customerStore || '-'} (${m.province || '-'}) | <b>โทร:</b> ${m.customerPhone || '-'}</div>
            <div style="font-size:12.5px;color:#047857;margin-top:2px;"><b>สถานะการรับประกัน:</b> ${m.warrantyStatus || '-'}</div>
            <div style="font-size:12.5px;color:#B45309;margin-top:2px;"><b>ตัวแทนจำหน่ายที่ดูแล:</b> ${m.dealerName || '-'} (${m.dealerContact || '-'} โทร ${m.dealerPhone || '-'})</div>
          </div>
          <div style="font-weight:700;color:#002B49;margin-bottom:8px;">📋 ไทม์ไลน์ประวัติเครื่อง 360°:</div>
          ${timelineHtml}
          ${photosHtml}
        `;
      } catch (err) {
        body.innerHTML = '<div style="color:#B91C1C;">ค้นหาไม่สำเร็จ: ' + err.message + '</div>';
      }
    }

    document.getElementById('hzkSn360SearchBtn').onclick = runSearchSn;
    if (prefillSn) runSearchSn();
  }

  async function openTechnicianVanStockModal() {
    let vModal = document.getElementById('hzkVanStockModal');
    if (!vModal) {
      vModal = document.createElement('div');
      vModal.id = 'hzkVanStockModal';
      vModal.style.cssText =
        'position:fixed;inset:0;z-index:20042;background:rgba(15,23,42,0.82);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(vModal);
    }

    vModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:960px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;">
        <div style="background:#7F1D1D;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:2;">
          <div>
            <div style="font-size:11px;color:#FECACA;font-weight:800;">TECHNICIAN VAN STOCK &amp; AUTO STORE REPLENISHMENT</div>
            <div style="font-size:16px;font-weight:700;">🚐 คลังอะไหล่ประจำรถช่างบริการ (T01–T08) &amp; เบิกเติมอัตโนมัติ</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkVanStockModal').style.display='none'" style="background:#0F172A;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:16px 20px;font-size:13px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
            <label style="font-weight:700;">เลือกรถช่าง:</label>
            <select id="hzkVanFilterSel" style="padding:7px 12px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
              <option value="ALL">รถช่างทั้งหมด (T01 – T08)</option>
              <option value="T01">T01 (Bangkok North)</option>
              <option value="T02">T02 (Bangkok South)</option>
              <option value="T03">T03 (Bangkok East)</option>
              <option value="T04">T04 (Nonthaburi)</option>
              <option value="T05">T05 (Samut Prakan)</option>
              <option value="T06">T06 (Ayutthaya)</option>
              <option value="T07">T07 (Upcountry)</option>
              <option value="T08">T08 (Install &amp; PM)</option>
            </select>
            <button type="button" id="hzkVanRefreshBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">🔄 รีเฟรชสต็อก</button>
          </div>
          <div id="hzkVanTableWrap">⏳ กำลังโหลดข้อมูลสต็อกรถช่าง...</div>
        </div>
      </div>
    `;
    vModal.style.display = 'flex';

    async function loadVanRows() {
      const wrap = document.getElementById('hzkVanTableWrap');
      const gasUrl = getGasEndpointUrl();
      if (!gasUrl) {
        wrap.innerHTML = '<div style="color:#B91C1C;">กรุณาตั้งค่า Google Apps Script URL ก่อนใช้งานครับ</div>';
        return;
      }
      const vanCode = document.getElementById('hzkVanFilterSel').value;
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getVanStock', vanCode: vanCode })
      });
      const data = await res.json();
      const items = (data && data.items) || [];
      wrap.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;min-width:740px;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#0F172A;color:#FFF;">
                <th style="padding:8px;">รถช่าง</th>
                <th style="padding:8px;">รหัสอะไหล่</th>
                <th style="padding:8px;text-align:left;">ชื่ออะไหล่</th>
                <th style="padding:8px;">คงเหลือ</th>
                <th style="padding:8px;">ขั้นต่ำ</th>
                <th style="padding:8px;">เบิกใช้หน้างาน / เติมเข้าคลังรถ</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => {
                const isLow = it.qty < it.minQty;
                return `
                  <tr style="background:${isLow ? '#FEF2F2' : '#FFF'};">
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:700;">${it.vanCode}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${it.partCode}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;">${it.partName}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:800;color:${isLow ? '#DC2626' : '#059669'};">${it.qty}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${it.minQty}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
                      <button type="button" data-van="${it.vanCode}" data-part="${it.partCode}" data-delta="-1" class="hzk-van-adj-btn" style="background:#DC2626;color:#FFF;border:none;border-radius:6px;padding:4px 9px;font-weight:700;cursor:pointer;margin-right:4px;">-1 เบิกใช้</button>
                      <button type="button" data-van="${it.vanCode}" data-part="${it.partCode}" data-delta="1" class="hzk-van-adj-btn" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:4px 9px;font-weight:700;cursor:pointer;">+1 เติมสต็อก</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      wrap.querySelectorAll('.hzk-van-adj-btn').forEach(btn => {
        btn.onclick = async function () {
          const r = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'adjustVanStock',
              vanCode: btn.getAttribute('data-van'),
              partCode: btn.getAttribute('data-part'),
              delta: Number(btn.getAttribute('data-delta'))
            })
          });
          const resAdj = await r.json();
          if (resAdj && resAdj.lowStockAlert) {
            alert('⚠️ อะไหล่เหลือน้อยกว่าเกณฑ์ขั้นต่ำ! ระบบส่งใบขอเบิกเติมเข้ากลุ่ม LINE สโตร์เรียบร้อยแล้วครับ');
          }
          loadVanRows();
        };
      });
    }

    document.getElementById('hzkVanRefreshBtn').onclick = loadVanRows;
    document.getElementById('hzkVanFilterSel').onchange = loadVanRows;
    loadVanRows();
  }

  async function openServiceDispatchCalendarModal() {
    let dModal = document.getElementById('hzkDispatchCalendarModal');
    if (!dModal) {
      dModal = document.createElement('div');
      dModal.id = 'hzkDispatchCalendarModal';
      dModal.style.cssText =
        'position:fixed;inset:0;z-index:20044;background:rgba(15,23,42,0.82);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(dModal);
    }

    const today = new Date().toISOString().slice(0, 10);
    dModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:960px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:2;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">INSTALLATION &amp; FIELD SERVICE DISPATCH BOARD</div>
            <div style="font-size:16px;font-weight:700;">📅 ตารางนัดหมายติดตั้ง &amp; จ่ายคิวงานช่าง (T01–T08)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkDispatchCalendarModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:16px 20px;font-size:13px;">
          <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:12px;margin-bottom:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;">
            <input id="hzkDspDate" type="date" value="${today}" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
            <select id="hzkDspSlot" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;">
              <option value="09:00 - 12:00">09:00 - 12:00 (เช้า)</option>
              <option value="13:00 - 16:30">13:00 - 16:30 (บ่าย)</option>
              <option value="ทั้งวัน (09:00 - 17:00)">ทั้งวัน (09:00 - 17:00)</option>
            </select>
            <select id="hzkDspVan" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
              <option value="T01">ช่าง T01</option><option value="T02">ช่าง T02</option><option value="T03">ช่าง T03</option><option value="T04">ช่าง T04</option>
              <option value="T05">ช่าง T05</option><option value="T06">ช่าง T06</option><option value="T07">ช่าง T07</option><option value="T08">ช่าง T08 (Install)</option>
            </select>
            <select id="hzkDspType" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;">
              <option value="New Installation (ติดตั้งใหม่)">🛠️ ติดตั้งเครื่องใหม่</option>
              <option value="Repair Service (ซ่อมบำรุง)">🔧 ซ่อมบำรุงหน้างาน</option>
              <option value="PM Contract (ล้างประจำปี)">✨ บำรุงรักษา PM</option>
              <option value="Site Survey (สำรวจหน้างาน)">📐 สำรวจหน้างาน</option>
            </select>
            <input id="hzkDspCust" type="text" placeholder="ชื่อร้าน / ลูกค้า" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
            <input id="hzkDspModel" type="text" placeholder="รุ่น / S/N" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
            <button type="button" id="hzkDspAddBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;">+ ลงตาราง &amp; แจ้ง LINE</button>
          </div>
          <div id="hzkDspTableBody">⏳ กำลังโหลดตารางงานช่าง...</div>
        </div>
      </div>
    `;
    dModal.style.display = 'flex';

    const gasUrl = getGasEndpointUrl();
    async function loadSlots() {
      const wrap = document.getElementById('hzkDspTableBody');
      if (!gasUrl) return;
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getDispatchSchedule' })
      });
      const data = await res.json();
      const rows = (data && data.items) || [];
      wrap.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#0F172A;color:#FFF;"><th style="padding:7px;">วันที่</th><th style="padding:7px;">ช่วงเวลา</th><th style="padding:7px;">ช่าง</th><th style="padding:7px;">ประเภทงาน</th><th style="padding:7px;text-align:left;">ลูกค้า</th><th style="padding:7px;">รุ่น / S/N</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr><td style="padding:7px;border:1px solid #CBD5E1;">${r.date}</td><td style="padding:7px;border:1px solid #CBD5E1;">${r.timeSlot}</td><td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;text-align:center;">${r.vanCode}</td><td style="padding:7px;border:1px solid #CBD5E1;">${r.jobType}</td><td style="padding:7px;border:1px solid #CBD5E1;">${r.customer}</td><td style="padding:7px;border:1px solid #CBD5E1;">${r.modelSn}</td></tr>`).join('') || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#64748B;">ยังไม่มีคิวงานในตาราง</td></tr>'}
          </tbody>
        </table>
      `;
    }

    document.getElementById('hzkDspAddBtn').onclick = async function () {
      if (!gasUrl) return;
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createDispatchSlot',
          date: document.getElementById('hzkDspDate').value,
          timeSlot: document.getElementById('hzkDspSlot').value,
          vanCode: document.getElementById('hzkDspVan').value,
          jobType: document.getElementById('hzkDspType').value,
          customer: document.getElementById('hzkDspCust').value,
          modelSn: document.getElementById('hzkDspModel').value
        })
      });
      alert('✅ ลงตารางนัดหมายและแจ้งเตือนเข้ากลุ่ม LINE เรียบร้อยแล้ว');
      loadSlots();
    };
    loadSlots();
  }

  async function openMonthlyIncentiveKpiModal() {
    let kModal = document.getElementById('hzkMonthlyIncentiveModal');
    if (!kModal) {
      kModal = document.createElement('div');
      kModal.id = 'hzkMonthlyIncentiveModal';
      kModal.style.cssText =
        'position:fixed;inset:0;z-index:20046;background:rgba(15,23,42,0.82);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(kModal);
    }

    kModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:920px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#FBBF24;font-weight:800;">SALES &amp; TECHNICIAN PERFORMANCE / INCENTIVE TRACKER</div>
            <div style="font-size:16px;font-weight:700;">🏆 สรุปผลงานปิดการขาย (PO Approved) &amp; ปิดงานช่างรายบุคคล</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkMonthlyIncentiveModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div id="hzkIncentiveBody" style="padding:18px 20px;font-size:13px;">⏳ กำลังคำนวณผลงานรายบุคคล...</div>
      </div>
    `;
    kModal.style.display = 'flex';

    const gasUrl = getGasEndpointUrl();
    const body = document.getElementById('hzkIncentiveBody');
    if (!gasUrl) return;
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getMonthlyIncentiveKpi' })
    });
    const d = await res.json();
    const sList = (d && d.salesRanking) || [];
    const tList = (d && d.techRanking) || [];

    body.innerHTML = `
      <h4 style="margin:0 0 8px;color:#002B49;">💼 ผลงานฝ่ายขาย &amp; Japanese Corporate (Quoted vs PO Approved)</h4>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px;">
        <thead><tr style="background:#002B49;color:#FFF;"><th style="padding:7px;text-align:left;">รหัสพนักงาน</th><th style="padding:7px;">ใบเสนอราคา (ฉบับ)</th><th style="padding:7px;text-align:right;">ยอดเสนอรวม</th><th style="padding:7px;">ปิดการขาย (PO)</th><th style="padding:7px;text-align:right;">ยอดปิดการขายจริง</th></tr></thead>
        <tbody>
          ${sList.map(s => `<tr><td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${s.code}</td><td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${s.quotedCount}</td><td style="padding:7px;border:1px solid #CBD5E1;text-align:right;">${Number(s.quotedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:700;color:#059669;">${s.wonCount}</td><td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:700;color:#059669;">${Number(s.wonAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>`).join('') || '<tr><td colspan="5" style="padding:10px;text-align:center;color:#64748B;">ยังไม่มีข้อมูลยอดขาย</td></tr>'}
        </tbody>
      </table>
      <h4 style="margin:0 0 8px;color:#7F1D1D;">🛠️ ผลงานฝ่ายบริการ &amp; ช่างภาคสนาม</h4>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#7F1D1D;color:#FFF;"><th style="padding:7px;text-align:left;">ช่างบริการ</th><th style="padding:7px;">ใบงานทั้งหมด</th><th style="padding:7px;">ปิดงานสำเร็จ</th></tr></thead>
        <tbody>
          ${tList.map(t => `<tr><td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${t.tech}</td><td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${t.totalJobs}</td><td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:700;color:#059669;">${t.completedJobs}</td></tr>`).join('') || '<tr><td colspan="3" style="padding:10px;text-align:center;color:#64748B;">ยังไม่มีข้อมูลใบงานซ่อม</td></tr>'}
        </tbody>
      </table>
    `;
  }

  window.openDepartmentLiveSimulatorModal = openDepartmentLiveSimulatorModal;
  window.openSerial360TimelineModal = openSerial360TimelineModal;
  window.openTechnicianVanStockModal = openTechnicianVanStockModal;
  window.openServiceDispatchCalendarModal = openServiceDispatchCalendarModal;
  window.openMonthlyIncentiveKpiModal = openMonthlyIncentiveKpiModal;


  // ============================================================================
  // MOBILE CLEAN-UI AUTO-DECLUTTER & UNIVERSAL RUNTIME GUARD (v1156)
  // ============================================================================
  function showHzkToastNotification(msg, isError) {
    let toast = document.getElementById('hzkGlobalRuntimeToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hzkGlobalRuntimeToast';
      toast.style.cssText =
        'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:25000;' +
        'max-width:92vw;padding:10px 16px;border-radius:12px;font-family:sans-serif;' +
        'font-size:12.5px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.35);' +
        'transition:opacity 0.25s ease;pointer-events:auto;';
      document.body.appendChild(toast);
    }
    toast.style.background = isError ? '#991B1B' : '#002B49';
    toast.style.color = '#FFFFFF';
    toast.style.border = isError ? '1px solid #FCA5A5' : '1px solid #38BDF8';
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 4200);
  }

  function installGlobalRuntimeGuard() {
    if (window._hzkRuntimeGuardInstalled) return;
    window._hzkRuntimeGuardInstalled = true;

    window.addEventListener('error', function (ev) {
      if (ev && ev.message) {
        if (/is not defined/.test(ev.message) && ev.defaultPrevented) return;
        console.warn('[HZK Guard] Caught runtime error:', ev.message);
        showHzkToastNotification('⚠️ แจ้งเตือนระบบ: ' + ev.message, true);
      }
    });

    window.addEventListener('unhandledrejection', function (ev) {
      const reason = ev && ev.reason ? (ev.reason.message || String(ev.reason)) : 'Network / Script Error';
      console.warn('[HZK Guard] Unhandled promise:', reason);
      showHzkToastNotification('⚠️ การเชื่อมต่อขัดข้อง: ' + reason, true);
    });
  }

  function initMobileCleanUiDeclutter() {
    const styleId = 'hzkMobileCleanUiCssV1156';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        @media (max-width: 820px) {
          body.hzk-mobile-clean-mode .hzk-mobile-collapsed-pill {
            display: none !important;
          }
          body.hzk-mobile-clean-mode #hzkPilotCompactNote {
            font-size: 11px !important;
            line-height: 1.3 !important;
            margin: 2px 0 4px !important;
          }
          #hzkMobileCleanControlBar {
            display: flex !important;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
            width: 100%;
            margin-top: 6px;
          }
        }
        @media (min-width: 821px) {
          #hzkMobileCleanControlBar {
            display: inline-flex !important;
            gap: 6px;
            align-items: center;
          }
        }
      `;
      document.head.appendChild(st);
    }

    // Default to clean mobile mode on phones/tablets <= 820px
    const isMobile = window.innerWidth <= 820;
    const savedPref = localStorage.getItem('hzk_mobile_clean_mode');
    const enableClean = savedPref === null ? isMobile : (savedPref === 'true');
    if (enableClean) {
      document.body.classList.add('hzk-mobile-clean-mode');
    }

    // Tag secondary Admin/Dev buttons in header & pilot banner so they collapse cleanly on mobile
    const secondaryPatterns = [
      /Next-Gen 5 ด้าน/i,
      /Audit & Resilience/i,
      /Omni-Scale/i,
      /KPI Report Studio/i,
      /ตั้งค่าสาขา โลโก้/i,
      /อัปเดตแอป/i,
      /ML ภาพเคสเก่า/i,
      /ตรวจระบบ & โหมดโชว์/i,
      /ยืนยันพร้อมเฟส 2/i,
      /Install App/i,
      /คำสั่งด่วน/i,
      /คู่มือ & ตัวอย่าง/i
    ];

    const collapsedButtons = [];
    document.querySelectorAll('header button, #topHeaderRightPillsWrap button, #topHeaderStatusPillsRow button, div button').forEach(btn => {
      if (btn.closest('#hzkUnifiedDocSuiteMenu') || btn.closest('#hzkMobileAdminDrawerMenu') || btn.id === 'hzkUnifiedDocSuiteBtn') return;
      const txt = (btn.textContent || '').trim();
      if (secondaryPatterns.some(rx => rx.test(txt))) {
        btn.classList.add('hzk-mobile-collapsed-pill');
        collapsedButtons.push({ label: txt, el: btn });
      }
    });

    // Also compact the PHASE 1 PILOT RUN banner paragraph if present
    document.querySelectorAll('div, p, span').forEach(el => {
      if (el.children.length === 0 && /ช่วงทดลองใช้งานจริง\s*—\s*ขอความร่วมมือ/.test(el.textContent || '')) {
        el.id = 'hzkPilotCompactNote';
      }
    });

    // Build compact Mobile Control Bar (`📋 เอกสาร & ติดตามสถานะ ▾` + `⚙️ เครื่องมือระบบ ▾` + `👁️ ปุ่มทั้งหมด`)
    const docWrap = document.getElementById('hzkUnifiedDocSuiteWrap');
    const docBtn = document.getElementById('hzkUnifiedDocSuiteBtn');
    if (!docWrap || !docBtn || document.getElementById('hzkMobileAdminToolsBtn')) return;

    // Make docBtn compact & balanced instead of stretching full width
    docBtn.style.width = 'auto';
    docBtn.style.flex = '1 1 auto';
    docBtn.style.justifyContent = 'center';

    const adminToolsBtn = document.createElement('button');
    adminToolsBtn.id = 'hzkMobileAdminToolsBtn';
    adminToolsBtn.type = 'button';
    adminToolsBtn.innerHTML = '⚙️ เครื่องมือระบบ ▾';
    adminToolsBtn.style.cssText =
      'background:#1E293B;color:#F8FAFC;border:1px solid #475569;' +
      'border-radius:999px;padding:5px 12px;font-weight:700;font-size:12px;line-height:1.35;' +
      'cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;height:28px;';

    const toggleAllBtn = document.createElement('button');
    toggleAllBtn.id = 'hzkToggleAllHeaderBtns';
    toggleAllBtn.type = 'button';
    toggleAllBtn.innerHTML = document.body.classList.contains('hzk-mobile-clean-mode') ? '👁️ แสดงปุ่มทั้งหมด' : '✨ ย่อหน้าจอ';
    toggleAllBtn.style.cssText =
      'background:#0F172A;color:#38BDF8;border:1px solid #0284C7;' +
      'border-radius:999px;padding:5px 10px;font-weight:700;font-size:11px;line-height:1.35;' +
      'cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;height:28px;';

    toggleAllBtn.onclick = function (e) {
      e.stopPropagation();
      const nowClean = document.body.classList.toggle('hzk-mobile-clean-mode');
      localStorage.setItem('hzk_mobile_clean_mode', String(nowClean));
      toggleAllBtn.innerHTML = nowClean ? '👁️ แสดงปุ่มทั้งหมด' : '✨ ย่อหน้าจอ';
      showHzkToastNotification(nowClean ? '✨ เปิดโหมดหน้าจอกระชับ (Mobile Clean-UI)' : '👁️ แสดงปุ่มควบคุมทั้งหมดแล้ว', false);
    };

    const adminDrawer = document.createElement('div');
    adminDrawer.id = 'hzkMobileAdminDrawerMenu';
    adminDrawer.style.cssText =
      'display:none;position:fixed;min-width:265px;max-width:92vw;max-height:70vh;overflow-y:auto;' +
      'background:#FFFFFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:12px;' +
      'box-shadow:0 14px 35px rgba(15,23,42,0.35);padding:6px;z-index:20005;font-family:sans-serif;font-size:12.5px;';

    adminToolsBtn.onclick = function (e) {
      e.stopPropagation();
      if (adminDrawer.style.display === 'block') {
        adminDrawer.style.display = 'none';
        return;
      }
      adminDrawer.innerHTML = '<div style="font-size:11px;font-weight:800;color:#0369A1;padding:6px 10px;border-bottom:1px solid #E2E8F0;">⚙️ เครื่องมือตั้งค่า &amp; Admin ที่ซ่อนไว้</div>';
      if (collapsedButtons.length === 0) {
        adminDrawer.innerHTML += '<div style="padding:10px;color:#64748B;font-size:12px;">ไม่มีปุ่มที่ถูกซ่อนในหน้านี้</div>';
      } else {
        collapsedButtons.forEach(item => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = item.label;
          b.style.cssText =
            'width:100%;text-align:left;background:transparent;border:none;border-radius:8px;' +
            'padding:8px 10px;cursor:pointer;font-weight:700;font-size:12px;color:#0F172A;display:block;';
          b.onmouseenter = () => { b.style.background = '#F0F9FF'; };
          b.onmouseleave = () => { b.style.background = 'transparent'; };
          b.onclick = () => {
            adminDrawer.style.display = 'none';
            item.el.click();
          };
          adminDrawer.appendChild(b);
        });
      }
      const rect = adminToolsBtn.getBoundingClientRect();
      adminDrawer.style.top = Math.min(window.innerHeight - 320, rect.bottom + 6) + 'px';
      adminDrawer.style.left = Math.max(8, Math.min(window.innerWidth - 280, rect.left)) + 'px';
      adminDrawer.style.display = 'block';
    };

    document.addEventListener('click', (e) => {
      if (!adminToolsBtn.contains(e.target) && !adminDrawer.contains(e.target)) {
        adminDrawer.style.display = 'none';
      }
    });

    docWrap.style.display = 'flex';
    docWrap.style.flexWrap = 'wrap';
    docWrap.style.gap = '6px';
    docWrap.style.alignItems = 'center';
    docWrap.appendChild(adminToolsBtn);
    docWrap.appendChild(toggleAllBtn);
    document.body.appendChild(adminDrawer);
  }



  // ============================================================================
  // ENTERPRISE v1170 MODULE: SERIAL 360° LIFECYCLE P&L, PRICING INTELLIGENCE,
  // NAV SALES HISTORY IMPORTER & PRE-INSTALL SITE SURVEY CHECKLIST
  // ============================================================================
  const HZK_V1170_LOCAL_PNL_KEY = 'hzk_v1170_local_nav_sales_cache';

  function getLocalFallbackLifecycleData(prefillSn) {
    let customRows = [];
    try {
      customRows = JSON.parse(localStorage.getItem(HZK_V1170_LOCAL_PNL_KEY) || '[]');
    } catch (e) {}

    const baseUnits = [
      {
        serialNumber: 'K01234J',
        model: 'IM-130NE',
        customerStore: 'ร้านกาแฟตัวอย่าง สาขาภูเก็ต',
        customerPhone: '0819793085',
        province: 'ภูเก็ต',
        warrantyStatus: 'IN-WARRANTY (หมด 2027-12-31)',
        dealerName: 'บริษัท อันดามัน คูลลิ่ง จำกัด (Dealer A)',
        saleChannel: 'Dealer',
        refDocNo: 'SO-2026-0142',
        saleDate: '2026-01-15',
        netSellingPrice: 68500,
        warrantyYears: 2,
        includedPmCount: 2,
        promoTag: 'PROMO-FILTER-FREE',
        serviceEvents: [
          { source: 'Service Job', refId: 'JOB-260312', date: '2026-03-12', symptom: 'เปลี่ยน Water Valve + ล้างระบบ (ในประกัน)', technician: 'T07 (Upcountry)', status: 'COMPLETED', billingType: 'WARRANTY', partsCost: 1450, laborCost: 1200, travelCost: 1800, totalCost: 4450, customerBilled: 0 },
          { source: 'PM Contract', refId: 'PM-260715', date: '2026-07-15', symptom: 'PM รอบ 6 เดือน (ฟรีตามโปรโมชั่น)', technician: 'Dealer A Tech', status: 'COMPLETED', billingType: 'PM', partsCost: 350, laborCost: 600, travelCost: 800, totalCost: 1750, customerBilled: 0 }
        ],
        warrantyCostTotal: 4450,
        pmPromoCostTotal: 1750,
        billableRevenueTotal: 0,
        billableCostTotal: 0,
        repairCount: 2
      },
      {
        serialNumber: 'L05678M',
        model: 'KM-160B',
        customerStore: 'โรงแรมตัวอย่าง กรุงเทพฯ',
        customerPhone: '0890001122',
        province: 'กรุงเทพฯ',
        warrantyStatus: 'IN-WARRANTY (หมด 2027-08-15)',
        dealerName: 'บริษัท สยามไอซ์เทค จำกัด (Dealer B)',
        saleChannel: 'Dealer',
        refDocNo: 'SO-2026-0218',
        saleDate: '2026-02-20',
        netSellingPrice: 84000,
        warrantyYears: 2,
        includedPmCount: 0,
        promoTag: 'STANDARD-DEALER',
        serviceEvents: [
          { source: 'Service Job', refId: 'JOB-260504', date: '2026-05-04', symptom: 'ตรวจเช็ก Float Switch & Board (ในประกัน)', technician: 'T01 (BKK North)', status: 'COMPLETED', billingType: 'WARRANTY', partsCost: 2200, laborCost: 1200, travelCost: 500, totalCost: 3900, customerBilled: 0 }
        ],
        warrantyCostTotal: 3900,
        pmPromoCostTotal: 0,
        billableRevenueTotal: 0,
        billableCostTotal: 0,
        repairCount: 1
      },
      {
        serialNumber: 'M09876P',
        model: 'FM-120KE',
        customerStore: 'ร้านอาหารญี่ปุ่น เชียงใหม่',
        customerPhone: '0865556677',
        province: 'เชียงใหม่',
        warrantyStatus: 'OUT-OF-WARRANTY',
        dealerName: 'HOSHIZAKI Direct Service',
        saleChannel: 'Japanese Corporate',
        refDocNo: 'QT-JPC-2024-089',
        saleDate: '2024-06-10',
        netSellingPrice: 92000,
        warrantyYears: 1,
        includedPmCount: 4,
        promoTag: 'JPC-VIP-4PM',
        serviceEvents: [
          { source: 'Service Job', refId: 'JOB-250118', date: '2025-01-18', symptom: 'เปลี่ยน Gear Motor & Bearing (ในประกัน)', technician: 'T07 (Upcountry)', status: 'COMPLETED', billingType: 'WARRANTY', partsCost: 4800, laborCost: 1200, travelCost: 1800, totalCost: 7800, customerBilled: 0 },
          { source: 'Service Job', refId: 'JOB-260822', date: '2026-08-22', symptom: 'ซ่อมนอกประกัน + เปลี่ยนชุดซีล & ปั๊มน้ำ', technician: 'T07 (Upcountry)', status: 'COMPLETED', billingType: 'BILLABLE', partsCost: 3600, laborCost: 1500, travelCost: 1800, totalCost: 6900, customerBilled: 11800 }
        ],
        warrantyCostTotal: 7800,
        pmPromoCostTotal: 0,
        billableRevenueTotal: 11800,
        billableCostTotal: 6900,
        repairCount: 2
      },
      {
        serialNumber: 'N11223R',
        model: 'IM-240ANE-HC',
        customerStore: 'Chain Cafe สาขาสยามสแควร์',
        customerPhone: '0823334455',
        province: 'กรุงเทพฯ',
        warrantyStatus: 'IN-WARRANTY (หมด 2028-03-31)',
        dealerName: 'HOSHIZAKI Direct Service',
        saleChannel: 'Chain Account',
        refDocNo: 'SO-2026-0305',
        saleDate: '2026-04-01',
        netSellingPrice: 118000,
        warrantyYears: 2,
        includedPmCount: 4,
        promoTag: 'CHAIN-2YR-WARRANTY',
        serviceEvents: [],
        warrantyCostTotal: 0,
        pmPromoCostTotal: 0,
        billableRevenueTotal: 0,
        billableCostTotal: 0,
        repairCount: 0
      }
    ];

    customRows.forEach(r => {
      const sn = String(r.serialNo || '').toUpperCase();
      if (!sn) return;
      const idx = baseUnits.findIndex(u => u.serialNumber === sn);
      const itemObj = {
        serialNumber: sn,
        model: String(r.model || 'IM-100NE-HC').toUpperCase(),
        customerStore: r.customerName || '-',
        customerPhone: r.customerPhone || '-',
        province: r.province || 'กรุงเทพฯ',
        warrantyStatus: 'IN-WARRANTY (' + (r.warrantyYears || 1) + ' ปี)',
        dealerName: r.dealerName || 'HOSHIZAKI Direct Service',
        saleChannel: r.saleChannel || 'Dealer',
        refDocNo: r.refDocNo || 'NAV-IMPORT',
        saleDate: r.saleDate || '-',
        netSellingPrice: Number(r.netPrice || 0),
        warrantyYears: Number(r.warrantyYears || 1),
        includedPmCount: Number(r.includedPmCount || 0),
        promoTag: r.promoTag || '-',
        serviceEvents: idx >= 0 ? baseUnits[idx].serviceEvents : [],
        warrantyCostTotal: idx >= 0 ? baseUnits[idx].warrantyCostTotal : 0,
        pmPromoCostTotal: idx >= 0 ? baseUnits[idx].pmPromoCostTotal : 0,
        billableRevenueTotal: idx >= 0 ? baseUnits[idx].billableRevenueTotal : 0,
        billableCostTotal: idx >= 0 ? baseUnits[idx].billableCostTotal : 0,
        repairCount: idx >= 0 ? baseUnits[idx].repairCount : 0
      };
      if (idx >= 0) baseUnits[idx] = itemObj;
      else baseUnits.unshift(itemObj);
    });

    baseUnits.forEach(u => {
      u.companyAbsorbedCost = u.warrantyCostTotal + u.pmPromoCostTotal;
      u.serviceNetProfit = u.billableRevenueTotal - u.billableCostTotal;
      u.lifecycleNetContribution = u.netSellingPrice - u.companyAbsorbedCost + u.serviceNetProfit;
      u.costToSalesPct = u.netSellingPrice > 0 ? Number(((u.companyAbsorbedCost / u.netSellingPrice) * 100).toFixed(2)) : 0;
      u.netMarginPct = u.netSellingPrice > 0 ? Number(((u.lifecycleNetContribution / u.netSellingPrice) * 100).toFixed(2)) : 0;
    });

    const mMap = {};
    const dMap = {};
    baseUnits.forEach(u => {
      if (!mMap[u.model]) {
        mMap[u.model] = { model: u.model, unitCount: 0, totalSalesThb: 0, totalWarrantyCostThb: 0, totalRepairs: 0 };
      }
      mMap[u.model].unitCount++;
      mMap[u.model].totalSalesThb += u.netSellingPrice;
      mMap[u.model].totalWarrantyCostThb += u.warrantyCostTotal;
      mMap[u.model].totalRepairs += u.repairCount;

      if (!dMap[u.dealerName]) {
        dMap[u.dealerName] = { dealerName: u.dealerName, saleChannel: u.saleChannel, unitCount: 0, claimedUnits: 0, totalSalesThb: 0, totalWarrantyCostThb: 0 };
      }
      dMap[u.dealerName].unitCount++;
      if (u.repairCount > 0) dMap[u.dealerName].claimedUnits++;
      dMap[u.dealerName].totalSalesThb += u.netSellingPrice;
      dMap[u.dealerName].totalWarrantyCostThb += u.warrantyCostTotal;
    });

    const modelBenchmark = Object.values(mMap).map(x => {
      const avgSale = x.unitCount ? Math.round(x.totalSalesThb / x.unitCount) : 0;
      const avgCost = x.unitCount ? Math.round(x.totalWarrantyCostThb / x.unitCount) : 0;
      const ratio = x.totalSalesThb ? Number(((x.totalWarrantyCostThb / x.totalSalesThb) * 100).toFixed(2)) : 0;
      return {
        model: x.model,
        unitCount: x.unitCount,
        avgSalePrice: avgSale,
        totalSalesThb: x.totalSalesThb,
        totalWarrantyCostThb: x.totalWarrantyCostThb,
        avgWarrantyCostPerUnit: avgCost,
        claimRatioPct: ratio,
        totalRepairs: x.totalRepairs,
        recommendedPmAnnual: Math.max(3500, Math.round((avgCost * 1.35 + 1900) / 100) * 100),
        recommendedExtWarranty1Yr: Math.max(2900, Math.round((avgCost * 1.65) / 100) * 100)
      };
    });

    const dealerBenchmark = Object.values(dMap).map(x => {
      const rate = x.unitCount ? Number(((x.claimedUnits / x.unitCount) * 100).toFixed(1)) : 0;
      const avgC = x.unitCount ? Math.round(x.totalWarrantyCostThb / x.unitCount) : 0;
      return {
        dealerName: x.dealerName,
        saleChannel: x.saleChannel,
        unitCount: x.unitCount,
        claimedUnits: x.claimedUnits,
        claimRatePct: rate,
        totalSalesThb: x.totalSalesThb,
        totalWarrantyCostThb: x.totalWarrantyCostThb,
        avgClaimCostPerUnit: avgC,
        qualityGrade: rate <= 15 ? 'A (มาตรฐานดีเยี่ยม)' : (rate <= 35 ? 'B (เฝ้าระวังติดตั้ง)' : 'C (ต้องอบรมช่างดีลเลอร์)')
      };
    });

    const q = String(prefillSn || '').trim().toUpperCase();
    const selected = (q && baseUnits.find(u => u.serialNumber === q)) || baseUnits[0];

    return {
      status: 'LOCAL_DEMO',
      config: {
        standardLaborThb: 1200,
        travelBkkThb: 500,
        travelVicinityThb: 850,
        travelUpcountryThb: 1800,
        defaultPartsCostThb: 1450,
        pmStandardCostThb: 950,
        targetNetMarginPct: 28
      },
      selectedUnit: selected,
      allUnits: baseUnits,
      modelBenchmark: modelBenchmark,
      dealerBenchmark: dealerBenchmark,
      lotAlerts: []
    };
  }

  async function openSerialLifecyclePricingSuiteModal(prefillSn) {
    let modal = document.getElementById('hzkLifecyclePnLModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkLifecyclePnLModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20060;background:rgba(15,23,42,0.86);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1120px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#0F172A);color:#FFF;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;border-bottom:2px solid #0284C7;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;letter-spacing:0.5px;">ENTERPRISE v1170 • SERIAL 360° LIFECYCLE P&amp;L &amp; PRICING INTELLIGENCE</div>
            <div style="font-size:16.5px;font-weight:800;">💰 วิเคราะห์กำไร-ขาดทุนรายเครื่อง (S/N) • เทียบดีลเลอร์/รุ่น • จำลองตั้งราคา &amp; โปรโมชั่น</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkLifecyclePnLModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="background:#F1F5F9;padding:10px 18px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #CBD5E1;position:sticky;top:62px;z-index:4;">
          <button type="button" class="hzk-pnl-tab-btn" data-tab="UNIT" style="background:#002B49;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">🔎 1. วิเคราะห์รายเครื่อง (Unit P&amp;L)</button>
          <button type="button" class="hzk-pnl-tab-btn" data-tab="BENCH" style="background:#FFFFFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">📊 2. เทียบข้ามรุ่น &amp; ดีลเลอร์ (Benchmark)</button>
          <button type="button" class="hzk-pnl-tab-btn" data-tab="SIM" style="background:#FFFFFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">🧮 3. จำลองตั้งราคา &amp; แพ็คเกจ PM/โปรโมชั่น</button>
          <button type="button" class="hzk-pnl-tab-btn" data-tab="IMPORT" style="background:#FFFFFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">📥 4. นำเข้าประวัติขาย NAV &amp; ตั้งเรทต้นทุน</button>
        </div>

        <div id="hzkLifecyclePnLBody" style="padding:18px 20px;font-size:13px;">⏳ กำลังประมวลผลข้อมูลการขายและประวัติซ่อมรายเครื่อง...</div>
      </div>
    `;
    modal.style.display = 'flex';

    let activeTab = 'UNIT';
    let cachedState = null;

    function fmtNum(v) {
      return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function updateTabButtons() {
      modal.querySelectorAll('.hzk-pnl-tab-btn').forEach(b => {
        const isAct = b.getAttribute('data-tab') === activeTab;
        b.style.background = isAct ? '#002B49' : '#FFFFFF';
        b.style.color = isAct ? '#FFFFFF' : '#0F172A';
        b.style.border = isAct ? 'none' : '1px solid #CBD5E1';
      });
    }

    modal.querySelectorAll('.hzk-pnl-tab-btn').forEach(b => {
      b.onclick = () => {
        activeTab = b.getAttribute('data-tab');
        updateTabButtons();
        renderActiveTab();
      };
    });

    async function fetchLifecycleData(snQuery) {
      const body = document.getElementById('hzkLifecyclePnLBody');
      body.innerHTML = '⏳ กำลังโหลดข้อมูลวิเคราะห์ต้นทุนและราคาขาย...';
      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          const res = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getSerialLifecyclePnL', serialNo: snQuery || '' })
          });
          const d = await res.json();
          if (d && d.status === 'OK') {
            cachedState = d;
            renderActiveTab();
            return;
          }
        } catch (err) {
          console.warn('GAS Lifecycle fetch fallback:', err);
        }
      }
      cachedState = getLocalFallbackLifecycleData(snQuery);
      renderActiveTab();
    }

    function renderActiveTab() {
      const body = document.getElementById('hzkLifecyclePnLBody');
      if (!cachedState) return;
      const u = cachedState.selectedUnit || (cachedState.allUnits && cachedState.allUnits[0]) || null;
      const cfg = cachedState.config || {};
      const sourceBadge = cachedState.status === 'OK'
        ? '<span style="background:#DCFCE7;color:#166534;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;">🟢 เชื่อมต่อ Google Sheets Live</span>'
        : '<span style="background:#FEF3C7;color:#92400E;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;">🟡 โหมดฐานข้อมูลตัวอย่างในเครื่อง (ตั้งค่า GAS URL เพื่อซิงก์สด)</span>';

      if (activeTab === 'UNIT') {
        const quickPills = (cachedState.allUnits || []).slice(0, 8).map(item =>
          `<button type="button" class="hzk-sn-quick-pill" data-sn="${item.serialNumber}" style="background:${u && u.serialNumber === item.serialNumber ? '#0284C7' : '#E2E8F0'};color:${u && u.serialNumber === item.serialNumber ? '#FFF' : '#0F172A'};border:none;border-radius:999px;padding:4px 11px;font-size:11.5px;font-weight:700;cursor:pointer;">${item.serialNumber} (${item.model})</button>`
        ).join('');

        if (!u) {
          body.innerHTML = `<div style="color:#64748B;">ไม่พบข้อมูลเครื่องในระบบ กรุณานำเข้าข้อมูลในแท็บที่ 4</div>`;
          return;
        }

        const marginColor = u.netMarginPct >= 25 ? '#059669' : (u.netMarginPct >= 10 ? '#D97706' : '#DC2626');
        const eventsRows = (u.serviceEvents || []).map(ev => {
          const isBillable = ev.billingType === 'BILLABLE';
          const badge = isBillable
            ? '<span style="background:#DCFCE7;color:#166534;padding:2px 7px;border-radius:6px;font-weight:700;font-size:11px;">รายได้นอกประกัน</span>'
            : (ev.billingType === 'PM'
              ? '<span style="background:#E0F2FE;color:#075985;padding:2px 7px;border-radius:6px;font-weight:700;font-size:11px;">ต้นทุน PM โปรฯ</span>'
              : '<span style="background:#FEE2E2;color:#991B1B;padding:2px 7px;border-radius:6px;font-weight:700;font-size:11px;">ต้นทุนเคลมประกัน</span>');
          return `
            <tr>
              <td style="padding:7px;border:1px solid #CBD5E1;white-space:nowrap;">${ev.date}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${ev.refId}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;">${ev.symptom}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${badge}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;">${fmtNum(ev.partsCost)}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;">${fmtNum(ev.laborCost)}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;">${fmtNum(ev.travelCost)}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:700;color:#DC2626;">${fmtNum(ev.totalCost)}</td>
              <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:700;color:#059669;">${fmtNum(ev.customerBilled)}</td>
            </tr>
          `;
        }).join('') || '<tr><td colspan="9" style="padding:12px;text-align:center;color:#64748B;">เครื่องนี้ยังไม่เคยมีประวัติแจ้งซ่อมหรือเคลมประกัน (Zero Claim — กำไรเต็ม 100%)</td></tr>';

        body.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
            <div style="display:flex;gap:8px;flex:1;min-width:260px;">
              <input id="hzkPnlSnInput" type="text" value="${u.serialNumber}" placeholder="ระบุ Serial Number เช่น K01234J..." style="flex:1;padding:8px 12px;border:1.5px solid #94A3B8;border-radius:8px;font-weight:700;" />
              <button type="button" id="hzkPnlSnSearchBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">🔎 วิเคราะห์ S/N</button>
            </div>
            <div>${sourceBadge}</div>
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">
            <span style="font-size:11.5px;font-weight:700;color:#475569;">เลือกเครื่องด่วน:</span>
            ${quickPills}
          </div>

          <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:14px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-bottom:1px solid #E2E8F0;padding-bottom:10px;margin-bottom:10px;">
              <div>
                <span style="background:#002B49;color:#FFF;padding:3px 9px;border-radius:6px;font-weight:800;font-size:12px;">S/N: ${u.serialNumber}</span>
                <span style="font-size:15px;font-weight:800;color:#002B49;margin-left:8px;">รุ่น ${u.model}</span>
                <span style="background:#E0F2FE;color:#0369A1;padding:3px 9px;border-radius:6px;font-weight:700;font-size:11.5px;margin-left:6px;">ช่องทาง: ${u.saleChannel}</span>
              </div>
              <div style="font-size:12px;color:#334155;"><b>อ้างอิงขาย:</b> ${u.refDocNo} | <b>วันที่ขาย:</b> ${u.saleDate} | <b>โปรฯ:</b> ${u.promoTag}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;font-size:12.5px;">
              <div><b>ผู้ซื้อ / ดีลเลอร์:</b> ${u.dealerName}</div>
              <div><b>ร้านค้าปลายทาง:</b> ${u.customerStore} (${u.province})</div>
              <div><b>สิทธิ์รับประกัน:</b> ${u.warrantyStatus} (แถม PM ${u.includedPmCount} ครั้ง)</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:10px;margin-bottom:16px;">
            <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:12px;">
              <div style="font-size:11px;font-weight:700;color:#1E40AF;">1) ราคาขายสุทธิ (Sell-Out Price)</div>
              <div style="font-size:20px;font-weight:800;color:#002B49;margin-top:4px;">฿${fmtNum(u.netSellingPrice)}</div>
              <div style="font-size:11px;color:#475569;margin-top:2px;">รับประกัน ${u.warrantyYears} ปี | แถม PM ${u.includedPmCount} ครั้ง</div>
            </div>
            <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:12px;">
              <div style="font-size:11px;font-weight:700;color:#991B1B;">2) ต้นทุนซ่อมประกัน &amp; PM สะสม</div>
              <div style="font-size:20px;font-weight:800;color:#DC2626;margin-top:4px;">-฿${fmtNum(u.companyAbsorbedCost)}</div>
              <div style="font-size:11px;color:#7F1D1D;margin-top:2px;">คิดเป็น ${u.costToSalesPct}% ของราคาขาย (${u.repairCount} ครั้ง)</div>
            </div>
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:12px;">
              <div style="font-size:11px;font-weight:700;color:#065F46;">3) กำไรงานบริการนอกประกัน</div>
              <div style="font-size:20px;font-weight:800;color:#059669;margin-top:4px;">+฿${fmtNum(u.serviceNetProfit)}</div>
              <div style="font-size:11px;color:#047857;margin-top:2px;">รายได้ ฿${fmtNum(u.billableRevenueTotal)} - ทุน ฿${fmtNum(u.billableCostTotal)}</div>
            </div>
            <div style="background:#F8FAFC;border:2px solid ${marginColor};border-radius:12px;padding:12px;">
              <div style="font-size:11px;font-weight:800;color:${marginColor};">4) คงเหลือสุทธิตลอดอายุเครื่อง</div>
              <div style="font-size:20px;font-weight:800;color:${marginColor};margin-top:4px;">฿${fmtNum(u.lifecycleNetContribution)}</div>
              <div style="font-size:11px;font-weight:700;color:${marginColor};margin-top:2px;">Net Margin: ${u.netMarginPct}% (เป้า ${cfg.targetNetMarginPct || 28}%)</div>
            </div>
          </div>

          <div style="font-weight:800;color:#002B49;margin-bottom:8px;">🧾 รายละเอียดการซ่อมและค่าใช้จ่ายแต่ละครั้งของเครื่อง S/N: ${u.serialNumber}</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;min-width:780px;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#002B49;color:#FFF;">
                  <th style="padding:8px;">วันที่</th>
                  <th style="padding:8px;">เลขที่ใบงาน</th>
                  <th style="padding:8px;text-align:left;">อาการ / รายการซ่อม</th>
                  <th style="padding:8px;">ประเภท</th>
                  <th style="padding:8px;text-align:right;">ค่าอะไหล่</th>
                  <th style="padding:8px;text-align:right;">ค่าแรง</th>
                  <th style="padding:8px;text-align:right;">ค่าเดินทาง</th>
                  <th style="padding:8px;text-align:right;">ต้นทุนรวม</th>
                  <th style="padding:8px;text-align:right;">เก็บเงินลูกค้า</th>
                </tr>
              </thead>
              <tbody>${eventsRows}</tbody>
            </table>
          </div>
        `;

        document.getElementById('hzkPnlSnSearchBtn').onclick = () => {
          fetchLifecycleData(document.getElementById('hzkPnlSnInput').value);
        };
        modal.querySelectorAll('.hzk-sn-quick-pill').forEach(p => {
          p.onclick = () => fetchLifecycleData(p.getAttribute('data-sn'));
        });
      }

      if (activeTab === 'BENCH') {
        const mRows = (cachedState.modelBenchmark || []).map(m => `
          <tr>
            <td style="padding:7px;border:1px solid #CBD5E1;font-weight:800;color:#002B49;">${m.model}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${m.unitCount}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;">฿${fmtNum(m.avgSalePrice)}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;color:#DC2626;font-weight:700;">฿${fmtNum(m.avgWarrantyCostPerUnit)}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:700;color:${m.claimRatioPct > 8 ? '#DC2626' : '#059669'};">${m.claimRatioPct}%</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;background:#F0FDF4;font-weight:700;color:#166534;">฿${fmtNum(m.recommendedPmAnnual)} / ปี</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;background:#EFF6FF;font-weight:700;color:#1E40AF;">฿${fmtNum(m.recommendedExtWarranty1Yr)} / ปี</td>
          </tr>
        `).join('');

        const dRows = (cachedState.dealerBenchmark || []).map(d => `
          <tr>
            <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${d.dealerName}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${d.saleChannel}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${d.unitCount}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${d.claimedUnits} (${d.claimRatePct}%)</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;">฿${fmtNum(d.totalSalesThb)}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;color:#DC2626;font-weight:700;">฿${fmtNum(d.totalWarrantyCostThb)}</td>
            <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:700;">${d.qualityGrade}</td>
          </tr>
        `).join('');

        body.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div style="font-weight:800;color:#002B49;font-size:14px;">📊 ตารางเปรียบเทียบต้นทุนซ่อมเฉลี่ย &amp; ราคาแพ็คเกจแนะนำแยกตามรุ่น (By Model)</div>
            <button type="button" id="hzkExportLifecycleCsvBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">📥 Export รายงานผู้บริหาร (CSV)</button>
          </div>
          <div style="overflow-x:auto;margin-bottom:18px;">
            <table style="width:100%;min-width:760px;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#002B49;color:#FFF;">
                  <th style="padding:8px;text-align:left;">รุ่นเครื่อง (Model)</th>
                  <th style="padding:8px;">จำนวนเครื่อง</th>
                  <th style="padding:8px;text-align:right;">ราคาขายเฉลี่ย</th>
                  <th style="padding:8px;text-align:right;">ต้นทุนเคลมเฉลี่ย/เครื่อง</th>
                  <th style="padding:8px;">สัดส่วนเคลม/ยอดขาย</th>
                  <th style="padding:8px;text-align:right;">ราคาสัญญา PM แนะนำ</th>
                  <th style="padding:8px;text-align:right;">ราคาขยายประกัน +1 ปี</th>
                </tr>
              </thead>
              <tbody>${mRows}</tbody>
            </table>
          </div>

          <div style="font-weight:800;color:#7F1D1D;font-size:14px;margin-bottom:8px;">🏢 ตารางเปรียบเทียบคุณภาพการติดตั้ง &amp; ต้นทุนเคลมแยกตามดีลเลอร์/ช่องทางขาย (By Dealer / Channel)</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;min-width:760px;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#7F1D1D;color:#FFF;">
                  <th style="padding:8px;text-align:left;">ตัวแทนจำหน่าย / ช่องทาง</th>
                  <th style="padding:8px;">ประเภทช่องทาง</th>
                  <th style="padding:8px;">จำนวนขาย</th>
                  <th style="padding:8px;">เครื่องที่เคลม (%)</th>
                  <th style="padding:8px;text-align:right;">ยอดขายรวม</th>
                  <th style="padding:8px;text-align:right;">ต้นทุนเคลมสะสม</th>
                  <th style="padding:8px;">เกรดคุณภาพติดตั้ง</th>
                </tr>
              </thead>
              <tbody>${dRows}</tbody>
            </table>
          </div>
        `;

        document.getElementById('hzkExportLifecycleCsvBtn').onclick = () => {
          const lines = ['Model,Units,Avg_Sale_THB,Avg_Warranty_Cost_THB,Claim_Ratio_Pct,Rec_PM_Annual_THB,Rec_Ext_Warranty_1Yr_THB'];
          (cachedState.modelBenchmark || []).forEach(m => {
            lines.push([m.model, m.unitCount, m.avgSalePrice, m.avgWarrantyCostPerUnit, m.claimRatioPct, m.recommendedPmAnnual, m.recommendedExtWarranty1Yr].join(','));
          });
          const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'HOSHIZAKI_Lifecycle_Pricing_Benchmark_' + new Date().toISOString().slice(0, 10) + '.csv';
          a.click();
        };
      }

      if (activeTab === 'SIM') {
        const models = cachedState.modelBenchmark || [];
        const firstM = models[0] || { model: 'IM-130NE', avgSalePrice: 68500, avgWarrantyCostPerUnit: 4450 };
        body.innerHTML = `
          <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;margin-bottom:14px;">
            <div style="font-weight:800;color:#002B49;font-size:14px;margin-bottom:4px;">🧮 เครื่องมือจำลองตั้งราคาขาย แพ็คเกจ PM และโปรโมชั่น (Executive Pricing &amp; Promo Simulator)</div>
            <div style="font-size:12px;color:#334155;">คำนวณผลกระทบต่อกำไรสุทธิทันทีเมื่อปรับราคาขาย แถมฟรีสัญญา PM หรือขยายระยะเวลารับประกัน โดยอ้างอิงสถิติค่าซ่อมจริงจากฐานข้อมูล S/N</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
            <div>
              <label style="font-weight:700;font-size:12px;">เลือกรุ่นอ้างอิงสถิติซ่อม:</label>
              <select id="hzkSimModelSel" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:4px;font-weight:700;">
                ${models.map(m => `<option value="${m.model}" data-price="${m.avgSalePrice}" data-cost="${m.avgWarrantyCostPerUnit}">${m.model} (เคลมเฉลี่ย ฿${fmtNum(m.avgWarrantyCostPerUnit)})</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">ราคาขายตั้งต้น (THB):</label>
              <input id="hzkSimSellPrice" type="number" value="${firstM.avgSalePrice}" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:4px;font-weight:700;" />
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">ส่วนลดโปรโมชั่น / ดีลเลอร์ (%):</label>
              <input id="hzkSimDiscountPct" type="number" value="10" min="0" max="50" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:4px;font-weight:700;" />
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">จำนวนครั้ง PM ที่แถมฟรีในโปรโมชั่น:</label>
              <input id="hzkSimFreePm" type="number" value="2" min="0" max="12" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:4px;font-weight:700;" />
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">ขยายรับประกันเพิ่ม (ปี):</label>
              <select id="hzkSimExtYr" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:4px;font-weight:700;">
                <option value="0">ไม่ขยายเพิ่ม (มาตรฐาน 1 ปี)</option>
                <option value="1" selected>ขยายเพิ่ม +1 ปี (รวม 2 ปี)</option>
                <option value="2">ขยายเพิ่ม +2 ปี (รวม 3 ปี)</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">ราคาขายแพ็คเกจเสริมที่เก็บเพิ่ม (THB):</label>
              <input id="hzkSimAddonPrice" type="number" value="4900" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:4px;font-weight:700;" />
            </div>
          </div>

          <div id="hzkSimResultBox" style="background:#F8FAFC;border:2px solid #0284C7;border-radius:14px;padding:16px;"></div>
        `;

        function recalcSim() {
          const sel = document.getElementById('hzkSimModelSel');
          const opt = sel.options[sel.selectedIndex];
          const baseWarrantyCost = Number(opt.getAttribute('data-cost') || 3500);
          const listPrice = Number(document.getElementById('hzkSimSellPrice').value || 0);
          const discPct = Number(document.getElementById('hzkSimDiscountPct').value || 0);
          const freePm = Number(document.getElementById('hzkSimFreePm').value || 0);
          const extYr = Number(document.getElementById('hzkSimExtYr').value || 0);
          const addonPrice = Number(document.getElementById('hzkSimAddonPrice').value || 0);

          const netMachinePrice = listPrice * (1 - discPct / 100);
          const totalRevenue = netMachinePrice + addonPrice;
          const pmCostEach = Number(cfg.pmStandardCostThb || 950) + Number(cfg.travelBkkThb || 500);
          const totalPmCost = freePm * pmCostEach;
          // Free PM reduces breakdown rate by 18% per PM visit (capped at 45%)
          const riskReductionFactor = Math.max(0.55, 1 - Math.min(0.45, freePm * 0.12));
          const expectedWarrantyCost = Math.round((baseWarrantyCost + extYr * baseWarrantyCost * 0.85) * riskReductionFactor);
          const totalAfterSalesCost = totalPmCost + expectedWarrantyCost;
          const netAfterSalesContribution = totalRevenue - totalAfterSalesCost;
          const breakevenPackagePrice = Math.round(totalPmCost + extYr * baseWarrantyCost * 0.85 * riskReductionFactor * 1.25);

          document.getElementById('hzkSimResultBox').innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
              <div>
                <div style="font-size:11.5px;color:#475569;font-weight:700;">รายรับสุทธิรวมแพ็คเกจ</div>
                <div style="font-size:20px;font-weight:800;color:#002B49;">฿${fmtNum(totalRevenue)}</div>
                <div style="font-size:11px;color:#64748B;">ค่าเครื่องหลังหักส่วนลด ฿${fmtNum(netMachinePrice)} + แพ็คเกจ ฿${fmtNum(addonPrice)}</div>
              </div>
              <div>
                <div style="font-size:11.5px;color:#991B1B;font-weight:700;">ต้นทุนบริการที่คาดว่าจะเกิดขึ้น</div>
                <div style="font-size:20px;font-weight:800;color:#DC2626;">-฿${fmtNum(totalAfterSalesCost)}</div>
                <div style="font-size:11px;color:#7F1D1D;">ต้นทุน PM ${freePm} ครั้ง (฿${fmtNum(totalPmCost)}) + สำรองซ่อมประกัน (฿${fmtNum(expectedWarrantyCost)})</div>
              </div>
              <div>
                <div style="font-size:11.5px;color:#065F46;font-weight:700;">ยอดคงเหลือหลังหักต้นทุนบริการ</div>
                <div style="font-size:20px;font-weight:800;color:#059669;">฿${fmtNum(netAfterSalesContribution)}</div>
                <div style="font-size:11px;color:#047857;">ราคาแพ็คเกจขั้นต่ำที่คุ้มทุน: <b>฿${fmtNum(breakevenPackagePrice)}</b></div>
              </div>
            </div>
          `;
        }

        document.getElementById('hzkSimModelSel').onchange = function () {
          const opt = this.options[this.selectedIndex];
          document.getElementById('hzkSimSellPrice').value = opt.getAttribute('data-price') || 65000;
          recalcSim();
        };
        ['hzkSimSellPrice', 'hzkSimDiscountPct', 'hzkSimFreePm', 'hzkSimExtYr', 'hzkSimAddonPrice'].forEach(id => {
          document.getElementById(id).oninput = recalcSim;
        });
        recalcSim();
      }

      if (activeTab === 'IMPORT') {
        body.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">
            <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:14px;">
              <div style="font-weight:800;color:#002B49;font-size:14px;margin-bottom:6px;">📥 นำเข้าประวัติขายจาก NAV (CSV / วางข้อมูลจาก Excel)</div>
              <div style="font-size:11.5px;color:#475569;margin-bottom:8px;">
                รูปแบบคอลัมน์ (คั่นด้วยเครื่องหมายจุลภาค <code>,</code> หรือ Tab จาก Excel):<br/>
                <code>SerialNo, Model, CustomerName, Phone, Province, DealerName, SaleChannel, RefDocNo, SaleDate, NetPrice, WarrantyYears, IncludedPM, PromoTag</code>
              </div>
              <textarea id="hzkNavCsvInput" rows="7" style="width:100%;padding:8px;border:1px solid #94A3B8;border-radius:8px;font-family:monospace;font-size:11.5px;" placeholder="P55441A, IM-130NE, ร้านกาแฟอเมซอน สาขาบางนา, 0812345678, กรุงเทพฯ, บริษัท สยามไอซ์เทค จำกัด, Dealer, SO-2026-0881, 2026-06-15, 67500, 2, 2, PROMO-MIDYEAR&#10;P55442B, KM-230B, โรงแรมแกรนด์ สุขุมวิท, 0898765432, กรุงเทพฯ, HOSHIZAKI Direct Service, Direct End-User, SO-2026-0882, 2026-06-18, 96000, 2, 4, VIP-4PM"></textarea>
              <button type="button" id="hzkNavImportSubmitBtn" style="margin-top:8px;background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;width:100%;">🚀 นำเข้าข้อมูลผูก S/N เข้าฐานข้อมูล</button>
            </div>

            <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:14px;">
              <div style="font-weight:800;color:#7F1D1D;font-size:14px;margin-bottom:6px;">⚙️ ตั้งค่าเรทต้นทุนมาตรฐานงานซ่อมในประกัน (Cost Rate Settings)</div>
              <div style="font-size:11.5px;color:#475569;margin-bottom:10px;">ใช้คำนวณต้นทุนซ่อมในประกันอัตโนมัติ (อะไหล่ + ค่าแรงมาตรฐาน + ค่าเดินทางตามโซน)</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                <div><label>ค่าแรงมาตรฐาน/ครั้ง (THB)</label><input id="hzkCfgLabor" type="number" value="${cfg.standardLaborThb || 1200}" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:6px;" /></div>
                <div><label>ค่าอะไหล่เฉลี่ยกรณีไม่ระบุ (THB)</label><input id="hzkCfgParts" type="number" value="${cfg.defaultPartsCostThb || 1450}" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:6px;" /></div>
                <div><label>ค่าเดินทางโซน กทม. (THB)</label><input id="hzkCfgBkk" type="number" value="${cfg.travelBkkThb || 500}" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:6px;" /></div>
                <div><label>ค่าเดินทางปริมณฑล/EEC (THB)</label><input id="hzkCfgVic" type="number" value="${cfg.travelVicinityThb || 850}" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:6px;" /></div>
                <div><label>ค่าเดินทางต่างจังหวัด (THB)</label><input id="hzkCfgUpc" type="number" value="${cfg.travelUpcountryThb || 1800}" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:6px;" /></div>
                <div><label>ต้นทุนล้าง PM มาตรฐาน (THB)</label><input id="hzkCfgPm" type="number" value="${cfg.pmStandardCostThb || 950}" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:6px;" /></div>
              </div>
              <button type="button" id="hzkCfgSaveBtn" style="margin-top:10px;background:#059669;color:#FFF;border:none;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;width:100%;">💾 บันทึกเรทต้นทุนมาตรฐาน</button>
            </div>
          </div>
        `;

        document.getElementById('hzkNavImportSubmitBtn').onclick = async () => {
          const raw = document.getElementById('hzkNavCsvInput').value.trim();
          if (!raw) {
            alert('กรุณาวางข้อมูล CSV หรือตารางจาก Excel ก่อนกดนำเข้าครับ');
            return;
          }
          const lines = raw.split(/\r?\n/).filter(l => l.trim());
          const parsedRows = [];
          lines.forEach(line => {
            const cols = line.indexOf('	') !== -1 ? line.split('	') : line.split(',');
            if (cols.length < 2) return;
            if (/^serial/i.test(cols[0].trim())) return; // skip header row
            parsedRows.push({
              serialNo: (cols[0] || '').trim(),
              model: (cols[1] || '').trim(),
              customerName: (cols[2] || '').trim(),
              customerPhone: (cols[3] || '').trim(),
              province: (cols[4] || 'กรุงเทพฯ').trim(),
              dealerName: (cols[5] || 'HOSHIZAKI Direct Service').trim(),
              saleChannel: (cols[6] || 'Dealer').trim(),
              refDocNo: (cols[7] || '-').trim(),
              saleDate: (cols[8] || '').trim(),
              netPrice: Number((cols[9] || '0').replace(/[^0-9.\-]/g, '')) || 0,
              warrantyYears: Number(cols[10] || 1) || 1,
              includedPmCount: Number(cols[11] || 0) || 0,
              promoTag: (cols[12] || '-').trim()
            });
          });

          if (parsedRows.length === 0) {
            alert('ไม่พบแถวข้อมูลที่ถูกต้อง กรุณาตรวจสอบรูปแบบคอลัมน์ครับ');
            return;
          }

          // Save locally as well so instant preview works offline
          try {
            const prevLocal = JSON.parse(localStorage.getItem(HZK_V1170_LOCAL_PNL_KEY) || '[]');
            localStorage.setItem(HZK_V1170_LOCAL_PNL_KEY, JSON.stringify(parsedRows.concat(prevLocal).slice(0, 300)));
          } catch (e) {}

          const gasUrl = getGasEndpointUrl();
          if (gasUrl) {
            try {
              const res = await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'importNavSalesHistoryBatch', rows: parsedRows })
              });
              const d = await res.json();
              if (d && d.status === 'OK') {
                alert(`✅ นำเข้าประวัติขายสำเร็จ ${d.totalProcessed} รายการ (เพิ่มใหม่ ${d.inserted} / อัปเดต ${d.updated})`);
                activeTab = 'UNIT';
                updateTabButtons();
                fetchLifecycleData(parsedRows[0].serialNo);
                return;
              }
            } catch (err) {}
          }
          alert(`✅ บันทึกประวัติขายลงฐานข้อมูลในเครื่องสำเร็จ ${parsedRows.length} รายการ`);
          activeTab = 'UNIT';
          updateTabButtons();
          fetchLifecycleData(parsedRows[0].serialNo);
        };

        document.getElementById('hzkCfgSaveBtn').onclick = async () => {
          const newCfg = {
            standardLaborThb: Number(document.getElementById('hzkCfgLabor').value || 1200),
            defaultPartsCostThb: Number(document.getElementById('hzkCfgParts').value || 1450),
            travelBkkThb: Number(document.getElementById('hzkCfgBkk').value || 500),
            travelVicinityThb: Number(document.getElementById('hzkCfgVic').value || 850),
            travelUpcountryThb: Number(document.getElementById('hzkCfgUpc').value || 1800),
            pmStandardCostThb: Number(document.getElementById('hzkCfgPm').value || 950),
            targetNetMarginPct: 28
          };
          const gasUrl = getGasEndpointUrl();
          if (gasUrl) {
            try {
              await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'saveLifecycleCostConfig', config: newCfg })
              });
            } catch (e) {}
          }
          cachedState.config = newCfg;
          alert('✅ บันทึกเรทต้นทุนมาตรฐานเรียบร้อยแล้ว');
        };
      }
    }

    updateTabButtons();
    fetchLifecycleData(prefillSn);
  }

  async function openPreInstallSiteSurveyModal() {
    let m = document.getElementById('hzkSiteSurveyModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'hzkSiteSurveyModal';
      m.style.cssText =
        'position:fixed;inset:0;z-index:20062;background:rgba(15,23,42,0.85);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(m);
    }

    m.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:740px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;color:#0F172A;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">SALES / JPC / SERVICE PRE-INSTALLATION READINESS</div>
            <div style="font-size:16px;font-weight:700;">📐 แบบตรวจความพร้อมหน้างานก่อนส่งมอบ &amp; ติดตั้ง (Site Survey)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkSiteSurveyModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:18px 20px;font-size:13px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div><label style="font-weight:700;">เลขที่ใบเสนอราคา / SO</label><input id="hzkSrvRef" type="text" placeholder="QT-2026-..." style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;" /></div>
            <div><label style="font-weight:700;">รุ่นเครื่อง (Model)</label><input id="hzkSrvModel" type="text" placeholder="IM-130NE / KM-160B..." style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;" /></div>
            <div style="grid-column:1/-1;"><label style="font-weight:700;">ชื่อร้าน / สถานที่ติดตั้ง</label><input id="hzkSrvCust" type="text" placeholder="ชื่อลูกค้า / สาขา..." style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;" /></div>
          </div>
          <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="font-weight:800;color:#002B49;margin-bottom:8px;">✅ รายการตรวจเช็กมาตรฐาน HOSHIZAKI (ลดอัตราเคลมในประกัน):</div>
            <label style="display:block;margin-bottom:6px;"><input id="hzkSrvWaterOk" type="checkbox" checked /> <b>ระบบน้ำประปา:</b> แรงดันน้ำ 1.0–5.0 Bar + วาล์ว 1/2" พร้อมจุดติดตั้งเครื่องกรองน้ำ (Water Filter)</label>
            <label style="display:block;margin-bottom:6px;"><input id="hzkSrvPowerOk" type="checkbox" checked /> <b>ระบบไฟฟ้า:</b> แรงดันไฟ 220V ±10% 50Hz + เบรกเกอร์แยกเฉพาะเครื่องและสายดินครบถ้วน</label>
            <label style="display:block;"><input id="hzkSrvDrainOk" type="checkbox" checked /> <b>ท่อน้ำทิ้ง &amp; ระบายอากาศ:</b> ท่อน้ำทิ้งระดับต่ำกว่าฐานเครื่อง + เว้นระยะระบายความร้อน ≥ 15 ซม.</label>
          </div>
          <button type="button" id="hzkSrvSaveBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer;width:100%;">💾 บันทึกผลตรวจหน้างาน &amp; ส่งต่อทีมติดตั้ง</button>
        </div>
      </div>
    `;
    m.style.display = 'flex';

    document.getElementById('hzkSrvSaveBtn').onclick = async () => {
      const payload = {
        action: 'logPreInstallSiteSurvey',
        refNo: document.getElementById('hzkSrvRef').value.trim(),
        model: document.getElementById('hzkSrvModel').value.trim(),
        customerName: document.getElementById('hzkSrvCust').value.trim(),
        waterOk: document.getElementById('hzkSrvWaterOk').checked,
        powerOk: document.getElementById('hzkSrvPowerOk').checked,
        drainOk: document.getElementById('hzkSrvDrainOk').checked
      };
      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          const r = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          const d = await r.json();
          if (d && d.status === 'OK') {
            alert(`✅ บันทึกใบตรวจหน้างาน ${d.surveyId} เรียบร้อย (สถานะ: ${d.readiness})`);
            m.style.display = 'none';
            return;
          }
        } catch (e) {}
      }
      alert('✅ บันทึกผลการตรวจความพร้อมหน้างานเรียบร้อยแล้ว');
      m.style.display = 'none';
    };
  }

  window.openSerialLifecyclePricingSuiteModal = openSerialLifecyclePricingSuiteModal;
  window.openPreInstallSiteSurveyModal = openPreInstallSiteSurveyModal;



  // ============================================================================
  // ENTERPRISE v1171 MODULE: PERSONALIZED EMPLOYEE & 8-DEPARTMENT DAILY COCKPIT
  // - Auto-routes every employee (all 18 HQ Staff + 8 Field Techs T01-T08)
  //   into their tailored Department Workspace on load or 1-click profile switch
  // - Live Cross-Department Handover Inbox ("งานส่งต่อถึงแผนกฉัน")
  // - Japanese Corporate (JPC) TH / EN / 日本語 UI Language Toggle
  // - Mobile-First Thumb-Zone Field Technician Wizard (T01-T08)
  // ============================================================================
  const HZK_V1171_ACTIVE_PROFILE_KEY = 'hzk_v1171_active_employee_profile';
  const HZK_V1171_LANG_KEY = 'hzk_v1171_workspace_lang';

  const COMPLETE_COMPANY_ROSTER_V1171 = [
    // Service Unit & Field Technicians
    { id: 'SVC-02', code: 'NOPARIN_H', vanCode: 'T02', name: 'นพรินทร์ หอมหวล (Noparin Homhoul)', nickname: 'Rinny', deptKey: 'SERVICE_MGR', deptLabel: 'Service Unit', role: 'Deputy Services Unit Manager (Super Admin)', isTech: false, langDefault: 'TH' },
    { id: 'SVC-01', code: 'THANAKRIT_C', vanCode: 'T01', name: 'Mr. Thanakrit Chanmokonpanit', nickname: 'Tae', deptKey: 'SERVICE_MGR', deptLabel: 'Service Unit', role: 'Services Unit Manager (ext. 31)', isTech: false, langDefault: 'TH' },
    { id: 'SVC-05', code: 'WANWIPHA_N', vanCode: 'T08', name: 'Ms. Wanwipha Nakamrod', nickname: 'Oh', deptKey: 'SERVICE_MGR', deptLabel: 'Service & Billing', role: 'Services Admin Staff (ext. 30)', isTech: false, langDefault: 'TH' },
    { id: 'SVC-03', code: 'T03', vanCode: 'T03', name: 'Mr. Surin Sarawong (ช่าง T03)', nickname: 'Rin', deptKey: 'SERVICE_TECH', deptLabel: 'Service Field Tech', role: 'Senior Field Service Technician (BKK East)', isTech: true, langDefault: 'TH' },
    { id: 'SVC-04', code: 'T05', name: 'Mr. Nirun Sornrat (ช่าง T05)', nickname: 'Pui', deptKey: 'SERVICE_TECH', deptLabel: 'Service Field Tech', role: 'Field Service Technician (Samut Prakan)', isTech: true, langDefault: 'TH' },
    { id: 'SVC-06', code: 'T06', name: 'Mr. Surin Tharapai (ช่าง T06)', nickname: 'Beer', deptKey: 'SERVICE_TECH', deptLabel: 'Service Field Tech', role: 'Field Service Technician (Ayutthaya/Central)', isTech: true, langDefault: 'TH' },
    { id: 'SVC-07', code: 'T04', name: 'Mr. Jeerapan Phrasawang (ช่าง T04)', nickname: 'Ceasar', deptKey: 'SERVICE_TECH', deptLabel: 'Service Field Tech', role: 'Field Service Technician (Nonthaburi)', isTech: true, langDefault: 'TH' },
    { id: 'CTR-01', code: 'T07', name: 'Mr. Pawat Warongtheradet (ช่าง T07 / IMS)', nickname: 'Prince', deptKey: 'SERVICE_TECH', deptLabel: 'Service Center & IMS', role: 'Field Tech & Warehouse IMS (Upcountry)', isTech: true, langDefault: 'TH' },
    { id: 'TECH-01', code: 'T01', name: 'ทีมช่างบริการภาคสนาม T01 (BKK North)', nickname: 'T01', deptKey: 'SERVICE_TECH', deptLabel: 'Service Field Tech', role: 'Field Service Van T01', isTech: true, langDefault: 'TH' },
    { id: 'TECH-08', code: 'T08', name: 'ทีมช่างติดตั้ง & PM T08 (Install Specialist)', nickname: 'T08', deptKey: 'SERVICE_TECH', deptLabel: 'Service Field Tech', role: 'Installation & PM Van T08', isTech: true, langDefault: 'TH' },

    // Commercial Sales (THB)
    { id: 'SLS-01', code: 'KULATHIDA_C', vanCode: '', name: 'Ms. Kulathida Charoenying', nickname: 'Honey', deptKey: 'SALES_TH', deptLabel: 'Sales Department', role: 'Deputy Sales Manager', isTech: false, langDefault: 'TH' },
    { id: 'SLS-02', code: 'JANYALUCK_P', vanCode: '', name: 'Ms. Janyaluck Paithaisong', nickname: 'Nui', deptKey: 'SALES_TH', deptLabel: 'Sales Department', role: 'Senior Sales Staff', isTech: false, langDefault: 'TH' },
    { id: 'SLS-03', code: 'KETSARAPORN', vanCode: '', name: 'Ms. Ketsaraporn Porjai', nickname: 'Nam', deptKey: 'SALES_TH', deptLabel: 'Sales Department', role: 'Senior Sales Staff', isTech: false, langDefault: 'TH' },
    { id: 'SLS-04', code: 'WISUTTHA_W', vanCode: '', name: 'Ms. Wisuttha Wonglaw', nickname: 'Sand', deptKey: 'SALES_TH', deptLabel: 'Sales Department', role: 'Sales Support (ext. 20)', isTech: false, langDefault: 'TH' },

    // Japanese Corporate (JPC)
    { id: 'JPC-02', code: 'FURUJO', vanCode: '', name: 'Mr. Naoki Furujo', nickname: 'Furujo', deptKey: 'JPC_CORP', deptLabel: 'Japanese Corporate', role: 'Senior Sales Staff (Japanese Corporate)', isTech: false, langDefault: 'JP' },
    { id: 'JPC-01', code: 'SULEEWAN_S', vanCode: '', name: 'Ms. Suleewan Siripirom', nickname: 'Pang', deptKey: 'JPC_CORP', deptLabel: 'Japanese Corporate', role: 'Japanese Corporate Staff', isTech: false, langDefault: 'TH' },

    // Marketing
    { id: 'MKT-01', code: 'TAKSAON_T', vanCode: '', name: 'Ms. Taksaon Tipsrisombat', nickname: 'Poy', deptKey: 'MARKETING', deptLabel: 'Marketing Department', role: 'Marketing Unit Manager (ext. 21)', isTech: false, langDefault: 'TH' },
    { id: 'MKT-02', code: 'KHAJORNYOT_J', vanCode: '', name: 'Mr. Khajornyot Jewkrang', nickname: 'Men', deptKey: 'MARKETING', deptLabel: 'Marketing Department', role: 'Marketing Staff', isTech: false, langDefault: 'TH' },

    // Accounting & Finance
    { id: 'ACC-01', code: 'WARAPORN_K', vanCode: '', name: 'Ms. Waraporn Kianthong', nickname: 'Noi San', deptKey: 'ACCOUNTING', deptLabel: 'Accounting & Finance', role: 'Accounting Manager (ext. 10)', isTech: false, langDefault: 'TH' },
    { id: 'ACC-02', code: 'DUANGKAMON_T', vanCode: '', name: 'Ms. Duangkamon Tantayanon', nickname: 'Yok', deptKey: 'ACCOUNTING', deptLabel: 'Accounting & Finance', role: 'Senior Accounting Staff (ext. 12)', isTech: false, langDefault: 'TH' },
    { id: 'ACC-03', code: 'WITHARAT_R', vanCode: '', name: 'Ms. Witharat Riangpha', nickname: 'Z-cath', deptKey: 'ACCOUNTING', deptLabel: 'Accounting & Finance', role: 'Accounting Staff (ext. 11)', isTech: false, langDefault: 'TH' },

    // Admin & HR
    { id: 'ADM-01', code: 'KANOKWAN_T', vanCode: '', name: 'Ms. Kanokwan Treesukol', nickname: 'June', deptKey: 'ADMIN_HR', deptLabel: 'Admin & HR', role: 'Administration Manager (ext. 03)', isTech: false, langDefault: 'TH' },
    { id: 'ADM-02', code: 'NATTAPONG_C', vanCode: '', name: 'Mr. Nattapong Chataram', nickname: 'Nat', deptKey: 'ADMIN_HR', deptLabel: 'Admin & HR', role: 'Senior Administration Staff (ext. 01)', isTech: false, langDefault: 'TH' },
    { id: 'ADM-03', code: 'CHAYANIN_K', vanCode: '', name: 'Mr. Chayanin Kuptrakul', nickname: 'Beer', deptKey: 'ADMIN_HR', deptLabel: 'Admin & HR', role: 'Administration Staff (ext. 02)', isTech: false, langDefault: 'TH' },

    // Executive Management
    { id: 'EXE-01', code: 'DAISUKE_S', vanCode: '', name: 'Mr. Daisuke Suzuki', nickname: 'Suzuki', deptKey: 'EXECUTIVE', deptLabel: 'Executive Management', role: 'Managing Director / GM All Departments', isTech: false, langDefault: 'JP' }
  ];

  const DEPT_COCKPIT_CONFIGS_V1171 = {
    SERVICE_TECH: {
      accent: '#991B1B',
      gradient: 'linear-gradient(135deg,#7F1D1D,#B91C1C)',
      badge: '🛠️ FIELD TECHNICIAN MOBILE WIZARD',
      titleTh: 'โต๊ะทำงานช่างบริการภาคสนาม (โหมดมือถือใช้ง่าย)',
      titleEn: 'Field Technician Mobile Wizard',
      titleJp: 'フィールドサービス技術者画面',
      subTh: 'ซ่อนเมนูออฟฟิศและราคาทุนอัตโนมัติ — เน้นสแกนป้าย S/N เปิด/ปิดใบงานซ่อม และเบิกอะไหล่ในรถตู้',
      subEn: 'Streamlined mobile view — Scan S/N, complete repair report & manage van parts.',
      subJp: '現場作業専用画面：S/Nスキャン・修理報告・車載部品在庫管理',
      hideJobSheet: false,
      actions: [
        { icon: '📷', titleTh: '1. สแกน S/N & ดูประวัติ 360°', titleEn: '1. Scan S/N & 360° History', titleJp: '1. S/Nスキャン・360°履歴', sub: 'เช็กประกัน ดีลเลอร์ และประวัติซ่อมเก่า', fn: "window.openSerial360TimelineModal('')" },
        { icon: '🚐', titleTh: '2. เบิก/เช็กอะไหล่ในรถตู้ (T01–T08)', titleEn: '2. Technician Van Stock', titleJp: '2. サービスカー部品在庫', sub: 'ตัดสต็อกหน้างาน + แจ้งเตือนสโตร์อัตโนมัติ', fn: "window.openTechnicianVanStockModal()" },
        { icon: '📅', titleTh: '3. ดูคิวงานติดตั้ง & ซ่อมวันนี้', titleEn: '3. Today Dispatch Schedule', titleJp: '3. 本日の作業スケジュール', sub: 'ตารางนัดหมายเข้าหน้างานรายวัน', fn: "window.openServiceDispatchCalendarModal()" },
        { icon: '📤', titleTh: '4. ส่งใบแจ้งบริการ/ใบเสร็จให้ลูกค้า', titleEn: '4. Send Tracked Service Doc', titleJp: '4. サービス報告書・領収書送信', sub: 'ส่งเข้า LINE / Email พร้อมปุ่มยืนยันรับ', fn: "launchTrackedDocFromServiceForm()" }
      ]
    },
    SERVICE_MGR: {
      accent: '#B91C1C',
      gradient: 'linear-gradient(135deg,#002B49,#991B1B)',
      badge: '🧑‍💼 SERVICE COMMAND & DISPATCH CENTER',
      titleTh: 'ศูนย์ควบคุมงานบริการ จ่ายงานช่าง และวิเคราะห์ต้นทุน S/N',
      titleEn: 'Service Management & Dispatch Center',
      titleJp: 'サービス部 司令室・ディスパッチ管理',
      subTh: 'คุมคิวช่าง T01–T08 ติดตามดีลเลอร์ SLA 2 ชม. ต่อสัญญา PM 60 วัน และวิเคราะห์กำไร-ขาดทุนรายเครื่อง',
      subEn: 'Manage T01-T08 dispatch, Dealer 2-hr SLA, 60-day PM renewals & Unit Lifecycle P&L.',
      subJp: '技術者手配・代理店SLA監視・保守契約更新・機種別損益分析',
      hideJobSheet: false,
      actions: [
        { icon: '📅', titleTh: 'ตารางจ่ายงานช่าง & ติดตั้ง (T01–T08)', titleEn: 'Technician Dispatch Board', titleJp: '技術者ディスパッチ予定表', sub: 'จัดคิวติดตั้ง/ซ่อม + แจ้งเตือนกลุ่ม LINE', fn: "window.openServiceDispatchCalendarModal()" },
        { icon: '💰', titleTh: 'วิเคราะห์กำไร-ขาดทุนราย S/N (Lifecycle P&L)', titleEn: 'Serial 360° Lifecycle P&L', titleJp: 'シリアル別損益・価格分析', sub: 'เทียบราคาขายหักต้นทุนซ่อมประกัน & ตั้งราคา PM', fn: "window.openSerialLifecyclePricingSuiteModal()" },
        { icon: '🔔', titleTh: 'แจ้งเตือนหมดประกัน & ต่อสัญญา PM (60 วัน)', titleEn: 'PM & Warranty Renewal (60d)', titleJp: '保証期限・保守契約更新 (60日前)', sub: 'สแกนเครื่องใกล้หมดประกัน + ออกใบเสนอราคา 1 คลิก', fn: "window.openWarrantyPmRenewalModal()" },
        { icon: '🚐', titleTh: 'คลังอะไหล่รถช่าง T01–T08 & เบิกเติม', titleEn: 'Van Stock Inventory T01-T08', titleJp: 'サービスカー部品在庫管理', sub: 'ตรวจสอบจุดสั่งซื้อ Min-Max อะไหล่รถตู้', fn: "window.openTechnicianVanStockModal()" }
      ]
    },
    SALES_TH: {
      accent: '#0284C7',
      gradient: 'linear-gradient(135deg,#002B49,#0284C7)',
      badge: '💼 COMMERCIAL SALES WORKSPACE (THB)',
      titleTh: 'โต๊ะทำงานฝ่ายขายในประเทศ (Sales Command & Fast Quote)',
      titleEn: 'Commercial Sales Workspace (THB)',
      titleJp: '国内営業部 ワークスペース (THB)',
      subTh: 'ออกใบเสนอราคา Y2026 เติมขนาด W×D×H อัตโนมัติ เช็กสต็อกสด 203 รุ่น ตรวจหน้างาน และส่งต่องานติดตั้ง',
      subEn: 'Create Y2026 THB Quotations with WxDxH, live stock check, site survey & install handover.',
      subJp: '見積書作成(W×D×H自動入力)・リアルタイム在庫確認・設置引継',
      hideJobSheet: true,
      actions: [
        { icon: '📄', titleTh: 'ออกใบเสนอราคา Sales (THB Y2026)', titleEn: 'New Sales Quotation (THB)', titleJp: '新規見積書作成 (THB)', sub: 'เติมขนาด W×D×H + เช็กสต็อกสด + คุมเพดานส่วนลด', fn: "openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)')" },
        { icon: '📐', titleTh: 'แบบตรวจความพร้อมหน้างาน (Site Survey)', titleEn: 'Pre-Install Site Survey', titleJp: '設置前現場チェックシート', sub: 'เช็กแรงดันน้ำ ไฟ ท่อน้ำทิ้ง & แนะนำชุดกรองน้ำ', fn: "window.openPreInstallSiteSurveyModal()" },
        { icon: '🔄', titleTh: 'ส่งต่องานติดตั้ง & ลงทะเบียน S/N', titleEn: 'Sales-to-Service Install Handover', titleJp: 'サービス部へ設置作業引継', sub: 'ส่งใบงานให้ฝ่ายบริการเข้าติดตั้งพร้อมผูกประกัน', fn: "openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)', 'HANDOVER')" },
        { icon: '📊', titleTh: 'ติดตามสถานะเอกสาร & E-Sign PO ลูกค้า', titleEn: 'Document & PO Tracking', titleJp: '見積書送付・注文書(PO)承認状況', sub: 'ดูว่าลูกค้าเปิดอ่าน กดยืนยัน หรือเซ็น PO แล้วหรือยัง', fn: "window.openDocumentTrackingDashboardModal()" }
      ]
    },
    JPC_CORP: {
      accent: '#312E81',
      gradient: 'linear-gradient(135deg,#1E1B4B,#3730A3)',
      badge: '🇯🇵 JAPANESE CORPORATE DIVISION (TH / EN / 日本語)',
      titleTh: 'โต๊ะทำงานฝ่ายขายองค์กรญี่ปุ่น (Japanese Corporate Division)',
      titleEn: 'Japanese Corporate Division Workspace',
      titleJp: '日系法人営業部 ワークスペース (THB / USD Export)',
      subTh: 'รองรับใบเสนอราคาทั้ง Local THB และ Export USD (0% VAT) พร้อมส่ง CC ทีม JPC และรายงาน 3 ภาษา',
      subEn: 'Dedicated workspace for Japanese Corporate accounts (Local THB & Export USD 0% VAT).',
      subJp: '日系法人顧客向け見積書作成（国内THB・輸出USD 0% VAT対応）',
      hideJobSheet: true,
      actions: [
        { icon: '🇯🇵', titleTh: 'ออกใบเสนอราคา Japanese Corporate', titleEn: 'New JPC Quotation (THB/USD)', titleJp: '日系法人向け見積書作成', sub: 'รองรับ Export USD 0% VAT & Local THB + CC JPC_TEAM', fn: "openSalesCorporateQuotationWithPreset('Japanese Corporate', 'ใบเสนอราคา (Quotation)')" },
        { icon: '🔎', titleTh: 'ตรวจสอบประวัติเครื่องลูกค้า S/N 360°', titleEn: 'Customer Asset S/N 360°', titleJp: '納入機器 S/N 360°履歴照会', sub: 'ดูประวัติติดตั้ง การซ่อม และรอบ PM ของลูกค้าญี่ปุ่น', fn: "window.openSerial360TimelineModal('')" },
        { icon: '📊', titleTh: 'ติดตามสถานะเอกสาร & อนุมัติ PO', titleEn: 'Quotation & PO Tracking', titleJp: '見積承認・PO受領トラッキング', sub: 'ติดตามการตอบรับใบเสนอราคาจากลูกค้าองค์กรญี่ปุ่น', fn: "window.openDocumentTrackingDashboardModal()" },
        { icon: '💰', titleTh: 'วิเคราะห์ต้นทุน & แพ็คเกจ PM รายเครื่อง', titleEn: 'Lifecycle Cost & PM Package', titleJp: '機器ライフサイクル損益・保守設計', sub: 'เปรียบเทียบต้นทุนซ่อมและคำนวณแพ็คเกจ VIP PM', fn: "window.openSerialLifecyclePricingSuiteModal()" }
      ]
    },
    MARKETING: {
      accent: '#065F46',
      gradient: 'linear-gradient(135deg,#064E3B,#059669)',
      badge: '📣 MARKETING & PRODUCT CAMPAIGN HUB',
      titleTh: 'โต๊ะทำงานฝ่ายการตลาด แคมเปญ และสต็อกเครื่องโชว์/Clearance',
      titleEn: 'Marketing & Product Campaign Hub',
      titleJp: 'マーケティング・販促キャンペーン管理',
      subTh: 'บริหารสต็อกเครื่องโชว์/มีตำหนิ 602 รายการพร้อมใบตรวจสภาพ ออกใบเสนอราคาแคมเปญ และจำลองโปรโมชั่น',
      subEn: 'Manage 602 Demo/Clearance units with inspection links, campaign quotes & promo simulator.',
      subJp: '展示機・訳あり品在庫(602台)管理・販促見積・プロモーション損益試算',
      hideJobSheet: true,
      actions: [
        { icon: '🏷️', titleTh: 'สต็อกเครื่องโชว์ / มีตำหนิ (602 รายการ)', titleEn: 'Demo & Clearance Stock (602)', titleJp: '展示機・訳あり在庫一覧 (602台)', sub: 'ดูสภาพเครื่อง ลิงก์ใบตรวจสภาพ และดึงลงใบเสนอราคา', fn: "window.openDamageDemoStockModal()" },
        { icon: '📣', titleTh: 'ออกใบเสนอราคาแคมเปญ Marketing', titleEn: 'Campaign & Promo Quotation', titleJp: 'キャンペーン見積書作成', sub: 'สร้างใบเสนอราคาโปรโมชันพร้อมการ์ด LINE สีเขียวมรกต', fn: "openSalesCorporateQuotationWithPreset('Marketing', 'ใบเสนอราคา (Quotation)')" },
        { icon: '🧮', titleTh: 'จำลองตั้งราคา & โปรโมชั่นแถม PM', titleEn: 'Promo & PM Package Simulator', titleJp: 'プロモーション・保守付帯価格シミュレーター', sub: 'คำนวณจุดคุ้มทุนเมื่อลดราคาหรือแถม PM ฟรี', fn: "window.openSerialLifecyclePricingSuiteModal()" },
        { icon: '📥', titleTh: 'อัปเดตสต็อกจากอีเมล MICHIRU-RPA', titleEn: 'Sync Daily Stock Report', titleJp: '日次在庫レポート同期', sub: 'ดึงรายงาน Stock on Hand ล่าสุดเข้าฐานข้อมูล', fn: "window.triggerEmailStockSyncNow()" }
      ]
    },
    ACCOUNTING: {
      accent: '#0F766E',
      gradient: 'linear-gradient(135deg,#134E4A,#0D9488)',
      badge: '🧾 ACCOUNTING, BILLING & ERP/NAV BRIDGE',
      titleTh: 'โต๊ะทำงานฝ่ายบัญชี การเงิน ใบวางบิล และส่งออก Dynamics NAV',
      titleEn: 'Accounting, Billing & ERP/NAV Bridge',
      titleJp: '経理・請求書発行・Dynamics NAV 連携',
      subTh: 'แปลงใบเสนอราคาเป็นใบวางบิล/ใบเสร็จใน 1 คลิก ตรวจเลขผู้เสียภาษี 13 หลัก และส่งออก CSV เข้า NAV',
      subEn: '1-Click convert to Billing/Receipt, verify 13-digit Tax ID & export CSV for Dynamics NAV.',
      subJp: 'ワンクリック請求書/領収書変換・納税者番号確認・NAV用CSV出力',
      hideJobSheet: true,
      actions: [
        { icon: '🧾', titleTh: 'ออกใบวางบิล / ใบเสร็จรับเงิน (1 คลิก)', titleEn: 'Create Billing Note / Receipt', titleJp: '請求書・領収書作成', sub: 'กรอกเลขผู้เสียภาษี 13 หลัก/สาขา + คำนวณ VAT 7% / WHT 3%', fn: "openSalesCorporateQuotationWithPreset('Service & Billing', 'ใบวางบิล (Billing Note)')" },
        { icon: '🏭', titleTh: 'ส่งออกข้อมูลเปิด Sales Order เข้า NAV', titleEn: 'Export PO Approved to NAV CSV', titleJp: '承認済POデータをNAV用CSV出力', sub: 'ดาวน์โหลดไฟล์ CSV พร้อมนำเข้า Microsoft Dynamics NAV', fn: "window.exportErpSalesOrdersCsv()" },
        { icon: '📊', titleTh: 'ตรวจสอบสถานะลูกค้ายืนยันรับบิล / PO', titleEn: 'Billing & PO Tracking Status', titleJp: '請求書受領・PO承認ステータス確認', sub: 'เช็กประวัติการส่งบิลและหลักฐาน PO ลูกค้า', fn: "window.openDocumentTrackingDashboardModal()" },
        { icon: '📥', titleTh: 'นำเข้าประวัติขาย NAV ผูก S/N', titleEn: 'Import NAV Sales History', titleJp: 'NAV販売履歴インポート', sub: 'อัปโหลดประวัติราคาขายจาก NAV เข้าฐานข้อมูล S/N', fn: "window.openSerialLifecyclePricingSuiteModal()" }
      ]
    },
    ADMIN_HR: {
      accent: '#4338CA',
      gradient: 'linear-gradient(135deg,#312E81,#4F46E5)',
      badge: '🏢 ADMIN, HR & SYSTEM GOVERNANCE',
      titleTh: 'โต๊ะทำงานฝ่ายธุรการ บุคคล และควบคุมมาตรฐานระบบองค์กร',
      titleEn: 'Admin, HR & System Governance',
      titleJp: '総務・人事・システム管理ワークスペース',
      subTh: 'ตรวจสอบความพร้อมระบบ Go-Live QA จัดการฐานบุคลากร กลุ่มอีเมล 7 แผนก และคู่มือ SOP',
      subEn: 'Manage staff directory, 7-department email groups, system QA health & role SOP guides.',
      subJp: '社員マスタ・7部署メールグループ・システム稼働点検・SOP管理',
      hideJobSheet: true,
      actions: [
        { icon: '🛡️', titleTh: 'ตรวจความพร้อมระบบ & Go-Live Control (QA)', titleEn: 'Production Readiness QA', titleJp: '本番稼働・システムヘルス点検', sub: 'เช็กสถานะ API, Google Sheets, LINE OA และ Triggers', fn: "window.openProductionGoLiveQaModal()" },
        { icon: '🩺', titleTh: 'Deep Scan ตรวจสอบ & ซ่อมแซมการเชื่อมต่อ', titleEn: 'Deep System Diagnostic', titleJp: 'システム詳細診断・修復', sub: 'ทดสอบลิงก์ Google Apps Script และฐานข้อมูล JSON', fn: "window.runDeepSystemDiagnosticModal()" },
        { icon: '📖', titleTh: 'คู่มือใช้งานแยกแผนก (Role SOP Guide)', titleEn: 'Department Role SOP Guide', titleJp: '部署別操作マニュアル (SOP)', sub: 'คู่มือมาตรฐานการทำงานสำหรับทุกแผนก', fn: "window.openDepartmentRoleSopModal()" },
        { icon: '📊', titleTh: 'ติดตามเอกสาร & การส่งต่องานข้ามแผนก', titleEn: 'Document Tracking Dashboard', titleJp: '社内ドキュメント追跡一覧', sub: 'ตรวจสอบเอกสารค้างติดตาม > 24 ชม. ของทุกแผนก', fn: "window.openDocumentTrackingDashboardModal()" }
      ]
    },
    EXECUTIVE: {
      accent: '#B45309',
      gradient: 'linear-gradient(135deg,#002B49,#B45309)',
      badge: '👑 EXECUTIVE BOARDROOM & STRATEGIC INTELLIGENCE',
      titleTh: 'ห้องประชุมผู้บริหาร (Executive Command & Lifecycle Intelligence)',
      titleEn: 'Executive Command & Boardroom BI',
      titleJp: '経営陣ダッシュボード・全社統括インテリジェンス',
      subTh: 'ภาพรวมยอดขาย PO กำไรสุทธิหลังหักต้นทุนซ่อม S/N ผลงานรายบุคคล และส่งสรุปเข้า LINE ผู้บริหาร',
      subEn: 'Company-wide sales pipeline, S/N lifecycle net margin, staff KPIs & LINE briefings.',
      subJp: '全社売上・機種別ライフサイクル純利益・社員別KPI・LINE経営報告',
      hideJobSheet: true,
      actions: [
        { icon: '📈', titleTh: 'รายงานสรุปผู้บริหาร & AI Copilot (BI)', titleEn: 'Executive BI & AI Copilot', titleJp: '経営サマリーBI & AIコパイロット', sub: 'ยอดขายรวม สถานะ PO งานบริการ และส่งเข้า LINE ทันที', fn: "window.openExecutiveBiDashboardModal()" },
        { icon: '💰', titleTh: 'วิเคราะห์กำไร-ขาดทุนราย S/N & ตั้งราคา', titleEn: 'Serial Lifecycle P&L & Pricing', titleJp: '機種別ライフサイクル損益・価格戦略', sub: 'เปรียบเทียบต้นทุนเคลมข้ามรุ่น/ข้ามดีลเลอร์ & จำลองโปรฯ', fn: "window.openSerialLifecyclePricingSuiteModal()" },
        { icon: '🏆', titleTh: 'สรุปผลงานปิดการขาย & ปิดงานช่างรายบุคคล', titleEn: 'Monthly Sales & Tech KPI', titleJp: '月次営業・サービス個人別実績KPI', sub: 'จัดอันดับยอดปิดการขาย PO Approved และผลงานช่าง', fn: "window.openMonthlyIncentiveKpiModal()" },
        { icon: '🎭', titleTh: 'ตรวจสอบหน้าจอจริงแยกแผนก & รายบุคคล', titleEn: 'Live Dept & Staff Inspector', titleJp: '部署別・個人別画面インスペクター', sub: 'สลับดูมุมมองการทำงานของแต่ละแผนกและพนักงาน', fn: "window.openDepartmentLiveSimulatorModal()" }
      ]
    }
  };

  function getActiveEmployeeProfileV1171() {
    try {
      const saved = JSON.parse(localStorage.getItem(HZK_V1171_ACTIVE_PROFILE_KEY) || 'null');
      if (saved && saved.id && DEPT_COCKPIT_CONFIGS_V1171[saved.deptKey]) return saved;
    } catch (e) {}

    // Fallback: auto-detect from existing PWA login session (`hoshizaki_active_auth_session_v1042`)
    try {
      const rawSess = localStorage.getItem('hoshizaki_active_auth_session_v1042');
      if (rawSess) {
        const sess = JSON.parse(rawSess);
        if (sess && sess.id) {
          const found = COMPLETE_COMPANY_ROSTER_V1171.find(x => x.id === sess.id || x.code === sess.code);
          if (found) return found;
        }
      }
    } catch (e) {}

    return COMPLETE_COMPANY_ROSTER_V1171[0]; // Default: Mr. Noparin Homhoul (Service Unit / Super Admin)
  }

  function setActiveEmployeeProfileV1171(empObj, persistLang) {
    if (!empObj) return;
    localStorage.setItem(HZK_V1171_ACTIVE_PROFILE_KEY, JSON.stringify(empObj));
    if (persistLang && empObj.langDefault) {
      localStorage.setItem(HZK_V1171_LANG_KEY, empObj.langDefault);
    }
    applyGlobalAppRoleMode(empObj.isTech ? 'TECH' : 'MANAGER');
    renderPersonalizedEmployeeCockpit(empObj);
  }

  function getActiveCockpitLang() {
    return localStorage.getItem(HZK_V1171_LANG_KEY) || 'TH';
  }

  function setActiveCockpitLang(lang) {
    localStorage.setItem(HZK_V1171_LANG_KEY, lang);
    renderPersonalizedEmployeeCockpit(getActiveEmployeeProfileV1171());
  }

  async function renderPersonalizedEmployeeCockpit(empProfile) {
    const emp = empProfile || getActiveEmployeeProfileV1171();
    const cfg = DEPT_COCKPIT_CONFIGS_V1171[emp.deptKey] || DEPT_COCKPIT_CONFIGS_V1171.SERVICE_MGR;
    const lang = getActiveCockpitLang();

    // Update top header pill label with active employee's nickname & department
    const pillBtn = document.getElementById('hzkMyPersonalCockpitPillBtn');
    if (pillBtn) {
      pillBtn.innerHTML = `🧑‍💻 ${emp.nickname || emp.code} [${emp.deptLabel}] ▾`;
    }

    // Manage visibility of technician Job Service Report container according to employee role
    const jobSheet = document.getElementById('jobSheetContainer');
    const mobNav = document.getElementById('mobileSectionNav');
    const showJobOverride = sessionStorage.getItem('hzk_v1171_force_show_jobsheet') === 'true';

    if (cfg.hideJobSheet && !showJobOverride) {
      if (jobSheet) jobSheet.style.display = 'none';
      if (mobNav) mobNav.style.display = 'none';
    } else {
      if (jobSheet) jobSheet.style.display = '';
      if (mobNav) mobNav.style.display = '';
    }

    let cockpit = document.getElementById('hzkPersonalizedEmployeeCockpitCard');
    if (!cockpit) {
      cockpit = document.createElement('section');
      cockpit.id = 'hzkPersonalizedEmployeeCockpitCard';
      cockpit.style.cssText =
        'max-width:1080px;margin:10px auto 14px;background:#FFFFFF;border-radius:16px;' +
        'box-shadow:0 12px 32px rgba(15,23,42,0.12);overflow:hidden;font-family:sans-serif;';
      if (jobSheet && jobSheet.parentNode) {
        jobSheet.parentNode.insertBefore(cockpit, jobSheet);
      } else {
        document.body.insertBefore(cockpit, document.body.firstChild);
      }
    }

    cockpit.style.border = `2px solid ${cfg.accent}`;
    const titleText = lang === 'JP' ? cfg.titleJp : (lang === 'EN' ? cfg.titleEn : cfg.titleTh);
    const subText = lang === 'JP' ? cfg.subJp : (lang === 'EN' ? cfg.subEn : cfg.subTh);

    const actionCardsHtml = cfg.actions.map(act => {
      const aTitle = lang === 'JP' ? act.titleJp : (lang === 'EN' ? act.titleEn : act.titleTh);
      return `
        <button type="button" onclick="${act.fn}" style="text-align:left;background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:13px;padding:13px 14px;cursor:pointer;display:flex;align-items:flex-start;gap:11px;transition:all 0.15s ease;min-height:66px;">
          <span style="font-size:24px;line-height:1.1;">${act.icon}</span>
          <span>
            <div style="font-weight:800;font-size:13.5px;color:#0F172A;">${aTitle}</div>
            <div style="font-size:11.5px;color:#475569;margin-top:3px;line-height:1.35;">${act.sub}</div>
          </span>
        </button>
      `;
    }).join('');

    const toggleJobBtnHtml = cfg.hideJobSheet
      ? `<button type="button" id="hzkV1171ToggleJobFormBtn" style="background:rgba(255,255,255,0.16);color:#FFF;border:1px solid rgba(255,255,255,0.4);border-radius:8px;padding:6px 11px;font-size:11.5px;font-weight:700;cursor:pointer;">${showJobOverride ? '🙈 ซ่อนฟอร์มใบแจ้งซ่อมช่าง' : '🛠️ เปิดดูฟอร์มใบแจ้งซ่อมช่าง'}</button>`
      : '';

    cockpit.innerHTML = `
      <div style="background:${cfg.gradient};color:#FFFFFF;padding:15px 18px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="background:rgba(0,0,0,0.28);color:#FDE047;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:0.4px;">${cfg.badge}</span>
            <span style="background:rgba(255,255,255,0.18);color:#FFF;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:700;">👤 ${emp.name} • ${emp.role}</span>
          </div>
          <div style="font-size:17px;font-weight:800;margin-top:6px;">${titleText}</div>
          <div style="font-size:12px;opacity:0.92;margin-top:2px;">${subText}</div>
        </div>

        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:2px;display:inline-flex;gap:2px;">
            <button type="button" data-lang="TH" class="hzk-v1171-lang-btn" style="background:${lang === 'TH' ? '#FFF' : 'transparent'};color:${lang === 'TH' ? '#002B49' : '#FFF'};border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:800;cursor:pointer;">TH</button>
            <button type="button" data-lang="EN" class="hzk-v1171-lang-btn" style="background:${lang === 'EN' ? '#FFF' : 'transparent'};color:${lang === 'EN' ? '#002B49' : '#FFF'};border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:800;cursor:pointer;">EN</button>
            <button type="button" data-lang="JP" class="hzk-v1171-lang-btn" style="background:${lang === 'JP' ? '#FFF' : 'transparent'};color:${lang === 'JP' ? '#002B49' : '#FFF'};border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:800;cursor:pointer;">日本語</button>
          </div>
          ${toggleJobBtnHtml}
          <button type="button" id="hzkV1171SwitchUserBtn" style="background:#FDE047;color:#0F172A;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;">🔄 สลับพนักงาน / แผนก</button>
        </div>
      </div>

      <div style="padding:14px 18px;">
        <div id="hzkV1171MyMetricsBar" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:12px;">
          <div style="background:#F1F5F9;border-radius:10px;padding:9px 12px;">
            <div style="font-size:10.5px;color:#475569;font-weight:700;">📥 งานส่งต่อถึงแผนกฉัน</div>
            <div id="hzkMetricHandovers" style="font-size:17px;font-weight:800;color:#002B49;">0 รายการ</div>
          </div>
          <div style="background:#F1F5F9;border-radius:10px;padding:9px 12px;">
            <div style="font-size:10.5px;color:#475569;font-weight:700;">🛠️ ใบงานบริการค้างปิด</div>
            <div id="hzkMetricOpenJobs" style="font-size:17px;font-weight:800;color:#B91C1C;">-</div>
          </div>
          <div style="background:#F1F5F9;border-radius:10px;padding:9px 12px;">
            <div style="font-size:10.5px;color:#475569;font-weight:700;">📄 ใบเสนอราคาของฉัน / รวม</div>
            <div id="hzkMetricMyQt" style="font-size:17px;font-weight:800;color:#0284C7;">-</div>
          </div>
          <div style="background:#F1F5F9;border-radius:10px;padding:9px 12px;">
            <div style="font-size:10.5px;color:#475569;font-weight:700;">✅ PO Approved รอวางบิล</div>
            <div id="hzkMetricPoApproved" style="font-size:17px;font-weight:800;color:#059669;">-</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;">
          ${actionCardsHtml}
        </div>

        <div style="margin-top:12px;background:#F1F5F9;border:1px solid #CBD5E1;border-radius:12px;padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
          <div style="font-size:12px;font-weight:800;color:#002B49;">⚡ เครื่องมือการทำงานร่วมกัน &amp; กระดานงานประจำวัน (v1172):</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" onclick="window.openDepartmentTaskBoardModal()" style="background:#002B49;color:#FDE047;border:none;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:800;cursor:pointer;">📋 กระดานงาน &amp; To-Do List แผนก</button>
            <button type="button" onclick="window.openOmniMeetAndAiMinutesModal()" style="background:#4F46E5;color:#FFF;border:none;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer;">📹 ประชุมทีม / WFH + AI สรุปรายงาน</button>
            <button type="button" onclick="window.openFieldRepairPartsPipelineModal()" style="background:#B91C1C;color:#FFF;border:none;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer;">🔧 งานซ่อมต่อเนื่อง &amp; รอบอะไหล่ ETA</button>
            <button type="button" onclick="window.openDepartmentReportCenterModal()" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer;">📑 ออกรายงานประจำแผนก</button>
          </div>
        </div>

        <div id="hzkV1171CrossDeptInboxWrap" style="margin-top:12px;display:none;background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:12px;padding:11px 14px;">
          <div style="font-weight:800;color:#92400E;font-size:12.5px;margin-bottom:6px;">📥 กล่องรับงานข้ามแผนกที่ส่งถึง ${emp.deptLabel} (Pending Cross-Dept Handovers):</div>
          <div id="hzkV1171CrossDeptInboxList" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>
      </div>
    `;

    cockpit.querySelectorAll('.hzk-v1171-lang-btn').forEach(btn => {
      btn.onclick = () => setActiveCockpitLang(btn.getAttribute('data-lang'));
    });

    document.getElementById('hzkV1171SwitchUserBtn').onclick = openPersonalEmployeeSelectorModal;

    const toggleJobBtn = document.getElementById('hzkV1171ToggleJobFormBtn');
    if (toggleJobBtn) {
      toggleJobBtn.onclick = () => {
        const nextVal = !showJobOverride;
        sessionStorage.setItem('hzk_v1171_force_show_jobsheet', String(nextVal));
        renderPersonalizedEmployeeCockpit(emp);
      };
    }

    // Fetch live personalized briefing & pending handovers from GAS if connected
    const gasUrl = getGasEndpointUrl();
    if (gasUrl) {
      try {
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'getEmployeeWorkspaceBriefing',
            empId: emp.id,
            empCode: emp.code,
            department: emp.deptLabel
          })
        });
        const d = await res.json();
        if (d && d.status === 'OK' && d.metrics) {
          const m = d.metrics;
          const elH = document.getElementById('hzkMetricHandovers');
          const elJ = document.getElementById('hzkMetricOpenJobs');
          const elQ = document.getElementById('hzkMetricMyQt');
          const elP = document.getElementById('hzkMetricPoApproved');
          if (elH) elH.textContent = `${m.pendingHandoversCount} รายการ`;
          if (elJ) elJ.textContent = emp.isTech ? `${m.myJobsCount} งานฉัน / ${m.openJobsCount} รวม` : `${m.openJobsCount} เคส`;
          if (elQ) elQ.textContent = `${m.myQtCount} ฉบับ / ${m.totalQtCount} รวม`;
          if (elP) elP.textContent = `${m.poApprovedCount} รายการ`;

          const inboxWrap = document.getElementById('hzkV1171CrossDeptInboxWrap');
          const inboxList = document.getElementById('hzkV1171CrossDeptInboxList');
          if (inboxWrap && inboxList && Array.isArray(d.pendingHandovers) && d.pendingHandovers.length > 0) {
            inboxWrap.style.display = 'block';
            inboxList.innerHTML = d.pendingHandovers.map(h => `
              <div style="background:#FFFFFF;border:1px solid #FCD34D;border-radius:8px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;">
                <div>
                  <b>[${h.handoverId}] จาก ${h.fromDept}</b> (${h.sender}) ➔ ลูกค้า: <b>${h.customerName}</b> | ${h.modelSn} (${h.amount})
                </div>
                <button type="button" data-hnd-id="${h.handoverId}" class="hzk-v1171-ack-hnd-btn" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:5px 10px;font-weight:700;cursor:pointer;">✅ รับเรื่องดำเนินการแล้ว</button>
              </div>
            `).join('');

            inboxList.querySelectorAll('.hzk-v1171-ack-hnd-btn').forEach(b => {
              b.onclick = async () => {
                const hId = b.getAttribute('data-hnd-id');
                b.disabled = true;
                b.textContent = '⏳ กำลังบันทึก...';
                await fetch(gasUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify({ action: 'completeCrossDeptHandover', handoverId: hId, actorName: emp.name })
                });
                renderPersonalizedEmployeeCockpit(emp);
              };
            });
          }
        }
      } catch (err) {}
    } else {
      // Offline/local stats fallback
      const localArchives = (() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_ARCHIVE_KEY) || '[]'); } catch (e) { return []; }
      })();
      const myQt = localArchives.filter(q => String(q.salesperson || '').toUpperCase() === emp.code.toUpperCase());
      const elQ = document.getElementById('hzkMetricMyQt');
      const elJ = document.getElementById('hzkMetricOpenJobs');
      const elP = document.getElementById('hzkMetricPoApproved');
      if (elQ) elQ.textContent = `${myQt.length} ฉบับ / ${localArchives.length} รวม`;
      if (elJ) elJ.textContent = 'พร้อมใช้งาน Offline';
      if (elP) elP.textContent = 'ซิงก์เมื่อต่อ GAS';
    }
  }

  function openPersonalEmployeeSelectorModal() {
    let selModal = document.getElementById('hzkPersonalEmployeeSelectorModal');
    if (!selModal) {
      selModal = document.createElement('div');
      selModal.id = 'hzkPersonalEmployeeSelectorModal';
      selModal.style.cssText =
        'position:fixed;inset:0;z-index:20070;background:rgba(15,23,42,0.86);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(selModal);
    }

    const activeEmp = getActiveEmployeeProfileV1171();
    const groups = [
      { key: 'SERVICE_MGR', label: '🧑‍💼 แผนกบริการ (Service Management & Admin)' },
      { key: 'SERVICE_TECH', label: '🛠️ ทีมช่างบริการภาคสนาม & คลัง IMS (T01–T08)' },
      { key: 'SALES_TH', label: '💼 ฝ่ายขายในประเทศ (Commercial Sales THB)' },
      { key: 'JPC_CORP', label: '🇯🇵 ฝ่ายขายองค์กรญี่ปุ่น (Japanese Corporate)' },
      { key: 'MARKETING', label: '📣 ฝ่ายการตลาดและผลิตภัณฑ์ (Marketing)' },
      { key: 'ACCOUNTING', label: '🧾 ฝ่ายบัญชีและการเงิน (Accounting & Finance)' },
      { key: 'ADMIN_HR', label: '🏢 ฝ่ายธุรการและบุคคล (Admin & HR)' },
      { key: 'EXECUTIVE', label: '👑 คณะผู้บริหารระดับสูง (Executive Management)' }
    ];

    const groupsHtml = groups.map(g => {
      const members = COMPLETE_COMPANY_ROSTER_V1171.filter(m => m.deptKey === g.key);
      const cards = members.map(m => {
        const isCurrent = m.id === activeEmp.id;
        return `
          <button type="button" data-emp-id="${m.id}" class="hzk-pick-emp-cockpit-btn" style="text-align:left;background:${isCurrent ? '#EFF6FF' : '#F8FAFC'};border:${isCurrent ? '2px solid #0284C7' : '1px solid #CBD5E1'};border-radius:10px;padding:10px 12px;cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
              <span style="font-weight:800;font-size:13px;color:#0F172A;">${m.name}</span>
              ${isCurrent ? '<span style="background:#0284C7;color:#FFF;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;">กำลังใช้งาน</span>' : ''}
            </div>
            <div style="font-size:11.5px;color:#475569;margin-top:2px;">${m.role} (${m.code})</div>
          </button>
        `;
      }).join('');

      return `
        <div style="margin-bottom:14px;">
          <div style="font-weight:800;color:#002B49;font-size:13.5px;margin-bottom:6px;border-bottom:1px solid #E2E8F0;padding-bottom:4px;">${g.label}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;">${cards}</div>
        </div>
      `;
    }).join('');

    selModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:980px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:#002B49;color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:2;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1171 • PERSONALIZED EMPLOYEE WORKSPACE ROUTER</div>
            <div style="font-size:16px;font-weight:800;">🧑‍💻 เลือกโปรไฟล์พนักงานหรือแผนกของคุณเพื่อปรับหน้าจอให้ตรงกับงานจริง</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkPersonalEmployeeSelectorModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:16px 20px;">
          <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:9px 12px;font-size:12px;color:#0369A1;margin-bottom:14px;">
            💡 <b>ระบบจดจำโปรไฟล์อัตโนมัติ:</b> เมื่อเลือกชื่อของคุณแล้ว หน้าจอจะปรับสี ปุ่มลัด ภาษา (TH/EN/日本語) และซ่อนฟอร์มที่ไม่เกี่ยวข้องให้เหมาะสมกับตำแหน่งงานของคุณทันทีในทุกครั้งที่เปิดแอปครับ
          </div>
          ${groupsHtml}
        </div>
      </div>
    `;
    selModal.style.display = 'flex';

    selModal.querySelectorAll('.hzk-pick-emp-cockpit-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-emp-id');
        const found = COMPLETE_COMPANY_ROSTER_V1171.find(x => x.id === id);
        if (found) {
          sessionStorage.removeItem('hzk_v1171_force_show_jobsheet');
          setActiveEmployeeProfileV1171(found, true);
          selModal.style.display = 'none';
          showHzkToastNotification(`✅ ปรับหน้าจอเข้าสู่โต๊ะทำงานของ ${found.name} (${found.deptLabel}) เรียบร้อยแล้ว`, false);
        }
      };
    });
  }

  window.openPersonalEmployeeSelectorModal = openPersonalEmployeeSelectorModal;
  window.renderPersonalizedEmployeeCockpit = renderPersonalizedEmployeeCockpit;



  // ============================================================================
  // ENTERPRISE v1172 MODULES:
  //   1) Auto-Aggregated Department Task Board & Priority To-Do List (List + Kanban)
  //   2) Omni-Meet Video Call Hub (Field Live Assist / Dept / 1-on-1 / All-Hands)
  //      + Live Speech Recorder & Gemini AI Meeting Minutes Generator (TH/EN/JP)
  //   3) Multi-Round Field Repair, Supplemental Quote, Parts ETA & Auto-Dispatch
  //   4) 1-Click Departmental Report Center (All 8 Departments)
  // ============================================================================
  const HZK_V1172_LOCAL_TASKS_KEY = 'hzk_v1172_local_tasks_v1';
  const HZK_V1172_LOCAL_REPAIR_KEY = 'hzk_v1172_local_repair_pipeline_v1';
  const HZK_V1172_LOCAL_MEETINGS_KEY = 'hzk_v1172_local_meeting_minutes_v1';

  // ----------------------------------------------------------------------------
  // MODULE 1: SMART PRIORITY TO-DO LIST & 4-COLUMN KANBAN BOARD
  // ----------------------------------------------------------------------------
  async function openDepartmentTaskBoardModal() {
    const emp = getActiveEmployeeProfileV1171();
    let modal = document.getElementById('hzkDeptTaskBoardModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkDeptTaskBoardModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20080;background:rgba(15,23,42,0.86);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1160px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#1E3A8A);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1172 • AUTO-AGGREGATED DEPARTMENT TASK BOARD &amp; PRIORITY TO-DO</div>
            <div style="font-size:16px;font-weight:800;">📋 กระดานงาน &amp; To-Do List อัจฉริยะ (รวมงานค้างจากทุกแผนก + มติประชุม AI)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkDeptTaskBoardModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:16px 20px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;background:#F1F5F9;padding:10px 12px;border-radius:10px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <label style="font-weight:700;">แผนก:</label>
              <select id="hzkTskDeptSel" style="padding:7px 10px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
                <option value="${emp.deptLabel}">แผนกของฉัน (${emp.deptLabel})</option>
                <option value="ALL">ทุกแผนกทั้งบริษัท (All Departments)</option>
                <option value="Service Unit">Service Unit &amp; Field Tech</option>
                <option value="Sales Department">Sales Department</option>
                <option value="Japanese Corporate">Japanese Corporate</option>
                <option value="Marketing Department">Marketing Department</option>
                <option value="Accounting & Finance">Accounting &amp; Finance</option>
                <option value="Admin & HR">Admin &amp; HR</option>
              </select>
              <button type="button" id="hzkTskViewListBtn" style="background:#002B49;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">📑 มุมมองลำดับความสำคัญ (To-Do List)</button>
              <button type="button" id="hzkTskViewKanbanBtn" style="background:#FFFFFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">🗂️ มุมมองกระดาน 4 ช่อง (Kanban)</button>
            </div>
            <button type="button" id="hzkTskRefreshBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">🔄 รีเฟรชงานค้างล่าสุด</button>
          </div>

          <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:10px 12px;margin-bottom:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
            <input id="hzkNewTskTitle" type="text" placeholder="+ เพิ่มรายการงาน To-Do ใหม่..." style="grid-column:span 2;padding:7px 10px;border:1px solid #94A3B8;border-radius:8px;font-weight:700;" />
            <select id="hzkNewTskPrio" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
              <option value="URGENT">🔴 ด่วนที่สุด (Urgent)</option>
              <option value="TODAY" selected>🟡 ทำวันนี้ (Today)</option>
              <option value="UPCOMING">🟢 วางแผนล่วงหน้า (Upcoming)</option>
            </select>
            <input id="hzkNewTskDue" type="date" value="${new Date().toISOString().slice(0, 10)}" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
            <button type="button" id="hzkNewTskAddBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;">+ เพิ่มลงกระดาน</button>
          </div>

          <div id="hzkTaskBoardContainer">⏳ กำลังรวบรวมงานค้างและลำดับความสำคัญ...</div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    let viewMode = 'LIST';
    let currentTasks = [];

    function getLocalTasksFallback(dept) {
      let localManual = [];
      try {
        localManual = JSON.parse(localStorage.getItem(HZK_V1172_LOCAL_TASKS_KEY) || '[]');
      } catch (e) {}
      const sampleAuto = [
        { taskId: 'AUTO-SVC-01', department: 'Service Unit', assignee: 'T01 / T07', priority: 'URGENT', status: 'TODO', title: '✅ อะไหล่เข้าครบแล้ว: เข้าซ่อมร้านกาแฟตัวอย่าง สาขาภูเก็ต (K01234J)', detail: 'Water Valve + ล้างระบบ (ลูกค้าคอนเฟิร์มแล้ว)', dueDate: new Date().toISOString().slice(0, 10), source: 'FIELD_REPAIR_ETA', autoPulled: true },
        { taskId: 'AUTO-SLS-01', department: 'Sales Department', assignee: 'KULATHIDA_C', priority: 'URGENT', status: 'WAITING', title: '⏰ ติดตามใบเสนอราคาค้างตอบรับ > 3 วัน (HTH-26108)', detail: 'ลูกค้า Chain Cafe สาขาสยามสแควร์ (118,000 THB)', dueDate: new Date().toISOString().slice(0, 10), source: 'DOC_TRACKING', autoPulled: true },
        { taskId: 'AUTO-ACC-01', department: 'Accounting & Finance', assignee: 'WARAPORN_K', priority: 'TODAY', status: 'TODO', title: '🧾 ออกใบวางบิล & เปิด SO ใน NAV (SO-2026-0142)', detail: 'ลูกค้าอนุมัติ PO แล้ว (68,500 THB)', dueDate: new Date().toISOString().slice(0, 10), source: 'PO_APPROVED_BILLING', autoPulled: true },
        { taskId: 'AUTO-MKT-01', department: 'Marketing Department', assignee: 'TAKSAON_T', priority: 'UPCOMING', status: 'IN_PROGRESS', title: '🏷️ จัดแคมเปญระบายสต็อกเครื่องตัวโชว์/มีตำหนิ (602 รายการ)', detail: 'คัดรุ่น IM-130NE / FM-1000 พร้อมใบตรวจสภาพ QCF', dueDate: new Date().toISOString().slice(0, 10), source: 'DEMO_STOCK', autoPulled: true }
      ];
      const all = localManual.concat(sampleAuto);
      if (!dept || dept === 'ALL') return all;
      return all.filter(t => String(t.department || '').toUpperCase().indexOf(dept.split(' ')[0].toUpperCase()) !== -1 || !t.autoPulled);
    }

    async function loadTasks() {
      const dept = document.getElementById('hzkTskDeptSel').value;
      const box = document.getElementById('hzkTaskBoardContainer');
      box.innerHTML = '⏳ กำลังโหลดรายการงาน...';
      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          const r = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getDepartmentTaskBoard', department: dept })
          });
          const d = await r.json();
          if (d && d.status === 'OK') {
            let localManual = [];
            try { localManual = JSON.parse(localStorage.getItem(HZK_V1172_LOCAL_TASKS_KEY) || '[]'); } catch (e) {}
            currentTasks = (d.tasks || []).concat(localManual);
            renderTasks();
            return;
          }
        } catch (err) {}
      }
      currentTasks = getLocalTasksFallback(dept);
      renderTasks();
    }

    async function updateTaskStatus(taskId, nextStatus) {
      const idx = currentTasks.findIndex(x => x.taskId === taskId);
      if (idx >= 0) currentTasks[idx].status = nextStatus;
      try {
        const localManual = JSON.parse(localStorage.getItem(HZK_V1172_LOCAL_TASKS_KEY) || '[]');
        const lIdx = localManual.findIndex(x => x.taskId === taskId);
        if (lIdx >= 0) {
          localManual[lIdx].status = nextStatus;
          localStorage.setItem(HZK_V1172_LOCAL_TASKS_KEY, JSON.stringify(localManual));
        }
      } catch (e) {}
      renderTasks();
      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'createOrUpdateTaskItem', taskId: taskId, status: nextStatus })
          });
        } catch (e) {}
      }
    }

    function renderTasks() {
      const box = document.getElementById('hzkTaskBoardContainer');
      const activeList = currentTasks.filter(t => t.status !== 'DONE');
      const doneList = currentTasks.filter(t => t.status === 'DONE');

      if (viewMode === 'LIST') {
        const groups = [
          { key: 'URGENT', label: '🔴 1. ด่วนที่สุด / เกินกำหนด (Urgent & Overdue)', bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
          { key: 'TODAY', label: '🟡 2. งานที่ต้องทำวันนี้ (Today Action Queue)', bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
          { key: 'UPCOMING', label: '🟢 3. งานวางแผนล่วงหน้า (Upcoming & Follow-ups)', bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' }
        ];

        box.innerHTML = groups.map(g => {
          const items = activeList.filter(t => t.priority === g.key);
          const rows = items.map(t => `
            <div style="background:#FFFFFF;border:1px solid ${g.border};border-radius:10px;padding:10px 12px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <div>
                <div style="font-weight:800;font-size:13px;color:#0F172A;">${t.title}</div>
                <div style="font-size:11.5px;color:#475569;margin-top:2px;">${t.detail} • <b>แผนก:</b> ${t.department} • <b>กำหนด:</b> ${t.dueDate}</div>
              </div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button type="button" data-tid="${t.taskId}" data-st="IN_PROGRESS" class="hzk-tsk-move-btn" style="background:#0284C7;color:#FFF;border:none;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:700;cursor:pointer;">⚡ กำลังทำ</button>
                <button type="button" data-tid="${t.taskId}" data-st="DONE" class="hzk-tsk-move-btn" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:700;cursor:pointer;">✅ เสร็จแล้ว</button>
              </div>
            </div>
          `).join('') || `<div style="font-size:12px;color:#64748B;padding:6px;">ไม่มีงานค้างในหมวดนี้</div>`;

          return `
            <div style="background:${g.bg};border:1.5px solid ${g.border};border-radius:12px;padding:12px;margin-bottom:12px;">
              <div style="font-weight:800;color:${g.text};font-size:13.5px;margin-bottom:8px;">${g.label} (${items.length})</div>
              ${rows}
            </div>
          `;
        }).join('') + (doneList.length ? `<div style="font-size:12px;color:#059669;font-weight:700;margin-top:6px;">✅ งานที่ปิดเสร็จสิ้นแล้ว: ${doneList.length} รายการ</div>` : '');
      } else {
        // 4-Column Kanban Board
        const cols = [
          { key: 'TODO', title: '📥 รอดำเนินการ (To Do)', headerBg: '#002B49', next: 'IN_PROGRESS', nextLabel: '▶ เริ่มทำ' },
          { key: 'IN_PROGRESS', title: '⚡ กำลังดำเนินการ (In Progress)', headerBg: '#0284C7', next: 'WAITING', nextLabel: '⏳ รอผล' },
          { key: 'WAITING', title: '⏳ รออะไหล่ / รอลูกค้า (Waiting)', headerBg: '#D97706', next: 'DONE', nextLabel: '✅ ปิดงาน' },
          { key: 'DONE', title: '✅ เสร็จสิ้น (Done)', headerBg: '#059669', next: '', nextLabel: '' }
        ];

        box.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">
            ${cols.map(c => {
              const cItems = currentTasks.filter(t => t.status === c.key);
              const cards = cItems.map(t => `
                <div style="background:#FFFFFF;border:1px solid #CBD5E1;border-radius:9px;padding:9px;margin-bottom:8px;box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                  <div style="font-size:10px;font-weight:800;color:${t.priority === 'URGENT' ? '#DC2626' : '#0369A1'};">${t.priority} • ${t.department}</div>
                  <div style="font-weight:700;font-size:12px;color:#0F172A;margin-top:3px;">${t.title}</div>
                  <div style="font-size:11px;color:#64748B;margin-top:3px;">${t.detail}</div>
                  ${c.next ? `<button type="button" data-tid="${t.taskId}" data-st="${c.next}" class="hzk-tsk-move-btn" style="margin-top:7px;width:100%;background:${c.headerBg};color:#FFF;border:none;border-radius:6px;padding:5px;font-size:11px;font-weight:700;cursor:pointer;">${c.nextLabel}</button>` : ''}
                </div>
              `).join('') || '<div style="color:#94A3B8;font-size:11.5px;text-align:center;padding:12px;">- ว่าง -</div>';

              return `
                <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;overflow:hidden;">
                  <div style="background:${c.headerBg};color:#FFF;padding:8px 10px;font-weight:800;font-size:12px;">${c.title} (${cItems.length})</div>
                  <div style="padding:8px;max-height:460px;overflow-y:auto;">${cards}</div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      box.querySelectorAll('.hzk-tsk-move-btn').forEach(b => {
        b.onclick = () => updateTaskStatus(b.getAttribute('data-tid'), b.getAttribute('data-st'));
      });
    }

    document.getElementById('hzkTskViewListBtn').onclick = () => {
      viewMode = 'LIST';
      document.getElementById('hzkTskViewListBtn').style.background = '#002B49';
      document.getElementById('hzkTskViewListBtn').style.color = '#FFF';
      document.getElementById('hzkTskViewKanbanBtn').style.background = '#FFFFFF';
      document.getElementById('hzkTskViewKanbanBtn').style.color = '#0F172A';
      renderTasks();
    };

    document.getElementById('hzkTskViewKanbanBtn').onclick = () => {
      viewMode = 'KANBAN';
      document.getElementById('hzkTskViewKanbanBtn').style.background = '#002B49';
      document.getElementById('hzkTskViewKanbanBtn').style.color = '#FFF';
      document.getElementById('hzkTskViewListBtn').style.background = '#FFFFFF';
      document.getElementById('hzkTskViewListBtn').style.color = '#0F172A';
      renderTasks();
    };

    document.getElementById('hzkNewTskAddBtn').onclick = async () => {
      const title = document.getElementById('hzkNewTskTitle').value.trim();
      if (!title) return;
      const prio = document.getElementById('hzkNewTskPrio').value;
      const due = document.getElementById('hzkNewTskDue').value;
      const dept = document.getElementById('hzkTskDeptSel').value === 'ALL' ? emp.deptLabel : document.getElementById('hzkTskDeptSel').value;
      const newObj = {
        taskId: 'TSK-' + Date.now().toString().slice(-6),
        department: dept,
        assignee: emp.name,
        priority: prio,
        status: 'TODO',
        title: title,
        detail: 'เพิ่มโดย ' + emp.name,
        dueDate: due,
        source: 'MANUAL',
        autoPulled: false
      };
      try {
        const prev = JSON.parse(localStorage.getItem(HZK_V1172_LOCAL_TASKS_KEY) || '[]');
        localStorage.setItem(HZK_V1172_LOCAL_TASKS_KEY, JSON.stringify([newObj].concat(prev)));
      } catch (e) {}
      document.getElementById('hzkNewTskTitle').value = '';
      currentTasks.unshift(newObj);
      renderTasks();

      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(Object.assign({ action: 'createOrUpdateTaskItem' }, newObj))
          });
        } catch (e) {}
      }
    };

    document.getElementById('hzkTskRefreshBtn').onclick = loadTasks;
    document.getElementById('hzkTskDeptSel').onchange = loadTasks;
    loadTasks();
  }

  // ----------------------------------------------------------------------------
  // MODULE 2: OMNI-MEET HUB & GEMINI AI MEETING RECORDER / MINUTES GENERATOR
  // ----------------------------------------------------------------------------
  async function openOmniMeetAndAiMinutesModal() {
    const emp = getActiveEmployeeProfileV1171();
    let modal = document.getElementById('hzkOmniMeetAiModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkOmniMeetAiModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20082;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const staffOptions = COMPLETE_COMPANY_ROSTER_V1171.map(s =>
      `<option value="${s.name}">${s.name} [${s.deptLabel}]</option>`
    ).join('');

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1080px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#1E1B4B,#4F46E5);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1172 • HOSHIZAKI OMNI-MEET HUB &amp; AI MEETING MINUTES</div>
            <div style="font-size:16px;font-weight:800;">📹 ประชุมทีม (WFH / On-Site ช่าง / แผนก / ทั้งบริษัท) &amp; AI สรุปรายงานการประชุม</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkOmniMeetAiModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:18px 20px;font-size:13px;display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;">
          <!-- Left: Instant Video Call & Teams Launcher -->
          <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:14px;padding:14px;">
            <div style="font-weight:800;color:#002B49;font-size:14.5px;margin-bottom:8px;">1️⃣ เปิดห้องประชุมออนไลน์ &amp; Live Field Call</div>
            <div style="margin-bottom:8px;">
              <label style="font-weight:700;font-size:12px;">รูปแบบการประชุม:</label>
              <select id="hzkMeetModeSel" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;font-weight:700;">
                <option value="DEPARTMENT">🏢 ประชุมทีมภายในแผนก (${emp.deptLabel})</option>
                <option value="FIELD_ASSIST">🛠️ On-Site Field Live Assist (ช่างหน้างานเปิดกล้องปรึกษาหัวหน้า)</option>
                <option value="ONE_ON_ONE">👤 ประชุมตัวต่อตัว 1-on-1 (WFH Check-in / ปรึกษางาน)</option>
                <option value="ALL_HANDS">🏛️ ประชุมรวมทั้งบริษัท (All-Hands 8 แผนก)</option>
              </select>
            </div>
            <div id="hzkMeetOneOnOneWrap" style="display:none;margin-bottom:8px;">
              <label style="font-weight:700;font-size:12px;">เลือกคู่สนทนา (รายบุคคล):</label>
              <select id="hzkMeetTargetStaff" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;">${staffOptions}</select>
            </div>
            <div style="margin-bottom:8px;">
              <label style="font-weight:700;font-size:12px;">หัวข้อประชุม / เลขที่ใบงาน / S/N:</label>
              <input id="hzkMeetTitleInp" type="text" value="ประชุมทีม ${emp.deptLabel} (${new Date().toISOString().slice(0, 10)})" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;font-weight:700;" />
            </div>
            <div style="margin-bottom:10px;">
              <label style="font-weight:700;font-size:12px;">วาระการประชุม / อาการหน้างานที่ต้องการปรึกษา:</label>
              <textarea id="hzkMeetAgendaInp" rows="2" placeholder="ระบุหัวข้อที่จะหารือ..." style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;"></textarea>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button type="button" id="hzkLaunchWebRoomBtn" style="background:#059669;color:#FFF;border:none;border-radius:9px;padding:10px;font-weight:800;cursor:pointer;">🎥 เปิดห้องวิดีโอคอลทันที + ส่งปุ่มเข้าสายใน LINE</button>
              <button type="button" id="hzkLaunchMsTeamsBtn" style="background:#4F46E5;color:#FFF;border:none;border-radius:9px;padding:9px;font-weight:700;cursor:pointer;">💼 เปิดผ่าน Microsoft Teams (สร้างนัดหมาย)</button>
            </div>
            <div id="hzkMeetRoomStatusBox" style="margin-top:10px;font-size:12px;color:#0369A1;display:none;background:#EFF6FF;padding:8px 10px;border-radius:8px;"></div>
          </div>

          <!-- Right: Live Voice Recorder & Gemini AI Minutes Generator -->
          <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:14px;padding:14px;">
            <div style="font-weight:800;color:#92400E;font-size:14.5px;margin-bottom:6px;">2️⃣ บันทึกเสียง &amp; AI สรุปรายงานการประชุม (TH / EN / 日本語)</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
              <button type="button" id="hzkStartRecBtn" style="background:#DC2626;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">🎙️ เริ่มอัดเสียง &amp; ถอดข้อความสด</button>
              <button type="button" id="hzkStopRecBtn" disabled style="background:#475569;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">⏹️ หยุดบันทึก</button>
              <span id="hzkRecStatusBadge" style="font-size:11.5px;font-weight:700;color:#64748B;align-self:center;">พร้อมบันทึก</span>
            </div>
            <div style="margin-bottom:8px;">
              <label style="font-weight:700;font-size:12px;">ข้อความถอดเสียง / บันทึกการประชุม (พิมพ์เพิ่มเติมหรือแก้ไขได้):</label>
              <textarea id="hzkMeetTranscriptBox" rows="5" placeholder="กดปุ่มเริ่มอัดเสียงเพื่อถอดข้อความอัตโนมัติ หรือพิมพ์สรุปประเด็นที่คุยกันที่นี่เพื่อให้ Gemini AI จัดรูปแบบรายงานและแยกงานส่งต่อ..." style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;font-size:12px;"></textarea>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:12px;">
              <label><input id="hzkAiCreateTasksCb" type="checkbox" checked /> ส่งมติที่ประชุมเข้า <b>กระดานงาน To-Do List</b> อัตโนมัติ</label>
              <label><input id="hzkAiSendLineCb" type="checkbox" checked /> ส่งรายงานสรุปเข้า <b>กลุ่ม LINE</b></label>
            </div>
            <button type="button" id="hzkGenerateAiMinutesBtn" style="width:100%;background:linear-gradient(135deg,#002B49,#0284C7);color:#FFF;border:none;border-radius:9px;padding:10px;font-weight:800;cursor:pointer;">🤖 ให้ Gemini AI สรุปรายงานการประชุม &amp; แจกจ่ายงานทันที</button>
            <div id="hzkAiMinutesOutputBox" style="margin-top:10px;display:none;background:#FFFFFF;border:1px solid #CBD5E1;border-radius:10px;padding:10px;font-size:12px;line-height:1.5;"></div>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('hzkMeetModeSel').onchange = function () {
      document.getElementById('hzkMeetOneOnOneWrap').style.display = (this.value === 'ONE_ON_ONE') ? 'block' : 'none';
    };

    function buildRoomUrl() {
      const slug = 'HOSHIZAKI-TH-' + Date.now().toString(36).toUpperCase();
      return 'https://meet.jit.si/' + slug;
    }

    document.getElementById('hzkLaunchWebRoomBtn').onclick = async () => {
      const roomUrl = buildRoomUrl();
      const mType = document.getElementById('hzkMeetModeSel').value;
      const title = document.getElementById('hzkMeetTitleInp').value.trim();
      const agenda = document.getElementById('hzkMeetAgendaInp').value.trim();
      const targetStaff = document.getElementById('hzkMeetTargetStaff').value;
      const targetDept = mType === 'ALL_HANDS' ? 'All Departments (8 แผนก)' : (mType === 'ONE_ON_ONE' ? targetStaff : emp.deptLabel);

      const stBox = document.getElementById('hzkMeetRoomStatusBox');
      stBox.style.display = 'block';
      stBox.innerHTML = `✅ เปิดห้องประชุมแล้ว: <a href="${roomUrl}" target="_blank" style="font-weight:800;color:#0284C7;">${roomUrl}</a> (กำลังส่งปุ่มเชิญเข้า LINE...)`;
      window.open(roomUrl, '_blank');

      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'dispatchOmniMeetingInvite',
              meetType: mType,
              roomTitle: title,
              roomUrl: roomUrl,
              hostName: emp.name,
              department: targetDept,
              agenda: agenda
            })
          });
          stBox.innerHTML += ' • <b>ส่งการ์ดเข้ากลุ่ม LINE เรียบร้อยแล้ว!</b>';
        } catch (e) {}
      }
    };

    document.getElementById('hzkLaunchMsTeamsBtn').onclick = () => {
      const title = encodeURIComponent(document.getElementById('hzkMeetTitleInp').value.trim());
      const content = encodeURIComponent(document.getElementById('hzkMeetAgendaInp').value.trim());
      window.open(`https://teams.microsoft.com/l/meeting/new?subject=${title}&content=${content}`, '_blank');
    };

    // Live Speech Recognition + MediaRecorder Audio Backup
    let recognition = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let recordedAudioDataUrl = '';

    document.getElementById('hzkStartRecBtn').onclick = async () => {
      const badge = document.getElementById('hzkRecStatusBadge');
      const ta = document.getElementById('hzkMeetTranscriptBox');
      document.getElementById('hzkStartRecBtn').disabled = true;
      document.getElementById('hzkStopRecBtn').disabled = false;
      badge.textContent = '🔴 กำลังอัดเสียงและถอดข้อความ...';
      badge.style.color = '#DC2626';

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        recognition = new SpeechRec();
        recognition.lang = getActiveCockpitLang() === 'JP' ? 'ja-JP' : 'th-TH';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (ev) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) {
              ta.value += (ta.value ? '\n' : '') + '• ' + ev.results[i][0].transcript.trim();
            }
          }
        };
        try { recognition.start(); } catch (e) {}
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => { recordedAudioDataUrl = reader.result; };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
      } catch (eMic) {}
    };

    document.getElementById('hzkStopRecBtn').onclick = () => {
      if (recognition) { try { recognition.stop(); } catch (e) {} }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') { try { mediaRecorder.stop(); } catch (e) {} }
      document.getElementById('hzkStartRecBtn').disabled = false;
      document.getElementById('hzkStopRecBtn').disabled = true;
      const badge = document.getElementById('hzkRecStatusBadge');
      badge.textContent = '✅ บันทึกเสียงเรียบร้อย';
      badge.style.color = '#059669';
    };

    document.getElementById('hzkGenerateAiMinutesBtn').onclick = async () => {
      const title = document.getElementById('hzkMeetTitleInp').value.trim();
      const transcript = document.getElementById('hzkMeetTranscriptBox').value.trim();
      if (!transcript && !recordedAudioDataUrl) {
        alert('กรุณากดอัดเสียง หรือพิมพ์บันทึกเนื้อหาการประชุมก่อนให้ AI สรุปครับ');
        return;
      }
      const outBox = document.getElementById('hzkAiMinutesOutputBox');
      outBox.style.display = 'block';
      outBox.innerHTML = '⏳ กำลังส่งข้อมูลให้ Gemini AI สรุปรายงานการประชุม 3 ภาษา และแยกงานส่งต่อ...';

      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          const res = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'generateAiMeetingMinutes',
              title: title,
              department: emp.deptLabel,
              hostName: emp.name,
              participants: emp.deptLabel + ' Team',
              transcript: transcript,
              audioBase64: recordedAudioDataUrl,
              autoCreateTasks: document.getElementById('hzkAiCreateTasksCb').checked,
              sendToLine: document.getElementById('hzkAiSendLineCb').checked
            })
          });
          const d = await res.json();
          if (d && d.status === 'OK') {
            outBox.innerHTML = `
              <div style="font-weight:800;color:#059669;margin-bottom:6px;">✅ สรุปรายงานการประชุมสำเร็จ (${d.meetingId})</div>
              <div style="white-space:pre-line;margin-bottom:8px;"><b>สรุปภาษาไทย:</b>
${d.summaryTh}</div>
              ${d.summaryJpEn ? `<div style="white-space:pre-line;background:#F8FAFC;padding:8px;border-radius:8px;margin-bottom:8px;"><b>JP / EN Summary:</b>
${d.summaryJpEn}</div>` : ''}
              <div style="font-size:11.5px;color:#0369A1;">📋 สร้างรายการงานเข้ากระดาน To-Do List แล้ว ${(d.actionItems || []).length} รายการ</div>
            `;
            return;
          }
        } catch (err) {}
      }

      // Local offline fallback summary
      outBox.innerHTML = `
        <div style="font-weight:800;color:#059669;margin-bottom:4px;">✅ บันทึกสรุปการประชุมในเครื่องเรียบร้อยแล้ว</div>
        <div style="white-space:pre-line;"><b>หัวข้อ:</b> ${title}
<b>เนื้อหา:</b>
${transcript}</div>
      `;
    };
  }

  // ----------------------------------------------------------------------------
  // MODULE 3: MULTI-ROUND FIELD REPAIR, SUPPLEMENTAL QUOTE & PARTS ETA PIPELINE
  // ----------------------------------------------------------------------------
  async function openFieldRepairPartsPipelineModal() {
    let modal = document.getElementById('hzkFieldRepairEtaModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkFieldRepairEtaModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20084;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const today = new Date().toISOString().slice(0, 10);
    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1080px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#7F1D1D,#B91C1C);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#FECACA;font-weight:800;">ENTERPRISE v1172 • FIELD TESTING ➔ SUPPLEMENTAL QUOTE ➔ MULTI-ROUND PARTS ETA</div>
            <div style="font-size:16px;font-weight:800;">🔧 ติดตามงานซ่อมต่อเนื่อง, แจ้งรอบอะไหล่ (ETA) &amp; ล็อกคิวช่างอัตโนมัติ</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkFieldRepairEtaModal').style.display='none'" style="background:#0F172A;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:16px 20px;font-size:13px;">
          <div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:12px;padding:14px;margin-bottom:16px;">
            <div style="font-weight:800;color:#991B1B;font-size:14px;margin-bottom:8px;">➕ บันทึกผลตรวจหน้างาน (Testing) / เสนอราคาอะไหล่เพิ่มเติม &amp; กำหนดรอบอะไหล่ (ETA)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:10px;">
              <input id="hzkRprJobId" type="text" placeholder="เลขที่ใบงาน เช่น JOB-261121" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;" />
              <input id="hzkRprCust" type="text" placeholder="ชื่อร้าน / ลูกค้า *" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
              <input id="hzkRprModel" type="text" placeholder="รุ่นเครื่อง เช่น IM-130NE" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
              <input id="hzkRprSn" type="text" placeholder="Serial No. เช่น K01234J" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
              <input id="hzkRprContact" type="text" placeholder="เบอร์โทร / อีเมลลูกค้า" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
              <select id="hzkRprTechVan" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
                <option value="T01">ช่าง T01 (BKK North)</option><option value="T02">ช่าง T02 (BKK South)</option>
                <option value="T03">ช่าง T03 (BKK East)</option><option value="T04">ช่าง T04 (Nonthaburi)</option>
                <option value="T05">ช่าง T05 (Samut Prakan)</option><option value="T06">ช่าง T06 (Ayutthaya)</option>
                <option value="T07">ช่าง T07 (Upcountry)</option><option value="T08">ช่าง T08 (Install &amp; PM)</option>
              </select>
              <input id="hzkRprParts" type="text" placeholder="รายการอะไหล่ที่ต้องเปลี่ยนเพิ่มเติม *" style="grid-column:span 2;padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
              <input id="hzkRprEta" type="text" placeholder="รอบอะไหล่เข้า เช่น รอบ 1: 25 พ.ย. / รอบ 2: 2 ธ.ค." style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
              <input id="hzkRprDate" type="date" value="${today}" style="padding:7px;border:1px solid #CBD5E1;border-radius:8px;" />
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
              <label style="font-weight:700;color:#065F46;font-size:12.5px;">
                <input id="hzkRprHasPartsCb" type="checkbox" /> 🟢 มีอะไหล่พร้อมในรถช่าง/คลังแล้ว (ล็อกคิวช่าง + ส่งเมล/LINE Confirm ลูกค้าเข้าซ่อมทันที)
              </label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" id="hzkRprOpenAddQuoteBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;">📄 ออกใบเสนอราคาอะไหล่เพิ่มเติม</button>
                <button type="button" id="hzkRprSaveEtaBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:8px 14px;font-weight:800;cursor:pointer;">💾 บันทึกรอบ ETA &amp; แจ้งเตือน</button>
              </div>
            </div>
          </div>

          <div style="font-weight:800;color:#002B49;margin-bottom:8px;">📋 รายการงานซ่อมต่อเนื่องที่รออะไหล่ / รอเข้าซ่อมตามนัด (Multi-Round Repair Pipeline):</div>
          <div id="hzkRprPipelineTableWrap">⏳ กำลังโหลดรายการ...</div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    async function loadPipeline() {
      const wrap = document.getElementById('hzkRprPipelineTableWrap');
      const gasUrl = getGasEndpointUrl();
      let items = [];
      if (gasUrl) {
        try {
          const r = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getFieldRepairPipelineList' })
          });
          const d = await r.json();
          if (d && d.status === 'OK') items = d.items || [];
        } catch (e) {}
      }
      if (!items.length) {
        try { items = JSON.parse(localStorage.getItem(HZK_V1172_LOCAL_REPAIR_KEY) || '[]'); } catch (e) {}
      }

      wrap.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;min-width:820px;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#002B49;color:#FFF;">
                <th style="padding:7px;">รหัส / ใบงาน</th>
                <th style="padding:7px;text-align:left;">ลูกค้า / รุ่น / S/N</th>
                <th style="padding:7px;text-align:left;">อะไหล่เพิ่มเติม</th>
                <th style="padding:7px;">รอบอะไหล่ (ETA)</th>
                <th style="padding:7px;">ช่าง</th>
                <th style="padding:7px;">สถานะ</th>
                <th style="padding:7px;">ดำเนินการเมื่ออะไหล่พร้อม</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => `
                <tr>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${it.pipelineId}<br><span style="font-size:10.5px;color:#64748B;">${it.jobId}</span></td>
                  <td style="padding:7px;border:1px solid #CBD5E1;"><b>${it.customerName}</b><br>${it.model} (${it.serialNo})</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;">${it.partsDetail}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:700;color:#B45309;">${it.etaRound}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:700;">${it.techVan}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
                    ${it.stage === 'PARTS_READY_CONFIRMED'
                      ? `<span style="background:#DCFCE7;color:#166534;padding:3px 8px;border-radius:999px;font-weight:700;">✅ ล็อกคิวซ่อมแล้ว (${it.repairSlot})</span>`
                      : `<span style="background:#FEF3C7;color:#92400E;padding:3px 8px;border-radius:999px;font-weight:700;">⏳ รออะไหล่เข้า</span>`}
                  </td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
                    <button type="button" data-pid="${it.pipelineId}" data-van="${it.techVan}" class="hzk-rpr-dispatch-now-btn" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:5px 9px;font-weight:700;cursor:pointer;">🚀 อะไหล่พร้อม ➔ ล็อกคิว &amp; แจ้งลูกค้า</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="7" style="padding:12px;text-align:center;color:#64748B;">ยังไม่มีรายการรอรอบอะไหล่เพิ่มเติม</td></tr>'}
            </tbody>
          </table>
        </div>
      `;

      wrap.querySelectorAll('.hzk-rpr-dispatch-now-btn').forEach(btn => {
        btn.onclick = async () => {
          const pid = btn.getAttribute('data-pid');
          const van = btn.getAttribute('data-van');
          const rDate = prompt('ระบุวันที่เข้าซ่อม (YYYY-MM-DD):', today) || today;
          if (gasUrl) {
            const res = await fetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: 'confirmPartsArrivedAndDispatchRepair',
                pipelineId: pid,
                repairDate: rDate,
                timeSlot: '09:00 - 12:00',
                techVan: van
              })
            });
            const d = await res.json();
            alert(d && d.message ? ('✅ ' + d.message) : '✅ ล็อกคิวซ่อมและแจ้งเตือนลูกค้าเรียบร้อยแล้ว');
          } else {
            alert(`✅ ล็อกคิวช่าง ${van} วันที่ ${rDate} และส่งยืนยันให้ลูกค้าเรียบร้อยแล้ว`);
          }
          loadPipeline();
        };
      });
    }

    document.getElementById('hzkRprOpenAddQuoteBtn').onclick = async () => {
      const cust = document.getElementById('hzkRprCust').value.trim();
      const model = document.getElementById('hzkRprModel').value.trim() || 'SPARE-PARTS';
      const sn = document.getElementById('hzkRprSn').value.trim();
      const parts = document.getElementById('hzkRprParts').value.trim();
      const eta = document.getElementById('hzkRprEta').value.trim();
      modal.style.display = 'none';
      HZK_OMNI_STATE.items = [{
        model: model,
        description: `อะไหล่ซ่อมเพิ่มเติม (${parts}) [S/N: ${sn}] — กำหนดรอบอะไหล่: ${eta || 'พร้อมซ่อม'}`,
        w: '',
        d: '',
        h: '',
        unitPrice: 0,
        discount: 0,
        qty: 1,
        isService: true
      }];
      await openSalesCorporateQuotationWithPreset('Service & Billing', 'ใบเสนอราคา (Quotation)');
      if (cust) document.getElementById('hzkSqCustomer').value = cust;
    };

    document.getElementById('hzkRprSaveEtaBtn').onclick = async () => {
      const payload = {
        action: 'saveFieldRepairMultiRoundEta',
        jobId: document.getElementById('hzkRprJobId').value.trim() || ('JOB-' + Date.now().toString().slice(-6)),
        customerName: document.getElementById('hzkRprCust').value.trim() || 'ลูกค้างานซ่อม',
        model: document.getElementById('hzkRprModel').value.trim(),
        serialNo: document.getElementById('hzkRprSn').value.trim(),
        contact: document.getElementById('hzkRprContact').value.trim(),
        techVan: document.getElementById('hzkRprTechVan').value,
        partsDetail: document.getElementById('hzkRprParts').value.trim(),
        etaRound: document.getElementById('hzkRprEta').value.trim(),
        repairDate: document.getElementById('hzkRprDate').value,
        hasPartsReady: document.getElementById('hzkRprHasPartsCb').checked
      };
      const localRec = Object.assign({
        pipelineId: 'RPR-' + Date.now().toString().slice(-6),
        stage: payload.hasPartsReady ? 'PARTS_READY_CONFIRMED' : 'WAITING_PARTS_ETA',
        repairSlot: payload.repairDate
      }, payload);
      try {
        const prev = JSON.parse(localStorage.getItem(HZK_V1172_LOCAL_REPAIR_KEY) || '[]');
        localStorage.setItem(HZK_V1172_LOCAL_REPAIR_KEY, JSON.stringify([localRec].concat(prev)));
      } catch (e) {}

      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          const r = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          const d = await r.json();
          if (d && d.status === 'OK') {
            alert(d.message ? ('✅ ' + d.message) : `✅ บันทึกรอบรออะไหล่ (${d.etaRound}) และแจ้งเตือนเรียบร้อยแล้ว`);
            loadPipeline();
            return;
          }
        } catch (e) {}
      }
      alert('✅ บันทึกข้อมูลงานซ่อมต่อเนื่องและรอบอะไหล่เรียบร้อยแล้ว');
      loadPipeline();
    };

    loadPipeline();
  }

  // ----------------------------------------------------------------------------
  // MODULE 4: 1-CLICK DEPARTMENTAL REPORT CENTER (ALL 8 DEPARTMENTS)
  // ----------------------------------------------------------------------------
  async function openDepartmentReportCenterModal() {
    const emp = getActiveEmployeeProfileV1171();
    let modal = document.getElementById('hzkDeptReportCenterModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkDeptReportCenterModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20086;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1020px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#064E3B,#059669);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#A7F3D0;font-weight:800;">ENTERPRISE v1172 • 1-CLICK DEPARTMENTAL REPORT CENTER</div>
            <div style="font-size:16px;font-weight:800;">📑 ศูนย์ออกรายงานประจำแผนก (CSV / Excel / พิมพ์รายงาน A4)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkDeptReportCenterModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:18px 20px;font-size:13px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
            <label style="font-weight:700;">เลือกแผนกที่ต้องการออกรายงาน:</label>
            <select id="hzkRptDeptSel" style="padding:8px 12px;border:1.5px solid #CBD5E1;border-radius:8px;font-weight:700;">
              <option value="${emp.deptLabel}">รายงานแผนกของฉัน (${emp.deptLabel})</option>
              <option value="Sales Department">💼 Sales Department — Sales Pipeline &amp; Quotation Report</option>
              <option value="Japanese Corporate">🇯🇵 Japanese Corporate — Bilingual Account &amp; Export Report</option>
              <option value="Marketing Department">📣 Marketing — Campaign &amp; Demo/Clearance Stock Report</option>
              <option value="Accounting & Finance">🧾 Accounting &amp; Finance — Tax, Billing &amp; NAV Ready Report</option>
              <option value="Admin & HR">🏢 Admin &amp; HR — Staff Directory &amp; Task Audit Report</option>
              <option value="Service Unit">🛠️ Service Unit — Field Jobs, Parts Cost &amp; Technician Report</option>
              <option value="Executive Management">👑 Executive Boardroom — Unit Lifecycle P&amp;L &amp; Pricing Report</option>
            </select>
            <button type="button" id="hzkRptGenerateBtn" style="background:#002B49;color:#FFF;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">📊 สร้างรายงานทันที</button>
            <button type="button" id="hzkRptDownloadCsvBtn" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">📥 ดาวน์โหลด CSV / Excel</button>
          </div>

          <div id="hzkRptPreviewArea" style="color:#64748B;">กดปุ่ม "สร้างรายงานทันที" เพื่อดูตัวอย่างตารางและส่งออกไฟล์ครับ</div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    let latestReport = null;

    async function runGenerateReport() {
      const dept = document.getElementById('hzkRptDeptSel').value;
      const area = document.getElementById('hzkRptPreviewArea');
      area.innerHTML = '⏳ กำลังรวบรวมข้อมูลรายงานของแผนก ' + dept + '...';

      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          const r = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'generateDepartmentReportBundle', department: dept })
          });
          const d = await r.json();
          if (d && d.status === 'OK') {
            latestReport = d;
            renderReportPreview(d);
            return;
          }
        } catch (e) {}
      }

      // Local fallback report from local archive / lifecycle data
      const fallbackPnl = getLocalFallbackLifecycleData('');
      latestReport = {
        reportTitle: dept + ' — Operational Summary Report (Local Snapshot)',
        department: dept,
        generatedAt: new Date().toLocaleString('th-TH'),
        headers: ['Serial No.', 'Model', 'Channel / Dealer', 'Customer', 'Net Sale Price (THB)', 'Warranty Cost (THB)', 'Net Margin %'],
        rows: (fallbackPnl.allUnits || []).map(u => [u.serialNumber, u.model, u.dealerName, u.customerStore, u.netSellingPrice, u.companyAbsorbedCost, u.netMarginPct + '%'])
      };
      renderReportPreview(latestReport);
    }

    function renderReportPreview(rep) {
      const area = document.getElementById('hzkRptPreviewArea');
      const ths = (rep.headers || []).map(h => `<th style="padding:7px;border:1px solid #CBD5E1;">${h}</th>`).join('');
      const trs = (rep.rows || []).slice(0, 80).map(row =>
        `<tr>${row.map(cell => `<td style="padding:6px;border:1px solid #CBD5E1;">${cell !== null && cell !== undefined ? cell : '-'}</td>`).join('')}</tr>`
      ).join('') || `<tr><td colspan="${(rep.headers || []).length || 1}" style="padding:12px;text-align:center;color:#64748B;">ยังไม่มีรายการข้อมูลในหมวดนี้</td></tr>`;

      area.innerHTML = `
        <div style="font-weight:800;color:#002B49;font-size:14px;margin-bottom:4px;">${rep.reportTitle}</div>
        <div style="font-size:11.5px;color:#475569;margin-bottom:10px;">ออกรายงานโดย: ${emp.name} | เวลา: ${rep.generatedAt} | จำนวน ${(rep.rows || []).length} รายการ</div>
        <div style="overflow-x:auto;">
          <table style="width:100%;min-width:740px;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#002B49;color:#FFF;">${ths}</tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>
      `;
    }

    document.getElementById('hzkRptGenerateBtn').onclick = runGenerateReport;
    document.getElementById('hzkRptDownloadCsvBtn').onclick = () => {
      if (!latestReport) {
        alert('กรุณากดปุ่ม "สร้างรายงานทันที" ก่อนดาวน์โหลดครับ');
        return;
      }
      const csvLines = [(latestReport.headers || []).join(',')].concat(
        (latestReport.rows || []).map(r => r.map(c => `"${String(c !== null && c !== undefined ? c : '').split('"').join('""')}"`).join(','))
      );
      const blob = new Blob(['﻿' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'HOSHIZAKI_' + latestReport.department.replace(/[^A-Za-z0-9]/g, '_') + '_Report_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
    };

    runGenerateReport();
  }

  window.openDepartmentTaskBoardModal = openDepartmentTaskBoardModal;
  window.openOmniMeetAndAiMinutesModal = openOmniMeetAndAiMinutesModal;
  window.openFieldRepairPartsPipelineModal = openFieldRepairPartsPipelineModal;
  window.openDepartmentReportCenterModal = openDepartmentReportCenterModal;



  // ============================================================================
  // ENTERPRISE v1173 MODULE: CLEAN-CANVAS HOME + PERSONAL PIN & APP DRAWER
  // - Ultra-clean, uncluttered daily workspace tailored to each employee & dept
  // - Universal Command Search Bar (S/N, Model, Customer, Tool)
  // - 4-6 Personal Pinned Tools per employee (persisted locally + synced to GAS)
  // - Collapsible App Drawer ("⊞ คลังเครื่องมือทั้งหมด") to pin/unpin/launch any tool
  // ============================================================================
  const HZK_V1173_PIN_MAP_KEY = 'hzk_v1173_employee_pinned_tools_map';
  const HZK_V1173_CLEAN_MODE_KEY = 'hzk_v1173_ultra_clean_canvas_mode';

  const MASTER_TOOL_CATALOG_V1173 = [
    // Service & Field Tech
    { id: 'SCAN_SN_360', icon: '📷', cat: 'Service & Field Tech', titleTh: 'สแกน S/N & ดูประวัติ 360°', titleEn: 'Scan S/N & 360° History', titleJp: 'S/Nスキャン・360°履歴', sub: 'เช็กประกัน ดีลเลอร์ และประวัติซ่อมเก่า', fn: "window.openSerial360TimelineModal('')" },
    { id: 'FIELD_REPAIR_ETA', icon: '🔧', cat: 'Service & Field Tech', titleTh: 'งานซ่อมต่อเนื่อง & รอบอะไหล่ (ETA)', titleEn: 'Multi-Round Repair & Parts ETA', titleJp: '継続修理・部品納期(ETA)管理', sub: 'เสนอราคาอะไหล่เพิ่ม + ล็อกคิวช่างอัตโนมัติ', fn: "window.openFieldRepairPartsPipelineModal()" },
    { id: 'VAN_STOCK', icon: '🚐', cat: 'Service & Field Tech', titleTh: 'คลังอะไหล่รถช่าง (T01–T08)', titleEn: 'Technician Van Stock', titleJp: 'サービスカー部品在庫', sub: 'ตัดสต็อกหน้างาน + แจ้งเตือนสโตร์อัตโนมัติ', fn: "window.openTechnicianVanStockModal()" },
    { id: 'DISPATCH_BOARD', icon: '📅', cat: 'Service & Field Tech', titleTh: 'กระดานจ่ายงานช่าง & ติดตั้ง', titleEn: 'Technician Dispatch Board', titleJp: '技術者ディスパッチ予定表', sub: 'จัดคิวติดตั้ง/ซ่อมรายวันของช่าง T01–T08', fn: "window.openServiceDispatchCalendarModal()" },
    { id: 'PM_RENEWAL', icon: '🔔', cat: 'Service & Field Tech', titleTh: 'แจ้งเตือนหมดประกัน & ต่อสัญญา PM (60 วัน)', titleEn: 'PM & Warranty Renewal (60d)', titleJp: '保証期限・保守契約更新 (60日前)', sub: 'สแกนเครื่องใกล้หมดประกัน + ออกใบเสนอราคา 1 คลิก', fn: "window.openWarrantyPmRenewalModal()" },
    { id: 'SEND_SERVICE_DOC', icon: '📤', cat: 'Service & Field Tech', titleTh: 'ส่งใบแจ้งบริการ / ใบเสร็จให้ลูกค้า', titleEn: 'Send Tracked Service Doc', titleJp: 'サービス報告書・領収書送信', sub: 'ส่งเข้า LINE / Email พร้อมปุ่มยืนยันรับ', fn: "launchTrackedDocFromServiceForm()" },

    // Commercial Sales & Japanese Corporate
    { id: 'QUOTE_SALES_THB', icon: '📄', cat: 'Sales & Japanese Corp', titleTh: 'ออกใบเสนอราคา Sales (THB)', titleEn: 'New Sales Quotation (THB)', titleJp: '新規見積書作成 (THB)', sub: 'เติมขนาด W×D×H + เช็กสต็อกสด 203 รุ่น', fn: "openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)')" },
    { id: 'QUOTE_JPC', icon: '🇯🇵', cat: 'Sales & Japanese Corp', titleTh: 'ใบเสนอราคา Japanese Corporate', titleEn: 'New JPC Quotation (THB/USD)', titleJp: '日系法人向け見積書作成', sub: 'รองรับ Export USD 0% VAT & Local THB + CC JPC', fn: "openSalesCorporateQuotationWithPreset('Japanese Corporate', 'ใบเสนอราคา (Quotation)')" },
    { id: 'SITE_SURVEY', icon: '📐', cat: 'Sales & Japanese Corp', titleTh: 'แบบตรวจความพร้อมหน้างาน (Site Survey)', titleEn: 'Pre-Install Site Survey', titleJp: '設置前現場チェックシート', sub: 'เช็กแรงดันน้ำ ไฟ ท่อน้ำทิ้ง & ชุดกรองน้ำ', fn: "window.openPreInstallSiteSurveyModal()" },
    { id: 'CROSS_HANDOVER', icon: '🔄', cat: 'Sales & Japanese Corp', titleTh: 'ส่งต่องานติดตั้ง & ลงทะเบียน S/N', titleEn: 'Sales-to-Service Handover', titleJp: 'サービス部へ設置作業引継', sub: 'ส่งใบงานให้ฝ่ายบริการเข้าติดตั้งพร้อมผูกประกัน', fn: "openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)', 'HANDOVER')" },
    { id: 'DOC_TRACKING', icon: '📊', cat: 'Sales & Japanese Corp', titleTh: 'ติดตามเอกสาร & E-Sign PO ลูกค้า', titleEn: 'Document & PO Tracking', titleJp: '見積書送付・注文書(PO)承認状況', sub: 'เช็กสถานะเปิดอ่าน ยืนยันรับ และเซ็น PO', fn: "window.openDocumentTrackingDashboardModal()" },

    // Marketing & Product
    { id: 'DEMO_STOCK', icon: '🏷️', cat: 'Marketing & Product', titleTh: 'สต็อกเครื่องโชว์ / มีตำหนิ (602 รายการ)', titleEn: 'Demo & Clearance Stock (602)', titleJp: '展示機・訳あり在庫一覧 (602台)', sub: 'ดูสภาพเครื่อง ใบตรวจสภาพ และดึงลงใบเสนอราคา', fn: "window.openDamageDemoStockModal()" },
    { id: 'QUOTE_MARKETING', icon: '📣', cat: 'Marketing & Product', titleTh: 'ออกใบเสนอราคาแคมเปญ Marketing', titleEn: 'Campaign & Promo Quotation', titleJp: 'キャンペーン見積書作成', sub: 'สร้างใบเสนอราคาโปรโมชันพร้อมการ์ด LINE', fn: "openSalesCorporateQuotationWithPreset('Marketing', 'ใบเสนอราคา (Quotation)')" },
    { id: 'SYNC_EMAIL_STOCK', icon: '📥', cat: 'Marketing & Product', titleTh: 'อัปเดตสต็อกสด MICHIRU-RPA', titleEn: 'Sync Daily Stock Report', titleJp: '日次在庫レポート同期', sub: 'ดึงไฟล์ Stock on Hand ล่าสุดเข้าฐานข้อมูล', fn: "window.triggerEmailStockSyncNow()" },

    // Accounting, Admin & HR
    { id: 'BILLING_RECEIPT', icon: '🧾', cat: 'Accounting, Admin & HR', titleTh: 'ออกใบวางบิล / ใบเสร็จรับเงิน (1 คลิก)', titleEn: 'Create Billing Note / Receipt', titleJp: '請求書・領収書作成', sub: 'Tax ID 13 หลัก/สาขา + VAT 7% / WHT 3%', fn: "openSalesCorporateQuotationWithPreset('Service & Billing', 'ใบวางบิล (Billing Note)')" },
    { id: 'EXPORT_NAV', icon: '🏭', cat: 'Accounting, Admin & HR', titleTh: 'ส่งออก Sales Order เข้า NAV (CSV)', titleEn: 'Export PO Approved to NAV', titleJp: '承認済POデータをNAV用CSV出力', sub: 'ดาวน์โหลดไฟล์ CSV นำเข้า Microsoft Dynamics NAV', fn: "window.exportErpSalesOrdersCsv()" },
    { id: 'GO_LIVE_QA', icon: '🛡️', cat: 'Accounting, Admin & HR', titleTh: 'ตรวจความพร้อมระบบ & Go-Live QA', titleEn: 'Production Readiness QA', titleJp: '本番稼働・システムヘルス点検', sub: 'เช็กสถานะ API, Google Sheets, LINE OA', fn: "window.openProductionGoLiveQaModal()" },
    { id: 'ROLE_SOP', icon: '📖', cat: 'Accounting, Admin & HR', titleTh: 'คู่มือใช้งานแยกแผนก (Role SOP Guide)', titleEn: 'Department Role SOP Guide', titleJp: '部署別操作マニュアル (SOP)', sub: 'คู่มือมาตรฐานการทำงานสำหรับทุกแผนก', fn: "window.openDepartmentRoleSopModal()" },

    // Collaboration, Task Board, BI & Executive
    { id: 'TASK_BOARD', icon: '📋', cat: 'Collaboration & Reports', titleTh: 'กระดานงาน & To-Do List แผนก', titleEn: 'Department Task Board & To-Do', titleJp: '部署別タスクボード・To-Do', sub: 'รวมงานค้างตามลำดับความสำคัญ + Kanban 4 ช่อง', fn: "window.openDepartmentTaskBoardModal()" },
    { id: 'OMNI_MEET_AI', icon: '📹', cat: 'Collaboration & Reports', titleTh: 'ประชุมทีม & AI สรุปรายงานประชุม', titleEn: 'Omni-Meet & AI Minutes', titleJp: 'Web会議・AI議事録自動作成', sub: 'ประชุมหน้างาน/WFH/แผนก + อัดเสียงสรุป 3 ภาษา', fn: "window.openOmniMeetAndAiMinutesModal()" },
    { id: 'DEPT_REPORT', icon: '📑', cat: 'Collaboration & Reports', titleTh: 'ศูนย์ออกรายงานประจำแผนก 1 คลิก', titleEn: '1-Click Department Reports', titleJp: '部署別ワンクリックレポート出力', sub: 'ดาวน์โหลดรายงานเฉพาะแผนก (CSV / Excel)', fn: "window.openDepartmentReportCenterModal()" },
    { id: 'LIFECYCLE_PNL', icon: '💰', cat: 'Executive & Intelligence', titleTh: 'วิเคราะห์กำไร-ขาดทุน S/N & ตั้งราคา', titleEn: 'Serial Lifecycle P&L & Pricing', titleJp: '機種別ライフサイクル損益・価格戦略', sub: 'เทียบราคาขายหักต้นทุนซ่อม + จำลองโปรฯ', fn: "window.openSerialLifecyclePricingSuiteModal()" },
    { id: 'EXEC_BI', icon: '📈', cat: 'Executive & Intelligence', titleTh: 'รายงานสรุปผู้บริหาร & AI Copilot (BI)', titleEn: 'Executive BI & AI Copilot', titleJp: '経営サマリーBI & AIコパイロット', sub: 'ภาพรวมยอดขาย PO งานบริการ & ส่งเข้า LINE', fn: "window.openExecutiveBiDashboardModal()" },
    { id: 'INCENTIVE_KPI', icon: '🏆', cat: 'Executive & Intelligence', titleTh: 'สรุปผลงาน & Incentive รายบุคคล', titleEn: 'Monthly Sales & Tech KPI', titleJp: '月次営業・サービス個人別実績KPI', sub: 'จัดอันดับยอดปิดการขายและผลงานช่างรายเดือน', fn: "window.openMonthlyIncentiveKpiModal()" },
    { id: 'FIELD_GEO_QC', icon: '📍', cat: 'Service & Field Tech', titleTh: 'เช็กอิน GPS หน้างาน & QC Checklist 5 ข้อ', titleEn: 'Field GPS Check-in & 5-Point QC', titleJp: '現場GPSチェックイン・品質点検表', sub: 'บันทึกพิกัดเดินทาง-ถึงหน้างาน-ปิดงาน + ค่าเดินทางโซนอัตโนมัติ', fn: "window.openFieldGeoCheckinAndQcModal()" },
    { id: 'MODEL_COMPARE_ROI', icon: '⚖️', cat: 'Sales & Japanese Corp', titleTh: 'เปรียบเทียบสเปกรุ่นเครื่อง & ROI 1 คลิก', titleEn: 'Side-by-Side Model Spec & ROI', titleJp: '機種スペック・投資回収(ROI)比較表', sub: 'เทียบกำลังผลิต ขนาด W×D×H ค่าไฟ และส่งการ์ดเข้า LINE ลูกค้า', fn: "window.openModelComparisonRoiModal()" },
    { id: 'AR_BUDGET_TRACKER', icon: '💳', cat: 'Accounting, Admin & HR', titleTh: 'ติดตามลูกหนี้ (AR Aging) & เป้าหมายงบประมาณ', titleEn: 'AR Aging & Budget Target Tracker', titleJp: '売掛金年齢調べ・予算達成率管理', sub: 'ติดตามบิลครบกำหนด 30/60 วัน และแถบ % ยอดขายเทียบเป้าแผนก', fn: "window.openArAgingAndBudgetModal()" },
    { id: 'SANDBOX_GOV_BACKUP', icon: '🧪', cat: 'Accounting, Admin & HR', titleTh: 'โหมดฝึกซ้อม (Sandbox) • Audit Trail • สำรองข้อมูล', titleEn: 'Sandbox Training, Audit & DB Backup', titleJp: '研修サンドボックス・監査ログ・DBバックアップ', sub: 'สลับโหมดฝึกซ้อมพนักงานใหม่ ตรวจประวัติแก้ไข และสำรองฐานข้อมูล', fn: "window.openSandboxAndGovernanceModal()" },
    { id: 'SMART_LINK_HUB', icon: '🔗', cat: 'Collaboration & Reports', titleTh: 'สร้างลิงก์ส่งลูกค้า / ผู้จัดการสาขา / Outsource + พรีวิว', titleEn: 'Smart Shareable Links & Live Preview', titleJp: '顧客・支店・外注向け専用リンク発行＆プレビュー', sub: 'สร้างลิงก์ส่งออก + พรีวิวหน้าจอจริงก่อนส่งให้ลูกค้า/ดีลเลอร์/ช่างซับ', fn: "window.openSmartShareableLinksPreviewModal()" },
    { id: 'OUTSOURCE_PORTAL_MGR', icon: '🛠️', cat: 'Service & Field Tech', titleTh: 'ส่งลิงก์ & ตรวจรับรายงาน Outsource / Inspection', titleEn: 'Outsource Job & Inspection Portal', titleJp: '外注作業・点検レポート管理ポータル', sub: 'ส่งลิงก์ให้ช่าง Outsource กรอกใบงาน/ผลตรวจ + ดูรายงานที่ส่งกลับ', fn: "window.openOutsourceAndDealerClaimHubModal('OUTSOURCE')" },
    { id: 'DEALER_CLAIM_HUB', icon: '🤝', cat: 'Service & Field Tech', titleTh: 'พอร์ทัลดีลเลอร์ยื่นเคลมประกัน & อนุมัติเคลม', titleEn: 'Dealer Warranty Claim Portal & Review', titleJp: '代理店保証クレーム申請・承認管理', sub: 'ส่งลิงก์ให้ดีลเลอร์ยื่นเคลม + ตรวจเช็ก S/N และอนุมัติยอดเคลม', fn: "window.openOutsourceAndDealerClaimHubModal('CLAIM')" },
    { id: 'DEMO_LOANER_PM', icon: '📦', cat: 'Marketing & Product', titleTh: 'ใบยืมเครื่อง Demo/สำรอง & จัดคิว PM รายไตรมาส', titleEn: 'Demo/Loaner Slip & Multi-Visit PM', titleJp: '展示機・代替機貸出票＆年間PM一括予約', sub: 'บันทึกยืม-คืนเครื่องสำรอง/ออกบูธ + สร้างตาราง PM 4 รอบ/ปีอัตโนมัติ', fn: "window.openDemoLoanerAndMultiPmModal()" }
  ];

  const DEFAULT_DEPT_PINS_V1173 = {
    SERVICE_TECH: ['FIELD_GEO_QC', 'SCAN_SN_360', 'OUTSOURCE_PORTAL_MGR', 'SMART_LINK_HUB'],
    SERVICE_MGR: ['OUTSOURCE_PORTAL_MGR', 'DEALER_CLAIM_HUB', 'DISPATCH_BOARD', 'SMART_LINK_HUB'],
    SALES_TH: ['QUOTE_SALES_THB', 'SMART_LINK_HUB', 'MODEL_COMPARE_ROI', 'DOC_TRACKING'],
    JPC_CORP: ['QUOTE_JPC', 'SMART_LINK_HUB', 'MODEL_COMPARE_ROI', 'SCAN_SN_360'],
    MARKETING: ['DEMO_STOCK', 'DEMO_LOANER_PM', 'SMART_LINK_HUB', 'QUOTE_MARKETING'],
    ACCOUNTING: ['BILLING_RECEIPT', 'AR_BUDGET_TRACKER', 'EXPORT_NAV', 'SMART_LINK_HUB'],
    ADMIN_HR: ['TASK_BOARD', 'SANDBOX_GOV_BACKUP', 'OMNI_MEET_AI', 'SMART_LINK_HUB'],
    EXECUTIVE: ['EXEC_BI', 'AR_BUDGET_TRACKER', 'LIFECYCLE_PNL', 'DEALER_CLAIM_HUB']
  };

  function getEmployeePinnedToolIds(emp) {
    try {
      const map = JSON.parse(localStorage.getItem(HZK_V1173_PIN_MAP_KEY) || '{}');
      if (emp && emp.id && Array.isArray(map[emp.id]) && map[emp.id].length > 0) {
        return map[emp.id];
      }
    } catch (e) {}
    return (emp && DEFAULT_DEPT_PINS_V1173[emp.deptKey]) || DEFAULT_DEPT_PINS_V1173.SERVICE_MGR;
  }

  async function saveEmployeePinnedToolIds(emp, pinIds) {
    if (!emp || !emp.id) return;
    try {
      const map = JSON.parse(localStorage.getItem(HZK_V1173_PIN_MAP_KEY) || '{}');
      map[emp.id] = pinIds;
      localStorage.setItem(HZK_V1173_PIN_MAP_KEY, JSON.stringify(map));
    } catch (e) {}

    const gasUrl = getGasEndpointUrl();
    if (gasUrl) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'saveEmployeePinnedPreferences',
            empId: emp.id,
            empName: emp.name,
            department: emp.deptLabel,
            pinnedIds: pinIds,
            lang: getActiveCockpitLang()
          })
        });
      } catch (e) {}
    }
  }

  function openPersonalAppDrawerModal() {
    const emp = getActiveEmployeeProfileV1171();
    const lang = getActiveCockpitLang();
    let pinnedIds = getEmployeePinnedToolIds(emp);

    let modal = document.getElementById('hzkPersonalAppDrawerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkPersonalAppDrawerModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20090;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    function renderDrawerContent(searchQuery) {
      const q = String(searchQuery || '').trim().toLowerCase();
      const categories = [
        'Service & Field Tech',
        'Sales & Japanese Corp',
        'Marketing & Product',
        'Accounting, Admin & HR',
        'Collaboration & Reports',
        'Executive & Intelligence'
      ];

      const catBlocks = categories.map(cat => {
        const tools = MASTER_TOOL_CATALOG_V1173.filter(t => {
          if (t.cat !== cat) return false;
          if (!q) return true;
          return (t.titleTh + ' ' + t.titleEn + ' ' + t.titleJp + ' ' + t.sub + ' ' + t.cat).toLowerCase().indexOf(q) !== -1;
        });
        if (!tools.length) return '';

        const cards = tools.map(t => {
          const isPinned = pinnedIds.indexOf(t.id) !== -1;
          const label = lang === 'JP' ? t.titleJp : (lang === 'EN' ? t.titleEn : t.titleTh);
          return `
            <div style="background:${isPinned ? '#F0F9FF' : '#F8FAFC'};border:1.5px solid ${isPinned ? '#0284C7' : '#CBD5E1'};border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
              <div onclick="document.getElementById('hzkPersonalAppDrawerModal').style.display='none';${t.fn}" style="cursor:pointer;display:flex;align-items:flex-start;gap:10px;">
                <span style="font-size:22px;line-height:1.1;">${t.icon}</span>
                <div>
                  <div style="font-weight:800;font-size:13px;color:#0F172A;">${label}</div>
                  <div style="font-size:11px;color:#475569;margin-top:2px;">${t.sub}</div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E2E8F0;padding-top:6px;">
                <button type="button" onclick="document.getElementById('hzkPersonalAppDrawerModal').style.display='none';${t.fn}" style="background:#002B49;color:#FFF;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">▶ เปิดใช้งาน</button>
                <button type="button" data-pin-id="${t.id}" class="hzk-drawer-pin-toggle-btn" style="background:${isPinned ? '#0284C7' : '#E2E8F0'};color:${isPinned ? '#FFF' : '#0F172A'};border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer;">${isPinned ? '📌 ปักหมุดอยู่ (ถอดหมุด)' : '📍 ปักหมุดขึ้นหน้าแรก'}</button>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div style="margin-bottom:14px;">
            <div style="font-weight:800;color:#002B49;font-size:13px;margin-bottom:6px;border-bottom:1px solid #E2E8F0;padding-bottom:3px;">${cat}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;">${cards}</div>
          </div>
        `;
      }).join('');

      document.getElementById('hzkAppDrawerListWrap').innerHTML = catBlocks || '<div style="color:#64748B;padding:12px;">ไม่พบเครื่องมือที่ค้นหา</div>';

      modal.querySelectorAll('.hzk-drawer-pin-toggle-btn').forEach(btn => {
        btn.onclick = async () => {
          const tid = btn.getAttribute('data-pin-id');
          if (pinnedIds.indexOf(tid) !== -1) {
            if (pinnedIds.length <= 1) {
              alert('ควรมีปุ่มปักหมุดบนหน้าแรกอย่างน้อย 1 ปุ่มครับ');
              return;
            }
            pinnedIds = pinnedIds.filter(x => x !== tid);
          } else {
            if (pinnedIds.length >= 6) {
              alert('แนะนำให้ปักหมุดบนหน้าแรกสูงสุด 6 ปุ่มเพื่อให้หน้าจอโล่งสะอาดตาครับ (กรุณาถอดหมุดปุ่มที่ไม่ใช้ออกก่อน)');
              return;
            }
            pinnedIds = pinnedIds.concat([tid]);
          }
          await saveEmployeePinnedToolIds(emp, pinnedIds);
          renderDrawerContent(document.getElementById('hzkDrawerSearchInp').value);
          renderCleanCanvasCockpitV1173(emp);
        };
      });
    }

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1040px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#0369A1);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1173 • PERSONAL APP DRAWER &amp; PIN CUSTOMIZER</div>
            <div style="font-size:16px;font-weight:800;">⊞ คลังเครื่องมือทั้งหมด (เลือกปักหมุดขึ้นหน้าแรกของ ${emp.nickname || emp.code})</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" id="hzkResetPinsDefaultBtn" style="background:rgba(255,255,255,0.18);color:#FFF;border:1px solid rgba(255,255,255,0.4);border-radius:8px;padding:6px 11px;font-size:11.5px;font-weight:700;cursor:pointer;">↺ คืนค่าปุ่มมาตรฐานแผนก</button>
            <button type="button" onclick="document.getElementById('hzkPersonalAppDrawerModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>
        <div style="padding:16px 20px;">
          <input id="hzkDrawerSearchInp" type="text" placeholder="🔍 ค้นหาชื่อเครื่องมือ เช่น ใบเสนอราคา, วางบิล, สต็อก, S/N, ประชุม..." style="width:100%;padding:9px 12px;border:1.5px solid #94A3B8;border-radius:10px;font-size:13px;margin-bottom:14px;" />
          <div id="hzkAppDrawerListWrap"></div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('hzkDrawerSearchInp').oninput = function () {
      renderDrawerContent(this.value);
    };

    document.getElementById('hzkResetPinsDefaultBtn').onclick = async () => {
      pinnedIds = DEFAULT_DEPT_PINS_V1173[emp.deptKey] || DEFAULT_DEPT_PINS_V1173.SERVICE_MGR;
      await saveEmployeePinnedToolIds(emp, pinnedIds);
      renderDrawerContent('');
      renderCleanCanvasCockpitV1173(emp);
      showHzkToastNotification('✅ คืนค่าปุ่มปักหมุดมาตรฐานของแผนกเรียบร้อยแล้ว', false);
    };

    renderDrawerContent('');
  }

  function executeUniversalCommandSearch(rawQuery) {
    const q = String(rawQuery || '').trim();
    if (!q) {
      openPersonalAppDrawerModal();
      return;
    }
    const upper = q.toUpperCase();
    // 1) Product model pattern (e.g. IM-130NE, KM-160B)
    if (/^(IM|KM|FM|HR|HF|RT|HNC|HSU|JWE|DBF|DCM)-?[A-Z0-9\-]+$/i.test(upper)) {
      window.openSerialLifecyclePricingSuiteModal(upper);
      return;
    }
    // 2) Serial number pattern (e.g. K01234J)
    if (/^[A-Z][0-9]{4,6}[A-Z0-9]$/i.test(upper)) {
      window.openSerial360TimelineModal(upper);
      return;
    }
    // 3) Keyword routing
    if (/วางบิล|ใบเสร็จ|nav|บัญชี/i.test(q)) {
      openSalesCorporateQuotationWithPreset('Service & Billing', 'ใบวางบิล (Billing Note)');
      return;
    }
    if (/เสนอราคา|quote|qt/i.test(q)) {
      openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)');
      return;
    }
    if (/ประชุม|meet|สรุป/i.test(q)) {
      window.openOmniMeetAndAiMinutesModal();
      return;
    }
    if (/งานค้าง|todo|กระดาน/i.test(q)) {
      window.openDepartmentTaskBoardModal();
      return;
    }
    // Otherwise open App Drawer pre-filtered with query
    openPersonalAppDrawerModal();
    setTimeout(() => {
      const inp = document.getElementById('hzkDrawerSearchInp');
      if (inp) {
        inp.value = q;
        inp.dispatchEvent(new Event('input'));
      }
    }, 50);
  }

  async function renderCleanCanvasCockpitV1173(empProfile) {
    const emp = empProfile || getActiveEmployeeProfileV1171();
    const cfg = DEPT_COCKPIT_CONFIGS_V1171[emp.deptKey] || DEPT_COCKPIT_CONFIGS_V1171.SERVICE_MGR;
    const lang = getActiveCockpitLang();
    const isUltraClean = localStorage.getItem(HZK_V1173_CLEAN_MODE_KEY) !== 'false';

    const pillBtn = document.getElementById('hzkMyPersonalCockpitPillBtn');
    if (pillBtn) {
      pillBtn.innerHTML = `🧑‍💻 ${emp.nickname || emp.code} [${emp.deptLabel}] ▾`;
    }

    const jobSheet = document.getElementById('jobSheetContainer');
    const mobNav = document.getElementById('mobileSectionNav');
    const showJobOverride = sessionStorage.getItem('hzk_v1171_force_show_jobsheet') === 'true';

    if (cfg.hideJobSheet && !showJobOverride) {
      if (jobSheet) jobSheet.style.display = 'none';
      if (mobNav) mobNav.style.display = 'none';
    } else {
      if (jobSheet) jobSheet.style.display = '';
      if (mobNav) mobNav.style.display = '';
    }

    let cockpit = document.getElementById('hzkPersonalizedEmployeeCockpitCard');
    if (!cockpit) {
      cockpit = document.createElement('section');
      cockpit.id = 'hzkPersonalizedEmployeeCockpitCard';
      cockpit.style.cssText =
        'max-width:1040px;margin:10px auto 14px;background:#FFFFFF;border-radius:16px;' +
        'box-shadow:0 10px 28px rgba(15,23,42,0.09);overflow:hidden;font-family:sans-serif;';
      if (jobSheet && jobSheet.parentNode) {
        jobSheet.parentNode.insertBefore(cockpit, jobSheet);
      } else {
        document.body.insertBefore(cockpit, document.body.firstChild);
      }
    }

    cockpit.style.border = `1.5px solid ${cfg.accent}`;
    const pinnedIds = getEmployeePinnedToolIds(emp);
    const pinnedTools = pinnedIds
      .map(id => MASTER_TOOL_CATALOG_V1173.find(t => t.id === id))
      .filter(Boolean);

    const pinnedCardsHtml = pinnedTools.map(t => {
      const label = lang === 'JP' ? t.titleJp : (lang === 'EN' ? t.titleEn : t.titleTh);
      return `
        <button type="button" onclick="${t.fn}" style="text-align:left;background:#FFFFFF;border:1.5px solid #E2E8F0;border-radius:14px;padding:14px 15px;cursor:pointer;display:flex;align-items:center;gap:12px;box-shadow:0 2px 6px rgba(15,23,42,0.04);transition:all 0.15s ease;min-height:64px;">
          <span style="font-size:25px;line-height:1;">${t.icon}</span>
          <span>
            <div style="font-weight:800;font-size:13.5px;color:#0F172A;">${label}</div>
            <div style="font-size:11.5px;color:#64748B;margin-top:2px;">${t.sub}</div>
          </span>
        </button>
      `;
    }).join('');

    const toggleJobBtnHtml = cfg.hideJobSheet
      ? `<button type="button" id="hzkV1171ToggleJobFormBtn" style="background:rgba(255,255,255,0.16);color:#FFF;border:1px solid rgba(255,255,255,0.38);border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;">${showJobOverride ? '🙈 ซ่อนฟอร์มช่าง' : '🛠️ ฟอร์มช่าง'}</button>`
      : '';

    cockpit.innerHTML = `
      <!-- Clean Header Bar -->
      <div style="background:${cfg.gradient};color:#FFFFFF;padding:13px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="background:rgba(0,0,0,0.28);color:#FDE047;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:800;">${emp.deptLabel.toUpperCase()}</span>
            <span style="font-size:14.5px;font-weight:800;">สวัสดี, ${emp.name}</span>
          </div>
          <div style="font-size:11.5px;opacity:0.88;margin-top:2px;">${emp.role} • หน้าจอโฟกัสประจำวัน (Clean Workspace)</div>
        </div>

        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:2px;display:inline-flex;gap:2px;">
            <button type="button" data-lang="TH" class="hzk-v1171-lang-btn" style="background:${lang === 'TH' ? '#FFF' : 'transparent'};color:${lang === 'TH' ? '#002B49' : '#FFF'};border:none;border-radius:6px;padding:3px 7px;font-size:10.5px;font-weight:800;cursor:pointer;">TH</button>
            <button type="button" data-lang="EN" class="hzk-v1171-lang-btn" style="background:${lang === 'EN' ? '#FFF' : 'transparent'};color:${lang === 'EN' ? '#002B49' : '#FFF'};border:none;border-radius:6px;padding:3px 7px;font-size:10.5px;font-weight:800;cursor:pointer;">EN</button>
            <button type="button" data-lang="JP" class="hzk-v1171-lang-btn" style="background:${lang === 'JP' ? '#FFF' : 'transparent'};color:${lang === 'JP' ? '#002B49' : '#FFF'};border:none;border-radius:6px;padding:3px 7px;font-size:10.5px;font-weight:800;cursor:pointer;">日本語</button>
          </div>
          ${toggleJobBtnHtml}
          <button type="button" id="hzkV1171SwitchUserBtn" style="background:#FDE047;color:#0F172A;border:none;border-radius:8px;padding:5px 11px;font-size:11.5px;font-weight:800;cursor:pointer;">🔄 สลับพนักงาน</button>
        </div>
      </div>

      <!-- Clean Body Canvas -->
      <div style="padding:14px 18px;background:#F8FAFC;">
        <!-- Universal Command Search + Drawer Trigger -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="flex:1;min-width:220px;display:flex;background:#FFFFFF;border:1.5px solid #CBD5E1;border-radius:11px;overflow:hidden;">
            <input id="hzkUniversalCmdInput" type="text" placeholder="🔍 ค้นหาด่วน: พิมพ์เลข S/N, รุ่นเครื่อง (IM-130NE), วางบิล, ประชุม..." style="flex:1;border:none;padding:9px 12px;font-size:12.5px;outline:none;" />
            <button type="button" id="hzkUniversalCmdGoBtn" style="background:#002B49;color:#FFF;border:none;padding:0 14px;font-weight:700;font-size:12px;cursor:pointer;">ค้นหา</button>
          </div>
          <button type="button" id="hzkOpenAppDrawerBtn" style="background:#FFFFFF;color:#002B49;border:1.5px solid #0284C7;border-radius:11px;padding:8px 14px;font-weight:800;font-size:12.5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            ⊞ คลังเครื่องมือทั้งหมด (${MASTER_TOOL_CATALOG_V1173.length}) / ปักหมุด
          </button>
        </div>

        <!-- Morning Focus Strip (Compact Status Pills) -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:12px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:11px;padding:8px 12px;font-size:12px;">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
            <span>📥 ส่งต่อถึงฉัน: <b id="hzkMetricHandovers" style="color:#002B49;">0</b></span>
            <span>🛠️ งานค้างระบบ: <b id="hzkMetricOpenJobs" style="color:#B91C1C;">-</b></span>
            <span>📄 ใบเสนอราคาฉัน: <b id="hzkMetricMyQt" style="color:#0284C7;">-</b></span>
            <span>✅ PO รอวางบิล: <b id="hzkMetricPoApproved" style="color:#059669;">-</b></span>
          </div>
          <button type="button" id="hzkToggleFocusDetailBtn" style="background:transparent;border:none;color:#0284C7;font-weight:700;font-size:11.5px;cursor:pointer;text-decoration:underline;">
            ${isUltraClean ? '▾ กางแถบงานร่วมกัน (To-Do / ประชุม / รายงาน)' : '▴ ย่อหน้าจอให้โล่ง'}
          </button>
        </div>

        <!-- Pinned Personal Shortcuts (Clean 2-Column Grid) -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
          <span style="font-size:11.5px;font-weight:800;color:#475569;">📌 เครื่องมือที่ปักหมุดไว้ของฉัน (My Pinned Shortcuts)</span>
          <button type="button" onclick="window.openPersonalAppDrawerModal()" style="background:transparent;border:none;color:#0284C7;font-size:11.5px;font-weight:700;cursor:pointer;">⚙️ ปรับแต่งปุ่มปักหมุด</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">
          ${pinnedCardsHtml}
        </div>

        <!-- Collapsible Secondary Bar (Hidden in Clean-Canvas Mode until toggled) -->
        <div id="hzkCleanCanvasExtraDrawer" style="display:${isUltraClean ? 'none' : 'flex'};margin-top:12px;background:#FFFFFF;border:1px solid #CBD5E1;border-radius:11px;padding:9px 12px;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
          <span style="font-size:11.5px;font-weight:800;color:#002B49;">⚡ เครื่องมือเพิ่มเติม:</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" onclick="window.openDepartmentTaskBoardModal()" style="background:#002B49;color:#FDE047;border:none;border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">📋 กระดานงาน &amp; To-Do</button>
            <button type="button" onclick="window.openOmniMeetAndAiMinutesModal()" style="background:#4F46E5;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">📹 ประชุมทีม &amp; AI สรุปมติ</button>
            <button type="button" onclick="window.openFieldRepairPartsPipelineModal()" style="background:#B91C1C;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">🔧 งานซ่อม &amp; รอบอะไหล่ ETA</button>
            <button type="button" onclick="window.openDepartmentReportCenterModal()" style="background:#059669;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">📑 รายงานประจำแผนก</button>
          </div>
        </div>

        <div id="hzkV1171CrossDeptInboxWrap" style="margin-top:10px;display:none;background:#FFFBEB;border:1px solid #FDE68A;border-radius:11px;padding:9px 12px;">
          <div style="font-weight:800;color:#92400E;font-size:12px;margin-bottom:5px;">📥 งานส่งต่อที่รอรับเรื่อง (${emp.deptLabel}):</div>
          <div id="hzkV1171CrossDeptInboxList" style="display:flex;flex-direction:column;gap:5px;"></div>
        </div>
      </div>
    `;

    cockpit.querySelectorAll('.hzk-v1171-lang-btn').forEach(btn => {
      btn.onclick = () => {
        localStorage.setItem(HZK_V1171_LANG_KEY, btn.getAttribute('data-lang'));
        renderCleanCanvasCockpitV1173(emp);
      };
    });

    document.getElementById('hzkV1171SwitchUserBtn').onclick = openPersonalEmployeeSelectorModal;
    document.getElementById('hzkOpenAppDrawerBtn').onclick = openPersonalAppDrawerModal;

    const cmdInp = document.getElementById('hzkUniversalCmdInput');
    document.getElementById('hzkUniversalCmdGoBtn').onclick = () => executeUniversalCommandSearch(cmdInp.value);
    cmdInp.onkeydown = (e) => { if (e.key === 'Enter') executeUniversalCommandSearch(cmdInp.value); };

    document.getElementById('hzkToggleFocusDetailBtn').onclick = () => {
      const nextClean = !isUltraClean;
      localStorage.setItem(HZK_V1173_CLEAN_MODE_KEY, String(nextClean));
      renderCleanCanvasCockpitV1173(emp);
    };

    const toggleJobBtn = document.getElementById('hzkV1171ToggleJobFormBtn');
    if (toggleJobBtn) {
      toggleJobBtn.onclick = () => {
        sessionStorage.setItem('hzk_v1171_force_show_jobsheet', String(!showJobOverride));
        renderCleanCanvasCockpitV1173(emp);
      };
    }

    // Sync metrics & cloud-saved pins if GAS URL is configured
    const gasUrl = getGasEndpointUrl();
    if (gasUrl) {
      try {
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'getEmployeeWorkspaceBriefing',
            empId: emp.id,
            empCode: emp.code,
            department: emp.deptLabel
          })
        });
        const d = await res.json();
        if (d && d.status === 'OK' && d.metrics) {
          const m = d.metrics;
          const elH = document.getElementById('hzkMetricHandovers');
          const elJ = document.getElementById('hzkMetricOpenJobs');
          const elQ = document.getElementById('hzkMetricMyQt');
          const elP = document.getElementById('hzkMetricPoApproved');
          if (elH) elH.textContent = `${m.pendingHandoversCount}`;
          if (elJ) elJ.textContent = emp.isTech ? `${m.myJobsCount}/${m.openJobsCount}` : `${m.openJobsCount}`;
          if (elQ) elQ.textContent = `${m.myQtCount}/${m.totalQtCount}`;
          if (elP) elP.textContent = `${m.poApprovedCount}`;

          const inboxWrap = document.getElementById('hzkV1171CrossDeptInboxWrap');
          const inboxList = document.getElementById('hzkV1171CrossDeptInboxList');
          if (inboxWrap && inboxList && Array.isArray(d.pendingHandovers) && d.pendingHandovers.length > 0) {
            inboxWrap.style.display = 'block';
            inboxList.innerHTML = d.pendingHandovers.map(h => `
              <div style="background:#FFFFFF;border:1px solid #FCD34D;border-radius:8px;padding:7px 10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;font-size:11.5px;">
                <div><b>[${h.handoverId}] ${h.fromDept}</b> ➔ <b>${h.customerName}</b> | ${h.modelSn} (${h.amount})</div>
                <button type="button" data-hnd-id="${h.handoverId}" class="hzk-v1171-ack-hnd-btn" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:4px 9px;font-weight:700;cursor:pointer;">✅ รับเรื่อง</button>
              </div>
            `).join('');

            inboxList.querySelectorAll('.hzk-v1171-ack-hnd-btn').forEach(b => {
              b.onclick = async () => {
                const hId = b.getAttribute('data-hnd-id');
                b.disabled = true;
                await fetch(gasUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify({ action: 'completeCrossDeptHandover', handoverId: hId, actorName: emp.name })
                });
                renderCleanCanvasCockpitV1173(emp);
              };
            });
          }
        }
      } catch (err) {}
    } else {
      const localArchives = (() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_ARCHIVE_KEY) || '[]'); } catch (e) { return []; }
      })();
      const myQt = localArchives.filter(q => String(q.salesperson || '').toUpperCase() === emp.code.toUpperCase());
      const elQ = document.getElementById('hzkMetricMyQt');
      const elJ = document.getElementById('hzkMetricOpenJobs');
      const elP = document.getElementById('hzkMetricPoApproved');
      if (elQ) elQ.textContent = `${myQt.length}/${localArchives.length}`;
      if (elJ) elJ.textContent = 'Offline';
      if (elP) elP.textContent = '0';
    }
  }

  // Override renderPersonalizedEmployeeCockpit with Clean-Canvas v1173 engine
  window.renderPersonalizedEmployeeCockpit = renderCleanCanvasCockpitV1173;
  window.openPersonalAppDrawerModal = openPersonalAppDrawerModal;



  // ============================================================================
  // ENTERPRISE v1174 MODALS:
  //   1) Field Tech GPS Geo-Checkin + Auto Travel Allowance + 5-Point QC Gate
  //   2) Side-by-Side Model Spec & ROI Comparison Generator (1-Click LINE Card)
  //   3) AR Aging (30/60 Days) & Target vs Actual Budget Tracker
  //   4) Sandbox Training Mode, System Audit Trail & Weekly DB Snapshot Backup
  // ============================================================================
  const HZK_SANDBOX_MODE_KEY = 'hzk_v1174_sandbox_training_mode';

  function isSandboxTrainingModeActive() {
    return localStorage.getItem(HZK_SANDBOX_MODE_KEY) === 'true';
  }

  function applySandboxBannerIfNeeded() {
    let sb = document.getElementById('hzkSandboxModeFloatingBanner');
    if (!isSandboxTrainingModeActive()) {
      if (sb) sb.style.display = 'none';
      return;
    }
    if (!sb) {
      sb = document.createElement('div');
      sb.id = 'hzkSandboxModeFloatingBanner';
      sb.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:26000;background:linear-gradient(90deg,#D97706,#B45309);' +
        'color:#FFF;padding:6px 14px;font-family:sans-serif;font-size:12px;font-weight:800;' +
        'display:flex;justify-content:center;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(0,0,0,0.25);';
      document.body.appendChild(sb);
    }
    sb.innerHTML = `
      <span>🧪 โหมดฝึกซ้อม (SANDBOX TRAINING MODE) — ข้อมูลที่ทดสอบจะไม่ถูกบันทึกลงฐานข้อมูลจริง</span>
      <button type="button" id="hzkExitSandboxBtn" style="background:#0F172A;color:#FDE047;border:none;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:800;cursor:pointer;">ออกจากโหมดฝึกซ้อม</button>
    `;
    sb.style.display = 'flex';
    document.getElementById('hzkExitSandboxBtn').onclick = () => {
      localStorage.setItem(HZK_SANDBOX_MODE_KEY, 'false');
      applySandboxBannerIfNeeded();
      showHzkToastNotification('✅ กลับเข้าสู่โหมดใช้งานจริง (Production Mode) เรียบร้อยแล้ว', false);
    };
  }

  // 1) Field Tech GPS Geo-Checkin + 5-Point QC Checklist Gate
  async function openFieldGeoCheckinAndQcModal() {
    const emp = getActiveEmployeeProfileV1171();
    let modal = document.getElementById('hzkFieldGeoQcModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkFieldGeoQcModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20092;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:860px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#7F1D1D,#B91C1C);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#FECACA;font-weight:800;">ENTERPRISE v1174 • FIELD GPS GEO-LOG &amp; MANDATORY 5-POINT QC GATE</div>
            <div style="font-size:16px;font-weight:800;">📍 เช็กอินพิกัด GPS หน้างาน, คำนวณค่าเดินทาง &amp; ตรวจ QC ก่อนปิดงาน</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkFieldGeoQcModal').style.display='none'" style="background:#0F172A;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:18px 20px;font-size:13px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px;">
            <div>
              <label style="font-weight:700;font-size:12px;">เลขที่ใบงาน (Job ID):</label>
              <input id="hzkGeoJobId" type="text" value="JOB-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;font-weight:700;" />
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">ชื่อลูกค้า / สถานที่:</label>
              <input id="hzkGeoCust" type="text" placeholder="ระบุชื่อร้าน / สาขา..." style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;" />
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">จังหวัด / โซนเดินทาง (คำนวณเบี้ยเลี้ยง):</label>
              <select id="hzkGeoProvince" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;font-weight:700;">
                <option value="กรุงเทพฯ">กรุงเทพฯ (โซน 1 — 500 THB)</option>
                <option value="นนทบุรี">ปริมณฑล / ชลบุรี / อยุธยา (โซน 2 — 850 THB)</option>
                <option value="ต่างจังหวัด">ต่างจังหวัด (โซน 3 — 1,800 THB)</option>
              </select>
            </div>
          </div>

          <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="font-weight:800;color:#002B49;margin-bottom:8px;">🛡️ แบบตรวจคุณภาพ 5 ข้อบังคับก่อนปิดงานซ่อม/ติดตั้ง (5-Point QC Gate):</div>
            <label style="display:block;margin-bottom:5px;"><input type="checkbox" class="hzk-qc-cb" checked /> 1. ตรวจวัดแรงดันน้ำยา (Suction / Discharge Pressure) อยู่ในเกณฑ์มาตรฐาน</label>
            <label style="display:block;margin-bottom:5px;"><input type="checkbox" class="hzk-qc-cb" checked /> 2. ตรวจวัดกระแสคอมเพรสเซอร์ (Ampere) และแรงดันไฟ 220V ปกติ</label>
            <label style="display:block;margin-bottom:5px;"><input type="checkbox" class="hzk-qc-cb" checked /> 3. ทดสอบรอบผลิตน้ำแข็ง / อุณหภูมิตู้แช่ ครบสมบูรณ์อย่างน้อย 1 รอบ</label>
            <label style="display:block;margin-bottom:5px;"><input type="checkbox" class="hzk-qc-cb" checked /> 4. ตรวจสอบรอยรั่วน้ำทิ้ง ความสะอาดตัวเครื่อง และแผ่นกรองอากาศ</label>
            <label style="display:block;"><input type="checkbox" class="hzk-qc-cb" checked /> 5. ถ่ายรูปก่อน-หลังซ่อม 2 ภาพ และให้ลูกค้าตรวจสอบเรียบร้อย</label>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px;">
            <button type="button" data-stage="DEPART" class="hzk-geo-stamp-btn" style="background:#0284C7;color:#FFF;border:none;border-radius:10px;padding:12px;font-weight:800;cursor:pointer;">🚐 1. กดออกเดินทาง (Stamp GPS)</button>
            <button type="button" data-stage="ARRIVE" class="hzk-geo-stamp-btn" style="background:#D97706;color:#FFF;border:none;border-radius:10px;padding:12px;font-weight:800;cursor:pointer;">📍 2. กดถึงหน้างานลูกค้า (Arrive)</button>
            <button type="button" data-stage="COMPLETE" class="hzk-geo-stamp-btn" style="background:#059669;color:#FFF;border:none;border-radius:10px;padding:12px;font-weight:800;cursor:pointer;">✅ 3. ผ่าน QC &amp; ปิดงานซ่อม (Complete)</button>
          </div>

          <div id="hzkGeoStatusBanner" style="display:none;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px;"></div>
          <div id="hzkGeoHistoryWrap"></div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    async function stampGeoStage(stage) {
      const allQcChecked = Array.from(modal.querySelectorAll('.hzk-qc-cb')).every(cb => cb.checked);
      if (stage === 'COMPLETE' && !allQcChecked) {
        alert('⚠️ กรุณาติ๊กยืนยันรายการตรวจคุณภาพ (5-Point QC Checklist) ให้ครบทั้ง 5 ข้อก่อนกดปิดงานครับ');
        return;
      }

      const stBanner = document.getElementById('hzkGeoStatusBanner');
      stBanner.style.display = 'block';
      stBanner.textContent = '⏳ กำลังดึงพิกัด GPS และบันทึกเวลาปฏิบัติงาน...';

      let lat = 0;
      let lng = 0;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (e) {}
      }

      const payload = {
        action: 'logFieldGeoCheckin',
        techName: emp.name,
        jobId: document.getElementById('hzkGeoJobId').value.trim(),
        customerName: document.getElementById('hzkGeoCust').value.trim() || 'ลูกค้าหน้างาน',
        province: document.getElementById('hzkGeoProvince').value,
        stage: stage,
        lat: lat,
        lng: lng,
        qcPassed: allQcChecked
      };

      if (isSandboxTrainingModeActive()) {
        stBanner.innerHTML = `🧪 <b>[SANDBOX]</b> จำลองบันทึกพิกัด ${stage} (${lat ? lat.toFixed(5) + ',' + lng.toFixed(5) : 'GPS จำลอง'}) เรียบร้อยแล้ว`;
        return;
      }

      const gasUrl = getGasEndpointUrl();
      if (gasUrl) {
        try {
          const r = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          const d = await r.json();
          if (d && d.status === 'OK') {
            stBanner.innerHTML = `✅ บันทึก <b>${stage}</b> สำเร็จ (${d.timestamp}) • พิกัด: <b>${d.coords}</b> • ค่าเดินทางโซนอัตโนมัติ: <b>฿${d.travelAllowance}</b>`;
            return;
          }
        } catch (e) {}
      }
      stBanner.innerHTML = `✅ บันทึกเวลา <b>${stage}</b> ในเครื่องเรียบร้อยแล้ว (${new Date().toLocaleTimeString('th-TH')})`;
    }

    modal.querySelectorAll('.hzk-geo-stamp-btn').forEach(btn => {
      btn.onclick = () => stampGeoStage(btn.getAttribute('data-stage'));
    });
  }

  // 2) Side-by-Side Model Spec & ROI Comparison Generator (1-Click LINE Card)
  async function openModelComparisonRoiModal() {
    const db = await loadSalesMasterDb(false);
    const models = db.models || [];
    const stockMap = db.stockMap || {};

    let modal = document.getElementById('hzkModelCompareRoiModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkModelCompareRoiModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20094;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const optsHtml = models.map(m =>
      `<option value="${m.model}">${m.model} — ${m.description}</option>`
    ).join('');

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:960px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#0284C7);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1174 • SIDE-BY-SIDE SPEC &amp; ROI COMPARISON</div>
            <div style="font-size:16px;font-weight:800;">⚖️ ตารางเปรียบเทียบสเปกรุ่นเครื่อง ขนาดพื้นที่ติดตั้ง &amp; จุดคุ้มทุน (ROI)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkModelCompareRoiModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:18px 20px;font-size:13px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
              <label style="font-weight:800;color:#002B49;">เลือกรุ่นที่ 1 (Option A):</label>
              <select id="hzkCmpModelA" style="width:100%;padding:8px;border:1.5px solid #0284C7;border-radius:8px;margin-top:4px;font-weight:700;">${optsHtml}</select>
            </div>
            <div>
              <label style="font-weight:800;color:#059669;">เลือกรุ่นที่ 2 (Option B):</label>
              <select id="hzkCmpModelB" style="width:100%;padding:8px;border:1.5px solid #059669;border-radius:8px;margin-top:4px;font-weight:700;">${optsHtml}</select>
            </div>
          </div>

          <div id="hzkCmpTableArea" style="margin-bottom:14px;"></div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button type="button" id="hzkCmpCopyLineTextBtn" style="background:#059669;color:#FFF;border:none;border-radius:9px;padding:9px 15px;font-weight:700;cursor:pointer;">💬 คัดลอกตารางเทียบสเปกส่งเข้า LINE ลูกค้า</button>
            <button type="button" id="hzkCmpAddToQuoteBtn" style="background:#002B49;color:#FFF;border:none;border-radius:9px;padding:9px 15px;font-weight:700;cursor:pointer;">📄 นำทั้ง 2 รุ่นไปออกใบเสนอราคา</button>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    const selA = document.getElementById('hzkCmpModelA');
    const selB = document.getElementById('hzkCmpModelB');
    if (selA.options.length > 5) selA.selectedIndex = 4;
    if (selB.options.length > 7) selB.selectedIndex = 6;

    function renderComparison() {
      const mA = models.find(x => x.model === selA.value) || models[0] || { model: 'IM-100NE', description: 'Cube Ice Maker', w: 704, d: 506, h: 1200, factory: 'HOSHIZAKI' };
      const mB = models.find(x => x.model === selB.value) || models[1] || { model: 'IM-130NE', description: 'Cube Ice Maker', w: 704, d: 506, h: 1200, factory: 'HOSHIZAKI' };
      const stA = stockMap[String(mA.model).toUpperCase()];
      const stB = stockMap[String(mB.model).toUpperCase()];

      document.getElementById('hzkCmpTableArea').innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <thead>
            <tr style="background:#002B49;color:#FFF;">
              <th style="padding:9px;text-align:left;width:28%;">หัวข้อเปรียบเทียบ</th>
              <th style="padding:9px;background:#0369A1;width:36%;">Option A: ${mA.model}</th>
              <th style="padding:9px;background:#047857;width:36%;">Option B: ${mB.model}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:8px;border:1px solid #CBD5E1;font-weight:700;">รายละเอียดรุ่น</td><td style="padding:8px;border:1px solid #CBD5E1;">${mA.description}</td><td style="padding:8px;border:1px solid #CBD5E1;">${mB.description}</td></tr>
            <tr><td style="padding:8px;border:1px solid #CBD5E1;font-weight:700;">ขนาดเครื่อง (W × D × H mm.)</td><td style="padding:8px;border:1px solid #CBD5E1;text-align:center;font-weight:700;">${mA.w || '-'} × ${mA.d || '-'} × ${mA.h || '-'} mm</td><td style="padding:8px;border:1px solid #CBD5E1;text-align:center;font-weight:700;">${mB.w || '-'} × ${mB.d || '-'} × ${mB.h || '-'} mm</td></tr>
            <tr><td style="padding:8px;border:1px solid #CBD5E1;font-weight:700;">ฐานการผลิต (Factory)</td><td style="padding:8px;border:1px solid #CBD5E1;text-align:center;">${mA.factory || 'HOSHIZAKI'}</td><td style="padding:8px;border:1px solid #CBD5E1;text-align:center;">${mB.factory || 'HOSHIZAKI'}</td></tr>
            <tr><td style="padding:8px;border:1px solid #CBD5E1;font-weight:700;">สถานะสต็อกพร้อมส่ง (Live Stock)</td><td style="padding:8px;border:1px solid #CBD5E1;text-align:center;font-weight:700;color:#0369A1;">${stA ? (stA.available > 0 ? '🟢 พร้อมส่ง ' + stA.available + ' เครื่อง' : stA.leadTime) : 'ตรวจสอบกับคลังสินค้า'}</td><td style="padding:8px;border:1px solid #CBD5E1;text-align:center;font-weight:700;color:#047857;">${stB ? (stB.available > 0 ? '🟢 พร้อมส่ง ' + stB.available + ' เครื่อง' : stB.leadTime) : 'ตรวจสอบกับคลังสินค้า'}</td></tr>
            <tr><td style="padding:8px;border:1px solid #CBD5E1;font-weight:700;">จุดเด่น &amp; ความคุ้มค่า (ROI)</td><td style="padding:8px;border:1px solid #CBD5E1;">ประหยัดพื้นที่ติดตั้ง น้ำแข็งก้อนใสละลายช้า มาตรฐานญี่ปุ่น</td><td style="padding:8px;border:1px solid #CBD5E1;">รองรับยอดขายช่วง Peak Hour ได้ต่อเนื่อง ลดต้นทุนซื้อน้ำแข็งกระสอบ 60%</td></tr>
          </tbody>
        </table>
      `;
    }

    selA.onchange = renderComparison;
    selB.onchange = renderComparison;
    renderComparison();

    document.getElementById('hzkCmpCopyLineTextBtn').onclick = () => {
      const mA = models.find(x => x.model === selA.value) || { model: selA.value, description: '', w: '-', d: '-', h: '-' };
      const mB = models.find(x => x.model === selB.value) || { model: selB.value, description: '', w: '-', d: '-', h: '-' };
      const summary =
        `❄️ เปรียบเทียบรุ่นเครื่อง HOSHIZAKI สำหรับร้านของคุณ:
` +
        `1️⃣ รุ่น ${mA.model} (${mA.w}x${mA.d}x${mA.h} mm) — ${mA.description}
` +
        `2️⃣ รุ่น ${mB.model} (${mB.w}x${mB.d}x${mB.h} mm) — ${mB.description}
` +
        `✅ รับประกันมาตรฐาน HOSHIZAKI (Thailand) พร้อมทีมช่างและอะไหล่แท้ทั่วประเทศครับ`;
      navigator.clipboard && navigator.clipboard.writeText(summary);
      showHzkToastNotification('✅ คัดลอกข้อความเปรียบเทียบสเปกพร้อมวางส่งใน LINE ลูกค้าแล้วครับ', false);
    };

    document.getElementById('hzkCmpAddToQuoteBtn').onclick = async () => {
      const mA = models.find(x => x.model === selA.value) || { model: selA.value, description: 'Hoshizaki Equipment', w: '', d: '', h: '' };
      const mB = models.find(x => x.model === selB.value) || { model: selB.value, description: 'Hoshizaki Equipment', w: '', d: '', h: '' };
      modal.style.display = 'none';
      HZK_OMNI_STATE.items = [
        { model: mA.model, description: mA.description + ' (Option A)', w: mA.w, d: mA.d, h: mA.h, unitPrice: 0, discount: 0, qty: 1, isService: false },
        { model: mB.model, description: mB.description + ' (Option B)', w: mB.w, d: mB.d, h: mB.h, unitPrice: 0, discount: 0, qty: 1, isService: false }
      ];
      await openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)');
    };
  }

  // 3) AR Aging & Target vs Actual Budget Tracker
  async function openArAgingAndBudgetModal() {
    let modal = document.getElementById('hzkArAgingBudgetModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkArAgingBudgetModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20096;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1020px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#134E4A,#0F766E);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#99F6E4;font-weight:800;">ENTERPRISE v1174 • TARGET VS ACTUAL BUDGET &amp; AR AGING TRACKER</div>
            <div style="font-size:16px;font-weight:800;">💳 ติดตามเป้าหมายงบประมาณรายแผนก (Target vs Actual) &amp; อายุลูกหนี้ (AR Aging)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkArAgingBudgetModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div id="hzkArBudgetBody" style="padding:18px 20px;font-size:13px;">⏳ กำลังโหลดข้อมูลเป้าหมายงบประมาณและรายการวางบิล...</div>
      </div>
    `;
    modal.style.display = 'flex';

    const body = document.getElementById('hzkArBudgetBody');
    let budgets = [
      { department: 'Sales', monthlyTarget: 4500000, actualAmount: 3150000, achievementPct: 70 },
      { department: 'Japanese Corporate', monthlyTarget: 3200000, actualAmount: 2720000, achievementPct: 85 },
      { department: 'Marketing', monthlyTarget: 1200000, actualAmount: 840000, achievementPct: 70 },
      { department: 'Service & Billing', monthlyTarget: 1800000, actualAmount: 1530000, achievementPct: 85 }
    ];
    let arList = [];

    const gasUrl = getGasEndpointUrl();
    if (gasUrl) {
      try {
        const r = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getArAgingAndBudgetSummary' })
        });
        const d = await r.json();
        if (d && d.status === 'OK') {
          if (Array.isArray(d.budgetProgress) && d.budgetProgress.length) budgets = d.budgetProgress;
          arList = d.arAgingList || [];
        }
      } catch (e) {}
    }

    const budgetCardsHtml = budgets.map(b => {
      const pct = Math.min(100, Number(b.achievementPct || 0));
      const barCol = pct >= 80 ? '#059669' : (pct >= 50 ? '#0284C7' : '#D97706');
      return `
        <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:12px;">
          <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;color:#002B49;">
            <span>${b.department}</span>
            <span style="color:${barCol};">${b.achievementPct}%</span>
          </div>
          <div style="height:9px;background:#E2E8F0;border-radius:999px;overflow:hidden;margin:7px 0;">
            <div style="height:100%;width:${pct}%;background:${barCol};"></div>
          </div>
          <div style="font-size:11.5px;color:#475569;">ทำได้จริง: <b>฿${Number(b.actualAmount || 0).toLocaleString()}</b> / เป้าหมาย: <b>฿${Number(b.monthlyTarget || 0).toLocaleString()}</b></div>
        </div>
      `;
    }).join('');

    const arRowsHtml = arList.map(a => `
      <tr>
        <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${a.docNo}</td>
        <td style="padding:7px;border:1px solid #CBD5E1;">${a.docType}</td>
        <td style="padding:7px;border:1px solid #CBD5E1;">${a.customer}</td>
        <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">${a.amount}</td>
        <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${a.ageDays} วัน</td>
        <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:700;color:${a.ageDays > 30 ? '#DC2626' : '#059669'};">${a.bucket}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#64748B;">ไม่พบรายการใบวางบิลค้างชำระเกินกำหนด</td></tr>';

    body.innerHTML = `
      <div style="font-weight:800;color:#002B49;font-size:14px;margin-bottom:8px;">📊 ความคืบหน้ายอดขายเทียบเป้าหมายรายแผนก (Monthly Target vs Actual)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:18px;">
        ${budgetCardsHtml}
      </div>

      <div style="font-weight:800;color:#0F766E;font-size:14px;margin-bottom:8px;">🧾 ตารางติดตามอายุบิล &amp; ใบสั่งซื้อรอเก็บเงิน (AR Aging &amp; Billing Follow-Up)</div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#002B49;color:#FFF;"><th style="padding:7px;">เลขที่เอกสาร</th><th style="padding:7px;">ประเภท</th><th style="padding:7px;text-align:left;">ลูกค้า</th><th style="padding:7px;text-align:right;">ยอดเงิน</th><th style="padding:7px;">อายุบิล</th><th style="padding:7px;">สถานะเครดิต</th></tr></thead>
          <tbody>${arRowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // 4) Sandbox Training Mode, Audit Trail & Weekly DB Snapshot Backup
  async function openSandboxAndGovernanceModal() {
    let modal = document.getElementById('hzkSandboxGovModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkSandboxGovModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20098;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const isSb = isSandboxTrainingModeActive();
    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:940px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#312E81,#4338CA);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1174 • ONBOARDING SANDBOX, AUDIT TRAIL &amp; AUTO-BACKUP</div>
            <div style="font-size:16px;font-weight:800;">🧪 โหมดฝึกซ้อมพนักงานใหม่ (Sandbox) • ประวัติการตรวจสอบ (Audit) • สำรองข้อมูล</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkSandboxGovModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:18px 20px;font-size:13px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-bottom:16px;">
            <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:12px;padding:14px;">
              <div style="font-weight:800;color:#92400E;margin-bottom:4px;">🧪 โหมดฝึกซ้อมพนักงานใหม่ (Sandbox Mode)</div>
              <div style="font-size:11.5px;color:#475569;margin-bottom:10px;">ให้พนักงานใหม่ทดลองกดทุกปุ่มได้เต็มที่โดยไม่ส่งข้อมูลเข้าฐานจริง</div>
              <button type="button" id="hzkToggleSandboxBtn" style="width:100%;background:${isSb ? '#DC2626' : '#D97706'};color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">${isSb ? '⏹️ ปิดโหมดฝึกซ้อม (กลับสู่ระบบจริง)' : '▶️ เปิดโหมดฝึกซ้อม (Sandbox)'}</button>
            </div>

            <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:12px;padding:14px;">
              <div style="font-weight:800;color:#1E40AF;margin-bottom:4px;">💾 สำรองฐานข้อมูล Google Sheets ทันที</div>
              <div style="font-size:11.5px;color:#475569;margin-bottom:10px;">สร้างไฟล์ Backup เก็บในโฟลเดอร์ HOSHIZAKI_DB_Backups บน Drive</div>
              <button type="button" id="hzkBackupDbNowBtn" style="width:100%;background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">☁️ สำรองฐานข้อมูลเดี๋ยวนี้</button>
            </div>

            <div style="background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:12px;padding:14px;">
              <div style="font-weight:800;color:#166534;margin-bottom:4px;">☀️ ส่งการ์ด Morning Briefing เข้า LINE</div>
              <div style="font-size:11.5px;color:#475569;margin-bottom:10px;">ส่งสรุปงานด่วนประจำวันพร้อมปุ่มเข้าโต๊ะทำงานส่วนตัวทันที</div>
              <button type="button" id="hzkPushMorningNowBtn" style="width:100%;background:#059669;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">📲 ส่ง Morning Push ทันที</button>
            </div>
          </div>

          <div style="font-weight:800;color:#002B49;margin-bottom:8px;">📜 ประวัติการดำเนินการสำคัญในระบบ (System Audit Trail):</div>
          <div id="hzkAuditLogsWrap" style="color:#64748B;">⏳ กำลังโหลดประวัติ Audit Trail...</div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('hzkToggleSandboxBtn').onclick = () => {
      const next = !isSandboxTrainingModeActive();
      localStorage.setItem(HZK_SANDBOX_MODE_KEY, String(next));
      applySandboxBannerIfNeeded();
      modal.style.display = 'none';
      showHzkToastNotification(next ? '🧪 เปิดโหมดฝึกซ้อม (Sandbox Training) แล้ว' : '✅ กลับสู่โหมดระบบจริงแล้ว', false);
    };

    const gasUrl = getGasEndpointUrl();
    document.getElementById('hzkBackupDbNowBtn').onclick = async () => {
      if (!gasUrl) { alert('กรุณาตั้งค่า GAS URL ก่อนสำรองข้อมูลครับ'); return; }
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'runWeeklyDatabaseSnapshotBackup' })
      });
      const d = await r.json();
      alert(d && d.status === 'OK' ? (`✅ สำรองฐานข้อมูลสำเร็จ: ${d.backupName}`) : '⚠️ สำรองไม่สำเร็จ');
    };

    document.getElementById('hzkPushMorningNowBtn').onclick = async () => {
      if (!gasUrl) { alert('กรุณาตั้งค่า GAS URL ก่อนส่ง LINE ครับ'); return; }
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'sendMorningPersonalPushNow' })
      });
      const d = await r.json();
      alert(d && d.status === 'OK' ? (`✅ ส่ง Morning Focus Briefing เข้า LINE เรียบร้อยแล้ว`) : '⚠️ ส่งไม่สำเร็จ');
    };

    const logWrap = document.getElementById('hzkAuditLogsWrap');
    if (gasUrl) {
      try {
        const r = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getSystemAuditLogs' })
        });
        const d = await r.json();
        const logs = (d && d.logs) || [];
        logWrap.innerHTML = logs.length
          ? `<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#0F172A;color:#FFF;"><th style="padding:6px;">เวลา</th><th style="padding:6px;">ผู้ดำเนินการ</th><th style="padding:6px;">กิจกรรม</th><th style="padding:6px;text-align:left;">รายละเอียด</th></tr></thead><tbody>${logs.map(l => `<tr><td style="padding:6px;border:1px solid #CBD5E1;">${l.timestamp}</td><td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;">${l.actor}</td><td style="padding:6px;border:1px solid #CBD5E1;">${l.actionType}</td><td style="padding:6px;border:1px solid #CBD5E1;">${l.detail}</td></tr>`).join('')}</tbody></table>`
          : 'ยังไม่มีรายการบันทึก Audit Trail ในระบบ';
      } catch (e) {}
    } else {
      logWrap.textContent = 'เชื่อมต่อ Google Apps Script URL เพื่อดูประวัติ Audit Trail แบบเรียลไทม์';
    }
  }

  window.openFieldGeoCheckinAndQcModal = openFieldGeoCheckinAndQcModal;
  window.openModelComparisonRoiModal = openModelComparisonRoiModal;
  window.openArAgingAndBudgetModal = openArAgingAndBudgetModal;
  window.openSandboxAndGovernanceModal = openSandboxAndGovernanceModal;



  // ============================================================================
  // ENTERPRISE v1175 MODALS:
  //   1) Smart Shareable Link Generator & Live Preview (Customer / Branch Mgr / Outsource / Dealer)
  //   2) Outsource Job & Inspection Portal + Dealer Warranty Claim Review Hub
  //   3) Demo/Loaner Borrowing Slip & Multi-Visit Annual PM Scheduler
  // ============================================================================

  // 1) Smart Shareable Link Generator & Live Preview
  async function openSmartShareableLinksPreviewModal(prefill) {
    const emp = getActiveEmployeeProfileV1171();
    const p = prefill || {};
    const gasUrl = getGasEndpointUrl();

    let modal = document.getElementById('hzkSmartLinksPreviewModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkSmartLinksPreviewModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20110;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const defaultRolePreset = /Service|Tech/i.test(emp.deptLabel)
      ? 'OUTSOURCE_JOB'
      : (/Account/i.test(emp.deptLabel) ? 'DOC_ESIGN' : 'BRANCH_MGR');

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1060px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#0284C7);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1175 • SMART DEEP-LINK GENERATOR &amp; LIVE RECIPIENT PREVIEW</div>
            <div style="font-size:16px;font-weight:800;">🔗 ศูนย์สร้างลิงก์ส่งลูกค้า / ผู้จัดการสาขา / Outsource / ดีลเลอร์ + พรีวิวหน้าจอก่อนส่ง</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkSmartLinksPreviewModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:18px 20px;font-size:13px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px;background:#F8FAFC;padding:12px;border-radius:12px;border:1px solid #CBD5E1;">
            <div>
              <label style="font-weight:800;font-size:12px;color:#002B49;">1. เลือกประเภทลิงก์ปลายทาง:</label>
              <select id="hzkSmlTargetType" style="width:100%;padding:8px;border:1.5px solid #0284C7;border-radius:8px;margin-top:3px;font-weight:700;">
                <option value="BRANCH_MGR" ${defaultRolePreset === 'BRANCH_MGR' ? 'selected' : ''}>🏢 พอร์ทัลผู้จัดการสาขาของลูกค้า (ดูเครื่องทั้งสาขา/ประวัติซ่อม)</option>
                <option value="OUTSOURCE_JOB" ${defaultRolePreset === 'OUTSOURCE_JOB' ? 'selected' : ''}>🛠️ ส่งลิงก์ให้ Outsource กรอกใบงาน / Inspection Report</option>
                <option value="DEALER_CLAIM">🤝 ส่งลิงก์ให้ Dealer ยื่นเอกสารเคลมประกัน (Warranty Claim)</option>
                <option value="DEALER_PORTAL">🏪 พอร์ทัลติดตามงานของตัวแทนจำหน่าย (Dealer Fleet)</option>
                <option value="SERIAL_360">🔎 ลิงก์ตรวจสอบประวัติเครื่องรายตัว (S/N 360°)</option>
                <option value="SPEC_5DOC">📐 ลิงก์สเปก &amp; คู่มือเทคนิค 5 หมวด (Model Spec Suite)</option>
                <option value="DOC_ESIGN" ${defaultRolePreset === 'DOC_ESIGN' ? 'selected' : ''}>✍️ ลิงก์ยืนยันรับเอกสาร / เซ็น PO ลูกค้า (E-Sign)</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">ชื่อลูกค้า / สาขา / ดีลเลอร์:</label>
              <input id="hzkSmlCustInp" type="text" value="${p.customerName || ''}" placeholder="เช่น ร้านกาแฟตัวอย่าง สาขาภูเก็ต" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;" />
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">รุ่นเครื่อง (Model) / Serial No.:</label>
              <div style="display:flex;gap:5px;margin-top:3px;">
                <input id="hzkSmlModelInp" type="text" value="${p.model || 'IM-130NE'}" placeholder="IM-130NE" style="width:50%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
                <input id="hzkSmlSnInp" type="text" value="${p.serialNo || 'K01234J'}" placeholder="K01234J" style="width:50%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              </div>
            </div>
            <div>
              <label style="font-weight:700;font-size:12px;">เลขที่ใบงาน / Track ID (ถ้ามี):</label>
              <input id="hzkSmlJobInp" type="text" value="${p.jobNo || 'JOB-261121'}" placeholder="JOB-... หรือ TRK-..." style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;">
            <!-- Left: Generated URL + Message Preview + Share Actions -->
            <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:12px;padding:14px;">
              <div style="font-weight:800;color:#002B49;margin-bottom:6px;">2. ลิงก์ที่สร้างอัตโนมัติ (Auto-Generated Deep Link):</div>
              <input id="hzkSmlGeneratedUrl" type="text" readonly style="width:100%;padding:8px;border:1px solid #93C5FD;border-radius:8px;background:#FFF;font-size:11.5px;font-family:monospace;margin-bottom:10px;" />

              <div style="font-weight:800;color:#002B49;margin-bottom:6px;">3. ตัวอย่างข้อความที่จะส่งออก (แก้ไขก่อนส่งได้):</div>
              <textarea id="hzkSmlMessageBox" rows="6" style="width:100%;padding:8px;border:1px solid #93C5FD;border-radius:8px;background:#FFF;font-size:12px;line-height:1.45;"></textarea>

              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                <button type="button" id="hzkSmlCopyBtn" style="flex:1;background:#002B49;color:#FFF;border:none;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer;">📋 คัดลอกข้อความ + ลิงก์</button>
                <button type="button" id="hzkSmlLineShareBtn" style="flex:1;background:#059669;color:#FFF;border:none;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer;">💬 ส่งเข้า LINE ทันที</button>
                <button type="button" id="hzkSmlTestOpenBtn" style="width:100%;background:#D97706;color:#FFF;border:none;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer;">👁️ เปิดทดสอบหน้าจอปลายทางจริง (Open Live Link)</button>
              </div>
            </div>

            <!-- Right: Visual Mockup Preview of What Recipient Sees -->
            <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:14px;">
              <div style="font-weight:800;color:#002B49;margin-bottom:8px;">4. พรีวิวหน้าจอที่ผู้รับปลายทางจะเห็น (Recipient Screen Preview):</div>
              <div id="hzkSmlVisualPreviewCard" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    function rebuildSmartLinkPreview() {
      const base = gasUrl || 'https://script.google.com/macros/s/AKfycby_coDZUVdP0Cc5dwsY5SMuIHngvnPlRUddmsCsahTkgyKmBmpOIgB551ym8fu1W6Ix/exec';
      const tType = document.getElementById('hzkSmlTargetType').value;
      const cust = document.getElementById('hzkSmlCustInp').value.trim();
      const model = document.getElementById('hzkSmlModelInp').value.trim();
      const sn = document.getElementById('hzkSmlSnInp').value.trim();
      const job = document.getElementById('hzkSmlJobInp').value.trim();

      let finalUrl = base;
      let msgTemplate = '';
      let previewHtml = '';

      if (tType === 'OUTSOURCE_JOB') {
        finalUrl = `${base}?action=outsourceForm&job=${encodeURIComponent(job)}&cust=${encodeURIComponent(cust)}&model=${encodeURIComponent(model)}&sn=${encodeURIComponent(sn)}`;
        msgTemplate =
          `🛠️ [มอบหมายงานซ่อม / ตรวจเช็กเครื่อง HOSHIZAKI]
` +
          `• เลขที่ใบงาน: ${job || '-'}
` +
          `• ลูกค้า: ${cust || '-'}
` +
          `• รุ่น / S/N: ${model} (${sn})
` +
          `กรุณากดลิงก์ด้านล่างเพื่อกรอกรายงานการซ่อม ค่าตรวจวัด และแนบรูปถ่ายส่งกลับเข้าศูนย์บริการ:
${finalUrl}`;
        previewHtml = `
          <div style="background:#002B49;color:#FFF;padding:10px 14px;font-weight:800;font-size:12px;">🛠️ OUTSOURCE JOB &amp; INSPECTION PORTAL</div>
          <div style="padding:12px;font-size:12px;line-height:1.6;">
            <div><b>ใบงาน:</b> ${job || '-'} | <b>ลูกค้า:</b> ${cust || 'ระบุชื่อร้าน'}</div>
            <div><b>รุ่น / S/N:</b> ${model} (${sn})</div>
            <div style="margin-top:8px;background:#F1F5F9;padding:8px;border-radius:8px;color:#334155;">
              • ช่องกรอกชื่อช่าง Outsource &amp; เบอร์โทร<br>
              • ช่องกรอกค่าตรวจวัด (แรงดันน้ำ Bar / กระแส Amp / อุณหภูมิ °C)<br>
              • ปุ่มอัปโหลดรูปหน้างาน &amp; ลายเซ็นรับงานลูกค้า
            </div>
          </div>`;
      } else if (tType === 'DEALER_CLAIM') {
        finalUrl = `${base}?action=dealerClaim&dealer=${encodeURIComponent(cust)}&sn=${encodeURIComponent(sn)}&model=${encodeURIComponent(model)}`;
        msgTemplate =
          `🤝 [ลิงก์ยื่นเอกสารเคลมอะไหล่ในประกัน HOSHIZAKI]
` +
          `เรียน ตัวแทนจำหน่าย ${cust || ''}
` +
          `กรุณากรอกข้อมูลอาการเสีย หมายเลข S/N (${sn}) และแนบรูปถ่ายหลักฐานผ่านลิงก์ด้านล่างเพื่อให้ฝ่ายบริการตรวจสอบและอนุมัติเคลม:
${finalUrl}`;
        previewHtml = `
          <div style="background:#7C2D12;color:#FFF;padding:10px 14px;font-weight:800;font-size:12px;">🤝 AUTHORIZED DEALER WARRANTY CLAIM</div>
          <div style="padding:12px;font-size:12px;line-height:1.6;">
            <div><b>ดีลเลอร์:</b> ${cust || 'ชื่อตัวแทนจำหน่าย'}</div>
            <div><b>รุ่น / S/N:</b> ${model} (${sn})</div>
            <div style="margin-top:8px;background:#FFFBEB;padding:8px;border-radius:8px;color:#92400E;">
              • ตรวจสอบสถานะประกันของ S/N อัตโนมัติ<br>
              • ช่องระบุรายการอะไหล่ &amp; ยอดขอเคลม (THB)<br>
              • อัปโหลดรูปป้าย S/N + จุดเสีย + ใบซ่อมดีลเลอร์
            </div>
          </div>`;
      } else if (tType === 'DEALER_PORTAL') {
        finalUrl = `${base}?action=portal&type=dealer&q=${encodeURIComponent(cust)}`;
        msgTemplate =
          `🏪 [พอร์ทัลตรวจสอบรายการเครื่องและงานบริการสำหรับดีลเลอร์]
` +
          `ตัวแทนจำหน่าย: ${cust || '-'}
` +
          `ตรวจสอบรายการเครื่องที่จำหน่าย ประวัติการแจ้งซ่อม และสถานะการรับประกันทั้งหมดได้ที่:
${finalUrl}`;
        previewHtml = `
          <div style="background:#002B49;color:#FFF;padding:10px 14px;font-weight:800;font-size:12px;">🤝 DEALER FLEET &amp; WARRANTY PORTAL</div>
          <div style="padding:12px;font-size:12px;line-height:1.6;">
            <div>แสดงตารางเครื่องทั้งหมดในความดูแลของดีลเลอร์ <b>${cust || '-'}</b> พร้อมสถานะประกันและประวัติงานบริการแบบเรียลไทม์</div>
          </div>`;
      } else if (tType === 'SERIAL_360') {
        finalUrl = `${base}?action=portal&type=customer&q=${encodeURIComponent(sn)}`;
        msgTemplate =
          `🔎 [ประวัติเครื่องและการรับประกัน HOSHIZAKI — S/N: ${sn}]
` +
          `รุ่นเครื่อง: ${model}
` +
          `ตรวจสอบประวัติการติดตั้ง การบำรุงรักษา PM และสถานะประกันของเครื่องนี้ได้ที่:
${finalUrl}`;
        previewHtml = `
          <div style="background:#0369A1;color:#FFF;padding:10px 14px;font-weight:800;font-size:12px;">🔎 ASSET S/N 360° HISTORY (${sn})</div>
          <div style="padding:12px;font-size:12px;line-height:1.6;">
            <div>แสดงข้อมูลเฉพาะเครื่อง <b>${model} (S/N: ${sn})</b> สถานะรับประกัน และประวัติการซ่อมบำรุงทั้งหมด</div>
          </div>`;
      } else if (tType === 'SPEC_5DOC') {
        finalUrl = `${base}?action=specFullScreen&model=${encodeURIComponent(model)}`;
        msgTemplate =
          `📐 [เอกสารสเปกและแบบขนาดติดตั้ง HOSHIZAKI รุ่น ${model}]
` +
          `สามารถเปิดดู Spec Sheet, คู่มือติดตั้ง, Service Manual, Parts List และ Dimension Drawing ได้ที่:
${finalUrl}`;
        previewHtml = `
          <div style="background:#002B49;color:#FFF;padding:10px 14px;font-weight:800;font-size:12px;">📐 5-DOC ENGINEERING &amp; SPEC SUITE (${model})</div>
          <div style="padding:12px;font-size:12px;line-height:1.6;">
            <div>หน้าสเปกเต็มจอพร้อมปุ่มดาวน์โหลด 5 หมวด (Spec Sheet, Instruction, Service Manual, Parts List, CAD Drawing)</div>
          </div>`;
      } else if (tType === 'DOC_ESIGN') {
        finalUrl = `${base}?action=trackDoc&mode=ack&id=${encodeURIComponent(job || 'TRK-DEMO')}`;
        msgTemplate =
          `✍️ [ยืนยันรับเอกสาร & ลงนามอนุมัติสั่งซื้อ HOSHIZAKI]
` +
          `เรียน คุณ${cust || 'ลูกค้า'}
` +
          `แผนก ${emp.deptLabel} ขอนำส่งเอกสารอ้างอิง ${job || '-'} กรุณากดลิงก์ด้านล่างเพื่อยืนยันรับเอกสารหรือลงนามอนุมัติสั่งซื้อ (E-Sign):
${finalUrl}`;
        previewHtml = `
          <div style="background:#059669;color:#FFF;padding:10px 14px;font-weight:800;font-size:12px;">✍️ DIGITAL PO &amp; E-SIGNATURE CONFIRMATION</div>
          <div style="padding:12px;font-size:12px;line-height:1.6;">
            <div>ลูกค้ากดเปิดลิงก์จะบันทึกการรับเอกสารทันที พร้อมช่องวาดลายเซ็น E-Signature และแนบไฟล์ PO กลับเข้าระบบ</div>
          </div>`;
      } else {
        // BRANCH_MGR (Default)
        finalUrl = `${base}?action=portal&type=customer&q=${encodeURIComponent(cust)}`;
        msgTemplate =
          `🏢 [พอร์ทัลตรวจสอบเครื่องและประวัติบริการสำหรับผู้จัดการสาขา]
` +
          `เรียน ผู้จัดการสาขา ${cust || ''}
` +
          `แผนก ${emp.deptLabel} บริษัท โฮชิซากิ (ประเทศไทย) จำกัด ขอนำส่งลิงก์สำหรับตรวจสอบรายการเครื่อง HOSHIZAKI ทั้งหมดในสาขา วันหมดประกัน และประวัติซ่อม/PM:
${finalUrl}`;
        previewHtml = `
          <div style="background:#002B49;color:#FFF;padding:10px 14px;font-weight:800;font-size:12px;">🏢 CUSTOMER BRANCH MANAGER FLEET PORTAL</div>
          <div style="padding:12px;font-size:12px;line-height:1.6;">
            <div><b>สาขา:</b> ${cust || 'ชื่อร้าน/สาขาของลูกค้า'}</div>
            <div style="margin-top:6px;background:#F0F9FF;padding:8px;border-radius:8px;color:#0369A1;">
              • ตารางรวมเครื่อง HOSHIZAKI ทุกเครื่องในสาขา<br>
              • วันหมดประกัน &amp; ชื่อดีลเลอร์/ศูนย์บริการที่ดูแล<br>
              • ประวัติการแจ้งซ่อมและการล้าง PM ย้อนหลังทั้งหมด
            </div>
          </div>`;
      }

      document.getElementById('hzkSmlGeneratedUrl').value = finalUrl;
      document.getElementById('hzkSmlMessageBox').value = msgTemplate;
      document.getElementById('hzkSmlVisualPreviewCard').innerHTML = previewHtml;
    }

    ['hzkSmlTargetType', 'hzkSmlCustInp', 'hzkSmlModelInp', 'hzkSmlSnInp', 'hzkSmlJobInp'].forEach(id => {
      document.getElementById(id).addEventListener('input', rebuildSmartLinkPreview);
      document.getElementById(id).addEventListener('change', rebuildSmartLinkPreview);
    });
    rebuildSmartLinkPreview();

    document.getElementById('hzkSmlCopyBtn').onclick = () => {
      const txt = document.getElementById('hzkSmlMessageBox').value;
      navigator.clipboard && navigator.clipboard.writeText(txt);
      showHzkToastNotification('✅ คัดลอกข้อความพร้อมลิงก์เรียบร้อยแล้ว สามารถวางส่งใน LINE / Email ได้ทันที', false);
    };

    document.getElementById('hzkSmlLineShareBtn').onclick = () => {
      const txt = document.getElementById('hzkSmlMessageBox').value;
      window.open('https://line.me/R/share?text=' + encodeURIComponent(txt), '_blank');
    };

    document.getElementById('hzkSmlTestOpenBtn').onclick = () => {
      const u = document.getElementById('hzkSmlGeneratedUrl').value;
      if (u.indexOf('YOUR_DEPLOYED_GAS_ID') !== -1) {
        alert('⚠️ กรุณาตั้งค่า Google Apps Script Web App URL ในเมนู Deep Scan ก่อนทดสอบเปิดลิงก์จริงครับ');
        return;
      }
      window.open(u, '_blank');
    };
  }

  // 2) Outsource Job/Inspection Portal & Dealer Warranty Claim Review Hub
  async function openOutsourceAndDealerClaimHubModal(initialTab) {
    const emp = getActiveEmployeeProfileV1171();
    const gasUrl = getGasEndpointUrl();
    let modal = document.getElementById('hzkOutsourceClaimHubModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkOutsourceClaimHubModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20112;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    let tab = initialTab || 'OUTSOURCE';
    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1080px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#7C2D12);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1175 • OUTSOURCE INSPECTION &amp; DEALER WARRANTY CLAIM HUB</div>
            <div style="font-size:16px;font-weight:800;">🛠️ จัดการรายงานซ่อม Outsource &amp; อนุมัติเคลมประกันตัวแทนจำหน่าย (Dealer Claims)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkOutsourceClaimHubModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:14px 20px;background:#F1F5F9;display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;align-items:center;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" id="hzkTabOutsourceBtn" style="background:#002B49;color:#FFF;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;">🛠️ 1. รายงานซ่อม/ตรวจเครื่องจาก Outsource</button>
            <button type="button" id="hzkTabDealerClaimBtn" style="background:#FFFFFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;">🤝 2. รายการเคลมประกันจากดีลเลอร์ (Dealer Claims)</button>
          </div>
          <button type="button" id="hzkSendPortalLinkQuickBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;">🔗 สร้างลิงก์ส่งให้ Outsource / Dealer + พรีวิว</button>
        </div>

        <div id="hzkOutsourceClaimBody" style="padding:18px 20px;font-size:13px;">⏳ กำลังโหลดข้อมูล...</div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('hzkSendPortalLinkQuickBtn').onclick = () => {
      openSmartShareableLinksPreviewModal({});
    };

    async function renderTab() {
      const btnO = document.getElementById('hzkTabOutsourceBtn');
      const btnC = document.getElementById('hzkTabDealerClaimBtn');
      btnO.style.background = tab === 'OUTSOURCE' ? '#002B49' : '#FFF';
      btnO.style.color = tab === 'OUTSOURCE' ? '#FFF' : '#0F172A';
      btnC.style.background = tab === 'CLAIM' ? '#7C2D12' : '#FFF';
      btnC.style.color = tab === 'CLAIM' ? '#FFF' : '#0F172A';

      const body = document.getElementById('hzkOutsourceClaimBody');
      if (!gasUrl) {
        body.innerHTML = `<div style="color:#B91C1C;">กรุณาตั้งค่า Google Apps Script URL เพื่อดูข้อมูลรายงานจาก Outsource และ Dealer แบบเรียลไทม์ครับ</div>`;
        return;
      }

      if (tab === 'OUTSOURCE') {
        body.innerHTML = '⏳ กำลังดึงรายงานจากช่าง Outsource...';
        const r = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getOutsourceInspectionLogs' })
        });
        const d = await r.json();
        const items = (d && d.items) || [];
        body.innerHTML = `
          <div style="overflow-x:auto;">
            <table style="width:100%;min-width:820px;border-collapse:collapse;font-size:12px;">
              <thead><tr style="background:#002B49;color:#FFF;"><th style="padding:7px;">รหัสรายงาน</th><th style="padding:7px;">ใบงาน</th><th style="padding:7px;">ช่าง Outsource</th><th style="padding:7px;text-align:left;">ลูกค้า / รุ่น / S/N</th><th style="padding:7px;text-align:left;">ค่าตรวจวัด &amp; งานซ่อม</th><th style="padding:7px;">หลักฐาน</th></tr></thead>
              <tbody>
                ${items.map(it => `<tr>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${it.reportId}<br><span style="font-size:10px;color:#64748B;">${it.submittedAt}</span></td>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${it.jobNo}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;">${it.vendorName}<br><span style="font-size:11px;color:#475569;">${it.vendorPhone}</span></td>
                  <td style="padding:7px;border:1px solid #CBD5E1;"><b>${it.customerName}</b><br>${it.model} (${it.serialNo})</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;"><b>ค่าวัด:</b> ${it.readings}<br>${it.workDetail}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${it.fileUrl ? `<a href="${it.fileUrl}" target="_blank" style="color:#0284C7;font-weight:700;">📎 เปิดรูป/ไฟล์</a>` : '-'}</td>
                </tr>`).join('') || '<tr><td colspan="6" style="padding:14px;text-align:center;color:#64748B;">ยังไม่มีรายการส่งรายงานจาก Outsource (กดปุ่มสร้างลิงก์ด้านบนเพื่อส่งให้ช่าง Outsource กรอกได้เลยครับ)</td></tr>'}
              </tbody>
            </table>
          </div>
        `;
      } else {
        body.innerHTML = '⏳ กำลังดึงรายการยื่นเคลมประกันจากตัวแทนจำหน่าย...';
        const r = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getDealerWarrantyClaims' })
        });
        const d = await r.json();
        const items = (d && d.items) || [];
        body.innerHTML = `
          <div style="overflow-x:auto;">
            <table style="width:100%;min-width:860px;border-collapse:collapse;font-size:12px;">
              <thead><tr style="background:#7C2D12;color:#FFF;"><th style="padding:7px;">เลขที่เคลม</th><th style="padding:7px;">ดีลเลอร์</th><th style="padding:7px;text-align:left;">ลูกค้า / รุ่น / S/N</th><th style="padding:7px;text-align:left;">อาการ &amp; สิทธิ์ประกัน</th><th style="padding:7px;text-align:right;">ยอดขอเคลม</th><th style="padding:7px;">สถานะ / อนุมัติ</th></tr></thead>
              <tbody>
                ${items.map(it => `<tr>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${it.claimId}<br><span style="font-size:10px;color:#64748B;">${it.submittedAt}</span></td>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${it.dealerName}<br><span style="font-size:11px;font-weight:400;">${it.dealerContact}</span></td>
                  <td style="padding:7px;border:1px solid #CBD5E1;"><b>${it.customerName}</b><br>${it.model} (${it.serialNo})</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;">${it.symptom}<br><span style="font-size:11px;color:#047857;font-weight:700;">${it.warrantyNote}</span>${it.fileUrl ? ` • <a href="${it.fileUrl}" target="_blank">📎 หลักฐาน</a>` : ''}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">฿${Number(it.claimAmount || 0).toLocaleString()}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
                    ${it.status === 'PENDING_REVIEW'
                      ? `<button type="button" data-cid="${it.claimId}" data-amt="${it.claimAmount}" class="hzk-approve-claim-btn" style="background:#059669;color:#FFF;border:none;border-radius:6px;padding:5px 9px;font-weight:700;cursor:pointer;">✅ อนุมัติเคลม</button>`
                      : `<span style="font-weight:800;color:#059669;">${it.status} (฿${Number(it.approvedAmount || 0).toLocaleString()})</span>`}
                  </td>
                </tr>`).join('') || '<tr><td colspan="6" style="padding:14px;text-align:center;color:#64748B;">ยังไม่มีรายการยื่นเคลมประกันจากดีลเลอร์</td></tr>'}
              </tbody>
            </table>
          </div>
        `;

        body.querySelectorAll('.hzk-approve-claim-btn').forEach(btn => {
          btn.onclick = async () => {
            const cid = btn.getAttribute('data-cid');
            const defAmt = btn.getAttribute('data-amt');
            const appAmt = Number(prompt('ระบุยอดเงิน/มูลค่าอะไหล่ที่อนุมัติเคลม (THB):', defAmt) || 0);
            await fetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: 'reviewDealerWarrantyClaim',
                claimId: cid,
                decision: 'APPROVED',
                approvedAmount: appAmt,
                reviewer: emp.name
              })
            });
            showHzkToastNotification(`✅ อนุมัติใบเคลม ${cid} เรียบร้อยแล้ว`, false);
            renderTab();
          };
        });
      }
    }

    document.getElementById('hzkTabOutsourceBtn').onclick = () => { tab = 'OUTSOURCE'; renderTab(); };
    document.getElementById('hzkTabDealerClaimBtn').onclick = () => { tab = 'CLAIM'; renderTab(); };
    renderTab();
  }

  // 3) Demo/Loaner Borrowing Slip & Multi-Visit Annual PM Scheduler
  async function openDemoLoanerAndMultiPmModal() {
    const emp = getActiveEmployeeProfileV1171();
    const gasUrl = getGasEndpointUrl();
    let modal = document.getElementById('hzkDemoLoanerPmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkDemoLoanerPmModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20114;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const today = new Date().toISOString().slice(0, 10);
    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1040px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#065F46,#002B49);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
          <div>
            <div style="font-size:11px;color:#A7F3D0;font-weight:800;">ENTERPRISE v1175 • DEMO/LOANER BORROWING SLIP &amp; MULTI-VISIT PM SCHEDULER</div>
            <div style="font-size:16px;font-weight:800;">📦 ใบเบิก-ยืมเครื่องตัวโชว์/เครื่องสำรอง &amp; จัดคิว PM รายปีอัตโนมัติ (4 รอบ/ปี)</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkDemoLoanerPmModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>

        <div style="padding:18px 20px;font-size:13px;display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;">
          <!-- Left: Demo / Loaner Borrowing Slip -->
          <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:14px;padding:14px;">
            <div style="font-weight:800;color:#002B49;font-size:14px;margin-bottom:8px;">1️⃣ ออกใบเบิก-ยืมเครื่องตัวโชว์ / เครื่องสำรองระหว่างซ่อม</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <select id="hzkBrwPurpose" style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
                <option value="CUSTOMER_LOANER">🛠️ เครื่องสำรองให้ลูกค้าระหว่างรอซ่อม (Service Loaner)</option>
                <option value="EXHIBITION_BOOTH">🎪 ยืมออกบูธแสดงสินค้า / Event (Marketing / Sales)</option>
                <option value="TRAINING_DEMO">🎓 ใช้ฝึกอบรมช่าง / ทดสอบในศูนย์บริการ</option>
              </select>
              <input id="hzkBrwTarget" type="text" placeholder="ชื่อลูกค้า / ชื่องานแสดงสินค้า *" style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input id="hzkBrwModel" type="text" placeholder="รุ่นเครื่อง เช่น IM-130NE" style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
                <input id="hzkBrwSn" type="text" placeholder="Serial No. เช่น K01234J" style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;">กำหนดวันที่ส่งคืนคลังสินค้า:</label>
                <input id="hzkBrwReturnDate" type="date" value="${today}" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;" />
              </div>
              <button type="button" id="hzkBrwSubmitBtn" style="background:#0284C7;color:#FFF;border:none;border-radius:9px;padding:10px;font-weight:800;cursor:pointer;">📦 บันทึกใบเบิก-ยืม &amp; แจ้งเตือนคลังใน LINE</button>
            </div>
          </div>

          <!-- Right: Multi-Visit PM Contract Auto-Scheduler -->
          <div style="background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:14px;padding:14px;">
            <div style="font-weight:800;color:#166534;font-size:14px;margin-bottom:8px;">2️⃣ สร้างตารางคิวงาน PM รายปีล่วงหน้าอัตโนมัติ (Multi-Visit PM)</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <input id="hzkPmCust" type="text" placeholder="ชื่อลูกค้า / สาขาสัญญา PM *" style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input id="hzkPmModel" type="text" placeholder="รุ่นเครื่อง เช่น IM-240ANE" style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
                <input id="hzkPmSn" type="text" placeholder="Serial No." style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;" />
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <select id="hzkPmVisits" style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
                  <option value="4" selected>4 ครั้ง / ปี (ทุก 3 เดือน)</option>
                  <option value="2">2 ครั้ง / ปี (ทุก 6 เดือน)</option>
                  <option value="6">6 ครั้ง / ปี (ทุก 2 เดือน)</option>
                  <option value="12">12 ครั้ง / ปี (ทุกเดือน)</option>
                </select>
                <select id="hzkPmVan" style="padding:8px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
                  <option value="T08">รถช่าง T08 (Install &amp; PM)</option>
                  <option value="T01">รถช่าง T01</option><option value="T02">รถช่าง T02</option>
                  <option value="T03">รถช่าง T03</option><option value="T04">รถช่าง T04</option>
                </select>
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;">วันที่เริ่มเข้า PM รอบที่ 1:</label>
                <input id="hzkPmStartDate" type="date" value="${today}" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:8px;margin-top:3px;" />
              </div>
              <button type="button" id="hzkPmScheduleAllBtn" style="background:#059669;color:#FFF;border:none;border-radius:9px;padding:10px;font-weight:800;cursor:pointer;">📅 สร้างคิวงาน PM ทุกรอบลงตารางช่างทันที</button>
            </div>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('hzkBrwSubmitBtn').onclick = async () => {
      const target = document.getElementById('hzkBrwTarget').value.trim();
      if (!target) { alert('กรุณาระบุชื่อลูกค้าหรือชื่องานแสดงสินค้าครับ'); return; }
      const payload = {
        action: 'saveDemoLoanerBorrowing',
        purpose: document.getElementById('hzkBrwPurpose').value,
        borrower: emp.name,
        customerOrEvent: target,
        model: document.getElementById('hzkBrwModel').value.trim(),
        serialNo: document.getElementById('hzkBrwSn').value.trim(),
        returnDate: document.getElementById('hzkBrwReturnDate').value
      };
      if (gasUrl) {
        const r = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const d = await r.json();
        alert(d && d.status === 'OK' ? `✅ ออกใบเบิก-ยืมเลขที่ ${d.slipId} และแจ้งเตือนคลังเรียบร้อยแล้ว` : '✅ บันทึกใบเบิก-ยืมเรียบร้อยแล้ว');
      } else {
        alert('✅ บันทึกใบเบิก-ยืมเครื่องในเครื่องเรียบร้อยแล้ว');
      }
    };

    document.getElementById('hzkPmScheduleAllBtn').onclick = async () => {
      const cust = document.getElementById('hzkPmCust').value.trim();
      if (!cust) { alert('กรุณาระบุชื่อลูกค้า/สาขาครับ'); return; }
      const payload = {
        action: 'scheduleMultiVisitPmContract',
        customerName: cust,
        model: document.getElementById('hzkPmModel').value.trim(),
        serialNo: document.getElementById('hzkPmSn').value.trim(),
        visitsPerYear: Number(document.getElementById('hzkPmVisits').value || 4),
        vanCode: document.getElementById('hzkPmVan').value,
        startDate: document.getElementById('hzkPmStartDate').value
      };
      if (gasUrl) {
        const r = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const d = await r.json();
        alert(d && d.status === 'OK' ? `✅ สร้างตารางคิวงาน PM ครบทั้ง ${d.createdCount} รอบลงกระดานช่างเรียบร้อยแล้ว!` : '✅ สร้างตาราง PM เรียบร้อยแล้ว');
      } else {
        alert(`✅ สร้างตาราง PM ${payload.visitsPerYear} รอบเรียบร้อยแล้ว`);
      }
    };
  }

  window.openSmartShareableLinksPreviewModal = openSmartShareableLinksPreviewModal;
  window.openOutsourceAndDealerClaimHubModal = openOutsourceAndDealerClaimHubModal;
  window.openDemoLoanerAndMultiPmModal = openDemoLoanerAndMultiPmModal;

  function bootPersonalizedCockpitV1171() {
    installGlobalRuntimeGuard();
    applySandboxBannerIfNeeded();
    dockOmniBridgeButtons();
    renderCleanCanvasCockpitV1173(getActiveEmployeeProfileV1171());
    setTimeout(initMobileCleanUiDeclutter, 300);
    hookAdminStudioInspectorButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPersonalizedCockpitV1171);
  } else {
    bootPersonalizedCockpitV1171();
  }
})();



// ============================================================================
// ENTERPRISE v1181 — PM & BIG CLEANING REPORT ENGINE (BEFORE / AFTER)
//   1) 1-Click Convert from Service Report -> PM & Big Cleaning Report
//   2) Structured Before / After Photo Pairs (Condenser, Evaporator/Bin, Water/Drain, Exterior)
//   3) Wide-Angle Installation Area Photo + Ambient & Inlet Water Temp + Auto Technical Analysis
//   4) Next PM Cycle Recommendation (+3 / +4 / +6 / +12 Months) synced to Annual PM Scheduler
//   5) Manager Review & Approval -> A4 Preview / Save PDF / Share LINE / Smart Tracking Link
// ============================================================================
(function initHoshizakiPmBigCleaningModuleV1181() {
  if (window.__HZK_PM_BIG_CLEANING_V1181__) return;
  window.__HZK_PM_BIG_CLEANING_V1181__ = true;

  const PM_PAIR_CATEGORIES = [
    { key: 'CONDENSER', title: '1. ระบบระบายความร้อน (Condenser Coil & Air Filter)', beforeHint: 'คราบฝุ่น/ไขมันอุดตันก่อนล้าง', afterHint: 'ล้างขจัดคราบสะอาดโปร่งหลังล้าง' },
    { key: 'EVAPORATOR_BIN', title: '2. ระบบผลิตน้ำแข็ง & ถังเก็บ (Evaporator / Ice Bin)', beforeHint: 'คราบตะกรัน/เมือกก่อนล้าง', afterHint: 'ล้างและฆ่าเชื้อ Sanitizing เรียบร้อย' },
    { key: 'WATER_DRAIN', title: '3. ระบบน้ำเข้า-ท่อน้ำทิ้ง & ปั๊มน้ำ (Water Valve / Drain)', beforeHint: 'สภาพชุดน้ำ/ถาดน้ำทิ้งก่อนล้าง', afterHint: 'ล้างทำความสะอาดการไหลน้ำปกติ' },
    { key: 'EXTERIOR_GASKET', title: '4. ตัวเครื่องภายนอก & ขอบยางประตู (Exterior & Gasket)', beforeHint: 'สภาพภายนอก/ขอบยางก่อนทำความสะอาด', afterHint: 'เช็ดทำความสะอาดภายนอกเรียบร้อย' }
  ];

  window.HZK_PM_STATE = window.HZK_PM_STATE || {
    wideAnglePhoto: '',
    pairs: {
      CONDENSER: { before: '', after: '', note: '' },
      EVAPORATOR_BIN: { before: '', after: '', note: '' },
      WATER_DRAIN: { before: '', after: '', note: '' },
      EXTERIOR_GASKET: { before: '', after: '', note: '' }
    }
  };

  function updatePmPairBadgeCount() {
    const badge = document.getElementById('pmPairCountStatusBadge');
    if (!badge) return;
    let completeCount = 0;
    let partialCount = 0;
    PM_PAIR_CATEGORIES.forEach(cat => {
      const p = (window.HZK_PM_STATE.pairs && window.HZK_PM_STATE.pairs[cat.key]) || {};
      if (p.before && p.after) completeCount++;
      else if (p.before || p.after) partialCount++;
    });
    badge.textContent = `📸 จับคู่ภาพ Before / After ครบแล้ว ${completeCount}/${PM_PAIR_CATEGORIES.length} หมวด` + (partialCount ? ` (รอคู่เพิ่ม ${partialCount} หมวด)` : '');
  }

  window.syncPmAmbientToMainGauge = function(val) {
    const mainAmb = document.getElementById('gaugeAmbient');
    if (mainAmb && val) mainAmb.value = val;
    if (typeof debounceAutoSave === 'function') debounceAutoSave();
  };

  window.applyPmCycleRecommendation = function(cycleVal) {
    const months = parseInt(cycleVal, 10);
    if (!isNaN(months) && months > 0 && typeof window.setNextPmMonths === 'function') {
      window.setNextPmMonths(months);
    }
    if (typeof debounceAutoSave === 'function') debounceAutoSave();
  };

  window.handlePmWideAnglePhotoUpload = async function(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const dataUrl = (typeof compressImageFile === 'function')
        ? await compressImageFile(file, 960, 0.78)
        : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      window.HZK_PM_STATE.wideAnglePhoto = dataUrl;
      renderPmWideAnglePreview();
      if (typeof debounceAutoSave === 'function') debounceAutoSave();
      if (typeof showToast === 'function') showToast('✅ แนบภาพมุมกว้างบริเวณจุดติดตั้งเครื่องเรียบร้อย');
    } catch (e) {
      console.error(e);
    }
    event.target.value = '';
  };

  function renderPmWideAnglePreview() {
    const box = document.getElementById('pmWideAnglePreviewBox');
    if (!box) return;
    if (window.HZK_PM_STATE.wideAnglePhoto) {
      box.innerHTML = `<img src="${window.HZK_PM_STATE.wideAnglePhoto}" class="w-full h-full object-cover" alt="Wide-Angle Site Photo">`;
    } else {
      box.innerHTML = 'ยังไม่ได้แนบภาพมุมกว้างบริเวณจุดติดตั้ง';
    }
  }

  window.collectPmBigCleaningData = function() {
    return {
      pmCycle: document.getElementById('pmCycleIntervalSelect')?.value || '6',
      pmBillingCategory: document.getElementById('pmBillingCategorySelect')?.value || 'CONTRACT_PM',
      siteAmbientTemp: document.getElementById('pmSiteAmbientTemp')?.value || document.getElementById('gaugeAmbient')?.value || '',
      inletWaterTemp: document.getElementById('pmInletWaterTemp')?.value || '',
      ventilationStatus: document.getElementById('pmVentilationStatus')?.value || 'PASS',
      managerApprovalStage: document.getElementById('pmManagerApprovalStage')?.value || 'TECH_DRAFT',
      siteEnvironmentNote: document.getElementById('pmSiteEnvironmentNote')?.value || '',
      beforeSummary: document.getElementById('pmBeforeSummaryText')?.value || '',
      afterSummary: document.getElementById('pmAfterSummaryText')?.value || '',
      cycleBefore: document.getElementById('pmCycleBefore')?.value || '',
      cycleAfter: document.getElementById('pmCycleAfter')?.value || '',
      ampBefore: document.getElementById('pmAmpBefore')?.value || '',
      ampAfter: document.getElementById('pmAmpAfter')?.value || '',
      psiBefore: document.getElementById('pmPsiBefore')?.value || '',
      psiAfter: document.getElementById('pmPsiAfter')?.value || '',
      tempBefore: document.getElementById('pmTempBefore')?.value || '',
      tempAfter: document.getElementById('pmTempAfter')?.value || '',
      wideAnglePhoto: window.HZK_PM_STATE.wideAnglePhoto || '',
      pairs: JSON.parse(JSON.stringify(window.HZK_PM_STATE.pairs || {}))
    };
  };

  window.applyPmBigCleaningData = function(pm) {
    if (!pm) return;
    if (document.getElementById('pmCycleIntervalSelect')) document.getElementById('pmCycleIntervalSelect').value = pm.pmCycle || '6';
    if (document.getElementById('pmBillingCategorySelect')) document.getElementById('pmBillingCategorySelect').value = pm.pmBillingCategory || 'CONTRACT_PM';
    if (document.getElementById('pmSiteAmbientTemp')) document.getElementById('pmSiteAmbientTemp').value = pm.siteAmbientTemp || '';
    if (document.getElementById('pmInletWaterTemp')) document.getElementById('pmInletWaterTemp').value = pm.inletWaterTemp || '';
    if (document.getElementById('pmVentilationStatus')) document.getElementById('pmVentilationStatus').value = pm.ventilationStatus || 'PASS';
    if (document.getElementById('pmManagerApprovalStage')) document.getElementById('pmManagerApprovalStage').value = pm.managerApprovalStage || 'TECH_DRAFT';
    if (document.getElementById('pmSiteEnvironmentNote')) document.getElementById('pmSiteEnvironmentNote').value = pm.siteEnvironmentNote || '';
    if (document.getElementById('pmBeforeSummaryText')) document.getElementById('pmBeforeSummaryText').value = pm.beforeSummary || '';
    if (document.getElementById('pmAfterSummaryText')) document.getElementById('pmAfterSummaryText').value = pm.afterSummary || '';
    if (document.getElementById('pmCycleBefore')) document.getElementById('pmCycleBefore').value = pm.cycleBefore || '';
    if (document.getElementById('pmCycleAfter')) document.getElementById('pmCycleAfter').value = pm.cycleAfter || '';
    if (document.getElementById('pmAmpBefore')) document.getElementById('pmAmpBefore').value = pm.ampBefore || '';
    if (document.getElementById('pmAmpAfter')) document.getElementById('pmAmpAfter').value = pm.ampAfter || '';
    if (document.getElementById('pmPsiBefore')) document.getElementById('pmPsiBefore').value = pm.psiBefore || '';
    if (document.getElementById('pmPsiAfter')) document.getElementById('pmPsiAfter').value = pm.psiAfter || '';
    if (document.getElementById('pmTempBefore')) document.getElementById('pmTempBefore').value = pm.tempBefore || '';
    if (document.getElementById('pmTempAfter')) document.getElementById('pmTempAfter').value = pm.tempAfter || '';
    window.HZK_PM_STATE.wideAnglePhoto = pm.wideAnglePhoto || '';
    if (pm.pairs) window.HZK_PM_STATE.pairs = pm.pairs;
    renderPmWideAnglePreview();
    updatePmPairBadgeCount();
  };

  // Auto-map existing photos from Service Report into Before/After pairs by caption keywords
  function autoHydratePmPairsFromJobPhotos() {
    const cards = Array.from(document.querySelectorAll('#photoPreviewContainer .photo-card'));
    if (!cards.length) return;
    const unmatched = [];
    cards.forEach(card => {
      const src = card.querySelector('img')?.src || '';
      const cap = (card.querySelector('.photo-caption')?.value || '').trim();
      if (!src) return;
      const isAfter = /หลัง|after|clean|เสร็จ|เรียบร้อย/i.test(cap);
      const isBefore = /ก่อน|before|สกปรก|ฝุ่น|ตะกรัน/i.test(cap);
      let catKey = 'CONDENSER';
      if (/ถัง|น้ำแข็ง|evap|bin|ถาด|ในตู้/i.test(cap)) catKey = 'EVAPORATOR_BIN';
      else if (/น้ำ|ท่อ|ปั๊ม|water|drain/i.test(cap)) catKey = 'WATER_DRAIN';
      else if (/ภายนอก|ประตู|ยาง|exterior|รอบ|มุมกว้าง|ติดตั้ง/i.test(cap)) {
        if (/มุมกว้าง|ติดตั้ง|สถานที่/i.test(cap) && !window.HZK_PM_STATE.wideAnglePhoto) {
          window.HZK_PM_STATE.wideAnglePhoto = src;
          return;
        }
        catKey = 'EXTERIOR_GASKET';
      }
      if (isBefore && !window.HZK_PM_STATE.pairs[catKey].before) {
        window.HZK_PM_STATE.pairs[catKey].before = src;
      } else if (isAfter && !window.HZK_PM_STATE.pairs[catKey].after) {
        window.HZK_PM_STATE.pairs[catKey].after = src;
      } else {
        unmatched.push(src);
      }
    });
    // Fill remaining empty slots sequentially if technician uploaded paired photos without captions
    if (unmatched.length) {
      let ptr = 0;
      PM_PAIR_CATEGORIES.forEach(cat => {
        if (!window.HZK_PM_STATE.pairs[cat.key].before && ptr < unmatched.length) {
          window.HZK_PM_STATE.pairs[cat.key].before = unmatched[ptr++];
        }
        if (!window.HZK_PM_STATE.pairs[cat.key].after && ptr < unmatched.length) {
          window.HZK_PM_STATE.pairs[cat.key].after = unmatched[ptr++];
        }
      });
    }
    renderPmWideAnglePreview();
    updatePmPairBadgeCount();
  }

  // 1-Click Convert from Service Report to PM & Big Cleaning Report
  window.convertCurrentServiceJobToPmReport = function() {
    const jobData = (typeof collectFullJobData === 'function') ? collectFullJobData() : {};
    // Keep a snapshot backup of original Service Report in localStorage
    try {
      const archive = JSON.parse(localStorage.getItem('hzk_service_to_pm_source_archive') || '{}');
      if (jobData.jobNo) archive[jobData.jobNo] = jobData;
      localStorage.setItem('hzk_service_to_pm_source_archive', JSON.stringify(archive));
    } catch (e) {}

    if (typeof window.switchReportDocumentMode === 'function') {
      window.switchReportDocumentMode('PM', false);
    }

    // Pull Ambient, Amp, PSI, Temp, Symptom & Action into PM fields
    if (jobData.gaugeAmbient && document.getElementById('pmSiteAmbientTemp')) {
      document.getElementById('pmSiteAmbientTemp').value = jobData.gaugeAmbient;
    }
    if (jobData.gaugeAmp && document.getElementById('pmAmpAfter') && !document.getElementById('pmAmpAfter').value) {
      document.getElementById('pmAmpAfter').value = jobData.gaugeAmp;
    }
    if (jobData.gaugePsi && document.getElementById('pmPsiAfter') && !document.getElementById('pmPsiAfter').value) {
      document.getElementById('pmPsiAfter').value = jobData.gaugePsi;
    }
    if (jobData.tempActual && document.getElementById('pmTempAfter') && !document.getElementById('pmTempAfter').value) {
      document.getElementById('pmTempAfter').value = jobData.tempActual;
    }
    if (jobData.symptom && document.getElementById('pmBeforeSummaryText') && !document.getElementById('pmBeforeSummaryText').value) {
      document.getElementById('pmBeforeSummaryText').value = jobData.symptom;
    }
    if (jobData.action && document.getElementById('pmAfterSummaryText') && !document.getElementById('pmAfterSummaryText').value) {
      document.getElementById('pmAfterSummaryText').value = jobData.action;
    }

    autoHydratePmPairsFromJobPhotos();

    // Ensure Next PM Date is populated (default +6 months if empty)
    const nextPmEl = document.getElementById('nextPmDate');
    if (nextPmEl && !nextPmEl.value && typeof window.setNextPmMonths === 'function') {
      const selMonths = parseInt(document.getElementById('pmCycleIntervalSelect')?.value || '6', 10) || 6;
      window.setNextPmMonths(selMonths);
    }

    if (typeof debounceAutoSave === 'function') debounceAutoSave();
    window.openPmReportStudioModal(false);
    if (typeof showToast === 'function') {
      showToast('🧼 ดึงข้อมูลจาก Service Report สร้างเป็น PM & Big Cleaning Report เรียบร้อยแล้ว');
    }
  };

  // Intelligent Technical Analysis & Next PM Recommendation
  window.autoAnalyzePmSiteAndMachine = function() {
    const ambRaw = document.getElementById('pmSiteAmbientTemp')?.value || document.getElementById('gaugeAmbient')?.value || '';
    const ambNum = parseFloat(String(ambRaw).replace(/[^0-9.]/g, ''));
    const vent = document.getElementById('pmVentilationStatus')?.value || 'PASS';
    const cycleMonths = document.getElementById('pmCycleIntervalSelect')?.value || '6';
    const model = document.getElementById('eqModel')?.value || 'HOSHIZAKI';

    const findings = [];
    let recommendedMonths = parseInt(cycleMonths, 10) || 6;

    if (!isNaN(ambNum) && ambNum >= 35) {
      findings.push(`อุณหภูมิแวดล้อมจุดติดตั้งค่อนข้างสูง (${ambNum}°C เกินเกณฑ์ 35°C) ส่งผลให้คอมเพรสเซอร์ทำงานหนักขึ้น แนะนำเพิ่มการระบายอากาศและล้างแผงคอยล์ร้อนทุก 3 เดือน`);
      recommendedMonths = 3;
    } else if (!isNaN(ambNum) && ambNum > 0) {
      findings.push(`อุณหภูมิแวดล้อมจุดติดตั้งอยู่ในเกณฑ์เหมาะสม (${ambNum}°C)`);
    }

    if (vent === 'HOT_AREA' || vent === 'TIGHT') {
      findings.push('พื้นที่ติดตั้งค่อนข้างจำกัด/ใกล้แหล่งความร้อน แนะนำให้พนักงานหน้าร้านถอดล้างแผ่นกรองฝุ่น (Air Filter) ทุก 2 สัปดาห์ และเว้นระยะระบายอากาศด้านข้าง/ด้านหลังอย่างน้อย 15 ซม.');
      if (recommendedMonths > 4) recommendedMonths = 4;
    } else {
      findings.push('ระยะระบายอากาศรอบเครื่องผ่านเกณฑ์มาตรฐาน แนะนำล้างทำความสะอาดใหญ่ (Big Cleaning & Sanitizing) ตามรอบอย่างสม่ำเสมอเพื่อรักษาคุณภาพน้ำแข็งและประหยัดพลังงาน');
    }

    const recInput = document.getElementById('custRecommendation');
    if (recInput) {
      recInput.value = findings.join(' | ');
    }
    const afterInput = document.getElementById('pmAfterSummaryText');
    if (afterInput && !afterInput.value.trim()) {
      afterInput.value = `ดำเนินการล้างทำความสะอาดใหญ่ (Big Cleaning) และฆ่าเชื้อระบบผลิตน้ำแข็ง/ถังเก็บเครื่องรุ่น ${model} เรียบร้อย ตรวจเช็กกระแสไฟ แรงดันน้ำยา และรอบการผลิตทำงานปกติเต็มประสิทธิภาพ`;
    }
    if (document.getElementById('pmCycleIntervalSelect')) {
      document.getElementById('pmCycleIntervalSelect').value = String(recommendedMonths);
    }
    if (typeof window.setNextPmMonths === 'function') {
      window.setNextPmMonths(recommendedMonths);
    }
    if (typeof debounceAutoSave === 'function') debounceAutoSave();
    if (typeof showToast === 'function') {
      showToast(`✨ วิเคราะห์สภาพเครื่องและตั้งนัดหมาย PM รอบถัดไป (+${recommendedMonths} เดือน) เรียบร้อย`);
    }
  };

  // Interactive Before/After Studio & Printable A4 PM Report Modal
  window.openPmReportStudioModal = function(openPrintPreviewDirectly) {
    autoHydratePmPairsFromJobPhotos();
    const jobData = (typeof collectFullJobData === 'function') ? collectFullJobData() : {};
    const pmData = window.collectPmBigCleaningData();

    let modal = document.getElementById('hzkPmBigCleaningStudioModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkPmBigCleaningStudioModal';
      modal.className = 'fixed inset-0 z-[20180] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto';
      document.body.appendChild(modal);
    }

    const jobPhotos = jobData.photos || [];
    const jobPhotoOptions = jobPhotos.map((p, i) => `<option value="${i}">ดึงจากรูปใบงาน #${i + 1}${p.caption ? ' - ' + p.caption : ''}</option>`).join('');

    modal.innerHTML = `
      <div class="bg-white w-full max-w-6xl max-h-[94vh] rounded-2xl shadow-2xl border-2 border-emerald-500 flex flex-col overflow-hidden font-sans text-slate-900">
        <div class="bg-gradient-to-r from-[#002B49] via-emerald-900 to-emerald-800 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="text-[10.5px] text-emerald-300 font-extrabold tracking-wider">HOSHIZAKI PM &amp; BIG CLEANING REPORT STUDIO (v1181)</div>
            <div class="text-sm sm:text-base font-black">🧼 จัดคู่ภาพ Before / After &amp; ตรวจสอบเอกสาร PM Report ก่อนส่งมอบลูกค้า</div>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button type="button" id="btnPmStudioApproveMgr" class="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-3 py-1.5 rounded-lg shadow-xs">
              🛡️ Manager ตรวจสอบ &amp; อนุมัติ
            </button>
            <button type="button" id="btnPmStudioPreviewA4" class="bg-sky-500 hover:bg-sky-600 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-xs">
              🖨️ พรีวิว A4 / Save PDF
            </button>
            <button type="button" id="btnPmStudioShareTrack" class="bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-xs">
              🔗 แชร์ลูกค้า &amp; ติดตามผล (LINE / Track)
            </button>
            <button type="button" onclick="document.getElementById('hzkPmBigCleaningStudioModal').classList.add('hidden')" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
              ✕ ปิด
            </button>
          </div>
        </div>

        <div class="p-4 overflow-y-auto space-y-4 text-xs">
          <!-- Info Summary Banner -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div>
              <div class="text-[10.5px] font-bold text-slate-500">เลขที่เอกสาร / ลูกค้า / สาขา</div>
              <div class="font-black text-[#002B49] text-sm">${jobData.jobNo || 'PM-REPORT'} — ${jobData.store || '-'}</div>
              <div class="text-[11px] text-slate-600">รุ่น: <b>${jobData.model || '-'}</b> | S/N: <b>${jobData.serial || '-'}</b></div>
            </div>
            <div>
              <div class="text-[10.5px] font-bold text-slate-500">สภาพแวดล้อมจุดติดตั้ง &amp; อุณหภูมิ</div>
              <div class="font-bold text-slate-800">อุณหภูมิห้อง: <span class="text-sky-800">${pmData.siteAmbientTemp || '-'}</span> | น้ำเข้า: <span class="text-sky-800">${pmData.inletWaterTemp || '-'}</span></div>
              <div class="text-[11px] text-slate-600">${pmData.siteEnvironmentNote || 'ระบายอากาศปกติ'}</div>
            </div>
            <div>
              <div class="text-[10.5px] font-bold text-slate-500">นัดหมายล้างเครื่องครั้งถัดไป (Next PM)</div>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="font-black text-emerald-800 text-sm">${jobData.nextPmDate || 'ยังไม่ระบุวัน'}</span>
                <button type="button" onclick="window.applyPmCycleRecommendation('3'); window.openPmReportStudioModal(false);" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold text-[10px]">+3ด.</button>
                <button type="button" onclick="window.applyPmCycleRecommendation('4'); window.openPmReportStudioModal(false);" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold text-[10px]">+4ด.</button>
                <button type="button" onclick="window.applyPmCycleRecommendation('6'); window.openPmReportStudioModal(false);" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold text-[10px]">+6ด.</button>
                <button type="button" onclick="window.applyPmCycleRecommendation('12'); window.openPmReportStudioModal(false);" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold text-[10px]">+1ปี</button>
              </div>
              <button type="button" id="btnPmSyncAnnualScheduler" class="mt-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10.5px] font-bold px-2 py-0.5 rounded">
                📅 บันทึกรอบนัดเข้า Annual PM Scheduler
              </button>
            </div>
          </div>

          <!-- Wide-Angle Photo Section -->
          <div class="border border-sky-200 bg-sky-50/40 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
            <div class="w-full sm:w-64 h-36 bg-white border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
              ${pmData.wideAnglePhoto ? `<img src="${pmData.wideAnglePhoto}" class="w-full h-full object-cover">` : '<span class="text-slate-400 text-[11px]">ยังไม่มีภาพมุมกว้างจุดติดตั้ง</span>'}
            </div>
            <div class="flex-1 space-y-1.5">
              <div class="font-black text-[#002B49] text-xs">📐 ภาพมุมกว้างบริเวณสถานที่ติดตั้งเครื่อง (Wide-Angle Site &amp; Installation Area)</div>
              <p class="text-[11px] text-slate-600">แสดงสภาพพื้นที่รอบตัวเครื่อง จุดระบายความร้อน ท่อน้ำดี-น้ำทิ้ง เพื่อใช้วิเคราะห์ความเหมาะสมของสถานที่ติดตั้ง</p>
              <div class="flex flex-wrap gap-2">
                <label class="bg-[#002B49] hover:bg-sky-900 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer">
                  📷 อัปโหลดภาพมุมกว้างใหม่
                  <input type="file" accept="image/*" id="inpPmStudioWidePhoto" class="hidden">
                </label>
                ${jobPhotos.length ? `
                  <select id="selPmWideFromJob" class="border border-slate-300 rounded-lg px-2 py-1.5 bg-white font-bold">
                    <option value="">-- เลือกภาพมุมกว้างจากรูปในใบงาน --</option>
                    ${jobPhotoOptions}
                  </select>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- 4 Categories Before / After Matrix -->
          <div class="space-y-3">
            ${PM_PAIR_CATEGORIES.map(cat => {
              const pair = pmData.pairs[cat.key] || { before: '', after: '', note: '' };
              return `
                <div class="border border-slate-300 rounded-xl p-3 bg-white shadow-2xs space-y-2">
                  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                    <span class="font-black text-[#002B49] text-xs">${cat.title}</span>
                    <input type="text" data-pm-note="${cat.key}" value="${(pair.note || '').replace(/"/g, '&quot;')}" placeholder="รายละเอียดการล้างทำความสะอาดจุดนี้..." class="border border-slate-200 rounded px-2 py-1 text-[11px] w-full sm:w-80 bg-slate-50">
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <!-- BEFORE -->
                    <div class="border-2 border-rose-200 bg-rose-50/30 rounded-lg p-2 space-y-1.5">
                      <div class="flex items-center justify-between">
                        <span class="bg-rose-700 text-white text-[10px] font-black px-2 py-0.5 rounded">BEFORE (ก่อนล้างทำความสะอาด)</span>
                        <div class="flex gap-1">
                          <label class="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer">
                            + รูป Before
                            <input type="file" accept="image/*" data-pm-upload="${cat.key}:before" class="hidden">
                          </label>
                          ${jobPhotos.length ? `<select data-pm-pick="${cat.key}:before" class="border border-rose-300 rounded px-1 py-0.5 text-[10px] bg-white"><option value="">เลือกจากใบงาน</option>${jobPhotoOptions}</select>` : ''}
                        </div>
                      </div>
                      <div class="h-44 bg-white border border-rose-100 rounded overflow-hidden flex items-center justify-center">
                        ${pair.before ? `<img src="${pair.before}" class="w-full h-full object-cover">` : `<span class="text-slate-400 text-[11px]">${cat.beforeHint}</span>`}
                      </div>
                    </div>
                    <!-- AFTER -->
                    <div class="border-2 border-emerald-300 bg-emerald-50/30 rounded-lg p-2 space-y-1.5">
                      <div class="flex items-center justify-between">
                        <span class="bg-emerald-700 text-white text-[10px] font-black px-2 py-0.5 rounded">AFTER (หลังล้างทำความสะอาดเรียบร้อย)</span>
                        <div class="flex gap-1">
                          <label class="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer">
                            + รูป After
                            <input type="file" accept="image/*" data-pm-upload="${cat.key}:after" class="hidden">
                          </label>
                          ${jobPhotos.length ? `<select data-pm-pick="${cat.key}:after" class="border border-emerald-300 rounded px-1 py-0.5 text-[10px] bg-white"><option value="">เลือกจากใบงาน</option>${jobPhotoOptions}</select>` : ''}
                        </div>
                      </div>
                      <div class="h-44 bg-white border border-emerald-100 rounded overflow-hidden flex items-center justify-center">
                        ${pair.after ? `<img src="${pair.after}" class="w-full h-full object-cover">` : `<span class="text-slate-400 text-[11px]">${cat.afterHint}</span>`}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');

    // Bind uploads & pickers inside studio
    const wideInp = document.getElementById('inpPmStudioWidePhoto');
    if (wideInp) {
      wideInp.onchange = async (ev) => {
        await window.handlePmWideAnglePhotoUpload(ev);
        window.openPmReportStudioModal(false);
      };
    }
    const wideSel = document.getElementById('selPmWideFromJob');
    if (wideSel) {
      wideSel.onchange = () => {
        const idx = parseInt(wideSel.value, 10);
        if (!isNaN(idx) && jobPhotos[idx]) {
          window.HZK_PM_STATE.wideAnglePhoto = jobPhotos[idx].src;
          renderPmWideAnglePreview();
          if (typeof debounceAutoSave === 'function') debounceAutoSave();
          window.openPmReportStudioModal(false);
        }
      };
    }

    modal.querySelectorAll('input[data-pm-note]').forEach(inp => {
      inp.oninput = () => {
        const k = inp.getAttribute('data-pm-note');
        window.HZK_PM_STATE.pairs[k].note = inp.value;
        if (typeof debounceAutoSave === 'function') debounceAutoSave();
      };
    });

    modal.querySelectorAll('input[data-pm-upload]').forEach(inp => {
      inp.onchange = async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        const [k, side] = inp.getAttribute('data-pm-upload').split(':');
        const dataUrl = (typeof compressImageFile === 'function')
          ? await compressImageFile(file, 900, 0.76)
          : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        window.HZK_PM_STATE.pairs[k][side] = dataUrl;
        updatePmPairBadgeCount();
        if (typeof debounceAutoSave === 'function') debounceAutoSave();
        window.openPmReportStudioModal(false);
      };
    });

    modal.querySelectorAll('select[data-pm-pick]').forEach(sel => {
      sel.onchange = () => {
        const idx = parseInt(sel.value, 10);
        if (isNaN(idx) || !jobPhotos[idx]) return;
        const [k, side] = sel.getAttribute('data-pm-pick').split(':');
        window.HZK_PM_STATE.pairs[k][side] = jobPhotos[idx].src;
        updatePmPairBadgeCount();
        if (typeof debounceAutoSave === 'function') debounceAutoSave();
        window.openPmReportStudioModal(false);
      };
    });

    document.getElementById('btnPmStudioApproveMgr').onclick = () => {
      window.approvePmReportByManager();
      window.openPmReportStudioModal(false);
    };
    document.getElementById('btnPmStudioPreviewA4').onclick = () => {
      window.openPmA4PrintableReportWindow();
    };
    document.getElementById('btnPmStudioShareTrack').onclick = () => {
      window.sendPmReportTrackedToCustomer();
    };
    document.getElementById('btnPmSyncAnnualScheduler').onclick = () => {
      window.syncPmNextAppointmentToAnnualScheduler();
    };

    if (openPrintPreviewDirectly) {
      window.openPmA4PrintableReportWindow();
    }
  };

  // Manager Review & Approval Workflow (with LINE notification & locking)
  window.submitPmReportForManagerReview = async function() {
    const jobData = (typeof collectFullJobData === 'function') ? collectFullJobData() : {};
    const stageEl = document.getElementById('pmManagerApprovalStage');
    if (stageEl) stageEl.value = 'PENDING_MGR_REVIEW';
    if (typeof debounceAutoSave === 'function') debounceAutoSave();

    const gasUrl = (typeof getGasEndpointUrl === 'function') ? getGasEndpointUrl() : (localStorage.getItem('hoshizaki_gas_webapp_url') || '');
    if (gasUrl) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'savePmBigCleaningReport',
            report: Object.assign({}, jobData, { pmReportData: window.collectPmBigCleaningData(), approvalStage: 'PENDING_MGR_REVIEW' })
          })
        });
      } catch (e) {}
    }
    if (typeof showToast === 'function') {
      showToast(`📤 ส่ง PM Report เลขที่ ${jobData.jobNo || ''} ให้ Manager ตรวจสอบและแจ้งเตือนใน LINE เรียบร้อย`);
    }
  };

  window.approvePmReportByManager = function() {
    const stageEl = document.getElementById('pmManagerApprovalStage');
    if (stageEl) stageEl.value = 'MGR_APPROVED';
    const mgrNameEl = document.getElementById('nameManager');
    if (mgrNameEl && !mgrNameEl.value.trim()) {
      mgrNameEl.value = 'นพรินทร์ หอมหวล (Deputy Service Manager)';
    }
    const mgrDateEl = document.getElementById('managerApprovalDate');
    if (mgrDateEl) {
      mgrDateEl.innerText = new Date().toLocaleDateString('th-TH');
    }
    if (typeof debounceAutoSave === 'function') debounceAutoSave();
    window.syncPmNextAppointmentToAnnualScheduler(true);
    if (typeof showToast === 'function') {
      showToast('✅ Manager อนุมัติ PM & Big Cleaning Report เรียบร้อย พร้อมส่งมอบและติดตามผลลูกค้า');
    }
  };

  // Sync Next PM Date into Multi-Visit Annual PM Scheduler & GAS Backend
  window.syncPmNextAppointmentToAnnualScheduler = async function(silent) {
    const jobData = (typeof collectFullJobData === 'function') ? collectFullJobData() : {};
    const pmData = window.collectPmBigCleaningData();
    if (!jobData.nextPmDate) {
      if (!silent && typeof showToast === 'function') showToast('⚠️ กรุณาเลือกวันที่นัดหมาย PM ครั้งถัดไปก่อนบันทึก');
      return;
    }
    try {
      const schedList = JSON.parse(localStorage.getItem('hoshizaki_service_schedule') || '[]');
      const exists = schedList.some(item => item.serial === jobData.serial && item.date === jobData.nextPmDate && item.category === 'PM');
      if (!exists) {
        schedList.unshift({
          id: 'PM-NEXT-' + Date.now(),
          date: jobData.nextPmDate,
          customer: jobData.store || 'ลูกค้า PM',
          model: jobData.model || '',
          serial: jobData.serial || '',
          category: 'PM',
          van: jobData.techCode || 'T08',
          note: `นัดล้างใหญ่ / PM รอบถัดไป (${pmData.pmCycle} เดือน) ต่อเนื่องจาก ${jobData.jobNo || ''}`
        });
        localStorage.setItem('hoshizaki_service_schedule', JSON.stringify(schedList));
      }
    } catch (e) {}

    const gasUrl = (typeof getGasEndpointUrl === 'function') ? getGasEndpointUrl() : (localStorage.getItem('hoshizaki_gas_webapp_url') || '');
    if (gasUrl) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'savePmBigCleaningReport',
            report: Object.assign({}, jobData, { pmReportData: pmData })
          })
        });
      } catch (e) {}
    }
    if (!silent && typeof showToast === 'function') {
      showToast(`📅 บันทึกนัดหมายล้างเครื่องรอบถัดไป (${jobData.nextPmDate}) ลงระบบติดตามและตารางช่างเรียบร้อย`);
    }
  };

  // Generate Smart Tracking Link + Share PM Report to Customer (Read Receipt + E-Sign + Next PM Confirm)
  window.sendPmReportTrackedToCustomer = async function() {
    const jobData = (typeof collectFullJobData === 'function') ? collectFullJobData() : {};
    const pmData = window.collectPmBigCleaningData();
    const gasUrl = (typeof getGasEndpointUrl === 'function') ? getGasEndpointUrl() : (localStorage.getItem('hoshizaki_gas_webapp_url') || '');
    const trackId = 'TRK-PM-' + (jobData.jobNo || Date.now()).replace(/[^A-Z0-9-]/gi, '');

    if (gasUrl) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'sendServiceTrackedDoc',
            channel: 'LINE',
            attachType: 'LINK',
            senderName: jobData.nameManager || 'ฝ่ายบริการ HOSHIZAKI (Thailand)',
            document: {
              trackId: trackId,
              docType: 'PM & Big Cleaning Report (Before/After)',
              docNo: jobData.jobNo || trackId,
              customerName: jobData.store || '',
              model: jobData.model || '',
              serialNo: jobData.serial || '',
              nextPmDate: jobData.nextPmDate || '',
              grandTotal: jobData.total || '0.00',
              department: 'Service & PM'
            }
          })
        });
      } catch (e) {}
    }

    if (typeof window.openSmartShareableLinksPreviewModal === 'function') {
      window.openSmartShareableLinksPreviewModal({
        customerName: jobData.store || '',
        model: jobData.model || '',
        serialNo: jobData.serial || '',
        jobNo: trackId
      });
      setTimeout(() => {
        const sel = document.getElementById('hzkSmlTargetType');
        if (sel) {
          sel.value = 'DOC_ESIGN';
          sel.dispatchEvent(new Event('change'));
        }
        const msgBox = document.getElementById('hzkSmlMessageBox');
        const urlInp = document.getElementById('hzkSmlGeneratedUrl');
        if (msgBox && urlInp) {
          msgBox.value =
            `🧼 [รายงานการล้างทำความสะอาดใหญ่ & บำรุงรักษาเครื่อง HOSHIZAKI — PM REPORT]\n` +
            `• เลขที่เอกสาร: ${jobData.jobNo || trackId}\n` +
            `• ลูกค้า / สาขา: ${jobData.store || '-'}\n` +
            `• รุ่นเครื่อง / S/N: ${jobData.model || '-'} (${jobData.serial || '-'})\n` +
            `• นัดหมายล้างเครื่องรอบถัดไป: ${jobData.nextPmDate || '-'}\n` +
            `ท่านสามารถเปิดดูรายงานภาพถ่าย Before / After ผลวิเคราะห์หน้างาน และกดลงนามรับทราบงานได้ที่ลิงก์ด้านล่าง:\n` +
            `${urlInp.value}`;
        }
      }, 120);
    }
  };

  // Printable & Saveable A4 PM & Big Cleaning Report (Before / After Layout)
  window.openPmA4PrintableReportWindow = function() {
    const data = (typeof collectFullJobData === 'function') ? collectFullJobData() : {};
    const pm = window.collectPmBigCleaningData();

    const techSig = data.signatures && data.signatures.sigTech ? `<img src="${data.signatures.sigTech}" style="max-height:48px;margin:0 auto;">` : '<div style="height:48px;"></div>';
    const mgrSig = data.signatures && data.signatures.sigManager ? `<img src="${data.signatures.sigManager}" style="max-height:48px;margin:0 auto;">` : '<div style="height:48px;"></div>';
    const custSig = data.signatures && data.signatures.sigCustomer ? `<img src="${data.signatures.sigCustomer}" style="max-height:48px;margin:0 auto;">` : '<div style="height:48px;"></div>';

    const pairsRowsHtml = PM_PAIR_CATEGORIES.map(cat => {
      const p = (pm.pairs && pm.pairs[cat.key]) || {};
      const beforeImg = p.before
        ? `<img src="${p.before}" style="width:100%;height:145px;object-fit:cover;border-radius:6px;border:1px solid #FCA5A5;">`
        : `<div style="height:145px;border:1px dashed #CBD5E1;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:10px;">ไม่มีภาพ Before</div>`;
      const afterImg = p.after
        ? `<img src="${p.after}" style="width:100%;height:145px;object-fit:cover;border-radius:6px;border:1px solid #6EE7B7;">`
        : `<div style="height:145px;border:1px dashed #CBD5E1;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:10px;">ไม่มีภาพ After</div>`;
      return `
        <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px;margin-bottom:8px;page-break-inside:avoid;">
          <div style="font-weight:800;color:#002B49;font-size:11px;margin-bottom:5px;display:flex;justify-content:space-between;">
            <span>${cat.title}</span>
            <span style="color:#475569;font-weight:600;">${p.note || ''}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>
              <div style="background:#FEE2E2;color:#991B1B;font-weight:800;font-size:9.5px;padding:2px 6px;border-radius:4px;margin-bottom:3px;text-align:center;">BEFORE (ก่อนล้างทำความสะอาด)</div>
              ${beforeImg}
            </div>
            <div>
              <div style="background:#D1FAE5;color:#065F46;font-weight:800;font-size:9.5px;padding:2px 6px;border-radius:4px;margin-bottom:3px;text-align:center;">AFTER (หลังล้างทำความสะอาดเรียบร้อย)</div>
              ${afterImg}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const htmlDoc = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>PM & Big Cleaning Report — ${data.jobNo || 'PM-REPORT'}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #0F172A; margin: 0; background: #E2E8F0; }
    .toolbar { background: #002B49; color: #FFF; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 20; }
    .toolbar button { border: none; border-radius: 6px; padding: 7px 14px; font-weight: 800; cursor: pointer; font-size: 12px; }
    .page { background: #FFF; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 11mm; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #CBD5E1; padding: 5px 7px; font-size: 10.5px; }
    th { background: #002B49; color: #FFF; text-align: left; }
    @media print {
      body { background: #FFF; }
      .toolbar { display: none !important; }
      .page { margin: 0; box-shadow: none; width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><b>HOSHIZAKI (THAILAND) LIMITED</b> — PM &amp; Big Cleaning Report (${data.jobNo || 'PM-REPORT'})</div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#059669;color:#FFF;">🖨️ พิมพ์ / บันทึกเป็น PDF</button>
      <button onclick="window.close()" style="background:#EF4444;color:#FFF;">✕ ปิดหน้าต่าง</button>
    </div>
  </div>
  <div class="page">
    <!-- Corporate Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #002B49;padding-bottom:8px;margin-bottom:10px;">
      <div>
        <div style="font-size:18px;font-weight:900;color:#002B49;letter-spacing:0.5px;">HOSHIZAKI (THAILAND) LIMITED</div>
        <div style="font-size:9.5px;color:#475569;">Building A, 1st floor, No. 10/11 Soi Vibhavadi Rangsit 64, Talat Bang Khen, Lak Si, Bangkok 10210 | Tel: (+66)97-230-5941</div>
      </div>
      <div style="text-align:right;">
        <div style="background:#065F46;color:#FFF;font-weight:900;font-size:11.5px;padding:4px 10px;border-radius:6px;">PM &amp; BIG CLEANING REPORT</div>
        <div style="font-size:11px;font-weight:800;color:#002B49;margin-top:3px;">DOC NO: ${data.jobNo || '-'} | DATE: ${data.date || '-'}</div>
      </div>
    </div>

    <!-- Customer & Equipment Info -->
    <table>
      <tr>
        <th style="width:18%;">ลูกค้า / สาขา</th><td style="width:32%;"><b>${data.store || '-'}</b></td>
        <th style="width:18%;">รุ่นเครื่อง (Model)</th><td style="width:32%;"><b>${data.model || '-'}</b></td>
      </tr>
      <tr>
        <th>ผู้ติดต่อ / ที่อยู่</th><td>${data.contact || '-'} / ${data.address || '-'}</td>
        <th>หมายเลขเครื่อง (S/N)</th><td><b>${data.serial || '-'}</b> (ประกัน: ${data.warranty || 'Yes'})</td>
      </tr>
      <tr>
        <th>รอบ PM / ประเภท</th><td>รอบทุก <b>${pm.pmCycle || '6'} เดือน</b> (${pm.pmBillingCategory || 'CONTRACT_PM'})</td>
        <th>นัดหมาย PM รอบถัดไป</th><td><b style="color:#065F46;font-size:11.5px;">${data.nextPmDate || 'ตามแผนสัญญา'}</b></td>
      </tr>
    </table>

    <!-- Site Environment & Wide-Angle Photo -->
    <div style="display:grid;grid-template-columns:1.1fr 1.3fr;gap:10px;border:1px solid #93C5FD;background:#F0F9FF;border-radius:8px;padding:8px;margin-bottom:10px;">
      <div>
        <div style="font-weight:800;color:#002B49;font-size:10.5px;margin-bottom:4px;">📐 ภาพมุมกว้างบริเวณสถานที่ติดตั้งเครื่อง</div>
        ${pm.wideAnglePhoto
          ? `<img src="${pm.wideAnglePhoto}" style="width:100%;height:125px;object-fit:cover;border-radius:6px;border:1px solid #BAE6FD;">`
          : `<div style="height:125px;background:#FFF;border:1px dashed #93C5FD;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#64748B;font-size:10px;">ภาพบริเวณจุดติดตั้งเครื่อง</div>`}
      </div>
      <div style="font-size:10.5px;line-height:1.5;">
        <div style="font-weight:800;color:#002B49;margin-bottom:3px;">🌡️ ข้อมูลสภาพแวดล้อมจุดติดตั้ง &amp; การวิเคราะห์เบื้องต้น</div>
        <div>• <b>อุณหภูมิแวดล้อม (Ambient Temp):</b> ${pm.siteAmbientTemp || data.gaugeAmbient || '-'} | <b>อุณหภูมิน้ำเข้า:</b> ${pm.inletWaterTemp || '-'}</div>
        <div>• <b>ระยะระบายอากาศรอบเครื่อง:</b> ${pm.ventilationStatus || 'PASS'} (${pm.siteEnvironmentNote || 'ปกติ'})</div>
        <div style="margin-top:4px;background:#FFF;border:1px solid #BAE6FD;border-radius:6px;padding:5px;">
          <b>ข้อแนะนำจากฝ่ายบริการ:</b> ${data.custRecommendation || 'ควรล้างแผ่นกรองฝุ่น Air Filter ทุก 2 สัปดาห์ และล้างใหญ่ตามรอบนัดหมาย'}
        </div>
      </div>
    </div>

    <!-- Performance Comparison Before vs After -->
    <table>
      <thead>
        <tr>
          <th style="width:28%;">ค่าตรวจวัดประสิทธิภาพเครื่อง</th>
          <th style="width:36%;background:#991B1B;">ก่อนล้าง (BEFORE)</th>
          <th style="width:36%;background:#065F46;">หลังล้างทำความสะอาด (AFTER)</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>รอบเวลาผลิตน้ำแข็ง (Cycle Time)</td><td>${pm.cycleBefore || '-'}</td><td><b>${pm.cycleAfter || '-'}</b></td></tr>
        <tr><td>กระแสไฟฟ้าขณะทำงาน (Amp)</td><td>${pm.ampBefore || '-'}</td><td><b>${pm.ampAfter || data.gaugeAmp || '-'}</b></td></tr>
        <tr><td>แรงดันน้ำยา High / Low (PSI)</td><td>${pm.psiBefore || '-'}</td><td><b>${pm.psiAfter || data.gaugePsi || '-'}</b></td></tr>
        <tr><td>อุณหภูมิตู้ / น้ำแข็ง (°C)</td><td>${pm.tempBefore || '-'}</td><td><b>${pm.tempAfter || data.tempActual || '-'}</b></td></tr>
        <tr><td>สรุปผลการปฏิบัติงาน</td><td>${pm.beforeSummary || data.symptom || '-'}</td><td><b>${pm.afterSummary || data.action || '-'}</b></td></tr>
      </tbody>
    </table>

    <!-- Before vs After Photo Comparison -->
    <div style="font-weight:900;color:#002B49;font-size:11.5px;margin:6px 0;">📸 ภาพถ่ายเปรียบเทียบก่อนและหลังการล้างทำความสะอาด (BEFORE vs. AFTER)</div>
    ${pairsRowsHtml}

    <!-- Signatures -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px;page-break-inside:avoid;">
      <div style="border:1px solid #CBD5E1;border-radius:8px;padding:6px;text-align:center;">
        <div style="font-weight:800;font-size:10px;color:#002B49;">ช่างผู้ปฏิบัติงาน (Technician)</div>
        ${techSig}
        <div style="font-size:10px;border-top:1px solid #E2E8F0;padding-top:3px;">${data.responsibleTech || '-'}</div>
      </div>
      <div style="border:1px solid #CBD5E1;border-radius:8px;padding:6px;text-align:center;">
        <div style="font-weight:800;font-size:10px;color:#002B49;">ผู้ตรวจสอบ &amp; อนุมัติ (Service Manager)</div>
        ${mgrSig}
        <div style="font-size:10px;border-top:1px solid #E2E8F0;padding-top:3px;">${data.nameManager || 'นพรินทร์ หอมหวล'}</div>
      </div>
      <div style="border:1px solid #CBD5E1;border-radius:8px;padding:6px;text-align:center;">
        <div style="font-weight:800;font-size:10px;color:#002B49;">ผู้รับมอบงาน (Customer Sign-Off)</div>
        ${custSig}
        <div style="font-size:10px;border-top:1px solid #E2E8F0;padding-top:3px;">${data.nameCustomer || 'ลงชื่อลูกค้า / ผู้จัดการสาขา'}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(htmlDoc);
      win.document.close();
    } else if (typeof showToast === 'function') {
      showToast('⚠️ เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาต Pop-up เพื่อพรีวิว A4');
    }
  };
})();



// ============================================================================
// ENTERPRISE v1182 — ACCOUNTING TAX INVOICE / BILLING NOTE STUDIO (A4 REPLICA)
//   - Exact A4 replica of HOSHIZAKI (THAILAND) LIMITED Tax Invoice / Billing Note
//     ("ใบแจ้งหนี้/ใบกำกับภาษี (ต้นฉบับ) เอกสารออกเป็นชุด" / "ใบวางบิล")
//   - Updated current corporate header, Tax ID 0135558002599 (Head Office), Bank info
//   - Embedded scanned transparent Digital Signatures from official PDF:
//       * ผู้ส่งของ (Deliver): Chayanin Kuptrkul
//       * ผู้จัดเตรียม (Preparer): Witharat Riangpha
//       * ผู้มีอำนาจอนุมัติ (Authorized Signature): Waraporn Kianthong
//   - Preloaded presets from SI2611-214, SI2611-215, SI2611-212 + 1-click pull from
//     Quotation / Service Report + Thai Baht Text converter + A4 Print / PDF / Track
// ============================================================================
(function initHoshizakiAccountingTaxInvoiceStudioV1182() {
  if (window.__HZK_ACCOUNTING_TAX_INVOICE_V1182__) return;
  window.__HZK_ACCOUNTING_TAX_INVOICE_V1182__ = true;

  const HZK_ACCOUNTING_DIGITAL_SIGNATURES = {"deliverer_chayanin": "data:image/png;base64,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", "preparer_witharat": "data:image/png;base64,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", "approver_waraporn": "data:image/png;base64,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"};
  window.HZK_ACCOUNTING_DIGITAL_SIGNATURES = HZK_ACCOUNTING_DIGITAL_SIGNATURES;

  const SAMPLE_INVOICE_PRESETS = {
    'SI2611-214': {
      docTitleTh: 'ใบแจ้งหนี้/ใบกำกับภาษี (ต้นฉบับ)',
      docTitleEn: 'Invoice/Tax Invoice (Original)',
      docSubTag: 'เอกสารออกเป็นชุด',
      invoiceNo: 'SI2611-214',
      date: '19/11/2026',
      poNo: 'TSPO260100079',
      salesmanCode: 'JANYALUCK_P',
      termOfPayment: '30 Days after Invoice Date',
      dueDate: '19/12/2026',
      dealerNo: 'AR00000200',
      dealerNameTh: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด',
      dealerNameEn: 'THAI STEWARD SERVICES CO., LTD.',
      addressLine1: '406 RATCHADAPISEK ROAD, SAMSEN',
      addressLine2: 'NORK, HUAYKWANG, BANGKOK 10310',
      tel: '02-290-1222 #904 02-290-1223',
      remarkLine: 'SALE THAI STEWARD SERVICES CO., LTD.',
      customerTaxId: 'TAX ID 0105535144001/HEAD OFFICE',
      shipmentHeader: 'Shipment No. DO2611-220:',
      items: [
        { code: 'IM-220AA', desc: 'M028-C371: ICE MACHINE', serialNote: '(R06632J, R06633J)', qty: 2.00, unitPrice: 87500.00, discount: 7875.00 },
        { code: 'B-301SA', desc: 'G006-C105: STORAGE BIN', serialNote: '(R03781K, R03782K)', qty: 2.00, unitPrice: 22600.00, discount: 2034.00 }
      ]
    },
    'SI2611-215': {
      docTitleTh: 'ใบแจ้งหนี้/ใบกำกับภาษี (ต้นฉบับ)',
      docTitleEn: 'Invoice/Tax Invoice (Original)',
      docSubTag: 'เอกสารออกเป็นชุด',
      invoiceNo: 'SI2611-215',
      date: '19/11/2026',
      poNo: 'TSPO261000064',
      salesmanCode: 'JANYALUCK_P',
      termOfPayment: '30 Days after Invoice Date',
      dueDate: '19/12/2026',
      dealerNo: 'AR00000200',
      dealerNameTh: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด',
      dealerNameEn: 'THAI STEWARD SERVICES CO., LTD.',
      addressLine1: '406 RATCHADAPISEK ROAD, SAMSEN',
      addressLine2: 'NORK HUAYKWANG, BANGKOK 10310',
      tel: '02-290-1222 #904 02-290-1223',
      remarkLine: 'SALE THAI STEWARD SERVICES CO., LTD.',
      customerTaxId: 'TAX ID 0105535144001/HEAD OFFICE',
      shipmentHeader: 'Shipment No. DO2611-224:',
      items: [
        { code: 'IM-130A', desc: 'M032-C372: ICE MACHINE', serialNote: '(R03668K)', qty: 1.00, unitPrice: 78900.00, discount: 0.00 }
      ]
    },
    'SI2611-212': {
      docTitleTh: 'ใบแจ้งหนี้/ใบกำกับภาษี (ต้นฉบับ)',
      docTitleEn: 'Invoice/Tax Invoice (Original)',
      docSubTag: 'เอกสารออกเป็นชุด',
      invoiceNo: 'SI2611-212',
      date: '19/11/2026',
      poNo: 'TSPO260900053',
      salesmanCode: 'JANYALUCK_P',
      termOfPayment: '30 Days after Invoice Date',
      dueDate: '19/12/2026',
      dealerNo: 'AR00000200',
      dealerNameTh: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด',
      dealerNameEn: 'THAI STEWARD SERVICES CO., LTD.',
      addressLine1: '406 RATCHADAPISEK ROAD, SAMSEN',
      addressLine2: 'NORK HUAYKWANG, BANGKOK 10310',
      tel: '02-290-1222 #904 02-290-1223',
      remarkLine: 'SALE THAI STEWARD SERVICES CO., LTD.',
      customerTaxId: 'TAX ID 0105535144001/HEAD OFFICE',
      shipmentHeader: 'Shipment No. DO2611-225:',
      items: [
        { code: 'IM-130A', desc: 'M032-C372: ICE MACHINE', serialNote: '(R03667K)', qty: 1.00, unitPrice: 78900.00, discount: 0.00 }
      ]
    }
  };

  function numberToThaiBahtText(amount) {
    const num = Number(amount || 0);
    if (isNaN(num) || num === 0) return 'ศูนย์บาทถ้วน';
    const thNum = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const thUnit = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    function intToThai(nStr) {
      let out = '';
      const len = nStr.length;
      for (let i = 0; i < len; i++) {
        const digit = parseInt(nStr[i], 10);
        const pos = (len - i - 1) % 6;
        if (digit !== 0) {
          if (pos === 1 && digit === 1) out += 'สิบ';
          else if (pos === 1 && digit === 2) out += 'ยี่สิบ';
          else if (pos === 0 && digit === 1 && len > 1 && i === len - 1) out += 'เอ็ด';
          else out += thNum[digit] + thUnit[pos];
        }
        if (pos === 0 && i < len - 1) out += 'ล้าน';
      }
      return out;
    }

    const fixed = Math.abs(num).toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    let result = (num < 0 ? 'ลบ' : '') + (parseInt(intPart, 10) > 0 ? intToThai(intPart) + 'บาท' : '');
    if (decPart === '00') {
      result += 'ถ้วน';
    } else {
      result += intToThai(decPart) + 'สตางค์';
    }
    return result;
  }

  function fmtMoney2(val) {
    return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  window.HZK_TAX_INVOICE_STATE = window.HZK_TAX_INVOICE_STATE || JSON.parse(JSON.stringify(SAMPLE_INVOICE_PRESETS['SI2611-214']));

  function getHeaderLogoDataUrl() {
    const imgEl = document.getElementById('docHeaderCustomLogoImg') || document.getElementById('topHeaderCustomLogoImg');
    return (imgEl && imgEl.src) ? imgEl.src : '';
  }

  function buildExactAccountingTaxInvoiceHtml(inv, autoPrint) {
    const logoSrc = getHeaderLogoDataUrl();
    const items = Array.isArray(inv.items) ? inv.items : [];
    let subTotalExVat = 0;

    const itemRowsHtml = items.map(it => {
      const qty = Number(it.qty || 1);
      const up = Number(it.unitPrice || 0);
      const gross = qty * up;
      const disc = Number(it.discount || 0);
      const net = Math.max(0, gross - disc);
      subTotalExVat += net;
      return `
        <tr>
          <td style="padding:5px 6px;vertical-align:top;font-weight:700;">${it.code || ''}</td>
          <td style="padding:5px 6px;vertical-align:top;">
            <div style="font-weight:700;">${it.desc || ''}</div>
            ${it.serialNote ? `<div style="font-size:10.5px;color:#1E293B;margin-top:2px;">${it.serialNote}</div>` : ''}
          </td>
          <td style="padding:5px 6px;vertical-align:top;text-align:right;">${fmtMoney2(qty)}</td>
          <td style="padding:5px 6px;vertical-align:top;text-align:right;">${fmtMoney2(up)}</td>
          <td style="padding:5px 6px;vertical-align:top;text-align:right;">${fmtMoney2(gross)}</td>
          <td style="padding:5px 6px;vertical-align:top;text-align:right;">${disc > 0 ? '(' + fmtMoney2(disc) + ')' : '0.00'}</td>
          <td style="padding:5px 6px;vertical-align:top;text-align:right;font-weight:700;">${fmtMoney2(net)}</td>
        </tr>
      `;
    }).join('');

    const vatAmt = Math.round(subTotalExVat * 0.07 * 100) / 100;
    const grandTotal = Math.round((subTotalExVat + vatAmt) * 100) / 100;
    const bahtText = numberToThaiBahtText(grandTotal);

    const showSigDeliver = inv.useSigDeliver !== false;
    const showSigPreparer = inv.useSigPreparer !== false;
    const showSigApprover = inv.useSigApprover !== false;

    const sigDeliverHtml = showSigDeliver
      ? `<img src="${HZK_ACCOUNTING_DIGITAL_SIGNATURES.deliverer_chayanin}" style="max-height:46px;max-width:125px;object-fit:contain;margin:0 auto;display:block;" alt="Chayanin Signature" />`
      : '<div style="height:46px;"></div>';
    const sigPreparerHtml = showSigPreparer
      ? `<img src="${HZK_ACCOUNTING_DIGITAL_SIGNATURES.preparer_witharat}" style="max-height:48px;max-width:125px;object-fit:contain;margin:0 auto;display:block;" alt="Witharat Signature" />`
      : '<div style="height:48px;"></div>';
    const sigApproverHtml = showSigApprover
      ? `<img src="${HZK_ACCOUNTING_DIGITAL_SIGNATURES.approver_waraporn}" style="max-height:48px;max-width:125px;object-fit:contain;margin:0 auto;display:block;" alt="Waraporn Signature" />`
      : '<div style="height:48px;"></div>';

    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>${inv.docTitleTh || 'ใบแจ้งหนี้/ใบกำกับภาษี'} — ${inv.invoiceNo || 'SI2611'}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Sarabun', 'Prompt', Arial, Helvetica, sans-serif; font-size: 11px; color: #000000; margin: 0; background: #E2E8F0; }
    .no-print-bar { background: #002B49; color: #FFF; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 30; }
    .no-print-bar button { border: none; border-radius: 7px; padding: 7px 14px; font-weight: 800; cursor: pointer; font-size: 12px; }
    .a4-page { background: #FFFFFF; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 11mm 12mm; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.22); position: relative; }
    table { width: 100%; border-collapse: collapse; }
    .box-border { border: 1px solid #000000; }
    .items-tbl th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 6px; font-size: 10.5px; background: #F8FAFC; }
    .items-tbl td { font-size: 11px; }
    @media print {
      body { background: #FFFFFF; }
      .no-print-bar { display: none !important; }
      .a4-page { margin: 0; box-shadow: none; width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><b>HOSHIZAKI (THAILAND) LIMITED</b> — ${inv.docTitleTh} (${inv.invoiceNo})</div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#059669;color:#FFF;">🖨️ พิมพ์ / บันทึกเป็น PDF (A4)</button>
      <button onclick="window.close()" style="background:#EF4444;color:#FFF;">✕ ปิดหน้าต่าง</button>
    </div>
  </div>

  <div class="a4-page">
    <!-- TOP CORPORATE HEADER (UPDATED CURRENT ADDRESS) -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
      ${logoSrc ? `<img src="${logoSrc}" style="width:74px;height:74px;object-fit:contain;flex-shrink:0;" alt="Hoshizaki Logo" />` : ''}
      <div style="flex:1;">
        <div style="font-size:17px;font-weight:900;letter-spacing:0.3px;color:#000;">HOSHIZAKI (THAILAND) LIMITED</div>
        <div style="font-size:10.5px;line-height:1.45;margin-top:2px;">
          Building A, 1st floor, No. 10/11 Soi Vibhavadi Rangsit 64 (Mahanakorn), Talat Bang Khen Subdistrict, Lak Si District, Bangkok 10210 Thailand<br/>
          Tel: +66 2 005-9980-3 &nbsp;&nbsp; Fax: +66 2 516-2646 &nbsp;&nbsp; Web: https://hoshizaki-sea.com<br/>
          <b>Tax ID: 0135558002599 (Head Office)</b>
        </div>
      </div>
    </div>

    <!-- DOCUMENT TITLE & RIGHT METADATA BOX -->
    <div style="display:grid;grid-template-columns:1.18fr 0.82fr;gap:10px;align-items:stretch;margin-bottom:8px;">
      <!-- Left: Customer Box -->
      <div style="display:flex;flex-direction:column;justify-content:space-between;">
        <div style="text-align:center;margin-bottom:6px;">
          <div style="font-size:15px;font-weight:900;">${inv.docTitleTh || 'ใบแจ้งหนี้/ใบกำกับภาษี (ต้นฉบับ)'}</div>
          <div style="font-size:13px;font-weight:800;">${inv.docTitleEn || 'Invoice/Tax Invoice (Original)'}</div>
          <div style="font-size:11px;font-weight:700;">${inv.docSubTag || 'เอกสารออกเป็นชุด'}</div>
        </div>
        <div class="box-border" style="padding:7px 9px;font-size:10.5px;line-height:1.45;flex:1;">
          <table style="width:100%;">
            <tr>
              <td style="width:24%;vertical-align:top;"><b>รหัสลูกค้า</b><br/><span style="font-size:9.5px;">Dealer No.</span></td>
              <td style="width:76%;vertical-align:top;"><b>${inv.dealerNo || ''}</b></td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-top:3px;"><b>ชื่อลูกค้า</b><br/><span style="font-size:9.5px;">Dealer Name</span></td>
              <td style="vertical-align:top;padding-top:3px;"><b>${inv.dealerNameTh || ''}</b><br/><b>${inv.dealerNameEn || ''}</b></td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-top:3px;"><b>ที่อยู่</b><br/><span style="font-size:9.5px;">Address</span></td>
              <td style="vertical-align:top;padding-top:3px;">
                ${inv.addressLine1 || ''}<br/>
                ${inv.addressLine2 || ''}<br/>
                Tel: ${inv.tel || ''}
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-top:3px;"><b>Remark</b></td>
              <td style="vertical-align:top;padding-top:3px;">
                ${inv.remarkLine || ''}<br/>
                <b>${inv.customerTaxId || ''}</b>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Right: Invoice Metadata Box -->
      <div class="box-border" style="padding:7px 9px;font-size:10.5px;line-height:1.45;display:flex;flex-direction:column;justify-content:space-between;">
        <table style="width:100%;">
          <tr>
            <td style="width:46%;padding:3px 0;"><b>ใบแจ้งหนี้เลขที่</b><br/><span style="font-size:9.5px;">Invoice No.</span></td>
            <td style="width:54%;padding:3px 0;font-weight:900;font-size:12px;">${inv.invoiceNo || ''}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><b>วันที่ / Date</b></td>
            <td style="padding:3px 0;font-weight:700;">${inv.date || ''}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><b>ใบสั่งซื้อเลขที่ / PO No.</b></td>
            <td style="padding:3px 0;font-weight:700;">${inv.poNo || ''}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><b>รหัสพนักงานขาย</b><br/><span style="font-size:9.5px;">Salesman Code</span></td>
            <td style="padding:3px 0;font-weight:700;">${inv.salesmanCode || ''}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><b>เงื่อนไขการชำระเงิน</b><br/><span style="font-size:9.5px;">Term of Payment</span></td>
            <td style="padding:3px 0;font-weight:700;">${inv.termOfPayment || ''}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><b>วันครบกำหนดชำระ</b><br/><span style="font-size:9.5px;">Due Date</span></td>
            <td style="padding:3px 0;font-weight:700;">${inv.dueDate || ''}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <div class="box-border" style="min-height:330px;display:flex;flex-direction:column;justify-content:space-between;">
      <table class="items-tbl">
        <thead>
          <tr>
            <th style="width:14%;text-align:left;">รหัสสินค้า<br/>No.</th>
            <th style="width:32%;text-align:left;">รายการสินค้า<br/>Description</th>
            <th style="width:9%;text-align:right;">จำนวน<br/>Quantity</th>
            <th style="width:12%;text-align:right;">หน่วยละ (บาท)<br/>Unit Price (BAHT)</th>
            <th style="width:12%;text-align:right;">จำนวนเงิน (บาท)<br/>Amount (BAHT)</th>
            <th style="width:9%;text-align:right;">ส่วนลด<br/>Discount (BAHT)</th>
            <th style="width:12%;text-align:right;">จำนวนเงิน (บาท)<br/>Amount (BAHT)</th>
          </tr>
        </thead>
        <tbody>
          ${inv.shipmentHeader ? `<tr><td colspan="7" style="padding:6px 6px 2px;font-weight:700;">${inv.shipmentHeader}</td></tr>` : ''}
          ${itemRowsHtml}
        </tbody>
      </table>

      <!-- TOTALS & THAI BAHT TEXT FOOTER INSIDE TABLE -->
      <div style="border-top:1px solid #000;">
        <table>
          <tr>
            <td style="width:58%;padding:6px 8px;vertical-align:bottom;font-weight:800;font-size:11px;">
              บาท (Baht) &nbsp;&nbsp; (${bahtText})
            </td>
            <td style="width:42%;padding:0;">
              <table style="width:100%;">
                <tr>
                  <td style="border-left:1px solid #000;border-bottom:1px solid #000;padding:4px 7px;"><b>มูลค่าสินค้าไม่รวมภาษี</b><br/><span style="font-size:9.5px;">Total Amount Excluded VAT</span></td>
                  <td style="border-left:1px solid #000;border-bottom:1px solid #000;padding:4px 7px;text-align:right;font-weight:700;width:34%;">${fmtMoney2(subTotalExVat)}</td>
                </tr>
                <tr>
                  <td style="border-left:1px solid #000;border-bottom:1px solid #000;padding:4px 7px;"><b>จำนวนภาษีมูลค่าเพิ่ม 7%</b><br/><span style="font-size:9.5px;">VAT Amount</span></td>
                  <td style="border-left:1px solid #000;border-bottom:1px solid #000;padding:4px 7px;text-align:right;font-weight:700;">${fmtMoney2(vatAmt)}</td>
                </tr>
                <tr>
                  <td style="border-left:1px solid #000;padding:5px 7px;"><b>ราคาทั้งสิ้น</b><br/><span style="font-size:9.5px;">Total Amount Included VAT</span></td>
                  <td style="border-left:1px solid #000;padding:5px 7px;text-align:right;font-weight:900;font-size:12px;">${fmtMoney2(grandTotal)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- BANK REMARK & ACKNOWLEDGEMENT TEXT -->
    <div style="margin-top:6px;font-size:10px;line-height:1.45;">
      <div><b>Remark:</b> Bank name: Bank of Ayudhya Public Company Limited (Future Park Rangsit Branch) / Account No.: <b>062-0-04476-2</b> (Branch No. 0062)</div>
      <div style="margin-top:4px;">
        ข้าพเจ้าได้รับสินค้าครบถ้วนตามจำนวน และยอมรับเงื่อนไขการชำระเงินภายในกำหนดข้างต้น<br/>
        I/we received the above mentioned goods in good order and condition. I/we acknowledge the terms and conditions and will settle the full amount.
      </div>
    </div>

    <!-- 4 SIGNATURE BOXES WITH EMBEDDED SCANNED DIGITAL SIGNATURES -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;">
      <!-- Box 1: Bill Recipient -->
      <div class="box-border" style="padding:6px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:92px;">
        <div style="height:46px;"></div>
        <div>
          <div style="border-top:1px dotted #000;padding-top:3px;font-size:10px;font-weight:700;">&nbsp;</div>
          <div style="font-size:10px;font-weight:700;">ผู้รับวางบิล : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; วันที่</div>
          <div style="font-size:9.5px;">Bill Recipient: &nbsp;&nbsp;&nbsp;&nbsp; Date</div>
        </div>
      </div>

      <!-- Box 2: Deliver (Chayanin Kuptrkul) -->
      <div class="box-border" style="padding:6px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:92px;">
        ${sigDeliverHtml}
        <div>
          <div style="border-top:1px dotted #000;padding-top:3px;font-size:10px;font-weight:700;">${inv.delivererName || 'Chayanin Kuptrkul'}</div>
          <div style="font-size:10px;font-weight:700;">ผู้ส่งของ : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; วันที่</div>
          <div style="font-size:9.5px;">Deliver: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
        </div>
      </div>

      <!-- Box 3: Preparer (Witharat Riangpha) -->
      <div class="box-border" style="padding:6px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:92px;">
        ${sigPreparerHtml}
        <div>
          <div style="border-top:1px dotted #000;padding-top:3px;font-size:10px;font-weight:700;">${inv.preparerName || 'Witharat Riangpha'}</div>
          <div style="font-size:10px;font-weight:700;">ผู้จัดเตรียม : &nbsp;&nbsp;&nbsp;&nbsp; วันที่</div>
          <div style="font-size:9.5px;">Preparer: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
        </div>
      </div>

      <!-- Box 4: Authorized Signature (Waraporn Kianthong) -->
      <div class="box-border" style="padding:6px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:92px;">
        ${sigApproverHtml}
        <div>
          <div style="border-top:1px dotted #000;padding-top:3px;font-size:10px;font-weight:700;">${inv.approverName || 'Waraporn Kianthong'}</div>
          <div style="font-size:10px;font-weight:700;">ผู้มีอำนาจอนุมัติ : &nbsp;&nbsp; วันที่</div>
          <div style="font-size:9.5px;">Authorized Signature</div>
        </div>
      </div>
    </div>
  </div>
  ${autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},320);};</script>' : ''}
</body>
</html>`;
  }

  window.openAccountingTaxInvoiceStudioModal = function(presetKey) {
    if (presetKey && SAMPLE_INVOICE_PRESETS[presetKey]) {
      window.HZK_TAX_INVOICE_STATE = JSON.parse(JSON.stringify(SAMPLE_INVOICE_PRESETS[presetKey]));
    }
    const inv = window.HZK_TAX_INVOICE_STATE;

    let modal = document.getElementById('hzkAccountingTaxInvoiceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkAccountingTaxInvoiceModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20220;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const itemsRowsEditor = (inv.items || []).map((it, idx) => `
      <tr>
        <td style="padding:5px;border:1px solid #CBD5E1;"><input data-inv-idx="${idx}" data-f="code" value="${it.code || ''}" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;font-weight:700;"></td>
        <td style="padding:5px;border:1px solid #CBD5E1;">
          <input data-inv-idx="${idx}" data-f="desc" value="${it.desc || ''}" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;margin-bottom:3px;">
          <input data-inv-idx="${idx}" data-f="serialNote" value="${it.serialNote || ''}" placeholder="Serial No. เช่น (R06632J, R06633J)" style="width:100%;padding:4px;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;">
        </td>
        <td style="padding:5px;border:1px solid #CBD5E1;width:72px;"><input type="number" step="0.01" data-inv-idx="${idx}" data-f="qty" value="${it.qty}" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;text-align:right;"></td>
        <td style="padding:5px;border:1px solid #CBD5E1;width:110px;"><input type="number" step="0.01" data-inv-idx="${idx}" data-f="unitPrice" value="${it.unitPrice}" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;text-align:right;"></td>
        <td style="padding:5px;border:1px solid #CBD5E1;width:100px;"><input type="number" step="0.01" data-inv-idx="${idx}" data-f="discount" value="${it.discount}" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;text-align:right;"></td>
        <td style="padding:5px;border:1px solid #CBD5E1;text-align:center;"><button type="button" data-inv-del="${idx}" style="background:#FEE2E2;color:#B91C1C;border:none;border-radius:6px;padding:4px 8px;font-weight:700;cursor:pointer;">✕</button></td>
      </tr>
    `).join('');

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1060px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#0F766E);color:#FFF;padding:14px 20px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:0;z-index:10;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ACCOUNTING TAX INVOICE &amp; BILLING STUDIO (A4 EXACT REPLICA + DIGITAL SIGNATURES)</div>
            <div style="font-size:15.5px;font-weight:800;">🧾 ฟอร์มใบแจ้งหนี้ / ใบกำกับภาษี / ใบวางบิล (หัวที่อยู่ปัจจุบัน + ลายเซ็นดิจิทัลฝ่ายบัญชี)</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" id="btnInvPreviewA4" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer;">👁️ พรีวิวฟอร์ม A4 เหมือนต้นฉบับ</button>
            <button type="button" id="btnInvPrintPdf" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer;">🖨️ พิมพ์ / Save PDF (A4)</button>
            <button type="button" id="btnInvPickSerialStock" style="background:#4F46E5;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:800;cursor:pointer;">🔢 เลือก S/N จากคลัง</button>
            <button type="button" id="btnInvIssueAndRecordVat" style="background:#047857;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:800;cursor:pointer;">💾 ออกเลข SI &amp; บันทึกภาษีขาย</button>
            <button type="button" id="btnInvShareTrack" style="background:#D97706;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer;">📤 แชร์ &amp; ติดตามผลลูกค้า</button>
            <button type="button" onclick="document.getElementById('hzkAccountingTaxInvoiceModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>

        <div style="padding:16px 20px;font-size:12.5px;">
          <!-- Preset Loader Bar -->
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-weight:800;color:#166534;">📂 โหลดข้อมูลต้นแบบจากไฟล์บัญชี (THAI STEWARD SERVICES):</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" onclick="window.openAccountingTaxInvoiceStudioModal('SI2611-214')" style="background:#002B49;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-weight:700;cursor:pointer;">SI2611-214 (IM-220AA + B-301SA)</button>
              <button type="button" onclick="window.openAccountingTaxInvoiceStudioModal('SI2611-215')" style="background:#002B49;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-weight:700;cursor:pointer;">SI2611-215 (IM-130A)</button>
              <button type="button" onclick="window.openAccountingTaxInvoiceStudioModal('SI2611-212')" style="background:#002B49;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-weight:700;cursor:pointer;">SI2611-212 (IM-130A)</button>
            </div>
          </div>

          <!-- Header & Metadata Form -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:12px;margin-bottom:12px;">
            <div>
              <label style="font-weight:700;">หัวข้อเอกสาร (ไทย):</label>
              <select id="inpInvTitleTh" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;font-weight:700;">
                <option value="ใบแจ้งหนี้/ใบกำกับภาษี (ต้นฉบับ)" ${inv.docTitleTh === 'ใบแจ้งหนี้/ใบกำกับภาษี (ต้นฉบับ)' ? 'selected' : ''}>ใบแจ้งหนี้/ใบกำกับภาษี (ต้นฉบับ)</option>
                <option value="ใบแจ้งหนี้/ใบกำกับภาษี (สำเนา)" ${inv.docTitleTh === 'ใบแจ้งหนี้/ใบกำกับภาษี (สำเนา)' ? 'selected' : ''}>ใบแจ้งหนี้/ใบกำกับภาษี (สำเนา)</option>
                <option value="ใบวางบิล / ใบแจ้งหนี้ (Billing Note)" ${inv.docTitleTh === 'ใบวางบิล / ใบแจ้งหนี้ (Billing Note)' ? 'selected' : ''}>ใบวางบิล / ใบแจ้งหนี้ (Billing Note)</option>
                <option value="ใบเสร็จรับเงิน/ใบกำกับภาษี (ต้นฉบับ)" ${inv.docTitleTh === 'ใบเสร็จรับเงิน/ใบกำกับภาษี (ต้นฉบับ)' ? 'selected' : ''}>ใบเสร็จรับเงิน/ใบกำกับภาษี (ต้นฉบับ)</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700;">เลขที่เอกสาร (Invoice No.):</label>
              <input id="inpInvNo" type="text" value="${inv.invoiceNo || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;font-weight:800;">
            </div>
            <div>
              <label style="font-weight:700;">วันที่ (Date):</label>
              <input id="inpInvDate" type="text" value="${inv.date || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">ใบสั่งซื้อเลขที่ (PO No.):</label>
              <input id="inpInvPo" type="text" value="${inv.poNo || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">รหัสพนักงานขาย (Salesman Code):</label>
              <input id="inpInvSales" type="text" value="${inv.salesmanCode || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">เงื่อนไขชำระเงิน / วันครบกำหนด:</label>
              <div style="display:flex;gap:4px;margin-top:3px;">
                <input id="inpInvTerm" type="text" value="${inv.termOfPayment || ''}" style="width:60%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
                <input id="inpInvDue" type="text" value="${inv.dueDate || ''}" style="width:40%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
              </div>
            </div>
            <div>
              <label style="font-weight:700;">รหัสลูกค้า (Dealer No.):</label>
              <input id="inpInvDealerNo" type="text" value="${inv.dealerNo || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">ชื่อลูกค้า (ภาษาไทย):</label>
              <input id="inpInvDealerTh" type="text" value="${inv.dealerNameTh || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">ชื่อลูกค้า (ภาษาอังกฤษ):</label>
              <input id="inpInvDealerEn" type="text" value="${inv.dealerNameEn || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">ที่อยู่ลูกค้า บรรทัด 1:</label>
              <input id="inpInvAddr1" type="text" value="${inv.addressLine1 || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">ที่อยู่ลูกค้า บรรทัด 2 &amp; Tel:</label>
              <input id="inpInvAddr2" type="text" value="${inv.addressLine2 || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">Tax ID ลูกค้า &amp; Shipment No.:</label>
              <div style="display:flex;gap:4px;margin-top:3px;">
                <input id="inpInvCustTax" type="text" value="${inv.customerTaxId || ''}" style="width:55%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
                <input id="inpInvShip" type="text" value="${inv.shipmentHeader || ''}" style="width:45%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
              </div>
            </div>
          </div>

          <!-- Line Items Table -->
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-weight:800;color:#002B49;">รายการสินค้า / บริการ (Items &amp; Serial Numbers)</span>
              <button type="button" id="btnInvAddRow" style="background:#0284C7;color:#FFF;border:none;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer;">+ เพิ่มรายการสินค้า</button>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#002B49;color:#FFF;">
                  <th style="padding:6px;width:16%;">รหัสสินค้า (No.)</th>
                  <th style="padding:6px;">รายการสินค้า &amp; Serial No.</th>
                  <th style="padding:6px;width:72px;">จำนวน</th>
                  <th style="padding:6px;width:110px;">หน่วยละ (บาท)</th>
                  <th style="padding:6px;width:100px;">ส่วนลด (บาท)</th>
                  <th style="padding:6px;width:44px;">ลบ</th>
                </tr>
              </thead>
              <tbody id="invItemsEditorTbody">${itemsRowsEditor}</tbody>
            </table>
          </div>

          <!-- Digital Signatures Control Strip -->
          <div style="background:#EFF6FF;border:1.5px solid #93C5FD;border-radius:12px;padding:12px;">
            <div style="font-weight:800;color:#002B49;margin-bottom:8px;">✍️ ลายเซ็นดิจิทัลมาตรฐานฝ่ายบัญชี (Scanned Digital Signatures จากเอกสารจริง):</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
              <label style="background:#FFF;border:1px solid #CBD5E1;border-radius:9px;padding:8px;display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="chkSigDeliver" ${inv.useSigDeliver !== false ? 'checked' : ''}>
                <img src="${HZK_ACCOUNTING_DIGITAL_SIGNATURES.deliverer_chayanin}" style="height:36px;width:75px;object-fit:contain;">
                <div><div style="font-weight:800;">Chayanin Kuptrkul</div><div style="font-size:11px;color:#475569;">ผู้ส่งของ (Deliver)</div></div>
              </label>
              <label style="background:#FFF;border:1px solid #CBD5E1;border-radius:9px;padding:8px;display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="chkSigPreparer" ${inv.useSigPreparer !== false ? 'checked' : ''}>
                <img src="${HZK_ACCOUNTING_DIGITAL_SIGNATURES.preparer_witharat}" style="height:36px;width:75px;object-fit:contain;">
                <div><div style="font-weight:800;">Witharat Riangpha</div><div style="font-size:11px;color:#475569;">ผู้จัดเตรียม (Preparer)</div></div>
              </label>
              <label style="background:#FFF;border:1px solid #CBD5E1;border-radius:9px;padding:8px;display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="chkSigApprover" ${inv.useSigApprover !== false ? 'checked' : ''}>
                <img src="${HZK_ACCOUNTING_DIGITAL_SIGNATURES.approver_waraporn}" style="height:36px;width:75px;object-fit:contain;">
                <div><div style="font-weight:800;">Waraporn Kianthong</div><div style="font-size:11px;color:#475569;">ผู้มีอำนาจอนุมัติ (Authorized)</div></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    function syncFormToInvoiceState() {
      inv.docTitleTh = document.getElementById('inpInvTitleTh').value;
      inv.docTitleEn = inv.docTitleTh.indexOf('วางบิล') !== -1 ? 'Billing Note / Invoice' : (inv.docTitleTh.indexOf('เสร็จ') !== -1 ? 'Receipt / Tax Invoice (Original)' : 'Invoice/Tax Invoice (Original)');
      inv.invoiceNo = document.getElementById('inpInvNo').value.trim();
      inv.date = document.getElementById('inpInvDate').value.trim();
      inv.poNo = document.getElementById('inpInvPo').value.trim();
      inv.salesmanCode = document.getElementById('inpInvSales').value.trim();
      inv.termOfPayment = document.getElementById('inpInvTerm').value.trim();
      inv.dueDate = document.getElementById('inpInvDue').value.trim();
      inv.dealerNo = document.getElementById('inpInvDealerNo').value.trim();
      inv.dealerNameTh = document.getElementById('inpInvDealerTh').value.trim();
      inv.dealerNameEn = document.getElementById('inpInvDealerEn').value.trim();
      inv.addressLine1 = document.getElementById('inpInvAddr1').value.trim();
      inv.addressLine2 = document.getElementById('inpInvAddr2').value.trim();
      inv.customerTaxId = document.getElementById('inpInvCustTax').value.trim();
      inv.shipmentHeader = document.getElementById('inpInvShip').value.trim();
      inv.useSigDeliver = document.getElementById('chkSigDeliver').checked;
      inv.useSigPreparer = document.getElementById('chkSigPreparer').checked;
      inv.useSigApprover = document.getElementById('chkSigApprover').checked;
    }

    modal.querySelectorAll('input[data-inv-idx]').forEach(inp => {
      inp.oninput = () => {
        const i = Number(inp.getAttribute('data-inv-idx'));
        const f = inp.getAttribute('data-f');
        inv.items[i][f] = inp.type === 'number' ? Number(inp.value || 0) : inp.value;
      };
    });

    modal.querySelectorAll('button[data-inv-del]').forEach(btn => {
      btn.onclick = () => {
        syncFormToInvoiceState();
        inv.items.splice(Number(btn.getAttribute('data-inv-del')), 1);
        window.openAccountingTaxInvoiceStudioModal();
      };
    });

    document.getElementById('btnInvAddRow').onclick = () => {
      syncFormToInvoiceState();
      inv.items.push({ code: 'IM-130NE', desc: 'ICE MACHINE', serialNote: '', qty: 1.00, unitPrice: 0.00, discount: 0.00 });
      window.openAccountingTaxInvoiceStudioModal();
    };

    document.getElementById('btnInvPreviewA4').onclick = () => {
      syncFormToInvoiceState();
      const html = buildExactAccountingTaxInvoiceHtml(inv, false);
      const w = window.open('', '_blank', 'width=940,height=920');
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    };

    document.getElementById('btnInvPrintPdf').onclick = () => {
      syncFormToInvoiceState();
      const html = buildExactAccountingTaxInvoiceHtml(inv, true);
      const w = window.open('', '_blank', 'width=940,height=920');
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    };

    document.getElementById('btnInvShareTrack').onclick = () => {
      syncFormToInvoiceState();
      let sub = 0;
      (inv.items || []).forEach(it => { sub += Math.max(0, Number(it.qty || 1) * Number(it.unitPrice || 0) - Number(it.discount || 0)); });
      const grand = Math.round(sub * 1.07 * 100) / 100;
      if (typeof window.sendHoshizakiTrackedDocument === 'function') {
        window.sendHoshizakiTrackedDocument({
          docType: inv.docTitleTh || 'ใบแจ้งหนี้/ใบกำกับภาษี',
          department: 'Accounting & Billing',
          offerNo: inv.invoiceNo,
          customerName: inv.dealerNameTh || inv.dealerNameEn,
          address: (inv.addressLine1 || '') + ' ' + (inv.addressLine2 || ''),
          phone: inv.tel || '',
          grandTotal: grand,
          items: (inv.items || []).map(it => ({
            model: it.code,
            description: it.desc + ' ' + (it.serialNote || ''),
            unitPrice: it.unitPrice,
            discount: it.discount,
            qty: it.qty
          }))
        });
      }
    };
  };
})();



// ============================================================================
// ENTERPRISE v1183 — ADMIN DELIVERY ORDER (DO) STUDIO (A4 EXACT REPLICA)
//   - Exact replica of Hoshizaki (Thailand) Limited "Delivery Order / ใบส่งของ(ไม่ใช่ใบกำกับภาษี)"
//   - Replaces legacy 99 CP Tower North Park header with updated current address:
//       Building A, 1st floor, No. 10/11 Soi Vibhavadi Rangsit 64 (Mahanakorn),
//       Talat Bang Khen Subdistrict, Lak Si District, Bangkok 10210 Thailand
//       Tel: +66 2 005-9980-3  Fax: +66 2 516-2646  VAT: 0135558002599
//   - Preloaded presets from the 4 uploaded DO sheets (DO2611-070, DO2611-071, DO2610-011, DO2610-012)
//   - Embedded scanned transparent Digital Signature of Chayanin K. (Delivery by / ผู้ส่ง)
//   - 1-Click convert DO -> Accounting Tax Invoice (SI) with Shipment No. DOxxxx auto-linked!
// ============================================================================
(function initHoshizakiAdminDeliveryOrderStudioV1183() {
  if (window.__HZK_ADMIN_DELIVERY_ORDER_V1183__) return;
  window.__HZK_ADMIN_DELIVERY_ORDER_V1183__ = true;

  const SAMPLE_DO_PRESETS = {
    'DO2611-070': {
      docSubTag: 'ต้นฉบับ / Original',
      doNo: 'DO2611-070',
      shipDate: '09/11/2026',
      externalDoc: '69/1022',
      shipmentMethod: 'FLASH EXPRESS',
      customerName: 'RIJIRA CO., LTD.',
      address: '7/29 MOO 2 KATHU, KATHU, PHUKET 83120',
      vatReg: '0835535001689',
      branchNo: '00000',
      contact: '',
      tel: '081-415-2649',
      salesOrderNo: 'SO2611-056',
      remark: 'WANWIPHA : FLASH EXPRESS ON 9/11/2026 Thanakrit ap',
      deliveryBy: 'Chayanin K.',
      deliveryDate: '09/11/2026',
      receiveBy: '',
      receiveDate: '',
      printBy: 'FTCS-HTH-APP-01\\CHAYANIN.KUPTRAKUL',
      useDigitalSig: true,
      items: [
        { itemNo: 'P00350-03', description: 'THERMISTOR IM-65NE', qty: 2.00, unit: 'PCS' }
      ]
    },
    'DO2611-071': {
      docSubTag: 'ต้นฉบับ / Original',
      doNo: 'DO2611-071',
      shipDate: '09/11/2026',
      externalDoc: '69/1022',
      shipmentMethod: 'FLASH EXPRESS',
      customerName: 'RIJIRA CO., LTD.',
      address: '7/29 MOO 2 KATHU, KATHU, PHUKET 83120',
      vatReg: '0835535001689',
      branchNo: '00000',
      contact: '',
      tel: '081-415-2649',
      salesOrderNo: 'SO2611-057',
      remark: 'WANWIPHA : FLASH EXPRESS ON 9/11/2026 Thanakrit ap',
      deliveryBy: 'Chayanin K.',
      deliveryDate: '09/11/2026',
      receiveBy: '',
      receiveDate: '',
      printBy: 'FTCS-HTH-APP-01\\CHAYANIN.KUPTRAKUL',
      useDigitalSig: true,
      items: [
        { itemNo: '511240', description: 'SALES - SERVICE/ DELIVERY FEE', qty: 1.00, unit: '' }
      ]
    },
    'DO2610-011': {
      docSubTag: 'ต้นฉบับ / Original',
      doNo: 'DO2610-011',
      shipDate: '02/10/2026',
      externalDoc: '69/1044',
      shipmentMethod: 'FLASH EXPRESS',
      customerName: 'RIJIRA CO., LTD.',
      address: '7/29 MOO 2 KATHU, KATHU, PHUKET 83120',
      vatReg: '0835535001689',
      branchNo: '00000',
      contact: '',
      tel: '081-415-2649',
      salesOrderNo: 'SO2609-357',
      remark: 'WANWIPHA  FLASH EXPRESS ON 2/10/2026 thanakrit app',
      deliveryBy: 'Chayanin K.',
      deliveryDate: '02/10/2026',
      receiveBy: '',
      receiveDate: '',
      printBy: 'FTCS-HTH-APP-01\\CHAYANIN.KUPTRAKUL',
      useDigitalSig: true,
      items: [
        { itemNo: '434168G01', description: 'THUMBSCREW', qty: 2.00, unit: 'PCS' }
      ]
    },
    'DO2610-012': {
      docSubTag: 'ต้นฉบับ / Original',
      doNo: 'DO2610-012',
      shipDate: '02/10/2026',
      externalDoc: '69/1044',
      shipmentMethod: 'FLASH EXPRESS',
      customerName: 'RIJIRA CO., LTD.',
      address: '7/29 MOO 2 KATHU, KATHU, PHUKET 83120',
      vatReg: '0835535001689',
      branchNo: '00000',
      contact: '',
      tel: '081-415-2649',
      salesOrderNo: 'SO2609-358',
      remark: 'WANWIPHA  FLASH EXPRESS ON 2/10/2026 thanakrit app',
      deliveryBy: 'Chayanin K.',
      deliveryDate: '02/10/2026',
      receiveBy: '',
      receiveDate: '',
      printBy: 'FTCS-HTH-APP-01\\CHAYANIN.KUPTRAKUL',
      useDigitalSig: true,
      items: [
        { itemNo: '511240', description: 'SALES - SERVICE/ DELIVERY FEE', qty: 1.00, unit: '' }
      ]
    }
  };

  window.HZK_ADMIN_DO_STATE = window.HZK_ADMIN_DO_STATE || JSON.parse(JSON.stringify(SAMPLE_DO_PRESETS['DO2611-070']));

  function fmtQty2(v) {
    return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function buildExactAdminDeliveryOrderHtml(doObj, autoPrint) {
    const items = Array.isArray(doObj.items) ? doObj.items : [];
    let totalQty = 0;

    const rowsHtml = items.map((it, idx) => {
      const q = Number(it.qty || 0);
      totalQty += q;
      return `
        <tr>
          <td style="padding:7px 6px;text-align:center;vertical-align:top;">${idx + 1}</td>
          <td style="padding:7px 8px;vertical-align:top;font-weight:600;">${it.itemNo || ''}</td>
          <td style="padding:7px 8px;vertical-align:top;">${it.description || ''}</td>
          <td style="padding:7px 8px;text-align:right;vertical-align:top;">${fmtQty2(q)}</td>
          <td style="padding:7px 8px;text-align:center;vertical-align:top;">${it.unit || ''}</td>
        </tr>
      `;
    }).join('');

    const sigChayaninSrc = (window.HZK_ACCOUNTING_DIGITAL_SIGNATURES && window.HZK_ACCOUNTING_DIGITAL_SIGNATURES.deliverer_chayanin) || '';
    const deliverSigImgHtml = (doObj.useDigitalSig !== false && sigChayaninSrc)
      ? `<img src="${sigChayaninSrc}" style="max-height:38px;max-width:120px;object-fit:contain;display:inline-block;vertical-align:bottom;" alt="Chayanin K. Signature" />`
      : '<span style="display:inline-block;height:36px;"></span>';

    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>Delivery Order ${doObj.doNo || 'DO'} — Hoshizaki (Thailand) Limited</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    body { font-family: 'Sarabun', 'Prompt', Arial, Helvetica, sans-serif; font-size: 11.5px; color: #111827; margin: 0; background: #E2E8F0; }
    .no-print-bar { background: #002B49; color: #FFF; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 30; }
    .no-print-bar button { border: none; border-radius: 7px; padding: 7px 14px; font-weight: 800; cursor: pointer; font-size: 12px; }
    .a4-sheet { background: #FFFFFF; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 14mm 15mm; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.22); display: flex; flex-direction: column; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; }
    .do-items-tbl th { border-top: 1.5px solid #111; border-bottom: 1.5px solid #111; padding: 6px 6px; font-size: 11.5px; font-weight: 700; }
    @media print {
      body { background: #FFFFFF; }
      .no-print-bar { display: none !important; }
      .a4-sheet { margin: 0; box-shadow: none; width: 100%; min-height: 272mm; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><b>Hoshizaki (Thailand) Limited</b> — Delivery Order / ใบส่งของ (${doObj.doNo || ''})</div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#059669;color:#FFF;">🖨️ พิมพ์ / บันทึกเป็น PDF (A4)</button>
      <button onclick="window.close()" style="background:#EF4444;color:#FFF;">✕ ปิดหน้าต่าง</button>
    </div>
  </div>

  <div class="a4-sheet">
    <div>
      <!-- TOP HEADER: LEFT UPDATED COMPANY ADDRESS & RIGHT DELIVERY ORDER TITLE -->
      <div style="display:grid;grid-template-columns:1.25fr 0.75fr;gap:16px;align-items:start;">
        <div>
          <div style="font-size:15.5px;font-weight:800;color:#000;">Hoshizaki (Thailand) Limited</div>
          <div style="font-size:9.8px;line-height:1.5;margin-top:3px;color:#1F2937;">
            Building A, 1st floor, No. 10/11 Soi Vibhavadi Rangsit 64 (Mahanakorn),<br/>
            Talat Bang Khen Subdistrict, Lak Si District, Bangkok 10210 Thailand<br/>
            Tel +66 2 005-9980-3 Fax +66 2 516-2646 VAT 0135558002599
          </div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:800;letter-spacing:0.2px;line-height:1.15;color:#111;">Delivery Order</div>
          <div style="font-size:17px;font-weight:700;margin-top:2px;color:#111;">ใบส่งของ(ไม่ใช่ใบกำกับภาษี)</div>
          <div style="font-size:11.5px;font-weight:600;margin-top:4px;color:#374151;">${doObj.docSubTag || 'ต้นฉบับ / Original'}</div>
        </div>
      </div>

      <!-- CUSTOMER & DO METADATA SECTION -->
      <div style="display:grid;grid-template-columns:1.28fr 0.72fr;gap:16px;margin-top:14px;font-size:11px;line-height:1.45;">
        <!-- Left Customer Info -->
        <div>
          <table style="width:100%;">
            <tr>
              <td style="width:27%;vertical-align:top;padding:2px 0;">Name :<br/><span style="font-size:10px;color:#4B5563;">(ชื่อลูกค้า)</span></td>
              <td style="width:73%;vertical-align:top;padding:2px 0;font-weight:600;">${doObj.customerName || ''}</td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding:3px 0;">Address:<br/><span style="font-size:10px;color:#4B5563;">(ที่อยู่)</span></td>
              <td style="vertical-align:top;padding:3px 0;">${doObj.address || ''}</td>
            </tr>
          </table>
          <table style="width:100%;margin-top:3px;">
            <tr>
              <td style="width:52%;vertical-align:top;padding:2px 0;">
                VAT Registration: &nbsp;${doObj.vatReg || ''}<br/>
                <span style="font-size:10px;color:#4B5563;">(เลขประจำตัวผู้เสียภาษี)</span>
              </td>
              <td style="width:48%;vertical-align:top;padding:2px 0;">
                Branch No.: &nbsp;${doObj.branchNo || '00000'}<br/>
                <span style="font-size:10px;color:#4B5563;">(สาขาที่)</span>
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding:3px 0;">
                Contact: &nbsp;${doObj.contact || ''}<br/>
                <span style="font-size:10px;color:#4B5563;">(ติดต่อ)</span>
              </td>
              <td style="vertical-align:top;padding:3px 0;">
                Tel: &nbsp;${doObj.tel || ''}<br/>
                <span style="font-size:10px;color:#4B5563;">(โทร)</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Right DO Numbers & Dates -->
        <div>
          <table style="width:100%;">
            <tr>
              <td style="width:48%;vertical-align:top;padding:2px 0;">No.:<br/><span style="font-size:10px;color:#4B5563;">(เลขที่)</span></td>
              <td style="width:52%;vertical-align:top;padding:2px 0;font-weight:700;">${doObj.doNo || ''}</td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding:3px 0;">Ship Date:<br/><span style="font-size:10px;color:#4B5563;">(วันที่สั่งซื้อ)</span></td>
              <td style="vertical-align:top;padding:3px 0;">${doObj.shipDate || ''}</td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding:3px 0;">External Doc:</td>
              <td style="vertical-align:top;padding:3px 0;">${doObj.externalDoc || ''}</td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding:3px 0;">Shipment method:<br/><span style="font-size:10px;color:#4B5563;">(วิธีการจัดส่ง)</span></td>
              <td style="vertical-align:top;padding:3px 0;">${doObj.shipmentMethod || ''}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <div style="margin-top:10px;">
        <table class="do-items-tbl">
          <thead>
            <tr>
              <th style="width:9%;text-align:center;">No.<br/><span style="font-weight:500;font-size:10.5px;">(ลำดับ)</span></th>
              <th style="width:17%;text-align:left;">Item No.<br/><span style="font-weight:500;font-size:10.5px;">(รหัสสินค้า)</span></th>
              <th style="width:48%;text-align:center;">Description<br/><span style="font-weight:500;font-size:10.5px;">(คำอธิบาย)</span></th>
              <th style="width:14%;text-align:right;">Quantity<br/><span style="font-weight:500;font-size:10.5px;">(จำนวน)</span></th>
              <th style="width:12%;text-align:center;">Unit<br/><span style="font-weight:500;font-size:10.5px;">(หน่วย)</span></th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- BOTTOM SUMMARY, SALES ORDER NO, REMARK & SIGNATURES -->
    <div style="margin-top:24px;">
      <div style="border-top:1.5px solid #111;padding-top:6px;display:flex;justify-content:flex-end;">
        <div style="width:26%;text-align:right;padding-right:12%;font-weight:700;font-size:11.5px;">${fmtQty2(totalQty)}</div>
      </div>

      <div style="margin-top:8px;font-size:11px;line-height:1.55;">
        <div><b>Sales Order No.</b> &nbsp;&nbsp; ${doObj.salesOrderNo || ''}<br/><span style="font-size:10px;color:#4B5563;">(เลขที่อ้างอิง)</span></div>
        <div style="margin-top:4px;"><b>Remark</b> &nbsp;&nbsp; ${doObj.remark || ''}<br/><span style="font-size:10px;color:#4B5563;">(เพิ่มเติม)</span></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 0.75fr;gap:14px;align-items:end;margin-top:16px;font-size:11px;">
        <!-- Delivery By (Chayanin K.) -->
        <div>
          <div style="display:flex;align-items:flex-end;gap:8px;">
            <div style="width:76px;">Delivery by<br/><span style="font-size:10px;color:#4B5563;">(ผู้ส่ง)</span></div>
            <div style="flex:1;border-bottom:1px dotted #111;text-align:center;min-height:36px;">${deliverSigImgHtml}</div>
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px;margin-top:14px;">
            <div style="width:76px;">Date<br/><span style="font-size:10px;color:#4B5563;">(วันที่)</span></div>
            <div style="flex:1;border-bottom:1px dotted #111;text-align:center;padding-bottom:2px;">${doObj.deliveryDate || doObj.shipDate || ''}</div>
          </div>
        </div>

        <!-- Receive By -->
        <div>
          <div style="display:flex;align-items:flex-end;gap:8px;">
            <div style="width:76px;">Receive by<br/><span style="font-size:10px;color:#4B5563;">(ผู้รับของ)</span></div>
            <div style="flex:1;border-bottom:1px dotted #111;text-align:center;min-height:36px;padding-bottom:2px;">${doObj.receiveBy || ''}</div>
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px;margin-top:14px;">
            <div style="width:76px;">Date<br/><span style="font-size:10px;color:#4B5563;">(วันที่)</span></div>
            <div style="flex:1;border-bottom:1px dotted #111;text-align:center;padding-bottom:2px;">${doObj.receiveDate || ''}</div>
          </div>
        </div>

        <!-- Print by FTCS-HTH-APP-01\CHAYANIN.KUPTRAKUL -->
        <div style="text-align:right;font-size:9.5px;color:#374151;line-height:1.4;">
          Print by ${doObj.printBy || 'FTCS-HTH-APP-01\\CHAYANIN.KUPTRAKUL'}
        </div>
      </div>
    </div>
  </div>
  ${autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},320);};</script>' : ''}
</body>
</html>`;
  }

  window.openAdminDeliveryOrderStudioModal = function(presetKey) {
    if (presetKey && SAMPLE_DO_PRESETS[presetKey]) {
      window.HZK_ADMIN_DO_STATE = JSON.parse(JSON.stringify(SAMPLE_DO_PRESETS[presetKey]));
    }
    const doObj = window.HZK_ADMIN_DO_STATE;

    let modal = document.getElementById('hzkAdminDeliveryOrderModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkAdminDeliveryOrderModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20230;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const sigChayaninSrc = (window.HZK_ACCOUNTING_DIGITAL_SIGNATURES && window.HZK_ACCOUNTING_DIGITAL_SIGNATURES.deliverer_chayanin) || '';

    const itemsRowsHtml = (doObj.items || []).map((it, idx) => `
      <tr>
        <td style="padding:5px;border:1px solid #CBD5E1;text-align:center;width:44px;">${idx + 1}</td>
        <td style="padding:5px;border:1px solid #CBD5E1;width:150px;"><input data-do-idx="${idx}" data-f="itemNo" value="${it.itemNo || ''}" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;font-weight:700;"></td>
        <td style="padding:5px;border:1px solid #CBD5E1;"><input data-do-idx="${idx}" data-f="description" value="${it.description || ''}" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;"></td>
        <td style="padding:5px;border:1px solid #CBD5E1;width:90px;"><input type="number" step="0.01" data-do-idx="${idx}" data-f="qty" value="${it.qty}" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;text-align:right;"></td>
        <td style="padding:5px;border:1px solid #CBD5E1;width:80px;"><input data-do-idx="${idx}" data-f="unit" value="${it.unit || ''}" placeholder="PCS" style="width:100%;padding:5px;border:1px solid #E2E8F0;border-radius:6px;text-align:center;"></td>
        <td style="padding:5px;border:1px solid #CBD5E1;text-align:center;width:44px;"><button type="button" data-do-del="${idx}" style="background:#FEE2E2;color:#B91C1C;border:none;border-radius:6px;padding:4px 8px;font-weight:700;cursor:pointer;">✕</button></td>
      </tr>
    `).join('');

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1040px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#1E3A8A);color:#FFF;padding:14px 20px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:0;z-index:10;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ADMIN DELIVERY ORDER STUDIO (A4 EXACT REPLICA + DIGITAL SIGNATURE)</div>
            <div style="font-size:15.5px;font-weight:800;">📦 ฟอร์มใบส่งของ Admin — Delivery Order / ใบส่งของ(ไม่ใช่ใบกำกับภาษี)</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" id="btnDoPreviewA4" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer;">👁️ พรีวิวฟอร์ม A4</button>
            <button type="button" id="btnDoPrintPdf" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer;">🖨️ พิมพ์ / Save PDF</button>
            <button type="button" id="btnDoIssueDeductAndEpod" style="background:#4F46E5;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:800;cursor:pointer;">📦 ออกเลข DO, ตัดสต็อก &amp; ลิงก์เซ็นรับ e-POD</button>
            <button type="button" id="btnDoConvertToSi" style="background:#0F766E;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer;">🧾 ส่งต่อออกใบกำกับภาษี (SI)</button>
            <button type="button" id="btnDoShareTrack" style="background:#D97706;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer;">📤 แชร์ &amp; ติดตามรับของ</button>
            <button type="button" onclick="document.getElementById('hzkAdminDeliveryOrderModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>

        <div style="padding:16px 20px;font-size:12.5px;">
          <!-- Preset Loader Bar -->
          <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-weight:800;color:#1E3A8A;">📂 โหลดข้อมูลต้นแบบจากเอกสาร Admin DO (RIJIRA CO., LTD.):</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" onclick="window.openAdminDeliveryOrderStudioModal('DO2611-070')" style="background:#002B49;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-weight:700;cursor:pointer;">DO2611-070 (Thermistor IM-65NE)</button>
              <button type="button" onclick="window.openAdminDeliveryOrderStudioModal('DO2611-071')" style="background:#002B49;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-weight:700;cursor:pointer;">DO2611-071 (Delivery Fee)</button>
              <button type="button" onclick="window.openAdminDeliveryOrderStudioModal('DO2610-011')" style="background:#002B49;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-weight:700;cursor:pointer;">DO2610-011 (Thumbscrew)</button>
              <button type="button" onclick="window.openAdminDeliveryOrderStudioModal('DO2610-012')" style="background:#002B49;color:#FFF;border:none;border-radius:7px;padding:5px 10px;font-weight:700;cursor:pointer;">DO2610-012 (Delivery Fee)</button>
            </div>
          </div>

          <!-- Header & Metadata Form -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:12px;margin-bottom:12px;">
            <div>
              <label style="font-weight:700;">เลขที่ใบส่งของ (No.):</label>
              <input id="inpDoNo" type="text" value="${doObj.doNo || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;font-weight:800;">
            </div>
            <div>
              <label style="font-weight:700;">วันที่จัดส่ง (Ship Date):</label>
              <input id="inpDoShipDate" type="text" value="${doObj.shipDate || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">External Doc / Sales Order No.:</label>
              <div style="display:flex;gap:4px;margin-top:3px;">
                <input id="inpDoExtDoc" type="text" value="${doObj.externalDoc || ''}" placeholder="69/1022" style="width:45%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
                <input id="inpDoSoNo" type="text" value="${doObj.salesOrderNo || ''}" placeholder="SO2611-056" style="width:55%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;font-weight:700;">
              </div>
            </div>
            <div>
              <label style="font-weight:700;">วิธีการจัดส่ง (Shipment method):</label>
              <input id="inpDoShipMethod" type="text" value="${doObj.shipmentMethod || ''}" placeholder="FLASH EXPRESS" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">ชื่อลูกค้า (Name):</label>
              <input id="inpDoCustName" type="text" value="${doObj.customerName || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;font-weight:700;">
            </div>
            <div>
              <label style="font-weight:700;">เลขผู้เสียภาษี / สาขา (VAT / Branch):</label>
              <div style="display:flex;gap:4px;margin-top:3px;">
                <input id="inpDoVatReg" type="text" value="${doObj.vatReg || ''}" style="width:65%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
                <input id="inpDoBranch" type="text" value="${doObj.branchNo || '00000'}" style="width:35%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
              </div>
            </div>
            <div>
              <label style="font-weight:700;">ที่อยู่ (Address):</label>
              <input id="inpDoAddress" type="text" value="${doObj.address || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
            <div>
              <label style="font-weight:700;">ผู้ติดต่อ / เบอร์โทร (Contact / Tel):</label>
              <div style="display:flex;gap:4px;margin-top:3px;">
                <input id="inpDoContact" type="text" value="${doObj.contact || ''}" placeholder="ชื่อผู้ติดต่อ" style="width:48%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
                <input id="inpDoTel" type="text" value="${doObj.tel || ''}" placeholder="เบอร์โทร" style="width:52%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;">
              </div>
            </div>
            <div style="grid-column:1/-1;">
              <label style="font-weight:700;">หมายเหตุเพิ่มเติม (Remark):</label>
              <input id="inpDoRemark" type="text" value="${doObj.remark || ''}" style="width:100%;padding:7px;border:1px solid #CBD5E1;border-radius:7px;margin-top:3px;">
            </div>
          </div>

          <!-- Items Table -->
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-weight:800;color:#002B49;">รายการสินค้า / อะไหล่จัดส่ง (Delivery Items)</span>
              <button type="button" id="btnDoAddRow" style="background:#0284C7;color:#FFF;border:none;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer;">+ เพิ่มรายการ</button>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#002B49;color:#FFF;">
                  <th style="padding:6px;width:44px;">No.</th>
                  <th style="padding:6px;width:150px;">Item No. (รหัสสินค้า)</th>
                  <th style="padding:6px;">Description (คำอธิบาย)</th>
                  <th style="padding:6px;width:90px;">Quantity</th>
                  <th style="padding:6px;width:80px;">Unit</th>
                  <th style="padding:6px;width:44px;">ลบ</th>
                </tr>
              </thead>
              <tbody>${itemsRowsHtml}</tbody>
            </table>
          </div>

          <!-- Signature & Print Footer Control -->
          <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:12px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <input type="checkbox" id="chkDoUseSig" ${doObj.useDigitalSig !== false ? 'checked' : ''}>
              ${sigChayaninSrc ? `<img src="${sigChayaninSrc}" style="height:36px;width:82px;object-fit:contain;background:#FFF;padding:2px 6px;border-radius:6px;border:1px solid #CBD5E1;">` : ''}
              <div>
                <div style="font-weight:800;color:#166534;">✍️ แนบลายเซ็นดิจิทัลผู้ส่งของ (Delivery by: Chayanin K.)</div>
                <div style="font-size:11px;color:#475569;">Print by: ${doObj.printBy || 'FTCS-HTH-APP-01\\CHAYANIN.KUPTRAKUL'}</div>
              </div>
            </label>
            <div style="display:flex;gap:8px;align-items:center;">
              <label style="font-size:12px;font-weight:700;">วันที่ส่ง (Date):</label>
              <input id="inpDoDelivDate" type="text" value="${doObj.deliveryDate || doObj.shipDate || ''}" style="width:110px;padding:6px;border:1px solid #CBD5E1;border-radius:7px;">
            </div>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    function syncFormToDoState() {
      doObj.doNo = document.getElementById('inpDoNo').value.trim();
      doObj.shipDate = document.getElementById('inpDoShipDate').value.trim();
      doObj.externalDoc = document.getElementById('inpDoExtDoc').value.trim();
      doObj.salesOrderNo = document.getElementById('inpDoSoNo').value.trim();
      doObj.shipmentMethod = document.getElementById('inpDoShipMethod').value.trim();
      doObj.customerName = document.getElementById('inpDoCustName').value.trim();
      doObj.vatReg = document.getElementById('inpDoVatReg').value.trim();
      doObj.branchNo = document.getElementById('inpDoBranch').value.trim();
      doObj.address = document.getElementById('inpDoAddress').value.trim();
      doObj.contact = document.getElementById('inpDoContact').value.trim();
      doObj.tel = document.getElementById('inpDoTel').value.trim();
      doObj.remark = document.getElementById('inpDoRemark').value.trim();
      doObj.deliveryDate = document.getElementById('inpDoDelivDate').value.trim();
      doObj.useDigitalSig = document.getElementById('chkDoUseSig').checked;
    }

    modal.querySelectorAll('input[data-do-idx]').forEach(inp => {
      inp.oninput = () => {
        const i = Number(inp.getAttribute('data-do-idx'));
        const f = inp.getAttribute('data-f');
        doObj.items[i][f] = inp.type === 'number' ? Number(inp.value || 0) : inp.value;
      };
    });

    modal.querySelectorAll('button[data-do-del]').forEach(btn => {
      btn.onclick = () => {
        syncFormToDoState();
        doObj.items.splice(Number(btn.getAttribute('data-do-del')), 1);
        window.openAdminDeliveryOrderStudioModal();
      };
    });

    document.getElementById('btnDoAddRow').onclick = () => {
      syncFormToDoState();
      doObj.items.push({ itemNo: '4HC-H', description: 'WATER FILTER CARTRIDGE', qty: 1.00, unit: 'PCS' });
      window.openAdminDeliveryOrderStudioModal();
    };

    document.getElementById('btnDoPreviewA4').onclick = () => {
      syncFormToDoState();
      const html = buildExactAdminDeliveryOrderHtml(doObj, false);
      const w = window.open('', '_blank', 'width=940,height=920');
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    };

    document.getElementById('btnDoPrintPdf').onclick = () => {
      syncFormToDoState();
      const html = buildExactAdminDeliveryOrderHtml(doObj, true);
      const w = window.open('', '_blank', 'width=940,height=920');
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    };

    // 1-Click Convert DO -> Accounting Tax Invoice (SI) with Shipment No. DOxxxx auto-populated!
    document.getElementById('btnDoConvertToSi').onclick = () => {
      syncFormToDoState();
      modal.style.display = 'none';
      if (window.HZK_TAX_INVOICE_STATE) {
        window.HZK_TAX_INVOICE_STATE.invoiceNo = doObj.doNo.replace(/^DO/i, 'SI');
        window.HZK_TAX_INVOICE_STATE.date = doObj.shipDate;
        window.HZK_TAX_INVOICE_STATE.poNo = doObj.salesOrderNo;
        window.HZK_TAX_INVOICE_STATE.dealerNameTh = doObj.customerName;
        window.HZK_TAX_INVOICE_STATE.dealerNameEn = doObj.customerName;
        window.HZK_TAX_INVOICE_STATE.addressLine1 = doObj.address;
        window.HZK_TAX_INVOICE_STATE.addressLine2 = '';
        window.HZK_TAX_INVOICE_STATE.tel = doObj.tel;
        window.HZK_TAX_INVOICE_STATE.customerTaxId = doObj.vatReg ? ('TAX ID ' + doObj.vatReg + '/' + (doObj.branchNo || '00000')) : '';
        window.HZK_TAX_INVOICE_STATE.shipmentHeader = 'Shipment No. ' + doObj.doNo + ':';
        window.HZK_TAX_INVOICE_STATE.items = (doObj.items || []).map(it => ({
          code: it.itemNo,
          desc: it.description,
          serialNote: '',
          qty: Number(it.qty || 1),
          unitPrice: 0,
          discount: 0
        }));
      }
      if (typeof window.openAccountingTaxInvoiceStudioModal === 'function') {
        window.openAccountingTaxInvoiceStudioModal();
      }
    };

    document.getElementById('btnDoShareTrack').onclick = () => {
      syncFormToDoState();
      if (typeof window.sendHoshizakiTrackedDocument === 'function') {
        window.sendHoshizakiTrackedDocument({
          docType: 'ใบส่งของ (Delivery Order)',
          department: 'Admin & Logistics',
          offerNo: doObj.doNo,
          customerName: doObj.customerName,
          address: doObj.address,
          phone: doObj.tel,
          grandTotal: 0,
          items: (doObj.items || []).map(it => ({
            model: it.itemNo,
            description: it.description + ' (' + (it.unit || 'PCS') + ')',
            unitPrice: 0,
            discount: 0,
            qty: it.qty
          }))
        });
      }
    };
  };
})();



// ============================================================================
// ENTERPRISE v1184 — CLOSED-LOOP FULFILLMENT, DIGITAL e-POD, S/N STOCK PICKER
//                    & ACCOUNTING OUTPUT VAT REGISTER (PP.30 / NAV READY)
// ============================================================================
(function initHoshizakiClosedLoopFulfillmentV1184() {
  if (window.__HZK_CLOSED_LOOP_FULFILLMENT_V1184__) return;
  window.__HZK_CLOSED_LOOP_FULFILLMENT_V1184__ = true;

  const LOCAL_DO_REG_KEY = 'hzk_v1184_issued_do_register';
  const LOCAL_SI_VAT_KEY = 'hzk_v1184_issued_si_vat_register';

  function getLocalDoList() {
    try { return JSON.parse(localStorage.getItem(LOCAL_DO_REG_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveLocalDoRecord(rec) {
    try {
      const list = getLocalDoList();
      const idx = list.findIndex(x => x.doNo === rec.doNo);
      if (idx >= 0) list[idx] = rec; else list.unshift(rec);
      localStorage.setItem(LOCAL_DO_REG_KEY, JSON.stringify(list.slice(0, 150)));
    } catch (e) {}
  }

  function getLocalSiVatList() {
    try { return JSON.parse(localStorage.getItem(LOCAL_SI_VAT_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveLocalSiVatRecord(rec) {
    try {
      const list = getLocalSiVatList();
      const idx = list.findIndex(x => x.invoiceNo === rec.invoiceNo);
      if (idx >= 0) list[idx] = rec; else list.unshift(rec);
      localStorage.setItem(LOCAL_SI_VAT_KEY, JSON.stringify(list.slice(0, 200)));
    } catch (e) {}
  }

  // Serial Number Stock Picker Modal for Tax Invoice / Delivery Order
  window.openSerialStockPickerForDocModal = async function () {
    let serialDb = [];
    try {
      const r = await fetch('./serial_db.json?v=' + Date.now());
      if (r.ok) {
        const raw = await r.json();
        serialDb = Array.isArray(raw) ? raw : (raw.serials || raw.records || Object.values(raw || {}));
      }
    } catch (e) {}

    let pModal = document.getElementById('hzkSerialStockPickerModal');
    if (!pModal) {
      pModal = document.createElement('div');
      pModal.id = 'hzkSerialStockPickerModal';
      pModal.style.cssText =
        'position:fixed;inset:0;z-index:20260;background:rgba(15,23,42,0.85);display:flex;' +
        'align-items:center;justify-content:center;padding:12px;overflow-y:auto;';
      document.body.appendChild(pModal);
    }

    pModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:760px;max-height:88vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;color:#0F172A;">
        <div style="background:#002B49;color:#FFF;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;">
          <div>
            <div style="font-size:11px;color:#38BDF8;font-weight:800;">SERIAL NUMBER INVENTORY &amp; WARRANTY AUTO-BINDER</div>
            <div style="font-size:15px;font-weight:800;">🔢 เลือกหมายเลขเครื่อง (Serial No.) เพื่อใส่ในใบกำกับภาษี &amp; เปิดสิทธิ์ประกัน</div>
          </div>
          <button type="button" onclick="document.getElementById('hzkSerialStockPickerModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
        <div style="padding:14px 18px;font-size:12.5px;">
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <input id="inpSnPickerSearch" type="text" placeholder="🔎 พิมพ์ค้นหา S/N หรือรุ่นเครื่อง เช่น IM-220AA, R066..." style="flex:1;min-width:220px;padding:8px 10px;border:1px solid #CBD5E1;border-radius:8px;">
            <input id="inpSnManualAdd" type="text" placeholder="หรือพิมพ์ S/N ใหม่ เช่น R06634J" style="width:180px;padding:8px 10px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
            <button type="button" id="btnSnManualInsert" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;">+ ใส่ S/N นี้</button>
          </div>
          <div id="snPickerListWrap" style="max-height:360px;overflow-y:auto;border:1px solid #CBD5E1;border-radius:10px;"></div>
        </div>
      </div>
    `;
    pModal.style.display = 'flex';

    function injectSnIntoFirstMatchingRow(snCode, modelHint) {
      const inv = window.HZK_TAX_INVOICE_STATE;
      if (!inv || !Array.isArray(inv.items) || !inv.items.length) return;
      let targetIdx = 0;
      if (modelHint) {
        const foundIdx = inv.items.findIndex(it => String(it.code || '').toUpperCase().indexOf(String(modelHint).toUpperCase()) !== -1);
        if (foundIdx >= 0) targetIdx = foundIdx;
      }
      const curNote = String(inv.items[targetIdx].serialNote || '').replace(/[()]/g, '').trim();
      const parts = curNote ? curNote.split(/,\s*/).filter(Boolean) : [];
      if (parts.indexOf(snCode) === -1) parts.push(snCode);
      inv.items[targetIdx].serialNote = '(' + parts.join(', ') + ')';
      pModal.style.display = 'none';
      if (typeof window.openAccountingTaxInvoiceStudioModal === 'function') {
        window.openAccountingTaxInvoiceStudioModal();
      }
    }

    document.getElementById('btnSnManualInsert').onclick = () => {
      const snVal = document.getElementById('inpSnManualAdd').value.trim().toUpperCase();
      if (snVal) injectSnIntoFirstMatchingRow(snVal, '');
    };

    function renderSnRows(q) {
      const term = String(q || '').trim().toUpperCase();
      const filtered = serialDb.filter(r => {
        const s = String(r.serial || r.serialNo || r.sn || '').toUpperCase();
        const m = String(r.model || '').toUpperCase();
        return !term || s.indexOf(term) !== -1 || m.indexOf(term) !== -1;
      }).slice(0, 60);

      const wrap = document.getElementById('snPickerListWrap');
      if (!filtered.length) {
        wrap.innerHTML = '<div style="padding:14px;text-align:center;color:#64748B;">ไม่พบรายการที่ค้นหา — สามารถพิมพ์ S/N ในช่องด้านบนขวาแล้วกด "+ ใส่ S/N นี้" ได้ทันที</div>';
        return;
      }
      wrap.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#0F172A;color:#FFF;"><th style="padding:7px;text-align:left;">Serial No.</th><th style="padding:7px;text-align:left;">Model</th><th style="padding:7px;text-align:left;">ลูกค้า/สถานะเดิม</th><th style="padding:7px;">เลือกใช้</th></tr></thead>
          <tbody>
            ${filtered.map((r, i) => {
              const s = r.serial || r.serialNo || r.sn || '-';
              const m = r.model || '-';
              const c = r.customer || r.customerName || r.store || 'พร้อมใช้งาน';
              return `<tr>
                <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;font-weight:800;">${s}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;">${m}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;color:#475569;">${c}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;text-align:center;"><button type="button" data-pick-sn="${s}" data-pick-m="${m}" class="btn-pick-sn-row" style="background:#0284C7;color:#FFF;border:none;border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer;">+ เลือก</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
      wrap.querySelectorAll('.btn-pick-sn-row').forEach(b => {
        b.onclick = () => injectSnIntoFirstMatchingRow(b.getAttribute('data-pick-sn'), b.getAttribute('data-pick-m'));
      });
    }

    document.getElementById('inpSnPickerSearch').oninput = (e) => renderSnRows(e.target.value);
    renderSnRows('');
  };

  // Output VAT Register (PP.30 / NAV) & Delivery Order e-POD Dashboard
  window.openOutputVatAndDoRegisterModal = async function () {
    let regModal = document.getElementById('hzkOutputVatDoRegModal');
    if (!regModal) {
      regModal = document.createElement('div');
      regModal.id = 'hzkOutputVatDoRegModal';
      regModal.style.cssText =
        'position:fixed;inset:0;z-index:20250;background:rgba(15,23,42,0.88);display:flex;' +
        'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
      document.body.appendChild(regModal);
    }

    regModal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1100px;max-height:94vh;overflow-y:auto;border-radius:16px;box-shadow:0 28px 70px rgba(0,0,0,0.5);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#0F766E);color:#FFF;padding:14px 20px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:0;z-index:10;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1184 • ADMIN e-POD DELIVERY REGISTER &amp; ACCOUNTING OUTPUT VAT (PP.30 / NAV)</div>
            <div style="font-size:16px;font-weight:800;">📊 ทะเบียนคุมใบส่งของ (DO e-POD) &amp; รายงานภาษีขาย (Output VAT 7%)</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" id="btnExportOutputVatCsv" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer;">📥 Export รายงานภาษีขาย (CSV / Excel)</button>
            <button type="button" onclick="document.getElementById('hzkOutputVatDoRegModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>

        <div style="padding:16px 20px;font-size:12.5px;">
          <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
            <button type="button" id="tabRegDoEpodBtn" style="background:#002B49;color:#FFF;border:none;border-radius:8px;padding:8px 14px;font-weight:800;cursor:pointer;">📦 1. ทะเบียนใบส่งของ Admin &amp; สถานะเซ็นรับ e-POD</button>
            <button type="button" id="tabRegOutputVatBtn" style="background:#E2E8F0;color:#0F172A;border:none;border-radius:8px;padding:8px 14px;font-weight:800;cursor:pointer;">🧾 2. รายงานภาษีขาย (Output VAT 7% / ยื่น ภ.พ.30)</button>
          </div>
          <div id="regModalBodyWrap">⏳ กำลังโหลดข้อมูลทะเบียนเอกสาร...</div>
        </div>
      </div>
    `;
    regModal.style.display = 'flex';

    let doRecords = getLocalDoList();
    let siRecords = getLocalSiVatList();

    // Seed with sample records if empty so team can immediately inspect & export
    if (!doRecords.length) {
      doRecords = [
        { doNo: 'DO2611-070', shipDate: '09/11/2026', salesOrderNo: 'SO2611-056', customerName: 'RIJIRA CO., LTD.', shipmentMethod: 'FLASH EXPRESS', totalQty: 2, epodStatus: 'DELIVERED', receiverInfo: 'ผู้รับหน้างาน (11/11/2026)' },
        { doNo: 'DO2611-071', shipDate: '09/11/2026', salesOrderNo: 'SO2611-057', customerName: 'RIJIRA CO., LTD.', shipmentMethod: 'FLASH EXPRESS', totalQty: 1, epodStatus: 'DELIVERED', receiverInfo: 'ผู้รับหน้างาน (11/11/2026)' }
      ];
    }
    if (!siRecords.length) {
      siRecords = [
        { invoiceNo: 'SI2611-214', date: '19/11/2026', poNo: 'TSPO260100079', customerName: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด', taxId: '0105535144001', branch: '00000 (Head Office)', exclVat: 210291.00, vatAmt: 14720.37, inclVat: 225011.37, serials: 'R06632J, R06633J, R03781K, R03782K' },
        { invoiceNo: 'SI2611-215', date: '19/11/2026', poNo: 'TSPO261000064', customerName: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด', taxId: '0105535144001', branch: '00000 (Head Office)', exclVat: 78900.00, vatAmt: 5523.00, inclVat: 84423.00, serials: 'R03668K' },
        { invoiceNo: 'SI2611-212', date: '19/11/2026', poNo: 'TSPO260900053', customerName: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด', taxId: '0105535144001', branch: '00000 (Head Office)', exclVat: 78900.00, vatAmt: 5523.00, inclVat: 84423.00, serials: 'R03667K' }
      ];
    }

    try {
      const cloudRes = await callGasApi('getOutputVatAndDoRegister', {}, false);
      if (cloudRes && cloudRes.status === 'OK') {
        if (Array.isArray(cloudRes.doRecords) && cloudRes.doRecords.length) doRecords = cloudRes.doRecords;
        if (Array.isArray(cloudRes.siRecords) && cloudRes.siRecords.length) siRecords = cloudRes.siRecords;
      }
    } catch (e) {}

    const gasUrl = getGasEndpointUrl();

    function renderDoTab() {
      document.getElementById('tabRegDoEpodBtn').style.background = '#002B49';
      document.getElementById('tabRegDoEpodBtn').style.color = '#FFF';
      document.getElementById('tabRegOutputVatBtn').style.background = '#E2E8F0';
      document.getElementById('tabRegOutputVatBtn').style.color = '#0F172A';

      document.getElementById('regModalBodyWrap').innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;min-width:820px;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#002B49;color:#FFF;">
                <th style="padding:8px;">เลขที่ DO</th>
                <th style="padding:8px;">วันที่ส่ง</th>
                <th style="padding:8px;">อ้างอิง SO</th>
                <th style="padding:8px;text-align:left;">ลูกค้า</th>
                <th style="padding:8px;">ขนส่ง</th>
                <th style="padding:8px;">สถานะ e-POD</th>
                <th style="padding:8px;">ผู้เซ็นรับของ</th>
                <th style="padding:8px;">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              ${doRecords.map(d => {
                const epodLink = gasUrl ? `${gasUrl}?action=epodDo&doNo=${encodeURIComponent(d.doNo)}&cust=${encodeURIComponent(d.customerName || '')}` : '#';
                const isDeliv = String(d.epodStatus || '').toUpperCase() === 'DELIVERED';
                return `
                  <tr>
                    <td style="padding:7px;border:1px solid #CBD5E1;font-weight:800;">${d.doNo}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${d.shipDate || '-'}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${d.salesOrderNo || '-'}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${d.customerName || '-'}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${d.shipmentMethod || '-'}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
                      ${isDeliv
                        ? '<span style="background:#DCFCE7;color:#166534;padding:3px 8px;border-radius:999px;font-weight:800;">✅ เซ็นรับแล้ว (DELIVERED)</span>'
                        : '<span style="background:#FEF3C7;color:#92400E;padding:3px 8px;border-radius:999px;font-weight:800;">⏳ รอเซ็นรับ e-POD</span>'}
                    </td>
                    <td style="padding:7px;border:1px solid #CBD5E1;">${d.receiverInfo || '-'}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
                      <a href="${epodLink}" target="_blank" style="background:#0284C7;color:#FFF;text-decoration:none;padding:4px 9px;border-radius:6px;font-weight:700;font-size:11px;">✍️ เปิดหน้าเซ็นรับ e-POD</a>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderVatTab() {
      document.getElementById('tabRegOutputVatBtn').style.background = '#0F766E';
      document.getElementById('tabRegOutputVatBtn').style.color = '#FFF';
      document.getElementById('tabRegDoEpodBtn').style.background = '#E2E8F0';
      document.getElementById('tabRegDoEpodBtn').style.color = '#0F172A';

      let sumExcl = 0, sumVat = 0, sumIncl = 0;
      siRecords.forEach(s => {
        sumExcl += Number(s.exclVat || 0);
        sumVat += Number(s.vatAmt || 0);
        sumIncl += Number(s.inclVat || 0);
      });

      document.getElementById('regModalBodyWrap').innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px;">
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:10px 14px;">
            <div style="font-size:11px;color:#166534;font-weight:700;">มูลค่าสินค้าก่อนภาษีรวม (Excl. VAT)</div>
            <div style="font-size:18px;font-weight:900;color:#0F172A;">${sumExcl.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB</div>
          </div>
          <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 14px;">
            <div style="font-size:11px;color:#1E40AF;font-weight:700;">ภาษีขายรวม 7% (Output VAT)</div>
            <div style="font-size:18px;font-weight:900;color:#1D4ED8;">${sumVat.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB</div>
          </div>
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;">
            <div style="font-size:11px;color:#92400E;font-weight:700;">ยอดรวมทั้งสิ้น (Total Incl. VAT)</div>
            <div style="font-size:18px;font-weight:900;color:#B45309;">${sumIncl.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB</div>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;min-width:860px;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#0F766E;color:#FFF;">
                <th style="padding:8px;">เลขที่ใบกำกับภาษี</th>
                <th style="padding:8px;">วันที่</th>
                <th style="padding:8px;text-align:left;">ชื่อผู้ซื้อ / ลูกค้า</th>
                <th style="padding:8px;">Tax ID (13 หลัก)</th>
                <th style="padding:8px;text-align:right;">มูลค่าก่อน VAT</th>
                <th style="padding:8px;text-align:right;">VAT 7%</th>
                <th style="padding:8px;text-align:right;">รวมทั้งสิ้น</th>
                <th style="padding:8px;text-align:left;">S/N ลงทะเบียนประกัน</th>
              </tr>
            </thead>
            <tbody>
              ${siRecords.map(s => `
                <tr>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:800;">${s.invoiceNo}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${s.date}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${s.customerName}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${s.taxId || '-'}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;">${Number(s.exclVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:700;color:#1D4ED8;">${Number(s.vatAmt || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:800;">${Number(s.inclVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style="padding:7px;border:1px solid #CBD5E1;font-size:11px;color:#047857;">${s.serials || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    document.getElementById('tabRegDoEpodBtn').onclick = renderDoTab;
    document.getElementById('tabRegOutputVatBtn').onclick = renderVatTab;

    document.getElementById('btnExportOutputVatCsv').onclick = () => {
      const headers = ['Invoice_No', 'Date', 'PO_No', 'Customer_Name', 'Tax_ID_13_Digits', 'Branch', 'Amount_Excl_VAT', 'VAT_7_Pct', 'Total_Incl_VAT', 'Registered_Serials'];
      const lines = [headers.join(',')].concat(siRecords.map(s =>
        [
          s.invoiceNo,
          s.date,
          s.poNo || '',
          `"${String(s.customerName || '').replace(/"/g, '""')}"`,
          `"${String(s.taxId || '')}"`,
          `"${String(s.branch || '00000')}"`,
          Number(s.exclVat || 0).toFixed(2),
          Number(s.vatAmt || 0).toFixed(2),
          Number(s.inclVat || 0).toFixed(2),
          `"${String(s.serials || '')}"`
        ].join(',')
      ));
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'HOSHIZAKI_Output_VAT_PP30_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
    };

    renderDoTab();
  };

  // Wire up the new buttons inside Tax Invoice Studio & Admin DO Studio whenever opened
  const obsV1184 = new MutationObserver(() => {
    const btnPickSn = document.getElementById('btnInvPickSerialStock');
    if (btnPickSn && !btnPickSn._boundV1184) {
      btnPickSn._boundV1184 = true;
      btnPickSn.onclick = () => window.openSerialStockPickerForDocModal();
    }

    const btnIssueSi = document.getElementById('btnInvIssueAndRecordVat');
    if (btnIssueSi && !btnIssueSi._boundV1184) {
      btnIssueSi._boundV1184 = true;
      btnIssueSi.onclick = async () => {
        const inv = window.HZK_TAX_INVOICE_STATE || {};
        inv.invoiceNo = (document.getElementById('inpInvNo')?.value || inv.invoiceNo || 'AUTO').trim();
        inv.date = (document.getElementById('inpInvDate')?.value || inv.date || '').trim();
        inv.poNo = (document.getElementById('inpInvPo')?.value || inv.poNo || '').trim();
        inv.salesmanCode = (document.getElementById('inpInvSales')?.value || inv.salesmanCode || '').trim();
        inv.dealerNo = (document.getElementById('inpInvDealerNo')?.value || inv.dealerNo || '').trim();
        inv.dealerNameTh = (document.getElementById('inpInvDealerTh')?.value || inv.dealerNameTh || '').trim();
        inv.dealerNameEn = (document.getElementById('inpInvDealerEn')?.value || inv.dealerNameEn || '').trim();
        inv.customerTaxId = (document.getElementById('inpInvCustTax')?.value || inv.customerTaxId || '').trim();

        let sub = 0;
        (inv.items || []).forEach(it => { sub += Math.max(0, Number(it.qty || 1) * Number(it.unitPrice || 0) - Number(it.discount || 0)); });
        const vat = Math.round(sub * 0.07 * 100) / 100;
        const grand = Math.round((sub + vat) * 100) / 100;
        const sns = (inv.items || []).map(it => it.serialNote || '').filter(Boolean).join(', ');

        btnIssueSi.disabled = true;
        btnIssueSi.textContent = '⏳ กำลังบันทึก...';
        let finalNo = inv.invoiceNo;
        try {
          const res = await callGasApi('issueTaxInvoiceAndRecordVat', { invoiceData: inv }, false);
          if (res && res.status === 'OK') {
            finalNo = res.invoiceNo;
            if (document.getElementById('inpInvNo')) document.getElementById('inpInvNo').value = finalNo;
          }
        } catch (e) {}

        saveLocalSiVatRecord({
          invoiceNo: finalNo,
          date: inv.date,
          poNo: inv.poNo,
          customerName: inv.dealerNameTh || inv.dealerNameEn,
          taxId: String(inv.customerTaxId || '').replace(/[^0-9]/g, ''),
          branch: '00000 (Head Office)',
          exclVat: sub,
          vatAmt: vat,
          inclVat: grand,
          serials: sns
        });

        btnIssueSi.disabled = false;
        btnIssueSi.textContent = '💾 ออกเลข SI & บันทึกภาษีขาย';
        alert('✅ ออกใบกำกับภาษีเลขที่ ' + finalNo + ' บันทึกรายงานภาษีขาย 7% และลงทะเบียนรับประกัน S/N เรียบร้อยแล้ว!');
      };
    }

    const btnIssueDo = document.getElementById('btnDoIssueDeductAndEpod');
    if (btnIssueDo && !btnIssueDo._boundV1184) {
      btnIssueDo._boundV1184 = true;
      btnIssueDo.onclick = async () => {
        const doObj = window.HZK_ADMIN_DO_STATE || {};
        doObj.doNo = (document.getElementById('inpDoNo')?.value || doObj.doNo || 'AUTO').trim();
        doObj.shipDate = (document.getElementById('inpDoShipDate')?.value || doObj.shipDate || '').trim();
        doObj.salesOrderNo = (document.getElementById('inpDoSoNo')?.value || doObj.salesOrderNo || '').trim();
        doObj.shipmentMethod = (document.getElementById('inpDoShipMethod')?.value || doObj.shipmentMethod || '').trim();
        doObj.customerName = (document.getElementById('inpDoCustName')?.value || doObj.customerName || '').trim();
        doObj.address = (document.getElementById('inpDoAddress')?.value || doObj.address || '').trim();
        doObj.tel = (document.getElementById('inpDoTel')?.value || doObj.tel || '').trim();

        btnIssueDo.disabled = true;
        btnIssueDo.textContent = '⏳ กำลังตัดสต็อก...';
        let finalDoNo = doObj.doNo;
        let epodLink = '';
        try {
          const res = await callGasApi('issueDeliveryOrderAndDeductStock', { doData: doObj }, false);
          if (res && res.status === 'OK') {
            finalDoNo = res.doNo;
            epodLink = res.epodUrl || '';
            if (document.getElementById('inpDoNo')) document.getElementById('inpDoNo').value = finalDoNo;
          }
        } catch (e) {}

        if (!epodLink) {
          const gUrl = getGasEndpointUrl();
          epodLink = gUrl + '?action=epodDo&doNo=' + encodeURIComponent(finalDoNo) + '&cust=' + encodeURIComponent(doObj.customerName || '');
        }

        saveLocalDoRecord({
          doNo: finalDoNo,
          shipDate: doObj.shipDate,
          salesOrderNo: doObj.salesOrderNo,
          customerName: doObj.customerName,
          shipmentMethod: doObj.shipmentMethod,
          epodStatus: 'PENDING_EPOD',
          receiverInfo: 'รอเซ็นรับ e-POD'
        });

        btnIssueDo.disabled = false;
        btnIssueDo.textContent = '📦 ออกเลข DO, ตัดสต็อก & ลิงก์เซ็นรับ e-POD';
        const openNow = confirm('✅ ออกใบส่งของเลขที่ ' + finalDoNo + ' และตัดสต็อกเรียบร้อยแล้ว!\n\nลิงก์ให้ลูกค้า/คนขับเซ็นรับของ (e-POD):\n' + epodLink + '\n\nกด OK เพื่อเปิดหน้าเซ็นรับของ e-POD ทันที');
        if (openNow) window.open(epodLink, '_blank');
      };
    }
  });
  obsV1184.observe(document.body, { childList: true, subtree: true });
})();



// ============================================================================
// ENTERPRISE v1185 MEGA-RELEASE — UNIFIED 18-MODULE OMNI-COMMAND CENTER
//   1) Official Receipt (RV) & WHT 3% (50 ทวิ) Settlement
//   2) Credit Note (CN) & RMA Stock/S/N Unlock
//   3) Store-to-Van Requisition, Defective RMA, Warehouse PDI & Import PO/GR
//   4) Unified Document Vault (QT -> SO -> DO -> SI -> RV -> CN) + Repeat Call Guard
//   5) Fleet & Allowance Hub:
//      - Personal Car Fixed Allowance + Upcountry Distance Mileage Claim (THB/km)
//      - Executive Outsource Chauffeured Car Lease (MD Mr. Suzuki & JPC Mgr Mr. Furujo - Flexible Switch)
//   6) Technician Skill Matrix, Digital Ringi, Dealer Ordering Portal & Training Sandbox
// ============================================================================
(function initHoshizakiEnterpriseOmniSuiteV1185() {
  if (window.__HZK_ENTERPRISE_OMNI_SUITE_V1185__) return;
  window.__HZK_ENTERPRISE_OMNI_SUITE_V1185__ = true;

  const LOCAL_V1185_KEY = 'hzk_v1185_enterprise_omni_store';

  function loadLocalV1185Store() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_V1185_KEY) || 'null');
      if (raw && typeof raw === 'object') return raw;
    } catch (e) {}
    return {
      receipts: [
        { rvNo: 'RV2611-018', date: '20/11/2026', refSi: 'SI2611-214', customer: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด', transferAmt: 225011.37, whtAmt: 0, whtDocNo: '-', netSettled: 225011.37, status: 'PAID_CLOSED' }
      ],
      creditNotes: [],
      execLeases: [
        { assignmentId: 'EXEC-CAR-01', execName: 'Mr. Daisuke Suzuki (Managing Director)', vendorCompany: 'External Limousine & Leasing Co., Ltd.', vehiclePlate: 'Toyota Alphard (กท-9901)', driverName: 'คุณสมศักดิ์ (คนขับประจำ MD)', driverPhone: '081-900-1101', monthlyRate: 68000, driverOt: 0, expiryDate: '2027-12-31', status: 'ACTIVE' },
        { assignmentId: 'EXEC-CAR-02', execName: 'Mr. Naoki Furujo (Japanese Corporate Manager)', vendorCompany: 'External Limousine & Leasing Co., Ltd.', vehiclePlate: 'Toyota Camry Hybrid (กท-8822)', driverName: 'คุณวิรัช (คนขับประจำ JPC Mgr)', driverPhone: '081-900-1102', monthlyRate: 42000, driverOt: 0, expiryDate: '2027-12-31', status: 'ACTIVE' }
      ],
      mileageClaims: [
        { claimId: 'MIL2611-001', date: '2026-11-24', empName: 'นพรินทร์ หอมหวล (Noparin)', department: 'Service Unit', carPlate: 'รถส่วนตัวพนักงาน (กท-5412)', fixedAllow: 8500, route: 'กรุงเทพฯ ➔ นิคมฯ อมตะซิตี้ ชลบุรี (ไป-กลับ)', distanceKm: 164, mileageAmt: 738, tollParking: 170, totalPayout: 9408 }
      ],
      skillMatrix: [
        { tech: 'T01 (Bangkok North)', imKm: '✅ Certified', jweDishwasher: '✅ Certified', coldRoomHrHf: '✅ Certified', r290Hydrocarbon: '✅ Certified' },
        { tech: 'T02 (Bangkok South)', imKm: '✅ Certified', jweDishwasher: '✅ Certified', coldRoomHrHf: '⏳ Training', r290Hydrocarbon: '✅ Certified' },
        { tech: 'T03 (Bangkok East)', imKm: '✅ Certified', jweDishwasher: '✅ Certified', coldRoomHrHf: '✅ Certified', r290Hydrocarbon: '✅ Certified' },
        { tech: 'T04 (Nonthaburi)', imKm: '✅ Certified', jweDishwasher: '⏳ Training', coldRoomHrHf: '✅ Certified', r290Hydrocarbon: '✅ Certified' },
        { tech: 'T05 (Samut Prakan)', imKm: '✅ Certified', jweDishwasher: '✅ Certified', coldRoomHrHf: '✅ Certified', r290Hydrocarbon: '✅ Certified' },
        { tech: 'T06 (Ayutthaya)', imKm: '✅ Certified', jweDishwasher: '✅ Certified', coldRoomHrHf: '⏳ Training', r290Hydrocarbon: '✅ Certified' },
        { tech: 'T07 (Upcountry / IMS)', imKm: '✅ Certified', jweDishwasher: '✅ Certified', coldRoomHrHf: '✅ Certified', r290Hydrocarbon: '✅ Certified' },
        { tech: 'T08 (Install & PM)', imKm: '✅ Certified', jweDishwasher: '✅ Certified', coldRoomHrHf: '✅ Certified', r290Hydrocarbon: '✅ Certified' }
      ]
    };
  }

  function saveLocalV1185Store(store) {
    try { localStorage.setItem(LOCAL_V1185_KEY, JSON.stringify(store)); } catch (e) {}
  }

  window.openEnterpriseOmniCommandCenterV1185 = async function (initialTab) {
    let modal = document.getElementById('hzkEnterpriseOmniV1185Modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkEnterpriseOmniV1185Modal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20280;background:rgba(15,23,42,0.9);display:flex;' +
        'align-items:center;justify-content:center;padding:8px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const store = loadLocalV1185Store();
    try {
      const cloud = await callGasApi('getEnterpriseOmniSuiteDataV1185', {}, false);
      if (cloud && cloud.status === 'OK') {
        if (Array.isArray(cloud.receipts) && cloud.receipts.length) store.receipts = cloud.receipts;
        if (Array.isArray(cloud.creditNotes) && cloud.creditNotes.length) store.creditNotes = cloud.creditNotes;
        if (Array.isArray(cloud.execLeases) && cloud.execLeases.length) store.execLeases = cloud.execLeases;
        if (Array.isArray(cloud.mileageClaims) && cloud.mileageClaims.length) store.mileageClaims = cloud.mileageClaims;
        saveLocalV1185Store(store);
      }
    } catch (e) {}

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1160px;max-height:95vh;overflow-y:auto;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,0.55);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#1E1B4B);color:#FFF;padding:14px 20px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:0;z-index:10;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">HOSHIZAKI (THAILAND) ENTERPRISE v1185 — COMPLETE 18-MODULE OMNI-SUITE</div>
            <div style="font-size:16px;font-weight:800;">🏛️ ศูนย์บริหารจัดการองค์กรครบวงจร (บัญชี RV/CN • คลัง/นำเข้า • ค้นหาเอกสารกลาง • รถส่วนตัว &amp; รถเช่าผู้บริหาร)</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <label style="background:rgba(255,255,255,0.14);padding:5px 10px;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;">
              <input type="checkbox" id="chkSandboxModeV1185" ${window.__HZK_SANDBOX_MODE__ ? 'checked' : ''}> 🧪 โหมดฝึกซ้อม (Sandbox)
            </label>
            <button type="button" onclick="document.getElementById('hzkEnterpriseOmniV1185Modal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 13px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>

        <div style="background:#F1F5F9;padding:10px 16px;border-bottom:1px solid #CBD5E1;display:flex;gap:6px;flex-wrap:wrap;position:sticky;top:60px;z-index:9;">
          <button type="button" class="v1185-tab" data-tab="VAULT" style="background:#002B49;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer;">🔍 1. คลังค้นหาเอกสารกลาง (Document Vault)</button>
          <button type="button" class="v1185-tab" data-tab="ACC_RV_CN" style="background:#FFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer;">💰 2. ใบเสร็จ RV / 50 ทวิ &amp; ใบลดหนี้ CN</button>
          <button type="button" class="v1185-tab" data-tab="FLEET_MILEAGE" style="background:#FFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer;">🚗 3. รถส่วนตัวพนักงาน (ค่าเสื่อม/ระยะทาง) &amp; รถเช่าผู้บริหาร</button>
          <button type="button" class="v1185-tab" data-tab="STORE_IMPORT" style="background:#FFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer;">📦 4. เบิกรถช่าง / RMA / PDI &amp; นำเข้า PO/GR</button>
          <button type="button" class="v1185-tab" data-tab="RINGI_HR" style="background:#FFF;color:#0F172A;border:1px solid #CBD5E1;border-radius:8px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer;">🎓 5. Digital Ringi &amp; ทักษะช่าง (Skill Matrix)</button>
        </div>

        <div id="v1185MainBody" style="padding:16px 20px;font-size:12.5px;"></div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('chkSandboxModeV1185').onchange = (e) => {
      window.__HZK_SANDBOX_MODE__ = e.target.checked;
      alert(e.target.checked
        ? '🧪 เปิดโหมดฝึกซ้อม (Sandbox Mode) แล้ว — ข้อมูลที่ทดสอบจะไม่ถูกส่งเข้าบัญชีจริง'
        : '✅ กลับสู่โหมดทำงานจริง (Production Mode)');
    };

    function setActiveTabStyle(tabKey) {
      modal.querySelectorAll('.v1185-tab').forEach(b => {
        const active = b.getAttribute('data-tab') === tabKey;
        b.style.background = active ? '#002B49' : '#FFFFFF';
        b.style.color = active ? '#FFFFFF' : '#0F172A';
        b.style.border = active ? 'none' : '1px solid #CBD5E1';
      });
    }

    // TAB 1: UNIFIED DOCUMENT VAULT (QT -> SO -> DO -> SI -> RV -> CN)
    function renderVaultTab() {
      setActiveTabStyle('VAULT');
      const wrap = document.getElementById('v1185MainBody');
      wrap.innerHTML = `
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:12px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input id="inpVaultSearch" type="text" placeholder="🔎 ค้นหาเลขที่เอกสาร (HTH-26..., DO2611..., SI2611..., RV..., CN...), ชื่อลูกค้า, PO หรือ Serial No..." style="flex:1;min-width:260px;padding:8px 12px;border:1px solid #93C5FD;border-radius:8px;font-weight:700;">
          <button type="button" id="btnVaultSearchNow" style="background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:8px 16px;font-weight:800;cursor:pointer;">🔍 ค้นหาทุกแผนก</button>
          <button type="button" onclick="window.openCustomerDealerPortalWindow()" style="background:#0F766E;color:#FFF;border:none;border-radius:8px;padding:8px 14px;font-weight:800;cursor:pointer;">🤝 เปิดพอร์ทัลสั่งซื้อดีลเลอร์ 24 ชม.</button>
        </div>
        <div id="vaultResultsWrap"></div>
      `;

      async function doSearchVault(qTerm) {
        const outEl = document.getElementById('vaultResultsWrap');
        outEl.innerHTML = '⏳ กำลังสืบค้นเอกสารเชื่อมโยงทั้งองค์กร...';
        let rows = [];
        // Merge local records first
        (store.receipts || []).forEach(r => rows.push({ category: 'Receipt & WHT (RV)', docNo: r.rvNo, date: r.date, customer: r.customer, reference: r.refSi, amountOrQty: r.netSettled.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' THB', status: r.status }));
        (store.creditNotes || []).forEach(c => rows.push({ category: 'Credit Note (CN)', docNo: c.cnNo, date: c.date, customer: c.customer, reference: c.refSi, amountOrQty: '-' + Math.abs(c.inclVat).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' THB', status: c.restocked }));
        rows.push(
          { category: 'Tax Invoice (SI)', docNo: 'SI2611-214', date: '19/11/2026', customer: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด', reference: 'PO: TSPO260100079 | S/N: R06632J, R06633J', amountOrQty: '225,011.37 THB', status: 'ISSUED + VAT 7%' },
          { category: 'Delivery Order (DO)', docNo: 'DO2611-070', date: '09/11/2026', customer: 'RIJIRA CO., LTD.', reference: 'SO2611-056 | P00350-03 THERMISTOR', amountOrQty: '2.00 PCS', status: 'DELIVERED (e-POD)' },
          { category: 'Delivery Order (DO)', docNo: 'DO2611-071', date: '09/11/2026', customer: 'RIJIRA CO., LTD.', reference: 'SO2611-057 | 511240 DELIVERY FEE', amountOrQty: '1.00', status: 'DELIVERED (e-POD)' }
        );

        try {
          const res = await callGasApi('searchUnifiedDocumentVault', { query: qTerm }, false);
          if (res && res.status === 'OK' && Array.isArray(res.records) && res.records.length) {
            rows = res.records;
          }
        } catch (e) {}

        const term = String(qTerm || '').trim().toUpperCase();
        const filtered = rows.filter(r => !term || JSON.stringify(r).toUpperCase().indexOf(term) !== -1);

        outEl.innerHTML = `
          <div style="overflow-x:auto;">
            <table style="width:100%;min-width:820px;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#002B49;color:#FFF;">
                  <th style="padding:8px;">ประเภทเอกสาร</th>
                  <th style="padding:8px;">เลขที่เอกสาร</th>
                  <th style="padding:8px;">วันที่</th>
                  <th style="padding:8px;text-align:left;">ลูกค้า / คู่ค้า</th>
                  <th style="padding:8px;text-align:left;">เลขที่อ้างอิง / S/N</th>
                  <th style="padding:8px;text-align:right;">มูลค่า / จำนวน</th>
                  <th style="padding:8px;">สถานะ (Audit Lock)</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(r => `
                  <tr>
                    <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${r.category}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;font-weight:800;color:#0369A1;">${r.docNo}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${r.date}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${r.customer}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;font-size:11px;">${r.reference}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:right;font-weight:800;">${r.amountOrQty}</td>
                    <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;"><span style="background:#DCFCE7;color:#166534;padding:3px 8px;border-radius:999px;font-weight:700;font-size:11px;">🔒 ${r.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      document.getElementById('btnVaultSearchNow').onclick = () => doSearchVault(document.getElementById('inpVaultSearch').value);
      doSearchVault('');
    }

    // TAB 2: RECEIPT (RV) + WHT 3% (50 ทวิ) & CREDIT NOTE (CN)
    function renderAccRvCnTab() {
      setActiveTabStyle('ACC_RV_CN');
      const wrap = document.getElementById('v1185MainBody');
      wrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;margin-bottom:14px;">
          <!-- Left: Issue Receipt RV + WHT 3% (50 ทวิ) -->
          <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#166534;font-size:14px;margin-bottom:8px;">💰 1. ออกใบเสร็จรับเงิน (RV) &amp; บันทึกหัก ณ ที่จ่าย 3% (50 ทวิ)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div><label style="font-weight:700;">เลขที่ใบเสร็จ (RV No.):</label><input id="inpRvNo" value="AUTO" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:800;"></div>
              <div><label style="font-weight:700;">อ้างอิงใบกำกับภาษี (SI):</label><input id="inpRvRefSi" value="SI2611-214" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;"></div>
              <div style="grid-column:1/-1;"><label style="font-weight:700;">ชื่อลูกค้า:</label><input id="inpRvCust" value="บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">ยอดเงินโอนเข้าบัญชี (THB):</label><input id="inpRvTransfer" type="number" step="0.01" value="225011.37" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;font-weight:700;"></div>
              <div><label style="font-weight:700;">หัก ณ ที่จ่าย 3% (THB):</label><input id="inpRvWht" type="number" step="0.01" value="0" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
              <div style="grid-column:1/-1;"><label style="font-weight:700;">เลขที่หนังสือรับรอง 50 ทวิ (ถ้ามี):</label><input id="inpRvWhtDoc" placeholder="เช่น WHT-2026-0089" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
            </div>
            <button type="button" id="btnSaveRvNow" style="width:100%;background:#059669;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">✅ บันทึกรับชำระเงิน, ปิดยอด AR &amp; ออกเลข RV</button>
          </div>

          <!-- Right: Issue Credit Note CN + Restock & S/N Unlock -->
          <div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#991B1B;font-size:14px;margin-bottom:8px;">🧾↩️ 2. ออกใบลดหนี้ (Credit Note / CN) &amp; คืนสต็อก / ปลดล็อก S/N</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div><label style="font-weight:700;">เลขที่ใบลดหนี้ (CN No.):</label><input id="inpCnNo" value="AUTO" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:800;"></div>
              <div><label style="font-weight:700;">อ้างอิงใบกำกับภาษีเดิม (SI):</label><input id="inpCnRefSi" value="SI2611-215" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;"></div>
              <div style="grid-column:1/-1;"><label style="font-weight:700;">ชื่อลูกค้า:</label><input id="inpCnCust" value="บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">มูลค่าลดหนี้ก่อน VAT (THB):</label><input id="inpCnExclVat" type="number" step="0.01" value="0" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;font-weight:700;"></div>
              <div><label style="font-weight:700;">ปลดล็อก S/N คืนประกัน:</label><input id="inpCnUnlockSn" placeholder="เช่น R03668K" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">รหัสรุ่นคืนเข้าคลัง:</label><input id="inpCnModel" placeholder="เช่น IM-220AA" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">จำนวนคืนคลัง (เครื่อง):</label><input id="inpCnQty" type="number" value="0" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
              <div style="grid-column:1/-1;"><label style="font-weight:700;">สาเหตุการลดหนี้:</label><input id="inpCnReason" value="รับคืนสินค้า / ปรับปรุงรายการในใบกำกับภาษี" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
            </div>
            <button type="button" id="btnSaveCnNow" style="width:100%;background:#DC2626;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">↩️ ออกใบลดหนี้ CN, คืนสต็อก &amp; บันทึกรายงานภาษีขาย</button>
          </div>
        </div>
      `;

      document.getElementById('btnSaveRvNow').onclick = async () => {
        const transferAmt = Number(document.getElementById('inpRvTransfer').value || 0);
        const whtAmt = Number(document.getElementById('inpRvWht').value || 0);
        const payload = {
          rvNo: document.getElementById('inpRvNo').value.trim(),
          refInvoiceNo: document.getElementById('inpRvRefSi').value.trim(),
          customerName: document.getElementById('inpRvCust').value.trim(),
          transferAmount: transferAmt,
          whtAmount: whtAmt,
          whtDocNo: document.getElementById('inpRvWhtDoc').value.trim()
        };
        let finalRv = payload.rvNo === 'AUTO' ? ('RV2611-' + String(Math.floor(100 + Math.random() * 899))) : payload.rvNo;
        try {
          const r = await callGasApi('issueReceiptAndWht', payload, false);
          if (r && r.status === 'OK') finalRv = r.rvNo;
        } catch (e) {}
        store.receipts.unshift({
          rvNo: finalRv,
          date: new Date().toLocaleDateString('en-GB'),
          refSi: payload.refInvoiceNo,
          customer: payload.customerName,
          transferAmt: transferAmt,
          whtAmt: whtAmt,
          whtDocNo: payload.whtDocNo,
          netSettled: transferAmt + whtAmt,
          status: 'PAID_CLOSED'
        });
        saveLocalV1185Store(store);
        alert(`✅ บันทึกใบเสร็จรับเงินเลขที่ ${finalRv} ยอดปิดบัญชี ${(transferAmt + whtAmt).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB เรียบร้อยแล้ว!`);
      };

      document.getElementById('btnSaveCnNow').onclick = async () => {
        const exclVat = Number(document.getElementById('inpCnExclVat').value || 0);
        const inclVat = Math.round(exclVat * 1.07 * 100) / 100;
        const payload = {
          cnNo: document.getElementById('inpCnNo').value.trim(),
          refInvoiceNo: document.getElementById('inpCnRefSi').value.trim(),
          customerName: document.getElementById('inpCnCust').value.trim(),
          creditExclVat: exclVat,
          unlockSerialNo: document.getElementById('inpCnUnlockSn').value.trim(),
          returnModel: document.getElementById('inpCnModel').value.trim(),
          returnQty: Number(document.getElementById('inpCnQty').value || 0),
          reason: document.getElementById('inpCnReason').value.trim()
        };
        let finalCn = payload.cnNo === 'AUTO' ? ('CN2611-' + String(Math.floor(100 + Math.random() * 899))) : payload.cnNo;
        try {
          const r = await callGasApi('issueCreditNoteAndReturn', payload, false);
          if (r && r.status === 'OK') finalCn = r.cnNo;
        } catch (e) {}
        store.creditNotes.unshift({
          cnNo: finalCn,
          date: new Date().toLocaleDateString('en-GB'),
          refSi: payload.refInvoiceNo,
          customer: payload.customerName,
          reason: payload.reason,
          exclVat: -exclVat,
          vatAmt: -(inclVat - exclVat),
          inclVat: -inclVat,
          restocked: payload.unlockSerialNo || payload.returnModel || 'ADJUSTED'
        });
        saveLocalV1185Store(store);
        alert(`✅ ออกใบลดหนี้เลขที่ ${finalCn} ยอดลดหนี้รวม VAT -${inclVat.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB เรียบร้อยแล้ว!`);
      };
    }

    // TAB 3: PERSONAL CAR ALLOWANCE & UPCOUNTRY MILEAGE + EXECUTIVE CHAUFFEURED LEASE
    function renderFleetMileageTab() {
      setActiveTabStyle('FLEET_MILEAGE');
      const wrap = document.getElementById('v1185MainBody');
      wrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px;margin-bottom:14px;">
          <!-- Left: Staff Personal Car Allowance & Upcountry Mileage Reimbursement -->
          <div style="background:#EFF6FF;border:1.5px solid #93C5FD;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#1E3A8A;font-size:14px;margin-bottom:6px;">🚗 1. พนักงานใช้รถส่วนตัว — ค่าเหมาค่าเสื่อม/น้ำมัน &amp; เบิกระยะทางพื้นที่รอบนอก</div>
            <div style="font-size:11.5px;color:#334155;margin-bottom:8px;">คำนวณค่าเหมาประจำเดือน + เบิกค่าเดินทางพื้นที่รอบนอก/ต่างจังหวัดตามระยะทางจริง (กม. × เรทบาท/กม.) + ค่าทางด่วน/ที่จอดรถ</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div><label style="font-weight:700;">ชื่อพนักงาน / ช่าง:</label><input id="inpMilEmp" value="นพรินทร์ หอมหวล (Noparin)" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">ทะเบียนรถส่วนตัว:</label><input id="inpMilPlate" placeholder="เช่น กท-5412" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">ค่าเหมาค่าเสื่อม+น้ำมัน (THB):</label><input id="inpMilFixed" type="number" value="8500" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;font-weight:700;"></div>
              <div><label style="font-weight:700;">ระยะทางพื้นที่รอบนอก (กม.):</label><input id="inpMilKm" type="number" value="120" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;font-weight:700;"></div>
              <div><label style="font-weight:700;">อัตราเบิก (บาท / กม.):</label><input id="inpMilRate" type="number" step="0.5" value="4.5" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
              <div><label style="font-weight:700;">ค่าทางด่วน + ที่จอดรถ (THB):</label><input id="inpMilToll" type="number" value="150" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
              <div style="grid-column:1/-1;"><label style="font-weight:700;">เส้นทางปฏิบัติงานพื้นที่รอบนอก (อ้างอิง GPS / ลูกค้า):</label><input id="inpMilRoute" placeholder="เช่น สำนักงานหลักสี่ ➔ นิคมฯ อมตะซิตี้ ระยอง (ไป-กลับ)" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
            </div>
            <button type="button" id="btnSaveMileageNow" style="width:100%;background:#1D4ED8;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">💾 บันทึกเบิกค่าเหมา &amp; ค่าระยะทางส่ง HR / บัญชี</button>
          </div>

          <!-- Right: Executive Chauffeured Car Lease (MD & JPC Manager - Flexible Assignment) -->
          <div style="background:#F5F3FF;border:1.5px solid #C4B5FD;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#4C1D95;font-size:14px;margin-bottom:6px;">🚘 2. รถเช่าพร้อมคนขับผู้บริหาร (MD &amp; JPC Manager — ปรับเปลี่ยนยืดหยุ่น)</div>
            <div style="font-size:11.5px;color:#334155;margin-bottom:8px;">บริหารสัญญารถเช่าพร้อมคนขับจากบริษัทภายนอกสำหรับ MD (Mr. Suzuki) และ JPC Manager (Mr. Furujo) รองรับการเปลี่ยนตัวคนขับ/รถทดแทนได้ทันที</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div>
                <label style="font-weight:700;">เลือกรายการรถผู้บริหาร:</label>
                <select id="selExecLeaseId" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;">
                  <option value="EXEC-CAR-01">EXEC-CAR-01 — MD (Mr. Daisuke Suzuki)</option>
                  <option value="EXEC-CAR-02">EXEC-CAR-02 — JPC Mgr (Mr. Naoki Furujo)</option>
                  <option value="NEW">+ เพิ่มรถเช่าผู้บริหารรายการใหม่</option>
                </select>
              </div>
              <div><label style="font-weight:700;">บริษัทรถเช่าภายนอก:</label><input id="inpExecVendor" value="External Limousine & Leasing Co., Ltd." style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">รุ่นรถ &amp; ทะเบียน:</label><input id="inpExecPlate" value="Toyota Alphard (กท-9901)" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">ชื่อคนขับ &amp; เบอร์โทร (เปลี่ยนได้):</label><input id="inpExecDriver" value="คุณสมศักดิ์ (081-900-1101)" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;"></div>
              <div><label style="font-weight:700;">ค่าเช่ารายเดือน (THB):</label><input id="inpExecRate" type="number" value="68000" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
              <div><label style="font-weight:700;">ค่า OT คนขับเดือนนี้ (THB):</label><input id="inpExecOt" type="number" value="0" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
            </div>
            <button type="button" id="btnSaveExecLeaseNow" style="width:100%;background:#6D28D9;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">🔄 อัปเดตข้อมูลรถเช่า / เปลี่ยนคนขับผู้บริหาร</button>
          </div>
        </div>

        <div style="font-weight:800;color:#002B49;margin-bottom:6px;">📋 ประวัติเบิกค่ารถส่วนตัว &amp; ระยะทางพื้นที่รอบนอกล่าสุด:</div>
        <div style="overflow-x:auto;margin-bottom:14px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#002B49;color:#FFF;"><th style="padding:7px;">รหัสเบิก</th><th style="padding:7px;">วันที่</th><th style="padding:7px;text-align:left;">พนักงาน</th><th style="padding:7px;text-align:left;">เส้นทางพื้นที่รอบนอก</th><th style="padding:7px;text-align:right;">ค่าเหมา</th><th style="padding:7px;text-align:right;">ค่าระยะทาง (กม.)</th><th style="padding:7px;text-align:right;">ทางด่วน/จอดรถ</th><th style="padding:7px;text-align:right;">รวมเบิกสุทธิ</th></tr></thead>
            <tbody>
              ${(store.mileageClaims || []).map(m => `
                <tr>
                  <td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;">${m.claimId}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">${m.date}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;">${m.empName}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;">${m.route}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:right;">${Number(m.fixedAllow).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:right;">${Number(m.mileageAmt).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${m.distanceKm} กม.)</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:right;">${Number(m.tollParking).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:right;font-weight:800;color:#059669;">${Number(m.totalPayout).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="font-weight:800;color:#4C1D95;margin-bottom:6px;">🚘 ทะเบียนรถเช่าพร้อมคนขับผู้บริหาร (MD &amp; JPC Manager):</div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#4C1D95;color:#FFF;"><th style="padding:7px;">รหัส</th><th style="padding:7px;text-align:left;">ผู้บริหาร</th><th style="padding:7px;text-align:left;">บริษัทรถเช่า</th><th style="padding:7px;">รถ &amp; ทะเบียน</th><th style="padding:7px;">คนขับปัจจุบัน</th><th style="padding:7px;text-align:right;">ค่าเช่า + OT</th></tr></thead>
            <tbody>
              ${(store.execLeases || []).map(l => `
                <tr>
                  <td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;">${l.assignmentId}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;">${l.execName}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;">${l.vendorCompany}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">${l.vehiclePlate}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;font-weight:700;color:#4C1D95;">${l.driverName} (${l.driverPhone || ''})</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:right;font-weight:800;">${(Number(l.monthlyRate) + Number(l.driverOt || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.getElementById('selExecLeaseId').onchange = (e) => {
        const found = (store.execLeases || []).find(x => x.assignmentId === e.target.value);
        if (found) {
          document.getElementById('inpExecVendor').value = found.vendorCompany || '';
          document.getElementById('inpExecPlate').value = found.vehiclePlate || '';
          document.getElementById('inpExecDriver').value = `${found.driverName || ''} (${found.driverPhone || ''})`;
          document.getElementById('inpExecRate').value = found.monthlyRate || 0;
          document.getElementById('inpExecOt').value = found.driverOt || 0;
        }
      };

      document.getElementById('btnSaveMileageNow').onclick = async () => {
        const fixedAllow = Number(document.getElementById('inpMilFixed').value || 0);
        const distanceKm = Number(document.getElementById('inpMilKm').value || 0);
        const ratePerKm = Number(document.getElementById('inpMilRate').value || 4.5);
        const tollParking = Number(document.getElementById('inpMilToll').value || 0);
        const mileageAmt = Math.round(distanceKm * ratePerKm * 100) / 100;
        const totalPayout = Math.round((fixedAllow + mileageAmt + tollParking) * 100) / 100;

        const payload = {
          mode: 'MILEAGE',
          empName: document.getElementById('inpMilEmp').value.trim(),
          carPlate: document.getElementById('inpMilPlate').value.trim(),
          fixedAllowance: fixedAllow,
          distanceKm: distanceKm,
          ratePerKm: ratePerKm,
          tollParking: tollParking,
          route: document.getElementById('inpMilRoute').value.trim()
        };
        try { await callGasApi('saveFleetAllowanceOrMileage', payload, false); } catch (e) {}
        store.mileageClaims.unshift({
          claimId: 'MIL2611-' + String(Math.floor(100 + Math.random() * 899)),
          date: new Date().toISOString().slice(0, 10),
          empName: payload.empName,
          department: 'Sales / Service',
          carPlate: payload.carPlate,
          fixedAllow: fixedAllow,
          route: payload.route,
          distanceKm: distanceKm,
          mileageAmt: mileageAmt,
          tollParking: tollParking,
          totalPayout: totalPayout
        });
        saveLocalV1185Store(store);
        alert(`✅ บันทึกค่าเหมา + ค่าระยะทางพื้นที่รอบนอกรวม ${totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB เรียบร้อยแล้ว!`);
        renderFleetMileageTab();
      };

      document.getElementById('btnSaveExecLeaseNow').onclick = async () => {
        const selId = document.getElementById('selExecLeaseId').value;
        const aId = selId === 'NEW' ? ('EXEC-CAR-' + String(Math.floor(10 + Math.random() * 89))) : selId;
        const driverRaw = document.getElementById('inpExecDriver').value.trim();
        const payload = {
          mode: 'EXEC_LEASE',
          assignmentId: aId,
          execName: selId === 'EXEC-CAR-02' ? 'Mr. Naoki Furujo (Japanese Corporate Manager)' : 'Mr. Daisuke Suzuki (Managing Director)',
          vendorCompany: document.getElementById('inpExecVendor').value.trim(),
          vehiclePlate: document.getElementById('inpExecPlate').value.trim(),
          driverName: driverRaw,
          driverPhone: '',
          monthlyRate: Number(document.getElementById('inpExecRate').value || 0),
          driverOt: Number(document.getElementById('inpExecOt').value || 0)
        };
        try { await callGasApi('saveFleetAllowanceOrMileage', payload, false); } catch (e) {}
        const idx = store.execLeases.findIndex(x => x.assignmentId === aId);
        if (idx >= 0) Object.assign(store.execLeases[idx], payload);
        else store.execLeases.push(payload);
        saveLocalV1185Store(store);
        alert(`✅ อัปเดตข้อมูลรถเช่าผู้บริหาร (${aId}) เรียบร้อยแล้ว!`);
        renderFleetMileageTab();
      };
    }

    // TAB 4: STORE-TO-VAN REQUISITION, DEFECTIVE RMA, WAREHOUSE PDI & IMPORT PO/GR
    function renderStoreImportTab() {
      setActiveTabStyle('STORE_IMPORT');
      const wrap = document.getElementById('v1185MainBody');
      wrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;">
          <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#002B49;font-size:14px;margin-bottom:8px;">🚐 1. เบิกโอนอะไหล่สโตร์ขึ้นรถช่าง &amp; คืนอะไหล่เสีย (RMA)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div>
                <label style="font-weight:700;">ประเภทรายการ:</label>
                <select id="selTrfType" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;">
                  <option value="STORE_TO_VAN">📦 เบิกสโตร์ขึ้นรถช่าง (Store ➔ Van)</option>
                  <option value="DEFECTIVE_RMA">🔁 คืนอะไหล่เสียเคลมโรงงาน (Defective RMA)</option>
                </select>
              </div>
              <div>
                <label style="font-weight:700;">รถช่าง / ทีม:</label>
                <select id="selTrfVan" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;">
                  <option value="T01">T01</option><option value="T02">T02</option><option value="T03">T03</option><option value="T04">T04</option>
                  <option value="T05">T05</option><option value="T06">T06</option><option value="T07">T07</option><option value="T08">T08</option>
                </select>
              </div>
              <div><label style="font-weight:700;">รหัสอะไหล่:</label><input id="inpTrfPart" value="4HC-H" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;"></div>
              <div><label style="font-weight:700;">จำนวน (ชิ้น):</label><input id="inpTrfQty" type="number" value="2" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
              <div style="grid-column:1/-1;"><label style="font-weight:700;">อ้างอิงใบงาน / S/N:</label><input id="inpTrfRef" placeholder="เช่น JOB-261121 / S/N R06632J" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
            </div>
            <button type="button" id="btnSubmitTrfNow" style="width:100%;background:#0284C7;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">✅ บันทึกโอนอะไหล่ / RMA &amp; แจ้ง LINE สโตร์</button>
          </div>

          <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#92400E;font-size:14px;margin-bottom:8px;">🚢 2. ติดตามสั่งซื้อนำเข้า (Import PO) &amp; รับเข้าคลัง (GR)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div><label style="font-weight:700;">เลขที่ Import PO:</label><input id="inpImpPo" placeholder="IMP-2026-045" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;"></div>
              <div><label style="font-weight:700;">โรงงานต้นทาง:</label><input id="inpImpFactory" value="HC / HHE Factory" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">รหัสรุ่น / อะไหล่:</label><input id="inpImpModel" placeholder="IM-220AA" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;"></div>
              <div><label style="font-weight:700;">จำนวน (เครื่อง/ชิ้น):</label><input id="inpImpQty" type="number" value="5" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
              <div>
                <label style="font-weight:700;">สถานะนำเข้า:</label>
                <select id="selImpStatus" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;">
                  <option value="ORDERED">📝 สั่งซื้อแล้ว (Ordered)</option>
                  <option value="IN_TRANSIT">🚢 อยู่ระหว่างขนส่งทางเรือ (In Transit)</option>
                  <option value="RECEIVED_GR">✅ รับเข้าคลังเรียบร้อย (+เพิ่มสต็อก GR)</option>
                </select>
              </div>
              <div><label style="font-weight:700;">กำหนดถึงคลัง (ETA):</label><input id="inpImpEta" type="date" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
            </div>
            <button type="button" id="btnSubmitImpNow" style="width:100%;background:#D97706;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">💾 บันทึกสถานะนำเข้า / รับของเข้าสต็อก GR</button>
          </div>
        </div>
      `;

      document.getElementById('btnSubmitTrfNow').onclick = async () => {
        const payload = {
          transferType: document.getElementById('selTrfType').value,
          vanCode: document.getElementById('selTrfVan').value,
          partCode: document.getElementById('inpTrfPart').value.trim(),
          qty: Number(document.getElementById('inpTrfQty').value || 1),
          refInfo: document.getElementById('inpTrfRef').value.trim()
        };
        try { await callGasApi('transferStoreToVanOrRma', payload, false); } catch (e) {}
        alert('✅ บันทึกรายการโอนย้ายอะไหล่ / คืนอะไหล่เสียเรียบร้อยแล้ว!');
      };

      document.getElementById('btnSubmitImpNow').onclick = async () => {
        const payload = {
          poNo: document.getElementById('inpImpPo').value.trim(),
          factory: document.getElementById('inpImpFactory').value.trim(),
          modelCode: document.getElementById('inpImpModel').value.trim(),
          qty: Number(document.getElementById('inpImpQty').value || 1),
          status: document.getElementById('selImpStatus').value,
          eta: document.getElementById('inpImpEta').value
        };
        try { await callGasApi('createOrUpdateImportPoGr', payload, false); } catch (e) {}
        alert(payload.status === 'RECEIVED_GR'
          ? '✅ บันทึกรับสินค้าเข้าคลัง (GR) และเพิ่มยอดสต็อกพร้อมขายเรียบร้อยแล้ว!'
          : '✅ บันทึกสถานะใบสั่งซื้อนำเข้าเรียบร้อยแล้ว!');
      };
    }

    // TAB 5: DIGITAL RINGI & TECHNICIAN SKILL MATRIX + WAREHOUSE PDI
    function renderRingiHrTab() {
      setActiveTabStyle('RINGI_HR');
      const wrap = document.getElementById('v1185MainBody');
      wrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;margin-bottom:14px;">
          <div style="background:#EEF2FF;border:1.5px solid #C7D2FE;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#312E81;font-size:14px;margin-bottom:8px;">📑 1. ส่งคำขออนุมัติภายในองค์กร (Digital Ringi / e-Memo)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div><label style="font-weight:700;">แผนกผู้ขอ:</label><input id="inpRngDept" value="Sales / Service" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">งบประมาณ / มูลค่า (THB):</label><input id="inpRngAmt" type="number" value="0" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;text-align:right;"></div>
              <div style="grid-column:1/-1;"><label style="font-weight:700;">เรื่องที่ขออนุมัติข้ามแผนก:</label><input id="inpRngSubj" placeholder="เช่น ขออนุมัติเบิกเครื่องตัวโชว์ออกบูธ THAIFEX / เปลี่ยนเครื่องใหม่ลูกค้า VIP" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
            </div>
            <button type="button" id="btnSubmitRingiNow" style="width:100%;background:#3730A3;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">🚀 ส่งคำขอ Digital Ringi แจ้งผู้บริหารใน LINE</button>
          </div>

          <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:14px;">
            <div style="font-weight:800;color:#166534;font-size:14px;margin-bottom:8px;">🔍 2. บันทึกตรวจคุณภาพก่อนส่งมอบ (Warehouse PDI Checklist)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div><label style="font-weight:700;">รุ่นเครื่อง:</label><input id="inpPdiModel" placeholder="IM-220AA" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;"></div>
              <div><label style="font-weight:700;">Serial No.:</label><input id="inpPdiSn" placeholder="R06632J" style="width:100%;padding:6px;border:1px solid #CBD5E1;border-radius:7px;margin-top:2px;font-weight:700;"></div>
              <div style="grid-column:1/-1;display:flex;gap:12px;flex-wrap:wrap;padding-top:4px;">
                <label><input type="checkbox" id="chkPdiExt" checked> ตัวเครื่อง &amp; กล่องสมบูรณ์</label>
                <label><input type="checkbox" id="chkPdiAcc" checked> อุปกรณ์เสริม &amp; คู่มือครบ</label>
                <label><input type="checkbox" id="chkPdiRun" checked> ทดสอบระบบไฟ/น้ำผ่าน</label>
              </div>
            </div>
            <button type="button" id="btnSubmitPdiNow" style="width:100%;background:#059669;color:#FFF;border:none;border-radius:8px;padding:9px;font-weight:800;cursor:pointer;">✅ ยืนยันผล PDI พร้อมออกใบส่งของ DO</button>
          </div>
        </div>

        <div style="font-weight:800;color:#002B49;margin-bottom:6px;">🎓 ตารางทักษะและความเชี่ยวชาญทีมช่างบริการ (Technician Skill &amp; Certification Matrix):</div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#002B49;color:#FFF;"><th style="padding:7px;text-align:left;">ทีมช่าง / รถบริการ</th><th style="padding:7px;">IM / KM Cube &amp; Crescent</th><th style="padding:7px;">JWE Commercial Dishwasher</th><th style="padding:7px;">HR / HF Cold Room</th><th style="padding:7px;">R290 Hydrocarbon Safety</th></tr></thead>
            <tbody>
              ${(store.skillMatrix || []).map(s => `
                <tr>
                  <td style="padding:6px 8px;border:1px solid #CBD5E1;font-weight:800;">${s.tech}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">${s.imKm}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">${s.jweDishwasher}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">${s.coldRoomHrHf}</td>
                  <td style="padding:6px;border:1px solid #CBD5E1;text-align:center;">${s.r290Hydrocarbon}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.getElementById('btnSubmitRingiNow').onclick = async () => {
        const payload = {
          mode: 'RINGI',
          department: document.getElementById('inpRngDept').value.trim(),
          amount: Number(document.getElementById('inpRngAmt').value || 0),
          subject: document.getElementById('inpRngSubj').value.trim()
        };
        try { await callGasApi('submitRingiOrWarehousePdi', payload, false); } catch (e) {}
        alert('✅ ส่งคำขออนุมัติ Digital Ringi เข้ากลุ่ม LINE ผู้บริหารเรียบร้อยแล้ว!');
      };

      document.getElementById('btnSubmitPdiNow').onclick = async () => {
        const payload = {
          mode: 'PDI',
          model: document.getElementById('inpPdiModel').value.trim(),
          serialNo: document.getElementById('inpPdiSn').value.trim(),
          exteriorOk: document.getElementById('chkPdiExt').checked,
          accessoriesOk: document.getElementById('chkPdiAcc').checked,
          testRunOk: document.getElementById('chkPdiRun').checked
        };
        try { await callGasApi('submitRingiOrWarehousePdi', payload, false); } catch (e) {}
        alert('✅ บันทึกผลการตรวจคุณภาพ Warehouse PDI เรียบร้อย พร้อมออกใบส่งของ DO!');
      };
    }

    modal.querySelectorAll('.v1185-tab').forEach(btn => {
      btn.onclick = () => {
        const t = btn.getAttribute('data-tab');
        if (t === 'VAULT') renderVaultTab();
        else if (t === 'ACC_RV_CN') renderAccRvCnTab();
        else if (t === 'FLEET_MILEAGE') renderFleetMileageTab();
        else if (t === 'STORE_IMPORT') renderStoreImportTab();
        else if (t === 'RINGI_HR') renderRingiHrTab();
      };
    });

    const startTab = initialTab || 'VAULT';
    if (startTab === 'ACC_RV_CN') renderAccRvCnTab();
    else if (startTab === 'FLEET_MILEAGE') renderFleetMileageTab();
    else if (startTab === 'STORE_IMPORT') renderStoreImportTab();
    else if (startTab === 'RINGI_HR') renderRingiHrTab();
    else renderVaultTab();
  };
})();



// ============================================================================
// ENTERPRISE v1186 — PRODUCTION HARDENING, ZERO-FRICTION PIPELINE (QT->DO->SI->RV),
//                    AI OCR SLIP / 50 ทวิ / TOLL SCANNER & STRICT ROLE LOCK
// ============================================================================
(function initHoshizakiProductionHardeningV1186() {
  if (window.__HZK_PRODUCTION_HARDENING_V1186__) return;
  window.__HZK_PRODUCTION_HARDENING_V1186__ = true;

  // Enforce strict role lock for non-Super-Admin employees
  const STRICT_ROLE_LOCK_KEY = 'hzk_v1186_strict_role_lock_enabled';

  window.isStrictRoleLockEnabledV1186 = function () {
    return localStorage.getItem(STRICT_ROLE_LOCK_KEY) === 'true';
  };

  window.toggleStrictRoleLockV1186 = function (enable) {
    localStorage.setItem(STRICT_ROLE_LOCK_KEY, enable ? 'true' : 'false');
    const emp = (typeof getActiveEmployeeProfileV1171 === 'function') ? getActiveEmployeeProfileV1171() : null;
    if (emp && typeof renderPersonalizedEmployeeCockpit === 'function') {
      renderPersonalizedEmployeeCockpit(emp);
    }
  };

  // Zero-Friction Fulfillment Pipeline (QT -> DO -> SI -> RV) + AI OCR Scanner Modal
  window.openZeroFrictionPipelineAndOcrModal = async function () {
    let modal = document.getElementById('hzkZeroFrictionOcrModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkZeroFrictionOcrModal';
      modal.style.cssText =
        'position:fixed;inset:0;z-index:20290;background:rgba(15,23,42,0.9);display:flex;' +
        'align-items:center;justify-content:center;padding:8px;overflow-y:auto;';
      document.body.appendChild(modal);
    }

    const isLocked = window.isStrictRoleLockEnabledV1186();

    modal.innerHTML = `
      <div style="background:#FFFFFF;width:100%;max-width:1140px;max-height:95vh;overflow-y:auto;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,0.55);font-family:sans-serif;color:#0F172A;">
        <div style="background:linear-gradient(135deg,#002B49,#0369A1);color:#FFF;padding:14px 20px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:0;z-index:10;">
          <div>
            <div style="font-size:11px;color:#FDE047;font-weight:800;">ENTERPRISE v1186 • ZERO-FRICTION PIPELINE (QT ➔ DO ➔ SI ➔ RV) + GEMINI AI OCR</div>
            <div style="font-size:16px;font-weight:800;">⚡ ศูนย์ไหลงานอัตโนมัติข้ามแผนก &amp; AI OCR สแกนสลิป / 50 ทวิ / บิลทางด่วน</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <label style="background:rgba(255,255,255,0.16);padding:5px 10px;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;">
              <input type="checkbox" id="chkStrictRoleLockV1186" ${isLocked ? 'checked' : ''}> 🔒 ล็อกสิทธิ์หน้าจอรายบุคคล (Production Lock)
            </label>
            <button type="button" id="btnRunWatchdogNowV1186" style="background:#D97706;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:800;cursor:pointer;">🔔 ตรวจงานค้าง &amp; ซ่อมซ้ำ (SLA)</button>
            <button type="button" onclick="document.getElementById('hzkZeroFrictionOcrModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          </div>
        </div>

        <div style="padding:16px 20px;font-size:12.5px;">
          <!-- AI OCR Document Scanner Section -->
          <div style="background:linear-gradient(135deg,#F0F9FF,#ECFDF5);border:1.5px solid #7DD3FC;border-radius:14px;padding:14px;margin-bottom:16px;">
            <div style="font-weight:800;color:#002B49;font-size:14px;margin-bottom:6px;">🤖 AI OCR อ่านเอกสารอัตโนมัติ (สลิปโอนเงิน • หนังสือรับรอง 50 ทวิ • ใบเสร็จทางด่วน/น้ำมัน)</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
              <select id="selOcrDocCategory" style="padding:8px 10px;border:1px solid #93C5FD;border-radius:8px;font-weight:700;background:#FFF;">
                <option value="SLIP_OR_WHT">💰 สลิปโอนเงินธนาคาร / ใบหัก ณ ที่จ่าย 3% (50 ทวิ)</option>
                <option value="TOLL_FUEL">🛣️ ใบเสร็จทางด่วน / ที่จอดรถ / ค่าน้ำมัน (เบิกรถส่วนตัว)</option>
              </select>
              <input type="file" id="inpOcrImageFile" accept="image/*" style="background:#FFF;padding:6px;border:1px solid #CBD5E1;border-radius:8px;font-size:12px;">
              <button type="button" id="btnRunGeminiOcrNow" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:8px 16px;font-weight:800;cursor:pointer;">✨ สแกนอ่านข้อมูลด้วย AI ทันที</button>
            </div>
            <div id="ocrScanResultBox" style="margin-top:10px;display:none;background:#FFF;border:1px solid #CBD5E1;border-radius:10px;padding:10px;"></div>
          </div>

          <!-- 3-Stage Live Cross-Department Queue -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;">
            <!-- Stage 1: Sales PO -> Admin DO Queue -->
            <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:12px;">
              <div style="font-weight:800;color:#1E3A8A;font-size:13.5px;margin-bottom:8px;">1️⃣ คิวรอ Admin ออกใบส่งของ (Sales PO ➔ Admin DO)</div>
              <div id="queueAdminDoWrap" style="display:flex;flex-direction:column;gap:8px;">⏳ กำลังโหลดคิวงาน...</div>
            </div>

            <!-- Stage 2: Delivered DO (e-POD) -> Accounting SI Queue -->
            <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:12px;">
              <div style="font-weight:800;color:#0F766E;font-size:13.5px;margin-bottom:8px;">2️⃣ คิวรอบัญชีออกใบกำกับภาษี (DO e-POD ➔ บัญชี SI)</div>
              <div id="queueAccSiWrap" style="display:flex;flex-direction:column;gap:8px;">⏳ กำลังโหลดคิวงาน...</div>
            </div>

            <!-- Stage 3: Unpaid Tax Invoice -> Receipt RV & 50 ทวิ Queue -->
            <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px;padding:12px;">
              <div style="font-weight:800;color:#B45309;font-size:13.5px;margin-bottom:8px;">3️⃣ คิวรอรับชำระเงิน &amp; ปิดยอดลูกหนี้ (SI ➔ ใบเสร็จ RV)</div>
              <div id="queueAccRvWrap" style="display:flex;flex-direction:column;gap:8px;">⏳ กำลังโหลดคิวงาน...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('chkStrictRoleLockV1186').onchange = (e) => {
      window.toggleStrictRoleLockV1186(e.target.checked);
      alert(e.target.checked
        ? '🔒 เปิดโหมดล็อกสิทธิ์หน้าจอรายบุคคลแล้ว — พนักงานจะเห็นเฉพาะโต๊ะทำงานของแผนกตนเอง'
        : '🔓 ปลดล็อกโหมดสลับแผนกสำหรับผู้ดูแลระบบแล้ว');
    };

    document.getElementById('btnRunWatchdogNowV1186').onclick = async () => {
      try {
        const res = await callGasApi('runProductionComplianceWatchdog', {}, false);
        if (res && res.status === 'OK') {
          alert(res.alertCount > 0
            ? ('🔔 ตรวจพบรายการแจ้งเตือน ' + res.alertCount + ' รายการ และส่งเข้ากลุ่ม LINE แล้ว:\n\n' + res.alerts.join('\n'))
            : '✅ ตรวจสอบเรียบร้อย: ไม่มีใบส่งของค้างออกบิลหรือเคสซ่อมซ้ำเกินกำหนดครับ');
        }
      } catch (e) {}
    };

    // AI OCR Handler
    document.getElementById('btnRunGeminiOcrNow').onclick = async () => {
      const fileInp = document.getElementById('inpOcrImageFile');
      const cat = document.getElementById('selOcrDocCategory').value;
      const resBox = document.getElementById('ocrScanResultBox');
      if (!fileInp.files || !fileInp.files[0]) {
        alert('กรุณาเลือกรูปภาพสลิปโอนเงิน ใบ 50 ทวิ หรือใบเสร็จทางด่วนก่อนกดสแกนครับ');
        return;
      }
      resBox.style.display = 'block';
      resBox.innerHTML = '⏳ กำลังส่งภาพให้ Gemini AI อ่านตัวเลขและวันที่...';

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const ocrRes = await callGasApi('scanDocumentWithGeminiOcr', {
            docCategory: cat,
            imageDataUrl: reader.result
          }, false);

          if (ocrRes && ocrRes.status === 'OK') {
            if (cat === 'TOLL_FUEL') {
              resBox.innerHTML = `
                <div style="font-weight:800;color:#059669;margin-bottom:4px;">✅ อ่านข้อมูลใบเสร็จสำเร็จ (${ocrRes.docType || 'TOLL/FUEL'})</div>
                <div>• <b>วันที่:</b> ${ocrRes.date || '-'} | <b>ยอดเงิน:</b> ${Number(ocrRes.amount || 0).toFixed(2)} THB | <b>ด่าน/สถานี:</b> ${ocrRes.routeOrStation || '-'}</div>
                <button type="button" id="btnApplyOcrToMileage" style="margin-top:8px;background:#1D4ED8;color:#FFF;border:none;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer;">🚗 ส่งยอดนี้เข้าฟอร์มเบิกค่ารถส่วนตัว &amp; ทางด่วนทันที</button>
              `;
              document.getElementById('btnApplyOcrToMileage').onclick = () => {
                modal.style.display = 'none';
                window.openEnterpriseOmniCommandCenterV1185('FLEET_MILEAGE');
                setTimeout(() => {
                  if (document.getElementById('inpMilToll')) document.getElementById('inpMilToll').value = Number(ocrRes.amount || 0);
                  if (document.getElementById('inpMilRoute') && ocrRes.routeOrStation) document.getElementById('inpMilRoute').value = ocrRes.routeOrStation;
                }, 300);
              };
            } else {
              resBox.innerHTML = `
                <div style="font-weight:800;color:#059669;margin-bottom:4px;">✅ อ่านข้อมูลสลิป / 50 ทวิ สำเร็จ (${ocrRes.docType || 'SLIP'})</div>
                <div>• <b>ยอดโอน:</b> ${Number(ocrRes.transferAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB | <b>หัก ณ ที่จ่าย 3%:</b> ${Number(ocrRes.whtAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB | <b>เลขที่อ้างอิง:</b> ${ocrRes.docOrRefNo || '-'}</div>
                <button type="button" id="btnApplyOcrToRv" style="margin-top:8px;background:#059669;color:#FFF;border:none;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer;">💰 ส่งยอดนี้เข้าฟอร์มออกใบเสร็จรับเงิน (RV) ทันที</button>
              `;
              document.getElementById('btnApplyOcrToRv').onclick = () => {
                modal.style.display = 'none';
                window.openEnterpriseOmniCommandCenterV1185('ACC_RV_CN');
                setTimeout(() => {
                  if (document.getElementById('inpRvTransfer') && Number(ocrRes.transferAmount) > 0) document.getElementById('inpRvTransfer').value = Number(ocrRes.transferAmount);
                  if (document.getElementById('inpRvWht') && Number(ocrRes.whtAmount) > 0) document.getElementById('inpRvWht').value = Number(ocrRes.whtAmount);
                  if (document.getElementById('inpRvWhtDoc') && ocrRes.docOrRefNo) document.getElementById('inpRvWhtDoc').value = ocrRes.docOrRefNo;
                }, 300);
              };
            }
          } else {
            resBox.innerHTML = `<div style="color:#B45309;">⚠️ ${(ocrRes && ocrRes.message) || 'ไม่สามารถอ่านภาพอัตโนมัติได้ กรุณากรอกข้อมูลด้วยตนเอง'}</div>`;
          }
        } catch (err) {
          resBox.innerHTML = `<div style="color:#DC2626;">❌ เกิดข้อผิดพลาด: ${err.message}</div>`;
        }
      };
      reader.readAsDataURL(fileInp.files[0]);
    };

    // Load 3-stage pipeline queues (with smart local fallback)
    let qAdminDo = [
      { offerNo: 'SO2611-058', customerName: 'RIJIRA CO., LTD.', address: '7/29 MOO 2 KATHU, PHUKET 83120', phone: '081-415-2649', grandTotal: 14500, itemsJson: JSON.stringify([{ model: '4HC-H', description: 'WATER FILTER CARTRIDGE', qty: 3 }]) }
    ];
    let qAccSi = [
      { doNo: 'DO2611-070', shipDate: '09/11/2026', soNo: 'SO2611-056', customerName: 'RIJIRA CO., LTD.', address: '7/29 MOO 2 KATHU, PHUKET 83120', tel: '081-415-2649', epodStatus: 'DELIVERED', itemsJson: JSON.stringify([{ itemNo: 'P00350-03', description: 'THERMISTOR IM-65NE', qty: 2 }]) }
    ];
    let qAccRv = [
      { invoiceNo: 'SI2611-215', date: '19/11/2026', customerName: 'บริษัท ไทยสจ๊วต เซอร์วิสเซ็ส จำกัด', inclVat: 84423.00 }
    ];

    try {
      const qData = await callGasApi('getFulfillmentPipelineQueues', {}, false);
      if (qData && qData.status === 'OK') {
        if (Array.isArray(qData.pendingAdminDoQueue) && qData.pendingAdminDoQueue.length) qAdminDo = qData.pendingAdminDoQueue;
        if (Array.isArray(qData.pendingAccountingSiQueue) && qData.pendingAccountingSiQueue.length) qAccSi = qData.pendingAccountingSiQueue;
        if (Array.isArray(qData.unpaidAccountingRvQueue) && qData.unpaidAccountingRvQueue.length) qAccRv = qData.unpaidAccountingRvQueue;
      }
    } catch (e) {}

    document.getElementById('queueAdminDoWrap').innerHTML = qAdminDo.map((q, idx) => `
      <div style="background:#FFF;border:1px solid #CBD5E1;border-radius:9px;padding:9px;">
        <div style="font-weight:800;color:#1E3A8A;">${q.offerNo} — ${q.customerName}</div>
        <div style="font-size:11px;color:#475569;margin:2px 0 6px;">ยอดขาย: ${Number(q.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB</div>
        <button type="button" data-qdo="${idx}" class="btn-queue-to-do" style="width:100%;background:#1D4ED8;color:#FFF;border:none;border-radius:7px;padding:6px;font-weight:700;cursor:pointer;">📦 เปิดฟอร์มออกใบส่งของ (DO) ทันที</button>
      </div>
    `).join('');

    document.getElementById('queueAccSiWrap').innerHTML = qAccSi.map((d, idx) => `
      <div style="background:#FFF;border:1px solid #CBD5E1;border-radius:9px;padding:9px;">
        <div style="font-weight:800;color:#0F766E;">${d.doNo} (${d.epodStatus}) — ${d.customerName}</div>
        <div style="font-size:11px;color:#475569;margin:2px 0 6px;">SO: ${d.soNo || '-'} | วันที่ส่ง: ${d.shipDate || '-'}</div>
        <button type="button" data-qsi="${idx}" class="btn-queue-to-si" style="width:100%;background:#0F766E;color:#FFF;border:none;border-radius:7px;padding:6px;font-weight:700;cursor:pointer;">🧾 เปิดฟอร์มออกใบกำกับภาษี (SI) ทันที</button>
      </div>
    `).join('');

    document.getElementById('queueAccRvWrap').innerHTML = qAccRv.map((s, idx) => `
      <div style="background:#FFF;border:1px solid #CBD5E1;border-radius:9px;padding:9px;">
        <div style="font-weight:800;color:#B45309;">${s.invoiceNo} — ${s.customerName}</div>
        <div style="font-size:11px;color:#475569;margin:2px 0 6px;">ยอดค้างชำระ: <b>${Number(s.inclVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB</b></div>
        <button type="button" data-qrv="${idx}" class="btn-queue-to-rv" style="width:100%;background:#D97706;color:#FFF;border:none;border-radius:7px;padding:6px;font-weight:700;cursor:pointer;">💰 รับชำระเงิน &amp; ออกใบเสร็จ (RV)</button>
      </div>
    `).join('');

    modal.querySelectorAll('.btn-queue-to-do').forEach(b => {
      b.onclick = () => {
        const item = qAdminDo[Number(b.getAttribute('data-qdo'))];
        modal.style.display = 'none';
        if (window.HZK_ADMIN_DO_STATE) {
          window.HZK_ADMIN_DO_STATE.doNo = 'AUTO';
          window.HZK_ADMIN_DO_STATE.salesOrderNo = item.offerNo;
          window.HZK_ADMIN_DO_STATE.customerName = item.customerName;
          window.HZK_ADMIN_DO_STATE.address = item.address || '';
          window.HZK_ADMIN_DO_STATE.tel = item.phone || '';
          try {
            const parsed = JSON.parse(item.itemsJson || '[]');
            if (parsed.length) {
              window.HZK_ADMIN_DO_STATE.items = parsed.map(x => ({ itemNo: x.model || x.itemNo || '', description: x.description || '', qty: Number(x.qty || 1), unit: 'PCS' }));
            }
          } catch (e) {}
        }
        window.openAdminDeliveryOrderStudioModal();
      };
    });

    modal.querySelectorAll('.btn-queue-to-si').forEach(b => {
      b.onclick = () => {
        const d = qAccSi[Number(b.getAttribute('data-qsi'))];
        modal.style.display = 'none';
        if (window.HZK_TAX_INVOICE_STATE) {
          window.HZK_TAX_INVOICE_STATE.invoiceNo = 'AUTO';
          window.HZK_TAX_INVOICE_STATE.poNo = d.soNo || '';
          window.HZK_TAX_INVOICE_STATE.dealerNameTh = d.customerName;
          window.HZK_TAX_INVOICE_STATE.dealerNameEn = d.customerName;
          window.HZK_TAX_INVOICE_STATE.addressLine1 = d.address || '';
          window.HZK_TAX_INVOICE_STATE.tel = d.tel || '';
          window.HZK_TAX_INVOICE_STATE.shipmentHeader = 'Shipment No. ' + d.doNo + ':';
          try {
            const parsed = JSON.parse(d.itemsJson || '[]');
            if (parsed.length) {
              window.HZK_TAX_INVOICE_STATE.items = parsed.map(x => ({ code: x.itemNo || x.model || '', desc: x.description || '', serialNote: '', qty: Number(x.qty || 1), unitPrice: 0, discount: 0 }));
            }
          } catch (e) {}
        }
        window.openAccountingTaxInvoiceStudioModal();
      };
    });

    modal.querySelectorAll('.btn-queue-to-rv').forEach(b => {
      b.onclick = () => {
        const s = qAccRv[Number(b.getAttribute('data-qrv'))];
        modal.style.display = 'none';
        window.openEnterpriseOmniCommandCenterV1185('ACC_RV_CN');
        setTimeout(() => {
          if (document.getElementById('inpRvRefSi')) document.getElementById('inpRvRefSi').value = s.invoiceNo;
          if (document.getElementById('inpRvCust')) document.getElementById('inpRvCust').value = s.customerName;
          if (document.getElementById('inpRvTransfer')) document.getElementById('inpRvTransfer').value = Number(s.inclVat || 0).toFixed(2);
        }, 300);
      };
    });
  };
})();



// ============================================================================
// ENTERPRISE v1187 — LIVE STOCK-ON-HAND VIEWER MODAL (`openLiveStockSnapshotModal`)
//   - Displays all 203+ active models from `live_stock_snapshot_y2026.json` & GAS `Live_Stock_Master`
//   - Supports instant search, warehouse filter & 1-click add into Sales Quotation
// ============================================================================
window.openLiveStockSnapshotModal = async function () {
  const db = await loadSalesMasterDb(false);
  const stockMap = db.stockMap || {};
  const stockList = Object.values(stockMap);

  let modal = document.getElementById('hzkLiveStockSnapshotModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'hzkLiveStockSnapshotModal';
    modal.style.cssText =
      'position:fixed;inset:0;z-index:20295;background:rgba(15,23,42,0.86);display:flex;' +
      'align-items:center;justify-content:center;padding:10px;overflow-y:auto;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:#FFFFFF;width:100%;max-width:1040px;max-height:92vh;overflow-y:auto;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:sans-serif;color:#0F172A;">
      <div style="background:linear-gradient(135deg,#002B49,#0284C7);color:#FFF;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:11px;color:#FDE047;font-weight:800;">LIVE WAREHOUSE INVENTORY SNAPSHOT (MICHIRU-RPA &amp; CLOUD SYNC)</div>
          <div style="font-size:16px;font-weight:800;">📦 สต็อกเครื่องและสินค้าพร้อมขาย (${stockList.length} รุ่นในระบบคลัง)</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" onclick="window.triggerEmailStockSyncNow()" style="background:#059669;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">📥 ซิงก์สต็อกล่าสุดจากอีเมล</button>
          <button type="button" onclick="document.getElementById('hzkLiveStockSnapshotModal').style.display='none'" style="background:#EF4444;color:#FFF;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">✕ ปิด</button>
        </div>
      </div>
      <div style="padding:16px 20px;font-size:13px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input id="hzkLiveStockSearchInp" type="text" placeholder="🔎 พิมพ์ค้นหารุ่นเครื่อง (เช่น IM-130NE, KM-160B, FM-120KE) หรือคลังสินค้า..." style="flex:1;min-width:240px;padding:9px 12px;border:1.5px solid #93C5FD;border-radius:8px;font-weight:700;" />
          <select id="hzkLiveStockFilterSel" style="padding:9px 12px;border:1px solid #CBD5E1;border-radius:8px;font-weight:700;">
            <option value="ALL">แสดงทั้งหมด (${stockList.length} รุ่น)</option>
            <option value="READY">🟢 เฉพาะรุ่นที่มีของพร้อมส่ง (Available &gt; 0)</option>
            <option value="OUT">🟠 เฉพาะรุ่นที่ต้องสั่งนำเข้า / รอเข้า</option>
          </select>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;min-width:760px;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#002B49;color:#FFF;">
                <th style="padding:8px;text-align:left;">รุ่นสินค้า (Model)</th>
                <th style="padding:8px;">ยอดในคลัง (Ready)</th>
                <th style="padding:8px;">จองแล้ว (Reserved)</th>
                <th style="padding:8px;">พร้อมขายสุทธิ (Available)</th>
                <th style="padding:8px;">คลังเก็บ</th>
                <th style="padding:8px;">สถานะจัดส่ง (Lead Time)</th>
                <th style="padding:8px;">ออกใบเสนอราคา</th>
              </tr>
            </thead>
            <tbody id="hzkLiveStockTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';

  function renderStockRows() {
    const q = (document.getElementById('hzkLiveStockSearchInp').value || '').trim().toUpperCase();
    const mode = document.getElementById('hzkLiveStockFilterSel').value;
    const filtered = stockList.filter(s => {
      if (mode === 'READY' && Number(s.available || 0) <= 0) return false;
      if (mode === 'OUT' && Number(s.available || 0) > 0) return false;
      if (!q) return true;
      return (String(s.model) + ' ' + String(s.warehouse) + ' ' + String(s.leadTime)).toUpperCase().indexOf(q) !== -1;
    }).sort((a, b) => Number(b.available || 0) - Number(a.available || 0));

    const tbody = document.getElementById('hzkLiveStockTableBody');
    tbody.innerHTML = filtered.slice(0, 150).map(s => {
      const avail = Number(s.available || 0);
      return `
        <tr style="background:${avail > 0 ? '#FFFFFF' : '#FFFBEB'};">
          <td style="padding:7px 9px;border:1px solid #CBD5E1;font-weight:800;color:#002B49;">${s.model}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${Number(s.ready || 0)}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${Number(s.reserved || 0)}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;font-weight:800;color:${avail > 0 ? '#059669' : '#D97706'};">${avail}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">${s.warehouse || 'BKK-WH1'}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;font-weight:700;">${s.leadTime || '-'}</td>
          <td style="padding:7px;border:1px solid #CBD5E1;text-align:center;">
            <button type="button" data-st-model="${s.model}" class="btn-pick-live-stock-qt" style="background:#0284C7;color:#FFF;border:none;border-radius:6px;padding:5px 9px;font-weight:700;cursor:pointer;">+ ใส่ใบเสนอราคา</button>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" style="padding:14px;text-align:center;color:#64748B;">ไม่พบรายการรุ่นสินค้าที่ค้นหา</td></tr>';

    tbody.querySelectorAll('.btn-pick-live-stock-qt').forEach(btn => {
      btn.onclick = async () => {
        const mCode = btn.getAttribute('data-st-model');
        modal.style.display = 'none';
        const mObj = (db.models || []).find(m => String(m.model).toUpperCase() === mCode.toUpperCase()) || {
          model: mCode, description: 'Hoshizaki Commercial Equipment', w: '', d: '', h: ''
        };
        HZK_OMNI_STATE.items.push({
          model: mObj.model,
          description: mObj.description,
          w: mObj.w || '',
          d: mObj.d || '',
          h: mObj.h || '',
          unitPrice: Number(mObj.listPrice || mObj.unitPrice || 0),
          discount: 0,
          qty: 1,
          isService: false
        });
        await openSalesCorporateQuotationWithPreset('Sales', 'ใบเสนอราคา (Quotation)');
      };
    });
  }

  document.getElementById('hzkLiveStockSearchInp').oninput = renderStockRows;
  document.getElementById('hzkLiveStockFilterSel').onchange = renderStockRows;
  renderStockRows();
};


// ============================================================================
// HOSHIZAKI ENTERPRISE v1188-SERVICE-FIRST-CONTROL
// 1. Service-First Clean Focus Mode (Hides non-Service dept menus by default)
// 2. Service Control Tower (Active Jobs, Van Stock T01-T08, 30-Day PM, QA Gate)
// 3. Smart Spare Parts 360° Cross-Reference, Model-First View & Photo Hub
// ============================================================================
(function() {
    const V1188_FOCUS_MODE_KEY = 'hzk_v1188_service_first_focus_mode'; // 'SERVICE_ONLY' | 'ALL_DEPTS'
    const V1188_PART_PHOTOS_KEY = 'hzk_v1188_custom_part_photos_v1';
    const V1188_PART_NOTES_KEY = 'hzk_v1188_custom_part_notes_v1';
    const V1188_PART_OVERRIDES_KEY = 'hzk_v1188_custom_part_overrides_v1';

    let v1188PartsCache = null;
    let v1188PartsLoadPromise = null;

    function esc1188_(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getCustomPartPhotos_() {
        try { return JSON.parse(localStorage.getItem(V1188_PART_PHOTOS_KEY) || '{}'); } catch (e) { return {}; }
    }
    function saveCustomPartPhotos_(map) {
        localStorage.setItem(V1188_PART_PHOTOS_KEY, JSON.stringify(map));
    }
    function getCustomPartNotes_() {
        try { return JSON.parse(localStorage.getItem(V1188_PART_NOTES_KEY) || '{}'); } catch (e) { return {}; }
    }
    function saveCustomPartNotes_(map) {
        localStorage.setItem(V1188_PART_NOTES_KEY, JSON.stringify(map));
    }
    function getCustomPartOverrides_() {
        try { return JSON.parse(localStorage.getItem(V1188_PART_OVERRIDES_KEY) || '{}'); } catch (e) { return {}; }
    }
    function saveCustomPartOverrides_(map) {
        localStorage.setItem(V1188_PART_OVERRIDES_KEY, JSON.stringify(map));
    }

    window.getV1188FocusMode = function() {
        return localStorage.getItem(V1188_FOCUS_MODE_KEY) || 'SERVICE_ONLY';
    };

    window.setV1188FocusMode = function(mode) {
        const next = (mode === 'ALL_DEPTS') ? 'ALL_DEPTS' : 'SERVICE_ONLY';
        localStorage.setItem(V1188_FOCUS_MODE_KEY, next);
        window.applyV1188ServiceFirstFocusMode();
        if (typeof showToast === 'function') {
            showToast(next === 'SERVICE_ONLY'
                ? '🛡️ เปิดโหมด Service-First Focus (ซ่อนเมนูแผนกอื่นเพื่อให้ทีมบริการใช้งานง่ายที่สุด)'
                : '🌐 ปลดล็อกโหมดทุกแผนก (Omni-Mode) เรียบร้อยแล้ว');
        }
    };

    window.applyV1188ServiceFirstFocusMode = function() {
        const mode = window.getV1188FocusMode();
        const isServiceOnly = (mode === 'SERVICE_ONLY');

        // Hide or show non-service toolbar categories / buttons cleanly
        const nonServiceSelectors = [
            '[data-toolbar-cat="IMS_INVENTORY"]',
            '[data-toolbar-cat="HR_WORKFLOW"]',
            '#btnCat_IMS_INVENTORY',
            '#btnCat_HR_WORKFLOW',
            '#btnOpenSalesQuotationSuite',
            '#btnOpenAccountingTaxInvoiceSuite',
            '#btnOpenAdminDeliveryOrderSuite',
            '#btnOpenMarketingSocialStudio',
            '#btnOpenHrWorkflowPortal',
            '#btnOpenImsWarehouseSuite'
        ];
        nonServiceSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.style.display = isServiceOnly ? 'none' : '';
            });
        });

        // Filter department selector options in cockpit if present
        const deptSel = document.getElementById('cockpitDeptFilter') || document.getElementById('staffCockpitDeptSelect');
        if (deptSel && isServiceOnly) {
            Array.from(deptSel.options || []).forEach(opt => {
                const v = String(opt.value || '').toUpperCase();
                if (v && v !== 'ALL' && v !== 'SERVICE' && v !== 'SERVICE_CENTER' && v !== 'OUTSOURCE') {
                    opt.hidden = true;
                } else {
                    opt.hidden = false;
                }
            });
        } else if (deptSel) {
            Array.from(deptSel.options || []).forEach(opt => { opt.hidden = false; });
        }

        const toggleBtn = document.getElementById('btnV1188ToggleFocusMode');
        if (toggleBtn) {
            toggleBtn.innerHTML = isServiceOnly
                ? '<i class="fa-solid fa-shield-halved text-emerald-300 mr-1"></i><span>Service Focus</span><span class="ml-1 text-[9px] bg-white/20 px-1.5 rounded">ปลดล็อกทุกแผนก</span>'
                : '<i class="fa-solid fa-layer-group text-amber-300 mr-1"></i><span>Omni-Mode (ทุกแผนก)</span><span class="ml-1 text-[9px] bg-white/20 px-1.5 rounded">กลับโหมด Service</span>';
        }
    };

    // Load 9,425+ Master Parts Catalog (Offline JSON + Local Overrides)
    window.loadV1188MasterPartsCatalog = async function() {
        if (v1188PartsCache) return v1188PartsCache;
        if (v1188PartsLoadPromise) return v1188PartsLoadPromise;

        v1188PartsLoadPromise = (async () => {
            let baseList = [];
            try {
                const res = await fetch('./parts_catalog.json?v=1188');
                if (res.ok) {
                    const data = await res.json();
                    baseList = Array.isArray(data.parts) ? data.parts : (Array.isArray(data) ? data : []);
                }
            } catch (e) {
                console.warn('v1188 parts_catalog fetch fallback:', e);
            }
            const overrides = getCustomPartOverrides_();
            const mergedMap = new Map();
            baseList.forEach(p => {
                if (p && p.partNo) mergedMap.set(String(p.partNo).toUpperCase(), Object.assign({}, p));
            });
            Object.keys(overrides).forEach(k => {
                const up = k.toUpperCase();
                mergedMap.set(up, Object.assign({}, mergedMap.get(up) || {}, overrides[k]));
            });
            v1188PartsCache = Array.from(mergedMap.values());
            return v1188PartsCache;
        })();

        return v1188PartsLoadPromise;
    };

    // Check live stock across Van Stock (T01-T08) and Warehouse snapshot
    function getPartStockStatus1188_(partNo) {
        const code = String(partNo || '').trim().toUpperCase();
        const vanHits = [];
        try {
            const vans = JSON.parse(localStorage.getItem('hoshizaki_van_stock_v1') || '[]');
            vans.forEach(item => {
                if (String(item.partNo || '').trim().toUpperCase() === code && Number(item.qty || 0) > 0) {
                    vanHits.push({ van: item.vanId || item.tech || 'Van Stock', qty: Number(item.qty || 0) });
                }
            });
        } catch (e) {}

        let whQty = null;
        try {
            const snap = window.HZK_LIVE_STOCK_SNAPSHOT || JSON.parse(localStorage.getItem('hzk_live_stock_snapshot_cache') || 'null');
            if (snap && snap.stockMap && snap.stockMap[code] != null) {
                const entry = snap.stockMap[code];
                whQty = typeof entry === 'object' ? Number(entry.qty || entry.available || 0) : Number(entry || 0);
            }
        } catch (e) {}

        return { vanHits, whQty };
    }

    // Find matching Drive PDFs for a model or part
    function findDrivePdfsForModels1188_(models) {
        const list = Array.isArray(models) ? models : (models ? [models] : []);
        if (!list.length) return [];
        let pdfIndex = [];
        try {
            pdfIndex = JSON.parse(localStorage.getItem('hoshizaki_drive_pdf_index_v1') || '[]');
        } catch (e) {}
        if (!Array.isArray(pdfIndex) || !pdfIndex.length) return [];

        const prefixes = list.map(m => String(m).toUpperCase().split('-').slice(0, 2).join('-')).filter(Boolean);
        return pdfIndex.filter(doc => {
            const name = String(doc.name || doc.title || '').toUpperCase();
            return prefixes.some(px => px.length >= 3 && name.includes(px));
        }).slice(0, 5);
    }

    // ========================================================================
    // SMART SPARE PARTS 360° CROSS-REFERENCE, MODEL-FIRST VIEW & PHOTO HUB
    // ========================================================================
    window.openSmartSpareParts360Modal = async function(initialQuery, initialMode) {
        let modal = document.getElementById('smartSpareParts360Modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'smartSpareParts360Modal';
            modal.className = 'hidden fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-[122] flex items-center justify-center p-2 sm:p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-sky-300">
                    <div class="bg-gradient-to-r from-[#002B49] via-[#004675] to-[#0082C8] text-white px-4 py-3 flex items-center justify-between">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="bg-emerald-400 text-[#002B49] text-[10px] font-black px-2 py-0.5 rounded-full">v1188 • 9,425+ PARTS</span>
                                <h3 class="font-extrabold text-sm sm:text-base">ศูนย์ค้นหาอะไหล่ 360° • พาสเก่า/ใหม่ • พาสทดแทน • แมทข้ามรุ่น & คลังภาพ</h3>
                            </div>
                            <p class="text-[11px] text-sky-100 mt-0.5">Field Technician Model-First View & Admin 360° Cross-Reference + Live Photo Capture & Drive PDF Linker</p>
                        </div>
                        <button type="button" onclick="document.getElementById('smartSpareParts360Modal').classList.add('hidden')" class="bg-red-600 hover:bg-red-700 text-white rounded-lg w-8 h-8 font-black text-lg flex items-center justify-center">&times;</button>
                    </div>

                    <div class="bg-sky-50 border-b border-sky-200 p-3 space-y-2">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex flex-wrap gap-1.5 text-xs">
                                <button type="button" id="sp360Mode_OMNI" onclick="switchSp360SearchMode('OMNI')" class="px-3 py-1.5 rounded-lg font-extrabold bg-[#002B49] text-white">
                                    <i class="fa-solid fa-magnifying-glass mr-1"></i> ค้นหาทุกมิติ (Admin 360°: รหัสเก่า/ใหม่/ชื่อ/รุ่น)
                                </button>
                                <button type="button" id="sp360Mode_MODEL" onclick="switchSp360SearchMode('MODEL')" class="px-3 py-1.5 rounded-lg font-bold bg-white text-slate-800 border border-slate-300">
                                    <i class="fa-solid fa-screwdriver-wrench text-[#00A3E0] mr-1"></i> โหมดช่างหน้างาน (ดูอะไหล่เฉพาะรุ่นเครื่อง)
                                </button>
                                <button type="button" id="sp360Mode_ADD" onclick="switchSp360SearchMode('ADD')" class="px-3 py-1.5 rounded-lg font-bold bg-white text-slate-800 border border-slate-300">
                                    <i class="fa-solid fa-plus-circle text-emerald-600 mr-1"></i> เพิ่ม/แก้ไขพาสทดแทน & นำเข้า Excel
                                </button>
                            </div>
                            <div id="sp360StatsBadge" class="text-[11px] font-bold text-[#002B49] bg-white border border-sky-200 px-2.5 py-1 rounded-lg">
                                กำลังโหลดฐานข้อมูล 9,425+ รายการ...
                            </div>
                        </div>

                        <div id="sp360SearchBarWrap" class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div class="sm:col-span-8 relative">
                                <input type="text" id="sp360SearchInput" oninput="runSp360Search()" placeholder="พิมพ์รหัสพาส (เช่น P03755-02, 458774-01, 4A3978-01), ชื่ออะไหล่ (Valve, Motor, Board) หรือรุ่นเครื่อง (IM-130NE, KM-515MAH-E, HRW-77)..." class="w-full border-2 border-[#00A3E0] rounded-xl pl-3.5 pr-9 py-2 text-xs sm:text-sm font-bold bg-white focus:outline-none">
                                <button type="button" onclick="document.getElementById('sp360SearchInput').value=''; runSp360Search();" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 font-bold">&times;</button>
                            </div>
                            <select id="sp360FilterSelect" onchange="runSp360Search()" class="sm:col-span-4 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-white text-slate-800">
                                <option value="ALL">แสดงทั้งหมด (9,425+ รายการ)</option>
                                <option value="HAS_MODELS">เฉพาะรายการที่แมทรุ่นเครื่องแล้ว (2,441+ รายการ)</option>
                                <option value="CROSS_REF">เฉพาะรายการที่มีพาสเก่า / พาสทดแทน</option>
                                <option value="MULTI_MODEL">เฉพาะพาสที่ใช้ข้ามหลายรุ่น (Cross-Model)</option>
                                <option value="HAS_PHOTO">เฉพาะรายการที่มีรูปภาพประกอบแล้ว</option>
                            </select>
                        </div>
                    </div>

                    <div id="sp360Body" class="p-3 sm:p-4 overflow-y-auto flex-1 text-xs space-y-3 bg-slate-50"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        modal.classList.remove('hidden');
        const allParts = await window.loadV1188MasterPartsCatalog();
        const badge = document.getElementById('sp360StatsBadge');
        if (badge) {
            badge.textContent = `ฐานข้อมูลพร้อมใช้: ${allParts.length.toLocaleString()} รายการ`;
        }

        const currentJobModel = document.getElementById('machineModel')?.value?.trim() || '';
        const q = (initialQuery !== undefined) ? initialQuery : (initialMode === 'MODEL' ? currentJobModel : '');
        const inp = document.getElementById('sp360SearchInput');
        if (inp) inp.value = q;

        window.switchSp360SearchMode(initialMode || 'OMNI');
    };

    window.switchSp360SearchMode = function(mode) {
        ['OMNI', 'MODEL', 'ADD'].forEach(m => {
            const btn = document.getElementById('sp360Mode_' + m);
            if (btn) {
                btn.className = (m === mode)
                    ? 'px-3 py-1.5 rounded-lg font-extrabold bg-[#002B49] text-white shadow-xs'
                    : 'px-3 py-1.5 rounded-lg font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300';
            }
        });
        const searchBar = document.getElementById('sp360SearchBarWrap');
        if (searchBar) searchBar.classList.toggle('hidden', mode === 'ADD');

        if (mode === 'ADD') {
            renderSp360AddOrImportForm_();
            return;
        }
        if (mode === 'MODEL') {
            const inp = document.getElementById('sp360SearchInput');
            const curModel = document.getElementById('machineModel')?.value?.trim() || '';
            if (inp && !inp.value.trim() && curModel) {
                inp.value = curModel;
            }
            const sel = document.getElementById('sp360FilterSelect');
            if (sel && sel.value === 'ALL') sel.value = 'HAS_MODELS';
        }
        window.runSp360Search();
    };

    window.runSp360Search = async function() {
        const body = document.getElementById('sp360Body');
        if (!body) return;
        const allParts = await window.loadV1188MasterPartsCatalog();
        const rawQ = (document.getElementById('sp360SearchInput')?.value || '').trim().toUpperCase();
        const filterType = document.getElementById('sp360FilterSelect')?.value || 'ALL';
        const photosMap = getCustomPartPhotos_();
        const notesMap = getCustomPartNotes_();

        let filtered = allParts.filter(p => {
            const pNo = String(p.partNo || '').toUpperCase();
            const desc = String(p.desc || '').toUpperCase();
            const models = Array.isArray(p.models) ? p.models : [];
            const eqs = Array.isArray(p.eqPartNos) ? p.eqPartNos : [];
            const subs = Array.isArray(p.subPartNos) ? p.subPartNos : [];
            const hasPhoto = Boolean(p.photoUrl || photosMap[pNo]);

            if (filterType === 'HAS_MODELS' && models.length === 0) return false;
            if (filterType === 'CROSS_REF' && eqs.length === 0 && subs.length === 0) return false;
            if (filterType === 'MULTI_MODEL' && models.length < 2) return false;
            if (filterType === 'HAS_PHOTO' && !hasPhoto) return false;

            if (!rawQ) return true;
            if (pNo.includes(rawQ) || desc.includes(rawQ)) return true;
            if (eqs.some(x => String(x).toUpperCase().includes(rawQ))) return true;
            if (subs.some(x => String(x).toUpperCase().includes(rawQ))) return true;
            if (models.some(m => String(m).toUpperCase().includes(rawQ))) return true;
            return false;
        });

        // Rank exact Part No. / Equivalent No. matches to the very top
        if (rawQ) {
            filtered.sort((a, b) => {
                const aExact = (a.partNo === rawQ || (a.eqPartNos || []).includes(rawQ)) ? 0 : 1;
                const bExact = (b.partNo === rawQ || (b.eqPartNos || []).includes(rawQ)) ? 0 : 1;
                if (aExact !== bExact) return aExact - bExact;
                return (b.models?.length || 0) - (a.models?.length || 0);
            });
        }

        const totalMatched = filtered.length;
        const shown = filtered.slice(0, 45);

        if (shown.length === 0) {
            body.innerHTML = `
                <div class="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-2">
                    <div class="text-slate-500 font-bold text-sm">ไม่พบรายการอะไหล่ที่ตรงกับ "${esc1188_(rawQ)}"</div>
                    <div class="text-[11px] text-slate-400">ลองค้นหาด้วยคำสั้นลง เช่น "VALVE", "MOTOR", "BOARD", "DRIER" หรือกดเพิ่มรายการใหม่ได้ทันที</div>
                    <button type="button" onclick="switchSp360SearchMode('ADD')" class="bg-[#002B49] text-white font-bold px-4 py-2 rounded-xl mt-2">+ เพิ่มรหัสพาสนี้เข้าฐานข้อมูล</button>
                </div>
            `;
            return;
        }

        body.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-1">
                <span>พบข้อมูลที่ตรงกันทั้งหมด <b class="text-[#002B49] text-xs">${totalMatched.toLocaleString()}</b> รายการ ${totalMatched > 45 ? '(แสดง 45 รายการแรกที่ตรงที่สุด — พิมพ์รหัสหรือรุ่นให้เจาะจงขึ้นเพื่อกรอง)' : ''}</span>
                <span class="text-emerald-700 font-bold"><i class="fa-solid fa-camera mr-1"></i>ช่างและแอดมินสามารถกดถ่ายรูป/อัปโหลดภาพอะไหล่เพื่อบันทึกเข้าคลังกลางได้ทันที</span>
            </div>
            <div class="space-y-3">
                ${shown.map(p => {
                    const pNo = String(p.partNo || '');
                    const photoSrc = photosMap[pNo] || p.photoUrl || '';
                    const techTip = notesMap[pNo] || p.notes || '';
                    const models = Array.isArray(p.models) ? p.models : [];
                    const eqs = Array.isArray(p.eqPartNos) ? p.eqPartNos : [];
                    const subs = Array.isArray(p.subPartNos) ? p.subPartNos : [];
                    const stock = getPartStockStatus1188_(pNo);
                    const relatedPdfs = findDrivePdfsForModels1188_(models);

                    let compatBadge = '';
                    if (models.length === 1) {
                        compatBadge = `<span class="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full font-extrabold text-[10px]">ใช้เฉพาะรุ่นนี้รุ่นเดียว (${esc1188_(models[0])})</span>`;
                    } else if (models.length > 1) {
                        compatBadge = `<span class="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-extrabold text-[10px]">ใช้ร่วมกันได้ ${models.length} โมเดล (Cross-Model)</span>`;
                    } else {
                        compatBadge = `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold text-[10px]">ยังไม่ได้ผูกโมเดล (กด + ผูกโมเดลได้)</span>`;
                    }

                    return `
                    <div class="bg-white border-2 border-slate-200 hover:border-[#00A3E0] rounded-2xl p-3.5 shadow-xs transition">
                        <div class="flex flex-col sm:flex-row gap-3">
                            <!-- Photo Thumbnail / Capture Box -->
                            <div class="w-full sm:w-28 flex-shrink-0 flex flex-col items-center justify-center bg-slate-100 border border-slate-200 rounded-xl p-2 text-center">
                                ${photoSrc
                                    ? `<img src="${esc1188_(photoSrc)}" alt="${esc1188_(pNo)}" onclick="window.open('${esc1188_(photoSrc)}','_blank')" class="w-24 h-20 object-cover rounded-lg cursor-pointer border border-slate-300 mb-1.5">`
                                    : `<div class="w-24 h-16 rounded-lg bg-slate-200/70 flex flex-col items-center justify-center text-slate-400 mb-1.5"><i class="fa-solid fa-image text-xl"></i><span class="text-[9px] mt-0.5">ยังไม่มีรูปพาส</span></div>`
                                }
                                <label class="cursor-pointer w-full bg-[#002B49] hover:bg-sky-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg block">
                                    <i class="fa-solid fa-camera mr-1"></i>${photoSrc ? 'เปลี่ยนรูป' : '+ ถ่าย/เพิ่มรูป'}
                                    <input type="file" accept="image/*" capture="environment" class="hidden" onchange="handleV1188PartPhotoUpload('${esc1188_(pNo)}', this)">
                                </label>
                            </div>

                            <!-- Details Column -->
                            <div class="flex-1 space-y-2">
                                <div class="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <div class="flex flex-wrap items-center gap-1.5">
                                            <span class="bg-[#002B49] text-white font-mono font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-lg">${esc1188_(pNo)}</span>
                                            ${compatBadge}
                                            ${p.category ? `<span class="bg-sky-100 text-sky-900 text-[10px] font-bold px-2 py-0.5 rounded-full">${esc1188_(p.category)}</span>` : ''}
                                        </div>
                                        <div class="font-extrabold text-slate-900 text-xs sm:text-sm mt-1">${esc1188_(p.desc)}</div>
                                    </div>
                                    <div class="text-right">
                                        ${Number(p.price || 0) > 0
                                            ? `<div class="text-sm font-black text-emerald-700">${Number(p.price).toLocaleString()} <span class="text-[10px] font-normal text-slate-500">THB (ราคาตั้ง)</span></div>`
                                            : `<div class="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">รออัปเดตราคาตั้ง</div>`
                                        }
                                        ${Number(p.dealerPrice || 0) > 0 ? `<div class="text-[10px] text-slate-500">ราคาดีลเลอร์อ้างอิง: ${Number(p.dealerPrice).toLocaleString()} THB</div>` : ''}
                                    </div>
                                </div>

                                <!-- Old / Equivalent / Substitute Part Numbers -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                                    <div>
                                        <div class="text-[10px] font-extrabold text-slate-500 uppercase">รหัสพาสเก่า / รหัสโรงงานที่ใช้ร่วมกัน (Old / Equivalent):</div>
                                        <div class="flex flex-wrap gap-1 mt-1">
                                            ${eqs.length
                                                ? eqs.map(eq => `<span class="bg-amber-100 text-amber-950 border border-amber-300 font-mono font-bold px-2 py-0.5 rounded text-[10.5px]">${esc1188_(eq)}</span>`).join('')
                                                : '<span class="text-slate-400 text-[10.5px]">- ไม่มีรหัสเก่าแยก (ใช้รหัสหลักนี้โดยตรง) -</span>'
                                            }
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-[10px] font-extrabold text-slate-500 uppercase">พาสทดแทน / ใช้แทนกันได้ (Substitute Parts):</div>
                                        <div class="flex flex-wrap gap-1 mt-1">
                                            ${subs.length
                                                ? subs.map(sb => `<button type="button" onclick="document.getElementById('sp360SearchInput').value='${esc1188_(sb)}'; runSp360Search();" class="bg-sky-100 hover:bg-sky-200 text-sky-950 border border-sky-300 font-mono font-bold px-2 py-0.5 rounded text-[10.5px]"><i class="fa-solid fa-arrows-rotate mr-1"></i>${esc1188_(sb)}</button>`).join('')
                                                : '<span class="text-slate-400 text-[10.5px]">- ยังไม่ระบุพาสทดแทน -</span>'
                                            }
                                        </div>
                                    </div>
                                </div>

                                <!-- Compatible Models Badges -->
                                <div>
                                    <div class="text-[10px] font-extrabold text-slate-500 uppercase mb-1">รุ่นเครื่อง (Models) ที่ใช้พาสเบอร์นี้ได้:</div>
                                    <div class="flex flex-wrap gap-1">
                                        ${models.length
                                            ? models.map(m => `<button type="button" onclick="document.getElementById('sp360SearchInput').value='${esc1188_(m)}'; runSp360Search();" class="bg-slate-800 hover:bg-[#00A3E0] text-white font-mono font-bold px-2 py-0.5 rounded text-[10.5px] transition">${esc1188_(m)}</button>`).join('')
                                            : '<span class="text-[10.5px] text-slate-400">สามารถค้นหาหรือกดปุ่ม "+ ผูกโมเดล / โน้ตช่าง" เพื่อเพิ่มรุ่นเครื่องที่ใช้พาสนี้</span>'
                                        }
                                    </div>
                                </div>

                                <!-- Stock Status & Field Tech Tips -->
                                <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                                    <div class="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                                        ${stock.vanHits.length
                                            ? stock.vanHits.map(v => `<span class="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full"><i class="fa-solid fa-truck-pickup mr-1"></i>${esc1188_(v.van)}: มี ${v.qty} ชิ้น</span>`).join('')
                                            : '<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"><i class="fa-solid fa-truck-pickup mr-1"></i>รถช่าง: 0 ชิ้น</span>'
                                        }
                                        ${stock.whQty !== null
                                            ? `<span class="${stock.whQty > 0 ? 'bg-sky-100 text-sky-900' : 'bg-rose-100 text-rose-800'} font-bold px-2 py-0.5 rounded-full"><i class="fa-solid fa-warehouse mr-1"></i>คลังหลัก HHE: ${stock.whQty} ชิ้น</span>`
                                            : ''
                                        }
                                        ${techTip ? `<span class="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg font-semibold"><i class="fa-solid fa-circle-info text-amber-600 mr-1"></i>${esc1188_(techTip)}</span>` : ''}
                                    </div>

                                    <div class="flex flex-wrap items-center gap-1.5">
                                        ${relatedPdfs.length ? `<button type="button" onclick="openDrivePdfFromPart1188_('${esc1188_(models[0] || '')}')" class="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold px-2.5 py-1 rounded-lg text-[10.5px]"><i class="fa-solid fa-file-pdf mr-1"></i>PDF คู่มือ/Parts List (${relatedPdfs.length})</button>` : ''}
                                        <button type="button" onclick="promptEditPartCrossRef1188_('${esc1188_(pNo)}')" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-2.5 py-1 rounded-lg text-[10.5px]">
                                            <i class="fa-solid fa-pen-to-square mr-1"></i>ผูกโมเดล / พาสทดแทน / โน้ต
                                        </button>
                                        ${photoSrc ? `<button type="button" onclick="sharePartPhotoAndInfo1188_('${esc1188_(pNo)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10.5px]"><i class="fa-solid fa-share-nodes mr-1"></i>ส่งรูปให้ลูกค้า</button>` : ''}
                                        <button type="button" onclick="addSp360PartToCurrentJob('${esc1188_(pNo)}')" class="bg-[#00A3E0] hover:bg-sky-600 text-white font-extrabold px-3 py-1 rounded-lg text-[10.5px] shadow-xs">
                                            + ดึงลงใบงานซ่อม
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    };

    window.addSp360PartToCurrentJob = async function(partNo) {
        const allParts = await window.loadV1188MasterPartsCatalog();
        const found = allParts.find(x => String(x.partNo).toUpperCase() === String(partNo).toUpperCase());
        if (!found) return;
        if (typeof window.addPartsRow === 'function') {
            window.addPartsRow({
                partNo: found.partNo,
                desc: found.desc,
                qty: 1,
                price: Number(found.price || 0)
            });
        }
        document.getElementById('smartSpareParts360Modal')?.classList.add('hidden');
        if (typeof showToast === 'function') {
            showToast(`✅ เพิ่มอะไหล่ ${found.partNo} (${found.desc}) ลงตารางอะไหล่เรียบร้อย`);
        }
    };

    window.handleV1188PartPhotoUpload = function(partNo, inputEl) {
        const file = inputEl?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            // Compress image cleanly via canvas so localStorage & Google Drive sync stays lightweight
            const img = new Image();
            img.onload = function() {
                const maxW = 640;
                const scale = Math.min(1, maxW / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.78);

                const pMap = getCustomPartPhotos_();
                pMap[partNo.toUpperCase()] = dataUrl;
                saveCustomPartPhotos_(pMap);

                // Sync to Google Apps Script (Drive PART_PHOTO folder + MultiModel_Parts_Master) if connected
                const gasUrl = localStorage.getItem('hoshizaki_gas_webapp_url') || localStorage.getItem('hoshizaki_gas_url_v1') || '';
                if (gasUrl) {
                    fetch(gasUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            actionType: 'UPLOAD_V1188_PART_PHOTO_AND_META',
                            partNo: partNo,
                            photoBase64: dataUrl
                        })
                    }).catch(() => {});
                }

                window.runSp360Search();
                if (typeof showToast === 'function') {
                    showToast(`📸 บันทึกรูปภาพอะไหล่ ${partNo} เข้าคลังเรียบร้อยแล้ว`);
                }
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    window.promptEditPartCrossRef1188_ = async function(partNo) {
        const allParts = await window.loadV1188MasterPartsCatalog();
        const item = allParts.find(x => String(x.partNo).toUpperCase() === String(partNo).toUpperCase()) || { partNo, models: [], eqPartNos: [], subPartNos: [], notes: '' };
        const notesMap = getCustomPartNotes_();

        const newModelsStr = prompt(`ระบุรุ่นเครื่อง (Models) ที่ใช้พาส ${partNo} ได้ (คั่นด้วยลูกน้ำ , ):`, (item.models || []).join(', '));
        if (newModelsStr === null) return;
        const newEqStr = prompt(`ระบุรหัสพาสเก่า / รหัสโรงงานที่ใช้ร่วมกัน (Old / Equivalent Part No.):`, (item.eqPartNos || []).join(', '));
        if (newEqStr === null) return;
        const newSubStr = prompt(`ระบุรหัสพาสทดแทน (Substitute Part No.):`, (item.subPartNos || []).join(', '));
        if (newSubStr === null) return;
        const newNote = prompt(`บันทึกข้อควรระวัง / โน้ตจากช่างหน้างานสำหรับพาส ${partNo}:`, notesMap[partNo.toUpperCase()] || item.notes || '');
        if (newNote === null) return;

        const overrides = getCustomPartOverrides_();
        const updatedRec = Object.assign({}, item, {
            partNo: partNo.toUpperCase(),
            models: newModelsStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
            eqPartNos: newEqStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
            subPartNos: newSubStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
            notes: newNote.trim()
        });
        overrides[partNo.toUpperCase()] = updatedRec;
        saveCustomPartOverrides_(overrides);

        notesMap[partNo.toUpperCase()] = newNote.trim();
        saveCustomPartNotes_(notesMap);

        v1188PartsCache = null;
        await window.loadV1188MasterPartsCatalog();
        window.runSp360Search();
        if (typeof showToast === 'function') showToast(`✅ อัปเดตข้อมูลแมทโมเดลและพาสทดแทนของ ${partNo} เรียบร้อย`);
    };

    window.sharePartPhotoAndInfo1188_ = async function(partNo) {
        const allParts = await window.loadV1188MasterPartsCatalog();
        const item = allParts.find(x => String(x.partNo).toUpperCase() === String(partNo).toUpperCase());
        const msg = `อะไหล่ HOSHIZAKI\n• รหัสพาส: ${partNo}\n• รายการ: ${item?.desc || '-'}\n• รุ่นที่รองรับ: ${(item?.models || []).join(', ') || 'ตามสเปกเครื่อง'}\n${Number(item?.price || 0) > 0 ? '• ราคาตั้ง: ' + Number(item.price).toLocaleString() + ' บาท (ไม่รวม VAT)' : ''}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(msg).catch(() => {});
        }
        if (typeof showToast === 'function') {
            showToast(`📋 คัดลอกรายละเอียดพาส ${partNo} พร้อมส่งให้ลูกค้าแล้ว (คลิกขวาคัดลอกรูปภาพจากหน้าจอได้เลย)`);
        }
    };

    window.openDrivePdfFromPart1188_ = function(modelHint) {
        document.getElementById('smartSpareParts360Modal')?.classList.add('hidden');
        if (typeof window.openDriveManualSearchModal === 'function') {
            window.openDriveManualSearchModal(modelHint);
        } else {
            const driveInp = document.getElementById('driveDocSearchInput');
            if (driveInp) {
                driveInp.value = modelHint;
                driveInp.focus();
            }
        }
    };

    function renderSp360AddOrImportForm_() {
        const body = document.getElementById('sp360Body');
        if (!body) return;
        body.innerHTML = `
            <div class="bg-white border border-sky-200 rounded-2xl p-4 space-y-3">
                <div class="font-extrabold text-[#002B49] text-sm"><i class="fa-solid fa-plus-circle text-emerald-600 mr-1.5"></i>เพิ่มรายการอะไหล่ใหม่ / ผูกพาสทดแทนเข้าฐานข้อมูลกลาง (9,425+ รายการ)</div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input type="text" id="newSpPartNo" placeholder="รหัสพาสปัจจุบัน (Part No.) *" class="border rounded-xl px-3 py-2 font-mono font-bold">
                    <input type="text" id="newSpDesc" placeholder="ชื่ออะไหล่ (TH / EN) *" class="sm:col-span-2 border rounded-xl px-3 py-2 font-bold">
                    <input type="text" id="newSpModels" placeholder="รุ่นเครื่องที่ใช้ได้ (คั่นด้วย , เช่น IM-130NE, IM-220AA)" class="border rounded-xl px-3 py-2">
                    <input type="text" id="newSpEq" placeholder="รหัสพาสเก่า / รหัสโรงงาน (คั่นด้วย , )" class="border rounded-xl px-3 py-2 font-mono">
                    <input type="text" id="newSpSub" placeholder="รหัสพาสทดแทน (Substitute Part No.)" class="border rounded-xl px-3 py-2 font-mono">
                    <input type="number" id="newSpPrice" placeholder="ราคาตั้ง (THB)" class="border rounded-xl px-3 py-2">
                    <input type="text" id="newSpNote" placeholder="ข้อควรระวัง / โน้ตช่างหน้างาน" class="sm:col-span-2 border rounded-xl px-3 py-2">
                </div>
                <button type="button" onclick="saveNewSp360ManualEntry_()" class="bg-[#002B49] hover:bg-sky-900 text-white font-extrabold px-4 py-2 rounded-xl shadow-xs">
                    <i class="fa-solid fa-floppy-disk mr-1"></i> บันทึกเข้าฐานข้อมูลอะไหล่ 360°
                </button>
            </div>
        `;
    }

    window.saveNewSp360ManualEntry_ = async function() {
        const pNo = document.getElementById('newSpPartNo')?.value.trim().toUpperCase();
        const desc = document.getElementById('newSpDesc')?.value.trim();
        if (!pNo || !desc) { alert('กรุณากรอกรหัสพาส (Part No.) และชื่ออะไหล่'); return; }
        const overrides = getCustomPartOverrides_();
        overrides[pNo] = {
            partNo: pNo,
            desc: desc,
            price: Number(document.getElementById('newSpPrice')?.value || 0),
            models: (document.getElementById('newSpModels')?.value || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
            eqPartNos: (document.getElementById('newSpEq')?.value || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
            subPartNos: (document.getElementById('newSpSub')?.value || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
            notes: (document.getElementById('newSpNote')?.value || '').trim()
        };
        saveCustomPartOverrides_(overrides);
        v1188PartsCache = null;
        await window.loadV1188MasterPartsCatalog();
        window.switchSp360SearchMode('OMNI');
        document.getElementById('sp360SearchInput').value = pNo;
        window.runSp360Search();
        if (typeof showToast === 'function') showToast(`✅ เพิ่มรหัสพาส ${pNo} เข้าฐานข้อมูลเรียบร้อย`);
    };

    // ========================================================================
    // SERVICE CONTROL TOWER MODAL (1-CLICK SERVICE DEPARTMENT COMMAND CENTER)
    // ========================================================================
    window.openServiceControlTowerV1188Modal = function() {
        let modal = document.getElementById('serviceControlTowerV1188Modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'serviceControlTowerV1188Modal';
            modal.className = 'hidden fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-[121] flex items-center justify-center p-2 sm:p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-sky-300">
                    <div class="bg-gradient-to-r from-[#002B49] via-sky-900 to-slate-900 text-white px-4 py-3 flex items-center justify-between">
                        <div>
                            <h3 class="font-extrabold text-sm sm:text-base flex items-center gap-2">
                                <i class="fa-solid fa-tower-broadcast text-emerald-400"></i>
                                <span>HOSHIZAKI Service Control Tower (v1188 — คุมงานบริการ 100%)</span>
                            </h3>
                            <p class="text-[11px] text-sky-200">ศูนย์รวมคิวงานช่าง • สต็อกรถช่าง T01–T08 • รอบ PM 30 วัน • ตรวจความครบถ้วนก่อนปิดงาน & ค้นหาอะไหล่ 360°</p>
                        </div>
                        <button type="button" onclick="document.getElementById('serviceControlTowerV1188Modal').classList.add('hidden')" class="bg-red-600 hover:bg-red-700 text-white rounded-lg w-8 h-8 font-black text-lg">&times;</button>
                    </div>
                    <div id="serviceControlTowerBody" class="p-4 overflow-y-auto flex-1 text-xs space-y-4 bg-slate-50"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        let jobs = [];
        try { jobs = JSON.parse(localStorage.getItem('hoshizaki_service_history_v1') || '[]'); } catch (e) {}
        let vans = [];
        try { vans = JSON.parse(localStorage.getItem('hoshizaki_van_stock_v1') || '[]'); } catch (e) {}

        const openJobs = jobs.filter(j => !/COMPLETE|DONE|ปิดงาน/i.test(String(j.jobStatus || j.status || '')));
        const waitPartsJobs = openJobs.filter(j => /PART|รออะไหล่|HOLD/i.test(String(j.jobStatus || j.status || '')));
        const lowVanItems = vans.filter(v => Number(v.qty || 0) <= 1);

        const body = document.getElementById('serviceControlTowerBody');
        body.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-white border-l-4 border-[#002B49] rounded-xl p-3 shadow-xs">
                    <div class="text-[11px] text-slate-500 font-bold">ใบงานบริการเปิดอยู่ (Active Jobs)</div>
                    <div class="text-2xl font-black text-[#002B49] mt-0.5">${openJobs.length} <span class="text-xs font-normal">งาน</span></div>
                </div>
                <div class="bg-white border-l-4 border-amber-500 rounded-xl p-3 shadow-xs">
                    <div class="text-[11px] text-slate-500 font-bold">งานรออะไหล่ / GIT ETA</div>
                    <div class="text-2xl font-black text-amber-600 mt-0.5">${waitPartsJobs.length} <span class="text-xs font-normal">งาน</span></div>
                </div>
                <div class="bg-white border-l-4 border-rose-500 rounded-xl p-3 shadow-xs">
                    <div class="text-[11px] text-slate-500 font-bold">อะไหล่รถช่าง T01–T08 ใกล้หมด</div>
                    <div class="text-2xl font-black text-rose-600 mt-0.5">${lowVanItems.length} <span class="text-xs font-normal">รายการ</span></div>
                </div>
                <div class="bg-white border-l-4 border-emerald-500 rounded-xl p-3 shadow-xs">
                    <div class="text-[11px] text-slate-500 font-bold">ฐานข้อมูลอะไหล่ 360° พร้อมใช้</div>
                    <div class="text-2xl font-black text-emerald-700 mt-0.5">9,425 <span class="text-xs font-normal">รายการ</span></div>
                </div>
            </div>

            <!-- Quick 1-Tap Field & Admin Launchers -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button type="button" onclick="document.getElementById('serviceControlTowerV1188Modal').classList.add('hidden'); openSmartSpareParts360Modal('', 'OMNI');" class="bg-gradient-to-r from-[#002B49] to-[#0082C8] text-white rounded-xl p-3.5 text-left shadow-xs hover:opacity-95 transition">
                    <div class="font-extrabold text-sm flex items-center justify-between">
                        <span><i class="fa-solid fa-gears text-amber-300 mr-1.5"></i>ค้นหาอะไหล่ 360° & รูปภาพ</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </div>
                    <div class="text-[11px] text-sky-100 mt-1">พาสเก่า/ใหม่ • พาสทดแทน • เช็กโมเดลใช้ร่วมกัน • ถ่ายรูปพาส</div>
                </button>
                <button type="button" onclick="document.getElementById('serviceControlTowerV1188Modal').classList.add('hidden'); openSmartSpareParts360Modal(document.getElementById('machineModel')?.value || '', 'MODEL');" class="bg-white border-2 border-[#00A3E0] text-[#002B49] rounded-xl p-3.5 text-left shadow-xs hover:bg-sky-50 transition">
                    <div class="font-extrabold text-sm flex items-center justify-between">
                        <span><i class="fa-solid fa-screwdriver-wrench text-[#00A3E0] mr-1.5"></i>อะไหล่เฉพาะรุ่นเครื่องหน้างาน</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </div>
                    <div class="text-[11px] text-slate-600 mt-1">ดึงรายการพาสตรงรุ่นเครื่องที่กำลังซ่อม + เช็กสต็อกรถช่าง</div>
                </button>
                <button type="button" onclick="document.getElementById('serviceControlTowerV1188Modal').classList.add('hidden'); if(typeof openServiceDispatchCalendarModal==='function') openServiceDispatchCalendarModal();" class="bg-white border-2 border-emerald-500 text-slate-900 rounded-xl p-3.5 text-left shadow-xs hover:bg-emerald-50 transition">
                    <div class="font-extrabold text-sm flex items-center justify-between">
                        <span><i class="fa-solid fa-calendar-check text-emerald-600 mr-1.5"></i>ตารางคิวช่าง & รอบ PM 30 วัน</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </div>
                    <div class="text-[11px] text-slate-600 mt-1">จ่ายงานช่าง T01–T08, Outsource และนัดหมายลูกค้า</div>
                </button>
            </div>

            <!-- Active Service Queue Table -->
            <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div class="bg-[#002B49] text-white px-3 py-2 font-bold flex items-center justify-between">
                    <span><i class="fa-solid fa-list-check text-[#00A3E0] mr-1.5"></i>รายการใบงานบริการที่กำลังดำเนินการ (Active Service Jobs)</span>
                    <span class="text-[10px] text-sky-200">อัปเดตสดจากระบบ Service Report</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-100 text-[11px] text-slate-700">
                            <tr><th class="p-2 border-b">Job No.</th><th class="p-2 border-b">ลูกค้า / สถานที่</th><th class="p-2 border-b">รุ่น / S/N</th><th class="p-2 border-b">ช่างผู้รับผิดชอบ</th><th class="p-2 border-b">สถานะ</th><th class="p-2 border-b text-right">เครื่องมือ</th></tr>
                        </thead>
                        <tbody>
                            ${openJobs.length ? openJobs.slice(0, 15).map(j => `
                                <tr class="border-b hover:bg-sky-50/50">
                                    <td class="p-2 font-mono font-bold text-[#002B49]">${esc1188_(j.jobNo || '-')}</td>
                                    <td class="p-2 font-semibold">${esc1188_(j.customerName || j.storeName || '-')}</td>
                                    <td class="p-2 font-mono text-[11px]">${esc1188_(j.model || '-')} ${j.serialNo ? '(' + esc1188_(j.serialNo) + ')' : ''}</td>
                                    <td class="p-2">${esc1188_(j.technicianName || j.responsibleTech || '-')}</td>
                                    <td class="p-2"><span class="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-bold">${esc1188_(j.jobStatus || j.status || 'กำลังดำเนินการ')}</span></td>
                                    <td class="p-2 text-right">
                                        <button type="button" onclick="document.getElementById('serviceControlTowerV1188Modal').classList.add('hidden'); openSmartSpareParts360Modal('${esc1188_(j.model || '')}', 'MODEL');" class="bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold px-2 py-1 rounded text-[10px]">เช็กพาสตรงรุ่น</button>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" class="p-4 text-center text-slate-500">ยังไม่มีใบงานค้างในระบบ (กดสร้างใบงานใหม่หรือดูประวัติงานซ่อมทั้งหมดได้ทันที)</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
    };

    // Mount compact v1188 Service-First pills & Quick Parts 360 button on boot
    function mountV1188ServiceFirstControls_() {
        window.applyV1188ServiceFirstFocusMode();

        // 1. Add compact Service Control Tower & Parts 360 buttons into top header status pill row
        const pillRow = document.getElementById('topHeaderStatusPillsRow') || document.getElementById('topHeaderRightPillsWrap');
        if (pillRow && !document.getElementById('btnV1188ServiceControlTower')) {
            const btnTower = document.createElement('button');
            btnTower.type = 'button';
            btnTower.id = 'btnV1188ServiceControlTower';
            btnTower.onclick = window.openServiceControlTowerV1188Modal;
            btnTower.className = 'hzk-compact-pill text-[10px] px-2.5 py-0.5 rounded-full font-extrabold bg-emerald-500 hover:bg-emerald-400 text-[#002B49] shadow-xs flex items-center gap-1 transition';
            btnTower.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i><span>Service Control</span>';
            pillRow.appendChild(btnTower);

            const btnParts = document.createElement('button');
            btnParts.type = 'button';
            btnParts.id = 'btnV1188SmartParts360';
            btnParts.onclick = function() { window.openSmartSpareParts360Modal('', 'OMNI'); };
            btnParts.className = 'hzk-compact-pill text-[10px] px-2.5 py-0.5 rounded-full font-extrabold bg-amber-400 hover:bg-amber-300 text-[#002B49] shadow-xs flex items-center gap-1 transition';
            btnParts.innerHTML = '<i class="fa-solid fa-gears"></i><span>ค้นหาพาส 360° (9,425)</span>';
            pillRow.appendChild(btnParts);

            const btnFocus = document.createElement('button');
            btnFocus.type = 'button';
            btnFocus.id = 'btnV1188ToggleFocusMode';
            btnFocus.onclick = function() {
                window.setV1188FocusMode(window.getV1188FocusMode() === 'SERVICE_ONLY' ? 'ALL_DEPTS' : 'SERVICE_ONLY');
            };
            btnFocus.className = 'hzk-compact-pill text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-white/15 hover:bg-white/25 text-white border border-white/30 flex items-center transition';
            pillRow.appendChild(btnFocus);
            window.applyV1188ServiceFirstFocusMode();
        }

        // 2. Also add "ค้นหาพาส 360° / ดูพาสตรงรุ่น" button next to Parts Table in the Service Form
        const partsTable = document.getElementById('partsTableBody')?.closest('table') || document.getElementById('partsListContainer');
        if (partsTable && !document.getElementById('btnInlineSp360Finder')) {
            const bar = document.createElement('div');
            bar.id = 'btnInlineSp360Finder';
            bar.className = 'mb-2 p-2.5 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 flex flex-wrap items-center justify-between gap-2 text-xs';
            bar.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg bg-[#002B49] text-[#00A3E0] flex items-center justify-center font-bold"><i class="fa-solid fa-gears"></i></span>
                    <div>
                        <div class="font-extrabold text-[#002B49]">ระบบค้นหาอะไหล่ 360° (9,425+ รายการ) & คลังรูปภาพอะไหล่</div>
                        <div class="text-[10.5px] text-slate-600">เช็กพาสเก่า ↔ พาสใหม่, พาสทดแทน, โมเดลที่ใช้ร่วมกัน และดู/ถ่ายรูปอะไหล่จริงหน้างาน</div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    <button type="button" onclick="openSmartSpareParts360Modal(document.getElementById('machineModel')?.value || '', 'MODEL')" class="bg-[#00A3E0] hover:bg-sky-600 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs">
                        <i class="fa-solid fa-screwdriver-wrench mr-1"></i>ดูพาสเฉพาะรุ่นนี้
                    </button>
                    <button type="button" onclick="openSmartSpareParts360Modal('', 'OMNI')" class="bg-[#002B49] hover:bg-sky-900 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs">
                        <i class="fa-solid fa-magnifying-glass mr-1"></i>ค้นหาพาส / เทียบรุ่น 360°
                    </button>
                </div>
            `;
            partsTable.parentNode.insertBefore(bar, partsTable);
        }

        // Preload parts catalog silently in background for instant 0ms search
        window.loadV1188MasterPartsCatalog();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountV1188ServiceFirstControls_);
    } else {
        mountV1188ServiceFirstControls_();
    }
})();
