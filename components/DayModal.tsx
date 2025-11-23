import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, CheckCircle, Trash2 } from 'lucide-react';
import { Transaction, TransactionType, Settlement } from '../types';

interface DayModalProps {
  date: string;
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  settlement: Settlement | undefined;
  onAddTransaction: (t: Omit<Transaction, 'id' | 'createdAt' | 'childId'>) => void;
  onDeleteTransaction: (id: string) => void;
  onSettle: () => void;
  onUnsettle: (id: string) => void;
  pendingAmountToDate: number;
}

const DayModal: React.FC<DayModalProps> = ({
  date,
  isOpen,
  onClose,
  transactions,
  settlement,
  onAddTransaction,
  onDeleteTransaction,
  onSettle,
  onUnsettle,
  pendingAmountToDate,
}) => {
  const [activeTab, setActiveTab] = useState<TransactionType>(TransactionType.INCOME);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const displayDate = new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    
    onAddTransaction({
      date,
      amount: parseFloat(amount),
      description: description || (activeTab === TransactionType.INCOME ? '零用錢' : '消費'),
      type: activeTab,
    });
    
    setAmount('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] md:max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold">{displayDate}</h2>
          <button onClick={onClose} className="p-1 hover:bg-indigo-700 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 md:space-y-6 min-h-0">
          
          {/* Settlement Section */}
          <div className={`p-4 rounded-xl border-2 ${settlement ? 'border-green-500 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
            {settlement ? (
              <div className="flex flex-col items-center text-center space-y-2">
                <CheckCircle size={40} className="text-green-500" />
                <div className="font-bold text-green-800">本日已結算</div>
                <p className="text-sm text-green-600">
                  結算金額歸零。
                  <br/>
                  (結算掉的金額: ${settlement.amountCleared.toLocaleString()})
                </p>
                <button 
                   onClick={() => onUnsettle(settlement.id)}
                   className="text-xs text-red-500 underline mt-2"
                >
                  取消結算
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="text-orange-800 font-medium">尚未結算</div>
                <p className="text-sm text-orange-600">
                   若您在今天與孩子進行了金錢交接，請點擊結算。
                   <br/>
                   <span className="font-bold">目前累積未結算: ${pendingAmountToDate.toLocaleString()}</span>
                </p>
                <button
                  onClick={onSettle}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg font-bold shadow hover:bg-orange-600 active:scale-95 transition w-full"
                >
                  本日結算 (歸零)
                </button>
              </div>
            )}
          </div>

          {/* Transaction List */}
          <div>
            <h3 className="text-gray-700 font-bold mb-3">當日明細</h3>
            {transactions.length === 0 ? (
              <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                無紀錄
              </div>
            ) : (
              <ul className="space-y-2">
                {transactions.map((t) => (
                  <li key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full ${t.type === TransactionType.INCOME ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <div className="font-medium text-gray-800">{t.description}</div>
                        <div className="text-xs text-gray-500">
                          {t.type === TransactionType.INCOME ? '收入' : '支出'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                      </span>
                      <button onClick={() => onDeleteTransaction(t.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Add Transaction Footer */}
        <div className="p-3 md:p-4 border-t bg-gray-50 shrink-0">
          <h3 className="text-xs md:text-sm font-bold text-gray-500 mb-2">新增紀錄</h3>
          <div className="flex gap-2 mb-2 md:mb-3">
            <button
              type="button"
              onClick={() => setActiveTab(TransactionType.INCOME)}
              className={`flex-1 py-1.5 md:py-2 rounded-lg font-medium text-xs md:text-sm transition flex items-center justify-center gap-1 ${
                activeTab === TransactionType.INCOME
                  ? 'bg-green-100 text-green-700 border border-green-200 shadow-sm'
                  : 'bg-white text-gray-500 border border-transparent'
              }`}
            >
              <Plus size={14} className="md:hidden" />
              <Plus size={16} className="hidden md:inline" />
              收入
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(TransactionType.EXPENSE)}
              className={`flex-1 py-1.5 md:py-2 rounded-lg font-medium text-xs md:text-sm transition flex items-center justify-center gap-1 ${
                activeTab === TransactionType.EXPENSE
                  ? 'bg-red-100 text-red-700 border border-red-200 shadow-sm'
                  : 'bg-white text-gray-500 border border-transparent'
              }`}
            >
              <Minus size={14} className="md:hidden" />
              <Minus size={16} className="hidden md:inline" />
              支出
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="項目說明"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 px-3 py-2 text-sm md:text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="金額"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 sm:w-24 px-3 py-2 text-sm md:text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!amount}
                className="bg-indigo-600 text-white px-4 py-2 text-sm md:text-base rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                新增
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DayModal;