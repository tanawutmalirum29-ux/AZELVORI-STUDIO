# AZELVORI STUDIO

> **AI-Powered Software & Game Development Studio**  
> *From Ideas to Digital Reality.*

**สถานะ:** Private Workspace Alpha — มีเว็บไซต์, Lead API, CRM, คำเชิญลูกค้า, โปรเจกต์ส่วนตัว, ข้อความและการตรวจรับ milestone ใน source แล้ว; ยังไม่เปิดบริการจริง

**อัปเดตแผน:** 24 ตุลาคม 2026

**ภาษาเริ่มต้น:** ไทย รองรับอังกฤษในระยะถัดไป  
**หลักการ:** AWS-first / Customer-first / Privacy by design / Human-approved AI

AZELVORI STUDIO คือแพลตฟอร์มธุรกิจรับพัฒนาเว็บไซต์ เว็บแอป เกม รับแก้บั๊กเกม ปรับประสิทธิภาพ และออกแบบ UI/UX โดยมีเว็บไซต์บริษัทเป็นศูนย์กลาง ไม่ต้องใช้ Facebook เป็นช่องทางหลัก ลูกค้าจัดการงานผ่านพอร์ทัลส่วนตัวพร้อมแชทเรียลไทม์ พรีวิว ทบทวนงาน และชำระเงินได้

> ย่อหน้าข้างต้นคือเป้าหมายผลิตภัณฑ์ โค้ดข้อความส่วนตัวบันทึกผ่าน backend และตรวจข้อความใหม่ทุก 15 วินาที; ยังไม่ได้ยืนยันบน AWS จริง ระบบชำระเงิน ไฟล์ พรีวิวแยกโดเมน และ AI runner ยังไม่เปิดใช้งาน ดูสถานะรายฟีเจอร์ที่ [Implementation Status](docs/10_IMPLEMENTATION_STATUS.md)

## เริ่มรันโค้ด

**ต้องการเปิดบัญชีแอดมินบนเว็บ Amplify:** เริ่มที่ [คู่มือ CloudShell ภาษาไทย](docs/19_CLOUDSHELL_QUICKSTART.md) เปิด CloudShell ในบัญชีและ region ของ app `d3uhwi8blbgrci` แล้วรัน `bash scripts/cloudshell-activate.sh` จาก checkout ของ `main` ที่ไม่มีการแก้ไขค้าง ตัวช่วยตรวจเป้าหมาย เตรียม backend/บัญชี และเชื่อม Amplify ให้หลังยืนยันแผน ส่วน `--check` ตรวจ AWS อย่างเดียว ยังไม่เปิดรับบรีฟสาธารณะ

ใช้ Node.js 22.14 ขึ้นไป และ npm:

```bash
npm ci --ignore-scripts
npm run dev
```

เปิด `http://localhost:4173` — หน้าแรก, `/start` ฟอร์มบรีฟ 5 ขั้น, `/demo` พอร์ทัลข้อมูลสมมติ, `/login` ระบบบัญชี, `/admin` CRM, `/admin/inbox` กล่องข้อความลูกค้า, `/admin/projects` จัดการโปรเจกต์, `/app` พื้นที่ลูกค้า และ `/invite` รับคำเชิญ หน้าส่วนตัวตรวจสิทธิ์ผ่าน API

ไม่มี `.env` ก็เปิดดู UI ได้ ฟอร์มจะดาวน์โหลดร่างในเครื่องและไม่อ้างว่าส่งงานแล้ว ระบบจริงเชื่อมผ่านตัวแปรใน [.env.example](.env.example) และ [คู่มือพัฒนา/Deploy](docs/11_DEVELOPER_GUIDE.md)

```bash
npm run build
npm test
npm run infra:synth -- --quiet
# Chromium + WebKit, 5 viewports per engine (CI runs this)
npx playwright install --with-deps chromium webkit
npm run test:e2e
npm run test:e2e:workspace
```

**Stack:** React + TypeScript + Vite, Zod shared contracts, API Gateway/Lambda, DynamoDB, Cognito, AWS CDK. ข้อมูลจริงไม่ถูกฝังใน frontend และไม่มี AWS credentials ใน repo

**การเปิด AWS:** มี `amplify.yml`, security headers, SPA rewrites และ CDK template ให้แล้ว แต่ยังไม่ได้สร้างทรัพยากรหรือยืนยันการทำงานใน AWS account จริง

## ผลตรวจและขอบเขตล่าสุด

[CI ผ่านบนโค้ด `12b30b4`](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40054843771): ทดสอบระบบและตัวช่วยเปิดแอดมิน 170 กรณี และเบราว์เซอร์ 140 กรณี (Chromium/WebKit × 5 ขนาดจอ) พร้อม build, CDK synth, hosting preflight และ dependency audit ผ่าน ดูวิธีเริ่มและขอบเขตการตรวจใน [CloudShell quick start](docs/19_CLOUDSHELL_QUICKSTART.md). ผลรอบก่อนเก็บไว้ใน [Admin desk QA](docs/18_QA_ADMIN_DESK.md), [Workspace QA](docs/16_QA_PRIVATE_WORKSPACE.md) และ [Foundation QA](docs/12_QA_FOUNDATION.md)

ดู [แบบระบบและขั้นตอนเปิด pilot](docs/15_PRIVATE_WORKSPACE_PILOT.md) และ [สถานะงานเทียบแผน](docs/10_IMPLEMENTATION_STATUS.md) — ผลทดสอบ source ยังไม่ใช่การยืนยันระบบบน AWS จริงหรืออนุมัติเปิด production

**ภาพแบรนด์ที่เพิ่มแล้ว:** สัญลักษณ์ AZ, โลโก้แนวนอน, Favicon, ไอคอนมือถือ, ภาพปกแชร์ 1200×630 PNG, ภาพ Hero, ภาพประกอบบริการ และภาพระบบลูกค้า (รายละเอียดและตำแหน่งที่ [Brand Asset Implementation](docs/14_BRAND_ASSET_IMPLEMENTATION.md)). เป็นงานออกแบบต้นแบบสำหรับตรวจรับ ยังไม่ใช่เครื่องหมายการค้าที่ผ่านการตรวจรับทางกฎหมาย

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

**ความหมายสถานะ:** เอกสาร 00–09 เป็น planning baseline; เอกสาร 10–19 และ ADR แสดงขอบเขต implementation, วิธีรัน และผลตรวจจริง ห้ามถือว่าทุกรายการใน roadmap เสร็จเพียงเพราะมีโค้ดบางส่วน

## ที่มา/อ้างอิง
ดูแหล่งข้อมูลบริการ AWS, Stripe และข้อกฎหมายที่ต้องตรวจยืนยันใน [06_SECURITY_LEGAL](docs/06_SECURITY_LEGAL.md) และ [03_AWS_ARCHITECTURE](docs/03_AWS_ARCHITECTURE.md).

## Studio admin activation

Open `/admin/login` to enter the studio desk, `/admin` for brief intake/follow-up, `/admin/projects` for project control, and `/admin/setup` for connection checks. These require a deployed backend and an active founder grant; hosting the frontend alone does not create an admin account. See [Thai activation guide and operator commands](docs/17_ADMIN_ACTIVATION.md). The operator helper defaults to a read-only plan: `npm run admin:setup -- --help`.
