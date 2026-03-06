import { Question, Subject } from '../types';
import { STATIC_QUESTIONS } from '../data/questions';

const globalAskedQuestions = new Set<string>();

export const generateEducationalContent = async (
  type: 'combat' | 'puzzle' | 'boss',
  subject?: Subject
): Promise<Question> => {
  
  // Pick a random subject if none is provided
  const selectedSubject = subject || Object.values(Subject)[Math.floor(Math.random() * 3)];
  
  // Determine target difficulty based on battle type
  // 'boss' type battles ONLY get 'boss' questions (last 25 of each block)
  // 'combat' type battles ONLY get 'explorer' questions (first 75 of each block)
  const targetDifficulty = type === 'boss' ? 'boss' : 'explorer';

  // Filter questions by Subject AND Difficulty AND ensuring not already asked
  let subjectQuestions = STATIC_QUESTIONS.filter(q => 
    q.subject === selectedSubject && 
    q.difficulty === targetDifficulty &&
    !globalAskedQuestions.has(q.text)
  );
  
  // Fallback 1: If we ran out of new questions for this difficulty, reset exclusion list for this specific set
  if (subjectQuestions.length === 0) {
    subjectQuestions = STATIC_QUESTIONS.filter(q => 
        q.subject === selectedSubject && 
        q.difficulty === targetDifficulty
    );
  }

  // Fallback 2: If somehow still empty (shouldn't happen with 300 questions), look for any difficulty
  if (subjectQuestions.length === 0) {
     subjectQuestions = STATIC_QUESTIONS.filter(q => q.subject === selectedSubject);
  }

  // Pick one at random
  if (subjectQuestions.length > 0) {
    const randomIndex = Math.floor(Math.random() * subjectQuestions.length);
    const selectedQuestion = subjectQuestions[randomIndex];
    globalAskedQuestions.add(selectedQuestion.text);
    return selectedQuestion;
  }

  // Ultimate Fallback
  return {
    text: "¿Cuánto es 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctIndex: 1,
    explanation: "Es 4.",
    subject: Subject.MATH,
    difficulty: 'explorer'
  };
};