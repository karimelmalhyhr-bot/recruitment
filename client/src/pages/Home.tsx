import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { toast } from "sonner";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Gauge,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Webhook,
  X,
  AlertCircle,
  ArrowUpLeft,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

type AnyRecord = Record<string, any>;
const api: any = trpc as any;
const candidateStatuses = [
  "new",
  "screening",
  "shortlisted",
  "phone",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
const jobStatuses = ["open", "paused", "closed"] as const;

function useApiQuery(procedure: any, input?: any, options?: any) {
  if (procedure?.useQuery) return procedure.useQuery(input, options);
  return {
    data: undefined,
    isLoading: false,
    error: undefined,
    refetch: () => undefined,
  } as any;
}
function useApiMutation(procedure: any) {
  if (procedure?.useMutation) return procedure.useMutation();
  return {
    isPending: false,
    mutateAsync: async () => {
      throw new Error("هذه العملية غير متاحة بعد");
    },
  } as any;
}
function listOf(value: any): AnyRecord[] {
  const candidate = value?.items ?? value?.results ?? value?.data ?? value;
  if (Array.isArray(candidate)) return candidate;
  if (candidate && typeof candidate === "object")
    return Object.values(candidate);
  return [];
}
function text(item: AnyRecord | undefined, ...keys: string[]) {
  if (!item) return "";
  for (const key of keys)
    if (item[key] !== undefined && item[key] !== null && item[key] !== "")
      return String(item[key]);
  return "";
}
function dateText(value: any, timeZone?: string) {
  if (!value) return "غير محدد";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "جديد",
    applied: "متقدم",
    screening: "فرز أولي",
    interview: "مقابلة",
    offer: "عرض وظيفي",
    shortlisted: "قائمة مختصرة",
    phone: "مكالمة هاتفية",
    rejected: "مرفوض",
    withdrawn: "منسحب",
    scheduled: "مجدولة",
    completed: "مكتملة",
    canceled: "ملغاة",
    open: "مفتوحة",
    closed: "مغلقة",
    draft: "مسودة",
  };
  return labels[status?.toLowerCase?.()] ?? status ?? "غير محدد";
}
function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(x => x[0])
      .join("")
      .toUpperCase() || "؟"
  );
}
function formatError(error: any) {
  return (
    error?.message?.replace(/^TRPCClientError:\s*/, "") ||
    "تعذر تحميل البيانات. حاول مرة أخرى."
  );
}

const navItems = [
  { path: "/", label: "نظرة عامة", icon: LayoutDashboard },
  { path: "/candidates", label: "المرشحون", icon: Users },
  { path: "/jobs", label: "الوظائف", icon: BriefcaseBusiness },
  { path: "/pipeline", label: "مسار التوظيف", icon: Gauge },
  { path: "/interviews", label: "المقابلات", icon: CalendarDays },
  { path: "/questions", label: "بنك الأسئلة", icon: MessageSquare },
  { path: "/evaluations", label: "التقييمات", icon: ClipboardCheck },
  { path: "/integrations", label: "التكاملات", icon: Webhook },
  { path: "/notifications", label: "التنبيهات", icon: Bell },
];

