import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { RELAY_PRESETS, type CustomRelayDTO, type RelayPublicRoomDTO } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { api, apiError } from '../../lib/api';
import { toast } from '../../store/toast';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';

function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [relayChoice, setRelayChoice] = useState('preset:2-4');
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: customRelays = [] } = useQuery<CustomRelayDTO[]>({
    queryKey: ['relays-custom'],
    queryFn: () => api.get('/relays/custom').then((r) => r.data),
    enabled: !!user && open,
  });

  async function handleCreate() {
    const displayName = user?.displayName ?? guestName.trim();
    if (!displayName) { toast.error('Enter a display name'); return; }
    if (!name.trim()) { toast.error('Enter a room name'); return; }
    if (!isPublic && !password) { toast.error('Private rooms need a password'); return; }
    const [kind, id] = relayChoice.split(':');
    setLoading(true);
    try {
      const { data } = await api.post<{ code: string }>('/relays/rooms', {
        name: name.trim(),
        presetId: kind === 'preset' ? id : undefined,
        customRelayId: kind === 'custom' ? id : undefined,
        isPublic,
        password: isPublic ? undefined : password,
      });
      navigate(`/relays/team/${data.code}`, { state: { displayName, password: isPublic ? undefined : password } });
    } catch (e) {
      toast.error(apiError(e, 'Failed to create room'));
      setLoading(false);
    }
  }

  function handleClose() {
    setName(''); setGuestName(''); setRelayChoice('preset:2-4'); setIsPublic(true); setPassword('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Host Team Relay" size="sm">
      <div className="space-y-4">
        {!user && (
          <div>
            <label className="label mb-1 block">Your display name</label>
            <input className="input w-full" placeholder="e.g. SpeedyCuber99" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label mb-1 block">Room name</label>
          <input className="input w-full" placeholder="e.g. Friday relay night" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label mb-1 block">Relay</label>
          <select className="input w-full" value={relayChoice} onChange={(e) => setRelayChoice(e.target.value)}>
            <optgroup label="Standard Relays">
              {RELAY_PRESETS.map((p) => (
                <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>
              ))}
            </optgroup>
            {customRelays.length > 0 && (
              <optgroup label="Your Custom Relays">
                {customRelays.map((r) => (
                  <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                ))}
              </optgroup>
            )}
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
            className={clsx('relative w-10 h-6 rounded-full transition-colors shrink-0', isPublic ? 'bg-accent' : 'bg-gray-300 dark:bg-card-hover')}
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
    navigate(`/relays/team/${trimmedCode}`, { state: { displayName, password: password || undefined } });
  }

  function handleClose() {
    setCode(''); setGuestName(''); setPassword('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Join Team Relay" size="sm">
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

export default function RelayLobby() {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: publicRooms = [] } = useQuery<RelayPublicRoomDTO[]>({
    queryKey: ['relays-public'],
    queryFn: () => api.get('/relays/rooms/public').then((r) => r.data),
    refetchInterval: 5000,
  });

  function joinPublic(code: string) {
    const displayName = user?.displayName;
    if (!displayName) {
      setShowJoin(true);
      return;
    }
    navigate(`/relays/team/${code}`, { state: { displayName } });
  }

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Team Relays</h1>
          <p className="text-muted text-sm">Create or join a room, divide up the events, and race the clock together.</p>
        </div>

        <div className="flex gap-3">
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={16} />
            Create Room
          </button>
          <button className="btn flex items-center gap-2 border border-gray-200 dark:border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-card-hover transition-colors" onClick={() => setShowJoin(true)}>
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
                      {room.relayName} · {room.participantCount} player{room.participantCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-500/20 text-yellow-400">{room.status}</span>
                  <div className="text-xs font-mono text-muted">{room.code}</div>
                  <button className="btn-primary text-sm px-3 py-1.5" onClick={() => joinPublic(room.code)}>
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinRoomModal open={showJoin} onClose={() => setShowJoin(false)} />
    </>
  );
}
