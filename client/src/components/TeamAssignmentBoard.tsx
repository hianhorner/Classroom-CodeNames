import {
  closestCorners,
  DragOverlay,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AssignmentSummary, AssignmentUpdateInput, PlayerSummary } from '@classroom-codenames/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type BucketId =
  | 'unassigned'
  | 'red_guessers'
  | 'red_spymasters'
  | 'blue_guessers'
  | 'blue_spymasters';

type TeamAssignmentBoardProps = {
  players: PlayerSummary[];
  assignments: AssignmentSummary[];
  onSave: (assignments: AssignmentUpdateInput[]) => Promise<void>;
};

const BUCKET_META: Record<BucketId, { title: string; subtitle: string }> = {
  unassigned: {
    title: 'Waiting Pool',
    subtitle: 'Students appear here as they join.'
  },
  red_guessers: {
    title: 'Red Guessers',
    subtitle: ''
  },
  red_spymasters: {
    title: 'Red Spymasters',
    subtitle: 'Order here sets captain rotation.'
  },
  blue_guessers: {
    title: 'Blue Guessers',
    subtitle: ''
  },
  blue_spymasters: {
    title: 'Blue Spymasters',
    subtitle: 'Order here sets captain rotation.'
  }
};

const TEAM_COLUMNS: Array<{ team: 'red' | 'blue'; bucketIds: BucketId[] }> = [
  {
    team: 'red',
    bucketIds: ['red_guessers', 'red_spymasters']
  },
  {
    team: 'blue',
    bucketIds: ['blue_guessers', 'blue_spymasters']
  }
];

function mapAssignmentToBucket(assignment: AssignmentSummary | undefined): BucketId {
  if (!assignment?.team || !assignment.role) {
    return 'unassigned';
  }

  return `${assignment.team}_${assignment.role}s` as BucketId;
}

function buildBuckets(players: PlayerSummary[], assignments: AssignmentSummary[]): Record<BucketId, string[]> {
  const assignmentMap = new Map(assignments.map((entry) => [entry.playerId, entry]));
  const buckets: Record<BucketId, string[]> = {
    unassigned: [],
    red_guessers: [],
    red_spymasters: [],
    blue_guessers: [],
    blue_spymasters: []
  };

  const captainOrderMap = new Map(assignments.map((entry) => [entry.playerId, entry.captainOrder ?? 999]));

  players.forEach((player) => {
    const bucketId = mapAssignmentToBucket(assignmentMap.get(player.id));
    buckets[bucketId].push(player.id);
  });

  (['red_guessers', 'blue_guessers'] as BucketId[]).forEach((bucketId) => {
    buckets[bucketId].sort((leftId, rightId) => {
      return (captainOrderMap.get(leftId) ?? 999) - (captainOrderMap.get(rightId) ?? 999);
    });
  });

  return buckets;
}

function buildAssignments(
  buckets: Record<BucketId, string[]>,
  assignments: AssignmentSummary[],
  visiblePlayerIds: Set<string>
): AssignmentUpdateInput[] {
  const visibleAssignments = Object.entries(buckets).flatMap(([bucketId, playerIds]) => {
    if (bucketId === 'unassigned') {
      return [];
    }

    const [team, rolePlural] = bucketId.split('_') as ['red' | 'blue', 'guessers' | 'spymasters'];
    const role: AssignmentUpdateInput['role'] = rolePlural === 'guessers' ? 'guesser' : 'spymaster';

    return playerIds.map((playerId, index) => ({
      playerId,
      team,
      role,
      captainOrder: role === 'guesser' ? index + 1 : null
    }));
  });

  const hiddenAssignments = assignments
    .filter(
      (assignment) =>
        !visiblePlayerIds.has(assignment.playerId) &&
        assignment.team !== null &&
        assignment.role !== null
    )
    .map((assignment) => ({
      playerId: assignment.playerId,
      team: assignment.team,
      role: assignment.role,
      captainOrder: assignment.role === 'guesser' ? assignment.captainOrder ?? null : null
    }));

  return [...visibleAssignments, ...hiddenAssignments];
}

function createEmptyBuckets(): Record<BucketId, string[]> {
  return {
    unassigned: [],
    red_guessers: [],
    red_spymasters: [],
    blue_guessers: [],
    blue_spymasters: []
  };
}

