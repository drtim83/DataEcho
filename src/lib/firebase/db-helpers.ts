import type {
  DocumentReference,
  Firestore,
  QuerySnapshot,
} from 'firebase-admin/firestore';

const BATCH_LIMIT = 450;

export async function commitDeletes(
  db: Firestore,
  refs: DocumentReference[]
): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function commitNullPipelineId(
  db: Firestore,
  refs: DocumentReference[]
): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) {
      batch.update(ref, { pipeline_id: null });
    }
    await batch.commit();
  }
}

export function sanitizeConnectorConfig(
  config: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!config) return {};
  const rest = { ...config };
  delete rest.password;
  return rest;
}

function collectRefs(snap: QuerySnapshot): DocumentReference[] {
  return snap.docs.map((d) => d.ref);
}

export async function deleteDestinationCascade(
  db: Firestore,
  destinationId: string
): Promise<void> {
  const conditionsSnap = await db
    .collection('pipeline_destination_conditions')
    .where('destination_id', '==', destinationId)
    .get();

  const refs: DocumentReference[] = [
    ...collectRefs(conditionsSnap),
    db.collection('pipeline_destinations').doc(destinationId),
  ];
  await commitDeletes(db, refs);
}

export async function deletePipelineCascade(
  db: Firestore,
  pipelineId: string
): Promise<void> {
  const [
    nodesSnap,
    edgesSnap,
    mappingsSnap,
    sourcesSnap,
    destinationsSnap,
    runsSnap,
    meteringSnap,
    auditSnap,
  ] = await Promise.all([
    db.collection('pipeline_nodes').where('pipeline_id', '==', pipelineId).get(),
    db.collection('pipeline_edges').where('pipeline_id', '==', pipelineId).get(),
    db.collection('schema_mappings').where('pipeline_id', '==', pipelineId).get(),
    db.collection('pipeline_sources').where('pipeline_id', '==', pipelineId).get(),
    db.collection('pipeline_destinations').where('pipeline_id', '==', pipelineId).get(),
    db.collection('sync_runs').where('pipeline_id', '==', pipelineId).get(),
    db.collection('metering_events').where('pipeline_id', '==', pipelineId).get(),
    db.collection('audit_logs').where('pipeline_id', '==', pipelineId).get(),
  ]);

  const conditionSnaps = await Promise.all(
    destinationsSnap.docs.map((d) =>
      db
        .collection('pipeline_destination_conditions')
        .where('destination_id', '==', d.id)
        .get()
    )
  );

  const deleteRefs: DocumentReference[] = [
    ...collectRefs(nodesSnap),
    ...collectRefs(edgesSnap),
    ...collectRefs(mappingsSnap),
    ...collectRefs(sourcesSnap),
    ...collectRefs(destinationsSnap),
    ...conditionSnaps.flatMap(collectRefs),
    ...collectRefs(runsSnap),
    db.collection('pipelines').doc(pipelineId),
  ];

  const nullRefs: DocumentReference[] = [
    ...collectRefs(meteringSnap),
    ...collectRefs(auditSnap),
  ];

  await Promise.all([
    commitDeletes(db, deleteRefs),
    commitNullPipelineId(db, nullRefs),
  ]);
}

export async function isConnectorReferenced(
  db: Firestore,
  connectorId: string
): Promise<boolean> {
  const [primarySources, primaryTargets, extraSources, extraDests] =
    await Promise.all([
      db.collection('pipelines').where('source_id', '==', connectorId).limit(1).get(),
      db.collection('pipelines').where('target_id', '==', connectorId).limit(1).get(),
      db.collection('pipeline_sources').where('source_id', '==', connectorId).limit(1).get(),
      db.collection('pipeline_destinations').where('target_id', '==', connectorId).limit(1).get(),
    ]);

  return (
    !primarySources.empty ||
    !primaryTargets.empty ||
    !extraSources.empty ||
    !extraDests.empty
  );
}
