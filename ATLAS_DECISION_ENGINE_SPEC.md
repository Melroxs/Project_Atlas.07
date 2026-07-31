# Atlas Decision Engine Specification

**Version:** 1.0  
**Date:** July 25, 2026  
**Purpose:** Define the "brain" of Atlas - how claim data transforms into evidence-backed supplement recommendations

---

## Executive Summary

The Atlas Decision Engine is the core intelligence layer that transforms uploaded claim data into compliant, evidence-backed supplement recommendations. This specification defines the complete data flow from claim intake to supplement package generation, including confidence scoring, compliance validation, and human review requirements.

**Core Principle:** Every recommendation must be explainable, evidence-backed, and reviewable.

---

## Architecture Overview

```
Claims → Document Intelligence → Atlas Decision Engine → Evidence Graph → Compliance Validator → Human Review → Supplement Package Generator
```

### Core Services

1. **Claims Service** - Claim intake and management
2. **Document Intelligence** - Document processing and content extraction
3. **Atlas Decision Engine** - Core AI analysis and recommendation generation
4. **Evidence Graph** - Evidence linking and traceability
5. **Compliance Validator** - Compliance checks and validation
6. **Human Review** - Review workflow and approval
7. **Supplement Package Generator** - Package creation and export

---

## Decision Engine Pipeline

### Stage 1: Data Intake

**Input Sources:**
- Claim metadata (claim number, insurance company, policy number, date of loss, cause of loss)
- Property information (address, type, year built, square footage, occupancy)
- Customer information (name, phone, email, address)
- Interview responses (FNOL data, inspection notes)
- Documents (estimates, carrier correspondence, reports)
- Photos (damage photos, progress photos)
- Existing supplements (previous supplement history)
- Activity timeline (claim history and events)

**Data Processing:**
1. Validate data completeness
2. Normalize data formats
3. Extract document content (PDF text, OCR)
4. Extract photo metadata (EXIF, GPS, timestamps)
5. Link related entities (claim ↔ property ↔ customer ↔ documents ↔ photos)
6. Build initial context graph

**Output:** Structured claim context object with all linked data

---

### Stage 2: Document Intelligence

**Input:** Raw documents and photos from Stage 1

**Processing:**

**Document Analysis:**
- Extract text from PDFs using pdf-parse
- Apply OCR to scanned documents using Tesseract.js
- Parse document structure (sections, tables, headers)
- Identify document types (estimate, carrier letter, report, etc.)
- Extract key data points (amounts, dates, line items)
- Store extracted content for AI analysis

**Photo Analysis:**
- Extract EXIF metadata (camera, timestamp, GPS)
- Generate thumbnails for preview
- Apply AI vision analysis (OpenAI Vision API) for:
  - Damage detection (location, severity, type)
  - Material identification
  - Measurement estimation
  - Quality assessment
- Categorize photos by type (damage, repair, progress, reference)
- Tag photos with location and description

**Output:** Enhanced document and photo objects with extracted content and analysis

---

### Stage 3: Atlas Decision Engine

**Input:** Structured claim context from Stage 1 + enhanced documents/photos from Stage 2

**Processing:**

**3.1 Context Assembly**
Build comprehensive prompt context including:
- Claim details (number, carrier, policy, loss info)
- Property details (address, type, age, size)
- Customer details
- Interview responses (structured FNOL data)
- Document content (extracted text, key data points)
- Photo analysis (damage detections, locations, metadata)
- Existing supplements (previous submissions, approvals, rejections)
- Activity timeline (claim history, events, communications)

**3.2 AI Analysis**
Invoke AI provider (OpenAI GPT-4) with:
- System prompt defining role as expert insurance restoration supplement analyst
- User prompt with assembled context
- Task instructions to generate JSON-structured recommendations
- Temperature: 0.7 (balanced creativity and reliability)
- Max tokens: 4000 (comprehensive analysis)

**3.3 Response Parsing**
Parse AI response into structured recommendations:
- Extract JSON from response
- Validate required fields
- Default missing optional fields
- Calculate confidence and risk scores
- Link recommendations to evidence sources

**3.4 Recommendation Generation**
Generate structured recommendations including:

**Missing Damage Observations:**
```typescript
{
  id: string,
  location: string,              // e.g., "Roof - South Slope"
  description: string,           // Detailed damage description
  severity: 'low' | 'medium' | 'high',
  confidence: number,           // 0.0-1.0
  evidence: string[],            // Document/photo references
  interviewAnswers: string[]     // Supporting interview responses
}
```

