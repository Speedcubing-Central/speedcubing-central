import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import '@cubing/icons';
import { RELAY_PRESETS, expandToLegs, type CustomRelayDTO } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { eventIconClass } from '../../lib/eventIcons';
import { Icon } from '../../components/Icon';
import CustomRelayBuilder from './CustomRelayBuilder';
import { guestRelayStore } from './relayLocalStore';
import { IS_BETA_SITE } from '../../lib/betaSite';

function EventIconRow({ events }: { events: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {events.map((eventId, i) => (
        <span
          key={i}
          className={`cubing-icon ${eventIconClass(eventId)} text-gray-500 dark:text-gray-400 group-hover:text-accent transition-colors`}
          style={{ fontSize: 26, lineHeight: 1 }}
        />
      ))}
    </div>
  );
}

function RelayTile({ name, events, onClick }: { name: string; events: string[]; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card group flex flex-col gap-4 p-5 text-left transition-colors hover:border-accent/50"
    >
      <div className="font-bold text-base leading-tight">{name}</div>
      <EventIconRow events={events} />
      <div className="mt-auto pt-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon name="skipForward" size={13} />
        {events.length} events
      </div>
    </button>
  );
}

function CustomRelayTile({
  relay,
  onRun,
  onShare,
  onDelete,
}: {
  relay: CustomRelayDTO;
  onRun: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const legEventIds = expandToLegs(relay.events);
  return (
    <div className="card group flex flex-col gap-4 p-5 transition-colors hover:border-accent/50">
      <div
        role="button"
        tabIndex={0}
        onClick={onRun}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRun();
          }
        }}
        className="flex flex-col gap-4 text-left cursor-pointer outline-none"
      >
        <div className="font-bold text-base leading-tight truncate">{relay.name}</div>
        <EventIconRow events={legEventIds} />
      </div>
      <div className="mt-auto pt-2 flex items-center justify-between border-t border-border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted pt-2">
          <Icon name="skipForward" size={13} />
          {legEventIds.length} events
        </div>
        <div className="flex items-center gap-0.5 pt-1">
          <button className="text-muted hover:text-gray-700 dark:hover:text-gray-200 p-1.5" title="Copy share link" onClick={onShare}>
            <Icon name="copy" size={15} />
          </button>
          <button className="text-muted hover:text-red-400 p-1.5" title="Delete" onClick={onDelete}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </div>
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

  function runPreset(presetId: string) {
    const preset = RELAY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    navigate('/relays/run', { state: { relayName: preset.name, legEventIds: preset.events } });
  }

  function runCustom(relay: CustomRelayDTO) {
    navigate('/relays/run', { state: { relayName: relay.name, legEventIds: expandToLegs(relay.events) } });
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
    if (!user) {
      toast.error('Log in to get a shareable link');
      return;
    }
    const url = `${window.location.origin}/relays/share/${relay.id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Share link copied'),
      () => toast.error('Failed to copy link'),
    );
  }

  const quickPresets = RELAY_PRESETS.filter((p) => p.group === 'quick');
  const guildfordPresets = RELAY_PRESETS.filter((p) => p.group === 'guildford');

  return (
    <div className="space-y-10 pb-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Relays</h1>
          <p className="text-muted text-sm">Time multi-event relays solo, build your own, or race one together.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border" onClick={() => setShowBuilder(true)}>
            <Icon name="plus" size={16} /> Custom Relay
          </button>
          {IS_BETA_SITE && (
            <Link to="/relays/team" className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
              <Icon name="swords" size={16} /> Team Relay
            </Link>
          )}
        </div>
      </div>

      <div>
        <div className="label mb-3">Quick Relays</div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {quickPresets.map((p) => (
            <RelayTile key={p.id} name={p.name} events={p.events} onClick={() => runPreset(p.id)} />
          ))}
        </div>
      </div>

      <div>
        <div className="label mb-3">Guildford Relays</div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {guildfordPresets.map((p) => (
            <RelayTile key={p.id} name={p.name} events={p.events} onClick={() => runPreset(p.id)} />
          ))}
        </div>
      </div>

      {customRelays.length > 0 && (
        <div>
          <div className="label mb-3">Custom Relays</div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {customRelays.map((r) => (
              <CustomRelayTile
                key={r.id}
                relay={r}
                onRun={() => runCustom(r)}
                onShare={() => copyShareLink(r)}
                onDelete={() => deleteCustom(r)}
              />
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
