import { createClient } from "tinacms/dist/client";
import { queries } from "./types";
export const client = createClient({ cacheDir: '/root/koya/apps/web/tina/__generated__/.cache/1775802560011', url: '/api/tina/gql', token: 'undefined', queries,  });
export default client;
  