import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface Group {
  id: string;
  name: string;
  role: string;
}

export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/groups');
      setGroups(data.groups);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setSubmitting(true);
    setModalError('');
    try {
      await api.post('/groups', { name: createName.trim() });
      setShowCreate(false);
      setCreateName('');
      await fetchGroups();
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSubmitting(true);
    setModalError('');
    try {
      await api.post('/groups/join', { joinCode: joinCode.trim() });
      setShowJoin(false);
      setJoinCode('');
      await fetchGroups();
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModals = () => {
    setShowCreate(false);
    setShowJoin(false);
    setModalError('');
    setCreateName('');
    setJoinCode('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="h-9 px-4 rounded-lg border border-[#3D6B4F] text-[#3D6B4F] text-sm font-semibold hover:bg-[#3D6B4F] hover:text-white transition-colors"
          >
            Join Group
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="h-9 px-4 rounded-lg bg-[#3D6B4F] text-white text-sm font-semibold hover:bg-[#2D5240] transition-colors"
          >
            Create Group
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No groups yet. Create one or join with a code.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => navigate(`/groups/${group.id}`)}
              className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between text-left hover:border-gray-200 transition-colors"
            >
              <span className="font-medium text-gray-900">{group.name}</span>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  group.role === 'leader'
                    ? 'bg-[#3D6B4F]/10 text-[#3D6B4F]'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {group.role}
              </span>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={closeModals}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create Group</h3>
            {modalError && (
              <p className="mb-3 text-sm text-red-500">{modalError}</p>
            )}
            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#3D6B4F] text-sm mb-4"
                placeholder="Group name"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeModals}
                  className="h-9 px-4 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg bg-[#3D6B4F] text-white text-sm font-semibold hover:bg-[#2D5240] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={closeModals}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Join Group</h3>
            {modalError && (
              <p className="mb-3 text-sm text-red-500">{modalError}</p>
            )}
            <form onSubmit={handleJoin}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#3D6B4F] text-sm mb-4"
                placeholder="Enter join code"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeModals}
                  className="h-9 px-4 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg bg-[#3D6B4F] text-white text-sm font-semibold hover:bg-[#2D5240] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
