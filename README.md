# AZELVORI STUDIO

> **AI-Powered Software & Game Development Studio**  
> *From Ideas to Digital Reality.*

**สถานะ:** Architecture & Product Planning — ยังไม่เริ่มพัฒนาระบบจริง  
**อัปเดตแผน:** 23 ตุลาคม 2026  
**ภาษาเริ่มต้น:** ไทย รองรับอังกฤษในระยะถัดไป  
**หลักการ:** AWS-first / Customer-first / Privacy by design / Human-approved AI

AZELVORI STUDIO คือแพลตฟอร์มธุรกิจรับพัฒนาเว็บไซต์ เว็บแอป เกม รับแก้บั๊กเกม ปรับประสิทธิภาพ และออกแบบ UI/UX โดยมีเว็บไซต์บริษัทเป็นศูนย์กลาง ไม่ต้องใช้ Facebook เป็นช่องทางหลัก ลูกค้าจัดการงานผ่านพอร์ทัลส่วนตัวพร้อมแชทเรียลไทม์ พรีวิว ทบทวนงาน และชำระเงินได้

## เอกสารแผนหลัก

1. [ภาพรวมและกรอบธุรกิจ](docs/00_MASTER_PLAN.md)
2. [ขอบเขตฟีเจอร์และ Product Requirements](docs/01_PRODUCT_REQUIREMENTS.md)
3. [หน้าจอ UX และ Customer Journeys](docs/02_UX_CUSTOMER_JOURNEYS.md)
4. [สถาปัตยกรรม AWS และการ Deploy](docs/03_AWS_ARCHITECTURE.md)
5. [Data Model, API และ Event Contracts](docs/04_DATA_API_CONTRACTS.md)
6. [AI Development Workspace และกระบวนการส่งงาน](docs/05_AI_WORKFLOW.md)
7. [ความปลอดภัย ความเป็นส่วนตัว และข้อกฎหมาย](docs/06_SECURITY_LEGAL.md)
8. [Roadmap, Backlog, QA และเกณฑ์เปิดบริการ](docs/07_ROADMAP_QA.md)
9. [ราคา การเงิน และการดำเนินธุรกิจ](docs/08_BUSINESS_OPERATIONS.md)
10. [การปฏิบัติการ AWS, Incident และ Disaster Recovery](docs/09_OPERATIONS_RUNBOOK.md)

## หลักการที่ต้องไม่ต่อรอง
- ลูกค้า A ต้องอ่านข้อมูล แชท ไฟล์ ใบเสนอราคา และพรีวิวของลูกค้า B ไม่ได้ แม้เดา URL หรือ UUID ถูก
- หน้า Customer กับหน้า Admin/AI ต้องแยกสิทธิ์ผ่าน backend ทุกครั้ง ไม่ใช่เพียงซ่อนปุ่ม
- ข้อมูลจ่ายเงินตรวจยืนยันจากผู้ให้บริการผ่าน webhook ที่ตรวจลายเซ็น ห้ามเชื่อค่าจาก browser
- AI ไม่สามารถใช้ credentials ลูกค้าเป็นค่าเริ่มต้น แก้ production หรือ Merge/Deploy โดยไม่มี Gate ที่ระบุ
- AI ทำงานได้ผ่าน API/runner ที่เชื่อมต่อและได้รับสิทธิ์จริงเท่านั้น; แชทเปล่าไม่ได้ทำให้ AI ควบคุม AWS หรือ Git ได้เอง
- ทุกงานลูกค้ามีขอบเขต ราคา milestone รอบแก้ไข acceptance criteria และนโยบายส่งมอบชัดเจน
- AWS มี service quotas และคิดค่าบริการตามการใช้ ไม่ใช่ทรัพยากรฟรีไม่จำกัด; ตั้ง budget/alerts ก่อนเปิดใช้
- ยังไม่อ้างว่าเป็นบริษัทจำกัดหรือมีเครื่องหมายการค้าจดทะเบียนจนตรวจสอบและดำเนินการจริง

## ลำดับเริ่มทำงาน
**Phase 0** รวบรวมธุรกิจ/ความเสี่ยง → **Phase 1** เว็บไซต์ + Identity + CRM → **Phase 2** Customer Portal + Chat → **Phase 3** Quotes/Payments/Preview → **Phase 4** AI-assisted workflow → **Phase 5** Beta/Pilot → **Phase 6** Scale.

**ความหมายสถานะ:** เอกสารทั้งหมดเป็นข้อเสนอการออกแบบและเกณฑ์ส่งมอบ ยังไม่ใช่การยืนยันว่าระบบ ฟังก์ชัน ความปลอดภัย หรือ AWS ได้ติดตั้งแล้ว

## ที่มา/อ้างอิง
ดูแหล่งข้อมูลบริการ AWS, Stripe และข้อกฎหมายที่ต้องตรวจยืนยันใน [06_SECURITY_LEGAL](docs/06_SECURITY_LEGAL.md) และ [03_AWS_ARCHITECTURE](docs/03_AWS_ARCHITECTURE.md).
