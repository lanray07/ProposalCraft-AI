import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  explainProposal,
  generateProposal,
  regenerateProposal
} from "../core/proposal";
import {
  type Proposal,
  type ProposalInput,
  type ServiceType,
  serviceTypes,
  type Tone,
  tones
} from "../core/types";
import "./styles.css";

type FormState = {
  businessName: string;
  clientName: string;
  projectDescription: string;
  serviceType: ServiceType;
  price: string;
  depositPercent: string;
  timeline: string;
  tone: Tone;
};

const serviceLabels: Record<ServiceType, string> = {
  landscaping: "Landscaping",
  paving: "Paving",
  cleaning: "Cleaning",
  "general-contractor": "General contractor",
  painting: "Painting",
  plumbing: "Plumbing",
  electrical: "Electrical",
  handyman: "Handyman",
  "pressure-washing": "Pressure washing",
  roofing: "Roofing"
};

const toneLabels: Record<Tone, string> = {
  formal: "Formal",
  friendly: "Friendly",
  premium: "Premium"
};

const initialForm: FormState = {
  businessName: "ProposalCraft Services",
  clientName: "Sample Client",
  projectDescription:
    "Install a new patio area with clean edging, compacted base, and a tidy finish for a residential garden.",
  serviceType: "paving",
  price: "4250",
  depositPercent: "30",
  timeline: "Estimated 4-5 working days from agreed start date",
  tone: "formal"
};

const savedFormKey = "proposalcraft.form.v1";

