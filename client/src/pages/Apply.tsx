import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileUp,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

type AnyRecord = Record<string, any>;
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

export default function Apply() {
  const [, params] = useRoute("/apply/:jobId");
  const jobsQuery = trpc.jobs.openings.useQuery();
  const apply = trpc.candidates.submitApplication.useMutation();
  const openings = listOf(jobsQuery.data);
  const [selectedJob, setSelectedJob] = useState<AnyRecord>();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    consent: false,
  });
  const [file, setFile] = useState<{
    name: string;
    type: string;
    size: number;
    base64: string;
  } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (params?.jobId) {
      const id = Number(params.jobId);
      const match = openings.find(job => Number(job.id) === id);
      if (match) setSelectedJob(match);
    }
  }, [params?.jobId, openings]);
  const onFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (candidate.size > 5 * 1024 * 1024) {
      toast.error("حجم السيرة الذاتية يجب ألا يتجاوز 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setFile({
        name: candidate.name,
        type: candidate.type,
        size: candidate.size,
        base64: result.includes(",") ? result.split(",")[1] : result,
      });
    };
    reader.onerror = () => toast.error("تعذر قراءة الملف");
    reader.readAsDataURL(candidate);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedJob) {
      toast.error("اختر الوظيفة التي تتقدم إليها");
      return;
    }
    if (!form.consent) {
      toast.error("يجب الموافقة على سياسة الخصوصية للمتابعة");
      return;
    }
    try {
      await apply.mutateAsync({
        jobId: Number(selectedJob.id),
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        privacyAccepted: true,
        resumeData: file?.base64,
        resumeFileName: file?.name,
        resumeContentType: file?.type,
      });
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error?.message || "تعذر إرسال الطلب. حاول مرة أخرى.");
    }
  };
  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f5ef] text-[#16382f]">
      <header className="border-b border-[#e2ddcf] bg-[#fffdf9]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/apply" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#174a3a] text-[#d9c7a2]">
              <ShieldCheck size={20} />
            </span>
            <span>
              <b className="block text-lg">مِعيار</b>
              <small className="text-[11px] text-[#89958d]">صفحة التقديم</small>
            </span>
          </Link>
          <span className="hidden text-xs text-[#7e8d84] sm:block">
            نموذج تقديم آمن لفريق التوظيف
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-9">
            <p className="mb-3 text-xs font-bold tracking-[.18em] text-[#a58c60]">
              فرصة جديدة
            </p>
            <h1 className="text-3xl font-black tracking-tight md:text-5xl">
              ابدأ خطوتك التالية معنا
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-8 text-[#718078]">
              اختر الوظيفة المناسبة وأرسل بياناتك. سيطلع فريق HR على طلبك وفق
              سياسة الخصوصية المعتمدة.
            </p>
          </div>
          {jobsQuery.isLoading ? (
            <div className="grid min-h-48 place-items-center rounded-3xl border border-[#e1dccf] bg-white">
              <Loader2 className="animate-spin text-[#174a3a]" />
            </div>
          ) : jobsQuery.error ? (
            <div className="rounded-2xl border border-[#f0cfc3] bg-[#fff8f5] p-5 text-sm text-[#9b4f32]">
              تعذر تحميل الوظائف المفتوحة حاليًا.
            </div>
          ) : submitted ? (
            <div className="rounded-3xl border border-[#c8dbcf] bg-white p-10 text-center">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-[#e4eee9] text-[#174a3a]">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-2xl font-black">تم استلام طلبك</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#718078]">
                شكرًا لتقديمك على{" "}
                {text(selectedJob, "title", "name") || "الوظيفة"}. سيقوم فريقنا
                بمراجعة البيانات والتواصل معك عند الحاجة.
              </p>
              <Link href="/apply" className="action-secondary mt-7 inline-flex">
                العودة إلى الوظائف
              </Link>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"
            >
              <section className="card h-fit">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-black">الوظائف المفتوحة</h2>
                    <p className="mt-1 text-xs text-[#87928b]">
                      اختر وظيفة واحدة
                    </p>
                  </div>
                  <span className="badge badge-sand">
                    {openings.length} فرص
                  </span>
                </div>
                <div className="space-y-3">
                  {openings.length === 0 ? (
                    <p className="rounded-xl bg-[#f4f0e7] p-4 text-sm leading-6 text-[#7c8981]">
                      لا توجد وظائف مفتوحة حاليًا. عد لاحقًا للاطلاع على الفرص
                      الجديدة.
                    </p>
                  ) : (
                    openings.map((job, index) => (
                      <button
                        type="button"
                        key={job.id ?? index}
                        onClick={() => setSelectedJob(job)}
                        className={`w-full rounded-2xl border p-4 text-right transition ${selectedJob?.id === job.id ? "border-[#174a3a] bg-[#edf4f0]" : "border-[#e5dfd2] bg-white hover:border-[#b7cabc]"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold">
                            {text(job, "title", "name") || "وظيفة مفتوحة"}
                          </span>
                          {selectedJob?.id === job.id && (
                            <CheckCircle2
                              size={18}
                              className="shrink-0 text-[#174a3a]"
                            />
                          )}
                        </div>
                        <p className="mt-2 text-xs text-[#849088]">
                          {text(job, "department") || "فريق مِعيار"} ·{" "}
                          {text(job, "location") || "يُحدد لاحقًا"}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </section>
              <section className="card">
                <h2 className="font-black">بيانات التقديم</h2>
                <p className="mt-1 text-xs text-[#87928b]">
                  كل الحقول الأساسية مطلوبة ما عدا الهاتف والسيرة الذاتية.
                </p>
                <div className="mt-6 grid gap-4">
                  <label className="field">
                    <span>الاسم الكامل</span>
                    <input
                      required
                      className="input"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="اكتب اسمك الكامل"
                    />
                  </label>
                  <label className="field">
                    <span>البريد الإلكتروني</span>
                    <input
                      required
                      type="email"
                      className="input"
                      value={form.email}
                      onChange={e =>
                        setForm({ ...form, email: e.target.value })
                      }
                      placeholder="name@example.com"
                      dir="ltr"
                    />
                  </label>
                  <label className="field">
                    <span>
                      رقم الهاتف <small>(اختياري)</small>
                    </span>
                    <input
                      className="input"
                      value={form.phone}
                      onChange={e =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                    />
                  </label>
                  <label className="field">
                    <span>
                      السيرة الذاتية <small>(PDF أو DOCX، حتى 5MB)</small>
                    </span>
                    <label className="upload-box">
                      <UploadCloud size={22} />
                      <span>
                        {file ? file.name : "اسحب الملف هنا أو اضغط للاختيار"}
                      </span>
                      <small>
                        {file
                          ? `${(file.size / 1024 / 1024).toFixed(2)}MB`
                          : "لن نرفع الملف قبل الإرسال"}
                      </small>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="sr-only"
                        onChange={e => onFile(e.target.files?.[0])}
                      />
                    </label>
                  </label>
                  <label className="mt-2 flex items-start gap-3 rounded-xl bg-[#f7f4ed] p-4 text-xs leading-6 text-[#68766e]">
                    <input
                      type="checkbox"
                      required
                      checked={form.consent}
                      onChange={e =>
                        setForm({ ...form, consent: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 accent-[#174a3a]"
                    />
                    <span>
                      أوافق صراحةً على معالجة بياناتي لأغراض التوظيف والتواصل
                      بشأن هذا الطلب وفق سياسة الخصوصية.
                    </span>
                  </label>
                </div>
                <button
                  disabled={apply.isPending || openings.length === 0}
                  className="action-primary mt-6 w-full justify-center"
                >
                  {apply.isPending ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <FileUp size={17} />
                  )}{" "}
                  إرسال الطلب
                </button>
                <p className="mt-4 text-center text-[11px] text-[#9aa29d]">
                  لن يتم اتخاذ قرار آلي من خلال هذا النموذج.
                </p>
              </section>
            </form>
          )}
        </div>
      </main>
      <footer className="mx-auto max-w-6xl px-5 pb-8 text-xs text-[#929b95] md:px-8">
        © {new Date().getFullYear()} مِعيار · تواصل مع فريق HR عند الحاجة
      </footer>
    </div>
  );
}