export default function Home() {
  const auth = trpc.auth.me.useQuery();
  if (auth.isLoading) return <LoadingScreen label="نجهّز مساحة العمل…" />;
  if (auth.error || !auth.data) return <LoginScreen error={auth.error} />;
  if (auth.data.role === "user") return <AccessPending />;
  return <Dashboard user={auth.data as AnyRecord} />;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div
      className="min-h-screen grid place-items-center bg-[#f7f5ef] text-[#174a3a]"
      dir="rtl"
    >
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#174a3a] text-white">
          <Loader2 className="animate-spin" size={22} />
        </div>
        <p className="text-sm font-semibold">{label}</p>
      </div>
    </div>
  );
}
function LoginScreen({ error }: { error?: any }) {
  return (
    <div
      className="min-h-screen grid place-items-center bg-[#f7f5ef] px-5 text-[#16382f]"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-[28px] border border-[#dfd9ca] bg-white p-8 text-center shadow-[0_20px_70px_rgba(23,74,58,.09)]">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#174a3a] text-[#d9c7a2]">
          <ShieldCheck size={28} />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.24em] text-[#a58c60]">
          مِعيار
        </p>
        <h1 className="mb-3 text-2xl font-extrabold">مساحة عمل فريق التوظيف</h1>
        <p className="mb-7 text-sm leading-7 text-[#68756f]">
          سجّل الدخول عبر Manus OAuth للوصول إلى سجلات المرشحين والوظائف.
        </p>
        {error && (
          <div className="mb-4 rounded-xl bg-[#fff4ed] p-3 text-xs text-[#9b4f32]">
            تعذر التحقق من الجلسة. أعد المحاولة.
          </div>
        )}
        <button onClick={() => startLogin()} className="action-primary w-full">
          تسجيل الدخول الآمن <ArrowUpLeft size={17} />
        </button>
      </div>
    </div>
  );
}

function AccessPending() {
  const logout = useApiMutation(api.auth?.logout);
  const doLogout = async () => {
    try {
      await logout.mutateAsync();
      window.location.href = "/";
    } catch {
      toast.error("تعذر تسجيل الخروج");
    }
  };
  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f5ef] px-5 text-[#16382f]">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center">
        <section className="card w-full text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-[#f2ead9] text-[#94794a]">
            <ShieldCheck size={30} />
          </div>
          <p className="mb-2 text-xs font-bold tracking-[.2em] text-[#a58c60]">
            مِعيار · وصول معلّق
          </p>
          <h1 className="text-2xl font-black">حسابك بانتظار موافقة المسؤول</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-8 text-[#718078]">
            تم تسجيل الدخول بنجاح، لكن يحتاج الحساب إلى موافقة مسؤول قبل الوصول
            إلى لوحة HR.
          </p>
          <button
            onClick={doLogout}
            disabled={logout.isPending}
            className="action-secondary mt-7 w-full justify-center text-[#a85e43]"
          >
            {logout.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <LogOut size={16} />
            )}{" "}
            تسجيل الخروج
          </button>
        </section>
      </div>
    </div>
  );
}
function Dashboard({ user }: { user: AnyRecord }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const active =
    navItems.find(item => item.path === location) ??
    (location === "/settings" ? { label: "الإعدادات" } : navItems[0]);
  const logout = useApiMutation(api.auth?.logout);
  const doLogout = async () => {
    try {
      await logout.mutateAsync();
      window.location.href = "/";
    } catch {
      toast.error("تعذر تسجيل الخروج");
    }
  };
  const go = (path: string) => {
    setLocation(path);
    setMobileOpen(false);
  };
  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f5ef] text-[#16382f]">
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-[#16382f]/40 lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-[278px] flex-col border-l border-[#ddd6c7] bg-[#173f33] text-white transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-[88px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#d9c7a2] text-[#174a3a]">
            <FileText size={21} />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight">مِعيار</p>
            <p className="text-[11px] text-white/55">سجلّات هادئة للتوظيف</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="mr-auto rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-sm font-bold">
              {initials(text(user, "name", "email"))}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {text(user, "name") || "عضو فريق HR"}
              </p>
              <p className="truncate text-[11px] text-white/55">
                {text(user, "email") || "حساب Manus"}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={`nav-item w-full ${isActive ? "nav-item-active" : ""}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => go("/settings")}
            className={`nav-item w-full ${location === "/settings" ? "nav-item-active" : ""}`}
          >
            <Settings size={18} />
            <span>الإعدادات</span>
          </button>
          <button
            onClick={doLogout}
            className="nav-item mt-1 w-full text-[#efb09b] hover:bg-[#6c312d]/30"
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
      <main className="min-h-screen lg:mr-[278px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e1dccf] bg-[#f7f5ef]/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="icon-button lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs text-[#88928b]">مساحة الإدارة /</p>
              <h1 className="text-lg font-black md:text-xl">{active.label}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/apply"
              className="hidden items-center gap-2 rounded-xl border border-[#d9c7a2] bg-[#fffdf8] px-3 py-2 text-xs font-bold text-[#7e663a] transition hover:bg-[#f2ead9] sm:flex"
            >
              <ExternalLink size={15} /> صفحة التقديم
            </Link>
            <button
              onClick={() => go("/notifications")}
              className="icon-button relative"
            >
              <Bell size={18} />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#b86d48]" />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] p-4 md:p-8">
          <SectionRouter user={user} location={location} go={go} />
        </div>
      </main>
    </div>
  );
}

function SectionRouter({
  user,
  location,
  go,
}: {
  user: AnyRecord;
  location: string;
  go: (path: string) => void;
}) {
  switch (location) {
    case "/candidates":
      return <Candidates />;
    case "/jobs":
      return <Jobs />;
    case "/pipeline":
      return <Pipeline />;
    case "/interviews":
      return <Interviews />;
    case "/questions":
      return <Questions />;
    case "/evaluations":
      return <Evaluations />;
    case "/integrations":
      return <Integrations />;
    case "/notifications":
      return <Notifications />;
    case "/settings":
      return <SettingsPage user={user} />;
    default:
      return <Overview go={go} />;
  }
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-[11px] font-bold tracking-[.18em] text-[#a58c60]">
          {eyebrow || "مساحة العمل"}
        </p>
        <h2 className="text-2xl font-black tracking-tight md:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#718078]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
function LoadingBox() {
  return (
    <div className="grid min-h-[170px] place-items-center rounded-2xl border border-[#e2ddcf] bg-white">
      <Loader2 className="animate-spin text-[#174a3a]" size={22} />
    </div>
  );
}
function ErrorBox({ error, retry }: { error: any; retry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#f0cfc3] bg-[#fff8f5] p-5 text-sm text-[#9b4f32]">
      <div className="flex items-center gap-3">
        <AlertCircle size={19} />
        <span>{formatError(error)}</span>
      </div>
      {retry && (
        <button
          onClick={retry}
          className="rounded-lg border border-[#e8b7a6] px-3 py-1.5 text-xs font-bold"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
function EmptyBox({
  title,
  message,
  icon: Icon = FileText,
  action,
}: {
  title: string;
  message: string;
  icon?: any;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[240px] place-items-center rounded-2xl border border-dashed border-[#dcd5c5] bg-white p-8 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#f2ede2] text-[#947b4e]">
          <Icon size={20} />
        </div>
        <h3 className="font-bold">{title}</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#7d8982]">
          {message}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: any;
  tone?: "green" | "sand" | "rust" | "blue";
}) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-[#718078]">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
        <p className="mt-2 text-[11px] text-[#9a9f99]">{detail}</p>
      </div>
      <div
        className={`grid h-11 w-11 place-items-center rounded-2xl ${tone === "sand" ? "bg-[#f2ead9] text-[#8d7142]" : tone === "rust" ? "bg-[#fae9e2] text-[#a85e43]" : tone === "blue" ? "bg-[#e7efee] text-[#38675d]" : "bg-[#e4eee9] text-[#174a3a]"}`}
      >
        <Icon size={20} />
      </div>
    </div>
  );
}

function Overview({ go }: { go: (path: string) => void }) {
  const jobs = useApiQuery(api.jobs?.list);
  const candidates = useApiQuery(api.candidates?.list);
  const interviews = useApiQuery(api.interviews?.list);
  const notifications = useApiQuery(api.notifications?.list);
  const loading =
    jobs.isLoading || candidates.isLoading || interviews.isLoading;
  if (loading)
    return (
      <>
        <PageHeading
          title="نظرة عامة"
          description="ملخص تشغيلي لحالة التوظيف الحالية."
        />
        <LoadingBox />
      </>
    );
  if (jobs.error || candidates.error || interviews.error)
    return (
      <>
        <PageHeading title="نظرة عامة" />
        <ErrorBox
          error={jobs.error || candidates.error || interviews.error}
          retry={() => {
            jobs.refetch?.();
            candidates.refetch?.();
            interviews.refetch?.();
          }}
        />
      </>
    );
  const jobRows = listOf(jobs.data),
    candidateRows = listOf(candidates.data),
    interviewRows = listOf(interviews.data),
    notificationRows = listOf(notifications.data);
  const upcomingInterviews = interviewRows
    .filter(item => {
      const scheduledAt = new Date(item.scheduledAt);
      return (
        text(item, "status").toLowerCase() === "scheduled" &&
        !Number.isNaN(scheduledAt.getTime()) &&
        scheduledAt.getTime() >= Date.now()
      );
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  const counts = ["new", "screening", "shortlisted", "interview", "offer"].map(
    status =>
      candidateRows.filter(
        c => text(c, "status", "stage").toLowerCase() === status
      ).length
  );
  return (
    <>
      <PageHeading
        eyebrow="اليوم في مِعيار"
        title="نظرة عامة"
        description="قرارات أوضح، وسجل واحد لكل خطوة في رحلة المرشح."
        action={
          <button onClick={() => go("/candidates")} className="action-primary">
            <Plus size={17} /> إضافة مرشح
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="المرشحون"
          value={candidateRows.length}
          detail="إجمالي السجلات"
          icon={Users}
        />
        <StatCard
          label="الوظائف المفتوحة"
          value={
            jobRows.filter(j => text(j, "status").toLowerCase() === "open")
              .length
          }
          detail="حسب آخر مزامنة"
          icon={BriefcaseBusiness}
          tone="sand"
        />
        <StatCard
          label="المقابلات القادمة"
          value={upcomingInterviews.length}
          detail="مواعيد مسجلة"
          icon={CalendarDays}
          tone="blue"
        />
        <StatCard
          label="غير المقروء"
          value={notificationRows.filter(n => !n.readAt && !n.read).length}
          detail="تنبيهات الفريق"
          icon={Bell}
          tone="rust"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="card">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-black">توزيع مسار التوظيف</h3>
              <p className="mt-1 text-xs text-[#87928b]">
                عدد المرشحين حسب المرحلة الحالية
              </p>
            </div>
            <button
              onClick={() => go("/pipeline")}
              className="text-xs font-bold text-[#527b6e]"
            >
              عرض المسار <ArrowUpLeft className="inline" size={14} />
            </button>
          </div>
          <div className="space-y-4">
            {[
              ["جديد", counts[0], "bg-[#8ab2a0]"],
              ["فرز أولي", counts[1], "bg-[#c6a86d]"],
              ["القائمة المختصرة", counts[2], "bg-[#b89b64]"],
              ["مقابلة", counts[3], "bg-[#6a9b92]"],
              ["عرض وظيفي", counts[4], "bg-[#b97859"],
            ].map(([label, count, color]) => (
              <div
                key={String(label)}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-20 text-[#68766e]">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf0eb]">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{
                      width: `${Math.min(100, Number(count) * 12 + (Number(count) ? 8 : 0))}%`,
                    }}
                  />
                </div>
                <b className="w-7 text-left text-[#294b3e]">{count}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-black">المقابلات القادمة</h3>
            <button
              onClick={() => go("/interviews")}
              className="text-xs font-bold text-[#527b6e]"
            >
              كل المواعيد
            </button>
          </div>
          {upcomingInterviews.slice(0, 4).length ? (
            <div className="space-y-4">
              {upcomingInterviews.slice(0, 4).map((item, index) => (
                <div
                  key={item.id ?? index}
                  className="flex items-center gap-3 border-b border-[#eeeae0] pb-3 last:border-0 last:pb-0"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf3f0] text-[#477467]">
                    <CalendarDays size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {text(
                        item,
                        "candidateName",
                        "title",
                        "candidate",
                        "name"
                      ) || "مقابلة مرشح"}
                    </p>
                    <p className="mt-1 text-[11px] text-[#8a958e]">
                      {dateText(
                        item.scheduledAt || item.startAt || item.date,
                        item.timeZone
                      )}
                    </p>
                  </div>
                  <span className="badge badge-green">
                    {statusLabel(text(item, "status") || "scheduled")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-5 text-center text-sm text-[#8a958e]">
              لا توجد مقابلات مسجلة بعد.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function Candidates() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const query = useApiQuery(api.candidates?.list, {
    search: search || undefined,
    status: status || undefined,
  });
  const jobs = useApiQuery(api.jobs?.list);
  const update = useApiMutation(api.candidates?.updateStatus);
  const detail = useApiQuery(
    api.candidates?.get,
    selected?.id ? { id: Number(selected.id) } : undefined,
    { enabled: Boolean(selected?.id) }
  );
  const rows = listOf(query.data);
  const changeStatus = async (id: any, next: string) => {
    const reason =
      next === "rejected"
        ? window.prompt("اكتب سبب الاستبعاد لتوثيقه في سجل المرشح:")?.trim()
        : undefined;
    if (next === "rejected" && !reason) {
      toast.error("يلزم إدخال سبب الاستبعاد");
      return;
    }
    try {
      await update.mutateAsync({
        id: Number(id),
        status: next,
        ...(reason ? { reason } : {}),
      });
      toast.success("تم تحديث مرحلة المرشح");
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="دليل المواهب"
        title="المرشحون"
        description="ابحث، راجع، وانقل المرشحين بين المراحل مع سجل واضح لكل إجراء."
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="action-primary"
          >
            <Plus size={17} /> إضافة مرشح
          </button>
        }
      />
      {showForm && (
        <CandidateForm
          jobs={listOf(jobs.data)}
          onDone={() => {
            setShowForm(false);
            query.refetch?.();
          }}
        />
      )}
      <div className="card mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_190px]">
          <label className="input-wrap">
            <Search size={17} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو البريد…"
            />
          </label>
          <select
            className="input"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">كل المراحل</option>
            {candidateStatuses.map(v => (
              <option key={v} value={v}>
                {statusLabel(v)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {query.isLoading ? (
        <LoadingBox />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={query.refetch} />
      ) : rows.length === 0 ? (
        <EmptyBox
          title="لا يوجد مرشحون"
          message="ابدأ بإضافة مرشح يدويًا أو شارك رابط صفحة التقديم العامة."
          icon={Users}
          action={
            <button
              onClick={() => setShowForm(true)}
              className="action-primary"
            >
              <Plus size={16} /> إضافة مرشح
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المرشح</th>
                  <th>الوظيفة</th>
                  <th>المرحلة</th>
                  <th>آخر تحديث</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((candidate, index) => {
                  const name =
                    text(candidate, "name", "fullName") || "بدون اسم";
                  const current = text(candidate, "status", "stage") || "new";
                  return (
                    <tr key={candidate.id ?? index}>
                      <td>
                        <button
                          className="flex items-center gap-3 text-right"
                          onClick={() => setSelected(candidate)}
                        >
                          <span className="avatar">{initials(name)}</span>
                          <span>
                            <b className="block text-sm">{name}</b>
                            <small>
                              {text(candidate, "email", "phone") ||
                                "بيانات اتصال غير مكتملة"}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        {text(candidate, "jobTitle", "jobName", "position") ||
                          "غير مرتبط"}
                      </td>
                      <td>
                        <select
                          className="stage-select"
                          value={current}
                          onChange={e =>
                            changeStatus(candidate.id, e.target.value)
                          }
                        >
                          {candidateStatuses.map(v => (
                            <option key={v} value={v}>
                              {statusLabel(v)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-xs text-[#849088]">
                        {dateText(candidate.updatedAt || candidate.createdAt)}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          onClick={() => setSelected(candidate)}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {selected && (
        <CandidateDrawer
          candidate={selected}
          detail={detail.data}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function CandidateForm({
  jobs,
  onDone,
}: {
  jobs: AnyRecord[];
  onDone: () => void;
}) {
  const create = useApiMutation(api.candidates?.create);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    jobId: "",
  });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.jobId) {
      toast.error("اختر الوظيفة أولًا");
      return;
    }
    try {
      await create.mutateAsync({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        jobId: Number(form.jobId),
      });
      toast.success("تمت إضافة المرشح");
      onDone();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <form onSubmit={submit} className="card mb-5 border-[#bfd1c6] bg-[#fbfdfb]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-black">إضافة مرشح جديد</h3>
          <p className="mt-1 text-xs text-[#7e8b82]">
            يُحفظ السجل كما أدخلته دون قرار آلي.
          </p>
        </div>
        <button type="button" onClick={onDone} className="icon-button">
          <X size={17} />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span>الاسم الكامل</span>
          <input
            required
            className="input"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="field">
          <span>البريد الإلكتروني</span>
          <input
            type="email"
            required
            className="input"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="field">
          <span>رقم الهاتف</span>
          <input
            className="input"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <label className="field">
          <span>الوظيفة</span>
          <select
            required
            className="input"
            value={form.jobId}
            onChange={e => setForm({ ...form, jobId: e.target.value })}
          >
            <option value="">اختر وظيفة</option>
            {jobs.map(job => (
              <option key={job.id} value={String(job.id)}>
                {text(job, "title", "name")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button disabled={create.isPending} className="action-primary mt-5">
        {create.isPending ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Check size={16} />
        )}{" "}
        حفظ المرشح
      </button>
    </form>
  );
}
function CandidateDrawer({
  candidate,
  detail,
  onClose,
}: {
  candidate: AnyRecord;
  detail: AnyRecord;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [resumeUrl, setResumeUrl] = useState("");
  const [pending, setPending] = useState(false);
  const record = detail || candidate;
  const name = text(record, "name", "fullName") || "تفاصيل المرشح";
  const openResume = async () => {
    setPending(true);
    try {
      const result = await utils.candidates.resumeLink.fetch({
        id: Number(candidate.id),
      });
      const url = text(result, "url", "link", "resumeUrl");
      if (url) {
        setResumeUrl(url);
        window.open(url, "_blank", "noopener,noreferrer");
      } else toast.error("لم يُرجع الخادم رابط السيرة الذاتية");
    } catch (error) {
      toast.error(formatError(error));
    } finally {
      setPending(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex justify-start bg-[#173f33]/30"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-r border-[#dfd8c8] bg-[#fffdf9] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-7 flex items-center justify-between">
          <h3 className="text-xl font-black">ملف المرشح</h3>
          <button onClick={onClose} className="icon-button">
            <X size={18} />
          </button>
        </div>
        <div className="mb-7 flex items-center gap-4">
          <span className="avatar avatar-lg">{initials(name)}</span>
          <div>
            <h4 className="font-black">{name}</h4>
            <p className="mt-1 text-sm text-[#748178]">
              {text(record, "email") || "بريد غير مسجل"}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            ["المرحلة", statusLabel(text(record, "status", "stage") || "new")],
            ["الهاتف", text(record, "phone") || "غير مسجل"],
            ["الوظيفة", text(record, "jobTitle", "jobName") || "غير مرتبطة"],
            ["تاريخ الإضافة", dateText(record.createdAt)],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between border-b border-[#eee9df] py-3 text-sm"
            >
              <span className="text-[#89948d]">{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
        {record.rejectionReason && (
          <div className="mt-5 rounded-2xl border border-[#ead9ce] bg-[#fff7f2] p-4 text-sm leading-7 text-[#8a503b]">
            <b className="block">سبب الاستبعاد المسجل</b>
            <span>{text(record, "rejectionReason")}</span>
          </div>
        )}
        <button
          onClick={openResume}
          disabled={pending}
          className="action-secondary mt-6 w-full"
        >
          {pending ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <FileText size={16} />
          )}{" "}
          فتح السيرة الذاتية
        </button>
        {resumeUrl && (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="action-link mt-3 w-full"
          >
            فتح الرابط مرة أخرى <ExternalLink size={14} />
          </a>
        )}
        <div className="mt-7 rounded-2xl bg-[#f4f0e7] p-4 text-xs leading-6 text-[#65736b]">
          تظهر هنا البيانات التي يتيحها الخادم فقط. لا يتم اتخاذ قرار تلقائي
          بشأن المرشح.
        </div>
      </aside>
    </div>
  );
}
function Jobs() {
  const [show, setShow] = useState(false);
  const query = useApiQuery(api.jobs?.list);
  const rows = listOf(query.data);
  return (
    <>
      <PageHeading
        eyebrow="هيكل الفريق"
        title="الوظائف"
        description="أنشئ الوظائف وشارك صفحات التقديم المفتوحة مع المرشحين."
        action={
          <button onClick={() => setShow(!show)} className="action-primary">
            <Plus size={17} /> إنشاء وظيفة
          </button>
        }
      />
      {show && (
        <JobForm
          onDone={() => {
            setShow(false);
            query.refetch?.();
          }}
        />
      )}
      {query.isLoading ? (
        <LoadingBox />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={query.refetch} />
      ) : rows.length === 0 ? (
        <EmptyBox
          title="لا توجد وظائف بعد"
          message="أنشئ أول وظيفة لتبدأ باستقبال المرشحين عبر صفحة التقديم."
          icon={BriefcaseBusiness}
          action={
            <button onClick={() => setShow(true)} className="action-primary">
              <Plus size={16} /> إنشاء وظيفة
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((job, index) => (
            <JobCard
              key={job.id ?? index}
              job={job}
              onRefresh={query.refetch}
            />
          ))}
        </div>
      )}
    </>
  );
}
function JobForm({ onDone }: { onDone: () => void }) {
  const create = useApiMutation(api.jobs?.create);
  const [form, setForm] = useState({
    title: "",
    department: "",
    location: "",
    criteria: "",
    status: "open",
  });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        ...form,
        department: form.department || undefined,
        location: form.location || undefined,
        criteria: form.criteria || undefined,
      });
      toast.success("تم إنشاء الوظيفة");
      onDone();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <form onSubmit={submit} className="card mb-5 border-[#bfd1c6] bg-[#fbfdfb]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-black">وظيفة جديدة</h3>
        <button type="button" onClick={onDone} className="icon-button">
          <X size={17} />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span>المسمى الوظيفي</span>
          <input
            required
            className="input"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="field">
          <span>القسم</span>
          <input
            className="input"
            value={form.department}
            onChange={e => setForm({ ...form, department: e.target.value })}
          />
        </label>
        <label className="field">
          <span>الموقع / نمط العمل</span>
          <input
            className="input"
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
          />
        </label>
        <label className="field">
          <span>الحالة</span>
          <select
            className="input"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
          >
            {jobStatuses.map(v => (
              <option key={v} value={v}>
                {statusLabel(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="field md:col-span-2">
          <span>معايير الوظيفة</span>
          <textarea
            className="input min-h-24"
            value={form.criteria}
            onChange={e => setForm({ ...form, criteria: e.target.value })}
          />
        </label>
      </div>
      <button disabled={create.isPending} className="action-primary mt-5">
        {create.isPending ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Check size={16} />
        )}{" "}
        حفظ الوظيفة
      </button>
    </form>
  );
}
function JobCard({
  job,
  onRefresh,
}: {
  job: AnyRecord;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const update = useApiMutation(api.jobs?.update);
  const title = text(job, "title", "name") || "وظيفة بلا عنوان";
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await update.mutateAsync({
        id: Number(job.id),
        title: String(d.get("title") || ""),
        department: String(d.get("department") || "") || undefined,
        location: String(d.get("location") || "") || undefined,
        status: String(d.get("status")),
        criteria: String(d.get("criteria") || "") || undefined,
      });
      toast.success("تم تحديث الوظيفة");
      setEditing(false);
      onRefresh();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  if (editing)
    return (
      <form onSubmit={save} className="card space-y-3">
        <input required name="title" defaultValue={title} className="input" />
        <input
          name="department"
          defaultValue={text(job, "department")}
          placeholder="القسم"
          className="input"
        />
        <input
          name="location"
          defaultValue={text(job, "location")}
          placeholder="الموقع"
          className="input"
        />
        <select
          required
          name="status"
          defaultValue={text(job, "status") || "open"}
          className="input"
        >
          {jobStatuses.map(v => (
            <option key={v} value={v}>
              {statusLabel(v)}
            </option>
          ))}
        </select>
        <textarea
          name="criteria"
          defaultValue={text(job, "criteria")}
          placeholder="معايير الوظيفة"
          className="input min-h-20"
        />
        <div className="flex gap-2">
          <button className="action-primary" disabled={update.isPending}>
            حفظ التعديل
          </button>
          <button
            type="button"
            className="action-secondary"
            onClick={() => setEditing(false)}
          >
            إلغاء
          </button>
        </div>
      </form>
    );
  return (
    <div className="card flex min-h-[190px] flex-col">
      <div className="flex items-start justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e5eee9] text-[#174a3a]">
          <BriefcaseBusiness size={20} />
        </div>
        <span
          className={`badge ${text(job, "status").toLowerCase() === "closed" ? "badge-neutral" : "badge-green"}`}
        >
          {statusLabel(text(job, "status") || "open")}
        </span>
      </div>
      <h3 className="mt-5 text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm text-[#748178]">
        {text(job, "department") || "قسم غير محدد"} ·{" "}
        {text(job, "location") || "موقع غير محدد"}
      </p>
      <p className="mt-3 line-clamp-2 text-xs leading-6 text-[#89948d]">
        {text(job, "criteria") || "لا توجد معايير مضافة"}
      </p>
      <div className="mt-auto flex justify-end pt-5">
        <button onClick={() => setEditing(true)} className="action-link">
          تعديل الوظيفة <ArrowUpLeft size={14} />
        </button>
      </div>
    </div>
  );
}
function Pipeline() {
  const query = useApiQuery(api.candidates?.list);
  const rows = listOf(query.data);
  const groups = [
    { key: "new", label: "جديد" },
    { key: "screening", label: "فرز أولي" },
    { key: "shortlisted", label: "قائمة مختصرة" },
    { key: "phone", label: "مكالمة هاتفية" },
    { key: "interview", label: "مقابلة" },
    { key: "offer", label: "عرض وظيفي" },
    { key: "rejected", label: "مرفوض" },
    { key: "withdrawn", label: "منسحب" },
  ];
  return (
    <>
      <PageHeading
        eyebrow="رؤية الفريق"
        title="مسار التوظيف"
        description="لوحة واحدة لفهم تدفق المرشحين، دون استبدال حكم فريق HR."
      />
      {query.isLoading ? (
        <LoadingBox />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={query.refetch} />
      ) : (
        <div className="pipeline-grid">
          {groups.map(group => (
            <div className="pipeline-column" key={group.key}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black">{group.label}</h3>
                <span className="count-dot">
                  {
                    rows.filter(
                      c =>
                        text(c, "status", "stage").toLowerCase() === group.key
                    ).length
                  }
                </span>
              </div>
              <div className="space-y-3">
                {rows
                  .filter(
                    c => text(c, "status", "stage").toLowerCase() === group.key
                  )
                  .map((candidate, index) => (
                    <div
                      key={candidate.id ?? index}
                      className="rounded-2xl border border-[#e5dfd2] bg-white p-4 shadow-[0_4px_15px_rgba(23,74,58,.03)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="avatar avatar-sm">
                          {initials(
                            text(candidate, "name", "fullName") || "مرشح"
                          )}
                        </span>
                        <b className="truncate text-sm">
                          {text(candidate, "name", "fullName") || "بدون اسم"}
                        </b>
                      </div>
                      <p className="mt-3 truncate text-xs text-[#8b958f]">
                        {text(candidate, "jobTitle", "jobName", "position") ||
                          "وظيفة غير مرتبطة"}
                      </p>
                    </div>
                  ))}
                {rows.filter(
                  c => text(c, "status", "stage").toLowerCase() === group.key
                ).length === 0 && (
                  <p className="rounded-xl border border-dashed border-[#ded8ca] p-5 text-center text-xs text-[#9ba39e]">
                    لا توجد سجلات
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Interviews() {
  const query = useApiQuery(api.interviews?.list);
  const candidates = useApiQuery(api.candidates?.list);
  const questions = useApiQuery(api.questions?.list);
  const create = useApiMutation(api.interviews?.create);
  const update = useApiMutation(api.interviews?.update);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    candidateId: "",
    scheduledAt: "",
    kind: "first",
    timeZone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC",
    participants: "",
    notes: "",
    questionIds: [] as number[],
  });
  const rows = listOf(query.data);
  const selectedCandidate = listOf(candidates.data).find(
    candidate => Number(candidate.id) === Number(form.candidateId)
  );
  const eligibleQuestions = listOf(questions.data).filter(
    question =>
      question.stage === form.kind &&
      (!question.jobId ||
        Number(question.jobId) === Number(selectedCandidate?.jobId))
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const participants = form.participants
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);
    if (!form.candidateId || !participants.length) {
      toast.error("اختر مرشحًا وأدخل مشاركًا واحدًا على الأقل");
      return;
    }
    const scheduledAt = new Date(form.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error("أدخل موعدًا صالحًا للمقابلة");
      return;
    }
    try {
      await create.mutateAsync({
        candidateId: Number(form.candidateId),
        kind: form.kind,
        scheduledAt: scheduledAt.toISOString(),
        timeZone: form.timeZone,
        participants,
        questionIds: form.questionIds,
        notes: form.notes || undefined,
      });
      toast.success("تم تسجيل الموعد");
      setShow(false);
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const change = async (item: AnyRecord, status: string) => {
    try {
      await update.mutateAsync({ id: Number(item.id), status });
      toast.success("تم تحديث حالة المقابلة");
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="تنسيق الوقت"
        title="المقابلات"
        description="سجّل المواعيد والحالة والملاحظات في مكان واحد."
        action={
          <button onClick={() => setShow(!show)} className="action-primary">
            <Plus size={17} /> موعد جديد
          </button>
        }
      />
      {show && (
        <form
          onSubmit={submit}
          className="card mb-5 border-[#bfd1c6] bg-[#fbfdfb]"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-black">تسجيل مقابلة</h3>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="icon-button"
            >
              <X size={17} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field">
              <span>المرشح</span>
              <select
                required
                className="input"
                value={form.candidateId}
                onChange={e =>
                  setForm({
                    ...form,
                    candidateId: e.target.value,
                    questionIds: [],
                  })
                }
              >
                <option value="">اختر مرشحًا</option>
                {listOf(candidates.data).map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {text(c, "name", "fullName")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>التاريخ والوقت</span>
              <input
                required
                type="datetime-local"
                className="input"
                value={form.scheduledAt}
                onChange={e =>
                  setForm({ ...form, scheduledAt: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>نوع المقابلة</span>
              <select
                required
                className="input"
                value={form.kind}
                onChange={e =>
                  setForm({ ...form, kind: e.target.value, questionIds: [] })
                }
              >
                <option value="phone">مكالمة هاتفية</option>
                <option value="first">أولى</option>
                <option value="technical">تقنية</option>
                <option value="final">نهائية</option>
              </select>
            </label>
            <label className="field">
              <span>المنطقة الزمنية</span>
              <input
                required
                className="input"
                dir="ltr"
                readOnly
                value={form.timeZone}
                onChange={e => setForm({ ...form, timeZone: e.target.value })}
              />
            </label>
            <label className="field md:col-span-2">
              <span>
                المشاركون <small>افصل بينهم بفواصل</small>
              </span>
              <input
                required
                className="input"
                dir="ltr"
                value={form.participants}
                onChange={e =>
                  setForm({ ...form, participants: e.target.value })
                }
                placeholder="hr@example.com, manager@example.com"
              />
            </label>
            <div className="field md:col-span-2">
              <span>أسئلة هذه المقابلة</span>
              {!form.candidateId ? (
                <p className="text-xs text-[#89948d]">اختر المرشح أولًا.</p>
              ) : eligibleQuestions.length ? (
                <div className="grid gap-2 rounded-xl border border-[#e5dfd2] bg-white p-3 sm:grid-cols-2">
                  {eligibleQuestions.map(question => (
                    <label
                      key={question.id}
                      className="flex items-start gap-2 text-sm leading-6"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#174a3a]"
                        checked={form.questionIds.includes(Number(question.id))}
                        onChange={e =>
                          setForm({
                            ...form,
                            questionIds: e.target.checked
                              ? [...form.questionIds, Number(question.id)]
                              : form.questionIds.filter(
                                  id => id !== Number(question.id)
                                ),
                          })
                        }
                      />
                      <span>{text(question, "question")}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#89948d]">
                  لا توجد أسئلة لهذه الوظيفة والمرحلة؛ أضفها من بنك الأسئلة.
                </p>
              )}
            </div>
            <label className="field md:col-span-2">
              <span>ملاحظات</span>
              <textarea
                className="input"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <button className="action-primary mt-5" disabled={create.isPending}>
            <Check size={16} /> حفظ الموعد
          </button>
        </form>
      )}
      {query.isLoading ? (
        <LoadingBox />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={query.refetch} />
      ) : rows.length === 0 ? (
        <EmptyBox
          title="لا توجد مقابلات"
          message="أنشئ موعدًا لربط المرشح بفريق المقابلة."
          icon={CalendarDays}
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المرشح</th>
                  <th>الموعد</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => (
                  <tr key={item.id ?? index}>
                    <td className="font-bold">
                      {text(item, "candidateName", "name", "candidate") ||
                        "مرشح"}
                    </td>
                    <td>{dateText(item.scheduledAt, item.timeZone)}</td>
                    <td>{statusLabel(text(item, "kind") || "first")}</td>
                    <td>
                      <select
                        className="stage-select"
                        value={text(item, "status") || "scheduled"}
                        onChange={e => change(item, e.target.value)}
                      >
                        <option value="scheduled">مجدولة</option>
                        <option value="completed">مكتملة</option>
                        <option value="canceled">ملغاة</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
function Questions() {
  const query = useApiQuery(api.questions?.list);
  const jobs = useApiQuery(api.jobs?.list);
  const create = useApiMutation(api.questions?.create);
  const remove = useApiMutation(api.questions?.delete);
  const [form, setForm] = useState({
    question: "",
    competency: "",
    stage: "first",
    jobId: "",
  });
  const rows = listOf(query.data);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.question.trim() || !form.competency.trim()) {
      toast.error("أدخل السؤال والكفاءة");
      return;
    }
    try {
      await create.mutateAsync({
        question: form.question,
        competency: form.competency,
        stage: form.stage,
        jobId: form.jobId ? Number(form.jobId) : undefined,
      });
      setForm({ ...form, question: "" });
      toast.success("تمت إضافة السؤال");
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const del = async (id: any) => {
    try {
      await remove.mutateAsync({ id: Number(id) });
      toast.success("تم حذف السؤال");
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="أدوات المقابلة"
        title="بنك الأسئلة"
        description="احتفظ بأسئلة منظمة تساعد الفريق على إجراء مقابلات متسقة."
      />
      <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <form onSubmit={add} className="card h-fit">
          <h3 className="font-black">إضافة سؤال</h3>
          <label className="field mt-5">
            <span>الكفاءة</span>
            <input
              required
              className="input"
              value={form.competency}
              onChange={e => setForm({ ...form, competency: e.target.value })}
              placeholder="التواصل"
            />
          </label>
          <label className="field mt-4">
            <span>المرحلة</span>
            <select
              className="input"
              value={form.stage}
              onChange={e => setForm({ ...form, stage: e.target.value })}
            >
              <option value="phone">مكالمة هاتفية</option>
              <option value="first">مقابلة أولى</option>
              <option value="technical">مقابلة تقنية</option>
              <option value="final">مقابلة نهائية</option>
            </select>
          </label>
          <label className="field mt-4">
            <span>
              الوظيفة <small>(اختياري)</small>
            </span>
            <select
              className="input"
              value={form.jobId}
              onChange={e => setForm({ ...form, jobId: e.target.value })}
            >
              <option value="">كل الوظائف</option>
              {listOf(jobs.data).map(job => (
                <option key={job.id} value={String(job.id)}>
                  {text(job, "title", "name")}
                </option>
              ))}
            </select>
          </label>
          <label className="field mt-4">
            <span>نص السؤال</span>
            <textarea
              required
              className="input min-h-32"
              value={form.question}
              onChange={e => setForm({ ...form, question: e.target.value })}
              placeholder="مثال: احكِ عن موقف…"
            />
          </label>
          <button disabled={create.isPending} className="action-primary mt-4">
            <Plus size={16} /> إضافة إلى البنك
          </button>
        </form>
        <div>
          {query.isLoading ? (
            <LoadingBox />
          ) : query.error ? (
            <ErrorBox error={query.error} retry={query.refetch} />
          ) : rows.length === 0 ? (
            <EmptyBox
              title="البنك فارغ"
              message="أضف أول سؤال ليظهر هنا لكل فريق المقابلات."
              icon={MessageSquare}
            />
          ) : (
            <div className="space-y-3">
              {rows.map((item, index) => (
                <div
                  key={item.id ?? index}
                  className="card flex items-start gap-4"
                >
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f1eadc] text-[#94794a]">
                    <MessageSquare size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="badge badge-sand">
                        {text(item, "competency") || "كفاءة عامة"}
                      </span>
                      <span className="badge badge-neutral">
                        {text(item, "stage") || "مرحلة"}
                      </span>
                    </div>
                    <p className="text-sm font-bold leading-7">
                      {text(item, "question", "text", "body")}
                    </p>
                  </div>
                  <button
                    onClick={() => del(item.id)}
                    className="icon-button text-[#a85e43]"
                    aria-label="حذف السؤال"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function Evaluations() {
  const query = useApiQuery(api.evaluations?.list);
  const candidates = useApiQuery(api.candidates?.list);
  const interviews = useApiQuery(api.interviews?.list);
  const create = useApiMutation(api.evaluations?.create);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    candidateId: "",
    interviewId: "",
    competency: "",
    score: "",
    note: "",
    recommendation: "hold",
    strengths: "",
    concerns: "",
    notes: "",
  });
  const rows = listOf(query.data);
  const candidateInterviews = listOf(interviews.data).filter(
    interview =>
      Number(interview.candidateId) === Number(form.candidateId) &&
      text(interview, "status").toLowerCase() !== "canceled"
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        candidateId: Number(form.candidateId),
        interviewId: Number(form.interviewId),
        scores: [
          {
            competency: form.competency,
            score: Number(form.score),
            ...(form.note ? { note: form.note } : {}),
          },
        ],
        recommendation: form.recommendation,
        strengths: form.strengths || undefined,
        concerns: form.concerns || undefined,
        notes: form.notes || undefined,
      });
      toast.success("تم تسجيل التقييم");
      setShow(false);
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="قرار الفريق"
        title="التقييمات"
        description="سجل ملاحظات وتقييمات المقابلين بشفافية — لا يتم اتخاذ قرار آلي."
        action={
          <button onClick={() => setShow(!show)} className="action-primary">
            <Plus size={17} /> تسجيل تقييم
          </button>
        }
      />
      {show && (
        <form
          onSubmit={submit}
          className="card mb-5 border-[#bfd1c6] bg-[#fbfdfb]"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-black">تقييم مرشح</h3>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="icon-button"
            >
              <X size={17} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field">
              <span>المرشح</span>
              <select
                required
                className="input"
                value={form.candidateId}
                onChange={e =>
                  setForm({
                    ...form,
                    candidateId: e.target.value,
                    interviewId: "",
                  })
                }
              >
                <option value="">اختر مرشحًا</option>
                {listOf(candidates.data).map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {text(c, "name", "fullName")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>المقابلة</span>
              <select
                required
                className="input"
                value={form.interviewId}
                onChange={e =>
                  setForm({ ...form, interviewId: e.target.value })
                }
              >
                <option value="">اختر مقابلة</option>
                {candidateInterviews.map(interview => (
                  <option key={interview.id} value={String(interview.id)}>
                    {statusLabel(text(interview, "kind"))} —{" "}
                    {dateText(interview.scheduledAt, interview.timeZone)}
                  </option>
                ))}
              </select>
              {form.candidateId && candidateInterviews.length === 0 && (
                <small>سجّل مقابلة لهذا المرشح أولًا.</small>
              )}
            </label>
            <label className="field">
              <span>الكفاءة</span>
              <input
                required
                className="input"
                value={form.competency}
                onChange={e => setForm({ ...form, competency: e.target.value })}
                placeholder="التواصل"
              />
            </label>
            <label className="field">
              <span>النتيجة من 5</span>
              <input
                required
                min="0"
                max="5"
                step="0.1"
                type="number"
                className="input"
                value={form.score}
                onChange={e => setForm({ ...form, score: e.target.value })}
              />
            </label>
            <label className="field">
              <span>التوصية</span>
              <select
                required
                className="input"
                value={form.recommendation}
                onChange={e =>
                  setForm({ ...form, recommendation: e.target.value })
                }
              >
                <option value="hire">تعيين</option>
                <option value="hold">قيد المراجعة</option>
                <option value="no_hire">عدم التعيين</option>
              </select>
            </label>
            <label className="field md:col-span-2">
              <span>ملاحظة الكفاءة</span>
              <input
                className="input"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </label>
            <label className="field">
              <span>نقاط القوة</span>
              <textarea
                className="input"
                value={form.strengths}
                onChange={e => setForm({ ...form, strengths: e.target.value })}
              />
            </label>
            <label className="field">
              <span>نقاط تحتاج متابعة</span>
              <textarea
                className="input"
                value={form.concerns}
                onChange={e => setForm({ ...form, concerns: e.target.value })}
              />
            </label>
            <label className="field md:col-span-2">
              <span>ملاحظات عامة</span>
              <textarea
                className="input"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <button className="action-primary mt-5" disabled={create.isPending}>
            <Check size={16} /> حفظ التقييم
          </button>
        </form>
      )}
      {query.isLoading ? (
        <LoadingBox />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={query.refetch} />
      ) : rows.length === 0 ? (
        <EmptyBox
          title="لا توجد تقييمات"
          message="سجّل أول تقييم بعد مقابلة المرشح."
          icon={ClipboardCheck}
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المرشح</th>
                  <th>المقابلة</th>
                  <th>النتيجة</th>
                  <th>التوصية</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => (
                  <tr key={item.id ?? index}>
                    <td className="font-bold">
                      {text(item, "candidateName", "name", "candidate") ||
                        "مرشح"}
                    </td>
                    <td>
                      {item.interviewKind
                        ? `${statusLabel(item.interviewKind)} — ${dateText(item.interviewScheduledAt, item.interviewTimeZone)}`
                        : "غير مرتبط"}
                    </td>
                    <td>
                      {Array.isArray(item.scores)
                        ? item.scores
                            .map(
                              (score: AnyRecord) =>
                                `${score.competency}: ${score.score}/5`
                            )
                            .join(" · ")
                        : "—"}
                    </td>
                    <td>
                      <span className="badge badge-green">
                        {statusLabel(text(item, "recommendation"))}
                      </span>
                    </td>
                    <td>{dateText(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
function Integrations() {
  const query = useApiQuery(api.integrations?.list);
  const jobs = useApiQuery(api.jobs?.list);
  const create = useApiMutation(api.integrations?.createWebhook);
  const disable = useApiMutation(api.integrations?.disableWebhook);
  const [form, setForm] = useState({ name: "", jobId: "" });
  const [created, setCreated] = useState<AnyRecord | null>(null);
  const rows = listOf(query.data);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const result = await create.mutateAsync({
        name: form.name,
        jobId: form.jobId ? Number(form.jobId) : undefined,
      });
      setCreated(result);
      setForm({ name: "", jobId: "" });
      toast.success("تم إنشاء webhook");
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const turnOff = async (id: any) => {
    try {
      await disable.mutateAsync({ id: Number(id) });
      toast.success("تم تعطيل التكامل");
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="بوابة البيانات"
        title="التكاملات"
        description="استقبل طلبات المرشحين من النماذج الخارجية عبر webhook موثّق."
      />
      <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <form onSubmit={add} className="card h-fit">
          <h3 className="font-black">إنشاء webhook</h3>
          <label className="field mt-5">
            <span>اسم التكامل</span>
            <input
              required
              className="input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="نموذج التوظيف الخارجي"
            />
          </label>
          <label className="field mt-4">
            <span>
              الوظيفة <small>(اختياري)</small>
            </span>
            <select
              className="input"
              value={form.jobId}
              onChange={e => setForm({ ...form, jobId: e.target.value })}
            >
              <option value="">كل الوظائف</option>
              {listOf(jobs.data).map(job => (
                <option key={job.id} value={String(job.id)}>
                  {text(job, "title", "name")}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={create.isPending}
            className="action-primary mt-5 w-full"
          >
            {create.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Webhook size={16} />
            )}{" "}
            إنشاء رابط آمن
          </button>
          {created && (
            <div className="mt-5 rounded-2xl border border-[#bfd1c6] bg-[#f5faf6] p-4 text-sm">
              <div className="flex items-center justify-between">
                <b>تم إنشاء التكامل</b>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setCreated(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <p className="mt-3 text-xs text-[#708078]">Endpoint نسبي</p>
              <code
                className="mt-1 block break-all rounded-lg bg-white p-2 text-xs"
                dir="ltr"
              >
                {created.endpoint || `/api/intake/${created.id}`}
              </code>
              <p className="mt-3 text-xs text-[#9b4f32]">
                احفظ هذا الرمز الآن؛ لن يظهر مجددًا في قائمة التكاملات.
              </p>
              <div
                className="mt-1 flex items-center gap-2 rounded-lg bg-[#fff8f5] p-2"
                dir="ltr"
              >
                <code className="min-w-0 flex-1 break-all text-xs">
                  X-HR-Integration-Token: {created.token}
                </code>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => navigator.clipboard?.writeText(created.token)}
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}
        </form>
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-black">طريقة الإرسال</h3>
            <p className="mt-2 text-sm leading-7 text-[#718078]">
              أرسل الطلب إلى الـ endpoint باستخدام ترويسة{" "}
              <code dir="ltr">X-HR-Integration-Token</code>. يجب أن يتضمن الجسم
              موافقة خصوصية صريحة.
            </p>
            <pre
              className="mt-4 overflow-x-auto rounded-xl bg-[#173f33] p-4 text-xs leading-6 text-[#f4f0e7]"
              dir="ltr"
            >{`POST /api/intake/:id
X-HR-Integration-Token: your-token
Content-Type: application/json

{
  "name": "Candidate Name",
  "email": "candidate@example.com",
  "jobId": 123,
  "privacyAccepted": true
}`}</pre>
          </div>
          {query.isLoading ? (
            <LoadingBox />
          ) : query.error ? (
            <ErrorBox error={query.error} retry={query.refetch} />
          ) : rows.length === 0 ? (
            <EmptyBox
              title="لا توجد تكاملات"
              message="أنشئ webhook من النموذج ليظهر endpoint النشط هنا."
              icon={Webhook}
            />
          ) : (
            <div className="space-y-3">
              {rows.map((item, index) => (
                <div className="card" key={item.id ?? index}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1eadc] text-[#94794a]">
                        <Webhook size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-black">
                          {text(item, "name", "label") || "Webhook"}
                        </h3>
                        <p
                          className="mt-1 truncate text-xs text-[#819087]"
                          dir="ltr"
                        >{`/api/intake/${item.id}`}</p>
                      </div>
                    </div>
                    <span
                      className={`badge ${item.disabledAt ? "badge-neutral" : "badge-green"}`}
                    >
                      {item.disabledAt ? "معطل" : "نشط"}
                    </span>
                  </div>
                  {!item.disabledAt && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => turnOff(item.id)}
                        className="action-secondary text-[#a85e43]"
                      >
                        تعطيل التكامل
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function Notifications() {
  const query = useApiQuery(api.notifications?.list);
  const mark = useApiMutation(api.notifications?.markRead);
  const rows = listOf(query.data);
  const read = async (item: AnyRecord) => {
    try {
      await mark.mutateAsync({ id: item.id });
      toast.success("تم تعليم التنبيه كمقروء");
      query.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="صندوق الفريق"
        title="التنبيهات"
        description="تابع تحديثات السجلات والمهام التي تحتاج انتباهك."
      />
      {query.isLoading ? (
        <LoadingBox />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={query.refetch} />
      ) : rows.length === 0 ? (
        <EmptyBox
          title="لا توجد تنبيهات"
          message="ستظهر هنا إشعارات التوظيف عند وصولها من الخادم."
          icon={Bell}
        />
      ) : (
        <div className="max-w-3xl space-y-3">
          {rows.map((item, index) => {
            const isRead = Boolean(item.readAt || item.read);
            return (
              <div
                key={item.id ?? index}
                className={`card flex gap-4 ${isRead ? "opacity-65" : "border-[#c7d8cf]"}`}
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isRead ? "bg-[#f0eee7] text-[#8b958e]" : "bg-[#e5eee9] text-[#174a3a]"}`}
                >
                  <Bell size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">
                        {text(item, "title", "type") || "تنبيه جديد"}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#718078]">
                        {text(item, "message", "body", "description") ||
                          "تحديث جديد في مساحة العمل."}
                      </p>
                    </div>
                    {!isRead && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#b86d48]" />
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-[#9aa29d]">
                      {dateText(item.createdAt)}
                    </span>
                    {!isRead && (
                      <button
                        onClick={() => read(item)}
                        className="text-xs font-bold text-[#527b6e]"
                      >
                        تعليم كمقروء
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function SettingsPage({ user }: { user: AnyRecord }) {
  const isAdmin = text(user, "role").toLowerCase() === "admin";
  const logout = useApiMutation(api.auth?.logout);
  const team = useApiQuery(api.team?.list, undefined, { enabled: isAdmin });
  const setRole = useApiMutation(api.team?.setRole);
  const doLogout = async () => {
    try {
      await logout.mutateAsync();
      window.location.href = "/";
    } catch {
      toast.error("تعذر تسجيل الخروج");
    }
  };
  const changeRole = async (member: AnyRecord, role: string) => {
    try {
      await setRole.mutateAsync({
        userId: Number(member.userId ?? member.id),
        role,
      });
      toast.success("تم تحديث دور العضو");
      team.refetch?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const members = listOf(team.data);
  return (
    <>
      <PageHeading
        eyebrow="مساحتك"
        title="الإعدادات"
        description="معلومات الحساب وإدارة جلسة الدخول."
      />
      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="card">
          <div className="mb-5 flex items-center gap-3">
            <div className="avatar avatar-lg">
              {initials(text(user, "name", "email"))}
            </div>
            <div>
              <h3 className="font-black">
                {text(user, "name") || "عضو فريق HR"}
              </h3>
              <p className="mt-1 text-xs text-[#7f8c84]">
                {text(user, "email") || "حساب Manus"}
              </p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-[#eeeae0] py-3">
              <span className="text-[#8c9790]">المزوّد</span>
              <b>Manus OAuth</b>
            </div>
            <div className="flex justify-between border-b border-[#eeeae0] py-3">
              <span className="text-[#8c9790]">الدور</span>
              <b>{text(user, "role") || "غير محدد"}</b>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-[#8c9790]">الحالة</span>
              <span className="badge badge-green">جلسة نشطة</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fae9e2] text-[#a85e43]">
            <LogOut size={18} />
          </div>
          <h3 className="mt-4 font-black">تسجيل الخروج</h3>
          <p className="mt-2 text-sm leading-6 text-[#7d8982]">
            ينهي جلسة Manus الحالية على هذا الجهاز.
          </p>
          <button
            onClick={doLogout}
            className="action-secondary mt-5 text-[#a85e43]"
          >
            تسجيل الخروج الآمن
          </button>
        </div>
      </div>
      {isAdmin && (
        <section className="card mt-5 max-w-4xl">
          <div className="mb-5">
            <h3 className="font-black">أعضاء الفريق</h3>
            <p className="mt-2 text-xs leading-6 text-[#7d8982]">
              يمكن للمسؤول منح أو سحب أدوار user وhr_member وviewer. لا يمكن
              إنشاء دور admin من هذه الواجهة.
            </p>
          </div>
          {team.isLoading ? (
            <LoadingBox />
          ) : team.error ? (
            <ErrorBox error={team.error} retry={team.refetch} />
          ) : members.length === 0 ? (
            <p className="rounded-xl bg-[#f7f4ed] p-4 text-sm text-[#7d8982]">
              لا توجد أعضاء لعرضهم.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>العضو</th>
                    <th>الدور الحالي</th>
                    <th>تحديث الدور</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => {
                    const id = member.userId ?? member.id;
                    const current = text(member, "role") || "user";
                    return (
                      <tr key={String(id ?? index)}>
                        <td>
                          <b className="block">
                            {text(member, "name", "email", "userId") || "عضو"}
                          </b>
                          <small>{text(member, "email")}</small>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{current}</span>
                        </td>
                        <td>
                          <select
                            className="stage-select"
                            value={current}
                            onChange={e => changeRole(member, e.target.value)}
                          >
                            <option value="user">user</option>
                            <option value="hr_member">hr_member</option>
                            <option value="viewer">viewer</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
