import { useState, type ReactNode } from "react";
import { Icon, Mark } from "./Icon";
export function Logo() {
  return (
    <a className="logo" href="/" aria-label="AZELVORI STUDIO หน้าแรก">
      <Mark />
      <span>
        AZELVORI<small>STUDIO</small>
      </span>
    </a>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />
        <button
          className="icon-button menu-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
        <nav
          id="main-nav"
          className={open ? "main-nav open" : "main-nav"}
          aria-label="เมนูหลัก"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <a href="/#services" onClick={() => setOpen(false)}>
            บริการ
          </a>
          <a href="/#work" onClick={() => setOpen(false)}>
            แนวทางงาน
          </a>
          <a href="/#process" onClick={() => setOpen(false)}>
            วิธีทำงาน
          </a>
          <a href="/#faq" onClick={() => setOpen(false)}>
            คำถามที่พบบ่อย
          </a>
          <a className="nav-login" href="/login">
            พื้นที่ลูกค้า <Icon name="northeast" size={15} />
          </a>
          <a className="button small" href="/start">
            เริ่มโปรเจกต์ <Icon name="arrow" size={16} />
          </a>
        </nav>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <Logo />
          <p>
            Thoughtfully built. Ready for what’s next.
            <br />
            <span>เว็บไซต์ · แอปพลิเคชัน · เกม</span>
          </p>
          <a href="/start" className="text-link">
            เล่าไอเดียของคุณ <Icon name="northeast" />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} AZELVORI STUDIO</span>
          <div>
            <a href="/privacy">ความเป็นส่วนตัว</a>
            <a href="/terms">เงื่อนไข</a>
            <a href="/cookies">การจัดเก็บข้อมูล</a>
          </div>
          <span className="alpha-label">DEVELOPMENT PREVIEW</span>
        </div>
      </div>
    </footer>
  );
}
export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        ข้ามไปเนื้อหา
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Notice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon name={kind === "success" ? "check" : "shield"} />
      <div>{children}</div>
    </div>
  );
}
