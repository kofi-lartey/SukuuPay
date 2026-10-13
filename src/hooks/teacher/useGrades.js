import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchClassGrades,
  fetchStudentGrades,
  saveGrade,
  saveGradesBulk,
  compileClassReportCards,
  publishClassReportCards,
} from '../../services/teacher/grades';

/**
 * Grades reads.
 *
 * `subject` is part of the key because it is part of the question: one class
 * has one grades column per subject, and a teacher who switches from Maths to
 * English must not be shown Maths scores in an English grid. Without it in the
 * key, React Query would serve the cached response and every student would
 * appear already graded.
 */
export const useClassGrades = (className, { term, academicYear, subject } = {}) =>
  useQuery({
    queryKey: ['teacher', 'grades', className, term, academicYear, subject],
    queryFn: () => fetchClassGrades(className, { term, academicYear, subject }),
    enabled: Boolean(className),
    select: (response) => response.data,
  });

export const useStudentGrades = (studentId, { term, academicYear } = {}) =>
  useQuery({
    queryKey: ['teacher', 'student-grades', studentId, term, academicYear],
    queryFn: () => fetchStudentGrades(studentId, { term, academicYear }),
    enabled: Boolean(studentId),
    select: (response) => response.data,
  });

/**
 * Saves grades for a whole class in one call.
 *
 * The single-grade mutation exists for a correction after the fact; the bulk
 * one is the working path, and both invalidate by `variables.className` — a
 * prefix match, so the term/subject/academic-year slices underneath it are
 * refetched too. Invalidating the bare `['teacher', 'grades', className]`
 * key rather than the exact one the page holds is what stops a subject switch
 * returning a stale column.
 */
export const useSaveGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveGrade,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['teacher', 'grades', variables.className],
      });
    },
  });
};

export const useSaveGradesBulk = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveGradesBulk,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['teacher', 'grades', variables.className],
      });
    },
  });
};

/**
 * Compile and publish terminal report cards.
 *
 * Neither invalidates anything locally, and that is the honest answer rather
 * than an omission: the report cards are not a query this portal reads back.
 * `CompileReports` holds the compile result in component state precisely so
 * the publish button can be gated on it, and publishing clears the class
 * summary — `useClassSummary` — on the next page the teacher opens.
 */
export const useCompileReportCards = () =>
  useMutation({ mutationFn: compileClassReportCards });

export const usePublishReportCards = () =>
  useMutation({ mutationFn: publishClassReportCards });
