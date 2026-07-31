import "server-only";

import type { Prisma } from "@prisma/client";
import {
  storagePathsForReferences,
  TRAINING_IMAGE_BUCKET,
  TRAINING_IMAGE_MAX_PER_WORKSPACE
} from "@/lib/storage";

type TrainingImageReader = Pick<
  Prisma.TransactionClient,
  "trainingPhase"
>;

export class TrainingImageQuotaError extends Error {
  constructor() {
    super(
      `Das Team-Limit von ${TRAINING_IMAGE_MAX_PER_WORKSPACE} Trainingsbildern ist erreicht. Bitte zuerst bestehende Bilder löschen.`
    );
    this.name = "TrainingImageQuotaError";
  }
}

export async function countWorkspaceTrainingImages(
  client: TrainingImageReader,
  workspaceId: string
): Promise<number> {
  const phases = await client.trainingPhase.findMany({
    where: { training: { workspaceId } },
    select: { imageUrls: true }
  });

  return storagePathsForReferences(
    TRAINING_IMAGE_BUCKET,
    phases.flatMap((phase) => phase.imageUrls ?? []),
    `${workspaceId}/`
  ).length;
}

export async function assertTrainingImageWorkspaceCapacity(
  client: TrainingImageReader,
  workspaceId: string,
  additionalImages = 1
): Promise<void> {
  const requestedCapacity = Math.max(
    0,
    Math.floor(additionalImages)
  );
  const currentImages = await countWorkspaceTrainingImages(
    client,
    workspaceId
  );

  if (
    currentImages + requestedCapacity >
    TRAINING_IMAGE_MAX_PER_WORKSPACE
  ) {
    throw new TrainingImageQuotaError();
  }
}
