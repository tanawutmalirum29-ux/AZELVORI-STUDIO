import { FirstPartyLogin } from "./FirstPartyLogin";
import { Icon } from "./Icon";

export function AdminEntry({ loading = false, reason = "", denied = false }: {
  loading?: boolean;
  reason?: string;
  denied?: boolean;
}) {
  return (
    <div className="container login-page admin-entry first-party-shell">
      <div className="login-story">
        <span className="eyebrow">AZELVORI / STUDIO DESK</span>
        <h1>ทุกโปรเจกต์<br /><span className="accent">เริ่มต้นที่นี่</span></h1>
        <p>พื้นที่ทำงานสำหรับรับบรีฟ ดูแลโปรเจกต์
          และตอบกลับลูกค้าอย่างเป็นระบบ</p>
        <ul>
          {["จัดคิวบรีฟและติดตามงาน", "ดูแลโปรเจกต์และขั้นตอนตรวจรับ", "จัดการแชทและสมาชิก"].map((value) => (
            <li key={value}><Icon name="check" />{value}</li>
          ))}
        </ul>
        <a className="text-link" href="/admin/setup">
          ตรวจความพร้อมระบบ <Icon name="arrow" />
        </a>
      </div>
      {loading ? <div className="login-card"><p role="status">กำลังตรวจสอบบัญชี…</p></div> :
        <FirstPartyLogin mode="admin" denied={denied} reason={reason} />}
    </div>
  );
}
