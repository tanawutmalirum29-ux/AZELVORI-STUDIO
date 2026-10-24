import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Notice, PageIntro } from "../components/Layout";
import {
  authConfigured,
  finishLogin,
  LoginCallbackError,
  signIn,
  type LoginDestination,
} from "../lib/auth";

export function Login() {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function login(destination: "app" | "admin") {
    setPending(true);
    try {
      await signIn(destination);
    } catch {
      setError("เปิดหน้าลงชื่อเข้าใช้ไม่ได้ กรุณาลองใหม่");
      setPending(false);
    }
  }
  return (
    <div className="container login-page">
      <div className="login-story">
        <span className="eyebrow">YOUR OWN SPACE</span>
        <h1>
          พื้นที่ของคุณ
          <br />
          <span className="accent">สำหรับทุกขั้นตอน</span>
        </h1>
        <p>
          ติดตามโปรเจกต์ ตรวจงาน และคุยรายละเอียด
          <br />
          ในพื้นที่ที่ออกแบบมาสำหรับงานของคุณ
        </p>
        <ul>
          {[
            "เห็นสถานะและสิ่งที่ต้องตรวจรับ",
            "ข้อมูลแยกตามโปรเจกต์",
            "เริ่มจากคำเชิญของสตูดิโอ",
          ].map((t) => (
            <li key={t}>
              <Icon name="check" />
              {t}
            </li>
          ))}
        </ul>
        <a className="text-link" href="/demo">
          สำรวจพอร์ทัลตัวอย่าง <Icon name="arrow" />
        </a>
      </div>
      <div className="login-card">
        <span className="service-icon">
          <Icon name="lock" size={27} />
        </span>
        <h2>ยินดีต้อนรับกลับ</h2>
        <p>เข้าสู่ระบบด้วยบัญชีที่ได้รับเชิญ</p>
        {!authConfigured && (
          <Notice>
            ยังไม่เปิดระบบบัญชีจริง
            คุณสามารถดูหน้าตาพอร์ทัลตัวอย่างได้โดยไม่ต้องลงทะเบียน
          </Notice>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <button
          className="button full"
          disabled={!authConfigured || pending}
          onClick={() => void login("app")}
        >
          เข้าสู่พื้นที่ลูกค้า <Icon name="arrow" />
        </button>
        <a className="button secondary full" href="/demo">
          ทดลองดูพอร์ทัล
        </a>
        <a className="text-link admin-login" href="/admin/login">
          เข้าสู่ระบบผู้ดูแล
        </a>
        <p className="small-note">
          การตั้งรหัสผ่านและกู้คืนบัญชีทำผ่านหน้าลงชื่อเข้าใช้ของ Amazon Cognito
        </p>
      </div>
    </div>
  );
}
export function Callback() {
  const [error, setError] = useState("");
  const [destination, setDestination] = useState<LoginDestination>();
  useEffect(() => {
    let active = true;
    if (!authConfigured) {
      setError("ยังไม่ได้ตั้งค่าระบบบัญชี");
      return;
    }
    void finishLogin()
      .then((target) => {
        if (active) setDestination(target);
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof LoginCallbackError
              ? e.message
              : "ยืนยันการเข้าสู่ระบบไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (destination) {
      // Render success and a usable link before attempting automatic navigation.
      // A slow/blocked document navigation must not leave a false loading screen.
      try {
        location.replace(destination);
      } catch {
        // The manual continuation link remains available.
      }
    }
  }, [destination]);
  return (
    <div className="container status-page">
      <PageIntro
        eyebrow="ACCOUNT"
        title={
          error
            ? "เข้าสู่ระบบไม่สำเร็จ"
            : destination
              ? "ยืนยันบัญชีแล้ว"
              : "กำลังยืนยันบัญชี…"
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {destination ? (
        <>
          <p role="status">
            กำลังเปิดพื้นที่ของคุณ หากหน้าไม่เปลี่ยน กดปุ่มด้านล่าง
          </p>
          <a href={destination} className="button">
            {destination === "/admin"
              ? "เปิดหน้าแอดมิน"
              : destination === "/invite"
                ? "เปิดคำเชิญ"
                : "เปิดพื้นที่ลูกค้า"}
          </a>
        </>
      ) : (
        <>
          {!error && (
            <p role="status">
              กำลังรับผลการเข้าสู่ระบบ ขั้นตอนนี้ใช้เวลาไม่เกินประมาณ 20 วินาที
            </p>
          )}
          <div className="button-row">
            <a href="/admin/login" className="button secondary">
              เข้าสู่ระบบผู้ดูแลอีกครั้ง
            </a>
            <a href="/login" className="button secondary">
              กลับหน้าเข้าสู่ระบบลูกค้า
            </a>
          </div>
          <p className="small-note">
            ทำต่อในแท็บเดิม ไม่ต้องเปลี่ยนรหัสผ่านใหม่
          </p>
        </>
      )}
    </div>
  );
}