function getAssignmentsSignature(assignments: AssignmentSummary[]) {
  return [...assignments]
    .sort((left, right) => left.playerId.localeCompare(right.playerId))
    .map((assignment) =>
      [
        assignment.playerId,
        assignment.team ?? '',
        assignment.role ?? '',
        assignment.captainOrder ?? '',
        assignment.isCurrentCaptain ? '1' : '0',
        assignment.isCurrentSpymasterCaptain ? '1' : '0'
      ].join(':')
    )
    .join('|');
}

function areBucketsEqual(left: Record<BucketId, string[]>, right: Record<BucketId, string[]>) {
  return (Object.keys(left) as BucketId[]).every((bucketId) => {
    if (left[bucketId].length !== right[bucketId].length) {
      return false;
    }

    return left[bucketId].every((playerId, index) => playerId === right[bucketId][index]);
  });
}

function findBucket(buckets: Record<BucketId, string[]>, itemId: string): BucketId | undefined {
  return (Object.keys(buckets) as BucketId[]).find((bucketId) => buckets[bucketId].includes(itemId));
}

function PlayerChipContent({
  player,
  order
}: {
  player: PlayerSummary;
  order?: number;
}) {
  return (
    <>
      <div className="player-chip__content">
        <strong>{player.name}</strong>
        <span>{player.isTeacher ? 'Teacher' : player.isConnected ? 'Connected' : 'Offline'}</span>
      </div>
      {order ? <span className="captain-order">#{order}</span> : null}
    </>
  );
}

function SortablePlayerChip({
  player,
  order
}: {
  player: PlayerSummary;
  order?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={isDragging ? 'player-chip player-chip--dragging' : 'player-chip'}
      {...attributes}
      {...listeners}
    >
      <PlayerChipContent player={player} order={order} />
    </div>
  );
}

function AssignmentZoneBody({
  bucketId,
  children
}: {
  bucketId: BucketId;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: bucketId
  });

  return (
    <div ref={setNodeRef} id={bucketId} className={`assignment-zone__list ${isOver ? 'assignment-zone__list--over' : ''}`}>
      {children}
    </div>
  );
}

