export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Child {
  id: string;
  userId?: string; // Owner of this record (Parent's UID)
  name: string;
  avatar: string; // Emoji character
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId?: string; // Owner of this record
  childId: string; // Link to a specific child
  date: string; // ISO Date string YYYY-MM-DD
  amount: number;
  description: string;
  type: TransactionType;
  createdAt: number;
}

export interface Settlement {
  id: string;
  userId?: string; // Owner of this record
  childId: string; // Link to a specific child
  date: string; // ISO Date string YYYY-MM-DD
  amountCleared: number; // The pending amount that was cleared
  createdAt: number;
}

export interface DaySummary {
  date: string;
  income: number;
  expense: number;
  isSettled: boolean;
  hasData: boolean;
}