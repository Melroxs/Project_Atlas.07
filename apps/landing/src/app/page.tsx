"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import CommandPalette from "@/components/CommandPalette";

const ATLAS_APP_URL =
  process.env.NEXT_PUBLIC_ATLAS_APP_URL || "http://localhost:3000";

const questions = [
  {
    question: "Where did we lose the most revenue this month?",
    answer:
      "Revenue currently waiting: $42,380\n12 supplements awaiting carrier approval.\n3 claims inactive for 21 days.\nRecommended action: Follow up with Carrier X.",
  },
  {
    question: "Which adjusters approve supplements fastest?",
    answer: "Michael Turner\nAverage approval: 6.1 days\nConfidence: High",
  },
  {
    question: "Which claims require attention today?",
    answer: "NPP-2026-0048\nMissing engineer report.\nRevenue at risk: $5,200",
  },
  {
    question: "What patterns are emerging?",
    answer:
      "Atlas identified that Carrier X requests code documentation before approval in 83% of supplements.\nRecommendation: Attach code documentation before submission.",
  },
];

export default function LandingPage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [visibleSection, setVisibleSection] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTyping && !showAnswer) {
        setIsTyping(true);
        setShowAnswer(true);
        typeAnswer(questions[currentQuestion].answer);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentQuestion, isTyping, showAnswer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id;
          const sectionIndex = [
            "hero",
            "ask-atlas",
            "queryable",
            "supplement",
            "executive",
            "learning",
            "scenes",
          ].indexOf(sectionId);
          if (sectionIndex !== -1) {
            setVisibleSection(sectionIndex);
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.3,
    });
    document.querySelectorAll("section[id]").forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const typeAnswer = (text: string) => {
    let i = 0;
    setTypedAnswer("");
    const timer = setInterval(() => {
      if (i < text.length) {
        setTypedAnswer((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
        setIsTyping(false);
        setTimeout(() => {
          setShowAnswer(false);
          setCurrentQuestion((prev) => (prev + 1) % questions.length);
        }, 4000);
      }
    }, 30);
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Cinematic Atlas Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse-glow"
          style={{ backgroundColor: "var(--brand-cyan)", opacity: 0.1 }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse-glow"
          style={{
            backgroundColor: "var(--brand-purple)",
            opacity: 0.1,
            animationDelay: "1s",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-cyan) 0%, var(--brand-purple) 100%)",
            opacity: 0.05,
          }}
        />
      </div>

      {/* Atlas Application Navigation */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b"
        style={{
          backgroundColor: "rgba(10, 22, 40, 0.9)",
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 gradient-cyan rounded-xl flex items-center justify-center shadow-brand">
              <span
                className="text-xl font-bold"
                style={{ color: "var(--brand-navy)" }}
              >
                A
              </span>
            </div>
            <span className="text-xl font-bold">PROJECT ATLAS</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a
              href="#ask-atlas"
              className="hover:text-[var(--brand-cyan)] transition-colors"
            >
              Intelligence
            </a>
            <a
              href="#supplement"
              className="hover:text-[var(--brand-cyan)] transition-colors"
            >
              Supplements
            </a>
            <a
              href="#queryable"
              className="hover:text-[var(--brand-cyan)] transition-colors"
            >
              How It Works
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <kbd className="px-2 py-1 bg-white/10 rounded text-xs mr-2">
                ⌘K
              </kbd>
              Ask Atlas
            </button>
            <Link
              href={`${ATLAS_APP_URL}/login`}
              className="hover:text-[var(--brand-cyan)] transition-colors"
            >
              Sign In
            </Link>
            <a
              href={`${ATLAS_APP_URL}/login`}
              className="px-4 py-2 gradient-cyan rounded-lg font-medium shadow-brand hover:shadow-lg transition-all"
              style={{ color: "var(--brand-navy)" }}
            >
              Request Pilot Access
            </a>
          </div>
        </div>
      </nav>

      {/* Cinematic Hero with Atlas Product Interface */}
      <section
        id="hero"
        className="min-h-screen flex items-center justify-center px-6 pt-20 relative"
      >
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center mb-16 animate-fade-in-up">
            <h1 className="text-[5.55rem] md:text-[7.4rem] lg:text-[8.3rem] font-bold mb-8 leading-tight">
              <span className="block animate-text-reveal">
                KNOW EVERYTHING.
              </span>
              <span
                className="block animate-text-reveal"
                style={{ animationDelay: "0.2s" }}
              >
                MISS NOTHING.
              </span>
            </h1>
            <p
              className="text-xl md:text-2xl mb-12 leading-relaxed max-w-3xl mx-auto animate-fade-in-up"
              style={{
                color: "var(--neutral-gray-400)",
                animationDelay: "0.4s",
              }}
            >
              Atlas turns the operational memory of an insurance restoration
              company into intelligence.
            </p>
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up"
              style={{ animationDelay: "0.6s" }}
            >
              <a
                href={`${ATLAS_APP_URL}/login`}
                className="px-10 py-4 gradient-mixed rounded-xl font-medium text-lg shadow-brand hover:shadow-xl transition-all cinematic-glow-cyan"
                style={{ color: "white" }}
              >
                REQUEST PILOT ACCESS
              </a>
              <a
                href="#ask-atlas"
                className="px-10 py-4 rounded-xl font-medium text-lg border hover:bg-white/10 transition-all"
                style={{ borderColor: "rgba(255, 255, 255, 0.2)" }}
              >
                EXPLORE ATLAS
              </a>
            </div>
          </div>

          {/* Large Atlas Product Interface */}
          <div
            className="max-w-6xl mx-auto animate-fade-in-up animate-float"
            style={{ animationDelay: "0.8s" }}
          >
            <div className="atlas-interface-elevated rounded-2xl p-8 relative overflow-hidden">
              {/* Atlas Sidebar Simulation */}
              <div
                className="absolute left-0 top-0 bottom-0 w-16 border-r"
                style={{
                  backgroundColor: "var(--brand-navy)",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                }}
              >
                <div className="p-3 space-y-2">
                  <div className="w-10 h-10 gradient-cyan rounded-lg flex items-center justify-center shadow-brand">
                    <span
                      className="text-lg font-bold"
                      style={{ color: "var(--brand-navy)" }}
                    >
                      A
                    </span>
                  </div>
                  <div
                    className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center transition-colors"
                    style={{ color: "var(--brand-cyan)" }}
                  >
                    🧠
                  </div>
                  <div className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center transition-colors">
                    📋
                  </div>
                  <div className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center transition-colors">
                    💰
                  </div>
                </div>
              </div>

              {/* Atlas Main Content */}
              <div className="ml-16">
                {/* Top Bar */}
                <div
                  className="flex items-center justify-between mb-6 pb-4 border-b"
                  style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 gradient-mixed rounded-xl flex items-center justify-center shadow-brand">
                      <span className="text-lg font-bold">A</span>
                    </div>
                    <span className="text-lg font-medium">Ask Atlas...</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-purple)]" />
                  </div>
                </div>

                {/* Query Display */}
                <div className="mb-6">
                  <p
                    className="text-xl"
                    style={{ color: "var(--neutral-gray-400)" }}
                  >
                    {questions[currentQuestion].question}
                  </p>
                </div>

                {/* Response */}
                {showAnswer && (
                  <div
                    className="rounded-xl p-6 border animate-fade-in-up"
                    style={{
                      backgroundColor: "var(--brand-navy-dark)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <p className="text-lg whitespace-pre-line font-mono leading-relaxed">
                      {typedAnswer}
                    </p>
                    {isTyping && (
                      <span
                        className="inline-block w-2 h-6 animate-pulse"
                        style={{ backgroundColor: "var(--brand-cyan)" }}
                      />
                    )}
                  </div>
                )}

                {/* Suggested Queries */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {questions.map((q, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentQuestion(index);
                        setShowAnswer(false);
                        setIsTyping(true);
                        setTimeout(() => {
                          setShowAnswer(true);
                          typeAnswer(q.answer);
                        }, 100);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        currentQuestion === index
                          ? "gradient-cyan font-medium shadow-brand"
                          : "hover:bg-white/10 border"
                      }`}
                      style={
                        currentQuestion === index
                          ? { color: "var(--brand-navy)" }
                          : { borderColor: "rgba(255, 255, 255, 0.1)" }
                      }
                    >
                      {q.question.slice(0, 25)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cinematic Ask Atlas Scene */}
      <section id="ask-atlas" className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[4.625rem] md:text-[6.475rem] font-bold mb-6">
              ASK YOUR COMPANY
              <br />
              <span className="gradient-mixed bg-clip-text text-transparent">
                ANYTHING.
              </span>
            </h2>
            <p
              className="text-xl max-w-3xl mx-auto"
              style={{ color: "var(--neutral-gray-400)" }}
            >
              Natural language queries across your entire operation. No training
              required.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="atlas-interface-elevated rounded-3xl p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-cyan)]/5 to-[var(--brand-purple)]/5" />

              <div className="relative">
                {/* Atlas Interface Header */}
                <div className="flex items-center space-x-4 mb-8">
                  <div className="w-12 h-12 gradient-mixed rounded-xl flex items-center justify-center shadow-brand">
                    <span className="text-2xl font-bold">A</span>
                  </div>
                  <div className="flex-1">
                    <div
                      className="h-3 rounded w-64 mb-2"
                      style={{ backgroundColor: "var(--neutral-gray-700)" }}
                    />
                    <div
                      className="h-2 rounded w-48"
                      style={{ backgroundColor: "var(--neutral-gray-800)" }}
                    />
                  </div>
                </div>

                {/* Query Input Simulation */}
                <div
                  className="rounded-2xl p-8 border mb-8"
                  style={{
                    backgroundColor: "var(--brand-navy-dark)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <p
                    className="text-lg mb-4"
                    style={{ color: "var(--neutral-gray-400)" }}
                  >
                    Where is revenue getting stuck?
                  </p>

                  {/* Simulated Processing */}
                  <div className="flex items-center space-x-2 mb-6">
                    <div
                      className="w-3 h-3 rounded-full animate-bounce"
                      style={{ backgroundColor: "var(--brand-cyan)" }}
                    />
                    <div
                      className="w-3 h-3 rounded-full animate-bounce"
                      style={{
                        backgroundColor: "var(--brand-purple)",
                        animationDelay: "0.1s",
                      }}
                    />
                    <div
                      className="w-3 h-3 rounded-full animate-bounce"
                      style={{
                        backgroundColor: "var(--brand-cyan)",
                        animationDelay: "0.2s",
                      }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "var(--neutral-gray-400)" }}
                    >
                      Analyzing company operations...
                    </span>
                  </div>

                  {/* Intelligence Result */}
                  <div className="space-y-4">
                    <p className="text-xl leading-relaxed">
                      <span
                        className="font-bold"
                        style={{ color: "var(--brand-cyan)" }}
                      >
                        $42,380
                      </span>{" "}
                      in potential revenue is currently associated with{" "}
                      <span className="font-bold">18</span> unresolved
                      supplement opportunities.
                    </p>

                    <div>
                      <p
                        className="font-medium mb-3"
                        style={{ color: "var(--brand-purple)" }}
                      >
                        Primary patterns detected:
                      </p>
                      <ul
                        className="space-y-2"
                        style={{ color: "var(--neutral-gray-300)" }}
                      >
                        <li>• Missing documentation</li>
                        <li>• Estimate discrepancies</li>
                        <li>• Repeated adjuster delays</li>
                      </ul>
                    </div>

                    <div
                      className="rounded-xl p-4 border"
                      style={{
                        backgroundColor: "var(--brand-navy)",
                        borderColor: "rgba(0, 212, 255, 0.3)",
                      }}
                    >
                      <p
                        className="font-medium mb-1"
                        style={{ color: "var(--brand-cyan)" }}
                      >
                        Recommended action:
                      </p>
                      <p>Review the 6 highest-value claims first.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Queryable Business Visual with Animated Data Paths */}
      <section id="queryable" className="py-32 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[4.625rem] md:text-[6.475rem] font-bold mb-6">
              YOUR BUSINESS
              <br />
              <span className="gradient-mixed bg-clip-text text-transparent">
                BECOMES QUERYABLE.
              </span>
            </h2>
          </div>

          <div className="relative">
            {/* Data Sources (Left) */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                "CLAIMS",
                "DOCUMENTS",
                "INTERVIEWS",
                "SUPPLEMENTS",
                "ADJUSTER INTERACTIONS",
                "ESTIMATES",
                "PHOTOS",
              ].map((source, index) => (
                <div
                  key={source}
                  className="atlas-interface rounded-xl p-4 text-center transform hover:scale-105 transition-all animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {source}
                </div>
              ))}
            </div>

            {/* Center Atlas Intelligence */}
            <div className="flex justify-center my-12">
              <div className="atlas-interface-elevated rounded-2xl p-8 text-center cinematic-glow-purple animate-float">
                <div className="w-20 h-20 gradient-mixed rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-brand">
                  <span className="text-[3.7rem] font-bold">A</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">ATLAS INTELLIGENCE</h3>
                <p
                  className="text-sm"
                  style={{ color: "var(--neutral-gray-400)" }}
                >
                  Every operational event becomes context
                </p>
              </div>
            </div>

            {/* Outputs (Right) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {[
                "ANSWERS",
                "SIGNALS",
                "RECOMMENDATIONS",
                "AUTOMATION",
                "BUSINESS MEMORY",
              ].map((output, index) => (
                <div
                  key={output}
                  className="atlas-interface rounded-xl p-6 text-center transform hover:scale-105 transition-all animate-fade-in-up"
                  style={{ animationDelay: `${(index + 7) * 100}ms` }}
                >
                  {output}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Supplement Intelligence Product Close-up */}
      <section id="supplement" className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[4.625rem] md:text-[6.475rem] font-bold mb-6">
              FIND THE REVENUE
              <br />
              <span className="gradient-mixed bg-clip-text text-transparent">
                HIDING IN THE CLAIM.
              </span>
            </h2>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="atlas-interface-elevated rounded-3xl p-12 relative overflow-hidden">
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl"
                style={{ backgroundColor: "var(--brand-cyan)", opacity: 0.1 }}
              />

              <div className="relative">
                {/* Claim Header */}
                <div
                  className="flex items-center justify-between mb-8 pb-6 border-b"
                  style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <div>
                    <p
                      className="text-sm mb-1"
                      style={{ color: "var(--neutral-gray-400)" }}
                    >
                      Claim #ATL-2847
                    </p>
                    <h3 className="text-2xl font-bold">
                      Residential Storm Damage
                    </h3>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-sm mb-1"
                      style={{ color: "var(--neutral-gray-400)" }}
                    >
                      Potential Supplement
                    </p>
                    <p
                      className="text-[3.7rem] font-bold"
                      style={{ color: "var(--brand-cyan)" }}
                    >
                      $8,420
                    </p>
                  </div>
                </div>

                {/* Signals Grid */}
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <p
                      className="font-medium mb-4"
                      style={{ color: "var(--brand-purple)" }}
                    >
                      Signals Detected:
                    </p>
                    <div
                      className="flex items-center space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#EF4444" }}
                      />
                      <span>Missing documentation</span>
                    </div>
                    <div
                      className="flex items-center space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#F59E0B" }}
                      />
                      <span>Estimate discrepancy detected</span>
                    </div>
                    <div
                      className="flex items-center space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "var(--brand-purple)" }}
                      />
                      <span>Adjuster delay pattern</span>
                    </div>
                    <div
                      className="flex items-center space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "var(--brand-cyan)" }}
                      />
                      <span>3 unsupported line items</span>
                    </div>
                  </div>

                  <div className="atlas-interface rounded-2xl p-6">
                    <p
                      className="text-sm mb-2"
                      style={{ color: "var(--neutral-gray-400)" }}
                    >
                      RECOMMENDED ACTION
                    </p>
                    <p className="text-lg leading-relaxed">
                      Prepare documentation review before supplement submission.
                      This adjuster approves 73% faster with complete
                      documentation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Executive Intelligence */}
      <section id="executive" className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[4.625rem] md:text-[6.475rem] font-bold mb-6">
              SEE THE BUSINESS
              <br />
              <span className="gradient-mixed bg-clip-text text-transparent">
                BEFORE IT BECOMES A PROBLEM.
              </span>
            </h2>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  label: "REVENUE AT RISK",
                  value: "$42,380",
                  color: "var(--brand-cyan)",
                },
                {
                  label: "SUPPLEMENTS PENDING",
                  value: "18",
                  color: "var(--brand-purple)",
                },
                {
                  label: "CLAIMS NEED ATTENTION",
                  value: "6",
                  color: "var(--brand-cyan)",
                },
                {
                  label: "RECOVERED OPPORTUNITY TRACKED",
                  value: "$127,500",
                  color: "var(--brand-purple)",
                },
              ].map((metric, index) => (
                <div
                  key={metric.label}
                  className="atlas-interface-elevated rounded-2xl p-8 text-center transform hover:scale-105 transition-all animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <p
                    className="text-sm mb-4"
                    style={{ color: "var(--neutral-gray-400)" }}
                  >
                    {metric.label}
                  </p>
                  <p
                    className="text-[4.625rem] md:text-[5.55rem] font-bold mb-2"
                    style={{ color: metric.color }}
                  >
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Atlas Learning Loop */}
      <section id="learning" className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[4.625rem] md:text-[6.475rem] font-bold mb-6">
              ATLAS REMEMBERS
              <br />
              <span className="gradient-mixed bg-clip-text text-transparent">
                WHAT THE COMPANY LEARNS.
              </span>
            </h2>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center space-y-4">
              {[
                "INSPECTION",
                "INTERVIEW",
                "CLAIM",
                "SUPPLEMENT",
                "CARRIER RESPONSE",
                "ADJUSTER OUTCOME",
                "ATLAS LEARNS",
                "FUTURE RECOMMENDATION IMPROVES",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-center w-full justify-center"
                >
                  <div
                    className="atlas-interface rounded-xl p-6 text-center min-w-[180px] transform hover:scale-105 transition-all animate-fade-in-up relative"
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {index === 6 && (
                      <div
                        className="absolute -top-2 -right-2 w-4 h-4 rounded-full animate-pulse"
                        style={{ backgroundColor: "var(--brand-cyan)" }}
                      />
                    )}
                    <p className="font-medium">{step}</p>
                  </div>
                  {index < 7 && (
                    <div
                      className="w-16 h-1 mx-4 rounded overflow-hidden"
                      style={{ backgroundColor: "var(--neutral-gray-700)" }}
                    >
                      <div
                        className="h-full rounded animate-data-flow"
                        style={{
                          background:
                            "linear-gradient(90deg, var(--brand-cyan), var(--brand-purple))",
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <p
                className="text-xl max-w-3xl mx-auto"
                style={{ color: "var(--neutral-gray-400)" }}
              >
                Atlas builds institutional memory from every interaction, making
                each recommendation more accurate than the last.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Scenes */}
      <section id="scenes" className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[4.625rem] md:text-[6.475rem] font-bold mb-6">
              EXPERIENCE
              <br />
              <span className="gradient-mixed bg-clip-text text-transparent">
                ATLAS IN ACTION.
              </span>
            </h2>
          </div>

          <div className="space-y-24">
            {/* Scene 1: Claim Intelligence */}
            <div className="atlas-interface-elevated rounded-3xl p-12 relative overflow-hidden">
              <div
                className="absolute top-0 left-0 w-64 h-64 rounded-full blur-3xl"
                style={{ backgroundColor: "var(--brand-cyan)", opacity: 0.1 }}
              />

              <div className="relative">
                <h3 className="text-[2.775rem] font-bold mb-4">
                  CLAIM INTELLIGENCE
                </h3>
                <p
                  className="text-xl mb-8"
                  style={{ color: "var(--neutral-gray-400)" }}
                >
                  Atlas understands the complete context of a claim.
                </p>

                <div className="atlas-interface rounded-2xl p-8">
                  <div
                    className="flex items-center justify-between mb-6 pb-4 border-b"
                    style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
                  >
                    <div>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        Claim #ATL-2847
                      </p>
                      <h4 className="text-xl font-bold">
                        Residential Storm Damage
                      </h4>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-[2.775rem] font-bold"
                        style={{ color: "var(--brand-cyan)" }}
                      >
                        94%
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        accuracy
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <p
                        className="text-2xl font-bold mb-1"
                        style={{ color: "var(--brand-cyan)" }}
                      >
                        12
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        Documents
                      </p>
                    </div>
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <p
                        className="text-2xl font-bold mb-1"
                        style={{ color: "var(--brand-purple)" }}
                      >
                        3
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        Supplements
                      </p>
                    </div>
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <p className="text-2xl font-bold mb-1">$28,400</p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        Total Value
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scene 2: Supplement Opportunity */}
            <div className="atlas-interface-elevated rounded-3xl p-12 relative overflow-hidden">
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl"
                style={{ backgroundColor: "var(--brand-purple)", opacity: 0.1 }}
              />

              <div className="relative">
                <h3 className="text-[2.775rem] font-bold mb-4">
                  SUPPLEMENT OPPORTUNITY
                </h3>
                <p
                  className="text-xl mb-8"
                  style={{ color: "var(--neutral-gray-400)" }}
                >
                  Atlas identifies patterns that may indicate missed supplement
                  opportunities.
                </p>

                <div className="atlas-interface rounded-2xl p-8">
                  <div className="space-y-4">
                    <div
                      className="flex items-center justify-between p-4 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <div>
                        <p className="font-medium">Missed Code Items</p>
                        <p
                          className="text-sm"
                          style={{ color: "var(--neutral-gray-400)" }}
                        >
                          Claim #ATL-2847
                        </p>
                      </div>
                      <p
                        className="text-2xl font-bold"
                        style={{ color: "var(--brand-cyan)" }}
                      >
                        $3,200
                      </p>
                    </div>

                    <div
                      className="flex items-center justify-between p-4 rounded-lg"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <div>
                        <p className="font-medium">Additional Damage</p>
                        <p
                          className="text-sm"
                          style={{ color: "var(--neutral-gray-400)" }}
                        >
                          Claim #ATL-2851
                        </p>
                      </div>
                      <p
                        className="text-2xl font-bold"
                        style={{ color: "var(--brand-purple)" }}
                      >
                        $1,800
                      </p>
                    </div>

                    <div
                      className="p-4 rounded-lg border"
                      style={{
                        backgroundColor: "var(--brand-navy)",
                        borderColor: "rgba(0, 212, 255, 0.3)",
                      }}
                    >
                      <p
                        className="font-medium mb-2"
                        style={{ color: "var(--brand-cyan)" }}
                      >
                        Total Potential: $5,000
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        Across 2 identified opportunities
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scene 3: Adjuster Intelligence */}
            <div className="atlas-interface-elevated rounded-3xl p-12 relative overflow-hidden">
              <div
                className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl"
                style={{ backgroundColor: "var(--brand-cyan)", opacity: 0.1 }}
              />

              <div className="relative">
                <h3 className="text-[2.775rem] font-bold mb-4">
                  ADJUSTER INTELLIGENCE
                </h3>
                <p
                  className="text-xl mb-8"
                  style={{ color: "var(--neutral-gray-400)" }}
                >
                  Atlas remembers historical interactions and operational
                  patterns.
                </p>

                <div className="atlas-interface rounded-2xl p-8">
                  <div className="flex items-center space-x-6 mb-6">
                    <div className="w-16 h-16 gradient-mixed rounded-full flex items-center justify-center">
                      <span className="text-2xl">👷</span>
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold">Michael Turner</h4>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        State Farm • 127 interactions
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div
                      className="p-4 rounded-lg text-center"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <p
                        className="text-[2.775rem] font-bold mb-1"
                        style={{ color: "var(--brand-cyan)" }}
                      >
                        6.1
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        Avg Days
                      </p>
                    </div>
                    <div
                      className="p-4 rounded-lg text-center"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <p
                        className="text-[2.775rem] font-bold mb-1"
                        style={{ color: "var(--brand-purple)" }}
                      >
                        83%
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        Approval
                      </p>
                    </div>
                    <div
                      className="p-4 rounded-lg text-center"
                      style={{ backgroundColor: "var(--brand-navy-dark)" }}
                    >
                      <p
                        className="text-[2.775rem] font-bold mb-1"
                        style={{ color: "var(--brand-cyan)" }}
                      >
                        High
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--neutral-gray-400)" }}
                      >
                        Confidence
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-6 p-4 rounded-lg border"
                    style={{
                      backgroundColor: "var(--brand-navy)",
                      borderColor: "rgba(124, 58, 237, 0.3)",
                    }}
                  >
                    <p
                      className="font-medium mb-2"
                      style={{ color: "var(--brand-purple)" }}
                    >
                      Pattern: Requests code documentation before approval in
                      83% of supplements
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: "var(--neutral-gray-400)" }}
                    >
                      Recommendation: Attach code documentation before
                      submission
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dramatic Final CTA */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--brand-navy)] to-[var(--brand-navy-dark)]" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--brand-cyan)", opacity: 0.1 }}
        />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-[4.625rem] md:text-[6.475rem] font-bold mb-8 animate-fade-in-up">
            YOUR COMPANY
            <br />
            <span className="gradient-mixed bg-clip-text text-transparent">
              ALREADY HAS
            </span>
            <br />
            <span
              className="animate-text-reveal"
              style={{ animationDelay: "0.3s" }}
            >
              THE ANSWERS.
            </span>
          </h2>

          <div
            className="mt-12 animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <p
              className="text-[2.775rem] font-bold mb-4"
              style={{ color: "var(--brand-cyan)" }}
            >
              ATLAS KNOWS WHERE TO FIND THEM.
            </p>
          </div>

          <div
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up"
            style={{ animationDelay: "0.9s" }}
          >
            <a
              href={`${ATLAS_APP_URL}/login`}
              className="px-12 py-5 gradient-mixed rounded-xl font-medium text-xl shadow-brand hover:shadow-xl transition-all cinematic-glow-cyan"
              style={{ color: "white" }}
            >
              REQUEST PILOT ACCESS
            </a>
            <Link
              href={`${ATLAS_APP_URL}/login`}
              className="px-12 py-5 rounded-xl font-medium text-xl border hover:bg-white/10 transition-all"
              style={{ borderColor: "rgba(255, 255, 255, 0.2)" }}
            >
              SIGN IN
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-12 px-6 border-t"
        style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
      >
        <div
          className="max-w-7xl mx-auto text-center"
          style={{ color: "var(--neutral-gray-500)" }}
        >
          <p>
            © 2026 Project Atlas. AI Operating System for Insurance Restoration.
          </p>
        </div>
      </footer>
    </div>
  );
}
