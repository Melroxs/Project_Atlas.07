/**
 * Supplement generation prompt templates.
 *
 * Single source of truth for supplement AI prompts — reuse these instead of
 * duplicating prompt text across the codebase.
 */

export interface SupplementPromptContext {
  claim: Record<string, unknown>;
  property?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  interviewResponses?: Record<string, unknown>;
  adjuster?: Record<string, unknown>;
  documents?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  existingSupplements?: Array<Record<string, unknown>>;
  activityTimeline?: Array<Record<string, unknown>>;
}

/** System prompt for the supplement analyst role. */
export function buildSupplementSystemPrompt(): string {
  return `You are an expert insurance restoration supplement analyst with deep knowledge of:
- Insurance claim processing and supplement workflows
- Construction damage assessment and repair methodologies
- Xactimate and industry-standard pricing
- Carrier supplement review processes
- Documentation requirements for successful supplement approval

Your role is to analyze claim information and generate professional supplement recommendations that:
1. Identify missing damage observations
2. Recommend appropriate line items with quantities and pricing
3. Provide clear justification for each recommendation
4. Link recommendations to supporting evidence
5. Flag missing information that could impact approval
6. Assess confidence levels for each recommendation
7. Identify potential risks or issues

Always be thorough, accurate, and conservative in your estimates. Never suggest items without evidence.
Provide clear explanations for why each recommendation is made.`;
}

function formatSection(title: string, lines: string[]): string {
  return `## ${title}\n${lines.join("\n")}`;
}

