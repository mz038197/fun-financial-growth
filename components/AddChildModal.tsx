import React, { useState, useEffect } from 'react';
import { X, UserPlus, Pencil } from 'lucide-react';
import { AVATAR_OPTIONS } from '../constants';

interface AddChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, avatar: string) => void;
  initialName?: string;
  initialAvatar?: string;
  mode?: 'add' | 'edit';
}

const AddChildModal: React.FC<AddChildModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialName = '', 
  initialAvatar = '👶',
  mode = 'add' 
}) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar);

  // Reset or preset name when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(mode === 'edit' ? initialName : '');
      setSelectedAvatar(mode === 'edit' && initialAvatar ? initialAvatar : AVATAR_OPTIONS[0]);
    }
  }, [isOpen, initialName, initialAvatar, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), selectedAvatar);
    if (mode === 'add') {
      setName('');
      setSelectedAvatar(AVATAR_OPTIONS[0]);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {mode === 'add' ? <UserPlus size={20} /> : <Pencil size={20} />}
            {mode === 'add' ? '新增孩子' : '修改資料'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-indigo-700 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form id="child-form" onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                選擇頭像
              </label>
              <div className="grid grid-cols-5 gap-3">
                {AVATAR_OPTIONS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`text-2xl p-2 rounded-xl transition hover:bg-gray-100 flex items-center justify-center aspect-square ${
                      selectedAvatar === avatar 
                        ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110' 
                        : 'bg-gray-50 border border-gray-100'
                    }`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === 'add' ? '孩子暱稱' : '新的暱稱'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：小寶"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t bg-gray-50 shrink-0">
          <button
            type="submit"
            form="child-form"
            disabled={!name.trim()}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98]"
          >
            {mode === 'add' ? '建立檔案' : '儲存修改'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddChildModal;