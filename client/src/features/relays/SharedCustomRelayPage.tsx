import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '@cubing/icons';
import { expandToLegs, type CustomRelayDTO } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { eventIconClass } from '../../lib/eventIcons';

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

  if (notFound) return <div className="p-8 text-muted text-center">Custom relay not found.</div>;
  if (!relay) return <div className="p-8 text-muted text-center">Loading…</div>;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">{relay.name}</h1>
        <p className="text-muted text-sm">{relay.events.reduce((n, e) => n + e.quantity, 0)} events</p>
      </div>
      <div className="card p-4 flex flex-wrap gap-2">
        {relay.events.map((e, i) => (
          <span key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card-hover text-xs">
            <span className={`cubing-icon ${eventIconClass(e.eventId)}`} style={{ fontSize: 16, lineHeight: 1 }} />
            {e.eventId}{e.quantity > 1 && ` ×${e.quantity}`}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={run}>Run this relay</button>
        {user && (
          <button className="btn flex-1 py-2 rounded-lg text-sm border border-border" onClick={saveCopy} disabled={saving}>
            {saving ? 'Saving…' : 'Save a copy'}
          </button>
        )}
      </div>
    </div>
  );
}
