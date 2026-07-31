import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { StatusPill } from "@/components/atlas/StatusPill";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { Building2, Plus, Search, Users, FileText, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_app/companies")({
  head: () => ({ meta: [{ title: "Companies — Atlas" }] }),
  component: CompaniesPage,
});

const COMPANIES = [
  { name: "NPP Roofing & Restoration", city: "Austin, TX", claims: 42, revenue: "$1.28M", contacts: 14, status: "Active", tone: "green" as const, initials: "NP", grad: "bg-gradient-purple" },
  { name: "Skyline Exteriors", city: "Denver, CO", claims: 28, revenue: "$820K", contacts: 9, status: "Active", tone: "green" as const, initials: "SE", grad: "bg-gradient-cyan" },
  { name: "Coastal Solar Group", city: "Tampa, FL", claims: 19, revenue: "$612K", contacts: 6, status: "Onboarding", tone: "cyan" as const, initials: "CS", grad: "bg-gradient-green" },
  { name: "Blue Ridge Restoration", city: "Nashville, TN", claims: 33, revenue: "$945K", contacts: 11, status: "Active", tone: "green" as const, initials: "BR", grad: "bg-gradient-purple" },
  { name: "Desert Peak Roofing", city: "Phoenix, AZ", claims: 15, revenue: "$490K", contacts: 5, status: "Paused", tone: "amber" as const, initials: "DP", grad: "bg-gradient-cyan" },
  { name: "Northstar Exteriors", city: "Minneapolis, MN", claims: 22, revenue: "$710K", contacts: 8, status: "Active", tone: "green" as const, initials: "NE", grad: "bg-gradient-green" },
];

function CompaniesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Companies"
        description="Contractors and partners connected to your Atlas workspace."
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input className="h-9 pl-9 pr-3 rounded-lg bg-white/[0.02] border border-white/10 text-xs w-64" placeholder="Search companies..." />
            </div>
            <button className="h-9 px-3 rounded-lg bg-gradient-cyan text-primary-foreground text-xs font-medium flex items-center gap-2"><Plus className="h-3.5 w-3.5" /> New company</button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {COMPANIES.map((c) => (
          <div key={c.name} className="group glass rounded-2xl p-5 hover:border-cyan/20 transition cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className={`h-12 w-12 rounded-xl ${c.grad} grid place-items-center text-sm font-semibold text-primary-foreground`}>{c.initials}</div>
              <StatusPill tone={c.tone}>{c.status}</StatusPill>
            </div>
            <h3 className="font-semibold tracking-tight text-foreground">{c.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{c.city}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Claims</p>
                <p className="text-sm font-semibold mt-0.5 text-cyan">{c.claims}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p>
                <p className="text-sm font-semibold mt-0.5">{c.revenue}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contacts</p>
                <p className="text-sm font-semibold mt-0.5">{c.contacts}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan" />
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium">All Companies</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                <th className="text-left font-medium px-5 py-3">Company</th>
                <th className="text-left font-medium py-3"><FileText className="inline h-3 w-3 mr-1" />Claims</th>
                <th className="text-left font-medium py-3"><DollarSign className="inline h-3 w-3 mr-1" />Revenue</th>
                <th className="text-left font-medium py-3"><Users className="inline h-3 w-3 mr-1" />Contacts</th>
                <th className="text-left font-medium py-3 pr-5">Status</th>
              </tr>
            </thead>
            <tbody>
              {COMPANIES.map((c) => (
                <tr key={c.name} className="border-t border-white/5 hover:bg-white/[0.02] transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg ${c.grad} grid place-items-center text-[10px] font-semibold text-primary-foreground`}>{c.initials}</div>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-cyan font-medium">{c.claims}</td>
                  <td>{c.revenue}</td>
                  <td className="text-muted-foreground">{c.contacts}</td>
                  <td className="pr-5"><StatusPill tone={c.tone}>{c.status}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AtlasInsights
          items={[
            { text: "Skyline Exteriors is trending +32% in supplement approvals this month.", tone: "green" },
            { text: "Desert Peak Roofing hasn't logged activity in 8 days.", tone: "purple" },
            { text: "NPP Roofing has the highest recovery rate in your portfolio.", tone: "cyan" },
          ]}
          action="Open partner intelligence"
        />
      </div>
    </>
  );
}
