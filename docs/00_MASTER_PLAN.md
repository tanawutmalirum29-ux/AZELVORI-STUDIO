# 00 — Master Plan / Business Blueprint

**Version:** 1.0 (planning baseline) | **Date:** 2026-10-23 | **Owner:** Founder/Operator  
**Project:** AZELVORI STUDIO | **Status:** DRAFT FOR IMPLEMENTATION  
**คำจำกัดความ:** บริษัทในเนื้อหานี้หมายถึง “แบรนด์/กิจการที่วางแผนจะดำเนินการ” ไม่ใช่คำยืนยันว่าจดทะเบียนนิติบุคคลแล้ว

## 1. วิสัยทัศน์และคุณค่าที่เสนอขาย
สร้างสตูดิโอพัฒนาเว็บไซต์ เว็บแอป เกม และรับแก้บั๊กเกม ที่ทำธุรกรรมได้บนเว็บไซต์เดียวโดยไม่บังคับคุยผ่านโซเชียล ลูกค้าจะ **เห็นผลลัพธ์ ตรวจงาน จ่ายเงิน และติดตามงาน** ผ่าน Customer Portal; เจ้าของกิจการสามารถบริหารโปรเจกต์และมอบหมายงานให้ AI จาก Admin Workspace ที่ตรวจสอบย้อนหลังได้

### กลุ่มลูกค้า (ICP)
| Segment | Pain point | Service/Outcome | สิ่งต้องพิสูจน์ |
|---|---|---|---|
| SME ร้านค้า/ร้านอาหาร | ไม่มีเว็บ/จอง/หน้าร้านออนไลน์ | Landing/Business Website | งบและการแก้งาน |
| ธุรกิจเล็ก-กลาง | ต้องการระบบ CRM/booking/dashboard | Web Application | Scope และข้อมูลส่วนบุคคล |
| ผู้สร้างเกมอินดี้ | สร้าง prototype ไม่ทัน | Game Prototype / vertical slice | แพลตฟอร์มและทรัพย์สินทางปัญญา |
| ทีมเกมที่มีบั๊ก | ค้างบั๊ก/ไม่รู้สาเหตุ | Debug/Bug Fix | ทำซ้ำบั๊กได้, build เข้าได้ |
| เจ้าของเว็บเดิม | ช้า UX ไม่ดี ต้องย้ายระบบ | Maintenance/Optimization | baseline performance |

### หมวดบริการ
- Website: corporate/portfolio/landing/blog/e-commerce (ฟังก์ชันจ่ายเงินจริงแยก scope)
- Web App: ระบบนัดหมาย งานภายใน บัญชีสมาชิก Dashboard Integration
- Game Development: prototype, browser game, Godot/Unity ตามการประเมิน, game loop, UI, VFX/audio ที่มีสิทธิ์ใช้
- Game Bug Fix: reproduce, profiling, debugging, regression tests, performance optimization, patch handoff
- Maintenance: การดูแล/อัปเดตหลังส่งมอบ, monitoring และ incident support ตามสัญญา
- UX/Visual: design system และ UI asset ที่มีสิทธิ์นำไปใช้; งาน 3D/เสียง/animation ตีราคาตาม scope

### ไม่รับโดยอัตโนมัติ
เกม AAA, multiplayer ขนาดใหญ่, การรับประกันอันดับ SEO/ยอดขาย, การแก้ระบบที่ไม่มีสิทธิ์เข้าถึง, โค้ดผิดกฎหมาย/โกงเกม/ละเมิด DRM, ระบบรับเงินที่ยังไม่ผ่านการประเมินความเสี่ยง หรืองานที่ระบุเวลา/งบโดยไม่มี discovery

## 2. หลักออกแบบบริการ
1. **Website-first communication**: บริษัท มี FAQ, ตัวอย่างงาน, inquiry form, portal, chat, การแจ้งเตือนทางอีเมล; ไม่ต้องใช้ Facebook เป็นช่องทางหลัก
2. **Verified progress**: เปอร์เซ็นต์ความคืบหน้าต้องอิง milestone ที่ตรวจรับแล้ว ไม่ใช่จำนวนข้อความ AI
3. **Human in control**: AI ร่างข้อเสนอ/เขียนโค้ดได้ แต่ scope, quote, payment release, production, refund และการส่งมอบต้องมีเจ้าของกิจการอนุมัติ
4. **Tenant isolation**: แยกข้อมูลและการเข้าถึงต่อองค์กร/โปรเจกต์แบบบังคับที่ server + event + file + preview
5. **Reversible work**: snapshot, backup, rollback, audit log สำหรับทุก release
6. **Transparency**: อธิบายให้ลูกค้าทราบว่ามีการใช้ AI ช่วยดำเนินงานตามความเหมาะสม ไม่อ้างว่ามีทีมมนุษย์จำนวนมากถ้าไม่มีจริง
7. **Low operational complexity**: เริ่มจาก modular monolith/serverless ก่อน microservices; no multi-account per customer ตั้งแต่วันแรก

