import { z } from "zod";
import { zPaginated, zUuid } from "./common.js";

export const zNotification = z.object({
  id: zUuid,
  channel: z.string(),
  template: z.string(),
  payload: z.record(z.unknown()),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof zNotification>;

export const zNotificationsResponse = zPaginated(zNotification);
