import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import '@cubing/icons';
import { RELAY_PRESETS, formatTime, type CustomRelayDTO, type RelayAttemptDTO } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { eventIconClass } from '../../lib/eventIcons';
import { Icon } from '../../components/Icon';
import CustomRelayBuilder from './CustomRelayBuilder';
import { guestRelayStore } from './relayLocalStore';

function RelayTile({ name, events, onClick }: { name: string; events: string[]; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 flex flex-col gap-2 text-left hover:bg-card-hover transition-colors">
      <div className="font-semibold">{name}</div>
      <div className="flex flex-wrap gap-1">
        {events.slice(0, 8).map((eventId, i) => (
          <span key={i} className={`cubing-icon ${eventIconClass(eventId)}`} style={{ fontSize: 18, lineHeight: 1 }} />
        ))}
        {events.length > 8 && <span className="text-xs text-muted self-center">+{events.length - 8}</span>}
      </div>
      <div className="text-xs text-muted">{events.length} events</div>
    </button>
  );
}

export default function RelaysPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);

  const { data: customRelays = [] } = useQuery<CustomRelayDTO[]>({
    queryKey: ['relays-custom'],
    queryFn: () => (user ? api.get('/relays/custom').then((r) => r.data) : Promise.resolve(guestRelayStore.listCustomRelays())),
  });

  const { data: attempts = [] } = useQuery<RelayAttemptDTO[]>({
    queryKey: ['relays-attempts'],
    queryFn: () => (user ? api.get('/relays/attempts').then((r) => r.data) : Promise.resolve(guestRelayStore.listAttempts())),
  });

  function runPreset(presetId: string) {
    const preset = RELAY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    navigate('/relays/run', { state: { relayName: preset.name, legEventIds: preset.events } });
  }

  function runCustom(relay: CustomRelayDTO) {
    const legEventIds = relay.events.flatMap((e) => Array(e.quantity).fill(e.eventId));
    navigate('/relays/run', { state: { relayName: relay.name, legEventIds } });
  }

  async function deleteCustom(relay: CustomRelayDTO) {
    if (user) {
      try {
        await api.delete(`/relays/custom/${relay.id}`);
      } catch (e) {
        toast.error(apiError(e, 'Failed to delete'));
        return;
      }
    } else {
      guestRelayStore.deleteCustomRelay(relay.id);
    }
    queryClient.invalidateQueries({ queryKey: ['relays-custom'] });
  }

  function copyShareLink(relay: CustomRelayDTO) {
    if (relay.userId === 'guest') {
      toast.error('Log in to get a shareable link');
      return;
    }
    const url = `${window.location.origin}/relays/share/${relay.id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Share link copied'),
      () => toast.error('Failed to copy link'),
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Relays</h1>
          <p className="text-muted text-sm">Time multi-event relays solo, build your own, or race one together.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border" onClick={() => setShowBuilder(true)}>
            <Icon name="plus" size={16} /> Custom Relay
          </button>
          <Link to="/relays/team" className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
            <Icon name="swords" size={16} /> Team Relay
          </Link>
        </div>
      </div>

      <div>
        <div className="label mb-2">Standard Relays</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {RELAY_PRESETS.map((p) => (
            <RelayTile key={p.id} name={p.name} events={p.events} onClick={() => runPreset(p.id)} />
          ))}
        </div>
      </div>

      {customRelays.length > 0 && (
        <div>
          <div className="label mb-2">Your Custom Relays</div>
          <div className="space-y-2">
            {customRelays.map((r) => (
              <div key={r.id} className="card p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted">{r.events.reduce((n, e) => n + e.quantity, 0)} events</div>
                </div>
                <button className="text-muted hover:text-gray-700 dark:hover:text-gray-200 p-1.5" title="Copy share link" onClick={() => copyShareLink(r)}>
                  <Icon name="copy" size={16} />
                </button>
                <button className="text-muted hover:text-red-400 p-1.5" title="Delete" onClick={() => deleteCustom(r)}>
                  <Icon name="trash" size={16} />
                </button>
                <button className="btn-primary text-sm px-3 py-1.5" onClick={() => runCustom(r)}>
                  Run
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {attempts.length > 0 && (
        <div>
          <div className="label mb-2">Recent Attempts</div>
          <div className="space-y-1.5">
            {attempts.slice(0, 10).map((a) => (
              <div key={a.id} className="card p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0 truncate text-sm">{a.relayName}</div>
                <div className="text-xs text-muted">{a.legs.length} events</div>
                <div className="font-mono text-sm">{formatTime(a.totalTimeMs, 'NONE', 2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CustomRelayBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['relays-custom'] })}
      />
    </div>
  );
}
