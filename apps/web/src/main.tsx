import { StrictMode, Component, type ReactNode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Layout, PageIntro } from "./components/Layout";
import { Home } from "./pages/Home";
import "./styles.css";
const Start = lazy(() =>
  import("./pages/Start").then((m) => ({ default: m.Start })),
);
const Demo = lazy(() =>
  import("./pages/Demo").then((m) => ({ default: m.Demo })),
);
const Login = lazy(() =>
  import("./pages/Account").then((m) => ({ default: m.Login })),
);
const Callback = lazy(() =>
  import("./pages/Account").then((m) => ({ default: m.Callback })),
);
const Admin = lazy(() =>
  import("./pages/Account").then((m) => ({ default: m.Admin })),
);
const CustomerAccount = lazy(() =>
  import("./pages/Workspace").then((m) => ({ default: m.Workspace })),
);
const Invite = lazy(() =>
  import("./pages/Workspace").then((m) => ({ default: m.Invite })),
);
const Legal = lazy(() =>
  import("./pages/Legal").then((m) => ({ default: m.Legal })),
);
const path = window.location.pathname.replace(/\/$/, "") || "/";
const titles: Record<string, string> = {
  "/": "Build what’s next.",
  "/start": "เริ่มโปรเจกต์",
  "/demo": "พอร์ทัลตัวอย่าง",
  "/login": "พื้นที่ลูกค้า",
  "/app": "พื้นที่ลูกค้า",
  "/admin": "จัดการบรีฟ",
  "/admin/projects": "จัดการโปรเจกต์",
  "/invite": "คำเชิญเข้าโปรเจกต์",
  "/auth/callback": "ยืนยันบัญชี",
  "/privacy": "ความเป็นส่วนตัว",
  "/terms": "เงื่อนไข",
  "/cookies": "การจัดเก็บข้อมูล",
};
document.title = `${titles[path] ?? "ไม่พบหน้านี้"} | AZELVORI STUDIO`;
function Route() {
  if (path === "/") return <Home />;
  if (path === "/start") return <Start />;
  if (path === "/demo") return <Demo />;
  if (path === "/login") return <Login />;
  if (path === "/auth/callback") return <Callback />;
  if (path === "/admin") return <Admin />;
  if (path === "/app" || path === "/admin/projects") return <CustomerAccount />;
  if (path === "/invite") return <Invite />;
  if (["/privacy", "/terms", "/cookies", "/refund-policy"].includes(path))
    return <Legal path={path} />;
  return (
    <div className="container status-page">
      <PageIntro eyebrow="404 / LOST IN SPACE" title="หน้านี้ยังไม่มีอยู่">
        กลับไปดูบริการหรือเริ่มบรีฟโปรเจกต์ใหม่ได้เลย
      </PageIntro>
      <a className="button" href="/">
        กลับหน้าแรก →
      </a>
    </div>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="container status-page">
        <h1>เปิดหน้านี้ไม่สำเร็จ</h1>
        <p>ข้อมูลยังไม่ถูกส่ง โปรดลองโหลดหน้าใหม่</p>
        <button className="button" onClick={() => location.reload()}>
          ลองอีกครั้ง
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <Layout>
        <Suspense
          fallback={
            <div className="container status-page" role="status">
              กำลังเปิดพื้นที่ของคุณ…
            </div>
          }
        >
          <Route />
        </Suspense>
      </Layout>
    </ErrorBoundary>
  </StrictMode>,
);
