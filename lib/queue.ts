import { Queue, Worker } from "bullmq";
import { redisClient, isRedisAvailable } from "./redis";
import webpush from "web-push";
import { db } from "./db";

type JobProcessor = (data: any) => Promise<void>;

const processors = new Map<string, JobProcessor>();
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

const inMemoryQueues: Record<string, Array<{ jobName: string; data: any }>> = {};

export function registerProcessor(queueName: string, processor: JobProcessor) {
  processors.set(queueName, processor);

  if (isRedisAvailable && redisClient) {
    try {
      const worker = new Worker(
        queueName,
        async (job) => {
          console.log(`Processing job ${job.id} from queue ${queueName}`);
          await processor(job.data);
        },
        { connection: redisClient }
      );

      worker.on("failed", (job, err) => {
        console.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
      });

      workers.set(queueName, worker);
    } catch (err: any) {
      console.warn(`Failed to initialize BullMQ worker for ${queueName}, running in-memory fallback:`, err.message);
    }
  }

  // Flush any in-memory queued jobs
  const pending = inMemoryQueues[queueName];
  if (pending && pending.length > 0) {
    inMemoryQueues[queueName] = [];
    for (const job of pending) {
      setTimeout(async () => {
        try {
          await processor(job.data);
        } catch (err) {
          console.error(`In-memory job processing failed for queue ${queueName}:`, err);
        }
      }, 0);
    }
  }
}

export async function addJob(queueName: string, jobName: string, data: any): Promise<void> {
  if (isRedisAvailable && redisClient) {
    try {
      let queue = queues.get(queueName);
      if (!queue) {
        queue = new Queue(queueName, { connection: redisClient });
        queues.set(queueName, queue);
      }
      await queue.add(jobName, data);
      console.log(`Job ${jobName} added to BullMQ queue ${queueName}`);
      return;
    } catch (err: any) {
      console.warn(`Failed to add job to BullMQ queue ${queueName}, falling back to in-memory:`, err.message);
    }
  }

  // Fallback to in-memory processing
  console.log(`Running fallback for job ${jobName} on queue ${queueName} (in-memory)`);
  const processor = processors.get(queueName);
  if (processor) {
    setTimeout(async () => {
      try {
        await processor(data);
      } catch (err) {
        console.error(`In-memory job processing failed for queue ${queueName}:`, err);
      }
    }, 0);
  } else {
    if (!inMemoryQueues[queueName]) {
      inMemoryQueues[queueName] = [];
    }
    inMemoryQueues[queueName].push({ jobName, data });
  }
}

// Pre-register push notification processor
registerProcessor("push-notifications", async (data: {
  subscription: { endpoint: string; p256dh: string; auth: string };
  payload: { title: string; body: string; url: string };
}) => {
  const { subscription, payload } = data;
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    console.error("Invalid notification subscription:", subscription);
    return;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      },
      JSON.stringify(payload)
    );
    console.log(`Notification sent to endpoint: ${subscription.endpoint}`);
  } catch (err: any) {
    console.warn(`Failed to send webpush notification to endpoint: ${subscription.endpoint}`, err.message);
    const status = err.statusCode;
    if (status === 410 || status === 404) {
      console.log(`Subscription expired/dead. Removing subscription for endpoint: ${subscription.endpoint}`);
      try {
        await db.pushSubscription.deleteMany({
          where: { endpoint: subscription.endpoint }
        });
      } catch (dbErr: any) {
        console.error("Failed to delete expired subscription:", dbErr.message);
      }
    }
  }
});
