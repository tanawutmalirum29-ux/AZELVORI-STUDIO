import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Notice, PageIntro } from "../components/Layout";
import { FirstPartyLogin } from "../components/FirstPartyLogin";
import {
  authConfigured,
  finishLogin,
  LoginCallbackError,
  type LoginDestination,
} from "../lib/auth";

export function Login() {
  return (
    <div className="container login-page first-party-shell">
      <div className="login-story">
        <span className="eyebrow">AZELVORI / YOUR PRIVATE SPACE</span>
        <h1>สร้างสิ่งที่เป็นไปได้<br /><span className="accent">ไปด้วยกัน</span></h1>
        <p>ติดตามงาน ตรวจรับความคืบหน้า และสนทนากับสตูดิโอ
          ในพื้นที่ที่ออกแบบเพื่อโปรเจกต์ของคุณโดยเฉพาะ</p>
        <ul>
          {["แชทและติดตามงานอย่างเป็นส่วนตัว", "ตรวจรับผลงานตามขั้นตอน", "ทุกอย่างรวมอยู่ในพื้นที่เดียว"].map((text) => (
            <li key={text}><Icon name="check" />{text}</li>
          ))}
        </ul>
        <a className="text-link" href="/demo">สำรวจพอร์ทัลตัวอย่าง <Icon name="arrow" /></a>
      </div>
      <FirstPartyLogin mode="app" />
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
