import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Wallet, PiggyBank, History, Plus, Users, Pencil, CloudOff, Cloud, LogOut, X } from 'lucide-react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, auth } from './firebase';
import { getMonthData, formatDateISO, isSameDay } from './utils/dateHelpers';
import { Transaction, TransactionType, Settlement, DaySummary, Child, UserProfile } from './types';
import { WEEKDAYS, APP_STORAGE_KEYS } from './constants';
import DayModal from './components/DayModal';
import AddChildModal from './components/AddChildModal';
import LoginPage from './components/LoginPage';
import TeamManagement from './components/TeamManagement';

const App: React.FC = () => {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // --- State ---
  const [currentDate, setCurrentDate] = useState(new Date());

  // Data State
  const [children, setChildren] = useState<Child[]>([]);
  const [currentChildId, setCurrentChildId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  // UI State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [childModalMode, setChildModalMode] = useState<'add' | 'edit'>('add');
  const [showTeamManagement, setShowTeamManagement] = useState(false);

  // Determine if we are using Firestore (Must have DB instance AND User logged in)
  const useFirestore = useMemo(() => !!db && !!user && !isGuest, [user, isGuest]);

  // Get user's team ID (use teamId if in team, otherwise use own uid for personal data)
  const userTeamId = useMemo(() => {
    if (isGuest || !user) return null;
    return userProfile?.teamId || user.uid;
  }, [userProfile, user, isGuest]);

  // --- Auth Listener ---
  useEffect(() => {
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged((currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
        if (currentUser) setIsGuest(false);
      });
      return () => unsubscribe();
    } else {
      setAuthLoading(false);
    }
  }, []);

  // --- User Profile Listener ---
  useEffect(() => {
    if (!user || !db || isGuest) {
      setUserProfile(null);
      return;
    }

    const unsubProfile = onSnapshot(
      doc(db, 'userProfiles', user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        } else {
          // 首次登入，創建使用者檔案
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || undefined,
            teamId: null, // 預設沒有團隊，使用個人資料
            createdAt: Date.now()
          };
          setDoc(doc(db, 'userProfiles', user.uid), newProfile);
          setUserProfile(newProfile);
        }
      },
      (error) => {
        console.error("Profile listener error:", error);
        // 如果出錯，設置預設檔案（使用個人資料）
        setUserProfile({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || undefined,
          teamId: null,
          createdAt: Date.now()
        });
      }
    );

    return () => unsubProfile();
  }, [user, db, isGuest]);

  // --- Data Subscriptions (Dual Mode) ---

  useEffect(() => {
    if (authLoading || !userTeamId) return; // Wait for auth check and teamId

    if (useFirestore && db && user) {
      // --- FIRESTORE 模式 (基於團隊的資料共享) ---

      // 1. Children (依 teamId 過濾)
      const qChildren = query(collection(db, 'children'), where('teamId', '==', userTeamId));
      const unsubChildren = onSnapshot(qChildren, (snapshot) => {
        const loadedChildren: Child[] = [];
        snapshot.forEach((doc) => loadedChildren.push(doc.data() as Child));
        loadedChildren.sort((a, b) => a.createdAt - b.createdAt);
        setChildren(loadedChildren);

        // 設置初始孩子
        if (loadedChildren.length > 0) {
          setCurrentChildId(prev => {
            const exists = loadedChildren.find(c => c.id === prev);
            return exists ? prev : loadedChildren[0].id;
          });
        } else {
          setCurrentChildId(null);
        }
      }, (error) => console.error("Firestore Children Error:", error));

      // 2. Transactions (依 teamId 過濾)
      const qTx = query(collection(db, 'transactions'), where('teamId', '==', userTeamId));
      const unsubTx = onSnapshot(qTx, (snapshot) => {
        const loaded: Transaction[] = [];
        snapshot.forEach((doc) => loaded.push(doc.data() as Transaction));
        setTransactions(loaded);
      }, (error) => console.error("Firestore Tx Error:", error));

      // 3. Settlements (依 teamId 過濾)
      const qSet = query(collection(db, 'settlements'), where('teamId', '==', userTeamId));
      const unsubSet = onSnapshot(qSet, (snapshot) => {
        const loaded: Settlement[] = [];
        snapshot.forEach((doc) => loaded.push(doc.data() as Settlement));
        setSettlements(loaded);
      }, (error) => console.error("Firestore Set Error:", error));

      return () => {
        unsubChildren();
        unsubTx();
        unsubSet();
      };
    } else if (isGuest || (!db && !user)) {
      // --- 本地儲存模式 (備用/訪客) ---
      console.log("Using LocalStorage Mode");

      const loadFromStorage = () => {
        try {
          const storedChildren = localStorage.getItem(APP_STORAGE_KEYS.CHILDREN);
          const storedTx = localStorage.getItem(APP_STORAGE_KEYS.TRANSACTIONS);
          const storedSettlements = localStorage.getItem(APP_STORAGE_KEYS.SETTLEMENTS);

          const loadedChildren = storedChildren ? JSON.parse(storedChildren) : [];
          setChildren(loadedChildren);

          if (loadedChildren.length > 0) {
            setCurrentChildId(prev => {
              const exists = loadedChildren.find((c: Child) => c.id === prev);
              return exists ? prev : loadedChildren[0].id;
            });
          }

          setTransactions(storedTx ? JSON.parse(storedTx) : []);
          setSettlements(storedSettlements ? JSON.parse(storedSettlements) : []);
        } catch (e) {
          console.error("LocalStorage Load Error:", e);
        }
      };

      loadFromStorage();
      window.addEventListener('storage', loadFromStorage);
      return () => window.removeEventListener('storage', loadFromStorage);
    }
  }, [useFirestore, user, isGuest, authLoading, userTeamId]);

  // --- 遷移 (本地 -> 雲端) ---
  useEffect(() => {
    const migrateData = async () => {
      if (!useFirestore || !db || !user || !userTeamId) return;

      try {
        // 僅在該使用者/團隊的雲端資料為空時才遷移
        const childrenSnapshot = await getDocs(query(collection(db, 'children'), where('teamId', '==', userTeamId)));
        if (!childrenSnapshot.empty) return;

        console.log("Migrating local data to Firestore for team:", userTeamId);
        const storedChildrenStr = localStorage.getItem(APP_STORAGE_KEYS.CHILDREN);
        const storedTransactionsStr = localStorage.getItem(APP_STORAGE_KEYS.TRANSACTIONS);
        const storedSettlementsStr = localStorage.getItem(APP_STORAGE_KEYS.SETTLEMENTS);

        if (storedChildrenStr) {
          const localChildren: Child[] = JSON.parse(storedChildrenStr);
          for (const child of localChildren) {
            // 為遷移的資料添加 userId 和 teamId
            const newChild = { ...child, userId: user.uid, teamId: userTeamId };
            await setDoc(doc(db, 'children', child.id), newChild);
          }
        }
        if (storedTransactionsStr) {
          const localTx: Transaction[] = JSON.parse(storedTransactionsStr);
          for (const tx of localTx) {
            const newTx = { ...tx, userId: user.uid, teamId: userTeamId };
            await setDoc(doc(db, 'transactions', tx.id), newTx);
          }
        }
        if (storedSettlementsStr) {
          const localSettlements: Settlement[] = JSON.parse(storedSettlementsStr);
          for (const s of localSettlements) {
            const newS = { ...s, userId: user.uid, teamId: userTeamId };
            await setDoc(doc(db, 'settlements', s.id), newS);
          }
        }
      } catch (e) {
        console.error("Migration failed:", e);
      }
    };

    migrateData();
  }, [useFirestore, user, userTeamId]);

  // --- Helper for LocalStorage Updates ---
  const updateLocalStorage = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
    if (key === APP_STORAGE_KEYS.CHILDREN) setChildren(data);
    if (key === APP_STORAGE_KEYS.TRANSACTIONS) setTransactions(data);
    if (key === APP_STORAGE_KEYS.SETTLEMENTS) setSettlements(data);
  };

  // --- Actions ---

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      setUser(null);
      // Clear local state to avoid flashing old data
      setChildren([]);
      setTransactions([]);
      setSettlements([]);
      setCurrentChildId(null);
    } else {
      setIsGuest(false);
    }
  };

  const openAddChildModal = () => {
    setChildModalMode('add');
    setIsChildModalOpen(true);
  };

  const openEditChildModal = () => {
    if (!currentChildId) return;
    setChildModalMode('edit');
    setIsChildModalOpen(true);
  };

  const handleSaveChild = async (name: string, avatar: string) => {
    const newChildData = { name, avatar };

    if (useFirestore && db && user && userTeamId) {
      try {
        if (childModalMode === 'add') {
          const newChild: Child = {
            id: crypto.randomUUID(),
            userId: user.uid,
            teamId: userTeamId, // 綁定到團隊以實現資料共享
            name,
            avatar,
            createdAt: Date.now(),
          };
          await setDoc(doc(db, 'children', newChild.id), newChild);
          setCurrentChildId(newChild.id);
        } else {
          if (!currentChildId) return;
          await setDoc(doc(db, 'children', currentChildId), newChildData, { merge: true });
        }
      } catch (error) {
        console.error("Error saving child:", error);
        alert("儲存失敗");
      }
    } else {
      // LocalStorage Fallback
      if (childModalMode === 'add') {
        const newChild: Child = {
          id: crypto.randomUUID(),
          name,
          avatar,
          createdAt: Date.now(),
        };
        const updated = [...children, newChild];
        updateLocalStorage(APP_STORAGE_KEYS.CHILDREN, updated);
        setCurrentChildId(newChild.id);
      } else {
        if (!currentChildId) return;
        const updated = children.map(c => c.id === currentChildId ? { ...c, ...newChildData } : c);
        updateLocalStorage(APP_STORAGE_KEYS.CHILDREN, updated);
      }
    }
  };

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id' | 'createdAt' | 'childId' | 'userId' | 'teamId'>) => {
    if (!currentChildId) return;

    const transaction: Transaction = {
      ...newTx,
      id: crypto.randomUUID(),
      childId: currentChildId,
      createdAt: Date.now(),
      ...(user && { userId: user.uid }),
      ...(userTeamId && { teamId: userTeamId }) // Bind to team for data sharing
    };

    if (useFirestore && db && user && userTeamId) {
      try {
        await setDoc(doc(db, 'transactions', transaction.id), transaction);
      } catch (error) {
        console.error("Error adding transaction:", error);
      }
    } else {
      const updated = [...transactions, transaction];
      updateLocalStorage(APP_STORAGE_KEYS.TRANSACTIONS, updated);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (useFirestore && db) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (error) {
        console.error("Error deleting transaction:", error);
      }
    } else {
      const updated = transactions.filter(t => t.id !== id);
      updateLocalStorage(APP_STORAGE_KEYS.TRANSACTIONS, updated);
    }
  };

  const handleSettle = async () => {
    if (!selectedDate || !currentChildId) return;
    const amountToClear = getPendingAmountForDate(selectedDate);
    const newSettlement: Settlement = {
      id: crypto.randomUUID(),
      childId: currentChildId,
      date: selectedDate,
      amountCleared: amountToClear,
      createdAt: Date.now(),
      ...(user && { userId: user.uid }),
      ...(userTeamId && { teamId: userTeamId }) // 綁定到團隊以實現資料共享
    };

    if (useFirestore && db && user && userTeamId) {
      try {
        // 先刪除該日/該孩子的現有結算
        const q = query(
          collection(db, 'settlements'),
          where('teamId', '==', userTeamId),
          where('childId', '==', currentChildId),
          where('date', '==', selectedDate)
        );
        const snapshot = await getDocs(q);
        await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));

        await setDoc(doc(db, 'settlements', newSettlement.id), newSettlement);
      } catch (error) {
        console.error("Error settling:", error);
      }
    } else {
      const filtered = settlements.filter(s => !(s.childId === currentChildId && s.date === selectedDate));
      const updated = [...filtered, newSettlement];
      updateLocalStorage(APP_STORAGE_KEYS.SETTLEMENTS, updated);
    }
  };

  const handleUnsettle = async (id: string) => {
    if (useFirestore && db) {
      try {
        await deleteDoc(doc(db, 'settlements', id));
      } catch (error) {
        console.error("Error removing settlement:", error);
      }
    } else {
      const updated = settlements.filter(s => s.id !== id);
      updateLocalStorage(APP_STORAGE_KEYS.SETTLEMENTS, updated);
    }
  };

  // --- Derived State Calculation (Same as before) ---
  const currentChild = useMemo(() => children.find(c => c.id === currentChildId), [children, currentChildId]);
  const childTransactions = useMemo(() => transactions.filter(t => t.childId === currentChildId), [transactions, currentChildId]);
  const childSettlements = useMemo(() => settlements.filter(s => s.childId === currentChildId), [settlements, currentChildId]);

  const totalBalance = useMemo(() => {
    return childTransactions.reduce((acc, t) => t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount, 0);
  }, [childTransactions]);

  const lastSettlement = useMemo(() => {
    if (childSettlements.length === 0) return null;
    return [...childSettlements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [childSettlements]);

  const pendingSettlementAmount = useMemo(() => {
    let filteredTransactions = childTransactions;
    if (lastSettlement) {
      filteredTransactions = childTransactions.filter(t => t.date > lastSettlement.date);
    }
    return filteredTransactions.reduce((acc, t) => t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount, 0);
  }, [childTransactions, lastSettlement]);

  const getPendingAmountForDate = (targetDateStr: string) => {
    if (!currentChildId) return 0;
    const prevSettlements = childSettlements.filter(s => s.date < targetDateStr);
    const lastPrevSettlement = prevSettlements.sort((a, b) => b.date.localeCompare(a.date))[0];
    const startDate = lastPrevSettlement ? lastPrevSettlement.date : '0000-00-00';
    const txsInRange = childTransactions.filter(t => t.date > startDate && t.date <= targetDateStr);
    return txsInRange.reduce((acc, t) => t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount, 0);
  };

  // --- View ---

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <LoginPage onGuestLogin={() => setIsGuest(true)} />;
  }

  // --- Calendar Logic ---
  const { year, month, daysInMonth, prefixDays } = getMonthData(currentDate);
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  };

  const getDaySummary = (dateStr: string): DaySummary => {
    if (!currentChildId) return { date: dateStr, income: 0, expense: 0, isSettled: false, hasData: false };
    const dayTxs = childTransactions.filter(t => t.date === dateStr);
    const isSettled = childSettlements.some(s => s.date === dateStr);
    const income = dayTxs.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
    const expense = dayTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
    return { date: dateStr, income, expense, isSettled, hasData: dayTxs.length > 0 };
  };

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-gray-50 shadow-2xl border-x border-gray-200 font-sans">

      {/* Header */}
      <header className="bg-indigo-600 text-white rounded-b-3xl shadow-lg z-10 relative transition-all duration-300">
        {/* Header Top Row */}
        <div className="flex justify-between items-start px-4 pt-3">
          <div className="flex items-center gap-2">
            {useFirestore ? (
              <div className="flex items-center gap-1 text-[10px] bg-indigo-500/50 px-2 py-1 rounded-full text-green-200 border border-green-400/30">
                <Cloud size={12} /> 雲端同步中
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] bg-orange-500/50 px-2 py-1 rounded-full text-orange-100 border border-orange-400/30">
                <CloudOff size={12} /> 離線模式
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {useFirestore && (
              <button
                onClick={() => setShowTeamManagement(true)}
                className="text-indigo-200 hover:text-white p-1 rounded-full hover:bg-indigo-500 transition"
                title="團隊管理"
              >
                <Users size={18} />
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-indigo-200 hover:text-white p-1 rounded-full hover:bg-indigo-500 transition"
              title="登出"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Child List */}
        <div className="flex items-center px-4 pt-4 pb-2 overflow-x-auto no-scrollbar gap-3">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setCurrentChildId(child.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${currentChildId === child.id
                  ? 'bg-white text-indigo-600 shadow-md ring-2 ring-indigo-200'
                  : 'bg-indigo-700/50 text-indigo-100 hover:bg-indigo-700'
                }`}
            >
              <span className="text-lg leading-none">{child.avatar}</span>
              {child.name}
            </button>
          ))}
          <button
            onClick={openAddChildModal}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-700/30 hover:bg-indigo-700/50 text-indigo-200 transition shrink-0"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Summary */}
        <div className="p-6 pt-2">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Fun財成長</h1>
              <div className="text-indigo-200 text-sm flex items-center gap-1">
                <span className="opacity-70">記帳對象:</span>
                <span className="font-bold text-white flex items-center gap-1">
                  {currentChild ? (
                    <>
                      <span>{currentChild.avatar}</span>
                      <span>{currentChild.name}</span>
                    </>
                  ) : '請新增孩子'}
                </span>
                {currentChild && (
                  <button
                    onClick={openEditChildModal}
                    className="p-1 ml-1 hover:bg-indigo-500/50 rounded-full text-indigo-200 hover:text-white transition"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="bg-indigo-500/30 p-2 rounded-lg backdrop-blur-sm">
              <Wallet className="text-indigo-100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-1 text-indigo-100 text-sm font-medium">
                <PiggyBank size={16} />
                <span>目前總資產</span>
              </div>
              <div className="text-2xl font-bold">
                ${totalBalance.toLocaleString()}
              </div>
            </div>

            <div className={`rounded-xl p-4 border backdrop-blur-md transition-colors ${pendingSettlementAmount > 0
                ? 'bg-orange-500/20 border-orange-300/30 text-orange-50'
                : 'bg-white/10 border-white/20'
              }`}>
              <div className="flex items-center gap-2 mb-1 text-indigo-100 text-sm font-medium">
                <History size={16} />
                <span>
                  {pendingSettlementAmount >= 0 ? '父母應給付' : '孩子應歸還'}
                </span>
              </div>
              <div className="text-2xl font-bold">
                ${Math.abs(pendingSettlementAmount).toLocaleString()}
              </div>
              <div className="text-xs mt-1 opacity-80">
                {lastSettlement
                  ? `自 ${lastSettlement.date} 結算後`
                  : '尚未進行過結算'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Calendar Controls */}
      <div className="flex items-center justify-between px-6 py-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-200 rounded-full transition">
          <ChevronLeft className="text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-800">
            {year}年 {month + 1}月
          </h2>
          {(!isSameDay(new Date(), currentDate)) && (
            <button onClick={goToToday} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md font-bold">
              回今天
            </button>
          )}
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-200 rounded-full transition">
          <ChevronRight className="text-gray-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <main className="flex-1 px-4 pb-8 overflow-y-auto">
        <div className="grid grid-cols-7 mb-2 text-center">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-gray-400 text-sm font-bold py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 auto-rows-fr">
          {prefixDays.map((_, i) => (
            <div key={`prefix-${i}`} className="aspect-square" />
          ))}

          {daysInMonth.map((date) => {
            const dateStr = formatDateISO(date);
            const isToday = isSameDay(date, new Date());
            const { income, expense, isSettled, hasData } = getDaySummary(dateStr);
            const dailyTotal = income - expense;

            return (
              <div
                key={dateStr}
                onClick={() => handleDateClick(dateStr)}
                className={`
                  relative aspect-square rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-start pt-1
                  hover:shadow-md active:scale-95
                  ${isToday
                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
                    : 'bg-white border-gray-100 shadow-sm'}
                  ${isSettled ? 'bg-orange-50/50' : ''}
                `}
              >
                <span className={`text-sm font-medium ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {date.getDate()}
                </span>

                {hasData && (
                  <div className={`text-[10px] font-bold mt-1 truncate w-full text-center px-0.5 ${dailyTotal > 0 ? 'text-green-600' : dailyTotal < 0 ? 'text-red-500' : 'text-gray-500'
                    }`}>
                    {dailyTotal > 0 ? '+' : ''}{dailyTotal}
                  </div>
                )}

                {isSettled && (
                  <div className="absolute bottom-1 right-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {children.length === 0 && (
          <div className="mt-8 p-8 text-center bg-white rounded-xl border-2 border-dashed border-indigo-200">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-indigo-500" size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">歡迎使用 Fun財成長</h3>
            <p className="text-gray-500 mb-4">請先建立一個孩子的檔案開始記帳</p>
            <button
              onClick={openAddChildModal}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-indigo-700"
            >
              建立孩子檔案
            </button>
          </div>
        )}

        {children.length > 0 && (
          <div className="mt-8 p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-sm text-gray-500">
            <h3 className="font-bold mb-2 text-gray-700">使用說明</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>上方可切換不同孩子的帳戶。</li>
              <li>點擊日期可新增收入或支出。</li>
              <li>數字代表當日總結金額 (綠色為正，紅色為負)。</li>
              <li><span className="text-orange-500 font-bold">結算</span>按鈕可將截至該日期的帳款歸零。</li>
            </ul>
          </div>
        )}
      </main>

      <DayModal
        date={selectedDate || ''}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transactions={selectedDate ? childTransactions.filter(t => t.date === selectedDate) : []}
        settlement={childSettlements.find(s => s.date === selectedDate)}
        onAddTransaction={handleAddTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onSettle={handleSettle}
        onUnsettle={handleUnsettle}
        pendingAmountToDate={selectedDate ? getPendingAmountForDate(selectedDate) : 0}
      />

      <AddChildModal
        isOpen={isChildModalOpen}
        onClose={() => setIsChildModalOpen(false)}
        onSave={handleSaveChild}
        initialName={childModalMode === 'edit' ? currentChild?.name : ''}
        initialAvatar={childModalMode === 'edit' ? currentChild?.avatar : undefined}
        mode={childModalMode}
      />

      {/* 團隊管理 Modal */}
      {showTeamManagement && db && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-50 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center rounded-t-2xl z-10">
              <h2 className="text-xl font-bold">團隊管理</h2>
              <button
                onClick={() => setShowTeamManagement(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <TeamManagement
                user={user!}
                userProfile={userProfile}
                db={db}
                onProfileUpdate={() => {
                  // 檔案會透過監聽器自動更新
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;