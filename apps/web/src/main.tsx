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
  import("./pages/Admin").then((m) => ({ default: m.Admin })),
);
const AdminLogin = lazy(() =>
  import("./components/AdminEntry").then((m) => ({ default: m.AdminEntry })),
);
const AdminInbox = lazy(() =>
  import("./pages/AdminInbox").then((m) => ({ default: m.AdminInbox })),
);
const AdminEmployees = lazy(() => import("./pages/AdminEmployees").then((m) => ({ default: m.AdminEmployees })));
const AdminPilot = lazy(() => import("./pages/AdminPilot").then((m) => ({ default: m.AdminPilot })));
const StaffLogin = lazy(() => import("./pages/Staff").then((m) => ({ default: m.StaffLogin })));
const StaffInbox = lazy(() => import("./pages/Staff").then((m) => ({ default: m.StaffInbox })));
const AdminSetup = lazy(() =>
  import("./pages/AdminSetup").then((m) => ({ default: m.AdminSetup })),
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
  "/admin": "บรีฟและคิวงาน",
  "/admin/login": "เข้าสู่ระบบผู้ดูแล",
  "/admin/setup": "เปิดใช้งานแอดมิน",
  "/admin/projects": "จัดการโปรเจกต์",
  "/admin/inbox": "ข้อความลูกค้า",
  "/admin/employees": "จัดการพนักงาน",
  "/admin/pilot": "ทดสอบระบบงานจริง",
  "/staff/login": "เข้าสู่ระบบพนักงาน",
  "/staff/inbox": "แชทและงานพนักงาน",
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
  if (path === "/admin/login") return <AdminLogin />;
  if (path === "/admin/setup") return <AdminSetup />;
  if (path === "/admin/inbox") return <AdminInbox />;
  if (path === "/admin/employees") return <AdminEmployees />;
  if (path === "/admin/pilot") return <AdminPilot />;
  if (path === "/staff/login") return <StaffLogin />;
  if (path === "/staff/inbox") return <StaffInbox />;
  if (path === "/app" || path === "/admin/projects")
    return <CustomerAccount requireAdmin={path === "/admin/projects"} />;
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
