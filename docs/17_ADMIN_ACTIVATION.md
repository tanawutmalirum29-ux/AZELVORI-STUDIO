# เปิดแอดมิน AZELVORI และเชื่อมระบบจริง

หน้าเว็บที่ผู้ใช้ให้ตรวจ: https://main.d3uhwi8blbgrci.amplifyapp.com

การเผยแพร่หน้าเว็บบน Amplify **ไม่ได้สร้าง API, Cognito, ฐานข้อมูล หรือบัญชีผู้ดูแลโดยอัตโนมัติ** เจ้าของรันตัวช่วยเปิดระบบแล้ว: ภาพ CloudShell วันที่ 24 ตุลาคม 2026 เวลา 10:36 แสดงว่าให้สิทธิ์เจ้าของ เชื่อม Amplify และเผยแพร่ job 15 สำเร็จ ตรวจหน้าเว็บจริงพบ Cognito/API ตั้งค่าแล้วและ health ผ่าน เจ้าของมาถึงขั้นตั้งรหัสผ่านครั้งแรกใน Cognito; การล็อกอินครบ MFA และทดสอบงานหลังล็อกอินยังรอตรวจ

## เปิดหน้าไหน

| หน้า | ใช้ทำอะไร |
|---|---|
| `/admin/login` | ลงชื่อเข้าใช้เจ้าของสตูดิโอ |
| `/admin` | รับเรื่องจากบรีฟ คิวติดตาม โน้ตภายใน และเปิดโปรเจกต์ |
| `/admin/projects` | คุมสถานะโปรเจกต์ ขั้นตอนตรวจรับ ข้อความ และสมาชิก |
| `/admin/setup` | ตรวจค่าการเชื่อมต่อ ทดสอบ API และดูวิธีตั้งค่าครั้งแรก |
| `/login` และ `/app` | บัญชีและพื้นที่ลูกค้า |

มีลิงก์ **สำหรับผู้ดูแล** ที่ท้ายเว็บทุกหน้า บัญชีลูกค้าไม่มีสิทธิ์เปิดพื้นที่แอดมิน แม้พิมพ์ URL โดยตรง

## ตั้งครั้งเดียวใน AWS

**ทางเริ่มที่แนะนำ:** ใช้ [คู่มือ CloudShell แบบนำทาง](19_CLOUDSHELL_QUICKSTART.md) และ `bash scripts/cloudshell-activate.sh` ตัวช่วยเตรียม Node, ตรวจบัญชี/region, สร้าง backend ที่ยังไม่มี, สร้างบัญชีเจ้าของ, เติมค่า Amplify main และรอ build ให้ในลำดับเดียว ขั้นตอน manual ด้านล่างยังใช้เมื่อมี stack เดิมหรือจำเป็นต้องตั้งค่าแยกส่วน

ใช้ AWS CloudShell หรือเครื่องของผู้ดูแลที่มี AWS CLI v2, Node.js >=22.14 และบัญชี AWS/SSO ที่ได้รับสิทธิ์อยู่แล้ว ห้ามส่ง access key, secret key, รหัสผ่าน หรือ OTP ในแชตหรือ commit ลง GitHub

ตัวอย่างด้านล่างเลือก `ap-southeast-1` สำหรับ **backend staging**; ตรวจว่าเป็น region ที่คุณตั้งใจใช้ก่อนรัน ไม่ใช่การยืนยัน region ของ Amplify ที่มีอยู่ การ deploy สร้างทรัพยากรที่อาจมีค่าใช้จ่าย ให้ตรวจรายการ CDK ก่อนยืนยัน

```bash
git clone https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO.git
cd AZELVORI-STUDIO
npm ci --ignore-scripts
npm run build:api
export AWS_REGION=ap-southeast-1
export AWS_DEFAULT_REGION=ap-southeast-1
aws sts get-caller-identity
```

ตรวจ Account ที่แสดงว่าเป็นบัญชีที่จะใช้ แล้ว bootstrap หากบัญชียังไม่ได้ทำ และ deploy:

```bash
# แทน 123456789012 ด้วย AWS Account ID ที่ตรวจแล้ว
npx cdk bootstrap aws://123456789012/ap-southeast-1
npx cdk deploy --app 'node --import tsx infrastructure/cdk/app.ts' \
  -c stage=staging \
  -c appOrigin=https://main.d3uhwi8blbgrci.amplifyapp.com \
  -c intakeEnabled=false -c legalReady=false
```

ถ้าใช้ named profile ให้เพิ่ม `--profile YOUR_PROFILE` ให้ AWS/CDK และ admin:setup ทุกคำสั่งอย่างสอดคล้องกัน ถ้ามี stack เดิมให้ deploy อัปเดต stack นั้นด้วย context เดิม อย่าสร้าง environment ซ้ำโดยไม่ตั้งใจ รุ่นนี้เพิ่ม GET รายละเอียดบรีฟ, PATCH follow-up, health capabilities และ AuditTable/AppOrigin outputs จึงต้องอัปเดต backend ด้วย

## สร้างบัญชีผู้ดูแลคนแรก

แทนอีเมลตัวอย่างด้วย **อีเมลของเจ้าของสตูดิโอที่ตั้งใจให้สิทธิ์เต็ม** และ Account ID จริง:

```bash
npm run admin:setup -- \
  --account 123456789012 --region ap-southeast-1 \
  --stack Azelvori-staging --email owner@example.com
```

คำสั่งนี้อ่านอย่างเดียวและแสดง `PLAN_ONLY`: บัญชี/region/stack/อีเมลเป้าหมาย และค่าหน้าเว็บ ตรวจแล้วใช้คำสั่งเดิมเพิ่ม `--apply`:

```bash
npm run admin:setup -- \
  --account 123456789012 --region ap-southeast-1 \
  --stack Azelvori-staging --email owner@example.com --apply
```

ผลที่ทำจริง:

- เทียบ AWS Account ID และ stack ARN/status ก่อนเปลี่ยนข้อมูล
- ใช้บัญชี Cognito ที่มีอีเมลตรงกัน หรือสร้างใหม่และให้ Cognito ส่งคำเชิญทางอีเมล ไม่มีรหัสผ่านออกทาง stdout และไม่ทำเครื่องหมาย email_verified เอง
- อ่าน `AdminGetUser` จาก user pool/อีเมลเป้าหมาย รวมถึงหลังสร้างบัญชีใหม่ ตรวจ Enabled และสถานะก่อนให้สิทธิ์ ใช้ `sub` เป็นรหัสของผู้ให้บริการโดยเก็บค่าเดิม ไม่บังคับ RFC UUID; หากตรวจไม่ผ่านจะแสดงรหัสเหตุผลโดยไม่พิมพ์ข้อมูลบัญชี
- เขียน `STAFF#<actual Cognito sub>` พร้อม `FOUNDER_ADMIN` และ audit ผู้ดำเนินการใน DynamoDB transaction เดียว จากนั้นอ่านตรวจผลแบบ strongly consistent
- ไม่ทับ grant ที่มีอยู่ ไม่ฟื้นสิทธิ์ที่ถูกถอน ถ้าบัญชีมีสิทธิ์ถูกต้องแล้วจะไม่ส่งคำเชิญหรือสร้าง grant ซ้ำ
- บัญชีใหม่และ grant อยู่คนละบริการ จึงไม่ใช่ transaction ข้าม Cognito/DynamoDB หากสร้างบัญชีสำเร็จแต่ grant ล้มเหลว ให้แก้สิทธิ์ AWS แล้วรันใหม่; โปรแกรมพบบัญชีเดิมและทำส่วนที่เหลือต่อ

สิทธิ์ operator ที่ต้องมี: `sts:GetCallerIdentity`, `cloudformation:DescribeStacks`, `cognito-idp:AdminGetUser`, `cognito-idp:AdminCreateUser` ใน pool ของ stack และ `dynamodb:GetItem`, `dynamodb:PutItem` สำหรับ operations/audit ตาม transaction เท่านั้น (จำกัด `dynamodb:LeadingKeys` ตามงานได้) แอปเว็บและ Lambda **ไม่ได้** รับสิทธิ์สร้าง staff grant เพิ่ม

## นำค่ามาใส่ Amplify

ผล `admin:setup` มี `frontend` ซึ่งเป็น public identifiers ทั้งหมด นำไปใส่ใน Amplify app `d3uhwi8blbgrci` → Hosting → Environment variables ของ branch `main`:

| ตัวแปร | ที่มา |
|---|---|
| `VITE_API_BASE_URL` | `ApiBaseUrl` ของ stack |
| `VITE_COGNITO_AUTHORITY` | `CognitoAuthority` |
| `VITE_COGNITO_CLIENT_ID` | `CognitoClientId` |
| `VITE_COGNITO_DOMAIN` | `CognitoDomain` |
| `VITE_SITE_URL` | `https://main.d3uhwi8blbgrci.amplifyapp.com` |
| `VITE_PUBLIC_INTAKE_ENABLED` | `false` ระหว่างตั้งค่า |

**Redeploy frontend หลังบันทึกค่า** เพราะ Vite อ่านค่าตอน build ไม่ใช่ตอนเปิดหน้าเว็บ ตัวช่วยไม่เขียนทับ environment variables อื่นของ Amplify

เปิด `/admin/setup` รายการบัญชีและ API ต้องเปลี่ยนเป็น “ตั้งค่าแล้ว” กดทดสอบ API ต้องตอบว่า “รองรับบันทึกติดตามบรีฟ” การผ่าน health ยืนยันเฉพาะการตอบกลับของ API ไม่ยืนยันสิทธิ์หรือการเขียนฐานข้อมูล

จากนั้นเปิด `/admin/login` ใช้บัญชีที่ได้รับคำเชิญ ตั้งรหัสผ่านใหม่และ TOTP Authenticator ตามหน้า Cognito การตั้งรหัสผ่าน/OTP ทำในหน้า AWS เท่านั้น เมื่อสำเร็จกลับ `/admin` จะตรวจ `FOUNDER_ADMIN` จากเซิร์ฟเวอร์ก่อนโหลดบรีฟ

## ใช้รหัสผ่านที่จำง่าย

นโยบายใน CDK ปัจจุบันกำหนด **อย่างน้อย 12 ตัวอักษร** โดยไม่บังคับตัวใหญ่ ตัวเล็ก ตัวเลข หรือสัญลักษณ์ผสมกัน ใช้คำหลายคำต่อกันให้ยาวพอได้ บัญชีทุกคนใน pool ใช้นโยบายเดียวกันและยังยืนยันด้วย TOTP Authenticator รหัสผ่านใหม่ต้องกรอกตรงกันทั้งสองช่อง และหน้า Cognito ไม่รับช่องว่างนำหน้าหรือต่อท้าย

หากเปิด pool ด้วยรุ่นเดิมที่บังคับ 14 ตัวอักษรและอักขระทั้ง 4 ประเภท การอัปเดต GitHub/Amplify อย่างเดียว **ยังไม่เปลี่ยน pool ที่เปิดไว้** และ activation wizard ใช้ stack เดิมโดยไม่ deploy ทับ เปลี่ยนผ่าน Console ได้ทันทีโดยไม่ต้องรัน CloudShell ใหม่:

1. เปิด AWS Console → **Amazon Cognito → User pools** ใน region ของ backend (ของเว็บนี้ที่เจ้าของเปิดแล้วคือ Sydney / `ap-southeast-2`)
2. เลือก pool ที่ตรงกับ `UserPoolId` ใน CloudFormation stack `Azelvori-staging` → **Authentication methods → Password policy → Edit**
3. เลือก **Custom password policy**, ตั้ง **Password minimum length = 12** และเอาเครื่องหมายถูกออกจาก requirements ทั้ง 4 รายการ: Numbers, Special characters, Uppercase letters, Lowercase letters แล้ว Save changes
4. เปิด `/admin/login` ใหม่เพื่อเริ่มหน้าลงชื่อเข้าใช้และโหลดกฎใหม่ หากยังอยู่ขั้นเปลี่ยนรหัสครั้งแรกให้ใช้คำเชิญเดิม ตั้งรหัสผ่านส่วนตัวในหน้า Cognito และทำขั้นตอน Authenticator ต่อ

การเปลี่ยนนโยบายไม่สร้างผู้ใช้ใหม่และไม่ตั้งรหัสผ่านให้ผู้ใช้ การแก้ Console เป็นการเปลี่ยนค่าจริงนอก CloudFormation ชั่วคราว; source ได้ปรับให้ตรงกันแล้ว การ deploy CDK ครั้งถัดไปด้วย context เดิมจะบันทึกกฎนี้ใน stack ด้วย วิธีนี้ไม่ใช่หลักฐานว่าแก้ AWS สำเร็จ ต้องตรวจว่า Console/หน้าตั้งรหัสแสดงกฎใหม่