export function TeamAssignmentBoard({ players, assignments, onSave }: TeamAssignmentBoardProps) {
  const [buckets, setBuckets] = useState<Record<BucketId, string[]>>(() => buildBuckets(players, assignments));
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const assignmentsSignatureRef = useRef(getAssignmentsSignature(assignments));

  useEffect(() => {
    const nextSignature = getAssignmentsSignature(assignments);

    if (assignmentsSignatureRef.current !== nextSignature) {
      assignmentsSignatureRef.current = nextSignature;
      setBuckets(buildBuckets(players, assignments));
      return;
    }

    setBuckets((currentBuckets) => {
      const validPlayerIds = new Set(players.map((player) => player.id));
      const nextBuckets = createEmptyBuckets();
      const seenPlayerIds = new Set<string>();

      (Object.keys(currentBuckets) as BucketId[]).forEach((bucketId) => {
        currentBuckets[bucketId].forEach((playerId) => {
          if (!validPlayerIds.has(playerId) || seenPlayerIds.has(playerId)) {
            return;
          }

          nextBuckets[bucketId].push(playerId);
          seenPlayerIds.add(playerId);
        });
      });

      const serverBuckets = buildBuckets(players, assignments);

      (Object.keys(serverBuckets) as BucketId[]).forEach((bucketId) => {
        serverBuckets[bucketId].forEach((playerId) => {
          if (seenPlayerIds.has(playerId)) {
            return;
          }

          nextBuckets[bucketId].push(playerId);
          seenPlayerIds.add(playerId);
        });
      });

      return areBucketsEqual(currentBuckets, nextBuckets) ? currentBuckets : nextBuckets;
    });
  }, [players, assignments]);

  async function persistBuckets(nextBuckets: Record<BucketId, string[]>) {
    setIsSaving(true);
    setSaveError(null);
    const visiblePlayerIds = new Set(players.map((player) => player.id));

    try {
      await onSave(buildAssignments(nextBuckets, assignments, visiblePlayerIds));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save assignments.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActivePlayerId(null);
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId) {
      return;
    }

    const sourceBucket = findBucket(buckets, activeId);
    const destinationBucket = (Object.keys(BUCKET_META) as BucketId[]).includes(overId as BucketId)
      ? (overId as BucketId)
      : findBucket(buckets, overId);

    if (!sourceBucket || !destinationBucket) {
      return;
    }

    const nextBuckets = {
      ...buckets,
      [sourceBucket]: [...buckets[sourceBucket]],
      [destinationBucket]: [...buckets[destinationBucket]]
    };

    if (sourceBucket === destinationBucket) {
      const oldIndex = nextBuckets[sourceBucket].indexOf(activeId);
      const newIndex =
        overId === destinationBucket ? nextBuckets[destinationBucket].length - 1 : nextBuckets[destinationBucket].indexOf(overId);

      nextBuckets[sourceBucket] = arrayMove(nextBuckets[sourceBucket], oldIndex, newIndex);
    } else {
      nextBuckets[sourceBucket] = nextBuckets[sourceBucket].filter((playerId) => playerId !== activeId);

      const targetIndex =
        overId === destinationBucket ? nextBuckets[destinationBucket].length : nextBuckets[destinationBucket].indexOf(overId);

      nextBuckets[destinationBucket].splice(targetIndex < 0 ? nextBuckets[destinationBucket].length : targetIndex, 0, activeId);
    }

    setBuckets(nextBuckets);
    void persistBuckets(nextBuckets);
  }

  function handleDragStart(event: DragStartEvent) {
    setActivePlayerId(String(event.active.id));
  }

  function getPlayerOrder(playerId: string): number | undefined {
    const bucketId = findBucket(buckets, playerId);

    if (!bucketId || !bucketId.endsWith('spymasters')) {
      return undefined;
    }

    return buckets[bucketId].indexOf(playerId) + 1;
  }

  const activePlayer = activePlayerId ? playerMap.get(activePlayerId) : undefined;

  return (
    <section className="assignment-board">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActivePlayerId(null)}
      >
        <article className="paper-panel assignment-zone assignment-zone--waiting">
          <header>
            <h4>{BUCKET_META.unassigned.title}</h4>
            {BUCKET_META.unassigned.subtitle ? <p>{BUCKET_META.unassigned.subtitle}</p> : null}
          </header>
          <SortableContext items={buckets.unassigned} strategy={rectSortingStrategy}>
            <AssignmentZoneBody bucketId="unassigned">
              {buckets.unassigned.length ? (
                buckets.unassigned.map((playerId) => {
                  const player = playerMap.get(playerId);

                  if (!player) {
                    return null;
                  }

                  return <SortablePlayerChip key={playerId} player={player} />;
                })
              ) : (
                <div className="assignment-zone__empty">Everyone has been assigned.</div>
              )}
            </AssignmentZoneBody>
          </SortableContext>
        </article>

        <div className="assignment-board__grid">
          {TEAM_COLUMNS.map(({ team, bucketIds }) => (
            <div key={team} className={`assignment-board__team assignment-board__team--${team}`}>
              {bucketIds.map((bucketId) => (
                <article key={bucketId} className={`paper-panel assignment-zone assignment-zone--${bucketId}`}>
                  <header>
                    <h4>{BUCKET_META[bucketId].title}</h4>
                    {BUCKET_META[bucketId].subtitle ? <p>{BUCKET_META[bucketId].subtitle}</p> : null}
                  </header>
                  <SortableContext items={buckets[bucketId]} strategy={rectSortingStrategy}>
                    <AssignmentZoneBody bucketId={bucketId}>
                      {buckets[bucketId].length ? (
                        buckets[bucketId].map((playerId, index) => {
                          const player = playerMap.get(playerId);

                          if (!player) {
                            return null;
                          }

                          return (
                            <SortablePlayerChip
                              key={playerId}
                              player={player}
                              order={bucketId.endsWith('spymasters') ? index + 1 : undefined}
                            />
                          );
                        })
                      ) : (
                        <div className="assignment-zone__empty">Drop players here</div>
                      )}
                    </AssignmentZoneBody>
                  </SortableContext>
                </article>
              ))}
            </div>
          ))}
        </div>

        <DragOverlay>
          {activePlayer ? (
            <div className="player-chip player-chip--overlay">
              <PlayerChipContent player={activePlayer} order={getPlayerOrder(activePlayer.id)} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div className="assignment-board__footer">
        <span>{isSaving ? 'Saving assignments…' : 'Assignments sync automatically after each drop.'}</span>
        {saveError ? <span className="error-text">{saveError}</span> : null}
      </div>
    </section>
  );
}