/** Build the full user prompt for supplement recommendation generation. */
export function buildSupplementPrompt(context: SupplementPromptContext): string {
  const sections: string[] = [];

  if (context.claim) {
    const c = context.claim as Record<string, any>;
    sections.push(
      formatSection("CLAIM INFORMATION", [
        `- Claim Number: ${c.claimNumber ?? "N/A"}`,
        `- Insurance Company: ${c.insuranceCompany ?? "N/A"}`,
        `- Policy Number: ${c.policyNumber ?? "N/A"}`,
        `- Date of Loss: ${c.dateOfLoss ?? "N/A"}`,
        `- Cause of Loss: ${c.causeOfLoss ?? "N/A"}`,
        `- Description: ${c.description ?? "N/A"}`,
        `- Status: ${c.status ?? "N/A"}`,
        `- Deductible: ${c.deductible ? `$${c.deductible}` : "N/A"}`,
        `- Estimated Value: ${c.estimatedValue ? `$${c.estimatedValue}` : "N/A"}`,
        `- Approved Value: ${c.approvedValue ? `$${c.approvedValue}` : "N/A"}`,
      ])
    );
  }

  if (context.property) {
    const p = context.property as Record<string, any>;
    sections.push(
      formatSection("PROPERTY INFORMATION", [
        `- Address: ${p.address ?? "N/A"}`,
        `- Property Type: ${p.type ?? "N/A"}`,
        `- Year Built: ${p.yearBuilt ?? "N/A"}`,
        `- Square Footage: ${p.squareFootage ?? "N/A"}`,
        `- Occupancy: ${p.occupancy ?? "N/A"}`,
      ])
    );
  }

  if (context.customer) {
    const cu = context.customer as Record<string, any>;
    sections.push(
      formatSection("CUSTOMER INFORMATION", [
        `- Name: ${cu.name ?? "N/A"}`,
        `- Phone: ${cu.phone ?? "N/A"}`,
        `- Email: ${cu.email ?? "N/A"}`,
        `- Address: ${cu.address ?? "N/A"}`,
      ])
    );
  }

  if (context.interviewResponses) {
    const ir = context.interviewResponses as Record<string, any>;
    const responses = ir.responses || {};
    const responseLines = Object.entries(responses).map(
      ([key, value]) => `- ${key}: ${JSON.stringify(value)}`
    );
    sections.push(
      formatSection("INTERVIEW RESPONSES", [
        `- Interview Number: ${ir.interviewNumber ?? "N/A"}`,
        `- Template: ${ir.templateName ?? "N/A"}`,
        `- Completed: ${ir.completedAt ?? "N/A"}`,
        "",
        "Responses:",
        ...(responseLines.length ? responseLines : ["No interview responses available"]),
      ])
    );
  }

  if (context.adjuster) {
    const a = context.adjuster as Record<string, any>;
    sections.push(
      formatSection("ADJUSTER INFORMATION", [
        `- Name: ${a.name ?? "N/A"}`,
        `- Phone: ${a.phone ?? "N/A"}`,
        `- Email: ${a.email ?? "N/A"}`,
        `- Company: ${a.company ?? "N/A"}`,
      ])
    );
  }

  if (context.existingSupplements && context.existingSupplements.length > 0) {
    const lines = (context.existingSupplements as Array<Record<string, any>>).map(
      (sup) => {
        const items = (sup.lineItems || [])
          .map(
            (item: any) =>
              `  - ${item.description}: ${item.quantity} ${item.unit} @ $${item.unitPrice} = $${item.totalPrice}`
          )
          .join("\n");
        return `- Supplement ${sup.supplementNumber} (${sup.status})\n  Requested: $${sup.requestedAmount}\n  Approved: $${sup.approvedAmount}\n  Line Items:\n${items || "  No line items"}`;
      }
    );
    sections.push(formatSection("EXISTING SUPPLEMENTS", lines));
  }

  if (context.documents && context.documents.length > 0) {
    const lines = (context.documents as Array<Record<string, any>>).map(
      (doc) => `- ${doc.name} (${doc.type || "Unknown"}) - Uploaded: ${doc.uploadedAt || "N/A"}`
    );
    sections.push(formatSection("DOCUMENTS", lines));
  }

  if (context.photos && context.photos.length > 0) {
    const lines = (context.photos as Array<Record<string, any>>).map(
      (photo) => `- ${photo.description || "Untitled"} - Location: ${photo.location || "N/A"} - Uploaded: ${photo.uploadedAt || "N/A"}`
    );
    sections.push(formatSection("PHOTOS", lines));
  }

  if (context.activityTimeline && context.activityTimeline.length > 0) {
    const lines = (context.activityTimeline as Array<Record<string, any>>)
      .slice(-10)
      .map(
        (activity) =>
          `- ${activity.createdAt || "N/A"}: ${activity.description || "No description"} by ${activity.userName || "Unknown"}`
      );
    sections.push(formatSection("RECENT ACTIVITY", lines));
  }

  sections.push(
    formatSection(
      "TASK",
      [
        "Based on the information above, generate a comprehensive supplement recommendation in JSON format with the following structure:",
        "",
        '{\n  "missingDamageObservations": [\n    { "id": "unique-id", "location": "e.g., \'Roof - South Slope\'", "description": "Detailed description of damage", "severity": "low|medium|high", "confidence": 0.0-1.0, "evidence": ["list of evidence sources"], "interviewAnswers": ["list of relevant interview answers"] }\n  ],\n  "recommendedLineItems": [\n    { "id": "unique-id", "description": "Line item description", "category": "e.g., \'Roofing\', \'Drywall\', \'Plumbing\'", "suggestedQuantity": 0, "suggestedUnit": "e.g., \'SQ\', \'LF\', \'EA\'", "suggestedUnitPrice": 0, "suggestedTotalPrice": 0, "confidence": 0.0-1.0, "justification": "Why this item is recommended", "evidence": ["list of evidence sources"], "interviewAnswers": ["list of relevant interview answers"], "documents": ["list of relevant documents"] }\n  ],\n  "suggestedQuantities": [\n    { "lineItemId": "reference to line item", "currentQuantity": 0, "suggestedQuantity": 0, "reason": "Explanation for quantity change", "confidence": 0.0-1.0 }\n  ],\n  "suggestedPricing": [\n    { "lineItemId": "reference to line item", "currentUnitPrice": 0, "suggestedUnitPrice": 0, "reason": "Explanation for pricing", "confidence": 0.0-1.0, "marketData": "Market data reference if available" }\n  ],\n  "supportingJustification": "Overall justification for the supplement",\n  "documentationChecklist": [\n    { "id": "unique-id", "description": "Documentation needed", "type": "photo|document|estimate|report", "status": "required|recommended|optional", "reason": "Why this documentation is needed" }\n  ],\n  "missingInformation": [\n    { "id": "unique-id", "description": "What information is missing", "impact": "low|medium|high", "source": "Where this information should come from" }\n  ],\n  "questionsForEstimator": ["Question 1"],\n  "warnings": ["Warning 1"],\n  "evidenceLinks": [\n    { "recommendationId": "r...", "documentId": "d...", "documentType": "...", "relevance": "high|medium|low", "description": "..." }\n  ],\n  "aiExplanation": {\n    "overallApproach": "Overall approach taken",\n    "dataSourcesAnalyzed": ["List of data sources"],\n    "confidenceFactors": ["Factors affecting confidence"],\n    "limitations": ["Known limitations"],\n    "recommendations": ["Additional recommendations"]\n  }\n}',
        "",
        "Important guidelines:",
        "- Only recommend items with clear evidence from the provided information",
        "- Use conservative estimates - it's better to be slightly under than over",
        "- Provide specific justifications for each recommendation",
        "- Link each recommendation to specific evidence sources",
        "- Flag any information gaps that could impact approval",
        "- Assess confidence honestly - low confidence items should be flagged",
        "- Consider carrier approval criteria in your recommendations",
        "- Ensure pricing aligns with industry standards",
        "- Identify any potential red flags or issues",
      ]
    )
  );

  return sections.join("\n\n");
}
