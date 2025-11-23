export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Child {
  id: string;
  userId?: string; // 記錄擁有者 (父母的 UID)
  teamId?: string; // 團隊 ID，用於資料共享
  name: string;
  avatar: string; // Emoji 字元
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId?: string; // 記錄擁有者
  teamId?: string; // 團隊 ID，用於資料共享
  childId: string; // 連結到特定孩子
  date: string; // ISO 日期字串 YYYY-MM-DD
  amount: number;
  description: string;
  type: TransactionType;
  createdAt: number;
}

export interface Settlement {
  id: string;
  userId?: string; // 記錄擁有者
  teamId?: string; // 團隊 ID，用於資料共享
  childId: string; // 連結到特定孩子
  date: string; // ISO 日期字串 YYYY-MM-DD
  amountCleared: number; // 已清除的待結算金額
  createdAt: number;
}

export interface DaySummary {
  date: string;
  income: number;
  expense: number;
  isSettled: boolean;
  hasData: boolean;
}

export interface Team {
  id: string;
  name: string; // 團隊名稱，如「張家」
  creatorId: string; // 創建者的 UID
  inviteCode: string; // 6位邀請碼
  createdAt: number;
  members: string[]; // 成員 UID 列表
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  teamId: string | null; // 使用者當前所屬的團隊ID
  createdAt: number;
}