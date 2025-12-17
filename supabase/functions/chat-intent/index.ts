import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplicationHistoryItem {
  id: string;
  status: string | null;
  ai_reason: string | null;
  loan_amount: number;
  credit_score: number | null;
  created_at: string | null;
  emi_amount: number | null;
  loan_tenure: number;
}

interface IntentRequest {
  userMessage: string;
  conversationHistory: { role: string; content: string }[];
  applicationContext?: {
    hasExistingApplication: boolean;
    applicationStatus?: string;
    rejectionReason?: string;
    loanAmount?: number;
    creditScore?: number;
    applicationHistory?: ApplicationHistoryItem[];
  };
  currentStep: string;
  isCollectingField: boolean;
  currentDate: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, conversationHistory, applicationContext, currentStep, isCollectingField, currentDate }: IntentRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use provided current date or fallback to server date
    const todayDate = currentDate || new Date().toLocaleDateString('en-IN', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    // Build application history summary for AI context
    const appHistory = applicationContext?.applicationHistory || [];
    let historyContext = "";
    
    if (appHistory.length > 0) {
      const approved = appHistory.filter(a => a.status === 'approved').length;
      const rejected = appHistory.filter(a => a.status === 'rejected').length;
      const pending = appHistory.filter(a => a.status === 'pending' || a.status === 'manual_review').length;
      const totalAmount = appHistory.reduce((sum, a) => sum + Number(a.loan_amount || 0), 0);
      const approvedAmount = appHistory.filter(a => a.status === 'approved').reduce((sum, a) => sum + Number(a.loan_amount || 0), 0);
      
      historyContext = `
USER'S LOAN APPLICATION HISTORY (Last ${appHistory.length} applications):
- Total applications: ${appHistory.length}
- Approved: ${approved}
- Rejected: ${rejected}
- Pending/Under Review: ${pending}
- Total amount applied: ₹${totalAmount.toLocaleString('en-IN')}
- Total approved amount: ₹${approvedAmount.toLocaleString('en-IN')}

DETAILED HISTORY:
${appHistory.map((app, i) => `${i + 1}. Application ID: ${app.id.substring(0, 8)}...
   - Status: ${app.status?.toUpperCase() || 'UNKNOWN'}
   - Amount: ₹${Number(app.loan_amount).toLocaleString('en-IN')}
   - Tenure: ${app.loan_tenure} months
   - Credit Score: ${app.credit_score || 'N/A'}
   - EMI: ${app.emi_amount ? `₹${Number(app.emi_amount).toLocaleString('en-IN')}/month` : 'N/A'}
   - Date: ${app.created_at ? new Date(app.created_at).toLocaleDateString('en-IN') : 'N/A'}
   ${app.ai_reason ? `- Reason: ${app.ai_reason}` : ''}`).join('\n')}`;
    }

    const systemPrompt = `You are an intelligent, friendly loan assistant chatbot like ChatGPT or Gemini. You must answer ALL user questions naturally and helpfully. Never give repetitive or generic responses.

IMPORTANT: Today's date is ${todayDate}. Always use this date when users ask about the current date, day, or time.

CONTEXT:
- Current chat step: ${currentStep}
- Is collecting form field: ${isCollectingField}
- User has existing application: ${applicationContext?.hasExistingApplication || false}
- Latest application status: ${applicationContext?.applicationStatus || 'none'}
- Latest rejection reason: ${applicationContext?.rejectionReason || 'none'}
${historyContext}

INTENT CATEGORIES:
1. "greeting" - User is greeting or starting conversation
2. "apply_loan" - User wants to apply for a new loan
3. "check_status" - User wants to know their application status
4. "rejection_reason" - User wants to know why their loan was rejected
5. "application_history" - User wants to see their past applications or ask about them (how many approved, rejected, total amount, etc.)
6. "loan_info" - User has general questions about loans, EMI, interest rates
7. "form_response" - User is responding to a form question (providing name, amount, tenure, income)
8. "document_query" - User is asking about documents or upload process
9. "help" - User needs help or guidance
10. "continue_application" - User wants to continue an existing/pending application
11. "other" - Anything else that needs a thoughtful response

RESPONSE FORMAT (JSON only):
{
  "intent": "<intent_category>",
  "confidence": <0.0-1.0>,
  "suggestedResponse": "<natural conversational response based on intent and context>",
  "shouldContinueFlow": <true if the user is cooperating with the current flow, false if they're asking something else>
}

CRITICAL RULES:
1. NEVER give repetitive or generic responses - always provide specific, contextual answers
2. When user asks about their history (how many approved/rejected, amounts, etc.), use the DETAILED HISTORY above to give accurate numbers
3. If user asks "why was my loan rejected?", ALWAYS include the specific rejection reason from the history
4. Be conversational, empathetic, and helpful like ChatGPT
5. For questions about loan history, calculate exact numbers from the history data provided
6. If the user is in the middle of providing form data (isCollectingField=true) and their message looks like a form response, classify as "form_response" with shouldContinueFlow=true
7. Answer ANY question the user asks - don't redirect them unless absolutely necessary
8. Use the user's actual data to personalize responses (e.g., "You have 3 approved loans totaling ₹5,00,000")`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI response:", content);
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = {
        intent: "other",
        confidence: 0.5,
        suggestedResponse: "I'm here to help you with your loan application. How can I assist you today?",
        shouldContinueFlow: true
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("chat-intent error:", e);
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : "Unknown error",
      intent: "other",
      confidence: 0,
      suggestedResponse: "I'm here to help! Would you like to apply for a loan or do you have questions about your existing application?",
      shouldContinueFlow: true
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});