**Recommended Line Items:**
```typescript
{
  id: string,
  description: string,           // Line item description
  category: string,              // e.g., "Roofing", "Drywall"
  suggestedQuantity: number,
  suggestedUnit: string,         // e.g., "SQ", "LF", "EA"
  suggestedUnitPrice: number,
  suggestedTotalPrice: number,
  confidence: number,           // 0.0-1.0
  justification: string,         // Why this item is recommended
  evidence: string[],            // Document/photo references
  interviewAnswers: string[],   // Supporting interview responses
  documents: string[]            // Document IDs
}
```

**Supporting Justification:**
- Overall rationale for the supplement
- Summary of findings
- Total estimated recoverable revenue

**Documentation Checklist:**
```typescript
{
  id: string,
  description: string,           // What documentation is needed
  type: 'photo' | 'document' | 'estimate' | 'report',
  status: 'required' | 'recommended' | 'optional',
  reason: string                 // Why this is needed
}
```

**Missing Information:**
```typescript
{
  id: string,
  description: string,           // What information is missing
  impact: 'low' | 'medium' | 'high',
  source: string                 // Where this should come from
}
```

**Evidence Links:**
```typescript
{
  recommendationId: string,      // Reference to recommendation
  documentId: string,           // Reference to document
  documentType: string,         // Type of evidence
  relevance: 'high' | 'medium' | 'low',
  description: string            // How this supports the recommendation
}
```

**AI Explanation:**
```typescript
{
  overallApproach: string,      // Analysis methodology
  dataSourcesAnalyzed: string[], // List of data sources used
  confidenceFactors: string[],  // Factors affecting confidence
  limitations: string[],        // Known limitations
  recommendations: string[]    // Additional recommendations
}
```

**Output:** Structured supplement recommendations with evidence links

---

### Stage 4: Evidence Graph

**Input:** AI recommendations from Stage 3 + document/photo metadata from Stage 2

**Processing:**

**4.1 Evidence Extraction**
Extract evidence references from AI recommendations:
- Parse document IDs from recommendation evidence arrays
- Parse photo IDs from recommendation evidence arrays
- Parse interview answer references
- Validate that referenced documents/photos exist
- Calculate evidence strength scores

**4.2 Evidence Linking**
Create evidence link records:
```typescript
{
  id: string,
  recommendationId: string,      // Reference to recommendation
  documentId: string?,          // Reference to document (if applicable)
  photoId: string?,             // Reference to photo (if applicable)
  interviewAnswerId: string?,   // Reference to interview answer (if applicable)
  relevance: 'high' | 'medium' | 'low',
  description: string,          // How this evidence supports the recommendation
  strengthScore: number,        // 0.0-1.0
  createdAt: timestamp,
  createdBy: string
}
```

**4.3 Evidence Validation**
Validate evidence completeness:
- Check if required evidence exists for each recommendation
- Flag recommendations with missing evidence
- Calculate overall evidence strength score
- Identify evidence gaps

**4.4 Evidence Graph Construction**
Build evidence graph showing:
- Recommendations as nodes
- Evidence as linked nodes
- Strength of connections
- Evidence type indicators
- Missing evidence warnings

**Output:** Evidence graph with validated links and strength scores

---

### Stage 5: Compliance Validator

**Input:** AI recommendations from Stage 3 + evidence graph from Stage 4

**Processing:**

**5.1 Compliance Rules**
Apply lightweight compliance checks:

**Fraud Detection:**
- Check for fabricated damage (no evidence)
- Check for unsupported measurements
- Check for inflated quantities
- Check for unrealistic pricing
- Flag suspicious patterns

**Regulatory Compliance:**
- Check for state-specific requirements (if configured)
- Check for licensing requirements
- Check for code compliance requirements
- Flag regulatory issues

**Carrier Compliance:**
- Check for carrier-specific documentation requirements
- Check for carrier-specific formatting requirements
- Check for carrier-specific submission requirements
- Flag carrier compliance issues

**Industry Standards:**
- Check pricing against industry ranges (Xactimate)
- Check quantities against standard calculations
- Check line item categorization
- Flag non-standard items

**5.2 Compliance Scoring**
Calculate compliance score (0-100):
```typescript
{
  overallScore: number,          // 0-100
  fraudScore: number,           // 0-100 (higher = less risk)
  regulatoryScore: number,      // 0-100
  carrierScore: number,         // 0-100
  industryScore: number,        // 0-100
  issues: ComplianceIssue[]
}
```

**5.3 Compliance Status**
Determine compliance status:
- 🟢 **Ready** - Score ≥ 80, no critical issues
- 🟡 **Needs Evidence** - Score 50-79, missing evidence
- 🔴 **Cannot Recommend** - Score < 50, critical issues

