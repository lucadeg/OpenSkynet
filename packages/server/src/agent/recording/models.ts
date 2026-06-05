export interface RecordedFrame {
  timestamp: number;
  url: string;
  title: string;
  screenshot?: string;
  domSnapshot?: string;
  action?: ActionEvent;
}

export interface ActionEvent {
  type: string;
  target?: string;
  value?: string;
  coordinates?: { x: number; y: number };
  timestamp: number;
}

export interface RecordingSession {
  id: string;
  name: string;
  frames: RecordedFrame[];
  startTime: number;
  endTime?: number;
  status: "recording" | "stopped" | "processing";
}
