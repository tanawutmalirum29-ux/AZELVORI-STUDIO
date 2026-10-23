import { newRequestId } from "../lib/id";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BUDGETS,
  BUDGET_LABELS,
  LeadSchema,
  LeadDetailsSchema,
  LeadTimingSchema,
  LeadReferencesSchema,
  PRIVACY_VERSION,
  SERVICE_LABELS,
  SERVICE_TYPES,
  type LeadInput,
  type LeadReceipt,
} from "@azelvori/contracts";
import { Icon } from "../components/Icon";
import { Notice } from "../components/Layout";
import { services } from "../lib/content";
import { ApiError, intakeEnabled, sendLead } from "../lib/api";
import {
  clearPreferences,
  exportBrief,
  loadPreferences,
  savePreferences,
} from "../lib/draft";

const steps = [
  "ประเภทงาน",
  "รายละเอียด",
  "งบและเวลา",
  "สิ่งอ้างอิง",
  "ตรวจสอบและส่ง",
];
function initialData(): LeadInput {
  const service = new URLSearchParams(location.search).get("service");
  return {
    serviceType: "WEBSITE",
    title: "",
    description: "",
    platform: "",
    engine: "",
    expected: "",
    actual: "",
    reproduction: "",
    severity: "MEDIUM",
    budget: "DISCUSS",
    timeline: "FLEXIBLE",
    targetDate: "",
    referenceUrl: "",
    contactName: "",
    contactEmail: "",
    privacyAcknowledged: false as unknown as true,
    privacyVersion: PRIVACY_VERSION,
    rightsConfirmed: false,
    website: "",
    ...loadPreferences(),
    ...(SERVICE_TYPES.includes(service as LeadInput["serviceType"])
      ? { serviceType: service as LeadInput["serviceType"] }
      : {}),
  };
}
export function Start() {
  const [data, setData] = useState<LeadInput>(initialData),
    [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [sending, setSending] = useState(false),
    [error, setError] = useState("");
  const [receipt, setReceipt] = useState<LeadReceipt | null>(null),
    [downloaded, setDownloaded] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    key = useRef(newRequestId()),
    submittedBody = useRef("");
  const submitLock = useRef(false);
  const set = <K extends keyof LeadInput>(field: K, value: LeadInput[K]) => {
    setData((d) => ({ ...d, [field]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[field];
      return next;
    });
    setError("");
  };
  useEffect(() => {
    savePreferences(data);
  }, [data.serviceType, data.budget]);
  useEffect(() => {
    if (step > 0) heading.current?.focus();
  }, [step]);
  function validation(final: boolean) {
    const schema = final
      ? LeadSchema
      : step === 1
        ? LeadDetailsSchema
        : step === 2
          ? LeadTimingSchema
          : step === 3
            ? LeadReferencesSchema
            : undefined;
    const result = schema?.safeParse(data);
    const issues = result && !result.success ? result.error.issues : [];
    const nextErrors = Object.fromEntries(
      issues.map((i) => [i.path.join("."), i.message]),
    );
    if (
      (final || step === 2) &&
      data.timeline === "SPECIFIC" &&
      data.targetDate &&
      data.targetDate <
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
    )
      nextErrors.targetDate = "เลือกวันนี้หรือวันในอนาคต";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setTimeout(
        () =>
          document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        0,
      );
      return false;
    }
    return true;
  }
  async function submit() {
    if (submitLock.current || !validation(true)) return;
    if (!intakeEnabled) {
      exportBrief(data);
      setDownloaded(true);
      return;
    }
    submitLock.current = true;
    setSending(true);
    setError("");
    const body = JSON.stringify(data);
    if (submittedBody.current && submittedBody.current !== body)
      key.current = newRequestId();
    submittedBody.current = body;
    try {
      const result = await sendLead(data, key.current);
      setReceipt(result);
      clearPreferences();
      window.scrollTo(0, 0);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "เชื่อมต่อไม่สำเร็จ ข้อมูลยังอยู่ในหน้านี้ กดส่งอีกครั้งได้",
      );
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
    } finally {
      submitLock.current = false;
      setSending(false);
    }
  }
  function field(
    name: keyof LeadInput,
    label: string,
    placeholder: string,
    options: { area?: boolean; type?: string; optional?: boolean } = {},
  ) {
    const shared = {
      id: name,
      name,
      value: String(data[name] ?? ""),
      placeholder,
      "aria-invalid": !!errors[name],
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => set(name, e.target.value as never),
    };
    return (
      <label className="field" key={name} htmlFor={name}>
        <span>
          {label}
          {options.optional ? (
            <small> ไม่บังคับ</small>
          ) : (
            <b aria-hidden="true"> *</b>
          )}
        </span>
        {options.area ? (
          <textarea
            {...shared}
            rows={name === "description" ? 5 : 3}
            maxLength={name === "description" ? 5000 : 3000}
          />
        ) : (
          <input
            {...shared}
            type={options.type ?? "text"}
            autoComplete={
              name === "contactEmail"
                ? "email"
                : name === "contactName"
                  ? "name"
                  : "off"
            }
            maxLength={name === "referenceUrl" ? 1000 : 200}
          />
        )}
        {errors[name] && (
          <small className="field-error" id={`${name}-error`}>
            {errors[name]}
          </small>
        )}
      </label>
    );
  }
  if (receipt)
    return (
      <div className="container receipt-page">
        <span className="success-seal">
          <Icon name="check" size={36} />
        </span>
        <span className="eyebrow">BRIEF RECEIVED</span>
        <h1>ได้รับบรีฟของคุณแล้ว</h1>
        <p>
          บันทึกข้อมูลเรียบร้อยแล้ว โปรดเก็บเลขอ้างอิงนี้ไว้ติดตามงาน
          <br />
          การส่งบรีฟยังไม่ใช่การยืนยันราคา หรือเริ่มสัญญา
        </p>
        <div className="receipt-code">{receipt.leadId}</div>
        <p className="muted">
          {new Date(receipt.receivedAt).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
          })}{" "}
          (เวลาไทย)
        </p>
        <button className="button" onClick={() => exportBrief(data, receipt)}>
          ดาวน์โหลดสำเนาบรีฟ <Icon name="download" />
        </button>
        <a href="/" className="text-link">
          กลับหน้าแรก <Icon name="arrow" />
        </a>
      </div>
    );
  return (
    <div className="container wizard-page">
      <div className="wizard-intro">
        <a href="/" className="back-link">
          <Icon name="back" size={16} /> กลับหน้าสตูดิโอ
        </a>
        <span className="eyebrow">LET’S BUILD SOMETHING</span>
        <h1>
          โปรเจกต์ใหม่
          <br />
          <span className="muted">เริ่มจากบรีฟที่ดี</span>
        </h1>
        <p>
          เล่าให้เราฟังว่าคุณอยากสร้างอะไร
          <br />
          เราใช้ข้อมูลนี้เพื่อเข้าใจงานและวางขอบเขต
        </p>
        <ol className="step-list">
          {steps.map((s, i) => (
            <li
              key={s}
              className={i === step ? "active" : i < step ? "complete" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span>
                {i < step ? <Icon name="check" size={14} /> : `0${i + 1}`}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <div className="wizard-side-note">
          <Icon name="lock" size={18} />
          <p>ไม่ต้องใส่รหัสผ่าน คีย์ API หรือข้อมูลส่วนบุคคลของผู้อื่น</p>
        </div>
      </div>
      <div className="wizard-panel">
        <div
          className="wizard-progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={step + 1}
          aria-label={`ขั้นตอน ${step + 1} จาก 5`}
        >
          <span style={{ width: `${(step + 1) * 20}%` }} />
        </div>
        <div className="wizard-panel-body">
          {!intakeEnabled && (
            <Notice>
              <strong>พรีวิวระบบรับบรีฟ</strong> ยังไม่ส่งข้อมูลถึงสตูดิโอ
              เมื่อกรอกครบสามารถดาวน์โหลดร่างเก็บไว้ได้
            </Notice>
          )}
          <span className="eyebrow">STEP 0{step + 1} / 05</span>
          <h2 ref={heading} tabIndex={-1}>
            {
              [
                "อยากให้เราช่วยเรื่องอะไร?",
                "เล่าโจทย์ของคุณ",
                "วางกรอบให้ตรงกัน",
                "สิ่งอ้างอิงและสิทธิ์ในงาน",
                "อีกนิดเดียว พร้อมตรวจบรีฟ",
              ][step]
            }
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 4) {
                if (validation(false)) setStep(step + 1);
              } else void submit();
            }}
            noValidate
          >
            {step === 0 && (
              <>
                <p className="form-description">
                  เลือกบริการหลักก่อน รายละเอียดเพิ่มเติมค่อยคุยกันได้
                </p>
                <div
                  className="service-options"
                  role="radiogroup"
                  aria-label="ประเภทงาน"
                >
                  {services.map((s) => (
                    <label
                      className={`service-option ${data.serviceType === s.id ? "selected" : ""}`}
                      key={s.id}
                    >
                      <input
                        type="radio"
                        name="serviceType"
                        value={s.id}
                        checked={data.serviceType === s.id}
                        onChange={() => set("serviceType", s.id)}
                      />
                      <Icon name={s.icon} size={24} />
                      <span>
                        <strong>{SERVICE_LABELS[s.id]}</strong>
                        <small>{s.tags.slice(0, 2).join(" · ")}</small>
                      </span>
                      <span className="radio-indicator" />
                    </label>
                  ))}
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <p className="form-description">
                  {SERVICE_LABELS[data.serviceType]} — ยิ่งบรีฟชัด
                  ยิ่งประเมินได้ตรงจุด
                </p>
                {field(
                  "title",
                  "ชื่อหรือหัวข้อโปรเจกต์",
                  "เช่น เว็บไซต์สำหรับสตูดิโอออกแบบ",
                )}
                {field(
                  "description",
                  "เป้าหมายและรายละเอียด",
                  "อยากทำอะไร ใครเป็นคนใช้ มีฟีเจอร์สำคัญหรือข้อจำกัดอะไรบ้าง",
                  { area: true },
                )}
                {field(
                  "platform",
                  "แพลตฟอร์มและอุปกรณ์เป้าหมาย",
                  "เช่น เว็บไซต์ รองรับมือถือ Android และ iPhone",
                )}
                {(data.serviceType === "GAME_NEW" ||
                  data.serviceType === "GAME_BUGFIX") &&
                  field(
                    "engine",
                    "เอนจินและเวอร์ชัน",
                    "เช่น Godot 4.x, Unity หรือขอให้ช่วยแนะนำ",
                  )}
                {data.serviceType === "GAME_BUGFIX" && (
                  <div className="conditional-fields">
                    <h3>
                      <Icon name="bug" /> ข้อมูลสำหรับทำซ้ำบั๊ก
                    </h3>
                    {field(
                      "expected",
                      "สิ่งที่ควรเกิดขึ้น",
                      "เช่น ตัวละครควรโจมตีเมื่อกดปุ่ม",
                      { area: true },
                    )}
                    {field(
                      "actual",
                      "อาการที่เกิดขึ้นจริง",
                      "เช่น เกมค้างหลังจากกดโจมตีครั้งที่ 2",
                      { area: true },
                    )}
                    {field(
                      "reproduction",
                      "ขั้นตอนทำซ้ำและสภาพแวดล้อม",
                      "1. เปิดเกมบน...\n2. ไปที่...\n3. กด...",
                      { area: true },
                    )}
                    <Choice
                      title="ระดับผลกระทบ"
                      name="severity"
                      value={data.severity ?? "MEDIUM"}
                      options={[
                        ["LOW", "เล็กน้อย"],
                        ["MEDIUM", "บางส่วนใช้งานไม่ได้"],
                        ["HIGH", "ฟีเจอร์หลักเสีย"],
                        ["CRITICAL", "ระบบหยุดทำงาน"],
                      ]}
                      onChange={(v) =>
                        set("severity", v as LeadInput["severity"])
                      }
                    />
                  </div>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <p className="form-description">
                  ข้อมูลนี้ใช้วางแผน ยังไม่ใช่ราคาหรือกำหนดส่งที่ยืนยันแล้ว
                </p>
                <Choice
                  title="งบประมาณที่เตรียมไว้"
                  name="budget"
                  value={data.budget}
                  options={BUDGETS.map((b) => [b, BUDGET_LABELS[b]])}
                  onChange={(v) => set("budget", v as LeadInput["budget"])}
                />
                <Choice
                  title="ช่วงเวลาที่อยากใช้งาน"
                  name="timeline"
                  value={data.timeline}
                  options={[
                    ["FLEXIBLE", "ยืดหยุ่นได้ ขอวางแผนร่วมกัน"],
                    ["ONE_MONTH", "ภายในประมาณ 1 เดือน"],
                    ["THREE_MONTHS", "ภายในประมาณ 3 เดือน"],
                    ["SPECIFIC", "มีวันที่ต้องการใช้งาน"],
                  ]}
                  onChange={(v) => set("timeline", v as LeadInput["timeline"])}
                />
                {data.timeline === "SPECIFIC" &&
                  field("targetDate", "วันที่ต้องการใช้งาน", "", {
                    type: "date",
                  })}
                <p className="small-note">
                  หากเวลาและขอบเขตไม่สอดคล้องกัน เราจะเสนอการแบ่งเฟสก่อนตกลงงาน
                </p>
              </>
            )}
            {step === 3 && (
              <>
                <p className="form-description">
                  มีตัวอย่างสไตล์ เว็บไซต์ หรือเกมที่ชอบไหม?
                </p>
                {field(
                  "referenceUrl",
                  "ลิงก์อ้างอิงสาธารณะ",
                  "https://example.com",
                  { type: "url", optional: true },
                )}
                <div className="upload-later">
                  <Icon name="folder" size={30} />
                  <h3>ส่งไฟล์อย่างปลอดภัยหลังเปิดโปรเจกต์</h3>
                  <p>
                    รอบนี้ยังไม่รับไฟล์แนบ
                    ระบบไฟล์ส่วนตัวและตรวจไฟล์ก่อนดาวน์โหลดจะเปิดในเฟสถัดไป
                  </p>
                  <span>ไม่ควรแนบลิงก์ที่มีรหัสผ่านหรือคีย์ลับ</span>
                </div>
                <CheckField
                  name="rightsConfirmed"
                  checked={data.rightsConfirmed}
                  onChange={(v) => set("rightsConfirmed", v)}
                  error={errors.rightsConfirmed}
                >
                  ฉันมีสิทธิ์ใช้งานเนื้อหา โค้ด และทรัพย์สินที่จะส่งให้พัฒนา
                  หรือจะระบุข้อจำกัดก่อนเริ่มงาน
                </CheckField>
              </>
            )}
            {step === 4 && (
              <>
                <div className="brief-summary">
                  <div>
                    <span>บริการ</span>
                    <strong>{SERVICE_LABELS[data.serviceType]}</strong>
                  </div>
                  <div>
                    <span>โปรเจกต์</span>
                    <strong>{data.title}</strong>
                  </div>
                  <div>
                    <span>งบที่เตรียมไว้</span>
                    <strong>{BUDGET_LABELS[data.budget]}</strong>
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setStep(1)}
                  >
                    แก้ไขรายละเอียด <Icon name="back" size={14} />
                  </button>
                </div>
                {field(
                  "contactName",
                  "ชื่อที่ให้เรียก",
                  "ชื่อของคุณหรือชื่อทีม",
                )}
                {field("contactEmail", "อีเมลติดต่อ", "you@example.com", {
                  type: "email",
                })}
                <div className="honeypot" aria-hidden="true">
                  <label htmlFor="website">
                    Website
                    <input
                      id="website"
                      tabIndex={-1}
                      value={data.website}
                      onChange={(e) => set("website", e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                </div>
                <CheckField
                  name="privacyAcknowledged"
                  checked={!!data.privacyAcknowledged}
                  onChange={(v) => set("privacyAcknowledged", v as true)}
                  error={errors.privacyAcknowledged}
                >
                  ฉันอ่านและรับทราบ{" "}
                  <a href="/privacy" target="_blank" rel="noopener">
                    รายละเอียดการใช้ข้อมูล{" "}
                    <span className="sr-only">(เปิดแท็บใหม่)</span>
                  </a>{" "}
                  เพื่อประเมินและติดต่อเกี่ยวกับบรีฟนี้
                </CheckField>
                <p className="small-note">
                  ไม่มีการสมัครรับข่าวสาร และไม่มีการเรียกเก็บเงินจากขั้นตอนนี้
                </p>
              </>
            )}
            {error && <Notice kind="error">{error}</Notice>}
            {downloaded && (
              <Notice kind="success">
                ดาวน์โหลดร่างแล้ว — ข้อมูลยังไม่ได้ส่งถึงสตูดิโอ
                ไฟล์มีข้อมูลติดต่อของคุณ โปรดเก็บไว้ส่วนตัว
              </Notice>
            )}
            {Object.keys(errors).some(
              (k) =>
                ![
                  "contactName",
                  "contactEmail",
                  "privacyAcknowledged",
                ].includes(k),
            ) &&
              step === 4 && (
                <Notice kind="error">
                  ข้อมูลในขั้นตอนก่อนหน้ายังไม่ครบ{" "}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setStep(1)}
                  >
                    กลับไปตรวจสอบ
                  </button>
                </Notice>
              )}
            <div className="wizard-actions">
              {step > 0 ? (
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setStep(step - 1)}
                  disabled={sending}
                >
                  <Icon name="back" size={16} /> ย้อนกลับ
                </button>
              ) : (
                <span className="small-note">01 / 05</span>
              )}
              <button type="submit" className="button" disabled={sending}>
                {sending
                  ? "กำลังส่งบรีฟ…"
                  : step === 4
                    ? intakeEnabled
                      ? "ส่งบรีฟให้สตูดิโอ"
                      : "ดาวน์โหลดร่างบรีฟ"
                    : "ขั้นตอนถัดไป"}
                <Icon
                  name={step === 4 && !intakeEnabled ? "download" : "arrow"}
                  size={18}
                />
              </button>
            </div>
          </form>
          <p className="draft-note">
            บันทึกเฉพาะประเภทงานและช่วงงบบนอุปกรณ์ 7 วัน
            ข้อความและข้อมูลติดต่อจะหายเมื่อปิดหรือรีเฟรชหน้านี้
          </p>
        </div>
      </div>
    </div>
  );
}
function Choice({
  title,
  name,
  value,
  options,
  onChange,
}: {
  title: string;
  name: string;
  value: string;
  options: readonly (readonly string[])[];
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{title}</legend>
      {options.map(([id, label]) => (
        <label key={id} className={value === id ? "choice selected" : "choice"}>
          <input
            type="radio"
            name={name}
            value={id}
            checked={value === id}
            onChange={() => onChange(id)}
          />
          <span className="radio-indicator" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
function CheckField({
  name,
  checked,
  onChange,
  error,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="check-field">
        <input
          id={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
