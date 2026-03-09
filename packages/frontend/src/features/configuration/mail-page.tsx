import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput } from "@/components/floating-field";

interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export function ConfigurationMailPage(): JSX.Element {
  const queryClient = useQueryClient();
  const mailQuery = useQuery({
    queryKey: ["config-mail"],
    queryFn: async () => (await api.get<MailConfig>("/config/mail")).data
  });
  const [form, setForm] = useState<MailConfig>({
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    fromName: "Plural PLM",
    fromEmail: ""
  });

  const saveMail = useMutation({
    mutationFn: async () => {
      await api.put("/config/mail", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["config-mail"] });
    }
  });

  if (mailQuery.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading mail configuration...</div>;
  }

  const mail = mailQuery.data;
  useEffect(() => {
    if (mail) {
      setForm(mail);
    }
  }, [mail]);

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <p className="text-xs uppercase text-slate-500">Configuration</p>
        <h2 className="font-heading text-xl">Mail Server</h2>
        <p className="text-sm text-slate-500">Used for workflow task notifications.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FloatingInput label="SMTP Host" value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} />
        <FloatingInput label="Port" value={String(form.port)} onChange={(event) => setForm({ ...form, port: Number(event.target.value) })} />
        <FloatingInput label="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        <FloatingInput label="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <FloatingInput label="From Name" value={form.fromName} onChange={(event) => setForm({ ...form, fromName: event.target.value })} />
        <FloatingInput label="From Email" value={form.fromEmail} onChange={(event) => setForm({ ...form, fromEmail: event.target.value })} />
        <label className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
          <input type="checkbox" checked={form.secure} onChange={(event) => setForm({ ...form, secure: event.target.checked })} />
          Use TLS/SSL
        </label>
      </div>
      <button
        type="button"
        onClick={() => saveMail.mutate()}
        disabled={saveMail.isPending}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {saveMail.isPending ? "Saving..." : "Save Mail Settings"}
      </button>
    </div>
  );
}
