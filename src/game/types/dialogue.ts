export type DialogueSpeakerId = 'player' | 'narrator' | string;

export interface DialogueLine {
  id?: string;
  speakerId: DialogueSpeakerId;
  textKey: string;
  portraitKey?: string;
  emotion?: string;
}

export interface TutorialTip {
  id: string;
  textKey: string;
  anchor?: string;
}
