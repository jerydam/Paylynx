'use client';

import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePrivy, useSendTransaction } from '@privy-io/react-auth';
import type { SendTransactionModalUIOptions } from '@privy-io/react-auth';
import { useApp } from '@/lib/app-context';
import { ChatMessage as ChatMessageComponent } from '@/components/chat-message';
import { ChatInput } from '@/components/chat-input';
import { Button } from '@/components/ui/button';
import { TransactionSuccess } from '@/components/transaction-success';

// Enhanced types for the new reasoning engine
interface IntentAnalysis {
  intent_type: string;
  confidence: number;
  reasoning: string;
  extracted_entities: Record<string, any>;
  requires_clarification: boolean;
  clarification_questions: string[];
  suggested_action: string;
}

export const ChatPage: React.FC = () => {
  const { chatMessages, addChatMessage } = useApp();
  const { user, getAccessToken } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTx, setPendingTx] = useState<any>(null);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [successData, setSuccessData] = useState<{
    txHash: string;
    data: any;
  } | null>(null);
  const [awaitingInput, setAwaitingInput] = useState<{
    type: 'address' | 'amount' | 'confirmation';
    context: any;
  } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://paylynx.onrender.com';

  // Fetch saved accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!user) return;
      
      console.log('📋 Fetching saved accounts...');
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE_URL}/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log(`✅ Loaded ${data.length} contact(s)`);
          setSavedAccounts(data);
        }
      } catch (err) {
        console.error('❌ Error fetching accounts:', err);
      }
    };

    fetchAccounts();
  }, [user, getAccessToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, pendingTx, awaitingInput]);

  // Update conversation history
  const updateConversationHistory = (role: 'user' | 'assistant', content: string) => {
    setConversationHistory(prev => [
      ...prev,
      { role, content, timestamp: new Date().toISOString() }
    ].slice(-10)); // Keep last 10 messages for context
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !user) {
      console.log('⚠️ Cannot send - empty message or no user');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('💬 [USER MESSAGE]:', message);
    console.log('='.repeat(60));

    const userMsg = {
      id: uuidv4(),
      sender: 'user',
      content: message,
      timestamp: new Date(),
    };
    addChatMessage(userMsg);
    updateConversationHistory('user', message);
    setIsLoading(true);

    try {
      // If we're in a specific input mode, handle accordingly
      if (awaitingInput) {
        await handleContextualInput(message);
        return;
      }

      // Step 1: Use advanced intent analysis
      console.log('\n[ADVANCED ANALYSIS] Calling reasoning engine...');
      
      const analysisRes = await fetch(`${API_BASE_URL}/agent/analyze-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          prompt: message,
          conversation_history: conversationHistory,
          user_contacts: savedAccounts.map(acc => ({
            name: acc.name,
            address: acc.address
          }))
        }),
      });

      if (!analysisRes.ok) {
        throw new Error(`Analysis failed: ${analysisRes.statusText}`);
      }

      const analysis: IntentAnalysis = await analysisRes.json();
      
      console.log('📊 Analysis Result:');
      console.log(`  Intent: ${analysis.intent_type} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
      console.log(`  Reasoning: ${analysis.reasoning}`);
      console.log(`  Entities:`, analysis.extracted_entities);
      console.log(`  Needs clarification: ${analysis.requires_clarification}`);

      // Handle different intent types
      await handleIntentResponse(analysis, message);

    } catch (err: any) {
      console.error('❌ Error processing message:', err);
      
      const errorMsg = {
        id: uuidv4(),
        sender: 'assistant',
        content: `🚫 Sorry, I encountered an error: ${err.message || 'Unable to process your request'}. Please try again.`,
        timestamp: new Date(),
      };
      addChatMessage(errorMsg);
      updateConversationHistory('assistant', errorMsg.content);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIntentResponse = async (analysis: IntentAnalysis, originalMessage: string) => {
    const { intent_type, extracted_entities, requires_clarification, clarification_questions, reasoning } = analysis;

    // Handle different intent types
    switch (intent_type) {
      case 'send_money':
        await handleSendMoneyIntent(analysis);
        break;

      case 'split_bill':
        await handleSplitBillIntent(analysis);
        break;

      case 'schedule_payment':
        await handleSchedulePaymentIntent(analysis);
        break;

      case 'check_balance':
        await handleCheckBalanceIntent(analysis);
        break;

      case 'view_history':
        await handleViewHistoryIntent(analysis);
        break;

      case 'manage_contacts':
        await handleManageContactsIntent(analysis);
        break;

      case 'general_query':
        await handleGeneralQuery(analysis);
        break;

      case 'unclear':
      default:
        const response = {
          id: uuidv4(),
          sender: 'assistant',
          content: `I'm not quite sure what you'd like to do. Here are some things I can help with:

• **Send money** - "Send $50 to Alice" or "Pay john@example.com $20"
• **Split bills** - "Split $120 dinner with Alice and Bob"
• **Check history** - "How much did I spend last week?"
• **Manage contacts** - "Show my saved recipients"

What would you like to do?`,
          timestamp: new Date(),
        };
        addChatMessage(response);
        updateConversationHistory('assistant', response.content);
        break;
    }
  };

  const handleSendMoneyIntent = async (analysis: IntentAnalysis) => {
    const { extracted_entities, requires_clarification, clarification_questions } = analysis;

    // Check if we need clarification
    if (requires_clarification) {
      const response = {
        id: uuidv4(),
        sender: 'assistant',
        content: `I understand you want to send money! 💸\n\n${clarification_questions.join('\n\n')}`,
        timestamp: new Date(),
      };
      addChatMessage(response);
      updateConversationHistory('assistant', response.content);

      // Set up awaiting input based on what's missing
      if (!extracted_entities.amount) {
        setAwaitingInput({ type: 'amount', context: extracted_entities });
      } else if (!extracted_entities.recipient_address && !extracted_entities.recipient_name) {
        setAwaitingInput({ type: 'address', context: extracted_entities });
      }
      return;
    }

    // Check if we have a recipient name but need to look up address
    if (extracted_entities.recipient_name && !extracted_entities.recipient_address) {
      // Check saved contacts
      const contact = savedAccounts.find(
        acc => acc.name.toLowerCase() === extracted_entities.recipient_name.toLowerCase()
      );

      if (contact) {
        console.log(`✅ Found contact: ${contact.name} -> ${contact.address}`);
        extracted_entities.recipient_address = contact.address;
      } else {
        // Ask for address/email
        const response = {
          id: uuidv4(),
          sender: 'assistant',
          content: `I don't have **${extracted_entities.recipient_name}** saved yet.\n\nPlease provide their:\n• Wallet address (0x...)\n• Email address (if they use Privy)`,
          timestamp: new Date(),
        };
        addChatMessage(response);
        updateConversationHistory('assistant', response.content);
        setAwaitingInput({
          type: 'address',
          context: {
            recipient_name: extracted_entities.recipient_name,
            amount: extracted_entities.amount
          }
        });
        return;
      }
    }

    // We have everything we need - show confirmation
    const confirmationMsg = {
      id: uuidv4(),
      sender: 'assistant',
      content: `Perfect! Here's what I understood:\n\n**Send ${extracted_entities.amount} ${extracted_entities.token || 'USDC'}**\n**To:** ${extracted_entities.recipient_name || 'Address'}\n**Address:** \`${extracted_entities.recipient_address.slice(0, 6)}...${extracted_entities.recipient_address.slice(-4)}\`\n\nConfirm to proceed?`,
      timestamp: new Date(),
    };
    addChatMessage(confirmationMsg);
    updateConversationHistory('assistant', confirmationMsg.content);

    setPendingTx({
      amount: extracted_entities.amount,
      token: extracted_entities.token || 'USDC',
      recipient: extracted_entities.recipient_address,
      recipient_name: extracted_entities.recipient_name,
      recipient_email: extracted_entities.recipient_email
    });
  };

  const handleSplitBillIntent = async (analysis: IntentAnalysis) => {
    const { extracted_entities } = analysis;
    
    const response = {
      id: uuidv4(),
      sender: 'assistant',
      content: `🧾 **Bill Splitting**\n\nI can see you want to split **$${extracted_entities.total_amount}** with **${extracted_entities.recipients?.join(', ')}**.\n\n**Your share:** $${extracted_entities.user_pays}\n\nThis will create ${extracted_entities.recipients?.length} transactions:\n${extracted_entities.recipients?.map((r: string) => `• $${extracted_entities.amount_per_person} to ${r}`).join('\n')}\n\n⚠️ **Note:** Multi-transaction splitting is coming soon! For now, you can send to each person individually.`,
      timestamp: new Date(),
    };
    addChatMessage(response);
    updateConversationHistory('assistant', response.content);
  };

  const handleSchedulePaymentIntent = async (analysis: IntentAnalysis) => {
    const { extracted_entities } = analysis;
    
    const response = {
      id: uuidv4(),
      sender: 'assistant',
      content: `📅 **Scheduled Payments**\n\nI can see you want to schedule a payment${extracted_entities.description ? ` for ${extracted_entities.description}` : ''}.\n\n⚠️ **Coming Soon!** Scheduled and recurring payments are in development.\n\nFor now, I can help you:\n• Send one-time payments\n• Save recipients for quick future payments\n\nWould you like to send a payment now instead?`,
      timestamp: new Date(),
    };
    addChatMessage(response);
    updateConversationHistory('assistant', response.content);
  };

  const handleCheckBalanceIntent = async (analysis: IntentAnalysis) => {
    const response = {
      id: uuidv4(),
      sender: 'assistant',
      content: `💰 **Balance Check**\n\n⚠️ Balance checking is coming soon!\n\nYou can check your wallet balance directly in MetaMask or your Privy wallet.\n\nYour connected wallet:\n\`${user?.wallet?.address || 'Not connected'}\``,
      timestamp: new Date(),
    };
    addChatMessage(response);
    updateConversationHistory('assistant', response.content);
  };

  const handleViewHistoryIntent = async (analysis: IntentAnalysis) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE_URL}/transactions?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const transactions = await res.json();
        
        if (transactions.length === 0) {
          const response = {
            id: uuidv4(),
            sender: 'assistant',
            content: `📜 **Transaction History**\n\nYou haven't made any transactions yet.\n\nOnce you send money, your history will appear here!`,
            timestamp: new Date(),
          };
          addChatMessage(response);
          updateConversationHistory('assistant', response.content);
        } else {
          const historyText = transactions.map((tx: any, idx: number) => 
            `${idx + 1}. **$${tx.amount}** to **${tx.recipient_name || tx.recipient.slice(0, 6) + '...'}** - ${new Date(tx.created_at).toLocaleDateString()}`
          ).join('\n');

          const response = {
            id: uuidv4(),
            sender: 'assistant',
            content: `📜 **Recent Transactions**\n\n${historyText}\n\n[View all transactions in your dashboard]`,
            timestamp: new Date(),
          };
          addChatMessage(response);
          updateConversationHistory('assistant', response.content);
        }
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleManageContactsIntent = async (analysis: IntentAnalysis) => {
    if (savedAccounts.length === 0) {
      const response = {
        id: uuidv4(),
        sender: 'assistant',
        content: `📇 **Saved Contacts**\n\nYou don't have any saved contacts yet.\n\nWhen you send money to someone, I'll ask if you want to save them for faster future transactions!`,
        timestamp: new Date(),
      };
      addChatMessage(response);
      updateConversationHistory('assistant', response.content);
    } else {
      const contactsList = savedAccounts.map((acc, idx) => 
        `${idx + 1}. **${acc.name}** - \`${acc.address.slice(0, 6)}...${acc.address.slice(-4)}\``
      ).join('\n');

      const response = {
        id: uuidv4(),
        sender: 'assistant',
        content: `📇 **Your Saved Contacts** (${savedAccounts.length})\n\n${contactsList}\n\nYou can now send money by just saying "Send $X to [name]"!`,
        timestamp: new Date(),
      };
      addChatMessage(response);
      updateConversationHistory('assistant', response.content);
    }
  };

  const handleGeneralQuery = async (analysis: IntentAnalysis) => {
    const { extracted_entities } = analysis;
    
    let responseText = `Thanks for your question!\n\n`;

    if (extracted_entities.query_topic === 'supported_tokens') {
      responseText += `💎 **Supported Tokens:**\n\nCurrently, I support **USDC** on **Base Sepolia** testnet.\n\nMore tokens and networks coming soon!`;
    } else {
      responseText += `I'm Paylynx AI, your crypto payment assistant!\n\n**I can help you:**\n• Send USDC to anyone\n• Split bills with friends\n• Manage your contacts\n• View transaction history\n\nWhat would you like to do?`;
    }

    const response = {
      id: uuidv4(),
      sender: 'assistant',
      content: responseText,
      timestamp: new Date(),
    };
    addChatMessage(response);
    updateConversationHistory('assistant', response.content);
  };

  const handleContextualInput = async (input: string) => {
    if (!awaitingInput) return;

    const { type, context } = awaitingInput;

    if (type === 'address') {
      // Check if it's an email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(input.trim())) {
        await handleEmailLookup(input.trim(), context);
      } else if (/^0x[a-fA-F0-9]{40}$/.test(input.trim())) {
        // Valid wallet address
        setPendingTx({
          amount: context.amount,
          token: 'USDC',
          recipient: input.trim(),
          recipient_name: context.recipient_name
        });

        const response = {
          id: uuidv4(),
          sender: 'assistant',
          content: `✅ **Address confirmed!**\n\n**Send ${context.amount} USDC** to **${context.recipient_name || 'Address'}**\n\nAddress: \`${input.trim().slice(0, 6)}...${input.trim().slice(-4)}\`\n\nConfirm to proceed?`,
          timestamp: new Date(),
        };
        addChatMessage(response);
        updateConversationHistory('assistant', response.content);
        setAwaitingInput(null);
      } else {
        const response = {
          id: uuidv4(),
          sender: 'assistant',
          content: `❌ That doesn't look like a valid wallet address or email.\n\nPlease provide:\n• A wallet address (0x... 42 characters)\n• An email address (user@example.com)`,
          timestamp: new Date(),
        };
        addChatMessage(response);
        updateConversationHistory('assistant', response.content);
      }
    } else if (type === 'amount') {
      const amountMatch = input.match(/(\d+(?:\.\d+)?)/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1]);
        // Continue with the flow using this amount
        await handleSendMoneyIntent({
          ...context,
          extracted_entities: {
            ...context,
            amount
          },
          requires_clarification: false
        } as any);
        setAwaitingInput(null);
      } else {
        const response = {
          id: uuidv4(),
          sender: 'assistant',
          content: `❌ I couldn't find a valid amount in your message.\n\nPlease specify an amount like:\n• "$50" or "50 dollars"\n• "100"\n• "25.50"`,
          timestamp: new Date(),
        };
        addChatMessage(response);
        updateConversationHistory('assistant', response.content);
      }
    }

    setIsLoading(false);
  };

  const handleEmailLookup = async (email: string, context: any) => {
    console.log(`🔍 Looking up email: ${email}`);
    
    const progressMsg = {
      id: uuidv4(),
      sender: 'assistant',
      content: `🔍 **Looking up ${email}...**\n\n⏳ Checking Privy database...`,
      timestamp: new Date(),
    };
    addChatMessage(progressMsg);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE_URL}/privy/lookup-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json();
        
        const successMsg = {
          id: uuidv4(),
          sender: 'assistant',
          content: `✅ **Wallet found!**\n\nEmail: ${email}\nAddress: \`${data.address.slice(0, 6)}...${data.address.slice(-4)}\`\n\nPreparing transaction...`,
          timestamp: new Date(),
        };
        addChatMessage(successMsg);
        updateConversationHistory('assistant', successMsg.content);

        setPendingTx({
          amount: context.amount,
          token: 'USDC',
          recipient: data.address,
          recipient_name: context.recipient_name,
          recipient_email: email
        });

        setAwaitingInput(null);
      } else {
        const error = await res.json();
        
        const errorMsg = {
          id: uuidv4(),
          sender: 'assistant',
          content: `❌ **Lookup failed**\n\n${error.detail}\n\nPlease provide a wallet address instead (starting with 0x).`,
          timestamp: new Date(),
        };
        addChatMessage(errorMsg);
        updateConversationHistory('assistant', errorMsg.content);
      }
    } catch (err: any) {
      const errorMsg = {
        id: uuidv4(),
        sender: 'assistant',
        content: `❌ Error looking up email: ${err.message}`,
        timestamp: new Date(),
      };
      addChatMessage(errorMsg);
      updateConversationHistory('assistant', errorMsg.content);
    }

    setIsLoading(false);
  };
