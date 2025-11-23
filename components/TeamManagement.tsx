import React, { useState, useEffect } from 'react';
import { Users, Copy, Check, LogIn, UserPlus, Trash2, X } from 'lucide-react';
import { Team, UserProfile } from '../types';
import { User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Firestore
} from 'firebase/firestore';

interface TeamManagementProps {
  user: User;
  userProfile: UserProfile | null;
  db: Firestore;
  onProfileUpdate: () => void;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ user, userProfile, db, onProfileUpdate }) => {
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [showMigrationWarning, setShowMigrationWarning] = useState(false);
  const [migrationAction, setMigrationAction] = useState<'create' | 'join' | null>(null);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);

  // 監聽當前團隊資料
  useEffect(() => {
    if (!userProfile?.teamId || !db) {
      setCurrentTeam(null);
      setTeamMembers([]);
      return;
    }

    const unsubTeam = onSnapshot(
      doc(db, 'teams', userProfile.teamId),
      (docSnap) => {
        if (docSnap.exists()) {
          setCurrentTeam(docSnap.data() as Team);
        } else {
          setCurrentTeam(null);
        }
      },
      (error) => {
        console.error("Team listener error:", error);
        setCurrentTeam(null);
      }
    );

    return () => unsubTeam();
  }, [userProfile?.teamId, db]);

  // 載入團隊成員資訊
  useEffect(() => {
    const loadMembers = async () => {
      if (!currentTeam || !db) {
        setTeamMembers([]);
        return;
      }

      try {
        const memberProfiles: UserProfile[] = [];
        for (const memberId of currentTeam.members) {
          const q = query(collection(db, 'userProfiles'), where('uid', '==', memberId));
          const snapshot = await getDocs(q);
          snapshot.forEach((doc) => {
            memberProfiles.push(doc.data() as UserProfile);
          });
        }
        setTeamMembers(memberProfiles);
      } catch (error) {
        console.error("載入成員失敗:", error);
      }
    };

    loadMembers();
  }, [currentTeam, db]);

  // 檢查是否有現有資料（用於顯示遷移警告）
  useEffect(() => {
    const checkExistingData = async () => {
      if (!db || userProfile?.teamId) return; // 如果已在團隊中，不需要檢查
      
      try {
        // 檢查是否有 teamId = user.uid 的資料
        const childrenSnapshot = await getDocs(
          query(collection(db, 'children'), where('teamId', '==', user.uid))
        );
        const transactionsSnapshot = await getDocs(
          query(collection(db, 'transactions'), where('teamId', '==', user.uid))
        );
        const settlementsSnapshot = await getDocs(
          query(collection(db, 'settlements'), where('teamId', '==', user.uid))
        );
        
        const hasData = !childrenSnapshot.empty || !transactionsSnapshot.empty || !settlementsSnapshot.empty;
        setHasExistingData(hasData);
      } catch (error) {
        console.error("檢查現有資料失敗:", error);
      }
    };

    checkExistingData();
  }, [db, user.uid, userProfile?.teamId]);

  // 生成6位隨機邀請碼
  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除容易混淆的字元
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 遷移舊資料到新團隊
  const migrateDataToTeam = async (newTeamId: string) => {
    try {
      console.log(`開始遷移資料到團隊 ${newTeamId}`);
      
      // 遷移孩子資料
      const childrenSnapshot = await getDocs(
        query(collection(db, 'children'), where('teamId', '==', user.uid))
      );
      for (const doc of childrenSnapshot.docs) {
        await updateDoc(doc.ref, { teamId: newTeamId });
      }
      console.log(`遷移了 ${childrenSnapshot.size} 個孩子檔案`);

      // 遷移交易資料
      const transactionsSnapshot = await getDocs(
        query(collection(db, 'transactions'), where('teamId', '==', user.uid))
      );
      for (const doc of transactionsSnapshot.docs) {
        await updateDoc(doc.ref, { teamId: newTeamId });
      }
      console.log(`遷移了 ${transactionsSnapshot.size} 筆交易記錄`);

      // 遷移結算資料
      const settlementsSnapshot = await getDocs(
        query(collection(db, 'settlements'), where('teamId', '==', user.uid))
      );
      for (const doc of settlementsSnapshot.docs) {
        await updateDoc(doc.ref, { teamId: newTeamId });
      }
      console.log(`遷移了 ${settlementsSnapshot.size} 筆結算記錄`);

      console.log('資料遷移完成！');
    } catch (error) {
      console.error("資料遷移失敗:", error);
      throw error;
    }
  };

  // 開始創建團隊流程
  const handleStartCreateTeam = () => {
    if (!teamName.trim()) {
      alert('請輸入團隊名稱');
      return;
    }

    // 如果有現有資料，顯示警告
    if (hasExistingData) {
      setMigrationAction('create');
      setShowMigrationWarning(true);
    } else {
      handleCreateTeam();
    }
  };

  // 創建團隊
  const handleCreateTeam = async () => {
    setShowMigrationWarning(false);
    setLoading(true);
    
    try {
      const newTeam: Team = {
        id: crypto.randomUUID(),
        name: teamName.trim(),
        creatorId: user.uid,
        inviteCode: generateInviteCode(),
        createdAt: Date.now(),
        members: [user.uid]
      };

      // 創建團隊
      await setDoc(doc(db, 'teams', newTeam.id), newTeam);
      
      // 遷移現有資料到新團隊
      if (hasExistingData) {
        await migrateDataToTeam(newTeam.id);
      }
      
      // 更新用戶檔案
      await setDoc(doc(db, 'userProfiles', user.uid), { teamId: newTeam.id }, { merge: true });

      setShowCreateTeam(false);
      setTeamName('');
      onProfileUpdate();
    } catch (error) {
      console.error("創建團隊失敗:", error);
      alert('創建團隊失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  // 開始加入團隊流程
  const handleStartJoinTeam = async () => {
    if (!inviteCode.trim()) {
      alert('請輸入邀請碼');
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'teams'), where('inviteCode', '==', inviteCode.toUpperCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert('邀請碼無效，請檢查後重試');
        setLoading(false);
        return;
      }

      const teamDoc = snapshot.docs[0];
      const team = teamDoc.data() as Team;

      // 檢查是否已經是成員
      if (team.members.includes(user.uid)) {
        alert('你已經是該團隊的成員了');
        setLoading(false);
        return;
      }

      setLoading(false);

      // 如果有現有資料，顯示警告
      if (hasExistingData) {
        setMigrationAction('join');
        setShowMigrationWarning(true);
      } else {
        handleJoinTeam();
      }
    } catch (error) {
      console.error("加入團隊失敗:", error);
      alert('加入團隊失敗，請重試');
      setLoading(false);
    }
  };

  // 加入團隊
  const handleJoinTeam = async () => {
    setShowMigrationWarning(false);
    setLoading(true);
    
    try {
      const q = query(collection(db, 'teams'), where('inviteCode', '==', inviteCode.toUpperCase()));
      const snapshot = await getDocs(q);
      const teamDoc = snapshot.docs[0];
      const team = teamDoc.data() as Team;

      // 遷移現有資料到新團隊
      if (hasExistingData) {
        await migrateDataToTeam(team.id);
      }

      // 更新團隊成員列表
      await updateDoc(doc(db, 'teams', team.id), {
        members: arrayUnion(user.uid)
      });

      // 更新用戶檔案
      await setDoc(doc(db, 'userProfiles', user.uid), { teamId: team.id }, { merge: true });

      setShowJoinTeam(false);
      setInviteCode('');
      onProfileUpdate();
    } catch (error) {
      console.error("加入團隊失敗:", error);
      alert('加入團隊失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  // 離開團隊
  const handleLeaveTeam = async () => {
    if (!currentTeam) return;
    
    if (!confirm('確定要離開團隊嗎？離開後將無法訪問團隊的共享資料。')) return;

    setLoading(true);
    try {
      // 從團隊成員列表中移除
      await updateDoc(doc(db, 'teams', currentTeam.id), {
        members: arrayRemove(user.uid)
      });

      // 更新用戶檔案
      await setDoc(doc(db, 'userProfiles', user.uid), { teamId: null }, { merge: true });

      onProfileUpdate();
    } catch (error) {
      console.error("離開團隊失敗:", error);
      alert('離開團隊失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  // 複製邀請碼
  const copyInviteCode = () => {
    if (currentTeam?.inviteCode) {
      navigator.clipboard.writeText(currentTeam.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* 當前團隊狀態 */}
      {userProfile?.teamId && currentTeam ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              當前團隊
            </h3>
          </div>
          
          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-1">團隊名稱</div>
            <div className="text-lg font-semibold text-gray-800">{currentTeam.name}</div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-2">邀請碼</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 font-mono text-xl font-bold text-indigo-700 text-center tracking-widest">
                {currentTeam.inviteCode}
              </div>
              <button
                onClick={copyInviteCode}
                className="p-3 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition"
                title="複製邀請碼"
              >
                {copied ? <Check size={20} className="text-green-600" /> : <Copy size={20} className="text-indigo-600" />}
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              將此邀請碼分享給家人，他們可以加入你的團隊共享資料
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-2">團隊成員 ({teamMembers.length})</div>
            <div className="space-y-2">
              {teamMembers.map(member => (
                <div key={member.uid} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-800">
                      {member.displayName || member.email}
                    </div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </div>
                  {member.uid === currentTeam.creatorId && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
                      創建者
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleLeaveTeam}
            disabled={loading}
            className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 size={16} />
            離開團隊
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-4">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="text-indigo-600" size={32} />
            </div>
            <h3 className="font-bold text-gray-800 mb-2">團隊協作</h3>
            <p className="text-sm text-gray-500">
              創建團隊或加入現有團隊，與家人共享記帳資料
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowCreateTeam(true)}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              創建新團隊
            </button>
            
            <button
              onClick={() => setShowJoinTeam(true)}
              className="w-full py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition flex items-center justify-center gap-2"
            >
              <LogIn size={18} />
              加入現有團隊
            </button>
          </div>
        </div>
      )}

      {/* 創建團隊彈窗 */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">創建新團隊</h3>
            <input
              type="text"
              placeholder="輸入團隊名稱，如：張家"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              autoFocus
              disabled={loading}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateTeam(false)}
                disabled={loading}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleStartCreateTeam}
                disabled={loading}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? '創建中...' : '創建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 加入團隊彈窗 */}
      {showJoinTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">加入團隊</h3>
            <p className="text-sm text-gray-500 mb-4">
              輸入家人分享給你的6位邀請碼
            </p>
            <input
              type="text"
              placeholder="輸入邀請碼"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center font-mono text-xl tracking-widest outline-none"
              maxLength={6}
              autoFocus
              disabled={loading}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinTeam(false)}
                disabled={loading}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleStartJoinTeam}
                disabled={loading}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? '加入中...' : '加入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 資料遷移警告彈窗 */}
      {showMigrationWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-orange-600">⚠️ 重要提醒</h3>
            <div className="mb-6 space-y-3 text-gray-700">
              <p className="font-medium">
                {migrationAction === 'create' 
                  ? '您目前有個人記帳資料。創建團隊後：' 
                  : '您目前有個人記帳資料。加入團隊後：'}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm bg-orange-50 p-4 rounded-lg border border-orange-200">
                <li>您的現有資料（孩子檔案、交易記錄、結算記錄）將自動轉移到團隊中</li>
                <li>團隊成員將能看到這些資料</li>
                <li>所有資料將與團隊成員共享</li>
              </ul>
              <p className="text-sm text-gray-600">
                {migrationAction === 'create' 
                  ? '確定要創建團隊並轉移資料嗎？' 
                  : '確定要加入團隊並轉移資料嗎？'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMigrationWarning(false);
                  setMigrationAction(null);
                }}
                disabled={loading}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (migrationAction === 'create') {
                    handleCreateTeam();
                  } else {
                    handleJoinTeam();
                  }
                }}
                disabled={loading}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? '處理中...' : '確定轉移'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;