อ้างอิง: [AWS password policy](https://docs.aws.amazon.com/cognito/latest/developerguide/managing-users-passwords.html) และ [NIST password guidance](https://pages.nist.gov/800-63-4/sp800-63b.html#passwords) ซึ่งแนะนำไม่บังคับผสมประเภทอักขระ นโยบายนี้ไม่ได้อ้างว่าระบบผ่านมาตรฐาน NIST ทั้งชุด

## เริ่มรับบรีฟและคุมงาน

1. ตรวจข้อมูลธุรกิจ ผู้ติดต่อ และนโยบายในหน้า privacy/terms ให้ตรงกับธุรกิจจริงก่อนเปิดรับข้อมูลลูกค้า รุ่นปัจจุบันยังมีข้อความ alpha ที่ต้องให้เจ้าของยืนยัน
2. ตรวจ staging: login/MFA, grant revocation, logout/refresh, CORS, callback `/auth/callback`, ข้อมูลไม่ข้ามบัญชี และ persistence หลังโหลดหน้าใหม่ ใช้ข้อมูลสมมติที่ไม่มี PII จริงในการทดสอบ
3. หากเริ่มด้วย `lambdaConcurrency=shared` ให้จัด quota และเปลี่ยนเป็น `lambdaConcurrency=reserved` ก่อน (ต้องจองได้ 5 โดยเหลือ unreserved อย่างน้อย 100) จากนั้นเปิด backend ด้วย `legalReady=true` และ `intakeEnabled=true` เมื่อพร้อมจริง แล้วตั้ง frontend `VITE_PUBLIC_INTAKE_ENABLED=true` และ redeploy ทั้งสองฝั่งต้องเปิดจึงส่งบรีฟสำเร็จ
4. บรีฟสำเร็จต้องมีเลขรับเรื่องจาก API และปรากฏใน `/admin` เลือกบรีฟ → “รับเรื่องแล้ว” → เก็บรายละเอียด → ประเมิน → สร้างโปรเจกต์ส่วนตัว
5. ใช้วันนัดติดตาม/ความสำคัญ/โน้ตภายในจัดคิว บันทึกก่อนเปลี่ยนสถานะ คิวและการค้นหานับเฉพาะหน้าข้อมูลที่โหลดแล้ว กด “โหลดเพิ่มเติม” เมื่อต้องการดูย้อนหลัง
6. ใน `/admin/projects` เชิญลูกค้า ส่งลิงก์คำเชิญให้ผู้รับที่ตั้งใจ และคุย/ตรวจรับตามเวอร์ชัน การรับเรื่องและโน้ตภายในไม่ส่งอีเมลตอบลูกค้าอัตโนมัติ

ก่อนเปิด production ให้ตั้ง budget/email/notification action ของ alarm, ทดสอบ backup/recovery และกำหนดการเก็บ/ลบข้อมูลตาม [Developer guide](11_DEVELOPER_GUIDE.md) การเปิด staging หรือ health check ไม่ทำให้ระบบเป็น production โดยอัตโนมัติ

## เมื่อมีปัญหา

| อาการ | ตรวจจุดนี้ |
|---|---|
| ปุ่มเข้าสู่ระบบปิดอยู่ | Cognito/API VITE variables ขาด หรือยังไม่ได้ redeploy frontend |
| ล็อกอินได้ แต่ไม่มีสิทธิ์ผู้ดูแล | grant ต้องใช้ Cognito `sub` จริง ไม่ใช่อีเมล/username; admin:setup ตรวจและสร้างให้ |
| API ตอบกลับ แต่โน้ตบันทึกไม่ได้ | backend ต้องเป็นรุ่นที่รองรับ `crm-follow-up`; deploy stack ปัจจุบัน |
| ข้อมูลถูกแก้พร้อมกัน (409) | ร่างยังอยู่ คัดลอกส่วนที่ต้องเก็บ แล้วกด “โหลดบรีฟล่าสุด” ก่อนแก้ใหม่ |
| ต่ออายุเซสชันไม่ได้ | ลงชื่อเข้าใหม่ ไม่ยืดอายุ refresh token เกินค่า 8 ชั่วโมงที่กำหนดไว้ |
| อีเมลคำเชิญยังไม่มา | ตรวจ spam, email delivery ใน Cognito และอายุรหัสชั่วคราว; บัญชีเดิมไม่มีการส่งซ้ำอัตโนมัติ |
| API/CORS ไม่ผ่าน | AppOrigin ต้องเป็น origin จริง ไม่มี path หรือ `/` ท้าย และตรงกับ URL หน้าเว็บ |

## ขอบเขตทางเทคนิคของรอบนี้

- `GET /api/v1/admin/leads/{id}`: founder เท่านั้น อ่านบรีฟและลิงก์โปรเจกต์แบบ strongly consistent
- `PATCH` เส้นทางเดียวกัน: `{status}` **หรือ** `{followUp:{note,priority,followUpDate}}` พร้อม `If-Match` ใช้ version เดียวกัน ป้องกันโน้ตชนกับการเปลี่ยนสถานะ
- follow-up จำกัดโน้ต 5,000 ตัวอักษร ตรวจวันที่ตามปฏิทิน และไม่รับ `updatedAt` จาก browser; server ใส่เอง
- การเขียน status/follow-up ตรวจ active founder grant ใน transaction เดียวกับข้อมูลและ audit; audit ไม่เก็บเนื้อหาโน้ต
- frontend ตรวจ schema ของ CRM responses, แยกสิทธิ์ admin/customer, เก็บร่างเมื่อเครือข่ายขัดข้อง และล้างเนื้อหาเมื่อได้รับ 401/403
- refresh token ใช้เฉพาะเมื่อ access token เหลือ ≤30 วินาที; คำขอพร้อมกันใช้ refresh เดียวต่อแท็บ, ไม่มี iframe fallback และ logout รอ refresh ก่อน revoke/remove session
- ยังไม่มีการแจ้งเตือนนัดนอกหน้าเว็บ, อัปโหลดไฟล์, ใบเสนอราคา/การชำระเงินจริง หรือหลักฐานทดสอบ AWS end-to-end ในรอบนี้

อ้างอิง implementation: [Cognito token endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html), [AdminCreateUser](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminCreateUser.html), [DynamoDB transactions](https://docs.aws.amazon.com/cli/latest/reference/dynamodb/transact-write-items.html), [oidc-client-ts UserManager](https://authts.github.io/oidc-client-ts/classes/UserManager.html). เอกสารอ้างอิงไม่ใช่หลักฐานว่า deploy แล้ว