**5.4 Issue Generation**
Generate specific compliance issues:
```typescript
{
  id: string,
  type: 'fraud' | 'regulatory' | 'carrier' | 'industry',
  severity: 'critical' | 'high' | 'medium' | 'low',
  message: string,
  recommendation: string,       // How to resolve
  affectedRecommendations: string[]  // Which recommendations are affected
}
```

**Output:** Compliance score, status, and specific issues

---

### Stage 6: Human Review

**Input:** AI recommendations from Stage 3 + evidence graph from Stage 4 + compliance status from Stage 5

**Processing:**

**6.1 Review Presentation**
Present recommendations in PR-style interface:
- AI explanation and approach
- Supporting evidence (linked documents/photos)
- Estimated recoverable revenue
- Confidence score
- Compliance status
- Missing information warnings
- Documentation checklist

**6.2 Review Actions**
Enable reviewer actions:
- **Approve** - Accept recommendation as-is
- **Approve with Modifications** - Accept with changes
- **Reject** - Reject recommendation
- **Request More Info** - Flag for additional information
- **Comment** - Add notes or questions

**6.3 Review Checklist**
Require completion of review checklist:
- [ ] I have reviewed the supporting evidence
- [ ] I have verified the compliance status
- [ ] I have confirmed the pricing is reasonable
- [ ] I have checked for missing information
- [ ] I have validated the quantities and measurements

**6.4 Review Attribution**
Track review metadata:
- Reviewer identity
- Review timestamp
- Review duration
- Review checklist completion
- Reviewer modifications (if any)
- Reviewer comments

**Output:** Reviewed recommendations with approval status and reviewer attribution

---

### Stage 7: Supplement Package Generation

**Input:** Approved recommendations from Stage 6 + evidence graph from Stage 4

**Processing:**

**7.1 Package Assembly**
Compile supplement package:
- Cover letter with summary
- Approved line items with pricing
- Supporting evidence appendix
- Documentation checklist completion
- Compliance validation confirmation
- Reviewer attribution
- Activity timeline

**7.2 Package Formatting**
Format package for submission:
- PDF generation with professional formatting
- Carrier-specific format (if configured)
- Include all supporting documents
- Include photo evidence
- Include audit trail

**7.3 Package Validation**
Validate package completeness:
- Check all required sections present
- Verify all evidence included
- Confirm compliance status
- Validate reviewer approval

**Output:** Submission-ready supplement package

---

## Confidence Scoring

### Confidence Calculation

**Base Confidence:** 0.5

**Adjustments:**
- +0.2 if recommended line items exist
- +0.1 if damage observations exist
- +0.1 if documentation checklist exists
- +0.1 if evidence links exist
- -0.1 if missing information impact is high
- -0.2 if confidence score < 0.5 for any line item

**Final Confidence:** Min(1.0, Max(0.0, base + adjustments))

### Confidence Levels

**High (0.7-1.0):**
- Evidence is complete
- Recommendation is ready for review
- No critical missing information
- Compliance score ≥ 80

**Medium (0.4-0.69):**
- Evidence is incomplete
- Atlas should request additional information
- Some missing information
- Compliance score 50-79

**Low (0.0-0.39):**
- Insufficient evidence
- Atlas should refuse to recommend submission
- Critical missing information
- Compliance score < 50

---

## Risk Scoring

### Risk Calculation

**Base Risk:** 0.0

**Adjustments:**
- +0.5 if no recommended line items
- +0.2 per high-impact missing information item (max 0.5)
- +0.1 if compliance score < 50
- +0.1 if evidence strength < 0.5

**Final Risk:** Min(1.0, base + adjustments)

### Risk Levels

**Low (0.0-0.3):**
- Minimal risk
- Ready for submission

**Medium (0.31-0.6):**
- Moderate risk
- Requires careful review

**High (0.61-1.0):**
- High risk
- Requires additional validation

---

## Evidence Strength Scoring

### Evidence Strength Calculation

**Base Strength:** 0.0

**Per Evidence Item:**
- +0.3 for document evidence
- +0.4 for photo evidence
- +0.2 for interview answer evidence
- +0.1 for activity timeline evidence

**Relevance Multiplier:**
- High relevance: ×1.0
- Medium relevance: ×0.7
- Low relevance: ×0.4

**Final Strength:** Min(1.0, sum of (evidence value × relevance multiplier))

### Evidence Strength Levels

**Strong (0.7-1.0):**
- Multiple evidence sources
- High relevance
- Ready for submission

