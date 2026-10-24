# เปิดระบบแอดมินด้วย AWS CloudShell

ใช้สำหรับเปิดระบบครั้งแรกของเว็บ **https://main.d3uhwi8blbgrci.amplifyapp.com** เท่านั้น ตัวช่วยอยู่บน GitHub `main` แล้ว แต่การมีตัวช่วยไม่ได้หมายความว่า backend หรือบัญชีของคุณถูกสร้างแล้ว ต้องรันใน AWS ของคุณก่อน

## คุณต้องทำอะไร

1. ลงชื่อเข้า [AWS Console](https://console.aws.amazon.com/amplify/home) ด้วยบัญชีที่ดูแลเว็บนี้ เปิด Amplify app **d3uhwi8blbgrci** แล้วจำ **Region ที่แสดงมุมขวาบน** ไม่ต้องเดาว่าเป็น Singapore
2. เปิด **CloudShell** (ไอคอน `>_` ใน Console) ใน region เดียวกัน รอจนพิมพ์คำสั่งได้ ใช้ CloudShell ปกติที่เชื่อมอินเทอร์เน็ตได้
3. วางคำสั่งนี้สำหรับครั้งแรก:

   ```bash
   git clone --branch main --single-branch https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO.git
   cd AZELVORI-STUDIO
   bash scripts/cloudshell-activate.sh
   ```

   ถ้ามีโฟลเดอร์จากครั้งก่อนแล้ว ไม่ต้อง clone ซ้ำ ใช้:

   ```bash
   cd ~/AZELVORI-STUDIO
   git pull --ff-only origin main
   bash scripts/cloudshell-activate.sh
   ```

4. เมื่อถามอีเมล ให้ใส่ **อีเมลของคุณที่ต้องการใช้เป็นเจ้าของสตูดิโอ** ตรวจ Account, Region, app ID, branch `main`, URL และอีเมลในแผน แล้วพิมพ์ `DEPLOY` หากถูกต้อง ทรัพยากร AWS มีค่าใช้จ่ายตามการใช้งาน ตัวช่วยยังไม่ตั้ง budget หรือเพดานค่าใช้จ่าย
5. ถ้า CDK แสดงรายการ IAM changes และถาม `Do you wish to deploy these changes` ให้ตรวจว่าเป็น stack `Azelvori-staging` ของบัญชีนี้ แล้วพิมพ์ `y` รอจนขึ้น **เผยแพร่สำเร็จ** อย่าปิด CloudShell หรือแก้ environment variables ระหว่างทำงาน
6. ตรวจอีเมลคำเชิญจาก Cognito รวมโฟลเดอร์ Spam เปิด [เข้าสู่ระบบผู้ดูแล](https://main.d3uhwi8blbgrci.amplifyapp.com/admin/login) ใช้อีเมลและรหัสชั่วคราวจากคำเชิญ ตั้งรหัสผ่านส่วนตัวและ Authenticator ตามหน้า Cognito เก็บรหัสและ OTP ไว้กับคุณเท่านั้น
7. เปิด [ตรวจความพร้อม](https://main.d3uhwi8blbgrci.amplifyapp.com/admin/setup) กดทดสอบ API แล้วเข้า [คิวบรีฟ](https://main.d3uhwi8blbgrci.amplifyapp.com/admin) และ [โปรเจกต์](https://main.d3uhwi8blbgrci.amplifyapp.com/admin/projects) บัญชีใหม่อาจยังไม่มีบรีฟ คิวว่างไม่ได้แปลว่าระบบเสีย

CloudShell ใช้สิทธิ์ของบัญชีที่ลงชื่อเข้า Console อยู่แล้ว **ไม่ต้องสร้างหรือส่ง Access Key มาในแชต** ต้องมีสิทธิ์ deploy ขององค์กรอยู่ก่อน หากเจอ AccessDenied ให้ผู้ดูแล AWS เพิ่มเฉพาะสิทธิ์ที่ขาดตาม error ไม่ต้องสร้าง IAM user ใหม่เพื่อเลี่ยงข้อจำกัด

## ตัวช่วยทำอะไรให้

- ตรวจ AWS account/region, repository, Amplify app และ branch ให้ตรงเป้าหมาย ก่อนแสดงแผน
- เตรียม Node.js ≥22.14 และติดตั้ง dependencies ตาม lockfile หาก Node เก่า จะใช้ Node 22 จาก `nodejs.org` พร้อมตรวจ SHA-256 ในโฟลเดอร์ชั่วคราวสำหรับคำสั่งนี้ ไม่แก้ shell profile
- ถ้ายังไม่มี backend: ตรวจ Lambda quota, สร้าง CDKToolkit เมื่อจำเป็น แล้ว deploy `Azelvori-staging` (API, Cognito, DynamoDB 2 ตาราง, logs, roles และ alarm) CDKToolkit มี bucket/roles สำหรับ deploy ด้วย ถ้า unreserved quota ≥105 จะจองพร้อมกัน 5 งาน; ถ้ามี 1–104 จะเลือก `lambdaConcurrency: shared` ใช้โควตาส่วนกลางที่มีอยู่ เพื่อให้เริ่มทดสอบแอดมินได้โดยไม่ต้องรอเพิ่ม quota
- ถ้ามี backend แล้ว: ใช้เฉพาะ stack ที่ตรงกับเว็บและยังปิดรับบรีฟ **ไม่ deploy ทับ stack เดิม** รุ่นเก่าที่ไม่มี `IntakeEnabled` output ต้องอัปเดตตาม [คู่มือเดิม](17_ADMIN_ACTIVATION.md) ด้วย context เดิมก่อน
- ตรวจ public API `/health` ว่ารองรับ CRM และ private workspace จากนั้นสร้าง/ตรวจบัญชีเจ้าของและสิทธิ์จริง พร้อม audit ในฐานข้อมูล
- เติม public identifiers 6 ค่าเฉพาะ Amplify branch `main` โดยรักษาตัวแปรอื่น ไม่แสดงค่าลับที่มีอยู่ และอ่านตรวจหลังบันทึก
- เริ่ม Amplify `RELEASE` และรอผลประมาณ 20 นาที (อาจนานกว่านี้เมื่อ AWS ตอบช้า) แจ้งสำเร็จเฉพาะเมื่อ AWS รายงาน `SUCCEED` หากหมดเวลารอ job ยังอาจทำงานอยู่

การ deploy, สร้างผู้ใช้ และเผยแพร่เว็บอยู่คนละบริการ จึงไม่ใช่ transaction เดียว หากหยุดกลางทางจะไม่ลบข้อมูลย้อนกลับ รันใหม่หลังแก้สาเหตุได้ บัญชีที่มีสิทธิ์ถูกต้องแล้วไม่ถูกเชิญซ้ำ ไม่คืนสิทธิ์ให้บัญชีที่ถูกถอน และอาจเริ่ม frontend build ใหม่หนึ่งครั้ง ตัวช่วยไม่ resend รหัสชั่วคราวที่หมดอายุ

## ตรวจอย่างเดียว / แก้ปัญหา

```bash
# เตรียมเครื่องและตรวจ AWS โดยไม่สร้างทรัพยากร/ผู้ใช้/แก้ Amplify
bash scripts/cloudshell-activate.sh --check

# หาก CLI ไม่ได้อ่าน region จาก CloudShell ให้แทน YOUR_REGION ด้วย region จริง
bash scripts/cloudshell-activate.sh --region YOUR_REGION
```

| ข้อความ/อาการ | ทำต่ออย่างไร |
|---|---|
| App ไม่พบ / ResourceNotFound / เป้าหมายไม่ตรง | กลับ Amplify ตรวจบัญชีและ region ของ app `d3uhwi8blbgrci` แล้วเปิด CloudShell ใน region นั้น |
| AccessDenied / Unauthorized | ให้ผู้ดูแล AWS ตรวจสิทธิ์ของ Console session นี้ตามบริการที่ปฏิเสธ |
| รุ่นเก่าขึ้น Lambda concurrency ไม่พอสำหรับจอง 5 | ในโฟลเดอร์ AZELVORI-STUDIO รัน `git pull --ff-only origin main` แล้ว `bash scripts/cloudshell-activate.sh` ใหม่ รุ่นปัจจุบันรองรับโควตา 1–104 ด้วยโหมด shared สำหรับ staging ที่ปิดรับบรีฟ |
| อ่าน Lambda quota ไม่ได้ / quota เป็น 0 | ตรวจ Lambda GetAccountSettings และสิทธิ์ของ region นี้ก่อน; ตัวช่วยไม่เดา quota ถ้าไม่มีโควตาที่ใช้ได้ต้องติดต่อผู้ดูแล AWS/Service Quotas |
| main กำลัง build | รอ job เดิมจบใน Amplify แล้วรันคำสั่งเดิม |
| มีค่าของระบบอื่น / IntakeEnabled output ขาด | หยุดตรวจ backend ที่ใช้อยู่ก่อน ตัวช่วยไม่เปลี่ยนปลายทางเดิมหรือปิดรับงานให้เอง |
| CloudFormation ROLLBACK / UPDATE_IN_PROGRESS | เปิด stack → Events ดูสาเหตุหรือรอจนจบ ไม่ลบตารางหรือ stack เพื่อแก้โดยเดา |
| CDK bootstrap เก่า / SSM bootstrap version ไม่พบ | ให้ผู้ดูแลตรวจ/อัปเกรด CDKToolkit ในบัญชีและ region เดิมก่อน ตัวช่วยไม่อัปเกรด bootstrap เดิมอัตโนมัติ |
| รุ่นเก่าขึ้น `Cognito principal is disabled, incomplete...` | ดึง `main` ล่าสุดแล้วรันตัวช่วยด้วยอีเมลเดิม ดูหัวข้อกู้ขั้นตอนบัญชีด้านล่าง รุ่นเก่าตรวจ `sub` เป็น RFC UUID เข้มเกินข้อกำหนดของ Cognito; ข้อความเดิมไม่สามารถแยกได้ว่าบัญชีถูกปิดหรือเป็นปัญหารูปแบบ ID |
| `COGNITO_SUB_MISSING` / `COGNITO_EMAIL_MISMATCH` | ตรวจบัญชีใน Cognito user pool ของ stack เดิมว่ามี sub และอีเมลตรงกับที่ใส่ ไม่ใช้ Username/อีเมลแทน sub และไม่แก้สิทธิ์ในฐานข้อมูลเอง |
| `COGNITO_NOT_ENABLED` / `COGNITO_STATUS_NOT_READY` | ตรวจสถานะบัญชีใน Cognito ต้อง Enabled และเป็น CONFIRMED หรือ FORCE_CHANGE_PASSWORD ตัวช่วยไม่เปิดบัญชีที่ถูกปิดหรือเปลี่ยนสถานะให้เอง |
| Amplify FAILED | เปิด job ID ที่แสดง ดู Build logs แก้สาเหตุแล้วรันใหม่ การสร้าง backend/บัญชีที่สำเร็จแล้วจะยังอยู่ |
| หมดเวลารอ Amplify | ดู job ID ใน Console ถ้าสำเร็จแล้วให้เปิดหน้าแอดมิน ถ้ายังรันให้รอ ไม่กด deploy ซ้ำ |
| อีเมลไม่มา / รหัสชั่วคราวหมดอายุ | ตรวจอีเมลและ Spam, Cognito delivery status แล้วให้ผู้ดูแลส่งคำเชิญใหม่จาก user pool เดิม |
| พื้นที่ CloudShell เต็ม / ดาวน์โหลด Node ไม่สำเร็จ | ตรวจพื้นที่และเครือข่ายของ CloudShell ก่อนรันใหม่ ตัวช่วยใช้พื้นที่ชั่วคราวสำหรับ Node/cache ไม่ลบไฟล์ส่วนตัว |
| ลงชื่อเข้าได้แต่ไม่ใช่ผู้ดูแล | ตรวจว่าใช้อีเมลเดียวกับแผน ตรวจ staff grant ตามคู่มือ; อย่าแก้ Cognito sub เองโดยเดา |

สิทธิ์ที่ใช้เพิ่มจาก `admin:setup`: อ่าน Amplify app/branch/job, `amplify:UpdateBranch`, `StartJob`, CloudFormation DescribeStacks, Lambda GetAccountSettings และสิทธิ์ CDK bootstrap/deploy ตามทรัพยากรใน template การใช้ helper ไม่เพิ่มสิทธิ์ของ Console user เอง

## รันต่อเมื่อสร้าง backend แล้ว แต่หยุดตอนให้สิทธิ์แอดมิน

ภาพ CloudShell ที่เจ้าของส่งเมื่อ 24 ตุลาคม 2026 แสดงว่า `Azelvori-staging` deploy สำเร็จใน `ap-southeast-2`, API ผ่านการตรวจของตัวช่วย, `LambdaConcurrencyMode=shared` และ `IntakeEnabled=false` แต่หยุดที่การตรวจบัญชี Cognito ก่อนเขียน grant และเชื่อม Amplify จึงยังไม่ยืนยันว่าเปิดแอดมินได้แล้ว

พบข้อผิดพลาดใน source เดิม: บังคับ `sub` เป็น RFC UUID ทั้งที่ [AWS ระบุว่า Cognito ใช้รูปแบบเฉพาะและไม่ควรตรวจ UUID อย่างเข้มงวด](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html) รุ่นปัจจุบันใช้ `sub` ที่อ่านผ่าน AdminGetUser เป็นรหัสอ้างอิงโดยเก็บค่าเดิมทุกตัวอักษร ตรวจอีเมล/Enabled/สถานะ และอ่านบัญชีจริงอีกครั้งหลัง AdminCreateUser ก่อนเขียน grant ภาพ error เดิมไม่เปิดเผย sub หรือเหตุที่ไม่ผ่านแต่ละข้อ จึงยังต้องตรวจผลการรันรุ่นแก้ไขจริง

ใน CloudShell โฟลเดอร์เดิม รัน:

```bash
git pull --ff-only origin main && bash scripts/cloudshell-activate.sh
```

ใส่อีเมลเดิม ตรวจว่าแผนแสดง `backend: REUSE`, region/app เดิม แล้วพิมพ์ `DEPLOY` ตัวช่วยจะตรวจบัญชีที่มีอยู่ ให้สิทธิ์และเชื่อม Amplify ต่อ โดยไม่ deploy backend ซ้ำหรือส่งคำเชิญซ้ำให้บัญชีเดิม รอ `เผยแพร่สำเร็จ` แล้วใช้คำเชิญเดิมลงชื่อเข้า `/admin/login` หากได้รหัส `COGNITO_...` ใหม่ ให้ตรวจสาเหตุเฉพาะตามตารางด้านบน ไม่ลบ stack หรือบัญชีเพื่อเริ่มใหม่

## หลังเข้าแอดมินได้แล้ว

เป้าหมายรอบนี้คือ **เปิดบัญชีผู้ดูแลและเชื่อมระบบจริงสำหรับทดสอบส่วนตัว** ตัวช่วยยังไม่เปิดรับบรีฟสาธารณะ ไม่ยืนยันข้อมูลธุรกิจ/นโยบายแทนเจ้าของ และไม่ส่งข้อความตอบลูกค้าอัตโนมัติ

ทดสอบ login/MFA, logout, เปิดหน้าใหม่และสิทธิ์ผู้ดูแลก่อน จากนั้นทำตาม [เริ่มรับบรีฟและคุมงาน](17_ADMIN_ACTIVATION.md#เริ่มรับบรีฟและคุมงาน): ยืนยันข้อมูลธุรกิจ/นโยบาย, budget/การแจ้งเตือน, backup และทดสอบข้อมูลสมมติครบวงจร ก่อนเปิด intake ทั้ง backend และ frontend

หากแผนเป็น `lambdaConcurrency: shared` จะใช้ pool ร่วมกับ Lambda อื่นในบัญชี/region และไม่รับประกันว่ามี capacity ว่างเสมอ ค่า API Gateway ต่อเส้นทางตั้งเป้า **2 คำขอ/วินาที, burst 5** แบบ best effort ไม่ใช่เพดาน concurrency หรือค่าใช้จ่าย โหมดนี้ใช้ได้เฉพาะ staging ที่ปิด intake; ก่อนเปิดรับบรีฟหรือ production ต้องมี quota พอจอง 5 โดยเหลือ unreserved 100 และ deploy ด้วย `-c lambdaConcurrency=reserved` พร้อม context เดิม ตัวช่วยเปิดครั้งแรกไม่เปลี่ยน stack เดิมให้อัตโนมัติ ดู [AWS reserved concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html) และ [HTTP API throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html)

การทดสอบอัตโนมัติของตัวช่วยใช้ AWS responses จำลองและ CDK synth ไม่ใช่หลักฐานว่า deploy หรือล็อกอินในบัญชี AWS จริงสำเร็จ ต้องตรวจผลจริงจาก CloudShell/Amplify และการเข้าใช้งานของคุณ

## ผลตรวจรุ่นเปิดระบบแรก — 24 ตุลาคม 2026

[GitHub Actions run 40052823650](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40052823650) บน source commit `6574a56248d9d922480de185bac7a6ae0c28a98b` ผ่านทั้งหมด:

- Unit/integration/operator tests **158 รายการ / 14 ไฟล์** รวมการหยุดเมื่อผิดบัญชี/แอป/branch/quota, ค่า env เปลี่ยนระหว่างยืนยัน, สิทธิ์ถูกถอน, health/build ล้มเหลว, timeout และการรันต่อโดยไม่เชิญผู้ใช้ซ้ำ
- Browser **140 กรณี**: public 60 + private workspace 80 บน Chromium/WebKit × 5 ขนาดจอ ผ่าน accessibility/overflow checks ที่กำหนดในชุดทดสอบ ตรวจภาพหน้า setup ขนาด 320×568 แล้ว
- Build/typecheck, hosting preflight, CDK synth และ dependency audit ผ่าน; audit รายงาน **0 vulnerabilities** ณ เวลาที่ตรวจ
- ตรวจ syntax ของ launcher และทดสอบ CLI แบบโต้ตอบ (ใส่อีเมล → อ่านแผน → ยกเลิก) กับ `--check` ผ่าน AWS CLI จำลอง ไม่มี cloud writes
- ตรวจเว็บ Amplify จริงแล้ว: หน้า setup แสดงคู่มือ CloudShell ใหม่ และหน้า login ยังแจ้งว่ายังไม่ได้เชื่อม Cognito/API จึงยังไม่อ้างว่าสร้างบัญชีหรือเปิดระบบจริงสำเร็จ

หลักฐาน CI artifact `12544201539` เก็บรายงาน/ภาพ/template ถึง **7 พฤศจิกายน 2026** ตาม retention ของ workflow; ไม่ใช่ backup ของข้อมูลธุรกิจ

อ้างอิงทางการ: [CloudShell และ credentials](https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html), [CloudShell software/พื้นที่](https://docs.aws.amazon.com/cloudshell/latest/userguide/vm-specs.html), [CDK bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html), [Amplify UpdateBranch](https://docs.aws.amazon.com/cli/latest/reference/amplify/update-branch.html), [Amplify StartJob](https://docs.aws.amazon.com/cli/latest/reference/amplify/start-job.html), [Node.js release checksums](https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt).


## ผลแก้กรณีโควตา Lambda ต่ำ — 24 ตุลาคม 2026

[CI run 40054843771](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40054843771) บน source `12b30b4715ce52e962a43b96c6b12a7dfdfdbd8e` ผ่าน **170 tests / 14 files + 140 browser cases** พร้อม build, CDK synth, hosting preflight และ audit 0 vulnerabilities

ทดสอบโควตาจำลอง 10/104 → shared, 105 → reserved, ปฏิเสธ quota ที่อ่านไม่ได้/เป็นศูนย์, ตรวจแผนใหม่เมื่อโหมดเปลี่ยน และใช้ stack shared เดิมโดยไม่ deploy ทับ ตรวจ template shared ที่ synth จริงแล้วว่าไม่มี ReservedConcurrentExecutions, intake ปิด, throttle ต่อเส้นทาง rate 2/burst 5 และ MFA/JWT ยังทำงานตามแบบเดิม การเปิด intake หรือ production ด้วย shared ถูกปฏิเสธ

ผลนี้ยืนยัน source และ template เท่านั้น; ยังต้องรันใน CloudShell และทดสอบบัญชี AWS จริงของเจ้าของ ไม่มีการสร้างทรัพยากรจริงจากสภาพแวดล้อมพัฒนารอบนี้
