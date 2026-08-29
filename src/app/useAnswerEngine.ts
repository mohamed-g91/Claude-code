// Wires one graded answer, from any mode, through SM-2 + scoring + streak +
// mastery and persists all of it to storage. This is the one place every
// mode calls into so "every mode grades the underlying question the same
// way an MCQ would" (per the plan) is true by construction.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialCardState, gradeFromCorrectness, review } from '../domain/srs';
import { applyAnswer, initScoreState, type PlayMode } from '../domain/scoring';
import { recordActivity } from '../domain/streak';
import { recordGroupAnswer } from '../domain/mastery';
import type { StorageProvider, Profile } from '../storage/provider';
import { defaultProfile } from '../storage/provider';

export interface SubmitAnswerArgs {
  questionId: string;
  group: string;
  mode: PlayMode;
  isCorrect: boolean;
  optionKey?: string;
  fast?: boolean;
}

export function useAnswerEngine(storage: StorageProvider) {
  const [profile, setProfile] = useState<Profile>(defaultProfile());
  const [ready, setReady] = useState(false);
  const profileRef = useRef<Profile>(profile);

  useEffect(() => {
    let cancelled = false;
    storage.getProfile().then((p) => {
      if (cancelled) return;
      profileRef.current = p;
      setProfile(p);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const submitAnswer = useCallback(
    async ({ questionId, group, mode, isCorrect, optionKey, fast }: SubmitAnswerArgs) => {
      const now = new Date();

      const prevCard = (await storage.getCardState(questionId)) ?? createInitialCardState(now);
      const quality = gradeFromCorrectness(isCorrect, fast);
      const newCard = review(prevCard, quality, now);
      await storage.saveCardState(questionId, newCard);

      await storage.recordAttempt({ questionId, mode, isCorrect, optionKey, answeredAt: now.toISOString() });

      const prevGroupStats = await storage.getGroupStats(group);
      const newGroupStats = recordGroupAnswer(prevGroupStats, isCorrect);
      await storage.saveGroupStats(group, newGroupStats);

      const current = profileRef.current ?? defaultProfile();
      const newScore = applyAnswer(current.score ?? initScoreState(), mode, isCorrect);
      const newStreak = recordActivity(current.streak, now);
      const newProfile: Profile = { ...current, score: newScore, streak: newStreak };
      await storage.saveProfile(newProfile);
      profileRef.current = newProfile;
      setProfile(newProfile);

      return { newCard, newGroupStats, newProfile };
    },
    [storage]
  );

  return { profile, ready, submitAnswer };
}
