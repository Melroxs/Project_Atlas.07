'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { subscribeDemoChanged } from '@/lib/demo-events';

interface Persona {
  id: string;
  customerName: string;
  claimNumber: string;
  insuranceCompany: string;
  damageType: string;
  status: string;
  workflow: 'A' | 'B';
  story: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  supplements: Array<{
    supplementNumber: string;
    status: string;
    requestedAmount: number;
    approvedAmount: number;
  }>;
  claimId: string;
  customerId: string;
  propertyId: string;
}

export default function PersonaCards() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPersonas();
    const unsubscribe = subscribeDemoChanged(() => fetchPersonas());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPersonas = async () => {
    try {
      const response = await apiFetch('/demo/personas');
      setPersonas((response as { personas: Persona[] }).personas);
    } catch (error) {
      console.error('Error fetching personas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaClick = (persona: Persona) => {
    // Navigate to the claim detail page
    router.push(`/admin/claims/${persona.claimId}`);
  };

  const getWorkflowLabel = (workflow: string) => {
    return workflow === 'A' ? 'Workflow A' : 'Workflow B';
  };

  const getWorkflowDescription = (workflow: string) => {
    return workflow === 'A' 
      ? 'Customer already filed claim'
      : 'Contractor discovers damage';
  };

  const getEstimatedValue = (persona: Persona) => {
    const totalApproved = persona.supplements.reduce(
      (sum, s) => sum + (s.approvedAmount || 0),
      0
    );
    return totalApproved > 0 ? `$${totalApproved.toLocaleString()}` : 'Pending';
  };

  if (loading) {
    return (
      <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-[var(--neutral-gray-200)] rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-[var(--neutral-gray-200)] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6">Demo Personas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map((persona) => (
          <button
            key={persona.id}
            onClick={() => handlePersonaClick(persona)}
            className="text-left bg-[var(--background-alt)] hover:bg-[var(--neutral-gray-100)] rounded-xl border border-[var(--neutral-gray-200)] hover:border-[var(--brand-cyan)] transition-all duration-300 hover:shadow-lg group"
          >
            {/* Property Photo Placeholder */}
            <div className="h-32 bg-gradient-to-br from-[var(--brand-cyan)]/20 to-[var(--brand-purple)]/20 rounded-t-xl flex items-center justify-center">
              <span className="text-4xl">🏠</span>
            </div>

            <div className="p-5 space-y-3">
              {/* Customer Name & Status */}
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--brand-cyan)] transition-colors">
                  {persona.customerName}
                </h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${ persona.status === 'approved' || persona.status === 'paid' ? 'bg-green-100 text-green-800' : persona.status === 'denied' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800' }`}>
                  {persona.status}
                </span>
              </div>

              {/* Insurance Company & Claim Number */}
              <div className="space-y-1">
                <p className="text-sm text-[var(--neutral-gray-600)]">
                  {persona.insuranceCompany}
                </p>
                <p className="text-xs text-[var(--neutral-gray-500)] font-mono">
                  {persona.claimNumber}
                </p>
              </div>

              {/* Workflow Badge */}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${ persona.workflow === 'A' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800' }`}>
                  {getWorkflowLabel(persona.workflow)}
                </span>
                <span className="text-xs text-[var(--neutral-gray-500)]">
                  {getWorkflowDescription(persona.workflow)}
                </span>
              </div>

              {/* Damage Type */}
              <p className="text-sm text-[var(--neutral-gray-600)]">
                {persona.damageType}
              </p>

              {/* Estimated Value */}
              <div className="pt-2 border-t border-[var(--neutral-gray-200)]">
                <p className="text-xs text-[var(--neutral-gray-500)]">Estimated Value</p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {getEstimatedValue(persona)}
                </p>
              </div>

              {/* Story Preview */}
              <p className="text-sm text-[var(--neutral-gray-500)] line-clamp-2">
                {persona.story}
              </p>

              {/* Click Indicator */}
              <div className="flex items-center justify-center pt-2 text-[var(--brand-cyan)] opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-sm font-medium">View Claim →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
