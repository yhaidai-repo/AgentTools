// One thing someone agreed to do in the meeting. `owner` as the transcript names them ("Me" is the user); `saidAt` the
// transcript time it was agreed, e.g. "00:12:03".
export interface MeetingActionItem {
  owner: string;
  what: string;
  due: string | null;
  saidAt: string;
}