const handleSaveContactFromCard = async (name: string, address: string) => {
    // Re-use your existing save logic here, or just call the API directly
    const token = await getAccessToken();
    await fetch(`${API_BASE_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        address,
        chain_id: 42431,
        type: 'evm',
      }),
    });
    
    // Refresh local list
    const updatedRes = await fetch(`${API_BASE_URL}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (updatedRes.ok) setSavedAccounts(await updatedRes.json());
  };
  const confirmAndSend = async () => {
    if (!pendingTx || !user?.wallet?.address) return;

    console.log('🚀 Confirming transaction:', pendingTx);
    setIsLoading(true);

    try {
      // Step 1: Prepare transaction (Keep existing logic)
      const token = await getAccessToken();
      const prepRes = await fetch(`${API_BASE_URL}/agent/prepare-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: pendingTx.amount,
          recipient: pendingTx.recipient,
          token: pendingTx.token || 'USDC',
        }),
      });

      if (!prepRes.ok) throw new Error('Failed to prepare transaction');
      const { tx_data } = await prepRes.json();

      // Step 2: Send Transaction (Keep existing logic)
      const txResponse = await sendTransaction({
        to: tx_data.to,
        data: tx_data.data,
        value: tx_data.value || '0x0',
        chainId: tx_data.chainId,
      });

      const txHash = txResponse.hash;

      // Step 3: Record in DB (Keep existing logic)
      await fetch(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tx_hash: txHash,
          amount: pendingTx.amount,
          recipient: pendingTx.recipient,
          recipient_name: pendingTx.recipient_name || 'Unknown',
        }),
      });

      // 3. TRIGGER THE SUCCESS CARD
      setSuccessData({
        txHash: txHash,
        data: {
          id: uuidv4(), // Generate a temp ID for the view
          amount: pendingTx.amount,
          recipient: pendingTx.recipient,
          recipientName: pendingTx.recipient_name || 'Unknown',
          date: new Date(),
          status: 'completed'
        }
      });

      // Add success message to chat history as well
      addChatMessage({
        id: uuidv4(),
        sender: 'assistant',
        content: `✅ **Transaction successful!**\n\nHash: \`${txHash}\``,
        timestamp: new Date(),
      });

    } catch (err: any) {
      const errorMsg = {
        id: uuidv4(),
        sender: 'assistant',
        content: `❌ **Transaction failed**\n\n${err.message}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      addChatMessage(errorMsg);
      updateConversationHistory('assistant', errorMsg.content);
    } finally {
      setIsLoading(false);
      setPendingTx(null);
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950 overflow-hidden">
      {/* Header */}
      <header className="glass border-b border-teal-400/20 p-4 sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-500 flex items-center justify-center overflow-hidden shadow-lg shadow-teal-500/20">
    <img
      src="/log.png"
      className="w-full h-full object-cover"
      alt="Paylynx"
    />
  </div>
  <div>
    <img
      src="/text.png"
      className="h-6 w-auto mb-1"
      alt="Paylynx"
    />
    <p className="text-xs text-slate-400 leading-none">Advanced reasoning • Context-aware</p>
  </div>
</div>
          <div className="text-right glass bg-slate-900/50 border-teal-400/20 px-4 py-2 rounded-xl">
            <p className="text-xs text-slate-400">Connected</p>
            <p className="text-sm font-bold text-teal-400">
              {user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : 'No wallet'}
            </p>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-32 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-teal-500/20 rounded-full blur-3xl" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center text-slate-900 font-bold text-3xl shadow-2xl shadow-teal-500/40">
                <img
             src={"/log.png"}
             className="w-20 h-20 rounded-full"
             alt="Paylynx"
            />
              </div>
            </div>

            <h2 className="text-3xl font-bold gradient-text mb-3">Paylynx AI Agent</h2>
            <p className="text-slate-400 max-w-md mb-2">
              I understand natural language and can help with complex requests
            </p>
            <p className="text-xs text-teal-400 mb-8">
              ✨ Powered by Gemini 2.0 Flash with chain-of-thought reasoning
            </p>

            {/* Example prompts */}
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              {[
                'Send $50 to Mom',
                'Split $120 dinner with Alice and Bob',
                'How much did I spend last week?',
                'Pay alice@example.com $25',
                'Show my saved contacts',
                'Send her $100'
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSendMessage(prompt)}
                  className="px-4 py-2 rounded-full glass bg-slate-900/50 border border-slate-700 text-slate-300 text-sm hover:border-teal-500/50 hover:text-teal-300 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((msg) => (
              <ChatMessageComponent key={msg.id} message={msg} />
            ))}

            {/* Pending Transaction */}
            {pendingTx && (
              <div className="glass border border-teal-500/30 rounded-2xl p-6 max-w-xl mx-auto animate-in fade-in zoom-in duration-300">
                <h3 className="text-lg font-bold mb-4 text-teal-300">Confirm Transaction</h3>
                <div className="space-y-3 mb-6">
                  <p><strong>Amount:</strong> {pendingTx.amount} {pendingTx.token}</p>
                  <p><strong>To:</strong> {pendingTx.recipient_name && <span className="text-teal-300">{pendingTx.recipient_name} - </span>}<span className="font-mono text-sm">{pendingTx.recipient}</span></p>
                </div>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setPendingTx(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmAndSend}
                    disabled={isLoading}
                    className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500"
                  >
                    {isLoading ? 'Sending...' : 'Confirm & Send'}
                  </Button>
                </div>
              </div>
            )}

            {/* Loading */}
            {isLoading && !pendingTx && (
              <div className="flex gap-3 items-end">
                <div className="w-10 h-10 rounded-full glass bg-gradient-to-r from-teal-400/20 to-emerald-500/20 border border-teal-400/30 flex items-center justify-center">
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                </div>
                <div className="glass bg-slate-900/50 px-4 py-3 rounded-2xl">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Thinking...</p>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
        {successData && (
        <TransactionSuccess 
          transaction={successData.data}
          txHash={successData.txHash}
          onClose={() => setSuccessData(null)}
          onSaveContact={handleSaveContactFromCard}
        />
      )}
    
      <ChatInput onSend={handleSendMessage} disabled={isLoading || !!pendingTx} />
    </div>
  );
};