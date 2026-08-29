// Shared content types, mirroring the shape produced by
// scripts/lib/normalise.mjs and scripts/lib/generate-play-items.mjs.

export type AnswerKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface QuestionOption {
  key: AnswerKey;
  text: string;
}

export interface Question {
  id: string;
  url: string;
  name: string;
  specialty: string;
  pearlTopic: string;
  topic: string;
  group: string;
  status: string;
  questionStem: string;
  questionHtml: string | null;
  incomplete: boolean;
  options: QuestionOption[];
  correctAnswer: AnswerKey;
  correctAnswerText: string;
  explanationHtml: string;
  pearlHtml: string;
}

export interface ContentFile {
  version: number;
  specialty: string;
  label: string;
  sourceDatabase: string;
  questionCount: number;
  questions: Question[];
}

export interface McqPlayItem {
  id: string;
  mode: 'mcq';
  questionId: string;
  group: string;
  topic: string;
}

export interface SwipeSortPlayItem {
  id: string;
  mode: 'swipeSort';
  questionId: string;
  optionKey: AnswerKey;
  optionText: string;
  truth: boolean;
  group: string;
  topic: string;
}

export interface PairMatchPair {
  questionId: string;
  leftText: string;
  rightText: string;
  group: string;
  topic: string;
}

export interface PairMatchRound {
  id: string;
  mode: 'pairMatch';
  pairs: PairMatchPair[];
}

export interface BucketMatchTile {
  questionId: string;
  text: string;
}

export interface BucketMatchBucket {
  group: string;
  tiles: BucketMatchTile[];
}

export interface BucketMatchRound {
  id: string;
  mode: 'bucketMatch';
  buckets: BucketMatchBucket[];
}

export interface PlayItemsFile {
  version: number;
  seed: string;
  modes: {
    mcq: McqPlayItem[];
    swipeSort: SwipeSortPlayItem[];
    pairMatch: PairMatchRound[];
    bucketMatch: BucketMatchRound[];
  };
}

export interface ManifestEntry {
  specialty: string;
  label: string;
  contentFile: string;
  playFile: string;
  questionCount: number;
  groups: string[];
}

export interface Manifest {
  version: number;
  generatedBy: string;
  specialties: ManifestEntry[];
}