## 3. Value stream: Lead → Revenue → Delivery
| Stage | Trigger | Output | SLA/Policy ตั้งต้น (ต้องอนุมัติ) |
|---|---|---|---|
| Discover | กรอกฟอร์ม | Lead + ประเภทงาน | acknowledge ทันที |
| Qualify | admin ตรวจ | Qualified / Declined | ตอบเบื้องต้นภายใน 1 วันทำการ (เป้าหมาย) |
| Scope | นัด/ถาม requirement | Scope & acceptance | ห้ามรับงานก่อนมี scope |
| Quote | admin อนุมัติราคา | Versioned Quote | มีวันหมดอายุ เงื่อนไขมัดจำ |
| Accept | ลูกค้ายืนยัน | Order + contract snapshot | เก็บหลักฐานยืนยัน |
| Deposit | provider ยืนยันเงินจริง | Active Project | webhook/idempotency |
| Execute | tasks/AI/human | artifacts + preview | build & tests ก่อน publish |
| Review | ลูกค้าส่ง revision | bounded change requests | นับรอบแก้ไขอย่างเป็นธรรม |
| QA/UAT | QA ผ่าน + client approve | Acceptance | ไม่มี P0/P1 เปิดค้าง |
| Final payment | จ่ายครบตามสัญญา | Delivery entitlement | ไม่เผย source ที่ตกลงว่าต้องจ่ายก่อน |
| Handover | export/transfer | files, docs, access | ยืนยันสิทธิ์และ revoke credentials |
| Warranty/Support | issue หลังส่ง | support ticket | กำหนดระยะประกันแยก |

## 4. ประสบการณ์ผลิตภัณฑ์หลัก
**Public Site:** หน้าแรก / บริการ / ผลงาน (ต้องได้รับอนุญาต) / ขั้นตอน / ราคาเริ่มต้นเชิงช่วง ไม่รับประกัน / FAQ / ติดต่อ / Privacy & Terms.  
**Customer:** สมัคร/เข้าสู่ระบบ / บรีฟงาน / ใบเสนอราคา / ชำระเงิน / โครงการ / แชท / ไฟล์ / พรีวิว / ขอแก้ไข / อนุมัติ / ส่งมอบ / Support.  
**Admin:** Leads / ลูกค้า / ราคา / โปรเจกต์ / ทีม/AI / ช่องสนทนา / QA / Deployment / การเงิน / Incident / Audit / การตั้งค่าแบรนด์.

## 5. Business model (ไม่ใช่ราคาประกาศ)
- Fixed-price เฉพาะงานที่ scope ชัด; time & materials สำหรับ bug fixing/legacy diagnosis
- แยก Discovery Fee สำหรับงานซับซ้อนและรหัสโปรเจกต์เก่าที่มีความเสี่ยง
- Milestone billing เป็นค่าเริ่มต้น: 30% เริ่มงาน / 40% หลัง demo ผ่าน / 30% ก่อนส่งมอบ (ปรับตามสัญญา)
- Optional: Maintenance รายเดือน, Hosting & Monitoring, Support retainer
- Platform fee: ต้นทุน AI/API, AWS, domain, payment, testing, creative licenses, risk buffer ต้องถูกใส่ในการตั้งราคา

## 6. Metrics / North-star / Guardrails
**Business:** lead→quote conversion; quote→paid; gross margin per project; on-time delivery; rework hours; refund/dispute; recurring revenue.  
**Product:** inquiry completion, invite acceptance, chat delivery p95, preview build success, UAT cycle, CSAT.  
**Engineering:** lead time; deploy rollback rate; failed build; open P0/P1; test pass; DORA-like metrics.  
**Security:** cross-tenant access attempts; auth anomalies; secret exposure incidents; malware upload rate.  
**Owner dashboard:** 1 หน้าจอแสดง lead ใหม่, งานต้องอนุมัติ, โปรเจกต์ติดขัด, ยอดค้างชำระ, ความเสี่ยง

