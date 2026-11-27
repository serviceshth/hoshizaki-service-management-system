/* ============================================================================
 * HOSHIZAKI (THAILAND) Job Service Management PWA
 * Enterprise V.1195 — Sales, Marketing, Executive 360° & Org-Wide Mobile RBAC Suite
 * Author: Noparin Homhoul (Deputy Service Manager, Hoshizaki Thailand)
 * ============================================================================ */
(function () {
  'use strict';

  const V1195_VERSION = 'V.1195-OMNI-SALES-MKT-360';
  const STORAGE_KEYS = {
    SESSION: 'hzk_v1195_active_mobile_session',
    VAULT: 'hzk_v1195_staff_credentials_vault',
    KNOWN_USERS: 'hzk_v1195_known_device_users',
    LOCKOUT: 'hzk_v1195_login_lockout_map',
    BUSINESS_CARDS: 'hzk_v1195_scanned_business_cards',
    DAILY_ORDERS: 'hzk_v1195_daily_live_orders',
    SN_CARETAKERS: 'hzk_v1195_sn_caretaker_lineage',
    IMPORT_SIM: 'hzk_v1195_factory_import_proposals',
    CONF_ROOM: 'hzk_v1195_presentation_room_state'
  };

  // All 8 Departments & 22 Staff Profiles (Default Password = Normalized Mobile Phone)
  const DEFAULT_STAFF_ROSTER_V1195 = [
    { id: 'SVC-01', code: 'T01', name: 'Mr. Thanakrit Chanmokonpanit', nickname: 'Tae', department: 'Service Unit', position: 'Services Unit Manager', rbacRole: 'SUPER_ADMIN', phone: '0968043989', email: 'thanakrit@hoshizaki.co.th', birthday: '05-14', joinDate: '2016-04-01' },
    { id: 'SVC-02', code: 'T02', name: 'Mr. Noparin Homhoul', nickname: 'Rinny', department: 'Service Unit', position: 'Deputy Services Unit Manager', rbacRole: 'SUPER_ADMIN', phone: '0972305941', email: 'noparin@hoshizaki.co.th', birthday: '08-22', joinDate: '2017-06-01' },
    { id: 'SVC-03', code: 'T03', name: 'Mr. Surin Sarawong', nickname: 'Rin', department: 'Service Unit', position: 'Senior Services Staff', rbacRole: 'SUPERVISOR', phone: '0917672018', email: 'surin@hoshizaki.co.th', birthday: '03-11', joinDate: '2018-02-15' },
    { id: 'SVC-04', code: 'T05', name: 'Mr. Nirun Sornrat', nickname: 'Pui', department: 'Service Unit', position: 'Services Staff', rbacRole: 'TECHNICIAN', phone: '0917672038', email: 'nirun@hoshizaki.co.th', birthday: '11-28', joinDate: '2019-07-01' },
    { id: 'SVC-05', code: 'T08', name: 'Ms. Wanwipha Nakamrod', nickname: 'Oh', department: 'Service Unit', position: 'Services Admin Staff', rbacRole: 'SUPERVISOR', phone: '0938278132', email: 'wanwipha@hoshizaki.co.th', birthday: '09-09', joinDate: '2019-01-10' },
    { id: 'SVC-06', code: 'T06', name: 'Mr. Surin Tharapai', nickname: 'Beer', department: 'Service Unit', position: 'Services Staff', rbacRole: 'TECHNICIAN', phone: '0638655442', email: 'surin.t@hoshizaki.co.th', birthday: '04-19', joinDate: '2020-03-01' },
    { id: 'SVC-07', code: 'T04', name: 'Mr. Jeerapan Phrasawang', nickname: 'Ceasar', department: 'Service Unit', position: 'Services Staff', rbacRole: 'TECHNICIAN', phone: '0917672079', email: 'jeerapan@hoshizaki.co.th', birthday: '07-15', joinDate: '2021-05-15' },
    { id: 'CTR-01', code: 'T07', name: 'Mr. Pawat Warongtheradet', nickname: 'Prince', department: 'Service Center', position: 'Service Center & Warehouse IMS', rbacRole: 'SERVICE_CENTER_IMS', phone: '0995081908', email: 'pawat@hoshizaki.co.th', birthday: '12-03', joinDate: '2021-09-01' },
    { id: 'EXE-01', code: 'EXE', name: 'Mr. Daisuke Suzuki', nickname: 'Suzuki', department: 'Executive Management', position: 'Managing Director / GM Accounting & Admin', rbacRole: 'EXECUTIVE', phone: '0889855979', email: 'suzuki@hoshizaki.co.th', birthday: '02-18', joinDate: '2022-04-01' },
    { id: 'ADM-01', code: 'ADM1', name: 'Ms. Kanokwan Treesukol', nickname: 'Kanokwan', department: 'Admin Unit', position: 'Admin Staff (Parts & Logistics)', rbacRole: 'ADMIN_UNIT', phone: '0971356304', email: 'kanokwan@hoshizaki.co.th', birthday: '06-21', joinDate: '2018-08-01' },
    { id: 'ADM-02', code: 'ADM2', name: 'Mr. Nattapong Chataram', nickname: 'Nattapong', department: 'Admin Unit', position: 'Admin Staff (Delivery & Warehouse)', rbacRole: 'ADMIN_UNIT', phone: '0917727423', email: 'nattapong@hoshizaki.co.th', birthday: '10-12', joinDate: '2020-11-01' },
    { id: 'ADM-03', code: 'ADM3', name: 'Mr. Chayanin Kuptrakul', nickname: 'Chayanin', department: 'Admin Unit', position: 'Admin Staff', rbacRole: 'ADMIN_UNIT', phone: '0900000003', email: 'chayanin@hoshizaki.co.th', birthday: '01-25', joinDate: '2023-02-01' },
    { id: 'ACC-01', code: 'ACC1', name: 'Ms. Waraporn Kianthong', nickname: 'Waraporn', department: 'Accounting Unit', position: 'Senior Accounting Staff', rbacRole: 'ACCOUNTING_UNIT', phone: '0936455623', email: 'waraporn@hoshizaki.co.th', birthday: '03-30', joinDate: '2017-03-01' },
    { id: 'ACC-02', code: 'ACC2', name: 'Ms. Duangkamon Tantayanon', nickname: 'Duangkamon', department: 'Accounting Unit', position: 'Accounting Staff', rbacRole: 'ACCOUNTING_UNIT', phone: '0813728190', email: 'duangkamon@hoshizaki.co.th', birthday: '08-08', joinDate: '2019-09-16' },
    { id: 'ACC-03', code: 'ACC3', name: 'Ms. Witharat Riangpha', nickname: 'Witharat', department: 'Accounting Unit', position: 'Accounting Staff', rbacRole: 'ACCOUNTING_UNIT', phone: '0959594734', email: 'witharat@hoshizaki.co.th', birthday: '11-11', joinDate: '2022-01-10' },
    { id: 'SLS-01', code: 'SLS1', name: 'Ms. Kulathida Charoenying', nickname: 'Kulathida', department: 'Sales Unit', position: 'Senior Sales Executive', rbacRole: 'SALES_UNIT', phone: '0968983388', email: 'kulathida@hoshizaki.co.th', birthday: '05-05', joinDate: '2018-05-01' },
    { id: 'SLS-02', code: 'SLS2', name: 'Ms. Janyaluck Paithaisong', nickname: 'Janyaluck', department: 'Sales Unit', position: 'Sales Executive', rbacRole: 'SALES_UNIT', phone: '0909720947', email: 'janyaluck@hoshizaki.co.th', birthday: '09-17', joinDate: '2020-06-15' },
    { id: 'SLS-03', code: 'SLS3', name: 'Ms. Ketsaraporn Porjai', nickname: 'Ketsaraporn', department: 'Sales Unit', position: 'Sales Executive', rbacRole: 'SALES_UNIT', phone: '0968043988', email: 'ketsaraporn@hoshizaki.co.th', birthday: '12-19', joinDate: '2021-10-01' },
    { id: 'MKT-01', code: 'MKT1', name: 'Ms. Taksaon Tipsrisombat', nickname: 'Taksaon', department: 'Marketing Unit', position: 'Marketing Executive', rbacRole: 'MARKETING_UNIT', phone: '0917672092', email: 'taksaon@hoshizaki.co.th', birthday: '04-04', joinDate: '2019-11-01' },
    { id: 'MKT-02', code: 'MKT2', name: 'Mr. Khajornyot Jewkrang', nickname: 'Khajornyot', department: 'Marketing Unit', position: 'Marketing Specialist', rbacRole: 'MARKETING_UNIT', phone: '0638211294', email: 'khajornyot@hoshizaki.co.th', birthday: '07-29', joinDate: '2022-08-01' },
    { id: 'JPC-01', code: 'JPC1', name: 'Ms. Suleewan Siripirom', nickname: 'Suleewan', department: 'Japanese Corporate Unit', position: 'Japanese Corporate Coordinator', rbacRole: 'JAPANESE_CORP', phone: '0638108586', email: 'suleewan@hoshizaki.co.th', birthday: '10-24', joinDate: '2019-04-01' },
    { id: 'JPC-02', code: 'JPC2', name: 'Mr. Naoki Furujo', nickname: 'Furujo', department: 'Japanese Corporate Unit', position: 'Japanese Corporate Manager', rbacRole: 'JAPANESE_CORP', phone: '0641484245', email: 'furujo@hoshizaki.co.th', birthday: '01-15', joinDate: '2025-07-01' }
  ];

  // Sample & Live-Synced Master Companies + Models + S/N Caretaker Lineage
  const DEFAULT_COMPANY_360_RECORDS = [
    {
      companyId: 'CUST-001',
      companyName: 'บริษัท คาเฟ่ อเมซอน ฟู้ด แอนด์ เบฟเวอเรจ จำกัด (สำนักงานใหญ่)',
      taxId: '0105559012345',
      channelGrade: 'Direct Key Account',
      contactName: 'คุณวิภาดา รัตนโชติ',
      contactTitle: 'ผู้จัดการฝ่ายจัดซื้ออุปกรณ์ครัว',
      phone: '081-912-4455',
      email: 'wipada.r@cafe-partner.co.th',
      lineId: '@wipada_procure',
      address: '555/2 ถ.วิภาวดีรังสิต แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900',
      lat: 13.8165,
      lng: 100.5612,
      businessCardImg: '',
      assignedOwner: 'Ms. Kulathida Charoenying (Sales Unit)',
      metrics: { daily: 148000, weekly: 425000, monthly: 1280000, yearly: 8450000, lifetime: 24900000, lastOrderDate: '2026-11-27', lastOrderAmount: 148000 },
      machines: [
        { model: 'IM-130NE', subModel: 'IM-130NE-HC (R290)', sn: 'H012458A', installDate: '2024-03-15', originalDealer: 'Hoshizaki Direct', currentCaretaker: 'Hoshizaki Direct Service', transferHistory: '2024-03: ติดตั้งสาขาวิภาวดี (Direct)', status: 'Active' },
        { model: 'KM-230AJ', subModel: 'KM-230AJ-E', sn: 'K998120B', installDate: '2023-08-20', originalDealer: 'บริษัท คิทเช่นโปร ดีลเลอร์ จำกัด', currentCaretaker: 'Hoshizaki Direct Service (โอนย้ายสาขา)', transferHistory: '2023-08: ขายผ่าน KitchenPro Dealer ➔ 2025-11: ย้ายเข้าคลังกลางและโอนดูแลโดย Hoshizaki Direct', status: 'PM Due Soon' }
      ],
      timeline: [
        { date: '2026-11-27', type: 'SALE', docNo: 'QT2026-1189 / PO-8841', model: 'IM-130NE-HC (x2)', desc: 'สั่งซื้อเครื่องทำน้ำแข็งก้อนสี่เหลี่ยม รุ่นประหยัดพลังงาน R290 พร้อมไส้กรอง 4HC-H', amount: 148000, status: 'PO Approved' },
        { date: '2026-11-12', type: 'PM', docNo: 'JOB2026-4410', model: 'KM-230AJ (S/N: K998120B)', desc: 'ล้างบำรุงรักษาใหญ่ Big Cleaning + เปลี่ยนไส้กรองน้ำ 4HC-H (ช่าง: Noparin)', amount: 4500, status: 'Completed' },
        { date: '2026-09-04', type: 'REPAIR', docNo: 'JOB2026-3892', model: 'IM-130NE (S/N: H012458A)', desc: 'เปลี่ยนวาล์วน้ำเข้า Water Valve (P01872-01) และตรวจเช็กแรงดันน้ำยา', amount: 3250, status: 'Completed' }
      ]
    },
    {
      companyId: 'CUST-002',
      companyName: 'บริษัท สยาม ซูชิ กรุ๊ป (ไทยแลนด์) จำกัด',
      taxId: '0105561088991',
      channelGrade: 'Japanese Corporate (JPC)',
      contactName: 'Mr. Kenji Takahashi',
      contactTitle: 'Operations & Store Expansion Director',
      phone: '089-774-2211',
      email: 'k.takahashi@siamsushi-jp.co.th',
      lineId: 'kenji_sushi_th',
      address: '88 อาคารปาร์คเวนเชอร์ ชั้น 14 ถ.วิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพฯ 10330',
      lat: 13.7436,
      lng: 100.5478,
      businessCardImg: '',
      assignedOwner: 'Mr. Naoki Furujo / Ms. Suleewan (Japanese Corp)',
      metrics: { daily: 285000, weekly: 640000, monthly: 1890000, yearly: 11200000, lifetime: 31500000, lastOrderDate: '2026-11-27', lastOrderAmount: 285000 },
      machines: [
        { model: 'HNC-180BE-R-B', subModel: 'HNC-180BE-R-B (Sushi Case)', sn: 'S554102J', installDate: '2025-01-18', originalDealer: 'Hoshizaki Direct (JPC)', currentCaretaker: 'Hoshizaki Direct Service', transferHistory: '2025-01: ติดตั้งสาขาเพลินจิต (JPC VIP)', status: 'Active' },
        { model: 'HR-120MA-S', subModel: 'HR-120MA-S (4-Door Chiller)', sn: 'R772190J', installDate: '2022-05-10', originalDealer: 'บริษัท โตเกียว คิทเช่น ซัพพลาย จำกัด', currentCaretaker: 'บริษัท โตเกียว คิทเช่น ซัพพลาย จำกัด', transferHistory: '2022-05: ดูแลต่อเนื่องโดย Dealer Tokyo Kitchen Supply', status: 'Trade-In Candidate' }
      ],
      timeline: [
        { date: '2026-11-27', type: 'SALE', docNo: 'QT2026-1192 / DO-2026-504', model: 'HNC-180BE-R-B + IM-65NE', desc: 'เปิดสาขาใหม่ทองหล่อ ชุดตู้ซูชิและเครื่องทำน้ำแข็ง', amount: 285000, status: 'DO Ready' },
        { date: '2026-10-19', type: 'REPAIR', docNo: 'JOB2026-4120', model: 'HR-120MA-S (S/N: R772190J)', desc: 'เปลี่ยนเซ็นเซอร์อุณหภูมิและยางขอบประตู (ซ่อมครั้งที่ 3 ในรอบปี — แนะนำ Trade-In)', amount: 5800, status: 'Completed' }
      ]
    },
    {
      companyId: 'CUST-003',
      companyName: 'บริษัท คิทเช่นโปร ดีลเลอร์ จำกัด (Authorized Dealer Grade A)',
      taxId: '0105554077123',
      channelGrade: 'Dealer Grade A',
      contactName: 'คุณธนพล กิจเจริญรุ่งเรือง',
      contactTitle: 'กรรมการผู้จัดการ (Managing Director)',
      phone: '086-331-9090',
      email: 'thanapol@kitchenpro-dealer.co.th',
      lineId: 'thanapol_kp',
      address: '129/8 ถ.บางนา-ตราด กม.12 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540',
      lat: 13.6331,
      lng: 100.7118,
      businessCardImg: '',
      assignedOwner: 'Ms. Janyaluck Paithaisong (Sales Unit)',
      metrics: { daily: 96000, weekly: 510000, monthly: 1650000, yearly: 14800000, lifetime: 46200000, lastOrderDate: '2026-11-27', lastOrderAmount: 96000 },
      machines: [
        { model: 'IM-240ANE', subModel: 'IM-240ANE-21', sn: 'M883211D', installDate: '2026-06-12', originalDealer: 'บริษัท คิทเช่นโปร ดีลเลอร์ จำกัด', currentCaretaker: 'บริษัท คิทเช่นโปร ดีลเลอร์ จำกัด (Dealer Service)', transferHistory: '2026-06: ซื้อสต็อกดีลเลอร์ ➔ ติดตั้งโรงแรมพัทยา', status: 'Warranty Active' }
      ],
      timeline: [
        { date: '2026-11-27', type: 'SALE', docNo: 'QT2026-1190 / SI-2026-881', model: 'IM-45NE (x2) + ไส้กรอง 4HC-H (x10)', desc: 'สั่งซื้อเติมสต็อกดีลเลอร์ประจำสัปดาห์', amount: 96000, status: 'Invoiced (SI)' },
        { date: '2026-11-02', type: 'PARTS', docNo: 'SO2026-7731', model: 'Pump Motor PA0613 + Board', desc: 'เบิกอะไหล่แท้สำหรับงานบริการลูกค้าของดีลเลอร์', amount: 18400, status: 'Delivered' }
      ]
    },
    {
      companyId: 'CUST-004',
      companyName: 'โรงแรม อันดามัน เพิร์ล รีสอร์ท แอนด์ สปา (ภูเก็ต)',
      taxId: '0835558004512',
      channelGrade: 'Direct Hospitality',
      contactName: 'คุณกิตติศักดิ์ วงศ์สุวรรณ',
      contactTitle: 'Chief Engineer (หัวหน้าแผนกช่างอาคาร)',
      phone: '076-341-998',
      email: 'chief.eng@andamanpearl-phuket.com',
      lineId: 'kittisak_eng_pkt',
      address: '99/1 ถ.ทวีวงศ์ ต.ป่าตอง อ.กะทู้ จ.ภูเก็ต 83150',
      lat: 7.8965,
      lng: 98.2968,
      businessCardImg: '',
      assignedOwner: 'Ms. Ketsaraporn Porjai (Sales Unit) + Phuket Outsource Hub',
      metrics: { daily: 42000, weekly: 195000, monthly: 780000, yearly: 4950000, lifetime: 13800000, lastOrderDate: '2026-11-26', lastOrderAmount: 42000 },
      machines: [
        { model: 'FM-480AKE', subModel: 'FM-480AKE-SB (Flake Ice)', sn: 'F441908P', installDate: '2024-11-05', originalDealer: 'Hoshizaki Direct', currentCaretaker: 'Hoshizaki Direct + Outsource Phuket', transferHistory: '2024-11: ติดตั้งห้องอาหารซีฟู้ด ป่าตอง', status: 'Active' }
      ],
      timeline: [
        { date: '2026-11-26', type: 'SALE', docNo: 'QT2026-1185', model: 'PM Annual Contract (4 เครื่อง)', desc: 'ต่อสัญญาบำรุงรักษารายปี 4 ครั้ง + ไส้กรองน้ำ 4HC-H', amount: 42000, status: 'Completed' },
        { date: '2026-10-08', type: 'REPAIR', docNo: 'JOB2026-4015', model: 'FM-480AKE (S/N: F441908P)', desc: 'เปลี่ยนชุดซีลและลูกปืน Auger + ล้างทำความสะอาดระบบน้ำ', amount: 12900, status: 'Completed' }
      ]
    },
    {
      companyId: 'CUST-005',
      companyName: 'บริษัท ฟู้ดแลนด์ ซูเปอร์มาร์เก็ต จำกัด (สาขาหลักสี่)',
      taxId: '0105515002311',
      channelGrade: 'Direct Retail Chain',
      contactName: 'คุณสมชาย เจริญสุข',
      contactTitle: 'ผู้จัดการฝ่ายซ่อมบำรุงสาขา',
      phone: '081-822-7766',
      email: 'somchai.m@retail-chain.co.th',
      lineId: 'somchai_maint',
      address: '99 ถ.แจ้งวัฒนะ แขวงทุ่งสองห้อง เขตหลักสี่ กรุงเทพฯ 10210',
      lat: 13.8879,
      lng: 100.5762,
      businessCardImg: '',
      assignedOwner: 'Ms. Kulathida Charoenying (Sales Unit)',
      metrics: { daily: 64500, weekly: 280000, monthly: 920000, yearly: 6150000, lifetime: 19400000, lastOrderDate: '2026-11-27', lastOrderAmount: 64500 },
      machines: [
        { model: 'IM-100NE', subModel: 'IM-100NE-HC', sn: 'H339011L', installDate: '2025-04-10', originalDealer: 'Hoshizaki Direct', currentCaretaker: 'Hoshizaki Direct Service', transferHistory: '2025-04: ติดตั้งแผนกอาหารสด หลักสี่', status: 'Active' }
      ],
      timeline: [
        { date: '2026-11-27', type: 'SALE', docNo: 'QT2026-1193', model: 'IM-100NE-HC (x1)', desc: 'สั่งซื้อเครื่องทำน้ำแข็งเสริมโซนเบเกอรี่', amount: 64500, status: 'QT Sent' }
      ]
    }
  ];

  // Factory Import & Demand Forecasting Advisor Baseline (Linked to Stock + GIT + Service Failure Rate)
  const DEFAULT_FACTORY_IMPORT_ADVISOR = [
    { model: 'IM-130NE-HC', category: 'Cube Ice Maker (R290)', origin: 'Hoshizaki Suzhou / Japan', sold30d: 48, sold90d: 134, stockOnHand: 18, gitInTransit: 20, pipelineReserved: 15, failureRatePct: 1.2, unitCostThb: 41500, sellingPriceThb: 74000, leadTimeWeeks: 6 },
    { model: 'IM-100NE-HC', category: 'Cube Ice Maker (R290)', origin: 'Hoshizaki Suzhou / Japan', sold30d: 39, sold90d: 112, stockOnHand: 12, gitInTransit: 15, pipelineReserved: 10, failureRatePct: 1.4, unitCostThb: 36200, sellingPriceThb: 64500, leadTimeWeeks: 6 },
    { model: 'HNC-180BE-R-B', category: 'Sushi Display Case', origin: 'Hoshizaki Japan HQ', sold30d: 14, sold90d: 38, stockOnHand: 4, gitInTransit: 5, pipelineReserved: 6, failureRatePct: 0.8, unitCostThb: 54000, sellingPriceThb: 95000, leadTimeWeeks: 8 },
    { model: 'KM-230AJ', category: 'Crescent Ice Maker', origin: 'Hoshizaki USA / Suzhou', sold30d: 22, sold90d: 61, stockOnHand: 16, gitInTransit: 10, pipelineReserved: 8, failureRatePct: 2.1, unitCostThb: 59000, sellingPriceThb: 105000, leadTimeWeeks: 8 },
    { model: 'HR-120MA-S', category: 'Upright Refrigerator', origin: 'Hoshizaki Europe / China', sold30d: 19, sold90d: 52, stockOnHand: 28, gitInTransit: 0, pipelineReserved: 4, failureRatePct: 1.9, unitCostThb: 43000, sellingPriceThb: 76000, leadTimeWeeks: 7 },
    { model: 'FM-480AKE', category: 'Flake Ice Maker', origin: 'Hoshizaki Europe (UK)', sold30d: 9, sold90d: 26, stockOnHand: 3, gitInTransit: 4, pipelineReserved: 4, failureRatePct: 2.6, unitCostThb: 88000, sellingPriceThb: 155000, leadTimeWeeks: 10 }
  ];

  // Utility: Normalize phone numbers (097-230-5941 / +66972305941 / 972305941 -> 0972305941)
  function normalizePhone_(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('66') && digits.length >= 11) digits = '0' + digits.slice(2);
    if (digits.length === 9 && !digits.startsWith('0')) digits = '0' + digits;
    return digits;
  }

  async function sha256Hex_(msg) {
    const str = String(msg || '');
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  async function ensureV1195Vault_() {
    let vault = [];
    try { vault = JSON.parse(localStorage.getItem(STORAGE_KEYS.VAULT) || '[]'); } catch (e) {}
    if (Array.isArray(vault) && vault.length >= DEFAULT_STAFF_ROSTER_V1195.length) return vault;
    const map = {};
    if (Array.isArray(vault)) vault.forEach(u => { map[u.id] = u; });
    const out = [];
    for (const s of DEFAULT_STAFF_ROSTER_V1195) {
      if (map[s.id]) {
        out.push(map[s.id]);
      } else {
        const normPhone = normalizePhone_(s.phone);
        const salt = 'HZK1195-' + s.id;
        const hash = await sha256Hex_(salt + ':' + normPhone);
        out.push(Object.assign({}, s, {
          phone: normPhone,
          salt: salt,
          passwordHash: hash,
          isDefaultPassword: true,
          pdpaAccepted: false,
          vehiclePlate: s.code.startsWith('T0') ? ('Van ' + s.code) : '',
          lineUserId: '',
          active: true
        }));
      }
    }
    localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(out));
    return out;
  }

  function getSession_() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null'); } catch (e) { return null; }
  }

  function getCompanies_() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.BUSINESS_CARDS) || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.BUSINESS_CARDS, JSON.stringify(DEFAULT_COMPANY_360_RECORDS));
    return DEFAULT_COMPANY_360_RECORDS.slice();
  }

  function saveCompanies_(list) {
    localStorage.setItem(STORAGE_KEYS.BUSINESS_CARDS, JSON.stringify(list));
  }

  // State for Sales & Marketing 360° Board
  const state = {
    period: 'daily', // daily | weekly | monthly | yearly
    selectedCompanyId: 'CUST-001',
    compareIds: ['CUST-001', 'CUST-002', 'CUST-003'],
    topN: 5,
    topMetric: 'revenue', // revenue | growth | fleet | upsell
    timelineFilter: 'ALL', // ALL | SALE | REPAIR | PM
    presentationMode: false,
    activeTab: 'DAILY_LIVE' // DAILY_LIVE | COMPANY_360 | COMPARE_TOP | FACTORY_IMPORT
  };

  function formatThb_(num) {
    return Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ฿';
  }

  // Check if URL is an External Portal Deep-Link (Customer / Dealer / Outsource / e-POD / TrackDoc)
  function isExternalPublicPortalUrl_() {
    const p = new URLSearchParams(window.location.search);
    const act = (p.get('action') || '').toLowerCase();
    return ['trackdoc', 'epoddo', 'portal', 'outsourceform', 'dealerclaim', 'specfullscreen'].includes(act) || p.has('os') || p.has('portal');
  }

  // Update Version Badges cleanly to V.1195 across UI
  function syncVersionBadgesToV1195_() {
    document.querySelectorAll('span, div, small, p').forEach(el => {
      if (el.children.length === 0 && el.textContent) {
        if (el.textContent.includes('V.1194') || el.textContent.includes('v1194')) {
          el.textContent = el.textContent.replace(/V\.1194/g, 'V.1195').replace(/v1194/g, 'v1195');
        }
      }
    });
  }

  // Inject Top Floating Bar Button for Sales & Marketing 360° + Mobile Login Badge
  function injectV1195Launchers_() {
    if (document.getElementById('hzkV1195LauncherStrip')) return;
    const strip = document.createElement('div');
    strip.id = 'hzkV1195LauncherStrip';
    strip.className = 'no-print sticky top-0 z-[85] bg-gradient-to-r from-[#002B49] via-[#004473] to-[#00A3E0] text-white px-3 py-1.5 shadow-md flex flex-wrap items-center justify-between gap-2 text-xs';
    strip.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="bg-white text-[#002B49] font-extrabold px-2 py-0.5 rounded text-[11px] tracking-wide">HOSHIZAKI ${V1195_VERSION}</span>
        <span id="v1195ActiveUserBanner" class="text-[11px] text-sky-100 font-semibold hidden sm:inline">พร้อมใช้งานทุกแผนก (8 Departments • Mobile RBAC)</span>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <button type="button" onclick="openSalesMarketing360Board('DAILY_LIVE')" class="bg-white text-[#002B49] hover:bg-sky-50 font-extrabold px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1 text-[11px]">
          <span>📊 Sales &amp; MKT 360° Board</span>
        </button>
        <button type="button" onclick="openSalesMarketing360Board('FACTORY_IMPORT')" class="bg-sky-950/70 hover:bg-sky-900 text-sky-100 border border-sky-300/40 font-bold px-2.5 py-1 rounded-lg text-[11px]">
          <span>🚢 Factory Import &amp; PSI</span>
        </button>
        <button type="button" id="v1195MobileLoginBtn" onclick="openV1195MobileLoginModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-2.5 py-1 rounded-lg shadow-xs text-[11px]">
          <span>🔐 เข้าสู่ระบบ / สลับ User</span>
        </button>
      </div>
    `;
    document.body.insertBefore(strip, document.body.firstChild);
    updateV1195SessionBanner_();
  }

  function updateV1195SessionBanner_() {
    const sess = getSession_();
    const banner = document.getElementById('v1195ActiveUserBanner');
    const btn = document.getElementById('v1195MobileLoginBtn');
    if (!sess) {
      if (banner) banner.textContent = 'กรุณาเข้าสู่ระบบด้วยรหัสพนักงาน/อีเมล + เบอร์มือถือเริ่มต้น';
      if (btn) btn.innerHTML = '<span>🔐 เข้าสู่ระบบมือถือ (Login)</span>';
      return;
    }
    if (banner) {
      banner.innerHTML = `👤 <b>${sess.name}</b> · <span class="bg-white/20 px-1.5 py-0.5 rounded">${sess.department}</span> (${sess.rbacRole})`;
    }
    if (btn) {
      btn.innerHTML = `<span>👤 ${sess.nickname || sess.code} · สลับ User</span>`;
    }
    // Check Birthday / Anniversary Recognition Card
    renderEmployeeRecognitionToast_(sess);
  }

  function renderEmployeeRecognitionToast_(sess) {
    const today = new Date();
    const mmdd = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    if (sess.birthday === mmdd && !sessionStorage.getItem('hzk_bday_shown_' + sess.id)) {
      sessionStorage.setItem('hzk_bday_shown_' + sess.id, '1');
      if (typeof showToast === 'function') {
        showToast(`🎂 สุขสันต์วันเกิดคุณ ${sess.name}! Happy Birthday & お誕生日おめでとうございます จากครอบครัว Hoshizaki Thailand`);
      }
    }
  }

  // ==========================================================================
  // 1. MOBILE LOGIN + FIRST-TIME ONBOARDING + FORCED PASSWORD CHANGE
  // ==========================================================================
  window.openV1195MobileLoginModal = async function () {
    const vault = await ensureV1195Vault_();
    const sess = getSession_();
    let modal = document.getElementById('hzkV1195MobileLoginModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkV1195MobileLoginModal';
      modal.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[120] flex items-center justify-center p-3';
      document.body.appendChild(modal);
    }

    const knownIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.KNOWN_USERS) || '[]');
    const knownUsers = knownIds.map(id => vault.find(u => u.id === id)).filter(Boolean);

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-[#00A3E0] text-xs">
        <div class="bg-gradient-to-r from-[#002B49] to-[#00A3E0] text-white px-4 py-3 flex items-center justify-between">
          <div>
            <div class="font-extrabold text-sm">🔐 HOSHIZAKI Mobile Staff Portal (${V1195_VERSION})</div>
            <div class="text-[11px] text-sky-100">เปิดใช้งานครบทั้ง 8 แผนก • รหัสผ่านเริ่มต้นคือเบอร์มือถือของพนักงาน</div>
          </div>
          ${sess ? `<button type="button" onclick="document.getElementById('hzkV1195MobileLoginModal').classList.add('hidden')" class="bg-white/20 hover:bg-white/30 text-white w-7 h-7 rounded-lg font-bold">&times;</button>` : ''}
        </div>

        <div class="p-4 space-y-3 max-h-[85dvh] overflow-y-auto">
          ${sess ? `
            <div class="p-2.5 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between">
              <div>
                <div class="font-extrabold text-[#002B49]">กำลังใช้งาน: ${sess.name}</div>
                <div class="text-[11px] text-slate-600">${sess.department} · ${sess.position}</div>
              </div>
              <button type="button" onclick="logoutV1195MobileSession()" class="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px]">ออกจากระบบ</button>
            </div>
          ` : ''}

          ${knownUsers.length > 0 ? `
            <div class="space-y-1">
              <div class="font-bold text-[#002B49] text-[11px]">📱 สลับผู้ใช้งานด่วนบนเครื่องนี้ (Shared Device):</div>
              <div class="flex flex-wrap gap-1.5">
                ${knownUsers.map(u => `
                  <button type="button" onclick="prefillV1195LoginUser('${u.id}')" class="px-2.5 py-1 rounded-full bg-sky-100 hover:bg-sky-200 text-[#002B49] font-bold text-[11px]">
                    ${u.nickname || u.code} (${u.department.replace(' Unit', '')})
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="space-y-2">
            <label class="font-bold text-slate-700 block">1. เลือกแผนกและรายชื่อพนักงาน (หรือพิมพ์รหัสพนักงาน / อีเมล):</label>
            <select id="v1195LoginUserSelect" onchange="onSelectV1195LoginUser(this.value)" class="w-full border-2 border-sky-200 rounded-xl px-3 py-2 font-bold text-[#002B49] bg-white">
              <option value="">-- เลือกชื่อพนักงาน (ทั้ง 8 แผนก • 22 บัญชี) --</option>
              ${vault.map(u => `<option value="${u.id}">[${u.department}] ${u.name} (${u.code})</option>`).join('')}
            </select>
          </div>

          <div class="space-y-1">
            <label class="font-bold text-slate-700 block">2. รหัสผ่าน (เข้าครั้งแรกใช้เบอร์มือถือ เช่น 0972305941):</label>
            <input type="password" id="v1195LoginPasswordInput" onkeydown="if(event.key==='Enter'){submitV1195MobileLogin();}" placeholder="กรอกเบอร์มือถือเริ่มต้น หรือรหัสผ่านที่ตั้งใหม่..." class="w-full border-2 border-[#002B49] rounded-xl px-3 py-2 text-sm font-bold">
          </div>

          <div id="v1195LoginErrBox" class="hidden p-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-bold"></div>

          <button type="button" onclick="submitV1195MobileLogin()" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#002B49] to-[#00A3E0] text-white font-extrabold text-sm shadow">
            เข้าสู่ระบบและเปิดหน้างานของฉัน
          </button>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
  };

  window.prefillV1195LoginUser = function (staffId) {
    const sel = document.getElementById('v1195LoginUserSelect');
    if (sel) sel.value = staffId;
    document.getElementById('v1195LoginPasswordInput')?.focus();
  };

  window.onSelectV1195LoginUser = function (staffId) {
    if (staffId) document.getElementById('v1195LoginPasswordInput')?.focus();
  };

  window.submitV1195MobileLogin = async function () {
    const staffId = document.getElementById('v1195LoginUserSelect')?.value || '';
    const rawPass = (document.getElementById('v1195LoginPasswordInput')?.value || '').trim();
    const errBox = document.getElementById('v1195LoginErrBox');
    if (!staffId || !rawPass) {
      if (errBox) { errBox.textContent = '⚠️ กรุณาเลือกชื่อพนักงานและกรอกรหัสผ่านครับ'; errBox.classList.remove('hidden'); }
      return;
    }

    const vault = await ensureV1195Vault_();
    const user = vault.find(u => u.id === staffId);
    if (!user) return;

    // Normalize input if user typed phone number with dashes or +66
    const normalizedInput = /^\+?[\d\s-]+$/.test(rawPass) ? normalizePhone_(rawPass) : rawPass;
    const candidateHash = await sha256Hex_(user.salt + ':' + normalizedInput);

    if (candidateHash !== user.passwordHash) {
      logSecurityAuditToCloud_('LOGIN_FAILED', user, 'Invalid password attempt');
      if (errBox) { errBox.textContent = '❌ รหัสผ่านไม่ถูกต้อง (หากเข้าครั้งแรกให้ใช้เบอร์โทรศัพท์มือถือของท่าน)'; errBox.classList.remove('hidden'); }
      return;
    }

    // Record Known User on Shared Mobile Device
    const known = JSON.parse(localStorage.getItem(STORAGE_KEYS.KNOWN_USERS) || '[]').filter(x => x !== user.id);
    known.unshift(user.id);
    localStorage.setItem(STORAGE_KEYS.KNOWN_USERS, JSON.stringify(known.slice(0, 12)));

    // If first-time login (isDefaultPassword === true), force profile completion & new password setup
    if (user.isDefaultPassword) {
      openFirstTimeOnboardingPopup_(user);
      return;
    }

    finalizeV1195LoginSession_(user);
  };

  function openFirstTimeOnboardingPopup_(user) {
    const modal = document.getElementById('hzkV1195MobileLoginModal');
    if (!modal) return;
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-emerald-500 text-xs">
        <div class="bg-gradient-to-r from-[#002B49] to-emerald-700 text-white px-4 py-3">
          <div class="font-extrabold text-sm">🛡️ ยืนยันตัวตนครั้งแรก &amp; ตั้งรหัสผ่านส่วนตัวใหม่</div>
          <div class="text-[11px] text-emerald-100">กรุณาอัปเดตข้อมูลส่วนตัวลงฐานข้อมูลกลางและตั้งรหัสผ่านใหม่เพื่อความปลอดภัย</div>
        </div>
        <div class="p-4 space-y-2.5 max-h-[85dvh] overflow-y-auto">
          <div class="p-2 rounded-lg bg-sky-50 border border-sky-200 font-bold text-[#002B49]">
            พนักงาน: ${user.name} (${user.department} · ${user.position})
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="font-bold text-slate-700 block mb-0.5">ชื่อเล่น (Nickname):</label>
              <input id="obNickname" value="${user.nickname || ''}" class="w-full border rounded-lg px-2.5 py-1.5 font-bold">
            </div>
            <div>
              <label class="font-bold text-slate-700 block mb-0.5">เบอร์มือถือติดต่อจริง:</label>
              <input id="obPhone" value="${user.phone || ''}" class="w-full border rounded-lg px-2.5 py-1.5 font-bold">
            </div>
            <div>
              <label class="font-bold text-slate-700 block mb-0.5">อีเมลบริษัท (@hoshizaki.co.th):</label>
              <input id="obEmail" value="${user.email || ''}" class="w-full border rounded-lg px-2.5 py-1.5">
            </div>
            <div>
              <label class="font-bold text-slate-700 block mb-0.5">รหัสรถบริการ / ทะเบียนรถ (ถ้ามี):</label>
              <input id="obVehicle" value="${user.vehiclePlate || ''}" placeholder="เช่น Van T01 หรือ 1กข-1234" class="w-full border rounded-lg px-2.5 py-1.5">
            </div>
            <div class="sm:col-span-2">
              <label class="font-bold text-slate-700 block mb-0.5">LINE ID (สำหรับรับแจ้งเตือนงานและสรุปยอดรายวัน):</label>
              <input id="obLineId" value="${user.lineUserId || ''}" placeholder="ระบุ LINE ID ของท่าน..." class="w-full border rounded-lg px-2.5 py-1.5">
            </div>
          </div>

          <div class="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
            <div class="font-extrabold text-amber-950">🔑 ตั้งรหัสผ่านส่วนตัวใหม่ (บังคับเปลี่ยนจากเบอร์มือถือเริ่มต้น):</div>
            <input type="password" id="obNewPass1" placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร หรือ PIN 6 หลัก)" class="w-full border border-amber-400 rounded-lg px-2.5 py-1.5 bg-white font-bold">
            <input type="password" id="obNewPass2" placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง" class="w-full border border-amber-400 rounded-lg px-2.5 py-1.5 bg-white font-bold">
          </div>

          <label class="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
            <input type="checkbox" id="obPdpaCheck" class="mt-0.5 w-4 h-4 accent-[#002B49]">
            <span>ข้าพเจ้ายินยอมให้บริษัท โฮชิซากิ (ประเทศไทย) จำกัด จัดเก็บข้อมูลส่วนบุคคลและประวัติการเข้าใช้งานระบบ (Audit Trail) ตามนโยบาย PDPA ขององค์กร</span>
          </label>

          <div id="obErrBox" class="hidden p-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-bold"></div>

          <button type="button" onclick="completeFirstTimeOnboardingSubmit('${user.id}')" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow">
            ✅ บันทึกข้อมูลส่วนตัว &amp; เข้าสู่พื้นที่ทำงานของฉัน
          </button>
        </div>
      </div>
    `;
  }

  window.completeFirstTimeOnboardingSubmit = async function (staffId) {
    const p1 = (document.getElementById('obNewPass1')?.value || '').trim();
    const p2 = (document.getElementById('obNewPass2')?.value || '').trim();
    const pdpa = document.getElementById('obPdpaCheck')?.checked;
    const errBox = document.getElementById('obErrBox');

    if (p1.length < 6) {
      if (errBox) { errBox.textContent = '⚠️ กรุณาตั้งรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษรครับ'; errBox.classList.remove('hidden'); }
      return;
    }
    if (p1 !== p2) {
      if (errBox) { errBox.textContent = '⚠️ รหัสผ่านใหม่ทั้ง 2 ช่องไม่ตรงกันครับ'; errBox.classList.remove('hidden'); }
      return;
    }
    if (!pdpa) {
      if (errBox) { errBox.textContent = '⚠️ กรุณาติ๊กยอมรับเงื่อนไข PDPA ก่อนดำเนินการต่อครับ'; errBox.classList.remove('hidden'); }
      return;
    }

    const vault = await ensureV1195Vault_();
    const user = vault.find(u => u.id === staffId);
    if (!user) return;

    user.nickname = (document.getElementById('obNickname')?.value || user.nickname).trim();
    user.phone = normalizePhone_(document.getElementById('obPhone')?.value || user.phone);
    user.email = (document.getElementById('obEmail')?.value || user.email).trim();
    user.vehiclePlate = (document.getElementById('obVehicle')?.value || '').trim();
    user.lineUserId = (document.getElementById('obLineId')?.value || '').trim();
    user.passwordHash = await sha256Hex_(user.salt + ':' + p1);
    user.isDefaultPassword = false;
    user.pdpaAccepted = true;
    user.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(vault));
    syncOnboardingProfileToCloud_(user);
    finalizeV1195LoginSession_(user);
  };

  function finalizeV1195LoginSession_(user) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({
      id: user.id,
      code: user.code,
      name: user.name,
      nickname: user.nickname,
      department: user.department,
      position: user.position,
      rbacRole: user.rbacRole,
      birthday: user.birthday,
      loginAt: new Date().toISOString()
    }));
    logSecurityAuditToCloud_('LOGIN_SUCCESS', user, 'Authenticated via Mobile Staff Portal');
    document.getElementById('hzkV1195MobileLoginModal')?.classList.add('hidden');
    updateV1195SessionBanner_();
    applyDepartmentWorkspaceRouting_(user);
    if (typeof showToast === 'function') {
      showToast(`✅ ยินดีต้อนรับ ${user.name} (${user.department})`);
    }
  }

  window.logoutV1195MobileSession = function () {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    updateV1195SessionBanner_();
    openV1195MobileLoginModal();
  };

  function applyDepartmentWorkspaceRouting_(user) {
    const role = user.rbacRole;
    if (role === 'SALES_UNIT' || role === 'MARKETING_UNIT' || role === 'JAPANESE_CORP') {
      openSalesMarketing360Board('DAILY_LIVE');
    } else if (role === 'EXECUTIVE' || role === 'SUPER_ADMIN') {
      // Keep main cockpit accessible with quick access to Sales/MKT 360 & Service
      if (typeof window.applyRbacRoleViewFiltering === 'function') window.applyRbacRoleViewFiltering();
    } else {
      if (typeof window.applyRbacRoleViewFiltering === 'function') window.applyRbacRoleViewFiltering();
    }
  }

  function logSecurityAuditToCloud_(eventType, user, detail) {
    const gasUrl = localStorage.getItem('hoshizaki_gas_webapp_url') || '';
    if (!gasUrl) return;
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        actionType: 'LOG_STAFF_ACCESS_AUDIT',
        eventType: eventType,
        staffId: user.id,
        staffName: user.name,
        department: user.department,
        rbacRole: user.rbacRole,
        deviceInfo: navigator.userAgent.slice(0, 120),
        detail: detail
      })
    }).catch(() => {});
  }

  function syncOnboardingProfileToCloud_(user) {
    const gasUrl = localStorage.getItem('hoshizaki_gas_webapp_url') || '';
    if (!gasUrl) return;
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        actionType: 'UPDATE_STAFF_ONBOARDING_PROFILE',
        staffId: user.id,
        name: user.name,
        nickname: user.nickname,
        department: user.department,
        phone: user.phone,
        email: user.email,
        vehiclePlate: user.vehiclePlate,
        lineUserId: user.lineUserId,
        passwordHash: user.passwordHash,
        pdpaAccepted: user.pdpaAccepted
      })
    }).catch(() => {});
  }

  // ==========================================================================
  // 2. SALES, MARKETING & EXECUTIVE 360° BOARD (BLUE-WHITE CORPORATE THEME)
  // ==========================================================================
  window.openSalesMarketing360Board = function (initialTab) {
    if (initialTab) state.activeTab = initialTab;
    let modal = document.getElementById('hzkSalesMarketing360Modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hzkSalesMarketing360Modal';
      modal.className = 'fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-[110] flex items-center justify-center p-1 sm:p-3';
      document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    renderSalesMarketing360Board_();
  };

  window.setV1195BoardTab = function (tab) {
    state.activeTab = tab;
    renderSalesMarketing360Board_();
  };

  window.setV1195Period = function (p) {
    state.period = p;
    renderSalesMarketing360Board_();
  };

  window.selectV1195Company = function (companyId) {
    state.selectedCompanyId = companyId;
    state.activeTab = 'COMPANY_360';
    renderSalesMarketing360Board_();
  };

  window.toggleV1195CompareCompany = function (companyId) {
    if (state.compareIds.includes(companyId)) {
      if (state.compareIds.length > 2) {
        state.compareIds = state.compareIds.filter(id => id !== companyId);
      }
    } else {
      if (state.compareIds.length >= 5) state.compareIds.shift();
      state.compareIds.push(companyId);
    }
    renderSalesMarketing360Board_();
  };

  window.setV1195TopN = function (n) {
    state.topN = Number(n) || 5;
    renderSalesMarketing360Board_();
  };

  window.setV1195TopMetric = function (m) {
    state.topMetric = m;
    renderSalesMarketing360Board_();
  };

  window.setV1195TimelineFilter = function (t) {
    state.timelineFilter = t;
    renderSalesMarketing360Board_();
  };

  window.toggleV1195PresentationMode = function () {
    state.presentationMode = !state.presentationMode;
    renderSalesMarketing360Board_();
  };

  window.shareV1195PresentationRoomLink = function () {
    const baseUrl = window.location.origin + window.location.pathname;
    const roomUrl = `${baseUrl}?presentRoom=HZK-EXEC-360&company=${encodeURIComponent(state.selectedCompanyId)}&period=${state.period}`;
    if (navigator.clipboard) navigator.clipboard.writeText(roomUrl).catch(() => {});
    const zoomLink = document.getElementById('v1195MeetingUrlInput')?.value || '';
    const msg = `📊 ห้องประชุมร่วม HOSHIZAKI Sales & Marketing 360° Live Board\n🔗 ลิงก์ดูข้อมูลร่วมกันผ่านเว็บ: ${roomUrl}${zoomLink ? '\n🎥 ลิงก์ Zoom / Teams: ' + zoomLink : ''}`;
    alert('คัดลอกลิงก์ห้องประชุมร่วมเรียบร้อยแล้ว (พร้อมแชร์ใน Zoom / Teams / LINE):\n\n' + msg);
  };

  window.shareCompanyGoogleMapLine = function (companyId) {
    const c = getCompanies_().find(x => x.companyId === companyId);
    if (!c) return;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
    const text = `📍 โลเคชั่นลูกค้า HOSHIZAKI\n🏢 ${c.companyName}\n👤 ติดต่อ: ${c.contactName} (${c.phone})\n🗺️ นำทาง Google Maps: ${mapUrl}`;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    if (typeof showToast === 'function') showToast('คัดลอกพิกัดและลิงก์ Google Maps พร้อมแชร์เข้า LINE แล้ว');
  };

  window.openBusinessCardScannerModal = function (companyId) {
    const c = getCompanies_().find(x => x.companyId === companyId) || getCompanies_()[0];
    const overlay = document.createElement('div');
    overlay.id = 'v1195BizCardScanOverlay';
    overlay.className = 'fixed inset-0 bg-black/75 z-[130] flex items-center justify-center p-3';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-[#00A3E0] text-xs">
        <div class="bg-[#002B49] text-white px-4 py-3 flex items-center justify-between">
          <div class="font-extrabold">📷 ถ่ายรูป / สแกนนามบัตรเข้าฐานข้อมูลอัตโนมัติ</div>
          <button type="button" onclick="document.getElementById('v1195BizCardScanOverlay').remove()" class="bg-rose-600 text-white w-7 h-7 rounded-lg font-bold">&times;</button>
        </div>
        <div class="p-4 space-y-2.5">
          <div class="p-3 rounded-xl bg-sky-50 border-2 border-dashed border-[#00A3E0] text-center space-y-2">
            <div class="text-slate-700 font-bold">ถ่ายภาพนามบัตรลูกค้าหรือเลือกไฟล์ภาพ (ระบบ AI OCR จะดึงข้อมูลเข้าฐานข้อมูลให้ทันที)</div>
            <input type="file" accept="image/*" capture="environment" onchange="handleBusinessCardPhotoInput(this, '${c.companyId}')" class="block w-full text-xs text-slate-600">
          </div>
          <div id="bizCardPreviewBox" class="hidden rounded-xl overflow-hidden border border-sky-200 max-h-40 flex items-center justify-center bg-slate-100"></div>
          <div class="grid grid-cols-1 gap-2">
            <input id="bcCompany" value="${c.companyName}" placeholder="ชื่อบริษัท *" class="border rounded-lg px-2.5 py-1.5 font-bold">
            <div class="grid grid-cols-2 gap-2">
              <input id="bcContact" value="${c.contactName}" placeholder="ชื่อผู้ติดต่อ *" class="border rounded-lg px-2.5 py-1.5 font-bold">
              <input id="bcTitle" value="${c.contactTitle}" placeholder="ตำแหน่ง" class="border rounded-lg px-2.5 py-1.5">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="bcPhone" value="${c.phone}" placeholder="เบอร์โทรศัพท์" class="border rounded-lg px-2.5 py-1.5">
              <input id="bcEmail" value="${c.email}" placeholder="อีเมล" class="border rounded-lg px-2.5 py-1.5">
            </div>
            <input id="bcAddress" value="${c.address}" placeholder="ที่อยู่บริษัท" class="border rounded-lg px-2.5 py-1.5">
          </div>
          <button type="button" onclick="saveScannedBusinessCardRecord('${c.companyId}')" class="w-full py-2 rounded-xl bg-[#002B49] hover:bg-[#00A3E0] text-white font-extrabold">
            💾 บันทึกนามบัตรและอัปเดตฐานข้อมูลบริษัท
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  };

  window.handleBusinessCardPhotoInput = function (input, companyId) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      window._tempBizCardDataUrl = ev.target.result;
      const box = document.getElementById('bizCardPreviewBox');
      if (box) {
        box.innerHTML = `<img src="${ev.target.result}" alt="Business Card" class="max-h-40 object-contain">`;
        box.classList.remove('hidden');
      }
      if (typeof showToast === 'function') showToast('📸 โหลดภาพนามบัตรเรียบร้อย ตรวจสอบความถูกต้องแล้วกดบันทึก');
    };
    reader.readAsDataURL(file);
  };

  window.saveScannedBusinessCardRecord = function (companyId) {
    const list = getCompanies_();
    const target = list.find(x => x.companyId === companyId);
    if (target) {
      target.companyName = (document.getElementById('bcCompany')?.value || target.companyName).trim();
      target.contactName = (document.getElementById('bcContact')?.value || target.contactName).trim();
      target.contactTitle = (document.getElementById('bcTitle')?.value || target.contactTitle).trim();
      target.phone = (document.getElementById('bcPhone')?.value || target.phone).trim();
      target.email = (document.getElementById('bcEmail')?.value || target.email).trim();
      target.address = (document.getElementById('bcAddress')?.value || target.address).trim();
      if (window._tempBizCardDataUrl) {
        target.businessCardImg = window._tempBizCardDataUrl;
        window._tempBizCardDataUrl = '';
      }
      saveCompanies_(list);
    }
    document.getElementById('v1195BizCardScanOverlay')?.remove();
    renderSalesMarketing360Board_();
    if (typeof showToast === 'function') showToast('✅ บันทึกข้อมูลนามบัตรลงฐานข้อมูลบริษัทเรียบร้อยแล้ว');
  };

  window.recalcImportProposalRow = function (idx, qty) {
    const el = document.getElementById('impSimResult_' + idx);
    const item = DEFAULT_FACTORY_IMPORT_ADVISOR[idx];
    if (!el || !item) return;
    const addQty = Math.max(0, parseInt(qty || '0', 10) || 0);
    const totalAvail = item.stockOnHand + item.gitInTransit + addQty;
    const monthsCover = ((totalAvail / Math.max(1, item.sold30d))).toFixed(1);
    const estImportCost = addQty * item.unitCostThb;
    const estProjRev = addQty * item.sellingPriceThb;
    el.innerHTML = `รองรับการขาย <b>${monthsCover} เดือน</b> · งบนำเข้า: <b>${formatThb_(estImportCost)}</b> · ประมาณการยอดขาย: <b class="text-emerald-700">${formatThb_(estProjRev)}</b>`;
  };

  function renderSalesMarketing360Board_() {
    const modal = document.getElementById('hzkSalesMarketing360Modal');
    if (!modal) return;
    const companies = getCompanies_();
    const selected = companies.find(c => c.companyId === state.selectedCompanyId) || companies[0];
    const pKey = state.period;
    const pLabels = { daily: 'รายวัน (Today)', weekly: 'รายสัปดาห์ (This Week)', monthly: 'รายเดือน (This Month)', yearly: 'รายปี (YTD 2026)' };

    // Aggregate KPI across all companies for selected period
    const totalPeriodSales = companies.reduce((sum, c) => sum + (c.metrics[pKey] || 0), 0);
    const totalActiveMachines = companies.reduce((sum, c) => sum + (c.machines ? c.machines.length : 0), 0);
    const activeCompaniesCount = companies.filter(c => (c.metrics[pKey] || 0) > 0).length;

    // Top N Ranking List
    const sortedTop = companies.slice().sort((a, b) => {
      if (state.topMetric === 'fleet') return (b.machines?.length || 0) - (a.machines?.length || 0);
      if (state.topMetric === 'upsell') {
        const bScore = b.machines.some(m => m.status.includes('Trade-In') || m.status.includes('PM')) ? 2 : 1;
        const aScore = a.machines.some(m => m.status.includes('Trade-In') || m.status.includes('PM')) ? 2 : 1;
        return bScore - aScore || (b.metrics[pKey] - a.metrics[pKey]);
      }
      return (b.metrics[pKey] || 0) - (a.metrics[pKey] || 0);
    }).slice(0, state.topN);
    const maxTopVal = Math.max(1, ...sortedTop.map(c => state.topMetric === 'fleet' ? (c.machines?.length || 1) : (c.metrics[pKey] || 1)));

    // Filtered Timeline for Selected Company
    const filteredTimeline = (selected.timeline || []).filter(item => {
      if (state.timelineFilter === 'ALL') return true;
      if (state.timelineFilter === 'SALE') return item.type === 'SALE' || item.type === 'PARTS';
      return item.type === state.timelineFilter;
    });

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl ${state.presentationMode ? 'w-full h-full max-w-none rounded-none' : 'max-w-6xl w-full max-h-[94dvh]'} flex flex-col border-2 border-[#00A3E0] overflow-hidden text-xs">
        <!-- Hoshizaki Blue-White Corporate Header -->
        <div class="bg-gradient-to-r from-[#002B49] via-[#004A80] to-[#00A3E0] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="bg-white text-[#002B49] font-black px-2.5 py-1 rounded-lg text-xs tracking-wider shadow-xs">HOSHIZAKI</div>
            <div>
              <h2 class="font-extrabold text-sm sm:text-base leading-tight">Sales, Marketing &amp; Executive 360° Live Board (${V1195_VERSION})</h2>
              <p class="text-[11px] text-sky-100">ฐานข้อมูลกลางเชื่อมต่อทุกแผนก (Company • Model/Sub-Model • Serial Number • Live Stock &amp; GIT)</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <!-- Period Switcher -->
            <div class="bg-white/15 p-0.5 rounded-xl flex items-center">
              ${['daily', 'weekly', 'monthly', 'yearly'].map(pk => `
                <button type="button" onclick="setV1195Period('${pk}')" class="px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${state.period === pk ? 'bg-white text-[#002B49] shadow-xs' : 'text-white hover:bg-white/10'}">
                  ${pk === 'daily' ? 'รายวัน' : pk === 'weekly' ? 'รายสัปดาห์' : pk === 'monthly' ? 'รายเดือน' : 'รายปี'}
                </button>
              `).join('')}
            </div>

            <!-- Standalone / Zoom / Teams Presentation Toggle -->
            <button type="button" onclick="toggleV1195PresentationMode()" class="px-3 py-1.5 rounded-xl font-extrabold text-[11px] ${state.presentationMode ? 'bg-amber-400 text-slate-950' : 'bg-sky-950/70 text-white border border-sky-200/40'}">
              ${state.presentationMode ? '🗗 ออกจากโหมดนำเสนอ' : '🖥️ โหมดนำเสนอ (Zoom / Teams)'}
            </button>
            <button type="button" onclick="shareV1195PresentationRoomLink()" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[11px]">
              🔗 แชร์ลิงก์ประชุมร่วม
            </button>
            <button type="button" onclick="document.getElementById('hzkSalesMarketing360Modal').classList.add('hidden')" class="bg-rose-600 hover:bg-rose-700 text-white w-8 h-8 rounded-xl font-extrabold text-base">&times;</button>
          </div>
        </div>

        <!-- Presentation Collaborative Bar (Visible in Presentation Mode) -->
        ${state.presentationMode ? `
          <div class="bg-sky-50 border-b border-sky-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-[#002B49]">🎥 ห้องประชุมร่วม (Standalone Web / Zoom / MS Teams):</span>
              <input id="v1195MeetingUrlInput" placeholder="วางลิงก์ Zoom / Microsoft Teams / Google Meet ที่นี่..." class="border border-sky-300 rounded-lg px-2.5 py-1 text-xs w-64 bg-white">
            </div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-700">เลือกบริษัทนำเสนอ:</span>
              <select onchange="selectV1195Company(this.value)" class="border border-sky-400 rounded-lg px-2.5 py-1 font-extrabold text-[#002B49] bg-white">
                ${companies.map(c => `<option value="${c.companyId}" ${c.companyId === selected.companyId ? 'selected' : ''}>${c.companyName}</option>`).join('')}
              </select>
            </div>
          </div>
        ` : ''}

        <!-- Top Real-Time KPI Summary Cards -->
        <div class="bg-[#F0F9FF] border-b border-sky-200 px-4 py-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div class="bg-white rounded-xl p-2.5 border border-sky-200 shadow-2xs">
            <div class="text-[11px] font-bold text-sky-700">ยอดขายและบริการรวม (${pLabels[pKey]})</div>
            <div class="text-lg sm:text-xl font-black text-[#002B49] mt-0.5">${formatThb_(totalPeriodSales)}</div>
            <div class="text-[10px] text-emerald-600 font-bold">▲ +14.8% เทียบช่วงก่อนหน้า (Real-Time)</div>
          </div>
          <div class="bg-white rounded-xl p-2.5 border border-sky-200 shadow-2xs">
            <div class="text-[11px] font-bold text-sky-700">บริษัทที่มีรายการเคลื่อนไหว</div>
            <div class="text-lg sm:text-xl font-black text-[#00A3E0] mt-0.5">${activeCompaniesCount} บริษัท</div>
            <div class="text-[10px] text-slate-500 font-semibold">คลิกที่ชื่อบริษัทเพื่อดูการ์ดซ้าย–ขวา</div>
          </div>
          <div class="bg-white rounded-xl p-2.5 border border-sky-200 shadow-2xs">
            <div class="text-[11px] font-bold text-sky-700">ออเดอร์ล่าสุดเข้าสู่ระบบ</div>
            <div class="text-sm font-black text-[#002B49] mt-0.5 truncate">${companies[0].companyName}</div>
            <div class="text-[10px] text-emerald-700 font-bold">${formatThb_(companies[0].metrics.lastOrderAmount)} · ${companies[0].metrics.lastOrderDate}</div>
          </div>
          <div class="bg-white rounded-xl p-2.5 border border-sky-200 shadow-2xs">
            <div class="text-[11px] font-bold text-sky-700">ฐานเครื่อง S/N ที่ดูแลร่วมกัน</div>
            <div class="text-lg sm:text-xl font-black text-[#002B49] mt-0.5">33,634 S/N</div>
            <div class="text-[10px] text-sky-700 font-bold">เชื่อมโยงประวัติซ่อม + ดีลเลอร์ผู้ดูแล</div>
          </div>
        </div>

        <!-- Module Navigation Sub-Tabs -->
        <div class="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-1.5">
          <button type="button" onclick="setV1195BoardTab('DAILY_LIVE')" class="px-3 py-1.5 rounded-xl font-extrabold ${state.activeTab === 'DAILY_LIVE' ? 'bg-[#002B49] text-white' : 'bg-sky-50 text-[#002B49] hover:bg-sky-100'}">
            ⚡ 1. ยอดสั่งซื้อรายวัน &amp; รายแผนก (Live Ticker)
          </button>
          <button type="button" onclick="setV1195BoardTab('COMPANY_360')" class="px-3 py-1.5 rounded-xl font-extrabold ${state.activeTab === 'COMPANY_360' ? 'bg-[#002B49] text-white' : 'bg-sky-50 text-[#002B49] hover:bg-sky-100'}">
            🪪 2. การ์ดข้อมูลบริษัท 360° (นามบัตร • แผนที่ • S/N • ไทม์ไลน์)
          </button>
          <button type="button" onclick="setV1195BoardTab('COMPARE_TOP')" class="px-3 py-1.5 rounded-xl font-extrabold ${state.activeTab === 'COMPARE_TOP' ? 'bg-[#002B49] text-white' : 'bg-sky-50 text-[#002B49] hover:bg-sky-100'}">
            🏆 3. กราฟเปรียบเทียบบริษัท &amp; จัดอันดับ Top 3/5/10/20
          </button>
          <button type="button" onclick="setV1195BoardTab('FACTORY_IMPORT')" class="px-3 py-1.5 rounded-xl font-extrabold ${state.activeTab === 'FACTORY_IMPORT' ? 'bg-[#002B49] text-white' : 'bg-sky-50 text-[#002B49] hover:bg-sky-100'}">
            🚢 4. วิเคราะห์โมเดลขายดี &amp; เสนอสั่งนำเข้าโรงงาน (Boardroom)
          </button>
        </div>

        <!-- Main Scrollable Content Area -->
        <div class="p-4 overflow-y-auto flex-1 space-y-4 bg-white">
          ${state.activeTab === 'DAILY_LIVE' ? `
            <!-- TAB 1: DAILY DEPARTMENT LIVE ORDER & REVENUE FEED -->
            <div class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2 bg-sky-50 border border-sky-200 rounded-xl p-3">
                <div>
                  <div class="font-extrabold text-sm text-[#002B49]">📡 กระดานติดตามยอดสั่งซื้อและรายได้รายวันแบบ Real-Time แยกตามบริษัท</div>
                  <div class="text-[11px] text-slate-600">คลิกที่ชื่อบริษัทใดก็ได้เพื่อเปิดการ์ดข้อมูลซ้าย–ขวา นามบัตร โลเคชั่น Google Maps และประวัติซื้อ-ซ่อมทั้งหมด</div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button type="button" onclick="setV1195BoardTab('COMPANY_360')" class="px-3 py-1.5 rounded-lg bg-[#00A3E0] text-white font-bold">เปิดการ์ดบริษัท 360° →</button>
                </div>
              </div>

              <div class="overflow-x-auto border border-sky-200 rounded-2xl">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="bg-[#002B49] text-white">
                      <th class="p-2.5">บริษัท / ลูกค้า (คลิกดูการ์ด 360°)</th>
                      <th class="p-2.5">ช่องทาง / ผู้รับผิดชอบ</th>
                      <th class="p-2.5">รายการเคลื่อนไหวล่าสุด</th>
                      <th class="p-2.5 text-right">ยอดวันนี้ (Daily)</th>
                      <th class="p-2.5 text-right">ยอดเดือนนี้ (Monthly)</th>
                      <th class="p-2.5 text-right">ยอดสะสมปีนี้ (Yearly)</th>
                      <th class="p-2.5 text-center">เทียบกราฟ</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-sky-100">
                    ${companies.map(c => {
                      const latest = (c.timeline && c.timeline[0]) || {};
                      const isCmp = state.compareIds.includes(c.companyId);
                      return `
                        <tr class="hover:bg-sky-50/80 transition">
                          <td class="p-2.5">
                            <button type="button" onclick="selectV1195Company('${c.companyId}')" class="text-left font-extrabold text-[#002B49] hover:text-[#00A3E0] underline decoration-sky-300">
                              ${c.companyName}
                            </button>
                            <div class="text-[10.5px] text-slate-500">ผู้ติดต่อ: ${c.contactName} (${c.phone}) · เครื่องในระบบ ${c.machines.length} S/N</div>
                          </td>
                          <td class="p-2.5">
                            <span class="px-2 py-0.5 rounded-full bg-sky-100 text-[#002B49] font-bold text-[10px]">${c.channelGrade}</span>
                            <div class="text-[10.5px] text-slate-600 mt-0.5">${c.assignedOwner}</div>
                          </td>
                          <td class="p-2.5">
                            <div class="font-bold text-slate-800">${latest.model || '-'}</div>
                            <div class="text-[10.5px] text-slate-500">${latest.docNo || ''} · <span class="text-emerald-700 font-bold">${latest.status || ''}</span></div>
                          </td>
                          <td class="p-2.5 text-right font-extrabold text-[#00A3E0]">${formatThb_(c.metrics.daily)}</td>
                          <td class="p-2.5 text-right font-bold text-slate-800">${formatThb_(c.metrics.monthly)}</td>
                          <td class="p-2.5 text-right font-extrabold text-[#002B49]">${formatThb_(c.metrics.yearly)}</td>
                          <td class="p-2.5 text-center">
                            <button type="button" onclick="toggleV1195CompareCompany('${c.companyId}')" class="px-2.5 py-1 rounded-lg font-bold text-[11px] ${isCmp ? 'bg-[#002B49] text-white' : 'bg-slate-100 text-slate-700 hover:bg-sky-100'}">
                              ${isCmp ? '✓ เลือกเทียบ' : '+ เทียบ'}
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          ${state.activeTab === 'COMPANY_360' ? `
            <!-- TAB 2: SPLIT-VIEW CUSTOMER 360° CARD (LEFT: BIZ CARD + MAP | RIGHT: METRICS + S/N LINEAGE | BOTTOM: CHRONOLOGICAL FEED) -->
            <div class="space-y-4">
              <!-- Company Quick Switcher Bar -->
              <div class="flex flex-wrap items-center justify-between gap-2 bg-[#F0F9FF] p-2.5 rounded-xl border border-sky-200">
                <div class="flex items-center gap-2 flex-1 min-w-[240px]">
                  <span class="font-extrabold text-[#002B49] whitespace-nowrap">🏢 เลือกบริษัท:</span>
                  <select onchange="selectV1195Company(this.value)" class="w-full border border-sky-300 rounded-lg px-2.5 py-1.5 font-extrabold text-[#002B49] bg-white">
                    ${companies.map(c => `<option value="${c.companyId}" ${c.companyId === selected.companyId ? 'selected' : ''}>${c.companyName}</option>`).join('')}
                  </select>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button type="button" onclick="openBusinessCardScannerModal('${selected.companyId}')" class="px-3 py-1.5 rounded-lg bg-[#002B49] hover:bg-[#00A3E0] text-white font-bold">
                    📷 ถ่ายรูปสแกนนามบัตรเข้าฐานข้อมูล
                  </button>
                  <button type="button" onclick="toggleV1195CompareCompany('${selected.companyId}'); setV1195BoardTab('COMPARE_TOP');" class="px-3 py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-[#002B49] font-bold">
                    📊 นำไปคอมแพร์กราฟ
                  </button>
                </div>
              </div>

              <!-- Split Card: Left (Business Card & Google Map) + Right (Sales/Service Summary & S/N Caretaker Badges) -->
              <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <!-- LEFT COLUMN (5 cols): Digital/Scanned Business Card & Google Maps Location -->
                <div class="lg:col-span-5 bg-gradient-to-br from-white to-[#F0F9FF] border-2 border-[#00A3E0] rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3">
                  <div class="space-y-2.5">
                    <div class="flex items-center justify-between">
                      <span class="px-2.5 py-0.5 rounded-full bg-[#002B49] text-white font-extrabold text-[10.5px]">${selected.channelGrade}</span>
                      <span class="text-[10.5px] font-mono text-slate-500">Tax ID: ${selected.taxId}</span>
                    </div>

                    <!-- Business Card Visual Frame -->
                    <div class="bg-white border border-sky-200 rounded-xl p-3 shadow-2xs relative overflow-hidden">
                      <div class="absolute top-0 right-0 w-20 h-20 bg-[#00A3E0]/10 rounded-bl-full"></div>
                      ${selected.businessCardImg ? `<img src="${selected.businessCardImg}" alt="Scanned Card" class="w-full h-28 object-contain mb-2 rounded border">` : ''}
                      <div class="font-black text-sm text-[#002B49]">${selected.companyName}</div>
                      <div class="mt-2 pt-2 border-t border-sky-100">
                        <div class="font-extrabold text-slate-900 text-xs">${selected.contactName}</div>
                        <div class="text-[11px] text-[#00A3E0] font-bold">${selected.contactTitle}</div>
                        <div class="mt-1.5 space-y-0.5 text-[11px] text-slate-700">
                          <div>📞 โทร: <b>${selected.phone}</b> · LINE: <b>${selected.lineId}</b></div>
                          <div>✉️ อีเมล: <b>${selected.email}</b></div>
                          <div>👤 ผู้ดูแลหลัก: <b class="text-[#002B49]">${selected.assignedOwner}</b></div>
                        </div>
                      </div>
                    </div>

                    <!-- Address & Google Maps Instant Navigation / Share -->
                    <div class="bg-white border border-sky-200 rounded-xl p-2.5 space-y-2">
                      <div class="text-[11px] text-slate-700"><b class="text-[#002B49]">📍 ที่ตั้งบริษัท:</b> ${selected.address}</div>
                      <div class="grid grid-cols-2 gap-1.5">
                        <a href="https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}" target="_blank" rel="noopener" class="text-center py-1.5 px-2 rounded-lg bg-[#00A3E0] hover:bg-[#002B49] text-white font-extrabold text-[11px]">
                          🗺️ เปิดดู / นำทาง Google Maps
                        </a>
                        <button type="button" onclick="shareCompanyGoogleMapLine('${selected.companyId}')" class="py-1.5 px-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-[#002B49] font-extrabold text-[11px]">
                          📤 แชร์พิกัดโลเคชั่น
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- RIGHT COLUMN (7 cols): Real-Time Revenue Metrics + S/N Caretaker & Transfer Badges -->
                <div class="lg:col-span-7 bg-white border-2 border-sky-200 rounded-2xl p-4 shadow-sm space-y-3">
                  <div class="font-extrabold text-sm text-[#002B49] flex items-center justify-between">
                    <span>💰 สรุปมูลค่าการสั่งซื้อและรายได้จากบริษัทนี้ (Real-Time)</span>
                    <span class="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">อัปเดตล่าสุด: ${selected.metrics.lastOrderDate}</span>
                  </div>

                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div class="bg-[#F0F9FF] border border-sky-200 rounded-xl p-2.5">
                      <div class="text-[10.5px] text-sky-800 font-bold">ยอดรวมทั้งหมด (Lifetime)</div>
                      <div class="text-sm sm:text-base font-black text-[#002B49] mt-0.5">${formatThb_(selected.metrics.lifetime)}</div>
                    </div>
                    <div class="bg-[#F0F9FF] border border-sky-200 rounded-xl p-2.5">
                      <div class="text-[10.5px] text-sky-800 font-bold">ยอดสะสมปีนี้ (YTD)</div>
                      <div class="text-sm sm:text-base font-black text-[#00A3E0] mt-0.5">${formatThb_(selected.metrics.yearly)}</div>
                    </div>
                    <div class="bg-[#F0F9FF] border border-sky-200 rounded-xl p-2.5">
                      <div class="text-[10.5px] text-sky-800 font-bold">ยอดเดือนนี้ (Monthly)</div>
                      <div class="text-sm sm:text-base font-black text-[#002B49] mt-0.5">${formatThb_(selected.metrics.monthly)}</div>
                    </div>
                    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                      <div class="text-[10.5px] text-emerald-800 font-bold">ยอดซื้อล่าสุด</div>
                      <div class="text-sm sm:text-base font-black text-emerald-700 mt-0.5">${formatThb_(selected.metrics.lastOrderAmount)}</div>
                    </div>
                  </div>

                  <!-- Serial Number Registry & Caretaker / Ownership Transfer Badges -->
                  <div class="space-y-2 pt-1">
                    <div class="font-extrabold text-xs text-[#002B49]">❄️ ทะเบียนเครื่อง Hoshizaki (Model / Sub-Model / Serial Number &amp; ประวัติผู้ดูแล):</div>
                    <div class="space-y-2">
                      ${(selected.machines || []).map(m => `
                        <div class="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-1">
                          <div class="flex flex-wrap items-center justify-between gap-1">
                            <div class="font-extrabold text-[#002B49]">
                              รุ่น: <span class="text-[#00A3E0]">${m.model}</span> (${m.subModel}) · S/N: <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-300">${m.sn}</span>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${m.status.includes('Trade-In') ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}">${m.status}</span>
                          </div>
                          <div class="flex flex-wrap gap-1.5 text-[10.5px]">
                            <span class="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">🏢 ดีลเลอร์ต้นทาง: <b>${m.originalDealer}</b></span>
                            <span class="px-2 py-0.5 rounded bg-[#002B49] text-white font-bold">🛠️ ผู้ดูแลปัจจุบัน: ${m.currentCaretaker}</span>
                          </div>
                          <div class="text-[10.5px] text-slate-600">🔄 ไทม์ไลน์ผู้ดูแล: ${m.transferHistory}</div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>

              <!-- BOTTOM SECTION: Unified Chronological Timeline (Newest -> Oldest) -->
              <div class="bg-white border-2 border-sky-200 rounded-2xl p-4 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="font-extrabold text-sm text-[#002B49]">📋 ประวัติรายการสั่งซื้อเครื่อง อะไหล่ และงานเซอร์วิส (เรียงจากวันที่ใหม่ล่าสุด ➔ เก่าสุด)</div>
                  <div class="flex gap-1">
                    ${['ALL', 'SALE', 'REPAIR', 'PM'].map(ft => `
                      <button type="button" onclick="setV1195TimelineFilter('${ft}')" class="px-2.5 py-1 rounded-lg font-bold text-[11px] ${state.timelineFilter === ft ? 'bg-[#002B49] text-white' : 'bg-sky-50 text-[#002B49]'}">
                        ${ft === 'ALL' ? 'ทั้งหมด' : ft === 'SALE' ? '🛒 ซื้อเครื่อง/อะไหล่' : ft === 'REPAIR' ? '🔧 งานซ่อม' : '✨ ล้าง PM'}
                      </button>
                    `).join('')}
                  </div>
                </div>

                <div class="divide-y divide-sky-100 border border-sky-100 rounded-xl overflow-hidden">
                  ${filteredTimeline.map(row => `
                    <div class="p-3 hover:bg-sky-50/60 flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-start gap-2.5">
                        <span class="px-2 py-1 rounded-lg font-extrabold text-[10.5px] ${row.type === 'SALE' || row.type === 'PARTS' ? 'bg-sky-100 text-[#002B49]' : row.type === 'PM' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}">
                          ${row.type}
                        </span>
                        <div>
                          <div class="font-extrabold text-[#002B49]">${row.date} · ${row.model} <span class="text-slate-500 font-normal">(${row.docNo})</span></div>
                          <div class="text-[11px] text-slate-700">${row.desc}</div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="font-black text-sm text-[#002B49]">${formatThb_(row.amount)}</div>
                        <div class="text-[10.5px] font-bold text-emerald-700">${row.status}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}

          ${state.activeTab === 'COMPARE_TOP' ? `
            <!-- TAB 3: MULTI-COMPANY VISUAL GRAPH COMPARISON & TOP 3/5/10/20 LEADERBOARD -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <!-- Top N Ranking Leaderboard (Left 6 Cols) -->
              <div class="lg:col-span-6 bg-[#F0F9FF] border-2 border-sky-200 rounded-2xl p-4 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="font-extrabold text-sm text-[#002B49]">🏆 จัดอันดับลูกค้า &amp; ดีลเลอร์ (Top ${state.topN})</div>
                  <div class="flex gap-1">
                    ${[3, 5, 10, 20].map(n => `
                      <button type="button" onclick="setV1195TopN(${n})" class="px-2.5 py-1 rounded-lg font-extrabold text-[11px] ${state.topN === n ? 'bg-[#002B49] text-white' : 'bg-white text-[#002B49] border border-sky-200'}">Top ${n}</button>
                    `).join('')}
                  </div>
                </div>

                <div class="flex flex-wrap gap-1.5">
                  ${[
                    { k: 'revenue', l: 'ยอดซื้อรวมสูงสุด' },
                    { k: 'fleet', l: 'จำนวนเครื่อง S/N มากสุด' },
                    { k: 'upsell', l: 'โอกาสเสนอขาย/Trade-In' }
                  ].map(m => `
                    <button type="button" onclick="setV1195TopMetric('${m.k}')" class="px-2.5 py-1 rounded-full font-bold text-[11px] ${state.topMetric === m.k ? 'bg-[#00A3E0] text-white' : 'bg-white text-slate-700 border border-sky-200'}">${m.l}</button>
                  `).join('')}
                </div>

                <div class="space-y-2.5 pt-1">
                  ${sortedTop.map((c, idx) => {
                    const val = state.topMetric === 'fleet' ? (c.machines?.length || 0) : (c.metrics[pKey] || 0);
                    const pct = Math.max(8, Math.round((val / maxTopVal) * 100));
                    return `
                      <div onclick="selectV1195Company('${c.companyId}')" class="cursor-pointer bg-white p-2.5 rounded-xl border border-sky-200 hover:border-[#00A3E0] transition space-y-1">
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-extrabold text-[#002B49]">#${idx + 1} ${c.companyName}</span>
                          <span class="font-black text-[#00A3E0]">${state.topMetric === 'fleet' ? (val + ' เครื่อง') : formatThb_(val)}</span>
                        </div>
                        <div class="w-full h-2.5 bg-sky-100 rounded-full overflow-hidden">
                          <div class="h-full bg-gradient-to-r from-[#002B49] to-[#00A3E0] rounded-full" style="width:${pct}%"></div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Multi-Company Graph Comparison (Right 6 Cols) -->
              <div class="lg:col-span-6 bg-white border-2 border-sky-200 rounded-2xl p-4 space-y-3">
                <div class="font-extrabold text-sm text-[#002B49]">📊 กราฟเปรียบเทียบระหว่างบริษัทที่เลือก (${state.compareIds.length} บริษัท · ${pLabels[pKey]})</div>
                <div class="flex flex-wrap gap-1.5">
                  ${companies.map(c => {
                    const active = state.compareIds.includes(c.companyId);
                    return `
                      <button type="button" onclick="toggleV1195CompareCompany('${c.companyId}')" class="px-2.5 py-1 rounded-full text-[11px] font-bold border ${active ? 'bg-[#002B49] text-white border-[#002B49]' : 'bg-sky-50 text-slate-700 border-sky-200'}">
                        ${active ? '✓ ' : '+ '}${c.companyName.slice(0, 24)}...
                      </button>
                    `;
                  }).join('')}
                </div>

                <!-- Visual Side-by-Side Bar Comparison Chart -->
                <div class="bg-[#F0F9FF] rounded-xl p-3 border border-sky-200 space-y-3">
                  ${(() => {
                    const picked = companies.filter(c => state.compareIds.includes(c.companyId));
                    const maxVal = Math.max(1, ...picked.map(c => c.metrics[pKey] || 1));
                    return picked.map(c => {
                      const v = c.metrics[pKey] || 0;
                      const w = Math.max(10, Math.round((v / maxVal) * 100));
                      return `
                        <div class="space-y-1">
                          <div class="flex justify-between text-[11px] font-extrabold text-[#002B49]">
                            <span>${c.companyName}</span>
                            <span>${formatThb_(v)} (${c.machines.length} S/N)</span>
                          </div>
                          <div class="w-full h-5 bg-white rounded-lg border border-sky-200 overflow-hidden flex items-center">
                            <div class="h-full bg-gradient-to-r from-[#002B49] via-[#0066A6] to-[#00A3E0] text-white text-[10px] font-bold flex items-center px-2" style="width:${w}%">
                              ${w}%
                            </div>
                          </div>
                        </div>
                      `;
                    }).join('');
                  })()}
                </div>
              </div>
            </div>
          ` : ''}

          ${state.activeTab === 'FACTORY_IMPORT' ? `
            <!-- TAB 4: FACTORY IMPORT & PSI DEMAND FORECASTING ADVISOR (BOARDROOM) -->
            <div class="space-y-3">
              <div class="bg-gradient-to-r from-[#002B49] to-[#0066A6] text-white rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="font-extrabold text-sm">🚢 ศูนย์วิเคราะห์โมเดลขายดี &amp; จำลองยอดสั่งนำเข้าจากโรงงานต่างประเทศ (Executive Boardroom)</div>
                  <div class="text-[11px] text-sky-100">รวมข้อมูลยอดขายจริง (Sell-Out) + สต็อกคงเหลือ (Stock on Hand) + สินค้าบนเรือ (GIT) + สถิติงานซ่อมจากฝ่ายบริการ</div>
                </div>
              </div>

              <div class="overflow-x-auto border border-sky-200 rounded-2xl">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="bg-[#002B49] text-white">
                      <th class="p-2.5">โมเดลสินค้า / โรงงานต้นทาง</th>
                      <th class="p-2.5 text-center">ขาย 30 / 90 วัน</th>
                      <th class="p-2.5 text-center">สต็อก + GIT (พร้อมส่ง)</th>
                      <th class="p-2.5 text-center">สถิติเสียซ้ำ (Service)</th>
                      <th class="p-2.5">คำแนะนำระบบ</th>
                      <th class="p-2.5">จำลองเพิ่มยอด Order นำเข้า</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-sky-100">
                    ${DEFAULT_FACTORY_IMPORT_ADVISOR.map((item, idx) => {
                      const netAvail = item.stockOnHand + item.gitInTransit - item.pipelineReserved;
                      const weeksCover = ((netAvail / Math.max(1, item.sold30d)) * 4.3).toFixed(1);
                      const needOrder = Number(weeksCover) < item.leadTimeWeeks;
                      const suggestedQty = needOrder ? Math.max(10, Math.ceil(item.sold30d * 1.5 - netAvail)) : 0;
                      return `
                        <tr class="hover:bg-sky-50/70">
                          <td class="p-2.5">
                            <div class="font-extrabold text-[#002B49]">${item.model}</div>
                            <div class="text-[10.5px] text-slate-600">${item.category} · ${item.origin} (Lead Time ${item.leadTimeWeeks} สัปดาห์)</div>
                          </td>
                          <td class="p-2.5 text-center font-bold">${item.sold30d} / ${item.sold90d} เครื่อง</td>
                          <td class="p-2.5 text-center">
                            <span class="font-extrabold text-[#00A3E0]">${item.stockOnHand} + ${item.gitInTransit} GIT</span>
                            <div class="text-[10px] text-slate-500">จองโครงการ: ${item.pipelineReserved} (Cover ~${weeksCover} สัปดาห์)</div>
                          </td>
                          <td class="p-2.5 text-center">
                            <span class="px-2 py-0.5 rounded-full font-bold text-[10.5px] ${item.failureRatePct > 2 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}">${item.failureRatePct}%</span>
                          </td>
                          <td class="p-2.5">
                            ${needOrder
                              ? `<span class="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-extrabold text-[11px]">⚠️ แนะนำสั่งเพิ่ม +${suggestedQty} เครื่อง</span>`
                              : `<span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-[11px]">✅ สต็อกเพียงพอ</span>`
                            }
                          </td>
                          <td class="p-2.5 space-y-1">
                            <div class="flex items-center gap-1.5">
                              <input type="number" min="0" value="${suggestedQty}" oninput="recalcImportProposalRow(${idx}, this.value)" class="w-20 border-2 border-[#00A3E0] rounded-lg px-2 py-1 font-extrabold text-[#002B49]">
                              <span class="text-[11px] font-bold">เครื่อง</span>
                            </div>
                            <div id="impSimResult_${idx}" class="text-[10.5px] text-slate-600">
                              งบนำเข้า: <b>${formatThb_(suggestedQty * item.unitCostThb)}</b> · ยอดขายคาดการณ์: <b class="text-emerald-700">${formatThb_(suggestedQty * item.sellingPriceThb)}</b>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Boot Sequence
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(async function () {
      await ensureV1195Vault_();
      syncVersionBadgesToV1195_();
      injectV1195Launchers_();

      const params = new URLSearchParams(window.location.search);
      if (params.get('presentRoom')) {
        if (params.get('company')) state.selectedCompanyId = params.get('company');
        if (params.get('period')) state.period = params.get('period');
        state.presentationMode = true;
        openSalesMarketing360Board('COMPANY_360');
        return;
      }

      // Enforce Mobile Login Gate on main internal app if not logged in yet
      if (!isExternalPublicPortalUrl_() && !getSession_()) {
        openV1195MobileLoginModal();
      }
    }, 900);
  });
})();
