import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput } from "@/components/floating-field";
export function ConfigurationMailPage() {
    const queryClient = useQueryClient();
    const mailQuery = useQuery({
        queryKey: ["config-mail"],
        queryFn: async () => (await api.get("/config/mail")).data
    });
    const [form, setForm] = useState({
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
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Loading mail configuration..." });
    }
    const mail = mailQuery.data;
    useEffect(() => {
        if (mail) {
            setForm(mail);
        }
    }, [mail]);
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-slate-500", children: "Configuration" }), _jsx("h2", { className: "font-heading text-xl", children: "Mail Server" }), _jsx("p", { className: "text-sm text-slate-500", children: "Used for workflow task notifications." })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(FloatingInput, { label: "SMTP Host", value: form.host, onChange: (event) => setForm({ ...form, host: event.target.value }) }), _jsx(FloatingInput, { label: "Port", value: String(form.port), onChange: (event) => setForm({ ...form, port: Number(event.target.value) }) }), _jsx(FloatingInput, { label: "Username", value: form.username, onChange: (event) => setForm({ ...form, username: event.target.value }) }), _jsx(FloatingInput, { label: "Password", value: form.password, onChange: (event) => setForm({ ...form, password: event.target.value }) }), _jsx(FloatingInput, { label: "From Name", value: form.fromName, onChange: (event) => setForm({ ...form, fromName: event.target.value }) }), _jsx(FloatingInput, { label: "From Email", value: form.fromEmail, onChange: (event) => setForm({ ...form, fromEmail: event.target.value }) }), _jsxs("label", { className: "flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: form.secure, onChange: (event) => setForm({ ...form, secure: event.target.checked }) }), "Use TLS/SSL"] })] }), _jsx("button", { type: "button", onClick: () => saveMail.mutate(), disabled: saveMail.isPending, className: "rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: saveMail.isPending ? "Saving..." : "Save Mail Settings" })] }));
}
//# sourceMappingURL=mail-page.js.map