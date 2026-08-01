"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { apiFetch } from "@/lib/api";
import { routeQuestion, type QueryResult } from "@/lib/ask-atlas/orchestrator";
import { Button, Input } from "@project-atlas/ui";
import {
  Mic,
  Volume2,
  VolumeOff,
  Send,
  ArrowRight,
  Clock,
  Briefcase,
  Building2,
  FileText,
  MessageSquare,
  DollarSign,
  FolderOpen,
  HardHat,
  Home,
  Users,
  FileEdit,
  Settings,
  BarChart3,
  LayoutDashboard,
  HeartPulse,
  Sparkles,
  Lightbulb,
  AlertCircle,
  Plus,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  result?: QueryResult;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  messages: Message[];
}

interface Claim {
  id: string;
  claimNumber: string;
  status: string;
  insuranceCompany: string | null;
  customerName: string | null;
  updatedAt: string;
}

interface Company {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
}

interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  type: "action" | "warning" | "opportunity";
  title: string;
  reason: string;
  suggestedAction: string;
  relatedEntityType?: "claim" | "supplement" | "interview" | "document";
  relatedEntityId?: string;
}

const STORAGE_KEY = "ask-atlas-conversations";

const moduleShortcuts = [
  {
    label: "Claims",
    href: "/admin/claims",
    icon: FileText,
    color: "bg-primary/10 text-primary",
  },
  {
    label: "Companies",
    href: "/admin/companies",
    icon: Building2,
    color: "bg-accent/10 text-accent",
  },
  {
    label: "Properties",
    href: "/admin/properties",
    icon: Home,
    color: "bg-success/10 text-success",
  },
  {
    label: "Documents",
    href: "/admin/documents",
    icon: FolderOpen,
    color: "bg-warning/10 text-warning",
  },
  {
    label: "Supplements",
    href: "/admin/supplements",
    icon: DollarSign,
    color: "bg-info/10 text-info",
  },
  {
    label: "Interviews",
    href: "/admin/interviews",
    icon: MessageSquare,
    color: "bg-primary/10 text-primary",
  },
  {
    label: "Tasks",
    href: "/admin/tasks",
    icon: Briefcase,
    color: "bg-accent/10 text-accent",
  },
  {
    label: "Operations",
    href: "/admin/operations",
    icon: LayoutDashboard,
    color: "bg-accent/10 text-accent",
  },
  {
    label: "Activity",
    href: "/admin/activity",
    icon: BarChart3,
    color: "bg-success/10 text-success",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    color: "bg-muted text-foreground",
  },
  {
    label: "System Health",
    href: "/admin/system-health",
    icon: HeartPulse,
    color: "bg-muted text-foreground",
  },
];

const suggestedActions = [
  "Show me all claims waiting on supplements",
  "Which adjusters have not responded this week?",
  "What is blocking invoice 1427?",
  "Summarize today activity",
  "Open the supplements page",
  "Create a new claim",
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatName(session: any) {
  if (!session?.user) return "there";
  const meta = session.user.user_metadata;
  if (meta?.name) return meta.name.split(" ")[0];
  if (session.user.email) {
    const part = session.user.email.split("@")[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
  }
  return "there";
}

function formatDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function timeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AskAtlas() {
  const { session } = useSupabase();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recentClaims, setRecentClaims] = useState<Claim[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSpokenRef = useRef("");

  const greeting = useMemo(() => getGreeting(), []);
  const displayName = useMemo(() => formatName(session), [session]);
  const currentDate = useMemo(() => formatDate(), []);

  const revenueOpportunities = useMemo(
    () => recommendations.filter((r) => r.type === "opportunity"),
    [recommendations],
  );
  const claimRiskAlerts = useMemo(
    () =>
      recommendations.filter(
        (r) => r.type === "warning" && r.relatedEntityType === "claim",
      ),
    [recommendations],
  );
  const taskRecommendations = useMemo(
    () => recommendations.filter((r) => r.type === "action"),
    [recommendations],
  );
  const suggestedFollowUps = useMemo(
    () =>
      recommendations.filter(
        (r) => r.type === "warning" || r.type === "opportunity",
      ),
    [recommendations],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        setConversations(parsed.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // ignore
    }
  }, [conversations]);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const [claimsRes, companiesRes, recsRes] = await Promise.all([
          apiFetch("/claims?limit=5"),
          apiFetch("/companies?limit=5"),
          apiFetch("/intelligence/recommendations"),
        ]);
        const claimsData = (claimsRes as any)?.data || [];
        const companiesData = (companiesRes as any)?.data || [];
        const recsData = (recsRes as any) || [];
        setRecentClaims(claimsData.slice(0, 5));
        setCompanies(companiesData.slice(0, 5));
        setRecommendations(recsData.slice(0, 3));
      } catch (err) {
        console.error("Failed to load home data", err);
      }
    };
    fetchHomeData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!voiceOutput || typeof window === "undefined") return;
    const last = messages.at(-1);
    if (
      last &&
      last.role === "assistant" &&
      last.content !== lastSpokenRef.current
    ) {
      const synth = (window as any).speechSynthesis;
      const Utterance = (window as any).SpeechSynthesisUtterance;
      if (!synth || !Utterance) return;
      synth.cancel();
      const utterance = new Utterance(last.content);
      utterance.lang = "en-US";
      synth.speak(utterance);
      lastSpokenRef.current = last.content;
    }
  }, [messages, voiceOutput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!voiceOutput) {
      (window as any).speechSynthesis?.cancel();
    }
  }, [voiceOutput]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSubmit = async (
    e?: React.FormEvent,
    overrideQuestion?: string,
  ) => {
    e?.preventDefault();
    const userQuestion = (overrideQuestion || question).trim();
    if (!userQuestion || loading) return;

    const userMessage: Message = {
      role: "user",
      content: userQuestion,
      timestamp: Date.now(),
    };

    const currentMessages = activeConversationId
      ? [...messages, userMessage]
      : [userMessage];

    if (!activeConversationId) {
      const newId = Date.now().toString();
      setActiveConversationId(newId);
      setConversations((prev) => [
        {
          id: newId,
          title: userQuestion.slice(0, 40),
          preview: "",
          timestamp: Date.now(),
          messages: currentMessages,
        },
        ...prev,
      ]);
    }

    setMessages(currentMessages);
    setQuestion("");
    setError(null);
    setLoading(true);

    try {
      const result = await routeQuestion(userMessage.content);
      const assistantMessage: Message = {
        role: "assistant",
        content: result.answer,
        result,
        timestamp: Date.now(),
      };
      const updatedMessages = [...currentMessages, assistantMessage];
      setMessages(updatedMessages);

      setConversations((prev) => {
        const existing = prev.find((c) => c.id === activeConversationId);
        if (existing) {
          return prev
            .map((c) =>
              c.id === activeConversationId
                ? {
                    ...c,
                    messages: updatedMessages,
                    preview: result.answer.slice(0, 80),
                    timestamp: Date.now(),
                  }
                : c,
            )
            .sort((a, b) => b.timestamp - a.timestamp);
        }
        return [
          {
            id: activeConversationId || Date.now().toString(),
            title: userMessage.content.slice(0, 40),
            preview: result.answer.slice(0, 80),
            timestamp: Date.now(),
            messages: updatedMessages,
          },
          ...prev,
        ];
      });
    } catch (err) {
      setError("Failed to process question. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedAction = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes("open the supplements page")) {
      if (typeof window !== "undefined")
        window.location.href = "/admin/supplements";
      return;
    }
    if (lower.includes("create a new claim")) {
      if (typeof window !== "undefined") window.location.href = "/admin/claims";
      return;
    }
    setQuestion(action);
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setQuestion("");
    setError(null);
  };

  const handleMicClick = () => {
    if (micActive) {
      recognitionRef.current?.stop();
      setMicActive(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    setVoiceOutput(true);
    finalTranscriptRef.current = "";
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
      }
      setQuestion(finalTranscriptRef.current + interim);
    };
    recognition.onend = () => {
      setMicActive(false);
      if (finalTranscriptRef.current.trim()) {
        handleSubmit(undefined, finalTranscriptRef.current.trim());
      }
    };
    recognition.onerror = (event: any) => {
      setMicActive(false);
      setError(
        event.error === "not-allowed"
          ? "Microphone access denied. Please allow microphone access."
          : "Voice input failed. Please try again.",
      );
    };
    recognitionRef.current = recognition;
    setMicActive(true);
    recognition.start();
  };

  const isInConversation = messages.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            {greeting}, {displayName}.
          </h1>
          <p className="text-muted-foreground mt-1">{currentDate}</p>
        </div>
        {isInConversation && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewConversation}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        )}
      </div>

      {/* Input */}
      <div className="panel-atlas p-4 rounded-2xl">
        <p className="text-sm text-muted-foreground mb-3">
          What would you like to do today?
        </p>
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center gap-2"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleMicClick}
            aria-label="Voice input"
            className={`shrink-0 rounded-full ${micActive ? "ring-2 ring-primary" : ""}`}
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setVoiceOutput((v) => !v)}
            aria-label={
              voiceOutput ? "Disable voice output" : "Enable voice output"
            }
            className={`shrink-0 rounded-full ${voiceOutput ? "text-primary" : "text-muted-foreground"}`}
          >
            {voiceOutput ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeOff className="h-4 w-4" />
            )}
          </Button>
          <Input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask Atlas..."
            disabled={loading}
            className="flex-1 h-12 text-base md:text-lg bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            disabled={loading || !question.trim()}
            aria-label="Send message"
            className="shrink-0 rounded-full"
          >
            {loading ? (
              <Clock className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive-foreground flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Conversation */}
      {isInConversation && (
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-3xl rounded-2xl p-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface border"
                }`}
              >
                {message.role === "assistant" && message.result ? (
                  <div className="space-y-4">
                    <p className="text-foreground">{message.result.answer}</p>
                    {message.result.reasoning && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">
                          Reasoning
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          {message.result.reasoning}
                        </p>
                      </div>
                    )}
                    {Object.keys(message.result.statistics).length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(message.result.statistics).map(
                          ([key, value]) => (
                            <div key={key} className="bg-muted p-3 rounded-lg">
                              <p className="text-xs text-muted-foreground">
                                {key}
                              </p>
                              <p className="text-lg font-semibold text-foreground">
                                {value}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                    {message.result.supportingRecords.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          Supporting Records
                        </h4>
                        <div className="space-y-2">
                          {message.result.supportingRecords.map((record, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div>
                                <p className="text-foreground text-sm">
                                  {record.description}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {record.id} • {record.type}
                                </p>
                              </div>
                              {record.value !== undefined && (
                                <span className="font-semibold text-foreground">
                                  {typeof record.value === "number"
                                    ? `$${record.value.toLocaleString()}`
                                    : record.value}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {message.result.recommendedActions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          Recommended Actions
                        </h4>
                        <ul className="space-y-2">
                          {message.result.recommendedActions.map(
                            (action, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-sm"
                              >
                                <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span className="text-foreground">
                                  {action}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-center gap-4 pt-2 border-t text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Confidence
                        </p>
                        <p className="font-semibold text-foreground">
                          {Math.round(message.result.confidence * 100)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Data Sources
                        </p>
                        <p className="font-semibold text-foreground">
                          {message.result.dataSources.join(", ")}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Home Dashboard */}
      {!isInConversation && (
        <div className="space-y-6">
          {/* Suggested Actions */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Suggested actions
            </h3>
            <div className="flex flex-wrap gap-2">
              {suggestedActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestedAction(action)}
                  className="h-auto text-xs px-3 py-1.5 whitespace-normal text-left"
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>

          {/* Module Shortcuts */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Quick access
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {moduleShortcuts.map((mod) => (
                <a
                  key={mod.href}
                  href={mod.href}
                  className="group panel-atlas p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${mod.color}`}>
                    <mod.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {mod.label}
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Conversations */}
            <div className="lg:col-span-1 panel-atlas p-4 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">
                  Recent conversations
                </h3>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </div>
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No conversations yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {conversations.slice(0, 6).map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {conversation.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {conversation.preview || "No response yet"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {timeAgo(conversation.timestamp)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Claims & Companies */}
            <div className="lg:col-span-2 space-y-6">
              <div className="panel-atlas p-4 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-foreground">
                    Recent claims
                  </h3>
                  <a
                    href="/admin/claims"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
                {recentClaims.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent claims.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentClaims.map((claim) => (
                      <a
                        key={claim.id}
                        href={`/admin/claims/${claim.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {claim.claimNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {claim.customerName || "Unknown customer"} •{" "}
                            {claim.insuranceCompany || "No carrier"}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {claim.status}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-atlas p-4 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-foreground">
                    Pinned companies
                  </h3>
                  <a
                    href="/admin/companies"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
                {companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No companies found.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {companies.map((company) => (
                      <a
                        key={company.id}
                        href={`/admin/companies/${company.id}`}
                        className="p-3 rounded-lg hover:bg-muted transition-colors border"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {company.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {company.industry || "Company"}{" "}
                          {company.city ? `• ${company.city}` : ""}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-atlas p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium text-foreground">
                    Background intelligence
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border bg-success/5">
                    <h4 className="text-sm font-semibold text-success mb-2">
                      Revenue opportunities
                    </h4>
                    {revenueOpportunities.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No revenue opportunities right now.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {revenueOpportunities.slice(0, 3).map((rec) => (
                          <div key={rec.id} className="text-sm">
                            <p className="text-foreground font-medium">
                              {rec.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {rec.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border bg-destructive/5">
                    <h4 className="text-sm font-semibold text-destructive mb-2">
                      Claim risk alerts
                    </h4>
                    {claimRiskAlerts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No claim risk alerts.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {claimRiskAlerts.slice(0, 3).map((rec) => (
                          <div key={rec.id} className="text-sm">
                            <p className="text-foreground font-medium">
                              {rec.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {rec.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border bg-primary/5">
                    <h4 className="text-sm font-semibold text-primary mb-2">
                      Task recommendations
                    </h4>
                    {taskRecommendations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No task recommendations.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {taskRecommendations.slice(0, 3).map((rec) => (
                          <div key={rec.id} className="text-sm">
                            <p className="text-foreground font-medium">
                              {rec.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {rec.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border bg-accent/5">
                    <h4 className="text-sm font-semibold text-accent mb-2">
                      Suggested follow-ups
                    </h4>
                    {suggestedFollowUps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No suggested follow-ups.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {suggestedFollowUps.slice(0, 3).map((rec) => (
                          <div key={rec.id} className="text-sm">
                            <p className="text-foreground font-medium">
                              {rec.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {rec.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
