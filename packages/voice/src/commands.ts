/**
 * Voice command router.
 *
 * Matches natural-language utterances to intents, extracts parameters
 * (claim numbers, entity names), and maps each intent to a tool id that the
 * host app implements against its existing APIs.
 */

import type { ToolContext, VoiceMode } from "./types";

export interface CommandIntent {
  id: string;
  toolId: string;
  label: string;
  params: Record<string, string>;
  /** When true the intent routes to the AI brain instead of a tool. */
  freeform?: boolean;
}

export interface CommandDef {
  id: string;
  toolId: string;
  label: string;
  /** Regex patterns matched against the normalized utterance. */
  patterns: RegExp[];
}

const CLAIM_NUMBER = /(?:CL-\d{4}-\d{4}|CL-\d{6})/i;
const CLAIM_NUMBER_GENERIC = /cl-\d{4,6}-\d{2,4}|claim\s+(?:number\s+)?(?:is\s+)?([a-z]{0,4}?\d[\w-]*)/i;

/** Route patterns — "open <module>" / "go to <module>" / "<module>". */
const NAV: Array<[string, string, RegExp[]]> = [
  ["dashboard", "/admin", [/open\s+dashboard/, /go(?:ing)?\s+to\s+dashboard/, /take me (?:to|home)/, /^dashboard$/]],
  ["claims", "/admin/claims", [/open\s+claims?/, /go(?:ing)?\s+to\s+claims?/, /show\s+(?:me\s+)?(?:the\s+)?claims?/, /^claims?$/]],
  ["documents", "/admin/documents", [/open\s+documents?/, /go(?:ing)?\s+to\s+documents?/, /show\s+(?:me\s+)?documents?/, /^documents?$/]],
  ["interviews", "/admin/interviews", [/open\s+interviews?/, /go(?:ing)?\s+to\s+interviews?/, /show\s+(?:me\s+)?interviews?/, /^interviews?$/]],
  ["supplements", "/admin/supplements", [/open\s+supplements?/, /go(?:ing)?\s+to\s+supplements?/, /show\s+(?:me\s+)?supplements?/, /^supplements?$/]],
  ["decisions", "/admin/decisions", [/open\s+(?:the\s+)?decision[s]?/, /go(?:ing)?\s+to\s+decision[s]?/, /decision review/, /^decisions?$/]],
  ["demo", "/admin/demo", [/open\s+(?:the\s+)?demo/, /go(?:ing)?\s+to\s+(?:the\s+)?demo/, /^demo$/]],
  ["settings", "/admin/settings", [/open\s+settings/, /go(?:ing)?\s+to\s+settings/, /voice settings/, /^settings$/]],
  ["activity", "/admin/activity", [/open\s+activity/, /go(?:ing)?\s+to\s+activity/, /show\s+activity/, /^activity$/]],
  ["companies", "/admin/companies", [/open\s+companies/, /go(?:ing)?\s+to\s+companies/, /^companies$/]],
  ["properties", "/admin/properties", [/open\s+properties/, /go(?:ing)?\s+to\s+properties/, /^properties$/]],
  ["contacts", "/admin/contacts", [/open\s+contacts?/, /go(?:ing)?\s+to\s+contacts?/, /^contacts$/]],
  ["intelligence", "/admin/intelligence", [/open\s+(?:the\s+)?intelligence/, /go(?:ing)?\s+to\s+intelligence/, /intelligence center/, /^intelligence$/]],
  ["health", "/admin/system-health", [/open\s+(?:the\s+)?system health/, /go(?:ing)?\s+to\s+(?:the\s+)?system health/, /system health/, /^health$/]],
  ["operations", "/admin/operations", [/open\s+operations/, /go(?:ing)?\s+to\s+operations/, /^operations$/]],
];