**Moderate (0.4-0.69):**
- Limited evidence
- Medium relevance
- Requires additional evidence

**Weak (0.0-0.39):**
- Minimal evidence
- Low relevance
- Cannot recommend

---

## Compliance Rules

### Fraud Detection Rules

**Rule 1: No Fabricated Damage**
- Check: Recommendation has no evidence
- Action: Flag as critical fraud risk
- Message: "Recommendation lacks supporting evidence"

**Rule 2: No Unsupported Measurements**
- Check: Quantity or measurement without source
- Action: Flag as high fraud risk
- Message: "Measurement lacks supporting documentation"

**Rule 3: No Inflated Quantities**
- Check: Quantity > 2× standard calculation
- Action: Flag as medium fraud risk
- Message: "Quantity appears inflated"

**Rule 4: No Unrealistic Pricing**
- Check: Unit price > 2× industry standard
- Action: Flag as high fraud risk
- Message: "Pricing exceeds industry standards"

### Regulatory Compliance Rules

**Rule 1: State Requirements**
- Check: State-specific requirements (if configured)
- Action: Flag missing requirements
- Message: "Missing state-specific documentation"

**Rule 2: Licensing Requirements**
- Check: Required licenses for work type
- Action: Flag if licenses not verified
- Message: "License verification required"

**Rule 3: Code Compliance**
- Check: Building code references for required work
- Action: Flag missing code references
- Message: "Building code compliance verification required"

### Carrier Compliance Rules

**Rule 1: Documentation Requirements**
- Check: Carrier-specific documentation requirements
- Action: Flag missing required documents
- Message: "Missing carrier-required documentation"

**Rule 2: Format Requirements**
- Check: Carrier-specific formatting requirements
- Action: Flag format issues
- Message: "Format does not meet carrier requirements"

### Industry Standards Rules

**Rule 1: Pricing Standards**
- Check: Pricing against Xactimate ranges
- Action: Flag pricing outside ranges
- Message: "Pricing outside industry standard range"

**Rule 2: Quantity Standards**
- Check: Quantities against standard calculations
- Action: Flag quantities outside ranges
- Message: "Quantity outside standard calculation range"

**Rule 3: Categorization**
- Check: Line item categorization
- Action: Flag non-standard categories
- Message: "Non-standard line item category"

---

## Human Review Requirements

### Required Review Actions

**For Each Recommendation:**
1. Review AI explanation
2. Verify supporting evidence
3. Check compliance status
4. Validate pricing
5. Confirm quantities
6. Check for missing information
7. Complete review checklist

### Review Checklist

**Evidence Verification:**
- [ ] I have reviewed all supporting documents
- [ ] I have reviewed all supporting photos
- [ ] I have verified evidence relevance
- [ ] I have confirmed evidence is sufficient

**Compliance Verification:**
- [ ] I have reviewed compliance status
- [ ] I have addressed all compliance issues
- [ ] I have confirmed no fraud indicators
- [ ] I have verified regulatory compliance

**Pricing Verification:**
- [ ] I have verified unit prices are reasonable
- [ ] I have confirmed quantities are accurate
- [ ] I have checked calculations
- [ ] I have compared to industry standards

**Information Verification:**
- [ ] I have checked for missing information
- [ ] I have verified all required fields
- [ ] I have confirmed data accuracy
- [ ] I have validated source data

### Review Outcomes

**Approve:**
- Recommendation accepted as-is
- Status changes to "Approved"
- Added to supplement package
- Logged in activity timeline

**Approve with Modifications:**
- Recommendation accepted with changes
- Modifications recorded
- Status changes to "Approved"
- Added to supplement package
- Logged in activity timeline'

**Reject:**
- Recommendation rejected
- Reason recorded
- Status changes to "Rejected"
- Not added to supplement package
- Logged in activity timeline

**Request More Info:**
- Recommendation flagged for additional information
- Missing information recorded
- Status changes to "Needs Information"
- Not added to supplement package
- Logged in activity timeline

---

## Data Flow Example

### Example: Water Damage Claim with Hidden Mold

**Stage 1: Data Intake**
- Claim: Water damage from pipe burst
- Property: Residential, 2000 sq ft, built 2010
- Interview: Customer reports musty smell in walls
- Documents: Initial estimate, carrier denial letter
- Photos: 5 photos of visible water damage

**Stage 2: Document Intelligence**
- Document content extracted from estimate and carrier letter
- Photo analysis detects water damage patterns
- Photos categorized as damage documentation

