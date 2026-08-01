// packages/claim-intelligence/src/knowledge-graph.ts
import { ClaimBundle, KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from './types';

let edgeSeq = 0;

/**
 * Extend the Evidence Graph into a complete Claim Knowledge Graph.
 * Every entity is a navigable node; edges capture typed relationships so any
 * AI recommendation can be explained by traversing the graph.
 */
export function buildKnowledgeGraph(bundle: ClaimBundle): KnowledgeGraph {
  edgeSeq = 0;
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  // Nodes are keyed by type + unique ref (document/photo ids, stable labels)
  // so two entities that share a label never collapse into one node id.
  const seen = new Set<string>();
  const nodeId = (type: string, ref: string) => `${type}:${ref}`;
  const addNode = (n: Omit<KnowledgeNode, 'id'>, ref: string) => {
    const id = nodeId(n.type, ref);
    if (seen.has(id)) return id;
    seen.add(id);
    nodes.push({ ...n, id });
    return id;
  };
  const addEdge = (source: string, target: string, relation: string, strength = 1) => {
    edges.push({ id: `edge-${++edgeSeq}`, source, target, relation, strength });
  };

  const claimId = addNode({ type: 'claim', label: bundle.claimNumber, summary: bundle.description || `Claim ${bundle.claimNumber} (${bundle.status})` }, bundle.claimId);

  // Customer
  if (bundle.customerName || bundle.customerEmail) {
    const customerId = addNode(
      {
        type: 'customer',
        label: bundle.customerName || bundle.customerEmail || 'Customer',
        summary: [bundle.customerEmail, bundle.customerPhone].filter(Boolean).join(' · ') || undefined,
      },
      bundle.customerEmail || bundle.customerName || 'customer'
    );
    addEdge(claimId, customerId, 'belongs_to');
  }

  // Property
  if (bundle.propertyId || bundle.property) {
    const prop = bundle.property;
    const propertyId = addNode(
      {
        type: 'property',
        label: prop?.address ? `${prop.address}${prop.city ? `, ${prop.city}` : ''}` : 'Property',
        summary: [prop?.state, prop?.zip].filter(Boolean).join(' ') || undefined,
      },
      bundle.propertyId || 'property'
    );
    addEdge(claimId, propertyId, 'located_at');
  }

  // Policy
  if (bundle.policyNumber) {
    const policyId = addNode({ type: 'policy', label: bundle.policyNumber, reference: bundle.policyNumber }, bundle.policyNumber);
    addEdge(claimId, policyId, 'governed_by');
  }

  // Carrier
  if (bundle.insuranceCompany) {
    const carrierId = addNode({ type: 'carrier', label: bundle.insuranceCompany }, bundle.insuranceCompany);
    addEdge(claimId, carrierId, 'insured_by');
  }

  // Documents (incl. photos, estimates, policy docs)
  for (const d of bundle.documents) {
    if (d.isPhoto) {
      const photoId = addNode({ type: 'photo', label: d.fileName, reference: d.url, summary: 'Photo evidence' }, d.id);
      addEdge(claimId, photoId, 'has_photo');
      if (bundle.propertyId) {
        const propNode = nodes.find((n) => n.type === 'property');
        if (propNode) addEdge(propNode.id, photoId, 'depicts');
      }
    } else {
      const docType: KnowledgeNode['type'] = d.isEstimate
        ? 'estimate'
        : d.isPolicy
          ? 'policy'
          : 'document';
      const docId = addNode({ type: docType, label: d.fileName, reference: d.url, summary: d.isSigned ? 'Signed' : 'Unsigned' }, d.id);
      addEdge(claimId, docId, d.isEstimate ? 'has_estimate' : 'has_document');
      if (d.isEstimate && d.isCarrierDocument) {
        const carrierNode = nodes.find((n) => n.type === 'carrier');
        if (carrierNode) addEdge(carrierNode.id, docId, 'issued');
      }
    }
  }

  // Supplements
  for (const s of bundle.supplements) {
    const supId = addNode(
      {
        type: 'supplement',
        label: s.supplementNumber,
        summary: `${s.status}${s.requestedAmount != null ? ` · $${s.requestedAmount}` : ''}`,
      },
      s.id
    );
    addEdge(claimId, supId, 'has_supplement');
    if (bundle.insuranceCompany) {
      const carrierNode = nodes.find((n) => n.type === 'carrier');
      if (carrierNode) addEdge(supId, carrierNode.id, s.responseDate ? 'responded_by' : 'awaiting');
    }
  }

  // Interviews → inspection
  for (const i of bundle.interviews) {
    const inspId = addNode({ type: 'inspection', label: `Interview ${i.id.slice(0, 8)}`, summary: `Status: ${i.status}` }, i.id);
    addEdge(claimId, inspId, 'has_inspection');
  }

  // Communications
  for (const c of bundle.communications) {
    const commId = addNode({ type: 'communication', label: `${c.source} (${c.createdAt.slice(0, 10)})`, summary: c.content.slice(0, 120) }, c.id);
    addEdge(claimId, commId, 'has_communication');
  }

  // Evidence links → evidence nodes
  for (const l of bundle.evidenceLinks) {
    const evId = addNode(
      {
        type: 'evidence',
        label: `Evidence ${l.id.slice(0, 8)}`,
        summary: `strength ${l.strengthScore ?? 'n/a'}`,
      },
      l.id
    );
    addEdge(claimId, evId, 'supported_by');
    const targetDoc = bundle.documents.find((d) => d.id === l.documentId);
    if (targetDoc) {
      const docNode = nodes.find((n) => n.label === targetDoc.fileName);
      if (docNode) addEdge(evId, docNode.id, 'references', Number(l.strengthScore ?? 0.5));
    }
  }

  return { nodes, edges };
}
