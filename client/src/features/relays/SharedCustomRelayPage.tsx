import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import '@cubing/icons';
import { expandToLegs, getEvent, type CustomRelayDTO } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { eventIconClass } from '../../lib/eventIcons';
import { Icon } from '../../components/Icon';

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="card p-8 text-center">{children}</div>
    </div>
  );
}

// A shared custom relay, opened by id (public read, mirrors Reconstruction's
// share-link pattern) — anyone with the link can view and run it; saving
// their own copy still requires an account.
export default function SharedCustomRelayPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [relay, setRelay] = useState<CustomRelayDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<CustomRelayDTO>(`/relays/custom/${id}`)
      .then((r) => setRelay(r.data))
      .catch(() => setNotFound(true));
  }, [id]);

  function run() {
    if (!relay) return;
    navigate('/relays/run', { state: { relayName: relay.name, legEventIds: expandToLegs(relay.events) } });
  }

  async function saveCopy() {
    if (!relay || !user) return;
    setSaving(true);
    try {
      await api.post('/relays/custom', { name: relay.name, events: relay.events });
      toast.success('Saved to your custom relays');
    } catch (e) {
      toast.error(apiError(e, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <CenteredCard>
        <Icon name="x" size={28} className="mx-auto mb-3 text-muted" />
        <div className="font-semibold mb-1">Relay not found</div>
        <p className="text-sm text-muted mb-4">This link may be wrong, or the relay was deleted.</p>
        <Link to="/relays" className="btn-primary">
          Back to Relays
        </Link>
      </CenteredCard>
    );
  }

  if (!relay) {
    return (
      <CenteredCard>
        <p className="text-sm text-muted">Loading…</p>
      </CenteredCard>
    );
  }

  const totalEvents = relay.events.reduce((n, e) => n + e.quantity, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent mb-2">
          <Icon name="external" size={13} />
          Shared Custom Relay
        </div>
        <h1 className="text-3xl font-bold mb-1">{relay.name}</h1>
        <p className="text-muted text-sm">{totalEvents} events</p>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-4">
          {relay.events.map((e, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 w-20">
              <span className={`cubing-icon ${eventIconClass(e.eventId)} text-gray-500 dark:text-gray-400`} style={{ fontSize: 32, lineHeight: 1 }} />
              <span className="text-xs font-medium text-center leading-tight">{getEvent(e.eventId)?.name ?? e.eventId}</span>
              {e.quantity > 1 && <span className="text-[11px] text-accent font-mono font-semibold">×{e.quantity}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button className="btn-primary flex-1 py-3" onClick={run}>
          Run this relay
        </button>
        {user ? (
          <button className="btn flex-1 py-3 rounded-lg text-sm border border-border" onClick={saveCopy} disabled={saving}>
            {saving ? 'Saving…' : 'Save a copy'}
          </button>
        ) : (
          <Link to="/login" className="btn flex-1 py-3 rounded-lg text-sm border border-border flex items-center justify-center">
            Log in to save a copy
          </Link>
        )}
      </div>
    </div>
  );
}
