import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Member {
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  joinedAt: string;
}

interface GroupData {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  joinCode?: string;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchGroup = async () => {
    try {
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data.group);
      setMembers(data.members);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load group.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const isLeader = group?.joinCode !== undefined;

  const copyCode = async () => {
    if (!group?.joinCode) return;
    await navigator.clipboard.writeText(group.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateCode = async () => {
    try {
      const { data } = await api.post(`/groups/${id}/regenerate-code`);
      setGroup((prev) => (prev ? { ...prev, joinCode: data.joinCode } : prev));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to regenerate code.');
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.delete(`/groups/${id}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove member.');
    }
  };

  const deleteGroup = async () => {
    if (!confirm('Are you sure you want to delete this group? This cannot be undone.')) return;
    try {
      await api.delete(`/groups/${id}`);
      navigate('/');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete group.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 text-sm mb-4">{error || 'Group not found.'}</p>
        <button
          onClick={() => navigate('/')}
          className="text-[#3D6B4F] text-sm font-medium hover:underline"
        >
          Back to groups
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
        </div>
        {isLeader && (
          <button
            onClick={deleteGroup}
            className="h-9 px-4 rounded-lg border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            Delete Group
          </button>
        )}
      </div>

      {isLeader && group.joinCode && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Join Code</p>
          <div className="flex items-center gap-3">
            <code className="text-lg font-mono font-bold text-gray-900 tracking-wider">{group.joinCode}</code>
            <button
              onClick={copyCode}
              className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={regenerateCode}
              className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Members ({members.length})
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#3D6B4F]/10 flex items-center justify-center text-sm font-medium text-[#3D6B4F]">
                  {member.firstName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.firstName} {member.lastName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    member.role === 'leader'
                      ? 'bg-[#3D6B4F]/10 text-[#3D6B4F]'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {member.role}
                </span>
                {isLeader && member.userId !== user?.id && (
                  <button
                    onClick={() => removeMember(member.userId)}
                    className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
