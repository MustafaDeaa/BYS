import { useState, useRef } from "react";

// يمر عبر Vite proxy → Groq (OpenAI-compatible)، يتفادى CORS ويخفي المفتاح في .env
const GROQ_MODEL = "llama-3.3-70b-versatile";

const chatCompletion = async (userContent, maxTokens = 1200) => {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: userContent }],
      max_tokens: maxTokens,
      temperature: 0.35,
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw || response.statusText);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from API");
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("Empty model response");
  }
  return text;
};

const parseJsonFromLlm = (text) => {
  const clean = text.replace(/```json|```/g, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
};

// ── Step 1: معلومات الأغنية (معرفة النموذج؛ ليس بحثاً حياً على الويب) ──
const searchSong = async (songName) => {
  const text = await chatCompletion(
    `أنت خبير موسيقى عربي. استخدم معلوماتك الموثوقة عن الأغاني المعروفة.

الأغنية: "${songName}"

إذا عرفت الأغنية والمغني بثقة، أعطِ JSON فقط بدون أي نص إضافي أو backticks:
{
  "found": true,
  "singer": "اسم المغني",
  "genre": "النوع الموسيقي",
  "mood": "المزاج العام (حزين أو فرحان أو رومانسي أو حماسي)",
  "energy": 7,
  "tempo": "بطيء أو متوسط أو سريع",
  "themes": "المواضيع الرئيسية",
  "vocal_style": "أسلوب الصوت",
  "language_style": "فصحى أو عامية أو مزيج",
  "signature_phrases": "لمسة خاصة بالمغني في الكلمات",
  "sample_lyrics": "مقتطف معروف من كلمات الأغنية (3-4 أسطر) إن أمكن"
}

إذا لم تكن متأكداً أو الأغنية غير معروفة: { "found": false }`,
    1200
  );
  const parsed = parseJsonFromLlm(text);
  return parsed && typeof parsed.found === "boolean" ? parsed : { found: false };
};

// ── Step 2: تحليل من لينك + اسم (معرفة النموذج) ──
const analyzeFromUrl = async (url, songName) => {
  const text = await chatCompletion(
    `المستخدم أعطى رابطاً يخص أغنية والاسم التقريبي.
الرابط: ${url}
اسم الأغنية: ${songName}

استنتج من الرابط والاسم إن أمكن من معلوماتك. أعطِ JSON فقط بدون أي نص إضافي أو backticks:
{
  "found": true,
  "singer": "اسم المغني",
  "genre": "النوع الموسيقي",
  "mood": "المزاج العام (حزين أو فرحان أو رومانسي أو حماسي)",
  "energy": 7,
  "tempo": "بطيء أو متوسط أو سريع",
  "themes": "المواضيع الرئيسية",
  "vocal_style": "أسلوب الصوت",
  "language_style": "فصحى أو عامية أو مزيج",
  "signature_phrases": "لمسة خاصة بالمغني في الكلمات",
  "sample_lyrics": "مقتطف من كلمات الأغنية (3-4 أسطر) إن أمكن"
}

إذا تعذر: { "found": false }`,
    1200
  );
  const parsed = parseJsonFromLlm(text);
  return parsed && typeof parsed.found === "boolean" ? parsed : { found: false };
};

// ── Step 3: إعادة صياغة الكلمات ──
const rewriteLyrics = async (analysis, newLyrics) => {
  const text = await chatCompletion(
    `أنت كاتب كلمات موسيقية محترف.

المغني: ${analysis.singer}
أسلوب الصوت: ${analysis.vocal_style}
المزاج: ${analysis.mood}
الطاقة: ${analysis.energy}/10
أسلوب اللغة: ${analysis.language_style}
اللمسة الخاصة: ${analysis.signature_phrases}

الكلمات الجديدة التي يريد المستخدم كتابتها:
"${newLyrics}"

أعد كتابة هذه الكلمات بأسلوب ${analysis.singer} تماماً مع الحفاظ على المعنى.
أجب بـ JSON فقط بدون أي نص إضافي أو backticks:
{
  "rewritten_lyrics": "الكلمات المعاد كتابتها",
  "explanation": "شرح مختصر كيف طُبّق أسلوب المغني",
  "tips": "نصائح للأداء بنفس الطريقة"
}`,
    1000
  );
  const parsed = parseJsonFromLlm(text);
  if (!parsed?.rewritten_lyrics) {
    throw new Error("Invalid rewrite JSON");
  }
  return parsed;
};

// ── Mood → color palette ──
const moodColors = {
  "حزين":    { bg: "#1a1a2e", accent: "#7b68ee", glow: "#7b68ee40" },
  "فرحان":   { bg: "#1a2a1a", accent: "#50c878", glow: "#50c87840" },
  "رومانسي": { bg: "#2a1a1a", accent: "#ff6b9d", glow: "#ff6b9d40" },
  "حماسي":   { bg: "#2a1a0a", accent: "#ff8c00", glow: "#ff8c0040" },
  default:   { bg: "#0f0f1a", accent: "#00d4ff", glow: "#00d4ff40" },
};

const Spinner = () => (
  <span style={{
    width: "16px", height: "16px",
    border: "2px solid #fff3", borderTop: "2px solid #fff",
    borderRadius: "50%", display: "inline-block",
    animation: "spin 0.8s linear infinite",
  }} />
);

export default function SongAIApp() {
  // steps: input | searching | need_link | analyzing_link | analyzed | rewriting | result
  const [step, setStep]         = useState("input");
  const [songName, setSongName] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [newLyrics, setNewLyrics] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const inputRef = useRef(null);

  const colors = analysis?.mood
    ? moodColors[analysis.mood] || moodColors.default
    : moodColors.default;

  const energyBars = analysis
    ? Array.from({ length: 10 }, (_, i) => i < Number(analysis.energy))
    : [];

  // ── Handlers ──
  const handleSearch = async () => {
    if (!songName.trim()) return;
    setStep("searching");
    setError("");
    try {
      const data = await searchSong(songName);
      if (data.found) {
        setAnalysis(data);
        setStep("analyzed");
      } else {
        setStep("need_link");
      }
    } catch {
      setError("حدث خطأ في البحث. حاول مجدداً.");
      setStep("input");
    }
  };

  const handleLinkAnalyze = async () => {
    if (!linkInput.trim()) return;
    setStep("analyzing_link");
    setError("");
    try {
      const data = await analyzeFromUrl(linkInput.trim(), songName);
      if (data.found) {
        setAnalysis(data);
        setStep("analyzed");
      } else {
        setError("ما قدرت أحلل الأغنية من اللينك. جرب لينك ثاني.");
        setStep("need_link");
      }
    } catch {
      setError("حدث خطأ في تحليل اللينك. حاول مجدداً.");
      setStep("need_link");
    }
  };

  const handleRewrite = async () => {
    if (!newLyrics.trim()) return;
    setStep("rewriting");
    setError("");
    try {
      const data = await rewriteLyrics(analysis, newLyrics);
      setResult(data);
      setStep("result");
    } catch {
      setError("حدث خطأ في إعادة الكتابة. حاول مجدداً.");
      setStep("analyzed");
    }
  };

  const reset = () => {
    setStep("input"); setSongName(""); setLinkInput("");
    setNewLyrics(""); setAnalysis(null); setResult(null); setError("");
  };

  // ── Shared style helpers ──
  const card = (extra = {}) => ({
    background: "#ffffff08",
    border: `1px solid ${colors.accent}35`,
    borderRadius: "20px",
    padding: "28px",
    ...extra,
  });

  const primaryBtn = (disabled = false, extra = {}) => ({
    flex: 1, padding: "15px",
    background: disabled
      ? `${colors.accent}40`
      : `linear-gradient(135deg, ${colors.accent}, ${colors.accent}cc)`,
    border: "none", borderRadius: "12px", color: "#fff",
    fontSize: "16px", fontWeight: "700",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    boxShadow: disabled ? "none" : `0 4px 18px ${colors.glow}`,
    ...extra,
  });

  const ghostBtn = () => ({
    padding: "15px 20px", background: "#ffffff12",
    border: "1px solid #ffffff25", borderRadius: "12px",
    color: "#ffffff70", fontSize: "14px",
    cursor: "pointer", fontFamily: "inherit",
  });

  const textInput = (extra = {}) => ({
    width: "100%", padding: "14px 18px", fontSize: "15px",
    background: "#ffffff0e", border: `1px solid ${colors.accent}40`,
    borderRadius: "12px", color: "#fff", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit", direction: "rtl",
    ...extra,
  });

  return (
    <div style={{
      minHeight: "100vh", background: colors.bg,
      fontFamily: "'Cairo','Tajawal',sans-serif",
      direction: "rtl", color: "#fff", margin: 0, padding: 0,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap" rel="stylesheet" />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: "660px", margin: "0 auto", padding: "40px 20px" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: "44px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "10px",
            background: `${colors.accent}15`, border: `1px solid ${colors.accent}35`,
            borderRadius: "50px", padding: "7px 18px", marginBottom: "22px",
          }}>
            <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                  width: "3px", height: `${8 + i * 4}px`,
                  background: colors.accent, borderRadius: "2px",
                }} />
              ))}
            </div>
            <span style={{ color: colors.accent, fontSize: "13px", fontWeight: "600" }}>
              مدعوم بالذكاء الاصطناعي
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(26px,6vw,40px)", fontWeight: "900",
            background: `linear-gradient(135deg,#fff 0%,${colors.accent} 100%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: "0 0 10px", lineHeight: 1.2,
          }}>محلل ومعدّل الأغاني</h1>
          <p style={{ color: "#ffffff65", fontSize: "15px", margin: 0 }}>
            ادخل اسم الأغنية، نحلّل الأسلوب من المعرفة المتاحة، وعدّل الكلمات بأسلوب المغني
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            background: "#ff4d4d18", border: "1px solid #ff4d4d45",
            borderRadius: "12px", padding: "14px 18px", marginBottom: "22px",
            color: "#ff9090", fontSize: "14px", textAlign: "center",
          }}>{error}</div>
        )}

        {/* ══ STEP: input / searching ══ */}
        {(step === "input" || step === "searching") && (
          <div style={card()}>
            <label style={{ display: "block", color: "#ffffff85", fontSize: "14px", marginBottom: "10px", fontWeight: "600" }}>
              🎵 اسم الأغنية والمغني
            </label>
            <input
              ref={inputRef}
              value={songName}
              onChange={e => setSongName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && step === "input" && handleSearch()}
              placeholder="مثال: أنا وليلى - ماجد المهندس"
              disabled={step === "searching"}
              style={textInput()}
            />
            <button
              onClick={handleSearch}
              disabled={!songName.trim() || step === "searching"}
              style={{ ...primaryBtn(!songName.trim() || step === "searching"), marginTop: "18px", width: "100%" }}
            >
              {step === "searching" ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <Spinner /> جاري التحليل...
                </span>
              ) : "🔍 بحث وتحليل"}
            </button>
          </div>
        )}

        {/* ══ STEP: need_link / analyzing_link ══ */}
        {(step === "need_link" || step === "analyzing_link") && (
          <div>
            <div style={{
              background: "#ff8c0012", border: "1px solid #ff8c0038",
              borderRadius: "16px", padding: "20px 22px", marginBottom: "20px",
              display: "flex", gap: "14px", alignItems: "flex-start",
            }}>
              <span style={{ fontSize: "22px", flexShrink: 0 }}>🔎</span>
              <div>
                <div style={{ fontWeight: "700", fontSize: "15px", marginBottom: "5px" }}>
                  ما تعرّفنا على الأغنية من الاسم
                </div>
                <div style={{ color: "#ffffff65", fontSize: "13px", lineHeight: 1.7 }}>
                  "{songName}" ما انطابق واضح مع أغنية معروفة من الاسم فقط، أو المعلومات ناقصة.
                  جرّب لينك من يوتيوب أو سبوتيفاي أو أي موقع لتحسين التعرف.
                </div>
              </div>
            </div>

            <div style={card()}>
              <label style={{ display: "block", color: "#ffffff85", fontSize: "14px", marginBottom: "10px", fontWeight: "600" }}>
                🔗 لينك الأغنية
              </label>
              <input
                value={linkInput}
                onChange={e => setLinkInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && step === "need_link" && handleLinkAnalyze()}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={step === "analyzing_link"}
                style={textInput({ direction: "ltr", textAlign: "left" })}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  onClick={handleLinkAnalyze}
                  disabled={!linkInput.trim() || step === "analyzing_link"}
                  style={primaryBtn(!linkInput.trim() || step === "analyzing_link")}
                >
                  {step === "analyzing_link" ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                      <Spinner /> جاري التحليل من اللينك...
                    </span>
                  ) : "📥 حلّل من اللينك"}
                </button>
                <button onClick={reset} style={ghostBtn()}>رجوع</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP: analyzed / rewriting ══ */}
        {(step === "analyzed" || step === "rewriting") && analysis && (
          <div>
            <div style={card({ marginBottom: "20px" })}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "19px", fontWeight: "700" }}>🎤 {analysis.singer}</h2>
                <span style={{
                  background: `${colors.accent}20`, color: colors.accent,
                  padding: "5px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                }}>{analysis.mood}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
                {[
                  { label: "النوع",        value: analysis.genre },
                  { label: "الإيقاع",      value: analysis.tempo },
                  { label: "أسلوب الصوت",  value: analysis.vocal_style },
                  { label: "اللغة",         value: analysis.language_style },
                ].map(item => (
                  <div key={item.label} style={{ background: "#ffffff08", borderRadius: "10px", padding: "11px 14px" }}>
                    <div style={{ color: "#ffffff40", fontSize: "11px", marginBottom: "3px" }}>{item.label}</div>
                    <div style={{ fontSize: "13px", fontWeight: "600" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "18px" }}>
                <div style={{ color: "#ffffff50", fontSize: "12px", marginBottom: "7px" }}>مستوى الطاقة</div>
                <div style={{ display: "flex", gap: "4px", alignItems: "flex-end" }}>
                  {energyBars.map((active, i) => (
                    <div key={i} style={{
                      flex: 1, height: `${10 + i * 3}px`,
                      background: active ? colors.accent : "#ffffff12",
                      borderRadius: "3px",
                    }} />
                  ))}
                </div>
              </div>

              {analysis.sample_lyrics && (
                <div style={{
                  background: `${colors.accent}0d`, border: `1px solid ${colors.accent}20`,
                  borderRadius: "12px", padding: "14px",
                }}>
                  <div style={{ color: "#ffffff40", fontSize: "11px", marginBottom: "6px" }}>🎶 مقتطف من الأغنية</div>
                  <div style={{ color: "#ffffff80", fontSize: "13px", lineHeight: 1.9, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                    {analysis.sample_lyrics}
                  </div>
                </div>
              )}

              {analysis.themes && (
                <div style={{ marginTop: "14px", color: "#ffffff55", fontSize: "13px", lineHeight: 1.7 }}>
                  <strong style={{ color: "#ffffff75" }}>المواضيع: </strong>{analysis.themes}
                </div>
              )}
            </div>

            <div style={card()}>
              <label style={{ display: "block", color: "#ffffff85", fontSize: "14px", marginBottom: "10px", fontWeight: "600" }}>
                ✍️ الكلمات الجديدة اللي تريد تعدل عليها
              </label>
              <textarea
                value={newLyrics}
                onChange={e => setNewLyrics(e.target.value)}
                placeholder={`اكتب الكلمات الجديدة هنا...\nمثال: أنت رفيقي في كل الأيام، ما غبت عني ولا لحظة`}
                rows={5}
                disabled={step === "rewriting"}
                style={{ ...textInput(), resize: "vertical", lineHeight: 1.9 }}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  onClick={handleRewrite}
                  disabled={!newLyrics.trim() || step === "rewriting"}
                  style={primaryBtn(!newLyrics.trim() || step === "rewriting")}
                >
                  {step === "rewriting" ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                      <Spinner /> جاري التعديل...
                    </span>
                  ) : "✨ عدّل الكلمات بأسلوب المغني"}
                </button>
                <button onClick={reset} style={ghostBtn()}>أغنية جديدة</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP: result ══ */}
        {step === "result" && result && (
          <div>
            <div style={{
              background: `${colors.accent}0e`, border: `1px solid ${colors.accent}45`,
              borderRadius: "20px", padding: "26px", marginBottom: "18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                <div style={{
                  width: "36px", height: "36px", background: colors.accent,
                  borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "16px", flexShrink: 0,
                }}>✓</div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>الكلمات المعدّلة بأسلوب {analysis?.singer}</h2>
              </div>

              <div style={{
                background: "#00000028", borderRadius: "12px", padding: "18px",
                fontSize: "15px", lineHeight: 2.2, color: "#fff",
                borderRight: `3px solid ${colors.accent}`, marginBottom: "18px",
                whiteSpace: "pre-wrap",
              }}>
                {result.rewritten_lyrics}
              </div>

              <div style={{ background: "#ffffff08", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
                <div style={{ color: colors.accent, fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>💡 كيف طُبّق الأسلوب</div>
                <div style={{ color: "#ffffff70", fontSize: "13px", lineHeight: 1.8 }}>{result.explanation}</div>
              </div>

              <div style={{ background: "#ffffff08", borderRadius: "12px", padding: "14px" }}>
                <div style={{ color: colors.accent, fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>🎙️ نصائح للأداء</div>
                <div style={{ color: "#ffffff70", fontSize: "13px", lineHeight: 1.8 }}>{result.tips}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setStep("analyzed"); setResult(null); setNewLyrics(""); }}
                style={primaryBtn()}
              >🔄 عدّل كلمات أخرى</button>
              <button onClick={reset} style={ghostBtn()}>أغنية جديدة</button>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "44px", color: "#ffffff22", fontSize: "11px" }}>
          مدعوم بـ Groq (Llama) • شغّل المشروع بـ npm run dev حتى يعمل البروكسي
        </div>
      </div>
    </div>
  );
}