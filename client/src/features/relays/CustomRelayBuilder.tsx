import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '@cubing/icons';
import type { CustomRelayEventEntry, CustomRelayDTO } from '@scc/shared';
import { expandToLegs } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { eventIconClass } from '../../lib/eventIcons';
import { EventSelector } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { guestRelayStore } from './relayLocalStore';

export default function CustomRelayBuilder({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (relay: CustomRelayDTO) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [events, setEvents] = useState<CustomRelayEventEntry[]>([]);
  const [addEventId, setAddEventId] = useState('333');
  const [saving, setSaving] = useState(false);

  function reset() {
    setName('');
    setEvents([]);
    setAddEventId('333');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function addEvent() {
    setEvents((prev) => {
      const existing = prev.find((e) => e.eventId === addEventId);
      if (existing) {
        return prev.map((e) => (e.eventId === addEventId ? { ...e, quantity: Math.min(10, e.quantity + 1) } : e));
      }
      return [...prev, { eventId: addEventId, quantity: 1 }];
    });
  }

  function removeEvent(index: number) {
    setEvents((prev) => prev.filter((_, i) => i !== index));
  }

  function setQuantity(index: number, quantity: number) {
    setEvents((prev) => prev.map((e, i) => (i === index ? { ...e, quantity: Math.max(1, Math.min(10, quantity)) } : e)));
  }

  function move(index: number, dir: -1 | 1) {
    setEvents((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function runNow() {
    if (events.length === 0) {
      toast.error('Add at least one event');
      return;
    }
    const legEventIds = expandToLegs(events);
    navigate('/relays/run', { state: { relayName: name.trim() || 'Custom Relay', legEventIds } });
    handleClose();
  }

  async function save() {
    if (events.length === 0) {
      toast.error('Add at least one event');
      return;
    }
    const relayName = name.trim() || 'Custom Relay';
    setSaving(true);
    try {
      if (user) {
        const { data } = await api.post<CustomRelayDTO>('/relays/custom', { name: relayName, events });
        toast.success('Custom relay saved');
        onSaved?.(data);
      } else {
        const relay = guestRelayStore.saveCustomRelay(relayName, events);
        toast.success('Saved locally — log in to get a shareable link');
        onSaved?.(relay);
      }
      handleClose();
    } catch (e) {
      toast.error(apiError(e, 'Failed to save custom relay'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Custom Relay" size="md">
      <div className="space-y-4">
        <div>
          <label className="label mb-1 block">Name</label>
          <input className="input w-full" placeholder="e.g. My Mixed Relay" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="label mb-1 block">Add event</label>
          <div className="flex gap-2">
            <EventSelector value={addEventId} onChange={setAddEventId} className="flex-1 max-w-none" />
            <button className="btn-primary px-4 flex items-center gap-1.5" onClick={addEvent}>
              <Icon name="plus" size={16} /> Add
            </button>
          </div>
        </div>

        {events.length > 0 && (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {events.map((e, i) => (
              <div key={e.eventId} className="flex items-center gap-2 card p-2">
                <span className={`cubing-icon ${eventIconClass(e.eventId)}`} style={{ fontSize: 20, lineHeight: 1 }} />
                <span className="text-sm font-medium flex-1 min-w-0 truncate">{e.eventId}</span>
                <div className="flex items-center gap-1">
                  <button className="text-muted hover:text-gray-700 dark:hover:text-gray-200 p-1" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                    <Icon name="arrowLeft" size={14} className="rotate-90" />
                  </button>
                  <button className="text-muted hover:text-gray-700 dark:hover:text-gray-200 p-1" onClick={() => move(i, 1)} disabled={i === events.length - 1} title="Move down">
                    <Icon name="arrowRight" size={14} className="rotate-90" />
                  </button>
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="input w-14 text-center text-sm py-1"
                  value={e.quantity}
                  onChange={(ev) => setQuantity(i, parseInt(ev.target.value, 10) || 1)}
                />
                <span className="text-xs text-muted">×</span>
                <button className="text-muted hover:text-red-400 p-1" onClick={() => removeEvent(i)} title="Remove">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn flex-1 py-2 rounded-lg text-sm border border-border" onClick={runNow}>
            Run now
          </button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : user ? 'Save & get share link' : 'Save locally'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
