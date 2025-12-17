import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoanChat } from '@/hooks/useLoanChat';
import { ProgressTracker } from './ProgressTracker';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { ChatInput } from './ChatInput';
import { SanctionLetterButton } from './SanctionLetterButton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from '@/components/UserMenu';
import { Bot } from 'lucide-react';

export function LoanChat() {
  const navigate = useNavigate();
  const {
    messages,
    currentStep,
    isTyping,
    sanctionLetterData,
    processUserMessage,
    handleDocumentUpload,
  } = useLoanChat();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-6 py-4">
        <div className="max-w-auto mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="text-left">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            LoanPal
          </span>
        </div>
              <p className="text-xs text-muted-foreground">Personal Loan Application</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[78px]" />

      {/* Progress Tracker */}
      <ProgressTracker currentStep={currentStep} />

      {/* Chat Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          {sanctionLetterData && (
            <SanctionLetterButton
              applicationId={sanctionLetterData.applicationId}
              customerName={sanctionLetterData.customerName}
              loanAmount={sanctionLetterData.loanAmount}
              tenure={sanctionLetterData.tenure}
              interestRate={sanctionLetterData.interestRate}
              emiAmount={sanctionLetterData.emiAmount}
              creditScore={sanctionLetterData.creditScore}
              monthlyIncome={sanctionLetterData.monthlyIncome}
            />
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="max-w-6xl mx-auto w-full">
        <ChatInput
          onSendMessage={processUserMessage}
          onUploadFiles={handleDocumentUpload}
          isTyping={isTyping}
          currentStep={currentStep}
        />
      </div>
    </div>
  );
}
