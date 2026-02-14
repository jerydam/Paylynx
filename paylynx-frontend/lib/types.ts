export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  isVerified: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  transactionData?: TransactionData;
  type?: 'text' | 'widget';
}

export interface TransactionData {
  id: string;
  recipientName: string;
  recipient: string;
  recipientCountry: string;
  amount: number;
  currency: string;
  purpose: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  createdAt: Date;
}

export interface TransactionHistory {
  total: number;
  count: number;
  transactions: TransactionData[];
}