function App() {
  const hostProposal = readHostProposal();
  const [form, setForm] = useState<FormState>(
    () => formFromHost() ?? readSavedForm() ?? initialForm
  );
  const [proposal, setProposal] = useState<Proposal | undefined>(hostProposal);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [explanation, setExplanation] = useState("");

  const canGenerate = useMemo(
    () =>
      form.projectDescription.trim().length >= 12 &&
      form.timeline.trim().length >= 2 &&
      Number.isFinite(Number(form.price)) &&
      Number(form.price) >= 0 &&
      (form.depositPercent.trim() === "" ||
        (Number.isFinite(Number(form.depositPercent)) &&
          Number(form.depositPercent) >= 0 &&
          Number(form.depositPercent) <= 100)),
    [form]
  );

  useEffect(() => {
    saveForm(form);
  }, [form]);

  async function handleGenerate() {
    await runProposalTool("generateProposal");
  }

  async function handleRegenerate() {
    await runProposalTool("regenerateProposal");
  }

  async function handleExplain() {
    setError("");
    setExplanation("");

    try {
      if (window.openai?.callTool) {
        const result = await window.openai.callTool("explainProposal", {
          serviceType: form.serviceType,
          tone: form.tone
        });
        const text =
          result.content?.find((item) => item.type === "text")?.text ??
          "ProposalCraft AI uses fixed templates and section rules.";
        setExplanation(text);
        return;
      }

      setExplanation(explainProposal(form.serviceType, form.tone).summary);
    } catch (toolError) {
      setError(toErrorMessage(toolError));
    }
  }

  async function runProposalTool(toolName: "generateProposal" | "regenerateProposal") {
    setIsGenerating(true);
    setError("");
    setExplanation("");

    try {
      const input = toProposalInput(form);

      if (window.openai?.callTool) {
        const result = await window.openai.callTool(toolName, input);
        const nextProposal = result.structuredContent?.proposal;
        const toolError = result.structuredContent?.error;

        if (toolError) {
          throw new Error(toolError);
        }

        if (!nextProposal) {
          throw new Error("The tool did not return a proposal.");
        }

        setProposal(nextProposal);
        await window.openai.setWidgetState?.({ form, proposal: nextProposal });
        return;
      }

      const nextProposal =
        toolName === "generateProposal"
          ? generateProposal(input)
          : regenerateProposal(input);
      setProposal(nextProposal);
    } catch (toolError) {
      setError(toErrorMessage(toolError));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="shell">
      <section className="workspace" aria-labelledby="app-title">
        <div className="intro">
          <p className="eyebrow">ProposalCraft AI</p>
          <h1 id="app-title">Create a client-ready service proposal.</h1>
          <p>
            Enter the job details, choose a service template, and generate a
            clean proposal your client can review right away.
          </p>
        </div>

        <form className="proposal-form" onSubmit={(event) => event.preventDefault()}>
          <label className="field">
            <span>Business name</span>
            <input
              value={form.businessName}
              onChange={(event) =>
                setForm({ ...form, businessName: event.target.value })
              }
              maxLength={120}
              placeholder="Your business"
            />
          </label>

          <label className="field">
            <span>Client name</span>
            <input
              value={form.clientName}
              onChange={(event) =>
                setForm({ ...form, clientName: event.target.value })
              }
              maxLength={120}
              placeholder="Client or company"
            />
          </label>

          <label className="field field-wide">
            <span>Project description</span>
            <textarea
              value={form.projectDescription}
              onChange={(event) =>
                setForm({ ...form, projectDescription: event.target.value })
              }
              rows={5}
              maxLength={2500}
            />
          </label>

          <label className="field">
            <span>Service type</span>
            <select
              value={form.serviceType}
              onChange={(event) =>
                setForm({ ...form, serviceType: event.target.value as ServiceType })
              }
            >
              {serviceTypes.map((serviceType) => (
                <option value={serviceType} key={serviceType}>
                  {serviceLabels[serviceType]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Price</span>
            <input
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              inputMode="decimal"
              placeholder="4250"
            />
          </label>

          <label className="field">
            <span>Timeline</span>
            <input
              value={form.timeline}
              onChange={(event) =>
                setForm({ ...form, timeline: event.target.value })
              }
              placeholder="Estimated 4-5 working days"
            />
          </label>

          <label className="field">
            <span>Deposit %</span>
            <input
              value={form.depositPercent}
              onChange={(event) =>
                setForm({ ...form, depositPercent: event.target.value })
              }
              inputMode="decimal"
              placeholder="30"
            />
          </label>

          <label className="field">
            <span>Tone</span>
            <select
              value={form.tone}
              onChange={(event) => setForm({ ...form, tone: event.target.value as Tone })}
            >
              {tones.map((tone) => (
                <option value={tone} key={tone}>
                  {toneLabels[tone]}
                </option>
              ))}
            </select>
          </label>

          <div className="actions">
            <button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
              {isGenerating ? "Generating..." : "Generate proposal"}
            </button>
            <button type="button" className="secondary" onClick={handleRegenerate} disabled={!canGenerate || isGenerating}>
              Regenerate
            </button>
            <button type="button" className="ghost" onClick={handleExplain}>
              Explain
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setForm(initialForm);
                setProposal(undefined);
                setError("");
                setExplanation("");
                removeSavedForm();
              }}
            >
              Reset
            </button>
          </div>
        </form>
        <p className="form-note">Inputs save on this device for the next proposal.</p>

        {error ? <p className="error" role="alert">{error}</p> : null}
        {explanation ? <p className="explanation">{explanation}</p> : null}
      </section>

      <ProposalCard proposal={proposal} />
    </main>
  );
}

function ProposalCard({ proposal }: { proposal?: Proposal }) {
  const [copyStatus, setCopyStatus] = useState("");
  const [emailStatus, setEmailStatus] = useState("");

  if (!proposal) {
    return (
      <aside className="output empty" aria-label="Proposal output">
        <p className="eyebrow">Output</p>
        <h2>Your proposal will appear here.</h2>
        <p>
          The finished draft includes overview, scope, timeline, pricing,
          payment terms, assumptions, upsells, and approval language.
        </p>
      </aside>
    );
  }

  return (
    <aside className="output" aria-label="Generated proposal">
      <div className="output-header">
        <div>
          <p className="eyebrow">{proposal.serviceLabel}</p>
          <h2>{proposal.title}</h2>
        </div>
        <div className="output-actions">
          <button
            type="button"
            className="copy"
            onClick={async () => {
              await copyProposal(proposal.clientReadyProposal);
              setCopyStatus("Copied");
              window.setTimeout(() => setCopyStatus(""), 1800);
            }}
          >
            {copyStatus || "Copy"}
          </button>
          <button
            type="button"
            className="download"
            onClick={() => downloadProposal(proposal)}
          >
            Download
          </button>
          <button type="button" className="print" onClick={() => window.print()}>
            PDF
          </button>
          <button
            type="button"
            className="copy-email"
            onClick={async () => {
              await copyProposal(proposal.followUpEmail);
              setEmailStatus("Email copied");
              window.setTimeout(() => setEmailStatus(""), 1800);
            }}
          >
            {emailStatus || "Copy email"}
          </button>
        </div>
      </div>

      <div className="sections">
        {proposal.sections.map((section) => (
          <section className="proposal-section" key={section.title}>
            <h3>{section.title}</h3>
            {Array.isArray(section.body) ? (
              <ul>
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>{section.body}</p>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}

function formFromHost(): FormState | undefined {
  const input = window.openai?.toolInput;

  if (!input) {
    return undefined;
  }

  return {
    projectDescription: String(input.projectDescription ?? initialForm.projectDescription),
    businessName: String(input.businessName ?? initialForm.businessName),
    clientName: String(input.clientName ?? initialForm.clientName),
    serviceType: isServiceType(input.serviceType)
      ? input.serviceType
      : initialForm.serviceType,
    price: String(input.price ?? initialForm.price),
    depositPercent: String(input.depositPercent ?? initialForm.depositPercent),
    timeline: String(input.timeline ?? initialForm.timeline),
    tone: isTone(input.tone) ? input.tone : initialForm.tone
  };
}

function readHostProposal(): Proposal | undefined {
  const output = window.openai?.toolOutput as
    | { proposal?: Proposal; structuredContent?: { proposal?: Proposal } }
    | undefined;

  return output?.proposal ?? output?.structuredContent?.proposal;
}

function readSavedForm(): FormState | undefined {
  try {
    const raw = localStorage.getItem(savedFormKey);
    const parsed = raw ? JSON.parse(raw) : undefined;

    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    return {
      businessName: String(parsed.businessName ?? initialForm.businessName),
      clientName: String(parsed.clientName ?? initialForm.clientName),
      projectDescription: String(
        parsed.projectDescription ?? initialForm.projectDescription
      ),
      serviceType: isServiceType(parsed.serviceType)
        ? parsed.serviceType
        : initialForm.serviceType,
      price: String(parsed.price ?? initialForm.price),
      depositPercent: String(parsed.depositPercent ?? initialForm.depositPercent),
      timeline: String(parsed.timeline ?? initialForm.timeline),
      tone: isTone(parsed.tone) ? parsed.tone : initialForm.tone
    };
  } catch {
    return undefined;
  }
}

function saveForm(formState: FormState) {
  try {
    localStorage.setItem(savedFormKey, JSON.stringify(formState));
  } catch {
    // Storage can be unavailable in restricted embeds; the app still works.
  }
}

function removeSavedForm() {
  try {
    localStorage.removeItem(savedFormKey);
  } catch {
    // Storage can be unavailable in restricted embeds; resetting state is enough.
  }
}

function toProposalInput(formState: FormState): ProposalInput {
  return {
    businessName: formState.businessName.trim() || undefined,
    clientName: formState.clientName.trim() || undefined,
    projectDescription: formState.projectDescription,
    serviceType: formState.serviceType,
    price: Number(formState.price),
    depositPercent:
      formState.depositPercent.trim() === ""
        ? undefined
        : Number(formState.depositPercent),
    timeline: formState.timeline,
    tone: formState.tone
  };
}

function isServiceType(value: unknown): value is ServiceType {
  return typeof value === "string" && serviceTypes.includes(value as ServiceType);
}

function isTone(value: unknown): value is Tone {
  return typeof value === "string" && tones.includes(value as Tone);
}

async function copyProposal(content: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function downloadProposal(proposal: Proposal) {
  const blob = new Blob([proposal.clientReadyProposal], {
    type: "text/markdown;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${slugify(proposal.title)}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "proposal";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
