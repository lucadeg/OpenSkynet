export interface Channel {
  id: string;
  name: string;
  platform: string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: string;
}
