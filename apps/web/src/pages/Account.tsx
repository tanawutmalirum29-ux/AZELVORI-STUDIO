import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Notice, PageIntro } from "../components/Layout";
import { authConfigured, finishLogin, signIn } from "../lib/auth";

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
  useEffect(() => {
    if (!authConfigured) {
      setError("ยังไม่ได้ตั้งค่าระบบบัญชี");
      return;
    }
    void finishLogin().catch(() => {
      history.replaceState(null, "", "/auth/callback");
      setError("ยืนยันการเข้าสู่ระบบไม่สำเร็จ ลิงก์อาจหมดอายุ กรุณาเริ่มใหม่");
    });
  }, []);
  return (
    <div className="container status-page">
      <PageIntro
        eyebrow="ACCOUNT"
        title={error ? "เข้าสู่ระบบไม่สำเร็จ" : "กำลังยืนยันบัญชี…"}
      />
      {error && <Notice kind="error">{error}</Notice>}
      <a href="/login" className="button secondary">
        กลับหน้าเข้าสู่ระบบ
      </a>
    </div>
  );
}