## 7. เป้าหมายคุณภาพสำหรับ Beta (SLO ที่เสนอ ไม่ใช่ผลทดสอบ)
- 0 การรั่วข้าม tenant ใน automated negative tests
- CRUD สำคัญ 100% มี authorization test, idempotent payment tests, audit trail
- หน้า landing/Core flows บน 320×568, 390×844, 768×1024, 844×390, 1440×900; Chromium + WebKit
- Web Core Vitals: LCP <= 2.5s, CLS <= 0.1, INP <= 200ms ในสภาพแวดล้อมทดสอบกำหนด
- Chat message persistence ผ่าน DB ก่อนส่ง event; reconnect recovery; duplicate delivery ไม่ทำให้ข้อความซ้ำ
- P95 authenticated API < 800 ms ภายใต้ workload ทดสอบ; uptime target กำหนดหลัง pilot
- Restore drill ผ่านอย่างน้อย 1 รอบก่อนเปิด beta; restore time/data loss targets ตาม [Runbook](09_OPERATIONS_RUNBOOK.md)

## 8. โมเดลความเสี่ยงและการตัดสินใจ
| Risk | Impact | Mitigation/Decision |
|---|---|---|
| หลายลูกค้าใช้ระบบเดียว | ข้อมูลรั่ว | policy at every boundary + negative tests |
| ค่า AWS/AI พุ่ง | ขาดทุน | budget alerts + usage limits/job caps/concurrency |
| Deploy งานลูกค้าทำลายระบบบริษัท | outage | sandbox/account separation + isolated domains |
| ลูกค้าอยากเห็นชื่อแบรนด์รับเงิน | identity/bank statement ambiguity | ทดสอบ processor และเอกสารกฎหมายจริง |
| คำขอแก้ไม่สิ้นสุด | margin ติดลบ | revision quota & change order |
| AI หลอนหรือเปลี่ยนของนอก scope | QA fail | scoped task contract, code review, human gate |
| สิทธิ์ repo/asset ของลูกค้า | IP dispute | ownership declaration and licensed assets checklist |
| ไฟล์ ZIP/โค้ดอันตราย | ransomware/abuse | quarantine, malware scan, sandbox, no host execution |

## 9. Decision record (ADR seed)
- ADR-001 AWS เป็น primary hosting; ทบทวน costs ทุกเดือน
- ADR-002 Website + Customer Portal + Admin ใน monorepo ของบริษัท แบ่ง module
- ADR-003 Customer chat in-app; ไม่มี public chat room; AppSync Events ส่ง notification ไม่เป็น source of truth
- ADR-004 DynamoDB สำหรับ canonical metadata; S3 สำหรับ files; Cognito authentication
- ADR-005 Stripe Checkout/PromptPay candidate; ต้องผ่าน business/KYC และ test descriptor ก่อน live
- ADR-006 Project workspace เก็บแยกโปรเจกต์; GitHub optional per delivery, ไม่ใช้ GitHub Issues เป็นห้องแชท
- ADR-007 Production release requires QA + Owner signoff; emergency rollback runbook
- ADR-008 Browser preview แยก domain/origin และ authorization; no arbitrary code execution in portal
- ADR-009 MVP เริ่มไทย/THB ก่อน รองรับภาษาอังกฤษแบบ staged
- ADR-010 เปลี่ยน ADR ได้ผ่าน decision log มีเหตุผล ผู้อนุมัติ และผลกระทบ

## 10. คำตัดสินที่รอ Founder
1. สถานะทางธุรกิจ/ชื่อทางการในเอกสาร, ใครเป็นผู้ออกใบกำกับ/ใบรับเงิน
2. งบ AWS และ AI สูงสุดต่อเดือน; ประเทศ Region; domain
3. กำหนด SLA เวลาตอบ, จำนวนรอบแก้, มัดจำ, คืนเงิน, ระยะประกัน
4. รองรับ Godot/Unity/HTML5 ในระยะแรกแบบใด (เสนอ HTML5 + Godot code review ก่อน)
5. ประเภทไฟล์ลูกค้าที่อนุญาต ขนาดสูงสุด และจำนวนโปรเจกต์พร้อมกัน
6. ผู้ให้บริการชำระเงินที่อนุมัติ KYC และแสดงชื่อถูกต้อง
7. ภาพผลงานที่ใช้ใน portfolio มีสิทธิ์เผยแพร่หรือไม่

**Exit Phase 0:** ตัดสินใจ 1–7 จนครบ หรือบันทึก Deferred พร้อม owner และ due date; ไม่อ้าง feature TBD ว่าพร้อมเปิดขาย
