"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ENTRY_POINTS, ENTRY_POINT_ORDER, EntryPoint } from "@/lib/workflow-engine";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

type FormState = {
  entryPoint: EntryPoint | null;
  claimNumber: string;
  carrier: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  dateOfLoss: string;
  description: string;
  policyNumber: string;
  carrierEstimateAmount: string;
  contractorEstimateAmount: string;
  propertyAddress: string;
  sourceSystem: string;
  internalNotes: string;
  submitting: boolean;
  error: string;
};

const INITIAL_FORM: FormState = {
  entryPoint: null,
  claimNumber: "",
  carrier: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  dateOfLoss: "",
  description: "",
  policyNumber: "",
  carrierEstimateAmount: "",
  contractorEstimateAmount: "",
  propertyAddress: "",
  sourceSystem: "",
  internalNotes: "",
  submitting: false,
  error: "",
};

export default function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  if (!open) return null;

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const reset = () => {
    setForm(INITIAL_FORM);
    onClose();
  };

  const goToClaim = (claimId: string) => {
    reset();
    router.push(`/admin/claims/${claimId}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.entryPoint) return;
    set({ submitting: true, error: "" });
    try {
      const num = (v: string) => (v === "" ? undefined : Number(v));

      switch (form.entryPoint) {
        case "new_claim":
        case "existing_claim": {
          const data = await apiFetch<{ id: string }>("/claims", {
            method: "POST",
            body: JSON.stringify({
              claimNumber: form.claimNumber,
              entryPoint: form.entryPoint,
              status: form.entryPoint === "existing_claim" ? "estimate_submitted" : "new",
              insuranceCompany: form.carrier || undefined,
              policyNumber: form.policyNumber || undefined,
              dateOfLoss: form.dateOfLoss || undefined,
              customerName: form.customerName || undefined,
              customerEmail: form.customerEmail || undefined,
              customerPhone: form.customerPhone || undefined,
              description: form.description || undefined,
            }),
          });
          goToClaim(data.id);
          break;
        }
        case "supplement_only": {
          const data = await apiFetch<{ claim: { id: string }; supplement: any }>(
            "/multi-entry/supplement-only",
            {
              method: "POST",
              body: JSON.stringify({
                claimNumber: form.claimNumber,
                carrier: form.carrier || undefined,
                policyNumber: form.policyNumber || undefined,
                dateOfLoss: form.dateOfLoss || undefined,
                customerName: form.customerName || undefined,
                customerEmail: form.customerEmail || undefined,
                customerPhone: form.customerPhone || undefined,
                description: form.description || undefined,
                carrierEstimateAmount: num(form.carrierEstimateAmount),
                contractorEstimateAmount: num(form.contractorEstimateAmount),
                internalNotes: form.internalNotes || undefined,
              }),
            },
          );
          goToClaim(data.claim.id);
          break;
        }
        case "imported": {
          const data = await apiFetch<{ claim: { id: string } }>("/multi-entry/import", {
            method: "POST",
            body: JSON.stringify({
              claimNumber: form.claimNumber,
              carrier: form.carrier || undefined,
              policyNumber: form.policyNumber || undefined,
              dateOfLoss: form.dateOfLoss || undefined,
              description: form.description || undefined,
              sourceSystem: form.sourceSystem || "external",
              customer: {
                name: form.customerName || undefined,
                email: form.customerEmail || undefined,
                phone: form.customerPhone || undefined,
              },
              property: form.propertyAddress
                ? { address: form.propertyAddress }
                : undefined,
            }),
          });
          goToClaim(data.claim.id);
          break;
        }
      }
    } catch (err: any) {
      set({ error: err.message || "Failed to create project" });
    } finally {
      set({ submitting: false });
    }
  };

  const selectEntryPoint = (entryPoint: EntryPoint) => {
    // Reset entry-point-specific auto-filled fields so switching back and forth
    // never leaks stale values (e.g. the supplement-only description) into
    // another entry point's form.
    const patch: Partial<FormState> = {
      entryPoint,
      description:
        entryPoint === "supplement_only"
          ? "Supplement-only project — no customer intake required."
          : "",
      sourceSystem: entryPoint === "imported" ? "external" : "",
    };
    set(patch);
  };

  const showField = (field: keyof FormState) => {
    switch (form.entryPoint) {
      case "supplement_only":
        return ["claimNumber", "carrier", "policyNumber", "carrierEstimateAmount", "contractorEstimateAmount", "internalNotes"].includes(field);
      case "imported":
        return ["claimNumber", "carrier", "policyNumber", "customerName", "customerEmail", "customerPhone", "propertyAddress", "sourceSystem"].includes(field);
      case "existing_claim":
        return ["claimNumber", "carrier", "policyNumber", "customerName", "customerEmail", "customerPhone", "dateOfLoss", "description"].includes(field);
      default:
        return ["claimNumber", "carrier", "policyNumber", "customerName", "customerEmail", "customerPhone", "dateOfLoss", "description"].includes(field);
    }
  };

  const inputCls =
    "w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors";
  const labelCls = "block mb-1 text-sm font-medium text-foreground";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-2xl border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-foreground">New Project</h2>
            <p className="text-sm text-muted-foreground">
              Enter the workflow at any stage — no fixed sequence required.
            </p>
          </div>
          <button
            onClick={reset}
            className="p-2 rounded hover:bg-accent text-muted-foreground transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: choose entry point */}
          {!form.entryPoint ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ENTRY_POINT_ORDER.map((ep) => {
                const meta = ENTRY_POINTS[ep];
                return (
                  <button
                    key={ep}
                    onClick={() => selectEntryPoint(ep)}
                    className="text-left p-4 rounded-xl border bg-muted/50 hover:bg-accent hover:border-primary transition-all group"
                  >
                    <div className="text-3xl mb-2">{meta.icon}</div>
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {meta.label}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {meta.description}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Step 2: streamlined form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {ENTRY_POINTS[form.entryPoint].icon}{" "}
                  {ENTRY_POINTS[form.entryPoint].label}
                </h3>
                <button
                  type="button"
                  onClick={() => set({ entryPoint: null, error: "" })}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {showField("claimNumber") && (
                  <div>
                    <label className={labelCls} htmlFor="np-claimNumber">Claim Number *</label>
                    <input
                      id="np-claimNumber"
                      className={inputCls}
                      value={form.claimNumber}
                      onChange={(e) => set({ claimNumber: e.target.value })}
                      required
                      placeholder="e.g. CL-2024-001"
                    />
                  </div>
                )}
                {showField("carrier") && (
                  <div>
                    <label className={labelCls} htmlFor="np-carrier">Insurance Carrier</label>
                    <input
                      id="np-carrier"
                      className={inputCls}
                      value={form.carrier}
                      onChange={(e) => set({ carrier: e.target.value })}
                      placeholder="e.g. State Farm"
                    />
                  </div>
                )}
                {showField("policyNumber") && (
                  <div>
                    <label className={labelCls} htmlFor="np-policy">Policy Number</label>
                    <input
                      id="np-policy"
                      className={inputCls}
                      value={form.policyNumber}
                      onChange={(e) => set({ policyNumber: e.target.value })}
                    />
                  </div>
                )}
                {showField("customerName") && (
                  <div>
                    <label className={labelCls} htmlFor="np-customerName">Customer Name</label>
                    <input
                      id="np-customerName"
                      className={inputCls}
                      value={form.customerName}
                      onChange={(e) => set({ customerName: e.target.value })}
                    />
                  </div>
                )}
                {showField("customerEmail") && (
                  <div>
                    <label className={labelCls} htmlFor="np-customerEmail">Customer Email</label>
                    <input
                      id="np-customerEmail"
                      type="email"
                      className={inputCls}
                      value={form.customerEmail}
                      onChange={(e) => set({ customerEmail: e.target.value })}
                    />
                  </div>
                )}
                {showField("customerPhone") && (
                  <div>
                    <label className={labelCls} htmlFor="np-customerPhone">Customer Phone</label>
                    <input
                      id="np-customerPhone"
                      className={inputCls}
                      value={form.customerPhone}
                      onChange={(e) => set({ customerPhone: e.target.value })}
                    />
                  </div>
                )}
                {showField("dateOfLoss") && (
                  <div>
                    <label className={labelCls} htmlFor="np-dateOfLoss">Date of Loss</label>
                    <input
                      id="np-dateOfLoss"
                      type="date"
                      className={inputCls}
                      value={form.dateOfLoss}
                      onChange={(e) => set({ dateOfLoss: e.target.value })}
                    />
                  </div>
                )}
                {showField("carrierEstimateAmount") && (
                  <div>
                    <label className={labelCls} htmlFor="np-carrierEst">Carrier Estimate ($)</label>
                    <input
                      id="np-carrierEst"
                      type="number"
                      min="0"
                      className={inputCls}
                      value={form.carrierEstimateAmount}
                      onChange={(e) => set({ carrierEstimateAmount: e.target.value })}
                      placeholder="Approved amount"
                    />
                  </div>
                )}
                {showField("contractorEstimateAmount") && (
                  <div>
                    <label className={labelCls} htmlFor="np-contractorEst">Contractor Estimate ($)</label>
                    <input
                      id="np-contractorEst"
                      type="number"
                      min="0"
                      className={inputCls}
                      value={form.contractorEstimateAmount}
                      onChange={(e) => set({ contractorEstimateAmount: e.target.value })}
                      placeholder="Our estimate"
                    />
                  </div>
                )}
                {showField("propertyAddress") && (
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="np-property">Property Address</label>
                    <input
                      id="np-property"
                      className={inputCls}
                      value={form.propertyAddress}
                      onChange={(e) => set({ propertyAddress: e.target.value })}
                      placeholder="123 Main St, Springfield"
                    />
                  </div>
                )}
                {showField("sourceSystem") && (
                  <div>
                    <label className={labelCls} htmlFor="np-source">Source System</label>
                    <input
                      id="np-source"
                      className={inputCls}
                      value={form.sourceSystem}
                      onChange={(e) => set({ sourceSystem: e.target.value })}
                      placeholder="e.g. Xactimate, internal, legacy"
                    />
                  </div>
                )}
                {showField("internalNotes") && (
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="np-notes">Internal Notes</label>
                    <textarea
                      id="np-notes"
                      className={inputCls}
                      rows={2}
                      value={form.internalNotes}
                      onChange={(e) => set({ internalNotes: e.target.value })}
                    />
                  </div>
                )}
                {showField("description") && (
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="np-desc">Description</label>
                    <textarea
                      id="np-desc"
                      className={inputCls}
                      rows={2}
                      value={form.description}
                      onChange={(e) => set({ description: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {form.error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded p-2">
                  {form.error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={form.submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {form.submitting ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