**Stage 3: Decision Engine**
- AI analyzes interview response about musty smell
- AI identifies potential hidden mold
- AI recommends mold testing and remediation
- AI generates line items for mold testing, remediation, drywall replacement

**Stage 4: Evidence Graph**
- Evidence links created:
  - Mold testing recommendation → interview answer about musty smell
  - Remediation recommendation → water damage photos
  - Drywall replacement → initial estimate showing affected areas
- Evidence strength calculated: 0.65 (moderate)

**Stage 5: Compliance Validator**
- Compliance checks pass (no fraud indicators)
- Regulatory compliance: Mold testing required in state
- Carrier compliance: Documentation requirements met
- Compliance score: 85 (Ready)

**Stage 6: Human Review**
- Reviewer sees AI explanation about hidden mold risk
- Reviewer reviews evidence (interview, photos, estimate)
- Reviewer completes checklist
- Reviewer approves recommendations

**Stage 7: Package Generation**
- Supplement package generated with:
  - Cover letter explaining hidden mold findings
  - Approved line items for mold testing and remediation
  - Supporting evidence (interview, photos, estimate)
  - Compliance validation confirmation
  - Reviewer attribution

---

## Error Handling

### Stage 1: Data Intake Errors
- Missing required fields → Request missing data
- Invalid data formats → Return validation errors
- Document upload failures → Retry with error message

### Stage 2: Document Intelligence Errors
- PDF extraction failures → Use OCR fallback
- OCR failures → Flag document as unprocessable
- Photo analysis failures → Continue without analysis

### Stage 3: Decision Engine Errors
- AI provider failures → Retry with exponential backoff
- JSON parsing failures → Request re-generation
- Validation failures → Return specific error messages

### Stage 4: Evidence Graph Errors
- Missing evidence references → Flag as missing evidence
- Invalid evidence links → Remove invalid links
- Evidence validation failures → Flag recommendations

### Stage 5: Compliance Validator Errors
- Rule engine failures → Use default compliance checks
- Scoring failures → Return neutral score
- Issue generation failures → Return generic issues

### Stage 6: Human Review Errors
- Review submission failures → Retry with error message
- Checklist validation failures → Require completion
- Approval failures → Log error and require retry

### Stage 7: Package Generation Errors
- PDF generation failures → Retry with error message
- Package validation failures → Return specific errors
- Export failures → Retry with alternative format

---

## Performance Requirements

### Response Times
- Data Intake: < 2 seconds
- Document Intelligence: < 10 seconds per document
- Decision Engine: < 30 seconds
- Evidence Graph: < 5 seconds
- Compliance Validator: < 3 seconds
- Human Review: Interactive (no timeout)
- Package Generation: < 15 seconds

### Throughput
- Support 10 concurrent claim analyses
- Process 100 documents per hour
- Generate 50 supplement packages per hour

### Scalability
- Horizontal scaling for AI processing
- Queue-based document processing
- Caching for repeated analyses

---

## Security Requirements

### Data Privacy
- Encrypt all claim data at rest
- Encrypt all data in transit
- Role-based access control
- Audit logging for all access

### Compliance
- SOC 2 Type II compliance (future)
- GDPR compliance (if applicable)
- State-specific privacy requirements

### Fraud Prevention
- Rate limiting on API endpoints
- Input validation on all inputs
- Output encoding to prevent injection
- Regular security audits

---

## Monitoring & Logging

### Metrics to Track
- AI recommendation generation time
- AI acceptance rate
- Compliance score distribution
- Evidence strength distribution
- Review completion time
- Package generation success rate

### Logging Requirements
- Log all decision engine invocations
- Log all compliance checks
- Log all human review actions
- Log all package generations
- Log all errors with stack traces

### Alerting
- Alert on AI provider failures
- Alert on compliance score < 50
- Alert on evidence strength < 0.4
- Alert on package generation failures

---

## Future Enhancements

### Phase 2 Enhancements
- Advanced photo analysis (damage quantification)
- Machine learning for confidence scoring
- Carrier-specific rule sets
- Regulatory database integration
- Automated evidence extraction

### Phase 3 Enhancements
- Predictive analytics for approval probability
- Natural language explanation generation
- Real-time collaboration on reviews
- Mobile review interface
- Voice-activated review

---

## Conclusion

This specification defines the complete decision engine for Atlas, from data intake to supplement package generation. Every recommendation is explainable, evidence-backed, and reviewable, ensuring compliance and building trust with users.

The architecture is designed to be modular, allowing each stage to be developed and tested independently while maintaining clear interfaces between components.

This specification serves as the source of truth for all implementation decisions, ensuring alignment across the development team and AI coding agents.
