import { useState } from "react";
import { useTranslation } from "react-i18next";

import ToolForm from "../components/Conversation/MessageAssistant/ToolForm";
import { buildDemoForm } from "../dev/toolFormDemo";

// Dev-only preview of the editable tool form that assistant messages render
// for `<tool>.form` events. It is reachable at /dev/tool-form in the dev
// server only (see Route/PublicRoute.tsx) and never sends a chat message.
export default function ToolFormDemoPage() {
  const { t } = useTranslation();
  const [form] = useState(() => buildDemoForm());
  const [submitted, setSubmitted] = useState(null);

  return (
    <div className="min-h-dvh bg-base-100 px-4 py-8 text-base-content">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t("tool_form_demo.title")}</h1>
          <p className="text-sm text-base-content/70">
            {t("tool_form_demo.description")}
          </p>
        </div>
        <ToolForm
          form={form}
          localState={{ settings: {} }}
          setLocalState={() => {}}
          onSubmit={async ({ values }) => setSubmitted(values)}
        />
        {submitted && (
          <div className="rounded-2xl border border-base-300 p-4">
            <div className="mb-2 text-sm font-medium">
              {t("tool_form_demo.submitted")}
            </div>
            <pre className="overflow-x-auto text-xs">
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