const COMMAND_DEFS: CommandDef[] = [
  // --- Claim commands ---------------------------------------------------
  {
    id: "claim.open",
    toolId: "claim.open",
    label: "Open a claim",
    patterns: [/open\s+(?:the\s+)?(\w+)\s+claim/, /open\s+(?:the\s+)?claim/, /pull up\s+(?:the\s+)?(\w+)\s+claim/, /open\s+claim\s+(?:number\s+)?(?:CL-\d{4}-\d{4}|CL-\d{6})/i],
  },
  {
    id: "claim.search",
    toolId: "claim.search",
    label: "Search claims",
    patterns: [/search\s+claims/, /find\s+(?:a\s+)?claims?/, /look\s+up\s+claims?/, /show\s+claims\s+for\s+(\w+)/, /claims?\s+for\s+(\w+)/],
  },
  {
    id: "claim.today",
    toolId: "claim.search",
    label: "Today's claims",
    patterns: [/today['’]?s\s+claims/, /claims?\s+today/, /recent\s+claims?/, /latest\s+claims?/],
  },
  {
    id: "claim.create",
    toolId: "claim.create",
    label: "Create a new claim",
    patterns: [/create\s+(?:a\s+|a\s+new\s+)?claim/, /new\s+claim/, /start\s+(?:a\s+)?claim/, /file\s+(?:a\s+)?claim/],
  },
  {
    id: "claim.summarize",
    toolId: "claim.summarize",
    label: "Summarize a claim",
    patterns: [/summarize\s+(?:the\s+)?(\w+)?\s*claim/, /summary\s+of\s+(?:the\s+)?claim/, /what('| i)s\s+(?:the\s+)?status\s+of\s+(?:the\s+)?(\w+)?\s*claim/, /how('| i)s\s+(?:the\s+)?(\w+)?\s*claim\s+doing/],
  },

  // --- Document commands ------------------------------------------------
  {
    id: "document.search",
    toolId: "document.search",
    label: "Search documents",
    patterns: [/search\s+documents/, /find\s+documents?/, /documents?\s+related\s+to/, /look\s+up\s+documents?/],
  },
  {
    id: "document.read",
    toolId: "document.read",
    label: "Read a document",
    patterns: [/read\s+(?:the\s+)?(?:inspection\s+report|document|report)/, /read\s+the\s+(\w+)\s+(?:report|document)/, /summarize\s+(?:the\s+)?(?:inspection\s+report|document)/, /what('| i)s\s+in\s+(?:the\s+)?(?:inspection\s+report|document)/],
  },
  {
    id: "document.explain",
    toolId: "document.explain",
    label: "Explain this document",
    patterns: [/explain\s+(?:this|the)\s+document/, /what\s+is\s+(?:this|the)\s+document/, /what('| i)s\s+this\s+document/, /about\s+this\s+document/],
  },
  {
    id: "document.extract",
    toolId: "document.extract",
    label: "Extract policy details",
    patterns: [/extract\s+(?:the\s+)?policy\s+limits/, /what('| i)s\s+(?:the\s+)?deductible/, /extract\s+(?:the\s+)?deductible/, /what\s+exclusions/, /what\s+endorsements/, /extract\s+(?:the\s+)?(?:policy|document)\s+details/, /code\s+requirements/],
  },

  // --- Decision commands ------------------------------------------------
  {
    id: "decision.explain",
    toolId: "decision.explain",
    label: "Explain this decision",
    patterns: [/explain\s+(?:this|the)\s+decision/, /why\s+(?:is|was)\s+(?:this|the)\s+decision/, /why\s+confidence/, /explain\s+the\s+recommendation/, /why\s+(?:was\s+this|this\s+was)\s+approved/, /what\s+evidence\s+is\s+missing/],
  },
  {
    id: "decision.approve",
    toolId: "decision.approve",
    label: "Approve this decision",
    patterns: [/approve\s+(?:this|the)\s+decision/, /mark\s+(?:it|this)\s+as\s+approved/, /approve\s+the\s+claim/],
  },
  {
    id: "decision.reject",
    toolId: "decision.reject",
    label: "Reject this decision",
    patterns: [/reject\s+(?:this|the)\s+decision/, /deny\s+(?:this|the)\s+decision/],
  },
  {
    id: "decision.request_review",
    toolId: "decision.request_review",
    label: "Request review",
    patterns: [/request\s+(?:a\s+)?review/, /send\s+(?:it\s+)?(?:back\s+)?for\s+review/, /ask\s+(?:for\s+)?(?:a\s+)?review/],
  },
  {
    id: "decision.regenerate",
    toolId: "decision.regenerate",
    label: "Regenerate the decision",
    patterns: [/regenerate\s+(?:this|the)\s+decision/, /re[- ]?run\s+(?:the\s+)?decision/, /recalculate\s+(?:the\s+)?decision/],
  },
  {
    id: "decision.probability",
    toolId: "decision.probability",
    label: "Approval probability",
    patterns: [/approval\s+probabilit/, /what('| i)s\s+(?:the\s+)?(?:approval|probability)\s+(?:score|probability)/, /how\s+likely\s+to\s+be\s+approved/, /chances\s+of\s+approval/],
  },

  // --- Evidence / photo intelligence ------------------------------------
  {
    id: "evidence.graph",
    toolId: "evidence.graph",
    label: "Open the evidence graph",
    patterns: [/evidence\s+graph/, /open\s+(?:the\s+)?evidence/, /run\s+(?:the\s+)?evidence/, /show\s+(?:the\s+)?evidence/],
  },
  {
    id: "evidence.show",
    toolId: "evidence.show",
    label: "Show supporting evidence",
    patterns: [/show\s+(?:the\s+)?supporting\s+evidence/, /supporting\s+evidence/, /what\s+evidence\s+supports/, /show\s+evidence\s+for/],
  },
  {
    id: "photo.damage",
    toolId: "photo.damage",
    label: "Photo intelligence — damage",
    patterns: [/what\s+damage\s+do\s+you\s+see/, /count\s+hail\s+hits/, /show\s+missing\s+shingles/, /flashing\s+damage/, /roof\s+damage/, /what\s+supports\s+full\s+replacement/, /what\s+evidence\s+is\s+strongest/],
  },
  {
    id: "photo.missing",
    toolId: "photo.missing",
    label: "Missing photos",
    patterns: [/what\s+photos\s+are\s+missing/, /missing\s+photos?/, /are\s+we\s+missing\s+(?:any\s+)?photos?/],
  },
  {
    id: "compliance.report",
    toolId: "compliance.report",
    label: "Generate compliance report",
    patterns: [/generate\s+(?:a\s+)?compliance\s+report/, /compliance\s+report/, /compliance\s+status/, /find\s+code\s+violations/, /code\s+violations/],
  },

  // --- Supplement commands ----------------------------------------------
  {
    id: "supplement.generate",
    toolId: "supplement.generate",
    label: "Generate supplement",
    patterns: [/generate\s+(?:a\s+|the\s+)?supplement/, /create\s+(?:a\s+|the\s+)?supplement/, /build\s+(?:a\s+|the\s+)?supplement/, /run\s+(?:the\s+)?supplement/],
  },
  {
    id: "supplement.explain",
    toolId: "supplement.explain",
    label: "Explain supplement",
    patterns: [/explain\s+omitted\s+items/, /show\s+(?:me\s+)?code\s+upgrades/, /compare\s+(?:the\s+)?carrier\s+estimate/, /why\s+was\s+(\w+)\s+omitted/, /explain\s+(?:the\s+)?supplement/, /omitted\s+hvac/],
  },
  {
    id: "supplement.compare",
    toolId: "supplement.compare",
    label: "Compare estimates",
    patterns: [/compare\s+(?:the\s+)?estimates?/, /compare\s+(?:with|to)\s+(?:the\s+)?carrier/, /estimates?\s+comparison/, /how\s+does\s+(?:the\s+)?(?:estimate|supplement)\s+compare/],
  },
  {
    id: "supplement.lineitems",
    toolId: "supplement.lineitems",
    label: "Missing line items",
    patterns: [/what\s+line\s+items\s+are\s+missing/, /missing\s+line\s+items/, /what('| i)s\s+omitted/, /explain\s+ridge\s+cap/],
  },

  // --- Interview --------------------------------------------------------
  {
    id: "interview.start",
    toolId: "interview.start",
    label: "Start an interview",
    patterns: [/start\s+(?:an?|the)\s+interview/, /start\s+(?:an?)\s+fnol\s+interview/, /begin\s+(?:an?|the)\s+interview/, /run\s+(?:an?|the)\s+interview/],
  },
  {
    id: "interview.continue",
    toolId: "interview.control",
    label: "Continue interview",
    patterns: [/continue\s+(?:the\s+)?interview/, /next\s+question/, /keep\s+going/, /next\s+interview\s+question/],
  },
  {
    id: "interview.pause",
    toolId: "interview.control",
    label: "Pause interview",
    patterns: [/pause\s+(?:the\s+)?interview/, /hold\s+on/, /stop\s+(?:the\s+)?interview/],
  },
  {
    id: "interview.repeat",
    toolId: "interview.control",
    label: "Repeat question",
    patterns: [/repeat\s+(?:that|the\s+question)/, /say\s+that\s+again/, /can\s+you\s+repeat/],
  },
  {
    id: "interview.clarify",
    toolId: "interview.control",
    label: "Clarify question",
    patterns: [/clarif/, /what\s+do\s+you\s+mean/, /explain\s+(?:the\s+)?question/],
  },
  {
    id: "interview.skip",
    toolId: "interview.control",
    label: "Skip question",
    patterns: [/skip\s+(?:the\s+)?question/, /skip\s+(?:the\s+)?interview/, /move\s+on/],
  },

  // --- Contacts / communications ----------------------------------------
  {
    id: "contact.email",
    toolId: "contact.email",
    label: "Email the adjuster",
    patterns: [/email\s+(?:the\s+)?adjuster/, /email\s+(?:the\s+)?(?:homeowner|customer)/, /draft\s+an\s+email/],
  },
  {
    id: "contact.call",
    toolId: "contact.call",
    label: "Call the homeowner",
    patterns: [/call\s+(?:the\s+)?(?:homeowner|customer)/, /call\s+(?:the\s+)?adjuster/, /phone\s+(?:the\s+)?(?:homeowner|customer)/],
  },

  // --- Estimate ---------------------------------------------------------
  {
    id: "estimate.explain",
    toolId: "estimate.explain",
    label: "Explain this estimate",
    patterns: [/explain\s+(?:this|the)\s+estimate/, /explain\s+estimate\s+line/, /what('| i)s\s+in\s+(?:the\s+)?estimate/, /estimate\s+breakdown/],
  },

  // --- Demo control -----------------------------------------------------
  {
    id: "demo.start",
    toolId: "demo.control",
    label: "Run the demo",
    patterns: [/run\s+(?:the\s+|the\s+full\s+)?demo/, /start\s+(?:the\s+|the\s+full\s+)?demo/, /start\s+full\s+atlas\s+demo/, /play\s+(?:the\s+)?demo/],
  },
  {
    id: "demo.pause",
    toolId: "demo.control",
    label: "Pause the demo",
    patterns: [/pause\s+(?:the\s+)?demo/, /pause\s+playback/],
  },
  {
    id: "demo.resume",
    toolId: "demo.control",
    label: "Resume the demo",
    patterns: [/resume\s+(?:the\s+)?demo/, /continue\s+(?:the\s+)?demo/, /unpause/],
  },
  {
    id: "demo.skip",
    toolId: "demo.control",
    label: "Skip the demo step",
    patterns: [/skip\s+(?:the\s+)?demo/, /skip\s+step/, /next\s+step/],
  },
  {
    id: "demo.restart",
    toolId: "demo.control",
    label: "Restart the demo",
    patterns: [/restart\s+(?:the\s+)?demo/, /start\s+(?:the\s+)?demo\s+over/],
  },
  {
    id: "demo.explain",
    toolId: "demo.explain",
    label: "Explain the demo",
    patterns: [/explain\s+(?:the\s+)?demo/, /what\s+is\s+(?:the\s+)?demo\s+doing/, /demo\s+status/, /narrate/],
  },

  // --- Export -----------------------------------------------------------
  {
    id: "export.package",
    toolId: "export.package",
    label: "Export the final claim package",
    patterns: [/export\s+(?:the\s+|a\s+)?final\s+claim\s+package/, /generate\s+(?:the\s+|a\s+)?final\s+package/, /export\s+(?:the\s+)?claim\s+package/, /prepare\s+(?:the\s+)?(?:final\s+)?package/, /export\s+(?:the\s+)?supplement/],
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[.,!?;]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractClaimNumber(text: string): string | null {
  const match = text.match(CLAIM_NUMBER_GENERIC);
  if (!match) return null;
  const raw = match[0] || match[1] || "";
  const cleaned = raw.toUpperCase().replace(/CLAIM NUMBER\s+IS\s+/i, "").trim();
  return cleaned.length >= 4 ? cleaned : null;
}

function extractEntity(text: string): string | null {
  // Entity names like "Carter", "Oak Valley", "Westgate" used in "open Carter claim".
  const known = [
    "carter", "oak valley", "westgate", "emily", "robert", "lisa", "george", "johnson", "garcia", "chen", "callahan", "priya", "marcus",
  ];
  for (const name of known) {
    if (text.includes(name)) {
      return name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  return null;
}

/**
 * Parse an utterance into a command intent, or null when the user is asking
 * a free-form question (route to the AI brain instead).
 */
export function parseCommand(text: string): CommandIntent | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const claimNumber = extractClaimNumber(text);
  const entity = extractEntity(text);

  // Navigation first (exact-ish matches).
  for (const [id, path, patterns] of NAV) {
    if (patterns.some((p) => p.test(normalized))) {
      return {
        id: `nav.${id}`,
        toolId: "navigate",
        label: `Open ${id}`,
        params: { path },
      };
    }
  }

  for (const def of COMMAND_DEFS) {
    if (def.patterns.some((p) => p.test(normalized))) {
      const params: Record<string, string> = {};
      if (claimNumber) params.claimNumber = claimNumber;
      if (entity) params.entity = entity;
      if (def.id === "claim.today") params.limit = "today";
      if (
        def.id.startsWith("demo.") &&
        def.id !== "demo.start" &&
        def.id !== "demo.explain"
      ) {
        params.action = def.id.split(".")[1];
      }
      if (
        def.id.startsWith("interview.") &&
        def.id !== "interview.start"
      ) {
        params.action = def.id.split(".")[1];
      }
      return { id: def.id, toolId: def.toolId, label: def.label, params };
    }
  }

  return null;
}

/** The mode a command should switch the assistant into. */
export function modeForIntent(intent: CommandIntent): VoiceMode {
  switch (intent.id.split(".")[0]) {
    case "claim":
      return "claim";
    case "document":
      return "document";
    case "decision":
      return "decision";
    case "supplement":
      return "supplement";
    case "interview":
      return "interview";
    case "evidence":
    case "photo":
      return "evidence";
    case "compliance":
    case "estimate":
      return "decision";
    case "contact":
      return "general";
    case "demo":
    case "export":
      return "demo";
    default:
      return "general";
  }
}

/** Contextual fallback: fills missing params (claimId etc.) from the page. */
export function resolveContext(
  intent: CommandIntent,
  ctx: ToolContext
): Record<string, string> {
  const params = { ...intent.params };
  if (!params.claimId && ctx.claimId) params.claimId = ctx.claimId;
  if (!params.claimNumber && ctx.claimNumber) params.claimNumber = ctx.claimNumber;
  if (!params.decisionId && ctx.decisionId) params.decisionId = ctx.decisionId;
  if (!params.supplementId && ctx.supplementId) params.supplementId = ctx.supplementId;
  return params;
}

export function commandDescriptions(): string[] {
  return COMMAND_DEFS.map((c) => c.label);
}
