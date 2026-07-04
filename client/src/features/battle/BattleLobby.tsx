import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../../store/auth';
import { api, apiError } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { toast } from '../../store/toast';
import { WCA_EVENTS, UNOFFICIAL_EVENTS, type BattlePublicRoomDTO } from '@scc/shared';

const WCA_EVENT_OPTIONS = WCA_EVENTS.filter((e) =>
  ['333', '222', '444', '555', '666', '777', '333oh', '333bf', '444bf', '555bf', 'minx', 'pyram', 'clock', 'skewb', 'sq1'].includes(e.id),
);
const UNOFFICIAL_EVENT_OPTIONS = UNOFFICIAL_EVENTS;

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'text-xs px-2 py-0.5 rounded-full font-medium',
        status === 'ACTIVE'
          ? 'bg-green-500/20 text-green-400'
          : 'bg-yellow-500/20 text-yellow-400',
      )}
    >
      {status === 'ACTIVE' ? 'In round' : 'Waiting'}
    </span>
  );
}

function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [eventId, setEventId] = useState('333');
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const displayName = user?.displayName ?? guestName.trim();
    if (!displayName) { toast.error('Enter a display name'); return; }
    if (!name.trim()) { toast.error('Enter a room name'); return; }
    if (!isPublic && !password) { toast.error('Private rooms need a password'); return; }
    setLoading(true);
    try {
      const { data } = await api.post<{ code: string }>('/battle', {
        name: name.trim(),
        eventId,
        isPublic,
        password: isPublic ? undefined : password,
      });
      navigate(`/battle/${data.code}`, { state: { displayName, password: isPublic ? undefined : password } });
    } catch (e) {
      toast.error(apiError(e, 'Failed to create room'));
      setLoading(false);
    }
  }

  function handleClose() {
    setName(''); setGuestName(''); setEventId('333'); setIsPublic(true); setPassword('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Battle Room" size="sm">
      <div className="space-y-4">
        {!user && (
          <div>
            <label className="label mb-1 block">Your display name</label>
            <input className="input w-full" placeholder="e.g. SpeedyCuber99" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label mb-1 block">Room name</label>
          <input className="input w-full" placeholder="e.g. Friday night 3x3" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label mb-1 block">Event</label>
          <select className="input w-full" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <optgroup label="WCA Events">
              {WCA_EVENT_OPTIONS.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </optgroup>
            <optgroup label="Unofficial Events">
              {UNOFFICIAL_EVENT_OPTIONS.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Public room</div>
            <div className="text-xs text-muted">Visible in the public rooms list</div>
          </div>
          <button
            role="switch"
            aria-checked={isPublic}
            onClick={() => setIsPublic((v) => !v)}
            className={clsx(
              'relative w-10 h-6 rounded-full transition-colors shrink-0',
              isPublic ? 'bg-accent' : 'bg-card-hover',
            )}
          >
            <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', isPublic && 'translate-x-4')} />
          </button>
        </div>
        {!isPublic && (
          <div>
            <label className="label mb-1 block">Room password</label>
            <input className="input w-full" type="password" placeholder="Password for joiners" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <button className="btn-primary w-full" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating…' : 'Create Room'}
        </button>
      </div>
    </Modal>
  );
}

function JoinRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [password, setPassword] = useState('');

  function handleJoin() {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) { toast.error('Enter a room code'); return; }
    const displayName = user?.displayName ?? guestName.trim();
    if (!displayName) { toast.error('Enter a display name'); return; }
    navigate(`/battle/${trimmedCode}`, { state: { displayName, password: password || undefined } });
  }

  function handleClose() {
    setCode(''); setGuestName(''); setPassword('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Join Room" size="sm">
      <div className="space-y-4">
        {!user && (
          <div>
            <label className="label mb-1 block">Your display name</label>
            <input className="input w-full" placeholder="e.g. SpeedyCuber99" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label mb-1 block">Room code</label>
          <input
            className="input w-full uppercase tracking-widest font-mono text-lg"
            placeholder="ABCD12"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
        </div>
        <div>
          <label className="label mb-1 block">Password <span className="text-muted font-normal">(if private)</span></label>
          <input className="input w-full" type="password" placeholder="Leave blank for public rooms" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoin()} />
        </div>
        <button className="btn-primary w-full" onClick={handleJoin}>
          Join Room
        </button>
      </div>
    </Modal>
  );
}

export default function BattleLobby() {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: publicRooms = [], isLoading } = useQuery<BattlePublicRoomDTO[]>({
    queryKey: ['battle-public'],
    queryFn: () => api.get('/battle/public').then((r) => r.data),
    refetchInterval: 5000,
  });

  function joinPublic(code: string) {
    const displayName = user?.displayName;
    if (!displayName) {
      setShowJoin(true);
      return;
    }
    navigate(`/battle/${code}`, { state: { displayName } });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Battle Mode</h1>
        <p className="text-muted text-sm">Race against others on identical scrambles and climb the leaderboard.</p>
      </div>

      <div className="flex gap-3">
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={16} />
          Create Room
        </button>
        <button className="btn flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-card-hover transition-colors" onClick={() => setShowJoin(true)}>
          <Icon name="arrowRight" size={16} />
          Join Private Room
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="label">Public Rooms</h2>
          <span className="text-xs text-muted">Refreshes every 5 s</span>
        </div>

        {publicRooms.length === 0 ? (
          <div className="card p-4 text-sm text-muted text-center">No rooms found</div>
        ) : (
          <div className="space-y-2">
            {publicRooms.map((room) => (
              <div key={room.code} className="card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{room.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {[...WCA_EVENTS, ...UNOFFICIAL_EVENTS].find((e) => e.id === room.eventId)?.name ?? room.eventId}
                    {' · '}
                    {room.participantCount} / 10 player{room.participantCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <StatusBadge status={room.status} />
                <div className="text-xs font-mono text-muted">{room.code}</div>
                <button
                  className="btn-primary text-sm px-3 py-1.5"
                  onClick={() => joinPublic(room.code)}
                  disabled={room.participantCount >= 10}
                >
                  {room.participantCount >= 10 ? 'Full' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4 text-xs text-muted space-y-1">
        <div className="font-medium text-sm text-gray-900 dark:text-gray-200 mb-2">How points work</div>
        <div>🥇 1st place — <span className="text-gray-900 dark:text-white">+5 pts</span></div>
        <div>🥈 2nd place — <span className="text-gray-900 dark:text-white">+3 pts</span></div>
        <div>🥉 3rd place — <span className="text-gray-900 dark:text-white">+2 pts</span></div>
        <div>4th+ place — <span className="text-gray-900 dark:text-white">+1 pt</span></div>
        <div>DNF — <span className="text-gray-900 dark:text-white">+0 pts</span></div>
        <div className="pt-1 border-t border-border mt-2">Points are tracked for the lifetime of the room session.</div>
      </div>

      <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinRoomModal open={showJoin} onClose={() => setShowJoin(false)} />
    </div>
  );
}
