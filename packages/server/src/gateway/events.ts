export interface MessageEvent {
  channelId: string;
  channelName?: string;
  userId: string;
  userName: string;
  content: string;
  platform: string;
  isCommand?: boolean;
  timestamp: string;
}
